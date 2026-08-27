import {
Client
} from 'pg';

const EMPRESA = 9;
const VERSION = 'dicor-conciliacion-v2';
const APPLY = process.argv.includes('--apply');
const ID_ARG = process.argv.find((arg) => arg.startsWith('--id='));
const ONLY_ID = ID_ARG ? Number(ID_ARG.slice(5)) : null;
type Row = Record<string, any>;
type IdMap = Map<number, number>;

function client(prefix: 'DICOR' | 'EMPHASYS', readOnly: boolean) {
  const get = (name: string, fallback?: string) => process.env[`${prefix}_PG_${name}`] || fallback;
  return new Client({
host: get('HOST', 'localhost'), port: Number(get('PORT', '5432')), database: get('DATABASE', prefix === 'DICOR' ? 'dev_dicor' : 'dev_emphasys'), user: get('USER', process.env.USER), password: get('PASSWORD'), options: readOnly ? '-c default_transaction_read_only=on' : undefined
});
}
const hash = (r: Row) => JSON.stringify(r, Object.keys(r).sort());
const snapshot = (r: Row) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? null : typeof v === 'number' ? String(v) : v]));
const jsonParam = (value: unknown) => JSON.stringify(value == null ? {} : value);
const report: Row = {
modo: APPLY ? 'apply' : 'dry-run', importaciones: 0, movimientos: 0, relaciones: 0, conciliaciones: 0, relaciones_conciliaciones: 0, activas: 0, anuladas: 0, excepciones: []
};
let source: Client;
let target: Client;

