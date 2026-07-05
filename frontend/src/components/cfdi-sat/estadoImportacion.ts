import type { CfdiSatEstadoImportacionOperativo } from '../../services/cfdiSatService';

/**
 * Label + color del chip de estado operativo de importación (Fase 10),
 * compartido entre la bandeja (ComprobantesSatSection) y el diálogo de
 * detalle (ComprobanteDetalleDialog) para que nunca se desalineen.
 */
export const ESTADO_IMPORTACION_INFO: Record<
  CfdiSatEstadoImportacionOperativo,
  { label: string; color: 'success' | 'warning' | 'error' | 'default' }
> = {
  importado: { label: 'Importado', color: 'success' },
  listo_para_importar: { label: 'Listo para importar', color: 'success' },
  sin_xml: { label: 'Sin XML', color: 'default' },
  cancelado: { label: 'Cancelado', color: 'error' },
  proveedor_no_encontrado: { label: 'Proveedor no encontrado', color: 'warning' },
  proveedor_duplicado: { label: 'Proveedor duplicado', color: 'warning' },
  proveedor_tipo_invalido: { label: 'Tipo de contacto inválido', color: 'warning' },
  impuestos_no_mapeados: { label: 'Impuesto no mapeado', color: 'warning' },
  rfc_receptor_no_coincide: { label: 'RFC receptor no coincide', color: 'error' },
  uuid_ya_existe_en_documentos: { label: 'Ya existe en Compras', color: 'success' },
  no_aplica: { label: 'No aplica', color: 'default' },
};

/** Independiente del estado principal: señal de que puede existir una factura ya capturada manualmente. */
export const POSIBLE_DUPLICADO_LABEL = 'Posible duplicado';
