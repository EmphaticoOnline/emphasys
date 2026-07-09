import pool from '../../config/database';
import { obtenerCuentaPorId, obtenerNaturalezaRango } from './cuentas.repository';

// ---------------------------------------------------------------------------
// Fase 5 de e-contabilidad: saldos iniciales/de apertura por cuenta y
// ejercicio (contabilidad.cuentas_saldos_iniciales). Nunca toca
// contabilidad.cuentas_saldos_mensuales ni genera pólizas de apertura: es
// exclusivamente la captura del dato.
//
// ── Convención de signo: DOS capas, cada una con su propio criterio ────────
//
// 1) ALMACENAMIENTO (columna cuentas_saldos_iniciales.saldo_inicial):
//    firmado, positivo = deudor, negativo = acreedor, independiente de la
//    naturaleza propia de la cuenta (igual que en una balanza de
//    comprobación tradicional). Esta es la convención de la tabla y NO
//    cambió: ver migración 20260713_create_contabilidad_saldos_iniciales.sql.
//
// 2) API / PANTALLA DE CAPTURA (SaldoInicialCuenta.saldo_inicial,
//    ItemSaldoInicialLote.saldo_inicial): "saldo normal" de la cuenta,
//    positivo cuando el saldo está del lado esperado según SU naturaleza,
//    negativo solo cuando está al revés de lo esperado. Es el mismo
//    criterio de presentación que ya usan todos los reportes del módulo
//    (Saldos por mes/año, Balanza Analítica, Balance General).
//
// ¿Por qué dos capas? Un usuario capturando saldos iniciales piensa en
// "cuánto debe Proveedores" (un número positivo), no en si tiene que
// teclearlo en negativo porque la cuenta es acreedora. Pedirle que aplique
// ese criterio a mano es una fuente real de error de captura (justo el bug
// que motivó este comentario). Por eso la conversión firmado↔normal ocurre
// UNA VEZ en la frontera de esta API (aquí, en listarSaldosIniciales /
// actualizarSaldoInicialCuenta) y el usuario nunca necesita pensar en el
// signo "de base de datos". La tabla sigue guardando el criterio firmado
// original, así que los reportes (saldos.repository.ts,
// reportesContables.repository.ts) siguen leyendo el mismo dato de
// siempre y aplican SU PROPIA conversión, en su propia frontera, sobre el
// valor ya acumulado hacia cuentas padre (ver obtenerSaldosInicialesPorCuenta
// más abajo). Ninguna de las dos conversiones depende de la otra: no hay
// doble inversión.
// ---------------------------------------------------------------------------

export interface SaldoInicialCuenta {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  naturaleza_saldo: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
  saldo_inicial: number;
  observaciones: string | null;
  origen: string | null;
  estado: 'capturado' | 'sin_capturar';
  tiene_polizas_aplicadas_ejercicio: boolean;
}

const NATURALEZA_DESCRIPCION: Record<'D' | 'A', string> = { D: 'Deudora', A: 'Acreedora' };

// Convierte el saldo FIRMADO (como se guarda en la tabla: positivo=deudor,
// negativo=acreedor) al "saldo normal" de la cuenta (positivo=lado
// esperado según su naturaleza). Deudora: ambos criterios coinciden.
// Acreedora: hay que invertir el signo. Ejemplo: Proveedores (naturaleza A)
// guardado en -80000 (saldo acreedor real) se presenta como +80000 (su
// saldo "normal").
export function saldoFirmadoASaldoNormal(naturaleza: string, saldoFirmado: number): number {
  return naturaleza === 'A' ? -saldoFirmado : saldoFirmado;
}

// Inversa exacta de la anterior (la fórmula es su propia inversa: aplicarla
// dos veces regresa el valor original), nombrada aparte para que cada sitio
// que la usa documente en qué dirección está convirtiendo. Se usa al
// GUARDAR: el usuario captura "saldo normal" y esto lo transforma al
// criterio firmado que exige la columna.
export function saldoNormalASaldoFirmado(naturaleza: string, saldoNormal: number): number {
  return naturaleza === 'A' ? -saldoNormal : saldoNormal;
}

