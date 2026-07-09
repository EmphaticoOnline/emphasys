import pool from '../../config/database';
import { obtenerOCrearConfiguracion } from './configuracion.repository';
import { validarCodigoAgrupadorSat } from './codigosAgrupadores.repository';

export interface Cuenta {
  id: number;
  empresa_id: number;
  cuenta: string;
  descripcion: string;
  rango_cuenta_id: number | null;
  afectable: boolean;
  cuenta_padre_id: number | null;
  nivel: number;
  subgrupo: string | null;
  codigo_agrupador_sat: string | null;
  rubro_presupuesto: string | null;
  no_considerar_presupuesto: boolean;
  observaciones: string | null;
  activa: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type CuentaEdicionInput = {
  descripcion: string;
  codigo_agrupador_sat?: string | null;
  observaciones?: string | null;
  activa?: boolean;
};

export type CuentaNuevaInput = {
  cuenta: string;
  descripcion: string;
  codigo_agrupador_sat?: string | null;
  observaciones?: string | null;
  activa?: boolean;
  // Descripciones para las cuentas ancestro que no existen todavía (todas
  // menos la cuenta final, que usa el campo `descripcion` de arriba).
  descripciones_faltantes?: Record<string, string>;
};

export interface NivelCuentaInfo {
  cuenta: string;
  nivel: number;
  existe: boolean;
  id: number | null;
  requiere_descripcion: boolean;
  es_cuenta_final: boolean;
}

export async function listarCuentas(empresaId: number, opts: { incluirInactivas?: boolean } = {}): Promise<Cuenta[]> {
  const condiciones = ['empresa_id = $1'];
  if (!opts.incluirInactivas) condiciones.push('activa = true');
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM contabilidad.cuentas WHERE ${condiciones.join(' AND ')} ORDER BY cuenta`,
    [empresaId]
  );
  return rows;
}

export async function obtenerCuentaPorId(id: number, empresaId: number): Promise<Cuenta | null> {
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM contabilidad.cuentas WHERE id = $1 AND empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] ?? null;
}

export interface CuentaAfectable {
  id: number;
  cuenta: string;
  descripcion: string;
}

// Para selectores de captura de movimientos: solo cuentas activas y
// afectables (hoja, sin subcuentas) pueden recibir cargos/abonos.
export async function listarCuentasAfectables(empresaId: number, buscar?: string): Promise<CuentaAfectable[]> {
  const condiciones = ['empresa_id = $1', 'activa = true', 'afectable = true'];
  const params: Array<string | number> = [empresaId];
  if (buscar?.trim()) {
    params.push(`%${buscar.trim()}%`);
    condiciones.push(`(cuenta ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
  }
  const { rows } = await pool.query<CuentaAfectable>(
    `SELECT id, cuenta, descripcion FROM contabilidad.cuentas WHERE ${condiciones.join(' AND ')} ORDER BY cuenta LIMIT 200`,
    params
  );
  // cuentas.id es bigserial: node-pg lo regresa como string aunque
  // CuentaAfectable.id sea number. Sin este cast, el frontend termina
  // comparando "42" (de aquí) contra 42 (number, ej. de movimientos ya
  // cargados de una póliza) y la comparación estricta falla en silencio.
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function degradarPadreSiAfectable(client: import('pg').PoolClient, cuentaPadreId: number, empresaId: number): Promise<void> {
  await client.query(
    `UPDATE contabilidad.cuentas SET afectable = false, actualizado_en = now()
     WHERE id = $1 AND empresa_id = $2 AND afectable = true`,
    [cuentaPadreId, empresaId]
  );
}

// Desactivar una cuenta debe arrastrar a todos sus descendientes (hijos,
// nietos, etc.), nunca al revés: reactivar una cuenta NO reactiva a sus
// hijos, porque pudieron haberse desactivado de forma independiente y
// reactivarlos por accidente sería incorrecto. Solo se llama cuando la
// cuenta pasa de activa=true a activa=false.
async function desactivarDescendientes(client: import('pg').PoolClient, cuentaId: number, empresaId: number): Promise<void> {
  await client.query(
    `WITH RECURSIVE descendientes AS (
       SELECT id FROM contabilidad.cuentas WHERE cuenta_padre_id = $1 AND empresa_id = $2
       UNION ALL
       SELECT c.id FROM contabilidad.cuentas c
       JOIN descendientes d ON c.cuenta_padre_id = d.id
       WHERE c.empresa_id = $2
     )
     UPDATE contabilidad.cuentas SET activa = false, actualizado_en = now()
     WHERE id IN (SELECT id FROM descendientes)`,
    [cuentaId, empresaId]
  );
}

// Una cuenta con movimientos no puede convertirse en cuenta padre: hacerlo
// dejaría de ser afectable y rompería la consistencia histórica de pólizas.
async function tieneMovimientos(cuentaId: number): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.polizas_detalle WHERE cuenta_id = $1`,
    [cuentaId]
  );
  return Number(rows[0].count) > 0;
}

async function listarCuentasPorCodigos(empresaId: number, codigos: string[]): Promise<Map<string, Cuenta>> {
  if (codigos.length === 0) return new Map();
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM contabilidad.cuentas WHERE empresa_id = $1 AND cuenta = ANY($2::varchar[])`,
    [empresaId, codigos]
  );
  const map = new Map<string, Cuenta>();
  rows.forEach((row) => map.set(row.cuenta, row));
  return map;
}

