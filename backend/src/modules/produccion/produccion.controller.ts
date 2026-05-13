import { Request, Response } from 'express';
import {
  actualizarEtapaProduccion,
  actualizarSeguimientoProduccion,
  crearEtapaProduccion,
  desactivarEtapaProduccion,
  eliminarEtapaProduccion,
  crearSeguimientoProduccion,
  listarHistorialSeguimientoPorDocumento,
  listarEtapasProduccion,
  listarSeguimientosProduccion,
} from './produccion.repository';

function getEmpresaId(req: Request) {
  return Number(req.context?.empresaId ?? 0);
}

function getUsuarioId(req: Request) {
  return Number(req.auth?.userId ?? 0);
}

export async function getEtapasProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const incluirInactivas = req.query.incluir_inactivas === '1';
    const etapas = await listarEtapasProduccion(empresaId, incluirInactivas);
    return res.json(etapas);
  } catch (error) {
    console.error('Error al obtener etapas de producción', error);
    return res.status(500).json({ message: 'Error al obtener etapas de producción' });
  }
}

export async function postEtapaProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const etapa = await crearEtapaProduccion(empresaId, {
      nombre: req.body?.nombre,
      orden: req.body?.orden,
      color: req.body?.color ?? null,
      activo: req.body?.activo,
    });

    return res.status(201).json(etapa);
  } catch (error) {
    const message = (error as Error)?.message ?? 'No se pudo crear la etapa';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }

    console.error('Error al crear etapa de producción', error);
    return res.status(500).json({ message: 'No se pudo crear la etapa' });
  }
}

export async function putEtapaProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const etapaId = Number(req.params.id);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const etapa = await actualizarEtapaProduccion(etapaId, empresaId, {
      nombre: req.body?.nombre,
      orden: req.body?.orden,
      color: req.body?.color,
      activo: req.body?.activo,
    });

    if (!etapa) {
      return res.status(404).json({ message: 'Etapa no encontrada' });
    }

    return res.json(etapa);
  } catch (error) {
    const message = (error as Error)?.message ?? 'No se pudo actualizar la etapa';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }

    console.error('Error al actualizar etapa de producción', error);
    return res.status(500).json({ message: 'No se pudo actualizar la etapa' });
  }
}

export async function deleteEtapaProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const etapaId = Number(req.params.id);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const result = await eliminarEtapaProduccion(etapaId, empresaId);
    if (!result) {
      return res.status(404).json({ message: 'Etapa no encontrada' });
    }

    return res.json(result);
  } catch (error) {
    const message = (error as Error)?.message ?? 'No se pudo eliminar la etapa';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }

    if (message.startsWith('DELETE_BLOCKED:')) {
      return res.status(409).json({ message: message.replace('DELETE_BLOCKED:', '').trim() });
    }

    console.error('Error al eliminar etapa de producción', error);
    return res.status(500).json({ message: 'No se pudo eliminar la etapa' });
  }
}

export async function getSeguimientosProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const seguimientos = await listarSeguimientosProduccion(empresaId);
    return res.json(seguimientos);
  } catch (error) {
    console.error('Error al obtener seguimientos de producción', error);
    return res.status(500).json({ message: 'Error al obtener seguimientos de producción' });
  }
}

export async function getSeguimientoProduccionPorDocumento(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const documentoId = Number(req.params.documentoId);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const historial = await listarHistorialSeguimientoPorDocumento(empresaId, documentoId);
    return res.json(historial);
  } catch (error) {
    const message = (error as Error)?.message ?? 'No se pudo obtener el historial de producción';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }

    console.error('Error al obtener historial de producción por documento', error);
    return res.status(500).json({ message: 'No se pudo obtener el historial de producción' });
  }
}

export async function postSeguimientoProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    const result = await crearSeguimientoProduccion(empresaId, {
      documento_id: req.body?.documento_id,
      etapa_id: req.body?.etapa_id,
      fecha_promesa: req.body?.fecha_promesa ?? null,
      comentarios: req.body?.comentarios ?? null,
      updated_by: usuarioId || null,
    });

    const status = result.created ? 201 : 200;
    return res.status(status).json({
      created: result.created,
      message: result.created ? 'Seguimiento creado' : 'El seguimiento ya existía para este documento',
      seguimiento: result.seguimiento,
    });
  } catch (error) {
    const message = (error as Error)?.message ?? 'No se pudo crear el seguimiento';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }

    console.error('Error al crear seguimiento de producción', error);
    return res.status(500).json({ message: 'No se pudo crear el seguimiento' });
  }
}

export async function putSeguimientoProduccion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const seguimientoId = Number(req.params.id);
    if (!empresaId) {
      return res.status(400).json({ message: 'Empresa requerida' });
    }

    if (!usuarioId) {
      return res.status(400).json({ message: 'Usuario inválido' });
    }

    const seguimiento = await actualizarSeguimientoProduccion(seguimientoId, empresaId, {
      etapa_id: req.body?.etapa_id,
      fecha_promesa: req.body?.fecha_promesa ?? null,
      comentarios: req.body?.comentarios ?? null,
      updated_by: usuarioId,
    });

    if (!seguimiento) {
      return res.status(404).json({ message: 'Seguimiento no encontrado' });
    }

    return res.json(seguimiento);
  } catch (error) {
    const message = (error as Error)?.message ?? 'No se pudo actualizar el seguimiento';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }

    console.error('Error al actualizar seguimiento de producción', error);
    return res.status(500).json({ message: 'No se pudo actualizar el seguimiento' });
  }
}