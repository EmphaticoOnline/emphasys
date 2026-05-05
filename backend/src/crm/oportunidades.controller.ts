import type { Request, Response } from 'express';
import pool from '../config/database';
import { formatearFolioDocumento } from '../utils/documentos';
import {
  COTIZACION_ESTADOS_SEGUIMIENTO,
  normalizarEstadoSeguimientoCotizacion,
  COTIZACION_ESTATUS_DOCUMENTO_EN_NEGOCIACION,
} from '../modules/documentos/cotizacion-status';
import { DocumentoDeleteValidationError, eliminarOportunidadConValidacion } from '../modules/documentos/documentos-delete.service';

type OportunidadVentaRow = {
  id: number;
  estatus: string | null;
  comentarios_no_cierre?: string | null;
  created_at: string | Date | null;
  fecha_cotizacion: string | Date | null;
  fecha_estimada_decision: string | Date | null;
  contacto_id: number | null;
  contacto_nombre: string | null;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  cotizacion_principal_id: number | null;
  numero: number | null;
  tipo_documento: string | null;
  serie: string | null;
  monto_oportunidad: number | string | null;
};

const ESTATUS_VALIDOS = new Set(COTIZACION_ESTADOS_SEGUIMIENTO);

function serializarOportunidad(row: OportunidadVentaRow) {
  const cotizacionPrincipalId = row.cotizacion_principal_id ?? null;
  const numeroFolio = Number(row.numero ?? cotizacionPrincipalId ?? row.id);

  return {
    id: row.id,
    folio: formatearFolioDocumento(row.serie ?? '', numeroFolio),
    cotizacion_principal_id: cotizacionPrincipalId,
    contacto_id: row.contacto_id,
    contacto_nombre: row.contacto_nombre,
    vendedor_id: row.vendedor_id,
    vendedor_nombre: row.vendedor_nombre,
    estatus: row.estatus,
    comentarios_no_cierre: row.comentarios_no_cierre ?? '',
    monto_oportunidad: row.monto_oportunidad,
    fecha_cotizacion: row.fecha_cotizacion,
    fecha_creacion: row.created_at,
    fecha_estimada_cierre: row.fecha_estimada_decision,
  };
}

export const listarOportunidadesPorConversacion = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    const conversacionIdRaw = req.query.conversacionId;
    const conversacionId = conversacionIdRaw == null ? null : Number(conversacionIdRaw);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (conversacionIdRaw != null && (!Number.isFinite(conversacionId) || Number(conversacionId) <= 0)) {
      return res.status(400).json({ message: 'conversacionId inválido' });
    }

    const params: Array<number> = [Number(empresaId)];
    const conversacionFilter = conversacionId == null
      ? ''
      : `
         AND o.conversacion_id = $2`;

    if (conversacionId != null) {
      params.push(Number(conversacionId));
    }

    const { rows } = await pool.query<OportunidadVentaRow>(
      `SELECT
         o.id,
         o.estatus,
         o.created_at,
         COALESCE(d.fecha_documento, o.created_at) AS fecha_cotizacion,
         o.fecha_estimada_decision,

         c.id AS contacto_id,
         c.nombre AS contacto_nombre,

         v.id AS vendedor_id,
         v.nombre AS vendedor_nombre,

         d.id AS cotizacion_principal_id,
         d.numero,
         d.tipo_documento,
         d.serie,
         COALESCE(SUM(
           CASE
             WHEN dp.es_parte_oportunidad IS TRUE THEN dp.subtotal_partida
             ELSE 0
           END
         ), 0) AS monto_oportunidad
       FROM crm.oportunidades_venta o
       LEFT JOIN documentos d
         ON d.id = o.cotizacion_principal_id
       LEFT JOIN documentos_partidas dp
         ON dp.documento_id = d.id
       JOIN contactos c
         ON c.id = o.contacto_id
       LEFT JOIN contactos v
         ON v.id = o.vendedor_id
       WHERE o.empresa_id = $1${conversacionFilter}
       GROUP BY
         o.id,
         o.estatus,
         o.created_at,
         d.fecha_documento,
         o.fecha_estimada_decision,
         c.id,
         c.nombre,
         v.id,
         v.nombre,
         d.id,
         d.numero,
         d.tipo_documento,
         d.serie,
         d.subtotal
       ORDER BY o.created_at DESC, o.id DESC`,
      params
    );

    return res.json(rows.map(serializarOportunidad));
  } catch (error) {
    console.error('Error al listar oportunidades por conversación:', error);
    return res.status(500).json({ message: 'Error al listar oportunidades' });
  }
};

