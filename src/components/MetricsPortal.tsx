import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, Users, Package, Car, Award, Calendar, 
  ChevronLeft, ChevronRight, Activity, DollarSign, Filter,
  PieChart as PieChartIcon, BarChart3, Target, Zap, Shield, Crown, Star,
  ArrowUpRight, ArrowDownRight, UserCheck, CreditCard, Wallet, Search,
  X, CheckCircle2, ChevronDown, ShoppingBag, Hammer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CyberLoader } from './CyberLoader';
import type { Order } from '../types';

// --- CUSTOM HUD TOOLTIP ---
const CustomHUDTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-2xl border border-brand-cyan/20 p-5 rounded-2xl shadow-4xl border-l-4 border-l-brand-cyan">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <div className="flex flex-1 justify-between gap-8">
                <span className="text-[11px] font-bold text-white uppercase">{entry.name}</span>
                <span className="text-xs font-black text-brand-cyan font-mono">
                   {typeof entry.value === 'number' && (entry.name.toLowerCase().includes('ingreso') || entry.name.toLowerCase().includes('total')) ? `$${entry.value.toLocaleString()}` : entry.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// --- KPI CARD WITH DELTA ---
const KPICard = ({ label, value, icon: Icon, color, trend, trendValue, sparkData }: any) => (
  <motion.div 
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
    className="bg-slate-950/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 relative group overflow-hidden"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-10 rounded-full transition-all group-hover:opacity-20`} style={{ backgroundColor: color }} />
    
    <div className="flex justify-between items-start mb-6 relative z-10">
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</span>
        <div className="text-3xl font-black text-white tracking-tighter tabular-nums">{value}</div>
      </div>
      <div className="p-3 bg-slate-900 rounded-2xl border border-white/5" style={{ color }}>
         <Icon size={18} />
      </div>
    </div>

    <div className="flex items-center gap-2 relative z-10">
       <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black ${trend === 'up' ? 'text-brand-green bg-brand-green/10' : 'text-red-500 bg-red-500/10'}`}>
          {trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trendValue}%
       </div>
       <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">vs periodo anterior</span>
    </div>

    {/* Small Sparkline simulation */}
    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
       <div className="h-full bg-gradient-to-r from-transparent via-current to-transparent opacity-30" style={{ color, width: '100%' }} />
    </div>
  </motion.div>
);

