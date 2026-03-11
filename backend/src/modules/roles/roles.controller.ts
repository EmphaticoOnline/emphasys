import { Request, Response } from 'express';
import { actualizarRol, crearRol, eliminarRol, listarRoles, rolTieneUsuarios } from './roles.repository';

type EmpresaCheck = { ok: true; empresaId: number } | { ok: false; status: number; message: string };

function ensureEmpresaMatch(req: Request, empresaIdParam?: number): EmpresaCheck {
  const empresaCtx = req.context?.empresaId;
  if (!empresaCtx) return { ok: false, status: 400, message: 'empresaId no disponible en contexto' };
  if (empresaIdParam !== undefined && empresaCtx !== empresaIdParam) {
    return { ok: false, status: 403, message: 'No puedes acceder a roles de otra empresa' };
  }
  return { ok: true, empresaId: empresaCtx };
}

export async function getRoles(req: Request, res: Response) {
  try {
    const empresaIdParam = Number(req.params.empresaId);
    if (!Number.isFinite(empresaIdParam)) return res.status(400).json({ message: 'empresaId debe ser numérico' });

    const check = ensureEmpresaMatch(req, empresaIdParam);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const roles = await listarRoles(empresaIdParam);
    res.json(roles);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ message: 'Error al obtener roles' });
  }
}

export async function crearRolHandler(req: Request, res: Response) {
  try {
    const empresaIdBody = req.body?.empresa_id ? Number(req.body.empresa_id) : undefined;
    const check = ensureEmpresaMatch(req, empresaIdBody);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const { nombre, descripcion, activo = true } = req.body || {};
    if (!nombre || String(nombre).trim() === '') {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    try {
  const nuevo = await crearRol({ empresa_id: check.empresaId, nombre: String(nombre), descripcion: descripcion ?? null, activo: Boolean(activo) });
      return res.status(201).json(nuevo);
    } catch (err: any) {
      if (err?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe un rol con ese nombre en la empresa' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error al crear rol:', error);
    res.status(500).json({ message: 'Error al crear rol' });
  }
}

export async function actualizarRolHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });

    const check = ensureEmpresaMatch(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const { nombre, descripcion, activo } = req.body || {};
    if (nombre !== undefined && String(nombre).trim() === '') {
      return res.status(400).json({ message: 'El nombre no puede estar vacío' });
    }

    try {
  const actualizado = await actualizarRol(id, check.empresaId, {
        nombre: nombre !== undefined ? String(nombre) : undefined,
        descripcion: descripcion !== undefined ? descripcion : undefined,
        activo: activo !== undefined ? Boolean(activo) : undefined,
      });
      if (!actualizado) return res.status(404).json({ message: 'Rol no encontrado' });
      return res.json(actualizado);
    } catch (err: any) {
      if (err?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe un rol con ese nombre en la empresa' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({ message: 'Error al actualizar rol' });
  }
}

export async function eliminarRolHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });

    const check = ensureEmpresaMatch(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const enUso = await rolTieneUsuarios(id);
    if (enUso) {
      return res.status(400).json({ message: 'No se puede eliminar el rol porque tiene usuarios asignados' });
    }

  const eliminado = await eliminarRol(id, check.empresaId);
    if (!eliminado) return res.status(404).json({ message: 'Rol no encontrado' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({ message: 'Error al eliminar rol' });
  }
}
