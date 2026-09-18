import pool from '../../config/database';
import { reconciliarCancelacionDocumentoService } from './documentos-cancel.service';

const ACTOR_EMAIL = 'sistema@internal.emphasys';
const LOCK_NAMESPACE = 727002;
const LOCK_KEY = 1;
const CYCLE_MS = 15 * 60 * 1000;

type Candidate = { documento_id: number; empresa_id: number };

type InvalidSummary = {
  total: number;
  pac_id_faltante: number;
  uuid_faltante: number;
  rfc_emisor_faltante: number;
  rfc_receptor_faltante: number;
  total_faltante: number;
  modalidad_invalida: number;
  fecha_solicitud_faltante: number;
};

async function obtenerActorSistema(): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id
       FROM core.usuarios
      WHERE lower(email) = lower($1)
        AND activo = false
        AND es_superadmin = false
        AND vendedor_contacto_id IS NULL
      LIMIT 1`,
    [ACTOR_EMAIL]
  );
  const actorId = rows[0]?.id;
  if (!actorId) {
    throw new Error(`No existe el actor técnico ${ACTOR_EMAIL}; ciclo abortado de forma segura.`);
  }
  return Number(actorId);
}

async function obtenerCandidatos(): Promise<Candidate[]> {
  const { rows } = await pool.query<Candidate>(`
    SELECT i.documento_id, i.empresa_id
      FROM public.documentos_cancelacion_intentos i
      JOIN public.documentos d
        ON d.id = i.documento_id
       AND d.empresa_id = i.empresa_id
      JOIN public.documentos_cfdi dc
        ON dc.documento_id = d.id
     WHERE i.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
       AND dc.cancelacion_estado IN ('solicitada', 'pendiente', 'requiere_reconciliacion')
       AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada', 'anulado', 'anulada')
       AND COALESCE(dc.estado_sat, '') <> 'cancelado'
       AND i.pac_id IS NOT NULL
       AND i.modalidad IN ('web', 'lite')
       AND COALESCE(i.cfdi_uuid, dc.uuid) IS NOT NULL
       AND dc.rfc_emisor IS NOT NULL
       AND dc.rfc_receptor IS NOT NULL
       AND dc.total IS NOT NULL
       AND i.fecha_solicitud IS NOT NULL
       AND (
         dc.cancelacion_ultima_consulta_at IS NULL
         OR dc.cancelacion_ultima_consulta_at <= NOW() - CASE
           WHEN NOW() - i.fecha_solicitud <= INTERVAL '2 hours' THEN INTERVAL '15 minutes'
           WHEN NOW() - i.fecha_solicitud <= INTERVAL '12 hours' THEN INTERVAL '30 minutes'
           WHEN NOW() - i.fecha_solicitud <= INTERVAL '48 hours' THEN INTERVAL '2 hours'
           WHEN NOW() - i.fecha_solicitud <= INTERVAL '7 days' THEN INTERVAL '6 hours'
           ELSE INTERVAL '24 hours'
         END
       )
     ORDER BY COALESCE(dc.cancelacion_ultima_consulta_at, i.fecha_solicitud), i.id
     LIMIT 100`);
  return rows;
}

async function registrarResumenInvalidos(): Promise<void> {
  const { rows } = await pool.query<InvalidSummary>(`
    SELECT
      COUNT(*) FILTER (WHERE
        i.pac_id IS NULL OR BTRIM(i.pac_id) = ''
        OR COALESCE(i.cfdi_uuid, dc.uuid) IS NULL OR BTRIM(COALESCE(i.cfdi_uuid, dc.uuid)) = ''
        OR dc.rfc_emisor IS NULL OR BTRIM(dc.rfc_emisor) = ''
        OR dc.rfc_receptor IS NULL OR BTRIM(dc.rfc_receptor) = ''
        OR dc.total IS NULL
        OR i.modalidad IS NULL OR i.modalidad NOT IN ('web', 'lite')
        OR i.fecha_solicitud IS NULL
      )::int AS total,
      COUNT(*) FILTER (WHERE i.pac_id IS NULL OR BTRIM(i.pac_id) = '')::int AS pac_id_faltante,
      COUNT(*) FILTER (WHERE COALESCE(i.cfdi_uuid, dc.uuid) IS NULL OR BTRIM(COALESCE(i.cfdi_uuid, dc.uuid)) = '')::int AS uuid_faltante,
      COUNT(*) FILTER (WHERE dc.rfc_emisor IS NULL OR BTRIM(dc.rfc_emisor) = '')::int AS rfc_emisor_faltante,
      COUNT(*) FILTER (WHERE dc.rfc_receptor IS NULL OR BTRIM(dc.rfc_receptor) = '')::int AS rfc_receptor_faltante,
      COUNT(*) FILTER (WHERE dc.total IS NULL)::int AS total_faltante,
      COUNT(*) FILTER (WHERE i.modalidad IS NULL OR i.modalidad NOT IN ('web', 'lite'))::int AS modalidad_invalida,
      COUNT(*) FILTER (WHERE i.fecha_solicitud IS NULL)::int AS fecha_solicitud_faltante
    FROM public.documentos_cancelacion_intentos i
    JOIN public.documentos d
      ON d.id = i.documento_id
     AND d.empresa_id = i.empresa_id
    JOIN public.documentos_cfdi dc
      ON dc.documento_id = d.id
   WHERE i.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
     AND dc.cancelacion_estado IN ('solicitada', 'pendiente', 'requiere_reconciliacion')
     AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada', 'anulado', 'anulada')
     AND COALESCE(dc.estado_sat, '') <> 'cancelado'
     AND (
       i.pac_id IS NULL OR BTRIM(i.pac_id) = ''
       OR COALESCE(i.cfdi_uuid, dc.uuid) IS NULL OR BTRIM(COALESCE(i.cfdi_uuid, dc.uuid)) = ''
       OR dc.rfc_emisor IS NULL OR BTRIM(dc.rfc_emisor) = ''
       OR dc.rfc_receptor IS NULL OR BTRIM(dc.rfc_receptor) = ''
       OR dc.total IS NULL
       OR i.modalidad IS NULL OR i.modalidad NOT IN ('web', 'lite')
       OR i.fecha_solicitud IS NULL
     )`);

  const summary = rows[0];
  if (!summary || summary.total === 0) return;
  console.warn('[CFDI-RECONCILIACION] pendientes inválidos', {
    total: summary.total,
    pac_id_faltante: summary.pac_id_faltante,
    uuid_faltante: summary.uuid_faltante,
    rfc_emisor_faltante: summary.rfc_emisor_faltante,
    rfc_receptor_faltante: summary.rfc_receptor_faltante,
    total_faltante: summary.total_faltante,
    modalidad_invalida: summary.modalidad_invalida,
    fecha_solicitud_faltante: summary.fecha_solicitud_faltante,
  });
}

async function ejecutarCiclo(): Promise<void> {
  const actorId = await obtenerActorSistema();
  await registrarResumenInvalidos();
  const candidates = await obtenerCandidatos();
  if (candidates.length === 0) return;

  console.log(`[CFDI-RECONCILIACION] candidatos=${candidates.length}`);
  for (const candidate of candidates) {
    try {
      await reconciliarCancelacionDocumentoService({
        documentoId: Number(candidate.documento_id),
        empresaId: Number(candidate.empresa_id),
        usuarioId: actorId,
      });
    } catch (error) {
      console.error('[CFDI-RECONCILIACION] candidato fallido', {
        documentoId: candidate.documento_id,
        empresaId: candidate.empresa_id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function ejecutarCicloConLock(): Promise<void> {
  const client = await pool.connect();
  let locked = false;
  try {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [LOCK_NAMESPACE, LOCK_KEY]
    );
    locked = Boolean(result.rows[0]?.locked);
    if (!locked) {
      console.log('[CFDI-RECONCILIACION] otro ciclo automático está activo; se omite este ciclo');
      return;
    }
    await ejecutarCiclo();
  } catch (error) {
    console.error('[CFDI-RECONCILIACION] ciclo abortado', error instanceof Error ? error.message : error);
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, LOCK_KEY]);
      } catch (error) {
        console.error('[CFDI-RECONCILIACION] no se pudo liberar advisory lock', error);
      }
    }
    client.release();
  }
}

let timer: NodeJS.Timeout | null = null;
let started = false;

export function iniciarReconciliacionCancelacionesJob(): void {
  if (started) return;
  started = true;
  console.log('[CFDI-RECONCILIACION] scheduler iniciado; periodo=15m');
  timer = setInterval(() => { void ejecutarCicloConLock(); }, CYCLE_MS);
  timer.unref();
}

export function detenerReconciliacionCancelacionesJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
