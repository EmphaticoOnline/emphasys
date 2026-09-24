import axios from 'axios';
import pool from '../config/database';
import { normalizarTelefono } from '../utils/telefono';
import { normalizeEmail } from '../shared/normalizers/email';
import { NormalizedMetaLead } from './meta-leads.service';

const EMPRESA_ID = 2;
const PAGE_ID = '351160398405043';
const FABY_CONTACTO_ID = 17;
const FABY_USUARIO_ID = 3;
const META_VERSION = 'v26.0';

type EventContext = { leadgen_id: string; page_id: string | number | null; form_id: string | number | null; created_time: string | number | null };
type LeadEvent = EventContext & { lead: NormalizedMetaLead; fieldNames: string[] };

const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const asId = (v: unknown) => v == null ? null : String(v);

export async function persistMetaLeadEvent(context: EventContext): Promise<boolean> {
  if (String(context.page_id ?? '') !== PAGE_ID) {
    console.warn('[Meta Leads] Página no autorizada; evento no persistido', { page_id: context.page_id, leadgen_id: context.leadgen_id });
    return false;
  }
  const result = await pool.query(
    `INSERT INTO crm.meta_leads (empresa_id,leadgen_id,page_id,form_id,created_time)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (empresa_id,leadgen_id) DO NOTHING RETURNING id`,
    [EMPRESA_ID, context.leadgen_id, PAGE_ID, asId(context.form_id), asId(context.created_time)]
  );
  return result.rowCount === 1;
}

function localParts(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant);
  const get = (x: string) => Number(parts.find(p => p.type === x)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, min: get('minute'), s: get('second') };
}
function dateKey(p: {y:number;m:number;d:number}) { return `${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`; }
function nextDay(key: string) { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+1); return dateKey({y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate()}); }
function fromLocal(key: string, time: string, zone: string) {
  const [y,m,d] = key.split('-').map(Number); const [h,mi,s=0] = time.split(':').map(Number);
  let candidate = new Date(Date.UTC(y,m-1,d,h,mi,s));
  for (let i=0;i<3;i++) { const p=localParts(candidate,zone); const offset=Date.UTC(p.y,p.m-1,p.d,p.h,p.min,p.s)-candidate.getTime(); candidate=new Date(Date.UTC(y,m-1,d,h,mi,s)-offset); }
  return candidate;
}

async function nextBusinessOpening(at = new Date()): Promise<Date> {
  const cfg = await pool.query(`SELECT e.zona_horaria, h.dia_semana, h.hora_inicio, h.hora_fin, h.activo,
      x.fecha::text AS excepcion_fecha, x.tipo AS excepcion_tipo, x.hora_inicio AS excepcion_inicio, x.hora_fin AS excepcion_fin
    FROM core.empresas e LEFT JOIN core.empresa_horarios_laborales h ON h.empresa_id=e.id
    LEFT JOIN core.empresa_excepciones_laborales x ON x.empresa_id=e.id
    WHERE e.id=$1`, [EMPRESA_ID]);
  const zone = cfg.rows[0]?.zona_horaria || 'America/Mexico_City';
  const schedules = new Map<number, any>(); const exceptions = new Map<string, any>();
  for (const row of cfg.rows) { if (row.dia_semana != null) schedules.set(Number(row.dia_semana), row); if (row.excepcion_fecha) exceptions.set(String(row.excepcion_fecha).slice(0,10), row); }
  let p=localParts(at,zone), key=dateKey(p);
  for (let i=0;i<370;i++) {
    const ex=exceptions.get(key); const h=ex?.excepcion_tipo==='inhabil'?null:ex?.excepcion_tipo==='horario_especial'?ex:schedules.get(new Date(`${key}T12:00:00Z`).getUTCDay());
    const inicioHorario = ex?.excepcion_tipo === 'horario_especial' ? ex.excepcion_inicio : h?.hora_inicio;
    const finHorario = ex?.excepcion_tipo === 'horario_especial' ? ex.excepcion_fin : h?.hora_fin;
    if (h && h.activo !== false && inicioHorario && finHorario) {
      const open=fromLocal(key,String(inicioHorario),zone), close=fromLocal(key,String(finHorario),zone);
      if (at >= open && at <= close) return at;
      if (at < open) return open;
    }
    key=nextDay(key);
  }
  return at;
}

