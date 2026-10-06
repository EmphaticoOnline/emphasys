import crypto from 'crypto';
import * as XLSX from 'xlsx';
import pool from '../../config/database';
import type { Pool, PoolClient } from 'pg';

export type EstadoCuentaMovimientoPreview = {
  numeroFila: number;
  fecha: string;
  conceptoBancario: string | null;
  referenciaBancaria: string | null;
  cargo: number;
  abono: number;
  importe: number;
  tipo: 'Deposito' | 'Retiro';
  saldoPosterior: number | null;
  hashMovimiento: string;
  duplicadoEnArchivo: boolean;
  duplicadoEnBase: boolean;
};

type ParseError = { numeroFila: number; errores: string[]; linea: string };
type Parsed = {
  formato: string;
  parserVersion: string;
  fechaInicial: string | null;
  fechaFinal: string | null;
  saldoInicial: number | null;
  saldoFinal: number | null;
  totalCargos: number;
  totalAbonos: number;
  totalFilas: number;
  filasInvalidas: ParseError[];
  movimientos: Omit<EstadoCuentaMovimientoPreview, 'duplicadoEnArchivo' | 'duplicadoEnBase'>[];
};

const MAX_BYTES = 10 * 1024 * 1024;

function sha256(value: string | Buffer): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function normalizar(v: unknown): string { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fecha(v: unknown): string | null {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
function pick(headers: string[], names: string[]): number {
  return headers.findIndex(h => names.includes(normalizar(h)));
}
function parseBuffer(buffer: Buffer, cuentaId: number): Parsed {
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error('El archivo está vacío o excede 10 MB');
  let rows: unknown[][];
  let formato = 'csv-generico';
  if (buffer.slice(0, 2).toString() === 'PK') {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    formato = 'xlsx-generico';
  } else {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(Boolean);
    const delimiter = (lines[0]?.split(';').length ?? 0) > (lines[0]?.split(',').length ?? 0) ? ';' : ',';
    rows = lines.map(line => line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, '')));
  }
  if (!rows.length) throw new Error('El archivo no contiene filas');
  const headers = (rows[0] ?? []).map(String);
  const dateI = pick(headers, ['fecha', 'dia', 'día', 'fecha operacion', 'fecha movimiento']);
  const descI = pick(headers, ['concepto', 'descripcion', 'descripción', 'concepto bancario', 'detalle']);
  const refI = pick(headers, ['referencia', 'referencia bancaria', 'referencia bancaria']);
  const cargoI = pick(headers, ['cargo', 'retiro', 'egreso', 'debitos', 'débito']);
  const abonoI = pick(headers, ['abono', 'deposito', 'depósito', 'ingreso', 'credito', 'crédito']);
  const importeI = pick(headers, ['importe', 'monto', 'movimiento']);
  const saldoI = pick(headers, ['saldo', 'saldo posterior', 'saldo final']);
  if (dateI < 0 || (cargoI < 0 && abonoI < 0 && importeI < 0)) throw new Error('No se reconocieron columnas de fecha e importe/cargo/abono');
  const movimientos: Parsed['movimientos'] = [];
  const filasInvalidas: ParseError[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (row.every(v => String(v ?? '').trim() === '')) continue;
    const f = fecha(row[dateI]);
    const cargo = cargoI >= 0 ? numero(row[cargoI]) ?? 0 : 0;
    const abono = abonoI >= 0 ? numero(row[abonoI]) ?? 0 : 0;
    const importe = importeI >= 0 ? numero(row[importeI]) : Math.max(cargo, abono);
    const errores: string[] = [];
    if (!f) errores.push('Fecha inválida');
    if (importe === null || importe <= 0) errores.push('Importe inválido');
    if (cargo > 0 && abono > 0) errores.push('No puede haber cargo y abono simultáneos');
    if (cargo === 0 && abono === 0 && importe !== null) errores.push('La fila no contiene cargo ni abono');
    if (errores.length || !f || importe === null) { filasInvalidas.push({ numeroFila: i + 1, errores, linea: row.map(String).join(' | ') }); continue; }
    const tipo = cargo > 0 || (cargo === 0 && abono === 0 && (importeI >= 0 && Number(row[importeI]) < 0)) ? 'Retiro' : 'Deposito';
    const amount = Math.abs(importe);
    const concepto = descI >= 0 ? String(row[descI] ?? '').trim() || null : null;
    const referencia = refI >= 0 ? String(row[refI] ?? '').trim() || null : null;
    const saldo = saldoI >= 0 ? numero(row[saldoI]) : null;
    const hashMovimiento = sha256(JSON.stringify({ cuentaId, fecha: f, tipo, importe: amount.toFixed(6), cargo: cargo.toFixed(6), abono: abono.toFixed(6), concepto: normalizar(concepto), referencia: normalizar(referencia), saldo: saldo === null ? null : saldo.toFixed(6) }));
    movimientos.push({ numeroFila: i + 1, fecha: f, conceptoBancario: concepto, referenciaBancaria: referencia, cargo: tipo === 'Retiro' ? amount : 0, abono: tipo === 'Deposito' ? amount : 0, importe: amount, tipo, saldoPosterior: saldo, hashMovimiento });
  }
  const fechas = movimientos.map(m => m.fecha).sort();
  return { formato, parserVersion: 'generic-v1', fechaInicial: fechas[0] ?? null, fechaFinal: fechas[fechas.length - 1] ?? null, saldoInicial: movimientos[0]?.saldoPosterior ?? null, saldoFinal: movimientos.length ? movimientos[movimientos.length - 1].saldoPosterior : null, totalCargos: movimientos.reduce((s, m) => s + m.cargo, 0), totalAbonos: movimientos.reduce((s, m) => s + m.abono, 0), totalFilas: rows.length - 1, filasInvalidas, movimientos };
}