export const MetricsPortal: React.FC = () => {
  // DATE RANGE STATES
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setHours(0,0,0,0) - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  
  // Cyber-Calendar States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(dateRange.start));
  const [tempRange, setTempRange] = useState({ start: dateRange.start, end: dateRange.end });
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');

  const [orders, setOrders] = useState<Order[]>([]);
  const [prevOrders, setPrevOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // FETCH DATA ENGINE
  useEffect(() => {
    setLoading(true);
    
    const fetchAll = async () => {
      // CURRENT PERIOD
      const start = new Date(dateRange.start);
      start.setHours(0,0,0,0);
      const end = new Date(dateRange.end);
      end.setHours(23,59,59,999);

      const qCurrent = query(
        collection(db, 'ordenes'),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'asc')
      );

      // PREVIOUS PERIOD (For Delta calculations)
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration - 1000);
      const prevEnd = new Date(start.getTime() - 1000);

      const qPrev = query(
        collection(db, 'ordenes'),
        where('timestamp', '>=', Timestamp.fromDate(prevStart)),
        where('timestamp', '<=', Timestamp.fromDate(prevEnd)),
        orderBy('timestamp', 'asc')
      );

      const [snapCurrent, snapPrev] = await Promise.all([
        getDocs(qCurrent),
        getDocs(qPrev)
      ]);

      const currentData = snapCurrent.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      const previousData = snapPrev.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];

      setOrders(currentData);
      setPrevOrders(previousData);
      setLoading(false);
    };

    fetchAll();
  }, [dateRange]);

  // --- ANALYTICAL CALCULATIONS ---

  const metrics = useMemo(() => {
    const calc = (data: Order[]) => {
      const revenue = data.reduce((acc, o) => acc + (o.total || 0), 0);
      const ops = data.length;
      const ticket = ops ? Math.round(revenue / ops) : 0;
      const credits = data.filter(o => o.pagoCredito).length;
      const items = data.reduce((acc, o) => acc + (o.adicionales?.filter(a => a.categoria === 'articulo').reduce((a, ad) => a + (ad.cantidad || 0), 0) || 0), 0);
      return { revenue, ops, ticket, credits, items };
    };

    const curr = calc(orders);
    const prev = calc(prevOrders);

    const getDelta = (c: number, p: number) => {
      if (!p) return c > 0 ? 100 : 0;
      return Math.round(((c - p) / p) * 100);
    };

    return {
      current: curr,
      deltas: {
        revenue: getDelta(curr.revenue, prev.revenue),
        ops: getDelta(curr.ops, prev.ops),
        ticket: getDelta(curr.ticket, prev.ticket),
        items: getDelta(curr.items, prev.items)
      }
    };
  }, [orders, prevOrders]);

  const loyaltyData = useMemo(() => {
    const uniqueClients = new Set(orders.map(o => o.clienteCedula).filter(Boolean));
    const repeatClients = orders.reduce((acc: Set<string>, o) => {
      if (!o.clienteCedula) return acc;
      const count = orders.filter(ord => ord.clienteCedula === o.clienteCedula).length;
      if (count > 1) acc.add(o.clienteCedula);
      return acc;
    }, new Set<string>());

    return {
      totalClients: uniqueClients.size,
      returningPercent: uniqueClients.size ? Math.round((repeatClients.size / uniqueClients.size) * 100) : 0
    };
  }, [orders]);

  const paymentMix = useMemo(() => {
    const cash = orders.filter(o => !o.pagoCredito).reduce((acc, o) => acc + (o.total || 0), 0);
    const credit = orders.filter(o => o.pagoCredito).reduce((acc, o) => acc + (o.total || 0), 0);
    return [
      { name: 'LIQUIDADO (CASH)', value: cash, color: '#22c55e' },
      { name: 'CRÉDITO (PEND.)', value: credit, color: '#00F7FF' }
    ];
  }, [orders]);

  const revenueArea = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (!o.timestamp) return;
      const label = o.timestamp.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      map[label] = (map[label] || 0) + (o.total || 0);
    });
    return Object.entries(map).map(([name, total]) => ({ name, total }));
  }, [orders]);

  const vehicleStats = useMemo(() => {
    const counts = { carro: 0, moto: 0 };
    orders.forEach(o => { (o.tipo === 'carro') ? counts.carro++ : counts.moto++; });
    return [
      { name: 'CARROS', value: counts.carro, color: '#00F7FF', icon: <Car size={14} /> },
      { name: 'MOTOS', value: counts.moto, color: '#FFCC00', icon: <Zap size={14} /> }
    ];
  }, [orders]);

  const topServicesData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (o.esTienda) return;
      map[o.servicioNombre] = (map[o.servicioNombre] || 0) + 1;
      o.adicionales?.forEach(ad => {
        if (ad.categoria === 'servicio') {
          map[ad.nombre] = (map[ad.nombre] || 0) + (ad.cantidad || 1);
        }
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [orders]);

  const topProductsData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      o.adicionales?.forEach(ad => {
        if (ad.categoria === 'articulo') {
          map[ad.nombre] = (map[ad.nombre] || 0) + (ad.cantidad || 1);
        }
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [orders]);

  const staffPerformance = useMemo(() => {
    const performance: Record<string, { total: number, serviceCount: number, name: string }> = {};
    orders.forEach(o => {
      if (!o.lavadorId || o.lavadorId === 'store') return;
      if (!performance[o.lavadorId]) performance[o.lavadorId] = { total: 0, serviceCount: 0, name: o.lavadorNombre };
      
      performance[o.lavadorId].total += (o.total || 0);
      
      let countForThisOrder = 0;
      if (!o.esTienda) countForThisOrder = 1;
      o.adicionales?.forEach(ad => {
        if (ad.categoria === 'servicio') countForThisOrder++;
      });
      performance[o.lavadorId].serviceCount += countForThisOrder;
    });
    return Object.values(performance).sort((a,b) => b.serviceCount - a.serviceCount);
  }, [orders]);


  // --- CALENDAR ENGINE ---
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

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (selectingStep === 'start') {
      setTempRange({ start: clickedDate, end: clickedDate });
      setSelectingStep('end');
    } else {
      if (clickedDate < tempRange.start) setTempRange({ start: clickedDate, end: tempRange.start });
      else setTempRange(prev => ({ ...prev, end: clickedDate }));
      setSelectingStep('start');
    }
  };

  const confirmRange = () => { setDateRange(tempRange); setIsCalendarOpen(false); };
  const isSelected = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return (d.getTime() === tempRange.start.getTime() || d.getTime() === tempRange.end.getTime());
  };
  const isInRange = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return d > tempRange.start && d < tempRange.end;
  };
  const formatShortDate = (date: Date) => date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase();

  const handlePreset = (type: string) => {
    const now = new Date();
    let start = new Date();
    if (type === 'today') start.setHours(0,0,0,0);
    else if (type === 'week') start.setDate(now.getDate() - 7);
    else if (type === 'month') start.setMonth(now.getMonth() - 1);
    setDateRange({ start, end: now });
    setTempRange({ start, end: now });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-8 bg-slate-950/20 rounded-[3rem]">
       <CyberLoader size={40} />
       <p className="text-[10px] font-black text-brand-cyan uppercase tracking-[0.5em] animate-pulse">Sincronizando Mallas de Datos...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
        <div className="flex items-center gap-6">
          <div className="p-6 bg-slate-900 rounded-[2rem] border border-brand-cyan/20 shadow-2xl">
            <Target className="w-10 h-10 text-brand-cyan" />
          </div>
          <div>
            <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-2">INTELIGENCIA</h2>
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-black text-brand-cyan uppercase tracking-[0.4em] opacity-60">Analítica de Rendimiento</span>
               <div className="h-1 w-1 rounded-full bg-slate-700" />
               <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/50 p-2 rounded-[2rem] border border-white/5 backdrop-blur-md">
           <div className="flex gap-1">
             {[{ id: 'today', label: 'Hoy' }, { id: 'week', label: '7D' }, { id: 'month', label: '30D' }].map(opt => (
               <button key={opt.id} onClick={() => handlePreset(opt.id)} className="px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                 {opt.label}
               </button>
             ))}
           </div>
           <div className="h-8 w-[1px] bg-white/5 hidden sm:block" />
           <button 
             onClick={() => { setIsCalendarOpen(true); setTempRange(dateRange); setViewDate(new Date(dateRange.start)); }}
             className={`flex items-center gap-3 px-8 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${isCalendarOpen ? 'bg-brand-cyan text-slate-950 border-brand-cyan' : 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20 hover:bg-brand-cyan hover:text-slate-950'}`}
           >
             <Calendar size={14} /> Personalizado
           </button>
        </div>
      </div>

      {/* CYBER-CALENDAR RANGE MODAL */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCalendarOpen(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.9)] w-full max-w-sm custom-calendar-shadow">
                <div className="flex flex-col gap-6">
                   <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-brand-cyan uppercase tracking-widest leading-none mb-1">Rango Táctico</span>
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Seleccionar Fechas</h4>
                      </div>
                      <button onClick={() => setIsCalendarOpen(false)} className="p-2 hover:bg-slate-900 rounded-full text-slate-600 hover:text-white transition-all"><X size={20} /></button>
                   </div>
                   <div className="flex gap-2 items-center">
                      <div className={`flex-1 p-3 rounded-xl border transition-all ${selectingStep === 'start' ? 'bg-brand-cyan/20 border-brand-cyan' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                         <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Desde</span>
                         <span className="text-xs font-black text-white">{formatShortDate(tempRange.start)}</span>
                      </div>
                      <ChevronRight className="text-slate-800" size={14} />
                      <div className={`flex-1 p-3 rounded-xl border transition-all ${selectingStep === 'end' ? 'bg-brand-cyan/20 border-brand-cyan' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                         <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Hasta</span>
                         <span className="text-xs font-black text-white">{formatShortDate(tempRange.end)}</span>
                      </div>
                   </div>
                   <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-xl border border-slate-900">
                      <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-950 rounded-lg text-slate-500 hover:text-brand-cyan active:scale-90"><ChevronLeft size={16} /></button>
                      <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{viewDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
                      <button onClick={handleNextMonth} className="p-2 hover:bg-slate-950 rounded-lg text-slate-500 hover:text-brand-cyan active:scale-90"><ChevronRight size={16} /></button>
                   </div>
                   <div className="space-y-2">
                      <div className="grid grid-cols-7 text-center">
                         {['D','L','M','X','J','V','S'].map(d => <span key={d} className="text-[9px] font-black text-slate-700">{d}</span>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                         {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => <div key={`empty-${i}`} className="h-9"></div>)}
                         {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                            const day = i + 1;
                            const selected = isSelected(day);
                            const ranged = isInRange(day);
                            return (
                               <button key={day} onClick={() => handleDateClick(day)} className={`h-9 w-9 rounded-xl text-[10px] font-black transition-all flex items-center justify-center relative ${selected ? 'bg-brand-cyan text-slate-950 shadow-[0_0_15px_rgba(0,247,255,0.4)]' : ranged ? 'bg-brand-cyan/10 text-brand-cyan' : 'text-slate-500 hover:bg-slate-900 hover:text-white'}`}>
                                  {day}
                                  {new Date().getDate() === day && new Date().getMonth() === viewDate.getMonth() && new Date().getFullYear() === viewDate.getFullYear() && !selected && <span className="absolute bottom-1 w-1 h-1 bg-brand-cyan rounded-full" />}
                               </button>
                            );
                         })}
                      </div>
                   </div>
                   <div className="flex gap-3 pt-4 border-t border-slate-900">
                      <button onClick={() => setIsCalendarOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-white transition-all">Cancelar</button>
                      <button onClick={confirmRange} className="flex-[2] py-4 bg-brand-cyan text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:shadow-brand-cyan/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                         <CheckCircle2 size={14} /> Confirmar Rango
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard label="Ingresos de Periodo" value={`$${metrics.current.revenue.toLocaleString()}`} icon={DollarSign} color="#22c55e" trend={metrics.deltas.revenue >= 0 ? 'up' : 'down'} trendValue={Math.abs(metrics.deltas.revenue)} />
        <KPICard label="Operaciones Totales" value={metrics.current.ops} icon={Activity} color="#00F7FF" trend={metrics.deltas.ops >= 0 ? 'up' : 'down'} trendValue={Math.abs(metrics.deltas.ops)} />
        <KPICard label="Ticket Promedio" value={`$${metrics.current.ticket.toLocaleString()}`} icon={Target} color="#FFCC00" trend={metrics.deltas.ticket >= 0 ? 'up' : 'down'} trendValue={Math.abs(metrics.deltas.ticket)} />
        <KPICard label="Productos Vendidos" value={metrics.current.items} icon={Package} color="#a855f7" trend={metrics.deltas.items >= 0 ? 'up' : 'down'} trendValue={Math.abs(metrics.deltas.items)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* MAIN REVENUE CHART */}
        <div className="lg:col-span-8 bg-slate-950/40 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity"><BarChart3 size={150} /></div>
          <div className="flex items-center gap-4 mb-12">
             <div className="h-10 w-2 bg-brand-cyan rounded-full shadow-[0_0_15px_rgba(0,247,255,0.5)]" />
             <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Tendencia de Facturación</h3>
          </div>
          <div className="h-[400px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueArea}>
                   <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00F7FF" stopOpacity={0.3}/><stop offset="95%" stopColor="#00F7FF" stopOpacity={0}/></linearGradient></defs>
                   <CartesianGrid strokeDasharray="10 10" stroke="#ffffff05" vertical={false} />
                   <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} dy={15} fontWeight={900} />
                   <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} dx={-10} fontWeight={900} tickFormatter={(v) => `$${v/1000}k`} />
                   <Tooltip content={<CustomHUDTooltip />} />
                   <Area type="monotone" dataKey="total" name="Ingreso Diario" stroke="#00F7FF" strokeWidth={4} fill="url(#colorRev)" />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* FLEET MIX */}
        <div className="lg:col-span-4 bg-slate-950/40 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 flex flex-col items-center shadow-2xl">
          <div className="w-full flex items-center gap-4 mb-10">
            <div className="h-10 w-2 bg-brand-gold rounded-full shadow-[0_0_15px_rgba(255,204,0,0.5)]" />
            <div>
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Mix de Flota</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Distribución de unidades</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[300px] relative">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={vehicleStats} innerRadius={80} outerRadius={110} paddingAngle={15} dataKey="value" stroke="none" animationDuration={1000}>{vehicleStats.map((e, index) => <Cell key={index} fill={e.color} fillOpacity={0.8}/>)}</Pie><Tooltip content={<CustomHUDTooltip/>}/></PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-white">{orders.length}</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Total</span>
             </div>
          </div>
          <div className="w-full space-y-3 mt-10">
             {vehicleStats.map((item, i) => (
               <div key={i} className="flex justify-between items-center bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                     <div className="p-2 rounded-lg bg-slate-900 border border-white/5" style={{ color: item.color }}>{item.icon}</div>
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-white leading-none mb-1">{item.value}</p>
                    <p className="text-[9px] font-black text-slate-600 uppercase">{orders.length ? Math.round((item.value/orders.length)*100) : 0}%</p>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* RANKINGS ROW */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* TOP SERVICES */}
           <div className="bg-slate-950/40 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-4">
                    <div className="h-8 w-1 bg-purple-500 rounded-full" />
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Top Servicios</h3>
                 </div>
                 <BarChart3 size={16} className="text-slate-700" />
              </div>
              <div className="space-y-8">
                 {topServicesData.map((svc, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                             <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center text-[10px] font-black text-brand-cyan">{i+1}</div>
                             <span className="text-xs font-black text-white uppercase tracking-tight">{svc.name}</span>
                          </div>
                          <div className="text-right"><span className="text-xs font-black text-white">{svc.value} <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">ventas</span></span></div>
                       </div>
                       <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(svc.value/(topServicesData[0]?.value || 1))*100}%` }} transition={{ duration: 1 }} className="h-full bg-purple-600 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.3)]"/>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-end">
                 <div><span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] block mb-1">Total Periodo</span><div className="text-2xl font-black text-brand-cyan tracking-tighter">{topServicesData.reduce((acc, s) => acc + s.value, 0)}</div></div>
                 <Activity size={24} className="text-slate-800 animate-pulse" />
              </div>
           </div>

           {/* TOP PRODUCTS */}
           <div className="bg-slate-950/40 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-4">
                    <div className="h-8 w-1 bg-brand-gold rounded-full" />
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Top Productos</h3>
                 </div>
                 <Package size={16} className="text-slate-700" />
              </div>
              <div className="space-y-8">
                 {topProductsData.map((p, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                             <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center text-[10px] font-black text-brand-gold">{i+1}</div>
                             <span className="text-xs font-black text-white uppercase tracking-tight">{p.name}</span>
                          </div>
                          <div className="text-right"><span className="text-xs font-black text-white">{p.value} <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">unidades</span></span></div>
                       </div>
                       <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(p.value/(topProductsData[0]?.value || 1))*100}%` }} transition={{ duration: 1 }} className="h-full bg-brand-gold rounded-full shadow-[0_0_10px_rgba(255,204,0,0.2)]"/>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-end">
                 <div><span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] block mb-1">Total Periodo</span><div className="text-2xl font-black text-brand-gold tracking-tighter text-glow-gold">{topProductsData.reduce((acc, p) => acc + p.value, 0)}</div></div>
                 <ShoppingBag size={24} className="text-slate-800" />
              </div>
           </div>
        </div>

        {/* STAFF ECONOMICS & LOYALTY */}
        <div className="lg:col-span-4 space-y-8">
           {/* STAFF RANKING (AS REQUESTED) */}
           <div className="bg-slate-950/40 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl">
              <div className="flex items-center gap-4 mb-10">
                 <div className="h-8 w-1 bg-brand-cyan rounded-full" />
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter">Eficiencia Staff</h3>
              </div>
              <div className="space-y-6">
                 {staffPerformance.map((emp, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center text-[10px] font-black text-brand-cyan">{i+1}</div>
                             <span className="text-xs font-black text-white uppercase tracking-tight">{emp.name}</span>
                          </div>
                          <span className="text-xs font-black text-white">{emp.serviceCount} <span className="text-[9px] text-slate-500 uppercase">svc</span></span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(emp.serviceCount/(staffPerformance[0]?.serviceCount || 1))*100}%` }} className="h-full bg-brand-cyan rounded-full shadow-[0_0_10px_rgba(0,247,255,0.3)]"/>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/5">
                 <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1">Total Servicios</span>
                 <div className="text-xl font-black text-white">{staffPerformance.reduce((acc, e) => acc + e.serviceCount, 0)} Unidades</div>
              </div>
           </div>

           {/* LOYALTY CARD */}
           <div className="bg-slate-950/40 backdrop-blur-xl p-8 rounded-[3rem] border border-white/5 flex flex-col items-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 blur-3xl" />
              <UserCheck size={32} className="text-brand-cyan mb-6" />
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tasa de Fidelidad</h4>
              <div className="text-5xl font-black text-white mb-2">{loyaltyData.returningPercent}%</div>
              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-center px-4">de tus clientes en este periodo han retornado al menos una vez</p>
           </div>
        </div>

      </div>

    </div>
  );
};
