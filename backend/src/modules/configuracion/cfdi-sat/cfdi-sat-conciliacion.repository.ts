import pool from '../../../config/database';
import type { PoolClient } from 'pg';
import { normalizeRFC } from '../../../shared/normalizers/rfc';

/**
 * Consultas de solo lectura y de vinculación sobre `documentos`/`contactos`
 * usadas por la evaluación operativa de importación (Fase 10) y por la
 * vinculación manual a una factura existente (Fase 11). Las consultas de
 * lectura nunca escriben nada: solo ayudan a detectar si ya existe una
 * factura de compra relacionada con un CFDI, ya sea porque Emphasys mismo la
 * importó (uuid_cfdi_origen) o porque alguien ya la capturó manualmente antes
 * de tener este módulo (coincidencia por proveedor + total + fecha/serie/folio).
 */

export interface DocumentoRelacionado {
  documento_id: number;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
}

/** Contacto (proveedor) de un documento ya existente, para enriquecer estados 'importado'. */
export async function obtenerContactoDeDocumento(documentoId: number): Promise<DocumentoRelacionado | null> {
  const { rows } = await pool.query<{ id: number; contacto_id: number | null; contacto_nombre: string | null }>(
    `SELECT d.id, d.contacto_principal_id AS contacto_id, c.nombre AS contacto_nombre
       FROM documentos d
       LEFT JOIN contactos c ON c.id = d.contacto_principal_id
      WHERE d.id = $1
      LIMIT 1`,
    [documentoId]
  );

  const row = rows[0];
  if (!row) return null;
  return { documento_id: row.id, proveedor_id: row.contacto_id, proveedor_nombre: row.contacto_nombre };
}

/**
 * Coincidencia EXACTA por documentos.uuid_cfdi_origen (índice único parcial,
 * ver 20260706_documentos_uuid_cfdi_origen.sql). Es la fuente de verdad de
 * trazabilidad; si aparece algo aquí y el comprobante no está marcado como
 * importado, es un estado inconsistente que igual debe bloquear la
 * reimportación (uuid_ya_existe_en_documentos).
 */
export async function buscarDocumentoPorUuidOrigen(
  empresaId: number,
  uuid: string
): Promise<DocumentoRelacionado | null> {
  const { rows } = await pool.query<{ id: number; contacto_id: number | null; contacto_nombre: string | null }>(
    `SELECT d.id, d.contacto_principal_id AS contacto_id, c.nombre AS contacto_nombre
       FROM documentos d
       LEFT JOIN contactos c ON c.id = d.contacto_principal_id
      WHERE d.empresa_id = $1
        AND d.uuid_cfdi_origen = $2
      LIMIT 1`,
    [empresaId, uuid]
  );

  const row = rows[0];
  if (!row) return null;
  return { documento_id: row.id, proveedor_id: row.contacto_id, proveedor_nombre: row.contacto_nombre };
}

export type ConfianzaDuplicado = 'alta' | 'media' | 'baja';

export interface PosibleDocumentoExistente {
  documento_id: number;
  confianza: ConfianzaDuplicado;
  motivo: string;
}

export interface CriteriosDuplicado {
  rfcEmisor: string;
  /** Serie del CFDI (Comprobante@Serie), si se conoce (requiere XML). */
  serieExterna?: string | null;
  /** Folio del CFDI (Comprobante@Folio) ya convertido a entero, si se conoce (requiere XML). */
  numeroExterno?: number | null;
  total: number | null;
  /** Fecha de emisión, formato ISO (con o sin hora). */
  fecha: string | null;
}

const TOLERANCIA_TOTAL = 0.01;
const TOLERANCIA_DIAS = 3;

interface CandidatoRow {
  id: number;
  serie: string | null;
  numero: number | null;
  serie_externa: string | null;
  numero_externo: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  fecha_documento: string;
  total: string;
  estatus_documento: string;
}

/**
 * Reglas de confianza (compartidas entre buscarPosibleDocumentoExistente y
 * listarCandidatosVinculacion):
 * - alta: mismo proveedor + misma serie/folio externos + total casi exacto.
 * - media: mismo proveedor + total casi exacto + fecha dentro de ±3 días.
 * - baja: mismo proveedor + total casi exacto, sin más coincidencias.
 */
function evaluarConfianza(
  candidato: Pick<CandidatoRow, 'serie_externa' | 'numero_externo' | 'fecha_documento'>,
  criterios: CriteriosDuplicado
): { confianza: ConfianzaDuplicado; motivo: string } {
  if (criterios.serieExterna || criterios.numeroExterno != null) {
    const serieCoincide = (criterios.serieExterna ?? null) === (candidato.serie_externa ?? null);
    const folioCoincide = (criterios.numeroExterno ?? null) === (candidato.numero_externo ?? null);
    if (serieCoincide && folioCoincide) {
      return { confianza: 'alta', motivo: 'Mismo proveedor, mismo total, misma serie y folio externos.' };
    }
  }

  const fechaSolo = criterios.fecha ? criterios.fecha.slice(0, 10) : null;
  if (fechaSolo) {
    const fechaDoc = String(candidato.fecha_documento).slice(0, 10);
    const diffDias = Math.abs((new Date(fechaDoc).getTime() - new Date(fechaSolo).getTime()) / 86_400_000);
    if (diffDias <= TOLERANCIA_DIAS) {
      return { confianza: 'media', motivo: `Mismo proveedor, mismo total y fecha dentro de ${TOLERANCIA_DIAS} días.` };
    }
  }

  return {
    confianza: 'baja',
    motivo: 'Mismo proveedor y mismo total, sin más coincidencias de fecha, serie o folio.',
  };
}

