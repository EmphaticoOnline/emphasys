import { Request } from 'express';

// Helper compartido para TipoEnvio/FechaModBal de Balanza de comprobación,
// extraído de balanzaComprobacionXml.controller.ts para que Paquete ZIP
// (Fase 11) pueda reutilizar exactamente la misma validación sin
// duplicarla.

export type TipoEnvioBalanza = 'N' | 'C';

// Fecha mínima permitida por el XSD para FechaModBal (BCE:t_Fecha_M).
const FECHA_MOD_MINIMA = '2015-01-01';
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface ParametrosTipoEnvioBalanza {
  tipoEnvio: TipoEnvioBalanza;
  fechaModificacion: string | null;
}

export function parseTipoEnvioBalanza(req: Request): ParametrosTipoEnvioBalanza | { error: string } {
  const tipoEnvioRaw = (req.query.tipo_envio_balanza as string | undefined)?.toUpperCase().trim()
    || (req.query.tipo_envio as string | undefined)?.toUpperCase().trim()
    || 'N';
  if (tipoEnvioRaw !== 'N' && tipoEnvioRaw !== 'C') {
    return { error: 'El tipo de envío de la balanza debe ser "N" (Normal) o "C" (Complementaria).' };
  }
  const tipoEnvio = tipoEnvioRaw as TipoEnvioBalanza;

  let fechaModificacion: string | null = null;
  if (tipoEnvio === 'C') {
    const fechaRaw = (
      (req.query.fecha_modificacion_balanza as string | undefined) ?? (req.query.fecha_modificacion as string | undefined)
    )?.trim() || '';
    if (!fechaRaw) {
      return { error: 'La fecha de modificación de la balanza es requerida cuando el tipo de envío es Complementaria.' };
    }
    if (!FECHA_REGEX.test(fechaRaw) || Number.isNaN(new Date(fechaRaw).getTime())) {
      return { error: 'La fecha de modificación de la balanza no es una fecha válida (formato AAAA-MM-DD).' };
    }
    if (fechaRaw < FECHA_MOD_MINIMA) {
      return { error: `La fecha de modificación de la balanza no puede ser anterior a ${FECHA_MOD_MINIMA}.` };
    }
    fechaModificacion = fechaRaw;
  }

  return { tipoEnvio, fechaModificacion };
}
