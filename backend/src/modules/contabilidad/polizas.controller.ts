import { Request, Response } from 'express';
import {
  listarPolizas,
  listarMovimientosPoliza,
  obtenerPolizaConMovimientos,
  calcularSiguienteNumero,
  crearPolizaConMovimientos,
  actualizarPolizaConMovimientos,
  eliminarPoliza,
  cambiarEstatusPoliza,
  cambiarEstatusPolizasLote,
  PolizaValidacionError,
} from './polizas.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function getUsuarioId(req: Request): number | null {
  const id = Number(req.auth?.userId ?? 0);
  return id > 0 ? id : null;
}

// PolizaValidacionError trae detalle por renglón (qué cuenta falló y por
// qué); se responde aparte para no perder esa información dentro del
// mensaje genérico de parseValidationError.
function responderErrorPoliza(res: Response, error: unknown, fallback: string): Response {
  if (error instanceof PolizaValidacionError) {
    return res.status(400).json({ message: error.message, detalles: error.detalles });
  }
  const { status, message } = parseValidationError(error, fallback);
  return res.status(status).json({ message });
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  if (message.includes('duplicate key')) {
    return { status: 409, message: 'Ya existe una póliza con ese número para este tipo, ejercicio y periodo' };
  }
  return { status: 500, message: fallback };
}

export async function getPolizas(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    const periodo = Number(req.query.periodo);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }
    if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
      return res.status(400).json({ message: 'El periodo debe estar entre 1 y 12' });
    }
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar : undefined;

    const polizas = await listarPolizas(empresaId, ejercicio, periodo, buscar);
    return res.json(polizas);
  } catch (error) {
    console.error('Error al obtener pólizas', error);
    return res.status(500).json({ message: 'No se pudieron obtener las pólizas' });
  }
}

export async function getMovimientosPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const movimientos = await listarMovimientosPoliza(Number(req.params.id), empresaId);
    if (movimientos === null) return res.status(404).json({ message: 'Póliza no encontrada' });
    return res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos de la póliza', error);
    return res.status(500).json({ message: 'No se pudieron obtener los movimientos de la póliza' });
  }
}

export async function getPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const resultado = await obtenerPolizaConMovimientos(Number(req.params.id), empresaId);
    if (!resultado) return res.status(404).json({ message: 'Póliza no encontrada' });
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener la póliza', error);
    return res.status(500).json({ message: 'No se pudo obtener la póliza' });
  }
}

export async function getSiguienteNumero(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const tipoPolizaId = Number(req.query.tipo_poliza_id);
    const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : '';
    if (!tipoPolizaId) return res.status(400).json({ message: 'tipo_poliza_id es requerido' });

    const resultado = await calcularSiguienteNumero(empresaId, tipoPolizaId, fecha);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al calcular el siguiente número de póliza', error);
    const { status, message } = parseValidationError(error, 'No se pudo calcular el siguiente número');
    return res.status(status).json({ message });
  }
}

export async function postPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const poliza = await crearPolizaConMovimientos(
      empresaId,
      {
        tipo_poliza_id: Number(req.body?.tipo_poliza_id),
        fecha: req.body?.fecha,
        referencia: req.body?.referencia ?? null,
        observaciones: req.body?.observaciones ?? null,
        estatus: req.body?.estatus === 'aplicada' ? 'aplicada' : 'borrador',
        movimientos: Array.isArray(req.body?.movimientos) ? req.body.movimientos : [],
      },
      getUsuarioId(req)
    );
    return res.status(201).json(poliza);
  } catch (error) {
    console.error('Error al crear la póliza', error);
    return responderErrorPoliza(res, error, 'No se pudo crear la póliza');
  }
}

export async function putPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const poliza = await actualizarPolizaConMovimientos(
      Number(req.params.id),
      empresaId,
      {
        tipo_poliza_id: Number(req.body?.tipo_poliza_id),
        fecha: req.body?.fecha,
        referencia: req.body?.referencia ?? null,
        observaciones: req.body?.observaciones ?? null,
        estatus: req.body?.estatus === 'aplicada' ? 'aplicada' : 'borrador',
        movimientos: Array.isArray(req.body?.movimientos) ? req.body.movimientos : [],
      },
      getUsuarioId(req)
    );
    if (!poliza) return res.status(404).json({ message: 'Póliza no encontrada' });
    return res.json(poliza);
  } catch (error) {
    console.error('Error al actualizar la póliza', error);
    return responderErrorPoliza(res, error, 'No se pudo actualizar la póliza');
  }
}

export async function patchPolizaEstatus(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const estatus = req.body?.estatus;
    if (estatus !== 'aplicada' && estatus !== 'borrador') {
      return res.status(400).json({ message: 'El estatus debe ser aplicada o borrador' });
    }

    const poliza = await cambiarEstatusPoliza(Number(req.params.id), empresaId, estatus);
    if (!poliza) return res.status(404).json({ message: 'Póliza no encontrada' });

    return res.json({
      ok: true,
      estatus: poliza.estatus,
      message: poliza.estatus === 'aplicada' ? 'Póliza aplicada correctamente.' : 'Póliza desaplicada correctamente.',
      poliza,
    });
  } catch (error) {
    console.error('Error al cambiar el estatus de la póliza', error);
    return responderErrorPoliza(res, error, 'No se pudo cambiar el estatus de la póliza');
  }
}

// Lote: cada póliza se procesa de forma independiente dentro de
// cambiarEstatusPolizasLote (su propia transacción interna, reutilizando
// cambiarEstatusPoliza tal cual), así que un error en una póliza no aborta
// las demás. La respuesta siempre es 200 con el detalle por póliza; solo se
// responde con error HTTP si el lote ni siquiera pudo iniciarse (body
// inválido o falla inesperada de la orquestación).
export async function postPolizasEstatusLote(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const idsCrudos = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = idsCrudos
      .map((v: unknown) => Number(v))
      .filter((v: number) => Number.isInteger(v) && v > 0);
    if (!ids.length) {
      return res.status(400).json({ message: 'Se requiere al menos un id de póliza' });
    }

    const estatus = req.body?.estatus;
    if (estatus !== 'aplicada' && estatus !== 'borrador') {
      return res.status(400).json({ message: 'El estatus debe ser aplicada o borrador' });
    }

    const { resultados, resumen } = await cambiarEstatusPolizasLote(empresaId, ids, estatus);
    return res.json({ ok: true, resumen, resultados });
  } catch (error) {
    console.error('Error al cambiar el estatus de pólizas en lote', error);
    return res.status(500).json({ message: 'No se pudo procesar el lote de pólizas' });
  }
}

export async function deletePoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const resultado = await eliminarPoliza(Number(req.params.id), empresaId);
    if (resultado === null) return res.status(404).json({ message: 'Póliza no encontrada' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar la póliza', error);
    const { status, message } = parseValidationError(error, 'No se pudo eliminar la póliza');
    return res.status(status).json({ message });
  }
}
