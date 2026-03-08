import type { TipoDocumento } from '../../types/documentos.types';

export type DocumentoField =
  | 'contacto_principal_id'
  | 'fecha_documento'
  | 'moneda'
  | 'tipo_cambio'
  | 'observaciones'
  | 'serie'
  | 'numero'
  | 'rfc_receptor'
  | 'nombre_receptor'
  | 'metodo_pago'
  | 'forma_pago'
  | 'uso_cfdi'
  | 'regimen_fiscal_receptor'
  | 'lugar_expedicion'
  | 'codigo_postal_receptor'
  | 'subtotal'
  | 'iva'
  | 'total'
  | 'usuario_creacion_id'
  | 'empresa_id'
  | 'partidas';

export type DocumentoSectionKey =
  | 'encabezado'
  | 'cliente'
  | 'fechas'
  | 'moneda'
  | 'fiscal'
  | 'partidas'
  | 'totales'
  | 'observaciones'
  | 'otros';

export type DocumentoSectionRule = {
  /**
   * When undefined defaults to true.
   */
  visible?: boolean;
  label?: string;
  description?: string;
};

export type DocumentoFieldRule = {
  /**
   * When undefined defaults to true.
   */
  visible?: boolean;
  /**
   * When undefined defaults to false.
   */
  required?: boolean;
  readOnly?: boolean;
  section?: DocumentoSectionKey;
  helperText?: string;
};

export type DocumentoFiscalRules = {
  requiereDatosFiscales?: boolean;
  requiereMetodoPago?: boolean;
  requiereFormaPago?: boolean;
  requiereUsoCfdi?: boolean;
  requiereRegimenFiscal?: boolean;
  requiereTipoCambio?: boolean;
};

export type DocumentoEstatus = 'borrador' | 'emitido' | 'cancelado' | 'cerrado' | 'timbrado' | 'pagado';

export type DocumentoTypeConfig = {
  tipo: TipoDocumento;
  label: string;
  descripcion?: string;
  secciones?: Partial<Record<DocumentoSectionKey, DocumentoSectionRule>>;
  campos?: Partial<Record<DocumentoField, DocumentoFieldRule>>;
  fiscales?: DocumentoFiscalRules;
  estatusPermitidos?: DocumentoEstatus[];
};

export type DocumentoTypeConfigMap = Record<TipoDocumento, DocumentoTypeConfig>;

export const DOCUMENTO_SECTIONS: readonly DocumentoSectionKey[] = [
  'encabezado',
  'cliente',
  'fechas',
  'moneda',
  'fiscal',
  'partidas',
  'totales',
  'observaciones',
  'otros',
] as const;

export const DOCUMENTO_FIELDS: readonly DocumentoField[] = [
  'contacto_principal_id',
  'fecha_documento',
  'moneda',
  'tipo_cambio',
  'observaciones',
  'serie',
  'numero',
  'rfc_receptor',
  'nombre_receptor',
  'metodo_pago',
  'forma_pago',
  'uso_cfdi',
  'regimen_fiscal_receptor',
  'lugar_expedicion',
  'codigo_postal_receptor',
  'subtotal',
  'iva',
  'total',
  'usuario_creacion_id',
  'empresa_id',
  'partidas',
] as const;
