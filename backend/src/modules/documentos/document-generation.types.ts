import type { TipoDocumento } from "../../types/documentos";

export interface OpcionGeneracion {
  tipo_documento_destino: TipoDocumento;
  nombre: string;
  orden?: number;
}

export interface PrepararGeneracionPartida {
  partida_id: number;
  documento_origen_id: number;
  documento_origen_folio: string | null;
  producto_id: number | null;
  descripcion: string | null;
  unidad: string | null;
  cantidad_origen: number;
  cantidad_ya_generada: number;
  cantidad_pendiente_sugerida: number;
  cantidad_default: number;
  precio_unitario: number;
  importe_maximo_sugerido: number;
}

export interface PrepararGeneracionResponse {
  documento_origen: {
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
  } | null;
  documentos_origen: Array<{
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
  }>;
  es_consolidado: boolean;
  tipo_documento_destino: TipoDocumento;
  partidas: PrepararGeneracionPartida[];
}

export interface DatosEncabezadoGeneracion {
  serie?: string | null;
  fecha?: string | Date;
  contacto_principal_id?: number | null;
  conversacion_id?: number | null;
  comentarios?: string | null;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  concepto_id?: number | null;
  producto_resumen?: string | null;
  rfc_receptor?: string | null;
  nombre_receptor?: string | null;
  regimen_fiscal_receptor?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
}

export interface GenerarDocumentoPartidaInput {
  partida_origen_id: number;
  cantidad: number;
  monto_bonificacion?: number | null;
}

export interface GenerarDocumentoPayload {
  documento_origen_id?: number;
  documento_origen_ids?: number[];
  documento_destino_id?: number;
  tipo_documento_destino: TipoDocumento;
  datos_encabezado?: DatosEncabezadoGeneracion;
  partidas: GenerarDocumentoPartidaInput[];
}

export interface GenerarDocumentoResultado {
  documento_destino_id: number;
  tipo_documento_destino: TipoDocumento;
  folio: string | null;
  subtotal: number;
  iva: number;
  total: number;
  partidas: Array<{
    partida_destino_id: number;
    partida_origen_id: number;
    cantidad: number;
  }>;
}
