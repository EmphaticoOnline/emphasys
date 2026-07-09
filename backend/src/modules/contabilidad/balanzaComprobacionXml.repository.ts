import pool from '../../config/database';
import { obtenerBalanzaAnalitica } from './reportesContables.repository';
import { obtenerSaldosInicialesPorCuenta } from './saldosIniciales.repository';

// ---------------------------------------------------------------------------
// Fase 7 de Contabilidad Electrónica: generación del XML de Balanza de
// comprobación (Anexo 24, esquema BalanzaComprobacion versión 1.3). Esta capa
// NO construye el XML (ver balanzaComprobacionXml.builder.ts); arma la fila
// por cuenta y corre las validaciones bloqueantes/de advertencia.
//
// Cuentas a incluir: el texto oficial del Anexo 24 (RMF vigente, apartado
// "B. BALANZA DE COMPROBACIÓN") dice literalmente: "La balanza de
// comprobación es el documento contable que incluye y enlista los saldos y
// movimientos de TODAS las cuentas y subcuentas de activo, pasivo, capital,
// ingresos, costos, gastos y cuentas de orden". Por eso NO se filtra por
// "solo cuentas con saldo/movimiento distinto de cero": se incluyen TODAS
// las cuentas ACTIVAS de la empresa (afectables y agrupadoras), igual que ya
// hace obtenerBalanzaAnalitica con mostrarCeros=true/soloAfectables=false.
// Las cuentas en cero no son un error: son informativas (ver advertencia
// "cuentas_incluidas_en_cero").
//
// Cálculo de SaldoIni/Debe/Haber/SaldoFin: se reutiliza tal cual
// obtenerBalanzaAnalitica (reportesContables.repository.ts) con
// periodo_inicial = periodo_final = periodo seleccionado. Esa función ya
// resuelve exactamente lo que pide esta fase: SaldoIni = saldo inicial
// histórico del ejercicio (convertido a "saldo normal" por naturaleza) +
// movimientos acumulados de periodos anteriores; Debe/Haber = cargos/abonos
// del periodo seleccionado; SaldoFin = SaldoIni + movimientos del periodo
// respetando naturaleza. No se reinventa ese cálculo aquí.
//
// Convención de signo (verificada, no asumida): el XSD permite decimales
// firmados en SaldoIni/Debe/Haber/SaldoFin (no hay restricción a positivos).
// La práctica documentada del Anexo 24 es "signo por naturaleza": el saldo
// normal de la cuenta (el esperado según si es Deudora o Acreedora) se
// reporta en positivo; si el saldo queda contrario a su naturaleza
// (situación anómala, ej. una cuenta de Activo con saldo acreedor) se
// reporta en negativo, como aviso de esa anomalía. Es EXACTAMENTE el mismo
// criterio que ya usan Balanza Analítica/Balance General/Saldos por mes en
// este ERP (aplicarNaturaleza/saldoFirmadoASaldoNormal en
// saldos.repository.ts/saldosIniciales.repository.ts), así que se reutiliza
// sin inventar una convención nueva. Debe/Haber (cargos/abonos del periodo)
// siempre son >= 0: son sumas de movimientos, no llevan signo de naturaleza.
// ---------------------------------------------------------------------------

export type TipoEnvioBalanza = 'N' | 'C';

export interface ErrorBalanzaXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaBalanzaXml {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface CuentaBalanzaXml {
  cuenta_id: number;
  num_cta: string;
  descripcion: string;
  saldo_ini: number;
  debe: number;
  haber: number;
  saldo_fin: number;
  naturaleza: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
}

export interface BalanzaComprobacionXmlResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_envio: TipoEnvioBalanza;
  fecha_modificacion: string | null;
  resumen: {
    cuentas: number;
    errores: number;
    advertencias: number;
    total_debe: number;
    total_haber: number;
    diferencia: number;
  };
  cuentas: CuentaBalanzaXml[];
  errores: ErrorBalanzaXml[];
  advertencias: AdvertenciaBalanzaXml[];
}

// Mismo patrón de validación básica de RFC que catalogoCuentasXml.repository.ts.
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

