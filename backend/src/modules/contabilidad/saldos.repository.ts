import pool from '../../config/database';
import { obtenerSaldosInicialesPorCuenta, saldoFirmadoASaldoNormal } from './saldosIniciales.repository';

export const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface CuentaSaldoMes {
  id: number;
  cuenta: string;
  descripcion: string;
  nivel: number;
  afectable: boolean;
  rango_cuenta_id: number | null;
  naturaleza_saldo: string;
  saldo_inicial: number;
  cargos: number;
  abonos: number;
  saldo_final: number;
}

export interface SaldoAnioMes {
  periodo: number;
  nombre_mes: string;
  cargos: number;
  abonos: number;
  saldo: number;
}

export interface SaldoAnioResultado {
  cuenta: string;
  descripcion: string;
  ejercicio: number;
  meses: SaldoAnioMes[];
  totales: { cargos: number; abonos: number; saldo_final: number };
}

export interface AuxiliarMovimiento {
  poliza_id: number;
  poliza_numero: number;
  referencia: string | null;
  tipo_poliza: string;
  renglon: number;
  fecha: string;
  concepto: string | null;
  cargo: number;
  abono: number;
}

export interface AuxiliarCuentaResultado {
  cuenta: { id: number; cuenta: string; descripcion: string };
  ejercicio: number;
  periodo: number;
  resumen: { cargos: number; abonos: number; numero_movimientos: number };
  movimientos: AuxiliarMovimiento[];
}

// Deudora: los cargos aumentan el saldo, los abonos lo disminuyen.
// Acreedora: los abonos aumentan el saldo, los cargos lo disminuyen.
// Exportada porque reportesContables.repository.ts (balanza analítica, estado
// de resultados, balance general) aplica el mismo criterio de naturaleza.
export function aplicarNaturaleza(naturaleza: string, base: number, cargos: number, abonos: number): number {
  return naturaleza === 'A' ? base - cargos + abonos : base + cargos - abonos;
}

// La conversión de saldo inicial FIRMADO (como se guarda en la tabla) a
// saldo "naturaleza-relativo" (lo que espera `aplicarNaturaleza` como
// `base`) vive en saldosIniciales.repository.ts -> saldoFirmadoASaldoNormal
// (mismo criterio, un solo lugar: esa es la fuente de verdad de "cómo se
// guarda y cómo se interpreta el signo" del saldo inicial). Se re-exporta
// aquí solo por conveniencia de quien ya importa aplicarNaturaleza de este
// archivo.
export { saldoFirmadoASaldoNormal } from './saldosIniciales.repository';

export async function listarEjerciciosDisponibles(empresaId: number): Promise<number[]> {
  const { rows } = await pool.query<{ ejercicio: number }>(
    `SELECT DISTINCT ejercicio FROM (
       SELECT ejercicio FROM contabilidad.polizas WHERE empresa_id = $1
       UNION
       SELECT ejercicio FROM contabilidad.cuentas_saldos_mensuales WHERE empresa_id = $1
     ) t
     ORDER BY ejercicio DESC`,
    [empresaId]
  );
  if (rows.length === 0) {
    return [new Date().getFullYear()];
  }
  return rows.map((row) => row.ejercicio);
}

