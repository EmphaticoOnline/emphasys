import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import pool from '../../config/database';
import { adjuntoPhysicalPath, adjuntosStorageRoot, eliminarArchivosAdjuntos } from './adjuntos.files';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype)) });
const root = adjuntosStorageRoot;
const safeName = (name: string) => `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(name).toLowerCase()}`;
const parseOptionalInteger = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('documento_id debe ser un entero válido');
  return parsed;
};

router.use(requireAuth, requireEmpresaActiva);

const projection = `
  d.id, d.empresa_id, d.tipo_id, d.documento_id, d.archivo_url,
  d.nombre_original, d.fecha_subida, d.fecha_vencimiento, d.vigente,
  d.comentarios, d.usuario_subio_id,
  t.nombre AS tipo_nombre,
  u.nombre AS usuario_nombre, u.email AS usuario_email`;

router.get('/tipos', async (_req, res) => {
  const r = await pool.query('SELECT id,nombre,descripcion,requiere_vigencia,dias_vigencia,activo FROM documentacion.documentos_empresa_tipos WHERE activo=true ORDER BY nombre');
  res.json(r.rows);
});

router.get('/', async (req: any, res) => {
  const r = await pool.query(`SELECT ${projection} FROM documentacion.adjuntos d JOIN documentacion.documentos_empresa_tipos t ON t.id=d.tipo_id LEFT JOIN core.usuarios u ON u.id=d.usuario_subio_id WHERE d.empresa_id=$1 ORDER BY d.fecha_subida DESC`, [req.context.empresaId]);
  res.json(r.rows);
});

router.get('/:id', async (req: any, res) => {
  const r = await pool.query(`SELECT ${projection} FROM documentacion.adjuntos d JOIN documentacion.documentos_empresa_tipos t ON t.id=d.tipo_id LEFT JOIN core.usuarios u ON u.id=d.usuario_subio_id WHERE d.id=$1 AND d.empresa_id=$2`, [req.params.id, req.context.empresaId]);
  if (!r.rowCount) return res.status(404).json({ message: 'Adjunto no encontrado' });
  return res.json(r.rows[0]);
});

router.get('/:id/archivo', async (req: any, res) => {
  const r = await pool.query('SELECT archivo_url,nombre_original FROM documentacion.adjuntos WHERE id=$1 AND empresa_id=$2', [req.params.id, req.context.empresaId]);
  if (!r.rowCount) return res.status(404).json({ message: 'Adjunto no encontrado' });
  if (String(r.rows[0].archivo_url).startsWith('DICOR_PENDIENTE/')) return res.status(409).json({ message: 'El archivo físico de este adjunto está pendiente de migración.' });
  const base = path.resolve(root());
  const file = adjuntoPhysicalPath(r.rows[0].archivo_url);
  if (!file.startsWith(`${base}${path.sep}`)) return res.status(400).json({ message: 'Ruta inválida' });
  try { await fs.access(file); return res.download(file, r.rows[0].nombre_original); } catch { return res.status(404).json({ message: 'Archivo no encontrado' }); }
});

router.post('/', upload.single('archivo'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo requerido o tipo no permitido' });
  let documentoId: number | null;
  try { documentoId = parseOptionalInteger(req.body.documento_id); } catch (error) { return res.status(400).json({ message: (error as Error).message }); }
  if (documentoId !== null) {
    const documento = await pool.query('SELECT 1 FROM public.documentos WHERE id=$1 AND empresa_id=$2', [documentoId, req.context.empresaId]);
    if (!documento.rowCount) return res.status(400).json({ message: 'El documento no existe o no pertenece a la empresa activa' });
  }
  const tipo = await pool.query('SELECT id FROM documentacion.documentos_empresa_tipos WHERE id=$1 AND activo=true', [req.body.tipo_id]);
  if (!tipo.rowCount) return res.status(400).json({ message: 'Tipo de documento inválido' });
  const dir = path.join(root(), String(req.context.empresaId));
  await fs.mkdir(dir, { recursive: true });
  const filename = safeName(req.file.originalname);
  const physicalFile = path.join(dir, filename);
  await fs.writeFile(physicalFile, req.file.buffer);
  try {
    const r = await pool.query(`INSERT INTO documentacion.adjuntos(empresa_id,tipo_id,documento_id,archivo_url,nombre_original,fecha_vencimiento,comentarios,usuario_subio_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,empresa_id,tipo_id,documento_id,archivo_url,nombre_original,fecha_subida,fecha_vencimiento,vigente,comentarios,usuario_subio_id`, [req.context.empresaId, req.body.tipo_id, documentoId, path.join(String(req.context.empresaId), filename).replace(/\\/g, '/'), req.file.originalname, req.body.fecha_vencimiento || null, req.body.comentarios || null, req.auth.userId]);
    return res.status(201).json(r.rows[0]);
  } catch (error) { await fs.unlink(physicalFile).catch(() => undefined); throw error; }
});

router.delete('/:id', async (req: any, res) => {
  const r = await pool.query('SELECT id,documento_id,empresa_id,archivo_url FROM documentacion.adjuntos WHERE id=$1 AND empresa_id=$2', [req.params.id, req.context.empresaId]);
  if (!r.rowCount) return res.status(404).json({ message: 'Adjunto no encontrado' });
  await pool.query('DELETE FROM documentacion.adjuntos WHERE id=$1 AND empresa_id=$2', [req.params.id, req.context.empresaId]);
  try {
    const failures = await eliminarArchivosAdjuntos([{ adjuntoId: r.rows[0].id, documentoId: r.rows[0].documento_id, empresaId: r.rows[0].empresa_id, archivoUrl: r.rows[0].archivo_url }]);
    if (failures > 0) return res.status(500).json({ message: 'Adjunto eliminado, pero la limpieza física quedó pendiente y fue registrada' });
  } catch { return res.status(500).json({ message: 'Adjunto eliminado, pero la ruta física era inválida' }); }
  return res.status(204).send();
});

export default router;
