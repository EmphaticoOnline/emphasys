import { Request, Response } from "express";
import {
  listarCamposObligatorios,
  crearCampoObligatorio,
  eliminarCampoObligatorio,
} from "./campos-obligatorios.repository";

export async function getCamposObligatorios(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ error: "empresaId es obligatorio" });

    const { entidad, contexto } = req.query;
    if (!entidad || typeof entidad !== "string") {
      return res.status(400).json({ error: "entidad es obligatoria" });
    }

    const contextoVal = typeof contexto === "string" ? contexto : null;
    const campos = await listarCamposObligatorios(empresaId, entidad, contextoVal);
    return res.json({ campos });
  } catch (error) {
    console.error("Error al listar campos obligatorios", error);
    return res.status(500).json({ error: "Error al obtener campos obligatorios" });
  }
}

export async function postCampoObligatorio(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ error: "empresaId es obligatorio" });

    const { entidad, contexto, campo } = req.body ?? {};
    if (!entidad || !campo) {
      return res.status(400).json({ error: "entidad y campo son obligatorios" });
    }

    const created = await crearCampoObligatorio(
      empresaId,
      String(entidad),
      contexto ? String(contexto) : null,
      String(campo)
    );
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error al crear campo obligatorio", error);
    return res.status(500).json({ error: "No se pudo crear el campo obligatorio" });
  }
}

export async function deleteCampoObligatorio(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ error: "empresaId es obligatorio" });

    const { entidad, contexto, campo } = req.body ?? {};
    if (!entidad || !campo) {
      return res.status(400).json({ error: "entidad y campo son obligatorios" });
    }

    const deleted = await eliminarCampoObligatorio(
      empresaId,
      String(entidad),
      contexto ? String(contexto) : null,
      String(campo)
    );

    if (!deleted) return res.status(404).json({ error: "Registro no encontrado" });
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar campo obligatorio", error);
    return res.status(500).json({ error: "No se pudo eliminar el campo obligatorio" });
  }
}
