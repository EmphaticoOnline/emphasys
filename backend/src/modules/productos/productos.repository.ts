import path from 'path';
import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { removeFileIfExists } from '../../services/fileStorage.service';
import { resolveUploadsDir } from '../uploads/uploads.multer';

export type ProductoArchivoRecord = {
  id: number;
  producto_id: number;
  tipo_archivo: string;
  archivo: string;
  descripcion: string | null;
  orden_visual: number;
  principal: boolean;
  fecha_creacion: string;
};

type CatalogoTipo = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
};

type CatalogoValor = {
  id: number;
  tipo_catalogo_id: number;
  descripcion: string;
  clave: string | null;
  orden: number | null;
};

type ProductoTecnicoRow = {
  id: number;
  clave: string;
  descripcion: string;
  activo: boolean;
  clasificacion: string | null;
  tipo_producto: string | null;
  familia: string | null;
  linea: string | null;
  presentacion: string | null;
  unidad_compra: string | null;
  factor_conversion: number | null;
  existencia_actual: number | null;
  minimo_inventario: number | null;
  costo_estandar: number | null;
  costo_promedio: number | null;
  ultimo_costo: number | null;
  precio_publico: number | null;
  precio_mayoreo: number | null;
  precio_menudeo: number | null;
  precio_distribuidor: number | null;
  iva_porcentaje: number | null;
  ieps_porcentaje: number | null;
  retiene_iva: boolean;
  retiene_isr: boolean;
  clave_producto_sat: string | null;
  fraccion_arancelaria: string | null;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  espesor: number | null;
  diametro: number | null;
  peso_unitario: number | null;
  equivalente_m2: number | null;
  piezas_por_empaque: number | null;
  peso_por_empaque: number | null;
  unidad_peso_empaque: string | null;
  ubicacion_almacen: string | null;
  proveedor_principal_id: number | null;
  proveedor_alternativo_1_id: number | null;
  proveedor_alternativo_2_id: number | null;
  archivo_fotografia_1: string | null;
  archivo_fotografia_2: string | null;
  archivo_ficha_tecnica: string | null;
  archivo_certificado: string | null;
  es_estacional: boolean;
  demanda_mensual_estimado: number | null;
  factor_demanda: number | null;
  observaciones: string | null;
  observaciones_compras: string | null;
  observaciones_diseno: string | null;
  fecha_creacion: string;
  empresa_id: number;
  unidad_venta_id: number | null;
  unidad_inventario_id: number | null;
  clave_unidad_sat: string | null;
  unidad_venta_clave?: string | null;
  unidad_venta_descripcion?: string | null;
  unidad_inventario_clave?: string | null;
  unidad_inventario_descripcion?: string | null;
};

const PRODUCTO_TECNICO_NC_CLAVE = 'NC-COMERCIAL';
const PRODUCTO_TECNICO_NC_DESCRIPCION = 'Nota de crédito comercial';
const PRODUCTO_TECNICO_NC_CLAVE_PRODUCTO_SAT = '01010101';

async function obtenerEntidadTipoIdProducto(): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM core.entidades_tipos WHERE codigo = 'PRODUCTO' LIMIT 1`
  );

  const entidadTipoId = rows[0]?.id;
  if (!entidadTipoId) {
    throw new Error('Tipo de entidad PRODUCTO no encontrado');
  }

  return entidadTipoId;
}

async function obtenerUnidadServicioId(empresaId: number): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT u.id
       FROM public.unidades u
       JOIN sat.unidades su ON su.id = u.unidad_sat_id
      WHERE u.empresa_id = $1
        AND u.activo = true
      ORDER BY CASE
        WHEN su.clave = 'E48' THEN 0
        WHEN su.clave = 'H87' THEN 1
        ELSE 2
      END,
      u.id
      LIMIT 1`,
    [empresaId]
  );

  return rows[0]?.id ?? null;
}

