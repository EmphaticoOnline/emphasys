import { Client } from 'pg';

const EMPRESA = 9;
const VERSION = 'dicor-finanzas-v1';
type Row = Record<string, any>;

function client(prefix: 'DICOR' | 'EMPHASYS', readOnly: boolean) {
  const get = (name: string) => {
    const value = process.env[`${prefix}_PG_${name}`];
    if (!value) throw new Error(`Falta ${prefix}_PG_${name}`);
    return value;
  };
  return new Client({ host: get('HOST'), port: Number(get('PORT')), database: get('DATABASE'), user: get('USER'), password: get('PASSWORD'), options: readOnly ? '-c default_transaction_read_only=on' : undefined });
}

const sourceHash = (row: Row) => JSON.stringify(row, Object.keys(row).sort());
const sourceSnapshot = (row: Row) => ({ ...row, monto: row.monto == null ? null : String(row.monto), saldo_legacy: row.saldo == null ? null : String(row.saldo), monto_por_cubrir_legacy: row.monto_por_cubrir == null ? null : String(row.monto_por_cubrir) });
async function correspondence(t: Client, type: string, id: string) {
  const q = await t.query<Row>('SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND id_origen=$3 AND empresa_destino_id=$4', ['DICOR', type, id, EMPRESA]);
  return q.rows[0]?.id_destino ? Number(q.rows[0].id_destino) : null;
}

async function ensureAccount(t: Client, account: Row, apply: boolean, report: Row) {
  const old = await correspondence(t, 'cuenta_dinero', String(account.id));
  if (old) return old;
  report.cuentas_nuevas++;
  if (!apply) return -Number(account.id);
  const inserted = await t.query<Row>(`INSERT INTO finanzas_cuentas(empresa_id,identificador,tipo_cuenta,moneda,saldo,saldo_inicial,saldo_conciliado,es_cuenta_efectivo,afecta_total_disponible,cuenta_cerrada,observaciones) VALUES($1,$2,$3,$4,0,0,0,$5,$6,false,$7) RETURNING id`, [EMPRESA, account.identificador, account.tipo_cuenta, account.moneda, account.es_cuenta_efectivo, account.afecta_total_disponible, `Cuenta DICOR ${account.id}; saldo histórico no autoritativo: ${account.saldo}`]);
  const id = Number(inserted.rows[0].id);
  await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','cuenta_dinero',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(account.id), EMPRESA, id, { identificador: account.identificador }, sourceHash(account), sourceSnapshot(account), VERSION]);
  return id;
}
async function ensureConcept(t: Client, concept: Row, apply: boolean) {
  const old = await correspondence(t, 'concepto', String(concept.id));
  if (old) return old;
  if (!apply) return -Number(concept.id);
  const inserted = await t.query<Row>(`INSERT INTO conceptos(empresa_id,nombre_concepto,es_gasto,activo,observaciones) VALUES($1,$2,$3,$4,$5) RETURNING id`, [EMPRESA, concept.nombre_concepto, concept.es_gasto, concept.activo, `Concepto DICOR ${concept.id}; conserva semántica histórica de origen.`]);
  const id = Number(inserted.rows[0].id);
  await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','concepto',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(concept.id), EMPRESA, id, { activo: concept.activo, historico: !concept.activo }, sourceHash(concept), sourceSnapshot(concept), VERSION]);
  return id;
}

