import { Request, Response } from "express";
import {
  obtenerContactos,
  insertarContacto,
  actualizarContacto as actualizarContactoRepository,
  obtenerContactoPorId,
  eliminarContacto as eliminarContactoRepository,
  obtenerCatalogosConfigurablesDeContacto,
  guardarCatalogosConfigurablesDeContacto,
} from "./contactos.repository";
import { normalizarTelefono } from "../../utils/telefono";
import { normalizeRFC } from "../../shared/normalizers/rfc";
import { normalizeEmail } from "../../shared/normalizers/email";

export async function crearContacto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    if (!req.body.nombre || String(req.body.nombre).trim() === "") {
      return res.status(400).json({ message: "nombre es obligatorio" });
    }

    const data = { ...req.body };

    data.nombre = String(data.nombre).trim();

    const normalizeTelefonoMx = (value: any) => {
      if (value === undefined || value === null || String(value).trim() === "") return null;
      return normalizarTelefono(String(value));
    };

    if ("telefono" in data) {
      data.telefono = normalizeTelefonoMx(data.telefono);
    }

    if ("telefono_secundario" in data) {
      data.telefono_secundario = normalizeTelefonoMx(data.telefono_secundario);
    }

    if ("rfc" in data) {
      data.rfc = normalizeRFC(data.rfc);
    }

    if ("email" in data) {
      data.email = normalizeEmail(data.email);
    }

    const contacto = await insertarContacto(data, Number(empresaId));

    res.status(201).json(contacto);
  } catch (error) {
    console.error("Error al crear contacto:", error);
    if (error instanceof Error && error.message.includes('teléfono')) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof Error && error.message === 'CP_SAT_NO_ENCONTRADO') {
      return res.status(400).json({ message: "El código postal SAT no existe" });
    }
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export const getContactos = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    const result = await obtenerContactos(Number(empresaId));
    res.json(result);
  } catch (error) {
    console.error("Error al obtener contactos:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export async function getContactoPorId(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;

    if (Number.isNaN(id) || empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "id y empresaId son obligatorios" });
    }

    const contacto = await obtenerContactoPorId(id, Number(empresaId));

    if (!contacto) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }

    res.json(contacto);
  } catch (error) {
    console.error("Error al obtener contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function actualizarContacto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const data = { ...req.body };

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    const normalizeTelefonoMx = (value: any) => {
      if (value === undefined || value === null || String(value).trim() === "") return null;
      return normalizarTelefono(String(value));
    };

    if ("telefono" in data) {
      data.telefono = normalizeTelefonoMx(data.telefono);
    }

    if ("telefono_secundario" in data) {
      data.telefono_secundario = normalizeTelefonoMx(data.telefono_secundario);
    }

    if ("rfc" in data) {
      data.rfc = normalizeRFC(data.rfc);
    }

    if ("email" in data) {
      data.email = normalizeEmail(data.email);
    }

    const contacto = await actualizarContactoRepository(id, Number(empresaId), data);
    res.json(contacto);
  } catch (error) {
    console.error("Error al actualizar contacto:", error);
    if (error instanceof Error && error.message.includes('teléfono')) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof Error && error.message === 'CP_SAT_NO_ENCONTRADO') {
      return res.status(400).json({ message: "El código postal SAT no existe" });
    }
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function eliminarContacto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;

    if (Number.isNaN(id) || empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "id y empresaId son obligatorios" });
    }

    const eliminado = await eliminarContactoRepository(id, Number(empresaId));

    if (!eliminado) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }

    res.json(eliminado);
  } catch (error) {
    console.error("Error al eliminar contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function listarCatalogosConfigurablesDeContacto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const contactoIdRaw = req.query.contactoId;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    const contactoId = contactoIdRaw !== undefined ? Number(contactoIdRaw) : undefined;

    if (contactoIdRaw !== undefined && !Number.isFinite(contactoId)) {
      return res.status(400).json({ message: "contactoId debe ser numérico" });
    }

    const payload = await obtenerCatalogosConfigurablesDeContacto(Number(empresaId), contactoId);
    res.json(payload);
  } catch (error) {
    console.error("Error al obtener catálogos configurables de contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function guardarCatalogosConfigurables(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const contactoId = Number(req.params.id);
    const catalogoIdsRaw = req.body?.catalogoIds;

    if (empresaId === undefined || empresaId === null || Number.isNaN(Number(empresaId))) {
      return res.status(400).json({ message: "empresaId es obligatorio" });
    }

    if (!Number.isFinite(contactoId)) {
      return res.status(400).json({ message: "id de contacto inválido" });
    }

    const catalogoIds = Array.isArray(catalogoIdsRaw)
      ? catalogoIdsRaw.map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [];

    await guardarCatalogosConfigurablesDeContacto(Number(empresaId), contactoId, catalogoIds);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error al guardar catálogos configurables de contacto:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}