import pool from '../../config/database';

export type ContactoDomicilioPayload = {
  identificador: string;
  es_principal?: boolean;
  activo?: boolean;
  responsable?: string | null;
  domicilio?: string | null;
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  colonia?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  cp?: string | null;
  pais?: string | null;
  cruces?: string | null;
  recibe?: string | null;
  telefono_recibe?: string | null;
  coto_o_fraccionamiento?: string | null;
  telefono?: string | null;
  fax?: string | null;
  observaciones?: string | null;
  cp_sat?: string | null;
  colonia_sat?: string | null;
  tipo_referencia?: string | null;
  latitud?: number | null;
  longitud?: number | null;
};

export const DOMICILIO_FIELDS = ['identificador','responsable','domicilio','calle','numero_exterior','numero_interior','colonia','ciudad','estado','cp','pais','cruces','recibe','telefono_recibe','coto_o_fraccionamiento','telefono','fax','observaciones','cp_sat','colonia_sat','tipo_referencia','latitud','longitud'] as const;
const fields = DOMICILIO_FIELDS;

function clean(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export function normalizarDomicilio(data: any): ContactoDomicilioPayload {
  return { ...Object.fromEntries(fields.map((field) => [field, ['latitud','longitud'].includes(field) ? (data?.[field] === '' || data?.[field] == null ? null : Number(data[field])) : field === 'identificador' ? String(data?.[field] ?? '').trim() : clean(data?.[field])])), es_principal: Boolean(data?.es_principal), activo: data?.activo !== false } as ContactoDomicilioPayload;
}

export function validarDomicilio(data: any): { payload?: ContactoDomicilioPayload; error?: string } {
  const payload = normalizarDomicilio(data);
  if (!payload.identificador) return { error: 'El identificador es obligatorio' };
  if (payload.identificador.toUpperCase() === 'PRINCIPAL') return { error: 'El identificador PRINCIPAL está reservado' };
  if (payload.cp && !/^\d{5}$/.test(payload.cp)) return { error: 'El código postal debe tener 5 dígitos' };
  if (payload.cp_sat && !/^\d{5}$/.test(payload.cp_sat)) return { error: 'El código postal SAT debe tener 5 dígitos' };
  if (payload.latitud != null && (!Number.isFinite(payload.latitud) || payload.latitud < -90 || payload.latitud > 90)) return { error: 'La latitud debe estar entre -90 y 90' };
  if (payload.longitud != null && (!Number.isFinite(payload.longitud) || payload.longitud < -180 || payload.longitud > 180)) return { error: 'La longitud debe estar entre -180 y 180' };
  const useful = fields.filter((field) => field !== 'identificador').some((field) => payload[field] != null);
  if (!useful) return { error: 'El domicilio no puede estar vacío' };
  return { payload };
}

async function contactBelongs(contactoId: number, empresaId: number): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM public.contactos WHERE id=$1 AND empresa_id=$2 LIMIT 1', [contactoId, empresaId]);
  return result.rowCount === 1;
}

export async function listarDomicilios(contactoId: number, empresaId: number) {
  if (!(await contactBelongs(contactoId, empresaId))) return null;
  const { rows } = await pool.query('SELECT * FROM public.contactos_domicilios WHERE contacto_id=$1 ORDER BY es_principal DESC, identificador,id', [contactoId]);
  return rows;
}

export async function crearDomicilio(contactoId: number, empresaId: number, payload: ContactoDomicilioPayload) {
  if (!(await contactBelongs(contactoId, empresaId))) return null;
  if (payload.es_principal) await pool.query('UPDATE public.contactos_domicilios SET es_principal=false WHERE contacto_id=$1', [contactoId]);
  const names = fields.join(', ');
  const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');
  const { rows } = await pool.query(`INSERT INTO public.contactos_domicilios (contacto_id, ${names}, es_principal, activo) VALUES ($1, ${placeholders}, $${fields.length + 2}, $${fields.length + 3}) RETURNING *`, [contactoId, ...fields.map((field) => payload[field]), Boolean(payload.es_principal), payload.activo !== false]);
  return rows[0];
}

export async function actualizarDomicilio(contactoId: number, domicilioId: number, empresaId: number, payload: ContactoDomicilioPayload) {
  if (!(await contactBelongs(contactoId, empresaId))) return null;
  if (payload.es_principal) await pool.query('UPDATE public.contactos_domicilios SET es_principal=false WHERE contacto_id=$1 AND id<>$2', [contactoId, domicilioId]);
  const sets = fields.map((field, i) => `${field}=$${i + 1}`).join(', ');
  const values: any[] = fields.filter((field) => field !== 'identificador').map((field) => payload[field]);
  values.length = 0;
  values.push(...fields.map((field) => payload[field]), Boolean(payload.es_principal), payload.activo !== false, domicilioId, contactoId);
  const { rows } = await pool.query(`UPDATE public.contactos_domicilios SET ${sets}, es_principal=$${fields.length + 1}, activo=$${fields.length + 2}, updated_at=now() WHERE id=$${fields.length + 3} AND contacto_id=$${fields.length + 4} RETURNING *`, values);
  return rows[0] ?? null;
}

export async function eliminarDomicilio(contactoId: number, domicilioId: number, empresaId: number) {
  if (!(await contactBelongs(contactoId, empresaId))) return null;
  const { rows } = await pool.query('DELETE FROM public.contactos_domicilios WHERE id=$1 AND contacto_id=$2 AND es_principal=false AND activo=false RETURNING *', [domicilioId, contactoId]);
  return rows[0] ?? null;
}
