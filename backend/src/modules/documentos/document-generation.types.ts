import type { TipoDocumento } from "../../types/documentos";

export interface OpcionGeneracion {
  tipo_documento_destino: TipoDocumento;
  nombre: string;
  orden?: number;
  modo_autorizacion: 'ninguna' | 'directa' | 'flujo' | null;
  usuario_puede_autorizar: boolean | null;
  rol_requerido: string | null;
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
    tratamiento_impuestos?: 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | null;
  } | null;
  documentos_origen: Array<{
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
    tratamiento_impuestos?: 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | null;
  }>;
  es_consolidado: boolean;
  tipo_documento_destino: TipoDocumento;
  partidas: PrepararGeneracionPartida[];
}

export interface DatosEncabezadoGeneracion {
  serie?: string | null;
  fecha?: string | Date;
  fecha_vencimiento?: string | null;
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
  tratamiento_impuestos?: 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | null;
  serie_externa?: string | null;
  numero_externo?: number | null;
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
  /**
   * Solo aplica cuando el documento generado es una nota de venta (tipo_documento_destino
   * = 'factura' con tratamiento_impuestos = 'sin_iva'). Para cualquier otro caso se ignora.
   */
  emitir_al_generar?: boolean;
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
  /**
   * Presente solo si se solicitó `emitir_al_generar` para una nota de venta. El documento
   * ya quedó creado (COMMIT) independientemente de si la emisión tuvo éxito o no.
   */
  emision?: {
    intentada: boolean;
    exitosa: boolean;
    mensaje: string | null;
  };
}
