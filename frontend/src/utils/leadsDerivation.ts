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
  const idleMinutes = minutesSince(lastMessage?.sentAt ?? lead.ultimoMensajeEn);

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
  const last = lead.conversation[lead.conversation.length - 1];
  const ts = last?.sentAt ?? lead.ultimoMensajeEn;
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
  tipoContenido: 'text' | 'image' | 'audio' | 'document',
  contenido: string | null | undefined,
  caption: string | null | undefined
): string => {
  if (tipoContenido === 'image') return '📷 Imagen';
  if (tipoContenido === 'audio') return '🎤 Nota de voz';
  if (tipoContenido === 'document') return caption ? `📄 ${caption}` : '📄 Documento';
  return contenido || '';
};

export const mapMessages = (messages: ConversationMessage[]): ConversationView[] => messages.map((msg) => {
  const sentAt = msg.fecha_envio || msg.creado_en || null;
  const tipoContenido = msg.tipo_contenido ?? 'text';
  let mediaUrl = msg.media_url ?? null;

  if ((tipoContenido === 'image' || tipoContenido === 'audio' || tipoContenido === 'document') && !mediaUrl) {
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
    text: (tipoContenido === 'image' || tipoContenido === 'audio' || tipoContenido === 'document')
      ? ''
      : (msg.contenido || ''),
    minutesAgo: minutesSince(sentAt),
    sentAt,
    tipoContenido,
    mediaUrl,
    caption: msg.caption ?? null,
    status: ((msg.status || '').toLowerCase().trim() as 'sending' | 'sent' | 'delivered' | 'read' | 'failed') || 'sent',
    replyTo,
  } as ConversationView;
});