export const obtenerOportunidadPorId = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    const oportunidadId = Number(req.params.id);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(oportunidadId) || oportunidadId <= 0) {
      return res.status(400).json({ message: 'id de oportunidad inválido' });
    }

    const { rows } = await pool.query<OportunidadVentaRow>(
      `SELECT
         o.id,
         o.estatus,
         o.comentarios_no_cierre,
         o.created_at,
         COALESCE(d.fecha_documento, o.created_at) AS fecha_cotizacion,
         o.fecha_estimada_decision,
         c.id AS contacto_id,
         c.nombre AS contacto_nombre,
         v.id AS vendedor_id,
         v.nombre AS vendedor_nombre,
         d.id AS cotizacion_principal_id,
         d.numero,
         d.tipo_documento,
         d.serie,
         COALESCE(SUM(
           CASE
             WHEN dp.es_parte_oportunidad IS TRUE THEN dp.subtotal_partida
             ELSE 0
           END
         ), 0) AS monto_oportunidad
       FROM crm.oportunidades_venta o
       LEFT JOIN documentos d
         ON d.id = o.cotizacion_principal_id
       LEFT JOIN documentos_partidas dp
         ON dp.documento_id = d.id
       JOIN contactos c
         ON c.id = o.contacto_id
       LEFT JOIN contactos v
         ON v.id = o.vendedor_id
       WHERE o.empresa_id = $1
         AND o.id = $2
       GROUP BY
         o.id,
         o.estatus,
         o.comentarios_no_cierre,
         o.created_at,
         d.fecha_documento,
         o.fecha_estimada_decision,
         c.id,
         c.nombre,
         v.id,
         v.nombre,
         d.id,
         d.numero,
         d.tipo_documento,
         d.serie
       LIMIT 1`,
      [Number(empresaId), oportunidadId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Oportunidad no encontrada' });
    }

    return res.json(serializarOportunidad(rows[0]));
  } catch (error) {
    console.error('Error al obtener oportunidad:', error);
    return res.status(500).json({ message: 'Error al obtener la oportunidad' });
  }
};