async function main() {
  const args = process.argv.slice(2), apply = args.includes('--apply'), idArg = args.find((x) => x.startsWith('--id='));
  const id = idArg ? Number(idArg.slice(5)) : null;
  const s = client('DICOR', true), t = client('EMPHASYS', !apply);
  await s.connect(); await t.connect();
  const report: Row = { modo: apply ? 'apply' : 'dry-run', cuentas_nuevas: 0, cuentas_mapeadas: 0, operaciones_nuevas: 0, operaciones_sin_cambios: 0, operaciones_modificadas: 0, anticipos: 0, creditos: 0, creditos_pago: 0, creditos_anticipo: 0, creditos_nota: 0, aplicaciones: 0, aplicaciones_a_documento: 0, aplicaciones_huerfanas: 0, excepciones: 0, bloqueados: 0, contactos_no_resueltos: [], problemas: [] };
  try {
    await s.query('BEGIN READ ONLY');
    const accountRows = await s.query<Row>('SELECT c.* FROM cuentas_dinero c WHERE EXISTS (SELECT 1 FROM operaciones_dinero o WHERE o.cuenta_dinero_id=c.id) ORDER BY c.id');
    const accountMap = new Map<number, number>();
    for (const account of accountRows.rows) { const mapped = await ensureAccount(t, account, apply, report); if (mapped) { accountMap.set(Number(account.id), mapped); report.cuentas_mapeadas++; } }
    const conceptRows = await s.query<Row>('SELECT c.* FROM conceptos c WHERE EXISTS (SELECT 1 FROM operaciones_dinero o WHERE o.concepto_id=c.id) ORDER BY c.id');
    const conceptMap = new Map<number, number>();
    for (const concept of conceptRows.rows) { const mapped = await ensureConcept(t, concept, apply); if (mapped) conceptMap.set(Number(concept.id), mapped); }
    const where = id ? 'WHERE o.id=$1' : '';
    const operations = await s.query<Row>(`SELECT o.* FROM operaciones_dinero o ${where} ORDER BY o.id`, id ? [id] : []);
    for (const row of operations.rows) {
      const hash = sourceHash(row), old = await t.query<Row>(`SELECT id_destino,hash_origen FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_dinero' AND id_origen=$1 AND empresa_destino_id=$2`, [String(row.id), EMPRESA]);
      if (old.rows[0]) { old.rows[0].hash_origen === hash ? report.operaciones_sin_cambios++ : report.operaciones_modificadas++; continue; }
      const account = accountMap.get(Number(row.cuenta_dinero_id));
      const contact = row.contacto_id == null ? null : await correspondence(t, 'contacto', String(row.contacto_id));
      const concept = conceptMap.get(Number(row.concepto_id));
      if (!account || !concept || (row.contacto_id != null && !contact)) { report.excepciones++; if (!contact && row.contacto_id != null) report.contactos_no_resueltos.push(row.contacto_id); report.problemas.push({ tipo: 'operacion_dinero', id: row.id, codigo: !account ? 'CUENTA_NO_RESUELTA' : !concept ? 'CONCEPTO_NO_RESUELTO' : 'CONTACTO_NO_RESUELTO' }); continue; }
      report.operaciones_nuevas++; if (row.es_anticipo === true) report.anticipos++;
      if (!apply) continue;
      await t.query('BEGIN');
      try {
        const doc = row.factura_id == null ? null : await correspondence(t, 'documento', String(row.factura_id));
        const full = row.full_id == null ? null : await correspondence(t, 'documento', String(row.full_id));
        const inserted = await t.query<Row>(`INSERT INTO finanzas_operaciones(empresa_id,fecha,tipo_movimiento,monto,referencia,observaciones,cuenta_id,contacto_id,factura_id,es_transferencia,transferencia_id,estado_conciliacion,saldo,concepto_id,naturaleza_operacion,documento_origen_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,$13,$14,$15,$16) RETURNING id`, [EMPRESA,row.fecha,row.tipo_movimiento === 'Depósito' ? 'Deposito' : row.tipo_movimiento,row.monto,row.referencia,JSON.stringify({ dicor_id: row.id, snapshot: sourceSnapshot(row) }),account,contact,doc,row.es_transferencia === true,row.transferencia_id,row.estado_conciliacion || 'pendiente',concept, row.es_anticipo === true ? 'anticipo' : 'movimiento_general',full,row.usuario_id]);
        const destination = Number(inserted.rows[0].id);
        await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','operacion_dinero',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(row.id),EMPRESA,destination,{ cuenta_dinero_id: row.cuenta_dinero_id, factura_id: doc, full_id: full, es_anticipo: row.es_anticipo === true },hash,sourceSnapshot(row),VERSION]);
        await t.query('COMMIT');
      } catch (error) { await t.query('ROLLBACK'); report.bloqueados++; report.problemas.push({ tipo: 'operacion_dinero', id: row.id, codigo: 'ROLLBACK', detalle: String(error) }); }
    }
    const credits = await s.query<Row>(`SELECT * FROM operaciones_credito ${id ? 'WHERE id=$1' : ''} ORDER BY id`, id ? [id] : []);
    report.creditos = credits.rowCount ?? 0;
    report.creditos_pago = credits.rows.filter((row) => row.tipo_operacion === 'Pago' && !row.es_anticipo).length;
    report.creditos_anticipo = credits.rows.filter((row) => row.es_anticipo === true).length;
    report.creditos_nota = credits.rows.filter((row) => row.tipo_operacion === 'Nota de Crédito').length;
    const applications = await s.query<Row>('SELECT * FROM operaciones_credito_aplicaciones ORDER BY id');
    report.aplicaciones = applications.rowCount ?? 0;
    report.aplicaciones_a_documento = applications.rows.filter((row) => row.factura_id != null).length;
    report.aplicaciones_huerfanas = applications.rows.filter((row) => !credits.rows.some((credit) => Number(credit.id) === Number(row.operacion_credito_id))).length;
    if (report.aplicaciones_huerfanas) { report.excepciones += report.aplicaciones_huerfanas; report.problemas.push({ tipo: 'aplicacion_credito', codigo: 'CREDITO_ORIGEN_NO_RESUELTO', cantidad: report.aplicaciones_huerfanas }); }
    if (apply) {
      const creditMap = new Map<number, number>();
      for (const credit of credits.rows.filter((row) => row.tipo_operacion === 'Nota de Crédito')) {
        const old = await t.query<Row>(`SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_credito' AND id_origen=$1 AND empresa_destino_id=$2`, [String(credit.id), EMPRESA]);
        if (old.rows[0]) { creditMap.set(Number(credit.id), Number(old.rows[0].id_destino)); continue; }
        const contact = await correspondence(t, 'contacto', String(credit.contacto_id));
        if (!contact) { report.excepciones++; report.problemas.push({ tipo: 'operacion_credito', id: credit.id, codigo: 'CONTACTO_NO_RESUELTO' }); continue; }
        const inserted = await t.query<Row>(`INSERT INTO credito_operaciones(empresa_id,contacto_id,tipo_operacion,fecha,monto,referencia,observaciones,usuario_id) VALUES($1,$2,'ajuste',$3,$4,$5,$6,$7) RETURNING id`, [EMPRESA,contact,credit.fecha,credit.total,credit.folio,JSON.stringify({ dicor_id: credit.id, snapshot: sourceSnapshot(credit) }),credit.usuario_id]);
        const destination = Number(inserted.rows[0].id); creditMap.set(Number(credit.id), destination);
        await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','operacion_credito',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(credit.id),EMPRESA,destination,{ tipo: 'Nota de Crédito' },sourceHash(credit),sourceSnapshot(credit),VERSION]);
      }
      for (const app of applications.rows) {
        const credit = credits.rows.find((row) => Number(row.id) === Number(app.operacion_credito_id));
        if (!credit) continue;
        const document = await correspondence(t, 'documento', String(app.factura_id));
        if (!document) { report.excepciones++; report.problemas.push({ tipo: 'aplicacion_credito', id: app.id, codigo: 'DOCUMENTO_NO_RESUELTO' }); continue; }
        const operation = credit.tipo_operacion === 'Pago' ? await correspondence(t, 'operacion_dinero', String(credit.operacion_dinero_id)) : creditMap.get(Number(credit.id));
        if (!operation) { report.excepciones++; report.problemas.push({ tipo: 'aplicacion_credito', id: app.id, codigo: 'ORIGEN_CANONICO_NO_RESUELTO' }); continue; }
        const tipoOrigen = credit.es_anticipo || credit.tipo_operacion === 'Pago' ? 'finanzas_operacion' : 'credito_operacion';
        const existing = await t.query<Row>(`SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_credito_aplicacion' AND id_origen=$1 AND empresa_destino_id=$2`, [String(app.id), EMPRESA]);
        if (existing.rows[0]) continue;
        const inserted = tipoOrigen === 'finanzas_operacion'
          ? await t.query<Row>(`INSERT INTO aplicaciones_saldo(empresa_id,finanzas_operacion_id,documento_destino_id,monto,monto_moneda_documento,fecha_aplicacion) VALUES($1,$2,$3,$4,$4,$5) RETURNING id`, [EMPRESA,operation,document,app.monto,app.fecha])
          : await t.query<Row>(`INSERT INTO aplicaciones_saldo(empresa_id,credito_operacion_id,documento_destino_id,monto,monto_moneda_documento,fecha_aplicacion) VALUES($1,$2,$3,$4,$4,$5) RETURNING id`, [EMPRESA,operation,document,app.monto,app.fecha]);
        await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','operacion_credito_aplicacion',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(app.id),EMPRESA,Number(inserted.rows[0].id),{ origen: tipoOrigen },sourceHash(app),sourceSnapshot(app),VERSION]);
      }
    }
    await s.query('ROLLBACK');
    console.log(JSON.stringify(report, null, 2));
  } finally { await s.end(); await t.end(); }
}
main().catch((error) => { console.error(error); process.exit(1); });
