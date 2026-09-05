import { Request, Response } from "express";
import {
  buscarCodigoPostal,
  listarColoniasPorCp,
  buscarRegimenesFiscales,
  buscarUsosCfdi,
  buscarFormasPago,
  buscarMetodosPago,
  buscarProductosServicios,
  buscarPaises,
  buscarCodigosPostales,
  buscarBienesTransportados, buscarMaterialesPeligrosos, buscarTiposEmbalaje, buscarUnidadesSat,
  buscarConfiguracionesAutotransporte, buscarTiposPermiso, buscarSubtiposRemolque,
  RegimenFiscal,
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

export async function getRegimenesFiscalesCatalogo(req: Request, res: Response) {
  try {
    const items: RegimenFiscal[] = await buscarRegimenesFiscales(null, 200);
    res.json(items.map((r) => ({ id: r.id, descripcion: r.descripcion })));
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

export async function getProductosServicios(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarProductosServicios(q, limit);
    res.json({ items });
  } catch (error) {
    console.error('Error al consultar productos/servicios SAT:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function getPaises(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await buscarPaises(q, limit);
    res.json({ items });
  } catch (error) {
    console.error('Error al consultar países SAT:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

async function getCartaPorteCatalogo(req: Request, res: Response, buscar: (q: string | null, limit?: number) => Promise<unknown[]>) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ items: await buscar(q, limit) });
  } catch (error) { console.error('Error al consultar catálogo Carta Porte:', error); res.status(500).json({ message: 'Error interno del servidor' }); }
}
export const getBienesTransportados = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarBienesTransportados);
export const getMaterialesPeligrosos = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarMaterialesPeligrosos);
export const getTiposEmbalaje = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarTiposEmbalaje);
export const getUnidadesSat = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarUnidadesSat);
export const getConfiguracionesAutotransporte = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarConfiguracionesAutotransporte);
export const getTiposPermiso = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarTiposPermiso);
export const getSubtiposRemolque = (req: Request, res: Response) => getCartaPorteCatalogo(req, res, buscarSubtiposRemolque);

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