export async function obtenerOCrearProductoTecnicoNcComercialRepository(empresaId: number, client?: PoolClient): Promise<ProductoTecnicoRow> {
  const executor = client ?? pool;

  const { rows: existenteRows } = await executor.query<ProductoTecnicoRow>(
    `SELECT p.*,
            uv.clave AS unidad_venta_clave,
            uv.descripcion AS unidad_venta_descripcion,
            ui.clave AS unidad_inventario_clave,
            ui.descripcion AS unidad_inventario_descripcion
       FROM productos p
       LEFT JOIN unidades uv ON p.unidad_venta_id = uv.id
       LEFT JOIN unidades ui ON p.unidad_inventario_id = ui.id
      WHERE p.empresa_id = $1
        AND p.clave = $2
      LIMIT 1`,
    [empresaId, PRODUCTO_TECNICO_NC_CLAVE]
  );

  const unidadVentaId = await obtenerUnidadServicioId(empresaId);

  if (existenteRows[0]) {
    const existente = existenteRows[0];
    const requiereAjuste =
      existente.tipo_producto !== 'SERVICIO' ||
      !existente.activo ||
      !existente.unidad_venta_id ||
      existente.clave_producto_sat !== PRODUCTO_TECNICO_NC_CLAVE_PRODUCTO_SAT;

    if (!requiereAjuste) {
      return existente;
    }

    if (!unidadVentaId) {
      throw new Error('No se encontró una unidad de servicio activa para ajustar el producto técnico de nota de crédito.');
    }

    const { rows: actualizadas } = await executor.query<ProductoTecnicoRow>(
      `UPDATE productos
          SET descripcion = $1,
              activo = true,
              tipo_producto = 'SERVICIO',
              unidad_venta_id = $2,
              unidad_inventario_id = NULL,
              clave_producto_sat = $3,
              retiene_iva = false,
              retiene_isr = false,
              es_estacional = false,
              observaciones = $4
        WHERE empresa_id = $5
          AND clave = $6
        RETURNING *`,
      [
        PRODUCTO_TECNICO_NC_DESCRIPCION,
        unidadVentaId,
        PRODUCTO_TECNICO_NC_CLAVE_PRODUCTO_SAT,
        'Producto técnico interno para notas de crédito comerciales',
        empresaId,
        PRODUCTO_TECNICO_NC_CLAVE,
      ]
    );

    return actualizadas[0] ?? existente;
  }

  if (!unidadVentaId) {
    throw new Error('No se encontró una unidad de servicio activa para crear el producto técnico de nota de crédito.');
  }

  const { rows: insertRows } = await executor.query<ProductoTecnicoRow>(
    `INSERT INTO productos (
        empresa_id,
        clave,
        descripcion,
        activo,
        tipo_producto,
        unidad_venta_id,
        unidad_inventario_id,
        clave_producto_sat,
        observaciones,
        retiene_iva,
        retiene_isr,
        es_estacional
      ) VALUES (
        $1, $2, $3, true, $4, $5, NULL, $6, $7, false, false, false
      )
      ON CONFLICT (empresa_id, clave) DO UPDATE
        SET descripcion = EXCLUDED.descripcion,
            activo = true,
            tipo_producto = EXCLUDED.tipo_producto,
            unidad_venta_id = EXCLUDED.unidad_venta_id,
            clave_producto_sat = EXCLUDED.clave_producto_sat,
            observaciones = EXCLUDED.observaciones
      RETURNING *`,
    [
      empresaId,
      PRODUCTO_TECNICO_NC_CLAVE,
      PRODUCTO_TECNICO_NC_DESCRIPCION,
      'SERVICIO',
      unidadVentaId,
      PRODUCTO_TECNICO_NC_CLAVE_PRODUCTO_SAT,
      'Producto técnico interno para notas de crédito comerciales',
    ]
  );

  const producto = insertRows[0];
  if (!producto) {
    throw new Error('No se pudo crear el producto técnico de nota de crédito.');
  }

  return producto;
}

const CAMPOS = [
  'clave', 'descripcion', 'activo', 'clasificacion', 'tipo_producto', 'familia', 'linea', 'presentacion',
  'unidad_venta_id', 'unidad_compra', 'unidad_inventario_id', 'factor_conversion', 'existencia_actual',
  'minimo_inventario', 'costo_estandar', 'costo_promedio', 'ultimo_costo', 'precio_publico', 'precio_mayoreo',
  'precio_menudeo', 'precio_distribuidor', 'iva_porcentaje', 'ieps_porcentaje', 'retiene_iva', 'retiene_isr',
  'clave_producto_sat', 'unidad_sat', 'fraccion_arancelaria', 'largo', 'ancho', 'alto', 'espesor', 'diametro',
  'peso_unitario', 'equivalente_m2', 'piezas_por_empaque', 'peso_por_empaque', 'unidad_peso_empaque',
  'ubicacion_almacen', 'proveedor_principal_id', 'proveedor_alternativo_1_id', 'proveedor_alternativo_2_id',
  'archivo_fotografia_1', 'archivo_fotografia_2', 'archivo_ficha_tecnica', 'archivo_certificado', 'es_estacional',
  'demanda_mensual_estimado', 'factor_demanda', 'observaciones', 'observaciones_compras', 'observaciones_diseno',
  'fecha_creacion'
];

