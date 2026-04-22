import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Users, Phone, Trash2, Loader2, X, Plus, Edit3, UserCircle, Search, CreditCard } from 'lucide-react';
import { playVFX, resolveVFX, cancelVFX } from './CyberVFX';
import { CyberLoader } from './CyberLoader';
import type { Customer } from '../types';

export const ClientesTerminal: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'clientes'), orderBy('nombre', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openEdit = (cust: Customer) => {
    setEditingId(cust.id!);
    setNombre(cust.nombre);
    setCedula(cust.cedula);
    setTelefono(cust.telefono);
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNombre('');
    setCedula('');
    setTelefono('');
  };

  const validateName = (val: string) => val.replace(/[^a-zA-Z\s]/g, '');
  const validateNumber = (val: string) => val.replace(/[^0-9]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cedula || telefono.length !== 10) return;

    setSaving(true);
    playVFX(editingId ? 'modify' : 'save', 'Sincronizando Cliente...');

    try {
      const data = { nombre, cedula, telefono };

      if (editingId) {
        await updateDoc(doc(db, 'clientes', editingId), data);
        resolveVFX(`${nombre} actualizado`);
      } else {
        await addDoc(collection(db, 'clientes'), data);
        resolveVFX(`${nombre} registrado`);
      }
      
      closeForm();
      setSaving(false);
    } catch (error) {
      console.error(error);
      setSaving(false);
      cancelVFX();
    }
  };

  const deleteCustomer = async (id: string, name: string) => {
    setConfirmModal({
      title: 'ELIMINAR CLIENTE',
      message: `¿Estás seguro de que deseas eliminar permanentemente a "${name}" de la base de datos?`,
      onConfirm: async () => {
        playVFX('delete', 'Borrando Registro...');
        try {
          await deleteDoc(doc(db, 'clientes', id));
          resolveVFX(`${name} eliminado`);
        } catch (e) {
          cancelVFX();
        }
        setConfirmModal(null);
      }
    });
  };

  const filteredCustomers = customers.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cedula.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-cyan/10 rounded-2xl border border-brand-cyan/30">
            <Users className="w-8 h-8 text-brand-cyan" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1">CLIENTES</h2>
            <p className="text-[10px] text-brand-cyan font-bold tracking-[0.3em] uppercase opacity-70">Base de Datos Maestra</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-cyan transition-colors" />
                <input 
                    type="text"
                    placeholder="BUSCAR CLIENTE..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                    className="cyber-input-premium pl-12 py-3 text-[11px] w-full sm:w-64 uppercase"
                />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="cyber-button-primary flex items-center justify-center gap-3">
                <Plus className="w-5 h-5" /> NUEVO CLIENTE
            </button>
        </div>
      </div>

      <div className="cyber-card shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/80 text-[10px] uppercase font-black text-slate-600 border-b border-slate-800">
              <tr>
                <th className="p-4 tracking-widest">Cédula</th>
                <th className="p-4 tracking-widest">Nombre del Cliente</th>
                <th className="p-4 tracking-widest">Contacto</th>
                <th className="p-4 text-center tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredCustomers.map(cust => (
                <tr key={cust.id} className="group hover:bg-slate-900/40 transition-all">
                  <td className="p-4">
                    <span className="font-mono text-slate-300 tracking-wider transition-colors group-hover:text-brand-cyan">{cust.cedula}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black group-hover:bg-brand-cyan group-hover:text-slate-950">
                        {cust.nombre.substring(0,2).toUpperCase()}
                      </div>
                      <span className="font-black text-white uppercase tracking-tighter text-base">{cust.nombre}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3 h-3 text-brand-cyan/60" />
                        <span className="text-xs font-bold tracking-widest">{cust.telefono}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                       <button onClick={() => openEdit(cust)} className="p-2 rounded-lg bg-slate-900 hover:bg-brand-cyan hover:text-slate-950 text-slate-400 border border-slate-800 transition-all"><Edit3 className="w-4 h-4" /></button>
                       <button onClick={() => deleteCustomer(cust.id!, cust.nombre)} className="p-2 rounded-lg bg-slate-900 hover:bg-brand-danger hover:text-white text-slate-700 border border-slate-800 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                    <td colSpan={4} className="p-20 text-center opacity-20">
                        <UserCircle className="w-12 h-12 mx-auto mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sin registros encontrados</span>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={closeForm}></div>
          <div className="relative cyber-card w-full max-w-lg bg-slate-900 border-brand-cyan/20 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-950">
               <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
                 <Users className="w-5 h-5 text-brand-cyan" />
                 {editingId ? 'Modificar Registro' : 'Nuevo Cliente'}
               </h3>
               <button onClick={closeForm} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="tactical-group">
                  <label className="cyber-label-tactical">Identificación</label>
                  <input 
                      type="number" 
                      value={cedula} 
                      onChange={(e) => setCedula(e.target.value.toUpperCase())} 
                      className="cyber-input-premium font-mono uppercase" 
                      placeholder="NÚMERO DE CÉDULA" 
                      required 
                  />
                </div>

                <div className="tactical-group">
                  <label className="cyber-label-tactical">Información de Contacto</label>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      value={nombre} 
                      onChange={(e) => setNombre(validateName(e.target.value).toUpperCase())} 
                      className="cyber-input-premium text-lg font-black uppercase" 
                      placeholder="NOMBRE COMPLETO" 
                      required 
                    />
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-brand-cyan" />
                      <input 
                          type="number" 
                          value={telefono} 
                          onChange={(e) => setTelefono(e.target.value.slice(0, 10))} 
                          className="cyber-input-premium pl-12" 
                          placeholder="CELULAR (10 DÍGITOS)" 
                          required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeForm} className="flex-1 cyber-button-secondary uppercase">Cancelar</button>
                  <button type="submit" disabled={saving || telefono.length !== 10} className="flex-[2] cyber-button-primary py-4 uppercase">
                    {saving ? <CyberLoader size={24} className="mx-auto" /> : <>{editingId ? 'Actualizar' : 'Guardar'}</>}
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
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center animate-modal-entry">
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