async function validarCuenta(cuentaId: number, empresaId: number) {
  const r = await pool.query('SELECT id, moneda, identificador FROM public.finanzas_cuentas WHERE id=$1 AND empresa_id=$2 AND NOT COALESCE(cuenta_cerrada,false)', [cuentaId, empresaId]);
  if (!r.rows[0]) throw Object.assign(new Error('Cuenta no encontrada, cerrada o fuera de la empresa activa'), { status: 404 });
  return r.rows[0];
}

async function enriquecer(parsed: Parsed, cuentaId: number, empresaId: number, client: Pool | PoolClient = pool) {
  const hashes = parsed.movimientos.map(m => m.hashMovimiento);
  const r = hashes.length ? await client.query('SELECT hash_movimiento FROM public.finanzas_estados_cuenta_importados_movimientos WHERE empresa_id=$1 AND cuenta_id=$2 AND hash_movimiento=ANY($3::text[])', [empresaId, cuentaId, hashes]) : { rows: [] };
  const dbHashes = new Set(r.rows.map((x: { hash_movimiento: string }) => x.hash_movimiento));
  const seen = new Set<string>();
  return parsed.movimientos.map(m => ({ ...m, duplicadoEnArchivo: seen.has(m.hashMovimiento), duplicadoEnBase: dbHashes.has(m.hashMovimiento) || (seen.add(m.hashMovimiento), false) }));
}

export async function previsualizarEstadoCuenta(buffer: Buffer, cuentaId: number, empresaId: number) {
  await validarCuenta(cuentaId, empresaId);
  const parsed = parseBuffer(buffer, cuentaId);
  const movimientos = await enriquecer(parsed, cuentaId, empresaId);
  const duplicados = movimientos.filter(m => m.duplicadoEnArchivo || m.duplicadoEnBase).length;
  const hashArchivo = sha256(buffer);
  const existente = await pool.query(
    `SELECT id, cuenta_id, nombre_original, fecha_inicial, fecha_final, filas_duplicadas
     FROM public.finanzas_estados_cuenta_importados
     WHERE empresa_id = $1 AND cuenta_id = $2 AND hash_archivo = $3
       AND COALESCE(es_historica, false) = false
       AND estado IS DISTINCT FROM 'cancelada'
     ORDER BY id DESC
     LIMIT 1`,
    [empresaId, cuentaId, hashArchivo]
  );
  const fila = existente.rows[0];
  return {
    ...parsed,
    movimientos,
    hashArchivo,
    filasValidas: parsed.movimientos.length,
    duplicados,
    filasInvalidas: parsed.filasInvalidas,
    importacionExistente: fila ? {
      id: Number(fila.id),
      cuentaId: Number(fila.cuenta_id),
      nombreOriginal: String(fila.nombre_original ?? ''),
      fechaInicial: fila.fecha_inicial ? String(fila.fecha_inicial) : null,
      fechaFinal: fila.fecha_final ? String(fila.fecha_final) : null,
      filasDuplicadas: Number(fila.filas_duplicadas ?? 0),
    } : null,
  };
}

