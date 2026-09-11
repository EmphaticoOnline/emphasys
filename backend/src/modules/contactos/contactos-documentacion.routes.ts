import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import pool from '../../config/database';

const router = Router();
const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, allowed.has(file.mimetype)) });
const root = () => path.resolve(process.env.DOCUMENTACION_CONTACTOS_STORAGE_DIR || path.join(process.cwd(), 'private-storage', 'documentacion', 'contactos'));
const isPreviewable = (mime: string) => mime === 'application/pdf' || mime.startsWith('image/');
const belongsToContact = async (empresaId: number, contactoId: number) => (await pool.query('SELECT id FROM public.contactos WHERE id=$1 AND empresa_id=$2', [contactoId, empresaId])).rowCount === 1;

router.use(requireAuth, requireEmpresaActiva);
router.get('/tipos-documentacion', async (_req, res) => {
  const result = await pool.query('SELECT id,nombre,orden FROM public.contactos_documentacion_tipos WHERE activo=true ORDER BY orden,nombre,id');
  res.json(result.rows);
});
router.get('/tipos-documentacion/admin', async (_req, res) => {
  const result = await pool.query('SELECT id,nombre,orden,activo,created_at,updated_at FROM public.contactos_documentacion_tipos ORDER BY orden,nombre,id');
  res.json(result.rows);
});
router.post('/tipos-documentacion', async (req: any, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const orden = Number(req.body?.orden ?? 100);
  if (!nombre) return res.status(400).json({ message: 'El nombre es requerido' });
  if (!Number.isInteger(orden) || orden < 0) return res.status(400).json({ message: 'El orden debe ser un entero no negativo' });
  try {
    const result = await pool.query('INSERT INTO public.contactos_documentacion_tipos (nombre,orden,activo) VALUES($1,$2,$3) RETURNING *', [nombre, orden, req.body?.activo !== false]);
    return res.status(201).json(result.rows[0]);
  } catch (error: any) { if (error?.code === '23505') return res.status(409).json({ message: 'Ya existe un tipo de documentación con ese nombre' }); throw error; }
});
router.put('/tipos-documentacion/:id', async (req: any, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const orden = Number(req.body?.orden ?? 100);
  if (!nombre) return res.status(400).json({ message: 'El nombre es requerido' });
  if (!Number.isInteger(orden) || orden < 0) return res.status(400).json({ message: 'El orden debe ser un entero no negativo' });
  try {
    const result = await pool.query('UPDATE public.contactos_documentacion_tipos SET nombre=$1,orden=$2,activo=$3,updated_at=now() WHERE id=$4 RETURNING *', [nombre, orden, req.body?.activo !== false, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Tipo de documentación no encontrado' });
    return res.json(result.rows[0]);
  } catch (error: any) { if (error?.code === '23505') return res.status(409).json({ message: 'Ya existe un tipo de documentación con ese nombre' }); throw error; }
});
router.patch('/tipos-documentacion/:id/estado', async (req: any, res) => {
  const result = await pool.query('UPDATE public.contactos_documentacion_tipos SET activo=$1,updated_at=now() WHERE id=$2 RETURNING *', [req.body?.activo === true, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Tipo de documentación no encontrado' });
  res.json(result.rows[0]);
});
router.get('/:contactoId/documentacion', async (req: any, res) => {
  if (!(await belongsToContact(req.context.empresaId, Number(req.params.contactoId)))) return res.status(404).json({ message: 'Contacto no encontrado' });
  const result = await pool.query(`SELECT d.id,t.nombre AS tipo,d.nombre_original,d.mime_type,d.tamano,d.fecha_vencimiento,d.comentarios,d.created_at AS fecha_subida,u.nombre AS usuario_nombre,u.email AS usuario_email
    FROM public.contactos_documentacion d JOIN public.contactos_documentacion_tipos t ON t.id=d.tipo_id LEFT JOIN core.usuarios u ON u.id=d.creado_por
    WHERE d.empresa_id=$1 AND d.contacto_id=$2 ORDER BY d.created_at DESC`, [req.context.empresaId, req.params.contactoId]);
  res.json(result.rows.map((row) => ({ ...row, preview_posible: isPreviewable(row.mime_type) })));
});
router.post('/:contactoId/documentacion', upload.single('archivo'), async (req: any, res) => {
  const empresaId = Number(req.context.empresaId), contactoId = Number(req.params.contactoId);
  if (!(await belongsToContact(empresaId, contactoId))) return res.status(404).json({ message: 'Contacto no encontrado' });
  if (!req.file) return res.status(400).json({ message: 'Archivo requerido o tipo no permitido' });
  const tipo = await pool.query('SELECT id FROM public.contactos_documentacion_tipos WHERE id=$1 AND activo=true', [req.body.tipo_id]);
  if (!tipo.rowCount) return res.status(400).json({ message: 'Tipo de documentación inválido' });
  const key = `${empresaId}/${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`;
  const file = path.join(root(), key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, req.file.buffer);
  try {
    const result = await pool.query(`INSERT INTO public.contactos_documentacion (empresa_id,contacto_id,tipo_id,nombre_original,mime_type,tamano,storage_key,fecha_vencimiento,comentarios,creado_por)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [empresaId, contactoId, req.body.tipo_id, req.file.originalname, req.file.mimetype, req.file.size, key, req.body.fecha_vencimiento || null, req.body.comentarios || null, req.auth.userId]);
    return res.status(201).json({ id: result.rows[0].id });
  } catch (error) { await fs.unlink(file).catch(() => undefined); throw error; }
});
router.get('/:contactoId/documentacion/:documentacionId/archivo', async (req: any, res) => {
  const result = await pool.query('SELECT storage_key,nombre_original,mime_type FROM public.contactos_documentacion WHERE id=$1 AND empresa_id=$2 AND contacto_id=$3', [req.params.documentacionId, req.context.empresaId, req.params.contactoId]);
  if (!result.rowCount) return res.status(404).json({ message: 'Documentación no encontrada' });
  const file = path.resolve(root(), result.rows[0].storage_key);
  if (!file.startsWith(`${root()}${path.sep}`)) return res.status(400).json({ message: 'Ruta inválida' });
  try { await fs.access(file); res.setHeader('Content-Type', result.rows[0].mime_type); return res.download(file, result.rows[0].nombre_original); } catch { return res.status(404).json({ message: 'Archivo no encontrado' }); }
});
router.delete('/:contactoId/documentacion/:documentacionId', async (req: any, res) => {
  const result = await pool.query('SELECT storage_key FROM public.contactos_documentacion WHERE id=$1 AND empresa_id=$2 AND contacto_id=$3', [req.params.documentacionId, req.context.empresaId, req.params.contactoId]);
  if (!result.rowCount) return res.status(404).json({ message: 'Documentación no encontrada' });
  await pool.query('DELETE FROM public.contactos_documentacion WHERE id=$1 AND empresa_id=$2 AND contacto_id=$3', [req.params.documentacionId, req.context.empresaId, req.params.contactoId]);
  const file = path.resolve(root(), result.rows[0].storage_key); if (file.startsWith(`${root()}${path.sep}`)) await fs.unlink(file).catch(() => undefined);
  return res.status(204).send();
});
export default router;
