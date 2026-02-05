import pool from '../../config/database';
import { getEmpresaActivaId } from '../../shared/context/empresa';

export async function obtenerContactos() {
  const empresaId = getEmpresaActivaId();

  const result = await pool.query(
    `SELECT *
     FROM contactos
     WHERE empresa_id = $1
     ORDER BY id`,
    [empresaId]
  );

  return result.rows;
}

export async function insertarContacto(data: {
  nombre: string;
  email?: string;
  telefono?: string;
}) {
  const empresaId = getEmpresaActivaId();

  const result = await pool.query(
    `
    INSERT INTO contactos (
      empresa_id,
      nombre,
      email,
      telefono
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [empresaId, data.nombre, data.email ?? null, data.telefono ?? null]
  );

  return result.rows[0];
}
