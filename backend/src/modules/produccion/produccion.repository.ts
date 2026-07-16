import pool from '../../config/database';
import { obtenerCamposConfigurablesPartidasParaImpresion } from '../documentos/documentos-campos.repository';

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
  tipo_documento: string;
  serie: string | null;
  numero: number | null;
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
       d.tipo_documento,
       d.serie,
       d.numero,
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
       d.tipo_documento,
       d.serie,
       d.numero,
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

export type ProduccionCampoConfigurable = {
  campoId: number;
  campoPadreId: number | null;
  nombre: string;
  valor: string;
};

export type ProduccionPartidaOperativa = {
  id: number;
  numeroPartida: number;
  productoId: number | null;
  productoClave: string | null;
  productoDescripcion: string | null;
  descripcionAlterna: string | null;
  cantidad: number;
  unidad: string | null;
  tituloAgrupador: string | null;
  observaciones: string | null;
  imagenUrl: string | null;
  camposConfigurables: ProduccionCampoConfigurable[];
};

export type ProduccionDetalleOperativo = {
  documento: {
    id: number;
    tipoDocumento: string;
    serie: string | null;
    numero: number | null;
    fechaDocumento: string;
    observaciones: string | null;
  };
  contacto: {
    id: number;
    nombre: string;
    nombreContacto: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
  etapaActual: {
    id: number | null;
    nombre: string | null;
    color: string | null;
  } | null;
  fechaPromesa: string | null;
  partidas: ProduccionPartidaOperativa[];
};

// Mismo criterio de resolución de URL pública que documentos.pdf.ts (no hay
// util compartida en el proyecto para esto; cada módulo la reimplementa).
function getAppBaseUrlForImages() {
  const rawBaseUrl = process.env.APP_BASE_URL?.trim();
  if (rawBaseUrl) return rawBaseUrl.replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3001';
  return null;
}

function resolvePublicImageUrl(value?: string | null) {
  const rawValue = (value ?? '').trim();
  if (!rawValue) return null;
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  const baseUrl = getAppBaseUrlForImages();
  if (!baseUrl) return null;
  return `${baseUrl}${rawValue.startsWith('/') ? '' : '/'}${rawValue}`;
}

/**
 * DTO operativo de producción: identifica el trabajo (documento + contacto),
 * la etapa/compromiso vigentes y el detalle de partidas (producto, cantidad,
 * unidad, observaciones, campos configurables e imagen). Deliberadamente NUNCA
 * selecciona columnas económicas (precio, descuento, impuestos, totales) de
 * `documentos` ni de `documentos_partidas` — el filtrado ocurre en el SELECT,
 * no en el frontend, para que ninguna inspección de red exponga esa información
 * al área de producción.
 */
export async function obtenerDetalleOperativoProduccion(
  empresaId: number,
  documentoId: number
): Promise<ProduccionDetalleOperativo | null> {
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    throw new Error('VALIDATION_ERROR: documentoId inválido');
  }

  const { rows: documentoRows } = await pool.query<{
    id: number;
    tipo_documento: string;
    serie: string | null;
    numero: number | null;
    fecha_documento: string;
    observaciones: string | null;
    contacto_id: number | null;
    contacto_nombre: string | null;
    contacto_nombre_contacto: string | null;
    contacto_telefono: string | null;
    contacto_email: string | null;
  }>(
    `SELECT
       d.id,
       d.tipo_documento,
       d.serie,
       d.numero,
       d.fecha_documento,
       d.observaciones,
       c.id AS contacto_id,
       c.nombre AS contacto_nombre,
       c.nombre_contacto AS contacto_nombre_contacto,
       c.telefono AS contacto_telefono,
       c.email AS contacto_email
     FROM documentos d
     LEFT JOIN contactos c
       ON c.id = d.contacto_principal_id
      AND c.empresa_id = d.empresa_id
    WHERE d.id = $1
      AND d.empresa_id = $2
    LIMIT 1`,
    [documentoId, empresaId]
  );

  const documentoRow = documentoRows[0];
  if (!documentoRow) {
    return null;
  }

  const { rows: seguimientoRows } = await pool.query<{
    etapa_id: number | null;
    etapa_nombre: string | null;
    etapa_color: string | null;
    fecha_promesa: string | null;
  }>(
    `SELECT s.etapa_id, e.nombre AS etapa_nombre, e.color AS etapa_color, s.fecha_promesa
       FROM produccion.seguimientos s
       LEFT JOIN produccion.etapas e
         ON e.id = s.etapa_id
        AND e.empresa_id = s.empresa_id
      WHERE s.empresa_id = $1
        AND s.documento_id = $2
        AND s.activo = TRUE
      LIMIT 1`,
    [empresaId, documentoId]
  );
  const seguimientoRow = seguimientoRows[0] ?? null;

  const { rows: partidaRows } = await pool.query<{
    id: number;
    numero_partida: number;
    producto_id: number | null;
    descripcion_alterna: string | null;
    cantidad: string;
    unidad: string | null;
    titulo_agrupador: string | null;
    observaciones: string | null;
    archivo_imagen_1: string | null;
    producto_archivo_id: number | null;
    producto_clave: string | null;
    producto_descripcion: string | null;
  }>(
    `SELECT
       dp.id,
       dp.numero_partida,
       dp.producto_id,
       dp.descripcion_alterna,
       dp.cantidad,
       dp.unidad,
       dp.titulo_agrupador,
       dp.observaciones,
       dp.archivo_imagen_1,
       dp.producto_archivo_id,
       p.clave AS producto_clave,
       p.descripcion AS producto_descripcion
     FROM documentos_partidas dp
     LEFT JOIN productos p ON p.id = dp.producto_id
    WHERE dp.documento_id = $1
    ORDER BY dp.numero_partida ASC, dp.id ASC`,
    [documentoId]
  );

  // Batch de imágenes de producto (fallback cuando la partida no tiene imagen
  // propia): una sola consulta con ANY(...) para todas las partidas, evitando
  // N+1 sobre productos_archivos.
  const productoArchivoIds = Array.from(
    new Set(
      partidaRows
        .filter((partida) => !partida.archivo_imagen_1?.trim() && partida.producto_archivo_id)
        .map((partida) => partida.producto_archivo_id as number)
    )
  );

  const productoArchivoUrlPorId = new Map<number, string>();
  if (productoArchivoIds.length > 0) {
    const { rows: archivoRows } = await pool.query<{ id: number; archivo: string }>(
      `SELECT pa.id, pa.archivo
         FROM productos_archivos pa
         INNER JOIN productos p ON p.id = pa.producto_id
        WHERE pa.id = ANY($1::int[])
          AND p.empresa_id = $2`,
      [productoArchivoIds, empresaId]
    );
    for (const row of archivoRows) {
      productoArchivoUrlPorId.set(row.id, row.archivo);
    }
  }

  // Campos configurables de todas las partidas en una sola consulta batch
  // (reutiliza el mismo repositorio que usa la impresión de PDF, que ya
  // resuelve jerarquía padre-hijo y nunca expone catalogo_id).
  const partidaIds = partidaRows.map((partida) => partida.id);
  const camposConfigurables = partidaIds.length
    ? await obtenerCamposConfigurablesPartidasParaImpresion(empresaId, partidaIds, documentoRow.tipo_documento)
    : [];

  const camposPorPartida = new Map<number, ProduccionCampoConfigurable[]>();
  for (const campo of camposConfigurables) {
    const lista = camposPorPartida.get(campo.partidaId) ?? [];
    lista.push({
      campoId: campo.campoId,
      campoPadreId: campo.campoPadreId,
      nombre: campo.nombre,
      valor: campo.valorTexto,
    });
    camposPorPartida.set(campo.partidaId, lista);
  }

  const partidas: ProduccionPartidaOperativa[] = partidaRows.map((partida) => {
    const imagenOriginal = partida.archivo_imagen_1?.trim()
      || (partida.producto_archivo_id ? productoArchivoUrlPorId.get(partida.producto_archivo_id) ?? null : null);

    return {
      id: partida.id,
      numeroPartida: partida.numero_partida,
      productoId: partida.producto_id,
      productoClave: partida.producto_clave,
      productoDescripcion: partida.producto_descripcion,
      descripcionAlterna: partida.descripcion_alterna,
      cantidad: Number(partida.cantidad),
      unidad: partida.unidad,
      tituloAgrupador: partida.titulo_agrupador,
      observaciones: partida.observaciones,
      imagenUrl: resolvePublicImageUrl(imagenOriginal),
      camposConfigurables: camposPorPartida.get(partida.id) ?? [],
    };
  });

  return {
    documento: {
      id: documentoRow.id,
      tipoDocumento: documentoRow.tipo_documento,
      serie: documentoRow.serie,
      numero: documentoRow.numero,
      fechaDocumento: documentoRow.fecha_documento,
      observaciones: documentoRow.observaciones,
    },
    contacto: documentoRow.contacto_id
      ? {
          id: documentoRow.contacto_id,
          nombre: documentoRow.contacto_nombre || 'Sin cliente',
          nombreContacto: documentoRow.contacto_nombre_contacto,
          telefono: documentoRow.contacto_telefono,
          email: documentoRow.contacto_email,
        }
      : null,
    etapaActual: seguimientoRow
      ? { id: seguimientoRow.etapa_id, nombre: seguimientoRow.etapa_nombre, color: seguimientoRow.etapa_color }
      : null,
    fechaPromesa: seguimientoRow?.fecha_promesa ?? null,
    partidas,
  };
}