import type { Request, Response } from 'express';
import { obtenerEmpresaPorId } from '../../../services/empresasService';
import {
  crearSolicitudPendiente,
  listarSolicitudes,
  marcarSolicitudEnviada,
  marcarSolicitudError,
  marcarSolicitudVerificando,
  obtenerSolicitudPorId,
} from './cfdi-sat-solicitudes.repository';
import {
  listarPaquetesPendientesOError,
  listarPaquetesPorSolicitud,
  type CfdiSatPaqueteConConteoRow,
} from './cfdi-sat-paquetes.repository';
import { registrarBitacora } from './cfdi-sat-bitacora.repository';
import {
  assertEsAdministrador,
  CfdiSatPermisoError,
  CfdiSatValidacionError,
  getEmpresaId,
  getUserId,
  obtenerCredencialesFielListas,
} from './cfdi-sat.shared';
import {
  crearSolicitudSat,
  extraerDetalleErrorSat,
  SatClientError,
  type SatEstatusComprobante,
  type SatTipoDescarga,
  type SatTipoSolicitud,
} from './sat-client';
import { ejecutarDescargaSolicitud, ejecutarVerificacionSolicitud } from './cfdi-sat-solicitudes.service';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** Tope propio de la aplicación (no del SAT) para evitar solicitudes desproporcionadas. */
const RANGO_MAXIMO_DIAS = 366;
const TIPOS_DESCARGA: SatTipoDescarga[] = ['emitidos', 'recibidos'];
const TIPOS_SOLICITUD: SatTipoSolicitud[] = ['xml', 'metadata'];
const ESTATUS_COMPROBANTE: SatEstatusComprobante[] = ['activos', 'cancelados', 'todos'];

interface SolicitudPayload {
  tipoDescarga: SatTipoDescarga;
  fechaInicio: string;
  fechaFin: string;
  tipoSolicitud: SatTipoSolicitud;
  estatusComprobante: SatEstatusComprobante | null;
  fielPassword: string;
}

function normalizarPayload(body: any): SolicitudPayload {
  const tipoDescarga = String(body?.tipo_descarga ?? '').trim() as SatTipoDescarga;
  const fechaInicio = String(body?.fecha_inicio ?? '').trim();
  const fechaFin = String(body?.fecha_fin ?? '').trim();
  const tipoSolicitud = String(body?.tipo_solicitud ?? '').trim() as SatTipoSolicitud;
  const estatusComprobanteRaw = body?.estatus_comprobante;
  const fielPassword = String(body?.fielPassword ?? '');

  if (!TIPOS_DESCARGA.includes(tipoDescarga)) {
    throw new Error('tipo_descarga debe ser "emitidos" o "recibidos"');
  }
  if (!FECHA_REGEX.test(fechaInicio) || !FECHA_REGEX.test(fechaFin)) {
    throw new Error('fecha_inicio y fecha_fin deben tener formato YYYY-MM-DD');
  }
  if (fechaFin < fechaInicio) {
    throw new Error('fecha_fin no puede ser anterior a fecha_inicio');
  }
  const diasSolicitados = Math.round(
    (new Date(`${fechaFin}T00:00:00Z`).getTime() - new Date(`${fechaInicio}T00:00:00Z`).getTime()) / 86_400_000
  );
  if (diasSolicitados > RANGO_MAXIMO_DIAS) {
    throw new Error(
      `El rango de fechas no puede exceder ${RANGO_MAXIMO_DIAS} días (solicitado: ${diasSolicitados} días). Divide la solicitud en periodos más cortos.`
    );
  }
  if (!TIPOS_SOLICITUD.includes(tipoSolicitud)) {
    throw new Error('tipo_solicitud debe ser "xml" o "metadata"');
  }

  let estatusComprobante: SatEstatusComprobante | null = null;
  if (estatusComprobanteRaw !== undefined && estatusComprobanteRaw !== null && estatusComprobanteRaw !== '') {
    const value = String(estatusComprobanteRaw).trim() as SatEstatusComprobante;
    if (!ESTATUS_COMPROBANTE.includes(value)) {
      throw new Error('estatus_comprobante debe ser "activos", "cancelados" o "todos"');
    }
    estatusComprobante = value;
  }

  if (!fielPassword) {
    throw new Error('fielPassword es obligatorio');
  }

  return { tipoDescarga, fechaInicio, fechaFin, tipoSolicitud, estatusComprobante, fielPassword };
}

