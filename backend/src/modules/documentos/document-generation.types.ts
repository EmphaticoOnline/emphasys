import type { TipoDocumento } from "../../types/documentos";

export interface OpcionGeneracion {
  tipo_documento_destino: TipoDocumento;
  nombre: string;
  orden?: number;
}

export interface PrepararGeneracionPartida {
  partida_id: number;
  producto_id: number | null;
  descripcion: string | null;
  unidad: string | null;
  cantidad_origen: number;
  cantidad_ya_generada: number;
  cantidad_pendiente_sugerida: number;
  cantidad_default: number;
  precio_unitario: number;
}

export interface PrepararGeneracionResponse {
  documento_origen: {
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
  };
  tipo_documento_destino: TipoDocumento;
  partidas: PrepararGeneracionPartida[];
}

export interface DatosEncabezadoGeneracion {
  serie?: string | null;
  fecha?: string | Date;
  contacto_principal_id?: number | null;
  conversacion_id?: number | null;
  comentarios?: string | null;
}

export interface GenerarDocumentoPartidaInput {
  partida_origen_id: number;
  cantidad: number;
}

export interface GenerarDocumentoPayload {
  documento_origen_id: number;
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
