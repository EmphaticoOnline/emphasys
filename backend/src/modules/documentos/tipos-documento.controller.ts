import { Request, Response } from 'express';
import { listarTiposDocumento } from './tipos-documento.repository';

export async function obtenerTiposDocumento(req: Request, res: Response) {
  try {
    const tipos = await listarTiposDocumento();
    res.json(tipos);
  } catch (error) {
    console.error('Error al listar tipos de documento:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
