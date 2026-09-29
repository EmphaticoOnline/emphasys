import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { requireAuth, requireEmpresaActiva } from '../auth/auth.middleware';
import pool from '../../config/database';
import { resolverAdjuntoPath, adjuntosStorageRoot, eliminarArchivosAdjuntos } from './adjuntos.files';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['application/pdf','image/png','image/jpeg','image/webp'].includes(file.mimetype)) });
router.use(requireAuth, requireEmpresaActiva);
const projection = `a.id,a.empresa_id,a.tipo_id,a.nombre_original,a.mime_type,a.tamano,a.storage_key,a.fecha_vencimiento,a.comentarios,a.creado_por,a.created_at,a.updated_at,t.nombre AS tipo_nombre,u.nombre AS usuario_nombre,u.email AS usuario_email`;
const entityType = (v: string) => ['empresa','documento','contacto','finanzas_operacion'].includes(v) ? v : null;

router.get('/tipos', async (req: any, res) => {
  const entidad = entityType(String(req.query.entidad_tipo || ''));
  const sql = entidad ? `SELECT t.id,t.nombre,t.descripcion,t.activo FROM documentacion.adjuntos_tipos t JOIN documentacion.adjuntos_tipos_entidades e ON e.tipo_id=t.id AND e.entidad_tipo=$1 WHERE t.activo=true ORDER BY t.nombre` : `SELECT id,nombre,descripcion,activo FROM documentacion.adjuntos_tipos WHERE activo=true ORDER BY nombre`;
  const r = await pool.query(sql, entidad ? [entidad] : []); res.json(r.rows);
});
router.get('/', async (req: any, res) => { const r = await pool.query(`SELECT ${projection} FROM documentacion.adjuntos a LEFT JOIN documentacion.adjuntos_tipos t ON t.id=a.tipo_id LEFT JOIN core.usuarios u ON u.id=a.creado_por WHERE a.empresa_id=$1 ORDER BY a.created_at DESC`, [req.context.empresaId]); res.json(r.rows); });
router.get('/:id', async (req: any, res) => { const r = await pool.query(`SELECT ${projection} FROM documentacion.adjuntos a LEFT JOIN documentacion.adjuntos_tipos t ON t.id=a.tipo_id LEFT JOIN core.usuarios u ON u.id=a.creado_por WHERE a.id=$1 AND a.empresa_id=$2`, [req.params.id,req.context.empresaId]); if (!r.rowCount) return res.status(404).json({message:'Adjunto no encontrado'}); return res.json(r.rows[0]); });
router.get('/:id/archivo', async (req: any, res) => { const r = await pool.query('SELECT storage_key,nombre_original FROM documentacion.adjuntos WHERE id=$1 AND empresa_id=$2', [req.params.id,req.context.empresaId]); if (!r.rowCount) return res.status(404).json({message:'Adjunto no encontrado'}); try { const file=resolverAdjuntoPath(r.rows[0].storage_key); await fs.access(file); return res.download(file,r.rows[0].nombre_original); } catch { return res.status(404).json({message:'Archivo no encontrado'}); } });
router.post('/', upload.single('archivo'), async (req: any, res) => { if (!req.file) return res.status(400).json({message:'Archivo requerido o tipo no permitido'}); const tipoId=req.body.tipo_id?Number(req.body.tipo_id):null; if (tipoId) { const t=await pool.query('SELECT 1 FROM documentacion.adjuntos_tipos WHERE id=$1 AND activo=true',[tipoId]); if (!t.rowCount) return res.status(400).json({message:'Tipo de adjunto inválido'}); } const key=`${req.context.empresaId}/${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`; const file=path.join(adjuntosStorageRoot(),key); await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,req.file.buffer); try { const r=await pool.query(`INSERT INTO documentacion.adjuntos(empresa_id,tipo_id,nombre_original,mime_type,tamano,storage_key,fecha_vencimiento,comentarios,creado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.context.empresaId,tipoId,req.file.originalname,req.file.mimetype,req.file.size,key,req.body.fecha_vencimiento||null,req.body.comentarios||null,req.auth.userId]); return res.status(201).json(r.rows[0]); } catch (error) { await fs.unlink(file).catch(()=>undefined); throw error; } });
router.delete('/:id', async (req: any, res) => { const client=await pool.connect(); try { await client.query('BEGIN'); const r=await client.query('SELECT id,empresa_id,storage_key FROM documentacion.adjuntos WHERE id=$1 AND empresa_id=$2 FOR UPDATE',[req.params.id,req.context.empresaId]); if (!r.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({message:'Adjunto no encontrado'}); } await client.query('DELETE FROM documentacion.adjuntos WHERE id=$1',[req.params.id]); await client.query('COMMIT'); const failures=await eliminarArchivosAdjuntos([{adjuntoId:r.rows[0].id,empresaId:r.rows[0].empresa_id,storageKey:r.rows[0].storage_key}]); if (failures) return res.status(500).json({message:'Adjunto eliminado, pero la limpieza física quedó pendiente y fue registrada'}); return res.status(204).send(); } catch(e) { await client.query('ROLLBACK').catch(()=>undefined); throw e; } finally { client.release(); } });
export default router;
