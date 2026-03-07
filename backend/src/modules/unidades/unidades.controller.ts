import { Request, Response } from 'express';
import { getUnidadesRepository } from './unidades.repository';

export async function getUnidades(_req: Request, res: Response) {
  try {
    const unidades = await getUnidadesRepository();
    res.json(unidades);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener unidades' });
  }
}
