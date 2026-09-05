import pool from '../../config/database';
import { insertarContacto, upsertDatosFiscales, upsertDomicilioPrincipal } from '../contactos/contactos.repository';
import { inTransaction } from './transporte.repository';

export type OperadorInput = {
  contacto_id: number;
  numero_licencia: string;
  tipo_licencia?: string | null;
  vigencia_licencia?: string | null;
  activo?: boolean;
};

const selectOperador = `SELECT o.id, o.empresa_id, o.contacto_id,
    o.numero_licencia, o.tipo_licencia, o.vigencia_licencia, o.activo,
    c.nombre, COALESCE(cdf.rfc, c.rfc) AS rfc,
    c.telefono,
    CASE WHEN cd.id IS NULL THEN NULL ELSE jsonb_build_object(
      'calle', cd.calle, 'numeroExterior', cd.numero_exterior,
      'numeroInterior', cd.numero_interior, 'colonia', COALESCE(cd.colonia_sat, cd.colonia),
      'localidad', cd.ciudad, 'estado', cd.estado, 'pais', cd.pais,
      'codigoPostal', COALESCE(cd.cp_sat, cd.cp), 'referencia', cd.cruces
    ) END AS domicilio_principal,
    (cd.id IS NOT NULL) AS tiene_domicilio_principal
  FROM transporte.operadores o
  JOIN public.contactos c ON c.id=o.contacto_id AND c.empresa_id=o.empresa_id
  LEFT JOIN public.contactos_datos_fiscales cdf ON cdf.contacto_id=c.id
  LEFT JOIN public.contactos_domicilios cd ON cd.contacto_id=c.id AND cd.es_principal=true`;

export async function listOperadores(empresaId:number, q:string|null, activo:string|null) {
  const params: unknown[] = [empresaId];
  const where = ['o.empresa_id=$1'];
  if (q?.trim()) { params.push(`%${q.trim()}%`); where.push(`concat_ws(' ',c.nombre,COALESCE(cdf.rfc,c.rfc),o.numero_licencia) ILIKE $${params.length}`); }
  if (activo && activo !== 'todos') { params.push(activo === 'activos'); where.push(`o.activo=$${params.length}`); }
  return (await pool.query(`${selectOperador} WHERE ${where.join(' AND ')} ORDER BY c.nombre`, params)).rows;
}

export async function getOperador(empresaId:number, id:number) {
  return (await pool.query(`${selectOperador} WHERE o.empresa_id=$1 AND o.id=$2`, [empresaId,id])).rows[0] ?? null;
}

async function validateContact(empresaId:number, contactoId:number) {
  return (await pool.query('SELECT id FROM public.contactos WHERE id=$1 AND empresa_id=$2', [contactoId,empresaId])).rowCount === 1;
}

export async function createOperador(empresaId:number, d:OperadorInput) {
  if (!(await validateContact(empresaId,d.contacto_id))) throw Object.assign(new Error('El contacto no pertenece a la empresa activa.'),{statusCode:400});
  if (!d.numero_licencia?.trim()) throw Object.assign(new Error('numero_licencia es obligatorio.'),{statusCode:400});
  const r=await pool.query(`INSERT INTO transporte.operadores (empresa_id,contacto_id,numero_licencia,tipo_licencia,vigencia_licencia,activo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[empresaId,d.contacto_id,d.numero_licencia.trim(),d.tipo_licencia||null,d.vigencia_licencia||null,d.activo!==false]);
  return getOperador(empresaId,Number(r.rows[0].id));
}

export async function createOperadorCompleto(empresaId:number, payload:any) {
  const c=payload.contacto ?? payload;
  const op=payload.operador ?? payload;
  const operadorId=await inTransaction(async client=>{
    const contacto=await insertarContacto({ ...c, nombre:String(c.nombre??'').trim() },empresaId,{ client });
    const r=await client.query(`INSERT INTO transporte.operadores (empresa_id,contacto_id,numero_licencia,tipo_licencia,vigencia_licencia,activo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,[empresaId,contacto.id,String(op.numero_licencia??'').trim(),op.tipo_licencia||null,op.vigencia_licencia||null,op.activo!==false]);
    return Number(r.rows[0].id);
  });
  return getOperador(empresaId,operadorId);
}

export async function updateOperadorCompleto(empresaId:number,id:number,payload:any) {
  const updated=await inTransaction(async client=>{
    const current=await client.query('SELECT contacto_id FROM transporte.operadores WHERE id=$1 AND empresa_id=$2',[id,empresaId]);
    if(!current.rowCount)return null;
    const contactoId=Number(current.rows[0].contacto_id), c=payload.contacto ?? {};
    if(c.nombre!==undefined){await client.query('UPDATE public.contactos SET nombre=$1,email=$2,telefono=$3 WHERE id=$4 AND empresa_id=$5',[String(c.nombre).trim(),c.email||null,c.telefono||null,contactoId,empresaId]);}
    await upsertDatosFiscales(client,contactoId,c);
    await upsertDomicilioPrincipal(client,contactoId,c);
    const op=payload.operador ?? payload;
    const r=await client.query('UPDATE transporte.operadores SET numero_licencia=$3,tipo_licencia=$4,vigencia_licencia=$5,activo=$6,updated_at=now() WHERE empresa_id=$1 AND id=$2 RETURNING id',[empresaId,id,String(op.numero_licencia??'').trim(),op.tipo_licencia||null,op.vigencia_licencia||null,op.activo!==false]);
    return r.rowCount?true:false;
  });
  return updated?getOperador(empresaId,id):null;
}

export async function updateOperador(empresaId:number,id:number,d:Omit<OperadorInput,'contacto_id'>) {
  if (!d.numero_licencia?.trim()) throw Object.assign(new Error('numero_licencia es obligatorio.'),{statusCode:400});
  const r=await pool.query(`UPDATE transporte.operadores SET numero_licencia=$3,tipo_licencia=$4,vigencia_licencia=$5,activo=$6,updated_at=now() WHERE empresa_id=$1 AND id=$2 RETURNING id`,[empresaId,id,d.numero_licencia.trim(),d.tipo_licencia||null,d.vigencia_licencia||null,d.activo!==false]);
  if (!r.rowCount) return null;
  return getOperador(empresaId,id);
}

export async function setOperadorActivo(empresaId:number,id:number,activo:boolean) {
  const r=await pool.query('UPDATE transporte.operadores SET activo=$3,updated_at=now() WHERE empresa_id=$1 AND id=$2 RETURNING id',[empresaId,id,activo]);
  return r.rowCount ? getOperador(empresaId,id) : null;
}
