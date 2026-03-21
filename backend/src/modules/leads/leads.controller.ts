import { Request, Response } from "express";
import { sugerirMensajeLead } from "./leads.service";

export async function sugerirMensaje(req: Request, res: Response) {
  try {
    const { nombre, ultimoMensaje, siguienteAccion, tiempoSinRespuesta, prioridad, tipoLead, canal } = req.body || {};

    if (![nombre, ultimoMensaje, siguienteAccion].every((v) => typeof v === "string" && v.trim().length > 0)) {
      return res.status(400).json({ message: "nombre, ultimoMensaje y siguienteAccion son requeridos" });
    }

    const mensaje = await sugerirMensajeLead({
      nombre: nombre.trim(),
      ultimoMensaje: ultimoMensaje.trim(),
      siguienteAccion: siguienteAccion.trim(),
      tiempoSinRespuesta: typeof tiempoSinRespuesta === "string" ? tiempoSinRespuesta.trim() : undefined,
      prioridad: typeof prioridad === "string" ? prioridad.trim() : undefined,
      tipoLead: typeof tipoLead === "string" ? tipoLead.trim() : undefined,
      canal: typeof canal === "string" ? canal.trim() : undefined,
    });

    return res.json({ mensaje });
  } catch (error) {
    console.error("Error al sugerir mensaje de lead:", error);

    const isConfigError = error instanceof Error && error.message.includes("OPENAI_API_KEY");
    const status = isConfigError ? 500 : 502;
    const message = isConfigError ? "Configuración de OpenAI faltante" : "No se pudo generar el mensaje";

    return res.status(status).json({ message });
  }
}
