import pool from '../../config/database';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ModoAutorizacion = 'ninguna' | 'directa' | 'flujo';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export type EstadoAutorizacion = 'no_requerida' | 'pendiente' | 'aprobada' | 'rechazada';

export interface AutorizacionReglaRow {
  id: number;
  empresa_id: number;
  transicion_id: number;
  monto_minimo: string | null;
  monto_maximo: string | null;
  modo: ModoAutorizacion;
  rol_autorizador_id: number | null;
  usuario_autorizador_id: number | null;
  nivel: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
  // campos enriquecidos del JOIN
  td_origen_nombre?: string;
  td_destino_nombre?: string;
  td_origen_codigo?: string;
  td_destino_codigo?: string;
  rol_nombre?: string | null;
  usuario_nombre?: string | null;
}

export interface AutorizacionSolicitudRow {
  id: number;
  empresa_id: number;
  regla_id: number;
  documento_origen_id: number;
  tipo_documento_origen: string;
  tipo_documento_destino: string;
  folio_documento_origen: string | null;
  monto: string;
  usuario_solicitante_id: number;
  usuario_autorizador_id: number | null;
  estado: EstadoSolicitud;
  comentario_solicitante: string | null;
  comentario_autorizador: string | null;
  created_at: string;
  updated_at: string;
  respondido_at: string | null;
  // campos enriquecidos
  usuario_solicitante_nombre?: string;
  usuario_autorizador_nombre?: string | null;
  td_origen_nombre?: string;
  td_destino_nombre?: string;
}

export type ResultadoPolitica =
  | { tipo: 'permitido' }
  | { tipo: 'sin_permiso_directa'; rol_requerido: string | null }
  | { tipo: 'solicitud_pendiente'; solicitud_id: number }
  | { tipo: 'solicitud_nueva'; solicitud_id: number };

export interface InfoPoliticaOpcion {
  modo_autorizacion: ModoAutorizacion | null;
  usuario_puede_autorizar: boolean | null;
  rol_requerido: string | null;
}

// ─── Transiciones disponibles (para selector de UI) ──────────────────────────

export interface TransicionConId {
  id: number;
  td_origen_nombre: string;
  td_origen_codigo: string;
  td_destino_nombre: string;
  td_destino_codigo: string;
}

export async function listarTransicionesEmpresa(empresaId: number): Promise<TransicionConId[]> {
  const { rows } = await pool.query<TransicionConId>(
    `SELECT etd.id,
            td_o.nombre AS td_origen_nombre, td_o.codigo AS td_origen_codigo,
            td_d.nombre AS td_destino_nombre, td_d.codigo AS td_destino_codigo
       FROM core.empresas_tipos_documento_transiciones etd
       JOIN core.tipos_documento td_o ON td_o.id = etd.tipo_documento_origen_id
       JOIN core.tipos_documento td_d ON td_d.id = etd.tipo_documento_destino_id
      WHERE etd.empresa_id = $1
        AND etd.activo = true
        AND td_o.activo = true
        AND td_d.activo = true
      ORDER BY td_o.nombre, td_d.nombre`,
    [empresaId]
  );
  return rows;
}

// ─── Reglas (CRUD) ────────────────────────────────────────────────────────────

export async function listarReglasEmpresa(empresaId: number): Promise<AutorizacionReglaRow[]> {
  const { rows } = await pool.query<AutorizacionReglaRow>(
    `SELECT ar.id,
            ar.empresa_id,
            ar.transicion_id,
            ar.monto_minimo,
            ar.monto_maximo,
            ar.modo,
            ar.rol_autorizador_id,
            ar.usuario_autorizador_id,
            ar.nivel,
            ar.activa,
            ar.created_at,
            ar.updated_at,
            td_o.nombre  AS td_origen_nombre,
            td_o.codigo  AS td_origen_codigo,
            td_d.nombre  AS td_destino_nombre,
            td_d.codigo  AS td_destino_codigo,
            r.nombre     AS rol_nombre,
            u.nombre     AS usuario_nombre
       FROM public.autorizaciones_reglas ar
       JOIN core.empresas_tipos_documento_transiciones etd ON etd.id = ar.transicion_id
       JOIN core.tipos_documento td_o ON td_o.id = etd.tipo_documento_origen_id
       JOIN core.tipos_documento td_d ON td_d.id = etd.tipo_documento_destino_id
       LEFT JOIN core.roles r ON r.id = ar.rol_autorizador_id
       LEFT JOIN core.usuarios u ON u.id = ar.usuario_autorizador_id
      WHERE ar.empresa_id = $1
        AND ar.activa = true
      ORDER BY td_o.nombre, ar.monto_minimo NULLS FIRST`,
    [empresaId]
  );
  return rows;
}

