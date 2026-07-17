import type { Pool as PgPool, PoolClient } from 'pg';
import pool from '../../config/database';

export interface PolizaEncabezado {
  id: number;
  empresa_id: number;
  tipo_poliza_id: number;
  tipo_poliza_identificador: string;
  ejercicio: number;
  periodo: number;
  numero: number;
  fecha: string;
  referencia: string | null;
  observaciones: string | null;
  total_cargos: number;
  total_abonos: number;
  modulo_origen: string | null;
  estatus: string;
  creada_por_id: number | null;
  creada_por_nombre: string | null;
  modificada_por_id: number | null;
  modificada_por_nombre: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PolizaMovimiento {
  id: number;
  poliza_id: number;
  renglon: number;
  cuenta_id: number;
  cuenta: string;
  cuenta_descripcion: string;
  concepto_id: number | null;
  concepto_descripcion: string | null;
  concepto_texto: string | null;
  cargo: number;
  abono: number;
  fecha: string | null;
  uuid_cfdi: string | null;
  rfc: string | null;
}

export type PolizaMovimientoInput = {
  cuenta_id: number;
  concepto_id?: number | null;
  // Concepto libre del renglón (ej. generado por contabilización automática
  // de facturas). Independiente de concepto_id, que sigue siendo el catálogo
  // genérico de public.conceptos.
  concepto_texto?: string | null;
  cargo?: number;
  abono?: number;
  uuid_cfdi?: string | null;
  rfc?: string | null;
};

export type PolizaEncabezadoInput = {
  tipo_poliza_id: number;
  fecha: string; // 'YYYY-MM-DD'
  referencia?: string | null;
  observaciones?: string | null;
  estatus: 'borrador' | 'aplicada';
  movimientos: PolizaMovimientoInput[];
};

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const FECHA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

// Deriva ejercicio/periodo a partir de la cadena 'YYYY-MM-DD' mediante split,
// sin construir un objeto Date: new Date('YYYY-MM-DD') se interpreta en UTC
// y getFullYear()/getMonth() locales pueden desfasar un día según la zona
// horaria del servidor.
function derivarEjercicioPeriodo(fechaISO: string): { ejercicio: number; periodo: number } {
  const match = FECHA_REGEX.exec(fechaISO ?? '');
  if (!match) {
    throw new Error('VALIDATION_ERROR: La fecha debe tener formato YYYY-MM-DD');
  }
  return { ejercicio: Number(match[1]), periodo: Number(match[2]) };
}

async function obtenerTipoPolizaOFallar(
  empresaId: number,
  tipoPolizaId: number
): Promise<{ id: number; poliza_inicial: number }> {
  const { rows } = await pool.query<{ id: number; poliza_inicial: number }>(
    `SELECT id, poliza_inicial FROM contabilidad.tipos_poliza WHERE id = $1 AND empresa_id = $2`,
    [tipoPolizaId, empresaId]
  );
  const tipo = rows[0];
  if (!tipo) {
    throw new Error('VALIDATION_ERROR: El tipo de póliza no existe en esta empresa');
  }
  return tipo;
}

// Consecutivo independiente por tipo de póliza (empresa + tipo_poliza_id +
// ejercicio + periodo): NO es un consecutivo global compartido entre tipos.
// Si ya existe una póliza para esa combinación exacta, el siguiente número es
// MAX(numero) + 1; si no existe ninguna, se usa el poliza_inicial configurado
// para ese tipo (nunca un valor fijo como 1).
async function obtenerSiguienteNumero(
  queryable: PgPool | PoolClient,
  empresaId: number,
  tipoPolizaId: number,
  ejercicio: number,
  periodo: number,
  polizaInicial: number
): Promise<number> {
  const { rows } = await queryable.query<{ maximo: string | null }>(
    `SELECT MAX(numero) AS maximo FROM contabilidad.polizas
     WHERE empresa_id = $1 AND tipo_poliza_id = $2 AND ejercicio = $3 AND periodo = $4`,
    [empresaId, tipoPolizaId, ejercicio, periodo]
  );
  const maximo = rows[0]?.maximo;
  return maximo != null ? Number(maximo) + 1 : polizaInicial;
}

function validarMovimiento(mov: PolizaMovimientoInput, index: number): void {
  const etiqueta = `El renglón ${index + 1}`;
  if (!mov.cuenta_id) {
    throw new Error(`VALIDATION_ERROR: ${etiqueta} requiere una cuenta`);
  }
  const cargo = Number(mov.cargo ?? 0);
  const abono = Number(mov.abono ?? 0);
  if (cargo < 0 || abono < 0) {
    throw new Error(`VALIDATION_ERROR: ${etiqueta} no puede tener importes negativos`);
  }
  if (cargo > 0 && abono > 0) {
    throw new Error(`VALIDATION_ERROR: ${etiqueta} no puede tener cargo y abono al mismo tiempo`);
  }
  if (cargo === 0 && abono === 0) {
    throw new Error(`VALIDATION_ERROR: ${etiqueta} debe tener cargo o abono`);
  }
  if (mov.uuid_cfdi?.trim() && !UUID_REGEX.test(mov.uuid_cfdi.trim())) {
    throw new Error(`VALIDATION_ERROR: ${etiqueta} tiene un UUID CFDI con formato inválido`);
  }
  if (mov.rfc?.trim() && ![12, 13].includes(mov.rfc.trim().length)) {
    throw new Error(`VALIDATION_ERROR: ${etiqueta} tiene un RFC con longitud inválida`);
  }
}

// Error de validación con detalle por renglón, para que el frontend pueda
// mostrar exactamente qué movimiento falló y por qué (no solo un mensaje
// genérico). El controller lo distingue de un Error común para incluir
// `detalles` en la respuesta JSON.
export class PolizaValidacionError extends Error {
  detalles: Array<{ renglon: number; cuenta_id: number; cuenta: string | null; motivo: string }>;

