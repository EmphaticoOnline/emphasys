import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { generarExcelBuffer } from '../../utils/exportar';
import type { ExportColumna } from '../../utils/exportar';
import {
  listarDocumentosRepository,
  listarDocumentosRepositoryPaginado,
  obtenerDocumentoRepository,
  actualizarDocumentoRepository,
  eliminarDocumentoRepository,
} from './documentos.repository';
import { generarDocumentoPDF } from './documentos.pdf';
import type { TipoDocumento } from '../../types/documentos';
import { cfdiService, CfdiValidationError } from '../cfdi/cfdi.service';
import pool from '../../config/database';
import { agregarPartidaService, reemplazarPartidasService } from './documentos-partidas.service';
import { actualizarCotizacionService, actualizarDocumentoService, crearDocumentoService, duplicarCotizacionService, duplicarDocumentosMasivoService } from './documentos.service';
import { calcularImpuestosPreview } from '../impuestos/impuestos-preview.service';
import { DocumentoDeleteValidationError, eliminarCotizacionConValidacion, puedeEliminarCotizacion } from './documentos-delete.service';
import { cancelarDocumentoService, DocumentoCancelValidationError } from './documentos-cancel.service';
import { formatearFolioDocumento } from '../../utils/documentos';
import { obtenerJwtSecret } from '../auth/auth.service';
import { sendTemplateDocumentMessage } from '../../whatsapp/whatsapp.service';
import { resolverTipoPlantillaWhatsapp, type WhatsappTemplateType } from '../../whatsapp/whatsapp-template-type.service';

const normalizarTipo = (valor: any, fallback: TipoDocumento): TipoDocumento => {
  const t = (valor ?? fallback) as any;
  return t ? t.toString().toLowerCase() : fallback;
};

const resolverTipoDocumentoRequest = (req: Request, fallback: TipoDocumento): TipoDocumento =>
  normalizarTipo(req.query.tipo_documento ?? req.body?.tipo_documento, fallback);

const TIPOS_DOCUMENTO_MONETARIOS = new Set<TipoDocumento>(['pago_cliente', 'pago_proveedor']);

