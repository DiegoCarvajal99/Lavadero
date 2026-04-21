import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, limit } from 'firebase/firestore';
import { Settings, Check, Zap } from 'lucide-react';

export const SetupHelper: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const seed = async () => {
    setLoading(true);
    try {
      // Check if already seeded
      const q = query(collection(db, 'servicios'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("La base de datos ya tiene servicios configurados.");
        setLoading(false);
        return;
      }

      const services = [
        { nombre: "Lavado Básico", precio: 25000, comision: 0.35 },
        { nombre: "Lavado Full", precio: 45000, comision: 0.35 },
        { nombre: "Lavado Motor", precio: 15000, comision: 0.35 },
        { nombre: "Polichado", precio: 60000, comision: 0.35 },
      ];

      const employees = [
        { nombre: "Juan Pérez", activo: true },
        { nombre: "Carlos Ruiz", activo: true },
        { nombre: "Andrés Gomez", activo: true },
      ];

      for (const s of services) await addDoc(collection(db, 'servicios'), s);
      for (const e of employees) await addDoc(collection(db, 'empleados'), e);

      setDone(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (done) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button 
        onClick={seed}
        disabled={loading}
        className="bg-slate-900 border border-brand-cyan/50 text-brand-cyan px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-brand-cyan hover:text-slate-950 transition-all shadow-lg"
      >
        {loading ? <Zap className="w-3 h-3 animate-spin" /> : <Settings className="w-3 h-3" />}
        INICIALIZAR DATOS DEMO
      </button>
    </div>
  );
};
