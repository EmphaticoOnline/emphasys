export interface NormalizedMessage {
  from: string;
  messageId: string;
  text: string;
  timestamp?: string;
}

export const normalizeWhatsappPayload = (body: any): NormalizedMessage | null => {
  const change = body?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  if (!message) return null;

  return {
    from: message.from,
    messageId: message.id,
    text: message.text?.body || "",
    timestamp: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : undefined
  };
};