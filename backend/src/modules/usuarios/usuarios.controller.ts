import { Request, Response } from 'express';
import {
  asignarEmpresas,
  asignarRoles,
  actualizarUsuario,
  crearUsuario,
  desactivarUsuario,
  listarUsuarios,
  obtenerUsuarioPorId,
  obtenerUsuarioEmpresasYRoles,
  usuarioTieneRelaciones,
} from './usuarios.repository';

export async function getUsuarios(_req: Request, res: Response) {
  try {
    const usuarios = await listarUsuarios();
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
}

export async function getUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const usuario = await obtenerUsuarioPorId(id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
}

export async function getUsuarioEmpresas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const data = await obtenerUsuarioEmpresasYRoles(id);
    if (!data) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(data);
  } catch (error) {
    console.error('Error al obtener empresas/roles de usuario:', error);
    res.status(500).json({ message: 'Error al obtener empresas del usuario' });
  }
}

export async function postUsuario(req: Request, res: Response) {
  try {
    const { nombre, email, password, es_superadmin = false, activo = true } = req.body || {};
    if (!nombre || String(nombre).trim() === '') return res.status(400).json({ message: 'El nombre es obligatorio' });
    if (!email || String(email).trim() === '') return res.status(400).json({ message: 'El email es obligatorio' });
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'El password es obligatorio (mínimo 6 caracteres)' });

    try {
      const nuevo = await crearUsuario({ nombre, email, password, es_superadmin, activo });
      res.status(201).json(nuevo);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
      throw err;
    }
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
}

export async function putUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });

    const { nombre, email, password, es_superadmin, activo } = req.body || {};
    if (email !== undefined && String(email).trim() === '') return res.status(400).json({ message: 'El email no puede estar vacío' });
    if (nombre !== undefined && String(nombre).trim() === '') return res.status(400).json({ message: 'El nombre no puede estar vacío' });
    if (password !== undefined && String(password).length < 6) return res.status(400).json({ message: 'El password debe tener al menos 6 caracteres' });

    try {
      const actualizado = await actualizarUsuario(id, { nombre, email, password, es_superadmin, activo });
      if (!actualizado) return res.status(404).json({ message: 'Usuario no encontrado' });
      res.json(actualizado);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
      throw err;
    }
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
}

export async function deleteUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });

    const tieneRelacion = await usuarioTieneRelaciones(id);
    if (tieneRelacion) {
      return res.status(400).json({ message: 'No se puede eliminar/desactivar: el usuario tiene empresas o roles asignados' });
    }

    const desactivado = await desactivarUsuario(id);
    if (!desactivado) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
}

export async function postUsuarioEmpresas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const empresas = Array.isArray(req.body?.empresas) ? req.body.empresas : [];
    await asignarEmpresas(id, empresas);
    res.status(204).send();
  } catch (error) {
    console.error('Error al asignar empresas:', error);
    res.status(500).json({ message: 'Error al asignar empresas' });
  }
}

export async function postUsuarioRoles(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = Number(req.body?.empresa_id);
    const roles = Array.isArray(req.body?.roles) ? req.body.roles.map((r: any) => Number(r)).filter((n: number) => Number.isFinite(n)) : [];
    if (!Number.isFinite(id) || !Number.isFinite(empresaId)) return res.status(400).json({ message: 'id o empresa_id inválidos' });

    await asignarRoles(id, empresaId, roles);
    res.status(204).send();
  } catch (error) {
    console.error('Error al asignar roles:', error);
    res.status(500).json({ message: 'Error al asignar roles' });
  }
}
