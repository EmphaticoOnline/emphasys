import { Request, Response } from 'express';
import { listarTiposDocumento, listarTiposDocumentoEmpresa } from './tipos-documento.repository';

export async function obtenerTiposDocumento(req: Request, res: Response) {
  try {
    const tipos = await listarTiposDocumento();
    res.json(tipos);
  } catch (error) {
    console.error('Error al listar tipos de documento:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function obtenerTiposDocumentoEmpresa(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const modulo = req.query?.modulo ? String(req.query.modulo) : undefined;

    const tipos = await listarTiposDocumentoEmpresa(empresaId, modulo);
    res.json(tipos);
  } catch (error) {
    console.error('Error al obtener tipos de documento de la empresa:', error);
    res.status(500).json({ message: 'Error al obtener tipos de documento de la empresa' });
  }
}
