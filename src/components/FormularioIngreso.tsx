import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, doc, updateDoc, getDocs, increment } from 'firebase/firestore';
import { PlusCircle, Plus, Car, Loader2, ClipboardList, ShieldCheck, Hash, CreditCard, Check, RefreshCcw, X, User, Users, Phone, Search, ChevronRight, ChevronDown, Package, ShoppingBag, AlertCircle, ShoppingCart } from 'lucide-react';
import { MotorcycleIcon } from './Icons';
import { CyberLoader } from './CyberLoader';
import type { Service, Employee, VehicleType, Order, Customer } from '../types';

export const FormularioIngreso: React.FC<{ 
  onSuccess?: () => void; 
  onClose?: () => void;
  initialMode?: 'lavadero' | 'tienda';
  allOrders?: Order[];
  initialData?: Order | null;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}> = ({ onSuccess, onClose, initialMode = 'lavadero', allOrders = [], initialData, onShowToast }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState<VehicleType>('carro');
  const [selectedService, setSelectedService] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  // Client States
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteCedula, setClienteCedula] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Payment States
  const [pagoAnticipado, setPagoAnticipado] = useState(false);
  const [pagoCredito, setPagoCredito] = useState(false);
  
  // Consolidated Additions State
  const [orderAdditions, setOrderAdditions] = useState<any[]>([]);
  
  // Search Additions States
  const [additionSearch, setAdditionSearch] = useState('');
  const [showAdditionResults, setShowAdditionResults] = useState(false);
  const [selectedSvcForQty, setSelectedSvcForQty] = useState<Service | null>(null);
  const [tempQty, setTempQty] = useState(1);
  const [workerSearch, setWorkerSearch] = useState('');
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [idTipoOperacion, setIdTipoOperacion] = useState<'lavadero' | 'tienda'>(initialMode);

  useEffect(() => {
    const qS = query(collection(db, 'servicios'), orderBy('precio', 'asc'));
    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    const qE = query(collection(db, 'empleados'), where('activo', '==', true));
    const unsubscribeE = onSnapshot(qE, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const qC = query(collection(db, 'clientes'), orderBy('nombre', 'asc'));
    const unsubscribeC = onSnapshot(qC, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    if (initialData) {
      setIdTipoOperacion(initialData.idTipoOperacion || 'lavadero');
      setPlaca(initialData.placa || '');
      setTipo(initialData.tipo || 'carro');
      setSelectedService(initialData.servicioId || '');
      setSelectedEmployee(initialData.lavadorId || '');
      setPagoAnticipado(!!initialData.pagoAnticipado);
      setPagoCredito(!!initialData.pagoCredito);
      setClienteNombre(initialData.clienteNombre || '');
      setClienteCedula(initialData.clienteCedula || '');
      setClienteTelefono(initialData.clienteTelefono || '');
      setOrderAdditions(initialData.adicionales || []);
    }

    return () => { unsubscribeS(); unsubscribeE(); unsubscribeC(); };
  }, [initialData]);

  const clearForm = () => {
    setPlaca('');
    setSelectedService('');
    setSelectedEmployee('');
    setPagoAnticipado(false);
    setPagoCredito(false);
    setClienteNombre('');
    setClienteCedula('');
    setClienteTelefono('');
    setOrderAdditions([]);
  };

  const handleHandlePlaca = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setPlaca(cleaned);
  };

  const validateName = (val: string) => val.replace(/[^a-zA-Z\s]/g, '');
  const validateNumber = (val: string) => val.replace(/[^0-9]/g, '');

  const selectCustomer = (cust: Customer) => {
    setClienteNombre(cust.nombre);
    setClienteCedula(cust.cedula);
    setClienteTelefono(cust.telefono);
    setShowSearch(false);
  };

  const handleTogglePagoInmediato = () => {
    if (pagoAnticipado) {
      setPagoAnticipado(false);
    } else {
      setPagoAnticipado(true);
      setPagoCredito(false);
    }
  };

  const handleTogglePagoCredito = () => {
    if (pagoCredito) {
      setPagoCredito(false);
    } else {
      setPagoCredito(true);
      setPagoAnticipado(false);
    }
  };

  const handleClose = () => {
    const isDirty = placa !== '' || orderAdditions.length > 0 || clienteNombre !== '' || clienteCedula !== '' || clienteTelefono !== '';
    if (isDirty && !initialData) {
      setShowDiscardConfirm(true);
    } else {
      onClose?.();
    }
  };

  const addPredefinedAddition = (svc: Service) => {
    if (svc.categoria === 'articulo') {
      // Validación inmediata si está agotado
      if ((svc.stock || 0) <= 0) {
        onShowToast?.('error', `PRODUCTO AGOTADO: ${svc.nombre} no tiene existencias.`);
        return;
      }
      setSelectedSvcForQty(svc);
      setTempQty(1);
      setAdditionSearch('');
      setShowAdditionResults(false);
    } else {
      setOrderAdditions([...orderAdditions, { ...svc, cantidad: 1 }]);
      setAdditionSearch('');
      setShowAdditionResults(false);
    }
  };

  const confirmAdditionWithQty = () => {
    if (!selectedSvcForQty) return;
    
    // Validar stock para artículos
    if (selectedSvcForQty.categoria === 'articulo') {
      const stockDisponible = selectedSvcForQty.stock || 0;
      
      const cantidadEnCarrito = orderAdditions
        .filter(item => item.id === selectedSvcForQty.id)
        .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
      
      const totalSolicitado = cantidadEnCarrito + tempQty;

      if (totalSolicitado > stockDisponible) {
        onShowToast?.('error', `STOCK INSUFICIENTE: Solo puedes agregar ${stockDisponible - cantidadEnCarrito} unidades más de ${selectedSvcForQty.nombre}. (Total stock: ${stockDisponible})`);
        return;
      }

      const stockRestante = stockDisponible - totalSolicitado;
      if (stockRestante <= 5) {
        onShowToast?.('info', `ATENCIÓN: Stock bajo para ${selectedSvcForQty.nombre}. Quedan ${stockRestante} unidades.`);
      }
    }
    
    setOrderAdditions(prev => {
      const existingIdx = prev.findIndex(item => item.id === selectedSvcForQty.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: (updated[existingIdx].cantidad || 0) + tempQty
        };
        return updated;
      }
      return [...prev, { ...selectedSvcForQty, cantidad: tempQty }];
    });
    
    setSelectedSvcForQty(null);
    setAdditionSearch('');
    setShowAdditionResults(false);
  };

  const removeAddition = (index: number) => {
    setOrderAdditions(prev => prev.filter((_, i) => i !== index));
  };
  
  const getEmployeeWorkload = (empId: string) => {
    return allOrders.filter(o => o.lavadorId === empId && (o.estado === 'proceso' || o.estado === 'espera')).length;
  };

  const sortedEmployees = [...employees]
    .filter(e => e.nombre.toLowerCase().includes(workerSearch.toLowerCase()))
    .sort((a, b) => getEmployeeWorkload(a.id!) - getEmployeeWorkload(b.id!));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isLavadero = idTipoOperacion === 'lavadero';
    const isTienda = idTipoOperacion === 'tienda';
    
    // Validations
    if (isLavadero && placa.length < 6) return;
    if (isLavadero && (!selectedService || !selectedEmployee)) return;
    
    // Customer is mandatory for Lavadero OR for Shop Credit
    const isCustomerRequired = isLavadero || (isTienda && pagoCredito);
    if (isCustomerRequired && (!clienteNombre || !clienteCedula || clienteTelefono.length !== 10)) {
        onShowToast?.('error', 'FALTAN DATOS DEL CLIENTE O SON INVÁLIDOS');
        return;
    }

    if (isTienda && orderAdditions.length === 0) {
      onShowToast?.('error', 'DEBE AGREGAR AL MENOS UN PRODUCTO');
      return;
    }

    try {
      setLoading(true);
      
      // Upsert Customer if info provided
      if (clienteCedula) {
          const customerRef = collection(db, 'clientes');
          const q = query(customerRef, where('cedula', '==', clienteCedula));
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) {
            await addDoc(customerRef, {
              nombre: clienteNombre.trim().toUpperCase(),
              cedula: clienteCedula.trim(),
              telefono: clienteTelefono.trim()
            });
          } else {
            const docId = querySnapshot.docs[0].id;
            await updateDoc(doc(db, 'clientes', docId), {
              nombre: clienteNombre.trim().toUpperCase(),
              telefono: clienteTelefono.trim()
            });
          }
      }

      const mainService = isLavadero ? services.find(s => s.id === selectedService) : null;
      const employee = isLavadero ? employees.find(emp => emp.id === selectedEmployee) : null;

      const additionsTotal = orderAdditions.reduce((acc, curr) => acc + (Number(curr.precio) * (curr.cantidad || 1)), 0);
      const additionsComision = orderAdditions
        .filter(a => a.categoria === 'servicio')
        .reduce((acc, curr) => acc + (Number(curr.precio) * (curr.comision || 0) * (curr.cantidad || 1)), 0);

      const isBusy = !initialData && isLavadero && allOrders.some(o => 
        o.lavadorId === selectedEmployee && 
        o.estado === 'proceso'
      );

      const orderPrice = mainService ? Number(mainService.precio || 0) : 0;
      const orderComision = mainService ? (orderPrice * Number(mainService.comision || 0)) : 0;

      const orderData: any = {
        placa: isLavadero ? placa.trim().toUpperCase() : 'TIENDA',
        tipo: isLavadero ? tipo : 'moto',
        servicioId: isLavadero ? selectedService : 'store_sale',
        servicioNombre: isLavadero ? mainService?.nombre : 'VENTA DIRECTA',
        lavadorId: isLavadero ? selectedEmployee : 'store',
        lavadorNombre: isLavadero ? employee?.nombre : 'TIENDA',
        pagoAnticipado: !pagoCredito && (isTienda || Boolean(pagoAnticipado)),
        pagoCredito: Boolean(pagoCredito),
        montoPagado: pagoCredito ? 0 : (pagoAnticipado || (isTienda && !pagoCredito)) ? (orderPrice + additionsTotal) : 0,
        adicionales: orderAdditions.map(a => ({ 
          svcId: a.id || '', 
          categoria: a.categoria || 'servicio',
          nombre: a.nombre || 'Adicional', 
          precio: Number(a.precio || 0), 
          comision: Number(a.comision || 0),
          cantidad: Number(a.cantidad || 1),
          pagado: Boolean(pagoAnticipado || (isTienda && !pagoCredito) || a.pagado)
        })), 
        clienteNombre: clienteNombre.trim().toUpperCase(),
        clienteCedula: clienteCedula.trim(),
        clienteTelefono: clienteTelefono.trim(),
        total: orderPrice + additionsTotal,
        servicioPrecio: orderPrice,
        comisionMonto: orderComision + additionsComision,
        servicioPrincipalPagado: Boolean(pagoAnticipado || (isTienda && !pagoCredito)),
        timestamp: initialData ? initialData.timestamp : serverTimestamp(),
        idTipoOperacion,
        esTienda: isTienda,
        estado: isLavadero ? (isBusy ? 'espera' : 'proceso') : 'pagado'
      };

      // Correct final state for transactions
      if (isTienda && pagoCredito) orderData.estado = 'espera'; // Pending pay
      if (isTienda && !pagoCredito) orderData.estado = 'pagado'; // Immediate pay

      if (!initialData) {
        await addDoc(collection(db, 'ordenes'), orderData);
      } else {
        await updateDoc(doc(db, 'ordenes', initialData.id!), orderData);
      }
      
      // Stock update
      const articles = orderAdditions.filter(a => a.categoria === 'articulo');
      if (articles.length > 0) {
        await Promise.all(articles.map(a => {
          if (!a.id) return Promise.resolve();
          return updateDoc(doc(db, 'servicios', a.id), { stock: increment(-(a.cantidad || 1)) });
        }));
      }
      
      clearForm();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      onShowToast?.('error', `ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.nombre.toLowerCase().includes(clienteNombre.toLowerCase()) ||
    c.cedula.includes(clienteNombre)
  );

  const isLavadero = idTipoOperacion === 'lavadero';
  const isTienda = idTipoOperacion === 'tienda';

  return (
    <div className="bg-slate-900 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-w-4xl mx-auto rounded-[2.5rem] border border-slate-800">
      <div className="bg-slate-950 p-8 border-b border-slate-800 flex items-center justify-between relative overflow-hidden">
         <div className={`absolute top-0 left-0 w-1 h-full shadow-[0_0_15px_rgba(255,255,255,0.5)] ${isLavadero ? 'bg-brand-cyan' : 'bg-brand-gold'}`}></div>
         <div className="flex items-center gap-5">
            <div className={`p-4 rounded-[1.5rem] border ${initialData ? 'bg-brand-gold/10 border-brand-gold/30 shadow-[0_0_20px_rgba(255,204,0,0.1)]' : (isLavadero ? 'bg-brand-cyan/10 border-brand-cyan/30 shadow-[0_0_20px_rgba(0,247,255,0.15)]' : 'bg-brand-gold/10 border-brand-gold/30 shadow-[0_0_20px_rgba(255,204,0,0.15)]')}`}>
               {isLavadero ? <ClipboardList className="w-7 h-7 text-brand-cyan" /> : <ShoppingBag className="w-7 h-7 text-brand-gold" />}
            </div>
            <div>
               <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                 {initialData ? 'Modificar Registro' : (isLavadero ? 'Nuevo Ingreso Patio' : 'Venta Directa Tienda')}
               </h3>
               <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full animate-pulse ${isLavadero ? 'bg-brand-cyan' : 'bg-brand-gold'}`}></div>
                 {isLavadero ? 'Configuración de Operación en Tiempo Real' : 'Terminal de Venta y Mostrador'}
               </p>
            </div>
         </div>

         <button 
           type="button"
           onClick={handleClose}
           className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600 rounded-2xl transition-all"
         >
            <X size={20} />
         </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-slate-900/50 backdrop-blur-xl">
        
        {/* MODE SELECTOR PILL */}
        {!initialData && (
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 max-w-md mx-auto shadow-2xl">
             <button 
              type="button"
              onClick={() => setIdTipoOperacion('lavadero')}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${
                isLavadero ? 'bg-brand-cyan text-slate-950 shadow-[0_0_30px_rgba(0,247,255,0.2)]' : 'text-slate-600 hover:text-slate-400'
              }`}
             >
               <Car size={16} />
               Lavadero
             </button>
             <button 
              type="button"
              onClick={() => setIdTipoOperacion('tienda')}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${
                isTienda ? 'bg-brand-gold text-slate-950 shadow-[0_0_30px_rgba(255,204,0,0.2)]' : 'text-slate-600 hover:text-slate-400'
              }`}
             >
               <ShoppingBag size={16} />
               Tienda
             </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT COLUMN: DATA STACK (Vehicle + Cart + Customer) */}
          <div className="space-y-6">
            {/* 1. Identification */}
            {isLavadero && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-l-2 border-brand-cyan pl-3">
                   <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Identificación Vehículo</h4>
                </div>
                
                <div className="grid grid-cols-12 gap-3 items-end">
                   <div className="col-span-8 space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest">Placa Operativa</label>
                      <input 
                        type="text" 
                        value={placa} 
                        onChange={(e) => handleHandlePlaca(e.target.value)}
                        placeholder="ABC-123"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-2xl font-black tracking-[0.2em] text-white focus:border-brand-cyan/50 focus:outline-none transition-all uppercase"
                        required={isLavadero} 
                      />
                   </div>
                   <div className="col-span-4 grid grid-cols-2 gap-2 h-[54px]">
                      <button type="button" onClick={() => setTipo('carro')} className={`flex items-center justify-center rounded-xl border transition-all ${tipo === 'carro' ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan shadow-[0_0_15px_rgba(0,247,255,0.1)]' : 'bg-slate-950 border-slate-800 text-slate-700'}`}>
                        <Car className="w-5 h-5" />
                      </button>
                      <button type="button" onClick={() => setTipo('moto')} className={`flex items-center justify-center rounded-xl border transition-all ${tipo === 'moto' ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan shadow-[0_0_15px_rgba(0,247,255,0.1)]' : 'bg-slate-950 border-slate-800 text-slate-700'}`}>
                        <MotorcycleIcon className="w-5 h-5" />
                      </button>
                   </div>
                </div>
              </div>
            )}

            {/* 2. Digital Cart / Additions List (Available for both modes now) */}
            <div className={`space-y-4 flex flex-col`}>
                <div className={`flex items-center justify-between border-l-2 pl-3 ${isTienda ? 'border-brand-gold' : 'border-slate-700'}`}>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <ShoppingCart size={14} className={isTienda ? 'text-brand-gold' : 'text-slate-500'} />
                      {isTienda ? 'Carrito de Compra' : 'Adicionales Cargados'}
                  </h4>
                  <span className={`${isTienda ? 'bg-brand-gold/10 text-brand-gold' : 'bg-slate-800 text-slate-500'} px-3 py-1 rounded-full text-[9px] font-black`}>{orderAdditions.length} ÍTEMS</span>
                </div>

                <div className={`flex-1 ${isLavadero ? 'min-h-[120px]' : 'min-h-[300px]'} bg-slate-950/30 rounded-3xl border border-slate-800/50 p-4 space-y-3 overflow-y-auto no-scrollbar`}>
                    {orderAdditions.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                          <ShoppingBag size={isLavadero ? 24 : 40} className="mb-4" />
                          <p className="text-[9px] font-black uppercase tracking-[0.2em]">{isTienda ? 'Carrito Vacío' : 'Sin Adicionales'}</p>
                      </div>
                    ) : (
                      orderAdditions.map((add, idx) => (
                          <div key={idx} className={`flex items-center gap-4 bg-slate-950 border border-slate-800 py-3 pl-5 pr-3 rounded-2xl group hover:border-${isTienda ? 'brand-gold' : 'brand-cyan'}/40 transition-all animate-in slide-in-from-left-2 duration-300`}>
                            <div className={`w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center ${isTienda ? 'text-brand-gold' : 'text-brand-cyan'} text-[10px] font-black border border-slate-800`}>
                                {add.cantidad || 1}
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="text-[11px] font-black text-white uppercase tracking-tight">
                                  {add.nombre}
                                </span>
                                <span className="text-[9px] font-black text-slate-600 tabular-nums">${(add.precio * (add.cantidad || 1)).toLocaleString()}</span>
                            </div>
                            <button type="button" onClick={() => removeAddition(idx)} className="p-2 hover:bg-red-500/10 hover:text-red-500 text-slate-800 rounded-xl transition-all">
                                <X className="w-4 h-4" />
                            </button>
                          </div>
                      ))
                    )}
                </div>
            </div>

            {/* 3. Customer Info (Always Bottom Left for Lavadero, conditional for Tienda) */}
            {(isLavadero || (isTienda && pagoCredito)) && (
              <div className="pt-4 space-y-4 border-t border-slate-800/40 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3 border-l-2 border-slate-700 pl-3">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Información Cliente</h4>
                  </div>
                  <div className="space-y-3">
                      <div className="relative group">
                          <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700 transition-colors ${isTienda ? 'group-focus-within:text-brand-gold' : 'group-focus-within:text-brand-cyan'}`} />
                          <input 
                              type="text" 
                              value={clienteNombre}
                              onChange={(e) => { setClienteNombre(validateName(e.target.value).toUpperCase()); setShowSearch(true); }}
                              onFocus={() => setShowSearch(true)}
                              placeholder="NOMBRE DEL CLIENTE"
                              className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-[10px] font-black text-white focus:outline-none transition-all uppercase tracking-widest ${isTienda ? 'focus:border-brand-gold/50' : 'focus:border-brand-cyan/50'}`}
                              required={isLavadero || (isTienda && pagoCredito)}
                          />
                          {showSearch && clienteNombre && filteredCustomers.length > 0 && (
                            <div className="absolute z-[100] left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden">
                                {filteredCustomers.map(cust => (
                                    <div key={cust.id} onClick={() => selectCustomer(cust)} className="p-3 hover:bg-slate-900 cursor-pointer border-b border-slate-900 flex justify-between group">
                                        <div className="flex flex-col">
                                            <span className={`text-[11px] font-black uppercase transition-colors ${isTienda ? 'text-white group-hover:text-brand-gold' : 'text-white group-hover:text-brand-cyan'}`}>{cust.nombre}</span>
                                            <span className="text-[9px] text-slate-500 font-bold">{cust.cedula}</span>
                                        </div>
                                        <ChevronRight size={12} className="text-slate-800" />
                                    </div>
                                ))}
                            </div>
                          )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <input type="number" value={clienteCedula} onChange={(e) => setClienteCedula(e.target.value.toUpperCase())} placeholder="CÉDULA" className={`cyber-input-premium font-mono uppercase focus:outline-none ${isTienda ? 'focus:border-brand-gold/30' : 'focus:border-brand-cyan/30'}`} required={isLavadero || (isTienda && pagoCredito)} />
                          <input type="number" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value.slice(0, 10))} placeholder="TELÉFONO" className={`cyber-input-premium focus:outline-none ${isTienda ? 'focus:border-brand-gold/30' : 'focus:border-brand-cyan/30'}`} required={isLavadero || (isTienda && pagoCredito)} />
                      </div>
                  </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ACTION HUB (Search & Config) */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-l-2 border-slate-700 pl-3">
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Configuración de Operación</h4>
            </div>

            {/* 1. Operation Config (Top for Lavadero) */}
            {isLavadero && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-right-2 duration-300">
                  <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest">Servicio Base</label>
                      <select 
                          value={selectedService} 
                          onChange={(e) => setSelectedService(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-black text-white focus:border-brand-cyan/50 focus:outline-none transition-all appearance-none cursor-pointer uppercase"
                          required={isLavadero}
                      >
                          <option value="">-- SERVICIO --</option>
                          {services
                              .filter(s => (s.esPrincipal || (s.esPrincipal === undefined && !s.esAdicional)) && (s.tipoVehiculo === tipo || s.tipoVehiculo === 'ambos'))
                              .map(s => <option key={s.id} value={s.id}>{s.nombre.toUpperCase()} (${s.precio.toLocaleString()})</option>)
                          }
                      </select>
                  </div>

                  <div className="space-y-1.5 relative">
                      <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest">Responsable</label>
                      <div 
                        onClick={() => setIsWorkerDropdownOpen(!isWorkerDropdownOpen)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isWorkerDropdownOpen ? 'bg-slate-900 border-brand-cyan' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                         <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-black border ${
                               selectedEmployee ? 'bg-brand-cyan text-slate-950 border-brand-cyan' : 'bg-slate-900 border-slate-800 text-slate-700'
                            }`}>
                              {selectedEmployee ? employees.find(e => e.id === selectedEmployee)?.nombre.charAt(0) : '?'}
                            </div>
                            <span className={`text-[10px] font-black uppercase truncate max-w-[80px] ${selectedEmployee ? 'text-white' : 'text-slate-700'}`}>
                              {selectedEmployee ? employees.find(e => e.id === selectedEmployee)?.nombre : 'OPERARIO'}
                            </span>
                         </div>
                         <ChevronDown size={14} className={`text-slate-800 transition-transform ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                       {isWorkerDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 z-[110] mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden animate-in slide-in-from-top-2 duration-300">
                           <div className="p-3 bg-slate-900/50 border-b border-slate-900 flex flex-col gap-2">
                              <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700 group-focus-within:text-brand-cyan" />
                                <input 
                                  autoFocus
                                  type="text"
                                  value={workerSearch}
                                  onChange={(e) => setWorkerSearch(e.target.value.toUpperCase())}
                                  placeholder="FILTRAR..."
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-[10px] font-black text-white focus:outline-none focus:border-brand-cyan transition-all"
                                />
                              </div>
                           </div>
                           <div className="max-h-52 overflow-y-auto no-scrollbar p-1.5 space-y-1">
                              {sortedEmployees.map((e) => {
                                const load = getEmployeeWorkload(e.id!);
                                return (
                                  <div 
                                    key={e.id}
                                    onClick={() => { setSelectedEmployee(e.id!); setIsWorkerDropdownOpen(false); setWorkerSearch(''); }}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer group ${
                                      selectedEmployee === e.id ? 'bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan' : 'hover:bg-slate-900 text-slate-500'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-black border ${
                                        selectedEmployee === e.id ? 'bg-brand-cyan text-slate-950' : 'bg-slate-900 border-slate-800'
                                      }`}>{e.nombre.charAt(0)}</div>
                                      <div>
                                        <p className="text-[11px] font-black uppercase tracking-tight leading-none mb-1">{e.nombre}</p>
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-1 h-1 rounded-full ${load === 0 ? 'bg-brand-green' : 'bg-brand-gold'}`}></div>
                                          <p className="text-[7.5px] font-black uppercase tracking-widest opacity-60">CARGA: {load}</p>
                                        </div>
                                      </div>
                                    </div>
                                    {selectedEmployee === e.id && <Check size={12} strokeWidth={4} />}
                                  </div>
                                );
                              })}
                           </div>
                        </div>
                      )}
                  </div>
              </div>
            )}

            {/* 2. Search Area (Middle for Lavadero, Top for Tienda) */}
            <div className={`space-y-4 relative ${isLavadero ? 'pt-4 border-t border-slate-800/40' : ''}`}>
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-slate-500 block uppercase tracking-widest">Buscador {isTienda ? 'Productos' : 'Extras'}</label>
                  <Package className={`w-3.5 h-3.5 ${isTienda ? 'text-brand-gold' : 'text-brand-cyan'} opacity-40`} />
                </div>

                <div className="relative group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 transition-colors ${isTienda ? 'group-focus-within:text-brand-gold' : 'group-focus-within:text-brand-cyan'}`} />
                    <input 
                        type="text" 
                        value={additionSearch} 
                        onChange={(e) => {
                            setAdditionSearch(e.target.value.toUpperCase());
                            setShowAdditionResults(true);
                        }}
                        onFocus={() => setShowAdditionResults(true)}
                        placeholder={isTienda ? "ESCRIBE PRODUCTO..." : "AÑADIR SERVICIOS EXTRA..."}
                        className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-[10px] font-black text-white focus:outline-none transition-all uppercase tracking-widest ${
                           isTienda ? 'focus:border-brand-gold/50' : 'focus:border-brand-cyan/50'
                        }`}
                    />
                    {showAdditionResults && additionSearch && (
                        <div className="absolute z-[100] left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
                            {services
                                .filter(s => 
                                    s.esAdicional && 
                                    (isLavadero ? (s.tipoVehiculo === tipo || s.tipoVehiculo === 'ambos') : s.categoria === 'articulo') && 
                                    s.nombre.toLowerCase().includes(additionSearch.toLowerCase())
                                )
                                .map(s => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => addPredefinedAddition(s)}
                                        className="p-4 hover:bg-slate-900 cursor-pointer border-b border-slate-900/50 flex justify-between items-center group transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg bg-slate-900 ${isTienda ? 'text-brand-gold' : 'text-brand-cyan'}`}>
                                               {s.categoria === 'articulo' ? <ShoppingBag size={14} /> : <Plus size={14} />}
                                            </div>
                                            <div>
                                                <span className="text-[12px] font-black text-white uppercase group-hover:text-brand-cyan transition-colors">{s.nombre}</span>
                                                <span className="text-[9px] text-slate-600 font-bold block mt-1 tracking-widest">${s.precio.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <PlusCircle size={18} className={`text-slate-800 ${isTienda ? 'group-hover:text-brand-gold' : 'group-hover:text-brand-cyan'}`} />
                                    </div>
                                ))
                            }
                        </div>
                    )}
                </div>

                {/* QUANTITY PICKER PANEL */}
                {selectedSvcForQty && (
                  <div className={`border-2 p-5 rounded-3xl space-y-4 animate-in zoom-in-95 duration-300 ${isTienda ? 'bg-brand-gold/5 border-brand-gold/20' : 'bg-brand-cyan/5 border-brand-cyan/20'}`}>
                    <div className="flex justify-between items-center px-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isTienda ? 'text-brand-gold' : 'text-brand-cyan'}`}>{selectedSvcForQty.nombre}</span>
                      <button type="button" onClick={() => setSelectedSvcForQty(null)}><X size={14} className="text-slate-600 hover:text-white transition-colors" /></button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                          <button type="button" onClick={() => setTempQty(Math.max(1, tempQty - 1))} className="w-8 h-8 bg-slate-900 rounded-lg text-lg font-black text-white">-</button>
                          <span className="text-xl font-black text-white w-12 text-center font-mono">{tempQty}</span>
                          <button type="button" onClick={() => setTempQty(tempQty + 1)} className="w-8 h-8 bg-slate-900 rounded-lg text-lg font-black text-white">+</button>
                      </div>
                      <button 
                        type="button"
                        onClick={confirmAdditionWithQty}
                        className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all ${isTienda ? 'bg-brand-gold text-slate-950' : 'bg-brand-cyan text-slate-950'}`}
                      >
                        CONFIRMAR ${ (selectedSvcForQty.precio * tempQty).toLocaleString() }
                      </button>
                    </div>
                  </div>
                )}
            </div>

            {/* 3. Payment & Total Section (Bottom for both) */}
             <div className="pt-4 space-y-4">
                 <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Liquidación Total</span>
                    <span className={`text-3xl font-black tabular-nums tracking-tighter ${isTienda ? 'text-brand-gold' : 'text-brand-cyan'}`}>
                       ${( (services.find(s => s.id === selectedService)?.precio || 0) + orderAdditions.reduce((acc, curr) => acc + (curr.precio * (curr.cantidad || 1)), 0) ).toLocaleString()}
                    </span>
                 </div>

                 <div className={`grid gap-3 ${isLavadero ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {isLavadero && (
                      <button 
                         type="button"
                         onClick={handleTogglePagoInmediato}
                         className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
                            pagoAnticipado ? 'bg-brand-gold/10 border-brand-gold text-brand-gold shadow-[0_0_20px_rgba(255,204,0,0.1)]' : 'bg-slate-950 border-slate-800 text-slate-700 opacity-50'
                         }`}
                      >
                         <CreditCard size={16} />
                         <span className="text-[10px] font-black uppercase text-left flex-1">Inmediato</span>
                         {pagoAnticipado && <Check className="w-3 h-3 text-brand-gold" />}
                      </button>
                    )}

                    <button 
                       type="button"
                       onClick={handleTogglePagoCredito}
                       className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
                          pagoCredito ? (isTienda ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' : 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan shadow-[0_0_20px_rgba(0,247,255,0.1)]') : 'bg-slate-950 border-slate-800 text-slate-700 opacity-50'
                       }`}
                    >
                       <Users size={16} />
                       <span className="text-[10px] font-black uppercase text-left flex-1">{isTienda ? 'Venta a Crédito' : 'Crédito'}</span>
                       {pagoCredito && <Check className={`w-3 h-3 ${isTienda ? 'text-brand-gold' : 'text-brand-cyan'}`} />}
                    </button>
                 </div>
             </div>
          </div>
        </div>

        {/* SUBMIT SECTION */}
        <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between">
           <div className="hidden lg:flex flex-col">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Protocolo Operativo</span>
              <div className="flex items-center gap-2 text-brand-green mt-1">
                 <ShieldCheck size={12} />
                 <span className="text-[7px] font-black uppercase tracking-widest">SISTEMA EN LÍNEA</span>
              </div>
           </div>
           
           <div className="flex items-center gap-3 w-full lg:w-auto">
              <button 
                type="button" 
                onClick={clearForm}
                className="px-6 py-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
              >
                Reset
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className={`flex-1 lg:flex-none px-12 py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] transition-all duration-300 shadow-xl active:scale-95 ${
                  loading ? 'bg-slate-800 text-slate-600' : 
                  isLavadero ? 'bg-brand-cyan text-slate-950 shadow-brand-cyan/20' :
                  'bg-brand-gold text-slate-950 shadow-brand-gold/20'
                }`}
              >
                {loading ? (
                   <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                   </div>
                ) : (
                   <div className="flex items-center gap-2">
                      {initialData ? <RefreshCcw size={16} /> : <PlusCircle size={16} />}
                      <span>{initialData ? 'Sincronizar' : (isTienda ? 'Finalizar Venta' : 'Confirmar Registro')}</span>
                   </div>
                )}
              </button>
           </div>
        </div>
      </form>

      {/* DISCARD CONFIRMATION MODAL */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowDiscardConfirm(false)}></div>
          <div className="relative w-full max-w-sm glass-panel p-8 rounded-[2rem] border border-brand-gold/20 text-center animate-in scale-in duration-300">
            <AlertCircle className="w-12 h-12 text-brand-gold mx-auto mb-6" />
            <h3 className="text-xl font-black text-white uppercase mb-2">Descartar Cambios</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-8">¿Está seguro que desea cerrar? Los datos ingresados se perderán.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDiscardConfirm(false)} className="flex-1 py-4 bg-slate-900 text-slate-500 rounded-xl font-black text-[10px] uppercase">Continuar</button>
              <button 
                onClick={() => { setShowDiscardConfirm(false); onClose?.(); }} 
                className="flex-1 py-4 bg-brand-gold text-slate-950 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-brand-gold/20"
              >Sí, Descartar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
