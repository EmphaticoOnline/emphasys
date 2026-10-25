import { Request, Response } from "express";
import { obtenerEmpresaActivaDeUsuario } from "../modules/auth/auth.service";
import { obtenerEmpresaPorId } from "../services/empresasService";
import { analizarLogoEmpresa } from "../services/empresasIdentidadVisualAnalisisService";
import {
  aRespuesta,
  guardarColoresIdentidad,
  obtenerIdentidadVisual,
} from "../services/empresasIdentidadVisualService";
import {
  normalizarHex,
  FONDOS_REFERENCIA,
  razonContraste,
  ROLES_IDENTIDAD,
  validarContraste,
  type RolIdentidad,
} from "../shared/identidadVisual/contraste";
import type { ModoIdentidad } from "../shared/identidadVisual/cambios";

function leerEmpresaId(req: Request): number | null {
  const empresaId = Number(req.params.empresa_id);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
}

type CuerpoValidado =
  | { ok: true; cambios: Partial<Record<RolIdentidad, string | null>>; superficieSecundaria?: string | null; modo?: ModoIdentidad; confirmarSobrescritura: boolean }
  | { ok: false; message: string };

/** Valida el cuerpo del PUT: `{ colores: { primario?, acento?, sidebar? }, confirmarSobrescritura? }`. */
export function validarCuerpoIdentidad(body: unknown): CuerpoValidado {
  const datos = (body ?? {}) as { colores?: unknown; superficie_secundaria?: unknown; modo?: unknown; confirmarSobrescritura?: unknown };
  const colores = datos.colores;
  if (!colores || typeof colores !== "object" || Array.isArray(colores)) {
    return { ok: false, message: "El campo 'colores' es requerido y debe ser un objeto" };
  }
  const claves = Object.keys(colores);
  const desconocidas = claves.filter((clave) => !(ROLES_IDENTIDAD as readonly string[]).includes(clave));
  if (desconocidas.length) {
    return { ok: false, message: `Colores no reconocidos: ${desconocidas.join(", ")}` };
  }
  if (!claves.length && datos.superficie_secundaria === undefined && datos.modo === undefined) {
    return { ok: false, message: "Indica al menos un color: primario, acento o sidebar" };
  }
  if (datos.confirmarSobrescritura !== undefined && typeof datos.confirmarSobrescritura !== "boolean") {
    return { ok: false, message: "'confirmarSobrescritura' debe ser booleano" };
  }

  const cambios: Partial<Record<RolIdentidad, string | null>> = {};
  for (const rol of claves as RolIdentidad[]) {
    const valor = (colores as Record<string, unknown>)[rol];
    if (valor === null) {
      cambios[rol] = null;
      continue;
    }
    const hex = normalizarHex(valor);
    if (!hex) return { ok: false, message: `Color ${rol} inválido: usa el formato #RRGGBB` };
    cambios[rol] = hex;
  }
  let superficieSecundaria: string | null | undefined;
  if (datos.superficie_secundaria !== undefined) {
    if (datos.superficie_secundaria === null) superficieSecundaria = null;
    else {
      superficieSecundaria = normalizarHex(datos.superficie_secundaria);
      if (!superficieSecundaria) return { ok: false, message: "Color superficie_secundaria inválido: usa el formato #RRGGBB" };
      if (razonContraste(superficieSecundaria, FONDOS_REFERENCIA.beige) < 4.5) return { ok: false, message: "Superficie secundaria sin contraste suficiente sobre beige" };
    }
  }
  const modo = datos.modo === undefined ? undefined : datos.modo === 'emphasys' || datos.modo === 'personalizado' ? datos.modo : null;
  if (datos.modo !== undefined && modo === null) return { ok: false, message: "Modo inválido" };
  return { ok: true, cambios, superficieSecundaria, modo: modo ?? undefined, confirmarSobrescritura: datos.confirmarSobrescritura === true };
}

export async function obtenerIdentidadVisualController(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth) return res.status(401).json({ message: "No autenticado" });

    const empresaId = leerEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: "empresa_id inválido" });

    if (auth.esSuperadmin) {
      const empresa = await obtenerEmpresaPorId(empresaId);
      if (!empresa) return res.status(404).json({ message: "Empresa no encontrada" });
    } else {
      const empresa = await obtenerEmpresaActivaDeUsuario(auth.userId, empresaId);
      if (!empresa) return res.status(403).json({ message: "No tienes acceso a la empresa indicada" });
    }

    const row = await obtenerIdentidadVisual(empresaId);
    return res.json(aRespuesta(empresaId, row, auth.esSuperadmin));
  } catch (error) {
    console.error("Error al obtener identidad visual de empresa:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/** POST …/identidad-visual/analizar: vuelve a analizar el logo y guarda solo la propuesta. */
export async function analizarIdentidadVisualController(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth) return res.status(401).json({ message: "No autenticado" });
    if (!auth.esSuperadmin) {
      return res.status(403).json({ message: "Solo un superadmin puede analizar el logotipo" });
    }

    const empresaId = leerEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: "empresa_id inválido" });

    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa) return res.status(404).json({ message: "Empresa no encontrada" });

    const resultado = await analizarLogoEmpresa(empresaId);
    if (!resultado.ok) return res.status(404).json({ message: "La empresa no tiene logotipo (logo_default)" });
    return res.json(aRespuesta(empresaId, resultado.identidad, true));
  } catch (error) {
    console.error("Error al analizar el logotipo de la empresa:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

export async function actualizarIdentidadVisualController(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth) return res.status(401).json({ message: "No autenticado" });
    if (!auth.esSuperadmin) {
      return res.status(403).json({ message: "Solo un superadmin puede modificar la identidad visual" });
    }

    const empresaId = leerEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: "empresa_id inválido" });

    const cuerpo = validarCuerpoIdentidad(req.body);
    if (!cuerpo.ok) return res.status(400).json({ message: cuerpo.message });

    const errores = validarContraste(cuerpo.cambios);
    if (errores.length) {
      return res.status(400).json({ message: "Uno o más colores no tienen contraste suficiente", errores });
    }

    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa) return res.status(404).json({ message: "Empresa no encontrada" });

    const resultado = await guardarColoresIdentidad(
      empresaId,
      cuerpo.cambios,
      cuerpo.confirmarSobrescritura,
      auth.userId,
      cuerpo.superficieSecundaria,
      cuerpo.modo
    );
    if (!resultado.ok) {
      return res.status(409).json({
        message: "Hay colores personalizados que se sobrescribirían; confirma para continuar",
        conflictos: resultado.conflictos,
      });
    }
    return res.json(aRespuesta(empresaId, resultado.identidad, true));
  } catch (error) {
    console.error("Error al guardar identidad visual de empresa:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}
