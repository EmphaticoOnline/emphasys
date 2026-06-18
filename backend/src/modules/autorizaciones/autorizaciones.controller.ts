import type { Request, Response } from 'express';
import {
  listarReglasEmpresa,
  crearRegla,
  actualizarRegla,
  desactivarRegla,
  listarBandejaAutorizador,
  listarMisSolicitudes,
  obtenerSolicitudPorId,
  responderSolicitud,
  cancelarSolicitud,
  listarTransicionesEmpresa,
} from './autorizaciones.repository';

function getEmpresaId(req: Request): number {
  return req.context?.empresaId as number;
}

function getUserId(req: Request): number {
  return req.auth?.userId as number;
}

function handleError(res: Response, err: unknown) {
  const e = err as any;
  const status: number = typeof e?.status === 'number' ? e.status : 500;
  const message: string = e?.message ?? 'Error interno del servidor';
  res.status(status).json({ error: message });
}

// ─── Transiciones ─────────────────────────────────────────────────────────────

export async function listarTransicionesHandler(req: Request, res: Response) {
  try {
    const rows = await listarTransicionesEmpresa(getEmpresaId(req));
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
}

// ─── Reglas ───────────────────────────────────────────────────────────────────

export async function listarReglasHandler(req: Request, res: Response) {
  try {
    const rows = await listarReglasEmpresa(getEmpresaId(req));
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
}

export async function crearReglaHandler(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const { transicion_id, monto_minimo, monto_maximo, modo, rol_autorizador_id, usuario_autorizador_id } = req.body;

    if (!transicion_id || !modo) {
      return res.status(400).json({ error: 'transicion_id y modo son requeridos.' });
    }
    if (modo !== 'ninguna' && !rol_autorizador_id && !usuario_autorizador_id) {
      return res.status(400).json({ error: 'Para modo directa o flujo se requiere rol_autorizador_id o usuario_autorizador_id.' });
    }

    const regla = await crearRegla(empresaId, {
      transicion_id: Number(transicion_id),
      monto_minimo: monto_minimo != null ? Number(monto_minimo) : null,
      monto_maximo: monto_maximo != null ? Number(monto_maximo) : null,
      modo,
      rol_autorizador_id: rol_autorizador_id ? Number(rol_autorizador_id) : null,
      usuario_autorizador_id: usuario_autorizador_id ? Number(usuario_autorizador_id) : null,
    });
    res.status(201).json(regla);
  } catch (err) {
    handleError(res, err);
  }
}

export async function actualizarReglaHandler(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const id = Number(req.params.id);
    const { transicion_id, monto_minimo, monto_maximo, modo, rol_autorizador_id, usuario_autorizador_id } = req.body;

    const regla = await actualizarRegla(id, empresaId, {
      transicion_id: transicion_id ? Number(transicion_id) : undefined,
      monto_minimo: 'monto_minimo' in req.body ? (monto_minimo != null ? Number(monto_minimo) : null) : undefined,
      monto_maximo: 'monto_maximo' in req.body ? (monto_maximo != null ? Number(monto_maximo) : null) : undefined,
      modo: modo ?? undefined,
      rol_autorizador_id: rol_autorizador_id != null ? Number(rol_autorizador_id) : null,
      usuario_autorizador_id: usuario_autorizador_id != null ? Number(usuario_autorizador_id) : null,
    });

    if (!regla) return res.status(404).json({ error: 'Política no encontrada.' });
    res.json(regla);
  } catch (err) {
    handleError(res, err);
  }
}

export async function desactivarReglaHandler(req: Request, res: Response) {
  try {
    const eliminado = await desactivarRegla(Number(req.params.id), getEmpresaId(req));
    if (!eliminado) return res.status(404).json({ error: 'Política no encontrada o ya inactiva.' });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

// ─── Solicitudes ──────────────────────────────────────────────────────────────

export async function listarBandejaHandler(req: Request, res: Response) {
  try {
    const rows = await listarBandejaAutorizador(getUserId(req), getEmpresaId(req));
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
}

export async function listarMisSolicitudesHandler(req: Request, res: Response) {
  try {
    const estado = typeof req.query.estado === 'string' ? req.query.estado : undefined;
    const rows = await listarMisSolicitudes(getUserId(req), getEmpresaId(req), estado);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
}

export async function obtenerSolicitudHandler(req: Request, res: Response) {
  try {
    const sol = await obtenerSolicitudPorId(Number(req.params.id), getEmpresaId(req));
    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    res.json(sol);
  } catch (err) {
    handleError(res, err);
  }
}

export async function responderSolicitudHandler(req: Request, res: Response) {
  try {
    const { decision, comentario_autorizador } = req.body;
    if (decision !== 'aprobada' && decision !== 'rechazada') {
      return res.status(400).json({ error: 'decision debe ser "aprobada" o "rechazada".' });
    }

    const sol = await responderSolicitud({
      id: Number(req.params.id),
      userId: getUserId(req),
      empresaId: getEmpresaId(req),
      decision,
      comentario: comentario_autorizador ?? null,
    });

    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    res.json(sol);
  } catch (err) {
    handleError(res, err);
  }
}

export async function cancelarSolicitudHandler(req: Request, res: Response) {
  try {
    const ok = await cancelarSolicitud(
      Number(req.params.id),
      getUserId(req),
      getEmpresaId(req)
    );
    if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada, ya respondida, o no pertenece al usuario.' });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}
