import pool from '../../config/database';
import { aplicarNaturaleza } from './saldos.repository';
import { obtenerSaldosInicialesPorCuenta, saldoFirmadoASaldoNormal } from './saldosIniciales.repository';

const GRUPOS_ACTIVO = ['Activo Circulante', 'Activo Fijo', 'Activo Diferido'];
const GRUPOS_PASIVO = ['Pasivo Corto Plazo', 'Pasivo Largo Plazo', 'Pasivo Diferido'];
const GRUPOS_CAPITAL = ['Capital Contable'];

// Avisa (sin bloquear el reporte) si hay cuentas afectables activas sin rango
// asignado: quedan fuera de Estado de Resultados/Balance General (no se
// pueden clasificar en Ingresos/Egresos/Activo/Pasivo/Capital) y en Balanza
// Analítica se calculan asumiendo naturaleza Deudora.
async function advertirCuentasSinRango(empresaId: number): Promise<void> {
  const { rows } = await pool.query<{ cuenta: string }>(
    `SELECT cuenta FROM contabilidad.cuentas
     WHERE empresa_id = $1 AND activa = true AND afectable = true AND rango_cuenta_id IS NULL
     ORDER BY cuenta LIMIT 20`,
    [empresaId]
  );
  if (rows.length > 0) {
    console.warn(
      `[reportesContables] ${rows.length} cuenta(s) afectable(s) sin rango asignado, quedan fuera de la clasificación de reportes: ${rows.map((r) => r.cuenta).join(', ')}`
    );
  }
}

// ── Balanza Analítica ─────────────────────────────────────────────────────────

export interface BalanzaAnaliticaCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  nivel: number;
  afectable: boolean;
  naturaleza_saldo: string;
  saldo_inicial: number;
  cargos: number;
  abonos: number;
  saldo_final: number;
}

export interface BalanzaAnaliticaResultado {
  ejercicio: number;
  periodo_inicial: number;
  periodo_final: number;
  cuentas: BalanzaAnaliticaCuenta[];
  totales: { cargos: number; abonos: number };
  cuadra: boolean;
}

export async function obtenerBalanzaAnalitica(
  empresaId: number,
  ejercicio: number,
  periodoInicial: number,
  periodoFinal: number,
  opts: { mostrarCeros: boolean; soloAfectables: boolean }
): Promise<BalanzaAnaliticaResultado> {
  await advertirCuentasSinRango(empresaId);

  const [{ rows }, saldosIniciales] = await Promise.all([
    pool.query(
      `WITH previos AS (
       SELECT cuenta_id, SUM(cargos) AS cargos, SUM(abonos) AS abonos
       FROM contabilidad.cuentas_saldos_mensuales
       WHERE empresa_id = $1 AND ejercicio = $2 AND periodo < $3
       GROUP BY cuenta_id
     ),
     rango_periodo AS (
       SELECT cuenta_id, SUM(cargos) AS cargos, SUM(abonos) AS abonos
       FROM contabilidad.cuentas_saldos_mensuales
       WHERE empresa_id = $1 AND ejercicio = $2 AND periodo BETWEEN $3 AND $4
       GROUP BY cuenta_id
     )
     SELECT
       c.id, c.cuenta, c.descripcion, c.nivel, c.afectable,
       r.naturaleza_saldo,
       COALESCE(p.cargos, 0) AS cargos_previos,
       COALESCE(p.abonos, 0) AS abonos_previos,
       COALESCE(rp.cargos, 0) AS cargos,
       COALESCE(rp.abonos, 0) AS abonos
     FROM contabilidad.cuentas c
     LEFT JOIN contabilidad.rangos_cuentas r ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     LEFT JOIN previos p ON p.cuenta_id = c.id
     LEFT JOIN rango_periodo rp ON rp.cuenta_id = c.id
     WHERE c.empresa_id = $1 AND c.activa = true
     ORDER BY c.cuenta`,
      [empresaId, ejercicio, periodoInicial, periodoFinal]
    ),
    obtenerSaldosInicialesPorCuenta(empresaId, ejercicio),
  ]);

  const todas: BalanzaAnaliticaCuenta[] = rows.map((row) => {
    const naturaleza: string = row.naturaleza_saldo ?? 'D';
    const cargosPrevios = Number(row.cargos_previos);
    const abonosPrevios = Number(row.abonos_previos);
    const cargos = Number(row.cargos);
    const abonos = Number(row.abonos);
    // Base del ejercicio: saldo inicial histórico (Fase 5 de e-contabilidad,
    // si se capturó) convertido al criterio naturaleza-relativo; ver
    // saldoFirmadoASaldoNormal en saldos.repository.ts.
    const baseInicial = saldoFirmadoASaldoNormal(naturaleza, saldosIniciales.get(Number(row.id)) ?? 0);
    const saldoInicial = aplicarNaturaleza(naturaleza, baseInicial, cargosPrevios, abonosPrevios);
    const saldoFinal = aplicarNaturaleza(naturaleza, saldoInicial, cargos, abonos);
    return {
      id: row.id,
      cuenta: row.cuenta,
      descripcion: row.descripcion,
      nivel: row.nivel,
      afectable: row.afectable,
      naturaleza_saldo: naturaleza,
      saldo_inicial: saldoInicial,
      cargos,
      abonos,
      saldo_final: saldoFinal,
    };
  });

  // Los totales de cuadre se calculan SIEMPRE sobre el universo completo de
  // cuentas afectables (sin importar los filtros de visualización): cada
  // movimiento real nace en una única cuenta afectable, aunque
  // cuentas_saldos_mensuales replique el acumulado hacia las cuentas
  // agrupadoras (ver polizas.repository.ts -> obtenerCadenaCuentas). Sumar
  // todos los niveles duplicaría los importes.
  const afectablesTodas = todas.filter((c) => c.afectable);
  const totalCargos = Math.round(afectablesTodas.reduce((acc, c) => acc + c.cargos, 0) * 100) / 100;
  const totalAbonos = Math.round(afectablesTodas.reduce((acc, c) => acc + c.abonos, 0) * 100) / 100;

  let cuentas = todas;
  if (opts.soloAfectables) cuentas = cuentas.filter((c) => c.afectable);
  if (!opts.mostrarCeros) {
    cuentas = cuentas.filter(
      (c) => c.saldo_inicial !== 0 || c.cargos !== 0 || c.abonos !== 0 || c.saldo_final !== 0
    );
  }

  return {
    ejercicio,
    periodo_inicial: periodoInicial,
    periodo_final: periodoFinal,
    cuentas,
    totales: { cargos: totalCargos, abonos: totalAbonos },
    cuadra: Math.abs(totalCargos - totalAbonos) < 0.01,
  };
}