// contabilidad.rangos_cuentas.id es la llave técnica (bigint); el límite
// superior funcional del rango vive en limite_superior. Se busca el primer
// rango cuyo limite_superior sea mayor o igual al primer segmento de la
// cuenta y se asigna su id técnico a cuentas.rango_cuenta_id. Si no hay
// rangos capturados o ninguno aplica, regresa null sin bloquear la creación.
async function calcularRangoCuentaId(empresaId: number, primerSegmento: number): Promise<number | null> {
  if (!Number.isFinite(primerSegmento)) return null;
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM contabilidad.rangos_cuentas
     WHERE empresa_id = $1 AND limite_superior >= $2
     ORDER BY limite_superior ASC
     LIMIT 1`,
    [empresaId, primerSegmento]
  );
  return rows[0]?.id ?? null;
}

// contabilidad.rangos_cuentas.naturaleza_saldo es NOT NULL con
// CHECK IN ('D','A') a nivel de base de datos: si el rango existe, su
// naturaleza YA está garantizada válida. La única forma real de que una
// cuenta activa se quede sin naturaleza resoluble es que rango_cuenta_id
// sea NULL (o, más raro, que apunte a un rango que ya no exista). Esta
// función es el único punto donde se resuelve "naturaleza contable de una
// cuenta a partir de su rango", para no repetir el criterio en cada sitio
// que necesita validarlo (crear, editar, cambiar estado).
export async function obtenerNaturalezaRango(empresaId: number, rangoCuentaId: number | null): Promise<'D' | 'A' | null> {
  if (rangoCuentaId == null) return null;
  const { rows } = await pool.query<{ naturaleza_saldo: string }>(
    `SELECT naturaleza_saldo FROM contabilidad.rangos_cuentas WHERE empresa_id = $1 AND id = $2`,
    [empresaId, rangoCuentaId]
  );
  const naturaleza = rows[0]?.naturaleza_saldo;
  return naturaleza === 'D' || naturaleza === 'A' ? naturaleza : null;
}

const MENSAJE_SIN_NATURALEZA =
  'No se puede guardar la cuenta porque no tiene una naturaleza contable válida. Revise los rangos de cuentas.';

// estructura_cuentas siempre usa guion como notación propia de longitudes de
// segmento (ej. "3-4-3"), independientemente del caracter_separador
// configurado para el número de cuenta visible.
function parseEstructuraCuentas(estructuraCuentas: string): number[] {
  const segmentos = estructuraCuentas.split('-').map(Number);
  if (segmentos.length === 0 || segmentos.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error('VALIDATION_ERROR: La configuración de estructura de cuentas es inválida');
  }
  return segmentos;
}

// El usuario captura solo dígitos corridos (o pega una cuenta ya separada);
// aquí se descarta cualquier carácter que no sea dígito, incluyendo el propio
// caracter_separador si es un espacio, punto, guion, etc.
function limpiarCuentaInput(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

// Formatea una cadena de dígitos según las longitudes de segmento,
// insertando el caracter_separador configurado entre cada segmento completo.
function aplicarMascaraCuenta(digitos: string, segmentLengths: number[], caracterSeparador: string): string {
  const partes: string[] = [];
  let cursor = 0;
  for (const len of segmentLengths) {
    if (cursor >= digitos.length) break;
    partes.push(digitos.slice(cursor, cursor + len));
    cursor += len;
  }
  return partes.join(caracterSeparador);
}

// Determina si la cantidad de dígitos capturada cae exactamente en un límite
// de segmento válido (ej. 3, 7 o 10 dígitos para la estructura "3-4-3") y, de
// ser así, regresa la cadena jerárquica ya formateada con el separador
// configurado (nivel 1, nivel 1+2, ..., nivel final). Si la cantidad de
// dígitos queda a la mitad de un segmento o excede la capacidad total,
// regresa null (cuenta inválida contra la estructura configurada).
function calcularNivelesPorDigitos(digitos: string, segmentLengths: number[], caracterSeparador: string): string[] | null {
  if (!digitos) return null;
  const niveles: string[] = [];
  let cursor = 0;
  for (const len of segmentLengths) {
    cursor += len;
    if (cursor > digitos.length) return null;
    niveles.push(aplicarMascaraCuenta(digitos.slice(0, cursor), segmentLengths, caracterSeparador));
    if (cursor === digitos.length) return niveles;
  }
  return null;
}

export async function analizarCuentaNueva(
  empresaId: number,
  cuentaCapturada: string
): Promise<{ nivel: number; niveles: NivelCuentaInfo[]; naturaleza_saldo: 'D' | 'A' | null }> {
  const configuracion = await obtenerOCrearConfiguracion(empresaId);
  const segmentLengths = parseEstructuraCuentas(configuracion.estructura_cuentas);
  const digitos = limpiarCuentaInput(cuentaCapturada);
  const codigosNiveles = calcularNivelesPorDigitos(digitos, segmentLengths, configuracion.caracter_separador);
  if (!codigosNiveles) {
    throw new Error(
      `VALIDATION_ERROR: La cuenta no coincide con la estructura configurada (${configuracion.estructura_cuentas})`
    );
  }

  const existentes = await listarCuentasPorCodigos(empresaId, codigosNiveles);

  const niveles: NivelCuentaInfo[] = codigosNiveles.map((codigo, index) => {
    const existente = existentes.get(codigo);
    const esFinal = index === codigosNiveles.length - 1;
    return {
      cuenta: codigo,
      nivel: index + 1,
      existe: Boolean(existente),
      id: existente?.id ?? null,
      requiere_descripcion: !existente,
      es_cuenta_final: esFinal,
    };
  });

  // Previsualización de la naturaleza que resultaría al crear: mismo cálculo
  // que crearCuentaJerarquica (primer segmento -> rango -> naturaleza), para
  // que el formulario pueda advertir ANTES de guardar si la cuenta quedaría
  // sin naturaleza resoluble.
  const primerSegmento = Number(digitos.slice(0, segmentLengths[0]));
  const rangoCuentaId = await calcularRangoCuentaId(empresaId, primerSegmento);
  const naturalezaSaldo = await obtenerNaturalezaRango(empresaId, rangoCuentaId);

  return { nivel: codigosNiveles.length, niveles, naturaleza_saldo: naturalezaSaldo };
}

export async function crearCuentaJerarquica(empresaId: number, input: CuentaNuevaInput): Promise<Cuenta> {
  if (!input.cuenta) {
    throw new Error('VALIDATION_ERROR: El número de cuenta es requerido');
  }
  if (!input.descripcion?.trim()) {
    throw new Error('VALIDATION_ERROR: La descripción es requerida');
  }

  const codigoAgrupadorSat = input.codigo_agrupador_sat?.trim() || null;
  if (codigoAgrupadorSat) {
    await validarCodigoAgrupadorSat(codigoAgrupadorSat);
  }

  const configuracion = await obtenerOCrearConfiguracion(empresaId);
  const segmentLengths = parseEstructuraCuentas(configuracion.estructura_cuentas);
  const digitos = limpiarCuentaInput(input.cuenta);
  const codigosNiveles = calcularNivelesPorDigitos(digitos, segmentLengths, configuracion.caracter_separador);
  if (!codigosNiveles) {
    throw new Error(
      `VALIDATION_ERROR: La cuenta no coincide con la estructura configurada (${configuracion.estructura_cuentas})`
    );
  }

  const existentesMap = await listarCuentasPorCodigos(empresaId, codigosNiveles);

  const cuentaFinal = codigosNiveles[codigosNiveles.length - 1];
  if (existentesMap.has(cuentaFinal)) {
    throw new Error('VALIDATION_ERROR: La cuenta contable ya existe.');
  }

  // El rango se calcula una sola vez: todos los niveles de esta cadena
  // comparten el mismo primer segmento, así que comparten el mismo rango.
  const primerSegmento = Number(digitos.slice(0, segmentLengths[0]));
  const rangoCuentaId = await calcularRangoCuentaId(empresaId, primerSegmento);

  // Toda cuenta nueva se crea activa (no hay forma de crearla inactiva
  // desde este flujo) y la cuenta final del nivel es siempre afectable, así
  // que si no hay rango que cubra este primer segmento, ninguna cuenta de
  // esta cadena tendría naturaleza resoluble. Se rechaza aquí, antes de
  // tocar la base de datos, en vez de crear la cuenta con rango_cuenta_id
  // NULL en silencio (como hacía antes).
  if (rangoCuentaId == null) {
    throw new Error(`VALIDATION_ERROR: ${MENSAJE_SIN_NATURALEZA}`);
  }

  const descripcionesFaltantes = input.descripciones_faltantes ?? {};
  for (let i = 0; i < codigosNiveles.length - 1; i++) {
    const codigo = codigosNiveles[i];
    if (!existentesMap.has(codigo) && !descripcionesFaltantes[codigo]?.trim()) {
      throw new Error(`VALIDATION_ERROR: Falta la descripción de la cuenta ${codigo}`);
    }
  }

  // Antes de crear nada: cualquier cuenta EXISTENTE que esté a punto de
  // recibir un hijo nuevo en esta operación no debe tener movimientos. Se
  // valida por completo antes de tocar la base de datos para que, si falla,
  // no quede ninguna cuenta creada a medias.
  for (let i = 0; i < codigosNiveles.length - 1; i++) {
    const actual = existentesMap.get(codigosNiveles[i]);
    const siguienteYaExiste = existentesMap.has(codigosNiveles[i + 1]);
    if (actual && !siguienteYaExiste && (await tieneMovimientos(actual.id))) {
      throw new Error(
        'VALIDATION_ERROR: No se puede crear una subcuenta porque la cuenta padre ya tiene movimientos contables.'
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let padreId: number | null = null;
    let cuentaCreada: Cuenta | null = null;

    for (let i = 0; i < codigosNiveles.length; i++) {
      const codigo = codigosNiveles[i];
      const nivel = i + 1;
      const esFinal = i === codigosNiveles.length - 1;
      const existente = existentesMap.get(codigo);

      if (existente) {
        if (!esFinal) {
          await degradarPadreSiAfectable(client, existente.id, empresaId);
        }
        padreId = existente.id;
        continue;
      }

      const descripcion = esFinal ? input.descripcion.trim() : descripcionesFaltantes[codigo].trim();
      // afectable = true solo si la cuenta no tiene hijos, no si alcanza el
      // último nivel teórico de la estructura. Dentro de esta misma
      // operación, la única cuenta nueva sin hijos es la final; todas las
      // intermedias nuevas reciben como hijo el siguiente nivel (existente o
      // recién creado), así que quedan en false.
      const afectable = esFinal;
      const padreDeEstaFila: number | null = padreId;

      const valoresInsert: Array<string | number | boolean | null> = [
        empresaId,
        codigo,
        descripcion,
        padreDeEstaFila,
        nivel,
        afectable,
        rangoCuentaId,
        null,
        esFinal ? codigoAgrupadorSat : null,
        null,
        true,
        esFinal ? input.observaciones?.trim() || null : null,
        esFinal ? input.activa ?? true : true,
      ];

      const resultadoInsert: { rows: Cuenta[] } = await client.query<Cuenta>(
        `INSERT INTO contabilidad.cuentas
           (empresa_id, cuenta, descripcion, cuenta_padre_id, nivel, afectable,
            rango_cuenta_id, subgrupo, codigo_agrupador_sat, rubro_presupuesto,
            no_considerar_presupuesto, observaciones, activa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        valoresInsert
      );

      const filaCreada: Cuenta = resultadoInsert.rows[0];

      if (padreDeEstaFila != null) {
        await degradarPadreSiAfectable(client, padreDeEstaFila, empresaId);
      }

      padreId = filaCreada.id;
      cuentaCreada = filaCreada;
    }

    await client.query('COMMIT');
    return cuentaCreada as Cuenta;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarCuenta(id: number, empresaId: number, input: CuentaEdicionInput): Promise<Cuenta | null> {
  const actual = await obtenerCuentaPorId(id, empresaId);
  if (!actual) return null;

  if (!input.descripcion?.trim()) {
    throw new Error('VALIDATION_ERROR: La descripción es requerida');
  }

  const codigoAgrupadorSat = input.codigo_agrupador_sat?.trim() || null;
  if (codigoAgrupadorSat) {
    await validarCodigoAgrupadorSat(codigoAgrupadorSat);
  }

  const nuevaActiva = input.activa ?? actual.activa;
  // Cascada solo en la transición true -> false: si ya estaba inactiva y se
  // vuelve a guardar como inactiva, no se toca a los hijos (pudieron haberse
  // reactivado manualmente después de la desactivación original).
  const seDesactiva = actual.activa && !nuevaActiva;

  // La edición nunca recalcula rango_cuenta_id (ver comentario más abajo),
  // pero si la cuenta va a quedar/permanecer activa, su naturaleza sí debe
  // ser resoluble en ese momento: cubre tanto cuentas legadas que ya tenían
  // rango_cuenta_id NULL desde antes de este endurecimiento, como una
  // reactivación (activa: false -> true) de una cuenta cuyo rango fue
  // borrado o dejó de existir. Aplica a cualquier cuenta activa, no solo
  // afectables: las agrupadoras también necesitan naturaleza resoluble
  // (los reportes de saldos y el catálogo de e-contabilidad ya la usan para
  // TODA cuenta activa, no solo para las hojas).
  if (nuevaActiva) {
    const naturaleza = await obtenerNaturalezaRango(empresaId, actual.rango_cuenta_id);
    if (!naturaleza) {
      throw new Error(`VALIDATION_ERROR: ${MENSAJE_SIN_NATURALEZA}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // afectable, rango_cuenta_id y nivel/cuenta_padre_id son calculados y solo
    // se fijan al crear la cuenta; la edición no permite tocarlos.
    const { rows } = await client.query<Cuenta>(
      `UPDATE contabilidad.cuentas
         SET descripcion = $1, codigo_agrupador_sat = $2, observaciones = $3, activa = $4, actualizado_en = now()
       WHERE id = $5 AND empresa_id = $6
       RETURNING *`,
      [
        input.descripcion.trim(),
        codigoAgrupadorSat,
        input.observaciones?.trim() || null,
        nuevaActiva,
        id,
        empresaId,
      ]
    );

    if (seDesactiva) {
      await desactivarDescendientes(client, id, empresaId);
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cambiarEstadoCuenta(id: number, empresaId: number, activa: boolean): Promise<Cuenta | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: filasActuales } = await client.query<{ activa: boolean; rango_cuenta_id: number | null }>(
      `SELECT activa, rango_cuenta_id FROM contabilidad.cuentas WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const actual = filasActuales[0];
    if (!actual) {
      await client.query('ROLLBACK');
      return null;
    }
    const seDesactiva = actual.activa && !activa;

    // Misma regla que actualizarCuenta: no se puede dejar/activar una
    // cuenta sin naturaleza contable resoluble. Cubre en particular
    // reactivar (activa: false -> true) una cuenta cuyo rango ya no exista.
    if (activa) {
      const naturaleza = await obtenerNaturalezaRango(empresaId, actual.rango_cuenta_id);
      if (!naturaleza) {
        throw new Error(`VALIDATION_ERROR: ${MENSAJE_SIN_NATURALEZA}`);
      }
    }

    const { rows } = await client.query<Cuenta>(
      `UPDATE contabilidad.cuentas SET activa = $1, actualizado_en = now() WHERE id = $2 AND empresa_id = $3 RETURNING *`,
      [activa, id, empresaId]
    );

    if (seDesactiva) {
      await desactivarDescendientes(client, id, empresaId);
    }

    await client.query('COMMIT');
    return rows[0] ?? null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Eliminación física, sin cascada: solo procede si la cuenta no tiene
// subcuentas, movimientos en pólizas ni saldos mensuales registrados.
export async function eliminarCuenta(id: number, empresaId: number): Promise<boolean | null> {
  const actual = await obtenerCuentaPorId(id, empresaId);
  if (!actual) return null;

  const hijosResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.cuentas WHERE cuenta_padre_id = $1`,
    [id]
  );
  if (Number(hijosResult.rows[0].count) > 0) {
    throw new Error('VALIDATION_ERROR: No se puede eliminar la cuenta porque tiene subcuentas.');
  }

  const movimientosResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.polizas_detalle WHERE cuenta_id = $1`,
    [id]
  );
  if (Number(movimientosResult.rows[0].count) > 0) {
    throw new Error('VALIDATION_ERROR: No se puede eliminar la cuenta porque tiene movimientos contables.');
  }

  const saldosResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.cuentas_saldos_mensuales WHERE cuenta_id = $1`,
    [id]
  );
  if (Number(saldosResult.rows[0].count) > 0) {
    throw new Error('VALIDATION_ERROR: No se puede eliminar la cuenta porque tiene saldos mensuales registrados.');
  }

  await pool.query(`DELETE FROM contabilidad.cuentas WHERE id = $1 AND empresa_id = $2`, [id, empresaId]);
  return true;
}

// ---------------------------------------------------------------------------
// Actualización rápida de código agrupador SAT (Fase 3 de e-contabilidad):
// a diferencia de actualizarCuenta, no exige descripción ni toca
// observaciones/activa — sirve para la pantalla de asignación masiva, donde
// solo se corrige codigo_agrupador_sat sin abrir el formulario completo.
// ---------------------------------------------------------------------------

export async function actualizarCodigoAgrupadorSatCuenta(
  id: number,
  empresaId: number,
  codigoAgrupadorSatInput: string | null
): Promise<Cuenta | null> {
  const codigoAgrupadorSat = codigoAgrupadorSatInput?.trim() || null;
  if (codigoAgrupadorSat) {
    await validarCodigoAgrupadorSat(codigoAgrupadorSat);
  }

  const { rows } = await pool.query<Cuenta>(
    `UPDATE contabilidad.cuentas
       SET codigo_agrupador_sat = $1, actualizado_en = now()
     WHERE id = $2 AND empresa_id = $3
     RETURNING *`,
    [codigoAgrupadorSat, id, empresaId]
  );
  return rows[0] ?? null;
}

export interface ItemCodigoAgrupadorSatLote {
  cuenta_id: number;
  codigo_agrupador_sat: string | null;
}

export interface ErrorLoteCodigoAgrupadorSat {
  cuenta_id: number;
  motivo: string;
}

export interface ResultadoLoteCodigoAgrupadorSat {
  actualizadas: number;
  errores: ErrorLoteCodigoAgrupadorSat[];
}

function mensajeLegibleDeErrorCodigoAgrupador(error: unknown): string {
  const message = (error as Error)?.message ?? 'No se pudo actualizar la cuenta';
  return message.startsWith('VALIDATION_ERROR:') ? message.replace('VALIDATION_ERROR:', '').trim() : message;
}

// Cada cuenta se procesa de forma independiente (sin transacción global) para
// que un error puntual (código inválido en una fila) no descarte el resto
// del lote: mismo criterio que cambiarEstatusPolizasLote en
// polizas.repository.ts.
export async function actualizarCodigosAgrupadoresSatLote(
  empresaId: number,
  items: ItemCodigoAgrupadorSatLote[]
): Promise<ResultadoLoteCodigoAgrupadorSat> {
  const errores: ErrorLoteCodigoAgrupadorSat[] = [];
  let actualizadas = 0;

  for (const item of items) {
    const cuentaId = Number(item.cuenta_id);
    try {
      const cuenta = await actualizarCodigoAgrupadorSatCuenta(cuentaId, empresaId, item.codigo_agrupador_sat);
      if (!cuenta) {
        errores.push({ cuenta_id: cuentaId, motivo: 'La cuenta no existe en esta empresa' });
        continue;
      }
      actualizadas += 1;
    } catch (err) {
      errores.push({ cuenta_id: cuentaId, motivo: mensajeLegibleDeErrorCodigoAgrupador(err) });
    }
  }

  return { actualizadas, errores };
}
