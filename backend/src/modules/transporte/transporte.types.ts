export type ViajeEditableStatus = 'borrador' | 'listo_para_validar' | 'validado';
export type ViajeStatus = ViajeEditableStatus | 'timbrado' | 'cancelado';

export interface ViajeUbicacionInput {
  ubicacionId?: number | null;
  tipo: 'origen' | 'destino';
  secuencia: number;
  fechaHoraProgramada: string;
  fechaHoraReal?: string | null;
  distanciaRecorrida?: number | null;
}

export interface ViajeMercanciaInput {
  mercanciaId: number;
  cantidad: number;
  pesoKg: number;
  valorMercancia?: number | null;
  origenSecuencia?: number | null;
  destinoSecuencia?: number | null;
}

export interface ViajeFiguraInput {
  tipoFigura: string;
  operadorId?: number | null;
  contactoId?: number | null;
  secuencia: number;
}

export interface ViajeRemolqueInput {
  remolqueId: number;
  orden: number;
}

export interface ViajeInput {
  folioInterno: string;
  clienteContactoId: number;
  estatus: ViajeEditableStatus;
  fechaProgramada?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  vehiculoId?: number | null;
  referenciaCliente?: string | null;
  observaciones?: string | null;
  ubicaciones: ViajeUbicacionInput[];
  mercancias: ViajeMercanciaInput[];
  figuras: ViajeFiguraInput[];
  remolques: ViajeRemolqueInput[];
}

export class TransporteError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'TRANSPORTE_VALIDATION'
  ) {
    super(message);
  }
}

export type UbicacionMaster = {
  id: number;
  nombre: string;
  rfc: string | null;
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia: string | null;
  localidad: string | null;
  municipio: string | null;
  estado: string | null;
  pais: string | null;
  codigo_postal: string | null;
  referencia: string | null;
  latitud: string | number | null;
  longitud: string | number | null;
};

export type MercanciaMaster = {
  id: number;
  descripcion: string;
  clave_bienes_transportados_sat: string | null;
  clave_unidad_sat: string | null;
  unidad_descripcion: string | null;
  material_peligroso: boolean;
  clave_material_peligroso: string | null;
  embalaje: string | null;
  descripcion_embalaje: string | null;
};

export type OperadorMaster = {
  id: number;
  contacto_id: number;
  numero_licencia: string;
  tipo_licencia: string | null;
  vigencia_licencia: string | null;
  nombre: string;
  rfc: string | null;
  curp: string | null;
  domicilio: Record<string, unknown> | null;
};

export type RemolqueMaster = {
  id: number;
  placas: string;
  subtipo_remolque_sat: string | null;
};
