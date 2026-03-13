import pool from '../../config/database';

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

const columnasPermitidasContacto = new Set([
  'nombre',
  'rfc',
  'email',
  'telefono',
  'telefono_secundario',
  'activo',
  'bloqueado',
  'dias_credito',
  'limite_credito',
  'vendedor_id',
  'observaciones',
  'motivo_bloqueo',
  'zona',
  'ultimo_concepto_utilizado',
  'iva_desglosado',
  'tipo_contacto',
]);

type DomicilioData = {
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  colonia?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  cp?: string | null;
  pais?: string | null;
  cp_sat?: string | null;
  colonia_sat?: string | null;
};

type DatosFiscalesData = {
  rfc?: string | null;
  regimen_fiscal?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal?: string | null;
};

const hasAnyValue = (data: Record<string, any> | undefined, keys: string[]) =>
  Boolean(data) && keys.some((k) => {
    const v = data?.[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });

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

async function upsertDomicilioPrincipal(
  client: any,
  contactoId: number,
  domicilio: DomicilioData | undefined
) {
  const cpSatValue = domicilio?.cp_sat ? String(domicilio.cp_sat).trim() : null;
  const coloniaSatValue = cpSatValue ? (domicilio?.colonia_sat ? String(domicilio.colonia_sat).trim() : null) : null;
  const keys = ['calle', 'numero_exterior', 'numero_interior', 'colonia', 'ciudad', 'estado', 'cp', 'pais', 'cp_sat', 'colonia_sat'];
  if (!hasAnyValue(domicilio as any, keys)) return null;

  if (cpSatValue) {
    const { rowCount } = await client.query(`SELECT 1 FROM sat.codigos_postales WHERE id = $1 LIMIT 1`, [cpSatValue]);
    if (!rowCount) {
      throw new Error('CP_SAT_NO_ENCONTRADO');
    }
  }

  const values = keys.map((k) => {
    if (k === 'cp_sat') return cpSatValue;
    if (k === 'colonia_sat') return coloniaSatValue;
    return (domicilio as any)?.[k] ?? null;
  });

  const updateResult = await client.query(
    `UPDATE contactos_domicilios
       SET calle = $1,
           numero_exterior = $2,
           numero_interior = $3,
           colonia = $4,
           ciudad = $5,
           estado = $6,
           cp = $7,
           pais = $8,
           cp_sat = $9,
           colonia_sat = $10,
           es_principal = true
     WHERE contacto_id = $11 AND es_principal = true
     RETURNING *`,
    [...values, contactoId]
  );

  if (updateResult.rowCount > 0) return updateResult.rows[0];

  const insertResult = await client.query(
    `INSERT INTO contactos_domicilios (
        contacto_id,
        calle,
        numero_exterior,
        numero_interior,
        colonia,
        ciudad,
        estado,
        cp,
        pais,
        cp_sat,
        colonia_sat,
        es_principal
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
      RETURNING *`,
    [contactoId, ...values]
  );

  return insertResult.rows[0];
}

async function upsertDatosFiscales(
  client: any,
  contactoId: number,
  datos: DatosFiscalesData | undefined
) {
  const keys = ['rfc', 'regimen_fiscal', 'uso_cfdi', 'forma_pago', 'metodo_pago', 'codigo_postal'];
  if (!hasAnyValue(datos as any, keys)) return null;

  const values = keys.map((k) => (datos as any)?.[k] ?? null);

  const updateResult = await client.query(
    `UPDATE contactos_datos_fiscales
       SET rfc = $1,
           regimen_fiscal = $2,
           uso_cfdi = $3,
           forma_pago = $4,
           metodo_pago = $5,
           codigo_postal = $6
     WHERE contacto_id = $7
     RETURNING *`,
    [...values, contactoId]
  );

  if (updateResult.rowCount > 0) return updateResult.rows[0];

  const insertResult = await client.query(
    `INSERT INTO contactos_datos_fiscales (
        contacto_id,
        rfc,
        regimen_fiscal,
        uso_cfdi,
        forma_pago,
        metodo_pago,
        codigo_postal
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
    [contactoId, ...values]
  );

  return insertResult.rows[0];
}

export async function obtenerContactos(empresaId: number) {
  const result = await pool.query(
    `SELECT *
     FROM contactos
     WHERE empresa_id = $1
     ORDER BY nombre ASC`,
    [empresaId]
  );

  return result.rows;
}

export async function insertarContacto(
  data: {
    nombre: string;
    email?: string;
    telefono?: string;
  },
  empresaId: number
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entries = Object.entries(data).filter(([key]) => columnasPermitidasContacto.has(key));

  const columns = ['empresa_id', 'nombre', ...entries.map(([key]) => key)];
  const values = [empresaId, data.nombre, ...entries.map(([, value]) => value ?? null)];
    const placeholders = columns.map((_, idx) => `$${idx + 1}`);

    const insertQuery = `
      INSERT INTO contactos (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const { rows } = await client.query(insertQuery, values);
    const contacto = rows[0];

    await upsertDomicilioPrincipal(client, contacto.id, data as any);
    await upsertDatosFiscales(client, contacto.id, data as any);

    await client.query('COMMIT');
    return contacto;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function obtenerContactoPorId(id: number, empresa_id: number) {
  const { rows } = await pool.query(
    `SELECT
        c.id,
        c.nombre,
        c.rfc AS rfc_contacto,
        c.email,
        c.telefono,
        c.telefono_secundario,
        c.activo,
        c.tipo_contacto,

        cd.calle,
        cd.numero_exterior,
        cd.numero_interior,
        cd.colonia,
    cd.ciudad,
    cd.estado,
    cd.cp,
    cd.pais,
    cd.cp_sat,
    cd.colonia_sat,

    cd.cp_sat AS contacto_codigo_postal,

  cdf.rfc AS rfc_fiscal,
  cdf.regimen_fiscal,
  cdf.uso_cfdi,
  cdf.forma_pago,
  cdf.metodo_pago

      FROM contactos c

      LEFT JOIN contactos_domicilios cd
             ON cd.contacto_id = c.id
            AND cd.es_principal = true

      LEFT JOIN contactos_datos_fiscales cdf
             ON cdf.contacto_id = c.id

      WHERE c.id = $1
      AND c.empresa_id = $2`,
    [id, empresa_id]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    contacto: {
      id: row.id,
      nombre: row.nombre,
      rfc: row.rfc_contacto,
      email: row.email,
      telefono: row.telefono,
      telefono_secundario: row.telefono_secundario,
      activo: row.activo,
      tipo_contacto: row.tipo_contacto,
    },
    domicilio_principal: {
      calle: row.calle,
      numero_exterior: row.numero_exterior,
      numero_interior: row.numero_interior,
      colonia: row.colonia,
      ciudad: row.ciudad,
      estado: row.estado,
      cp: row.cp,
      pais: row.pais,
      cp_sat: row.cp_sat,
      colonia_sat: row.colonia_sat,
    },
    datos_fiscales: {
      rfc: row.rfc_fiscal,
      regimen_fiscal: row.regimen_fiscal,
      uso_cfdi: row.uso_cfdi,
      forma_pago: row.forma_pago,
      metodo_pago: row.metodo_pago,
      codigo_postal: row.contacto_codigo_postal,
    },
  };
}

export async function obtenerCatalogosConfigurablesDeContacto(
  empresaId: number,
  contactoId?: number
): Promise<{
  entidad_tipo_id: number;
  tipos: (CatalogoTipo & { valores: CatalogoValor[] })[];
  seleccionados: number[];
}> {
  const entidadTipoId = await obtenerEntidadTipoIdContacto();

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

  if (contactoId && Number.isFinite(contactoId) && tipoIds.length) {
    const { rows } = await pool.query<{ catalogo_id: number }>(
      `SELECT catalogo_id
         FROM core.entidades_catalogos
        WHERE empresa_id = $1
          AND entidad_tipo_id = $2
          AND entidad_id = $3`,
      [empresaId, entidadTipoId, contactoId]
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

export async function actualizarContacto(id: number, empresa_id: number, data: any) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entries = Object.entries(data).filter(([key, _]) => columnasPermitidasContacto.has(key));

    let contactoActualizado = null;

    if (entries.length > 0) {
      const setClauses = entries.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = entries.map(([, value]) => value);

      const query = `
        UPDATE contactos
        SET ${setClauses}
        WHERE id = $${values.length + 1} AND empresa_id = $${values.length + 2}
        RETURNING *
      `;

      const { rows } = await client.query(query, [...values, id, empresa_id]);
      contactoActualizado = rows[0] ?? null;
    } else {
      const { rows } = await client.query(
        'SELECT * FROM contactos WHERE id = $1 AND empresa_id = $2',
        [id, empresa_id]
      );
      contactoActualizado = rows[0] ?? null;
    }

    if (!contactoActualizado) {
      await client.query('ROLLBACK');
      return null;
    }

    await upsertDomicilioPrincipal(client, id, data as any);
    await upsertDatosFiscales(client, id, data as any);

    await client.query('COMMIT');
    return contactoActualizado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function guardarCatalogosConfigurablesDeContacto(
  empresaId: number,
  contactoId: number,
  catalogoIds: number[]
) {
  const entidadTipoId = await obtenerEntidadTipoIdContacto();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM core.entidades_catalogos
        WHERE empresa_id = $1
          AND entidad_tipo_id = $2
          AND entidad_id = $3`,
      [empresaId, entidadTipoId, contactoId]
    );

    if (catalogoIds.length) {
      const values = catalogoIds.map((_, idx) => `($1, $2, $3, $${idx + 4})`).join(', ');
      await client.query(
        `INSERT INTO core.entidades_catalogos (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
         VALUES ${values}`,
        [empresaId, entidadTipoId, contactoId, ...catalogoIds]
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

export async function eliminarContacto(id: number, empresa_id: number) {
  const { rows } = await pool.query(
    'DELETE FROM contactos WHERE id = $1 AND empresa_id = $2 RETURNING *',
    [id, empresa_id]
  );

  return rows[0] ?? null;
}
