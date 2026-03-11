import pool from '../../config/database';

export type Rol = {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
};

export async function listarRoles(empresaId: number): Promise<Rol[]> {
  const { rows } = await pool.query<Rol>(
    `SELECT id, empresa_id, nombre, descripcion, activo, created_at
       FROM core.roles
      WHERE empresa_id = $1
      ORDER BY nombre`,
    [empresaId]
  );
  return rows;
}

export async function crearRol(data: { empresa_id: number; nombre: string; descripcion?: string | null; activo?: boolean }): Promise<Rol> {
  const { empresa_id, nombre, descripcion = null, activo = true } = data;
  const { rows } = await pool.query<Rol>(
    `INSERT INTO core.roles (empresa_id, nombre, descripcion, activo)
     VALUES ($1, $2, $3, $4)
     RETURNING id, empresa_id, nombre, descripcion, activo, created_at`,
    [empresa_id, nombre.trim(), descripcion, activo]
  );
  return rows[0];
}

export async function actualizarRol(
  id: number,
  empresaId: number,
  data: { nombre?: string; descripcion?: string | null; activo?: boolean }
): Promise<Rol | null> {
  const { nombre, descripcion, activo } = data;
  const { rows } = await pool.query<Rol>(
    `UPDATE core.roles
        SET nombre = COALESCE($3, nombre),
            descripcion = COALESCE($4, descripcion),
            activo = COALESCE($5, activo)
      WHERE id = $1
        AND empresa_id = $2
      RETURNING id, empresa_id, nombre, descripcion, activo, created_at`,
    [id, empresaId, nombre?.trim() ?? null, descripcion ?? null, activo]
  );
  return rows[0] ?? null;
}

export async function rolTieneUsuarios(rolId: number): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM core.usuarios_roles WHERE rol_id = $1`, [rolId]);
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function eliminarRol(id: number, empresaId: number): Promise<boolean> {
  const result = await pool.query(`DELETE FROM core.roles WHERE id = $1 AND empresa_id = $2`, [id, empresaId]);
  return (result.rowCount ?? 0) > 0;
}