function sanitizarNombreDescarga(nombre: string): string {
  const limpio = (nombre || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
  return limpio || 'documento';
}

function construirNombrePdf(documento: any, fallbackId: number): string {
  const numero = Number(documento?.numero);
  const folio = Number.isFinite(numero)
    ? formatearFolioDocumento(documento?.serie ?? '', numero)
    : `documento-${fallbackId}`;

  return `${sanitizarNombreDescarga(folio)}.pdf`;
}

const nombreDocumento: Record<TipoDocumento, string> = {
  cotizacion: 'cotización',
  factura: 'factura',
  nota_credito: 'nota de crédito',
  pago_cliente: 'pago cliente',
  orden_servicio: 'orden de servicio',
  pedido: 'pedido',
  remision: 'remisión',
  orden_entrega: 'orden de entrega',
  requisicion: 'requisición',
  orden_compra: 'orden de compra',
  recepcion: 'recepción',
  nota_credito_compra: 'nota de crédito de compra',
  pago_proveedor: 'pago proveedor',
  factura_compra: 'factura de compra',
};

const TIPOS_DOCUMENTO_ENVIO = new Set<TipoDocumento>(['cotizacion', 'orden_servicio']);
const CARPETAS_PUBLICAS_POR_TIPO: Partial<Record<TipoDocumento, string>> = {
  cotizacion: 'cotizaciones',
  orden_servicio: 'ordenes-servicio',
};

const esTipoDocumentoEnviable = (value: TipoDocumento): value is 'cotizacion' | 'orden_servicio' =>
  TIPOS_DOCUMENTO_ENVIO.has(value);

type RecursoFacturaPublico = 'pdf' | 'xml';

type FacturaPublicLinkTokenPayload = {
  documentoId: number;
  empresaId: number;
  recurso: RecursoFacturaPublico;
  tipo_documento: 'factura';
  exp: number;
};

const WHATSAPP_PUBLIC_LINK_EXPIRES_IN_SECONDS = (() => {
  const parsed = Number(process.env.WHATSAPP_PUBLIC_LINK_EXPIRES_IN_SECONDS ?? 600);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 600;
})();

function buildHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function construirNombreXml(documento: any, fallbackId: number): string {
  const numero = Number(documento?.numero);
  const folio = Number.isFinite(numero)
    ? formatearFolioDocumento(documento?.serie ?? '', numero)
    : `factura-${fallbackId}`;

  return `${sanitizarNombreDescarga(folio)}.xml`;
}

function resolverBaseUrlPublica(req: Request): string {
  const envBaseUrl = process.env.APP_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host')?.trim();
  const protocol = forwardedProto || req.protocol || 'http';

  if (host) {
    return `${protocol}://${host}`.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001';
  }

  throw buildHttpError(500, 'APP_BASE_URL no configurada');
}

function firmarTokenPublicoFactura(
  payload: Omit<FacturaPublicLinkTokenPayload, 'exp'>,
  exp: number
): string {
  return jwt.sign({ ...payload, exp }, obtenerJwtSecret());
}
async function assertFacturaTimbrada(documentoId: number, empresaId: number): Promise<void> {
  const { rows } = await pool.query<{ estatus_documento: string | null }>(
    `SELECT estatus_documento
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
        AND LOWER(COALESCE(tipo_documento, '')) = 'factura'
      LIMIT 1`,
    [documentoId, empresaId]
  );

  const estatus = rows[0]?.estatus_documento?.trim().toLowerCase() ?? null;
  if (estatus !== 'timbrado') {
    throw buildHttpError(400, 'La factura no está timbrada');
  }
}

function validarTokenPublicoFactura(
  token: string,
  documentoId: number,
  recurso: RecursoFacturaPublico
): FacturaPublicLinkTokenPayload {
  const decoded = jwt.verify(token, obtenerJwtSecret()) as jwt.JwtPayload & FacturaPublicLinkTokenPayload;

  if (!decoded || typeof decoded !== 'object') {
    throw buildHttpError(401, 'Token inválido');
  }

  if (decoded.tipo_documento !== 'factura') {
    throw buildHttpError(403, 'Token no autorizado para este tipo de documento');
  }

  if (Number(decoded.documentoId) !== documentoId || decoded.recurso !== recurso) {
    throw buildHttpError(403, 'Token no coincide con el recurso solicitado');
  }

  if (!Number.isFinite(Number(decoded.empresaId)) || Number(decoded.empresaId) <= 0) {
    throw buildHttpError(403, 'Token sin empresa válida');
  }

  return {
    documentoId: Number(decoded.documentoId),
    empresaId: Number(decoded.empresaId),
    recurso: decoded.recurso,
    tipo_documento: 'factura',
    exp: Number(decoded.exp),
  };
}

async function obtenerDocumentoPdfData(documentoId: number, empresaId: number, tipo: TipoDocumento) {
  const result = await obtenerDocumentoRepository(documentoId, empresaId, tipo);
  if (!result) {
    throw buildHttpError(404, 'Documento no encontrado');
  }

  try {
    const { rows } = await pool.query(
      `SELECT uuid, fecha_timbrado, rfc_proveedor_certificacion, no_certificado_sat, sello_cfdi, sello_sat, cadena_original, rfc_emisor, rfc_receptor, total
         FROM documentos_cfdi
        WHERE documento_id = $1
        LIMIT 1`,
      [documentoId]
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
      (result.documento as any).estatus_documento = 'Timbrado';
    }
  } catch (err) {
    console.error('Error al consultar timbre CFDI para PDF', err);
  }

  const pdfBuffer = await generarDocumentoPDF(result, empresaId);
  const filename = construirNombrePdf(result.documento, documentoId);

  return {
    buffer: pdfBuffer,
    filename,
    documento: result.documento,
  };
}

async function obtenerFacturaXmlData(documentoId: number, empresaId: number) {
  const { rows } = await pool.query(
    `SELECT dc.xml_timbrado, d.serie, d.numero
       FROM documentos_cfdi dc
       JOIN documentos d ON d.id = dc.documento_id
      WHERE dc.documento_id = $1
        AND d.empresa_id = $2
      LIMIT 1`,
    [documentoId, empresaId]
  );

  const row = rows[0];
  if (!row || !row.xml_timbrado) {
    throw buildHttpError(404, 'XML timbrado no encontrado');
  }

  return {
    xml: String(row.xml_timbrado),
    filename: construirNombreXml({ serie: row.serie, numero: row.numero }, documentoId),
  };
}

async function generarFacturaPublicLinks(req: Request, documentoId: number, empresaId: number, incluirXml = true) {
  const result = await obtenerDocumentoRepository(documentoId, empresaId, 'factura');
  if (!result) {
    throw buildHttpError(404, 'Factura no encontrada');
  }

  const { buffer: pdfBuffer, filename: pdfFilename } = await obtenerDocumentoPdfData(documentoId, empresaId, 'factura');

  const uploadsDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), 'uploads');
  const facturaUploadsDir = path.join(uploadsDir, 'facturas', String(documentoId));

  await fs.mkdir(facturaUploadsDir, { recursive: true });
  await fs.writeFile(path.join(facturaUploadsDir, pdfFilename), pdfBuffer);

  let xmlFilename: string | null = null;
  if (incluirXml) {
    const { xml, filename } = await obtenerFacturaXmlData(documentoId, empresaId);
    xmlFilename = filename;
    await fs.writeFile(path.join(facturaUploadsDir, xmlFilename), xml, 'utf8');
  }

  const baseUrl = resolverBaseUrlPublica(req);

  const links = {
    pdfUrl: `${baseUrl}/uploads/facturas/${documentoId}/${pdfFilename}`,
    xmlUrl: xmlFilename ? `${baseUrl}/uploads/facturas/${documentoId}/${xmlFilename}` : null,
    pdfFilename,
    xmlFilename,
    expiresAt: null,
  };

  console.info('[CFDI WhatsApp] URLs temporales generadas', {
    documentoId,
    empresaId,
    expiresAt: links.expiresAt,
    pdfUrl: links.pdfUrl,
    xmlUrl: links.xmlUrl,
  });

  return links;
}

