import { apiFetch } from './apiFetch';

// Servicio general de notificaciones push (Web Push + VAPID) del ERP. No es
// específico de Leads/WhatsApp: WhatsApp será, en un bloque posterior,
// apenas el primer consumidor. Bloque de cimientos: aquí solo se
// administra la suscripción del dispositivo actual, no hay envío ni
// manejo de clic en notificación todavía.

const SERVICE_WORKER_URL = '/sw.js';

export type PushUiState =
  | 'checking'
  | 'unsupported'
  | 'not-subscribed'
  | 'subscribed'
  | 'blocked'
  | 'error';

export interface PushSubscriptionRecord {
  // El backend serializa id (bigserial) como string, no number: node-postgres
  // devuelve los bigint así para no perder precisión. Se conserva ese tipo
  // aquí tal cual, sin convertir a Number en el cliente.
  id: string;
  plataforma: string | null;
  nombre_dispositivo: string | null;
  user_agent: string | null;
  endpoint_enmascarado: string;
  creada_en: string;
  ultima_actividad_en: string;
}

export class PushNotificationsError extends Error {}

// Soporte del navegador: los tres APIs son necesarios para el flujo
// completo (Service Worker para el registro, PushManager para suscribirse,
// Notification para pedir permiso). Cubre, entre otros, Safari de
// escritorio (sin PushManager) y navegadores muy antiguos.
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// En iOS/Safari, Web Push solo existe si la PWA está instalada ("Agregar a
// pantalla de inicio") y corriendo en modo standalone — en una pestaña
// normal de Safari, PushManager no existe en absoluto, así que
// isPushSupported() ya devuelve false ahí sin necesidad de una rama aparte.
// Esta función es solo para decidir si mostrar la explicación de iPhone en
// la interfaz (ver NotificationsSettingsDialog).
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    // Safari/iOS expone esta propiedad no estándar en vez de display-mode.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) {
    throw new PushNotificationsError('Este navegador no es compatible con notificaciones push.');
  }
  const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SERVICE_WORKER_URL);
}

// Convierte la clave pública VAPID (base64url, tal como la entrega el
// backend) al Uint8Array que exige applicationServerKey en
// pushManager.subscribe(). Conversión estándar del estándar Web Push, sin
// depender de ninguna librería.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Uint8Array(new ArrayBuffer(...)) en vez de Uint8Array(length): fuerza el
  // respaldo a ArrayBuffer (no ArrayBufferLike genérico), que es lo que
  // exige BufferSource en applicationServerKey de PushSubscriptionOptions.
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function fetchVapidPublicKey(): Promise<string> {
  const { publicKey } = await apiFetch<{ publicKey: string }>('/api/notificaciones/push/public-key');
  return publicKey;
}

// Suscripción de PushManager para ESTE dispositivo/navegador, si ya existe
// (sin pedir permiso ni crear una nueva). Es la fuente de verdad de "¿este
// dispositivo ya está registrado?": se consulta al propio navegador, no se
// infiere comparando contra el listado del backend.
export async function getCurrentDeviceSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

