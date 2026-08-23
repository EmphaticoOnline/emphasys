import type { PoolClient } from 'pg';
import pool from '../../config/database';
import type { CompassOwnerScope, Congruencia, ExpectativaAtencion, RevisionSemanalInput, RevisionSemanalListOptions } from './compass.types';
import { upsertIntencionEnTransaccion } from './compass.repository';
import { CompassNotFoundError } from './compass-work.repository';
import { calcularAtencionPorFrente, sugerirCongruenciaPorCobertura } from './compass-attention';

export function sugerirCongruencia(objetivo:number|null,expectativa:ExpectativaAtencion|null,reservadas:number,efectivas:number):Congruencia|null {
  return sugerirCongruenciaPorCobertura(objetivo,expectativa,efectivas,reservadas);
}
export async function listarRevisiones(s:CompassOwnerScope,options:RevisionSemanalListOptions,db:Pick<typeof pool,'query'>=pool){
  const {rows}=await db.query(`SELECT id,to_char(semana_inicio,'YYYY-MM-DD') semana_inicio,fecha_revision
    FROM compass.revisiones_semanales
    WHERE usuario_id=$1
    ORDER BY semana_inicio DESC,fecha_revision DESC,id DESC
    LIMIT $2 OFFSET $3`,[s.usuarioId,options.limit,options.offset]);
  return rows;
}
async function calculated(s:CompassOwnerScope,week:string,db:PoolClient|typeof pool=pool){
  const actividades=(await db.query(`SELECT frente_id,inicio_programado,fin_programado,estado,minutos_efectivos
    FROM compass.actividades WHERE usuario_id=$1 AND inicio_programado >= $2::date AND inicio_programado < $2::date+interval '7 days'`,[s.usuarioId,week])).rows;
  const metricas=calcularAtencionPorFrente(actividades);
  const {rows}=await db.query(`WITH actividad_frentes AS (
    SELECT DISTINCT frente_id FROM compass.actividades
    WHERE usuario_id=$1 AND inicio_programado >= $2::date AND inicio_programado < $2::date+interval '7 days')
    SELECT f.id frente_id,f.nombre,i.id intencion_semanal_id,i.prioridad prioridad_snapshot,i.horas_objetivo::float8 horas_objetivo_snapshot,
      i.expectativa_atencion expectativa_atencion_snapshot
    FROM compass.frentes f LEFT JOIN compass.intenciones_semanales i ON i.usuario_id=f.usuario_id AND i.frente_id=f.id AND i.semana_inicio=$2::date
    LEFT JOIN actividad_frentes af ON af.frente_id=f.id WHERE f.usuario_id=$1 AND (f.estado<>'archivado' OR i.id IS NOT NULL OR af.frente_id IS NOT NULL) ORDER BY f.nombre`,[s.usuarioId,week]);
  return rows.map(r=>{const m=metricas.get(r.frente_id)??{horas_planificadas:0,horas_efectivas:0,horas_reservadas:0};return {...r,...m,congruencia_sugerida:sugerirCongruenciaPorCobertura(r.horas_objetivo_snapshot,r.expectativa_atencion_snapshot,m.horas_efectivas,m.horas_reservadas),congruencia_confirmada:null,que_ocurrio:null,que_bloqueo:null,que_aprendi:null,que_cambiare:null}});
}
export async function obtenerRevision(s:CompassOwnerScope,week:string){
  const {rows}=await pool.query(`SELECT id,to_char(semana_inicio,'YYYY-MM-DD') semana_inicio,fecha_revision,resumen_general,aprendizaje_principal,ajuste_general,created_at,updated_at FROM compass.revisiones_semanales WHERE usuario_id=$1 AND semana_inicio=$2::date LIMIT 1`,[s.usuarioId,week]);
  if(!rows[0])return {revision:null,semana_inicio:week,frentes:await calculated(s,week),historica:false};
  const review=rows[0];let resumen:any={};try{resumen=JSON.parse(review.resumen_general||'{}')}catch{resumen={atencion_esperada:review.resumen_general,frentes_descuidados:''}}
  const details=(await pool.query(`SELECT rf.frente_id,f.nombre,rf.intencion_semanal_id,rf.prioridad_snapshot,rf.horas_objetivo_snapshot::float8,rf.expectativa_atencion_snapshot,rf.horas_planificadas::float8,rf.horas_efectivas::float8,0::float8 horas_reservadas,rf.congruencia_sugerida,rf.congruencia_confirmada,rf.que_ocurrio,rf.que_bloqueo,rf.que_aprendi,rf.que_cambiare FROM compass.revisiones_frente rf JOIN compass.frentes f ON f.usuario_id=rf.usuario_id AND f.id=rf.frente_id WHERE rf.usuario_id=$1 AND rf.revision_semanal_id=$2 ORDER BY f.nombre`,[s.usuarioId,review.id])).rows;
  return {revision:{...review,atencion_esperada:resumen.atencion_esperada??'',frentes_descuidados:resumen.frentes_descuidados??''},semana_inicio:week,frentes:details,historica:true};
}
export async function guardarRevision(s:CompassOwnerScope,input:RevisionSemanalInput){const client=await pool.connect();try{await client.query('BEGIN');const current=await calculated(s,input.semana_inicio,client);const byId=new Map(input.frentes.map(x=>[x.frente_id,x]));for(const answer of input.frentes)if(!current.some(x=>x.frente_id===answer.frente_id))throw new CompassNotFoundError('Frente no encontrado');
  const {rows}=await client.query<{id:number}>(`INSERT INTO compass.revisiones_semanales (empresa_id,usuario_id,semana_inicio,resumen_general,aprendizaje_principal,ajuste_general) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(usuario_id,semana_inicio) DO UPDATE SET resumen_general=EXCLUDED.resumen_general,aprendizaje_principal=EXCLUDED.aprendizaje_principal,ajuste_general=EXCLUDED.ajuste_general,fecha_revision=now(),updated_at=now() RETURNING id`,[s.empresaId,s.usuarioId,input.semana_inicio,JSON.stringify({atencion_esperada:input.atencion_esperada,frentes_descuidados:input.frentes_descuidados}),input.aprendizaje_principal,input.ajuste_general]);const reviewId=rows[0].id;await client.query('DELETE FROM compass.revisiones_frente WHERE usuario_id=$1 AND revision_semanal_id=$2',[s.usuarioId,reviewId]);
  for(const snap of current){const a=byId.get(snap.frente_id);await client.query(`INSERT INTO compass.revisiones_frente (empresa_id,usuario_id,revision_semanal_id,frente_id,intencion_semanal_id,prioridad_snapshot,horas_objetivo_snapshot,expectativa_atencion_snapshot,horas_planificadas,horas_efectivas,congruencia_sugerida,congruencia_confirmada,que_ocurrio,que_bloqueo,que_aprendi,que_cambiare) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,[s.empresaId,s.usuarioId,reviewId,snap.frente_id,snap.intencion_semanal_id,snap.prioridad_snapshot,snap.horas_objetivo_snapshot,snap.expectativa_atencion_snapshot,snap.horas_planificadas,snap.horas_efectivas,snap.congruencia_sugerida,a?.congruencia_confirmada??null,a?.que_ocurrio??null,a?.que_bloqueo??null,a?.que_aprendi??null,a?.que_cambiare??null])}
  for(const next of input.proximas_intenciones)await upsertIntencionEnTransaccion(client,s,next.frente_id,next);await client.query('COMMIT');return obtenerRevision(s,input.semana_inicio);
}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