// Inserta un nuevo producto usando empresa_id
export async function insertarProductoRepository(data: any, empresaId: number) {
  const camposPresentes = CAMPOS.filter((campo) => campo in data);
  const values = [empresaId, ...camposPresentes.map((campo) => data[campo])];
  const params = values.map((_, idx) => `$${idx + 1}`).join(', ');
  const cols = ['empresa_id', ...camposPresentes];
  const query = `INSERT INTO productos (${cols.join(', ')}) VALUES (${params}) RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Obtiene los productos de la empresa activa
export async function getProductosRepository(empresaId: number) {
  const query = `
    SELECT
      p.*,
      uv.clave AS unidad_venta_clave,
      uv.descripcion AS unidad_venta_descripcion,
      ui.clave AS unidad_inventario_clave,
      ui.descripcion AS unidad_inventario_descripcion
  FROM productos p
  LEFT JOIN unidades uv ON p.unidad_venta_id = uv.id
  LEFT JOIN unidades ui ON p.unidad_inventario_id = ui.id
    WHERE p.empresa_id = $1
      AND p.clave <> $2
    ORDER BY p.id
  `;
  const { rows } = await pool.query(query, [empresaId, PRODUCTO_TECNICO_NC_CLAVE]);
  return rows;
}

export async function getProductosPaginadosRepository(
  empresaId: number,
  options: { page: number; limit: number; search?: string }
): Promise<{ data: any[]; total: number }> {
  const { page, limit, search } = options;
  const params: Array<string | number> = [empresaId, PRODUCTO_TECNICO_NC_CLAVE];
  const whereClauses = ['p.empresa_id = $1', 'p.clave <> $2'];

  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    const idx = params.length;
    whereClauses.push(`(p.clave ILIKE $${idx} OR p.descripcion ILIKE $${idx})`);
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const query = `
    SELECT
      p.*,
      uv.clave AS unidad_venta_clave,
      uv.descripcion AS unidad_venta_descripcion,
      ui.clave AS unidad_inventario_clave,
      ui.descripcion AS unidad_inventario_descripcion,
      COUNT(*) OVER() AS total_count
    FROM productos p
    LEFT JOIN unidades uv ON p.unidad_venta_id = uv.id
    LEFT JOIN unidades ui ON p.unidad_inventario_id = ui.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY p.id
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(query, params);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const data = rows.map((row: any) => {
    const { total_count, ...rest } = row;
    return rest;
  });
  return { data, total };
}

export async function getProductoByIdRepository(id: number, empresaId: number) {
  const query = `
    SELECT
      p.*,
      uv.clave AS unidad_venta_clave,
      uv.descripcion AS unidad_venta_descripcion,
      ui.clave AS unidad_inventario_clave,
      ui.descripcion AS unidad_inventario_descripcion
    FROM productos p
    LEFT JOIN unidades uv ON p.unidad_venta_id = uv.id
    LEFT JOIN unidades ui ON p.unidad_inventario_id = ui.id
    WHERE p.empresa_id = $1 AND p.id = $2
    LIMIT 1
  `;
  console.log('[BACK SQL DEBUG] getProductoById SQL', query);
  console.log('[BACK SQL DEBUG] getProductoById params', [empresaId, id]);
  const { rows } = await pool.query(query, [empresaId, id]);
  const row = rows[0];
  console.log('[BACK IVA DEBUG] getProductoById row', row ? { id: row.id, iva_porcentaje: row.iva_porcentaje } : null);
  return row;
}

