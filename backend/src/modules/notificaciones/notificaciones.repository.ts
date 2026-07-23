import pool from '../../config/database';

// Bloque de cimientos de la infraestructura general de notificaciones push
// (Web Push + VAPID). Este repositorio SOLO administra el almacenamiento de
// suscripciones (core.push_subscriptions); no hay lógica de envío aquí
// todavía. WhatsApp será, en un bloque posterior, el primer consumidor.

export interface PushSubscriptionRow {
  // id es bigserial: node-postgres lo entrega como string (no number) para
  // no perder precisión más allá de Number.MAX_SAFE_INTEGER. Mismo criterio
  // que ya usa el proyecto para otros ids bigint (ej. crm.mensajes.id).
  id: string;
  usuario_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  plataforma: string | null;
  nombre_dispositivo: string | null;
  creada_en: Date;
  ultima_actividad_en: Date;
  desactivada_en: Date | null;
}

const COLUMNAS = `
  id, usuario_id, endpoint, p256dh, auth, user_agent, plataforma, nombre_dispositivo,
  creada_en, ultima_actividad_en, desactivada_en
`;

// Suscripciones activas de un usuario, sin importar la empresa activa: una
// suscripción no tiene empresa_id (ver comentario en la migración de esta
// tabla), así que no hay nada que filtrar por empresa aquí.
export async function listarSuscripcionesActivas(usuarioId: number): Promise<PushSubscriptionRow[]> {
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT ${COLUMNAS}
       FROM core.push_subscriptions
      WHERE usuario_id = $1
        AND desactivada_en IS NULL
      ORDER BY ultima_actividad_en DESC`,
    [usuarioId]
  );
  return rows;
}

export interface UpsertSuscripcionParams {
  usuarioId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  plataforma: string | null;
  nombreDispositivo: string | null;
}

// UPSERT por endpoint (única identidad real de una PushSubscription, ver
// UNIQUE(endpoint) en la migración). Si el endpoint ya existía —incluso si
// pertenecía a otro usuario (mismo navegador, sesión distinta)— se
// reasigna a usuario_id del autenticado, se refrescan claves/metadatos, se
// reactiva (desactivada_en = NULL) y se marca actividad reciente. Nunca
// deja dos filas para el mismo endpoint.
export async function upsertSuscripcion(params: UpsertSuscripcionParams): Promise<PushSubscriptionRow> {
  const { rows } = await pool.query<PushSubscriptionRow>(
    `INSERT INTO core.push_subscriptions
       (usuario_id, endpoint, p256dh, auth, user_agent, plataforma, nombre_dispositivo,
        creada_en, ultima_actividad_en, desactivada_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NULL)
     ON CONFLICT (endpoint) DO UPDATE
        SET usuario_id          = EXCLUDED.usuario_id,
            p256dh              = EXCLUDED.p256dh,
            auth                = EXCLUDED.auth,
            user_agent          = EXCLUDED.user_agent,
            plataforma          = EXCLUDED.plataforma,
            nombre_dispositivo  = EXCLUDED.nombre_dispositivo,
            ultima_actividad_en = NOW(),
            desactivada_en      = NULL
     RETURNING ${COLUMNAS}`,
    [
      params.usuarioId,
      params.endpoint,
      params.p256dh,
      params.auth,
      params.userAgent,
      params.plataforma,
      params.nombreDispositivo,
    ]
  );
  return rows[0];
}

// Soft-delete acotado a (id, usuario_id): jamás afecta una fila que no
// pertenezca al usuario autenticado, sin importar qué id se pida. Devuelve
// false tanto si el id no existe como si pertenece a otro usuario o ya
// estaba desactivada — el llamador no puede distinguir esos casos, a
// propósito, para no filtrar si un id "existe pero es ajeno". id se recibe
// y se enlaza como string (no Number(...)): bigint acepta un string
// numérico directamente y así se evita cualquier pérdida de precisión más
// allá de Number.MAX_SAFE_INTEGER en el viaje de ida y vuelta id -> URL ->
// backend.
export async function desactivarSuscripcion(id: string, usuarioId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE core.push_subscriptions
        SET desactivada_en = NOW()
      WHERE id = $1
        AND usuario_id = $2
        AND desactivada_en IS NULL`,
    [id, usuarioId]
  );
  return (rowCount ?? 0) > 0;
}
