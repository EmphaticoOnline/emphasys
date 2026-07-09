import { Request, Response } from 'express';
import { listarCodigosAgrupadores } from './codigosAgrupadores.repository';

export async function getCodigosAgrupadores(req: Request, res: Response) {
  try {
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar : undefined;
    const codigos = await listarCodigosAgrupadores(buscar);
    return res.json(codigos);
  } catch (error) {
    console.error('Error al obtener códigos agrupadores SAT', error);
    return res.status(500).json({ message: 'No se pudieron obtener los códigos agrupadores SAT' });
  }
}
