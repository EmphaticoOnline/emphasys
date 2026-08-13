import { apiFetch } from './apiFetch';
import { DEFAULT_NOTIFICATION_TONE, type NotificationTone } from '../utils/notificationSound';

// Reutiliza el backend genérico de preferencias por usuario que ya usan los
// grids (core.grid_preferences vía /api/grid-preferences/:pantalla): pese al
// nombre, el backend no valida nada específico de grids — `pantalla` es un
// string libre y `preferencias` es JSON arbitrario (ver
// backend/src/modules/grid-preferences/grid-preferences.controller.ts). No
// se reutiliza el hook useGridPreferences (atado a forma de grid: sortModel,
// columnWidths, etc.), solo el endpoint.
const PANTALLA_CHAT_LEADS = 'leads-chat';

export type ChatDeviceProfile = 'desktop' | 'mobile';

export type LeadScopePreference = 'mis' | 'todos';

export type ChatSoundPreferences = {
  sonidoActivado: boolean;
  tonoMensajes: NotificationTone;
  // null cuando el usuario todavía no guardó una preferencia de scope
  // (leads-chat es un objeto viejo, o nunca cambió manualmente de Mis
  // leads/Todos): quien llama debe aplicar en ese caso el default existente
  // basado en isAdmin/vendedorContactoId, no un valor fijo.
  leadScope: LeadScopePreference | null;
  // Última conversación seleccionada manualmente por el usuario (lead.id /
  // conv.id, el mismo identificador que ya gobierna toda la selección). null
  // cuando todavía no seleccionó ninguna o cuando el objeto es viejo. Quien
  // llama debe validar que siga existiendo en la colección visible antes de
  // usarlo — si no, cae al primer lead disponible como siempre.
  selectedLeadId: string | null;
};

type ChatPreferencesPayload = {
  sonidoActivado?: boolean;
  tonoMensajes?: NotificationTone;
  leadScope?: LeadScopePreference | null;
  selectedLeadId?: string | null;
};

type GridPreferenceResponse = {
  pantalla: string;
  perfil_dispositivo: string;
  preferencias: ChatPreferencesPayload | null;
  updated_at: string | null;
};

const VALID_TONES = new Set<NotificationTone>(['discreto', 'clasico', 'campana', 'pop', 'alerta']);
const VALID_LEAD_SCOPES = new Set<LeadScopePreference>(['mis', 'todos']);

function normalizeTono(value: unknown): NotificationTone {
  return typeof value === 'string' && VALID_TONES.has(value as NotificationTone)
    ? (value as NotificationTone)
    : DEFAULT_NOTIFICATION_TONE;
}

function normalizeLeadScope(value: unknown): LeadScopePreference | null {
  return typeof value === 'string' && VALID_LEAD_SCOPES.has(value as LeadScopePreference)
    ? (value as LeadScopePreference)
    : null;
}

function normalizeSelectedLeadId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Trae las CUATRO preferencias en una sola llamada (viven en el mismo objeto
// JSON de la pantalla 'leads-chat'). Importante: el endpoint PUT reemplaza
// todo el objeto `preferencias`, no lo mezcla — por eso siempre se lee/
// escribe el conjunto completo junto, nunca un campo suelto, para no pisar
// los otros al guardar.
export async function fetchChatSoundPreferences(perfilDispositivo: ChatDeviceProfile): Promise<ChatSoundPreferences> {
  try {
    const response = await apiFetch<GridPreferenceResponse>(
      `/api/grid-preferences/${PANTALLA_CHAT_LEADS}?perfil_dispositivo=${perfilDispositivo}`
    );
    const activado = response?.preferencias?.sonidoActivado;
    return {
      // Por defecto el sonido está activado si el usuario nunca guardó una preferencia.
      sonidoActivado: activado === undefined ? true : Boolean(activado),
      tonoMensajes: normalizeTono(response?.preferencias?.tonoMensajes),
      leadScope: normalizeLeadScope(response?.preferencias?.leadScope),
      selectedLeadId: normalizeSelectedLeadId(response?.preferencias?.selectedLeadId),
    };
  } catch (error) {
    console.error('No se pudo cargar las preferencias de sonido del chat', error);
    return { sonidoActivado: true, tonoMensajes: DEFAULT_NOTIFICATION_TONE, leadScope: null, selectedLeadId: null };
  }
}

// Siempre recibe el conjunto completo (sonidoActivado + tonoMensajes +
// leadScope + selectedLeadId): quien llama (LeadsPage.tsx) debe pasar el
// valor vigente de los campos que NO está cambiando, para no perderlos en
// el reemplazo.
export async function guardarChatSoundPreferences(
  perfilDispositivo: ChatDeviceProfile,
  preferencias: ChatSoundPreferences
): Promise<void> {
  try {
    await apiFetch<GridPreferenceResponse>(`/api/grid-preferences/${PANTALLA_CHAT_LEADS}`, {
      method: 'PUT',
      body: {
        perfil_dispositivo: perfilDispositivo,
        preferencias,
      },
    });
  } catch (error) {
    console.error('No se pudo guardar las preferencias de sonido del chat', error);
  }
}
