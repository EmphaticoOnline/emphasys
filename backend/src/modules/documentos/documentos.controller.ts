import { Request, Response } from 'express';
import {
  agregarPartidaRepository,
  crearDocumentoRepository,
  listarDocumentosRepository,
  obtenerDocumentoRepository,
  actualizarDocumentoRepository,
  reemplazarPartidasRepository,
  eliminarDocumentoRepository,
} from './documentos.repository';
import { generarDocumentoPDF } from './documentos.pdf';
import type { TipoDocumento } from '../../types/documentos';

const TIPOS_VALIDOS: TipoDocumento[] = ['cotizacion', 'factura', 'pedido', 'remision'];

const normalizarTipo = (valor: any, fallback: TipoDocumento): TipoDocumento => {
  const t = (valor ?? '').toString().toLowerCase();
  return (TIPOS_VALIDOS as string[]).includes(t) ? (t as TipoDocumento) : fallback;
};

const nombreDocumento: Record<TipoDocumento, string> = {
  cotizacion: 'cotización',
  factura: 'factura',
  pedido: 'pedido',
  remision: 'remisión',
};

const buildListarHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const data = await listarDocumentosRepository(tipo, Number(empresaId));
    res.json(data);
  } catch (error) {
    console.error(`Error al listar ${tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al listar ${tipoPorDefecto}` });
  }
};

const buildObtenerHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const result = await obtenerDocumentoRepository(id, Number(empresaId), tipo);
    if (!result) return res.status(404).json({ message: `${nombreDocumento[tipoPorDefecto]} no encontrada` });
    res.json(result);
  } catch (error) {
    console.error(`Error al obtener ${tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al obtener ${tipoPorDefecto}` });
  }
};

const buildCrearHandler = (tipoPorDefecto: TipoDocumento) => async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const payload = {
      ...(req.body || {}),
      tipo_documento: tipoPorDefecto,
      estatus_documento: 'Borrador',
    };

    const created = await crearDocumentoRepository(payload, Number(empresaId), tipoPorDefecto);
    res.status(201).json(created);
  } catch (error) {
    if ((error as any)?.code === 'DOCUMENTO_DUPLICADO') {
      return res.status(400).json({ message: (error as any)?.message || 'Documento duplicado' });
    }
    console.error(`Error al crear ${tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al crear ${tipoPorDefecto}` });
  }
};

const buildActualizarHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const updated = await actualizarDocumentoRepository(id, req.body || {}, Number(empresaId), tipo);
    if (!updated) return res.status(404).json({ message: `${nombreDocumento[tipoPorDefecto]} no encontrada` });
    res.json(updated);
  } catch (error) {
    console.error(`Error al actualizar ${tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al actualizar ${tipoPorDefecto}` });
  }
};

const buildEliminarHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const deleted = await eliminarDocumentoRepository(id, Number(empresaId), tipo);
    if (!deleted) return res.status(404).json({ message: `${nombreDocumento[tipoPorDefecto]} no encontrada` });
    res.status(204).send();
  } catch (error) {
    console.error(`Error al eliminar ${tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al eliminar ${tipoPorDefecto}` });
  }
};

export const listarCotizaciones = buildListarHandler('cotizacion');
export const obtenerCotizacion = buildObtenerHandler('cotizacion');
export const crearCotizacion = buildCrearHandler('cotizacion');
export const actualizarCotizacion = buildActualizarHandler('cotizacion');
export const eliminarCotizacion = buildEliminarHandler('cotizacion');

export const listarFacturas = buildListarHandler('factura', true);
export const obtenerFactura = buildObtenerHandler('factura', true);
export const crearFactura = buildCrearHandler('factura');
export const actualizarFactura = buildActualizarHandler('factura', true);
export const eliminarFactura = buildEliminarHandler('factura', true);

const buildPdfHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const result = await obtenerDocumentoRepository(id, Number(empresaId), tipo);
    if (!result) return res.status(404).json({ message: 'Documento no encontrado' });

    const pdfBuffer = await generarDocumentoPDF(result);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=documento-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al obtener PDF del documento', error);
    res.status(500).json({ message: 'Error al generar PDF' });
  }
};

export const obtenerCotizacionPDF = buildPdfHandler('cotizacion');
export const obtenerFacturaPDF = buildPdfHandler('factura', true);

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
