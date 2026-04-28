import { Request, Response } from 'express';
import {
  guardarConfiguracionEmail,
  guardarConfiguracionEmailUsuario,
  getConfiguracionEmail,
  obtenerConfiguracionEmailActual,
  obtenerConfiguracionEmailUsuarioActual,
  probarConfiguracionEmail,
} from './email.service';

function ensureEmpresa(req: Request): number | null {
  return req.context?.empresaId ?? null;
}

function ensureUsuario(req: Request): number | null {
  return req.auth?.userId ?? null;
}

function resolveUsuarioObjetivo(req: Request): number | null {
  const usuarioRaw = req.method === 'GET' ? req.query?.usuario_id : req.body?.usuario_id;
  if (usuarioRaw !== undefined && usuarioRaw !== null && String(usuarioRaw).trim() !== '') {
    const usuarioId = Number(usuarioRaw);
    return Number.isFinite(usuarioId) ? usuarioId : null;
  }

  return ensureUsuario(req);
}

export async function obtenerConfiguracionEmail(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const configuracion = await obtenerConfiguracionEmailActual(empresaId);
    return res.json({ configuracion });
  } catch (error) {
    console.error('Error al obtener configuracion SMTP:', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuracion SMTP' });
  }
}

export async function obtenerConfiguracionEmailUsuario(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    const usuarioId = resolveUsuarioObjetivo(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });
    if (!usuarioId) return res.status(400).json({ message: 'usuario_id inválido o no disponible' });

    const configuracion = await obtenerConfiguracionEmailUsuarioActual(empresaId, usuarioId);
    const configuracion_resuelta = await getConfiguracionEmail(empresaId, usuarioId);
    return res.json({ configuracion, configuracion_resuelta });
  } catch (error) {
    console.error('Error al obtener configuracion SMTP de usuario:', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuracion SMTP de usuario' });
  }
}

export async function guardarConfiguracionEmailController(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    console.log('[SMTP SAVE][controller][empresa] req.body', {
      empresaId,
      smtp_user: req.body?.smtp_user,
      smtp_password_present: Boolean(req.body?.smtp_password),
      smtp_password_length: req.body?.smtp_password?.length ?? 0,
    });

    const configuracion = await guardarConfiguracionEmail(empresaId, req.body || {});
    return res.json({ configuracion });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la configuracion SMTP';
    const status = message.includes('obligatorio') || message.includes('numero valido') ? 400 : 500;
    console.error('Error al guardar configuracion SMTP:', error);
    return res.status(status).json({ message });
  }
}

export async function guardarConfiguracionEmailUsuarioController(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    const usuarioId = resolveUsuarioObjetivo(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });
    if (!usuarioId) return res.status(400).json({ message: 'usuario_id inválido o no disponible' });

    console.log('[SMTP SAVE][controller][usuario] req.body', {
      empresaId,
      usuarioId,
      smtp_user: req.body?.smtp_user,
      smtp_password_present: Boolean(req.body?.smtp_password),
      smtp_password_length: req.body?.smtp_password?.length ?? 0,
    });
    console.log('SMTP PASSWORD RECEIVED:', req.body?.smtp_password?.length ?? 0);

    const configuracion = await guardarConfiguracionEmailUsuario(empresaId, usuarioId, req.body || {});
    return res.json({ configuracion });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la configuracion SMTP de usuario';
    const status = message.includes('obligatorio') || message.includes('numero valido') ? 400 : 500;
    console.error('Error al guardar configuracion SMTP de usuario:', error);
    return res.status(status).json({ message });
  }
}

export async function probarConfiguracionEmailController(req: Request, res: Response) {
  try {
    const empresaId = ensureEmpresa(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa no disponible en el contexto' });

    const usuarioId = req.body?.usuario_id !== undefined ? resolveUsuarioObjetivo(req) : req.auth?.userId;
    if (req.body?.usuario_id !== undefined && !usuarioId) {
      return res.status(400).json({ message: 'usuario_id inválido o no disponible' });
    }

    const resultado = await probarConfiguracionEmail(empresaId, req.body || {}, req.auth?.email, usuarioId);
    return res.json(resultado);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo probar la configuracion SMTP';
    const status = message.includes('No existe configuracion SMTP') || message.includes('Define un destinatario')
      || message.includes('No hay usuario autenticado')
      || message.includes('obligatorio') || message.includes('numero valido')
      ? 400
      : 502;
    console.error('Error al probar configuracion SMTP:', error);
    return res.status(status).json({ message });
  }
}