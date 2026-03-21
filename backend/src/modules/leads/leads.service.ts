import OpenAI from "openai";

export interface SugerirMensajeParams {
  nombre: string;
  ultimoMensaje: string;
  siguienteAccion: string;
  tiempoSinRespuesta?: string;
  prioridad?: string;
  tipoLead?: string;
  canal?: string;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function sugerirMensajeLead({ nombre, ultimoMensaje, siguienteAccion, tiempoSinRespuesta, prioridad, tipoLead, canal = "WhatsApp" }: SugerirMensajeParams): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const contextParts = [
    `Nombre: ${nombre}`,
    `Último mensaje: ${ultimoMensaje}`,
    `Siguiente acción: ${siguienteAccion}`,
    tiempoSinRespuesta ? `Tiempo sin respuesta: ${tiempoSinRespuesta}` : null,
    prioridad ? `Prioridad: ${prioridad}` : null,
    tipoLead ? `Tipo de lead: ${tipoLead}` : null,
    canal ? `Canal: ${canal}` : null,
  ].filter(Boolean);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.5,
    max_tokens: 160,
    messages: [
      {
        role: "system",
        content:
          "Eres un asesor comercial que escribe respuestas de WhatsApp muy breves (2-3 líneas), naturales y cercanas."
          + " Usa el nombre, responde al último mensaje y muestra intención comercial ligera."
          + " Sugiere un siguiente paso concreto cuando aplique (llamada, demo, pedido, agendar)."
          + " Si hay mucho tiempo sin respuesta o está frío, reengancha con una pregunta breve."
          + " Si es urgente, sé directo y claro."
          + " Si es seguimiento, retoma el contexto en una frase y avanza."
          + " Nunca suenes robótico ni te extiendas; evita listas y despedidas largas.",
      },
      {
        role: "user",
        content: contextParts.join("\n"),
      },
    ],
  });

  const mensaje = completion.choices[0]?.message?.content?.trim();

  if (!mensaje) {
    throw new Error("No se recibió una sugerencia de mensaje");
  }

  return mensaje;
}
