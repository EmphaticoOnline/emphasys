import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const EMPRESA = 9;
const VERSION = 'dicor-documentos-empresa-v1';
type Row = Record<string, any>;

function connection(prefix: 'DICOR' | 'EMPHASYS') {
  const isSource = prefix === 'DICOR';
  const host = process.env[`${prefix}_PG_HOST`] || '127.0.0.1';
  const port = Number(process.env[`${prefix}_PG_PORT`] || '5432');
  const database = process.env[`${prefix}_PG_DATABASE`] || (isSource ? 'dev_dicor' : 'dev_emphasys');
  const user = process.env[`${prefix}_PG_USER`] || (isSource ? process.env.PG_USER : process.env.DB_USER) || process.env.USER || 'postgres';
  const password = process.env[`${prefix}_PG_PASSWORD`] || (isSource ? process.env.PG_PASSWORD : process.env.DB_PASSWORD);
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') throw new Error(`Conexión bloqueada: ${prefix} debe usar PostgreSQL local, no ${host}`);
  if (port !== 5432) throw new Error(`Conexión bloqueada: ${prefix} debe usar el puerto local 5432, no ${port}`);
  const expected = isSource ? 'dev_dicor' : 'dev_emphasys';
  if (database !== expected) throw new Error(`Conexión bloqueada: ${prefix} debe usar ${expected}, no ${database}`);
  return { host, port, database, user, password };
}

function client(prefix: 'DICOR' | 'EMPHASYS', readOnly: boolean) {
  return new Client({ ...connection(prefix), options: readOnly ? '-c default_transaction_read_only=on' : undefined });
}