  constructor(
    message: string,
    detalles: Array<{ renglon: number; cuenta_id: number; cuenta: string | null; motivo: string }>
  ) {
    super(message);
    this.name = 'PolizaValidacionError';
    this.detalles = detalles;
  }
}

// `accion` solo cambia la redacción del mensaje ("guardar" vs "aplicar") para
// que el error tenga sentido sin importar si se dispara al crear/editar o al
// aplicar una póliza desde la grilla.
async function validarCuentasYConceptos(
  empresaId: number,
  movimientos: PolizaMovimientoInput[],
  accion: string = 'guardar'
): Promise<void> {
  // contabilidad.cuentas.id es bigserial: node-pg lo regresa como string. Los
  // cuenta_id de entrada también pueden llegar como string dependiendo de qué
  // endpoint los originó (ver fix en cuentas.repository/listarCuentasAfectables).
  // Se normaliza todo a number para que la comparación nunca falle por tipos.
  const cuentaIds = [...new Set(movimientos.map((m) => Number(m.cuenta_id)))];
  const { rows } = await pool.query<{ id: string; cuenta: string; empresa_id: string; activa: boolean; afectable: boolean }>(
    `SELECT id, cuenta, empresa_id, activa, afectable FROM contabilidad.cuentas WHERE id = ANY($1::bigint[])`,
    [cuentaIds]
  );
  const cuentasPorId = new Map(rows.map((r) => [Number(r.id), r]));

  const detalles: Array<{ renglon: number; cuenta_id: number; cuenta: string | null; motivo: string }> = [];
  movimientos.forEach((mov, index) => {
    const cuentaId = Number(mov.cuenta_id);
    const cuenta = cuentasPorId.get(cuentaId);
    let motivo: string | null = null;
    if (!cuenta) {
      motivo = 'La cuenta no existe';
    } else if (Number(cuenta.empresa_id) !== empresaId) {
      motivo = 'La cuenta no pertenece a esta empresa';
    } else if (!cuenta.activa) {
      motivo = 'La cuenta no está activa';
    } else if (!cuenta.afectable) {
      motivo = 'La cuenta no es afectable (tiene subcuentas)';
    }
    if (motivo) {
      detalles.push({ renglon: index + 1, cuenta_id: cuentaId, cuenta: cuenta?.cuenta ?? null, motivo });
    }
  });

  if (detalles.length > 0) {
    throw new PolizaValidacionError(
      `No se puede ${accion} la póliza porque hay movimientos con cuentas inválidas.`,
      detalles
    );
  }

  const conceptoIds = [...new Set(movimientos.map((m) => m.concepto_id).filter((v): v is number => v != null))];
  if (conceptoIds.length > 0) {
    const conceptosResult = await pool.query<{ id: number }>(
      `SELECT id FROM public.conceptos WHERE empresa_id = $1 AND id = ANY($2::integer[])`,
      [empresaId, conceptoIds]
    );
    const conceptosValidos = new Set(conceptosResult.rows.map((r) => Number(r.id)));
    const conceptoInvalido = conceptoIds.find((id) => !conceptosValidos.has(Number(id)));
    if (conceptoInvalido != null) {
      throw new Error('VALIDATION_ERROR: Uno o más conceptos no son válidos');
    }
  }
}

// Los importes son numeric(19,2): redondear a centavos antes de comparar
// evita falsos "no cuadra" por arrastre de flotantes.
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function calcularTotales(movimientos: PolizaMovimientoInput[]): { totalCargos: number; totalAbonos: number } {
  const totalCargos = movimientos.reduce((acc, m) => acc + Number(m.cargo ?? 0), 0);
  const totalAbonos = movimientos.reduce((acc, m) => acc + Number(m.abono ?? 0), 0);
  return { totalCargos: redondear(totalCargos), totalAbonos: redondear(totalAbonos) };
}

function validarEncabezadoYMovimientos(input: PolizaEncabezadoInput, totalCargos: number, totalAbonos: number): void {
  if (!input.movimientos || input.movimientos.length === 0) {
    throw new Error('VALIDATION_ERROR: La póliza debe tener al menos un movimiento');
  }
  input.movimientos.forEach(validarMovimiento);

  if (!['borrador', 'aplicada'].includes(input.estatus)) {
    throw new Error('VALIDATION_ERROR: El estatus debe ser borrador o aplicada');
  }

  if (input.estatus === 'aplicada') {
    if (input.movimientos.length < 2) {
      throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza con menos de dos movimientos.');
    }
    if (Math.abs(totalCargos - totalAbonos) > 0.005) {
      throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza descuadrada.');
    }
    if (totalCargos <= 0) {
      throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza con el total en cero.');
    }
  }
}

// ---------------------------------------------------------------------------
// Afectación de saldos mensuales (contabilidad.cuentas_saldos_mensuales)
// ---------------------------------------------------------------------------
//
// `aplicada` = la póliza ya afectó saldos contables; `borrador` = existe pero
// todavía no los afecta. No hay un tercer estado de "validada" en esta fase.

type MovimientoParaSaldos = { cuenta_id: number; cargo?: number; abono?: number };

// Para cada cuenta de movimiento, obtiene la cadena completa (ella misma +
// todos sus ancestros vía cuenta_padre_id) para que las cuentas agrupadoras
// también reciban el acumulado, no solo la cuenta afectable de hoja.
async function obtenerCadenaCuentas(
  client: PoolClient,
  empresaId: number,
  cuentaIds: number[]
): Promise<Map<number, number[]>> {
  const cadenaPorCuenta = new Map<number, number[]>();
  if (cuentaIds.length === 0) return cadenaPorCuenta;

  const { rows } = await client.query<{ cuenta_origen: string; cuenta_ancestro: string }>(
    `WITH RECURSIVE cadena AS (
       SELECT id AS cuenta_origen, id AS cuenta_ancestro, cuenta_padre_id
       FROM contabilidad.cuentas
       WHERE empresa_id = $1 AND id = ANY($2::bigint[])
       UNION ALL
       SELECT cadena.cuenta_origen, c.id AS cuenta_ancestro, c.cuenta_padre_id
       FROM contabilidad.cuentas c
       JOIN cadena ON c.id = cadena.cuenta_padre_id
       WHERE c.empresa_id = $1
     )
     SELECT cuenta_origen, cuenta_ancestro FROM cadena`,
    [empresaId, cuentaIds]
  );

  for (const row of rows) {
    const origen = Number(row.cuenta_origen);
    const ancestro = Number(row.cuenta_ancestro);
    const lista = cadenaPorCuenta.get(origen) ?? [];
    lista.push(ancestro);
    cadenaPorCuenta.set(origen, lista);
  }
  return cadenaPorCuenta;
}

// Suma cargos/abonos por cuenta REALMENTE afectada (cuenta del movimiento +
// todos sus ancestros), agregando movimientos distintos que compartan un
// mismo ancestro antes de tocar la base de datos.
function acumularAfectacionesPorCuenta(
  movimientos: MovimientoParaSaldos[],
  cadenaPorCuenta: Map<number, number[]>
): Map<number, { cargos: number; abonos: number }> {
  const acumulado = new Map<number, { cargos: number; abonos: number }>();
  for (const mov of movimientos) {
    const cuentaId = Number(mov.cuenta_id);
    const cargo = Number(mov.cargo ?? 0);
    const abono = Number(mov.abono ?? 0);
    const cuentasAfectadas = cadenaPorCuenta.get(cuentaId) ?? [cuentaId];
    for (const cuentaAfectada of cuentasAfectadas) {
      const actual = acumulado.get(cuentaAfectada) ?? { cargos: 0, abonos: 0 };
      actual.cargos += cargo;
      actual.abonos += abono;
      acumulado.set(cuentaAfectada, actual);
    }
  }
  return acumulado;
}

// Cargo siempre suma a cargos, abono siempre suma a abonos: la naturaleza
// deudora/acreedora de la cuenta NO se interpreta aquí (eso es solo para
// calcular saldos visuales después, no para invertir signos al guardar).
async function aplicarSaldos(
  client: PoolClient,
  empresaId: number,
  ejercicio: number,
  periodo: number,
  movimientos: MovimientoParaSaldos[]
): Promise<void> {
  const cuentaIds = [...new Set(movimientos.map((m) => Number(m.cuenta_id)))];
  const cadenaPorCuenta = await obtenerCadenaCuentas(client, empresaId, cuentaIds);
  const acumulado = acumularAfectacionesPorCuenta(movimientos, cadenaPorCuenta);

  for (const [cuentaId, { cargos, abonos }] of acumulado) {
    await client.query(
      `INSERT INTO contabilidad.cuentas_saldos_mensuales (empresa_id, cuenta_id, ejercicio, periodo, cargos, abonos)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (empresa_id, cuenta_id, ejercicio, periodo)
       DO UPDATE SET
         cargos = contabilidad.cuentas_saldos_mensuales.cargos + EXCLUDED.cargos,
         abonos = contabilidad.cuentas_saldos_mensuales.abonos + EXCLUDED.abonos,
         actualizado_en = now()`,
      [empresaId, cuentaId, ejercicio, periodo, redondear(cargos), redondear(abonos)]
    );
  }
}

// Reversa exacta de aplicarSaldos: resta lo que esa póliza había sumado. Se
// usa UPDATE (no upsert) porque la fila ya debe existir si se aplicó antes.
async function revertirSaldos(
  client: PoolClient,
  empresaId: number,
  ejercicio: number,
  periodo: number,
  movimientos: MovimientoParaSaldos[]
): Promise<void> {
  const cuentaIds = [...new Set(movimientos.map((m) => Number(m.cuenta_id)))];
  const cadenaPorCuenta = await obtenerCadenaCuentas(client, empresaId, cuentaIds);
  const acumulado = acumularAfectacionesPorCuenta(movimientos, cadenaPorCuenta);

  for (const [cuentaId, { cargos, abonos }] of acumulado) {
    await client.query(
      `UPDATE contabilidad.cuentas_saldos_mensuales
       SET cargos = cargos - $5, abonos = abonos - $6, actualizado_en = now()
       WHERE empresa_id = $1 AND cuenta_id = $2 AND ejercicio = $3 AND periodo = $4`,
      [empresaId, cuentaId, ejercicio, periodo, redondear(cargos), redondear(abonos)]
    );
  }
}

// fecha se manda siempre como texto plano 'YYYY-MM-DD' (to_char), nunca como
// el Date que arma node-pg para columnas date: así el frontend jamás necesita
// pasarla por new Date(...)/toISOString() y no hay riesgo de desfase de zona
// horaria en ningún punto del contrato de la API.
const SELECT_ENCABEZADO = `
  SELECT
    p.id, p.empresa_id, p.tipo_poliza_id, tp.identificador AS tipo_poliza_identificador,
    p.ejercicio, p.periodo, p.numero, to_char(p.fecha, 'YYYY-MM-DD') AS fecha,
    p.referencia, p.observaciones,
    p.total_cargos, p.total_abonos, p.modulo_origen, p.estatus,
    p.creada_por_id, ua.nombre AS creada_por_nombre,
    p.modificada_por_id, um.nombre AS modificada_por_nombre,
    p.creado_en, p.actualizado_en
  FROM contabilidad.polizas p
  JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
  LEFT JOIN core.usuarios ua ON ua.id = p.creada_por_id
  LEFT JOIN core.usuarios um ON um.id = p.modificada_por_id
`;

// bigint/bigserial (id, empresa_id, tipo_poliza_id, creada_por_id,
// modificada_por_id) llegan de node-pg como string, no como number, aunque
// PolizaEncabezado los declare number. Sin esta conversión, el frontend
// compara "5" (string, del listado) contra 5 (number, de un onRowClick que sí
// castea) y la comparación estricta falla silenciosamente: la póliza queda
// "seleccionada" por id pero nunca se encuentra en el arreglo, así que sus
// movimientos jamás se muestran.
function mapearEncabezado(row: any): PolizaEncabezado {
  return {
    ...row,
    id: Number(row.id),
    empresa_id: Number(row.empresa_id),
    tipo_poliza_id: Number(row.tipo_poliza_id),
    total_cargos: Number(row.total_cargos),
    total_abonos: Number(row.total_abonos),
    creada_por_id: row.creada_por_id != null ? Number(row.creada_por_id) : null,
    modificada_por_id: row.modificada_por_id != null ? Number(row.modificada_por_id) : null,
  };
}

export async function listarPolizas(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  buscar?: string
): Promise<PolizaEncabezado[]> {
  const condiciones = ['p.empresa_id = $1', 'p.ejercicio = $2', 'p.periodo = $3'];
  const params: Array<string | number> = [empresaId, ejercicio, periodo];

  if (buscar?.trim()) {
    params.push(`%${buscar.trim()}%`);
    const idx = params.length;
    condiciones.push(
      `(CAST(p.numero AS TEXT) ILIKE $${idx} OR tp.identificador ILIKE $${idx} OR p.referencia ILIKE $${idx} OR p.modulo_origen ILIKE $${idx})`
    );
  }

  const { rows } = await pool.query(
    `${SELECT_ENCABEZADO} WHERE ${condiciones.join(' AND ')} ORDER BY p.numero ASC`,
    params
  );
  return rows.map(mapearEncabezado);
}

// client opcional: para poder leer una póliza recién insertada por la misma
// transacción (todavía sin COMMIT) cuando crearPolizaConMovimientos corre
// sobre un client externo en vez de abrir su propia conexión.
export async function obtenerPolizaPorId(id: number, empresaId: number, client?: PoolClient): Promise<PolizaEncabezado | null> {
  const db = client ?? pool;
  const { rows } = await db.query(`${SELECT_ENCABEZADO} WHERE p.id = $1 AND p.empresa_id = $2`, [id, empresaId]);
  return rows[0] ? mapearEncabezado(rows[0]) : null;
}

// Regresa null si la póliza no existe o no pertenece a la empresa actual,
// para que el controller responda 404 sin filtrar datos de otra empresa.
export async function listarMovimientosPoliza(polizaId: number, empresaId: number): Promise<PolizaMovimiento[] | null> {
  const poliza = await obtenerPolizaPorId(polizaId, empresaId);
  if (!poliza) return null;

  const { rows } = await pool.query(
    `SELECT
       pd.id, pd.poliza_id, pd.renglon, pd.cuenta_id,
       c.cuenta, c.descripcion AS cuenta_descripcion,
       pd.concepto_id, co.nombre_concepto AS concepto_descripcion, pd.concepto_texto,
       pd.cargo, pd.abono, to_char(pd.fecha, 'YYYY-MM-DD') AS fecha, pd.uuid_cfdi, pd.rfc
     FROM contabilidad.polizas_detalle pd
     JOIN contabilidad.cuentas c ON c.id = pd.cuenta_id
     LEFT JOIN public.conceptos co ON co.id = pd.concepto_id
     WHERE pd.poliza_id = $1 AND pd.empresa_id = $2
     ORDER BY pd.renglon ASC`,
    [polizaId, empresaId]
  );

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    poliza_id: Number(row.poliza_id),
    cuenta_id: Number(row.cuenta_id),
    concepto_id: row.concepto_id != null ? Number(row.concepto_id) : null,
    cargo: Number(row.cargo),
    abono: Number(row.abono),
  }));
}

