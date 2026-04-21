import pool from '../../../config/database';

export type LayoutSerieRow = {
  id: number;
  serie: string;
  tipo_documento: string;
  layout_id: number | null;
};

export type PlantillaLayoutRow = {
  id: number;
  empresa_id: number;
  tipo_documento: string | null;
  configuracion: Record<string, any> | null;
  activo: boolean;
  contenido_html: string | null;
  nombre: string | null;
};

export async function obtenerSerieDocumento(
  empresaId: number,
  tipoDocumento: string,
  serie: string
): Promise<LayoutSerieRow | null> {
  const query = `
    SELECT id, serie, tipo_documento, layout_id
      FROM public.series_documento
     WHERE empresa_id = $1
       AND tipo_documento = $2
       AND serie = $3
     LIMIT 1
  `;
  const { rows } = await pool.query<LayoutSerieRow>(query, [empresaId, tipoDocumento, serie]);
  return rows[0] ?? null;
}

export async function obtenerLayoutSerie(
  empresaId: number,
  tipoDocumento: string,
  serie: string
): Promise<Pick<PlantillaLayoutRow, 'id' | 'configuracion'> | null> {
  const query = `
    SELECT pd.id, pd.configuracion
      FROM public.series_documento sd
      LEFT JOIN public.plantillas_documento pd ON pd.id = sd.layout_id
     WHERE sd.empresa_id = $1
       AND sd.tipo_documento = $2
       AND sd.serie = $3
     LIMIT 1
  `;
  const { rows } = await pool.query<Pick<PlantillaLayoutRow, 'id' | 'configuracion'>>(query, [empresaId, tipoDocumento, serie]);
  return rows[0] ?? null;
}

export async function obtenerLayoutEmpresa(
  empresaId: number,
  tipoDocumento: string
): Promise<Pick<PlantillaLayoutRow, 'id' | 'configuracion'> | null> {
  const query = `
    SELECT id, configuracion
      FROM public.plantillas_documento
     WHERE empresa_id = $1
       AND activo = true
       AND (tipo_documento IS NULL OR tipo_documento = $2)
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1
  `;
  const { rows } = await pool.query<Pick<PlantillaLayoutRow, 'id' | 'configuracion'>>(query, [empresaId, tipoDocumento]);
  return rows[0] ?? null;
}

export async function listarSeriesDocumento(
  empresaId: number,
  tipoDocumento: string
): Promise<LayoutSerieRow[]> {
  const query = `
    SELECT id, serie, tipo_documento, layout_id
      FROM public.series_documento
     WHERE empresa_id = $1
       AND tipo_documento = $2
  ORDER BY serie ASC
  `;
  const { rows } = await pool.query<LayoutSerieRow>(query, [empresaId, tipoDocumento]);
  return rows;
}

export async function actualizarLayoutConfiguracion(id: number, configuracion: Record<string, any>) {
  const query = `
    UPDATE public.plantillas_documento
       SET configuracion = $1,
           activo = true,
           updated_at = NOW()
     WHERE id = $2
     RETURNING id, configuracion
  `;
  const { rows } = await pool.query(query, [configuracion, id]);
  return rows[0] ?? null;
}

export async function crearLayoutConfiguracion(
  empresaId: number,
  tipoDocumento: string,
  nombre: string,
  configuracion: Record<string, any>
) {
  const query = `
    INSERT INTO public.plantillas_documento
      (empresa_id, tipo_documento, nombre, contenido_html, configuracion, activo)
    VALUES ($1, $2, $3, $4, $5, true)
    RETURNING id, configuracion
  `;
  const { rows } = await pool.query(query, [empresaId, tipoDocumento, nombre, '', configuracion]);
  return rows[0] ?? null;
}

export async function asignarLayoutASerie(serieId: number, layoutId: number) {
  const query = `
    UPDATE public.series_documento
       SET layout_id = $1,
           updated_at = NOW()
     WHERE id = $2
     RETURNING id, layout_id
  `;
  const { rows } = await pool.query(query, [layoutId, serieId]);
  return rows[0] ?? null;
}