export async function listarSaldosIniciales(empresaId: number, ejercicio: number): Promise<SaldoInicialCuenta[]> {
  const { rows } = await pool.query(
    `SELECT
       c.id, c.cuenta, c.descripcion, r.naturaleza_saldo,
       si.saldo_inicial, si.observaciones, si.origen,
       (si.cuenta_id IS NOT NULL) AS capturado,
       EXISTS (
         SELECT 1
         FROM contabilidad.polizas_detalle pd
         JOIN contabilidad.polizas p ON p.id = pd.poliza_id
         WHERE pd.cuenta_id = c.id AND p.empresa_id = c.empresa_id
           AND p.ejercicio = $2 AND p.estatus = 'aplicada'
       ) AS tiene_polizas_aplicadas_ejercicio
     FROM contabilidad.cuentas c
     LEFT JOIN contabilidad.rangos_cuentas r
       ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     LEFT JOIN contabilidad.cuentas_saldos_iniciales si
       ON si.empresa_id = c.empresa_id AND si.ejercicio = $2 AND si.cuenta_id = c.id
     WHERE c.empresa_id = $1 AND c.afectable = true AND c.activa = true
     ORDER BY c.cuenta`,
    [empresaId, ejercicio]
  );

  return rows.map((r) => {
    const naturaleza: 'D' | 'A' | null = r.naturaleza_saldo === 'D' || r.naturaleza_saldo === 'A' ? r.naturaleza_saldo : null;
    // Se presenta en "saldo normal", no en el firmado crudo de la columna
    // (ver comentario de convención al inicio del archivo). Si la cuenta no
    // tiene naturaleza resoluble (caso raro, cuenta inconsistente), se
    // muestra el valor firmado tal cual: no hay criterio de naturaleza con
    // el cual convertirlo.
    const saldoFirmado = r.capturado ? Number(r.saldo_inicial) : 0;
    const saldoNormal = naturaleza ? saldoFirmadoASaldoNormal(naturaleza, saldoFirmado) : saldoFirmado;
    return {
      cuenta_id: Number(r.id),
      cuenta: r.cuenta,
      descripcion: r.descripcion,
      naturaleza_saldo: naturaleza,
      naturaleza_descripcion: naturaleza ? NATURALEZA_DESCRIPCION[naturaleza] : null,
      saldo_inicial: saldoNormal,
      observaciones: r.observaciones ?? null,
      origen: r.origen ?? null,
      estado: r.capturado ? 'capturado' : 'sin_capturar',
      tiene_polizas_aplicadas_ejercicio: Boolean(r.tiene_polizas_aplicadas_ejercicio),
    };
  });
}