export async function listarCuentasConSaldoMes(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<CuentaSaldoMes[]> {
  const [{ rows }, saldosIniciales] = await Promise.all([
    pool.query(
    `WITH previos AS (
       SELECT cuenta_id, SUM(cargos) AS cargos, SUM(abonos) AS abonos
       FROM contabilidad.cuentas_saldos_mensuales
       WHERE empresa_id = $1 AND ejercicio = $2 AND periodo < $3
       GROUP BY cuenta_id
     ),
     actual AS (
       SELECT cuenta_id, cargos, abonos
       FROM contabilidad.cuentas_saldos_mensuales
       WHERE empresa_id = $1 AND ejercicio = $2 AND periodo = $3
     )
     SELECT
       c.id,
       c.cuenta,
       c.descripcion,
       c.nivel,
       c.afectable,
       c.rango_cuenta_id,
       r.naturaleza_saldo,
       COALESCE(p.cargos, 0) AS cargos_previos,
       COALESCE(p.abonos, 0) AS abonos_previos,
       COALESCE(a.cargos, 0) AS cargos,
       COALESCE(a.abonos, 0) AS abonos
     FROM contabilidad.cuentas c
     LEFT JOIN contabilidad.rangos_cuentas r
       ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     LEFT JOIN previos p ON p.cuenta_id = c.id
     LEFT JOIN actual a ON a.cuenta_id = c.id
     WHERE c.empresa_id = $1 AND c.activa = true
     ORDER BY c.cuenta`,
      [empresaId, ejercicio, periodo]
    ),
    obtenerSaldosInicialesPorCuenta(empresaId, ejercicio),
  ]);

  return rows.map((row) => {
    // Si la cuenta no tiene rango/naturaleza asignada todavía, se asume
    // deudora solo para no romper la vista de saldos; en datos consistentes
    // esto no debería pasar, ya que toda cuenta final calcula su rango al
    // crearse (ver cuentas.repository.ts -> calcularRangoCuentaId).
    const naturaleza: string = row.naturaleza_saldo ?? 'D';
    const cargosPrevios = Number(row.cargos_previos);
    const abonosPrevios = Number(row.abonos_previos);
    const cargos = Number(row.cargos);
    const abonos = Number(row.abonos);

    // Base del ejercicio: saldo inicial histórico (si se capturó, Fase 5 de
    // e-contabilidad) convertido al criterio naturaleza-relativo, más los
    // movimientos de los periodos anteriores al que se está consultando.
    const baseInicial = saldoFirmadoASaldoNormal(naturaleza, saldosIniciales.get(Number(row.id)) ?? 0);
    const saldoInicial = aplicarNaturaleza(naturaleza, baseInicial, cargosPrevios, abonosPrevios);
    const saldoFinal = aplicarNaturaleza(naturaleza, saldoInicial, cargos, abonos);

    return {
      id: row.id,
      cuenta: row.cuenta,
      descripcion: row.descripcion,
      nivel: row.nivel,
      afectable: row.afectable,
      rango_cuenta_id: row.rango_cuenta_id,
      naturaleza_saldo: naturaleza,
      saldo_inicial: saldoInicial,
      cargos,
      abonos,
      saldo_final: saldoFinal,
    };
  });
}

export async function obtenerSaldosAnio(
  cuentaId: number,
  empresaId: number,
  ejercicio: number
): Promise<SaldoAnioResultado | null> {
  const cuentaResult = await pool.query(
    `SELECT c.cuenta, c.descripcion, r.naturaleza_saldo
     FROM contabilidad.cuentas c
     LEFT JOIN contabilidad.rangos_cuentas r ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     WHERE c.id = $1 AND c.empresa_id = $2`,
    [cuentaId, empresaId]
  );
  const cuenta = cuentaResult.rows[0];
  if (!cuenta) return null;

  // Mismo criterio que listarCuentasConSaldoMes: sin rango asignado, se
  // asume deudora solo para no romper la vista.
  const naturaleza: string = cuenta.naturaleza_saldo ?? 'D';

  const [movimientosResult, saldosIniciales] = await Promise.all([
    pool.query<{ periodo: number; cargos: string; abonos: string }>(
      `SELECT periodo, cargos, abonos FROM contabilidad.cuentas_saldos_mensuales
       WHERE empresa_id = $1 AND cuenta_id = $2 AND ejercicio = $3`,
      [empresaId, cuentaId, ejercicio]
    ),
    obtenerSaldosInicialesPorCuenta(empresaId, ejercicio),
  ]);
  const movimientosPorPeriodo = new Map<number, { cargos: number; abonos: number }>();
  movimientosResult.rows.forEach((row) => {
    movimientosPorPeriodo.set(row.periodo, { cargos: Number(row.cargos), abonos: Number(row.abonos) });
  });

  let cargosAcumulados = 0;
  let abonosAcumulados = 0;
  // Arranca en el saldo inicial histórico del ejercicio (si se capturó,
  // Fase 5 de e-contabilidad) en vez de 0, ya convertido al criterio
  // naturaleza-relativo; ver saldoFirmadoASaldoNormal.
  let saldoAcumulado = saldoFirmadoASaldoNormal(naturaleza, saldosIniciales.get(cuentaId) ?? 0);
  const meses: SaldoAnioMes[] = [];

  for (let periodo = 1; periodo <= 12; periodo++) {
    const mov = movimientosPorPeriodo.get(periodo) ?? { cargos: 0, abonos: 0 };
    cargosAcumulados += mov.cargos;
    abonosAcumulados += mov.abonos;
    saldoAcumulado = aplicarNaturaleza(naturaleza, saldoAcumulado, mov.cargos, mov.abonos);
    meses.push({
      periodo,
      nombre_mes: NOMBRES_MESES[periodo - 1],
      cargos: mov.cargos,
      abonos: mov.abonos,
      saldo: saldoAcumulado,
    });
  }

  return {
    cuenta: cuenta.cuenta,
    descripcion: cuenta.descripcion,
    ejercicio,
    meses,
    totales: {
      cargos: cargosAcumulados,
      abonos: abonosAcumulados,
      saldo_final: saldoAcumulado,
    },
  };
}

// Auxiliar contable: detalle de los movimientos de pólizas APLICADAS que
// integran cargos/abonos de una cuenta afectable en un ejercicio+periodo.
// A diferencia de listarCuentasConSaldoMes (que lee el acumulado ya
// guardado en cuentas_saldos_mensuales), este consulta directamente
// polizas/polizas_detalle: cuentas_saldos_mensuales sirve para el saldo
// agregado, el auxiliar tiene que explicar de qué movimientos viene.
// Solo se implementa para cuentas afectables; las agrupadoras necesitarían
// traer movimientos de todas sus cuentas hijas (fase futura).
export async function obtenerAuxiliarCuenta(
  empresaId: number,
  cuentaId: number,
  ejercicio: number,
  periodo: number
): Promise<AuxiliarCuentaResultado | null> {
  const cuentaResult = await pool.query<{ id: number; cuenta: string; descripcion: string; afectable: boolean }>(
    `SELECT id, cuenta, descripcion, afectable FROM contabilidad.cuentas WHERE id = $1 AND empresa_id = $2`,
    [cuentaId, empresaId]
  );
  const cuenta = cuentaResult.rows[0];
  if (!cuenta) return null;

  if (!cuenta.afectable) {
    throw new Error('VALIDATION_ERROR: Solo se pueden consultar auxiliares de cuentas afectables');
  }

  const { rows } = await pool.query(
    `SELECT
       p.id AS poliza_id, p.numero AS poliza_numero, p.referencia,
       tp.identificador AS tipo_poliza,
       pd.renglon, to_char(p.fecha, 'YYYY-MM-DD') AS fecha,
       co.nombre_concepto AS concepto,
       pd.cargo, pd.abono
     FROM contabilidad.polizas_detalle pd
     JOIN contabilidad.polizas p ON p.id = pd.poliza_id
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     LEFT JOIN public.conceptos co ON co.id = pd.concepto_id
     WHERE pd.empresa_id = $1
       AND pd.cuenta_id = $2
       AND p.empresa_id = $1
       AND p.ejercicio = $3
       AND p.periodo = $4
       AND p.estatus = 'aplicada'
     ORDER BY p.fecha ASC, p.numero ASC, pd.renglon ASC`,
    [empresaId, cuentaId, ejercicio, periodo]
  );

  const movimientos: AuxiliarMovimiento[] = rows.map((row: any) => ({
    poliza_id: Number(row.poliza_id),
    poliza_numero: Number(row.poliza_numero),
    referencia: row.referencia,
    tipo_poliza: row.tipo_poliza,
    renglon: Number(row.renglon),
    fecha: row.fecha,
    concepto: row.concepto ?? null,
    cargo: Number(row.cargo),
    abono: Number(row.abono),
  }));

  const cargos = movimientos.reduce((acc, m) => acc + m.cargo, 0);
  const abonos = movimientos.reduce((acc, m) => acc + m.abono, 0);

  return {
    cuenta: { id: Number(cuenta.id), cuenta: cuenta.cuenta, descripcion: cuenta.descripcion },
    ejercicio,
    periodo,
    resumen: {
      cargos: Math.round(cargos * 100) / 100,
      abonos: Math.round(abonos * 100) / 100,
      numero_movimientos: movimientos.length,
    },
    movimientos,
  };
}
