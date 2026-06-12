import type { TipoDocumento } from '../types/documentos';

export type WhatsappTemplateAction = 'documento_pdf' | 'cfdi' | 'reactivacion' | 'seguimiento';
export type WhatsappTemplateType =
  | 'envio_cotizacion'
  | 'envio_orden_servicio'
  | 'envio_orden_compra'
  | 'envio_cfdi'
  | 'envio_nota_venta'
  | 'reactivacion'
  | 'seguimiento';

export const DEFAULT_WHATSAPP_TEMPLATE_ACTION: Extract<WhatsappTemplateAction, 'reactivacion' | 'seguimiento'> = 'reactivacion';

const DOCUMENTO_PDF_TEMPLATE_BY_DOCUMENTO: Partial<Record<TipoDocumento, WhatsappTemplateType>> = {
  cotizacion: 'envio_cotizacion',
  orden_servicio: 'envio_orden_servicio',
  orden_compra: 'envio_orden_compra',
};

const CFDI_TEMPLATE_BY_DOCUMENTO: Partial<Record<TipoDocumento, WhatsappTemplateType>> = {
  factura: 'envio_cfdi',
};

function normalizarValor(valor: string | undefined | null): string {
  return String(valor ?? '').trim().toLowerCase();
}

export function resolverTipoPlantillaWhatsapp(
  accion: string,
  tipoDocumento?: string
): WhatsappTemplateType {
  const accionNormalizada = normalizarValor(accion);
  const tipoDocumentoNormalizado = normalizarValor(tipoDocumento) as TipoDocumento | '';

  switch (accionNormalizada) {
    case 'documento_pdf': {
      const tipoPlantilla = tipoDocumentoNormalizado
        ? DOCUMENTO_PDF_TEMPLATE_BY_DOCUMENTO[tipoDocumentoNormalizado]
        : null;
      if (!tipoPlantilla) {
        throw new Error(`No hay tipo de plantilla WhatsApp configurado para la accion documento_pdf y el tipo_documento ${tipoDocumentoNormalizado || '(vacio)'}`);
      }
      return tipoPlantilla;
    }
    case 'cfdi': {
      const tipoPlantilla = tipoDocumentoNormalizado
        ? CFDI_TEMPLATE_BY_DOCUMENTO[tipoDocumentoNormalizado]
        : null;
      if (!tipoPlantilla) {
        throw new Error(`No hay tipo de plantilla WhatsApp configurado para la accion cfdi y el tipo_documento ${tipoDocumentoNormalizado || '(vacio)'}`);
      }
      return tipoPlantilla;
    }
    case 'reactivacion':
      return 'reactivacion';
    case 'seguimiento':
      return 'seguimiento';
    default:
      throw new Error(`Accion de plantilla WhatsApp no soportada: ${accionNormalizada || '(vacia)'}`);
  }
}