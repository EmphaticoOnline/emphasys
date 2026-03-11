import bcrypt from 'bcrypt';
import pool from '../../config/database';

export type Usuario = {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  es_superadmin: boolean;
  created_at: string;
};

export type UsuarioDetalle = Usuario & {
  empresas: { empresa_id: number; activo: boolean }[];
  roles: { empresa_id: number; rol_id: number }[];
};

const SALT_ROUNDS = 10;

export async function listarUsuarios(): Promise<Usuario[]> {
  const { rows } = await pool.query<Usuario>(
    `SELECT id, nombre, email, activo, es_superadmin, created_at
       FROM core.usuarios
      ORDER BY nombre`
  );
  return rows;
}

export async function obtenerUsuarioPorId(id: number): Promise<UsuarioDetalle | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT id, nombre, email, activo, es_superadmin, created_at
       FROM core.usuarios
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  const base = rows[0];
  if (!base) return null;

  const empresasRes = await pool.query<{ empresa_id: number; activo: boolean }>(
    `SELECT empresa_id, activo
       FROM core.usuarios_empresas
      WHERE usuario_id = $1`,
    [id]
  );
  const rolesRes = await pool.query<{ empresa_id: number; rol_id: number }>(
    `SELECT empresa_id, rol_id
       FROM core.usuarios_roles
      WHERE usuario_id = $1`,
    [id]
  );

  return { ...base, empresas: empresasRes.rows, roles: rolesRes.rows };
}

export async function obtenerUsuarioEmpresasYRoles(id: number): Promise<{ empresas: { empresa_id: number; activo: boolean }[]; roles: { empresa_id: number; rol_id: number }[] } | null> {
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM core.usuarios WHERE id = $1 LIMIT 1`, [id]);
  if (!rows[0]) return null;

  const empresasRes = await pool.query<{ empresa_id: number; activo: boolean }>(
    `SELECT empresa_id, activo
       FROM core.usuarios_empresas
      WHERE usuario_id = $1`,
    [id]
  );
  const rolesRes = await pool.query<{ empresa_id: number; rol_id: number }>(
    `SELECT empresa_id, rol_id
       FROM core.usuarios_roles
      WHERE usuario_id = $1`,
    [id]
  );

  return { empresas: empresasRes.rows, roles: rolesRes.rows };
}

export async function crearUsuario(data: {
  nombre: string;
  email: string;
  password: string;
  es_superadmin?: boolean;
  activo?: boolean;
}): Promise<Usuario> {
  const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const { rows } = await pool.query<Usuario>(
    `INSERT INTO core.usuarios (nombre, email, password_hash, es_superadmin, activo)
     VALUES ($1, lower($2), $3, $4, $5)
     RETURNING id, nombre, email, activo, es_superadmin, created_at`,
    [data.nombre.trim(), data.email.trim(), password_hash, Boolean(data.es_superadmin), data.activo ?? true]
  );
  return rows[0];
}

export async function actualizarUsuario(id: number, data: {
  nombre?: string;
  email?: string;
  password?: string;
  es_superadmin?: boolean;
  activo?: boolean;
}): Promise<Usuario | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.nombre !== undefined) {
    updates.push(`nombre = $${idx++}`);
    values.push(data.nombre.trim());
  }
  if (data.email !== undefined) {
    updates.push(`email = lower($${idx++})`);
    values.push(data.email.trim());
  }
  if (data.password !== undefined) {
    const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    updates.push(`password_hash = $${idx++}`);
    values.push(hash);
  }
  if (data.es_superadmin !== undefined) {
    updates.push(`es_superadmin = $${idx++}`);
    values.push(Boolean(data.es_superadmin));
  }
  if (data.activo !== undefined) {
    updates.push(`activo = $${idx++}`);
    values.push(Boolean(data.activo));
  }

  if (!updates.length) return obtenerUsuarioSimple(id);

  values.push(id);
  const { rows } = await pool.query<Usuario>(
    `UPDATE core.usuarios
        SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, nombre, email, activo, es_superadmin, created_at`,
    values
  );
  return rows[0] ?? null;
}

async function obtenerUsuarioSimple(id: number): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT id, nombre, email, activo, es_superadmin, created_at
       FROM core.usuarios
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function asignarEmpresas(usuarioId: number, empresas: { empresa_id: number; activo?: boolean }[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM core.usuarios_empresas WHERE usuario_id = $1`, [usuarioId]);
    await client.query(`DELETE FROM core.usuarios_roles WHERE usuario_id = $1`, [usuarioId]);
    for (const item of empresas) {
      await client.query(
        `INSERT INTO core.usuarios_empresas (usuario_id, empresa_id, activo)
         VALUES ($1, $2, $3)`,
        [usuarioId, item.empresa_id, item.activo ?? true]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function asignarRoles(usuarioId: number, empresaId: number, roles: number[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM core.usuarios_roles WHERE usuario_id = $1 AND empresa_id = $2`, [usuarioId, empresaId]);
    for (const rolId of roles) {
      await client.query(
        `INSERT INTO core.usuarios_roles (usuario_id, empresa_id, rol_id)
         VALUES ($1, $2, $3)`,
        [usuarioId, empresaId, rolId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function usuarioTieneRelaciones(id: number): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT (
        (SELECT COUNT(*) FROM core.usuarios_empresas WHERE usuario_id = $1) +
        (SELECT COUNT(*) FROM core.usuarios_roles WHERE usuario_id = $1)
      )::int AS count`,
    [id]
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function desactivarUsuario(id: number): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `UPDATE core.usuarios
        SET activo = false
      WHERE id = $1
      RETURNING id, nombre, email, activo, es_superadmin, created_at`,
    [id]
  );
  return rows[0] ?? null;
}
