import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, Timestamp, increment, getDocs, writeBatch } from 'firebase/firestore';
import { CardVehiculo } from './CardVehiculo';
import { FormularioIngreso } from './FormularioIngreso';
import { ModalDetalleOrden } from './ModalDetalleOrden';
import { CyberLoader } from './CyberLoader';
import { CyberToast, type ToastMessage } from './CyberToast';
import { 
  LayoutDashboard, Clock, Activity, CheckCircle, 
  RefreshCcw, Plus, X, CreditCard, Flame, AlertTriangle, Search,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, Trash2,
  Car, PlusCircle, Shield, User, Smartphone, Hash, Users, Filter, ShoppingBag
} from 'lucide-react';
import { playVFX, resolveVFX, cancelVFX } from './CyberVFX';
import type { Order } from '../types';

export const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void, danger?: boolean } | null>(null);
  const [isRegressionMode, setIsRegressionMode] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // VIEW MODE: Lavadero vs Tienda
  const [viewMode, setViewMode] = useState<'lavadero' | 'tienda'>('lavadero');
  
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  // Custom Date States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  useEffect(() => {
    setLoading(true);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'ordenes'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);

      // Refresh the detail modal
      setSelectedDetailOrder(current => {
        if (!current) return null;
        const updated = ordersData.find(o => o.id === current.id);
        return updated || null;
      });
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const updateStatus = async (id: string, newStatus: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const statusWeights: Record<string, number> = { espera: 0, proceso: 1, listo: 2, pagado: 3, finalizado: 3 };
    const currentWeight = statusWeights[order.estado] || 0;
    const newWeight = statusWeights[newStatus] || 0;

    if (newWeight < currentWeight && order.estado !== 'espera') {
      if (newStatus === 'proceso' || newStatus === 'listo') {
        setIsRegressionMode(true);
        setSelectedDetailOrder(order);
        return;
      }
    }

    let targetStatus = newStatus;
    const isSettled = (order.total || 0) <= (order.montoPagado || 0) || order.pagoCredito;
    
    if (newStatus === 'listo' && isSettled) {
      targetStatus = (order.pagoCredito || order.pagoAnticipado) ? 'finalizado' : 'pagado';
    }

    const orderRef = doc(db, 'ordenes', id);
    const updates: any = { estado: targetStatus };
    
    if (targetStatus === 'pagado' || targetStatus === 'finalizado') {
      updates.montoPagado = order.total;
      updates.servicioPrincipalPagado = true;
      if (order.adicionales) {
        updates.adicionales = order.adicionales.map((ad: any) => ({ ...ad, pagado: true }));
      }
    }

    await updateDoc(orderRef, updates);
  };

  const handlePayDirect = async (id: string) => {
    const orderRef = doc(db, 'ordenes', id);
    const order = orders.find(o => o.id === id);
    if (!order) return;

    await updateDoc(orderRef, { 
      estado: (order.pagoCredito || order.pagoAnticipado) ? 'finalizado' : 'pagado',
      montoPagado: order.total,
      servicioPrincipalPagado: true,
      adicionales: order.adicionales?.map((ad: any) => ({ ...ad, pagado: true })) || []
    });

    if (order.adicionales) {
       await Promise.all(order.adicionales
          .filter(ad => ad.categoria === 'articulo' && ad.svcId)
          .map(ad => updateDoc(doc(db, 'servicios', ad.svcId!), { stock: increment(-(ad.cantidad || 1)) }))
       );
    }
    
    setSelectedDetailOrder(null);
  };

  const wipeTransactionalData = async () => {
    setConfirmModal({
      title: 'BORRADO TOTAL',
      message: 'ESTÁ A PUNTO DE ELIMINAR TODAS LAS ÓRDENES. ESTA ACCIÓN ES IRREVERSIBLE.',
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        playVFX('delete', 'BORRANDO...');
        try {
          const snapshot = await getDocs(query(collection(db, 'ordenes')));
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          resolveVFX('Completado');
        } catch (e) { cancelVFX(); }
        setLoading(false);
        setConfirmModal(null);
      }
    });
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.placa.toUpperCase().includes(searchTerm.toUpperCase()) ||
      o.clienteNombre?.toUpperCase().includes(searchTerm.toUpperCase());
    
    if (viewMode === 'lavadero') return matchesSearch && (!o.idTipoOperacion || o.idTipoOperacion === 'lavadero');
    return matchesSearch && (
      o.idTipoOperacion === 'tienda' || 
      o.adicionales?.some(ad => ad.categoria === 'articulo' && ad.pagado)
    );
  });

  const getColOrders = (status: string) => filteredOrders.filter(o => o.estado === status);

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none animate-panel-entry">
      
      {/* HEADER: MODE & ACTIONS */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between glass-panel p-4 border border-slate-800">
         
         <div className="flex items-center gap-6">
            {/* TABS SWITCHER */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
               <button 
                onClick={() => setViewMode('lavadero')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                  viewMode === 'lavadero' ? 'bg-brand-cyan text-slate-950 shadow-lg' : 'text-slate-600 hover:text-slate-400'
                }`}
               >
                 <Car size={14} /> Lavadero
               </button>
               <button 
                onClick={() => setViewMode('tienda')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                  viewMode === 'tienda' ? 'bg-brand-gold text-slate-950 shadow-lg' : 'text-slate-600 hover:text-slate-400'
                }`}
               >
                 <ShoppingBag size={14} /> Tienda
               </button>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-800 pl-6">
               <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                  <input 
                    type="text"
                    placeholder="BUSCAR..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-black text-white focus:outline-none focus:border-brand-cyan/40 transition-all uppercase"
                  />
               </div>
            </div>
         </div>

         <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-3 bg-slate-950 border border-slate-800 p-2.5 px-5 rounded-xl hover:border-slate-600 transition-all group"
            >
              <Calendar className="w-4 h-4 text-slate-600 group-hover:text-brand-cyan" />
              <span className="text-xs font-black text-white tracking-widest">{formatDateDisplay(selectedDate)}</span>
            </button>

            <button 
              onClick={wipeTransactionalData}
              className="p-3.5 bg-slate-950 border border-brand-danger/20 text-brand-danger/40 hover:text-brand-danger rounded-xl transition-all"
            ><Trash2 size={16} /></button>

            <button 
              onClick={() => { setEditingOrder(null); setIsEntryModalOpen(true); }}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
                viewMode === 'lavadero' ? 'bg-brand-cyan text-slate-950 shadow-brand-cyan/20' : 'bg-brand-gold text-slate-950 shadow-brand-gold/20'
              }`}
            >
               <Plus size={16} strokeWidth={4} />
               {viewMode === 'lavadero' ? 'Nuevo Ingreso' : 'Venta Tienda'}
            </button>
         </div>
      </div>

      {/* METRICS BAR */}
      <div className={`grid grid-cols-2 gap-3 ${viewMode === 'lavadero' ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
         {(viewMode === 'lavadero' ? [
           { label: 'Total Registros', value: filteredOrders.length, color: 'text-white' },
           { label: 'En Proceso', value: getColOrders('proceso').length, color: 'text-brand-cyan' },
           { label: 'Por Cobrar', value: getColOrders('listo').length, color: 'text-brand-green' },
           { label: 'Caja Día', value: `$${filteredOrders.filter(o => o.estado === 'pagado' || o.estado === 'finalizado').reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString()}`, color: 'text-brand-gold' },
           { label: 'Créditos', value: filteredOrders.filter(o => o.pagoCredito).length, color: 'text-brand-danger' },
           { label: 'Eficiencia', value: `${orders.length > 0 ? Math.round((filteredOrders.filter(o => o.estado === 'pagado' || o.estado === 'finalizado').length / orders.length) * 100) : 0}%`, color: 'text-slate-500' }
         ] : [
           { label: 'Total Ventas', value: filteredOrders.length, color: 'text-white' },
           { label: 'Artículos Vendidos', value: filteredOrders.reduce((acc, o) => acc + (o.adicionales?.filter(ad => ad.categoria === 'articulo' && ad.pagado).reduce((a, ad) => a + (ad.cantidad || 0), 0) || 0), 0), color: 'text-brand-gold' },
           { label: 'Caja Día (Art.)', value: `$${filteredOrders.filter(o => !o.pagoCredito).reduce((acc, o) => acc + (o.adicionales?.filter(ad => ad.categoria === 'articulo' && ad.pagado).reduce((a, ad) => a + (ad.precio * (ad.cantidad || 1)), 0) || 0), 0).toLocaleString()}`, color: 'text-brand-cyan' },
           { label: 'Valor en Inventario', value: `$${filteredOrders.reduce((acc, o) => acc + (o.adicionales?.filter(ad => ad.categoria === 'articulo' && ad.pagado).reduce((a, ad) => a + (ad.precio * (ad.cantidad || 1)), 0) || 0), 0).toLocaleString()}`, color: 'text-white' }
         ]).map((stat, i) => (
           <div key={i} className="glass-panel p-3 border border-slate-800/50">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-sm font-black ${stat.color || 'text-white'}`}>{stat.value}</p>
           </div>
         ))}
      </div>

      {/* CONTENT: DASHBOARD VS TIENDA TABLE */}
      <div key={viewMode} className="animate-panel-entry">
        {viewMode === 'lavadero' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {['espera', 'proceso', 'listo', 'pagado'].map(col => (
             <div key={col} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 px-1">
                   <h3 className="font-black text-white text-[9px] tracking-widest uppercase opacity-60">{col}</h3>
                   <span className="text-[9px] font-black text-slate-700 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-900">{getColOrders(col === 'pagado' ? 'pagado' : col).length}</span>
                </div>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pt-2">
                   {filteredOrders.filter(o => col === 'pagado' ? (o.estado === 'pagado' || o.estado === 'finalizado') : o.estado === col).map(order => (
                      <CardVehiculo key={order.id} order={order} onUpdateStatus={updateStatus} onDelete={id => setOrderToDelete(id)} onEdit={handleEdit => { setEditingOrder(order); setIsEntryModalOpen(true); }} onClick={() => setSelectedDetailOrder(order)} />
                   ))}
                </div>
             </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel overflow-hidden border border-slate-800 shadow-2xl">
           <table className="w-full text-left">
              <thead className="bg-slate-950 border-b border-slate-800">
                 <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    <th className="p-5">TRANSACCIÓN</th>
                    <th className="p-5">CLIENTE</th>
                    <th className="p-5">PRODUCTOS</th>
                    <th className="p-5 text-right">TOTAL</th>
                    <th className="p-5 text-center">ESTADO</th>
                    <th className="p-5 text-right">ACCIONES</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                 {filteredOrders.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-900/40 transition-all group">
                       <td className="p-5">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-mono font-black text-white">#{sale.id?.slice(-6).toUpperCase()}</span>
                             {sale.idTipoOperacion === 'lavadero' && (
                               <span className="text-[7px] font-black text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-1.5 py-0.5 rounded mt-1 w-fit">PATIO</span>
                             )}
                          </div>
                       </td>
                       <td className="p-5">
                          <p className="text-[11px] font-black text-white uppercase">{sale.clienteNombre || 'CLIENTE ANONIMO'}</p>
                          <p className="text-[9px] text-slate-600 font-bold">{sale.clienteCedula || ''}</p>
                       </td>
                       <td className="p-5">
                          <div className="flex flex-wrap gap-2">
                             {(sale.adicionales?.filter(ad => ad.categoria === 'articulo' && ad.pagado)
                                .reduce((acc, curr) => {
                                   const existing = acc.find((a:any) => a.nombre === curr.nombre);
                                   if (existing) existing.cantidad += curr.cantidad;
                                   else acc.push({ ...curr });
                                   return acc;
                                }, [] as any[]) || []).map((ad:any, idx:number) => (
                                <span key={idx} className="text-[9px] font-black text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">{ad.nombre} x{ad.cantidad}</span>
                             ))}
                          </div>
                       </td>
                       <td className="p-5 text-right">
                          <div className="flex flex-col items-end">
                             <span className="text-base font-black text-white tabular-nums">
                               ${ (sale.idTipoOperacion === 'tienda' ? sale.total : (sale.adicionales?.filter(ad => ad.categoria === 'articulo' && ad.pagado).reduce((a, b) => a + (b.precio * b.cantidad), 0) || 0)).toLocaleString() }
                             </span>
                             {sale.idTipoOperacion === 'lavadero' && (
                               <span className="text-[8px] text-slate-600 font-bold uppercase">Pagado en Patio</span>
                             )}
                          </div>
                       </td>
                       <td className="p-5 text-center">
                          <span className={`text-[8px] font-black px-3 py-1 rounded-full border ${sale.pagoCredito ? 'border-brand-cyan text-brand-cyan' : 'border-brand-green text-brand-green'}`}>
                             {sale.pagoCredito ? 'CRÉDITO' : 'LIQUIDADO'}
                          </span>
                       </td>
                       <td className="p-5 text-right">
                          <div className="flex justify-end gap-2">
                             {sale.pagoCredito && <button onClick={() => handlePayDirect(sale.id!)} className="p-2 bg-brand-cyan/10 text-brand-cyan rounded-lg hover:bg-brand-cyan hover:text-slate-950 transition-all"><CheckCircle size={14} /></button>}
                             <button onClick={() => setSelectedDetailOrder(sale)} className="p-2 bg-slate-900 text-slate-500 rounded-lg hover:text-white"><Activity size={14} /></button>
                             <button onClick={() => setOrderToDelete(sale.id!)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                          </div>
                       </td>
                    </tr>
                 ))}
                 {filteredOrders.length === 0 && <tr><td colSpan={6} className="p-20 text-center text-[10px] font-black text-slate-700 uppercase tracking-widest italic">Sin registros para esta fecha</td></tr>}
              </tbody>
           </table>
        </div>
        )}
      </div>

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setIsEntryModalOpen(false)}></div>
          <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto no-scrollbar rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-300">
             <FormularioIngreso 
               onSuccess={() => setIsEntryModalOpen(false)} 
               onClose={() => setIsEntryModalOpen(false)}
               initialMode={viewMode}
               allOrders={orders} 
               initialData={editingOrder} 
               onShowToast={showToast} 
             />
          </div>
        </div>
      )}

      {/* Re-usable Modals */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsCalendarOpen(false)}></div>
           <div className="relative bg-slate-950 border border-slate-800 p-8 rounded-[2rem] shadow-4xl animate-in fade-in zoom-in-95 duration-300">
              <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-6">Selección Operativa de Fecha</h4>
              <input 
                type="date" 
                value={selectedDate.toISOString().split('T')[0]} 
                onChange={(e) => { setSelectedDate(new Date(e.target.value)); setIsCalendarOpen(false); }}
                className="bg-slate-900 border border-slate-800 text-white p-4 rounded-xl font-black text-lg focus:outline-none focus:border-brand-cyan"
              />
           </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setOrderToDelete(null)}></div>
          <div className="relative w-full max-w-sm glass-panel p-8 rounded-[2rem] border border-red-500/20 text-center animate-in fade-in zoom-in-95 duration-300">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-6" />
            <h3 className="text-xl font-black text-white uppercase mb-2">Eliminar Registro</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-8">Esta acción es permanente e irreversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 bg-slate-900 text-slate-500 rounded-xl font-black text-[10px] uppercase">Cancelar</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'ordenes', orderToDelete)); setOrderToDelete(null); }} className="flex-1 py-4 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase">Borrar</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={() => setConfirmModal(null)}></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-white uppercase mb-4">{confirmModal.title}</h3>
            <p className="text-xs text-slate-500 mb-8 uppercase font-bold tracking-widest">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 rounded-xl bg-slate-950 text-slate-600 font-black uppercase">No</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-4 rounded-xl bg-brand-cyan text-slate-950 font-black uppercase">Sí</button>
            </div>
          </div>
        </div>
      )}

      {selectedDetailOrder && <ModalDetalleOrden order={selectedDetailOrder} isOpen={!!selectedDetailOrder} onClose={() => setSelectedDetailOrder(null)} onPay={handlePayDirect} isRegression={isRegressionMode} />}
      <CyberToast toasts={toasts} onClose={removeToast} />
      {loading && <div className="fixed bottom-10 right-10 z-[500]"><CyberLoader size={40} /></div>}
    </div>
  );
};
