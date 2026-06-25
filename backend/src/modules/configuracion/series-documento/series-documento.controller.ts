import type { Request, Response } from 'express';
import {
  actualizarActivaSerieDocumento,
  actualizarAsignacionSerieUsuario,
  actualizarSerieDocumentoAdmin,
  crearAsignacionSerieUsuario,
  crearSerieDocumentoAdmin,
  eliminarAsignacionSerieUsuario,
  listarAsignacionesSeriesUsuario,
  listarSeriesDocumentoAdmin,
  type SerieDocumentoPayload,
} from './series-documento.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function normalizarSeriePayload(body: any, { incluirFolio = false } = {}): SerieDocumentoPayload {
  const serie = String(body?.serie ?? '').trim();
  const tipoDocumento = String(body?.tipo_documento ?? '').trim().toLowerCase();
  const descripcionRaw = body?.descripcion;
  const descripcion = typeof descripcionRaw === 'string' ? descripcionRaw.trim() : descripcionRaw ?? null;
  const esFiscal = Boolean(body?.es_fiscal);
  const activa = body?.activa === undefined ? true : Boolean(body?.activa);

  if (!serie) {
    throw new Error('serie es obligatoria');
  }

  if (!tipoDocumento) {
    throw new Error('tipo_documento es obligatorio');
  }

  const payload: SerieDocumentoPayload = {
    serie,
    descripcion: descripcion ? descripcion : null,
    tipo_documento: tipoDocumento,
    es_fiscal: esFiscal,
    activa,
  };

  if (incluirFolio && body?.ultimo_numero !== undefined) {
    const folio = Number(body.ultimo_numero);
    if (!Number.isInteger(folio) || folio < 0) {
      throw new Error('ultimo_numero debe ser un entero mayor o igual a cero');
    }
    payload.ultimo_numero = folio;
  }

  return payload;
}

function normalizarAsignacionPayload(body: any): { usuario_id: number; serie_documento_id: number; tipo_documento: string } {
  const usuarioId = Number(body?.usuario_id ?? 0);
  const serieDocumentoId = Number(body?.serie_documento_id ?? 0);
  const tipoDocumento = String(body?.tipo_documento ?? '').trim().toLowerCase();

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new Error('usuario_id es obligatorio');
  }

  if (!Number.isInteger(serieDocumentoId) || serieDocumentoId <= 0) {
    throw new Error('serie_documento_id es obligatorio');
  }

  if (!tipoDocumento) {
    throw new Error('tipo_documento es obligatorio');
  }

  return {
    usuario_id: usuarioId,
    serie_documento_id: serieDocumentoId,
    tipo_documento: tipoDocumento,
  };
}

export async function obtenerSeriesDocumentoAdmin(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    const rows = await listarSeriesDocumentoAdmin(empresaId);
    return res.json(rows);
  } catch (error) {
    console.error('Error al listar series de documento:', error);
    return res.status(500).json({ message: 'No se pudieron cargar las series de documento' });
  }
}

export async function crearSerieDocumentoAdminController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    const payload = normalizarSeriePayload(req.body);
    const row = await crearSerieDocumentoAdmin(empresaId, payload);
    return res.status(201).json(row);
  } catch (error: any) {
    const message = error?.message || 'No se pudo crear la serie';
    const status = /obligatori|duplicate|unique|uq_/i.test(message) ? 400 : 500;
    console.error('Error al crear serie de documento:', error);
    return res.status(status).json({ message });
  }
}

export async function actualizarSerieDocumentoAdminController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const serieId = Number(req.params.id ?? 0);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(serieId) || serieId <= 0) {
      return res.status(400).json({ message: 'id de serie inválido' });
    }

    const payload = normalizarSeriePayload(req.body, { incluirFolio: Boolean(req.auth?.esSuperadmin) });
    const row = await actualizarSerieDocumentoAdmin(empresaId, serieId, payload);

    if (!row) {
      return res.status(404).json({ message: 'Serie no encontrada' });
    }

    return res.json(row);
  } catch (error: any) {
    const message = error?.message || 'No se pudo actualizar la serie';
    const status = /obligatori|duplicate|unique|uq_/i.test(message) ? 400 : 500;
    console.error('Error al actualizar serie de documento:', error);
    return res.status(status).json({ message });
  }
}

export async function actualizarSerieDocumentoActivaController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const serieId = Number(req.params.id ?? 0);
    const activa = Boolean(req.body?.activa);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(serieId) || serieId <= 0) {
      return res.status(400).json({ message: 'id de serie inválido' });
    }

    const row = await actualizarActivaSerieDocumento(empresaId, serieId, activa);

    if (!row) {
      return res.status(404).json({ message: 'Serie no encontrada' });
    }

    return res.json(row);
  } catch (error) {
    console.error('Error al cambiar estatus de serie de documento:', error);
    return res.status(500).json({ message: 'No se pudo actualizar el estatus de la serie' });
  }
}

export async function obtenerAsignacionesSeriesDocumentoController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    const rows = await listarAsignacionesSeriesUsuario(empresaId);
    return res.json(rows);
  } catch (error) {
    console.error('Error al listar asignaciones de series por usuario:', error);
    return res.status(500).json({ message: 'No se pudieron cargar las asignaciones de series' });
  }
}

export async function crearAsignacionSerieDocumentoController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    const payload = normalizarAsignacionPayload(req.body);
    const row = await crearAsignacionSerieUsuario(empresaId, payload);
    return res.status(201).json(row);
  } catch (error: any) {
    const message = error?.message || 'No se pudo crear la asignación';
    const status = /obligatori|no existe|solo se pueden/i.test(message) ? 400 : 500;
    console.error('Error al crear asignación de serie:', error);
    return res.status(status).json({ message });
  }
}

export async function actualizarAsignacionSerieDocumentoController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const asignacionId = Number(req.params.id ?? 0);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(asignacionId) || asignacionId <= 0) {
      return res.status(400).json({ message: 'id de asignación inválido' });
    }

    const payload = normalizarAsignacionPayload(req.body);
    const row = await actualizarAsignacionSerieUsuario(empresaId, asignacionId, payload);

    if (!row) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    return res.json(row);
  } catch (error: any) {
    const message = error?.message || 'No se pudo actualizar la asignación';
    const status = /obligatori|no existe|solo se pueden/i.test(message) ? 400 : 500;
    console.error('Error al actualizar asignación de serie:', error);
    return res.status(status).json({ message });
  }
}

export async function eliminarAsignacionSerieDocumentoController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const asignacionId = Number(req.params.id ?? 0);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isInteger(asignacionId) || asignacionId <= 0) {
      return res.status(400).json({ message: 'id de asignación inválido' });
    }

    const deleted = await eliminarAsignacionSerieUsuario(empresaId, asignacionId);
    if (!deleted) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar asignación de serie:', error);
    return res.status(500).json({ message: 'No se pudo eliminar la asignación' });
  }
}