async function generarDocumentoPublicLinks(req: Request, documentoId: number, empresaId: number, tipoDocumento: TipoDocumento) {
  const carpetaPublica = CARPETAS_PUBLICAS_POR_TIPO[tipoDocumento] ?? tipoDocumento;
  const result = await obtenerDocumentoRepository(documentoId, empresaId, tipoDocumento);
  if (!result) {
    throw buildHttpError(404, `${nombreDocumento[tipoDocumento] ?? tipoDocumento} no encontrado`);
  }

  const { buffer: pdfBuffer, filename: pdfFilename } = await obtenerDocumentoPdfData(documentoId, empresaId, tipoDocumento);

  const uploadsDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), 'uploads');
  const documentoUploadsDir = path.join(uploadsDir, carpetaPublica, String(documentoId));

  await fs.mkdir(documentoUploadsDir, { recursive: true });
  await fs.writeFile(path.join(documentoUploadsDir, pdfFilename), pdfBuffer);

  const baseUrl = resolverBaseUrlPublica(req);
  return {
    pdfUrl: `${baseUrl}/uploads/${carpetaPublica}/${documentoId}/${pdfFilename}`,
    pdfFilename,
    expiresAt: null,
  };
}

const buildListarHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const search = typeof req.query.search === 'string' ? req.query.search : null;

    const pageRaw = req.query.page;
    const limitRaw = req.query.limit;
    const page = typeof pageRaw === 'string' ? Number(pageRaw) : undefined;
    const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;

    if (Number.isFinite(page) && Number.isFinite(limit) && page && page >= 1 && limit && limit >= 1 && limit <= 100) {
      const quickFilter = typeof req.query.quick_filter === 'string' ? req.query.quick_filter.trim() : undefined;
      const soloPendientes = req.query.solo_pendientes === 'true';
      const clienteIdRaw = typeof req.query.cliente_id === 'string' ? Number(req.query.cliente_id) : null;
      const agenteIdRaw = typeof req.query.agente_id === 'string' ? Number(req.query.agente_id) : null;
      const fechaDesde = typeof req.query.fecha_desde === 'string' ? req.query.fecha_desde : null;
      const fechaHasta = typeof req.query.fecha_hasta === 'string' ? req.query.fecha_hasta : null;
      const montoMinRaw = typeof req.query.monto_min === 'string' ? Number(req.query.monto_min) : null;
      const montoMaxRaw = typeof req.query.monto_max === 'string' ? Number(req.query.monto_max) : null;

      const result = await listarDocumentosRepositoryPaginado(
        tipo,
        Number(empresaId),
        { page, limit },
        search,
        {
          soloPendientes,
          quickFilter: quickFilter && quickFilter !== 'todos' ? quickFilter : undefined,
          clienteId: clienteIdRaw && !isNaN(clienteIdRaw) ? clienteIdRaw : null,
          agenteId: agenteIdRaw && !isNaN(agenteIdRaw) ? agenteIdRaw : null,
          fechaDesde,
          fechaHasta,
          montoMin: montoMinRaw !== null && !isNaN(montoMinRaw) ? montoMinRaw : null,
          montoMax: montoMaxRaw !== null && !isNaN(montoMaxRaw) ? montoMaxRaw : null,
        }
      );
      return res.json({ data: result.data, total: result.total, page, limit });
    }

    const data = await listarDocumentosRepository(tipo, Number(empresaId), search);
    res.json(data);
  } catch (error) {
    console.error(`Error al listar ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al listar ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}` });
  }
};

const buildObtenerHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const result = await obtenerDocumentoRepository(id, Number(empresaId), tipo);
    if (!result) return res.status(404).json({ message: `${nombreDocumento[tipo] ?? tipo} no encontrada` });
    res.json(result);
  } catch (error) {
    console.error(`Error al obtener ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al obtener ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}` });
  }
};

const buildCrearHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const tipo = forzarTipo ? tipoPorDefecto : resolverTipoDocumentoRequest(req, tipoPorDefecto);

    const payload = {
      ...(req.body || {}),
      tipo_documento: tipo,
      estatus_documento: 'Borrador',
      usuario_creacion_id: req.body?.usuario_creacion_id ?? req.auth?.userId ?? null,
    };

    const created = await crearDocumentoService(payload, Number(empresaId), tipo);
    res.status(201).json(created);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
    if ((error as any)?.code === 'DOCUMENTO_DUPLICADO') {
      return res.status(400).json({ message: (error as any)?.message || 'Documento duplicado' });
    }
    console.error(`Error al crear ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al crear ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}` });
  }
};

const buildActualizarHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : resolverTipoDocumentoRequest(req, tipoPorDefecto);
    const updated = TIPOS_DOCUMENTO_MONETARIOS.has(tipo)
      ? await actualizarDocumentoService(id, req.body || {}, Number(empresaId), tipo)
      : await actualizarDocumentoRepository(id, req.body || {}, Number(empresaId), tipo);
    if (!updated) return res.status(404).json({ message: `${nombreDocumento[tipo] ?? tipo} no encontrada` });
    res.json(updated);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
    console.error(`Error al actualizar ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al actualizar ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}` });
  }
};

const buildEliminarHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : resolverTipoDocumentoRequest(req, tipoPorDefecto);
    const deleted = await eliminarDocumentoRepository(id, Number(empresaId), tipo);
    if (!deleted) return res.status(404).json({ message: `${nombreDocumento[tipo] ?? tipo} no encontrada` });
    res.status(204).send();
  } catch (error) {
    console.error(`Error al eliminar ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}`, error);
    res.status(500).json({ message: `Error al eliminar ${nombreDocumento[tipoPorDefecto] ?? tipoPorDefecto}` });
  }
};

export const listarCotizaciones = buildListarHandler('cotizacion');
export const obtenerCotizacion = buildObtenerHandler('cotizacion');
export const crearCotizacion = buildCrearHandler('cotizacion');
export const validarEliminacionCotizacion = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = resolverTipoDocumentoRequest(req, 'cotizacion');

    if (tipo !== 'cotizacion') {
      const documento = await obtenerDocumentoRepository(id, Number(empresaId), tipo);
      if (!documento) {
        return res.status(404).json({ message: `${nombreDocumento[tipo] ?? tipo} no encontrada` });
      }

      return res.json({
        exists: true,
        canDelete: true,
        message: null,
      });
    }

    const result = await puedeEliminarCotizacion(id, Number(empresaId));
    if (!result.exists) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    return res.json({
      exists: result.exists,
      canDelete: result.canDelete,
      message: result.canDelete ? null : 'No se puede eliminar la cotización porque ya generó documentos posteriores.',
    });
  } catch (error) {
    console.error('Error al validar eliminación de cotización', error);
    return res.status(500).json({ message: 'Error al validar la eliminación de la cotización' });
  }
};

export const actualizarCotizacion = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = resolverTipoDocumentoRequest(req, 'cotizacion');
    const body = req.body || {};
    const requiereReconciliarOportunidad = tipo === 'cotizacion' && Object.prototype.hasOwnProperty.call(body, 'contacto_principal_id');

    const updated = requiereReconciliarOportunidad
      ? await actualizarCotizacionService(id, body, Number(empresaId))
      : await actualizarDocumentoRepository(id, body, Number(empresaId), tipo);

    if (!updated) return res.status(404).json({ message: `${nombreDocumento[tipo] ?? tipo} no encontrada` });
    return res.json(updated);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
    console.error('Error al actualizar cotización', error);
    return res.status(500).json({ message: 'Error al actualizar cotización' });
  }
};
export const eliminarCotizacion = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ error: 'ID o empresaId inválido' });

    const tipo = resolverTipoDocumentoRequest(req, 'cotizacion');

    if (tipo !== 'cotizacion') {
      const deleted = await eliminarDocumentoRepository(id, Number(empresaId), tipo);
      if (!deleted) return res.status(404).json({ error: `${nombreDocumento[tipo] ?? tipo} no encontrada` });
      return res.status(204).send();
    }

    const deleted = await eliminarCotizacionConValidacion(id, Number(empresaId));
    if (!deleted) return res.status(404).json({ error: 'Cotización no encontrada' });
    return res.status(204).send();
  } catch (error) {
    if (error instanceof DocumentoDeleteValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al eliminar cotización', error);
    return res.status(500).json({ error: 'Error al eliminar la cotización' });
  }
};

