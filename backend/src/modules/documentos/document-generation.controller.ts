import { Request, Response } from "express";
import type { TipoDocumento } from "../../types/documentos";
import { DocumentGenerationService, ServiceError } from "./document-generation.service";
import type { GenerarDocumentoPayload } from "./document-generation.types";

const parseTipo = (valor: any): TipoDocumento => (valor ?? "").toString().toLowerCase() as TipoDocumento;

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ message: error.message, code: error.code, details: error.details });
  }
  console.error("Error inesperado en generación de documentos", error);
  return res.status(500).json({ message: "Error interno" });
};

export async function obtenerOpcionesGeneracion(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.documentoId);
    const empresaId = req.context?.empresaId;
    if (!empresaId || Number.isNaN(documentoId)) {
      return res.status(400).json({ message: "Parámetros inválidos" });
    }

    const opciones = await DocumentGenerationService.getOpcionesGeneracion(documentoId, empresaId);
    return res.json(opciones);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function prepararGeneracion(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.documentoId);
    const tipoDestino = parseTipo(req.query.tipoDestino);
    const empresaId = req.context?.empresaId;

    if (!empresaId || Number.isNaN(documentoId) || !tipoDestino) {
      return res.status(400).json({ message: "Parámetros inválidos" });
    }

    const respuesta = await DocumentGenerationService.prepararGeneracion(documentoId, tipoDestino, empresaId);
    return res.json(respuesta);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function generarDocumentoDesdeOrigen(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId no disponible en contexto" });
    }

    const payload = req.body as GenerarDocumentoPayload;
    if (!payload?.documento_origen_id || !payload?.tipo_documento_destino) {
      return res.status(400).json({ message: "documento_origen_id y tipo_documento_destino son requeridos" });
    }

    const usuarioId = req.auth?.userId ?? null;

    const resultado = await DocumentGenerationService.generarDocumentoDesdeOrigen(
      {
        ...payload,
        tipo_documento_destino: parseTipo(payload.tipo_documento_destino),
      },
      empresaId,
      usuarioId
    );

    return res.status(201).json(resultado);
  } catch (error) {
    return handleError(res, error);
  }
}