export async function obtenerCatalogosConfigurablesDeProducto(
  empresaId: number,
  productoId?: number
): Promise<{
  entidad_tipo_id: number;
  tipos: (CatalogoTipo & { valores: CatalogoValor[] })[];
  seleccionados: number[];
}> {
  const entidadTipoId = await obtenerEntidadTipoIdProducto();

  const { rows: tipos } = await pool.query<CatalogoTipo>(
    `SELECT id, nombre, NULL::text AS descripcion
       FROM core.catalogos_tipos
      WHERE entidad_tipo_id = $1
        AND empresa_id = $2
        AND activo = true
      ORDER BY nombre NULLS LAST, id`,
    [entidadTipoId, empresaId]
  );

  const tipoIds = tipos.map((t) => t.id);

  const valores: CatalogoValor[] = tipoIds.length
    ? (await pool.query<CatalogoValor>(
        `SELECT id, tipo_catalogo_id, descripcion, clave, orden
           FROM core.catalogos
          WHERE tipo_catalogo_id = ANY($1)
            AND empresa_id = $2
            AND activo = true
          ORDER BY orden ASC NULLS LAST, descripcion ASC NULLS LAST, id`,
        [tipoIds, empresaId]
      )).rows
    : [];

  let seleccionados: number[] = [];

  if (productoId && Number.isFinite(productoId) && tipoIds.length) {
    const { rows } = await pool.query<{ catalogo_id: number }>(
      `SELECT catalogo_id
         FROM core.entidades_catalogos
        WHERE empresa_id = $1
          AND entidad_tipo_id = $2
          AND entidad_id = $3`,
      [empresaId, entidadTipoId, productoId]
    );
    seleccionados = rows.map((r) => r.catalogo_id);
  }

  const tiposConValores = tipos.map((tipo) => ({
    ...tipo,
    valores: valores.filter((v) => v.tipo_catalogo_id === tipo.id),
  }));

  return {
    entidad_tipo_id: entidadTipoId,
    tipos: tiposConValores,
    seleccionados,
  };
}