async function resolveOwner(client: any, contactSeller: number | null) {
  const seller = contactSeller ?? FABY_CONTACTO_ID;
  const { rows } = await client.query(`SELECT u.id FROM core.usuarios u JOIN public.contactos c ON c.id=u.vendedor_contacto_id
    JOIN core.usuarios_empresas ue ON ue.usuario_id=u.id AND ue.empresa_id=$1 AND ue.activo=true
    WHERE u.id=$2 AND u.activo=true AND c.id=$3 AND c.empresa_id=$1 AND c.activo=true LIMIT 1`, [EMPRESA_ID, contactSeller ? null : FABY_USUARIO_ID, seller]);
  if (rows[0]) return Number(rows[0].id);
  if (contactSeller) {
    const fallback = await client.query(`SELECT u.id FROM core.usuarios u JOIN core.usuarios_empresas ue ON ue.usuario_id=u.id AND ue.empresa_id=$1 AND ue.activo=true
      WHERE u.vendedor_contacto_id=$2 AND u.activo=true LIMIT 1`, [EMPRESA_ID, contactSeller]);
    if (fallback.rows[0]) return Number(fallback.rows[0].id);
  }
  const faby = await client.query(`SELECT u.id FROM core.usuarios u JOIN public.contactos c ON c.id=u.vendedor_contacto_id JOIN core.usuarios_empresas ue ON ue.usuario_id=u.id AND ue.empresa_id=$1 AND ue.activo=true
    WHERE u.id=$2 AND u.activo=true AND c.id=$3 AND c.empresa_id=$1 AND c.activo=true`, [EMPRESA_ID,FABY_USUARIO_ID,FABY_CONTACTO_ID]);
  if (!faby.rows[0]) throw new Error('META_FABY_CONFIG_INVALID');
  return FABY_USUARIO_ID;
}

