import { Request, Response } from 'express';
import {
  agregarPartidaRepository,
  crearCotizacionRepository,
  listarCotizacionesRepository,
  obtenerCotizacionRepository,
  actualizarCotizacionRepository,
  reemplazarPartidasRepository,
  eliminarCotizacionRepository,
} from './documentos.repository';
import { generarDocumentoPDF } from './documentos.pdf';

export async function listarCotizaciones(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const tipo = req.query.tipo_documento?.toString() || 'Cotizacion';
    const data = await listarCotizacionesRepository(tipo, Number(empresaId));
    res.json(data);
  } catch (error) {
    console.error('Error al listar cotizaciones', error);
    res.status(500).json({ message: 'Error al listar cotizaciones' });
  }
}

export async function obtenerCotizacion(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const result = await obtenerCotizacionRepository(id, Number(empresaId));
    if (!result) return res.status(404).json({ message: 'Cotización no encontrada' });
    res.json(result);
  } catch (error) {
    console.error('Error al obtener cotización', error);
    res.status(500).json({ message: 'Error al obtener cotización' });
  }
}

export async function crearCotizacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const body = req.body || {};

    const payload = {
      ...body,
      tipo_documento: 'Cotizacion',
      estatus_documento: 'Borrador',
    };

    const created = await crearCotizacionRepository(payload, Number(empresaId));
    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear cotización', error);
    res.status(500).json({ message: 'Error al crear cotización' });
  }
}

export async function actualizarCotizacion(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const updated = await actualizarCotizacionRepository(id, req.body || {}, Number(empresaId));
    if (!updated) return res.status(404).json({ message: 'Cotización no encontrada' });
    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar cotización', error);
    res.status(500).json({ message: 'Error al actualizar cotización' });
  }
}

export async function agregarPartida(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(documentoId) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const partida = await agregarPartidaRepository(documentoId, req.body || {}, Number(empresaId));
    if (!partida) return res.status(404).json({ message: 'Documento no encontrado' });
    res.status(201).json(partida);
  } catch (error) {
    console.error('Error al agregar partida', error);
    res.status(500).json({ message: 'Error al agregar partida' });
  }
}

export async function reemplazarPartidas(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(documentoId) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const partidas = Array.isArray(req.body?.partidas) ? req.body.partidas : [];
    const inserted = await reemplazarPartidasRepository(documentoId, partidas, Number(empresaId));
    if (!inserted) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json(inserted);
  } catch (error) {
    console.error('Error al reemplazar partidas', error);
    res.status(500).json({ message: 'Error al reemplazar partidas' });
  }
}

export async function eliminarCotizacion(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const deleted = await eliminarCotizacionRepository(id, Number(empresaId));
    if (!deleted) return res.status(404).json({ message: 'Cotización no encontrada' });
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar cotización', error);
    res.status(500).json({ message: 'Error al eliminar cotización' });
  }
}

export async function obtenerDocumentoPDF(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const result = await obtenerCotizacionRepository(id, Number(empresaId));
    if (!result) return res.status(404).json({ message: 'Documento no encontrado' });

    const pdfBuffer = await generarDocumentoPDF(result);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=documento-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al obtener PDF del documento', error);
    res.status(500).json({ message: 'Error al generar PDF' });
  }
}
