export type TipoSolicitudPolizas = 'AF' | 'FC' | 'DE' | 'CO';

// ── Auxiliar de folios fiscales ─────────────────────────────────────────

export type EstadoFolioXml = 'correcto' | 'uuid_no_encontrado' | 'cfdi_cancelado' | 'rfc_no_coincide' | 'uuid_sin_rfc' | 'error';

export interface ErrorFolioXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaFolioXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface FolioXml {
  uuid_cfdi: string;
  rfc: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: number | null;
  moneda: string | null;
  estatus_sat: string | null;
  poliza: string;
  fecha: string;
  renglon: number;
  cuenta: string | null;
  descripcion_cuenta: string | null;
  concepto: string | null;
  cargo: number;
  abono: number;
  estado: EstadoFolioXml;
  motivo: string | null;
  incluir_en_xml: boolean;
  rfc_comprobante: string | null;
}

export interface AuxiliarFoliosResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_solicitud: TipoSolicitudPolizas;
  num_orden: string | null;
  num_tramite: string | null;
  resumen: {
    folios: number;
    polizas: number;
    movimientos: number;
    uuid_encontrados: number;
    uuid_no_encontrados: number;
    cfdi_cancelados: number;
    errores: number;
    advertencias: number;
  };
  folios: FolioXml[];
  errores: ErrorFolioXml[];
  advertencias: AdvertenciaFolioXml[];
}

// ── Auxiliar de cuentas (Fase 10B) ──────────────────────────────────────

export type EstadoCuentaAuxiliar = 'correcto' | 'error';

export interface ErrorCuentaAuxiliar {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaCuentaAuxiliar {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface DetalleMovimientoAuxiliar {
  fecha: string;
  poliza: string;
  renglon: number;
  concepto: string | null;
  debe: number;
  haber: number;
}

export interface CuentaAuxiliar {
  cuenta_id: number;
  num_cta: string;
  descripcion: string;
  saldo_ini: number;
  saldo_fin: number;
  naturaleza: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
  estado: EstadoCuentaAuxiliar;
  motivo: string | null;
  detalle: DetalleMovimientoAuxiliar[];
}

export interface AuxiliarCuentasResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_solicitud: TipoSolicitudPolizas;
  num_orden: string | null;
  num_tramite: string | null;
  cuenta_id: number | null;
  resumen: {
    cuentas: number;
    movimientos: number;
    errores: number;
    advertencias: number;
  };
  cuentas: CuentaAuxiliar[];
  errores: ErrorCuentaAuxiliar[];
  advertencias: AdvertenciaCuentaAuxiliar[];
}
