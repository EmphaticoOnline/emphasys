import pool from '../../../config/database';
import type { SatEstatusComprobante, SatEstatusVerificacion, SatTipoDescarga, SatTipoSolicitud } from './sat-client';

export type CfdiSatSolicitudEstatus =
  | 'pendiente'
  | 'solicitado'
  | 'en_proceso'
  | 'terminado'
  | 'sin_resultados'
  | 'error'
  | 'expirado'
  | 'rechazado';

export interface CfdiSatSolicitudRow {
  id: number;
  empresa_id: number;
  usuario_id: number;
  tipo_descarga: SatTipoDescarga;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_solicitud: SatTipoSolicitud;
  estatus_comprobante: SatEstatusComprobante | null;
  sat_request_id: string | null;
  estatus: CfdiSatSolicitudEstatus;
  mensaje_error: string | null;
  cfdis_encontrados: number | null;
  creado_en: string;
  solicitado_en: string | null;
  verificado_en: string | null;
  /** Solo presentes en listarSolicitudes()/obtenerSolicitudPorId() (calculados por JOIN). */
  total_paquetes?: number;
  total_comprobantes?: number;
}

const SELECT_CON_CONTEOS = `
  SELECT s.id, s.empresa_id, s.usuario_id, s.tipo_descarga, s.fecha_inicio, s.fecha_fin,
         s.tipo_solicitud, s.estatus_comprobante, s.sat_request_id, s.estatus,
         s.mensaje_error, s.cfdis_encontrados, s.creado_en, s.solicitado_en, s.verificado_en,
         COALESCE(p.total_paquetes, 0) AS total_paquetes,
         COALESCE(c.total_comprobantes, 0) AS total_comprobantes
    FROM core.cfdi_sat_solicitudes s
    LEFT JOIN (
      SELECT solicitud_id, COUNT(*) AS total_paquetes
        FROM core.cfdi_sat_paquetes
       GROUP BY solicitud_id
    ) p ON p.solicitud_id = s.id
    LEFT JOIN (
      SELECT solicitud_id, COUNT(*) AS total_comprobantes
        FROM core.cfdi_sat_comprobantes
       GROUP BY solicitud_id
    ) c ON c.solicitud_id = s.id
`;

interface CrearSolicitudPendienteParams {
  empresaId: number;
  usuarioId: number;
  tipoDescarga: SatTipoDescarga;
  fechaInicio: string;
  fechaFin: string;
  tipoSolicitud: SatTipoSolicitud;
  estatusComprobante: SatEstatusComprobante | null;
}

export async function crearSolicitudPendiente(params: CrearSolicitudPendienteParams): Promise<CfdiSatSolicitudRow> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `INSERT INTO core.cfdi_sat_solicitudes
       (empresa_id, usuario_id, tipo_descarga, fecha_inicio, fecha_fin,
        tipo_solicitud, estatus_comprobante, estatus)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
     RETURNING *`,
    [
      params.empresaId,
      params.usuarioId,
      params.tipoDescarga,
      params.fechaInicio,
      params.fechaFin,
      params.tipoSolicitud,
      params.estatusComprobante,
    ]
  );

  return rows[0];
}

export async function marcarSolicitudEnviada(id: number, satRequestId: string): Promise<CfdiSatSolicitudRow> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `UPDATE core.cfdi_sat_solicitudes
        SET estatus = 'solicitado',
            sat_request_id = $2,
            solicitado_en = NOW(),
            mensaje_error = NULL
      WHERE id = $1
      RETURNING *`,
    [id, satRequestId]
  );

  return rows[0];
}

export async function marcarSolicitudError(
  id: number,
  mensajeError: string,
  estatus: Extract<CfdiSatSolicitudEstatus, 'error' | 'rechazado'> = 'error'
): Promise<CfdiSatSolicitudRow> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `UPDATE core.cfdi_sat_solicitudes
        SET estatus = $2,
            mensaje_error = $3
      WHERE id = $1
      RETURNING *`,
    [id, estatus, mensajeError.slice(0, 1000)]
  );

  return rows[0];
}

interface ActualizarTrasVerificacionParams {
  estatus: SatEstatusVerificacion;
  cfdisEncontrados: number;
  mensajeError: string | null;
}

/**
 * Aplica el resultado de verify() a la solicitud. mensajeError debe venir ya
 * saneado por el llamador (nunca debe contener la contraseña de la FIEL).
 */
export async function actualizarSolicitudTrasVerificacion(
  id: number,
  params: ActualizarTrasVerificacionParams
): Promise<CfdiSatSolicitudRow> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `UPDATE core.cfdi_sat_solicitudes
        SET estatus = $2,
            cfdis_encontrados = $3,
            mensaje_error = $4,
            verificado_en = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, params.estatus, params.cfdisEncontrados, params.mensajeError ? params.mensajeError.slice(0, 1000) : null]
  );

  return rows[0];
}

export async function listarSolicitudes(empresaId: number): Promise<CfdiSatSolicitudRow[]> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `${SELECT_CON_CONTEOS}
      WHERE s.empresa_id = $1
      ORDER BY s.creado_en DESC
      LIMIT 100`,
    [empresaId]
  );

  return rows;
}

export async function obtenerSolicitudPorId(id: number, empresaId: number): Promise<CfdiSatSolicitudRow | null> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `${SELECT_CON_CONTEOS}
      WHERE s.id = $1
        AND s.empresa_id = $2
      LIMIT 1`,
    [id, empresaId]
  );

  return rows[0] ?? null;
}

/**
 * Solicitudes de la empresa listas para volver a preguntarle al SAT su estatus
 * (ya fueron aceptadas y aún no llegaron a un estatus terminal). Usada por la
 * ejecución asistida de Fase 9 — nunca reintenta rechazado/expirado/error/
 * sin_resultados/terminado, que son estatus terminales.
 */
export async function listarSolicitudesParaVerificar(empresaId: number): Promise<CfdiSatSolicitudRow[]> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `${SELECT_CON_CONTEOS}
      WHERE s.empresa_id = $1
        AND s.estatus IN ('solicitado', 'en_proceso')
        AND s.sat_request_id IS NOT NULL
      ORDER BY s.creado_en ASC`,
    [empresaId]
  );

  return rows;
}

/**
 * Solicitudes ya terminadas de la empresa que todavía tienen paquetes
 * pendientes o con error de descarga. Usada por la ejecución asistida de
 * Fase 9 para saber a cuáles vale la pena intentarles download() de nuevo.
 */
export async function listarSolicitudesConPaquetesPendientes(empresaId: number): Promise<CfdiSatSolicitudRow[]> {
  const { rows } = await pool.query<CfdiSatSolicitudRow>(
    `${SELECT_CON_CONTEOS}
      WHERE s.empresa_id = $1
        AND s.estatus = 'terminado'
        AND EXISTS (
          SELECT 1 FROM core.cfdi_sat_paquetes p
           WHERE p.solicitud_id = s.id
             AND p.estatus IN ('pendiente', 'error')
        )
      ORDER BY s.creado_en ASC`,
    [empresaId]
  );

  return rows;
}
