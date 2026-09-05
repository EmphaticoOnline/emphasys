import pool from '../../config/database';
import { DOMICILIO_FIELDS, validarDomicilio } from './contactos-domicilios.repository';

export async function listarDomiciliosEmpresa(empresaId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM public.contactos_domicilios
      WHERE empresa_id=$1 AND contacto_id IS NULL
      ORDER BY es_principal DESC, activo DESC, identificador, id`, [empresaId]);
  return rows;
}

export async function crearDomicilioEmpresa(empresaId: number, data: unknown) {
  const validation = validarDomicilio(data);
  if (validation.error) throw new Error(validation.error);
  const payload = validation.payload!;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (payload.es_principal) await client.query('UPDATE public.contactos_domicilios SET es_principal=false WHERE empresa_id=$1 AND contacto_id IS NULL', [empresaId]);
    const names = DOMICILIO_FIELDS.join(', ');
    const placeholders = DOMICILIO_FIELDS.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await client.query(`INSERT INTO public.contactos_domicilios (empresa_id, contacto_id, ${names}, es_principal, activo) VALUES ($1, NULL, ${placeholders}, $${DOMICILIO_FIELDS.length + 2}, $${DOMICILIO_FIELDS.length + 3}) RETURNING *`, [empresaId, ...DOMICILIO_FIELDS.map((field) => payload[field]), Boolean(payload.es_principal), payload.activo !== false]);
    await client.query('COMMIT');
    return rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function actualizarDomicilioEmpresa(empresaId: number, domicilioId: number, data: unknown) {
  const validation = validarDomicilio(data);
  if (validation.error) throw new Error(validation.error);
  const payload = validation.payload!;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT 1 FROM public.contactos_domicilios WHERE id=$1 AND empresa_id=$2 AND contacto_id IS NULL', [domicilioId, empresaId]);
    if (exists.rowCount !== 1) { await client.query('ROLLBACK'); return null; }
    if (payload.es_principal) await client.query('UPDATE public.contactos_domicilios SET es_principal=false WHERE empresa_id=$1 AND contacto_id IS NULL AND id<>$2', [empresaId, domicilioId]);
    const sets = DOMICILIO_FIELDS.map((field, i) => `${field}=$${i + 1}`).join(', ');
    const { rows } = await client.query(`UPDATE public.contactos_domicilios SET ${sets}, es_principal=$${DOMICILIO_FIELDS.length + 1}, activo=$${DOMICILIO_FIELDS.length + 2}, updated_at=now() WHERE id=$${DOMICILIO_FIELDS.length + 3} AND empresa_id=$${DOMICILIO_FIELDS.length + 4} AND contacto_id IS NULL RETURNING *`, [...DOMICILIO_FIELDS.map((field) => payload[field]), Boolean(payload.es_principal), payload.activo !== false, domicilioId, empresaId]);
    await client.query('COMMIT');
    return rows[0] ?? null;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function actualizarActivoDomicilioEmpresa(empresaId: number, domicilioId: number, activo: boolean) {
  const { rows } = await pool.query('UPDATE public.contactos_domicilios SET activo=$1, updated_at=now() WHERE id=$2 AND empresa_id=$3 AND contacto_id IS NULL RETURNING *', [activo, domicilioId, empresaId]);
  return rows[0] ?? null;
}
