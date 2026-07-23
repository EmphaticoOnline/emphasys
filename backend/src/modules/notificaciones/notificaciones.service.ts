// Lógica de negocio del módulo general de notificaciones: validación de la
// entrada de suscripción, enmascarado para logs/listados, y resolución de
// la clave pública VAPID. Bloque de cimientos: no hay envío de push aquí
// todavía (ver notificaciones.repository.ts y notificaciones.controller.ts
// para el resto del alcance de este bloque).

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_PLATFORM_LENGTH = 40;
const MAX_DEVICE_NAME_LENGTH = 120;

export interface SuscripcionInputValidada {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  plataforma: string | null;
  nombreDispositivo: string | null;
}

export interface ValidacionResultado {
  data?: SuscripcionInputValidada;
  error?: string;
}

// Valida estrictamente el body de POST /push/subscriptions. No confía en
// ningún campo salvo los explícitamente esperados; cualquier otra clave del
// body (incluyendo un eventual usuario_id) se ignora por completo — el
// usuario_id real siempre lo decide el controller a partir de
// req.auth.userId, nunca este validador.
export function validarSuscripcionInput(body: unknown): ValidacionResultado {
  const payload = (body ?? {}) as Record<string, unknown>;

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  if (!endpoint) return { error: 'endpoint es obligatorio' };
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return { error: 'endpoint excede la longitud permitida' };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpoint);
  } catch {
    return { error: 'endpoint no es una URL válida' };
  }
  if (parsedUrl.protocol !== 'https:') {
    return { error: 'endpoint debe ser una URL HTTPS' };
  }

  const keys = (payload.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  if (!p256dh) return { error: 'keys.p256dh es obligatorio' };
  if (p256dh.length > MAX_KEY_LENGTH) return { error: 'keys.p256dh excede la longitud permitida' };

  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';
  if (!auth) return { error: 'keys.auth es obligatorio' };
  if (auth.length > MAX_KEY_LENGTH) return { error: 'keys.auth excede la longitud permitida' };

  const userAgentRaw = typeof payload.userAgent === 'string' ? payload.userAgent.trim() : '';
  const userAgent = userAgentRaw ? userAgentRaw.slice(0, MAX_USER_AGENT_LENGTH) : null;

  const plataformaRaw = typeof payload.plataforma === 'string' ? payload.plataforma.trim() : '';
  const plataforma = plataformaRaw ? plataformaRaw.slice(0, MAX_PLATFORM_LENGTH) : null;

  const nombreDispositivoRaw = typeof payload.nombreDispositivo === 'string' ? payload.nombreDispositivo.trim() : '';
  const nombreDispositivo = nombreDispositivoRaw ? nombreDispositivoRaw.slice(0, MAX_DEVICE_NAME_LENGTH) : null;

  return { data: { endpoint, p256dh, auth, userAgent, plataforma, nombreDispositivo } };
}

// Nunca se registran endpoints completos en logs (podrían identificar al
// dispositivo/usuario ante quien lea los logs) ni tampoco se exponen
// completos en el listado del frontend. Se conserva el host (útil para
// distinguir proveedor: fcm.googleapis.com, mozilla, etc.) y un fragmento
// corto del final del path, suficiente para que soporte/diagnóstico
// distinga dos filas sin poder reconstruir el endpoint real.
export function enmascararEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const path = url.pathname;
    const visible = path.length > 8 ? path.slice(-8) : path;
    return `${url.host}/…${visible}`;
  } catch {
    return '…';
  }
}

export class VapidNoConfiguradoError extends Error {
  constructor() {
    super('VAPID no está configurado en este servidor');
    this.name = 'VapidNoConfiguradoError';
  }
}

// Lectura perezosa (no al arrancar el proceso): las claves VAPID son
// enteramente opcionales para que el servidor arranque — igual que
// getJwtSecret() en auth.service.ts, el error solo ocurre si efectivamente
// se pide la clave sin estar configurada. Nunca genera un par de claves por
// su cuenta: deben generarse una sola vez fuera del código (ver reporte del
// bloque) y quedar fijas en el entorno.
export function obtenerVapidPublicKey(): string {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key || !key.trim()) {
    throw new VapidNoConfiguradoError();
  }
  return key.trim();
}