export const duplicarCotizacion = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ error: 'ID o empresaId inválido' });

    const duplicated = await duplicarCotizacionService(id, Number(empresaId));
    if (!duplicated) return res.status(404).json({ error: 'Cotización no encontrada' });
    return res.status(201).json(duplicated);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }

    console.error('Error al duplicar cotización', error);
    return res.status(500).json({ error: 'Error al duplicar la cotización' });
  }
};

export const duplicarDocumentosMasivo = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    const tipo = resolverTipoDocumentoRequest(req, 'cotizacion');
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0)
      : [];

    if (!empresaId || ids.length === 0) {
      return res.status(400).json({ error: 'IDs o empresaId inválidos' });
    }

    const duplicated = await duplicarDocumentosMasivoService(ids, Number(empresaId), tipo);
    return res.status(201).json(duplicated);
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
    if (message.startsWith('DOCUMENT_NOT_FOUND:')) {
      return res.status(404).json({ error: 'Una de las cotizaciones no fue encontrada' });
    }

    console.error('Error al duplicar documentos', error);
    return res.status(500).json({ error: 'Error al duplicar los documentos' });
  }
};

export const listarFacturas = buildListarHandler('factura', true);
export const obtenerFactura = buildObtenerHandler('factura', true);
export const crearFactura = buildCrearHandler('factura', true);
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
      descuento,
      descuento_global,
      tratamiento_impuestos,
    } = req.body || {};

    const result = await calcularImpuestosPreview({
      empresaId: Number(empresaId),
      productoId: producto_id != null ? Number(producto_id) : null,
      cantidad: cantidad != null ? Number(cantidad) : null,
      precioUnitario: precio_unitario != null ? Number(precio_unitario) : null,
      descuento: descuento != null ? Number(descuento) : null,
      descuentoGlobal: descuento_global != null ? Number(descuento_global) : null,
      tratamientoImpuestos: tratamiento_impuestos ?? 'normal',
    });

    return res.json(result);
  } catch (error) {
    console.error('Error en preview de cálculo de impuestos', error);
    return res.status(500).json({ message: 'Error al calcular impuestos' });
  }
};

export async function exportarDocumentos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const { filters = {}, columns } = req.body as {
      filters: Record<string, any>;
      columns: ExportColumna[];
    };

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ message: 'columns es obligatorio' });
    }

    const exportColumns = columns
      .filter((c) => c && typeof c.field === 'string' && typeof c.headerName === 'string')
      .slice(0, 50);

    if (exportColumns.length === 0) {
      return res.status(400).json({ message: 'No hay columnas válidas para exportar' });
    }

    const tipo = normalizarTipo(filters.tipo_documento, 'cotizacion');
    const search = typeof filters.search === 'string' ? filters.search : null;

    let filas: Record<string, any>[] = await listarDocumentosRepository(tipo, Number(empresaId), search);

    if (filters.soloPendientes === true) {
      filas = filas.filter((row) => Number(row['saldo'] ?? 0) > 0);
    }

    const quickFilter = typeof filters.quickFilter === 'string' ? filters.quickFilter.trim().toLowerCase() : 'todos';
    if (quickFilter && quickFilter !== 'todos') {
      const statusField = tipo === 'cotizacion' ? 'estado_seguimiento' : 'estatus_documento';
      filas = filas.filter((row) => {
        const raw = String(row[statusField] ?? '').trim().toLowerCase();
        const normalized = statusField === 'estatus_documento' && raw === 'enviado' ? 'emitido' : raw;
        return normalized === quickFilter;
      });
    }

    if (filters.clienteId) {
      const clienteId = Number(filters.clienteId);
      filas = filas.filter((row) => Number(row['contacto_principal_id']) === clienteId);
    }

    if (filters.agenteId) {
      const agenteId = Number(filters.agenteId);
      filas = filas.filter((row) => Number(row['agente_id'] ?? 0) === agenteId);
    }

    if (filters.fechaDesde) {
      const desde = new Date(String(filters.fechaDesde));
      desde.setHours(0, 0, 0, 0);
      filas = filas.filter((row) => new Date(row['fecha_documento']) >= desde);
    }

    if (filters.fechaHasta) {
      const hasta = new Date(String(filters.fechaHasta));
      hasta.setHours(23, 59, 59, 999);
      filas = filas.filter((row) => new Date(row['fecha_documento']) <= hasta);
    }

    const montoMin = filters.montoMin !== '' && filters.montoMin != null ? Number(filters.montoMin) : null;
    const montoMax = filters.montoMax !== '' && filters.montoMax != null ? Number(filters.montoMax) : null;

    if (montoMin !== null && !Number.isNaN(montoMin)) {
      filas = filas.filter((row) => Number(row['total'] ?? 0) >= montoMin);
    }

    if (montoMax !== null && !Number.isNaN(montoMax)) {
      filas = filas.filter((row) => Number(row['total'] ?? 0) <= montoMax);
    }

    filas = filas.map((row) => ({
      ...row,
      folio: formatearFolioDocumento(String(row['serie'] ?? ''), Number(row['numero'] ?? 0)) || String(row['id']),
    }));

    const buffer = generarExcelBuffer(filas, exportColumns, 'Documentos');
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="documentos-${fecha}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar documentos:', error);
    res.status(500).json({ message: 'Error al exportar documentos' });
  }
}

