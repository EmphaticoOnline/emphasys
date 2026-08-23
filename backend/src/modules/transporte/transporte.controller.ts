import type { Request, Response } from 'express';
import { createTrip, getTrip, updateTripAggregate } from './transporte.service';
import { TransporteError } from './transporte.types';
import { getCurrentCartaPorte, materializeCartaPorte } from './carta-porte.service';
import { vincularFacturaViaje } from './carta-porte-timbrado.service';

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
    return res.status(error.statusCode).json({ message: error.message, code: error.code });
  }
  const pgError = error as { code?: string; constraint?: string };
  if (pgError?.code === '23505') {
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