async function correspondence(type: string, id: unknown): Promise<number | null> {
  if (id == null) return null;
  const q = await target.query<Row>('SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND id_origen=$3 AND empresa_destino_id=$4', ['DICOR', type, String(id), EMPRESA]);
  return q.rows[0] ? Number(q.rows[0].id_destino) : null;
}
async function preserveHistoricalUsers(row: Row, ids: unknown[]) {
  const unique = [...new Set(ids.filter((id) => id != null).map(Number))];
  if (!unique.length) return;
  const users = await source.query<Row>('SELECT id,nombre,login,correo,rol_id FROM usuarios WHERE id = ANY($1::int[])', [unique]);
  row.usuario_historico = users.rows.map((u) => ({ usuario_dicor_id: u.id, nombre: u.nombre, login: u.login, correo: u.correo, rol_id: u.rol_id }));
}
async function resolveUser(id: unknown, row: Row, field: string): Promise<number | null> {
  if (id == null) return null;
  const mapped = await correspondence('usuario', id);
  if (mapped) return mapped;
  await preserveHistoricalUsers(row, [id]);
  row.usuario_historico = (row.usuario_historico || []).map((u: Row) => ({ ...u, campo: field }));
  return null;
}
async function aliasCorrespondence(type: string, id: unknown): Promise<number | null> {
  if (id == null) return null;
  const q = await target.query<Row>('SELECT id_destino_canonico FROM migrate.entidades_alias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND id_origen=$3 AND empresa_destino_id=$4', ['DICOR', type, String(id), EMPRESA]);
  return q.rows[0] ? Number(q.rows[0].id_destino_canonico) : null;
}
async function saveCorrespondence(type: string, row: Row, id: number) {
  const origin = await target.query<Row>('SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND id_origen=$3 AND empresa_destino_id=$4', ['DICOR', type, String(row.id), EMPRESA]);
  if (origin.rows[0]) {
    if (Number(origin.rows[0].id_destino) !== id) throw new Error(`Correspondencia inconsistente: ${type} DICOR ${row.id} apunta a ${origin.rows[0].id_destino}, no a ${id}`);
    return;
  }
  const destination = await target.query<Row>('SELECT id_origen FROM migrate.entidades_correspondencias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND empresa_destino_id=$3 AND id_destino=$4', ['DICOR', type, EMPRESA, id]);
  if (destination.rows[0]) {
    if (type !== 'importacion_bancaria') throw new Error(`Colisión de correspondencia: ${type} destino ${id} ya pertenece a DICOR ${destination.rows[0].id_origen}`);
    const physical = await target.query<Row>('SELECT hash_archivo FROM finanzas_importaciones_bancarias WHERE id=$1 AND empresa_id=$2', [id, EMPRESA]);
    if (!physical.rows[0] || physical.rows[0].hash_archivo !== row.hash_archivo) throw new Error(`Colisión real: importación destino ${id} tiene hash incompatible`);
    await target.query(`INSERT INTO migrate.entidades_alias (sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino_canonico,metadata,snapshot_origen,hash_origen) VALUES ('DICOR',$1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sistema_origen,tipo_entidad,id_origen,empresa_destino_id) DO UPDATE SET id_destino_canonico=EXCLUDED.id_destino_canonico,updated_at=now()`, [type, String(row.id), EMPRESA, id, jsonParam({ canonical: false }), jsonParam(snapshot(row)), hash(row)]);
    return;
  }
  await target.query(`INSERT INTO migrate.entidades_correspondencias (sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES ('DICOR',$1,$2,$3,$4,$5,$6,$7,now(),$8,'sin_cambios') ON CONFLICT (sistema_origen,tipo_entidad,id_origen,empresa_destino_id) DO UPDATE SET id_destino=EXCLUDED.id_destino,metadata=EXCLUDED.metadata,hash_origen=EXCLUDED.hash_origen,snapshot_origen=EXCLUDED.snapshot_origen,fecha_ultima_sincronizacion=now(),version_transformacion=EXCLUDED.version_transformacion`, [type, String(row.id), EMPRESA, id, {
dicor_id: row.id
}, hash(row), jsonParam(snapshot(row)), VERSION]);
}
async function ensure(type: string, table: string, row: Row, values: Row, conflict: string): Promise<number> {
  if (type === 'importacion_bancaria') values.es_historica = true;
  if (type === 'movimiento_bancario') values.es_historico = true;
  if (type === 'importacion_bancaria') {
    const alias = await aliasCorrespondence(type, row.id);
    if (alias) return alias;
  }
  const old = await correspondence(type, row.id);
if (old) return old;
if (!APPLY) return -Number(row.id);
  const columns = Object.keys(values);
const conflictClause = table === 'finanzas_importaciones_bancarias' || table === 'finanzas_conciliaciones' ? 'ON CONFLICT DO NOTHING' : `ON CONFLICT ${conflict} DO NOTHING`;
const q = await target.query<Row>(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) ${conflictClause} RETURNING id`, Object.values(values));
  let id = q.rows[0] ? Number(q.rows[0].id) : await correspondence(type, row.id);
  if (!id && table === 'finanzas_importaciones_bancarias') {
const existing = await target.query<Row>('SELECT id FROM finanzas_importaciones_bancarias WHERE empresa_id=$1 AND hash_archivo=$2', [EMPRESA, values.hash_archivo]);
id = existing.rows[0] ? Number(existing.rows[0].id) : null;
}
  if (!id) throw new Error(`No se pudo recuperar ID destino para ${type} ${row.id};
clave=${JSON.stringify(values)}`);
await saveCorrespondence(type, row, id);
return id;
}
function problem(type: string, row: Row, cause: string) {
report.excepciones.push({
tipo: type, id: row.id, causa: cause
});
}

function normalizeMovementType(value: unknown, cargo: number): string {
  if (value === 'Depósito' || value === 'Deposito') return 'Deposito';
  if (value === 'Retiro') return 'Retiro';
  return cargo > 0 ? 'Retiro' : 'Deposito';
}

function normalizeMotivos(value: unknown): object | unknown[] {
  if (value == null || value === '') return {};
  if (Array.isArray(value)) return { motivos: value };
  if (typeof value === 'object') return value as object;
  const text = String(value);
  try { return JSON.parse(text); } catch { return { texto_historico: text }; }
}

function normalizePuntuacion(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`puntuacion fuera de rango: ${value}`);
  return n > 1 ? n / 100 : n;
}

async function imports(accounts: IdMap) {
  const refs: IdMap = new Map();
  for (const r of (await source.query<Row>('SELECT * FROM importaciones_bancarias ORDER BY id')).rows) {
    if (ONLY_ID != null && Number(r.id) !== ONLY_ID) continue;
    const account = accounts.get(Number(r.cuenta_dinero_id));
    if (!account) { problem('importacion', r, 'CUENTA_NO_RESUELTA'); continue; }
    const usuarioCreacion = await resolveUser(r.usuario_creacion_id || r.usuario_id, r, 'usuario_creacion_id');
    const usuarioCancelacion = await resolveUser(r.usuario_cancelacion_id, r, 'usuario_cancelacion_id');
    const usuarioFinalizacion = await resolveUser(r.usuario_finalizacion_id, r, 'usuario_finalizacion_id');
    r.duplicados_omitidos = jsonParam(r.duplicados_omitidos || {});
    refs.set(Number(r.id), await ensure('importacion_bancaria', 'finanzas_importaciones_bancarias', r, {
      empresa_id: EMPRESA, cuenta_id: account, nombre_original: r.nombre_original || r.nombre || `DICOR-${r.id}`, hash_archivo: r.hash_archivo || hash(r), contenido_original: r.contenido_original || null, codificacion: r.codificacion || null, formato_detectado: r.formato_detectado || null, parser_version: r.parser_version || VERSION, fecha_inicial: r.fecha_inicial || r.fecha_inicio || null, fecha_final: r.fecha_final || r.fecha_fin || null, saldo_inicial: r.saldo_inicial || null, saldo_final: r.saldo_final || null, total_cargos: r.total_cargos || 0, total_abonos: r.total_abonos || 0, total_filas: r.total_filas || 0, filas_validas: r.filas_validas || 0, filas_invalidas: r.filas_invalidas || 0, filas_nuevas: r.filas_nuevas || 0, filas_duplicadas: r.filas_duplicadas || 0, duplicados_omitidos: r.duplicados_omitidos || {}, estado: r.estado || 'procesada', usuario_creacion_id: usuarioCreacion, usuario_cancelacion_id: usuarioCancelacion, fecha_cancelacion: r.fecha_cancelacion || null, motivo_cancelacion: r.motivo_cancelacion || null, usuario_finalizacion_id: usuarioFinalizacion, fecha_finalizacion: r.fecha_finalizacion || null, fecha_creacion: r.fecha_creacion || new Date(), metadatos: { dicor_id: r.id, snapshot: snapshot(r), usuario_historico: r.usuario_historico || [] }
    }, '(empresa_id,hash_archivo)'));
    report.importaciones++;
  }
  return refs;
}
async function movements(importsMap: IdMap, accounts: IdMap) {
const refs: IdMap = new Map();
for (const r of (await source.query<Row>('SELECT * FROM movimientos_bancarios_importados ORDER BY id')).rows) {
if (ONLY_ID != null && !importsMap.has(Number(r.importacion_id))) continue;
 r.tipo = normalizeMovementType(r.tipo, Number(r.cargo || 0));
const imp = importsMap.get(Number(r.importacion_id));
if (!imp) {
problem('movimiento', r, 'IMPORTACION_NO_RESUELTA');
continue;
} const cargo = r.cargo || 0, abono = r.abono || 0;
refs.set(Number(r.id), await ensure('movimiento_bancario', 'finanzas_movimientos_bancarios', r, {
empresa_id: EMPRESA, importacion_id: imp, cuenta_id: accounts.get(Number(r.cuenta_dinero_id)) || [...accounts.values()][0], numero_fila: r.numero_fila || r.fila || r.id, fecha: r.fecha, hora: r.hora || null, concepto_bancario: r.concepto_bancario || r.concepto || null, referencia_bancaria: r.referencia_bancaria || r.referencia || null, cargo, abono, importe: r.importe || abono - cargo, tipo: r.tipo || (cargo ? 'Retiro' : 'Deposito'), saldo_posterior: r.saldo_posterior || r.saldo || null, linea_original: r.linea_original || null, hash_movimiento: r.hash_movimiento || hash(r), datos_originales: snapshot(r)
}, '(importacion_id,numero_fila)'));
report.movimientos++;
} return refs;
}
async function bankRelations(movementsMap: IdMap) {
  for (const r of (await source.query<Row>('SELECT * FROM movimientos_bancarios_relaciones')).rows) {
    if (ONLY_ID != null && !movementsMap.has(Number(r.movimiento_bancario_id))) continue;
    const m = movementsMap.get(Number(r.movimiento_bancario_id));
    const o = await correspondence('operacion_dinero', r.operacion_dinero_id);
    r.puntuacion = normalizePuntuacion(r.puntuacion);
    const usuarioConfirmacion = await resolveUser(r.usuario_confirmacion_id, r, 'usuario_confirmacion_id');
    if (!m || !o) { problem('relacion', r, 'OPERACION_NO_RESUELTA'); continue; }
    if (APPLY) await target.query('INSERT INTO finanzas_movimientos_bancarios_relaciones (empresa_id,movimiento_bancario_id,operacion_id,estado,origen,puntuacion,nivel_confianza,explicacion,motivos,usuario_confirmacion_id,fecha_confirmacion,activa) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (movimiento_bancario_id,operacion_id) DO NOTHING', [EMPRESA, m, o, r.estado || 'confirmada', r.origen || 'importacion', r.puntuacion || null, r.nivel_confianza || null, r.explicacion || null, { ...normalizeMotivos(r.motivos) as Row, usuario_historico: r.usuario_historico || [] }, usuarioConfirmacion, r.fecha_confirmacion || null, r.activa !== false]);
    report.relaciones++;
  }
}
async function conciliations(accounts: IdMap) {
if (ONLY_ID != null) return;
for (const r of (await source.query<Row>('SELECT * FROM cuentas_dinero_conciliaciones')).rows) {
const a = accounts.get(Number(r.cuenta_dinero_id));
if (!a) {
problem('conciliacion', r, 'CUENTA_NO_RESUELTA');
continue;
} const usuarioConciliacion = await resolveUser(r.usuario_id || r.usuario_creacion_id, r, 'usuario_id');
const usuarioAnulacion = await resolveUser(r.usuario_anulacion_id, r, 'usuario_anulacion_id');
if (r.saldo_final == null || r.saldo_anterior == null) {
  throw new Error(`Conciliación DICOR ${r.id} sin saldo_final o saldo_anterior`);
}
const totals = await source.query<Row>(
  `SELECT
     COALESCE(SUM(CASE WHEN tipo_movimiento IN ('Depósito','Deposito') THEN monto ELSE 0 END), 0)::text AS depositos,
     COALESCE(SUM(CASE WHEN tipo_movimiento = 'Retiro' THEN monto ELSE 0 END), 0)::text AS retiros
   FROM operaciones_dinero
   WHERE conciliacion_id = $1`,
  [r.id]
);
const depositos = totals.rows[0]?.depositos ?? '0';
const retiros = totals.rows[0]?.retiros ?? '0';
const calculated = await source.query<Row>(
  'SELECT ($1::numeric + $2::numeric - $3::numeric)::text AS valor',
  [String(r.saldo_anterior), depositos, retiros]
);
const saldoCalculado = calculated.rows[0].valor;
const values = {
  empresa_id: EMPRESA,
  cuenta_id: a,
  fecha_corte: r.fecha_corte || r.fecha,
  saldo_banco: String(r.saldo_final),
  saldo_conciliado_anterior: String(r.saldo_anterior),
  total_depositos_cotejados: depositos,
  total_retiros_cotejados: retiros,
  saldo_conciliado_calculado: saldoCalculado,
  saldo_sistema: null,
  diferencia: null,
  observaciones: r.observaciones || null,
  fecha_creacion: r.fecha_creacion || new Date(),
  usuario_id: usuarioConciliacion,
  estatus: r.estado === 'anulada' ? 'anulada' : 'cerrada',
  anulada_en: r.anulada_en || r.fecha_anulacion || null,
  anulada_por: usuarioAnulacion,
  motivo_anulacion: r.motivo_anulacion || null,
  metadatos: { dicor_id: r.id, snapshot: snapshot(r), usuario_historico: r.usuario_historico || [] }
};
const c = await ensure('conciliacion', 'finanzas_conciliaciones', r, values, '(id)');
if (APPLY) {
  await target.query(
    `UPDATE finanzas_conciliaciones
     SET saldo_banco=$1, saldo_conciliado_anterior=$2,
         total_depositos_cotejados=$3, total_retiros_cotejados=$4,
         saldo_conciliado_calculado=$5, saldo_sistema=NULL, diferencia=NULL
     WHERE id=$6 AND empresa_id=$7`,
    [String(r.saldo_final), String(r.saldo_anterior), depositos, retiros, saldoCalculado, c, EMPRESA]
  );
}
report.conciliaciones++;
if (r.estado === 'anulada') report.anuladas++;
else report.activas++;
for (const x of (await source.query<Row>('SELECT id AS operacion_dinero_id FROM operaciones_dinero WHERE conciliacion_id=$1', [r.id])).rows) {
const o = await correspondence('operacion_dinero', x.operacion_dinero_id);
if (!o) {
problem('relacion_conciliacion', x, 'OPERACION_NO_RESUELTA');
continue;
} if (APPLY) await target.query('INSERT INTO finanzas_conciliaciones_operaciones (conciliacion_id,operacion_id) VALUES ($1,$2) ON CONFLICT (conciliacion_id,operacion_id) DO NOTHING', [c, o]);
report.relaciones_conciliaciones++;
}
}
}

async function main() {
source = client('DICOR', true);
target = client('EMPHASYS', !APPLY);
await source.connect();
await target.connect();
try {
await source.query('BEGIN READ ONLY');
await target.query('BEGIN');
const accounts: IdMap = new Map();
for (const r of (await source.query<Row>('SELECT DISTINCT c.* FROM cuentas_dinero c JOIN (SELECT cuenta_dinero_id FROM importaciones_bancarias UNION SELECT cuenta_dinero_id FROM cuentas_dinero_conciliaciones) x ON x.cuenta_dinero_id=c.id')).rows) {
const id = await correspondence('cuenta_dinero', r.id);
if (id) accounts.set(Number(r.id), id);
} const im = await imports(accounts);
const mm = await movements(im, accounts);
await bankRelations(mm);
await conciliations(accounts);
if (APPLY) await target.query('COMMIT');
else await target.query('ROLLBACK');
await source.query('ROLLBACK');
console.log(JSON.stringify(report, null, 2));
} catch (e) {
await target.query('ROLLBACK').catch(() => undefined);
throw e;
} finally {
await source.end();
await target.end();
}
}
main().catch(e => {
console.error(e);
process.exitCode = 1;
});