const buildPdfHandler = (tipoPorDefecto: TipoDocumento, forzarTipo = false) => async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(id) || !empresaId) return res.status(400).json({ message: 'ID o empresaId inválido' });

    const tipo = forzarTipo ? tipoPorDefecto : normalizarTipo(req.query.tipo_documento, tipoPorDefecto);
    const { buffer, filename } = await obtenerDocumentoPdfData(id, Number(empresaId), tipo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ message: (error as Error).message });
    }
    console.error('Error al obtener PDF del documento', {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    res.status(500).json({ message: 'Error al generar PDF' });
  }
};

export const obtenerCotizacionPDF = buildPdfHandler('cotizacion');
export const obtenerFacturaPDF = buildPdfHandler('factura', true);

const permiteArchivoImagen = (_req: Request) => true;

const limpiarArchivoImagenPartida = (partida: any, permitir: boolean) => {
  if (permitir || !partida || typeof partida !== 'object') return partida;
  const { archivo_imagen_1, ...rest } = partida as Record<string, any>;
  return rest;
};

export async function enviarFacturaPorCorreo(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const emailDestino = String(req.body?.email ?? '').trim() || undefined;

    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ error: 'ID o empresaId inválido' });
    }

    await assertFacturaTimbrada(documentoId, Number(empresaId));

  // Import dinámico para no acoplar el controlador a la implementación
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { FacturaEmailService } = await import('../../services/factura-email.service');

  await FacturaEmailService.enviarFactura({
    documentoId,
    usuarioId: req.auth?.userId ?? null,
    emailDestino,
  });

    return res.json({ success: true, message: 'Factura enviada correctamente' });
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ error: (error as Error).message });
    }
    const message = (error as Error)?.message ?? 'Error al enviar la factura';
    return res.status(400).json({ error: message });
  }
}

export async function enviarCotizacionPorCorreo(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const tipoDocumento = resolverTipoDocumentoRequest(req, 'cotizacion');

    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ message: 'ID o empresaId inválido' });
    }

    if (!esTipoDocumentoEnviable(tipoDocumento)) {
      return res.status(400).json({ message: 'Tipo de documento no soportado para envío por correo' });
    }

    const to = String(req.body?.to ?? '').trim();
    const subject = String(req.body?.subject ?? '').trim();
    const message = String(req.body?.message ?? '').trim();

    if (!to) {
      return res.status(400).json({ message: 'El correo destino es obligatorio' });
    }

    const { CotizacionEmailService } = await import('../../services/cotizacion-email.service');
    const result = await CotizacionEmailService.enviarDocumento({
      documentoId,
      empresaId: Number(empresaId),
      usuarioId: req.auth?.userId ?? null,
      to,
      subject,
      message,
      tipoDocumento,
    });

    return res.json(result);
  } catch (error) {
    const message = (error as Error)?.message ?? 'Error al enviar el documento';
    const status = message.includes('obligatorio') || message.includes('no encontrada') || message.includes('No hay configuración SMTP')
      ? 400
      : 502;
    return res.status(status).json({ message });
  }
}

export async function obtenerFacturaXML(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ message: 'ID o empresaId inválido' });
    }

    const { xml, filename } = await obtenerFacturaXmlData(documentoId, Number(empresaId));

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(xml);
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ message: (error as Error).message });
    }
    console.error('Error al obtener XML timbrado', error);
    res.status(500).json({ message: 'Error al obtener XML timbrado' });
  }
}

export async function obtenerFacturaPublicLinks(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;

    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ message: 'ID o empresaId inválido' });
    }

    const links = await generarFacturaPublicLinks(req, documentoId, Number(empresaId));
    return res.status(200).json({
      documentoId,
      pdfUrl: links.pdfUrl,
      xmlUrl: links.xmlUrl,
      expiresAt: links.expiresAt,
    });
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ message: (error as Error).message });
    }
    console.error('[CFDI WhatsApp] Error generando URLs públicas', error);
    return res.status(500).json({ message: 'No se pudieron generar las URLs temporales' });
  }
}

