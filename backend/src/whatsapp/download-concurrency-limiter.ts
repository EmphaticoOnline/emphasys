// Límite global (a nivel proceso) de descargas de adjuntos entrantes en
// curso simultáneamente. Sin esto, un pico de mensajes con adjuntos (o un
// reintento masivo de webhooks) podría disparar decenas/cientos de
// descargas en paralelo, cada una abriendo sockets y escribiendo a disco al
// mismo tiempo. No se agrega ninguna dependencia (p-limit, Bottleneck,
// etc.): es un semáforo simple, suficiente para este único caso de uso.
//
// Configurable vía WHATSAPP_MEDIA_DOWNLOAD_CONCURRENCY; por defecto 3 — el
// mismo valor conservador que ya se usa para el fan-out de reenvío
// (REENVIO_CONCURRENCY en whatsapp.service.ts). Es un techo deliberadamente
// bajo: estas descargas son best-effort y no bloquean nada visible para el
// usuario, así que no hay presión por subirlo; uno más alto solo aumentaría
// el riesgo de saturar sockets/disco ante un pico de mensajes.
const configured = Number(process.env.WHATSAPP_MEDIA_DOWNLOAD_CONCURRENCY);
export const WHATSAPP_MEDIA_DOWNLOAD_CONCURRENCY = Number.isFinite(configured) && configured > 0 ? configured : 3;

let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < WHATSAPP_MEDIA_DOWNLOAD_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Ejecuta `fn` respetando el máximo global de descargas concurrentes. Si el
 * cupo está lleno, la llamada queda en una cola en memoria (FIFO) hasta que
 * se libera un lugar. Esta cola vive solo en el proceso: si el backend se
 * reinicia, cualquier trabajo en espera o en curso se pierde sin más efecto
 * que "esa copia local nunca se creó" — el mensaje ya está guardado con la
 * URL original de Gupshup desde antes, así que no hay pérdida de datos, y
 * no existe (ni se agregó aquí) un mecanismo de persistencia/reintento de
 * la cola entre reinicios: está fuera del alcance de esta protección, que
 * es puramente best-effort.
 */
export async function withDownloadConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