export async function obtenerReglaPorId(id: number, empresaId: number): Promise<AutorizacionReglaRow | null> {
  const { rows } = await pool.query<AutorizacionReglaRow>(
    `SELECT ar.*,
            td_o.nombre AS td_origen_nombre, td_o.codigo AS td_origen_codigo,
            td_d.nombre AS td_destino_nombre, td_d.codigo AS td_destino_codigo,
            r.nombre    AS rol_nombre,
            u.nombre    AS usuario_nombre
       FROM public.autorizaciones_reglas ar
       JOIN core.empresas_tipos_documento_transiciones etd ON etd.id = ar.transicion_id
       JOIN core.tipos_documento td_o ON td_o.id = etd.tipo_documento_origen_id
       JOIN core.tipos_documento td_d ON td_d.id = etd.tipo_documento_destino_id
       LEFT JOIN core.roles r ON r.id = ar.rol_autorizador_id
       LEFT JOIN core.usuarios u ON u.id = ar.usuario_autorizador_id
      WHERE ar.id = $1 AND ar.empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

interface CrearReglaInput {
  transicion_id: number;
  monto_minimo?: number | null;
  monto_maximo?: number | null;
  modo: ModoAutorizacion;
  rol_autorizador_id?: number | null;
  usuario_autorizador_id?: number | null;
}

async function verificarTraslapeRangos(
  empresaId: number,
  transicionId: number,
  montoMinimo: number | null | undefined,
  montoMaximo: number | null | undefined,
  excluirId: number = 0
): Promise<{ hay_traslape: boolean; monto_minimo_conflicto: string | null; monto_maximo_conflicto: string | null }> {
  const { rows } = await pool.query<{ id: number; monto_minimo: string | null; monto_maximo: string | null }>(
    `SELECT ar.id, ar.monto_minimo, ar.monto_maximo
       FROM public.autorizaciones_reglas ar
      WHERE ar.empresa_id    = $1
        AND ar.transicion_id = $2
        AND ar.activa        = true
        AND ar.id           != $3
        -- Traslape: new_max >= existing_min  Y  existing_max >= new_min
        -- NULL = sin límite en ese extremo → siempre satisface la condición
        AND ($4::numeric IS NULL OR ar.monto_minimo IS NULL OR $4 >= ar.monto_minimo)
        AND ($5::numeric IS NULL OR ar.monto_maximo IS NULL OR ar.monto_maximo >= $5)
      LIMIT 1`,
    [empresaId, transicionId, excluirId, montoMaximo ?? null, montoMinimo ?? null]
  );
  if (rows[0]) {
    return { hay_traslape: true, monto_minimo_conflicto: rows[0].monto_minimo, monto_maximo_conflicto: rows[0].monto_maximo };
  }
  return { hay_traslape: false, monto_minimo_conflicto: null, monto_maximo_conflicto: null };
}

export async function crearRegla(empresaId: number, data: CrearReglaInput): Promise<AutorizacionReglaRow> {
  const traslape = await verificarTraslapeRangos(
    empresaId, data.transicion_id, data.monto_minimo, data.monto_maximo
  );
  if (traslape.hay_traslape) {
    const conflicto = formatearRango(traslape.monto_minimo_conflicto, traslape.monto_maximo_conflicto);
    throw Object.assign(
      new Error(`Ya existe una política para esta transición que cubre parte del rango indicado (${conflicto}). Ajusta los montos para eliminar la intersección.`),
      { status: 409, code: 'RANGO_SOLAPADO' }
    );
  }

  const { rows } = await pool.query<AutorizacionReglaRow>(
    `INSERT INTO public.autorizaciones_reglas
       (empresa_id, transicion_id, monto_minimo, monto_maximo, modo,
        rol_autorizador_id, usuario_autorizador_id, activa)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING *`,
    [
      empresaId,
      data.transicion_id,
      data.monto_minimo ?? null,
      data.monto_maximo ?? null,
      data.modo,
      data.rol_autorizador_id ?? null,
      data.usuario_autorizador_id ?? null,
    ]
  );
  return rows[0];
}

export async function actualizarRegla(
  id: number,
  empresaId: number,
  data: Partial<CrearReglaInput>
): Promise<AutorizacionReglaRow | null> {
  const actual = await obtenerReglaPorId(id, empresaId);
  if (!actual) return null;

  const transicionId = data.transicion_id ?? actual.transicion_id;
  const montoMinimo = 'monto_minimo' in data ? data.monto_minimo : Number(actual.monto_minimo ?? null);
  const montoMaximo = 'monto_maximo' in data ? data.monto_maximo : Number(actual.monto_maximo ?? null);

  const traslape = await verificarTraslapeRangos(empresaId, transicionId, montoMinimo, montoMaximo, id);
  if (traslape.hay_traslape) {
    const conflicto = formatearRango(traslape.monto_minimo_conflicto, traslape.monto_maximo_conflicto);
    throw Object.assign(
      new Error(`Ya existe una política para esta transición que cubre parte del rango indicado (${conflicto}). Ajusta los montos para eliminar la intersección.`),
      { status: 409, code: 'RANGO_SOLAPADO' }
    );
  }

  const { rows } = await pool.query<AutorizacionReglaRow>(
    `UPDATE public.autorizaciones_reglas
        SET transicion_id          = COALESCE($3, transicion_id),
            monto_minimo           = $4,
            monto_maximo           = $5,
            modo                   = COALESCE($6, modo),
            rol_autorizador_id     = $7,
            usuario_autorizador_id = $8,
            updated_at             = NOW()
      WHERE id = $1 AND empresa_id = $2
      RETURNING *`,
    [
      id,
      empresaId,
      data.transicion_id ?? null,
      montoMinimo ?? null,
      montoMaximo ?? null,
      data.modo ?? null,
      data.rol_autorizador_id ?? null,
      data.usuario_autorizador_id ?? null,
    ]
  );
  return rows[0] ?? null;
}

export async function desactivarRegla(id: number, empresaId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE public.autorizaciones_reglas
        SET activa = false, updated_at = NOW()
      WHERE id = $1 AND empresa_id = $2 AND activa = true`,
    [id, empresaId]
  );
  return (rowCount ?? 0) > 0;
}

