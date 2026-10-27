import pool from '../../config/database';

export type ContactoAdicionalPayload = {
  nombre: string;
  puesto: string | null;
  email: string | null;
  telefono: string | null;
  telefono_secundario: string | null;
  observaciones: string | null;
  activo: boolean;
};

const fields = ['nombre', 'puesto', 'email', 'telefono', 'telefono_secundario', 'observaciones', 'activo'] as const;

const LIMITES: Record<string, number> = { nombre: 150, puesto: 100, email: 150, telefono: 30, telefono_secundario: 30 };
const ETIQUETAS: Record<string, string> = { nombre: 'nombre', puesto: 'puesto', email: 'correo', telefono: 'teléfono', telefono_secundario: 'teléfono secundario' };

function clean(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export function validarContactoAdicional(data: any): { payload?: ContactoAdicionalPayload; error?: string } {
  const payload: ContactoAdicionalPayload = {
    nombre: clean(data?.nombre) ?? '',
    puesto: clean(data?.puesto),
    email: clean(data?.email)?.toLowerCase() ?? null,
    telefono: clean(data?.telefono),
    telefono_secundario: clean(data?.telefono_secundario),
    observaciones: clean(data?.observaciones),
    activo: data?.activo !== false,
  };
  if (!payload.nombre) return { error: 'El nombre es obligatorio' };
  for (const [field, max] of Object.entries(LIMITES)) {
    const value = payload[field as keyof ContactoAdicionalPayload];
    if (typeof value === 'string' && value.length > max) return { error: `El ${ETIQUETAS[field]} no puede exceder ${max} caracteres` };
  }
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return { error: 'El correo no es válido' };
  return { payload };
}

async function contactBelongs(contactoId: number, empresaId: number): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM public.contactos WHERE id=$1 AND empresa_id=$2 LIMIT 1', [contactoId, empresaId]);
  return result.rowCount === 1;
}

export async function listarContactosAdicionales(contactoId: number, empresaId: number) {
  if (!(await contactBelongs(contactoId, empresaId))) return null;
  const { rows } = await pool.query(
    'SELECT * FROM public.contactos_adicionales WHERE empresa_id=$1 AND contacto_id=$2 ORDER BY activo DESC, lower(nombre), id',
    [empresaId, contactoId],
  );
  return rows;
}

export async function crearContactoAdicional(contactoId: number, empresaId: number, payload: ContactoAdicionalPayload) {
  if (!(await contactBelongs(contactoId, empresaId))) return null;
  const placeholders = fields.map((_, i) => `$${i + 3}`).join(', ');
  const { rows } = await pool.query(
    `INSERT INTO public.contactos_adicionales (empresa_id, contacto_id, ${fields.join(', ')}) VALUES ($1, $2, ${placeholders}) RETURNING *`,
    [empresaId, contactoId, ...fields.map((field) => payload[field])],
  );
  return rows[0];
}

export async function actualizarContactoAdicional(contactoId: number, adicionalId: number, empresaId: number, payload: ContactoAdicionalPayload) {
  const sets = fields.map((field, i) => `${field}=$${i + 1}`).join(', ');
  const n = fields.length;
  const { rows } = await pool.query(
    `UPDATE public.contactos_adicionales SET ${sets} WHERE id=$${n + 1} AND contacto_id=$${n + 2} AND empresa_id=$${n + 3} RETURNING *`,
    [...fields.map((field) => payload[field]), adicionalId, contactoId, empresaId],
  );
  return rows[0] ?? null;
}

export async function cambiarActivoContactoAdicional(contactoId: number, adicionalId: number, empresaId: number, activo: boolean) {
  const { rows } = await pool.query(
    'UPDATE public.contactos_adicionales SET activo=$1 WHERE id=$2 AND contacto_id=$3 AND empresa_id=$4 RETURNING *',
    [activo, adicionalId, contactoId, empresaId],
  );
  return rows[0] ?? null;
}

export async function eliminarContactoAdicional(contactoId: number, adicionalId: number, empresaId: number) {
  const { rows } = await pool.query(
    'DELETE FROM public.contactos_adicionales WHERE id=$1 AND contacto_id=$2 AND empresa_id=$3 RETURNING id',
    [adicionalId, contactoId, empresaId],
  );
  return rows[0] ?? null;
}
