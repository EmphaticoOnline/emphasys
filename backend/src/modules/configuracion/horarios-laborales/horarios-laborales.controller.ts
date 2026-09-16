import { Request, Response, NextFunction } from 'express';
import { obtenerRolesDeUsuarioEnEmpresa } from '../../auth/auth.service';
import { actualizarExcepcion, actualizarZonaHoraria, eliminarExcepcion, guardarExcepcion, guardarHorarios, guardarHorario, obtenerConfiguracion } from './horarios-laborales.repository';

export async function requireAdminConfiguracion(req: Request, res: Response, next: NextFunction) {
  const empresaId = req.context?.empresaId;
  if (!empresaId || !req.auth) return res.status(400).json({ message: 'Empresa activa no disponible' });
  const roles = await obtenerRolesDeUsuarioEnEmpresa(req.auth.userId, empresaId);
  if (!req.auth.esSuperadmin && !roles.some((r) => ['admin', 'administrador'].includes(r.nombre.trim().toLowerCase()))) return res.status(403).json({ message: 'Sólo administradores pueden modificar horarios laborales' });
  next();
}

const empresa = (req: Request) => req.context?.empresaId ?? 0;
const hora = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const zonaValida = (v: unknown) => typeof v === 'string' && v.length <= 64 && (() => { try { new Intl.DateTimeFormat('en-US', { timeZone: v }).format(); return true; } catch { return false; } })();

export async function getHorarios(req: Request, res: Response) { return res.json(await obtenerConfiguracion(empresa(req))); }
export async function putZona(req: Request, res: Response) {
  const zona = req.body?.zona_horaria;
  if (zona !== null && zona !== '' && !zonaValida(zona)) return res.status(400).json({ message: 'La zona horaria debe ser IANA (por ejemplo, America/Mexico_City)' });
  return res.json(await actualizarZonaHoraria(empresa(req), zona || null));
}
export async function putHorario(req: Request, res: Response) {
  if (Array.isArray(req.body?.horarios)) {
    const horarios = req.body.horarios.map((h: any) => ({ dia: Number(h.dia_semana), inicio: h.hora_inicio, fin: h.hora_fin, activo: h.activo !== false }));
    const invalid = horarios.find((h: any) => !Number.isInteger(h.dia) || h.dia < 0 || h.dia > 6 || !hora(h.inicio) || !hora(h.fin) || h.inicio >= h.fin);
    if (horarios.length !== 7 || invalid) return res.status(400).json({ message: invalid ? `La configuración semanal es inválida en ${['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][invalid.dia] ?? 'un día'}: usa horas HH:mm con fin posterior.` : 'La configuración semanal debe incluir los 7 días.' });
    return res.json(await guardarHorarios(empresa(req), horarios));
  }
  const dia = Number(req.body?.dia_semana), inicio = req.body?.hora_inicio, fin = req.body?.hora_fin;
  if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !hora(inicio) || !hora(fin) || inicio >= fin) return res.status(400).json({ message: 'Día u horario inválido; la hora final debe ser posterior' });
  return res.json(await guardarHorario(empresa(req), dia, inicio, fin, req.body?.activo !== false));
}
export async function postExcepcion(req: Request, res: Response) {
  const { fecha, tipo, descripcion = null, hora_inicio = null, hora_fin = null } = req.body ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') || !['inhabil', 'horario_especial'].includes(tipo) || (tipo === 'inhabil' && (hora_inicio || hora_fin)) || (tipo === 'horario_especial' && (!hora(hora_inicio) || !hora(hora_fin) || hora_inicio >= hora_fin))) return res.status(400).json({ message: 'Excepción inválida' });
  return res.status(201).json(await guardarExcepcion(empresa(req), { fecha, tipo, descripcion, hora_inicio: tipo === 'inhabil' ? null : hora_inicio, hora_fin: tipo === 'inhabil' ? null : hora_fin }));
}
export async function putExcepcion(req: Request, res: Response) {
  const { fecha, tipo, descripcion = null, hora_inicio = null, hora_fin = null } = req.body ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') || !['inhabil', 'horario_especial'].includes(tipo) || (tipo === 'inhabil' && (hora_inicio || hora_fin)) || (tipo === 'horario_especial' && (!hora(hora_inicio) || !hora(hora_fin) || hora_inicio >= hora_fin))) return res.status(400).json({ message: 'Excepción inválida' });
  const updated = await actualizarExcepcion(empresa(req), Number(req.params.id), { fecha, tipo, descripcion, hora_inicio: tipo === 'inhabil' ? null : hora_inicio, hora_fin: tipo === 'inhabil' ? null : hora_fin });
  return updated ? res.json(updated) : res.status(404).json({ message: 'Excepción no encontrada' });
}
export async function deleteExcepcion(req: Request, res: Response) { return (await eliminarExcepcion(empresa(req), Number(req.params.id))) ? res.status(204).send() : res.status(404).json({ message: 'Excepción no encontrada' }); }