function getFielPassword(req: Request): string {
  return String(req.body?.fielPassword ?? '');
}

function getSolicitudId(req: Request): number {
  return Number(req.params.id ?? 0);
}

export async function listarSolicitudesController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const rows = await listarSolicitudes(empresaId);
    return res.json({ solicitudes: rows });
  } catch (error) {
    console.error('[CFDI SAT] Error al listar solicitudes', error);
    return res.status(500).json({ message: 'No se pudieron obtener las solicitudes' });
  }
}

export async function crearSolicitudController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);
  let solicitudId: number | null = null;

  try {
    await assertEsAdministrador(req);

    let payload: SolicitudPayload;
    try {
      payload = normalizarPayload(req.body ?? {});
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || 'Payload inválido' });
    }

    const { cerBuffer, keyBuffer } = await obtenerCredencialesFielListas(empresaId);

    const solicitud = await crearSolicitudPendiente({
      empresaId,
      usuarioId,
      tipoDescarga: payload.tipoDescarga,
      fechaInicio: payload.fechaInicio,
      fechaFin: payload.fechaFin,
      tipoSolicitud: payload.tipoSolicitud,
      estatusComprobante: payload.estatusComprobante,
    });
    solicitudId = solicitud.id;

    let resultado;
    try {
      resultado = await crearSolicitudSat({
        cerBuffer,
        keyBuffer,
        fielPassword: payload.fielPassword,
        tipoDescarga: payload.tipoDescarga,
        fechaInicio: payload.fechaInicio,
        fechaFin: payload.fechaFin,
        tipoSolicitud: payload.tipoSolicitud,
        estatusComprobante: payload.estatusComprobante,
      });
    } catch (error: any) {
      const mensaje =
        error instanceof SatClientError ? error.message : 'No se pudo presentar la solicitud ante el SAT';

      console.error('[CFDI SAT] Error al crear solicitud ante el SAT', {
        accion: 'crear_solicitud_sat',
        empresaId,
        solicitudId,
        ...extraerDetalleErrorSat(error),
      });

      const actualizada = await marcarSolicitudError(solicitudId, mensaje);
      await registrarBitacora({
        empresaId,
        usuarioId,
        accion: 'error',
        resultado: 'error',
        detalle: `solicitud_id=${solicitudId}: ${mensaje}`,
      });

      const status = error instanceof SatClientError ? 422 : 500;
      const code = error instanceof SatClientError ? error.code : undefined;
      return res.status(status).json({ message: mensaje, code, solicitud: actualizada });
    }

    const actualizada = await marcarSolicitudEnviada(solicitudId, resultado.requestId);

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'solicitud_creada',
      detalle: `solicitud_id=${solicitudId}, tipo=${payload.tipoDescarga}, rango=${payload.fechaInicio}..${payload.fechaFin}, sat_request_id=${resultado.requestId}`,
    });

    return res.status(201).json({ solicitud: actualizada });
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof CfdiSatValidacionError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al crear solicitud', { empresaId, solicitudId, message: error?.message });

    if (solicitudId) {
      await marcarSolicitudError(solicitudId, 'Error interno al presentar la solicitud').catch(() => {});
    }

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'error',
      resultado: 'error',
      detalle: `solicitud_id=${solicitudId ?? 'n/a'}: ${String(error?.message ?? 'Error desconocido').slice(0, 500)}`,
    }).catch(() => {});

    return res.status(500).json({ message: 'No se pudo crear la solicitud de descarga' });
  }
}

