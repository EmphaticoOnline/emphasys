export interface PolizaEncabezado {
  id: number;
  empresa_id: number;
  tipo_poliza_id: number;
  tipo_poliza_identificador: string;
  ejercicio: number;
  periodo: number;
  numero: number;
  fecha: string;
  referencia: string | null;
  observaciones: string | null;
  total_cargos: number;
  total_abonos: number;
  modulo_origen: string | null;
  estatus: string;
  creada_por_id: number | null;
  creada_por_nombre: string | null;
  modificada_por_id: number | null;
  modificada_por_nombre: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PolizaMovimiento {
  id: number;
  poliza_id: number;
  renglon: number;
  cuenta_id: number;
  cuenta: string;
  cuenta_descripcion: string;
  concepto_id: number | null;
  concepto_descripcion: string | null;
  concepto_texto: string | null;
  cargo: number;
  abono: number;
  fecha: string | null;
  uuid_cfdi: string | null;
  rfc: string | null;
}

export type PolizaMovimientoInput = {
  cuenta_id: number;
  concepto_id?: number | null;
  concepto_texto?: string | null;
  cargo?: number;
  abono?: number;
  uuid_cfdi?: string | null;
  rfc?: string | null;
};

export type PolizaEncabezadoInput = {
  tipo_poliza_id: number;
  fecha: string;
  referencia?: string | null;
  observaciones?: string | null;
  estatus: 'borrador' | 'aplicada';
  movimientos: PolizaMovimientoInput[];
};

export interface PolizaConMovimientos {
  encabezado: PolizaEncabezado;
  movimientos: PolizaMovimiento[];
}

export interface SiguienteNumeroResultado {
  numero: number;
  ejercicio: number;
  periodo: number;
}

export interface CuentaAfectable {
  id: number;
  cuenta: string;
  descripcion: string;
}

export interface PolizaValidacionDetalle {
  renglon: number;
  cuenta_id: number;
  cuenta: string | null;
  motivo: string;
}

export interface ResultadoLotePoliza {
  id: number;
  numero: number | null;
  tipo: string | null;
  ok: boolean;
  omitida: boolean;
  estatus: string | null;
  message: string;
  detalles?: PolizaValidacionDetalle[];
}

export interface ResumenLotePolizas {
  procesadas: number;
  exitosas: number;
  omitidas: number;
  fallidas: number;
}