// ── Estado de Resultados ──────────────────────────────────────────────────────

export interface EstadoResultadosCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  importe: number;
}

export interface EstadoResultadosResultado {
  ejercicio: number;
  periodo_inicial: number;
  periodo_final: number;
  ingresos: EstadoResultadosCuenta[];
  egresos: EstadoResultadosCuenta[];
  total_ingresos: number;
  total_egresos: number;
  utilidad_periodo: number;
}

export async function obtenerEstadoResultados(
  empresaId: number,
  ejercicio: number,
  periodoInicial: number,
  periodoFinal: number,
  opts: { mostrarDetalle: boolean }
): Promise<EstadoResultadosResultado> {
  await advertirCuentasSinRango(empresaId);

  // Solo cuentas afectables: son las únicas donde nace un movimiento real
  // (ver nota de duplicidad en obtenerBalanzaAnalitica). Ingresos/Egresos son
  // los únicos grupos de rangos_cuentas relevantes para este reporte.
  const { rows } = await pool.query(
    `SELECT c.id, c.cuenta, c.descripcion, r.grupo,
       COALESCE(SUM(m.cargos), 0) AS cargos,
       COALESCE(SUM(m.abonos), 0) AS abonos
     FROM contabilidad.cuentas c
     JOIN contabilidad.rangos_cuentas r ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     LEFT JOIN contabilidad.cuentas_saldos_mensuales m
       ON m.empresa_id = c.empresa_id AND m.cuenta_id = c.id
       AND m.ejercicio = $2 AND m.periodo BETWEEN $3 AND $4
     WHERE c.empresa_id = $1 AND c.activa = true AND c.afectable = true
       AND r.grupo IN ('Ingresos', 'Egresos')
     GROUP BY c.id, c.cuenta, c.descripcion, r.grupo
     ORDER BY c.cuenta`,
    [empresaId, ejercicio, periodoInicial, periodoFinal]
  );

  const ingresos: EstadoResultadosCuenta[] = [];
  const egresos: EstadoResultadosCuenta[] = [];
  let totalIngresos = 0;
  let totalEgresos = 0;

  for (const row of rows) {
    const cargos = Number(row.cargos);
    const abonos = Number(row.abonos);
    if (row.grupo === 'Ingresos') {
      const importe = abonos - cargos;
      totalIngresos += importe;
      if (opts.mostrarDetalle) {
        ingresos.push({ id: row.id, cuenta: row.cuenta, descripcion: row.descripcion, importe });
      }
    } else if (row.grupo === 'Egresos') {
      const importe = cargos - abonos;
      totalEgresos += importe;
      if (opts.mostrarDetalle) {
        egresos.push({ id: row.id, cuenta: row.cuenta, descripcion: row.descripcion, importe });
      }
    }
  }

  totalIngresos = Math.round(totalIngresos * 100) / 100;
  totalEgresos = Math.round(totalEgresos * 100) / 100;

  return {
    ejercicio,
    periodo_inicial: periodoInicial,
    periodo_final: periodoFinal,
    ingresos,
    egresos,
    total_ingresos: totalIngresos,
    total_egresos: totalEgresos,
    utilidad_periodo: Math.round((totalIngresos - totalEgresos) * 100) / 100,
  };
}

// ── Balance General ────────────────────────────────────────────────────────────

export interface BalanceGeneralCuenta {
  id: number;
  cuenta: string;
  descripcion: string;
  saldo: number;
}

export interface BalanceGeneralGrupo {
  grupo: string;
  cuentas: BalanceGeneralCuenta[];
  subtotal: number;
}

