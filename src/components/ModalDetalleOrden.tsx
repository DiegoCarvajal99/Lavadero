import React from 'react';
import { X, User, Phone, Hash, CreditCard, ShieldCheck, CheckCircle2, Car, Package, DollarSign, Search, Plus, Loader2, Save, Undo2, AlertTriangle, Check, ChevronDown, ChevronRight, PlusCircle } from 'lucide-react';
import { MotorcycleIcon } from './Icons';
import { CyberLoader } from './CyberLoader';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { playVFX, resolveVFX, cancelVFX } from './CyberVFX';
import type { Order, Service } from '../types';

interface Props {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onPay: (id: string) => void;
  isRegression?: boolean;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ModalDetalleOrden: React.FC<Props> = ({ order, isOpen, onClose, onPay, isRegression, onShowToast }) => {
  const [stagedAdditions, setStagedAdditions] = React.useState<any[]>([]);
  const [workingAdicionales, setWorkingAdicionales] = React.useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>([]);
  const [isPrincipalPaidSession, setIsPrincipalPaidSession] = React.useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);
  const [additionSearch, setAdditionSearch] = React.useState('');
  const [showResults, setShowResults] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [selectedSvcForQty, setSelectedSvcForQty] = React.useState<Service | null>(null);
  const [tempQty, setTempQty] = React.useState(1);

  React.useEffect(() => {
    if (!isOpen) return;
    setStagedAdditions([]);
    setWorkingAdicionales(order.adicionales || []);
    setIsPrincipalPaidSession(!!order.servicioPrincipalPagado);
    setExpandedGroups([]);
    setShowCancelConfirm(false);
    const q = query(collection(db, 'servicios'), where('esAdicional', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const svcs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      // Filter by vehicle type
      setServices(svcs.filter(s => s.tipoVehiculo === 'ambos' || s.tipoVehiculo === order.tipo));
    });
    return () => unsubscribe();
  }, [isOpen, order.id]);

  if (!isOpen) return null;

  const handleAddWithQty = (svc: Service) => {
    if (svc.categoria === 'articulo') {
      setSelectedSvcForQty(svc);
      setTempQty(1);
    } else {
      executeAdd(svc, 1);
    }
  };

  const executeAdd = (svc: Service, qty: number) => {
    // Validar stock para artículos
    if (svc.categoria === 'articulo') {
      const stockDisponible = svc.stock || 0;
      
      // Calcular cuánto hay ya en el carrito (stagedAdditions)
      const cantidadEnCarrito = stagedAdditions
        .filter(item => item.svcId === svc.id)
        .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
      
      const totalSolicitado = cantidadEnCarrito + qty;

      if (stockDisponible <= 0) {
        onShowToast?.('error', `PRODUCTO AGOTADO: ${svc.nombre} no tiene existencias disponibles.`);
        return;
      }

      if (totalSolicitado > stockDisponible) {
        onShowToast?.('error', `STOCK INSUFICIENTE: Solo puedes agregar ${stockDisponible - cantidadEnCarrito} unidades más de ${svc.nombre}.`);
        return;
      }

      // Alerta de stock bajo (<= 5 después de la adición)
      const stockRestante = stockDisponible - totalSolicitado;
      if (stockRestante <= 5) {
        onShowToast?.('info', `ATENCIÓN: Stock bajo para ${svc.nombre}. Quedan ${stockRestante} unidades.`);
      }
    }

    const newAdicional = {
      svcId: svc.id || '',
      categoria: svc.categoria || 'servicio',
      nombre: svc.nombre || 'Servicio Desconocido',
      precio: Number(svc.precio) || 0,
      comision: Number(svc.comision) || 0,
      cantidad: Number(qty) || 1,
      pagado: false // Default to unpaid until toggled
    };

    setStagedAdditions(prev => [...prev, newAdicional]);
    playVFX('modify', 'AÑADIENDO ITEM...');
    setAdditionSearch('');
    setShowResults(false);
    setSelectedSvcForQty(null);
  };

  const toggleStagedPaid = (index: number) => {
    setStagedAdditions(prev => prev.map((item, i) => 
      i === index ? { ...item, pagado: !item.pagado } : item
    ));
  };

