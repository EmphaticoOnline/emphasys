import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { Request, Response } from 'express';
import pool from '../../config/database';
import { adjuntosStorageRoot, eliminarArchivosAdjuntos, resolverAdjuntoPath } from '../documentacion/adjuntos.files';

export const finanzasAdjuntoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)),
});

const projection = `a.id, a.empresa_id, a.tipo_id, a.nombre_original, a.mime_type, a.tamano,
  a.storage_key, a.fecha_vencimiento, a.comentarios, a.creado_por, a.created_at, a.updated_at,
  t.nombre AS tipo_nombre`;

async function getOperation(operacionId: number, empresaId: number) {
  const result = await pool.query(
    'SELECT id, empresa_id FROM public.finanzas_operaciones WHERE id = $1 AND empresa_id = $2',
    [operacionId, empresaId],
  );
  return result.rows[0] as { id: number; empresa_id: number } | undefined;
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function listarAdjuntosOperacion(req: any, res: Response) {
  const empresaId = req.context.empresaId as number;
  const operacionId = parseId(req.params.id);
  if (!operacionId) return res.status(400).json({ message: 'operacionId inválido' });
  if (!(await getOperation(operacionId, empresaId))) return res.status(404).json({ message: 'Operación no encontrada' });
  const result = await pool.query(
    `SELECT ${projection}
       FROM documentacion.adjuntos a
       JOIN documentacion.adjuntos_entidades ae ON ae.adjunto_id = a.id AND ae.finanzas_operacion_id = $1
       LEFT JOIN documentacion.adjuntos_tipos t ON t.id = a.tipo_id
      WHERE a.empresa_id = $2
      ORDER BY a.created_at DESC, a.id DESC`,
    [operacionId, empresaId],
  );
  return res.json(result.rows);
}

export async function subirAdjuntoOperacion(req: any, res: Response) {
  const empresaId = req.context.empresaId as number;
  const usuarioId = req.auth.userId as number;
  const operacionId = parseId(req.params.id);
  if (!operacionId) return res.status(400).json({ message: 'operacionId inválido' });
  const operation = await getOperation(operacionId, empresaId);
  if (!operation) return res.status(404).json({ message: 'Operación no encontrada' });
  if (!req.file) return res.status(400).json({ message: 'Archivo requerido o tipo no permitido' });

  const tipoId = req.body.tipo_id ? Number(req.body.tipo_id) : null;
  if (tipoId !== null && (!Number.isInteger(tipoId) || tipoId <= 0)) {
    return res.status(400).json({ message: 'Tipo de adjunto inválido' });
  }
  if (tipoId !== null) {
    const type = await pool.query(
      `SELECT 1 FROM documentacion.adjuntos_tipos t
        JOIN documentacion.adjuntos_tipos_entidades te ON te.tipo_id = t.id AND te.entidad_tipo = 'finanzas_operacion'
       WHERE t.id = $1 AND t.activo = true`,
      [tipoId],
    );
    if (!type.rowCount) return res.status(400).json({ message: 'Tipo de adjunto inválido para Finanzas' });
  }

  const storageKey = `${empresaId}/${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`;
  const physicalPath = path.join(adjuntosStorageRoot(), storageKey);
  await fs.mkdir(path.dirname(physicalPath), { recursive: true });
  await fs.writeFile(physicalPath, req.file.buffer);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const attachment = await client.query(
      `INSERT INTO documentacion.adjuntos
        (empresa_id, tipo_id, nombre_original, mime_type, tamano, storage_key,
         fecha_vencimiento, comentarios, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [empresaId, tipoId, req.file.originalname, req.file.mimetype, req.file.size, storageKey,
        req.body.fecha_vencimiento || null, req.body.comentarios || null, usuarioId],
    );
    await client.query(
      'INSERT INTO documentacion.adjuntos_entidades (adjunto_id, finanzas_operacion_id) VALUES ($1, $2)',
      [attachment.rows[0].id, operacionId],
    );
    await client.query('COMMIT');
    return res.status(201).json({ id: attachment.rows[0].id, nombre_original: req.file.originalname });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await fs.unlink(physicalPath).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function getOperationAttachment(operacionId: number, adjuntoId: number, empresaId: number) {
  const result = await pool.query(
    `SELECT a.id, a.empresa_id, a.storage_key, a.nombre_original
       FROM documentacion.adjuntos a
       JOIN documentacion.adjuntos_entidades ae ON ae.adjunto_id = a.id
      WHERE a.id = $1 AND a.empresa_id = $2 AND ae.finanzas_operacion_id = $3`,
    [adjuntoId, empresaId, operacionId],
  );
  return result.rows[0] as { id: number; empresa_id: number; storage_key: string; nombre_original: string } | undefined;
}

export async function descargarAdjuntoOperacion(req: any, res: Response) {
  const empresaId = req.context.empresaId as number;
  const operacionId = parseId(req.params.id);
  const adjuntoId = parseId(req.params.adjuntoId);
  if (!operacionId || !adjuntoId) return res.status(400).json({ message: 'Identificador inválido' });
  if (!(await getOperation(operacionId, empresaId))) return res.status(404).json({ message: 'Operación no encontrada' });
  const attachment = await getOperationAttachment(operacionId, adjuntoId, empresaId);
  if (!attachment) return res.status(404).json({ message: 'Adjunto no encontrado' });
  try {
    const physicalPath = resolverAdjuntoPath(attachment.storage_key);
    await fs.access(physicalPath);
    return res.download(physicalPath, attachment.nombre_original);
  } catch {
    return res.status(404).json({ message: 'Archivo no encontrado' });
  }
}

export async function eliminarAdjuntoOperacion(req: any, res: Response) {
  const empresaId = req.context.empresaId as number;
  const operacionId = parseId(req.params.id);
  const adjuntoId = parseId(req.params.adjuntoId);
  if (!operacionId || !adjuntoId) return res.status(400).json({ message: 'Identificador inválido' });
  if (!(await getOperation(operacionId, empresaId))) return res.status(404).json({ message: 'Operación no encontrada' });

  const client = await pool.connect();
  let attachment: { id: number; empresa_id: number; storage_key: string } | undefined;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT a.id, a.empresa_id, a.storage_key
         FROM documentacion.adjuntos a
         JOIN documentacion.adjuntos_entidades ae ON ae.adjunto_id = a.id
        WHERE a.id = $1 AND a.empresa_id = $2 AND ae.finanzas_operacion_id = $3
        FOR UPDATE`,
      [adjuntoId, empresaId, operacionId],
    );
    attachment = result.rows[0];
    if (!attachment) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Adjunto no encontrado' });
    }
    await client.query('DELETE FROM documentacion.adjuntos WHERE id = $1', [adjuntoId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const failures = await eliminarArchivosAdjuntos([{
    adjuntoId: attachment.id,
    empresaId: attachment.empresa_id,
    storageKey: attachment.storage_key,
  }]);
  if (failures) return res.status(500).json({ message: 'Adjunto eliminado, pero la limpieza física quedó pendiente y fue registrada' });
  return res.status(204).send();
}
