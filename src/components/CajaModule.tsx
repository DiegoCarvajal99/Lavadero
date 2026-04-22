import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, Timestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { DollarSign, Users, TrendingUp, Calendar, ChevronDown, FileText, Car, RefreshCcw, X, ChevronLeft, ChevronRight, CreditCard, CheckCircle2, ShoppingBag } from 'lucide-react';
import { MotorcycleIcon } from './Icons';
import { playVFX, resolveVFX, cancelVFX } from './CyberVFX';
import { CyberLoader } from './CyberLoader';
import type { Order } from '../types';

interface WasherLiquidation {
  nombre: string;
  count: number;
  totalProduction: number;
  totalCommission: number;
  orders: Order[];
}

interface ClientCredit {
  nombre: string;
  cedula: string;
  totalOwed: number;
  count: number;
  orders: Order[];
}

export const CajaModule: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingWasher, setViewingWasher] = useState<WasherLiquidation | null>(null);
  const [viewingCredit, setViewingCredit] = useState<ClientCredit | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'lavadores' | 'creditos' | 'historial'>('lavadores');
  const [historyPage, setHistoryPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void, danger?: boolean } | null>(null);
  const [paymentInput, setPaymentInput] = useState<string>('');
  
  // Custom Date Handling (Avoiding UTC shifts)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  // Calendar View State
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders for selected date (Accounting)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const qDay = query(
        collection(db, 'ordenes'),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<=', Timestamp.fromDate(endOfDay))
      );
      
      const snapshotDay = await getDocs(qDay);
      const dayData = snapshotDay.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds || b.timestamp - a.timestamp);
      
      const finishedOrders = dayData.filter(o => ['pagado', 'listo', 'finalizado'].includes(o.estado));
      setOrders(finishedOrders);

      // 2. Fetch All Pending Credits (Cross-date)
      // Note: We filter 'estado' in JS to avoid requiring a composite index in Firestore
      const qCredits = query(
        collection(db, 'ordenes'),
        where('pagoCredito', '==', true)
      );

      const snapshotCredits = await getDocs(qCredits);
      const creditOrders = snapshotCredits.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .filter(o => {
          const balance = (Number(o.total) || 0) - (Number(o.montoPagado) || 0);
          return !['pagado'].includes(o.estado) && balance > 0;
        });
      
      // Group Credits by Client
      const groupedCredits: Record<string, ClientCredit> = creditOrders.reduce((acc: any, curr) => {
        const key = curr.clienteCedula || curr.clienteNombre || 'DESCONOCIDO';
        if (!acc[key]) {
          acc[key] = {
            nombre: curr.clienteNombre || 'SIN NOMBRE',
            cedula: curr.clienteCedula || 'S/N',
            totalOwed: 0,
            count: 0,
            orders: []
          };
        }
        acc[key].totalOwed += (curr.total || 0) - (curr.montoPagado || 0);
        acc[key].count += 1;
        acc[key].orders.push(curr);
        return acc;
      }, {});

      setCredits(Object.values(groupedCredits).sort((a,b) => b.totalOwed - a.totalOwed));
    } catch (error) {
      console.error("Error fetching Caja data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setHistoryPage(1); // Reset pagination on date change
  }, [selectedDate]);

  useEffect(() => {
    setHistoryPage(1); // Reset pagination on tab change
  }, [activeTab]);

  const totalRecaudado = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalComisiones = orders.reduce((acc, curr) => acc + (curr.comisionMonto || 0), 0);
  const utilidadNeta = totalRecaudado - totalComisiones;

  const liquidaciones: Record<string, WasherLiquidation> = orders
    .filter(o => !o.esTienda) // Exclude shop sales from washer liquidations
    .reduce((acc: any, curr) => {
    if (!acc[curr.lavadorNombre]) {
      acc[curr.lavadorNombre] = { 
        nombre: curr.lavadorNombre,
        totalProduction: 0, 
        totalCommission: 0, 
        count: 0,
        orders: []
      };
    }
    // Calculate only service-related production (Base + Service Additions)
    // Formula: Total - Shop Articles (Articulos)
    const shopArticlesTotal = (curr.adicionales || [])
        .filter((a: any) => a.categoria === 'articulo')
        .reduce((sum: number, a: any) => sum + (a.precio * (a.cantidad || 1)), 0);

    const serviceProduction = (curr.total || 0) - shopArticlesTotal;

    acc[curr.lavadorNombre].totalProduction += serviceProduction;
    acc[curr.lavadorNombre].totalCommission += curr.comisionMonto || 0;
    acc[curr.lavadorNombre].count += 1;
    acc[curr.lavadorNombre].orders.push(curr);
    return acc;
  }, {});

  const handlePayCredit = async (credit: ClientCredit, amount: number) => {
    if (amount <= 0 || amount > credit.totalOwed) return;

    setConfirmModal({
      title: 'CONFIRMAR PAGO DE CRÉDITO',
      message: `¿CONFIRMAR PAGO DE $${amount.toLocaleString()} PARA ${credit.nombre.toUpperCase()}? ESTO SE APLICARÁ A LAS DEUDAS MÁS ANTIGUAS PRIMERO.`,
      onConfirm: async () => {
        setIsPaying(true);
        playVFX('modify', 'Procesando Abono...');
        
        try {
          const batch = writeBatch(db);
          let remainingPayment = amount;

          // FIFO Sort: Oldest orders first
          const sortedOrders = [...credit.orders].sort((a, b) => {
            const timeA = a.timestamp?.seconds || a.timestamp || 0;
            const timeB = b.timestamp?.seconds || b.timestamp || 0;
            return timeA - timeB;
          });

          for (const order of sortedOrders) {
            if (remainingPayment <= 0) break;
            
            const orderRef = doc(db, 'ordenes', order.id!);
            const orderTotal = order.total || 0;
            const alreadyPaid = order.montoPagado || 0;
            const balance = orderTotal - alreadyPaid;

            if (remainingPayment >= balance) {
              // Full payment for this order - mark as pagado
              batch.update(orderRef, { 
                estado: 'pagado',
                montoPagado: orderTotal,
                pagoCredito: false
              });
              remainingPayment -= balance;
            } else {
              // Partial payment for this order
              batch.update(orderRef, { 
                montoPagado: alreadyPaid + remainingPayment 
              });
              remainingPayment = 0;
            }
          }
          
          await batch.commit();
          resolveVFX(`Abono de $${amount.toLocaleString()} registrado`);
          fetchData();
          setViewingCredit(null);
          setPaymentInput('');
        } catch (error) {
          console.error("Error paying credit:", error);
          cancelVFX();
        } finally {
          setIsPaying(false);
          setConfirmModal(null);
        }
      }
    });
  };

  // Calendar Engine
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setSelectedDate(newDate);
    setIsCalendarOpen(false);
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase();
  };

  const monthName = viewDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <div className="space-y-8 pb-20 select-none">
      <style>{`
        .custom-calendar-shadow {
           box-shadow: 0 0 50px rgba(0,0,0,0.9), 0 0 20px rgba(0,247,255,0.05);
        }
        .date-capsule {
           user-select: none;
           -webkit-user-select: none;
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-[100]">
        <h2 className="text-3xl font-black text-white flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-brand-cyan" />
          ESTADO DE CUENTA
        </h2>
        
        <div className="relative transition-all duration-300">
          <div 
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className={`date-capsule flex items-center gap-3 bg-slate-950 border-2 p-1.5 px-4 rounded-xl self-start lg:self-center transition-all group cursor-pointer ${
              isCalendarOpen ? 'border-brand-cyan shadow-[0_0_20px_rgba(0,247,255,0.1)]' : 'border-slate-800 hover:border-brand-cyan/50'
            }`}
          >
            <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 transition-colors ${isCalendarOpen ? 'text-brand-cyan' : 'text-slate-500 group-hover:text-brand-cyan'}`}>
              <Calendar className="w-4 h-4 transition-transform group-hover:scale-110" />
            </div>
            <div className="flex flex-col pr-2">
               <span className={`text-[8px] font-black uppercase tracking-[0.1em] leading-none mb-1 transition-colors ${isCalendarOpen ? 'text-brand-cyan' : 'text-slate-600'}`}>Cierre de Caja</span>
               <span className="text-base font-black text-white tracking-widest leading-none">{formatDateDisplay(selectedDate)}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-800 transition-transform duration-500 ${isCalendarOpen ? 'rotate-180 text-brand-cyan' : ''}`} />
          </div>

          {isCalendarOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsCalendarOpen(false)}></div>
              <div className="absolute top-full right-0 mt-3 w-64 bg-slate-950 border border-slate-800 rounded-2xl p-4 custom-calendar-shadow z-50">
                <div className="flex items-center justify-between mb-4 bg-slate-900/50 rounded-lg p-1 border border-slate-900">
                  <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-950 rounded-md text-slate-500 hover:text-brand-cyan transition-all active:scale-90"><ChevronLeft size={16} /></button>
                  <span className="text-[10px] font-black text-white tracking-widest">{monthName}</span>
                  <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-950 rounded-md text-slate-500 hover:text-brand-cyan transition-all active:scale-90"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['D','L','M','M','J','V','S'].map(d => <span key={d} className="text-[8px] font-black text-slate-700 uppercase">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => <div key={`empty-${i}`} className="h-7"></div>)}
                  {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                    const isToday = new Date().getDate() === day && new Date().getMonth() === viewDate.getMonth() && new Date().getFullYear() === viewDate.getFullYear();
                    return (
                      <button key={day} onClick={() => handleDateSelect(day)} className={`h-7 w-7 rounded-lg text-[10px] font-black transition-all flex items-center justify-center relative group/day ${isSelected ? 'bg-brand-cyan text-slate-950 shadow-[0_0_10px_rgba(0,247,255,0.4)]' : 'text-slate-400 hover:bg-slate-900 hover:text-white active:scale-90'}`}>
                        {day}{isToday && !isSelected && <span className="absolute bottom-0.5 w-0.5 h-0.5 rounded-full bg-brand-cyan"></span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center px-1">
                   <button onClick={() => { const now = new Date(); setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())); setViewDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())); setIsCalendarOpen(false); }} className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all">Hoy</button>
                   <button onClick={() => setIsCalendarOpen(false)} className="text-[9px] font-black text-brand-danger/80 uppercase tracking-widest hover:brightness-125">Cerrar</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="cyber-card p-6 border-brand-cyan/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={80} /></div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Producción Total</p>
          <p className="text-4xl font-black text-white neon-text-cyan">${totalRecaudado.toLocaleString()}</p>
        </div>
        <div className="cyber-card p-6 border-brand-danger/30">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Comisiones a Pagar</p>
          <p className="text-4xl font-black text-brand-danger">${totalComisiones.toLocaleString()}</p>
        </div>
        <div className="cyber-card p-6 border-brand-green/30">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Utilidad Neta</p>
          <p className="text-4xl font-black text-brand-green">${utilidadNeta.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-900 w-full sm:w-fit shadow-2xl">
            <button 
                onClick={() => setActiveTab('lavadores')}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                activeTab === 'lavadores' ? 'bg-brand-cyan text-slate-950 shadow-[0_0_25px_rgba(0,247,255,0.25)]' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <Users size={14} />
                <span>Liquidaciones</span>
            </button>
            <button 
                onClick={() => setActiveTab('creditos')}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 relative ${
                activeTab === 'creditos' ? 'bg-brand-gold text-slate-950 shadow-[0_0_25px_rgba(255,204,0,0.25)]' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <CreditCard size={14} />
                <span>Cartera y Créditos</span>
                {credits.length > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                        activeTab === 'creditos' ? 'bg-slate-950 text-brand-gold' : 'bg-brand-gold text-slate-950'
                    }`}>
                        {credits.length}
                    </span>
                )}
            </button>
            <button 
                onClick={() => setActiveTab('historial')}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                activeTab === 'historial' ? 'bg-brand-green text-slate-950 shadow-[0_0_25px_rgba(0,255,157,0.25)]' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <FileText size={14} />
                <span>Historial</span>
            </button>
        </div>
      </div>

      <div className="">
        {activeTab === 'lavadores' ? (
            /* Liquidation Table */
            <div className="cyber-card border-slate-800 overflow-hidden">
                <div className="p-5 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20">
                            <Users className="w-4 h-4 text-brand-cyan" />
                        </div>
                        <h3 className="font-black text-slate-200 uppercase tracking-widest text-sm">Registro de Liquidación por Operador</h3>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-cyan"></span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{Object.keys(liquidaciones).length} Activos</span>
                    </div>
                </div>

                {loading ? (
                    <div className="p-24 flex flex-col items-center justify-center gap-4">
                        <CyberLoader size={40} />
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {Object.values(liquidaciones).map((liq) => (
                        <div key={liq.nombre} onClick={() => setViewingWasher(liq)} className="group p-5 flex items-center justify-between hover:bg-slate-900/30 cursor-pointer transition-all border-l-4 border-transparent hover:border-brand-cyan">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-brand-cyan transition-colors">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-xl text-white uppercase tracking-tight group-hover:tracking-wider transition-all">{liq.nombre}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{liq.count} Servicios Realizados</p>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-10">
                                <div className="hidden md:block">
                                    <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1">Total Producido</p>
                                    <p className="font-black text-lg text-slate-300">${liq.totalProduction.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-brand-gold uppercase font-black tracking-widest mb-1">Comisión Neta</p>
                                    <p className="font-black text-3xl text-brand-gold shadow-gold-text">${liq.totalCommission.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        ))}
                        {Object.keys(liquidaciones).length === 0 && (
                             <div className="p-24 text-center opacity-20 flex flex-col items-center gap-4">
                                <FileText className="w-16 h-16" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sin registros tácticos</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        ) : activeTab === 'creditos' ? (
            /* Credits Table */
            <div className="cyber-card border-slate-800 overflow-hidden border-t-brand-gold/50 border-t-2">
                <div className="p-5 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-gold/10 border border-brand-gold/20">
                            <CreditCard className="w-4 h-4 text-brand-gold" />
                        </div>
                        <h3 className="font-black text-slate-200 uppercase tracking-widest text-sm">Monitoreo de Cuentas por Cobrar</h3>
                    </div>
                </div>
                
                <div className="divide-y divide-slate-800/50">
                    {credits.map((credit) => (
                        <div key={credit.cedula} onClick={() => setViewingCredit(credit)} className="group p-6 flex items-center justify-between hover:bg-slate-900/30 cursor-pointer transition-all border-l-4 border-transparent hover:border-brand-gold">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 group-hover:text-brand-gold transition-colors">
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-xl text-white uppercase tracking-tight group-hover:text-brand-gold transition-colors">{credit.nombre}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{credit.cedula} • {credit.count} Facturas Pendientes</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-brand-cyan uppercase font-black tracking-widest mb-1">Saldo Total</p>
                                <p className="font-black text-3xl text-white shadow-cyan-text">${credit.totalOwed.toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                    {credits.length === 0 && (
                        <div className="p-32 text-center opacity-20 flex flex-col items-center gap-4">
                            <CheckCircle2 className="w-16 h-16" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Cartera de Clientes en Cero</span>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            /* Historial Table */
            <div className="cyber-card border-slate-800 overflow-hidden border-t-brand-green/50 border-t-2">
                <div className="p-5 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-green/10 border border-brand-green/20">
                            <FileText className="w-4 h-4 text-brand-green" />
                        </div>
                        <h3 className="font-black text-slate-200 uppercase tracking-widest text-sm">Libro de Transacciones Diarias</h3>
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800">
                                <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Servicio / Placa</th>
                                <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Modalidad</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Ingreso</th>
                                <th className="p-4 text-[9px] font-black text-brand-danger/60 uppercase tracking-widest text-right">Egreso (Com)</th>
                                <th className="p-4 text-[9px] font-black text-brand-green uppercase tracking-widest text-right">Ganancia Neta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/50">
                            {orders.slice((historyPage - 1) * rowsPerPage, historyPage * rowsPerPage).map((o, idx) => {
                                const gain = (o.total || 0) - (o.comisionMonto || 0);
                                return (
                                    <tr key={o.id || idx} className="hover:bg-slate-900/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded bg-slate-900 border border-slate-800 ${o.esTienda ? 'text-brand-gold' : 'text-slate-400'}`}>
                                                    {o.esTienda ? <ShoppingBag size={12} /> : (o.tipo === 'carro' ? <Car size={12} /> : <MotorcycleIcon size={12} />)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-white uppercase tracking-tighter">{o.placa}</p>
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase">{o.servicioNombre}</p>
                                                        {o.adicionales?.map((a, i) => (
                                                            <p key={i} className={`text-[8px] font-bold uppercase ${a.categoria === 'articulo' ? 'text-brand-gold' : 'text-brand-cyan'}`}>
                                                                + {a.nombre} {a.cantidad > 1 ? `(x${a.cantidad})` : ''}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {o.pagoCredito ? (
                                                    <span className="px-2 py-0.5 rounded bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-widest">Crédito</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-[9px] font-black uppercase tracking-widest">Pagado</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-xs font-black text-slate-300">${(o.total || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-xs font-black text-brand-danger/60 opacity-60">-${(o.comisionMonto || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="text-sm font-black text-brand-green shadow-green-text">${gain.toLocaleString()}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-950 border-t border-slate-800">
                            <tr>
                                <td colSpan={2} className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Totales del Día:</td>
                                <td className="p-4 text-right font-black text-white text-xs">${totalRecaudado.toLocaleString()}</td>
                                <td className="p-4 text-right font-black text-brand-danger/60 text-xs">-${totalComisiones.toLocaleString()}</td>
                                <td className="p-4 text-right font-black text-brand-green text-base shadow-green-text">${(totalRecaudado - totalComisiones).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {(orders.length > 0) && (
                    <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row shadow-[0_-10px_20px_rgba(0,0,0,0.5)] items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Ver registros:</span>
                            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                {[10, 25, 50, 100].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => {
                                            setRowsPerPage(num);
                                            setHistoryPage(1);
                                        }}
                                        className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all ${
                                            rowsPerPage === num 
                                            ? 'bg-brand-cyan text-slate-950 shadow-[0_0_10px_rgba(0,247,255,0.2)]' 
                                            : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <button 
                                disabled={historyPage === 1}
                                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black text-slate-400 hover:text-white disabled:opacity-20 transition-all uppercase tracking-widest flex items-center gap-2"
                            >
                                <ChevronLeft size={14} /> Anterior
                            </button>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                                Página <span className="text-brand-cyan">{historyPage}</span> de {Math.max(1, Math.ceil(orders.length / rowsPerPage))}
                            </span>
                            <button 
                                disabled={historyPage >= Math.ceil(orders.length / rowsPerPage)}
                                onClick={() => setHistoryPage(prev => prev + 1)}
                                className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black text-slate-400 hover:text-white disabled:opacity-20 transition-all uppercase tracking-widest flex items-center gap-2"
                            >
                                Siguiente <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {orders.length === 0 && (
                    <div className="p-32 text-center opacity-20 flex flex-col items-center gap-4">
                        <RefreshCcw className="w-16 h-16" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sin actividad registrada</span>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Liquidation Modal */}
      {viewingWasher && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setViewingWasher(null)}></div>
          <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
             <div className="bg-slate-950 p-6 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xl font-black text-white uppercase">{viewingWasher.nombre}</h4>
                <button onClick={() => setViewingWasher(null)} className="p-2 rounded-full hover:bg-slate-800 text-slate-500"><X size={20} /></button>
             </div>
             <div className="p-6 max-h-[50vh] overflow-y-auto no-scrollbar">
                <table className="w-full text-left">
                    <thead className="text-[9px] font-black text-slate-600 uppercase border-b border-slate-800">
                        <tr>
                            <th className="p-3">Vehículo</th>
                            <th className="p-3">Servicios Realizados</th>
                            <th className="p-3 text-right">Producción</th>
                            <th className="p-3 text-right">Comisión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                        {viewingWasher.orders.sort((a,b) => {
                            const timeA = a.timestamp?.seconds || a.timestamp || 0;
                            const timeB = b.timestamp?.seconds || b.timestamp || 0;
                            return timeB - timeA;
                        }).map((o, idx) => {
                            const shopArticlesTotal = (o.adicionales || [])
                                .filter(a => a.categoria === 'articulo')
                                .reduce((sum, a) => sum + (a.precio * (a.cantidad || 1)), 0);
                            
                            const orderProd = (o.total || 0) - shopArticlesTotal;
                            
                            return (
                                <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                                    <td className="p-3 font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                        {o.esTienda ? <ShoppingBag size={14} className="text-brand-gold" /> : (o.tipo === 'carro' ? <Car size={14}/> : <MotorcycleIcon size={14}/>)} 
                                        {o.placa}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <span className="text-slate-200 font-black uppercase text-[11px]">{o.servicioNombre}</span>
                                            {o.adicionales?.filter(a => a.categoria === 'servicio').map((a, i) => (
                                                <span key={i} className="text-[9px] text-brand-cyan font-bold uppercase">
                                                    + {a.nombre} {a.cantidad > 1 ? `(x${a.cantidad})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right text-slate-400 font-mono text-xs">${orderProd.toLocaleString()}</td>
                                    <td className="p-3 text-right text-brand-gold font-black">${o.comisionMonto.toLocaleString()}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
             </div>
             <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-xs">Total Liquidación</span>
                <span className="text-2xl font-black text-brand-gold">${viewingWasher.totalCommission.toLocaleString()}</span>
             </div>
          </div>
        </div>
      )}

      {/* Credit Details Modal */}
      {viewingCredit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setViewingCredit(null)}></div>
          <div className="relative w-full max-w-3xl bg-slate-900 rounded-3xl overflow-hidden border border-brand-gold/20 shadow-[0_0_50px_rgba(255,204,0,0.1)]">
             <div className="bg-slate-950 p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-brand-gold/10 border border-brand-gold/20"><CreditCard className="w-6 h-6 text-brand-gold" /></div>
                    <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-1">{viewingCredit.nombre}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{viewingCredit.cedula} • Cartera Pendiente</p>
                    </div>
                </div>
                <button onClick={() => setViewingCredit(null)} className="p-2 rounded-full hover:bg-slate-800 text-slate-500"><X size={20} /></button>
             </div>
             
             <div className="p-6 max-h-[50vh] overflow-y-auto no-scrollbar">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="text-[9px] font-black text-slate-600 uppercase border-b border-slate-800">
                        <tr>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Vehículo</th>
                            <th className="p-3">Producto / Servicio</th>
                            <th className="p-3 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                        {viewingCredit.orders.sort((a,b) => b.timestamp - a.timestamp).map((o, idx) => {
                            const date = o.timestamp?.toDate ? o.timestamp.toDate() : new Date();
                            return (
                                <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                                    <td className="p-3">
                                        <span className="text-[10px] font-mono text-slate-500 block leading-none">{date.toLocaleDateString()}</span>
                                        <span className="text-[8px] font-mono text-slate-700">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            {o.esTienda ? <ShoppingBag size={13} className="text-brand-gold" /> : (o.tipo === 'carro' ? <Car size={13} className="text-slate-500"/> : <MotorcycleIcon size={13} className="text-slate-500"/>)}
                                            <span className="font-black text-white uppercase tracking-tighter">{o.placa}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{o.servicioNombre}</span>
                                            {o.adicionales?.map((a, i) => (
                                                <span key={i} className={`text-[9px] font-bold uppercase ${a.categoria === 'articulo' ? 'text-brand-gold' : 'text-brand-cyan'}`}>
                                                    + {a.nombre} {a.cantidad > 1 ? `(x${a.cantidad})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right font-black text-slate-200">
                                        ${o.total?.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>

             <div className="p-8 bg-slate-950 border-t border-slate-800 flex flex-col lg:flex-row justify-between items-end gap-8">
                <div className="w-full lg:w-1/2">
                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] mb-4">Tactical Payment Input</p>
                    <div className="relative group">
                       <input 
                         type="text" 
                         value={paymentInput ? Number(paymentInput).toLocaleString('es-CO') : ''}
                         onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setPaymentInput(val);
                         }}
                         placeholder="MONTO A PAGAR..."
                         className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl px-6 py-5 text-2xl font-black text-white focus:border-brand-gold shadow-inner transition-all placeholder:text-slate-800 uppercase"
                       />
                       <button 
                         onClick={() => setPaymentInput(viewingCredit.totalOwed.toString())}
                         className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-800 text-[9px] font-black text-brand-gold rounded-lg border border-slate-700 hover:bg-brand-gold hover:text-slate-950 transition-all uppercase tracking-widest"
                       >
                         Total
                       </button>
                    </div>
                    <div className="flex justify-between mt-3 px-1">
                       <span className="text-[9px] text-slate-500 font-black uppercase">Saldo Cliente: <span className="text-slate-300 font-mono">${viewingCredit.totalOwed.toLocaleString()}</span></span>
                       <span className="text-[9px] text-brand-gold font-black uppercase">Abono: <span className="font-mono">${Number(paymentInput || 0).toLocaleString()}</span></span>
                    </div>
                </div>

                <button 
                    onClick={() => handlePayCredit(viewingCredit, Number(paymentInput))}
                    disabled={isPaying || !paymentInput || Number(paymentInput) <= 0 || Number(paymentInput) > viewingCredit.totalOwed}
                    className="w-full lg:w-auto px-12 py-5 bg-brand-gold text-slate-950 font-black uppercase tracking-[0.2em] rounded-2xl hover:shadow-[0_0_30px_rgba(255,204,0,0.3)] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-20 disabled:grayscale"
                >
                    {isPaying ? <CyberLoader size={20} /> : <CheckCircle2 size={20} />}
                    REGISTRAR PAGO
                </button>
             </div>
          </div>
        </div>
      )}
      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setConfirmModal(null)}></div>
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <div className={`w-16 h-16 ${confirmModal.danger ? 'bg-red-500/10 border-red-500/20' : 'bg-brand-cyan/10 border-brand-cyan/20'} rounded-full flex items-center justify-center mx-auto mb-6 border`}>
               {confirmModal.danger ? <X className="w-8 h-8 text-red-500" /> : <CreditCard className="w-8 h-8 text-brand-cyan" />}
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
                className={`flex-1 py-3 rounded-xl ${confirmModal.danger ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-brand-cyan text-slate-950 shadow-[0_0_20px_rgba(0,247,255,0.3)]'} text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all`}
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
