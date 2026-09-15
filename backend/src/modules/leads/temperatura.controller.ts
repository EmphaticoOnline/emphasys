import { Request, Response } from "express";
import pool from "../../config/database";
import { resolverContextoScopeComercial } from "../auth/scope-comercial";
import { ejecutarAnalisis, ultimoAnalisis } from "./temperatura.service";

async function acceso(req: Request, id: number) {
  const empresaId = Number(req.context?.empresaId);
  const userId = req.auth?.userId;
  if (!empresaId || !Number.isFinite(id)) return { error: [400, "Empresa o conversación inválida"] as const };
  const scope = await resolverContextoScopeComercial(empresaId, userId, req.auth?.esSuperadmin);
  if (!scope.esAdmin && !scope.vendedorContactoId) return { error: [404, "Conversación no encontrada"] as const };
  const params: unknown[] = [id, empresaId];
  const seller = !scope.esAdmin && (scope.esVendedor || scope.vendedorContactoId);
  if (seller) params.push(scope.vendedorContactoId);
  const row = await pool.query<{ estado: string; finalizada_en: string | null }>(`SELECT c.estado,c.finalizada_en FROM crm.conversaciones c LEFT JOIN public.contactos ct ON ct.id=c.contacto_id WHERE c.id=$1 AND c.empresa_id=$2 ${seller ? "AND ct.vendedor_id=$3" : ""} LIMIT 1`, params);
  if (!row.rows[0]) return { error: [404, "Conversación no encontrada"] as const };
  return { empresaId, userId: Number(userId), estado: row.rows[0].estado, finalizada: Boolean(row.rows[0].finalizada_en) || row.rows[0].estado === "finalizada" };
}

export async function obtenerTemperatura(req: Request, res: Response) {
  try { const auth = await acceso(req, Number(req.params.id)); if (auth.error) return res.status(auth.error[0]).json({ message: auth.error[1] }); const data = await ultimoAnalisis(auth.empresaId, Number(req.params.id)); return res.json(data); }
  catch (error) { if ((error as { code?: string })?.code === "42P01") return res.status(503).json({ message: "La función de temperatura aún no está disponible: falta aplicar la migración." }); console.error("Error obteniendo temperatura:", error); return res.status(500).json({ message: "No se pudo obtener la temperatura" }); }
}

export async function analizarTemperatura(req: Request, res: Response) {
  try {
    const auth = await acceso(req, Number(req.params.id));
    if (auth.error) return res.status(auth.error[0]).json({ message: auth.error[1] });
    if (auth.finalizada) return res.status(409).json({ message: "Las conversaciones finalizadas no se pueden analizar ni actualizar." });
    const data = await ejecutarAnalisis(auth.empresaId, Number(req.params.id), auth.userId);
    return res.json(data);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INTERACCION_INSUFICIENTE") return res.status(422).json({ code, message: "Aún no hay suficiente interacción para analizar la temperatura comercial." });
    if (code === "CONVERSACION_SIN_EVIDENCIA") return res.status(422).json({ message: "La conversación no contiene suficiente texto o captions para analizar." });
    if (code === "OPENAI_API_KEY_MISSING") return res.status(503).json({ message: "La integración de IA no está configurada." });
    if (code === "RESPUESTA_IA_INVALIDA") return res.status(502).json({ message: "La IA devolvió una respuesta no válida. Intenta nuevamente." });
    if ((error as { code?: string })?.code === "42P01") return res.status(503).json({ message: "La función de temperatura aún no está disponible: falta aplicar la migración." });
    console.error("Error analizando temperatura:", error); return res.status(502).json({ message: "No se pudo analizar la conversación temporalmente." });
  }
}
