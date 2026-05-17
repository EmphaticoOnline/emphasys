import pool from '../../config/database';

export type PreciosCapturaFiltros = {
  clave?: string;
  descripcion?: string;
  clasificacion?: string;
  familia?: string;
};

export type PrecioCapturaLista = {
  id: number;
  nombre: string;
  orden: number | null;
  es_default: boolean;
};

export type PrecioCapturaProducto = {
  producto_id: number;
  clave: string | null;
  descripcion: string;
  clasificacion: string | null;
  familia: string | null;
  activo: boolean;
  precios: Record<string, number | null>;
};

export type PreciosCapturaPayload = {
  listas: PrecioCapturaLista[];
  productos: PrecioCapturaProducto[];
  filtros: {
    clasificaciones: string[];
    familias: string[];
  };
};

export type PrecioBatchItem = {
  producto_id: number;
  precio_lista_id: number;
  precio: number | null;
};

export type PrecioBatchResult = {
  input_count: number;
  valid_count: number;
  deleted_count: number;
  updated_count: number;
  inserted_count: number;
};

export type PrecioDocumentoResolucion = {
  precio_lista_id: number | null;
  precio: number | null;
  origen: 'contacto' | 'clasificacion' | 'default' | 'sin_lista' | 'sin_precio';
};

function buildProductosWhere(
  empresaId: number,
  filtros: PreciosCapturaFiltros
): { whereSql: string; values: Array<number | string> } {
  const conditions = ['p.empresa_id = $1'];
  const values: Array<number | string> = [empresaId];

  if (filtros.clave?.trim()) {
    values.push(`%${filtros.clave.trim()}%`);
    conditions.push(`p.clave ILIKE $${values.length}`);
  }

  if (filtros.descripcion?.trim()) {
    values.push(`%${filtros.descripcion.trim()}%`);
    conditions.push(`p.descripcion ILIKE $${values.length}`);
  }

  if (filtros.clasificacion?.trim()) {
    values.push(filtros.clasificacion.trim());
    conditions.push(`p.clasificacion = $${values.length}`);
  }

  if (filtros.familia?.trim()) {
    values.push(filtros.familia.trim());
    conditions.push(`p.familia = $${values.length}`);
  }

  return {
    whereSql: conditions.join(' AND '),
    values,
  };
}

export async function obtenerPreciosCapturaRepository(
  empresaId: number,
  filtros: PreciosCapturaFiltros = {}
): Promise<PreciosCapturaPayload> {
  const listasQuery = `
    SELECT id, nombre, orden, es_default
      FROM precios_listas
     WHERE empresa_id = $1
       AND tipo_precio = 'VENTA'
       AND activo = true
     ORDER BY orden ASC NULLS LAST, nombre ASC, id ASC
  `;

  const filtrosQuery = `
    SELECT DISTINCT clasificacion
      FROM productos
     WHERE empresa_id = $1
       AND clasificacion IS NOT NULL
       AND BTRIM(clasificacion) <> ''
     ORDER BY clasificacion ASC
  `;

  const familiasQuery = `
    SELECT DISTINCT familia
      FROM productos
     WHERE empresa_id = $1
       AND familia IS NOT NULL
       AND BTRIM(familia) <> ''
     ORDER BY familia ASC
  `;

  const { whereSql, values } = buildProductosWhere(empresaId, filtros);
  const productosQuery = `
    SELECT
      p.id AS producto_id,
      p.clave,
      p.descripcion,
      p.clasificacion,
      p.familia,
      p.activo
    FROM productos p
    WHERE ${whereSql}
    ORDER BY p.clave ASC NULLS LAST, p.descripcion ASC, p.id ASC
  `;

  const [listasRes, clasificacionesRes, familiasRes, productosRes] = await Promise.all([
    pool.query<PrecioCapturaLista>(listasQuery, [empresaId]),
    pool.query<{ clasificacion: string }>(filtrosQuery, [empresaId]),
    pool.query<{ familia: string }>(familiasQuery, [empresaId]),
    pool.query<Omit<PrecioCapturaProducto, 'precios'>>(productosQuery, values),
  ]);

  const listas = listasRes.rows;
  const listasNormalizadas = listas.map((lista) => ({
    ...lista,
    id: Number(lista.id),
    orden: lista.orden === null ? null : Number(lista.orden),
    es_default: Boolean(lista.es_default),
  }));
  const productosBase = productosRes.rows.map((producto) => ({
    ...producto,
    producto_id: Number(producto.producto_id),
  }));

  const productosMap = new Map<number, PrecioCapturaProducto>(
    productosBase.map((producto) => [
      producto.producto_id,
      {
        ...producto,
        precios: Object.fromEntries(listasNormalizadas.map((lista) => [String(lista.id), null])),
      },
    ])
  );

  const productoIds = productosBase.map((producto) => producto.producto_id);
  const listaIds = listasNormalizadas.map((lista) => lista.id);

  if (productoIds.length && listaIds.length) {
    const preciosQuery = `
      SELECT producto_id, precio_lista_id, precio
        FROM precios
       WHERE empresa_id = $1
         AND contacto_id IS NULL
         AND activo = true
         AND producto_id = ANY($2::bigint[])
         AND precio_lista_id = ANY($3::bigint[])
    `;

    const { rows } = await pool.query<{ producto_id: number; precio_lista_id: number; precio: string | number }>(
      preciosQuery,
      [empresaId, productoIds, listaIds]
    );

    for (const row of rows) {
      const productoId = Number(row.producto_id);
      const precioListaId = Number(row.precio_lista_id);
      const producto = productosMap.get(productoId);
      if (!producto) continue;
      producto.precios[String(precioListaId)] = row.precio === null ? null : Number(row.precio);
    }
  }

  return {
    listas: listasNormalizadas,
    productos: Array.from(productosMap.values()),
    filtros: {
      clasificaciones: clasificacionesRes.rows.map((row) => row.clasificacion),
      familias: familiasRes.rows.map((row) => row.familia),
    },
  };
}

