import { Request, Response } from 'express';
import {
  listarConfiguraciones,
  obtenerConfiguracionPorId,
  crearConfiguracion,
  actualizarConfiguracion,
  eliminarConfiguracion,
  listarValoresProducto,
  type ConfiguracionCuentaContableInput,
} from './configuracionCuentasContables.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  if (message.includes('duplicate key')) {
    return { status: 409, message: 'Ya existe una configuración con esta empresa, uso contable y entidad destino.' };
  }
  return { status: 500, message: fallback };
}

function parseNumeroQuery(valor: unknown): number | undefined {
  if (typeof valor !== 'string' || valor.trim() === '') return undefined;
  const num = Number(valor);
  return Number.isFinite(num) ? num : undefined;
}

export async function getConfiguracionesCuentasContables(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const activaQuery = req.query.activa;
    const configuraciones = await listarConfiguraciones(empresaId, {
      uso_contable: typeof req.query.uso_contable === 'string' ? req.query.uso_contable : undefined,
      contacto_id: parseNumeroQuery(req.query.contacto_id),
      producto_id: parseNumeroQuery(req.query.producto_id),
      almacen_id: parseNumeroQuery(req.query.almacen_id),
      finanzas_cuenta_id: parseNumeroQuery(req.query.finanzas_cuenta_id),
      concepto_id: parseNumeroQuery(req.query.concepto_id),
      impuesto_id: typeof req.query.impuesto_id === 'string' ? req.query.impuesto_id : undefined,
      activa: activaQuery === 'true' ? true : activaQuery === 'false' ? false : undefined,
    });
    return res.json(configuraciones);
  } catch (error) {
    console.error('Error al obtener configuraciones de cuentas contables', error);
    return res.status(500).json({ message: 'Error al obtener configuraciones de cuentas contables' });
  }
}

export async function getConfiguracionCuentaContable(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await obtenerConfiguracionPorId(Number(req.params.id), empresaId);
    if (!configuracion) return res.status(404).json({ message: 'Configuración no encontrada' });
    return res.json(configuracion);
  } catch (error) {
    console.error('Error al obtener configuración de cuenta contable', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuración' });
  }
}

function extraerInput(body: Record<string, unknown>): ConfiguracionCuentaContableInput {
  return {
    cuenta_id: Number(body?.cuenta_id),
    uso_contable: String(body?.uso_contable ?? ''),
    contacto_id: body?.contacto_id != null ? Number(body.contacto_id) : null,
    producto_id: body?.producto_id != null ? Number(body.producto_id) : null,
    almacen_id: body?.almacen_id != null ? Number(body.almacen_id) : null,
    finanzas_cuenta_id: body?.finanzas_cuenta_id != null ? Number(body.finanzas_cuenta_id) : null,
    concepto_id: body?.concepto_id != null ? Number(body.concepto_id) : null,
    impuesto_id: typeof body?.impuesto_id === 'string' ? body.impuesto_id : null,
    producto_familia: typeof body?.producto_familia === 'string' ? body.producto_familia : null,
    producto_linea: typeof body?.producto_linea === 'string' ? body.producto_linea : null,
    producto_clasificacion: typeof body?.producto_clasificacion === 'string' ? body.producto_clasificacion : null,
    producto_tipo: typeof body?.producto_tipo === 'string' ? body.producto_tipo : null,
    activa: typeof body?.activa === 'boolean' ? body.activa : undefined,
    notas: typeof body?.notas === 'string' ? body.notas : null,
  };
}

export async function postConfiguracionCuentaContable(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await crearConfiguracion(empresaId, extraerInput(req.body ?? {}));
    return res.status(201).json(configuracion);
  } catch (error) {
    console.error('Error al crear configuración de cuenta contable', error);
    const { status, message } = parseValidationError(error, 'No se pudo crear la configuración');
    return res.status(status).json({ message });
  }
}

export async function putConfiguracionCuentaContable(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await actualizarConfiguracion(Number(req.params.id), empresaId, extraerInput(req.body ?? {}));
    if (!configuracion) return res.status(404).json({ message: 'Configuración no encontrada' });
    return res.json(configuracion);
  } catch (error) {
    console.error('Error al actualizar configuración de cuenta contable', error);
    const { status, message } = parseValidationError(error, 'No se pudo actualizar la configuración');
    return res.status(status).json({ message });
  }
}

export async function deleteConfiguracionCuentaContable(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const resultado = await eliminarConfiguracion(Number(req.params.id), empresaId);
    if (resultado === null) return res.status(404).json({ message: 'Configuración no encontrada' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar configuración de cuenta contable', error);
    const { status, message } = parseValidationError(error, 'No se pudo eliminar la configuración');
    return res.status(status).json({ message });
  }
}

export async function getValoresProducto(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const campo = typeof req.query.campo === 'string' ? req.query.campo : '';
    const valores = await listarValoresProducto(empresaId, campo);
    return res.json(valores);
  } catch (error) {
    console.error('Error al obtener valores de producto', error);
    const { status, message } = parseValidationError(error, 'No se pudieron obtener los valores de producto');
    return res.status(status).json({ message });
  }
}
