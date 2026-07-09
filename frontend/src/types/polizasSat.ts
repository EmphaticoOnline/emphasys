export type EstadoMovimientoPolizaSat =
  | 'correcto'
  | 'uuid_no_encontrado'
  | 'cfdi_cancelado'
  | 'rfc_no_coincide'
  | 'uuid_sin_rfc'
  | 'sin_uuid'
  | 'error';

export interface ErrorPolizaSat {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaPolizaSat {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface MovimientoPolizaSat {
  poliza_id: number;
  tipo_poliza: string;
  numero: number;
  fecha: string;
  renglon: number;
  cuenta: string | null;
  descripcion_cuenta: string | null;
  concepto: string | null;
  cargo: number;
  abono: number;
  uuid_cfdi: string | null;
  rfc: string | null;
  cfdi_encontrado: boolean;
  estatus_sat: string | null;
  rfc_coincide: boolean | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: number | null;
  tipo_comprobante: string | null;
  estado: EstadoMovimientoPolizaSat;
  motivo: string | null;
}

export interface PolizasSatResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  resumen: {
    polizas: number;
    movimientos: number;
    movimientos_con_uuid: number;
    uuid_encontrados: number;
    uuid_no_encontrados: number;
    cfdi_cancelados: number;
    rfc_no_coincide: number;
    errores: number;
    advertencias: number;
  };
  movimientos: MovimientoPolizaSat[];
  errores: ErrorPolizaSat[];
  advertencias: AdvertenciaPolizaSat[];
}