export async function importarEstadoCuenta(buffer: Buffer, cuentaId: number, empresaId: number, usuarioId: number | null, nombreOriginal: string) {
  const cuenta = await validarCuenta(cuentaId, empresaId);
  const parsed = parseBuffer(buffer, cuentaId);
  const hashArchivo = sha256(buffer);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM public.finanzas_estados_cuenta_importados WHERE empresa_id=$1 AND hash_archivo=$2 AND es_historica=false LIMIT 1', [empresaId, hashArchivo]);
    if (existing.rows[0]) throw Object.assign(new Error('El archivo ya fue importado para esta empresa'), { status: 409 });
    const movimientos = await enriquecer(parsed, cuentaId, empresaId, client);
    const nuevos = movimientos.filter(m => !m.duplicadoEnArchivo && !m.duplicadoEnBase);
    const imp = await client.query(`INSERT INTO public.finanzas_estados_cuenta_importados (empresa_id,cuenta_id,nombre_original,hash_archivo,formato_detectado,parser_version,fecha_inicial,fecha_final,saldo_inicial,saldo_final,total_cargos,total_abonos,total_filas,filas_validas,filas_invalidas,filas_nuevas,filas_duplicadas,duplicados_omitidos,estado,usuario_creacion_id,fecha_finalizacion,metadatos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'procesada',$19,now(),$20) RETURNING id`, [empresaId, cuentaId, nombreOriginal, hashArchivo, parsed.formato, parsed.parserVersion, parsed.fechaInicial, parsed.fechaFinal, parsed.saldoInicial, parsed.saldoFinal, parsed.totalCargos, parsed.totalAbonos, parsed.totalFilas, parsed.movimientos.length, parsed.filasInvalidas.length, nuevos.length, movimientos.length - nuevos.length, JSON.stringify({ duplicados: movimientos.filter(m => m.duplicadoEnArchivo || m.duplicadoEnBase).map(m => m.numeroFila) }), usuarioId, JSON.stringify({ cuentaIdentificador: cuenta.identificador })]);
    const importacionId = Number(imp.rows[0].id);
    for (const m of nuevos) await client.query(`INSERT INTO public.finanzas_estados_cuenta_importados_movimientos (empresa_id,importacion_id,cuenta_id,numero_fila,fecha,concepto_bancario,referencia_bancaria,cargo,abono,importe,tipo,saldo_posterior,hash_movimiento,estado_revision,datos_originales) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pendiente',$14)`, [empresaId, importacionId, cuentaId, m.numeroFila, m.fecha, m.conceptoBancario, m.referenciaBancaria, m.cargo, m.abono, m.importe, m.tipo, m.saldoPosterior, m.hashMovimiento, JSON.stringify({ numeroFila: m.numeroFila })]);
    await client.query('COMMIT');
    return { id: importacionId, nombreOriginal, ...parsed, filasValidas: parsed.movimientos.length, movimientosInsertados: nuevos.length, duplicados: movimientos.length - nuevos.length };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function listarImportacionesEstadosCuenta(cuentaId: number | null, empresaId: number) {
  const params: unknown[] = [empresaId];
  const where = ['i.empresa_id=$1'];
  if (cuentaId) { params.push(cuentaId); where.push(`i.cuenta_id=$${params.length}`); }
  const r = await pool.query(`SELECT i.*, c.identificador AS cuenta_identificador, u.nombre AS usuario_nombre FROM public.finanzas_estados_cuenta_importados i JOIN public.finanzas_cuentas c ON c.id=i.cuenta_id AND c.empresa_id=i.empresa_id LEFT JOIN core.usuarios u ON u.id=i.usuario_creacion_id WHERE ${where.join(' AND ')} ORDER BY i.fecha_creacion DESC`, params);
  return r.rows;
}

export async function listarMovimientosEstadoCuenta(importacionId: number, empresaId: number) {
  const r = await pool.query(`SELECT m.* FROM public.finanzas_estados_cuenta_importados_movimientos m JOIN public.finanzas_estados_cuenta_importados i ON i.id=m.importacion_id AND i.empresa_id=m.empresa_id WHERE m.importacion_id=$1 AND m.empresa_id=$2 ORDER BY m.fecha,m.numero_fila`, [importacionId, empresaId]);
  return r.rows;
}

type Candidato = {
  id: number;
  movimiento_bancario_id: number;
  operacion_id: number;
  estado: string;
  origen: string;
  puntuacion: number;
  nivel_confianza: 'alta' | 'media' | 'baja';
  explicacion: string;
  motivos: Record<string, unknown>;
  fecha: string;
  monto: string;
  tipo_movimiento: string;
  referencia: string | null;
  observaciones: string | null;
  naturaleza_operacion: string | null;
};

const MATCH_MAX_DAYS = 3;
const MATCH_MIN_SCORE = 60;

function scoreCandidate(m: any, o: any) {
  const days = Math.abs(Math.round((Date.parse(String(m.fecha).slice(0, 10)) - Date.parse(String(o.fecha).slice(0, 10))) / 86400000));
  const reasons: Record<string, unknown> = { importe_exactamente_igual: true, diferencia_dias: days, tipo_compatible: m.tipo === o.tipo_movimiento };
  let score = 60;
  if (days === 0) { score += 25; reasons.fecha = 'misma_fecha'; }
  else if (days === 1) { score += 20; reasons.fecha = '±1_día'; }
  else if (days === 2) { score += 15; reasons.fecha = '±2_días'; }
  else if (days === 3) { score += 10; reasons.fecha = '±3_días'; }
  if (m.tipo === o.tipo_movimiento) score += 10;
  const bankText = normalizar(`${m.referenciaBancaria ?? ''} ${m.conceptoBancario ?? ''}`);
  const opText = normalizar(`${o.referencia ?? ''} ${o.observaciones ?? ''} ${o.concepto_nombre ?? ''}`);
  const refMatch = Boolean(bankText && opText && (bankText.includes(opText) || opText.includes(bankText)));
  if (refMatch) { score += 5; reasons.referencia = 'texto_compatible'; }
  const confidence: 'alta' | 'media' | 'baja' = score >= 90 ? 'alta' : score >= 75 ? 'media' : 'baja';
  return { score, confidence, reasons, days, refMatch };
}

async function obtenerImportacion(importacionId: number, empresaId: number, client: Pool | PoolClient = pool) {
  const r = await client.query(`SELECT id, empresa_id, cuenta_id FROM public.finanzas_estados_cuenta_importados WHERE id=$1 AND empresa_id=$2`, [importacionId, empresaId]);
  if (!r.rows[0]) throw Object.assign(new Error('Importación no encontrada'), { status: 404 });
  return r.rows[0];
}

export async function generarCandidatosEstadoCuenta(importacionId: number, empresaId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const imp = await obtenerImportacion(importacionId, empresaId, client);
    const movements = await client.query(`SELECT id, fecha, tipo, importe, referencia_bancaria, concepto_bancario FROM public.finanzas_estados_cuenta_importados_movimientos WHERE importacion_id=$1 AND empresa_id=$2 AND activo=true`, [importacionId, empresaId]);
    console.log('MATCH_1_MOVIMIENTOS_IMPORTADOS', movements.rows.map((m: any) => ({ id: m.id, fecha: m.fecha, tipo: m.tipo, importe: m.importe, referencia: m.referencia_bancaria })));
    if (!movements.rows.length) { await client.query('COMMIT'); return { importacion_id: importacionId, movimientos: 0, candidatos: 0 }; }
    const calendarDate = (value: unknown): string => {
      if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
      }
      return String(value).slice(0, 10);
    };
    const timestamps = movements.rows.map((m: any) => Date.parse(`${calendarDate(m.fecha)}T00:00:00Z`));
    const minDate = new Date(Math.min(...timestamps) - MATCH_MAX_DAYS * 86400000).toISOString().slice(0, 10);
    const maxDate = new Date(Math.max(...timestamps) + MATCH_MAX_DAYS * 86400000).toISOString().slice(0, 10);
    console.log('MATCH_IMPORTACION_DATOS', imp);
    console.log('MATCH_2_PARAMETROS_SQL', {
      empresaId,
      cuentaId: imp.cuenta_id,
      fechaMin: minDate,
      fechaMax: maxDate,
      estados: null,
    });
    const operations = await client.query(`SELECT fo.id, fo.fecha, fo.tipo_movimiento, fo.monto, fo.referencia, fo.observaciones, fo.empresa_id, fo.cuenta_id, co.nombre_concepto
      FROM public.finanzas_operaciones fo
      LEFT JOIN public.conceptos co ON co.id=fo.concepto_id AND co.empresa_id=fo.empresa_id
      WHERE fo.empresa_id=$1 AND fo.cuenta_id=$2 AND fo.fecha BETWEEN $3::date AND $4::date`, [empresaId, imp.cuenta_id, minDate, maxDate]);
    console.log('MATCH_2_OPERACIONES_CARGADAS', operations.rows.map((op: any) => ({ id: op.id, fecha: op.fecha, tipo_movimiento: op.tipo_movimiento, monto: op.monto, referencia: op.referencia, empresa_id: op.empresa_id, cuenta_id: op.cuenta_id })));
    const pendingRelations: Array<{ movimientoId: number; operacionId: number; score: ReturnType<typeof scoreCandidate>; motivos: string }> = [];
    for (const m of movements.rows) {
      const movementCandidates: Array<{ operacionId: number; puntuacion: number }> = [];
      for (const op of operations.rows) {
        if (Number(m.importe) !== Number(op.monto) || m.tipo !== op.tipo_movimiento) continue;
        const s = scoreCandidate(m, op);
        if (s.score < MATCH_MIN_SCORE) continue;
        const motivos = JSON.stringify(s.reasons);
        movementCandidates.push({ operacionId: op.id, puntuacion: s.score });
        pendingRelations.push({ movimientoId: m.id, operacionId: op.id, score: s, motivos });
      }
      console.log('MATCH_3_RESULTADO_MOVIMIENTO', { movimiento: { id: m.id, fecha: m.fecha, tipo: m.tipo, importe: m.importe, referencia: m.referencia_bancaria }, candidatos: movementCandidates.length, operaciones: movementCandidates.map((c) => c.operacionId), puntuaciones: movementCandidates.map((c) => ({ operacion_id: c.operacionId, puntuacion: c.puntuacion })) });
    }
    console.log('MATCH_4_RELACIONES_A_GUARDAR', { cantidad: pendingRelations.length, pares: pendingRelations.map((r) => `${r.movimientoId} → ${r.operacionId}`) });
    let inserted = 0;
    for (const relation of pendingRelations) {
      const s = relation.score;
      const puntuacionPersistida = s.score / 100;
      const result = await client.query(`INSERT INTO public.finanzas_estados_cuenta_importados_relaciones
        (empresa_id,movimiento_bancario_id,operacion_id,estado,origen,puntuacion,nivel_confianza,explicacion,motivos,activa)
        VALUES ($1,$2,$3,'sugerida','automatico',$4,$5,$6,$7,true)
        ON CONFLICT (movimiento_bancario_id,operacion_id) DO UPDATE SET
          puntuacion=EXCLUDED.puntuacion,nivel_confianza=EXCLUDED.nivel_confianza,explicacion=EXCLUDED.explicacion,motivos=EXCLUDED.motivos
        WHERE finanzas_estados_cuenta_importados_relaciones.origen='automatico'
          AND finanzas_estados_cuenta_importados_relaciones.estado='sugerida'
        RETURNING id`, [empresaId, relation.movimientoId, relation.operacionId, puntuacionPersistida, s.confidence, `${s.score} puntos: importe exacto; ${s.days === 0 ? 'misma fecha' : `${s.days} día(s) de diferencia`}${s.refMatch ? '; referencia compatible' : ''}`, relation.motivos]);
      if (result.rowCount) inserted += 1;
    }
    console.log('MATCH_5_RELACIONES_GUARDADAS', { cantidad: inserted });
    await client.query('COMMIT');
    return { importacion_id: importacionId, movimientos: movements.rowCount ?? 0, candidatos: inserted };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function listarCandidatosEstadoCuenta(importacionId: number, empresaId: number) {
  await obtenerImportacion(importacionId, empresaId);
  const r = await pool.query(`SELECT r.*, m.fecha, m.importe AS movimiento_importe, m.tipo AS movimiento_tipo,
      fo.fecha AS operacion_fecha, fo.monto, fo.tipo_movimiento, fo.referencia, fo.observaciones,
      fo.estado_conciliacion AS operacion_estado_conciliacion
    FROM public.finanzas_estados_cuenta_importados_relaciones r
    JOIN public.finanzas_estados_cuenta_importados_movimientos m ON m.id=r.movimiento_bancario_id AND m.empresa_id=r.empresa_id
    JOIN public.finanzas_operaciones fo ON fo.id=r.operacion_id AND fo.empresa_id=r.empresa_id
    WHERE r.empresa_id=$1 AND m.importacion_id=$2 ORDER BY m.fecha, r.puntuacion DESC`, [empresaId, importacionId]);
  return r.rows;
}

async function marcarOperacionCotejada(client: PoolClient, operacionId: number, empresaId: number) {
  const op = await client.query(
    `SELECT id, estado_conciliacion FROM public.finanzas_operaciones WHERE id=$1 AND empresa_id=$2 FOR UPDATE`,
    [operacionId, empresaId],
  );
  if (!op.rows[0]) throw errorEstado('No se encontró la operación de esta coincidencia.', 404);
  if (op.rows[0].estado_conciliacion === 'conciliado') throw errorEstado('Esta operación ya pertenece a una conciliación cerrada.', 409);
  await client.query(
    `UPDATE public.finanzas_operaciones SET estado_conciliacion='cotejado' WHERE id=$1 AND empresa_id=$2 AND estado_conciliacion <> 'conciliado'`,
    [operacionId, empresaId],
  );
}

function agruparIds(rows: Array<{ movimiento_bancario_id: number; operacion_id: number }>, campo: 'movimiento_bancario_id' | 'operacion_id') {
  const grupos = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row[campo]);
    grupos.set(id, (grupos.get(id) ?? 0) + 1);
  }
  return grupos;
}

