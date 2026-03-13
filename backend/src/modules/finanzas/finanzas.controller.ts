import { Request, Response } from 'express';
import {
  crearAplicacion,
  crearConciliacion,
  crearCuenta,
  crearOperacion,
  crearTransferencia,
  actualizarTransferencia,
  eliminarTransferencia,
  eliminarAplicacion,
  eliminarOperacion,
  listarCuentas,
  listarOperaciones,
  actualizarCuenta,
  eliminarCuenta,
  actualizarOperacion,
} from './finanzas.repository';

export async function getCuentas(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuentas = await listarCuentas(empresaId);
    res.json(cuentas);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al obtener cuentas' });
  }
}

export async function postCuenta(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuenta = await crearCuenta(req.body, empresaId);
    res.status(201).json(cuenta);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo crear la cuenta' });
  }
}

export async function putCuenta(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const cuenta = await actualizarCuenta(id, req.body, empresaId);
    res.json(cuenta);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo actualizar la cuenta' });
  }
}

export async function deleteCuenta(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarCuenta(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la cuenta' });
  }
}

export async function getOperaciones(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuentaId = req.query.cuenta_id ? Number(req.query.cuenta_id) : undefined;
    const ops = await listarOperaciones(empresaId, cuentaId);
    res.json(ops);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al obtener operaciones' });
  }
}

export async function postOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const op = await crearOperacion(req.body, empresaId);
    res.status(201).json(op);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo crear la operación' });
  }
}

export async function putOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const op = await actualizarOperacion(id, req.body, empresaId);
    res.json(op);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo actualizar la operación' });
  }
}

export async function deleteOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarOperacion(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la operación' });
  }
}

export async function postTransferencia(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearTransferencia(req.body, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo registrar la transferencia' });
  }
}

export async function putTransferencia(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const result = await actualizarTransferencia(id, req.body, empresaId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo actualizar la transferencia' });
  }
}

export async function deleteTransferencia(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarTransferencia(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la transferencia' });
  }
}

export async function postConciliacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearConciliacion(req.body, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo registrar la conciliación' });
  }
}

export async function postAplicacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearAplicacion(req.body, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo registrar la aplicación' });
  }
}

export async function deleteAplicacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarAplicacion(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la aplicación' });
  }
}
