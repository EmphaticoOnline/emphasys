import { Request, Response } from 'express';
import { actualizarUnidadRepository, crearUnidadRepository, eliminarUnidadRepository, getUnidadesRepository } from './unidades.repository';

export async function getUnidades(req: Request, res: Response) {
  try {
    const unidades = await getUnidadesRepository(req.context!.empresaId, req.query.incluirInactivas !== 'false');
    res.json(unidades);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener unidades' });
  }
}

function parseInput(body: any) {
  const clave = typeof body?.clave === 'string' ? body.clave.trim() : '';
  const descripcion = typeof body?.descripcion === 'string' ? body.descripcion.trim() : '';
  const unidad_sat_id = Number(body?.unidad_sat_id);
  if (!clave || !descripcion || !Number.isInteger(unidad_sat_id) || unidad_sat_id <= 0) throw new Error('Clave, descripción y Unidad SAT son obligatorias.');
  return { clave, descripcion, unidad_sat_id, activo: body?.activo !== false };
}

export async function crearUnidad(req: Request, res: Response) { try { res.status(201).json(await crearUnidadRepository(req.context!.empresaId, parseInput(req.body))); } catch (e: any) { res.status(e?.code === '23505' ? 409 : 400).json({ message: e?.code === '23505' ? 'La clave operativa ya existe para esta empresa.' : e.message }); } }
export async function actualizarUnidad(req: Request, res: Response) { try { const row = await actualizarUnidadRepository(req.context!.empresaId, Number(req.params.id), parseInput(req.body)); if (!row) return res.status(404).json({ message: 'Unidad no encontrada.' }); res.json(row); } catch (e: any) { res.status(e?.code === '23505' ? 409 : 400).json({ message: e?.code === '23505' ? 'La clave operativa ya existe para esta empresa.' : e.message }); } }
export async function eliminarUnidad(req: Request, res: Response) { try { const result = await eliminarUnidadRepository(req.context!.empresaId, Number(req.params.id)); if (result.referenced) return res.status(409).json({ message: `No se puede eliminar: la unidad está referenciada por ${result.referenced} producto(s). Desactívala en su lugar.` }); if (!result.deleted) return res.status(404).json({ message: 'Unidad no encontrada.' }); res.status(204).send(); } catch { res.status(400).json({ message: 'No se pudo eliminar la unidad.' }); } }