// ─── Lógica de política (usada por document-generation) ───────────────────────

interface BuscarPoliticaArgs {
  empresaId: number;
  transicionId: number;
  monto: number;
}

interface PoliticaRow {
  id: number;
  modo: ModoAutorizacion;
  rol_autorizador_id: number | null;
  usuario_autorizador_id: number | null;
  rol_nombre: string | null;
}

export async function buscarPoliticaAplicable(args: BuscarPoliticaArgs): Promise<PoliticaRow | null> {
  const { empresaId, transicionId, monto } = args;
  const { rows } = await pool.query<PoliticaRow>(
    `SELECT ar.id, ar.modo, ar.rol_autorizador_id, ar.usuario_autorizador_id,
            r.nombre AS rol_nombre
       FROM public.autorizaciones_reglas ar
       LEFT JOIN core.roles r ON r.id = ar.rol_autorizador_id
      WHERE ar.empresa_id    = $1
        AND ar.transicion_id = $2
        AND ar.activa        = true
        AND (ar.monto_minimo IS NULL OR $3 >= ar.monto_minimo)
        AND (ar.monto_maximo IS NULL OR $3 <= ar.monto_maximo)
      ORDER BY ar.id ASC
      LIMIT 1`,
    [empresaId, transicionId, monto]
  );
  return rows[0] ?? null;
}

