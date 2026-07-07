import { Request, Response } from 'express';
import {
  listarCuentas,
  obtenerCuentaPorId,
  crearCuentaJerarquica,
  actualizarCuenta,
  cambiarEstadoCuenta,
  analizarCuentaNueva,
} from './cuentas.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  if (message.includes('duplicate key')) {
    return { status: 409, message: 'Ya existe una cuenta con ese número en esta empresa' };
  }
  return { status: 500, message: fallback };
}

export async function getCuentas(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const incluirInactivas = req.query.incluir_inactivas === '1';
    const cuentas = await listarCuentas(empresaId, { incluirInactivas });
    return res.json(cuentas);
  } catch (error) {
    console.error('Error al obtener cuentas contables', error);
    return res.status(500).json({ message: 'Error al obtener cuentas contables' });
  }
}

export async function getValidarNuevaCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const cuenta = typeof req.query.cuenta === 'string' ? req.query.cuenta : '';
    if (!cuenta) {
      return res.json({ valida: false, message: 'Captura un número de cuenta' });
    }

    const { nivel, niveles } = await analizarCuentaNueva(empresaId, cuenta);
    const final = niveles[niveles.length - 1];
    return res.json({
      valida: true,
      nivel,
      cuentas: niveles,
      cuenta_existente: final?.existe ?? false,
    });
  } catch (error) {
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.json({ valida: false, message: message.replace('VALIDATION_ERROR:', '').trim() });
    }
    console.error('Error al validar cuenta contable', error);
    return res.status(500).json({ message: 'No se pudo validar la cuenta' });
  }
}

export async function getCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const cuenta = await obtenerCuentaPorId(Number(req.params.id), empresaId);
    if (!cuenta) return res.status(404).json({ message: 'Cuenta no encontrada' });
    return res.json(cuenta);
  } catch (error) {
    console.error('Error al obtener cuenta contable', error);
    return res.status(500).json({ message: 'No se pudo obtener la cuenta' });
  }
}

export async function postCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const cuenta = await crearCuentaJerarquica(empresaId, {
      cuenta: req.body?.cuenta,
      descripcion: req.body?.descripcion,
      afectable: req.body?.afectable,
      rango_cuenta_id: req.body?.rango_cuenta_id ?? null,
      subgrupo: req.body?.subgrupo ?? null,
      codigo_agrupador_sat: req.body?.codigo_agrupador_sat ?? null,
      rubro_presupuesto: req.body?.rubro_presupuesto ?? null,
      no_considerar_presupuesto: req.body?.no_considerar_presupuesto,
      observaciones: req.body?.observaciones ?? null,
      activa: req.body?.activa,
      descripciones_faltantes: req.body?.descripciones_faltantes ?? {},
    });
    return res.status(201).json(cuenta);
  } catch (error) {
    console.error('Error al crear cuenta contable', error);
    const { status, message } = parseValidationError(error, 'No se pudo crear la cuenta');
    return res.status(status).json({ message });
  }
}

export async function putCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const cuenta = await actualizarCuenta(Number(req.params.id), empresaId, {
      descripcion: req.body?.descripcion,
      afectable: req.body?.afectable,
      rango_cuenta_id: req.body?.rango_cuenta_id ?? null,
      subgrupo: req.body?.subgrupo ?? null,
      codigo_agrupador_sat: req.body?.codigo_agrupador_sat ?? null,
      rubro_presupuesto: req.body?.rubro_presupuesto ?? null,
      no_considerar_presupuesto: req.body?.no_considerar_presupuesto,
      observaciones: req.body?.observaciones ?? null,
    });

    if (!cuenta) return res.status(404).json({ message: 'Cuenta no encontrada' });
    return res.json(cuenta);
  } catch (error) {
    console.error('Error al actualizar cuenta contable', error);
    const { status, message } = parseValidationError(error, 'No se pudo actualizar la cuenta');
    return res.status(status).json({ message });
  }
}

export async function patchCuentaEstado(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const activa = Boolean(req.body?.activa);
    const cuenta = await cambiarEstadoCuenta(Number(req.params.id), empresaId, activa);
    if (!cuenta) return res.status(404).json({ message: 'Cuenta no encontrada' });
    return res.json(cuenta);
  } catch (error) {
    console.error('Error al cambiar estado de cuenta contable', error);
    return res.status(500).json({ message: 'No se pudo cambiar el estado de la cuenta' });
  }
}
