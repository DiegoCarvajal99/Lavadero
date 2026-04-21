import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, increment } from 'firebase/firestore';
import { ListPlus, Package, DollarSign, Percent, Trash2, Save, X, Plus, PlusCircle, Loader2, Edit3, Settings, Car, RefreshCcw, Search } from 'lucide-react';
import { MotorcycleIcon } from './Icons';
import { playVFX, resolveVFX, cancelVFX } from './CyberVFX';
import { CyberLoader } from './CyberLoader';
import type { Service, VehicleType } from '../types';

export const GestionServicios: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [comisionPerc, setComisionPerc] = useState('35');
  const [tipoVehiculo, setTipoVehiculo] = useState<VehicleType | 'ambos'>('ambos');
  const [esAdicional, setEsAdicional] = useState(false);
  const [stock, setStock] = useState('0');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalSearch, setModalSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState<'servicio' | 'articulo'>('servicio');
  const [filterType, setFilterType] = useState<VehicleType | 'ambos' | 'todos'>('todos');
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'servicios'), orderBy('precio', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          categoria: data.categoria || 'servicio' // Backward compatibility
        } as Service;
      }));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openEdit = (svc: Service) => {
    setEditingId(svc.id);
    setNombre(svc.nombre);
    setPrecio(svc.precio.toString());
    setComisionPerc((svc.comision * 100).toFixed(0));
    setTipoVehiculo(svc.tipoVehiculo || 'ambos');
    setEsAdicional(!!svc.esAdicional);
    setStock('0'); // For adding more
    setModalSearch('');
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNombre('');
    setPrecio('');
    setTipoVehiculo('ambos');
    setEsAdicional(false);
    setStock('0');
  };

  const handleCancel = () => {
    const isDirty = nombre || precio;
    if (isDirty) {
      setConfirmModal({
        title: 'DESCARTAR CAMBIOS',
        message: '¿Deseas cancelar la edición? Se perderán los cambios no guardados.',
        onConfirm: () => {
          closeForm();
          setConfirmModal(null);
        }
      });
    } else {
      closeForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !precio) return;

    setSaving(true);
    playVFX(editingId ? 'modify' : 'save', 'Actualizando Catálogo...');

    try {
      const data = {
        nombre: nombre.toUpperCase(),
        precio: Number(precio),
        comision: activeTab === 'articulo' ? 0 : Number(comisionPerc) / 100,
        tipoVehiculo: tipoVehiculo,
        esAdicional: activeTab === 'articulo' ? true : esAdicional,
        categoria: activeTab,
        stock: editingId ? increment(Number(stock)) : Number(stock)
      };

      if (editingId) {
        await updateDoc(doc(db, 'servicios', editingId), data);
        resolveVFX(`${nombre} actualizado`);
      } else {
        await addDoc(collection(db, 'servicios'), data);
        resolveVFX(`${nombre} agregado`);
      }
      
      closeForm();
      setSaving(false);
    } catch (error) {
      console.error(error);
      setSaving(false);
      cancelVFX();
    }
  };

  const deleteService = async (id: string, name: string) => {
    setConfirmModal({
      title: 'ELIMINAR REGISTRO',
      message: `¿Estás seguro de que deseas eliminar "${name}" permanentemente del sistema?`,
      onConfirm: async () => {
        playVFX('delete', 'Borrando del Sistema...');
        try {
          await deleteDoc(doc(db, 'servicios', id));
          resolveVFX(`${name} eliminado`);
        } catch (e) {
          cancelVFX();
        }
        setConfirmModal(null);
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-cyan/10 rounded-2xl border border-brand-cyan/30">
            <Package className="w-8 h-8 text-brand-cyan" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1">CATÁLOGO</h2>
            <p className="text-[10px] text-brand-cyan font-bold tracking-[0.3em] uppercase opacity-70">Productos y Servicios</p>
          </div>
        </div>
        
        <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-900 shadow-xl">
            <button 
                onClick={() => setActiveTab('servicio')}
                className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                  activeTab === 'servicio' ? 'bg-brand-cyan text-slate-950 shadow-[0_0_25px_rgba(0,247,255,0.25)]' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <RefreshCcw size={14} className={activeTab === 'servicio' ? 'animate-spin-slow' : ''} />
                SERVICIOS
            </button>
            <button 
                onClick={() => setActiveTab('articulo')}
                className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                  activeTab === 'articulo' ? 'bg-brand-gold text-slate-950 shadow-[0_0_25px_rgba(255,204,0,0.25)]' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <Package size={14} />
                PRODUCTOS
            </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)} 
          className={`${activeTab === 'servicio' ? 'cyber-button-primary' : 'cyber-button-gold'} flex items-center justify-center gap-2 group`}
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> 
          NUEVO {activeTab === 'servicio' ? 'SERVICIO' : 'PRODUCTO'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {activeTab === 'servicio' ? (
          <div className="flex gap-2 p-1 bg-slate-950/50 rounded-xl border border-slate-800 w-fit">
            {[
              { id: 'todos', label: 'TODOS', icon: Package },
              { id: 'carro', label: 'CARROS', icon: Car },
              { id: 'moto', label: 'MOTOS', icon: MotorcycleIcon }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setFilterType(filter.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${
                  filterType === filter.id 
                  ? 'bg-brand-cyan text-slate-950 shadow-[0_0_15px_rgba(0,247,255,0.2)]' 
                  : 'text-slate-500 hover:text-white'
                }`}
              >
                <filter.icon size={12} />
                {filter.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 h-10 opacity-30 select-none">
             <Package size={14} className="text-brand-gold" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Catálogo General de Productos</span>
          </div>
        )}

        <div className="relative w-full md:w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
           <input 
            type="text" 
            placeholder="BUSCAR ITEM..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cyber-input-premium pl-10 py-2.5 text-[10px] uppercase tracking-widest font-black"
           />
        </div>
      </div>

      <div className="cyber-card shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/80 text-[10px] uppercase font-black text-slate-600 border-b border-slate-800">
              <tr>
                <th className="p-4 tracking-widest">Nombre</th>
                <th className="p-4 tracking-widest text-right">Precio</th>
                {activeTab === 'servicio' ? (
                  <th className="p-4 tracking-widest text-brand-cyan">Comisión Lavador</th>
                ) : (
                  <th className="p-4 tracking-widest text-brand-gold text-right">Stock Act.</th>
                )}
                <th className="p-4 text-center tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {services
                .filter(svc => svc.categoria === activeTab)
                .filter(svc => filterType === 'todos' || svc.tipoVehiculo === filterType || svc.tipoVehiculo === 'ambos')
                .filter(svc => svc.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((svc) => {
                  return (
                    <tr key={svc.id} className="group hover:bg-slate-900/10 transition-colors border-b border-slate-900/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                               <div className="flex gap-1 items-center">
                                  {svc.categoria === 'servicio' && (
                                    <>
                                       {(svc.tipoVehiculo === 'carro' || svc.tipoVehiculo === 'ambos') && <Car size={14} className="text-brand-cyan opacity-40 hover:opacity-100 transition-opacity" />}
                                       {(svc.tipoVehiculo === 'moto' || svc.tipoVehiculo === 'ambos') && <MotorcycleIcon size={14} className="text-brand-gold opacity-40 hover:opacity-100 transition-opacity" />}
                                    </>
                                  )}
                                  {svc.esAdicional && svc.categoria === 'servicio' && <span className="bg-brand-cyan/20 text-brand-cyan text-[7px] font-black px-1.5 py-0.5 rounded border border-brand-cyan/30 ml-2 tracking-widest uppercase">Adicional</span>}
                                  {svc.categoria === 'articulo' && <span className="bg-brand-gold/20 text-brand-gold text-[7px] font-black px-1.5 py-0.5 rounded border border-brand-gold/30 tracking-widest uppercase">Punto de Venta</span>}
                               </div>
                               <span className="font-black text-white uppercase tracking-tight text-base leading-none">{svc.nombre}</span>
                            </div>
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                               {svc.categoria === 'servicio' ? (svc.tipoVehiculo === 'ambos' ? 'MULTIVH-COMPATIBLE' : `${svc.tipoVehiculo}-X`) : 'ITEM UNIVERSAL'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-300 text-right font-black text-base">
                        ${svc.precio.toLocaleString()}
                      </td>
                      {activeTab === 'servicio' && (
                        <td className="p-4">
                          <div className="flex flex-col">
                             <span className="font-black text-brand-cyan text-base">
                               ${(svc.precio * (svc.comision || 0)).toLocaleString()}
                             </span>
                             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">{((svc.comision || 0) * 100).toFixed(0)}% de comisión</span>
                          </div>
                        </td>
                      )}
                      {activeTab === 'articulo' && (
                        <td className="p-4 text-right">
                           <span className={`font-black text-lg ${
                             (svc.stock || 0) <= 0 ? 'text-brand-danger animate-pulse' : 
                             (svc.stock || 0) <= 5 ? 'text-brand-gold' : 'text-brand-green'
                           }`}>
                             {svc.stock || 0} UNI
                           </span>
                        </td>
                      )}
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEdit(svc)} className="p-2 rounded-lg bg-slate-900 hover:bg-brand-cyan hover:text-slate-950 text-slate-500 border border-slate-800 transition-all"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteService(svc.id, svc.nombre)} className="p-2 rounded-lg bg-slate-900 hover:bg-brand-danger hover:text-white text-slate-700 border border-slate-800 transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={handleCancel}></div>
          <div className="relative cyber-card w-full max-w-md bg-slate-900 border-brand-cyan/20 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-950">
               <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
                 <Settings className="w-5 h-5 text-brand-cyan" />
                 {editingId ? 'Ajustes de Servicio' : 'Nuevo Registro'}
               </h3>
                <button onClick={handleCancel} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-6">
              <div className="tactical-group relative">
                <div className="flex justify-between items-center mb-1">
                  <label className="cyber-label-tactical mb-0">Identificación del {activeTab === 'articulo' ? 'Producto' : 'Servicio'}</label>
                  {!editingId && <span className="text-[7px] font-black text-brand-cyan/50 tracking-widest uppercase">Búsqueda Inteligente Activa</span>}
                </div>
                <input 
                  type="text" 
                  value={nombre} 
                  onChange={(e) => {
                    setNombre(e.target.value.toUpperCase());
                    setShowSuggestions(true);
                  }} 
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="EJ. POLICHADO MANUAL" 
                  className="cyber-input-premium font-black text-base" 
                  required 
                />
                
                {/* Suggestions Dropdown */}
                {!editingId && showSuggestions && nombre.length > 1 && (
                  <div className="absolute z-[110] left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto no-scrollbar">
                     {services
                        .filter(s => s.categoria === activeTab && s.nombre.toLowerCase().includes(nombre.toLowerCase()))
                        .map(s => (
                           <div 
                             key={s.id} 
                             onClick={() => { openEdit(s); setShowSuggestions(false); }}
                             className="p-3 hover:bg-brand-cyan/10 cursor-pointer border-b border-slate-900 flex justify-between items-center transition-colors group"
                           >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-white group-hover:text-brand-cyan transition-colors">{s.nombre}</span>
                                <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">${s.precio.toLocaleString()}</span>
                              </div>
                              <RefreshCcw size={12} className="text-brand-cyan" />
                           </div>
                        ))
                     }
                  </div>
                )}
                {showSuggestions && <div className="fixed inset-0 z-[105]" onClick={() => setShowSuggestions(false)}></div>}
              </div>

              <div className="tactical-group grid grid-cols-2 gap-4">
                <div className="col-span-1">
                   <label className="cyber-label-tactical">Precio Venta</label>
                   <div className="relative">
                      <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-cyan" />
                      <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className={`cyber-input-premium pl-10 font-mono ${activeTab === 'articulo' ? 'border-brand-gold/30 focus:border-brand-gold' : ''}`} required />
                   </div>
                </div>
                <div className="col-span-1">
                   <label className="cyber-label-tactical">% Lavador</label>
                   <div className="relative">
                      <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input 
                        type="number" 
                        value={activeTab === 'articulo' ? '0' : comisionPerc} 
                        disabled={activeTab === 'articulo'}
                        onChange={(e) => setComisionPerc(e.target.value)} 
                        className={`cyber-input-premium pl-10 font-mono ${activeTab === 'articulo' ? 'opacity-30' : ''}`} 
                      />
                   </div>
                </div>
              </div>

              {activeTab === 'articulo' && (
                <div className="tactical-group bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-end mb-2">
                    <label className="cyber-label-tactical mb-0">{editingId ? 'Reponer Inventario' : 'Existencias Iniciales'}</label>
                    {editingId && (
                       <span className="text-[9px] font-black text-slate-500 uppercase">
                          Actual: <span className="text-brand-gold">{services.find(s => s.id === editingId)?.stock || 0}</span>
                       </span>
                    )}
                  </div>
                  <div className="relative">
                    <PlusCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold" />
                    <input 
                      type="number" 
                      value={stock} 
                      onChange={(e) => setStock(e.target.value)} 
                      className="cyber-input-premium pl-10 font-mono border-brand-gold/30 focus:border-brand-gold" 
                      placeholder={editingId ? "CANTIDAD A SUMAR..." : "CANTIDAD INICIAL..."}
                    />
                  </div>
                  <p className="text-[7px] font-bold text-slate-600 uppercase tracking-tight mt-2 italic">
                    {editingId ? "Ingresa la cantidad que vas a agregar al stock actual." : "Establece la cantidad con la que inicias este artículo."}
                  </p>
                </div>
              )}

              {activeTab === 'servicio' && (
                <div className="tactical-group">
                  <label className="cyber-label-tactical">Compatibilidad de Vehículo</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { id: 'carro', label: 'CARRO', icon: Car, color: 'text-brand-cyan', bg: 'hover:bg-brand-cyan/20 border-brand-cyan/20' },
                      { id: 'moto', label: 'MOTO', icon: MotorcycleIcon, color: 'text-brand-gold', bg: 'hover:bg-brand-gold/20 border-brand-gold/20' },
                      { id: 'ambos', label: 'AMBOS', icon: Package, color: 'text-white', bg: 'hover:bg-white/10 border-white/10' }
                    ].map(item => (
                      <div 
                        key={item.id}
                        onClick={() => setTipoVehiculo(item.id as any)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer group ${
                          tipoVehiculo === item.id ? 'bg-slate-800 border-brand-cyan shadow-[0_0_15px_rgba(0,247,255,0.15)]' : 'bg-slate-950/20 border-slate-800'
                        }`}
                      >
                          <item.icon size={18} className={`mb-1.5 ${tipoVehiculo === item.id ? item.color : 'text-slate-600 opacity-40'} transition-colors duration-300`} />
                          <span className={`text-[8px] font-black tracking-widest ${tipoVehiculo === item.id ? 'text-white' : 'text-slate-700'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'servicio' && (
                <div className="tactical-group pt-2">
                  <label className="cyber-label-tactical">Tipo de Categoría</label>
                  <select 
                      value={esAdicional ? 'adicional' : 'principal'}
                      onChange={(e) => setEsAdicional(e.target.value === 'adicional')}
                      className="cyber-select-premium w-full text-xs font-bold py-3"
                  >
                      <option value="principal">SERVICIO PRINCIPAL (EN LISTA SELECTORA)</option>
                      <option value="adicional">SERVICIO ADICIONAL (BUSCADOR TÁCTICO)</option>
                  </select>
                  <p className="text-[7px] font-bold text-slate-600 uppercase tracking-tight mt-2">
                    Los principales aparecen en la selección central. Los adicionales solo en el buscador de extras.
                  </p>
                </div>
              )}

              {activeTab === 'articulo' && (
                <div className="p-3 bg-brand-gold/5 border border-brand-gold/20 rounded-xl">
                  <p className="text-[8px] font-bold text-brand-gold uppercase tracking-widest text-center leading-relaxed">
                    Los productos se considerarán automáticamente adicionales<br/>y no generarán comisión al lavador.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCancel} className="flex-1 cyber-button-secondary uppercase">Cancelar</button>
                <button type="submit" disabled={saving} className={`flex-[2] ${activeTab === 'servicio' ? 'cyber-button-primary' : 'cyber-button-gold'} py-4 uppercase font-black italic`}>
                  {saving ? <CyberLoader size={24} className="mx-auto" /> : <>{editingId ? 'CONFIRMAR' : 'GUARDAR'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setConfirmModal(null)}></div>
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
               <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-8 uppercase font-bold px-4">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:brightness-110 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
