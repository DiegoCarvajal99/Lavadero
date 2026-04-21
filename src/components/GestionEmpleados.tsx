import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { UserPlus, Users, Phone, MapPin, Power, Trash2, Loader2, Save, X, Plus, Edit3, Shield, Contact } from 'lucide-react';
import { playVFX, resolveVFX, cancelVFX } from './CyberVFX';
import { CyberLoader } from './CyberLoader';
import type { Employee } from '../types';

export const GestionEmpleados: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);

  // Form states
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'empleados'), orderBy('nombre', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setTipoDocumento(emp.tipoDocumento);
    setDocumento(emp.documento);
    setNombre(emp.nombre);
    setTelefono(emp.telefono);
    setDireccion(emp.direccion);
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setTipoDocumento('CC');
    setDocumento('');
    setNombre('');
    setTelefono('');
    setDireccion('');
  };

  const handleCancel = () => {
    const isDirty = documento || nombre || telefono || direccion;
    if (isDirty) {
      setConfirmModal({
        title: 'DESCARTAR REGISTRO',
        message: '¿Deseas cancelar el registro? Se perderán los datos ingresados no guardados.',
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
    if (!nombre || !documento) return;

    setSaving(true);
    playVFX(editingId ? 'modify' : 'save', 'Sincronizando Personal...');

    try {
      const data = { tipoDocumento, documento, nombre, telefono, direccion, activo: true };

      if (editingId) {
        await updateDoc(doc(db, 'empleados', editingId), data);
        resolveVFX(`${nombre} actualizado`);
      } else {
        await addDoc(collection(db, 'empleados'), data);
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

  const toggleStatus = async (id: string, currentStatus: boolean, name: string) => {
    playVFX('modify', 'Actualizando Estado...');
    try {
      await updateDoc(doc(db, 'empleados', id), { activo: !currentStatus });
      resolveVFX(`${name} ${!currentStatus ? 'activado' : 'desactivado'}`);
    } catch (e) {
      cancelVFX();
    }
  };

  const deleteEmployee = async (id: string, name: string) => {
    setConfirmModal({
      title: 'ELIMINAR ASESOR',
      message: `¿Estás seguro de que deseas eliminar a "${name}" del sistema técnico?`,
      onConfirm: async () => {
        playVFX('delete', 'Borrando Registro...');
        try {
          await deleteDoc(doc(db, 'empleados', id));
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
            <Users className="w-8 h-8 text-brand-cyan" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1">ASESORES</h2>
            <p className="text-[10px] text-brand-cyan font-bold tracking-[0.3em] uppercase opacity-70">Operaciones de Personal</p>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="cyber-button-primary flex items-center justify-center gap-3">
          <Plus className="w-5 h-5" /> NUEVO ASESOR
        </button>
      </div>

      <div className="cyber-card shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/80 text-[10px] uppercase font-black text-slate-600 border-b border-slate-800">
              <tr>
                <th className="p-4 tracking-widest">ID</th>
                <th className="p-4 tracking-widest">Personal</th>
                <th className="p-4 text-center tracking-widest">Activo</th>
                <th className="p-4 text-center tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {employees.map(emp => (
                <tr key={emp.id} className={`group hover:bg-slate-900/40 transition-all ${!emp.activo ? 'opacity-30' : ''}`}>
                  <td className="p-4">
                    <span className="text-[10px] font-black text-brand-cyan/40 uppercase block leading-none">{emp.tipoDocumento}</span>
                    <span className="font-mono text-slate-300 tracking-wider transition-colors group-hover:text-brand-cyan">{emp.documento}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black group-hover:bg-brand-cyan group-hover:text-slate-950">
                        {emp.nombre.substring(0,2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                         <span className="font-black text-white uppercase tracking-tighter text-base leading-none mb-1">{emp.nombre}</span>
                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">{emp.telefono || 'S/N'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => toggleStatus(emp.id, emp.activo, emp.nombre)} 
                      className={`p-2 rounded-lg border transition-all ${emp.activo ? 'text-brand-green border-brand-green/20' : 'text-slate-700 border-slate-800'}`}>
                      <Power className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                       <button onClick={() => openEdit(emp)} className="p-2 rounded-lg bg-slate-900 hover:bg-brand-cyan hover:text-slate-950 text-slate-400 border border-slate-800 transition-all"><Edit3 className="w-4 h-4" /></button>
                       <button onClick={() => deleteEmployee(emp.id, emp.nombre)} className="p-2 rounded-lg bg-slate-900 hover:bg-brand-danger hover:text-white text-slate-700 border border-slate-800 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={handleCancel}></div>
          <div className="relative cyber-card w-full max-w-lg bg-slate-900 border-brand-cyan/20 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-950">
               <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
                 <Shield className="w-5 h-5 text-brand-cyan" />
                 {editingId ? 'Editar Perfil' : 'Alta de Personal'}
               </h3>
               <button onClick={handleCancel} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="tactical-group">
                <label className="cyber-label-tactical">Validación de Identidad</label>
                <div className="grid grid-cols-3 gap-3">
                  <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className="cyber-select-premium col-span-1">
                    <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option>
                  </select>
                  <input type="text" value={documento} onChange={(e) => setDocumento(e.target.value)} className="cyber-input-premium col-span-2 font-mono" placeholder="NRO ID" required />
                </div>
              </div>

              <div className="tactical-group">
                <label className="cyber-label-tactical">Datos Personales</label>
                <div className="space-y-4">
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="cyber-input-premium text-lg font-black" placeholder="NOMBRE COMPLETO" required />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="cyber-input-premium" placeholder="TELÉFONO" />
                    <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="cyber-input-premium" placeholder="DIRECCIÓN" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCancel} className="flex-1 cyber-button-secondary uppercase">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-[2] cyber-button-primary py-4 uppercase">
                  {saving ? <CyberLoader size={24} className="mx-auto" /> : <>{editingId ? 'Actualizar' : 'Guardar'}</>}
                </button>
              </div>
            </form>
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