export async function obtenerPolizaConMovimientos(
  polizaId: number,
  empresaId: number
): Promise<{ encabezado: PolizaEncabezado; movimientos: PolizaMovimiento[] } | null> {
  const encabezado = await obtenerPolizaPorId(polizaId, empresaId);
  if (!encabezado) return null;
  const movimientos = await listarMovimientosPoliza(polizaId, empresaId);
  return { encabezado, movimientos: movimientos ?? [] };
}

// Eliminación física (no baja lógica): contabilidad.polizas_detalle y
// contabilidad.documentos_polizas ya tienen FK con ON DELETE CASCADE hacia
// contabilidad.polizas (ver migración 20260709_create_contabilidad_base.sql),
// así que borrar el encabezado arrastra automáticamente sus movimientos sin
// necesidad de un DELETE explícito adicional ni de una transacción manual.
//
// Una póliza aplicada ya afectó saldos: eliminarla sin revertir dejaría
// saldos huérfanos. Debe desaplicarse primero (cambiarEstatusPoliza).
//
// contabilidad.contabilizaciones apunta a la póliza (poliza_id) sin ON DELETE
// CASCADE a propósito (ver 20260717_create_contabilidad_contabilizaciones):
// borrar una póliza no debe arrastrar silenciosamente el registro de
// contabilización. Aquí se borra explícitamente ese vínculo antes de la
// póliza, dentro de la misma transacción, para no dejar huérfanos ni violar
// la FK. Si la póliza es una contabilización original que ya tiene una
// reversa registrada, se bloquea: borrar el original dejaría la reversa
// apuntando a una contabilización inexistente.
export async function eliminarPoliza(id: number, empresaId: number): Promise<boolean | null> {
  const actual = await obtenerPolizaPorId(id, empresaId);
  if (!actual) return null;

  const client = await pool.connect();
  let encontrada = true;
  try {
    await client.query('BEGIN');

    // Regla absoluta: una póliza aplicada nunca se puede eliminar, sin
    // importar su origen (manual, ventas, lote, contabilización automática,
    // etc.). Se revalida el estatus bajo lock (no solo la lectura de arriba)
    // para cerrar la ventana de carrera con una aplicación concurrente
    // disparada desde la grilla justo antes de este DELETE.
    const { rows: filasLock } = await client.query<{ estatus: string }>(
      `SELECT estatus FROM contabilidad.polizas WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );

    if (!filasLock[0]) {
      encontrada = false;
    } else {
      if (filasLock[0].estatus === 'aplicada') {
        throw new Error('VALIDATION_ERROR: No se puede eliminar una póliza aplicada.');
      }

      // Lock de las contabilizaciones ligadas a esta póliza: cierra la ventana
      // de carrera con un registro de reversa concurrente entre la validación
      // de abajo y el DELETE.
      const { rows: contabilizacionesPoliza } = await client.query<{ id: number; es_reversa: boolean }>(
        `SELECT id, es_reversa FROM contabilidad.contabilizaciones
          WHERE empresa_id = $1 AND poliza_id = $2
          FOR UPDATE`,
        [empresaId, id]
      );

      const originales = contabilizacionesPoliza.filter((c) => !c.es_reversa);
      if (originales.length > 0) {
        const idsOriginales = originales.map((c) => c.id);
        const { rows: reversaRows } = await client.query<{ existe: boolean }>(
          `SELECT EXISTS(
             SELECT 1 FROM contabilidad.contabilizaciones
             WHERE empresa_id = $1 AND es_reversa = true AND contabilizacion_origen_id = ANY($2::bigint[])
           ) AS existe`,
          [empresaId, idsOriginales]
        );
        if (reversaRows[0].existe) {
          throw new Error('VALIDATION_ERROR: No se puede eliminar esta póliza porque tiene una reversa contable asociada.');
        }
      }

      if (contabilizacionesPoliza.length > 0) {
        await client.query(`DELETE FROM contabilidad.contabilizaciones WHERE empresa_id = $1 AND poliza_id = $2`, [
          empresaId,
          id,
        ]);
      }

      await client.query(`DELETE FROM contabilidad.polizas WHERE empresa_id = $1 AND id = $2`, [empresaId, id]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return encontrada ? true : null;
}

// Aplicar/desaplicar desde la grilla principal (acción rápida, sin pasar por
// el formulario completo).
//
// `aplicada` = la póliza ya afectó contabilidad.cuentas_saldos_mensuales.
// `borrador` = existe pero todavía no afecta saldos. No hay estado
// intermedio de "validada": aplicar valida Y afecta saldos en el mismo paso.
//
// Todo corre en una sola transacción con `SELECT ... FOR UPDATE` sobre la
// póliza para serializar dobles-clics/condiciones de carrera: una segunda
// llamada concurrente espera a que la primera termine y luego encuentra el
// estatus ya cambiado (el guard de no-op evita duplicar/restar dos veces).
export async function cambiarEstatusPoliza(
  id: number,
  empresaId: number,
  estatusDestino: 'aplicada' | 'borrador'
): Promise<PolizaEncabezado | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: filasPoliza } = await client.query<{
      id: string;
      estatus: string;
      ejercicio: number;
      periodo: number;
    }>(
      `SELECT id, estatus, ejercicio, periodo
       FROM contabilidad.polizas
       WHERE id = $1 AND empresa_id = $2
       FOR UPDATE`,
      [id, empresaId]
    );
    const actual = filasPoliza[0];
    if (!actual) {
      await client.query('ROLLBACK');
      return null;
    }

    if (actual.estatus === 'cancelada') {
      throw new Error('VALIDATION_ERROR: No se puede cambiar el estatus de una póliza cancelada');
    }

    // No-op idempotente: ya está en el estatus pedido, no se vuelve a
    // aplicar/revertir (evita doble afectación si se dispara dos veces).
    if (actual.estatus === estatusDestino) {
      await client.query('ROLLBACK');
      return obtenerPolizaPorId(id, empresaId);
    }
    if (estatusDestino === 'aplicada' && actual.estatus !== 'borrador') {
      throw new Error('VALIDATION_ERROR: Solo se puede aplicar una póliza que esté en borrador');
    }
    if (estatusDestino === 'borrador' && actual.estatus !== 'aplicada') {
      throw new Error('VALIDATION_ERROR: Solo se puede desaplicar una póliza que esté aplicada');
    }

    const { rows: filasMovimiento } = await client.query<{
      cuenta_id: string;
      concepto_id: string | null;
      cargo: string;
      abono: string;
      uuid_cfdi: string | null;
      rfc: string | null;
    }>(
      `SELECT cuenta_id, concepto_id, cargo, abono, uuid_cfdi, rfc
       FROM contabilidad.polizas_detalle
       WHERE poliza_id = $1 AND empresa_id = $2
       ORDER BY renglon ASC`,
      [id, empresaId]
    );
    const movimientos: PolizaMovimientoInput[] = filasMovimiento.map((m) => ({
      cuenta_id: Number(m.cuenta_id),
      concepto_id: m.concepto_id != null ? Number(m.concepto_id) : null,
      cargo: Number(m.cargo),
      abono: Number(m.abono),
      uuid_cfdi: m.uuid_cfdi,
      rfc: m.rfc,
    }));

    const ejercicio = Number(actual.ejercicio);
    const periodo = Number(actual.periodo);

    if (estatusDestino === 'aplicada') {
      if (movimientos.length === 0) {
        throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza sin movimientos.');
      }
      movimientos.forEach(validarMovimiento);
      if (movimientos.length < 2) {
        throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza con menos de dos movimientos.');
      }
      const { totalCargos, totalAbonos } = calcularTotales(movimientos);
      if (Math.abs(totalCargos - totalAbonos) > 0.005) {
        throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza descuadrada.');
      }
      if (totalCargos <= 0) {
        throw new Error('VALIDATION_ERROR: No se puede aplicar una póliza con el total en cero.');
      }
      await validarCuentasYConceptos(empresaId, movimientos, 'aplicar');

      // Recalcular el encabezado desde los movimientos reales antes de
      // aplicar, sin confiar en lo que ya tuviera guardado.
      await client.query(
        `UPDATE contabilidad.polizas
         SET total_cargos = $1, total_abonos = $2, estatus = 'aplicada', actualizado_en = now()
         WHERE id = $3 AND empresa_id = $4`,
        [totalCargos, totalAbonos, id, empresaId]
      );
      await aplicarSaldos(client, empresaId, ejercicio, periodo, movimientos);
    } else {
      await revertirSaldos(client, empresaId, ejercicio, periodo, movimientos);
      await client.query(
        `UPDATE contabilidad.polizas SET estatus = 'borrador', actualizado_en = now() WHERE id = $1 AND empresa_id = $2`,
        [id, empresaId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return obtenerPolizaPorId(id, empresaId);
}

export interface ResultadoLotePoliza {
  id: number;
  numero: number | null;
  tipo: string | null;
  ok: boolean;
  omitida: boolean;
  estatus: string | null;
  message: string;
  detalles?: Array<{ renglon: number; cuenta_id: number; cuenta: string | null; motivo: string }>;
}

export interface ResumenLotePolizas {
  procesadas: number;
  exitosas: number;
  omitidas: number;
  fallidas: number;
}

function mensajeLegibleDeError(error: unknown, fallback: string): string {
  const message = (error as Error)?.message ?? fallback;
  return message.startsWith('VALIDATION_ERROR:') ? message.replace('VALIDATION_ERROR:', '').trim() : message;
}

// Aplicar/desaplicar en lote: CADA póliza se procesa de forma independiente
// (su propia llamada a cambiarEstatusPoliza, con su propia transacción
// interna) para que un resultado parcial sea posible — no hay una
// transacción global que aborte todo el lote si una póliza falla. Reutiliza
// tal cual la lógica/reglas de cambiarEstatusPoliza; esta función solo
// orquesta la iteración y clasifica cada resultado como exitosa/omitida/
// fallida para el resumen.
export async function cambiarEstatusPolizasLote(
  empresaId: number,
  ids: number[],
  estatusDestino: 'aplicada' | 'borrador'
): Promise<{ resultados: ResultadoLotePoliza[]; resumen: ResumenLotePolizas }> {
  const idsUnicos = [...new Set(ids.map((id) => Number(id)))];
  const resultados: ResultadoLotePoliza[] = [];

  for (const id of idsUnicos) {
    const actual = await obtenerPolizaPorId(id, empresaId);
    if (!actual) {
      resultados.push({
        id,
        numero: null,
        tipo: null,
        ok: false,
        omitida: false,
        estatus: null,
        message: 'Póliza no encontrada',
      });
      continue;
    }

    // Ya está en el estatus pedido: se reporta como omitida, sin volver a
    // llamar cambiarEstatusPoliza (evita el viaje redondo de un no-op).
    if (actual.estatus === estatusDestino) {
      resultados.push({
        id,
        numero: actual.numero,
        tipo: actual.tipo_poliza_identificador,
        ok: true,
        omitida: true,
        estatus: actual.estatus,
        message: estatusDestino === 'aplicada' ? 'La póliza ya estaba aplicada' : 'La póliza ya estaba en borrador',
      });
      continue;
    }

    try {
      const poliza = await cambiarEstatusPoliza(id, empresaId, estatusDestino);
      resultados.push({
        id,
        numero: poliza?.numero ?? actual.numero,
        tipo: poliza?.tipo_poliza_identificador ?? actual.tipo_poliza_identificador,
        ok: true,
        omitida: false,
        estatus: poliza?.estatus ?? estatusDestino,
        message: estatusDestino === 'aplicada' ? 'Póliza aplicada correctamente.' : 'Póliza desaplicada correctamente.',
      });
    } catch (err) {
      const fallback =
        estatusDestino === 'aplicada' ? 'No se pudo aplicar la póliza' : 'No se pudo desaplicar la póliza';
      resultados.push({
        id,
        numero: actual.numero,
        tipo: actual.tipo_poliza_identificador,
        ok: false,
        omitida: false,
        estatus: actual.estatus,
        message: mensajeLegibleDeError(err, fallback),
        detalles: err instanceof PolizaValidacionError ? err.detalles : undefined,
      });
    }
  }

  const resumen: ResumenLotePolizas = {
    procesadas: resultados.length,
    exitosas: resultados.filter((r) => r.ok && !r.omitida).length,
    omitidas: resultados.filter((r) => r.omitida).length,
    fallidas: resultados.filter((r) => !r.ok).length,
  };

  return { resultados, resumen };
}

export async function calcularSiguienteNumero(
  empresaId: number,
  tipoPolizaId: number,
  fecha: string
): Promise<{ numero: number; ejercicio: number; periodo: number }> {
  const tipo = await obtenerTipoPolizaOFallar(empresaId, tipoPolizaId);
  const { ejercicio, periodo } = derivarEjercicioPeriodo(fecha);
  const numero = await obtenerSiguienteNumero(
    pool,
    empresaId,
    tipoPolizaId,
    ejercicio,
    periodo,
    tipo.poliza_inicial
  );
  return { numero, ejercicio, periodo };
}

// clienteExterno opcional: cuando el llamador ya está dentro de su propia
// transacción SQL (p. ej. la cancelación de un documento que debe generar su
// póliza reversa de forma atómica), se reutiliza esa misma conexión/cliente
// en vez de abrir una segunda con pool.connect(). Abrir una segunda conexión
// mientras la primera sigue retenida es justo el patrón que puede colgar el
// proceso bajo carga: si el pool no tiene una conexión libre, ese segundo
// pool.connect() espera indefinidamente (no hay connectionTimeoutMillis
// configurado) a que la propia transacción exterior —que nunca va a soltar
// su conexión hasta que esto termine— libere una. Con clienteExterno no se
// pide ninguna conexión adicional, así que ese escenario ya no puede darse.
// El llamador es responsable del BEGIN/COMMIT/ROLLBACK y de liberar
// clienteExterno; esta función solo maneja su propia transacción cuando abre
// su propia conexión (llamada "suelta", como hasta ahora).
export async function crearPolizaConMovimientos(
  empresaId: number,
  input: PolizaEncabezadoInput,
  usuarioId: number | null,
  clienteExterno?: PoolClient
): Promise<PolizaEncabezado> {
  if (!input.tipo_poliza_id) {
    throw new Error('VALIDATION_ERROR: El tipo de póliza es requerido');
  }
  const tipo = await obtenerTipoPolizaOFallar(empresaId, input.tipo_poliza_id);

  const { ejercicio, periodo } = derivarEjercicioPeriodo(input.fecha);
  const { totalCargos, totalAbonos } = calcularTotales(input.movimientos ?? []);
  validarEncabezadoYMovimientos(input, totalCargos, totalAbonos);
  await validarCuentasYConceptos(empresaId, input.movimientos);

  const esClientePropio = !clienteExterno;
  const client = clienteExterno ?? (await pool.connect());
  let polizaId: number | null = null;
  try {
    if (esClientePropio) await client.query('BEGIN');

    let poliza: { id: number } | null = null;
    const maxIntentos = 2;
    for (let intento = 1; intento <= maxIntentos; intento++) {
      const numero = await obtenerSiguienteNumero(
        client,
        empresaId,
        input.tipo_poliza_id,
        ejercicio,
        periodo,
        tipo.poliza_inicial
      );

      try {
        const insertResult = await client.query(
          `INSERT INTO contabilidad.polizas
             (empresa_id, tipo_poliza_id, ejercicio, periodo, numero, fecha, estatus,
              referencia, observaciones, total_cargos, total_abonos, creada_por_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id`,
          [
            empresaId,
            input.tipo_poliza_id,
            ejercicio,
            periodo,
            numero,
            input.fecha,
            input.estatus,
            input.referencia?.trim() || null,
            input.observaciones?.trim() || null,
            totalCargos,
            totalAbonos,
            usuarioId,
          ]
        );
        poliza = insertResult.rows[0];
        break;
      } catch (err: any) {
        // 23505 = unique_violation: otra transacción tomó el mismo número
        // entre nuestro SELECT MAX y el INSERT. Se reintenta una vez
        // recalculando el siguiente número dentro de la misma transacción.
        if (err?.code === '23505' && intento < maxIntentos) {
          continue;
        }
        throw err;
      }
    }

    if (!poliza) {
      throw new Error('No se pudo crear el encabezado de la póliza');
    }
    const polizaCreada = poliza;

    for (let i = 0; i < input.movimientos.length; i++) {
      const mov = input.movimientos[i];
      await client.query(
        `INSERT INTO contabilidad.polizas_detalle
           (empresa_id, poliza_id, renglon, cuenta_id, concepto_id, concepto_texto, cargo, abono, uuid_cfdi, rfc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          empresaId,
          polizaCreada.id,
          i + 1,
          mov.cuenta_id,
          mov.concepto_id ?? null,
          mov.concepto_texto?.trim() || null,
          Number(mov.cargo ?? 0),
          Number(mov.abono ?? 0),
          mov.uuid_cfdi?.trim() || null,
          mov.rfc?.trim() || null,
        ]
      );
    }

    // Si se guarda directamente como 'aplicada' (botón "Aplicar" del
    // formulario, no solo el ícono de la grilla), debe afectar saldos igual
    // que cambiarEstatusPoliza: aplicada siempre implica saldos afectados,
    // sin importar por qué endpoint se haya llegado a ese estatus.
    if (input.estatus === 'aplicada') {
      await aplicarSaldos(client, empresaId, ejercicio, periodo, input.movimientos);
    }

    polizaId = polizaCreada.id;
    if (esClientePropio) await client.query('COMMIT');
  } catch (err) {
    if (esClientePropio) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (esClientePropio) client.release();
  }

  // Con clienteExterno, la póliza recién insertada todavía no tiene COMMIT:
  // hay que releerla con ese mismo client para poder verla (otra conexión,
  // vía pool, todavía la vería como si no existiera).
  return (await obtenerPolizaPorId(polizaId as number, empresaId, clienteExterno)) as PolizaEncabezado;
}

