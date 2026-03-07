import { Request, Response } from "express";
import {
  buscarCodigoPostal,
  listarColoniasPorCp,
  buscarRegimenesFiscales,
  buscarUsosCfdi,
  buscarFormasPago,
  buscarMetodosPago,
  buscarCodigosPostales,
} from "./sat.repository";

export async function getCodigoPostal(req: Request, res: Response) {
  try {
    const cp = typeof req.params.cp === "string" ? req.params.cp : "";
    if (!cp || cp.trim() === "") {
      return res.status(400).json({ message: "El código postal es obligatorio" });
    }

  const result = await buscarCodigoPostal(cp.trim());
    if (!result) {
      return res.status(404).json({ message: "Código postal no encontrado" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error al consultar código postal:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function getColonias(req: Request, res: Response) {
  try {
    const cpParam = typeof req.params.cp === "string" ? req.params.cp : undefined;
    const cpQuery = typeof req.query.cp === "string" ? req.query.cp : undefined;
    const cp = (cpParam ?? cpQuery)?.trim();
    const q = typeof req.query.q === "string" ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    if (!cp || cp === "") {
      return res.status(400).json({ message: "cp es obligatorio" });
    }

    const colonias = await listarColoniasPorCp(cp.trim(), q, limit);
    res.json({ items: colonias.map((c) => ({ ...c, colonia: c.clave, texto: c.nombre })) });
  } catch (error) {
    console.error("Error al consultar colonias:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function getRegimenesFiscales(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarRegimenesFiscales(q, limit);
    res.json({ items });
  } catch (error) {
    console.error("Error al consultar regímenes fiscales:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function getUsosCfdi(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarUsosCfdi(q, limit);
    res.json({ items });
  } catch (error) {
    console.error("Error al consultar usos CFDI:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function getFormasPago(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarFormasPago(q, limit);
    res.json({ items });
  } catch (error) {
    console.error("Error al consultar formas de pago:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function getMetodosPago(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarMetodosPago(q, limit);
    res.json({ items });
  } catch (error) {
    console.error("Error al consultar métodos de pago:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function buscarCodigosPostalesHandler(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarCodigosPostales(q, limit);
    res.json({ items });
  } catch (error) {
    console.error("Error al buscar códigos postales:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}