// Heurística orientativa (no crítica de seguridad, así lo documenta la
// migración/columna) para sugerir plataforma y nombre de dispositivo a
// partir de navigator.userAgent. No pretende ser una detección perfecta.
export function detectPlatform(): string {
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export function suggestDeviceName(): string {
  const ua = navigator.userAgent || '';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';

  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome\//i.test(ua)
      ? 'Chrome'
      : /firefox\//i.test(ua)
        ? 'Firefox'
        : /safari\//i.test(ua)
          ? 'Safari'
          : 'Navegador';

  const os = /mac os x/i.test(ua)
    ? 'macOS'
    : /windows/i.test(ua)
      ? 'Windows'
      : /linux/i.test(ua)
        ? 'Linux'
        : '';

  return os ? `${browser} en ${os}` : browser;
}

// Resuelve el estado a mostrar en la interfaz sin pedir permiso ni crear
// ninguna suscripción — solo lectura del estado actual del navegador y del
// Service Worker.
export async function resolvePushState(): Promise<PushUiState> {
  if (!isPushSupported()) return 'unsupported';

  if (Notification.permission === 'denied') return 'blocked';

  try {
    const subscription = await getCurrentDeviceSubscription();
    return subscription ? 'subscribed' : 'not-subscribed';
  } catch {
    return 'error';
  }
}

// Registra (UPSERT, vía POST) la PushSubscription del navegador en el
// backend con los metadatos actuales. Se reutiliza tanto al suscribirse
// por primera vez como para "releer" con certeza el id real en el backend
// de una suscripción que el navegador ya tenía (idempotente: solo refresca
// ultima_actividad_en si no había cambiado nada).
async function registerCurrentSubscription(subscription: PushSubscription): Promise<PushSubscriptionRecord> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new PushNotificationsError('El navegador no devolvió una suscripción válida.');
  }

  return apiFetch<PushSubscriptionRecord>('/api/notificaciones/push/subscriptions', {
    method: 'POST',
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
      plataforma: detectPlatform(),
      nombreDispositivo: suggestDeviceName(),
    },
  });
}

// Único punto que realmente pide permiso y crea la suscripción: debe
// llamarse exclusivamente desde un manejador de clic explícito del
// usuario (nunca al cargar la pantalla) — ver NotificationsSettingsDialog.
// Registra el Service Worker si hace falta, pide permiso, crea la
// PushSubscription vía PushManager y la registra en el backend.
export async function subscribeToPush(): Promise<PushSubscriptionRecord> {
  if (!isPushSupported()) {
    throw new PushNotificationsError('Este navegador no es compatible con notificaciones push.');
  }

  const registration = await getRegistration();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PushNotificationsError(
      permission === 'denied'
        ? 'El permiso de notificaciones fue denegado en el navegador.'
        : 'No se concedió el permiso de notificaciones.'
    );
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const publicKey = await fetchVapidPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  return registerCurrentSubscription(subscription);
}

export async function listActiveSubscriptions(): Promise<PushSubscriptionRecord[]> {
  return apiFetch<PushSubscriptionRecord[]>('/api/notificaciones/push/subscriptions');
}

// Fila del backend correspondiente a la suscripción de ESTE dispositivo,
// si el navegador ya tiene una PushSubscription activa (null si no). Se
// resuelve re-registrando (idempotente) en vez de confiar en un id
// guardado localmente, para no depender de localStorage y funcionar igual
// aunque se limpien los datos del sitio o se abra en otra pestaña.
export async function getCurrentDeviceRecord(): Promise<PushSubscriptionRecord | null> {
  const subscription = await getCurrentDeviceSubscription();
  if (!subscription) return null;
  return registerCurrentSubscription(subscription);
}

// Desactiva la suscripción de ESTE dispositivo: primero en el backend
// (fuente de verdad de a quién se le enviarán notificaciones futuras) y
// luego, con el mismo objeto PushSubscription que ya se tiene en mano,
// también en el navegador.
export async function deactivateCurrentDevice(): Promise<void> {
  const subscription = await getCurrentDeviceSubscription();
  if (!subscription) return;

  const record = await registerCurrentSubscription(subscription);
  await apiFetch<void>(`/api/notificaciones/push/subscriptions/${record.id}`, { method: 'DELETE' });
  await subscription.unsubscribe();
}

// Desactiva la suscripción de OTRO dispositivo de la lista: solo backend.
// Nunca se llama con el id del dispositivo actual (usar
// deactivateCurrentDevice para ese caso) porque este navegador no tiene
// ningún objeto PushSubscription para un dispositivo distinto al propio.
export async function deactivateOtherDevice(id: string): Promise<void> {
  await apiFetch<void>(`/api/notificaciones/push/subscriptions/${id}`, { method: 'DELETE' });
}