// Cadena de ancestros por cuenta (ella misma + todos sus padres vía
// cuenta_padre_id), mismo patrón que obtenerCadenaCuentas en
// polizas.repository.ts para propagar cargos/abonos hacia cuentas
// agrupadoras. No se reutiliza esa función directamente (no está
// exportada, y vive en un módulo que no le corresponde a saldos
// iniciales), pero es la misma idea aplicada aquí.
async function obtenerCadenaAncestros(empresaId: number, cuentaIds: number[]): Promise<Map<number, number[]>> {
  const cadenaPorCuenta = new Map<number, number[]>();
  if (cuentaIds.length === 0) return cadenaPorCuenta;

  const { rows } = await pool.query<{ cuenta_origen: string; cuenta_ancestro: string }>(
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

// Usada por saldos.repository.ts y reportesContables.repository.ts para
// integrar el saldo inicial histórico en Saldos por mes/año, Balanza
// Analítica y Balance General.
//
// Regresa el saldo FIRMADO (positivo=deudor, negativo=acreedor tal como se
// guarda en la tabla) YA ACUMULADO hacia las cuentas padre: la captura solo
// existe en cuentas afectables (hojas, sin subcuentas), pero al consultar
// una cuenta agrupadora (ej. "102" o "102 0001") el saldo inicial debe
// reflejar la suma de sus hijas, igual que ya ocurre con cargos/abonos de
// pólizas aplicadas (ver aplicarSaldos/obtenerCadenaCuentas en
// polizas.repository.ts). La conversión a "saldo normal" (criterio de
// naturaleza) sigue siendo responsabilidad de quien consume el mapa —ver
// saldoFirmadoASaldoNormal— y como todas las cuentas de una misma cadena
// jerárquica comparten siempre el mismo rango/naturaleza (se calcula una
// sola vez a partir del primer segmento del número de cuenta, ver
// calcularRangoCuentaId en cuentas.repository.ts), acumular en firmado y
// convertir después con la naturaleza de CADA cuenta da el mismo resultado
// que acumular ya convertido: no hay inconsistencia posible ahí.
export async function obtenerSaldosInicialesPorCuenta(empresaId: number, ejercicio: number): Promise<Map<number, number>> {
  const { rows } = await pool.query<{ cuenta_id: number; saldo_inicial: string }>(
    `SELECT cuenta_id, saldo_inicial FROM contabilidad.cuentas_saldos_iniciales
     WHERE empresa_id = $1 AND ejercicio = $2`,
    [empresaId, ejercicio]
  );
  if (rows.length === 0) return new Map();

  const cuentaIds = rows.map((r) => Number(r.cuenta_id));
  const cadenaPorCuenta = await obtenerCadenaAncestros(empresaId, cuentaIds);

  const acumulado = new Map<number, number>();
  for (const row of rows) {
    const cuentaId = Number(row.cuenta_id);
    const saldo = Number(row.saldo_inicial);
    const cuentasAfectadas = cadenaPorCuenta.get(cuentaId) ?? [cuentaId];
    for (const cuentaAfectada of cuentasAfectadas) {
      acumulado.set(cuentaAfectada, (acumulado.get(cuentaAfectada) ?? 0) + saldo);
    }
  }
  return acumulado;
}

export interface ItemSaldoInicialLote {
  cuenta_id: number;
  saldo_inicial: number | null;
  observaciones?: string | null;
}

export interface ErrorLoteSaldoInicial {
  cuenta_id: number;
  motivo: string;
}

export interface ResultadoLoteSaldosIniciales {
  actualizadas: number;
  errores: ErrorLoteSaldoInicial[];
}

// Convención elegida para saldo_inicial null/vacío en el payload:
//   - saldo_inicial === null  -> ELIMINA el registro (vuelve a "sin
//     capturar"/asumido en cero). Es la forma de "limpiar" un valor ya
//     guardado.
//   - saldo_inicial es un número (incluido 0) -> UPSERT con ese valor.
//     Un 0 explícito SÍ se guarda (queda como "capturado", distinto de
//     "sin_capturar"), porque contablemente "confirmé que el saldo de
//     arranque es cero" no es lo mismo que "no se ha revisado esta cuenta".
//
// El valor que llega en `item.saldo_inicial` es "saldo normal" (lo que
// capturó el usuario, positivo = lado esperado de la cuenta): se convierte
// a firmado con saldoNormalASaldoFirmado antes de guardar, usando la
// naturaleza ya resuelta arriba para las demás validaciones.
async function actualizarSaldoInicialCuenta(
  empresaId: number,
  ejercicio: number,
  item: ItemSaldoInicialLote,
  usuarioId: number | null
): Promise<void> {
  const cuentaId = Number(item.cuenta_id);
  const cuenta = await obtenerCuentaPorId(cuentaId, empresaId);
  if (!cuenta) {
    throw new Error('VALIDATION_ERROR: La cuenta no existe en esta empresa.');
  }
  if (!cuenta.afectable) {
    throw new Error('VALIDATION_ERROR: Solo se puede capturar saldo inicial en cuentas afectables.');
  }
  if (!cuenta.activa) {
    throw new Error('VALIDATION_ERROR: La cuenta no está activa.');
  }
  const naturaleza = await obtenerNaturalezaRango(empresaId, cuenta.rango_cuenta_id);
  if (!naturaleza) {
    throw new Error('VALIDATION_ERROR: La cuenta no tiene una naturaleza contable válida. Revise los rangos de cuentas.');
  }
  if (!Number.isInteger(ejercicio) || ejercicio < 2000) {
    throw new Error('VALIDATION_ERROR: El ejercicio no es válido.');
  }

  if (item.saldo_inicial == null) {
    await pool.query(
      `DELETE FROM contabilidad.cuentas_saldos_iniciales WHERE empresa_id = $1 AND ejercicio = $2 AND cuenta_id = $3`,
      [empresaId, ejercicio, cuentaId]
    );
    return;
  }

  const saldoNormal = Number(item.saldo_inicial);
  if (!Number.isFinite(saldoNormal)) {
    throw new Error('VALIDATION_ERROR: El saldo inicial debe ser un número.');
  }
  const saldoFirmado = saldoNormalASaldoFirmado(naturaleza, saldoNormal);

  await pool.query(
    `INSERT INTO contabilidad.cuentas_saldos_iniciales
       (empresa_id, ejercicio, cuenta_id, saldo_inicial, observaciones, origen, creado_por, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, 'manual', $6, $6)
     ON CONFLICT (empresa_id, ejercicio, cuenta_id) DO UPDATE SET
       saldo_inicial = EXCLUDED.saldo_inicial,
       observaciones = EXCLUDED.observaciones,
       actualizado_por = EXCLUDED.actualizado_por,
       actualizado_en = now()`,
    [empresaId, ejercicio, cuentaId, Math.round(saldoFirmado * 100) / 100, item.observaciones?.trim() || null, usuarioId]
  );
}

function mensajeLegibleDeError(error: unknown): string {
  const message = (error as Error)?.message ?? 'No se pudo actualizar el saldo inicial';
  return message.startsWith('VALIDATION_ERROR:') ? message.replace('VALIDATION_ERROR:', '').trim() : message;
}

// Cada cuenta se procesa de forma independiente (mismo criterio que
// actualizarCodigosAgrupadoresSatLote en cuentas.repository.ts): un error
// puntual no descarta el resto del lote.
export async function actualizarSaldosInicialesLote(
  empresaId: number,
  ejercicio: number,
  items: ItemSaldoInicialLote[],
  usuarioId: number | null
): Promise<ResultadoLoteSaldosIniciales> {
  const errores: ErrorLoteSaldoInicial[] = [];
  let actualizadas = 0;

  for (const item of items) {
    const cuentaId = Number(item.cuenta_id);
    try {
      await actualizarSaldoInicialCuenta(empresaId, ejercicio, item, usuarioId);
      actualizadas += 1;
    } catch (err) {
      errores.push({ cuenta_id: cuentaId, motivo: mensajeLegibleDeError(err) });
    }
  }

  return { actualizadas, errores };
}
