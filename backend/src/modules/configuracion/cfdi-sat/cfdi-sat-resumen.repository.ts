import pool from '../../../config/database';

export interface ResumenSolicitudes {
  total: number;
  en_proceso: number;
  terminadas: number;
  con_error: number;
}

export interface ResumenComprobantes {
  total: number;
  recibidos: number;
  importados: number;
  pendientes_importar: number;
}

export interface ResumenModulo {
  solicitudes: ResumenSolicitudes;
  comprobantes: ResumenComprobantes;
  paquetes_con_error: number;
}

/**
 * Agrega los conteos usados tanto por el resumen ejecutivo como por las
 * alertas operativas de la pantalla principal, en una sola consulta por
 * entidad (evita repetir la misma agregación en dos endpoints separados).
 */
export async function obtenerResumenModulo(empresaId: number): Promise<ResumenModulo> {
  const [solicitudesResult, comprobantesResult, paquetesResult] = await Promise.all([
    pool.query<{ total: string; en_proceso: string; terminadas: string; con_error: string }>(
      `SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estatus IN ('pendiente', 'solicitado', 'en_proceso')) AS en_proceso,
          COUNT(*) FILTER (WHERE estatus = 'terminado') AS terminadas,
          COUNT(*) FILTER (WHERE estatus IN ('error', 'rechazado', 'expirado')) AS con_error
         FROM core.cfdi_sat_solicitudes
        WHERE empresa_id = $1`,
      [empresaId]
    ),
    pool.query<{ total: string; recibidos: string; importados: string; pendientes_importar: string }>(
      `SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE tipo_descarga = 'recibidos') AS recibidos,
          COUNT(*) FILTER (WHERE importado_compras = true) AS importados,
          COUNT(*) FILTER (
            WHERE tipo_descarga = 'recibidos'
              AND tipo_comprobante = 'I'
              AND importado_compras = false
              AND xml_path IS NOT NULL
              AND (estatus_sat IS NULL OR estatus_sat <> 'cancelado')
          ) AS pendientes_importar
         FROM core.cfdi_sat_comprobantes
        WHERE empresa_id = $1`,
      [empresaId]
    ),
    pool.query<{ con_error: string }>(
      `SELECT COUNT(*) AS con_error
         FROM core.cfdi_sat_paquetes p
         JOIN core.cfdi_sat_solicitudes s ON s.id = p.solicitud_id
        WHERE s.empresa_id = $1
          AND p.estatus = 'error'`,
      [empresaId]
    ),
  ]);

  const solicitudesRow = solicitudesResult.rows[0];
  const comprobantesRow = comprobantesResult.rows[0];

  return {
    solicitudes: {
      total: Number(solicitudesRow?.total ?? 0),
      en_proceso: Number(solicitudesRow?.en_proceso ?? 0),
      terminadas: Number(solicitudesRow?.terminadas ?? 0),
      con_error: Number(solicitudesRow?.con_error ?? 0),
    },
    comprobantes: {
      total: Number(comprobantesRow?.total ?? 0),
      recibidos: Number(comprobantesRow?.recibidos ?? 0),
      importados: Number(comprobantesRow?.importados ?? 0),
      pendientes_importar: Number(comprobantesRow?.pendientes_importar ?? 0),
    },
    paquetes_con_error: Number(paquetesResult.rows[0]?.con_error ?? 0),
  };
}
