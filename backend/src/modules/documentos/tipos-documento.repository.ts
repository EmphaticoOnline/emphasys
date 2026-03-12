import pool from '../../config/database';

export type TipoDocumento = {
  codigo: string;
  nombre: string;
  nombre_plural: string | null;
  icono: string | null;
  orden?: number;
};

export async function listarTiposDocumento(): Promise<TipoDocumento[]> {
  const query = `
    SELECT codigo, nombre, nombre_plural, icono
      FROM core.tipos_documento
     WHERE activo = TRUE
     ORDER BY orden
  `;

  const { rows } = await pool.query<TipoDocumento>(query);
  return rows;
}

export async function listarTiposDocumentoEmpresa(
  empresaId: number,
  modulo?: string
): Promise<TipoDocumento[]> {
  const filterModulo = modulo ? 'AND td.modulo = $2' : '';
  const params: any[] = modulo ? [empresaId, modulo] : [empresaId];

  const query = `
    SELECT td.id, td.codigo, td.nombre, td.nombre_plural, td.icono, td.orden
      FROM core.empresas_tipos_documento etd
      JOIN core.tipos_documento td ON td.id = etd.tipo_documento_id
     WHERE etd.empresa_id = $1
       AND etd.activo = TRUE
       AND td.activo = TRUE
       ${filterModulo}
     ORDER BY td.orden, td.nombre;
  `;

  const { rows } = await pool.query<TipoDocumento>(query, params);
  return rows;
}
