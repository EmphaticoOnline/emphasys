import pool from '../../config/database';

export interface Concepto {
  id: number;
  empresa_id: number;
  nombre_concepto: string;
  es_gasto: boolean;
  activo: boolean;
  rubro_presupuesto_id?: number | null;
  observaciones?: string | null;
}

export type ConceptoInput = {
  nombre_concepto: string;
  es_gasto?: boolean;
  activo?: boolean;
  observaciones?: string | null;
};

export async function listarConceptos(empresaId: number): Promise<Concepto[]> {
  const { rows } = await pool.query<Concepto>(
    `SELECT * FROM conceptos WHERE empresa_id = $1 ORDER BY nombre_concepto`,
    [empresaId]
  );
  return rows;
}

export async function crearConcepto(data: ConceptoInput, empresaId: number): Promise<Concepto> {
  if (!data.nombre_concepto?.trim()) {
    throw new Error('El nombre_concepto es requerido');
  }
  const { rows } = await pool.query<Concepto>(
    `INSERT INTO conceptos (empresa_id, nombre_concepto, es_gasto, activo, observaciones)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      empresaId,
      data.nombre_concepto.trim(),
      data.es_gasto ?? true,
      data.activo ?? true,
      data.observaciones ?? null,
    ]
  );
  return rows[0];
}

export async function actualizarConcepto(id: number, data: ConceptoInput, empresaId: number): Promise<Concepto> {
  if (!data.nombre_concepto?.trim()) {
    throw new Error('El nombre_concepto es requerido');
  }
  const { rows } = await pool.query<Concepto>(
    `UPDATE conceptos
       SET nombre_concepto = $1,
           es_gasto = $2,
           activo = $3,
           observaciones = $4
     WHERE id = $5 AND empresa_id = $6
     RETURNING *`,
    [
      data.nombre_concepto.trim(),
      data.es_gasto ?? true,
      data.activo ?? true,
      data.observaciones ?? null,
      id,
      empresaId,
    ]
  );
  if (!rows[0]) throw new Error('Concepto no encontrado');
  return rows[0];
}

export async function eliminarConcepto(id: number, empresaId: number): Promise<void> {
  await pool.query(`DELETE FROM conceptos WHERE id = $1 AND empresa_id = $2`, [id, empresaId]);
}
