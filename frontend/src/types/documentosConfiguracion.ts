export type AfectaInventario = 'none' | 'entrada' | 'salida' | 'transferencia';

export type DocumentoEmpresa = {
  id: number;
  codigo: string;
  nombre: string;
  nombre_plural: string;
  icono: string | null;
  orden: number;
  habilitado: boolean;
  whatsapp_plantilla_default_id: number | null;
  /** null = sin override de empresa (hereda del catálogo). */
  afecta_inventario: AfectaInventario | null;
  /** Default del catálogo global. Solo lectura, para mostrar en UI. */
  afecta_inventario_sistema: AfectaInventario | null;
  afecta_reservado: boolean;
};

export type TransicionDocumento = {
  tipo_documento_origen_id: number;
  tipo_documento_destino_id: number;
  activo: boolean;
};

export type FlujoDocumentosResponse = {
  documentos: DocumentoEmpresa[];
  transiciones: TransicionDocumento[];
};