export async function verificarSolicitudController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);
  const solicitudId = getSolicitudId(req);

  try {
    await assertEsAdministrador(req);

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      return res.status(400).json({ message: 'id de solicitud inválido' });
    }

    const fielPassword = getFielPassword(req);
    if (!fielPassword) {
      return res.status(400).json({ message: 'fielPassword es obligatorio' });
    }

    const solicitud = await obtenerSolicitudPorId(solicitudId, empresaId);
    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }
    if (!solicitud.sat_request_id) {
      return res.status(422).json({ message: 'La solicitud aún no fue aceptada por el SAT' });
    }

    const { cerBuffer, keyBuffer } = await obtenerCredencialesFielListas(empresaId);

    let resultado;
    try {
      resultado = await ejecutarVerificacionSolicitud({ solicitud, cerBuffer, keyBuffer, fielPassword });
    } catch (error: any) {
      const mensaje =
        error instanceof SatClientError ? error.message : 'No se pudo verificar la solicitud ante el SAT';

      console.error('[CFDI SAT] Error al verificar solicitud ante el SAT', {
        accion: 'verificar_solicitud_sat',
        empresaId,
        solicitudId,
        satRequestId: solicitud.sat_request_id,
        ...extraerDetalleErrorSat(error),
      });

      await registrarBitacora({
        empresaId,
        usuarioId,
        accion: 'error',
        resultado: 'error',
        detalle: `solicitud_id=${solicitudId}: ${mensaje}`,
      });

      const status = error instanceof SatClientError ? 422 : 500;
      const code = error instanceof SatClientError ? error.code : undefined;
      return res.status(status).json({ message: mensaje, code });
    }

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'verificacion',
      detalle: `solicitud_id=${solicitudId}, estatus=${resultado.estatus}, paquetes=${resultado.paquetesNuevos}, cfdis=${resultado.numeroCfdis}`,
    });

    const actualizada = await obtenerSolicitudPorId(solicitudId, empresaId);
    return res.json({ solicitud: actualizada });
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof CfdiSatValidacionError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al verificar solicitud', { empresaId, solicitudId, message: error?.message });
    return res.status(500).json({ message: 'No se pudo verificar la solicitud' });
  }
}

export async function descargarSolicitudController(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const usuarioId = getUserId(req);
  const solicitudId = getSolicitudId(req);

  try {
    await assertEsAdministrador(req);

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      return res.status(400).json({ message: 'id de solicitud inválido' });
    }

    const fielPassword = getFielPassword(req);
    if (!fielPassword) {
      return res.status(400).json({ message: 'fielPassword es obligatorio' });
    }

    const solicitud = await obtenerSolicitudPorId(solicitudId, empresaId);
    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    const empresa = await obtenerEmpresaPorId(empresaId);
    if (!empresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const paquetesPendientes = await listarPaquetesPendientesOError(solicitudId);
    if (paquetesPendientes.length === 0) {
      return res.status(422).json({
        message: 'No hay paquetes pendientes de descarga para esta solicitud. Verifica la solicitud primero.',
      });
    }

    const { cerBuffer, keyBuffer } = await obtenerCredencialesFielListas(empresaId);

    const { nuevos, duplicados, paquetesConError } = await ejecutarDescargaSolicitud({
      solicitud,
      paquetesPendientes,
      empresaId,
      empresaIdentificador: empresa.identificador,
      usuarioId,
      cerBuffer,
      keyBuffer,
      fielPassword,
    });

    await registrarBitacora({
      empresaId,
      usuarioId,
      accion: 'descarga_paquete',
      detalle: `solicitud_id=${solicitudId}, paquetes_procesados=${paquetesPendientes.length}, nuevos=${nuevos}, duplicados=${duplicados}, con_error=${paquetesConError}`,
    });

    const actualizada = await obtenerSolicitudPorId(solicitudId, empresaId);
    return res.json({ solicitud: actualizada, nuevos, duplicados, paquetes_con_error: paquetesConError });
  } catch (error: any) {
    if (error instanceof CfdiSatPermisoError) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof CfdiSatValidacionError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('[CFDI SAT] Error al descargar paquetes', { empresaId, solicitudId, message: error?.message });
    return res.status(500).json({ message: 'No se pudo completar la descarga de paquetes' });
  }
}

/** Nunca exponer zip_path (ruta interna del storage privado): solo un booleano. */
function toPublicPaquete(row: CfdiSatPaqueteConConteoRow) {
  const { zip_path, ...publico } = row;
  return { ...publico, tiene_zip: Boolean(zip_path) };
}

export async function listarPaquetesDeSolicitudController(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const solicitudId = getSolicitudId(req);

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      return res.status(400).json({ message: 'id de solicitud inválido' });
    }

    const solicitud = await obtenerSolicitudPorId(solicitudId, empresaId);
    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    const paquetes = await listarPaquetesPorSolicitud(solicitudId);
    return res.json({ paquetes: paquetes.map(toPublicPaquete) });
  } catch (error) {
    console.error('[CFDI SAT] Error al listar paquetes de la solicitud', error);
    return res.status(500).json({ message: 'No se pudieron obtener los paquetes de la solicitud' });
  }
}
