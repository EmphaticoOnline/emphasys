import { Request, Response } from 'express';
import { listarEntidadesTipos } from './entidades-tipos.repository';

export async function obtenerEntidadesTipos(_req: Request, res: Response) {
  try {
    const data = await listarEntidadesTipos();
    res.json(data);
  } catch (error) {
    console.error('Error al listar entidades_tipos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
