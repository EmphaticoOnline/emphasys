export interface NormalizedMessage {
  from: string;
  messageId: string;
  text: string;
  timestamp?: string;
  tipoContenido: 'text' | 'image' | 'audio' | 'document';
  mediaUrl: string | null;
  caption: string | null;
  mimeType: string | null;
  // id_externo del mensaje citado, si el cliente respondió citando desde su
  // propio WhatsApp (null si no es una respuesta). Ver extractQuotedMessageId.
  quotedMessageId: string | null;
}

interface MediaField {
  link?: string;
  url?: string;
  originalUrl?: string;
  previewUrl?: string;
  id?: string;
  mediaId?: string;
  caption?: string;
  mime_type?: string;
  mimeType?: string;
  filename?: string;
}

// Tipos de whatsapp.message.type que mapean a una columna tipo_contenido soportada por crm.mensajes
// (CHECK constraint solo permite 'text' | 'image' | 'audio' | 'document', ver migración 20260423_add_whatsapp_mensajes_media.sql)
const MEDIA_TYPE_MAP: Record<string, 'image' | 'audio' | 'document'> = {
  image: 'image',
  sticker: 'image',
  audio: 'audio',
  voice: 'audio',
  document: 'document',
  video: 'document',
};

const extractMediaUrl = (media?: MediaField): string | null =>
  media?.link || media?.url || media?.originalUrl || media?.previewUrl || null;

const extractMimeType = (media?: MediaField): string | null =>
  media?.mime_type || media?.mimeType || null;

// Cuando el cliente responde citando un mensaje desde su propio WhatsApp, el
// `context` que Gupshup entrega en el webhook entrante trae TRES
// identificadores distintos del mensaje citado — confirmado contra tráfico
// real de producción (2026-07-17, conversación de prueba):
//   context.gs_id       -> el mismo UUID que Gupshup devuelve como
//                          `messageId` en la respuesta síncrona de envío Y
//                          como `gs_id` en los webhooks de status. Es
//                          EXACTAMENTE el valor que este proyecto ya guarda
//                          como crm.mensajes.id_externo para mensajes
//                          salientes (ver registrarMensaje*SalienteWhatsapp).
//   context.id          -> un id corto interno de Gupshup (aparece también
//                          como "id" en los webhooks de status, junto a
//                          gs_id) que NO coincide con nada que persistamos.
//   context.meta_msg_id -> el wamid real de WhatsApp — no lo usamos porque
//                          hoy no persistimos el wamid de los mensajes que
//                          nosotros enviamos (solo el gs_id de Gupshup).
// Por eso context.gs_id es el único que puede resolver contra id_externo tal
// como está almacenado hoy. Se prioriza explícitamente, con el resto como
// alias defensivos (algún otro canal/versión de Gupshup podría diferir).
// Nunca se hace matching parcial: solo se toma el valor tal cual, para
// comparar por igualdad exacta contra id_externo.
export const extractQuotedMessageId = (message: any): string | null => {
  const context = message?.context;
  if (!context || typeof context !== 'object') return null;

  const candidate = context.gs_id ?? context.gsId ?? context.id ?? context.msgId ?? context.messageId;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
};

export const normalizeWhatsappPayload = (body: any): NormalizedMessage | null => {
  const change = body?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  if (!message) return null;

  const base = {
    from: message.from,
    messageId: message.id,
    timestamp: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : undefined,
    quotedMessageId: extractQuotedMessageId(message),
  };

  const rawType = typeof message.type === 'string' ? message.type : 'text';

  if (rawType === 'text') {
    return {
      ...base,
      text: message.text?.body || '',
      tipoContenido: 'text',
      mediaUrl: null,
      caption: null,
      mimeType: null,
    };
  }

  const tipoContenido = MEDIA_TYPE_MAP[rawType];

  if (!tipoContenido) {
    console.warn('[WhatsApp Webhook][Media] Tipo de mensaje entrante no soportado, se guarda como texto informativo', {
      rawType,
      messageId: message.id,
    });
    return {
      ...base,
      text: `[Mensaje no soportado: ${rawType}]`,
      tipoContenido: 'text',
      mediaUrl: null,
      caption: null,
      mimeType: null,
    };
  }

  const mediaPayload = message[rawType] as MediaField | undefined;

  // Log temporal de diagnóstico: confirma el shape real que envía Gupshup para media entrante.
  console.log('[WhatsApp Webhook][Media] Payload de media entrante recibido', {
    rawType,
    tipoContenido,
    messageId: message.id,
    mediaKeys: mediaPayload ? Object.keys(mediaPayload) : [],
    mediaPayload,
  });

  const mediaUrl = extractMediaUrl(mediaPayload);
  const mimeType = extractMimeType(mediaPayload);
  const caption = typeof mediaPayload?.caption === 'string' && mediaPayload.caption.trim()
    ? mediaPayload.caption.trim()
    : null;

  if (!mediaUrl) {
    console.warn('[WhatsApp Webhook][Media] No se encontró una URL resoluble en el payload de media', {
      rawType,
      messageId: message.id,
      mediaPayload,
    });
  }

  return {
    ...base,
    text: '',
    tipoContenido,
    mediaUrl,
    caption,
    mimeType,
  };
};
