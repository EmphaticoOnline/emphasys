import pool from '../../config/database';

export type EtapaProduccion = {
  id: number;
  empresa_id: number;
  nombre: string;
  orden: number;
  color: string | null;
  activo: boolean;
};

export type SeguimientoProduccionRow = {
  id: number;
  empresa_id: number;
  documento_id: number;
  documento: string;
  cliente: string;
  etapa_id: number | null;
  activo: boolean;
  etapa_nombre: string | null;
  etapa_color: string | null;
  fecha_promesa: string | null;
  comentarios: string | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type SeguimientoProduccionHistorialRow = {
  id: number;
  empresa_id: number;
  documento_id: number;
  etapa_id: number | null;
  etapa_nombre: string | null;
  etapa_color: string | null;
  fecha_promesa: string | null;
  comentarios: string | null;
  updated_by: number | null;
  usuario_nombre: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type DeleteEtapaProduccionResult = {
  deleted: true;
  id: number;
};

type SeguimientoMutationInput = {
  documento_id?: number;
  etapa_id?: number | null;
  fecha_promesa?: string | null;
  comentarios?: string | null;
  updated_by?: number | null;
};

type EtapaProduccionMutationInput = {
  nombre?: string;
  orden?: number;
  color?: string | null;
  activo?: boolean;
};

type UpsertSeguimientoResult = {
  created: boolean;
  seguimiento: SeguimientoProduccionRow;
};

type DatabaseLike = {
  query: typeof pool.query;
};

async function obtenerPrimeraEtapaActiva(empresaId: number) {
  const { rows } = await pool.query<Pick<EtapaProduccion, 'id'>>(
    `SELECT id
       FROM produccion.etapas
      WHERE empresa_id = $1
        AND activo = TRUE
      ORDER BY orden ASC, id ASC
      LIMIT 1`,
    [empresaId]
  );

  return rows[0]?.id ?? null;
}

async function validarEtapaEmpresa(etapaId: number, empresaId: number) {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM produccion.etapas
        WHERE id = $1
          AND empresa_id = $2
          AND activo = TRUE
     ) AS exists`,
    [etapaId, empresaId]
  );

  return Boolean(rows[0]?.exists);
}

async function existeNombreActivoDuplicado(empresaId: number, nombre: string, excludeId?: number) {
  const trimmedName = nombre.trim();
  if (!trimmedName) {
    return false;
  }

  const params: Array<number | string> = [empresaId, trimmedName];
  let excludeSql = '';
  if (excludeId && Number.isInteger(excludeId) && excludeId > 0) {
    params.push(excludeId);
    excludeSql = ` AND id <> $${params.length}`;
  }

  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM produccion.etapas
        WHERE empresa_id = $1
          AND activo = TRUE
          AND LOWER(TRIM(nombre)) = LOWER(TRIM($2))
          ${excludeSql}
     ) AS exists`,
    params
  );

  return Boolean(rows[0]?.exists);
}

function normalizarColor(color: string | null | undefined) {
  const trimmedColor = String(color ?? '').trim();
  if (!trimmedColor) {
    return null;
  }

  if (!/^#([0-9A-Fa-f]{6})$/.test(trimmedColor)) {
    throw new Error('VALIDATION_ERROR: El color debe usar formato hexadecimal #RRGGBB');
  }

  return trimmedColor.toUpperCase();
}

function normalizarNombre(nombre: string | undefined) {
  const trimmedName = String(nombre ?? '').trim();
  if (!trimmedName) {
    throw new Error('VALIDATION_ERROR: nombre es requerido');
  }

  return trimmedName;
}

function normalizarOrden(orden: number | undefined) {
  const parsedOrder = Number(orden);
  if (!Number.isInteger(parsedOrder) || parsedOrder <= 0) {
    throw new Error('VALIDATION_ERROR: orden debe ser un entero mayor a cero');
  }

  return parsedOrder;
}

async function validarDocumentoEmpresa(documentoId: number, empresaId: number) {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM documentos
        WHERE id = $1
          AND empresa_id = $2
     ) AS exists`,
    [documentoId, empresaId]
  );

  return Boolean(rows[0]?.exists);
}

async function obtenerEtapaProduccionPorId(id: number, empresaId: number) {
  const { rows } = await pool.query<EtapaProduccion>(
    `SELECT id, empresa_id, nombre, orden, color, activo
       FROM produccion.etapas
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [id, empresaId]
  );

  return rows[0] ?? null;
}