export const actualizarEstatusOportunidad = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    const oportunidadId = Number(req.params.id);
    const estatusInput = String(req.body?.estatus ?? '').trim().toLowerCase();
    const estatus = normalizarEstadoSeguimientoCotizacion(estatusInput);
    const comentariosNoCierre = typeof req.body?.comentarios_no_cierre === 'string'
      ? req.body.comentarios_no_cierre.trim()
      : '';

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(oportunidadId) || oportunidadId <= 0) {
      return res.status(400).json({ message: 'id de oportunidad inválido' });
    }

    if (!estatus || !ESTATUS_VALIDOS.has(estatus)) {
      return res.status(400).json({ message: 'estatus inválido' });
    }

    if (estatus === 'cancelada' && !comentariosNoCierre) {
      return res.status(400).json({ message: 'comentarios_no_cierre es obligatorio para cancelar una oportunidad' });
    }

    const { rows: oportunidadRows } = await pool.query<{ cotizacion_principal_id: number | null; estatus: string | null }>(
      `SELECT cotizacion_principal_id,
              estatus
       FROM crm.oportunidades_venta
       WHERE id = $1
         AND empresa_id = $2
       LIMIT 1`,
      [oportunidadId, Number(empresaId)]
    );

    if (!oportunidadRows.length) {
      return res.status(404).json({ message: 'Oportunidad no encontrada' });
    }

    const cotizacionPrincipalId = oportunidadRows[0].cotizacion_principal_id;
    const estatusAnterior = String(oportunidadRows[0].estatus ?? '').trim().toLowerCase();

    if (estatus === 'cancelada' && cotizacionPrincipalId) {
      const { rows: descendientesRows } = await pool.query<{ tiene_descendientes: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM documentos
           WHERE documento_origen_id = $1
         ) AS tiene_descendientes`,
        [cotizacionPrincipalId]
      );

      if (descendientesRows[0]?.tiene_descendientes) {
        return res.status(400).json({
          message: 'No se puede cancelar la oportunidad porque la cotización ya generó documentos.',
        });
      }
    }

    const { rows } = await pool.query<OportunidadVentaRow>(
      `WITH updated AS (
         UPDATE crm.oportunidades_venta
         SET
           estatus = $1,
           comentarios_no_cierre = $2,
           updated_at = NOW()
         WHERE id = $3
           AND empresa_id = $4
         RETURNING
           id,
           empresa_id,
           contacto_id,
           vendedor_id,
           cotizacion_principal_id,
           estatus,
           comentarios_no_cierre,
           created_at,
           fecha_estimada_decision
       )
       SELECT
         o.id,
         o.estatus,
         o.comentarios_no_cierre,
         o.created_at,
         COALESCE(d.fecha_documento, o.created_at) AS fecha_cotizacion,
         o.fecha_estimada_decision,
         c.id AS contacto_id,
         c.nombre AS contacto_nombre,
         v.id AS vendedor_id,
         v.nombre AS vendedor_nombre,
         d.id AS cotizacion_principal_id,
         d.numero,
         d.tipo_documento,
         d.serie,
         COALESCE(SUM(
           CASE
             WHEN dp.es_parte_oportunidad IS TRUE THEN dp.subtotal_partida
             ELSE 0
           END
         ), 0) AS monto_oportunidad
       FROM updated o
       LEFT JOIN documentos d
         ON d.id = o.cotizacion_principal_id
       LEFT JOIN documentos_partidas dp
         ON dp.documento_id = d.id
       JOIN contactos c
         ON c.id = o.contacto_id
       LEFT JOIN contactos v
         ON v.id = o.vendedor_id
       GROUP BY
         o.id,
         o.estatus,
         o.comentarios_no_cierre,
         o.created_at,
         d.fecha_documento,
         o.fecha_estimada_decision,
         c.id,
         c.nombre,
         v.id,
         v.nombre,
         d.id,
         d.numero,
         d.tipo_documento,
         d.serie`,
      [estatus, estatus === 'cancelada' ? comentariosNoCierre : null, oportunidadId, Number(empresaId)]
    );

    if (cotizacionPrincipalId) {
      if (estatus === 'abierta' && (estatusAnterior === 'perdida' || estatusAnterior === 'cancelada')) {
        await pool.query(
          `UPDATE documentos
              SET estado_seguimiento = $1,
                  estatus_documento = $2
            WHERE id = $3
              AND empresa_id = $4
              AND LOWER(tipo_documento) = 'cotizacion'`,
          [estatus, COTIZACION_ESTATUS_DOCUMENTO_EN_NEGOCIACION, cotizacionPrincipalId, Number(empresaId)]
        );
      } else {
        await pool.query(
          `UPDATE documentos
              SET estado_seguimiento = $1
            WHERE id = $2
              AND empresa_id = $3
              AND LOWER(tipo_documento) = 'cotizacion'`,
          [estatus, cotizacionPrincipalId, Number(empresaId)]
        );
      }
    }

    return res.json(serializarOportunidad(rows[0]));
  } catch (error) {
    console.error('Error al actualizar estatus de oportunidad:', error);
    return res.status(500).json({ message: 'Error al actualizar la oportunidad' });
  }
};

export const eliminarOportunidad = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    const oportunidadId = Number(req.params.id);

    if (!empresaId) {
      return res.status(400).json({ error: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(oportunidadId) || oportunidadId <= 0) {
      return res.status(400).json({ error: 'id de oportunidad inválido' });
    }

    const deleted = await eliminarOportunidadConValidacion(oportunidadId, Number(empresaId));
    if (!deleted) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    if (error instanceof DocumentoDeleteValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error al eliminar oportunidad:', error);
    return res.status(500).json({ error: 'Error al eliminar la oportunidad' });
  }
};