import { Request, Response } from "express";
import {
  Empresa,
  EmpresaPayload,
  actualizarEmpresa,
  crearEmpresa,
  desactivarEmpresa,
  listarEmpresasActivas,
  obtenerEmpresaPorId,
} from "../services/empresasService";

function validarRequeridos(body: any) {
  const faltantes: string[] = [];
  const requeridos = [
    "identificador",
    "nombre",
    "razon_social",
    "rfc",
    "regimen_fiscal_id",
    "codigo_postal_id",
    "estado_id",
  ];

  requeridos.forEach((campo) => {
    const value = body?.[campo];
    if (value === undefined || value === null || String(value).trim() === "") {
      faltantes.push(campo);
    }
  });

  return faltantes;
}

export async function getEmpresas(_req: Request, res: Response) {
  try {
    const empresas = await listarEmpresasActivas();
    return res.json(empresas);
  } catch (error) {
    console.error("Error al listar empresas:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function getEmpresaPorId(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "id inválido" });
    }

    const empresa = await obtenerEmpresaPorId(id);
    if (!empresa) {
      return res.status(404).json({ message: "Empresa no encontrada" });
    }

    return res.json(empresa);
  } catch (error) {
    console.error("Error al obtener empresa:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function crearEmpresaController(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth || !auth.esSuperadmin) {
      return res.status(403).json({ message: "Solo un superadmin puede administrar empresas" });
    }

    const faltantes = validarRequeridos(req.body);
    if (faltantes.length > 0) {
      return res.status(400).json({ message: `Campos requeridos: ${faltantes.join(", ")}` });
    }

    const payload: EmpresaPayload = { ...req.body };
    const nueva = await crearEmpresa(payload);
    return res.status(201).json(nueva);
  } catch (error) {
    console.error("Error al crear empresa:", error);
    if (error instanceof Error) {
      if (error.message === "IDENTIFICADOR_DUPLICADO") {
        return res.status(409).json({ message: "El identificador ya existe" });
      }
      if (error.message === "RFC_DUPLICADO") {
        return res.status(409).json({ message: "El RFC ya existe" });
      }
      if (error.message === "DATOS_INCOMPLETOS") {
        return res.status(400).json({ message: "Campos obligatorios incompletos" });
      }
    }
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function actualizarEmpresaController(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth || !auth.esSuperadmin) {
      return res.status(403).json({ message: "Solo un superadmin puede administrar empresas" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "id inválido" });
    }

    const payload: EmpresaPayload = { ...req.body };
    const actualizada = await actualizarEmpresa(id, payload);

    if (!actualizada) {
      return res.status(404).json({ message: "Empresa no encontrada" });
    }

    return res.json(actualizada);
  } catch (error) {
    console.error("Error al actualizar empresa:", error);
    if (error instanceof Error) {
      if (error.message === "IDENTIFICADOR_DUPLICADO") {
        return res.status(409).json({ message: "El identificador ya existe" });
      }
      if (error.message === "RFC_DUPLICADO") {
        return res.status(409).json({ message: "El RFC ya existe" });
      }
    }
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function eliminarEmpresaController(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth || !auth.esSuperadmin) {
      return res.status(403).json({ message: "Solo un superadmin puede administrar empresas" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "id inválido" });
    }

    const eliminada: Empresa | null = await desactivarEmpresa(id);

    if (!eliminada) {
      return res.status(404).json({ message: "Empresa no encontrada" });
    }

    return res.json(eliminada);
  } catch (error) {
    console.error("Error al eliminar empresa:", error);
    if (error instanceof Error && error.message === "EMPRESA_CON_RELACIONES") {
      return res.status(409).json({ message: "No se puede eliminar: existen registros relacionados" });
    }
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}
