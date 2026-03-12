import pool from "../../../config/database";

export type ParametroOpcion = {
  opcion_id: number;
  parametro_id: number;
  valor: string;
  etiqueta: string;
  orden: number | null;
};

export async function listarOpciones(parametroId: number): Promise<ParametroOpcion[]> {
  const { rows } = await pool.query<ParametroOpcion>(
    `SELECT opcion_id, parametro_id, valor, etiqueta, orden
       FROM core.parametros_opciones
      WHERE parametro_id = $1
      ORDER BY orden ASC NULLS LAST, etiqueta ASC` ,
    [parametroId]
  );
  return rows;
}

export async function crearOpcion(parametroId: number, data: { valor: string; etiqueta: string; orden?: number | null }) {
  const { valor, etiqueta, orden = null } = data;
  const { rows } = await pool.query<ParametroOpcion>(
    `INSERT INTO core.parametros_opciones (parametro_id, valor, etiqueta, orden)
     VALUES ($1, $2, $3, $4)
     RETURNING opcion_id, parametro_id, valor, etiqueta, orden`,
    [parametroId, valor, etiqueta, orden]
  );
  return rows[0];
}

export async function actualizarOpcion(opcionId: number, data: { valor?: string; etiqueta?: string; orden?: number | null }) {
  const { valor, etiqueta, orden } = data;
  const { rows } = await pool.query<ParametroOpcion>(
    `UPDATE core.parametros_opciones
        SET valor = COALESCE($2, valor),
            etiqueta = COALESCE($3, etiqueta),
            orden = COALESCE($4, orden)
      WHERE opcion_id = $1
      RETURNING opcion_id, parametro_id, valor, etiqueta, orden`,
    [opcionId, valor ?? null, etiqueta ?? null, orden ?? null]
  );
  return rows[0] ?? null;
}

export async function eliminarOpcion(opcionId: number): Promise<boolean> {
  const result = await pool.query(`DELETE FROM core.parametros_opciones WHERE opcion_id = $1`, [opcionId]);
  return (result.rowCount ?? 0) > 0;
}