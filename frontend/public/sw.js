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
