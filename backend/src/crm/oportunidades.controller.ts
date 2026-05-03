import type { Request, Response } from 'express';
import pool from '../config/database';
import { formatearFolioDocumento } from '../utils/documentos';
import {
  COTIZACION_ESTADOS_SEGUIMIENTO,
  normalizarEstadoSeguimientoCotizacion,
  COTIZACION_ESTATUS_DOCUMENTO_EN_NEGOCIACION,
} from '../modules/documentos/cotizacion-status';

type OportunidadVentaRow = {
  id: number;
  estatus: string | null;
  comentarios_no_cierre?: string | null;
  created_at: string | Date | null;
  fecha_estimada_decision: string | Date | null;
  contacto_id: number | null;
  contacto_nombre: string | null;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  cotizacion_principal_id: number | null;
  numero: number | null;
  tipo_documento: string | null;
  serie: string | null;
  monto_estimado: number | null;
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
    monto_estimado: row.monto_estimado,
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
         o.fecha_estimada_decision,

         c.id AS contacto_id,
         c.nombre AS contacto_nombre,

         v.id AS vendedor_id,
         v.nombre AS vendedor_nombre,

         d.id AS cotizacion_principal_id,
         d.numero,
         d.tipo_documento,
         d.serie,
         d.subtotal AS monto_estimado
       FROM crm.oportunidades_venta o
       JOIN documentos d
         ON d.id = o.cotizacion_principal_id
       JOIN contactos c
         ON c.id = o.contacto_id
       LEFT JOIN contactos v
         ON v.id = o.vendedor_id
       WHERE o.empresa_id = $1${conversacionFilter}
       ORDER BY o.created_at DESC, o.id DESC`,
      params
    );

    return res.json(rows.map(serializarOportunidad));
  } catch (error) {
    console.error('Error al listar oportunidades por conversación:', error);
    return res.status(500).json({ message: 'Error al listar oportunidades' });
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
           fecha_estimada_decision,
           monto_estimado
       )
       SELECT
         o.id,
         o.estatus,
         o.comentarios_no_cierre,
         o.created_at,
         o.fecha_estimada_decision,
         c.id AS contacto_id,
         c.nombre AS contacto_nombre,
         v.id AS vendedor_id,
         v.nombre AS vendedor_nombre,
         d.id AS cotizacion_principal_id,
         d.numero,
         d.tipo_documento,
         d.serie,
         COALESCE(d.subtotal, o.monto_estimado) AS monto_estimado
       FROM updated o
       JOIN documentos d
         ON d.id = o.cotizacion_principal_id
       JOIN contactos c
         ON c.id = o.contacto_id
       LEFT JOIN contactos v
         ON v.id = o.vendedor_id`,
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