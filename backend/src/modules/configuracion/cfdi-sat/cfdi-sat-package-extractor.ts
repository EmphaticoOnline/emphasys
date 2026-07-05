import { loadSatWsModule, type SatTipoSolicitud } from './sat-client';
import { parseCfdiXml } from './cfdi-sat-xml-parser';

export interface ComprobanteExtraido {
  uuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  nombreEmisor: string | null;
  nombreReceptor: string | null;
  fechaEmision: string | null;
  tipoComprobante: string | null;
  total: number | null;
  moneda: string | null;
  estatusSat: 'vigente' | 'cancelado' | null;
  /** Contenido crudo del XML; null cuando el paquete es de tipo metadata (no hay XML). */
  xmlContent: string | null;
}

/**
 * Extrae los comprobantes de un paquete ya descargado del SAT (ZIP en binario).
 * Cada elemento se procesa de forma independiente: un XML/registro corrupto no
 * debe tumbar el resto del paquete (el llamador decide cómo reportar fallos
 * puntuales sin marcar todo el paquete como error).
 */
export async function extraerComprobantesDePaquete(
  zipBuffer: Buffer,
  tipoSolicitud: SatTipoSolicitud
): Promise<{ items: ComprobanteExtraido[]; errores: string[] }> {
  const sat = await loadSatWsModule();
  const binaryContents = zipBuffer.toString('binary');
  const errores: string[] = [];

  if (tipoSolicitud === 'xml') {
    const reader = await sat.CfdiPackageReader.createFromContents(binaryContents);
    const entries = await reader.cfdisToArray();

    const items: ComprobanteExtraido[] = [];
    for (const entry of entries) {
      try {
        const parsed = parseCfdiXml(entry.content);
        items.push({ ...parsed, estatusSat: null, xmlContent: entry.content });
      } catch (error: any) {
        errores.push(`uuid=${entry.uuid || 'desconocido'}: ${String(error?.message ?? 'XML inválido')}`);
      }
    }
    return { items, errores };
  }

  const reader = await sat.MetadataPackageReader.createFromContents(binaryContents);
  const rows = await reader.metadataToArray();

  const items: ComprobanteExtraido[] = [];
  for (const row of rows) {
    try {
      const uuid = String(row.get('uuid') ?? '').trim().toUpperCase();
      if (!uuid) {
        throw new Error('Registro de metadata sin uuid');
      }

      const estatusRaw = String(row.get('estatus') ?? '').trim().toLowerCase();
      const montoRaw = Number(row.get('monto'));
      const tipoRaw = String(row.get('efectoComprobante') ?? '').trim().toUpperCase();

      items.push({
        uuid,
        rfcEmisor: String(row.get('rfcEmisor') ?? '').trim().toUpperCase(),
        rfcReceptor: String(row.get('rfcReceptor') ?? '').trim().toUpperCase(),
        nombreEmisor: row.get('nombreEmisor')?.trim() || null,
        nombreReceptor: row.get('nombreReceptor')?.trim() || null,
        fechaEmision: row.get('fechaEmision')?.trim() || null,
        tipoComprobante: tipoRaw || null,
        total: Number.isFinite(montoRaw) ? montoRaw : null,
        moneda: null,
        estatusSat: estatusRaw ? (estatusRaw.includes('cancel') ? 'cancelado' : 'vigente') : null,
        xmlContent: null,
      });
    } catch (error: any) {
      errores.push(String(error?.message ?? 'Registro de metadata inválido'));
    }
  }

  return { items, errores };
}