async function contarUsoEtapaProduccion(id: number, empresaId: number) {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
       FROM produccion.seguimientos
      WHERE empresa_id = $1
        AND etapa_id = $2`,
    [empresaId, id]
  );

  return Number(rows[0]?.total ?? 0);
}

async function obtenerSeguimientoEnriquecidoPorIdDesdeDb(
  db: DatabaseLike,
  id: number,
  empresaId: number
) {
  const { rows } = await db.query<SeguimientoProduccionRow>(
    `SELECT
       s.id,
       s.empresa_id,
       s.documento_id,
       s.activo,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.serie, d.numero::text)), ''), d.id::text) AS documento,
       COALESCE(NULLIF(TRIM(c.nombre), ''), 'Sin cliente') AS cliente,
       s.etapa_id,
       e.nombre AS etapa_nombre,
       e.color AS etapa_color,
       s.fecha_promesa,
       s.comentarios,
       s.updated_by,
       s.created_at,
       s.updated_at
     FROM produccion.seguimientos s
     JOIN documentos d
       ON d.id = s.documento_id
      AND d.empresa_id = s.empresa_id
     LEFT JOIN contactos c
       ON c.id = d.contacto_principal_id
     LEFT JOIN produccion.etapas e
       ON e.id = s.etapa_id
      AND e.empresa_id = s.empresa_id
    WHERE s.id = $1
      AND s.empresa_id = $2
    LIMIT 1`,
    [id, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerSeguimientoEnriquecidoPorId(id: number, empresaId: number) {
  return obtenerSeguimientoEnriquecidoPorIdDesdeDb(pool, id, empresaId);
}

export async function listarEtapasProduccion(empresaId: number, incluirInactivas = false) {
  const { rows } = await pool.query<EtapaProduccion>(
    `SELECT id, empresa_id, nombre, orden, color, activo
       FROM produccion.etapas
      WHERE empresa_id = $1
        AND ($2::boolean = TRUE OR activo = TRUE)
      ORDER BY orden ASC, id ASC`,
    [empresaId, incluirInactivas]
  );

  return rows;
}

export async function crearEtapaProduccion(empresaId: number, input: EtapaProduccionMutationInput) {
  const nombre = normalizarNombre(input.nombre);
  const orden = normalizarOrden(input.orden);
  const color = normalizarColor(input.color ?? null);

  if (await existeNombreActivoDuplicado(empresaId, nombre)) {
    throw new Error('VALIDATION_ERROR: Ya existe una etapa activa con ese nombre');
  }

  const { rows } = await pool.query<EtapaProduccion>(
    `INSERT INTO produccion.etapas (
       empresa_id,
       nombre,
       orden,
       color,
       activo
     )
     VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
     RETURNING id, empresa_id, nombre, orden, color, activo`,
    [empresaId, nombre, orden, color, input.activo ?? true]
  );

  return rows[0];
}

export async function actualizarEtapaProduccion(id: number, empresaId: number, input: EtapaProduccionMutationInput) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('VALIDATION_ERROR: id inválido');
  }

  const etapaActual = await obtenerEtapaProduccionPorId(id, empresaId);
  if (!etapaActual) {
    return null;
  }

  const nombre = input.nombre !== undefined ? normalizarNombre(input.nombre) : etapaActual.nombre;
  const orden = input.orden !== undefined ? normalizarOrden(input.orden) : etapaActual.orden;
  const color = input.color !== undefined ? normalizarColor(input.color) : etapaActual.color;
  const activo = input.activo ?? etapaActual.activo;

  if (activo && await existeNombreActivoDuplicado(empresaId, nombre, id)) {
    throw new Error('VALIDATION_ERROR: Ya existe una etapa activa con ese nombre');
  }

  const { rows } = await pool.query<EtapaProduccion>(
    `UPDATE produccion.etapas
        SET nombre = $1,
            orden = $2,
            color = $3,
            activo = $4,
            updated_at = NOW()
      WHERE id = $5
        AND empresa_id = $6
      RETURNING id, empresa_id, nombre, orden, color, activo`,
    [nombre, orden, color, activo, id, empresaId]
  );

  return rows[0] ?? null;
}

export async function desactivarEtapaProduccion(id: number, empresaId: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('VALIDATION_ERROR: id inválido');
  }

  const { rows } = await pool.query<EtapaProduccion>(
    `UPDATE produccion.etapas
        SET activo = FALSE,
            updated_at = NOW()
      WHERE id = $1
        AND empresa_id = $2
      RETURNING id, empresa_id, nombre, orden, color, activo`,
    [id, empresaId]
  );

  return rows[0] ?? null;
}

export async function eliminarEtapaProduccion(id: number, empresaId: number): Promise<DeleteEtapaProduccionResult | null> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('VALIDATION_ERROR: id inválido');
  }

  const etapa = await obtenerEtapaProduccionPorId(id, empresaId);
  if (!etapa) {
    return null;
  }

  const totalUsos = await contarUsoEtapaProduccion(id, empresaId);
  if (totalUsos > 0) {
    throw new Error(`DELETE_BLOCKED: La etapa ya fue usada en ${totalUsos} seguimiento${totalUsos === 1 ? '' : 's'}. No se puede eliminar físicamente; solo puedes desactivarla.`);
  }

  await pool.query(
    `DELETE FROM produccion.etapas
      WHERE id = $1
        AND empresa_id = $2`,
    [id, empresaId]
  );

  return {
    deleted: true,
    id,
  };
}

export async function listarSeguimientosProduccion(empresaId: number) {
  const { rows } = await pool.query<SeguimientoProduccionRow>(
    `SELECT
       s.id,
       s.empresa_id,
       s.documento_id,
       s.activo,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.serie, d.numero::text)), ''), d.id::text) AS documento,
       COALESCE(NULLIF(TRIM(c.nombre), ''), 'Sin cliente') AS cliente,
       s.etapa_id,
       e.nombre AS etapa_nombre,
       e.color AS etapa_color,
       s.fecha_promesa,
       s.comentarios,
       s.updated_by,
       s.created_at,
       s.updated_at
     FROM produccion.seguimientos s
     JOIN documentos d
       ON d.id = s.documento_id
      AND d.empresa_id = s.empresa_id
     LEFT JOIN contactos c
       ON c.id = d.contacto_principal_id
     LEFT JOIN produccion.etapas e
       ON e.id = s.etapa_id
      AND e.empresa_id = s.empresa_id
    WHERE s.empresa_id = $1
      AND s.activo = TRUE
    ORDER BY COALESCE(s.fecha_promesa, d.fecha_documento) ASC, s.updated_at DESC, s.id DESC`,
    [empresaId]
  );

  return rows;
}

export async function listarHistorialSeguimientoPorDocumento(empresaId: number, documentoId: number) {
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    throw new Error('VALIDATION_ERROR: documentoId inválido');
  }

  const documentoValido = await validarDocumentoEmpresa(documentoId, empresaId);
  if (!documentoValido) {
    throw new Error('VALIDATION_ERROR: El documento no pertenece a la empresa activa');
  }

  const { rows } = await pool.query<SeguimientoProduccionHistorialRow>(
    `SELECT
       s.id,
       s.empresa_id,
       s.documento_id,
       s.etapa_id,
       e.nombre AS etapa_nombre,
       e.color AS etapa_color,
       s.fecha_promesa,
       s.comentarios,
       s.updated_by,
       u.nombre AS usuario_nombre,
       s.activo,
       s.created_at,
       s.updated_at
     FROM produccion.seguimientos s
     LEFT JOIN produccion.etapas e
       ON e.id = s.etapa_id
      AND e.empresa_id = s.empresa_id
     LEFT JOIN core.usuarios u
       ON u.id = s.updated_by
    WHERE s.empresa_id = $1
      AND s.documento_id = $2
    ORDER BY s.created_at DESC, s.id DESC`,
    [empresaId, documentoId]
  );

  return rows;
}

export async function crearSeguimientoProduccion(
  empresaId: number,
  input: SeguimientoMutationInput
): Promise<UpsertSeguimientoResult> {
  const documentoId = Number(input.documento_id);
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    throw new Error('VALIDATION_ERROR: documento_id es requerido');
  }

  const documentoExiste = await validarDocumentoEmpresa(documentoId, empresaId);
  if (!documentoExiste) {
    throw new Error('VALIDATION_ERROR: El documento no pertenece a la empresa activa');
  }

  let etapaId = input.etapa_id ?? null;
  if (etapaId !== null && etapaId !== undefined) {
    etapaId = Number(etapaId);
    if (!Number.isInteger(etapaId) || etapaId <= 0) {
      throw new Error('VALIDATION_ERROR: etapa_id inválida');
    }

    const etapaValida = await validarEtapaEmpresa(etapaId, empresaId);
    if (!etapaValida) {
      throw new Error('VALIDATION_ERROR: La etapa no pertenece a la empresa activa');
    }
  } else {
    etapaId = await obtenerPrimeraEtapaActiva(empresaId);
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const { rows: existentes } = await cliente.query<{ id: number }>(
      `SELECT id
         FROM produccion.seguimientos
        WHERE empresa_id = $1
          AND documento_id = $2
          AND activo = TRUE
        LIMIT 1`,
      [empresaId, documentoId]
    );

    if (existentes[0]?.id) {
      const seguimientoExistente = await obtenerSeguimientoEnriquecidoPorIdDesdeDb(cliente, existentes[0].id, empresaId);
      await cliente.query('COMMIT');

      if (!seguimientoExistente) {
        throw new Error('No se pudo recuperar el seguimiento existente');
      }

      return {
        created: false,
        seguimiento: seguimientoExistente,
      };
    }

    const { rows } = await cliente.query<{ id: number }>(
      `INSERT INTO produccion.seguimientos (
         empresa_id,
         documento_id,
         etapa_id,
         fecha_promesa,
         comentarios,
         updated_by,
         activo
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id`,
      [
        empresaId,
        documentoId,
        etapaId,
        input.fecha_promesa ?? null,
        input.comentarios?.trim() || null,
        input.updated_by ?? null,
      ]
    );

    if (!rows[0]?.id) {
      throw new Error('No se pudo crear el seguimiento');
    }

    const seguimiento = await obtenerSeguimientoEnriquecidoPorIdDesdeDb(cliente, rows[0].id, empresaId);
    await cliente.query('COMMIT');

    if (!seguimiento) {
      throw new Error('No se pudo recuperar el seguimiento creado');
    }

    return {
      created: true,
      seguimiento,
    };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

export async function actualizarSeguimientoProduccion(
  id: number,
  empresaId: number,
  input: SeguimientoMutationInput
) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('VALIDATION_ERROR: id inválido');
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const { rows: seguimientoActualRows } = await cliente.query<{
      documento_id: number;
      etapa_id: number | null;
    }>(
      `SELECT documento_id, etapa_id
         FROM produccion.seguimientos
        WHERE id = $1
          AND empresa_id = $2
          AND activo = TRUE
        LIMIT 1`,
      [id, empresaId]
    );

    const seguimientoActual = seguimientoActualRows[0];
    if (!seguimientoActual) {
      await cliente.query('ROLLBACK');
      return null;
    }

    const etapaFinal = input.etapa_id !== undefined && input.etapa_id !== null
      ? Number(input.etapa_id)
      : seguimientoActual.etapa_id ?? (await obtenerPrimeraEtapaActiva(empresaId));

    if (etapaFinal !== null && etapaFinal !== undefined) {
      if (!Number.isInteger(etapaFinal) || etapaFinal <= 0) {
        throw new Error('VALIDATION_ERROR: etapa_id inválida');
      }

      const etapaValida = await validarEtapaEmpresa(etapaFinal, empresaId);
      if (!etapaValida) {
        throw new Error('VALIDATION_ERROR: La etapa no pertenece a la empresa activa');
      }
    }

    await cliente.query(
      `UPDATE produccion.seguimientos
          SET activo = FALSE,
              updated_at = NOW()
        WHERE documento_id = $1
          AND empresa_id = $2
          AND activo = TRUE`,
      [seguimientoActual.documento_id, empresaId]
    );

    const { rows } = await cliente.query<{ id: number }>(
      `INSERT INTO produccion.seguimientos (
         empresa_id,
         documento_id,
         etapa_id,
         fecha_promesa,
         comentarios,
         updated_by,
         activo
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id`,
      [
        empresaId,
        seguimientoActual.documento_id,
        etapaFinal,
        input.fecha_promesa ?? null,
        input.comentarios?.trim() || null,
        input.updated_by ?? null,
      ]
    );

    if (!rows[0]?.id) {
      throw new Error('No se pudo crear el nuevo avance');
    }

    const seguimiento = await obtenerSeguimientoEnriquecidoPorIdDesdeDb(cliente, rows[0].id, empresaId);
    await cliente.query('COMMIT');

    if (!seguimiento) {
      throw new Error('No se pudo recuperar el avance creado');
    }

    return seguimiento;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}