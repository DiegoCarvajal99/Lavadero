import React from 'react';
import { Car, Play, CheckCircle2, MoreVertical, CreditCard, Check, ShieldCheck, Trash2 } from 'lucide-react';
import { MotorcycleIcon } from './Icons';
import type { Order } from '../types';

interface Props {
  order: Order;
  onUpdateStatus: (id: string, newStatus: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (order: Order) => void;
  onClick?: () => void;
}

export const CardVehiculo: React.FC<Props> = ({ order, onUpdateStatus, onDelete, onEdit, onClick }) => {
  const statusStyles: Record<string, string> = {
    espera: 'border-slate-800/50 text-slate-500',
    proceso: 'border-brand-cyan/30 glow-cyan',
    listo: 'border-brand-green/30 glow-green',
    pagado: 'border-brand-gold/20 opacity-80 glow-gold',
  };

  const statusLabels: Record<string, string> = {
    espera: 'En Cola',
    proceso: 'Lavando',
    listo: 'Listo p/ Entrega',
    pagado: 'Completado',
    finalizado: 'Operación Finalizada',
  };

  const getWhatsAppLink = () => {
    if (!order.clienteTelefono) return '#';
    const cleanPhone = order.clienteTelefono.replace(/\D/g, '');
    const prefix = cleanPhone.startsWith('57') ? '' : '57'; // Assuming Colombia (+57)
    
    let message = '';
    if (order.estado === 'proceso') {
      message = `Hola ${order.clienteNombre}, su vehículo con placa ${order.placa} está en proceso de lavado.`;
    } else if (order.estado === 'listo') {
      const items = [order.servicioNombre, ...(order.adicionales?.map(a => `${a.nombre} ($${a.precio.toLocaleString()})`) || [])];
      message = `Su vehículo con placa ${order.placa} ya está listo. \n\nDetalle:\n- ${items.join('\n- ')}\n\nTotal a Pagar: $${order.total.toLocaleString()}`;
    } else if (order.estado === 'pagado' || order.estado === 'finalizado') {
      message = `Hola ${order.clienteNombre}, su vehículo con placa ${order.placa} ya está listo para recoger.`;
    }

    return `https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div 
      onClick={() => onClick?.()}
      className={`cyber-card p-4 group ${statusStyles[order.estado] || statusStyles.espera} relative overflow-hidden flex flex-col h-full min-h-[160px] transition-premium hover:scale-[1.02] border focus-within:ring-2 focus-within:ring-brand-cyan shadow-2xl`}
    >
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-slate-950 border border-slate-800 ${order.estado === 'proceso' ? 'text-brand-cyan' : 'text-slate-500'}`}>
            {order.tipo === 'carro' ? <Car className="w-3.5 h-3.5" /> : <MotorcycleIcon className="w-3.5 h-3.5" />}
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 leading-none">
              {order.tipo}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className={`text-[9px] font-bold uppercase ${
                 order.estado === 'proceso' ? 'text-brand-cyan' : 
                 order.estado === 'listo' ? 'text-brand-green' : 
                 order.estado === 'pagado' ? 'text-brand-gold' : 'text-slate-600'
               }`}>
                 {statusLabels[order.estado]}
               </span>
               {(() => {
                 const total = order.total || 0;
                 const pagado = order.montoPagado || 0;
                 const pendiente = total - pagado;
                 
                 if (pendiente <= 0 && pagado > 0) {
                   return (
                     <span className="px-1 py-0.5 rounded-sm bg-brand-green/20 text-brand-green text-[6px] font-black uppercase tracking-tighter border border-brand-green/30">
                       PAGADO
                     </span>
                   );
                 }
                 
                 if (pagado > 0 && pendiente > 0) {
                   return (
                     <span className="px-1 py-0.5 rounded-sm bg-brand-gold/20 text-brand-gold text-[6px] font-black uppercase tracking-tighter border border-brand-gold/30 animate-pulse">
                       PAGO PARCIAL
                     </span>
                   );
                 }

                 if (order.pagoAnticipado || order.pagoCredito) {
                   return (
                     <span className="px-1 py-0.5 rounded-sm bg-brand-gold/20 text-brand-gold text-[6px] font-black uppercase tracking-tighter border border-brand-gold/30">
                       {order.pagoCredito ? 'CRÉDITO' : 'PRE-PAGO'}
                     </span>
                   );
                 }

                 return null;
               })()}
            </div>
          </div>
        </div>
        
        <div className="flex gap-1 relative z-20">
           {order.clienteTelefono && (
             <a 
               href={getWhatsAppLink()}
               target="_blank"
               rel="noopener noreferrer"
               onClick={(e) => e.stopPropagation()}
               className="p-1.5 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all border border-green-500/20"
               title="Enviar WhatsApp"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
             </a>
           )}
           {(order.estado === 'espera' || order.estado === 'proceso') && (
             <button 
               onClick={(e) => { e.stopPropagation(); onEdit?.(order); }}
               className="p-1.5 rounded-md hover:bg-slate-800 text-slate-600 hover:text-white transition-all border border-transparent hover:border-slate-700"
               title="Editar"
             >
               <MoreVertical className="w-3 h-3" />
             </button>
           )}
           {order.estado === 'espera' && (
             <button 
               onClick={(e) => { e.stopPropagation(); onDelete?.(order.id!); }}
               className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-700 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
               title="Eliminar"
             >
               <Trash2 className="w-3 h-3" />
             </button>
           )}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center mb-1 relative z-10">
        <div className="flex justify-between items-baseline">
          <h3 className="text-2xl font-black tracking-tight text-white uppercase leading-tight group-hover:text-brand-cyan transition-colors">
            {order.placa}
          </h3>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">
            {order.clienteNombre?.split(' ')[0]}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
           <span className={`w-1 h-1 rounded-full ${
             order.estado === 'espera' ? 'bg-slate-600' :
             order.estado === 'proceso' ? 'bg-brand-cyan' :
             order.estado === 'listo' ? 'bg-brand-green' : 'bg-brand-gold'
           } opacity-50`}></span>
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-full italic">
             {order.servicioNombre}
           </p>
        </div>

        {/* DETAILED LIST WHEN READY */}
        {order.estado === 'listo' && (
          <div className="mt-2 p-2 bg-slate-950/80 rounded-lg border border-brand-green/20 space-y-1">
            <div className="flex justify-between items-center text-[7px] font-black text-slate-600 uppercase border-b border-slate-900 pb-1 mb-1">
              <span>Item</span>
              <span>Valor</span>
            </div>
            <div className="max-h-[60px] overflow-y-auto no-scrollbar space-y-1">
               <div className="flex justify-between text-[8px] font-bold text-slate-300 items-center">
                  <div className="flex items-center gap-1 truncate max-w-[70%]">
                    {(order.servicioPrincipalPagado || order.pagoAnticipado || order.pagoCredito) && <Check className="w-2 h-2 text-brand-green" />}
                    <span className="truncate">{order.servicioNombre}</span>
                  </div>
                  <span className="font-mono">${(order.total - (order.adicionales?.reduce((a, b) => a + (b.precio * b.cantidad), 0) || 0)).toLocaleString()}</span>
               </div>
               {order.adicionales?.map((ad, i) => (
                  <div key={i} className="flex justify-between text-[8px] font-bold items-center">
                    <div className={`flex items-center gap-1 truncate max-w-[70%] ${ad.pagado ? 'text-slate-400' : 'text-brand-cyan/80'}`}>
                      {ad.pagado && <Check className="w-2 h-2 text-brand-green" />}
                      <span className="truncate">+ {ad.nombre}</span>
                    </div>
                    <span className={`font-mono ${ad.pagado ? 'text-slate-500' : 'text-brand-cyan/80'}`}>${(ad.precio * ad.cantidad).toLocaleString()}</span>
                  </div>
               ))}
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-900 mt-1 text-[7px] font-black uppercase text-slate-600">
               <span>Ya Saldado / Crédito</span>
               <span className="font-mono">${(order.montoPagado || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
               <span className="text-[9px] font-black text-white uppercase tracking-tighter">Saldo Pendiente</span>
               <span className={`text-xs font-black font-mono ${ (order.total - (order.montoPagado || 0)) > 0 ? 'text-brand-cyan animate-pulse' : 'text-brand-green'}`}>
                 ${Math.max(0, (order.total - (order.montoPagado || 0))).toLocaleString()}
               </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/50 relative z-10 mt-auto">
        <div className="flex flex-col">
          <span className="text-[7px] uppercase text-slate-600 font-black tracking-widest leading-none mb-1">Operador</span>
          <div className="flex items-center gap-1.5">
             <div className="w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[7px] font-bold text-slate-500">
               {order.lavadorNombre?.charAt(0) || 'A'}
             </div>
             <span className="text-[9px] font-bold text-slate-300 uppercase truncate max-w-[60px]">
               {order.lavadorNombre?.split(' ')[0] || 'S/A'}
             </span>
          </div>
        </div>
        
        <div className="flex gap-1.5 relative z-20">
          {order.estado === 'espera' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id!, 'proceso'); }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-brand-cyan hover:bg-brand-cyan/20 text-brand-cyan transition-all group/btn"
              title="Iniciar"
            >
              <Play className="w-3 h-3 fill-current group-hover/btn:scale-110 transition-transform" />
            </button>
          )}
          
          {order.estado === 'proceso' && (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                const hasBalance = order.total > (order.montoPagado || 0);
                const nextStatus = hasBalance ? 'listo' : (order.pagoAnticipado || order.pagoCredito ? 'finalizado' : 'pagado');
                onUpdateStatus(order.id!, nextStatus); 
              }}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 transition-all group/btn ${
                (order.total <= (order.montoPagado || 0) && (order.pagoAnticipado || order.pagoCredito)) ? 'hover:border-brand-gold hover:bg-brand-gold/20 text-brand-gold' : 'hover:border-brand-green hover:bg-brand-green/20 text-brand-green'
              }`}
              title={(order.total <= (order.montoPagado || 0) && (order.pagoAnticipado || order.pagoCredito)) ? 'Cierre Total' : 'Cierre Patio'}
            >
              <CheckCircle2 className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
              <span className="text-[8px] font-black uppercase tracking-tighter">Terminar</span>
            </button>
          )}

          {order.estado === 'listo' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id!, 'pagado'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-cyan text-slate-950 hover:bg-white transition-all shadow-[0_4px_10px_rgba(0,247,255,0.3)] group/btn"
              title="Liquidar Caja"
            >
              <CreditCard className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
              <span className="text-[8px] font-black uppercase tracking-tighter">Pagar</span>
            </button>
          )}

          {(order.estado === 'pagado' || order.estado === 'finalizado') && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-950/50 border border-brand-gold/20 text-brand-gold">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[8px] font-black uppercase tracking-tighter font-mono italic">DONE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
