export type TipoSolicitudPolizas = 'AF' | 'FC' | 'DE' | 'CO';

export type EstadoMovimientoPolizaXml =
  | 'correcto'
  | 'uuid_no_encontrado'
  | 'cfdi_cancelado'
  | 'rfc_no_coincide'
  | 'uuid_sin_rfc'
  | 'sin_uuid'
  | 'error';

export interface ErrorPolizaXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaPolizaXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface MovimientoPolizaXml {
  renglon: number;
  cuenta: string | null;
  descripcion: string | null;
  concepto: string | null;
  debe: number;
  haber: number;
  uuid_cfdi: string | null;
  rfc: string | null;
  cfdi_encontrado: boolean;
  estatus_sat: string | null;
  estado: EstadoMovimientoPolizaXml;
  motivo: string | null;
  incluir_comprobante: boolean;
  monto_cfdi: number | null;
  moneda_cfdi: string | null;
  rfc_comprobante: string | null;
}

export interface PolizaXml {
  poliza_id: number;
  tipo: string;
  numero: number;
  fecha: string;
  concepto: string;
  num_un_iden_pol: string;
  movimientos: MovimientoPolizaXml[];
}

export interface PolizasPeriodoXmlResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_solicitud: TipoSolicitudPolizas;
  num_orden: string | null;
  num_tramite: string | null;
  resumen: {
    polizas: number;
    movimientos: number;
    comprobantes: number;
    errores: number;
    advertencias: number;
  };
  polizas: PolizaXml[];
  errores: ErrorPolizaXml[];
  advertencias: AdvertenciaPolizaXml[];
}