export async function aceptarCoincidenciasClaras(importacionId: number, empresaId: number, usuarioId: number | null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await obtenerImportacion(importacionId, empresaId, client);
    const locked = await client.query(
      `SELECT r.id, r.estado, r.movimiento_bancario_id, r.operacion_id, m.importacion_id,
          (m.fecha = fo.fecha) AS misma_fecha,
          (m.importe = fo.monto) AS mismo_importe,
          (m.tipo = fo.tipo_movimiento) AS mismo_tipo,
          fo.estado_conciliacion
       FROM public.finanzas_estados_cuenta_importados_relaciones r
       JOIN public.finanzas_estados_cuenta_importados_movimientos m ON m.id=r.movimiento_bancario_id AND m.empresa_id=r.empresa_id
       JOIN public.finanzas_operaciones fo ON fo.id=r.operacion_id AND fo.empresa_id=r.empresa_id
       WHERE r.empresa_id=$1
         AND r.estado IN ('sugerida','confirmada')
         AND (
           m.importacion_id=$2
           OR r.operacion_id IN (
             SELECT r3.operacion_id
             FROM public.finanzas_estados_cuenta_importados_relaciones r3
             JOIN public.finanzas_estados_cuenta_importados_movimientos m3 ON m3.id=r3.movimiento_bancario_id AND m3.empresa_id=r3.empresa_id
             WHERE r3.empresa_id=$1 AND m3.importacion_id=$2 AND r3.estado='sugerida'
           )
         )
       ORDER BY r.id, fo.id
       FOR UPDATE OF r, fo`,
      [empresaId, importacionId],
    );
    const deEsta = locked.rows.filter((row) => Number(row.importacion_id) === importacionId);
    const sugeridas = deEsta.filter((row) => row.estado === 'sugerida');
    const porMovimiento = agruparIds(sugeridas, 'movimiento_bancario_id');
    const porOperacion = agruparIds(sugeridas, 'operacion_id');
    const operacionesConfirmadas = new Set(locked.rows.filter((row) => row.estado === 'confirmada').map((row) => Number(row.operacion_id)));
    const claras = sugeridas.filter((row) => {
      const movimientoId = Number(row.movimiento_bancario_id);
      const operacionId = Number(row.operacion_id);
      return porMovimiento.get(movimientoId) === 1
        && porOperacion.get(operacionId) === 1
        && !operacionesConfirmadas.has(operacionId)
        && row.estado_conciliacion !== 'conciliado'
        && row.mismo_importe === true
        && row.mismo_tipo === true
        && row.misma_fecha === true;
    });
    const vistosMovimiento = new Set<number>();
    const vistosOperacion = new Set<number>();
    for (const row of claras) {
      const movimientoId = Number(row.movimiento_bancario_id);
      const operacionId = Number(row.operacion_id);
      if (vistosMovimiento.has(movimientoId) || vistosOperacion.has(operacionId)) throw errorEstado('Hay coincidencias claras que comparten la misma operación.', 409);
      vistosMovimiento.add(movimientoId);
      vistosOperacion.add(operacionId);
      await client.query(
        `UPDATE public.finanzas_estados_cuenta_importados_relaciones
         SET estado='confirmada', activa=true, usuario_confirmacion_id=$2, fecha_confirmacion=now()
         WHERE id=$1 AND estado='sugerida'`,
        [row.id, usuarioId],
      );
      await client.query(
        `UPDATE public.finanzas_estados_cuenta_importados_relaciones
         SET estado='anulada', activa=false, usuario_confirmacion_id=$4, fecha_confirmacion=now()
         WHERE empresa_id=$1 AND estado='sugerida' AND id<>$2 AND (movimiento_bancario_id=$3 OR operacion_id=$5)`,
        [empresaId, row.id, movimientoId, usuarioId, operacionId],
      );
      await marcarOperacionCotejada(client, operacionId, empresaId);
    }
    await client.query('COMMIT');
    return { aceptadas: claras.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function errorEstado(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

export async function actualizarCandidatoEstadoCuenta(relacionId: number, estado: 'confirmada' | 'anulada', empresaId: number, usuarioId: number | null) {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    if (estado === 'anulada') {
      const current = await client.query(
        `SELECT r.id, r.estado
         FROM public.finanzas_estados_cuenta_importados_relaciones r
         JOIN public.finanzas_estados_cuenta_importados_movimientos m
           ON m.id = r.movimiento_bancario_id AND m.empresa_id = r.empresa_id
         WHERE r.id = $1 AND r.empresa_id = $2
         FOR UPDATE OF r`,
        [relacionId, empresaId],
      );
      const row = current.rows[0];
      if (!row) throw errorEstado('Relación no encontrada', 404);
      if (row.estado === 'confirmada') throw errorEstado('Esta coincidencia ya fue aceptada.', 409);
      if (row.estado === 'anulada') {
        await client.query('COMMIT');
        committed = true;
        return row;
      }
      const updated = await client.query(
        `UPDATE public.finanzas_estados_cuenta_importados_relaciones
         SET estado = 'anulada', activa = false, usuario_confirmacion_id = $2, fecha_confirmacion = now()
         WHERE id = $1
         RETURNING *`,
        [relacionId, usuarioId],
      );
      await client.query('COMMIT');
      committed = true;
      return updated.rows[0];
    }

    const locked = await client.query(
      `SELECT r.id, r.estado, r.movimiento_bancario_id, r.operacion_id
       FROM public.finanzas_estados_cuenta_importados_relaciones r
       WHERE r.empresa_id = $1
         AND EXISTS (
           SELECT 1
           FROM public.finanzas_estados_cuenta_importados_movimientos m
           WHERE m.id = r.movimiento_bancario_id AND m.empresa_id = r.empresa_id
         )
         AND (
           r.id = $2
           OR (
             r.estado IN ('sugerida', 'confirmada')
             AND (
               r.movimiento_bancario_id = (
                 SELECT movimiento_bancario_id
                 FROM public.finanzas_estados_cuenta_importados_relaciones
                 WHERE id = $2 AND empresa_id = $1
               )
               OR r.operacion_id = (
                 SELECT operacion_id
                 FROM public.finanzas_estados_cuenta_importados_relaciones
                 WHERE id = $2 AND empresa_id = $1
               )
             )
           )
         )
       ORDER BY r.id
       FOR UPDATE`,
      [empresaId, relacionId],
    );
    const target = locked.rows.find((row) => Number(row.id) === relacionId);
    if (!target) throw errorEstado('Relación no encontrada', 404);
    if (target.estado === 'confirmada') {
      await client.query('COMMIT');
      committed = true;
      return target;
    }
    if (target.estado === 'anulada') throw errorEstado('Esta opción ya fue descartada.', 409);
    const operacion = await client.query(
      `SELECT id, estado_conciliacion FROM public.finanzas_operaciones WHERE id=$1 AND empresa_id=$2 FOR UPDATE`,
      [target.operacion_id, empresaId],
    );
    if (!operacion.rows[0]) throw errorEstado('No se encontró la operación de esta coincidencia.', 404);
    if (operacion.rows[0].estado_conciliacion === 'conciliado') throw errorEstado('Esta operación ya pertenece a una conciliación cerrada.', 409);

    const movimientoOcupado = locked.rows.some((row) => row.estado === 'confirmada' && Number(row.movimiento_bancario_id) === Number(target.movimiento_bancario_id) && Number(row.id) !== relacionId);
    const operacionOcupada = locked.rows.some((row) => row.estado === 'confirmada' && Number(row.operacion_id) === Number(target.operacion_id) && Number(row.id) !== relacionId);
    if (movimientoOcupado || operacionOcupada) {
      if (movimientoOcupado) {
        await client.query(
          `UPDATE public.finanzas_estados_cuenta_importados_relaciones
           SET estado = 'anulada', activa = false, usuario_confirmacion_id = $3, fecha_confirmacion = now()
           WHERE empresa_id = $1 AND estado = 'sugerida' AND movimiento_bancario_id = $2`,
          [empresaId, target.movimiento_bancario_id, usuarioId],
        );
      }
      if (operacionOcupada) {
        await client.query(
          `UPDATE public.finanzas_estados_cuenta_importados_relaciones
           SET estado = 'anulada', activa = false, usuario_confirmacion_id = $3, fecha_confirmacion = now()
           WHERE empresa_id = $1 AND estado = 'sugerida' AND operacion_id = $2`,
          [empresaId, target.operacion_id, usuarioId],
        );
      }
      await client.query('COMMIT');
      committed = true;
      throw errorEstado(
        movimientoOcupado
          ? 'Este movimiento bancario ya tiene una coincidencia aceptada.'
          : 'Esta operación ya está relacionada con otro movimiento bancario.',
        409,
      );
    }

    const updated = await client.query(
      `UPDATE public.finanzas_estados_cuenta_importados_relaciones
       SET estado = 'confirmada', activa = true, usuario_confirmacion_id = $2, fecha_confirmacion = now()
       WHERE id = $1
       RETURNING *`,
      [relacionId, usuarioId],
    );
    await client.query(
      `UPDATE public.finanzas_estados_cuenta_importados_relaciones
       SET estado = 'anulada', activa = false, usuario_confirmacion_id = $4, fecha_confirmacion = now()
       WHERE empresa_id = $1
         AND estado = 'sugerida'
         AND id <> $2
         AND (movimiento_bancario_id = $3 OR operacion_id = $5)`,
      [empresaId, relacionId, target.movimiento_bancario_id, usuarioId, target.operacion_id],
    );
    await marcarOperacionCotejada(client, Number(target.operacion_id), empresaId);
    await client.query('COMMIT');
    committed = true;
    return updated.rows[0];
  } catch (error) {
    if (!committed) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