async function findContact(client: any, phone: string | null, email: string | null) {
  if (phone) {
    const r=await client.query(`SELECT * FROM public.contactos WHERE empresa_id=$1 AND (telefono=$2 OR telefono_secundario=$2) FOR UPDATE`,[EMPRESA_ID,phone]);
    if (r.rows.length>1) throw new Error('META_AMBIGUOUS_PHONE');
    if (r.rows[0]) return r.rows[0];
  }
  if (email) {
    const r=await client.query(`SELECT * FROM public.contactos WHERE empresa_id=$1 AND lower(trim(email))=$2 FOR UPDATE`,[EMPRESA_ID,email]);
    if (r.rows.length>1) throw new Error('META_AMBIGUOUS_EMAIL');
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

async function processEvent(event: LeadEvent) {
  if (String(event.page_id ?? '') !== PAGE_ID) return;
  const phoneRaw=text(event.lead.phone_number), email=normalizeEmail(event.lead.email);
  let phone: string|null=null; if (phoneRaw) { try { phone=normalizarTelefono(phoneRaw); } catch { phone=null; } }
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const locked=await client.query(`SELECT * FROM crm.meta_leads WHERE empresa_id=$1 AND leadgen_id=$2 FOR UPDATE`,[EMPRESA_ID,event.leadgen_id]);
    if (!locked.rows[0]) throw new Error('META_EVENT_NOT_FOUND');
    if (['procesado','revision'].includes(locked.rows[0].estado)) { await client.query('COMMIT'); return; }
    if (!phone && !email) { await client.query(`UPDATE crm.meta_leads SET estado='revision',ultimo_error=$3,actualizado_at=now() WHERE empresa_id=$1 AND leadgen_id=$2`,[EMPRESA_ID,event.leadgen_id,'MISSING_CONTACT_IDENTIFIER']); await client.query('COMMIT'); return; }
    let contact=await findContact(client,phone,email);
    if (!contact) {
      const valid=await client.query(`SELECT 1 FROM core.usuarios u JOIN public.contactos c ON c.id=u.vendedor_contacto_id JOIN core.usuarios_empresas ue ON ue.usuario_id=u.id AND ue.empresa_id=$1 AND ue.activo=true WHERE u.id=$2 AND u.activo=true AND c.id=$3 AND c.empresa_id=$1 AND c.activo=true`,[EMPRESA_ID,FABY_USUARIO_ID,FABY_CONTACTO_ID]);
      if (!valid.rows[0]) throw new Error('META_FABY_CONFIG_INVALID');
      const origin=await client.query(`SELECT c.id FROM core.catalogos c JOIN core.catalogos_tipos ct ON ct.id=c.tipo_catalogo_id WHERE c.empresa_id=$1 AND ct.empresa_id=$1 AND ct.nombre ILIKE '%origen%' AND c.activo=true AND c.descripcion='Anuncio de Meta' LIMIT 1`,[EMPRESA_ID]);
      let originId=origin.rows[0]?.id;
      if (!originId) {
        // No existe una clave única que identifique valores de catálogo por
        // empresa/tipo/clave. El advisory lock transaccional serializa sólo
        // la creación de este valor para empresa 2 y el tipo de origen.
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`meta-origin:${EMPRESA_ID}:origenes-contactos:ANUNCIO_META`]);
        const afterLock = await client.query(`SELECT c.id FROM core.catalogos c JOIN core.catalogos_tipos ct ON ct.id=c.tipo_catalogo_id
          WHERE c.empresa_id=$1 AND ct.empresa_id=$1 AND ct.nombre ILIKE '%origen%' AND c.activo=true AND c.descripcion='Anuncio de Meta' LIMIT 1`, [EMPRESA_ID]);
        originId = afterLock.rows[0]?.id;
      }
      if (!originId) {
        const type = await client.query(`SELECT id FROM core.catalogos_tipos WHERE empresa_id=$1 AND nombre ILIKE '%origen%' AND activo=true ORDER BY id LIMIT 1`, [EMPRESA_ID]);
        if (type.rows[0]) {
          const created = await client.query(`INSERT INTO core.catalogos (empresa_id,tipo_catalogo_id,clave,descripcion,activo) VALUES ($1,$2,'ANUNCIO_META','Anuncio de Meta',true) RETURNING id`, [EMPRESA_ID, type.rows[0].id]);
          originId = created.rows[0]?.id;
          if (!originId) {
            const existing = await client.query(`SELECT id FROM core.catalogos WHERE empresa_id=$1 AND tipo_catalogo_id=$2 AND descripcion='Anuncio de Meta' AND activo=true LIMIT 1`, [EMPRESA_ID, type.rows[0].id]);
            originId = existing.rows[0]?.id;
          }
        }
      }
      if (!originId) throw new Error('META_ORIGIN_CATALOG_MISSING');
      const company=text(event.lead.company_name), full=text(event.lead.full_name); const name=company||full||'Lead de Meta';
      const inserted=await client.query(`INSERT INTO public.contactos (empresa_id,tipo_contacto,nombre,nombre_contacto,email,telefono,vendedor_id) VALUES ($1,'Lead',$2,$3,$4,$5,$6) RETURNING *`,[EMPRESA_ID,name,full,email,phone,FABY_CONTACTO_ID]); contact=inserted.rows[0];
      const et=await client.query(`SELECT id FROM core.entidades_tipos WHERE codigo='CONTACTO' LIMIT 1`); await client.query(`INSERT INTO core.entidades_catalogos (empresa_id,entidad_tipo_id,entidad_id,catalogo_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[EMPRESA_ID,et.rows[0].id,contact.id,originId]);
    }
    const owner=await resolveOwner(client,contact.vendedor_id ? Number(contact.vendedor_id) : null);
    const scheduled=await nextBusinessOpening(new Date());
    const formName=text(locked.rows[0].form_name);
    const notes=formName ? `Nueva solicitud comercial desde Meta. Formulario: ${formName}.` : 'Nueva solicitud comercial desde Meta.';
    const activity=await client.query(`INSERT INTO crm.actividades (empresa_id,usuario_asignado_id,usuario_creador_id,contacto_id,oportunidad_id,tipo_actividad,fecha_programada,notas,estatus,recordatorio,recordatorio_minutos) VALUES ($1,$2,$2,$3,NULL,'tarea',$4,$5,'pendiente',true,1) RETURNING id`,[EMPRESA_ID,owner,contact.id,scheduled,notes]);
    await client.query(`UPDATE crm.meta_leads SET estado='procesado',intentos=intentos+1,contacto_id=$3,actividad_id=$4,procesado_at=now(),actualizado_at=now(),ultimo_error=NULL WHERE empresa_id=$1 AND leadgen_id=$2`,[EMPRESA_ID,event.leadgen_id,contact.id,activity.rows[0].id]);
    await client.query('COMMIT');
    console.info('[Meta Leads] Evento comercial procesado',{leadgen_id:event.leadgen_id,contacto_id:contact.id,actividad_id:activity.rows[0].id});
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function processMetaLeadCommercial(event: LeadEvent) {
  try { await processEvent(event); }
  catch (error) {
    const code=error instanceof Error?error.message:'META_PROCESSING_ERROR'; const review=/AMBIGUOUS|MISSING_CONTACT_IDENTIFIER|CONFIG|ORIGIN/.test(code);
    await pool.query(`UPDATE crm.meta_leads SET estado=$3, intentos=intentos+1, ultimo_error=$4, proximo_reintento_at=CASE WHEN $3='pendiente' THEN now()+interval '15 minutes' ELSE NULL END, actualizado_at=now() WHERE empresa_id=$1 AND leadgen_id=$2`,[EMPRESA_ID,event.leadgen_id,review?'revision':'pendiente',code.slice(0,160)]);
    console.error('[Meta Leads] Procesamiento comercial fallido',{leadgen_id:event.leadgen_id,reason:code});
  }
}

export async function retryPendingMetaLeads() {
  const pending = await pool.query(`SELECT leadgen_id,page_id,form_id,created_time FROM crm.meta_leads
    WHERE empresa_id=$1 AND estado='pendiente' AND (proximo_reintento_at IS NULL OR proximo_reintento_at<=now()) AND intentos<5
    ORDER BY recibido_at LIMIT 20`, [EMPRESA_ID]);
  for (const row of pending.rows) {
    try {
      const token = process.env.META_LEADS_PAGE_ACCESS_TOKEN;
      if (!token) return;
      const response = await axios.get(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(row.leadgen_id)}`, { params: { fields: 'id,created_time,field_data,form_id,ad_id,campaign_id', access_token: token }, timeout: 10000 });
      const { normalizeMetaLead } = await import('./meta-leads.service');
      const normalized = normalizeMetaLead(response.data, row);
      await processMetaLeadCommercial({ ...row, lead: normalized.lead, fieldNames: normalized.fieldNames });
    } catch (error) {
      await pool.query(`UPDATE crm.meta_leads SET intentos=intentos+1,ultimo_error=$3,proximo_reintento_at=now()+interval '15 minutes',actualizado_at=now() WHERE empresa_id=$1 AND leadgen_id=$2`, [EMPRESA_ID, row.leadgen_id, 'RETRY_GRAPH_OR_PROCESSING_ERROR']);
      console.error('[Meta Leads] Reintento fallido', { leadgen_id: row.leadgen_id });
    }
  }
}