export async function actualizarPolizaConMovimientos(
  polizaId: number,
  empresaId: number,
  input: PolizaEncabezadoInput,
  usuarioId: number | null
): Promise<PolizaEncabezado | null> {
  const actual = await obtenerPolizaPorId(polizaId, empresaId);
  if (!actual) return null;

  if (actual.estatus === 'cancelada') {
    throw new Error('VALIDATION_ERROR: No se puede editar una póliza cancelada');
  }
  // Una póliza aplicada ya afectó saldos; editarla sin pasar por
  // desaplicar/aplicar dejaría los saldos desincronizados de los
  // movimientos. Debe desaplicarse primero (cambiarEstatusPoliza).
  if (actual.estatus === 'aplicada') {
    throw new Error('VALIDATION_ERROR: No se puede editar una póliza aplicada. Primero debe desaplicarse.');
  }
  if (!input.tipo_poliza_id || input.tipo_poliza_id !== actual.tipo_poliza_id) {
    throw new Error('VALIDATION_ERROR: No se puede cambiar el tipo de póliza en esta fase');
  }

  const { ejercicio, periodo } = derivarEjercicioPeriodo(input.fecha);
  if (ejercicio !== actual.ejercicio || periodo !== actual.periodo) {
    throw new Error('VALIDATION_ERROR: No se puede mover la póliza a otro ejercicio o periodo en esta fase');
  }

  const { totalCargos, totalAbonos } = calcularTotales(input.movimientos ?? []);
  validarEncabezadoYMovimientos(input, totalCargos, totalAbonos);
  await validarCuentasYConceptos(empresaId, input.movimientos);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-verifica el estatus bajo lock dentro de la misma transacción que va
    // a mutar movimientos (y saldos, si aplica): cierra la ventana de
    // carrera entre la lectura inicial de arriba y una aplicación
    // concurrente disparada desde la grilla.
    const { rows: filasLock } = await client.query<{ estatus: string }>(
      `SELECT estatus FROM contabilidad.polizas WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [polizaId, empresaId]
    );
    if (filasLock[0]?.estatus === 'aplicada') {
      throw new Error('VALIDATION_ERROR: No se puede editar una póliza aplicada. Primero debe desaplicarse.');
    }

    await client.query(
      `UPDATE contabilidad.polizas
         SET fecha = $1, estatus = $2, referencia = $3, observaciones = $4,
             total_cargos = $5, total_abonos = $6, modificada_por_id = $7, actualizado_en = now()
       WHERE id = $8 AND empresa_id = $9`,
      [
        input.fecha,
        input.estatus,
        input.referencia?.trim() || null,
        input.observaciones?.trim() || null,
        totalCargos,
        totalAbonos,
        usuarioId,
        polizaId,
        empresaId,
      ]
    );

    await client.query(`DELETE FROM contabilidad.polizas_detalle WHERE poliza_id = $1 AND empresa_id = $2`, [
      polizaId,
      empresaId,
    ]);

    for (let i = 0; i < input.movimientos.length; i++) {
      const mov = input.movimientos[i];
      await client.query(
        `INSERT INTO contabilidad.polizas_detalle
           (empresa_id, poliza_id, renglon, cuenta_id, concepto_id, concepto_texto, cargo, abono, uuid_cfdi, rfc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          empresaId,
          polizaId,
          i + 1,
          mov.cuenta_id,
          mov.concepto_id ?? null,
          mov.concepto_texto?.trim() || null,
          Number(mov.cargo ?? 0),
          Number(mov.abono ?? 0),
          mov.uuid_cfdi?.trim() || null,
          mov.rfc?.trim() || null,
        ]
      );
    }

    // Guardar directamente como 'aplicada' (botón "Aplicar" del formulario
    // sobre una póliza en borrador) debe afectar saldos igual que
    // cambiarEstatusPoliza; la edición ya está bloqueada arriba si la
    // póliza YA estaba aplicada, así que esta transición solo puede ser
    // borrador -> aplicada.
    if (input.estatus === 'aplicada') {
      await aplicarSaldos(client, empresaId, ejercicio, periodo, input.movimientos);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return obtenerPolizaPorId(polizaId, empresaId);
}
