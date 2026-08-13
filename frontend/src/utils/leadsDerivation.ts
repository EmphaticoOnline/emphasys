import type {
  ConversationMessage,
  EtapaOportunidad,
  Lead,
  LeadConPrioridad,
  LeadStatusType,
  NextAction,
  Priority,
  ReglasSeguimiento,
  ReplyPreview,
  WhatsappSendErrorInfo,
} from '../pages/LeadsPage';
import type { Contacto } from '../types/contactos.types';

export function formatFechaHora(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

// Etiqueta de separador de día (Hoy/Ayer/fecha) para el historial de chat,
// derivada del `sentAt` que ya trae cada mensaje mapeado — sin estado nuevo
// ni relación con el estado de "no leídos" (no existe todavía). Devuelve
// null si no hay fecha válida (p. ej. un mensaje optimista sin sentAt aún),
// en cuyo caso simplemente no se muestra separador para ese mensaje.
export function getDayLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

// Conjunto compacto de reacciones estilo WhatsApp, compartido entre
// LeadsDesktopView y LeadsMobileView.
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const DEFAULT_REGLAS_SEGUIMIENTO: ReglasSeguimiento = {
  tiempo_tolerancia_respuesta_a_cliente: 30,
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: 4,
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: 24,
};

export function normalizeEtapaOportunidad(value: unknown): EtapaOportunidad {
  const normalized = String(value ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'contactado':
    case 'interesado':
    case 'cotizado':
    case 'negociacion':
      return normalized;
    case 'convertida':
    case 'ganado':
    case 'ganada':
      return 'convertida';
    case 'perdida':
    case 'perdido':
      return 'perdida';
    case 'nuevo':
    default:
      return 'nuevo';
  }
}

export const getIdleSeverity = (min: number): { color: 'default' | 'warning' | 'error'; showIcon: boolean } => {
  if (min > 180) return { color: 'error', showIcon: true };
  if (min >= 60) return { color: 'warning', showIcon: false };
  return { color: 'default', showIcon: false };
};

export function formatMinutesAgo(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return `${d}d ${h}h`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return `${d}d ${h}h`;
}

// Traduce la respuesta de error del backend (o un fallo de red del propio
// fetch) a un mensaje comprensible para el usuario. Nunca muestra códigos
// HTTP, JSON crudo ni stack traces en la interfaz.
export function buildWhatsappSendErrorInfo(payload: any, isNetworkError: boolean): WhatsappSendErrorInfo {
  if (isNetworkError) {
    return {
      codigo: 'CONEXION_FRONTEND_BACKEND',
      mensajeUsuario: 'No se pudo conectar con el servidor de Emphasys.',
      accionSugerida: 'Verifica tu conexión a internet e intenta nuevamente.',
      recuperable: true,
    };
  }

  if (payload?.codigo && payload?.mensaje_usuario) {
    return {
      codigo: String(payload.codigo),
      mensajeUsuario: String(payload.mensaje_usuario),
      accionSugerida: payload.accion_sugerida ? String(payload.accion_sugerida) : null,
      recuperable: Boolean(payload.recuperable),
    };
  }

  return {
    codigo: 'ERROR_DESCONOCIDO',
    mensajeUsuario: (typeof payload?.message === 'string' && payload.message) || 'No fue posible enviar el mensaje por una causa no identificada.',
    accionSugerida: 'Intenta nuevamente. Si el problema continúa, repórtalo al administrador.',
    recuperable: true,
  };
}

export function minutesSince(dateString: string | null): number {
  if (!dateString) return 0;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function deriveNextAction(hasUnrepliedIncoming: boolean): NextAction {
  return hasUnrepliedIncoming ? 'Responder' : 'Responder';
}

// La ventana de 24h de WhatsApp solo se abre con un mensaje ENTRANTE real del
// cliente (igual que el backend en validateWhatsapp24hWindow). Un mensaje
// saliente, incluida una plantilla, nunca la reabre ni la simula.
function findLastIncomingSentAt(conversation: Lead['conversation']): string | null {
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    const item = conversation[i];
    if (item?.from === 'lead') {
      return item.sentAt ?? null;
    }
  }
  return null;
}

export function deriveLeadState(lead: Lead, reglasSeguimiento: ReglasSeguimiento = DEFAULT_REGLAS_SEGUIMIENTO): {
  awaitingResponse: boolean;
  statusLabel: string;
  statusType: LeadStatusType;
  idleMinutes: number;
  priority: Priority;
  nextAction: NextAction;
  within24hWindow: boolean;
  windowExpiresInMinutes: number;
  canSendFreeMessage: boolean;
  requiresTemplate: boolean;
} {
  const lastMessage = lead.conversation[lead.conversation.length - 1];
  const lastFrom = lastMessage?.from ?? null;
  // Exclusivamente lead.ultimoMensajeEn (misma fuente para TODOS los leads,
  // se haya cargado su historial completo o no — ver loadConversations en
  // LeadsPage.tsx). Antes caía a lastMessage?.sentAt cuando `conversation`
  // tenía datos: como `conversation` solo se puebla para el lead
  // seleccionado (loadMessages) o tras enviar un mensaje, ese fallback hacía
  // que el idleMinutes/prioridad de UN lead se calculara con una fuente
  // distinta a la de los demás apenas se seleccionaba, cambiando su lugar
  // en el orden sin ninguna actividad real nueva. El envío optimista
  // (handleSendWhatsapp) ya setea ultimoMensajeEn explícitamente, así que
  // no necesita este fallback.
  const idleMinutes = minutesSince(lead.ultimoMensajeEn);

  let awaitingResponse = lead.awaitingResponse;
  if (lastFrom === 'lead') {
    awaitingResponse = true;
  } else if (lastFrom === 'me') {
    awaitingResponse = false;
  }

  const statusLabel = awaitingResponse ? 'Sin responder' : 'Esperando cliente';
  const statusType: LeadStatusType = awaitingResponse ? 'attention' : 'waiting';
  const toleranciaRespuestaMin = reglasSeguimiento.tiempo_tolerancia_respuesta_a_cliente;
  const seguimientoDespuesRespuestaMin = reglasSeguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente * 60;
  const maxSinRespuestaMin = reglasSeguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente * 60;
  const priority: Priority = awaitingResponse
    ? idleMinutes > toleranciaRespuestaMin
      ? 'Alta'
      : 'Media'
    : idleMinutes > maxSinRespuestaMin
      ? 'Alta'
      : idleMinutes > seguimientoDespuesRespuestaMin
        ? 'Media'
        : 'Baja';
  const nextAction = deriveNextAction(awaitingResponse);
  // Ojo: se basa en el último mensaje ENTRANTE, no en el último mensaje de la
  // conversación. Enviar una plantilla (o cualquier mensaje "me") no reabre
  // la ventana; solo una respuesta real del cliente lo hace.
  const lastIncomingSentAt = findLastIncomingSentAt(lead.conversation);
  const minutesSinceLastIncoming = lastIncomingSentAt ? minutesSince(lastIncomingSentAt) : null;
  const windowExpiresInMinutes = minutesSinceLastIncoming === null ? 0 : Math.max(0, 1440 - minutesSinceLastIncoming);
  const within24hWindow = windowExpiresInMinutes > 0;
  const canSendFreeMessage = within24hWindow;
  const requiresTemplate = !within24hWindow;

  return {
    awaitingResponse,
    statusLabel,
    statusType,
    idleMinutes,
    priority,
    nextAction,
    within24hWindow,
    windowExpiresInMinutes,
    canSendFreeMessage,
    requiresTemplate,
  };
}

export function esSeguimientoPendiente(lead: Lead): boolean {
  const etapa = lead.etapa_oportunidad ?? 'nuevo';
  if (etapa === 'convertida' || etapa === 'perdida') return false;

  const last = lead.conversation[lead.conversation.length - 1];
  const lastFrom = last?.from;
  if (lastFrom !== 'lead') return false;

  const minutos = minutesSince(last?.sentAt ?? lead.ultimoMensajeEn);
  const limites: Record<EtapaOportunidad, number> = {
    nuevo: 15,
    contactado: 60,
    interesado: 120,
    cotizado: 360,
    negociacion: 360,
    convertida: Infinity,
    perdida: Infinity,
  };

  const limite = limites[etapa] ?? 120;
  return minutos > limite;
}

export const prioridadRank: Record<Priority, number> = { Alta: 2, Media: 1, Baja: 0 };

export const getLastTimestampMs = (lead: Lead): number => {
  // Exclusivamente lead.ultimoMensajeEn, mismo motivo que en deriveLeadState
  // de arriba: usar conversation[last] acá desincronizaba el orden de un
  // lead apenas se cargaba su historial (loadMessages), porque pasaba a
  // ordenarse con una fuente distinta a la de los leads sin abrir.
  const ts = lead.ultimoMensajeEn;
  const d = ts ? new Date(ts).getTime() : 0;
  return Number.isNaN(d) ? 0 : d;
};

export const ordenarLeads = (a: LeadConPrioridad, b: LeadConPrioridad): number => {
  // 1) seguimiento pendiente primero
  if (a.seguimientoPendiente !== b.seguimientoPendiente) {
    return a.seguimientoPendiente ? -1 : 1;
  }

  // 2) prioridad alta > media > baja
  const prioDiff = prioridadRank[b.computedPriority] - prioridadRank[a.computedPriority];
  if (prioDiff !== 0) return prioDiff;

  // 3) más reciente primero
  return getLastTimestampMs(b) - getLastTimestampMs(a);
};

export const buildLeadOwnerLabel = (
  lead: Lead,
  vendedoresMap: Record<number, Contacto>,
  currentVendedorId: number | null
): string => {
  const vendedorId = lead.vendedor_id ?? null;
  if (vendedorId && currentVendedorId && vendedorId === currentVendedorId) return 'Tú';
  if (vendedorId && vendedoresMap[vendedorId]) return vendedoresMap[vendedorId].nombre;
  return 'Sin asignar';
};

export function applyDerivedLeadState(lead: Lead, reglasSeguimiento: ReglasSeguimiento = DEFAULT_REGLAS_SEGUIMIENTO): Lead {
  const derived = deriveLeadState(lead, reglasSeguimiento);
  return {
    ...lead,
    ...derived,
    lastMessageTimeMinutesAgo: derived.idleMinutes,
    hot: derived.priority === 'Alta',
  };
}

export const getLatestTimestamp = (messages: ConversationMessage[]): string | null => {
  const last = messages[messages.length - 1];
  return last?.fecha_envio ?? last?.creado_en ?? null;
};

type ConversationView = Lead['conversation'][number];

export const filterWhatsappMessages = (messages: ConversationMessage[]): ConversationMessage[] => (
  messages.filter((msg) => msg.canal === 'whatsapp')
);

export const getLastWhatsappPreview = (conversation: ConversationView[]): { text: string; sentAt: string | null } | null => {
  const last = conversation[conversation.length - 1];
  if (!last) return null;

  return {
    text: last.text || '',
    sentAt: last.sentAt ?? null,
  };
};

export const buildReplyPreviewText = (
  tipoContenido: 'text' | 'image' | 'audio' | 'document' | 'video',
  contenido: string | null | undefined,
  caption: string | null | undefined
): string => {
  if (tipoContenido === 'image') return '📷 Imagen';
  if (tipoContenido === 'audio') return '🎤 Nota de voz';
  if (tipoContenido === 'video') return caption ? `🎥 ${caption}` : '🎥 Video';
  if (tipoContenido === 'document') return caption ? `📄 ${caption}` : '📄 Documento';
  return contenido || '';
};

// Iniciales + color determinístico para el avatar visual de un lead.
// Puramente de presentación: no depende de datos nuevos ni de backend, solo
// del nombre/id que el Lead ya trae. Mismo lead -> mismo color siempre
// (hash simple sobre el id), reutilizado tanto en la fila de la lista como
// en el header de la conversación para que se vean consistentes.
const LEAD_AVATAR_COLORS = ['#1d2f68', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a21caf'];

export function getLeadInitials(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : '';
  const initials = `${first}${second}`.toUpperCase();
  return initials || '?';
}

export function getLeadAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return LEAD_AVATAR_COLORS[hash % LEAD_AVATAR_COLORS.length] ?? '#1d2f68';
}

// Estado de la ventana de WhatsApp de 24h ya resuelto a texto/color/emoji de
// presentación. Extraído del cálculo que antes vivía inline (duplicado) en
// el panel de detalle, para poder reutilizarlo también en el header
// compacto de la conversación sin repetir la lógica. No cambia ningún
// umbral ni criterio: mismos dos campos (`requiresTemplate`,
// `windowExpiresInMinutes`) que ya calculaba `deriveLeadState`.
export type WindowDisplayState = 'closed' | 'warning' | 'open';

export function getWindowDisplayState(lead: {
  requiresTemplate: boolean;
  within24hWindow: boolean;
  windowExpiresInMinutes: number;
}): { state: WindowDisplayState; label: string; shortLabel: string; color: string; dot: string } {
  const expiresIn = lead.windowExpiresInMinutes;
  const state: WindowDisplayState = lead.requiresTemplate || expiresIn <= 0
    ? 'closed'
    : lead.within24hWindow
      ? (expiresIn <= 120 ? 'warning' : 'open')
      : 'closed';

  const label = state === 'closed'
    ? 'Ventana cerrada · requiere plantilla'
    : state === 'warning'
      ? `Expira pronto · ${formatMinutes(expiresIn)} restantes`
      : `Ventana abierta · expira en ${formatMinutes(expiresIn)}`;

  const shortLabel = state === 'closed' ? 'Ventana cerrada' : state === 'warning' ? 'Expira pronto' : 'Ventana abierta';
  const color = state === 'closed' ? 'error.main' : state === 'warning' ? 'warning.main' : 'success.main';
  const dot = state === 'closed' ? '🔴' : state === 'warning' ? '🟡' : '🟢';

  return { state, label, shortLabel, color, dot };
}

export const mapMessages = (messages: ConversationMessage[]): ConversationView[] => messages.map((msg) => {
  const sentAt = msg.fecha_envio || msg.creado_en || null;
  const tipoContenido = msg.tipo_contenido ?? 'text';
  let mediaUrl = msg.media_url ?? null;

  if ((tipoContenido === 'image' || tipoContenido === 'audio' || tipoContenido === 'document' || tipoContenido === 'video') && !mediaUrl) {
    mediaUrl = msg.contenido ?? null;
  }

  const replyTo: ReplyPreview | null = msg.mensaje_respuesta_id
    ? {
      id: String(msg.mensaje_respuesta_id),
      from: msg.respuesta_tipo_mensaje === 'entrante' ? 'lead' : 'me',
      preview: buildReplyPreviewText(msg.respuesta_tipo_contenido ?? 'text', msg.respuesta_contenido, msg.respuesta_caption),
    }
    : null;

  return {
    id: msg.id,
    from: msg.tipo_mensaje === 'entrante' ? 'lead' : 'me',
    text: (tipoContenido === 'image' || tipoContenido === 'audio' || tipoContenido === 'document' || tipoContenido === 'video')
      ? ''
      : (msg.contenido || ''),
    minutesAgo: minutesSince(sentAt),
    sentAt,
    tipoContenido,
    mediaUrl,
    mimeType: msg.mime_type ?? null,
    isGif: Boolean(msg.es_gif),
    caption: msg.caption ?? null,
    status: ((msg.status || '').toLowerCase().trim() as 'sending' | 'sent' | 'delivered' | 'read' | 'failed') || 'sent',
    replyTo,
    reactions: msg.reacciones ?? [],
  } as ConversationView;
});