export interface BalanceGeneralResultado {
  ejercicio: number;
  periodo: number;
  activo: BalanceGeneralGrupo[];
  pasivo: BalanceGeneralGrupo[];
  capital: BalanceGeneralGrupo[];
  total_activo: number;
  total_pasivo: number;
  total_capital: number;
  diferencia: number;
  cuadrado: boolean;
}

function construirGrupos(
  rows: Array<{ id: number; cuenta: string; descripcion: string; grupo: string; naturaleza_saldo: string; cargos: string | number; abonos: string | number }>,
  gruposOrden: string[],
  mostrarDetalle: boolean,
  saldosIniciales: Map<number, number>
): { grupos: BalanceGeneralGrupo[]; total: number } {
  const grupos: BalanceGeneralGrupo[] = [];
  let total = 0;

  for (const nombreGrupo of gruposOrden) {
    const filasGrupo = rows.filter((r) => r.grupo === nombreGrupo);
    if (filasGrupo.length === 0) continue;

    const cuentas: BalanceGeneralCuenta[] = [];
    let subtotal = 0;
    for (const row of filasGrupo) {
      // Base: saldo inicial histórico del ejercicio (Fase 5 de
      // e-contabilidad, si se capturó) convertido al criterio
      // naturaleza-relativo; ver saldoFirmadoASaldoNormal.
      const baseInicial = saldoFirmadoASaldoNormal(row.naturaleza_saldo, saldosIniciales.get(Number(row.id)) ?? 0);
      const saldo = aplicarNaturaleza(row.naturaleza_saldo, baseInicial, Number(row.cargos), Number(row.abonos));
      subtotal += saldo;
      if (mostrarDetalle) {
        cuentas.push({ id: row.id, cuenta: row.cuenta, descripcion: row.descripcion, saldo: Math.round(saldo * 100) / 100 });
      }
    }
    subtotal = Math.round(subtotal * 100) / 100;
    total += subtotal;
    grupos.push({ grupo: nombreGrupo, cuentas, subtotal });
  }

  return { grupos, total: Math.round(total * 100) / 100 };
}

export async function obtenerBalanceGeneral(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  opts: { mostrarDetalle: boolean }
): Promise<BalanceGeneralResultado> {
  await advertirCuentasSinRango(empresaId);

  // Acumulado desde el periodo 1 hasta el periodo seleccionado del mismo
  // ejercicio, ahora sumado sobre el saldo inicial histórico del ejercicio
  // (Fase 5 de e-contabilidad) si se capturó uno; si no hay saldo inicial
  // capturado para una cuenta, el cálculo es idéntico al de antes (arranca
  // en 0), sin regresión para empresas que no usan la funcionalidad nueva.
  const [{ rows }, saldosIniciales] = await Promise.all([
    pool.query(
      `SELECT c.id, c.cuenta, c.descripcion, r.grupo, r.naturaleza_saldo,
       COALESCE(SUM(m.cargos), 0) AS cargos,
       COALESCE(SUM(m.abonos), 0) AS abonos
     FROM contabilidad.cuentas c
     JOIN contabilidad.rangos_cuentas r ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     LEFT JOIN contabilidad.cuentas_saldos_mensuales m
       ON m.empresa_id = c.empresa_id AND m.cuenta_id = c.id
       AND m.ejercicio = $2 AND m.periodo BETWEEN 1 AND $3
     WHERE c.empresa_id = $1 AND c.activa = true AND c.afectable = true
       AND r.grupo IN (${['Activo Circulante', 'Activo Fijo', 'Activo Diferido', 'Pasivo Corto Plazo', 'Pasivo Largo Plazo', 'Pasivo Diferido', 'Capital Contable']
         .map((_, i) => `$${i + 4}`)
         .join(', ')})
     GROUP BY c.id, c.cuenta, c.descripcion, r.grupo, r.naturaleza_saldo
     ORDER BY c.cuenta`,
      [
        empresaId,
        ejercicio,
        periodo,
        ...GRUPOS_ACTIVO,
        ...GRUPOS_PASIVO,
        ...GRUPOS_CAPITAL,
      ]
    ),
    obtenerSaldosInicialesPorCuenta(empresaId, ejercicio),
  ]);

  const { grupos: activo, total: totalActivo } = construirGrupos(rows, GRUPOS_ACTIVO, opts.mostrarDetalle, saldosIniciales);
  const { grupos: pasivo, total: totalPasivo } = construirGrupos(rows, GRUPOS_PASIVO, opts.mostrarDetalle, saldosIniciales);
  const { grupos: capital, total: totalCapital } = construirGrupos(rows, GRUPOS_CAPITAL, opts.mostrarDetalle, saldosIniciales);

  const diferencia = Math.round((totalActivo - (totalPasivo + totalCapital)) * 100) / 100;

  return {
    ejercicio,
    periodo,
    activo,
    pasivo,
    capital,
    total_activo: totalActivo,
    total_pasivo: totalPasivo,
    total_capital: totalCapital,
    diferencia,
    cuadrado: Math.abs(diferencia) < 0.01,
  };
}
