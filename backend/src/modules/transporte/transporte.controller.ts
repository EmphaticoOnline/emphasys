import type { Request, Response } from 'express';
import { createTrip, createTripFromDocument, getTrip, getTripByDocument, updateTripAggregate } from './transporte.service';
import { TransporteError } from './transporte.types';
import { getCurrentCartaPorte, materializeCartaPorte } from './carta-porte.service';
import { vincularFacturaViaje } from './carta-porte-timbrado.service';
import { listAvailableLocations, listAvailableOperators, listImportablePartidas } from './transporte.repository';
import pool from '../../config/database';
import { obtenerLogoEmpresaPath } from '../documentos/documentos.pdf';
import { mapCartaPortePrintModel } from './carta-porte-print.mapper';
import { generarCartaPortePDF } from './carta-porte-print.pdf';
import { combinarPDFs } from './pdf-composer';

const requestContext = (req: Request): { empresaId: number; usuarioId: number } => {
  const empresaId = Number(req.context?.empresaId);
  const usuarioId = Number(req.auth?.userId);
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new TransporteError('Empresa activa requerida.', 400);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) throw new TransporteError('Usuario autenticado requerido.', 401);
  return { empresaId, usuarioId };
};

const idParam = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new TransporteError('El id del viaje no es válido.');
  return id;
};

const respondError = (res: Response, error: unknown) => {
  if (error instanceof TransporteError) {
    return res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
      ...(error.issues && error.issues.length ? { issues: error.issues } : {}),
    });
  }
  const pgError = error as { code?: string; constraint?: string; detail?: string; schema?: string; table?: string };
  if (pgError?.code === '23505') {
    // El mensaje al cliente permanece genérico, pero el servidor registra
    // constraint/detail/tabla: son indispensables para diagnosticar el 409.
    console.error('[transporte] 23505 clave duplicada', {
      constraint: pgError.constraint,
      detail: pgError.detail,
      table: pgError.schema && pgError.table ? `${pgError.schema}.${pgError.table}` : pgError.table,
    });
    return res.status(409).json({ message: 'El viaje contiene una clave o secuencia duplicada.' });
  }
  console.error('[transporte] Error inesperado', error);
  return res.status(500).json({ message: 'Error interno del módulo Transporte.' });
};

