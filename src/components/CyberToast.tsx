import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, Terminal } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface Props {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const CyberToast: React.FC<Props> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const configs = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-brand-green" />,
      border: 'border-brand-green/30',
      bg: 'bg-brand-green/10',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]',
      label: 'SYSTEM: SUCCESS'
    },
    error: {
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      border: 'border-red-500/30',
      bg: 'bg-red-500/10',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
      label: 'SYSTEM: ERROR'
    },
    info: {
      icon: <Info className="w-5 h-5 text-brand-cyan" />,
      border: 'border-brand-cyan/30',
      bg: 'bg-brand-cyan/10',
      glow: 'shadow-[0_0_20px_rgba(0,247,255,0.15)]',
      label: 'SYSTEM: INFO'
    }
  };

  const config = configs[toast.type];

  return (
    <div className={`pointer-events-auto min-w-[300px] max-w-md ${config.bg} backdrop-blur-xl border ${config.border} p-4 rounded-xl ${config.glow} animate-in slide-in-from-right-full duration-300 relative group overflow-hidden`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <div className="flex gap-4 items-start">
        <div className={`p-2 rounded-lg bg-slate-950 border ${config.border}`}>
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <Terminal size={10} className="text-slate-500" />
            <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">{config.label}</span>
          </div>
          <p className="text-sm font-bold text-white leading-tight uppercase tracking-tight break-words">
            {toast.message}
          </p>
        </div>

        <button 
          onClick={() => onClose(toast.id)}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] bg-white/10 w-full overflow-hidden">
        <div 
          className={`h-full ${toast.type === 'success' ? 'bg-brand-green' : toast.type === 'error' ? 'bg-red-500' : 'bg-brand-cyan'} animate-progress`} 
        />
      </div>
    </div>
  );
};
