export type DocumentoEmpresa = {
  id: number;
  codigo: string;
  nombre: string;
  nombre_plural: string;
  icono: string | null;
  orden: number;
  habilitado: boolean;
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