// Actualiza un producto por id
export async function updateProductoRepository(id: number, data: any, empresaId: number) {
  const fields: string[] = [];
  const values: any[] = [];

  for (const campo of CAMPOS) {
    if (campo in data) {
      fields.push(`${campo} = $${values.length + 1}`);
      values.push(data[campo]);
    }
  }

  if (fields.length === 0) throw new Error('No hay campos para actualizar');

  values.push(id);
  values.push(empresaId);

  const query = `
    UPDATE productos
    SET ${fields.join(', ')}
    WHERE id = $${values.length - 1}
      AND empresa_id = $${values.length}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Elimina un producto por id
export async function deleteProductoRepository(id: number, empresaId: number) {
  const query = 'DELETE FROM productos WHERE id = $1 AND empresa_id = $2 RETURNING *';
  const result = await pool.query(query, [id, empresaId]);
  return result.rows[0];
}

export async function guardarCatalogosConfigurablesDeProducto(
  empresaId: number,
  productoId: number,
  catalogoIds: number[]
) {
  const entidadTipoId = await obtenerEntidadTipoIdProducto();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM core.entidades_catalogos
        WHERE empresa_id = $1
          AND entidad_tipo_id = $2
          AND entidad_id = $3`,
      [empresaId, entidadTipoId, productoId]
    );

    if (catalogoIds.length) {
      const values = catalogoIds.map((_, idx) => `($1, $2, $3, $${idx + 4})`).join(', ');
      await client.query(
        `INSERT INTO core.entidades_catalogos (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
         VALUES ${values}`,
        [empresaId, entidadTipoId, productoId, ...catalogoIds]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getProductoOwner(
  client: { query: <T = any>(text: string, params?: any[]) => Promise<{ rows: T[] }> },
  productoId: number,
  empresaId: number
) {
  const { rows } = await client.query<{ id: number }>(
    `SELECT id
       FROM productos
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [productoId, empresaId]
  );

  return rows[0] ?? null;
}

function resolveProductoArchivoAbsolutePath(relativePath: string) {
  const normalized = relativePath.replace(/^\/uploads\/?/, '');
  return path.join(resolveUploadsDir(), normalized);
}

export async function listarProductoArchivosRepository(productoId: number, empresaId: number): Promise<ProductoArchivoRecord[]> {
  const producto = await getProductoOwner(pool, productoId, empresaId);
  if (!producto) {
    return [];
  }

  const { rows } = await pool.query<ProductoArchivoRecord>(
    `SELECT
        id,
        producto_id,
        tipo_archivo,
        archivo,
        descripcion,
        orden_visual,
        principal,
        fecha_creacion::text
      FROM public.productos_archivos
      WHERE producto_id = $1
        AND tipo_archivo = 'imagen'
      ORDER BY principal DESC, orden_visual ASC, id ASC`,
    [productoId]
  );

  return rows;
}

export async function crearProductoArchivoRepository(
  productoId: number,
  empresaId: number,
  payload: { archivo: string; descripcion?: string | null; tipo_archivo: 'imagen' }
): Promise<ProductoArchivoRecord> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const producto = await getProductoOwner(client, productoId, empresaId);
    if (!producto) {
      throw new Error('PRODUCTO_NOT_FOUND');
    }

    const { rows: currentRows } = await client.query<{ next_orden: number; has_principal: boolean }>(
      `SELECT
         COALESCE(MAX(orden_visual), 0) + 1 AS next_orden,
         COALESCE(BOOL_OR(principal), false) AS has_principal
       FROM public.productos_archivos
       WHERE producto_id = $1
         AND tipo_archivo = 'imagen'`,
      [productoId]
    );

    const nextOrden = Number(currentRows[0]?.next_orden ?? 1);
    const hasPrincipal = Boolean(currentRows[0]?.has_principal);

    const { rows } = await client.query<ProductoArchivoRecord>(
      `INSERT INTO public.productos_archivos (
         producto_id,
         tipo_archivo,
         archivo,
         descripcion,
         orden_visual,
         principal
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         producto_id,
         tipo_archivo,
         archivo,
         descripcion,
         orden_visual,
         principal,
         fecha_creacion::text`,
      [productoId, payload.tipo_archivo, payload.archivo, payload.descripcion ?? null, nextOrden, !hasPrincipal]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function eliminarProductoArchivoRepository(archivoId: number, empresaId: number): Promise<ProductoArchivoRecord | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query<ProductoArchivoRecord>(
      `SELECT
         pa.id,
         pa.producto_id,
         pa.tipo_archivo,
         pa.archivo,
         pa.descripcion,
         pa.orden_visual,
         pa.principal,
         pa.fecha_creacion::text
       FROM public.productos_archivos pa
       JOIN public.productos p
         ON p.id = pa.producto_id
      WHERE pa.id = $1
        AND p.empresa_id = $2
      LIMIT 1`,
      [archivoId, empresaId]
    );

    const archivo = rows[0] ?? null;
    if (!archivo) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM public.productos_archivos WHERE id = $1', [archivoId]);

    if (archivo.principal) {
      await client.query(
        `WITH siguiente AS (
           SELECT id
             FROM public.productos_archivos
            WHERE producto_id = $1
              AND tipo_archivo = 'imagen'
            ORDER BY orden_visual ASC, id ASC
            LIMIT 1
         )
         UPDATE public.productos_archivos pa
            SET principal = true
           FROM siguiente
          WHERE pa.id = siguiente.id`,
        [archivo.producto_id]
      );
    }

    await client.query('COMMIT');

    await removeFileIfExists(resolveProductoArchivoAbsolutePath(archivo.archivo));
    return archivo;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function marcarProductoArchivoPrincipalRepository(archivoId: number, empresaId: number): Promise<ProductoArchivoRecord | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query<ProductoArchivoRecord>(
      `SELECT
         pa.id,
         pa.producto_id,
         pa.tipo_archivo,
         pa.archivo,
         pa.descripcion,
         pa.orden_visual,
         pa.principal,
         pa.fecha_creacion::text
       FROM public.productos_archivos pa
       JOIN public.productos p
         ON p.id = pa.producto_id
      WHERE pa.id = $1
        AND p.empresa_id = $2
      LIMIT 1`,
      [archivoId, empresaId]
    );

    const archivo = rows[0] ?? null;
    if (!archivo) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE public.productos_archivos
          SET principal = false
        WHERE producto_id = $1
          AND tipo_archivo = 'imagen'`,
      [archivo.producto_id]
    );

    const { rows: updatedRows } = await client.query<ProductoArchivoRecord>(
      `UPDATE public.productos_archivos
          SET principal = true
        WHERE id = $1
        RETURNING
          id,
          producto_id,
          tipo_archivo,
          archivo,
          descripcion,
          orden_visual,
          principal,
          fecha_creacion::text`,
      [archivoId]
    );

    await client.query('COMMIT');
    return updatedRows[0] ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
