import { Request, Response } from 'express';
import {
  obtenerCamposConfiguracion,
  crearCampoConfiguracion,
  actualizarCampoConfiguracion,
  eliminarCampoConfiguracion,
} from './campos-configuracion.repository';

function getCampoConfiguracionErrorMessage(error: unknown): string {
  const pgError = error as { code?: string; constraint?: string; message?: string };

  if (
    pgError?.code === '23505' &&
    pgError?.constraint === 'ux_campos_configuracion_empresa_proposito_sistema'
  ) {
    return 'Ya existe un campo configurado con ese propósito del sistema en esta empresa.';
  }

  return error instanceof Error ? error.message : 'No se pudo procesar el campo';
}

export async function listarCamposConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });

    const entidadTipoId = req.query.entidad_tipo_id ? Number(req.query.entidad_tipo_id) : undefined;
    const entidadTipoCodigo = req.query.entidad_tipo_codigo?.toString();
    const tipoDocumento = req.query.tipo_documento?.toString();
    const incluirInactivos = ['1', 'true', 'si', 'yes'].includes(String(req.query.incluir_inactivos ?? '').toLowerCase());

    const data = await obtenerCamposConfiguracion(Number(empresaId), {
      entidad_tipo_id: Number.isFinite(entidadTipoId) ? entidadTipoId : undefined,
      entidad_tipo_codigo: entidadTipoCodigo || undefined,
      tipo_documento: tipoDocumento || undefined,
      incluirInactivos,
    });

    res.json(data);
  } catch (error) {
    console.error('Error al listar campos configuracion', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function crearCampo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });

    const nuevo = await crearCampoConfiguracion(Number(empresaId), req.body);
    res.status(201).json(nuevo);
  } catch (error) {
    console.error('Error al crear campo configuracion', error);
    res.status(400).json({ message: getCampoConfiguracionErrorMessage(error) });
  }
}

export async function actualizarCampo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const id = Number(req.params.id);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!id) return res.status(400).json({ message: 'id es obligatorio' });

    const actualizado = await actualizarCampoConfiguracion(Number(empresaId), id, req.body);
    if (!actualizado) return res.status(404).json({ message: 'Registro no encontrado' });

    res.json(actualizado);
  } catch (error) {
    console.error('Error al actualizar campo configuracion', error);
    res.status(400).json({ message: getCampoConfiguracionErrorMessage(error) });
  }
}

export async function eliminarCampo(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    const id = Number(req.params.id);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es obligatorio' });
    if (!id) return res.status(400).json({ message: 'id es obligatorio' });

    const eliminado = await eliminarCampoConfiguracion(Number(empresaId), id);
    if (!eliminado) return res.status(404).json({ message: 'Registro no encontrado' });

    res.json(eliminado);
  } catch (error) {
    console.error('Error al eliminar campo configuracion', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo eliminar el campo' });
  }
}