export async function buscarTransicionId(
  empresaId: number,
  tipoOrigen: string,
  tipoDestino: string
): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT etd.id
       FROM core.empresas_tipos_documento_transiciones etd
       JOIN core.tipos_documento td_o ON td_o.id = etd.tipo_documento_origen_id
       JOIN core.tipos_documento td_d ON td_d.id = etd.tipo_documento_destino_id
      WHERE etd.empresa_id = $1
        AND LOWER(td_o.codigo) = LOWER($2)
        AND LOWER(td_d.codigo) = LOWER($3)
        AND etd.activo = true
      LIMIT 1`,
    [empresaId, tipoOrigen, tipoDestino]
  );
  return rows[0]?.id ?? null;
}

async function usuarioTienePermisoDirecta(
  userId: number,
  empresaId: number,
  politica: PoliticaRow
): Promise<boolean> {
  if (politica.usuario_autorizador_id !== null) {
    return politica.usuario_autorizador_id === userId;
  }
  if (politica.rol_autorizador_id !== null) {
    const { rows } = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM core.usuarios_roles
          WHERE usuario_id = $1 AND empresa_id = $2 AND rol_id = $3
       ) AS existe`,
      [userId, empresaId, politica.rol_autorizador_id]
    );
    return rows[0]?.existe ?? false;
  }
  return false;
}