  const toggleExistingPaid = (index: number) => {
    // Prevent unchecking if already paid in DB
    if (order.adicionales?.[index]?.pagado) return;
    
    setWorkingAdicionales(prev => prev.map((item, i) => 
      i === index ? { ...item, pagado: !item.pagado } : item
    ));
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleAllGroup = (name: string, targetValue: boolean) => {
    setWorkingAdicionales(prev => prev.map((item, i) => {
      // Don't allow unchecking items that were already paid in the DB
      const wasPaid = order.adicionales?.[i]?.pagado;
      if (item.nombre === name && !wasPaid) {
        return { ...item, pagado: targetValue };
      }
      return item;
    }));
    setStagedAdditions(prev => prev.map(item => 
      item.nombre === name ? { ...item, pagado: targetValue } : item
    ));
  };

  // Grouping Engine
  const groupedData = React.useMemo(() => {
    const combined = [
      ...workingAdicionales.map((ad, i) => ({ ...ad, originalIndex: i, isStaged: false })),
      ...stagedAdditions.map((ad, i) => ({ ...ad, originalIndex: i, isStaged: true }))
    ];

    return combined.reduce((acc: any, item) => {
      if (!acc[item.nombre]) {
        acc[item.nombre] = {
          nombre: item.nombre,
          batches: [],
          totalQty: 0,
          pendingQty: 0,
          totalPrice: 0,
          pendingPrice: 0,
          allPaid: true
        };
      }
      acc[item.nombre].batches.push(item);
      acc[item.nombre].totalQty += (item.cantidad || 1);
      acc[item.nombre].totalPrice += (item.precio * (item.cantidad || 1));
      
      if (!item.pagado) {
        acc[item.nombre].allPaid = false;
        acc[item.nombre].pendingQty += (item.cantidad || 1);
        acc[item.nombre].pendingPrice += (item.precio * (item.cantidad || 1));
      }
      
      // Track if it was already paid in the database (Original)
      const isOriginallyPaid = !item.isStaged && order.adicionales?.[item.originalIndex]?.pagado;
      if (!acc[item.nombre].hasOwnProperty('allOriginallyPaid')) {
         acc[item.nombre].allOriginallyPaid = true;
      }
      if (!isOriginallyPaid) acc[item.nombre].allOriginallyPaid = false;

      return acc;
    }, {});
  }, [workingAdicionales, stagedAdditions, order.adicionales]);

  // Selection Calculator (What am I paying right now?)
  const totalSeleccionado = React.useMemo(() => {
    let total = 0;
    
    // Principal service if toggled to paid in this session
    if (isPrincipalPaidSession && !order.servicioPrincipalPagado) {
       total += (order.total - (order.adicionales?.reduce((acc, curr) => acc + (curr.precio * (curr.cantidad || 1)), 0) || 0));
    }

    // Existing items toggled to paid
    workingAdicionales.forEach((ad, i) => {
       const original = order.adicionales?.[i];
       if (ad.pagado && !original?.pagado) {
         total += (ad.precio * (ad.cantidad || 1));
       }
    });

    // Staged items that are marked as paid
    stagedAdditions.forEach(ad => {
       if (ad.pagado) total += (ad.precio * (ad.cantidad || 1));
    });

    return total;
  }, [workingAdicionales, stagedAdditions, isPrincipalPaidSession, order]);

  const handleSave = async () => {
    if (isUpdating || (stagedAdditions.length === 0 && totalSeleccionado === 0)) return;
    if (!order.id) {
       onShowToast?.('error', 'Error: El vehículo no tiene una ID válida');
       return;
    }

    setIsUpdating(true);
    try {
      playVFX('modify', 'PROCESANDO CAMBIOS...');
      const batch = writeBatch(db);
      const orderRef = doc(db, 'ordenes', order.id);
      
      const newStagedTotal = stagedAdditions.reduce((acc, curr) => acc + (Number(curr.precio || 0) * Number(curr.cantidad || 1)), 0);
      const newStagedPagadoTotal = stagedAdditions.filter(a => a.pagado).reduce((acc, curr) => acc + (Number(curr.precio || 0) * Number(curr.cantidad || 1)), 0);
      
      const sessionPaymentsTotal = workingAdicionales.reduce((acc, curr, i) => {
         const original = order.adicionales?.[i];
         if (curr.pagado && !original?.pagado) {
             return acc + (curr.precio * (curr.cantidad || 1));
         }
         return acc;
      }, 0);

      const stagedComision = stagedAdditions
        .filter(a => a.categoria === 'servicio')
        .reduce((acc, curr) => acc + (Number(curr.precio || 0) * (Number(curr.comision || 0)) * Number(curr.cantidad || 1)), 0);

      const newTotal = (order.total || 0) + newStagedTotal;
      const newMontoPagado = (order.montoPagado || 0) + newStagedPagadoTotal + sessionPaymentsTotal;
      const newComisionMonto = (order.comisionMonto || 0) + stagedComision;
      
      const isClosing = newTotal <= newMontoPagado;
      const hasNewService = stagedAdditions.some(a => a.categoria === 'servicio');
      
      const finalAdicionales = [...workingAdicionales, ...stagedAdditions.map(a => ({
        ...a,
        pagado: isClosing ? true : a.pagado
      }))];

      const updateData: any = {
        adicionales: finalAdicionales,
        total: newTotal,
        montoPagado: newMontoPagado,
        comisionMonto: newComisionMonto,
        servicioPrincipalPagado: isClosing ? true : isPrincipalPaidSession
      };

      if (hasNewService) {
        // Services require labor -> Move to Operation queue
        updateData.estado = 'proceso';
      } else if (isClosing) {
        // Articles only and paid -> Return to/Stay in final state if it was already finished
        const wasFinished = order.estado === 'pagado' || order.estado === 'finalizado';
        if (wasFinished) {
          updateData.estado = (order.pagoAnticipado || order.pagoCredito) ? 'finalizado' : 'pagado';
        } else {
          updateData.estado = order.estado;
        }
      } else {
        // Articles only and NOT paid -> Move to Collection queue (unless already in processing)
        const isLaborState = order.estado === 'proceso' || order.estado === 'espera';
        updateData.estado = isLaborState ? order.estado : 'listo';
      }

      batch.update(orderRef, updateData);

      // Deduct stock for articles
      const stockUpdates = stagedAdditions
        .filter(a => a.categoria === 'articulo')
        .reduce((acc, curr) => {
          acc[curr.svcId] = (acc[curr.svcId] || 0) + (curr.cantidad || 1);
          return acc;
        }, {} as Record<string, number>);

      Object.entries(stockUpdates).forEach(([svcId, totalQty]) => {
        const svcRef = doc(db, 'servicios', svcId);
        batch.update(svcRef, { stock: increment(-totalQty) });
      });

      await batch.commit();
      resolveVFX('Cambios guardados con éxito');
      onClose();
    } catch (error: any) {
      console.error("Error saving additions:", error);
      onShowToast?.('error', `ERROR AL GUARDAR: ${error.message || 'Fallo en la comunicación con base de datos'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    if (stagedAdditions.length > 0) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const totalPagado = order.montoPagado || 0;
  const saldoPendiente = order.total - totalPagado;
  const isFinished = (order.estado === 'pagado' || order.estado === 'finalizado') && saldoPendiente <= 0;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose}></div>
      
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header Header */}
        <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl bg-slate-900 border border-slate-800 ${order.estado === 'proceso' ? 'text-brand-cyan shadow-[0_0_15px_rgba(0,247,255,0.1)]' : 'text-slate-500'}`}>
              {order.tipo === 'carro' ? <Car className="w-8 h-8" /> : <MotorcycleIcon className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{order.placa}</h3>
                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                  order.estado === 'proceso' ? 'border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5' : 'border-slate-800 text-slate-500'
                }`}>
                  ID: {order.id?.slice(-6)}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  order.estado === 'espera' ? 'text-slate-500' :
                  order.estado === 'proceso' ? 'text-brand-cyan' :
                  order.estado === 'listo' ? 'text-brand-green' : 'text-brand-gold'
                }`}>
                  {order.estado}
                </span>
                <span className="text-slate-700 mx-1">•</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Ingreso: {new Date(order.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={(!isRegression || stagedAdditions.length > 0) ? handleCancel : undefined} 
            className={`p-2 rounded-full transition-all border border-transparent ${(!isRegression || stagedAdditions.length > 0) ? 'hover:bg-slate-900 text-slate-500 hover:text-white hover:border-slate-800' : 'text-slate-800 cursor-not-allowed'}`}
          >
            <X size={24} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-0 ${(showResults || selectedSvcForQty) ? 'pb-40' : ''}`}>
          
          {/* PRIMARY COLUMN: TRANSACTIONAL (8/12) */}
          <div className="lg:col-span-8 p-6 space-y-6 border-r border-slate-800/50">
          {/* Service Info */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 border-l-2 border-brand-cyan pl-3">
                <Package className="w-3.5 h-3.5 text-brand-cyan" />
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Productos y Servicios</h4>
             </div>
             <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-4 space-y-3">
                <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-xl border border-slate-800/50">
                   <div className="flex items-center gap-3">
                    <div 
                      onClick={() => !order.servicioPrincipalPagado && setIsPrincipalPaidSession(!isPrincipalPaidSession)}
                      className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                        (order.servicioPrincipalPagado || order.pagoAnticipado) 
                          ? 'bg-brand-green border-brand-green text-slate-950 cursor-not-allowed shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                          : isPrincipalPaidSession 
                            ? 'bg-brand-blue border-brand-blue text-slate-950 shadow-[0_0_10px_rgba(0,102,255,0.3)]'
                            : 'border-slate-800 text-transparent hover:border-brand-blue/40 cursor-pointer'
                      }`}
                    >
                      <Check size={12} strokeWidth={4} />
                    </div>
                    <div>
                      <h5 className="font-black text-white uppercase tracking-tight text-sm leading-none">
                        {order.servicioNombre}
                      </h5>
                      <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Servicio Base</span>
                    </div>
                  </div>
                   <span className="text-xs font-mono text-brand-green font-black">${(order.total - (order.adicionales?.reduce((acc, curr) => acc + (curr.precio * (curr.cantidad || 1)), 0) || 0)).toLocaleString()}</span>
                </div>
                
                {((workingAdicionales.length > 0) || stagedAdditions.length > 0) && (
                   <div className="pt-2 space-y-3">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest pl-1">Consumos y Adicionales</p>
                      
                      <div className="space-y-2">
                        {Object.values(groupedData).map((group: any) => (
                           <div key={group.nombre} className="bg-slate-900/30 rounded-2xl border border-slate-800 overflow-hidden transition-all">
                              {/* Group Header */}
                              <div className="p-3 flex justify-between items-center transition-colors">
                                 <div className="flex items-center gap-3">
                                    {/* Select All Toggle */}
                                    <div 
                                       onClick={() => {
                                          if (group.allOriginallyPaid) return;
                                          // If all batches in UI are checked (either Green or Cyan) -> Uncheck session ones
                                          const allCurrentlyChecked = group.batches.every((b: any) => b.pagado);
                                          toggleAllGroup(group.nombre, !allCurrentlyChecked);
                                       }}
                                       className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                          group.allOriginallyPaid 
                                          ? 'bg-brand-green border-brand-green text-slate-950 shadow-[0_0_10px_rgba(34,197,94,0.3)] cursor-not-allowed' 
                                          : group.batches.some((b: any) => b.pagado && !(b.isStaged ? false : order.adicionales?.[b.originalIndex]?.pagado))
                                             ? 'bg-brand-blue border-brand-blue text-slate-950 shadow-[0_0_10px_rgba(0,102,255,0.3)] cursor-pointer'
                                             : 'border-slate-800 text-transparent hover:border-brand-blue/40 cursor-pointer'
                                       }`}
                                    >
                                       <Check size={12} strokeWidth={4} />
                                    </div>

                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${group.allPaid ? 'bg-brand-green/10 border-brand-green/20 text-brand-green' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                       <Package size={16} />
                                    </div>
                                    <div>
                                       <p className="text-[10px] font-black text-white uppercase leading-none">{group.nombre} <span className="text-brand-cyan text-[8px]">{group.allPaid ? `(TOTAL x${group.totalQty})` : `x${group.pendingQty}`}</span></p>
                                       <p className="text-[7px] font-bold text-slate-500 uppercase mt-0.5">{group.allPaid ? 'LIQUIDADO COMPLETAMENTE' : `${group.batches.filter((b:any) => !b.pagado).length} RONDAS PENDIENTES`}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black font-mono text-slate-400">
                                      ${(group.allPaid ? group.totalPrice : group.pendingPrice).toLocaleString()}
                                    </span>
                                    <button 
                                       onClick={() => toggleGroup(group.nombre)}
                                       className={`p-1.5 rounded-lg border transition-all ${expandedGroups.includes(group.nombre) ? 'bg-brand-cyan text-slate-950 border-brand-cyan' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-brand-cyan'}`}
                                    >
                                       {expandedGroups.includes(group.nombre) ? <ChevronDown size={14} /> : <Plus size={14} />}
                                    </button>
                                 </div>
                              </div>

                              {/* Expanded Detail View */}
                              {expandedGroups.includes(group.nombre) && (
                                 <div className="px-3 pb-3 pt-1 border-t border-slate-800/50 bg-slate-950/20 space-y-1 animate-in slide-in-from-top-2 duration-300">
                                    {group.batches.map((batch: any, bIdx: number) => (
                                       <div key={`${group.nombre}-${bIdx}`} className={`flex justify-between items-center p-2 rounded-xl transition-all ${batch.pagado ? 'bg-brand-green/5 border border-brand-green/10' : 'bg-slate-900 border border-transparent'}`}>
                                          <div className="flex items-center gap-3">
                                           <div 
                                               onClick={() => batch.isStaged ? toggleStagedPaid(batch.originalIndex) : toggleExistingPaid(batch.originalIndex)}
                                               className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                                 (batch.isStaged ? false : (order.adicionales?.[batch.originalIndex]?.pagado || order.pagoAnticipado))
                                                   ? 'bg-brand-green border-brand-green text-slate-950 cursor-not-allowed'
                                                   : batch.pagado
                                                     ? 'bg-brand-blue border-brand-blue text-slate-950 shadow-[0_0_10px_rgba(0,102,255,0.3)] cursor-pointer'
                                                     : 'border-slate-800 text-transparent hover:border-brand-blue/40 cursor-pointer'
                                               }`}
                                             >
                                               <Check size={10} strokeWidth={4} />
                                             </div>
                                             <div>
                                                <p className={`text-[9px] font-bold uppercase leading-none ${(batch.pagado || order.pagoAnticipado) ? 'text-brand-green' : 'text-slate-400'}`}>
                                                  {batch.isStaged ? 'NUEVA RONDA' : `RONDA ${bIdx + 1}`} <span className="opacity-60">({batch.cantidad || 1} UNI)</span>
                                                </p>
                                                <span className="text-[6px] font-black text-slate-600 block tracking-[0.1em]">{(batch.pagado || order.pagoAnticipado) ? 'COBRADO' : 'POR COBRAR'}</span>
                                             </div>
                                          </div>
                                          <span className={`text-[9px] font-mono font-black ${batch.pagado ? 'text-brand-green' : 'text-slate-400'}`}>
                                            ${(batch.precio * (batch.cantidad || 1)).toLocaleString()}
                                          </span>
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        ))}
                      </div>
                   </div>
                )}

                {/* Buscador de Adicionales en Caliente */}
                {true && (
                  <div className="pt-3 border-t border-slate-800 relative">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                        <input 
                           type="text" 
                           value={additionSearch}
                           onChange={(e) => {
                              setAdditionSearch(e.target.value.toUpperCase());
                              setShowResults(true);
                           }}
                           onFocus={() => setShowResults(true)}
                           placeholder="AGREGAR MÁS (BUSCAR POR NOMBRE)..."
                           className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-[9px] font-black text-white placeholder:text-slate-700 focus:outline-none focus:border-brand-cyan transition-all"
                        />
                        {isUpdating && <CyberLoader size={12} className="absolute right-3 top-1/2 -translate-y-1/2" />}
                     </div>

                     {/* Search Results Dropdown */}
                     {showResults && additionSearch && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto no-scrollbar">
                           {services
                              .filter(s => s.nombre.toLowerCase().includes(additionSearch.toLowerCase()))
                              .map(s => (
                                 <div 
                                    key={s.id} 
                                    onClick={() => handleAddWithQty(s)}
                                    className="p-2.5 hover:bg-slate-900 cursor-pointer border-b border-slate-900 flex justify-between items-center group transition-colors"
                                 >
                                    <div className="flex flex-col">
                                       <span className="text-[9px] font-black text-white uppercase group-hover:text-brand-cyan transition-colors">{s.nombre}</span>
                                       <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest leading-none">${s.precio.toLocaleString()}</span>
                                    </div>
                                    <Plus className="w-3 h-3 text-brand-cyan opacity-0 group-hover:opacity-100" />
                                 </div>
                              ))
                           }
                           {services.filter(s => s.nombre.toLowerCase().includes(additionSearch.toLowerCase())).length === 0 && (
                              <div className="p-3 text-center">
                                 <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">Sin resultados</span>
                              </div>
                           )}
                        </div>
                     )}
                     {selectedSvcForQty && (
                        <div className="absolute z-[60] left-0 right-0 mt-1 bg-slate-950 border border-brand-gold/50 rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-top-2">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-brand-gold uppercase tracking-[0.2em]">{selectedSvcForQty.nombre}</span>
                              <button onClick={() => setSelectedSvcForQty(null)}><X size={16} className="text-slate-600" /></button>
                           </div>
                           <div className="flex items-center gap-4">
                              <button 
                                 onClick={() => setTempQty(Math.max(1, tempQty - 1))}
                                 className="w-10 h-10 bg-slate-900 rounded-xl border border-slate-800 text-white font-black hover:bg-brand-gold hover:text-slate-900 transition-all"
                              >-</button>
                              <span className="text-xl font-black text-white font-mono w-10 text-center">{tempQty}</span>
                              <button 
                                 onClick={() => setTempQty(tempQty + 1)}
                                 className="w-10 h-10 bg-slate-900 rounded-xl border border-slate-800 text-white font-black hover:bg-brand-gold hover:text-slate-900 transition-all"
                              >+</button>
                              <button 
                                 onClick={() => executeAdd(selectedSvcForQty, tempQty)}
                                 className="flex-1 py-3 bg-brand-gold text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
                              >
                                CONFIRMAR x{tempQty}
                              </button>
                           </div>
                        </div>
                      )}
                     {showResults && <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)}></div>}
                  </div>
                )}

                  <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                    {totalSeleccionado > 0 && (
                      <div className="flex justify-between items-center p-4 rounded-2xl bg-brand-blue text-white shadow-[0_0_30px_rgba(0,102,255,0.4)] animate-in fade-in zoom-in duration-500 scale-105 transform origin-bottom">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-widest opacity-70">Monto Seleccionado</span>
                            <span className="text-xs font-black uppercase tracking-tighter leading-none">A COBRAR AHORA</span>
                         </div>
                         <div className="flex items-center gap-3">
                            <DollarSign className="w-5 h-5" />
                            <span className="text-3xl font-black font-mono tracking-tighter">${totalSeleccionado.toLocaleString()}</span>
                         </div>
                      </div>
                    )}

                </div>
             </div>
          </div>
        </div>

        {/* SECONDARY COLUMN: METADATA & STATUS (4/12) */}
        <div className="lg:col-span-4 bg-slate-950/30 p-6 space-y-8 flex flex-col h-full overflow-y-auto no-scrollbar border-l border-slate-800/20">
            
            {/* Customer Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 border-l-2 border-slate-700 pl-3">
                  <User className="w-4 h-4 text-slate-500" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Información Cliente</h4>
               </div>
               <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-500 border border-slate-700/50 shadow-inner">
                      <User size={24} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-black text-white uppercase tracking-tight truncate">{order.clienteNombre || 'CLIENTE FINAL'}</p>
                      <p className="text-[10px] font-black text-slate-600 font-mono tracking-widest uppercase mt-0.5">{order.clienteCedula || 'Sin Identificación'}</p>
                    </div>
                  </div>
                  {(order.clienteTelefono) && (
                    <div className="pt-3 border-t border-slate-800/50 flex items-center gap-3 group">
                      <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-slate-600 transition-colors group-hover:text-brand-cyan">
                        <Phone size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 tracking-tighter group-hover:text-slate-300 transition-colors">{order.clienteTelefono}</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Operator Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 border-l-2 border-slate-700 pl-3">
                  <CheckCircle2 className="w-4 h-4 text-slate-500" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Operación en Patio</h4>
               </div>
               <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-brand-cyan/5 border border-brand-cyan/20 flex items-center justify-center text-[14px] font-black text-brand-cyan shadow-[0_0_15px_rgba(0,247,255,0.05)]">
                         {order.lavadorNombre?.charAt(0)}
                       </div>
                       <div>
                          <p className="text-[11px] font-black text-white uppercase leading-none">{order.lavadorNombre || 'Sin Asignar'}</p>
                          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Operador Responsable</p>
                       </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Financial Status Section */}
            <div className="space-y-4 pt-4 border-t border-slate-800/50 mt-auto">
               <div className="flex items-center gap-2 border-l-2 border-slate-700 pl-3">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Estado de Cuenta</h4>
               </div>
               <div className="space-y-2">
                 <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/20 border border-slate-800/30 text-slate-500">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em]">Liquidado en Caja</span>
                    <span className="text-sm font-black font-mono tracking-tighter text-slate-400">${totalPagado.toLocaleString()}</span>
                 </div>
                 
                 <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/50 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Créditos/Abonos</span>
                       <div className="flex items-center gap-2">
                          {order.pagoCredito ? (
                            <span className="px-2 py-0.5 rounded bg-brand-gold/10 text-brand-gold text-[7px] font-black uppercase border border-brand-gold/20 leading-none">CREDIT</span>
                          ) : order.pagoAnticipado ? (
                            <span className="px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue text-[7px] font-black uppercase border border-brand-blue/20 leading-none">PREP</span>
                          ) : null}
                          <span className="text-[11px] font-black text-white font-mono">$0</span>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800/50 flex justify-between items-end">
                       <div>
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Saldo Total</span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Pendiente</span>
                       </div>
                       <span className={`text-2xl font-black font-mono tracking-tighter ${saldoPendiente > 0 || stagedAdditions.length > 0 ? 'text-brand-danger drop-shadow-[0_0_10px_rgba(255,0,60,0.2)]' : 'text-brand-green'}`}>
                          ${Math.max(0, (
                            ((order.total || 0) + stagedAdditions.reduce((acc, curr) => acc + (Number(curr.precio || 0) * Number(curr.cantidad || 1)), 0)) -
                            ((order.montoPagado || 0) + stagedAdditions.filter(a => a.pagado).reduce((acc, curr) => acc + (Number(curr.precio || 0) * Number(curr.cantidad || 1)), 0) + 
                              workingAdicionales.reduce((acc, curr, i) => {
                                const original = order.adicionales?.[i];
                                if (curr.pagado && !original?.pagado) return acc + (curr.precio * (curr.cantidad || 1));
                                return acc;
                              }, 0) +
                              (isPrincipalPaidSession && !order.servicioPrincipalPagado ? 
                                (order.total - (order.adicionales?.reduce((acc, curr) => acc + (curr.precio * (curr.cantidad || 1)), 0) || 0)) : 0
                              )
                            )
                          )).toLocaleString()}
                       </span>
                    </div>
                 </div>

                 {/* Current Selection Highlight (Floating Style inside sidebar) */}
                 {totalSeleccionado > 0 && (
                   <div className="p-4 rounded-2xl bg-brand-blue text-white shadow-[0_10px_30px_rgba(0,102,255,0.3)] animate-in slide-in-from-right duration-300 ring-1 ring-white/20 mt-4">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-[8px] font-black uppercase tracking-widest opacity-80">Por Cobrar Ahora</span>
                         <DollarSign size={14} className="opacity-60" />
                      </div>
                      <div className="text-4xl font-black font-mono tracking-tighter leading-none">${totalSeleccionado.toLocaleString()}</div>
                      <p className="text-[8px] font-bold uppercase mt-2 opacity-70 tracking-widest">Calculadora de Batch Táctica</p>
                   </div>
                 )}
               </div>
            </div>

          </div>
        </div>

        {/* REGRESSION NOTIFICATION - Tactical Style */}
        {isRegression && stagedAdditions.length === 0 && (
          <div className="mx-6 p-4 bg-brand-cyan/10 border border-brand-cyan/30 rounded-2xl flex items-center gap-3 animate-pulse">
            <Plus className="w-4 h-4 text-brand-cyan" />
            <p className="text-[9px] font-black text-brand-cyan uppercase tracking-widest leading-normal">
              Modo Regresión Activo: Debe añadir al menos un servicio adicional para regresar el vehículo a proceso.
            </p>
          </div>
        )}

        {/* UNIFIED ACTION FOOTER */}
        {(stagedAdditions.length > 0 || totalSeleccionado > 0 || (saldoPendiente > 0 && !isFinished) || isFinished) && (
          <div className="p-6 bg-slate-950 border-t border-slate-800">
             {/* Staged Changes Actions (Blue Primary) */}
             {(stagedAdditions.length > 0 || totalSeleccionado > 0) ? (
               <div className="flex items-center justify-between gap-4">
                  <button 
                     onClick={handleCancel}
                     className="flex-1 py-4 px-6 rounded-2xl border border-slate-800 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 group"
                  >
                     <Undo2 size={18} className="group-hover:-rotate-45 transition-transform" />
                     <span>Descartar</span>
                  </button>
                  <button 
                     onClick={handleSave}
                     disabled={isUpdating}
                     className="flex-[2] py-4 px-6 rounded-2xl bg-brand-blue text-white font-black uppercase text-[11px] tracking-widest hover:brightness-110 transition-all shadow-[0_0_40px_rgba(0,102,255,0.2)] flex items-center justify-center gap-3 active:scale-95"
                  >
                     {isUpdating ? <CyberLoader size={18} /> : <Save size={18} />}
                     <span>{totalSeleccionado > 0 ? `LIQUIDAR $${totalSeleccionado.toLocaleString()}` : 'CONFIRMAR OPERACIÓN'}</span>
                  </button>
               </div>
             ) : (saldoPendiente > 0 && !isFinished) ? (
               /* Global Balance Settlement (Yellow Primary) - Refined Compact Style */
               <div className="flex flex-col items-center gap-3">
                  <button 
                    onClick={() => onPay(order.id!)}
                    className="w-full max-w-sm py-3.5 px-6 rounded-2xl bg-brand-gold text-slate-950 font-black uppercase tracking-[0.15em] text-[10px] transition-all shadow-xl shadow-brand-gold/10 hover:bg-white active:scale-95 group flex items-center justify-center gap-3"
                  >
                    <DollarSign className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>{totalPagado > 0 ? 'Liquidación de Saldo Pendiente' : 'Cobrar Servicio Completo'}</span>
                  </button>
                  <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest text-center opacity-70">
                    {totalPagado > 0 ? 'Ajuste de cuentas por abonos previos' : 'Al confirmar se registra la salida del vehículo'}
                  </p>
               </div>
             ) : isFinished && stagedAdditions.length === 0 ? (
               /* Operation Finished State */
               <div className="flex items-center justify-center gap-3 text-brand-green">
                  <ShieldCheck size={18} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{saldoPendiente < 0 ? 'SALDO A FAVOR / CERRADO' : 'REGISTRO CERRADO / COBRADO'}</span>
               </div>
             ) : null}
          </div>
        )}

        {/* CANCEL CONFIRMATION OVERLAY */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-8 text-center">
            <div className="max-w-xs">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-red-500 w-8 h-8" />
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">¿Descartar Cambios?</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Tienes {stagedAdditions.length} items pendientes que no se guardarán.</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={onClose}
                  className="w-full py-4 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20"
                >
                  Sí, Descartar todo
                </button>
                <button 
                  onClick={() => setShowCancelConfirm(false)}
                  className="w-full py-4 bg-slate-900 text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest border border-slate-800"
                >
                  No, Seguir editando
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
