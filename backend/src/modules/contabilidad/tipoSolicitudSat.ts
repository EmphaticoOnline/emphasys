import { Request } from 'express';

// Helper compartido por los tres XML que dependen de TipoSolicitud/NumOrden/
// NumTramite (Pólizas del periodo, Auxiliar de folios, Auxiliar de cuentas):
// los tres XSD (PolizasPeriodo_1_3, AuxiliarFolios_1_3, AuxiliarCtas_1_3)
// definen ESTOS TRES ATRIBUTOS de forma idéntica -- mismo patrón, misma
// regla condicional -- verificado directamente en cada XSD. Se centraliza
// aquí para no triplicar la misma regex/lógica en cada controller.

export type TipoSolicitudPolizas = 'AF' | 'FC' | 'DE' | 'CO';

const TIPOS_SOLICITUD_VALIDOS: TipoSolicitudPolizas[] = ['AF', 'FC', 'DE', 'CO'];
// Patrones exactos verificados en los XSD: NumOrden 13 caracteres (3 letras +
// 7 dígitos + "/" + 2 dígitos); NumTramite 14 caracteres (2 letras + 12
// dígitos).
const NUM_ORDEN_REGEX = /^[A-Z]{3}\d{7}\/\d{2}$/;
const NUM_TRAMITE_REGEX = /^[A-Z]{2}\d{12}$/;

export interface ParametrosTipoSolicitud {
  tipoSolicitud: TipoSolicitudPolizas;
  numOrden: string | null;
  numTramite: string | null;
}

// Devuelve los parámetros ya validados, o `{ error }` si el request está
// malformado (mismo criterio de "error de parámetro = 400 directo, no fila
// del arreglo `errores`" que ya usan balanzaComprobacionXml.controller.ts /
// polizasPeriodoXml.controller.ts para TipoEnvio/FechaModBal).
export function parseTipoSolicitud(req: Request): ParametrosTipoSolicitud | { error: string } {
  const tipoSolicitudRaw = (req.query.tipo_solicitud as string | undefined)?.toUpperCase().trim() || '';
  if (!TIPOS_SOLICITUD_VALIDOS.includes(tipoSolicitudRaw as TipoSolicitudPolizas)) {
    return { error: 'El tipo de solicitud debe ser "AF" (Acto de Fiscalización), "FC" (Fiscalización por Compulsa), "DE" (Devolución) o "CO" (Compensación).' };
  }
  const tipoSolicitud = tipoSolicitudRaw as TipoSolicitudPolizas;

  let numOrden: string | null = null;
  let numTramite: string | null = null;

  if (tipoSolicitud === 'AF' || tipoSolicitud === 'FC') {
    const numOrdenRaw = (req.query.num_orden as string | undefined)?.trim().toUpperCase() || '';
    if (!numOrdenRaw) {
      return { error: 'El número de orden es requerido para Acto de Fiscalización o Fiscalización por Compulsa.' };
    }
    if (!NUM_ORDEN_REGEX.test(numOrdenRaw)) {
      return { error: 'El número de orden no tiene el formato correcto (3 letras + 7 dígitos + "/" + 2 dígitos, ej. ABC1234567/26).' };
    }
    numOrden = numOrdenRaw;
  } else {
    const numTramiteRaw = (req.query.num_tramite as string | undefined)?.trim().toUpperCase() || '';
    if (!numTramiteRaw) {
      return { error: 'El número de trámite es requerido para Devolución o Compensación.' };
    }
    if (!NUM_TRAMITE_REGEX.test(numTramiteRaw)) {
      return { error: 'El número de trámite no tiene el formato correcto (2 letras + 12 dígitos, ej. AB123456789012).' };
    }
    numTramite = numTramiteRaw;
  }

  return { tipoSolicitud, numOrden, numTramite };
}