export async function postViaje(req: Request, res: Response) {
  try {
    const { empresaId, usuarioId } = requestContext(req);
    return res.status(201).json(await createTrip(empresaId, usuarioId, req.body));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getViaje(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    return res.json(await getTrip(empresaId, idParam(req)));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getUbicacionesDisponibles(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    const rawLimit = Number(req.query.limit);
    const contactoId = Number(req.query.contactoId);
    const activos = req.query.activos !== 'false';
    const tipo = req.query.tipoPropietario ? String(req.query.tipoPropietario) : undefined;
    if (tipo && tipo !== 'contacto' && tipo !== 'empresa') throw new TransporteError('tipoPropietario no es válido.');
    return res.json(await listAvailableLocations(empresaId, { q: String(req.query.q ?? ''), contactoId: Number.isInteger(contactoId) && contactoId > 0 ? contactoId : undefined, tipoPropietario: tipo, activos, limit: Number.isFinite(rawLimit) ? rawLimit : undefined }));
  } catch (error) { return respondError(res, error); }
}

export async function getOperadoresDisponibles(req: Request, res: Response) {
  try { const { empresaId } = requestContext(req); return res.json(await listAvailableOperators(empresaId)); }
  catch (error) { return respondError(res, error); }
}

export async function getViajeDeDocumento(req: Request, res: Response) {
  try { const { empresaId } = requestContext(req); const id = Number(req.params.documentoId); if (!Number.isInteger(id) || id <= 0) throw new TransporteError('El id del documento no es válido.'); return res.json(await getTripByDocument(empresaId, id)); }
  catch (error) { return respondError(res, error); }
}

export async function postViajeDeDocumento(req: Request, res: Response) {
  try { const { empresaId, usuarioId } = requestContext(req); const id = Number(req.params.documentoId); if (!Number.isInteger(id) || id <= 0) throw new TransporteError('El id del documento no es válido.'); return res.status(201).json(await createTripFromDocument(empresaId, usuarioId, id)); }
  catch (error) { return respondError(res, error); }
}

export async function getPartidasImportables(req: Request, res: Response) {
  try { const { empresaId } = requestContext(req); const id = Number(req.params.documentoId); if (!Number.isInteger(id) || id <= 0) throw new TransporteError('El id del documento no es válido.'); return res.json(await listImportablePartidas(empresaId, id)); }
  catch (error) { return respondError(res, error); }
}

export async function putViaje(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    return res.json(await updateTripAggregate(empresaId, idParam(req), req.body));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function postValidarCartaPorte(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    return res.status(201).json(await materializeCartaPorte(idParam(req), empresaId));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getCartaPorte(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    return res.json(await getCurrentCartaPorte(idParam(req), empresaId));
  } catch (error) {
    return respondError(res, error);
  }
}

export async function getCartaPortePDF(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    const documentoId = Number(req.params.documentoId);
    if (!Number.isInteger(documentoId) || documentoId <= 0) throw new TransporteError('El id del documento no es válido.');
    const { rows } = await pool.query(`
      SELECT d.id AS documento_id, d.empresa_id, d.tipo_documento, d.serie, d.numero, d.fecha_documento,
             dc.uuid, dc.fecha_timbrado, dc.rfc_emisor, dc.rfc_receptor, dc.sello_cfdi, dc.total, dc.xml_timbrado,
             e.nombre, e.razon_social, e.rfc AS empresa_rfc, e.regimen_fiscal_id,
             concat_ws(', ', e.calle, e.numero_exterior, e.numero_interior, e.colonia, e.localidad, e.estado, e.codigo_postal, e.pais) AS domicilio
        FROM public.documentos d
        JOIN public.documentos_cfdi dc ON dc.documento_id = d.id
        LEFT JOIN core.empresas e ON e.id = d.empresa_id
       WHERE d.id = $1 AND d.empresa_id = $2 AND lower(d.tipo_documento) = 'factura'
       LIMIT 1`, [documentoId, empresaId]);
    const row = rows[0];
    if (!row) throw new TransporteError('Factura timbrada no encontrada.', 404, 'CARTA_PORTE_DOCUMENT_NOT_FOUND');
    if (!row.xml_timbrado) throw new TransporteError('La factura no tiene XML timbrado.', 409, 'CARTA_PORTE_XML_MISSING');
    const model = mapCartaPortePrintModel({
      documentoId, serie: row.serie, folio: row.numero, fecha: row.fecha_documento,
      uuid: row.uuid, fechaTimbrado: row.fecha_timbrado, rfcEmisor: row.rfc_emisor, rfcReceptor: row.rfc_receptor,
      selloCfdi: row.sello_cfdi, total: row.total,
      branding: { logoPath: (await obtenerLogoEmpresaPath(empresaId)) ?? undefined, nombre: row.nombre, razonSocial: row.razon_social, rfc: row.empresa_rfc, regimenFiscal: row.regimen_fiscal_id, domicilio: row.domicilio },
    }, String(row.xml_timbrado));
    const buffer = await generarCartaPortePDF(model);
    const filename = `CartaPorte-${row.serie ?? ''}-${row.numero ?? documentoId}.pdf`.replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return respondError(res, error);
  }
}

export async function putViajeDocumento(req: Request, res: Response) {
  try {
    const { empresaId } = requestContext(req);
    const documentoId = Number(req.body?.documentoId);
    if (!Number.isInteger(documentoId) || documentoId <= 0) throw new TransporteError('documentoId debe ser un entero positivo.');
    return res.json(await vincularFacturaViaje(idParam(req), documentoId, empresaId));
  } catch (error) {
    return respondError(res, error);
  }
}