const norm = (value: any) => value == null ? '' : String(value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
const hash = (row: Row) => createHash('sha256').update(JSON.stringify(row, Object.keys(row).sort())).digest('hex');
const snapshot = (row: Row) => ({ ...row, fecha_subida: row.fecha_subida instanceof Date ? row.fecha_subida.toISOString() : row.fecha_subida });
const pending = (original: string) => `DICOR_PENDIENTE/${original.replace(/^[/\\]+/, '')}`;

function uploadCandidates(original: string) {
  const configured = process.env.DICOR_UPLOAD_DIR ? [process.env.DICOR_UPLOAD_DIR] : [];
  const roots = [...configured, path.resolve(process.cwd(), '..', '..', 'uploads', 'documentos_empresa'), path.resolve(process.cwd(), '..', '..', '..', 'dicor', 'uploads', 'documentos_empresa')];
  return roots.map((root) => path.resolve(root, original));
}

async function locate(original: string) {
  for (const candidate of uploadCandidates(original)) {
    try { await fs.access(candidate); return candidate; } catch { /* continue */ }
  }
  return null;
}

async function correspondence(t: Client, type: string, id: any) {
  const q = await t.query<Row>('SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND id_origen=$3 AND empresa_destino_id=$4', ['DICOR', type, String(id), EMPRESA]);
  if (q.rowCount && q.rowCount > 1) throw new Error(`Correspondencia ambigua: ${type} ${id}`);
  return q.rows[0]?.id_destino ? Number(q.rows[0].id_destino) : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const source = client('DICOR', true);
  const target = client('EMPHASYS', !apply);
  console.log(JSON.stringify({ modo: apply ? 'apply' : 'dry-run', origen: connection('DICOR'), destino: connection('EMPHASYS') }, (key, value) => key === 'password' ? undefined : value));
  await source.connect(); await target.connect();
  const report: any = { modo: apply ? 'apply' : 'dry-run', tipos: [], documentos: [], archivos_encontrados: 0, archivos_pendientes: 0, correspondencias_tipos: 0, correspondencias_documentos: 0, problemas: [] };
  try {
    await source.query('BEGIN READ ONLY');
    const types = await source.query<Row>('SELECT id,nombre,descripcion,requiere_vigencia,dias_vigencia,activo FROM public.documentos_tipo ORDER BY id');
    const docs = await source.query<Row>('SELECT id,tipo_id,archivo_url,nombre_original,fecha_subida,fecha_vencimiento,vigente,comentarios,usuario_subio FROM public.documentos_empresa ORDER BY id');
    const targetTypes = await target.query<Row>('SELECT id,nombre,descripcion,requiere_vigencia,dias_vigencia,activo FROM documentacion.documentos_empresa_tipos WHERE empresa_id IS NULL OR empresa_id=$1 ORDER BY id', [EMPRESA]).catch(async () => target.query<Row>('SELECT id,nombre,descripcion,requiere_vigencia,dias_vigencia,activo FROM documentacion.documentos_empresa_tipos ORDER BY id'));
    const typeMap = new Map<number, number>();
    for (const type of types.rows) {
      const matches = targetTypes.rows.filter((candidate) => norm(candidate.nombre) === norm(type.nombre));
      if (matches.length > 1) throw new Error(`Tipo ambiguo ${type.id} (${type.nombre})`);
      const existing = await correspondence(target, 'documentos_empresa_tipo', type.id);
      if (existing && !matches.some((m) => Number(m.id) === existing)) throw new Error(`Correspondencia de tipo ${type.id} no coincide con su nombre`);
      const id = existing || (matches[0]?.id ? Number(matches[0].id) : null);
      if (!id) { report.problemas.push({ codigo: 'TIPO_NO_RESUELTO', id_origen: type.id, nombre: type.nombre }); continue; }
      typeMap.set(Number(type.id), id);
      report.tipos.push({ dicor_id: type.id, emphasy_id: id, nombre: type.nombre, accion: existing ? 'correspondencia_existente' : matches.length ? 'reutilizar' : 'crear' });
    }
    if (report.problemas.length) throw new Error('Existen tipos sin correspondencia inequívoca.');
    for (const doc of docs.rows) {
      const existing = await target.query<Row>(`SELECT id_destino,hash_origen FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='documentos_empresa' AND id_origen=$1 AND empresa_destino_id=$2`, [String(doc.id), EMPRESA]);
      if (existing.rowCount && existing.rowCount > 1) throw new Error(`Correspondencia ambigua para documento ${doc.id}`);
      if (existing.rows[0]) {
        const destination = await target.query<Row>('SELECT id,archivo_url FROM documentacion.documentos_empresa WHERE id=$1 AND empresa_id=$2', [existing.rows[0].id_destino, EMPRESA]);
        if (!destination.rowCount) throw new Error(`Correspondencia huérfana para documento ${doc.id}`);
        report.documentos.push({ dicor_id: doc.id, emphasy_id: existing.rows[0].id_destino, tipo_id: typeMap.get(Number(doc.tipo_id)), estado: 'sin_cambios', archivo_url: destination.rows[0].archivo_url });
        continue;
      }
      const tipo = typeMap.get(Number(doc.tipo_id));
      if (!tipo) throw new Error(`Tipo no resuelto para documento ${doc.id}`);
      const original = String(doc.archivo_url);
      const physical = await locate(original);
      const targetUrl = physical ? `9/${Date.now()}-${doc.id}${path.extname(original).toLowerCase()}` : pending(original);
      const usuario = doc.usuario_subio == null ? null : await correspondence(target, 'usuario', doc.usuario_subio);
      if (doc.usuario_subio != null && !usuario) throw new Error(`Usuario sin correspondencia para documento ${doc.id}`);
      const item = { dicor_id: doc.id, tipo_id: tipo, tipo_nombre: types.rows.find((t) => Number(t.id) === Number(doc.tipo_id))?.nombre, nombre_original: doc.nombre_original, archivo_url: targetUrl, estado_archivo: physical ? 'copiado' : 'pendiente', fecha_vencimiento: doc.fecha_vencimiento, vigente: doc.vigente, comentarios: doc.comentarios, usuario_subio_id: usuario };
      report.documentos.push(item);
      physical ? report.archivos_encontrados++ : report.archivos_pendientes++;
      if (!apply) continue;
      await target.query('BEGIN');
      try {
        if (physical) { const dir = path.resolve(process.cwd(), 'private-storage', 'documentacion', 'documentos_empresa', '9'); await fs.mkdir(dir, { recursive: true }); await fs.copyFile(physical, path.join(dir, path.basename(targetUrl))); }
        const inserted = await target.query<Row>(`INSERT INTO documentacion.documentos_empresa(empresa_id,tipo_id,archivo_url,nombre_original,fecha_subida,fecha_vencimiento,vigente,comentarios,usuario_subio_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [EMPRESA, tipo, targetUrl, doc.nombre_original, doc.fecha_subida, doc.fecha_vencimiento, doc.vigente, doc.comentarios, usuario]);
        const id = Number(inserted.rows[0].id);
        await target.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','documentos_empresa',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(doc.id), EMPRESA, id, { tipo_id: tipo, archivo: physical ? 'copiado' : 'pendiente' }, hash(doc), snapshot(doc), VERSION]);
        await target.query('COMMIT'); report.correspondencias_documentos++;
      } catch (error) { await target.query('ROLLBACK'); throw error; }
    }
    if (apply) {
      for (const type of types.rows) {
        if (await correspondence(target, 'documentos_empresa_tipo', type.id)) continue;
        const match = targetTypes.rows.find((candidate) => norm(candidate.nombre) === norm(type.nombre));
        if (!match) { const inserted = await target.query<Row>('INSERT INTO documentacion.documentos_empresa_tipos(nombre,descripcion,requiere_vigencia,dias_vigencia,activo) VALUES($1,$2,$3,$4,$5) RETURNING id', [type.nombre, type.descripcion, type.requiere_vigencia, type.dias_vigencia, type.activo]); typeMap.set(Number(type.id), Number(inserted.rows[0].id)); }
        const id = typeMap.get(Number(type.id));
        await target.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','documentos_empresa_tipo',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(type.id), EMPRESA, id, {}, hash(type), snapshot(type), VERSION]);
        report.correspondencias_tipos++;
      }
    }
    await source.query('ROLLBACK');
    console.log(JSON.stringify(report, null, 2));
  } finally { await source.end(); await target.end(); }
}

main().catch((error) => { console.error(error); process.exit(1); });