async function obtenerEntidadTipoIdContacto(): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM core.entidades_tipos WHERE codigo = 'CONTACTO' LIMIT 1`
  );

  const entidadTipoId = rows[0]?.id;
  if (!entidadTipoId) {
    throw new Error('Tipo de entidad CONTACTO no encontrado');
  }

  return entidadTipoId;
}

async function resolverPrecioListaContacto(
  empresaId: number,
  contactoId: number | null
): Promise<{ precio_lista_id: number | null; origen: PrecioDocumentoResolucion['origen'] }> {
  if (contactoId) {
    const directoQuery = `
      SELECT precio_lista_id
        FROM contactos
       WHERE id = $1
         AND empresa_id = $2
       LIMIT 1
    `;

    const directoRes = await pool.query<{ precio_lista_id: number | null }>(directoQuery, [contactoId, empresaId]);
    const directo = directoRes.rows[0]?.precio_lista_id ?? null;
    if (directo) {
      return { precio_lista_id: Number(directo), origen: 'contacto' };
    }

    const entidadTipoId = await obtenerEntidadTipoIdContacto();
    const clasificacionQuery = `
      SELECT c.precio_lista_id
        FROM core.entidades_catalogos ec
        INNER JOIN core.catalogos c ON c.id = ec.catalogo_id
        INNER JOIN core.catalogos_tipos ct ON ct.id = c.tipo_catalogo_id
       WHERE ec.empresa_id = $1
         AND ec.entidad_tipo_id = $2
         AND ec.entidad_id = $3
         AND c.precio_lista_id IS NOT NULL
         AND ct.nombre ILIKE '%clasificacion%'
       ORDER BY c.orden ASC NULLS LAST, c.descripcion ASC, c.id ASC
       LIMIT 1
    `;

    const clasificacionRes = await pool.query<{ precio_lista_id: number | null }>(clasificacionQuery, [
      empresaId,
      entidadTipoId,
      contactoId,
    ]);
    const clasificacion = clasificacionRes.rows[0]?.precio_lista_id ?? null;
    if (clasificacion) {
      return { precio_lista_id: Number(clasificacion), origen: 'clasificacion' };
    }
  }

  const defaultQuery = `
    SELECT id
      FROM precios_listas
     WHERE empresa_id = $1
       AND tipo_precio = 'VENTA'
       AND activo = true
       AND es_default = true
     ORDER BY id ASC
     LIMIT 1
  `;
  const defaultRes = await pool.query<{ id: number }>(defaultQuery, [empresaId]);
  const defaultLista = defaultRes.rows[0]?.id ?? null;
  if (defaultLista) {
    return { precio_lista_id: Number(defaultLista), origen: 'default' };
  }

  return { precio_lista_id: null, origen: 'sin_lista' };
}

export async function resolverPrecioDocumentoRepository(
  empresaId: number,
  productoId: number,
  contactoId: number | null
): Promise<PrecioDocumentoResolucion> {
  const lista = await resolverPrecioListaContacto(empresaId, contactoId);
  if (!lista.precio_lista_id) {
    return {
      precio_lista_id: null,
      precio: null,
      origen: 'sin_lista',
    };
  }

  const precioQuery = `
    SELECT precio
      FROM precios
     WHERE empresa_id = $1
       AND producto_id = $2
       AND precio_lista_id = $3
       AND contacto_id IS NULL
       AND activo = true
     ORDER BY updated_at DESC, id DESC
     LIMIT 1
  `;

  const { rows } = await pool.query<{ precio: string | number }>(precioQuery, [
    empresaId,
    productoId,
    lista.precio_lista_id,
  ]);

  if (!rows.length) {
    return {
      precio_lista_id: lista.precio_lista_id,
      precio: null,
      origen: 'sin_precio',
    };
  }

  return {
    precio_lista_id: lista.precio_lista_id,
    precio: Number(rows[0].precio),
    origen: lista.origen,
  };
}

export async function guardarPreciosBatchRepository(
  empresaId: number,
  items: PrecioBatchItem[]
): Promise<PrecioBatchResult> {
  if (!items.length) {
    return {
      input_count: 0,
      valid_count: 0,
      deleted_count: 0,
      updated_count: 0,
      inserted_count: 0,
    };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = `
      WITH input_rows AS (
        SELECT DISTINCT ON (producto_id, precio_lista_id)
          producto_id,
          precio_lista_id,
          precio
        FROM json_to_recordset($2::json) AS x(
          producto_id BIGINT,
          precio_lista_id BIGINT,
          precio NUMERIC(18,6)
        )
        ORDER BY producto_id, precio_lista_id
      ),
      valid_rows AS (
        SELECT i.producto_id, i.precio_lista_id, i.precio
          FROM input_rows i
          INNER JOIN productos p
                  ON p.id = i.producto_id
                 AND p.empresa_id = $1
          INNER JOIN precios_listas pl
                  ON pl.id = i.precio_lista_id
                 AND pl.empresa_id = $1
                 AND pl.tipo_precio = 'VENTA'
                 AND pl.activo = true
      ),
      deleted AS (
        DELETE FROM precios p
         USING valid_rows v
         WHERE v.precio IS NULL
           AND p.empresa_id = $1
           AND p.contacto_id IS NULL
           AND p.producto_id = v.producto_id
           AND p.precio_lista_id = v.precio_lista_id
        RETURNING p.producto_id, p.precio_lista_id
      ),
      updated AS (
        UPDATE precios p
           SET precio = v.precio,
               activo = true,
               updated_at = NOW()
          FROM valid_rows v
         WHERE v.precio IS NOT NULL
           AND p.empresa_id = $1
           AND p.contacto_id IS NULL
           AND p.producto_id = v.producto_id
           AND p.precio_lista_id = v.precio_lista_id
        RETURNING p.producto_id, p.precio_lista_id
      ),
      inserted AS (
        INSERT INTO precios (
          empresa_id,
          producto_id,
          precio_lista_id,
          contacto_id,
          precio,
          activo,
          created_at,
          updated_at
        )
        SELECT
          $1,
          v.producto_id,
          v.precio_lista_id,
          NULL,
          v.precio,
          true,
          NOW(),
          NOW()
          FROM valid_rows v
          LEFT JOIN updated u
                 ON u.producto_id = v.producto_id
                AND u.precio_lista_id = v.precio_lista_id
         WHERE v.precio IS NOT NULL
           AND u.producto_id IS NULL
        RETURNING producto_id, precio_lista_id
      )
      SELECT
        (SELECT COUNT(*)::INT FROM input_rows) AS input_count,
        (SELECT COUNT(*)::INT FROM valid_rows) AS valid_count,
        (SELECT COUNT(*)::INT FROM deleted) AS deleted_count,
        (SELECT COUNT(*)::INT FROM updated) AS updated_count,
        (SELECT COUNT(*)::INT FROM inserted) AS inserted_count
    `;

    const payload = JSON.stringify(items);
    const { rows } = await client.query<PrecioBatchResult>(query, [empresaId, payload]);
    const result = rows[0];

    if (!result) {
      throw new Error('No se pudo guardar el batch de precios');
    }

    if (result.valid_count !== result.input_count) {
      throw new Error('Algunos productos o listas de precios no son válidos para la empresa activa');
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}