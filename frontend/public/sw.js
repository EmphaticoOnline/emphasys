// Service Worker de Emphasys ERP — bloque de cimientos de la
// infraestructura general de notificaciones push.
//
// Deliberadamente NO hace nada más que instalarse/activarse y tomar
// control de los clientes ya abiertos:
//   - no intercepta fetch (sin listener 'fetch': el navegador sigue yendo
//     a la red exactamente igual que sin Service Worker);
//   - no cachea nada, no hay caché offline;
//   - no maneja el evento 'push' todavía;
//   - no maneja 'notificationclick' todavía.
// Esa lógica llega en un bloque posterior. Este archivo solo deja el
// Service Worker registrado y activo, condición necesaria para poder crear
// una PushSubscription (pushManager.subscribe) y, en producción sobre
// iPhone, para que la PWA instalada sea elegible para push.

self.addEventListener('install', () => {
  // skipWaiting: una actualización futura de este archivo reemplaza la
  // versión anterior sin esperar a que se cierren todas las pestañas
  // abiertas. Importante dejarlo desde este primer Service Worker mínimo
  // para que las actualizaciones futuras (cuando se agregue push real) se
  // apliquen sin fricción.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // clients.claim: toma control de las pestañas ya abiertas en este mismo
  // origen sin esperar a que se recarguen, para que el registro quede
  // "listo" de inmediato tras activar/actualizar.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data?.text?.() || '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'Emphasys', {
    body: payload.body || 'Tienes una nueva notificación en Emphasys.',
    icon: payload.icon || '/emphazul_192.png', badge: payload.badge || '/emphazul_192.png',
    tag: payload.tag || 'emphasys-notification', data: { ...(payload.data || {}), url: payload.url || '/' },
    silent: payload.sound === false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const client = clients[0];
    if (client) return client.navigate(targetUrl).then(() => client.focus());
    return self.clients.openWindow(targetUrl);
  }));
});
