export type VehicleType = 'carro' | 'moto';
export type OrderStatus = 'espera' | 'proceso' | 'listo' | 'pagado' | 'finalizado';

export interface Service {
  id: string;
  nombre: string;
  precio: number;
  comision: number; // Porcentaje como 0.35 para el 35%
  tipoVehiculo: VehicleType | 'ambos';
  esAdicional?: boolean;
  categoria: 'servicio' | 'articulo';
  stock?: number;
}

export interface Employee {
  id: string;
  tipoDocumento: string; // CC, CE, Pasaporte
  documento: string; // Cédula
  nombre: string;
  telefono: string;
  direccion: string;
  activo: boolean;
}

export interface Customer {
  id?: string;
  nombre: string;
  cedula: string;
  telefono: string;
}

export interface Order {
  id?: string;
  placa: string;
  tipo: VehicleType;
  servicioId: string;
  servicioNombre: string;
  servicioPrincipalPagado?: boolean; // Track if the main wash is already paid
  lavadorId: string;
  lavadorNombre: string;
  estado: OrderStatus;
  total: number;
  comisionMonto: number;
  pagoAnticipado?: boolean;
  pagoCredito?: boolean;
  montoPagado?: number;
  adicionales?: { 
    svcId?: string; 
    categoria?: string; 
    nombre: string; 
    precio: number; 
    comision: number; 
    cantidad: number;
    pagado?: boolean; // Track individual item payment status
  }[];
  clienteNombre?: string;
  clienteCedula?: string;
  clienteTelefono?: string;
  timestamp: any;
  idTipoOperacion?: 'lavadero' | 'tienda';
  esTienda?: boolean;
}
