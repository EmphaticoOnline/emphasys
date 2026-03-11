import { Request, Response } from 'express';
import { obtenerEsquemaCamposDocumentoRepository } from './documentos-esquema.repository';

export async function obtenerEsquemaCamposDocumento(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId ?? Number(req.query.empresa_id);
    const tipoDocumento = req.query.tipo_documento ? String(req.query.tipo_documento) : undefined;

    if (!empresaId || !Number.isFinite(Number(empresaId))) {
      return res.status(400).json({ message: 'empresa_id es obligatorio y debe ser numérico' });
    }

    const esquema = await obtenerEsquemaCamposDocumentoRepository(Number(empresaId), tipoDocumento);
    res.json(esquema);
  } catch (error) {
    console.error('Error al obtener esquema de campos dinámicos de documentos', error);
    res.status(500).json({ message: 'Error al obtener esquema de campos dinámicos de documentos' });
  }
}
