import { Request, Response } from "express";
import { obtenerParametrosPorEmpresa, upsertParametroEmpresa } from "./parametros.repository";
import { actualizarOpcion, crearOpcion, eliminarOpcion, listarOpciones } from "./parametros-opciones.repository";

export async function listarParametrosSistema(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: "empresaId es obligatorio" });

    const modulos = await obtenerParametrosPorEmpresa(empresaId);
    return res.json({ modulos });
  } catch (error) {
    console.error("Error al listar parámetros del sistema", error);
    return res.status(500).json({ message: "Error al obtener parámetros" });
  }
}

export async function guardarParametroSistema(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: "empresaId es obligatorio" });

    const parametroId = Number(req.body?.parametro_id);
    if (!Number.isFinite(parametroId)) {
      return res.status(400).json({ message: "parametro_id debe ser numérico" });
    }

    const valor = req.body?.valor ?? null;

    try {
      const saved = await upsertParametroEmpresa(empresaId, parametroId, valor);
      return res.json(saved);
    } catch (err: any) {
      if (err?.message === "PARAMETRO_NO_ENCONTRADO") {
        return res.status(404).json({ message: "Parámetro no encontrado" });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error al guardar parámetro del sistema", error);
    return res.status(500).json({ message: "No se pudo guardar el parámetro" });
  }
}

export async function listarOpcionesParametro(req: Request, res: Response) {
  try {
    const parametroId = Number(req.params.parametroId);
    if (!Number.isFinite(parametroId)) return res.status(400).json({ message: "parametroId inválido" });

    const opciones = await listarOpciones(parametroId);
    return res.json(opciones);
  } catch (error) {
    console.error("Error al listar opciones de parámetro", error);
    return res.status(500).json({ message: "Error al obtener opciones" });
  }
}

export async function crearOpcionParametro(req: Request, res: Response) {
  try {
    const parametroId = Number(req.params.parametroId);
    if (!Number.isFinite(parametroId)) return res.status(400).json({ message: "parametroId inválido" });

    const { valor, etiqueta, orden = null } = req.body || {};
    if (!valor || !etiqueta) return res.status(400).json({ message: "valor y etiqueta son requeridos" });

    const created = await crearOpcion(parametroId, { valor, etiqueta, orden });
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error al crear opción de parámetro", error);
    return res.status(500).json({ message: "No se pudo crear la opción" });
  }
}

export async function actualizarOpcionParametro(req: Request, res: Response) {
  try {
    const opcionId = Number(req.params.opcionId);
    if (!Number.isFinite(opcionId)) return res.status(400).json({ message: "opcionId inválido" });

    const { valor, etiqueta, orden = null } = req.body || {};
    const updated = await actualizarOpcion(opcionId, { valor, etiqueta, orden });
    if (!updated) return res.status(404).json({ message: "Opción no encontrada" });
    return res.json(updated);
  } catch (error) {
    console.error("Error al actualizar opción de parámetro", error);
    return res.status(500).json({ message: "No se pudo actualizar la opción" });
  }
}

export async function eliminarOpcionParametro(req: Request, res: Response) {
  try {
    const opcionId = Number(req.params.opcionId);
    if (!Number.isFinite(opcionId)) return res.status(400).json({ message: "opcionId inválido" });

    const deleted = await eliminarOpcion(opcionId);
    if (!deleted) return res.status(404).json({ message: "Opción no encontrada" });
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar opción de parámetro", error);
    return res.status(500).json({ message: "No se pudo eliminar la opción" });
  }
}