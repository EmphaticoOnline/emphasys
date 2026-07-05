export interface NormalizedMessage {
  from: string;
  messageId: string;
  text: string;
  timestamp?: string;
  tipoContenido: 'text' | 'image' | 'audio' | 'document';
  mediaUrl: string | null;
  caption: string | null;
  mimeType: string | null;
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

export const normalizeWhatsappPayload = (body: any): NormalizedMessage | null => {
  const change = body?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  if (!message) return null;

  // Log temporal: confirmar si Gupshup expone algún gsId/gs_id (u otro campo equivalente)
  // en mensajes entrantes, para poder citarlos con context.msgId al responder. Quitar una
  // vez confirmado.
  console.log('[WhatsApp Webhook][Reply][DEBUG] Claves del mensaje entrante crudo', {
    messageKeys: Object.keys(message),
    gsId: message.gsId ?? message.gs_id ?? null,
    context: message.context ?? null,
    rawMessage: message,
  });

  const base = {
    from: message.from,
    messageId: message.id,
    timestamp: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : undefined,
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
