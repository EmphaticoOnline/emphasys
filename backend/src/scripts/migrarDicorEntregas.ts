import { Client } from 'pg';
import { createHash } from 'crypto';

const EMPRESA = 9;
const VERSION = 'dicor-entregas-v3';
type Row = Record<string, any>;

function client(prefix: 'DICOR' | 'EMPHASYS', readOnly: boolean): Client {
  const env = (name: string) => {
    const value = process.env[`${prefix}_PG_${name}`];
    if (!value) throw new Error(`Falta ${prefix}_PG_${name}`);
    return value;
  };
  return new Client({
    host: env('HOST'), port: Number(env('PORT')), database: env('DATABASE'),
    user: env('USER'), password: env('PASSWORD'),
    options: readOnly ? '-c default_transaction_read_only=on' : undefined,
  });
}

function snapshot(e: Row) {
  return { id: e.id, full_id: e.full_id, fecha: e.fecha, cantidad: String(e.cantidad),
    fletera_id: e.fletera_id, numero_unidad: e.numero_unidad, operador: e.operador,
    operador_id: e.operador_id, domicilio_envio: e.domicilio_envio, carta_porte: e.carta_porte,
    estatus: e.estatus, contacto_id: e.contacto_id, contacto_domicilio_id: e.contacto_domicilio_id,
    archivos: e.archivos };
}
function digest(value: Row) { return createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex'); }
async function mapping(t: Client, type: string, id: any) {
  if (id == null) return null;
  const q = await t.query('SELECT id_destino FROM migrate.entidades_correspondencias WHERE sistema_origen=$1 AND tipo_entidad=$2 AND id_origen=$3 AND empresa_destino_id=$4', ['DICOR', type, String(id), EMPRESA]);
  return q.rows[0] ? Number(q.rows[0].id_destino) : null;
}
async function source(s: Client, id: number) { return (await s.query<Row>('SELECT e.*,(SELECT count(*) FROM entregas_facturas ef WHERE ef.entrega_id=e.id) vinculos,(SELECT count(*) FROM entregas_archivos ea WHERE ea.entrega_id=e.id) archivos FROM entregas e WHERE e.id=$1', [id])).rows[0]; }

async function persist(s: Client, t: Client, e: Row, fail = false) {
  const snap = snapshot(e), hash = digest(snap);
  const old = await t.query<Row>(`SELECT id_destino,hash_origen FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='entrega' AND id_origen=$1 AND empresa_destino_id=$2`, [String(e.id), EMPRESA]);
  if (old.rows[0]) return old.rows[0].hash_origen === hash ? { status: 'sin_cambios', id: old.rows[0].id } : { status: 'modificado', code: 'CAMBIO_REQUIERE_PROCESO_DOMINIO' };
  const full = await mapping(t, 'documento', e.full_id), contacto = await mapping(t, 'contacto', e.contacto_id), fletera = await mapping(t, 'contacto', e.fletera_id);
  if (e.full_id != null && !full) throw new Error(`FULL_ORIGEN_INEXISTENTE:${e.full_id}`);
  const user = (await t.query('SELECT id FROM core.usuarios WHERE activo=true ORDER BY id LIMIT 1')).rows[0]?.id;
  if (!user) throw new Error('USUARIO_DESTINO_INEXISTENTE');
  const ins = await t.query<Row>(`INSERT INTO operaciones_entregas(empresa_id,fecha,cantidad,estado,full_documento_id,contacto_id,fletera_contacto_id,domicilio_snapshot,carta_porte_referencia,observaciones,datos_logisticos_snapshot,usuario_creacion_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [EMPRESA,e.fecha,e.cantidad,e.estatus==='Programada'?'programada':'entregada',full,contacto,fletera,e.domicilio_envio?{texto:e.domicilio_envio}:{},e.carta_porte,e.observaciones,{operador_texto:e.operador,operador_id_origen:e.operador_id,numero_unidad:e.numero_unidad,full_id_origen:e.full_id},user]);
  const links = await s.query<Row>('SELECT * FROM entregas_facturas WHERE entrega_id=$1 ORDER BY id', [e.id]);
  for (const link of links.rows) { const doc = await mapping(t,'documento',link.factura_id), part = await mapping(t,'partida',`${link.factura_id}:1`); if (!doc || !part) throw new Error(`PARTIDA_DESTINO_NO_RESUELTA:${link.factura_id}`); await t.query('INSERT INTO operaciones_entregas_partidas(entrega_id,documento_id,partida_id,cantidad) VALUES($1,$2,$3,$4)', [ins.rows[0].id,doc,part,link.cantidad]); if (fail) throw new Error('PRUEBA_FALLO_VINCULO_INTERMEDIO'); }
  await t.query(`INSERT INTO migrate.entidades_correspondencias(sistema_origen,tipo_entidad,id_origen,empresa_destino_id,id_destino,metadata,hash_origen,snapshot_origen,fecha_ultima_sincronizacion,version_transformacion,estado_sincronizacion) VALUES('DICOR','entrega',$1,$2,$3,$4,$5,$6,now(),$7,'sin_cambios')`, [String(e.id),EMPRESA,ins.rows[0].id,{full_documento_id:full,links:links.rowCount},hash,snap,VERSION]);
  return { status: 'nuevo', id: ins.rows[0].id, links: links.rowCount };
}

async function main() {
  const args=process.argv.slice(2), apply=args.includes('--apply'), test=args.includes('--test-rollback'), idem=args.includes('--test-idempotency'), dry=!apply&&!test&&!idem;
  const id=args.find(x=>x.startsWith('--id='))?.slice(5), limit=args.find(x=>x.startsWith('--limit='))?.slice(8);
  const s=client('DICOR',true), t=client('EMPHASYS',dry); await s.connect(); await t.connect();
  try { await s.query('BEGIN READ ONLY');
    if (test || idem) { if (!id) throw new Error('Use --test-rollback/--test-idempotency --id=<entrega>'); const e=await source(s,Number(id)); if(!e) throw new Error(`Entrega inexistente: ${id}`); await t.query('BEGIN'); try { const first=await persist(s,t,e); const second=idem?await persist(s,t,e):null; console.log(JSON.stringify({modo:test?'test-rollback':'test-idempotency',id:Number(id),first,second},null,2)); } finally { await t.query('ROLLBACK'); } await s.query('ROLLBACK'); return; }
    const where=id?'AND e.id=$1':'', rows=await s.query<Row>(`SELECT e.*,(SELECT count(*) FROM entregas_facturas ef WHERE ef.entrega_id=e.id) vinculos,(SELECT count(*) FROM entregas_archivos ea WHERE ea.entrega_id=e.id) archivos FROM entregas e WHERE true ${where} ORDER BY e.id${limit?` LIMIT ${Math.max(1,Number(limit))}`:''}`,id?[id]:[]);
    const report:any={total:rows.rowCount??0,migrables:0,nuevos:0,sin_cambios:0,modificados:0,excepciones:0,bloqueadas:0,relaciones:0,full_resueltos:0,full_no_resueltos:0,archivos:0,carta_porte:0,multiples:0,problemas:[]};
    for(const e of rows.rows){const snap=snapshot(e),h=digest(snap),old=await t.query<Row>(`SELECT hash_origen FROM migrate.entidades_correspondencias WHERE sistema_origen='DICOR' AND tipo_entidad='entrega' AND id_origen=$1 AND empresa_destino_id=$2`,[String(e.id),EMPRESA]);if(old.rows[0]){old.rows[0].hash_origen===h?report.sin_cambios++:report.modificados++;continue}if(e.archivos)report.archivos+=Number(e.archivos);if(e.carta_porte)report.carta_porte++;if(e.vinculos>1)report.multiples++;const full=await mapping(t,'documento',e.full_id);if(full)report.full_resueltos++;if(e.full_id!=null&&!full){report.excepciones++;report.problemas.push({id_origen:e.id,codigo:'FULL_ORIGEN_INEXISTENTE'});continue}const links=await s.query<Row>('SELECT * FROM entregas_facturas WHERE entrega_id=$1',[e.id]);let ok=true;for(const link of links.rows)if(!await mapping(t,'documento',link.factura_id)||!await mapping(t,'partida',`${link.factura_id}:1`)){ok=false;report.excepciones++;report.problemas.push({id_origen:e.id,codigo:'PARTIDA_DESTINO_NO_RESUELTA'})}if(!ok)continue;report.migrables++;report.nuevos++;report.relaciones+=links.rowCount??0;if(!dry){await t.query('BEGIN');try{await persist(s,t,e);await t.query('COMMIT')}catch(err){await t.query('ROLLBACK');report.bloqueadas++;report.problemas.push({id_origen:e.id,codigo:'ROLLBACK_ENTREGA',descripcion:String(err)})}}}
    await s.query('ROLLBACK'); console.log(JSON.stringify({...report,modo:dry?'dry-run':'apply',ids_problematicos:report.problemas.slice(0,50)},null,2));
  } finally { await s.end(); await t.end(); }
}
main().catch(error=>{console.error(error);process.exit(1)});
