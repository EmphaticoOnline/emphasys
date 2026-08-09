import type { Request, Response } from 'express';
import { actualizarEspecificacionBiblioteca, cambiarBajaEspecificacionBiblioteca, crearEspecificacionBiblioteca, listarEspecificacionesBiblioteca, reordenarEspecificacionesBiblioteca } from './especificaciones-biblioteca.repository';
import { exigirEspecificacionesEmpresaHabilitadas, obtenerConfiguracionEspecificaciones } from './especificaciones-configuracion.service';

function responderError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Error interno';
  if (message.startsWith('VALIDATION_ERROR:')) return res.status(400).json({ error: message.slice(17).trim() });
  console.error('[especificaciones-biblioteca]', error);
  return res.status(500).json({ error: 'No se pudo procesar la biblioteca de especificaciones' });
}

export async function listar(req: Request, res: Response) {
  try {
    await exigirEspecificacionesEmpresaHabilitadas(Number(req.context!.empresaId));
    const raw = req.query.producto_id;
    const productoId = raw === undefined ? undefined : raw === 'global' ? null : Number(raw);
    if (typeof productoId === 'number' && !Number.isInteger(productoId)) return res.status(400).json({ error: 'producto_id inválido' });
    res.json(await listarEspecificacionesBiblioteca(Number(req.context!.empresaId), productoId, req.query.incluir_bajas === 'true'));
  } catch (e) { responderError(res, e); }
}
export async function crear(req: Request, res: Response) {
  try { await exigirEspecificacionesEmpresaHabilitadas(Number(req.context!.empresaId)); res.status(201).json(await crearEspecificacionBiblioteca(Number(req.context!.empresaId), req.auth?.userId ?? null, req.body)); } catch (e) { responderError(res, e); }
}
export async function actualizar(req: Request, res: Response) {
  try { await exigirEspecificacionesEmpresaHabilitadas(Number(req.context!.empresaId)); const row = await actualizarEspecificacionBiblioteca(Number(req.params.id), Number(req.context!.empresaId), req.auth?.userId ?? null, req.body); if (!row) return res.status(404).json({ error: 'Especificación no encontrada' }); res.json(row); } catch (e) { responderError(res, e); }
}
export async function reordenar(req: Request, res: Response) {
  try { await exigirEspecificacionesEmpresaHabilitadas(Number(req.context!.empresaId)); await reordenarEspecificacionesBiblioteca(Number(req.context!.empresaId), req.auth?.userId ?? null, Array.isArray(req.body?.ids) ? req.body.ids : []); res.json({ ok: true }); } catch (e) { responderError(res, e); }
}
export async function baja(req: Request, res: Response) {
  try { await exigirEspecificacionesEmpresaHabilitadas(Number(req.context!.empresaId)); const row = await cambiarBajaEspecificacionBiblioteca(Number(req.params.id), Number(req.context!.empresaId), req.auth?.userId ?? null, req.body?.baja !== false); if (!row) return res.status(404).json({ error: 'Especificación no encontrada' }); res.json(row); } catch (e) { responderError(res, e); }
}

export async function obtenerConfiguracion(req: Request, res: Response) {
  try {
    const tipoDocumento = String(req.query.tipo_documento ?? '').trim().toLowerCase() || null;
    res.json(await obtenerConfiguracionEspecificaciones(Number(req.context!.empresaId), tipoDocumento));
  } catch (e) { responderError(res, e); }
}
