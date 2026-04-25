import { Request, Response } from 'express';
import {
  listarDocumentosRepository,
  obtenerDocumentoRepository,
  actualizarDocumentoRepository,
  eliminarDocumentoRepository,
} from './documentos.repository';
import { generarDocumentoPDF } from './documentos.pdf';
import type { TipoDocumento } from '../../types/documentos';
import { cfdiService, CfdiValidationError } from '../cfdi/cfdi.service';
import pool from '../../config/database';
import { agregarPartidaService, reemplazarPartidasService } from './documentos-partidas.service';
import { crearDocumentoService } from './documentos.service';
import { calcularImpuestosPreview } from '../impuestos/impuestos-preview.service';

const normalizarTipo = (valor: any, fallback: TipoDocumento): TipoDocumento => {
  const t = (valor ?? fallback) as any;
  return t ? t.toString().toLowerCase() : fallback;
};

const nombreDocumento: Record<TipoDocumento, string> = {
  cotizacion: 'cotización',
  factura: 'factura',
  pedido: 'pedido',
  remision: 'remisión',
  orden_entrega: 'orden de entrega',
  requisicion: 'requisición',
  orden_compra: 'orden de compra',
  recepcion: 'recepción',
  factura_compra: 'factura de compra',
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

  const created = await crearDocumentoService(payload, Number(empresaId), tipoPorDefecto);
    res.status(201).json(created);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
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
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
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
export const calcularImpuestosPreviewHandler = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const {
      producto_id,
      cantidad,
      precio_unitario,
      tratamiento_impuestos,
    } = req.body || {};

    const result = await calcularImpuestosPreview({
      empresaId: Number(empresaId),
      productoId: producto_id != null ? Number(producto_id) : null,
      cantidad: cantidad != null ? Number(cantidad) : null,
      precioUnitario: precio_unitario != null ? Number(precio_unitario) : null,
      tratamientoImpuestos: tratamiento_impuestos ?? 'normal',
    });

    return res.json(result);
  } catch (error) {
    console.error('Error en preview de cálculo de impuestos', error);
    return res.status(500).json({ message: 'Error al calcular impuestos' });
  }
};

const buildPdfHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const result = await obtenerDocumentoRepository(id, Number(empresaId), tipo);
    if (!result) return res.status(404).json({ message: 'Documento no encontrado' });

    // Adjuntar timbre CFDI si existe
    try {
      const { rows } = await pool.query(
        `SELECT uuid, fecha_timbrado, rfc_proveedor_certificacion, no_certificado_sat, sello_cfdi, sello_sat, cadena_original, rfc_emisor, rfc_receptor, total
           FROM documentos_cfdi
          WHERE documento_id = $1
          LIMIT 1`,
        [id]
      );

      const timbre = rows[0];
      if (timbre) {
        result.documento = result.documento || ({} as any);
        (result.documento as any).timbre = {
          uuid: timbre.uuid,
          fecha_timbrado: timbre.fecha_timbrado?.toISOString?.() ?? timbre.fecha_timbrado,
          rfc_proveedor_certificacion: timbre.rfc_proveedor_certificacion,
          no_certificado_sat: timbre.no_certificado_sat,
          sello_cfdi: timbre.sello_cfdi,
          sello_sat: timbre.sello_sat,
          cadena_original: timbre.cadena_original,
          rfc_emisor: timbre.rfc_emisor,
          rfc_receptor: timbre.rfc_receptor,
          total: timbre.total,
        };
        // Marcar estatus como Timbrado para el PDF
        (result.documento as any).estatus_documento = 'Timbrado';
      }
    } catch (err) {
      console.error('Error al consultar timbre CFDI para PDF', err);
    }

  const pdfBuffer = await generarDocumentoPDF(result, empresaId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=documento-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al obtener PDF del documento', {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    res.status(500).json({ message: 'Error al generar PDF' });
  }
};

export const obtenerCotizacionPDF = buildPdfHandler('cotizacion');
export const obtenerFacturaPDF = buildPdfHandler('factura', true);

const permiteArchivoImagen = (req: Request) => (req.baseUrl || '').toLowerCase().includes('/documentos');

const limpiarArchivoImagenPartida = (partida: any, permitir: boolean) => {
  if (permitir || !partida || typeof partida !== 'object') return partida;
  const { archivo_imagen_1, ...rest } = partida as Record<string, any>;
  return rest;
};

export async function enviarFacturaPorCorreo(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);

    if (Number.isNaN(documentoId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

  // Import dinámico para no acoplar el controlador a la implementación
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { FacturaEmailService } = await import('../../services/factura-email.service');

  await FacturaEmailService.enviarFactura(documentoId);

    return res.json({ success: true, message: 'Factura enviada correctamente' });
  } catch (error) {
    const message = (error as Error)?.message ?? 'Error al enviar la factura';
    return res.status(400).json({ error: message });
  }
}

export async function obtenerFacturaXML(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ message: 'ID o empresaId inválido' });
    }

    const { rows } = await pool.query(
      `SELECT dc.xml_timbrado
         FROM documentos_cfdi dc
         JOIN documentos d ON d.id = dc.documento_id
        WHERE dc.documento_id = $1
          AND d.empresa_id = $2
        LIMIT 1`,
      [documentoId, Number(empresaId)]
    );

    const row = rows[0];
    if (!row || !row.xml_timbrado) {
      return res.status(404).json({ message: 'XML timbrado no encontrado' });
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${documentoId}.xml`);
    res.send(row.xml_timbrado);
  } catch (error) {
    console.error('Error al obtener XML timbrado', error);
    res.status(500).json({ message: 'Error al obtener XML timbrado' });
  }
}

export async function agregarPartida(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(documentoId) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

  const partidaPayload = limpiarArchivoImagenPartida(req.body || {}, permiteArchivoImagen(req));
  const partida = await agregarPartidaService(documentoId, partidaPayload, Number(empresaId));
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

  const permiteImagen = permiteArchivoImagen(req);
  const partidas = Array.isArray(req.body?.partidas) ? req.body.partidas.map((p: any) => limpiarArchivoImagenPartida(p, permiteImagen)) : [];
  const inserted = await reemplazarPartidasService(documentoId, partidas, Number(empresaId));
    if (!inserted) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json(inserted);
  } catch (error) {
    console.error('Error al reemplazar partidas', error);
    res.status(500).json({ message: 'Error al reemplazar partidas' });
  }
}

export async function timbrarFacturaCfdi(req: Request, res: Response) {
  const documentoId = Number(req.params.id);
  const empresaId = req.context?.empresaId;
  if (Number.isNaN(documentoId) || !empresaId) {
    return res.status(400).json({ message: 'ID o empresaId inválido' });
  }

  try {
    const resultado = await cfdiService.timbrarFactura(documentoId, Number(empresaId));
    res.json(resultado);
  } catch (error) {
    if (error instanceof CfdiValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error al timbrar factura', error);
    res.status(500).json({ message: 'Error al timbrar la factura' });
  }
}
