import type { Request, Response } from 'express';
import pool from '../config/database';

export const listarOportunidadesPorConversacion = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId;
    const conversacionId = Number(req.query.conversacionId);

    if (!empresaId) {
      return res.status(400).json({ message: 'empresaId no disponible en contexto' });
    }

    if (!Number.isFinite(conversacionId) || conversacionId <= 0) {
      return res.status(400).json({ message: 'conversacionId inválido' });
    }

    const { rows } = await pool.query(
      `SELECT
         ov.id,
         ov.estatus,
         ov.monto_estimado,
         d.serie,
         d.numero
       FROM crm.oportunidades_venta ov
       LEFT JOIN documentos d
         ON d.id = ov.cotizacion_principal_id
        AND d.empresa_id = ov.empresa_id
       WHERE ov.empresa_id = $1
         AND ov.conversacion_id = $2
       ORDER BY ov.created_at DESC, ov.id DESC`,
      [Number(empresaId), conversacionId]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Error al listar oportunidades por conversación:', error);
    return res.status(500).json({ message: 'Error al listar oportunidades' });
  }
};