export interface CandidatoVinculacion {
  documento_id: number;
  serie: string | null;
  numero: number | null;
  serie_externa: string | null;
  numero_externo: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  fecha_documento: string;
  total: number;
  estatus_documento: string;
  confianza: ConfianzaDuplicado;
  motivo: string;
}

/**
 * Busca, entre las facturas de compra que aún NO están vinculadas a ningún
 * CFDI (uuid_cfdi_origen IS NULL), candidatas para el mismo proveedor y un
 * total casi idéntico. Nunca es una coincidencia definitiva — cada candidato
 * trae su propia confianza y motivo para que el usuario decida (Fase 11).
 */
export async function listarCandidatosVinculacion(
  empresaId: number,
  criterios: CriteriosDuplicado,
  limite = 10
): Promise<CandidatoVinculacion[]> {
  const rfc = normalizeRFC(criterios.rfcEmisor);
  if (!rfc || criterios.total == null) return [];

  const { rows } = await pool.query<CandidatoRow>(
    `SELECT d.id, d.serie, d.numero, d.serie_externa, d.numero_externo,
            d.contacto_principal_id AS proveedor_id, c.nombre AS proveedor_nombre,
            d.fecha_documento, d.total, d.estatus_documento
       FROM documentos d
       LEFT JOIN contactos c ON c.id = d.contacto_principal_id
       LEFT JOIN contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
      WHERE d.empresa_id = $1
        AND LOWER(d.tipo_documento) = 'factura_compra'
        AND d.uuid_cfdi_origen IS NULL
        AND UPPER(COALESCE(cdf.rfc, c.rfc, '')) = $2
        AND d.total BETWEEN $3 AND $4
      ORDER BY ABS(d.total - $5) ASC, d.fecha_documento DESC
      LIMIT $6`,
    [empresaId, rfc, criterios.total - TOLERANCIA_TOTAL, criterios.total + TOLERANCIA_TOTAL, criterios.total, limite]
  );

  return rows.map((row) => {
    const { confianza, motivo } = evaluarConfianza(row, criterios);
    return {
      documento_id: row.id,
      serie: row.serie,
      numero: row.numero,
      serie_externa: row.serie_externa,
      numero_externo: row.numero_externo,
      proveedor_id: row.proveedor_id,
      proveedor_nombre: row.proveedor_nombre,
      fecha_documento: row.fecha_documento,
      total: Number(row.total),
      estatus_documento: row.estatus_documento,
      confianza,
      motivo,
    };
  });
}

/**
 * Compatibilidad con la evaluación operativa de importación (Fase 10): solo
 * necesita el mejor candidato (prioriza alta > media > baja), no la lista.
 */
export async function buscarPosibleDocumentoExistente(
  empresaId: number,
  criterios: CriteriosDuplicado
): Promise<PosibleDocumentoExistente | null> {
  const candidatos = await listarCandidatosVinculacion(empresaId, criterios, 5);
  if (candidatos.length === 0) return null;

  const mejor =
    candidatos.find((c) => c.confianza === 'alta') ?? candidatos.find((c) => c.confianza === 'media') ?? candidatos[0];

  return { documento_id: mejor.documento_id, confianza: mejor.confianza, motivo: mejor.motivo };
}

export interface DocumentoParaVinculacion {
  id: number;
  tipo_documento: string;
  estatus_documento: string;
  uuid_cfdi_origen: string | null;
  contacto_principal_id: number | null;
  contacto_rfc: string | null;
  contacto_nombre: string | null;
  serie_externa: string | null;
  numero_externo: number | null;
  total: string;
  fecha_documento: string;
}

/**
 * Trae el documento con lock de fila (FOR UPDATE) para la vinculación manual
 * (Fase 11): evita que dos comprobantes se vinculen al mismo documento en
 * una condición de carrera.
 */
export async function bloquearDocumentoParaVinculacion(
  documentoId: number,
  empresaId: number,
  client: PoolClient
): Promise<DocumentoParaVinculacion | null> {
  const { rows } = await client.query<DocumentoParaVinculacion>(
    `SELECT d.id, d.tipo_documento, d.estatus_documento, d.uuid_cfdi_origen,
            d.contacto_principal_id,
            UPPER(COALESCE(cdf.rfc, c.rfc, '')) AS contacto_rfc,
            c.nombre AS contacto_nombre,
            d.serie_externa, d.numero_externo, d.total, d.fecha_documento
       FROM documentos d
       LEFT JOIN contactos c ON c.id = d.contacto_principal_id
       LEFT JOIN contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
      WHERE d.id = $1
        AND d.empresa_id = $2
      LIMIT 1
      FOR UPDATE OF d`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
}