export async function buscarSolicitudPendiente(
  documentoOrigenId: number,
  tipoDocumentoDestino: string
): Promise<{ id: number } | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM public.autorizaciones_solicitudes
      WHERE documento_origen_id     = $1
        AND LOWER(tipo_documento_destino) = LOWER($2)
        AND estado = 'pendiente'
      LIMIT 1`,
    [documentoOrigenId, tipoDocumentoDestino]
  );
  return rows[0] ?? null;
}

interface VerificarPoliticaArgs {
  empresaId: number;
  documentoOrigenId: number;
  tipoDocumentoDestino: string;
  userId: number | null | undefined;
}

export async function verificarPoliticaAutorizacion(args: VerificarPoliticaArgs): Promise<ResultadoPolitica> {
  const { empresaId, documentoOrigenId, tipoDocumentoDestino, userId } = args;

  // Cargar datos del documento origen
  const { rows: docRows } = await pool.query<{
    tipo_documento: string;
    total: string;
    estado_autorizacion: EstadoAutorizacion;
    serie: string | null;
    numero: number | null;
  }>(
    `SELECT tipo_documento, total, estado_autorizacion, serie, numero
       FROM public.documentos
      WHERE id = $1 AND empresa_id = $2
      LIMIT 1`,
    [documentoOrigenId, empresaId]
  );

  const doc = docRows[0];
  if (!doc) return { tipo: 'permitido' };

  // Si el documento ya fue autorizado (modo flujo), permitir la transición
  if (doc.estado_autorizacion === 'aprobada') return { tipo: 'permitido' };

  // Buscar la transición para esta pareja de tipos
  const transicionId = await buscarTransicionId(empresaId, doc.tipo_documento, tipoDocumentoDestino);
  if (!transicionId) return { tipo: 'permitido' };

  // Buscar política aplicable para este monto
  const monto = Number(doc.total ?? 0);
  const politica = await buscarPoliticaAplicable({ empresaId, transicionId, monto });
  if (!politica || politica.modo === 'ninguna') return { tipo: 'permitido' };

  // Modo directa: verificar permiso del usuario actual
  if (politica.modo === 'directa') {
    if (!userId) {
      return { tipo: 'sin_permiso_directa', rol_requerido: politica.rol_nombre };
    }
    const tienPermiso = await usuarioTienePermisoDirecta(userId, empresaId, politica);
    if (tienPermiso) return { tipo: 'permitido' };
    return { tipo: 'sin_permiso_directa', rol_requerido: politica.rol_nombre };
  }

  // Modo flujo: verificar si ya hay solicitud pendiente
  const solicitudExistente = await buscarSolicitudPendiente(documentoOrigenId, tipoDocumentoDestino);
  if (solicitudExistente) {
    return { tipo: 'solicitud_pendiente', solicitud_id: solicitudExistente.id };
  }

  // Crear nueva solicitud en transacción propia
  const folio = [doc.serie, doc.numero].filter(Boolean).join('') || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: solRows } = await client.query<{ id: number }>(
      `INSERT INTO public.autorizaciones_solicitudes
         (empresa_id, regla_id, documento_origen_id, tipo_documento_origen,
          tipo_documento_destino, folio_documento_origen, monto, usuario_solicitante_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        empresaId,
        politica.id,
        documentoOrigenId,
        doc.tipo_documento,
        tipoDocumentoDestino,
        folio,
        monto,
        userId ?? null,
      ]
    );

    await client.query(
      `UPDATE public.documentos
          SET estado_autorizacion = 'pendiente'
        WHERE id = $1`,
      [documentoOrigenId]
    );

    await client.query('COMMIT');
    return { tipo: 'solicitud_nueva', solicitud_id: solRows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function obtenerInfoPoliticaParaOpcion(
  empresaId: number,
  transicionId: number,
  monto: number,
  userId: number | null | undefined
): Promise<InfoPoliticaOpcion> {
  const politica = await buscarPoliticaAplicable({ empresaId, transicionId, monto });
  if (!politica || politica.modo === 'ninguna') {
    return { modo_autorizacion: politica?.modo ?? null, usuario_puede_autorizar: null, rol_requerido: null };
  }
  if (politica.modo === 'directa') {
    const puede = userId ? await usuarioTienePermisoDirecta(userId, empresaId, politica) : false;
    return { modo_autorizacion: 'directa', usuario_puede_autorizar: puede, rol_requerido: politica.rol_nombre };
  }
  return { modo_autorizacion: 'flujo', usuario_puede_autorizar: null, rol_requerido: null };
}

// ─── Solicitudes ──────────────────────────────────────────────────────────────

const SOLICITUDES_JOIN = `
  FROM public.autorizaciones_solicitudes s
  JOIN core.usuarios us ON us.id = s.usuario_solicitante_id
  LEFT JOIN core.usuarios ua ON ua.id = s.usuario_autorizador_id
`;

const SOLICITUDES_FIELDS = `
  s.id, s.empresa_id, s.regla_id, s.documento_origen_id, s.tipo_documento_origen,
  s.tipo_documento_destino, s.folio_documento_origen, s.monto, s.estado,
  s.usuario_solicitante_id, s.usuario_autorizador_id,
  s.comentario_solicitante, s.comentario_autorizador,
  s.created_at, s.updated_at, s.respondido_at,
  us.nombre AS usuario_solicitante_nombre,
  ua.nombre AS usuario_autorizador_nombre
`;

export async function listarBandejaAutorizador(
  userId: number,
  empresaId: number
): Promise<AutorizacionSolicitudRow[]> {
  const { rows } = await pool.query<AutorizacionSolicitudRow>(
    `SELECT ${SOLICITUDES_FIELDS}
     ${SOLICITUDES_JOIN}
      JOIN public.autorizaciones_reglas ar ON ar.id = s.regla_id
      WHERE s.empresa_id = $1
        AND s.estado = 'pendiente'
        AND (
          ar.usuario_autorizador_id = $2
          OR (
            ar.rol_autorizador_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM core.usuarios_roles ur
               WHERE ur.usuario_id = $2
                 AND ur.empresa_id = $1
                 AND ur.rol_id = ar.rol_autorizador_id
            )
          )
        )
      ORDER BY s.created_at DESC`,
    [empresaId, userId]
  );
  return rows;
}

export async function listarMisSolicitudes(
  userId: number,
  empresaId: number,
  estado?: string
): Promise<AutorizacionSolicitudRow[]> {
  const values: any[] = [empresaId, userId];
  let filtroEstado = '';
  if (estado && estado !== 'todas') {
    values.push(estado);
    filtroEstado = `AND s.estado = $${values.length}`;
  }
  const { rows } = await pool.query<AutorizacionSolicitudRow>(
    `SELECT ${SOLICITUDES_FIELDS}
     ${SOLICITUDES_JOIN}
      WHERE s.empresa_id = $1
        AND s.usuario_solicitante_id = $2
        ${filtroEstado}
      ORDER BY s.created_at DESC`,
    values
  );
  return rows;
}

export async function obtenerSolicitudPorId(
  id: number,
  empresaId: number
): Promise<AutorizacionSolicitudRow | null> {
  const { rows } = await pool.query<AutorizacionSolicitudRow>(
    `SELECT ${SOLICITUDES_FIELDS}
     ${SOLICITUDES_JOIN}
      WHERE s.id = $1 AND s.empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

interface ResponderSolicitudArgs {
  id: number;
  userId: number;
  empresaId: number;
  decision: 'aprobada' | 'rechazada';
  comentario?: string | null;
}

export async function responderSolicitud(args: ResponderSolicitudArgs): Promise<AutorizacionSolicitudRow | null> {
  const { id, userId, empresaId, decision, comentario } = args;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cargar solicitud con bloqueo
    const { rows: solRows } = await client.query<{
      id: number;
      estado: string;
      documento_origen_id: number;
      regla_id: number;
    }>(
      `SELECT id, estado, documento_origen_id, regla_id
         FROM public.autorizaciones_solicitudes
        WHERE id = $1 AND empresa_id = $2
          FOR UPDATE`,
      [id, empresaId]
    );

    const sol = solRows[0];
    if (!sol) {
      await client.query('ROLLBACK');
      return null;
    }
    if (sol.estado !== 'pendiente') {
      throw Object.assign(
        new Error('La solicitud ya fue respondida o cancelada.'),
        { status: 409, code: 'SOLICITUD_NO_PENDIENTE' }
      );
    }

    // Verificar que el usuario tiene permiso para responder según la regla
    const { rows: reglaRows } = await client.query<{
      rol_autorizador_id: number | null;
      usuario_autorizador_id: number | null;
    }>(
      `SELECT rol_autorizador_id, usuario_autorizador_id
         FROM public.autorizaciones_reglas
        WHERE id = $1`,
      [sol.regla_id]
    );
    const regla = reglaRows[0];
    if (regla) {
      let tienePermiso = false;
      if (regla.usuario_autorizador_id !== null) {
        tienePermiso = regla.usuario_autorizador_id === userId;
      } else if (regla.rol_autorizador_id !== null) {
        const { rows: rolRows } = await client.query<{ existe: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM core.usuarios_roles
              WHERE usuario_id = $1 AND empresa_id = $2 AND rol_id = $3
           ) AS existe`,
          [userId, empresaId, regla.rol_autorizador_id]
        );
        tienePermiso = rolRows[0]?.existe ?? false;
      }
      if (!tienePermiso) {
        throw Object.assign(
          new Error('No tiene permiso para responder esta solicitud de autorización.'),
          { status: 403, code: 'SIN_PERMISO_RESPONDER' }
        );
      }
    }

    // Actualizar solicitud
    await client.query(
      `UPDATE public.autorizaciones_solicitudes
          SET estado = $1, usuario_autorizador_id = $2, comentario_autorizador = $3,
              respondido_at = NOW(), updated_at = NOW()
        WHERE id = $4`,
      [decision, userId, comentario ?? null, id]
    );

    // Actualizar estado_autorizacion del documento origen
    await client.query(
      `UPDATE public.documentos
          SET estado_autorizacion = $1
        WHERE id = $2`,
      [decision, sol.documento_origen_id]
    );

    await client.query('COMMIT');
    return obtenerSolicitudPorId(id, empresaId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelarSolicitud(
  id: number,
  userId: number,
  empresaId: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{ documento_origen_id: number; estado: string }>(
      `SELECT documento_origen_id, estado
         FROM public.autorizaciones_solicitudes
        WHERE id = $1 AND empresa_id = $2 AND usuario_solicitante_id = $3
          FOR UPDATE`,
      [id, empresaId, userId]
    );

    const sol = rows[0];
    if (!sol || sol.estado !== 'pendiente') {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `UPDATE public.autorizaciones_solicitudes
          SET estado = 'cancelada', updated_at = NOW()
        WHERE id = $1`,
      [id]
    );

    await client.query(
      `UPDATE public.documentos
          SET estado_autorizacion = 'no_requerida'
        WHERE id = $1`,
      [sol.documento_origen_id]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatearRango(min: string | null, max: string | null): string {
  const fmt = (v: string | null) => (v ? `$${Number(v).toLocaleString('es-MX')}` : '∞');
  return `${fmt(min)} – ${fmt(max)}`;
}