const NATURALEZA_DESCRIPCION: Record<'D' | 'A', string> = { D: 'Deudora', A: 'Acreedora' };

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export async function construirBalanzaComprobacionXml(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  tipoEnvio: TipoEnvioBalanza,
  fechaModificacion: string | null
): Promise<BalanzaComprobacionXmlResultado> {
  const errores: ErrorBalanzaXml[] = [];
  const advertencias: AdvertenciaBalanzaXml[] = [];

  // 1) Empresa: RFC y razón social.
  const empresaResult = await pool.query<{ rfc: string | null; razon_social: string | null }>(
    `SELECT rfc, razon_social FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const empresaRow = empresaResult.rows[0];
  const rfc = empresaRow?.rfc?.trim() ?? '';
  const razonSocial = empresaRow?.razon_social?.trim() ?? '';

  if (!rfc) {
    errores.push({ tipo: 'empresa_sin_rfc', motivo: 'La empresa no tiene RFC configurado.' });
  } else if (!RFC_REGEX.test(rfc)) {
    errores.push({ tipo: 'empresa_rfc_invalido', motivo: `El RFC "${rfc}" no tiene un formato válido.` });
  }

  // 2) Base de cálculo: se reutiliza el reporte de Balanza Analítica ya
  // existente y probado (mismo periodo como inicial y final), con
  // mostrarCeros=true y soloAfectables=false para obtener TODAS las cuentas
  // activas (regla oficial, ver comentario de cabecera).
  const [balanzaAnalitica, saldosIniciales, naturalezaPorCuentaRows] = await Promise.all([
    obtenerBalanzaAnalitica(empresaId, ejercicio, periodo, periodo, { mostrarCeros: true, soloAfectables: false }),
    obtenerSaldosInicialesPorCuenta(empresaId, ejercicio),
    pool.query<{ id: number; rango_cuenta_id: number | null }>(
      `SELECT c.id, c.rango_cuenta_id FROM contabilidad.cuentas c WHERE c.empresa_id = $1 AND c.activa = true`,
      [empresaId]
    ),
  ]);

  // obtenerBalanzaAnalitica asume naturaleza 'D' cuando la cuenta no tiene
  // rango asignado (para no romper ESE reporte, ver su propio comentario).
  // Para Balanza XML esto SÍ debe bloquear (validación 8/11 del pedido: no
  // se puede reportar en el XML un saldo con signo confiable si no se sabe
  // la naturaleza real). Por eso se resuelve aquí, aparte, qué cuentas
  // activas no tienen rango_cuenta_id (= sin naturaleza resoluble).
  const cuentasSinNaturaleza = new Set(
    naturalezaPorCuentaRows.rows.filter((r) => r.rango_cuenta_id == null).map((r) => Number(r.id))
  );

  // 3) Cuenta inactiva con movimiento en el periodo (validación 12): si una
  // cuenta se desactivó pero cuentas_saldos_mensuales tiene cargos/abonos
  // para este ejercicio/periodo, el XML (que solo lista cuentas activas)
  // quedaría incompleto de forma silenciosa.
  const inactivasConMovimiento = await pool.query<{ cuenta: string; descripcion: string }>(
    `SELECT c.cuenta, c.descripcion
     FROM contabilidad.cuentas_saldos_mensuales m
     JOIN contabilidad.cuentas c ON c.id = m.cuenta_id AND c.empresa_id = m.empresa_id
     WHERE m.empresa_id = $1 AND m.ejercicio = $2 AND m.periodo = $3
       AND c.activa = false AND (m.cargos <> 0 OR m.abonos <> 0)`,
    [empresaId, ejercicio, periodo]
  );
  for (const row of inactivasConMovimiento.rows) {
    errores.push({
      tipo: 'cuenta_inactiva_con_movimiento',
      cuenta: row.cuenta,
      descripcion: row.descripcion,
      motivo: 'La cuenta está inactiva pero tiene cargos/abonos registrados en este periodo; quedaría fuera de la balanza.',
    });
  }

  // 4) Saldos mensuales inexistentes cuando hay pólizas aplicadas
  // (validación 14): cuentas afectadas por una póliza aplicada en este
  // ejercicio/periodo que no tienen fila correspondiente en
  // cuentas_saldos_mensuales (indicio de que el acumulado no se recalculó).
  const faltantes = await pool.query<{ cuenta: string; descripcion: string }>(
    `WITH cuentas_con_poliza AS (
       SELECT DISTINCT pd.cuenta_id
       FROM contabilidad.polizas_detalle pd
       JOIN contabilidad.polizas p ON p.id = pd.poliza_id
       WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
     )
     SELECT c.cuenta, c.descripcion
     FROM cuentas_con_poliza cp
     JOIN contabilidad.cuentas c ON c.id = cp.cuenta_id
     WHERE NOT EXISTS (
       SELECT 1 FROM contabilidad.cuentas_saldos_mensuales m
       WHERE m.empresa_id = $1 AND m.ejercicio = $2 AND m.periodo = $3 AND m.cuenta_id = cp.cuenta_id
     )`,
    [empresaId, ejercicio, periodo]
  );
  for (const row of faltantes.rows) {
    errores.push({
      tipo: 'saldo_mensual_faltante',
      cuenta: row.cuenta,
      descripcion: row.descripcion,
      motivo: 'Existen pólizas aplicadas en este periodo para esta cuenta, pero no hay saldo mensual acumulado. Recalcule saldos.',
    });
  }

  // 5) Saldos iniciales capturados en cuentas inválidas (validación 15):
  // cuenta inactiva o no afectable con un saldo inicial capturado para este
  // ejercicio (puede ocurrir si la cuenta se desactivó después de capturar).
  const saldosInicialesInvalidos = await pool.query<{ cuenta: string; descripcion: string; activa: boolean; afectable: boolean }>(
    `SELECT c.cuenta, c.descripcion, c.activa, c.afectable
     FROM contabilidad.cuentas_saldos_iniciales si
     JOIN contabilidad.cuentas c ON c.id = si.cuenta_id AND c.empresa_id = si.empresa_id
     WHERE si.empresa_id = $1 AND si.ejercicio = $2 AND (c.activa = false OR c.afectable = false)`,
    [empresaId, ejercicio]
  );
  for (const row of saldosInicialesInvalidos.rows) {
    const motivo = !row.activa
      ? 'Tiene un saldo inicial capturado en este ejercicio, pero la cuenta está inactiva.'
      : 'Tiene un saldo inicial capturado en este ejercicio, pero la cuenta no es afectable.';
    errores.push({ tipo: 'saldo_inicial_cuenta_invalida', cuenta: row.cuenta, descripcion: row.descripcion, motivo });
  }

  // 6) Validaciones de campo por cuenta incluida + armado de la fila XML.
  const cuentasXml: CuentaBalanzaXml[] = [];
  for (const cuenta of balanzaAnalitica.cuentas) {
    if (!cuenta.cuenta?.trim()) {
      errores.push({
        tipo: 'cuenta_sin_numero',
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta activa incluida no tiene número de cuenta.',
      });
      continue;
    }

    const sinNaturaleza = cuentasSinNaturaleza.has(cuenta.id);
    if (sinNaturaleza) {
      errores.push({
        tipo: 'cuenta_sin_naturaleza',
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        motivo: 'La cuenta activa no tiene rango/naturaleza resoluble.',
      });
    }

    const naturaleza: 'D' | 'A' | null = sinNaturaleza ? null : (cuenta.naturaleza_saldo as 'D' | 'A');

    cuentasXml.push({
      cuenta_id: cuenta.id,
      num_cta: cuenta.cuenta,
      descripcion: cuenta.descripcion,
      saldo_ini: redondear(cuenta.saldo_inicial),
      debe: redondear(cuenta.cargos),
      haber: redondear(cuenta.abonos),
      saldo_fin: redondear(cuenta.saldo_final),
      naturaleza,
      naturaleza_descripcion: naturaleza ? NATURALEZA_DESCRIPCION[naturaleza] : null,
    });
  }

  // Orden final estable y repetible: número de cuenta ascendente (mismo
  // criterio que catalogoCuentasXml.repository.ts).
  cuentasXml.sort((a, b) => a.num_cta.localeCompare(b.num_cta, 'es'));

  // Duplicados de NumCta: misma revalidación barata en memoria que en
  // Catálogo XML, aunque (empresa_id, cuenta) ya sea UNIQUE en BD.
  const vistos = new Set<string>();
  for (const c of cuentasXml) {
    if (vistos.has(c.num_cta)) {
      errores.push({
        tipo: 'cuenta_numero_duplicado',
        cuenta: c.num_cta,
        descripcion: c.descripcion,
        motivo: `El número de cuenta "${c.num_cta}" está duplicado en la balanza.`,
      });
    }
    vistos.add(c.num_cta);
  }

  // 7) Diferencia entre total Debe y total Haber del periodo (validación
  // 13): se reutiliza el cuadre ya calculado por obtenerBalanzaAnalitica
  // (suma sobre cuentas AFECTABLES únicamente, para no duplicar importes
  // que también viven en las cuentas agrupadoras; ver su propio comentario).
  const totalDebe = balanzaAnalitica.totales.cargos;
  const totalHaber = balanzaAnalitica.totales.abonos;
  const diferencia = redondear(totalDebe - totalHaber);
  if (!balanzaAnalitica.cuadra) {
    errores.push({
      tipo: 'balanza_no_cuadra',
      motivo: `El total de Debe (${totalDebe.toFixed(2)}) no coincide con el total de Haber (${totalHaber.toFixed(2)}); diferencia de ${diferencia.toFixed(2)}.`,
    });
  }

  // ── Advertencias (no bloquean) ──────────────────────────────────────────

  if (saldosIniciales.size === 0) {
    advertencias.push({
      tipo: 'sin_saldos_iniciales_ejercicio',
      motivo: `No hay saldos iniciales registrados para el ejercicio ${ejercicio}.`,
    });
  } else {
    for (const cuenta of balanzaAnalitica.cuentas) {
      if (cuenta.afectable && !saldosIniciales.has(cuenta.id)) {
        advertencias.push({
          tipo: 'cuenta_sin_saldo_inicial_capturado',
          cuenta: cuenta.cuenta,
          descripcion: cuenta.descripcion,
          motivo: 'Cuenta afectable activa sin saldo inicial capturado; se asume en cero.',
        });
      }
    }
  }

  if (redondear(totalDebe + totalHaber) === 0) {
    advertencias.push({ tipo: 'sin_movimientos_periodo', motivo: `No hay movimientos registrados en el periodo ${periodo}.` });
  }

  const sinNingunaActividad = cuentasXml.every((c) => c.saldo_ini === 0 && c.debe === 0 && c.haber === 0 && c.saldo_fin === 0);
  if (cuentasXml.length > 0 && sinNingunaActividad) {
    advertencias.push({ tipo: 'balanza_sin_cuentas_con_actividad', motivo: 'Ninguna cuenta incluida tiene saldo o movimiento distinto de cero.' });
  } else {
    const enCero = cuentasXml.filter((c) => c.saldo_ini === 0 && c.debe === 0 && c.haber === 0 && c.saldo_fin === 0).length;
    if (enCero > 0) {
      advertencias.push({
        tipo: 'cuentas_incluidas_en_cero',
        motivo: `${enCero} cuenta(s) se incluyen en la balanza con saldo/movimiento en cero (regla oficial: se listan todas las cuentas activas del catálogo).`,
      });
    }
  }

  return {
    ok: errores.length === 0,
    empresa: { rfc, razon_social: razonSocial },
    ejercicio,
    periodo,
    tipo_envio: tipoEnvio,
    fecha_modificacion: tipoEnvio === 'C' ? fechaModificacion : null,
    resumen: {
      cuentas: cuentasXml.length,
      errores: errores.length,
      advertencias: advertencias.length,
      total_debe: redondear(totalDebe),
      total_haber: redondear(totalHaber),
      diferencia,
    },
    cuentas: cuentasXml,
    errores,
    advertencias,
  };
}
