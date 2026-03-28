import { Request, Response } from "express";
import { APIError } from "openai";
import {
  SqlValidationError,
  ejecutarSQL,
  generarInsightEstructurado,
  generarSQL,
  validarSQL,
} from "../services/aiReportes.service";
import { obtenerEmpresaActivaDeUsuario } from "../modules/auth/auth.service";
import { obtenerEmpresaActivaPorId } from "../modules/auth/auth.middleware";

export async function generarReporteAI(req: Request, res: Response) {
  const inicio = Date.now();

  try {
    const { pregunta, empresa_id } = req.body || {};

    if (!req.auth) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const preguntaLimpia = typeof pregunta === "string" ? pregunta.trim().replace(/\s+/g, " ") : "";
    const empresaId = Number(empresa_id);

    if (!preguntaLimpia) {
      return res.status(400).json({ message: "El campo 'pregunta' es requerido" });
    }

    if (preguntaLimpia.length > 400) {
      return res.status(400).json({ message: "La pregunta es demasiado larga (máx. 400 caracteres)" });
    }

    if (!Number.isFinite(empresaId)) {
      return res.status(400).json({ message: "El campo 'empresa_id' debe ser numérico" });
    }

    const empresa = req.auth.esSuperadmin
      ? await obtenerEmpresaActivaPorId(empresaId)
      : await obtenerEmpresaActivaDeUsuario(req.auth.userId, empresaId);

    if (!empresa) {
      return res.status(403).json({ message: "No tienes acceso a la empresa indicada" });
    }

    const sql = await generarSQL(preguntaLimpia, empresaId);
    validarSQL(sql, empresaId);

  const resultados = await ejecutarSQL(sql);
  const insight = await generarInsightEstructurado(resultados, preguntaLimpia);

    const duracionMs = Date.now() - inicio;
    console.info(
      `[ai-reportes] empresa=${empresaId} usuario=${req.auth.userId} pregunta="${preguntaLimpia}" sql="${sql}" duracion_ms=${duracionMs}`
    );

    return res.json({
      sql_generado: sql,
      resultados,
      resumen: insight.resumen,
      metricas: insight.metricas,
      hallazgos: insight.hallazgos,
      recomendaciones: insight.recomendaciones,
    });
  } catch (error) {
    const duracionMs = Date.now() - inicio;
    console.error("[ai-reportes] error", { error, duracion_ms: duracionMs });

    if (error instanceof SqlValidationError) {
      return res.status(400).json({ message: error.message });
    }

    if (error instanceof APIError) {
      const status = error.status ?? 502;
      const message = error.error?.message || error.message || "Error al llamar a OpenAI";
      return res.status(status).json({ message });
    }

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return res.status(500).json({ message: "Configuración de OpenAI faltante" });
    }

    const fallbackMessage = error instanceof Error ? error.message : "No se pudo generar el reporte";
    return res.status(502).json({ message: fallbackMessage });
  }
}