export async function obtenerFacturaPDFPublico(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const token = String(req.query.token ?? '').trim();

    if (Number.isNaN(documentoId) || !token) {
      return res.status(400).json({ message: 'Solicitud inválida' });
    }

    const tokenPayload = validarTokenPublicoFactura(token, documentoId, 'pdf');
    console.info('[CFDI WhatsApp] Token público validado', {
      documentoId,
      empresaId: tokenPayload.empresaId,
      recurso: 'pdf',
      exp: tokenPayload.exp,
    });

    const { buffer, filename } = await obtenerDocumentoPdfData(documentoId, tokenPayload.empresaId, 'factura');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(buffer);
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ message: (error as Error).message });
    }
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
    console.error('[CFDI WhatsApp] Error sirviendo PDF público', error);
    return res.status(500).json({ message: 'No se pudo servir el PDF público' });
  }
}

export async function obtenerFacturaXMLPublico(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const token = String(req.query.token ?? '').trim();

    if (Number.isNaN(documentoId) || !token) {
      return res.status(400).json({ message: 'Solicitud inválida' });
    }

    const tokenPayload = validarTokenPublicoFactura(token, documentoId, 'xml');
    console.info('[CFDI WhatsApp] Token público validado', {
      documentoId,
      empresaId: tokenPayload.empresaId,
      recurso: 'xml',
      exp: tokenPayload.exp,
    });

    const { xml, filename } = await obtenerFacturaXmlData(documentoId, tokenPayload.empresaId);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(xml);
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ message: (error as Error).message });
    }
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
    console.error('[CFDI WhatsApp] Error sirviendo XML público', error);
    return res.status(500).json({ message: 'No se pudo servir el XML público' });
  }
}

export async function enviarFacturaPorWhatsappCfdi(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const telefono = String(req.body?.telefono ?? '').trim();

    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ message: 'ID o empresaId inválido' });
    }

    if (!telefono) {
      return res.status(400).json({ message: 'telefono es requerido' });
    }

    await assertFacturaTimbrada(documentoId, Number(empresaId));

    const factura = await obtenerDocumentoRepository(documentoId, Number(empresaId), 'factura');
    if (!factura) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    const facturaDocumento = factura.documento as any;
    const tratamiento = String(facturaDocumento?.tratamiento_impuestos ?? '').trim().toLowerCase();
    const tipoPlantilla: WhatsappTemplateType = tratamiento === 'sin_iva' ? 'envio_nota_venta' : 'envio_cfdi';
    const nombreCliente = String(facturaDocumento?.nombre_receptor ?? facturaDocumento?.cliente_nombre ?? 'Cliente').trim() || 'Cliente';
    const folioFactura = formatearFolioDocumento(facturaDocumento?.serie ?? '', Number(facturaDocumento?.numero ?? 0)) || String(documentoId);
    const links = await generarFacturaPublicLinks(req, documentoId, Number(empresaId), true);
    const templateParams = [nombreCliente, folioFactura, links.xmlUrl ?? ''];

    console.info('[CFDI WhatsApp] Inicio de envio automatico', {
      documentoId,
      empresaId,
      telefono,
      tipoPlantilla,
    });

    console.info('[CFDI WhatsApp] Envio template a Gupshup', {
      documentoId,
      empresaId,
      telefono,
      tipoPlantilla,
      templateParams,
      xmlUrl: links.xmlUrl,
      nota: 'Se considera exito cuando sendTemplateDocumentMessage resuelve sin lanzar error',
    });

    console.info('[CFDI WhatsApp] Enviando template+PDF por Gupshup', {
      documentoId,
      empresaId,
      telefono,
      templateParams,
      xmlUrl: links.xmlUrl,
      pdfUrl: links.pdfUrl,
      filename: links.pdfFilename,
    });
    const templateDocumentResponse = await sendTemplateDocumentMessage(
      Number(empresaId),
      telefono,
      tipoPlantilla,
      templateParams,
      links.pdfUrl,
      links.pdfFilename
    );
    console.info('[CFDI WhatsApp] Respuesta Gupshup template+PDF', {
      documentoId,
      empresaId,
      telefono,
      templateParams,
      xmlUrl: links.xmlUrl,
      response: templateDocumentResponse,
    });

    return res.status(200).json({
      success: true,
      template: templateDocumentResponse,
      expiresAt: links.expiresAt,
      pdfUrl: links.pdfUrl,
      xmlUrl: links.xmlUrl,
    });
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ error: (error as Error).message });
    }
    console.error('[CFDI WhatsApp] Error en envio automatico de CFDI', error);
    return res.status(500).json({ message: 'No se pudo enviar el CFDI por WhatsApp' });
  }
}

