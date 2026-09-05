import { Client } from 'pg';

const EMPRESA = 9;
const VERSION = 'dicor-finanzas-v1';
type Row = Record<string, any>;

// Regla histórica de DICOR: todo retiro ligado directamente a un FULL es
// gasto adicional para conservar la semántica de main. No depende del concepto.
const naturalezaOperacion = (row: Row) =>
  row.tipo_movimiento === 'Retiro' && row.full_compra_id != null
    ? 'gasto_adicional_full'
    : row.es_anticipo === true ? 'anticipo' : 'movimiento_general';

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
  const inserted = await t.query<Row>(`INSERT INTO conceptos(empresa_id,nombre_concepto,es_gasto,activo,observaciones) VALUES($1,$2,$3,$4,$5) RETURNING id`, [EMPRESA, concept.nombre_concepto, concept.es_gasto, concept.activo, concept.observaciones || null]);
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
    const operations = await s.query<Row>(`SELECT o.*, f.id AS full_compra_id FROM operaciones_dinero o LEFT JOIN facturas f ON f.id = o.full_id AND f.tipo_factura = 'Compra' ${where} ORDER BY o.id`, id ? [id] : []);
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
        const inserted = await t.query<Row>(`INSERT INTO finanzas_operaciones(empresa_id,fecha,tipo_movimiento,monto,referencia,observaciones,cuenta_id,contacto_id,factura_id,es_transferencia,transferencia_id,estado_conciliacion,saldo,concepto_id,naturaleza_operacion,documento_origen_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,$13,$14,$15,$16) RETURNING id`, [EMPRESA,row.fecha,row.tipo_movimiento === 'Depósito' ? 'Deposito' : row.tipo_movimiento,row.monto,row.referencia,JSON.stringify({ dicor_id: row.id, snapshot: sourceSnapshot(row) }),account,contact,doc,row.es_transferencia === true,row.transferencia_id,row.estado_conciliacion || 'pendiente',concept, naturalezaOperacion({ ...row, full_id: full }),full,row.usuario_id]);
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
        const existingDocument = await t.query<Row>(`SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='nota_credito_documento' AND id_origen=$1 AND empresa_destino_id=$2`, [String(credit.id), EMPRESA]);
        if (existingDocument.rows[0]) { creditMap.set(Number(credit.id), Number(existingDocument.rows[0].id_destino)); continue; }
        const old = await t.query<Row>(`SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_credito' AND id_origen=$1 AND empresa_destino_id=$2`, [String(credit.id), EMPRESA]);
        const contact = await correspondence(t, 'contacto', String(credit.contacto_id));
        if (!contact) { report.excepciones++; report.problemas.push({ tipo: 'operacion_credito', id: credit.id, codigo: 'CONTACTO_NO_RESUELTO' }); continue; }
        const item = await s.query<Row>('SELECT * FROM operaciones_credito_items WHERE operacion_credito_id=$1 ORDER BY id LIMIT 1', [credit.id]);
        const historicItem = item.rows[0];
        const product = historicItem?.producto_id == null ? null : await correspondence(t, 'producto', String(historicItem.producto_id));
        const user = 1;
        const documentoOrigen = historicItem?.factura_id == null ? null : await correspondence(t, 'documento', String(historicItem.factura_id));
        const observaciones = [credit.referencia, credit.observaciones].filter(Boolean).join(' — ') || null;
        const existingByNumber = await t.query<Row>(`SELECT id FROM documentos WHERE empresa_id=$1 AND tipo_documento='nota_credito_compra' AND serie=$2 AND numero=$3`, [EMPRESA,credit.serie,credit.numero]);
        let destination: number;
        const createdDocument = existingByNumber.rowCount === 0;
        if (createdDocument) {
          const inserted = await t.query<Row>(`INSERT INTO documentos(empresa_id,tipo_documento,estatus_documento,serie,numero,contacto_principal_id,fecha_documento,moneda,tipo_cambio,subtotal,descuento_global,descuento,iva,total,saldo,observaciones,documento_origen_id,motivo_nc,usuario_creacion_id,tratamiento_impuestos) VALUES($1,'nota_credito_compra','emitido',$2,$3,$4,$5,$6,$7,$8,0,0,$9,$10,$10,$11,$12,'otro',$13,'sin_iva') RETURNING id`, [EMPRESA,credit.serie,credit.numero,contact,credit.fecha,credit.moneda || 'MXN',Number(credit.cotizacion || 1),Number(credit.total)-Number(credit.monto_iva || 0),Number(credit.monto_iva || 0),Number(credit.total),observaciones,documentoOrigen,user]);
          destination = Number(inserted.rows[0].id);
        } else destination = Number(existingByNumber.rows[0].id);
        creditMap.set(Number(credit.id), destination);
        if (historicItem && createdDocument) {
          const part = await t.query<Row>(`INSERT INTO documentos_partidas(documento_id,numero_partida,producto_id,descripcion_alterna,cantidad,precio_unitario,descuento,descuento_tipo,descuento_monto,subtotal_partida,total_partida) VALUES($1,1,$2,$3,$4,$5,0,'porcentaje',0,$6,$6) RETURNING id`, [destination,product,credit.referencia || credit.observaciones || null,Number(historicItem.cantidad || 1),Number(historicItem.precio_unitario || 0),Number(historicItem.subtotal || credit.total)]);
          const sourcePart = historicItem.partida_factura ? await correspondence(t, 'partida', String(historicItem.partida_factura)) : null;
          if (sourcePart) await t.query(`INSERT INTO documentos_partidas_vinculos(empresa_id,documento_origen_id,documento_destino_id,partida_origen_id,partida_destino_id,cantidad,usuario_creacion_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [EMPRESA, await correspondence(t,'documento',String(historicItem.factura_id)), destination, sourcePart, part.rows[0].id, Number(historicItem.cantidad || 1), user]);
        }
        await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','nota_credito_documento',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(credit.id),EMPRESA,destination,{ tipo: 'nota_credito_compra', origen: 'operacion_credito' },sourceHash(credit),sourceSnapshot(credit),VERSION]);
        if (!old.rows[0]) await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','operacion_credito',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(credit.id),EMPRESA,destination,{ tipo: 'Nota de Crédito' },sourceHash(credit),sourceSnapshot(credit),VERSION]);
      }
      for (const credit of credits.rows.filter((row) => row.tipo_operacion === 'Nota de Crédito')) {
        const old = await correspondence(t, 'operacion_credito', String(credit.id));
        if (!old) continue;
        await t.query(`DELETE FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_credito_aplicacion' AND id_destino IN (SELECT id FROM aplicaciones_saldo WHERE empresa_id=$1 AND credito_operacion_id=$2)`, [EMPRESA, old]);
        await t.query(`DELETE FROM aplicaciones_saldo WHERE empresa_id=$1 AND credito_operacion_id=$2`, [EMPRESA, old]);
        await t.query(`DELETE FROM credito_operaciones WHERE id=$1 AND empresa_id=$2`, [old, EMPRESA]);
        await t.query(`DELETE FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_credito' AND id_origen=$1 AND empresa_destino_id=$2`, [String(credit.id), EMPRESA]);
      }
      for (const app of applications.rows) {
        const credit = credits.rows.find((row) => Number(row.id) === Number(app.operacion_credito_id));
        if (!credit) continue;
        const document = await correspondence(t, 'documento', String(app.factura_id));
        if (!document) { report.excepciones++; report.problemas.push({ tipo: 'aplicacion_credito', id: app.id, codigo: 'DOCUMENTO_NO_RESUELTO' }); continue; }
        const operation = credit.tipo_operacion === 'Pago' ? await correspondence(t, 'operacion_dinero', String(credit.operacion_dinero_id)) : creditMap.get(Number(credit.id));
        if (!operation) { report.excepciones++; report.problemas.push({ tipo: 'aplicacion_credito', id: app.id, codigo: 'ORIGEN_CANONICO_NO_RESUELTO' }); continue; }
        const tipoOrigen = credit.es_anticipo || credit.tipo_operacion === 'Pago' ? 'finanzas_operacion' : 'documento';
        const existing = await t.query<Row>(`SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='operacion_credito_aplicacion' AND id_origen=$1 AND empresa_destino_id=$2`, [String(app.id), EMPRESA]);
        if (existing.rows[0]) continue;
        const inserted = tipoOrigen === 'finanzas_operacion'
          ? await t.query<Row>(`INSERT INTO aplicaciones_saldo(empresa_id,finanzas_operacion_id,documento_destino_id,monto,monto_moneda_documento,fecha_aplicacion) VALUES($1,$2,$3,$4,$4,$5) RETURNING id`, [EMPRESA,operation,document,app.monto,app.fecha])
          : await t.query<Row>(`INSERT INTO aplicaciones_saldo(empresa_id,documento_origen_id,documento_destino_id,monto,monto_moneda_documento,fecha_aplicacion) VALUES($1,$2,$3,$4,$4,$5) RETURNING id`, [EMPRESA,operation,document,app.monto,app.fecha]);
        await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','operacion_credito_aplicacion',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(app.id),EMPRESA,Number(inserted.rows[0].id),{ origen: tipoOrigen },sourceHash(app),sourceSnapshot(app),VERSION]);
      }
      const ncrDocuments = [...creditMap.values()];
      if (ncrDocuments.length) await t.query(`UPDATE documentos d SET saldo=GREATEST(d.total-COALESCE((SELECT SUM(a.monto) FROM aplicaciones_saldo a WHERE a.empresa_id=$1 AND a.documento_origen_id=d.id),0),0) WHERE d.empresa_id=$1 AND d.id=ANY($2::bigint[])`, [EMPRESA, ncrDocuments]);
    }
    await s.query('ROLLBACK');
    console.log(JSON.stringify(report, null, 2));
  } finally { await s.end(); await t.end(); }
}
main().catch((error) => { console.error(error); process.exit(1); });