export async function enviarWhatsappCotizacion(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const telefono = String(req.body?.telefono ?? '').trim();
    const tipoDocumento = resolverTipoDocumentoRequest(req, 'cotizacion');

    if (Number.isNaN(documentoId) || !empresaId) {
      return res.status(400).json({ message: 'ID o empresaId inválido' });
    }

    if (!telefono) {
      return res.status(400).json({ message: 'telefono es requerido' });
    }

    if (!esTipoDocumentoEnviable(tipoDocumento)) {
      return res.status(400).json({ message: 'Tipo de documento no soportado para envío por WhatsApp' });
    }

    const documento = await obtenerDocumentoRepository(documentoId, Number(empresaId), tipoDocumento);
    if (!documento) {
      return res.status(404).json({ message: `${nombreDocumento[tipoDocumento] ?? tipoDocumento} no encontrado` });
    }

    const documentoData = documento.documento as any;
    const nombreCliente = String(documentoData?.nombre_receptor ?? documentoData?.cliente_nombre ?? 'Cliente').trim() || 'Cliente';
    const folioDocumento = formatearFolioDocumento(documentoData?.serie ?? '', Number(documentoData?.numero ?? 0)) || String(documentoId);
    const links = await generarDocumentoPublicLinks(req, documentoId, Number(empresaId), tipoDocumento);
    const templateParams = [nombreCliente, folioDocumento];
    const tipoDocumentoLabel = nombreDocumento[tipoDocumento] ?? tipoDocumento;
    const tipoPlantilla = resolverTipoPlantillaWhatsapp('documento_pdf', tipoDocumento);

    console.info('[WhatsApp Documento] Inicio de envio', {
      documentoId,
      empresaId,
      telefono,
      tipoDocumento,
      tipoPlantilla,
    });

    console.info('[WhatsApp Documento] Enviando template+PDF por Gupshup', {
      documentoId,
      empresaId,
      telefono,
      templateParams,
      pdfUrl: links.pdfUrl,
      filename: links.pdfFilename,
    });

    const templateDocumentResponse = await sendTemplateDocumentMessage(
      Number(empresaId),
      telefono,
      tipoPlantilla,
      templateParams,
      links.pdfUrl,
      links.pdfFilename
    );

    console.info('[WhatsApp Documento] Respuesta Gupshup template+PDF', {
      documentoId,
      empresaId,
      telefono,
      templateParams,
      response: templateDocumentResponse,
    });

    return res.status(200).json({
      success: true,
      template: templateDocumentResponse,
      expiresAt: links.expiresAt,
      pdfUrl: links.pdfUrl,
      tipoDocumento,
      tipoDocumentoLabel,
    });
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return res.status(status).json({ error: (error as Error).message });
    }
    console.error('[WhatsApp Documento] Error en envio por WhatsApp', error);
    return res.status(500).json({ message: 'No se pudo enviar el documento por WhatsApp' });
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
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
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
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({ ok: false, error: message.replace('VALIDATION_ERROR:', '').trim() || 'Error de validación' });
    }
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

export async function timbrarDocumentoCfdi(req: Request, res: Response) {
  const documentoId = Number(req.params.id);
  const empresaId = req.context?.empresaId;
  if (Number.isNaN(documentoId) || !empresaId) {
    return res.status(400).json({ message: 'ID o empresaId inválido' });
  }

  try {
    const resultado = await cfdiService.timbrarDocumento(documentoId, Number(empresaId));
    res.json(resultado);
  } catch (error) {
    if (error instanceof CfdiValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error al timbrar documento CFDI', error);
    res.status(500).json({ message: 'Error al timbrar el documento' });
  }
}

export async function cancelarDocumento(req: Request, res: Response) {
  try {
    const documentoId = Number(req.params.id);
    const empresaId = req.context?.empresaId;
    const usuarioId = req.auth?.userId;

    if (!Number.isFinite(documentoId) || !empresaId || !usuarioId) {
      return res.status(400).json({ message: 'ID, empresa o usuario inválido' });
    }

    const result = await cancelarDocumentoService({
      documentoId,
      empresaId: Number(empresaId),
      usuarioId: Number(usuarioId),
      esSuperadmin: Boolean(req.auth?.esSuperadmin),
      motivoCancelacion: req.body?.motivo_cancelacion,
      motivoSat: req.body?.motivo_sat,
      uuidSustitucion: req.body?.uuid_sustitucion,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof DocumentoCancelValidationError) {
      return res.status(400).json({ message: error.message });
    }

    console.error('Error al cancelar documento', error);
    return res.status(500).json({ message: 'Error al cancelar documento' });
  }
}
