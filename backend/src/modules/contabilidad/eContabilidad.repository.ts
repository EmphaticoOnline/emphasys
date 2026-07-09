import pool from '../../config/database';
import { contarCodigosAgrupadoresActivos } from './codigosAgrupadores.repository';

// ---------------------------------------------------------------------------
// Fase 1 de Contabilidad Electrónica: solo diagnóstico/validación de datos.
// No genera XML, no modifica ninguna tabla. Cada función corresponde a una
// de las 11 validaciones acordadas para esta fase.
// ---------------------------------------------------------------------------

export type NivelValidacion = 'error' | 'advertencia';

export interface SeccionValidacion {
  clave: string;
  titulo: string;
  nivel: NivelValidacion;
  total: number;
  items: Record<string, unknown>[];
}

export interface ResumenValidacion {
  errores: number;
  advertencias: number;
  cuentas_revisadas: number;
  polizas_revisadas: number;
}

export interface ValidacionEContabilidadResultado {
  ok: boolean;
  ejercicio: number;
  periodo: number;
  resumen: ResumenValidacion;
  secciones: SeccionValidacion[];
}

function seccion(
  clave: string,
  titulo: string,
  nivel: NivelValidacion,
  items: Record<string, unknown>[]
): SeccionValidacion {
  return { clave, titulo, nivel, total: items.length, items };
}

// ── 1. Cuentas afectables activas sin código agrupador SAT ─────────────────

async function validarCuentasSinCodigoAgrupador(empresaId: number): Promise<SeccionValidacion> {
  const { rows } = await pool.query(
    `SELECT id, cuenta, descripcion
     FROM contabilidad.cuentas
     WHERE empresa_id = $1 AND activa = true AND afectable = true
       AND (codigo_agrupador_sat IS NULL OR btrim(codigo_agrupador_sat) = '')
     ORDER BY cuenta`,
    [empresaId]
  );
  const items = rows.map((r) => ({
    cuenta_id: Number(r.id),
    cuenta: r.cuenta,
    descripcion: r.descripcion,
    motivo: 'Cuenta afectable activa sin código agrupador SAT',
  }));
  return seccion('cuentas_sin_codigo_agrupador', 'Cuentas sin código agrupador SAT', 'error', items);
}

// ── 2. Cuentas activas sin rango/naturaleza resoluble ───────────────────────
// Fase 4: contabilidad.rangos_cuentas.naturaleza_saldo es NOT NULL con
// CHECK IN ('D','A') a nivel de base de datos, así que "rango sin naturaleza"
// y "naturaleza inválida" son estructuralmente casi imposibles hoy (solo
// podrían darse por datos legados o una migración incompleta); se dejan
// como motivos explícitos de todas formas para no ocultar la causa real si
// algún día sí ocurren. El caso real en producción es "sin rango asignado"
// (cuentas creadas antes de que existiera un rango que cubriera su primer
// segmento) o, más raro, "rango asignado ya no existe" (borrado directo en
// base de datos, fuera de los endpoints normales, que sí lo impiden).

async function validarCuentasSinNaturaleza(empresaId: number): Promise<SeccionValidacion> {
  const { rows } = await pool.query(
    `SELECT c.id, c.cuenta, c.descripcion, c.rango_cuenta_id,
       r.id AS rango_existe, r.descripcion AS rango_descripcion, r.naturaleza_saldo
     FROM contabilidad.cuentas c
     LEFT JOIN contabilidad.rangos_cuentas r
       ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     WHERE c.empresa_id = $1 AND c.activa = true
       AND (c.rango_cuenta_id IS NULL OR r.id IS NULL OR r.naturaleza_saldo IS NULL OR r.naturaleza_saldo NOT IN ('D', 'A'))
     ORDER BY c.cuenta`,
    [empresaId]
  );
  const items = rows.map((r) => {
    let motivo: string;
    if (r.rango_cuenta_id == null) {
      motivo = 'Cuenta sin rango asignado.';
    } else if (r.rango_existe == null) {
      motivo = 'El rango asignado ya no existe.';
    } else if (r.naturaleza_saldo == null) {
      motivo = 'El rango asignado no tiene naturaleza definida.';
    } else {
      motivo = 'La naturaleza del rango asignado es inválida.';
    }
    return {
      cuenta_id: Number(r.id),
      cuenta: r.cuenta,
      descripcion: r.descripcion,
      rango_cuenta_id: r.rango_cuenta_id != null ? Number(r.rango_cuenta_id) : null,
      rango_descripcion: r.rango_descripcion ?? null,
      naturaleza_saldo: r.naturaleza_saldo ?? null,
      motivo,
    };
  });
  return seccion('cuentas_sin_naturaleza', 'Cuentas activas sin rango/naturaleza', 'error', items);
}

// ── 3. Catálogo oficial de códigos agrupadores SAT ──────────────────────────
// Fase 2: sat.codigos_agrupadores ya existe y se valida de verdad. Si el
// catálogo está vacío (todavía no se cargó la publicación oficial del SAT),
// se reporta como error único y NO se ejecuta la validación por cuenta (b):
// marcar cada cuenta como "inválida" solo porque el catálogo está vacío
// sería ruido, no información útil — la causa raíz ya quedó reportada aquí.

async function validarCatalogoAgrupadoresYCuentas(empresaId: number): Promise<SeccionValidacion[]> {
  const totalActivos = await contarCodigosAgrupadoresActivos();

  if (totalActivos === 0) {
    return [
      seccion('catalogo_agrupadores_sat_vacio', 'Catálogo de códigos agrupadores SAT vacío', 'error', [
        { motivo: 'No hay códigos agrupadores SAT cargados. No se puede validar el catálogo de cuentas.' },
      ]),
    ];
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.cuenta, c.descripcion, c.codigo_agrupador_sat, ca.activo AS agrupador_activo
     FROM contabilidad.cuentas c
     LEFT JOIN sat.codigos_agrupadores ca ON ca.codigo = c.codigo_agrupador_sat
     WHERE c.empresa_id = $1 AND c.activa = true AND c.afectable = true
       AND c.codigo_agrupador_sat IS NOT NULL AND btrim(c.codigo_agrupador_sat) <> ''
       AND (ca.id IS NULL OR ca.activo = false)
     ORDER BY c.cuenta`,
    [empresaId]
  );
  const items = rows.map((r) => ({
    cuenta_id: Number(r.id),
    cuenta: r.cuenta,
    descripcion: r.descripcion,
    codigo_agrupador_sat: r.codigo_agrupador_sat,
    motivo:
      r.agrupador_activo === false
        ? 'El código agrupador SAT está inactivo en el catálogo oficial.'
        : 'El código agrupador SAT no existe en el catálogo oficial.',
  }));
  return [
    seccion('cuentas_codigo_agrupador_invalido', 'Cuentas con código agrupador SAT inválido', 'error', items),
  ];
}

// ── 4. Pólizas aplicadas descuadradas (defensivo) ───────────────────────────

async function validarPolizasDescuadradas(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<SeccionValidacion> {
  const { rows } = await pool.query(
    `SELECT p.id, p.numero, tp.identificador AS tipo, to_char(p.fecha, 'YYYY-MM-DD') AS fecha,
       p.total_cargos, p.total_abonos,
       COALESCE(d.suma_cargo, 0) AS suma_cargo, COALESCE(d.suma_abono, 0) AS suma_abono
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     LEFT JOIN (
       SELECT poliza_id, SUM(cargo) AS suma_cargo, SUM(abono) AS suma_abono
       FROM contabilidad.polizas_detalle
       WHERE empresa_id = $1
       GROUP BY poliza_id
     ) d ON d.poliza_id = p.id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND (
         ABS(p.total_cargos - p.total_abonos) > 0.005
         OR ABS(COALESCE(d.suma_cargo, 0) - COALESCE(d.suma_abono, 0)) > 0.005
         OR ABS(p.total_cargos - COALESCE(d.suma_cargo, 0)) > 0.005
         OR ABS(p.total_abonos - COALESCE(d.suma_abono, 0)) > 0.005
       )
     ORDER BY p.numero`,
    [empresaId, ejercicio, periodo]
  );
  const items = rows.map((r) => {
    let motivo = 'Póliza aplicada descuadrada (cargos ≠ abonos)';
    if (Math.abs(Number(r.total_cargos) - Number(r.suma_cargo)) > 0.005 ||
        Math.abs(Number(r.total_abonos) - Number(r.suma_abono)) > 0.005) {
      motivo = 'Los totales del encabezado no coinciden con la suma real del detalle';
    }
    return {
      poliza_id: Number(r.id),
      tipo: r.tipo,
      numero: Number(r.numero),
      fecha: r.fecha,
      motivo,
    };
  });
  return seccion('polizas_aplicadas_descuadradas', 'Pólizas aplicadas descuadradas', 'error', items);
}

// ── 5. Pólizas aplicadas sin movimientos ────────────────────────────────────

async function validarPolizasSinMovimientos(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<SeccionValidacion> {
  const { rows } = await pool.query(
    `SELECT p.id, p.numero, tp.identificador AS tipo, to_char(p.fecha, 'YYYY-MM-DD') AS fecha
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND NOT EXISTS (SELECT 1 FROM contabilidad.polizas_detalle pd WHERE pd.poliza_id = p.id)
     ORDER BY p.numero`,
    [empresaId, ejercicio, periodo]
  );
  const items = rows.map((r) => ({
    poliza_id: Number(r.id),
    tipo: r.tipo,
    numero: Number(r.numero),
    fecha: r.fecha,
    motivo: 'Póliza aplicada sin movimientos',
  }));
  return seccion('polizas_aplicadas_sin_movimientos', 'Pólizas aplicadas sin movimientos', 'error', items);
}

// ── 6. Movimientos aplicados con cuenta inválida ────────────────────────────

async function validarMovimientosCuentaInvalida(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<SeccionValidacion> {
  const { rows } = await pool.query(
    `SELECT p.id AS poliza_id, p.numero, tp.identificador AS tipo, pd.renglon,
       pd.cuenta_id, c.cuenta, c.activa, c.afectable
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     JOIN contabilidad.polizas_detalle pd ON pd.poliza_id = p.id
     LEFT JOIN contabilidad.cuentas c ON c.id = pd.cuenta_id AND c.empresa_id = p.empresa_id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND (pd.cuenta_id IS NULL OR c.id IS NULL OR c.activa = false OR c.afectable = false)
     ORDER BY p.numero, pd.renglon`,
    [empresaId, ejercicio, periodo]
  );
  const items = rows.map((r) => {
    let motivo = 'Cuenta no existe o no pertenece a esta empresa';
    if (r.cuenta_id != null && r.cuenta != null) {
      motivo = r.activa === false ? 'Cuenta inactiva' : 'Cuenta no afectable (tiene subcuentas)';
    }
    return {
      poliza_id: Number(r.poliza_id),
      tipo: r.tipo,
      numero: Number(r.numero),
      renglon: Number(r.renglon),
      cuenta: r.cuenta ?? null,
      motivo,
    };
  });
  return seccion('movimientos_cuenta_invalida', 'Movimientos con cuenta inválida', 'error', items);
}

// ── 7, 8, 9. UUID/RFC de movimientos contra CFDI SAT descargados ───────────
// Una sola consulta (evita repetir el join tres veces): clasifica cada
// movimiento con uuid_cfdi capturado en "no encontrado", "cancelado" o
// "RFC no coincide", según lo que exista en core.cfdi_sat_comprobantes.
// El cast a texto es necesario porque polizas_detalle.uuid_cfdi es `uuid`
// nativo de Postgres y cfdi_sat_comprobantes.uuid es varchar(36).

interface FilaCfdiCruce {
  poliza_id: number;
  numero: number;
  tipo: string;
  renglon: number;
  cuenta: string | null;
  uuid_cfdi: string;
  rfc: string | null;
  cfdi_uuid: string | null;
  estatus_sat: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
}

async function obtenerCruceMovimientosCfdi(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<FilaCfdiCruce[]> {
  const { rows } = await pool.query(
    `SELECT p.id AS poliza_id, p.numero, tp.identificador AS tipo, pd.renglon, c.cuenta,
       pd.uuid_cfdi, pd.rfc,
       cc.uuid AS cfdi_uuid, cc.estatus_sat, cc.rfc_emisor, cc.rfc_receptor
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     JOIN contabilidad.polizas_detalle pd ON pd.poliza_id = p.id
     LEFT JOIN contabilidad.cuentas c ON c.id = pd.cuenta_id
     LEFT JOIN core.cfdi_sat_comprobantes cc
       ON cc.empresa_id = p.empresa_id AND lower(cc.uuid) = lower(pd.uuid_cfdi::text)
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND pd.uuid_cfdi IS NOT NULL
     ORDER BY p.numero, pd.renglon`,
    [empresaId, ejercicio, periodo]
  );
  return rows.map((r) => ({
    poliza_id: Number(r.poliza_id),
    numero: Number(r.numero),
    tipo: r.tipo,
    renglon: Number(r.renglon),
    cuenta: r.cuenta ?? null,
    uuid_cfdi: r.uuid_cfdi,
    rfc: r.rfc ?? null,
    cfdi_uuid: r.cfdi_uuid ?? null,
    estatus_sat: r.estatus_sat ?? null,
    rfc_emisor: r.rfc_emisor ?? null,
    rfc_receptor: r.rfc_receptor ?? null,
  }));
}

function baseItemMovimiento(f: FilaCfdiCruce, motivo: string) {
  return {
    poliza_id: f.poliza_id,
    tipo: f.tipo,
    numero: f.numero,
    renglon: f.renglon,
    cuenta: f.cuenta,
    uuid_cfdi: f.uuid_cfdi,
    motivo,
  };
}

function validarUuidNoEncontrado(filas: FilaCfdiCruce[]): SeccionValidacion {
  const items = filas
    .filter((f) => f.cfdi_uuid == null)
    .map((f) => baseItemMovimiento(f, 'UUID CFDI capturado no encontrado en CFDI SAT descargados'));
  return seccion(
    'movimientos_uuid_no_encontrado',
    'Movimientos con UUID CFDI no encontrado en CFDI SAT',
    'advertencia',
    items
  );
}

function validarUuidCancelado(filas: FilaCfdiCruce[]): SeccionValidacion {
  const items = filas
    .filter((f) => f.cfdi_uuid != null && f.estatus_sat === 'cancelado')
    .map((f) => baseItemMovimiento(f, 'El CFDI relacionado está cancelado ante el SAT'));
  return seccion(
    'movimientos_uuid_cancelado',
    'Movimientos con UUID CFDI cancelado',
    'advertencia',
    items
  );
}

function validarRfcNoCoincide(filas: FilaCfdiCruce[]): SeccionValidacion {
  const items = filas
    .filter((f) => {
      if (f.cfdi_uuid == null || !f.rfc) return false;
      const rfc = f.rfc.trim().toUpperCase();
      const emisor = f.rfc_emisor?.trim().toUpperCase() ?? '';
      const receptor = f.rfc_receptor?.trim().toUpperCase() ?? '';
      return rfc !== emisor && rfc !== receptor;
    })
    .map((f) =>
      Object.assign(baseItemMovimiento(f, 'El RFC capturado no coincide con el emisor ni el receptor del CFDI'), {
        rfc: f.rfc,
      })
    );
  return seccion(
    'movimientos_rfc_no_coincide',
    'Movimientos con RFC que no coincide con el CFDI',
    'advertencia',
    items
  );
}

// ── 10. Periodo sin saldos mensuales ────────────────────────────────────────

async function validarPeriodoSinSaldos(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<SeccionValidacion | null> {
  const [{ rows: saldosRows }, { rows: polizasRows }] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM contabilidad.cuentas_saldos_mensuales
       WHERE empresa_id = $1 AND ejercicio = $2 AND periodo = $3`,
      [empresaId, ejercicio, periodo]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM contabilidad.polizas
       WHERE empresa_id = $1 AND ejercicio = $2 AND periodo = $3 AND estatus = 'aplicada'`,
      [empresaId, ejercicio, periodo]
    ),
  ]);

  const tieneSaldos = Number(saldosRows[0]?.count ?? 0) > 0;
  if (tieneSaldos) return null;

  const tienePolizasAplicadas = Number(polizasRows[0]?.count ?? 0) > 0;
  const nivel: NivelValidacion = tienePolizasAplicadas ? 'error' : 'advertencia';
  const motivo = tienePolizasAplicadas
    ? 'El periodo tiene pólizas aplicadas pero no tiene saldos mensuales acumulados'
    : 'El periodo no tiene saldos mensuales ni pólizas aplicadas';

  return seccion('periodo_sin_saldos', 'Periodo sin saldos mensuales', nivel, [{ motivo }]);
}

// ── 11. Saldos iniciales del ejercicio (Fase 5 de e-contabilidad) ──────────
// Reemplaza la advertencia genérica de Fase 1 ("no existe una estrategia
// formal de saldos iniciales...") ahora que contabilidad.cuentas_saldos_
// iniciales existe de verdad y se puede validar contra datos reales.
//
//   a) el ejercicio no tiene NINGÚN saldo inicial capturado: advertencia
//      única (no se lista cuenta por cuenta, sería ruido: aplicaría a
//      absolutamente todas las cuentas afectables).
//   b) hay cuentas afectables activas concretas sin saldo inicial
//      capturado: solo se corre si (a) no aplicó, mismo criterio que ya se
//      usa para el catálogo de códigos agrupadores vacío (evitar listar
//      "todas" dos veces con distinta redacción).
//   c) existen saldos iniciales capturados sobre cuentas que ya no son
//      válidas para e-contabilidad (inactivas, no afectables, o sin
//      naturaleza resoluble): error, porque ese dato SÍ se guardó y
//      quedaría mal representado en la futura balanza XML.

async function validarSaldosInicialesEnCuentasInvalidas(empresaId: number, ejercicio: number): Promise<SeccionValidacion> {
  const { rows } = await pool.query(
    `SELECT si.cuenta_id, c.cuenta, c.descripcion, si.saldo_inicial,
       c.activa, c.afectable, c.rango_cuenta_id, r.id AS rango_existe, r.naturaleza_saldo
     FROM contabilidad.cuentas_saldos_iniciales si
     JOIN contabilidad.cuentas c ON c.id = si.cuenta_id AND c.empresa_id = si.empresa_id
     LEFT JOIN contabilidad.rangos_cuentas r ON r.empresa_id = c.empresa_id AND r.id = c.rango_cuenta_id
     WHERE si.empresa_id = $1 AND si.ejercicio = $2
       AND (
         c.activa = false OR c.afectable = false
         OR c.rango_cuenta_id IS NULL OR r.id IS NULL OR r.naturaleza_saldo IS NULL OR r.naturaleza_saldo NOT IN ('D', 'A')
       )
     ORDER BY c.cuenta`,
    [empresaId, ejercicio]
  );
  const items = rows.map((r) => {
    let motivo: string;
    if (!r.activa) motivo = 'La cuenta con saldo inicial capturado ya no está activa.';
    else if (!r.afectable) motivo = 'La cuenta con saldo inicial capturado ya no es afectable.';
    else motivo = 'La cuenta con saldo inicial capturado no tiene naturaleza contable resoluble.';
    return {
      cuenta_id: Number(r.cuenta_id),
      cuenta: r.cuenta,
      descripcion: r.descripcion,
      saldo_inicial: Number(r.saldo_inicial),
      motivo,
    };
  });
  return seccion('saldos_iniciales_cuenta_invalida', 'Saldos iniciales en cuentas inválidas para e-contabilidad', 'error', items);
}

async function validarSaldosInicialesEjercicio(empresaId: number, ejercicio: number): Promise<SeccionValidacion[]> {
  const [{ rows: totalRows }, seccionInvalidas] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM contabilidad.cuentas_saldos_iniciales WHERE empresa_id = $1 AND ejercicio = $2`,
      [empresaId, ejercicio]
    ),
    validarSaldosInicialesEnCuentasInvalidas(empresaId, ejercicio),
  ]);
  const totalCapturados = Number(totalRows[0]?.count ?? 0);

  if (totalCapturados === 0) {
    return [
      seccion('saldos_iniciales_no_registrados_ejercicio', 'Saldos iniciales no registrados para el ejercicio', 'advertencia', [
        {
          motivo: `No hay saldos iniciales registrados para el ejercicio ${ejercicio}. Las cuentas sin registro se asumirán en cero.`,
        },
      ]),
      seccionInvalidas,
    ];
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.cuenta, c.descripcion
     FROM contabilidad.cuentas c
     WHERE c.empresa_id = $1 AND c.activa = true AND c.afectable = true
       AND NOT EXISTS (
         SELECT 1 FROM contabilidad.cuentas_saldos_iniciales si
         WHERE si.empresa_id = c.empresa_id AND si.ejercicio = $2 AND si.cuenta_id = c.id
       )
     ORDER BY c.cuenta`,
    [empresaId, ejercicio]
  );
  const items = rows.map((r) => ({
    cuenta_id: Number(r.id),
    cuenta: r.cuenta,
    descripcion: r.descripcion,
    motivo: `Cuenta afectable activa sin saldo inicial registrado para el ejercicio ${ejercicio}; se asumirá en cero.`,
  }));

  return [
    seccion('cuentas_sin_saldo_inicial', 'Cuentas afectables sin saldo inicial registrado', 'advertencia', items),
    seccionInvalidas,
  ];
}

// ── Orquestador ──────────────────────────────────────────────────────────

async function contarCuentasRevisadas(empresaId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.cuentas WHERE empresa_id = $1 AND activa = true`,
    [empresaId]
  );
  return Number(rows[0]?.count ?? 0);
}

async function contarPolizasRevisadas(empresaId: number, ejercicio: number, periodo: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.polizas
     WHERE empresa_id = $1 AND ejercicio = $2 AND periodo = $3 AND estatus = 'aplicada'`,
    [empresaId, ejercicio, periodo]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function validarPeriodoEContabilidad(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<ValidacionEContabilidadResultado> {
  const cruceCfdi = await obtenerCruceMovimientosCfdi(empresaId, ejercicio, periodo);

  const [
    cuentasSinAgrupador,
    cuentasSinNaturaleza,
    seccionesAgrupador,
    polizasDescuadradas,
    polizasSinMovimientos,
    movimientosCuentaInvalida,
    periodoSinSaldos,
    seccionesSaldosIniciales,
    cuentasRevisadas,
    polizasRevisadas,
  ] = await Promise.all([
    validarCuentasSinCodigoAgrupador(empresaId),
    validarCuentasSinNaturaleza(empresaId),
    validarCatalogoAgrupadoresYCuentas(empresaId),
    validarPolizasDescuadradas(empresaId, ejercicio, periodo),
    validarPolizasSinMovimientos(empresaId, ejercicio, periodo),
    validarMovimientosCuentaInvalida(empresaId, ejercicio, periodo),
    validarPeriodoSinSaldos(empresaId, ejercicio, periodo),
    validarSaldosInicialesEjercicio(empresaId, ejercicio),
    contarCuentasRevisadas(empresaId),
    contarPolizasRevisadas(empresaId, ejercicio, periodo),
  ]);

  const secciones: SeccionValidacion[] = [
    cuentasSinAgrupador,
    cuentasSinNaturaleza,
    ...seccionesAgrupador,
    polizasDescuadradas,
    polizasSinMovimientos,
    movimientosCuentaInvalida,
    validarUuidNoEncontrado(cruceCfdi),
    validarUuidCancelado(cruceCfdi),
    validarRfcNoCoincide(cruceCfdi),
    ...(periodoSinSaldos ? [periodoSinSaldos] : []),
    ...seccionesSaldosIniciales,
  ].filter((s) => s.total > 0);

  const errores = secciones.filter((s) => s.nivel === 'error').reduce((acc, s) => acc + s.total, 0);
  const advertencias = secciones.filter((s) => s.nivel === 'advertencia').reduce((acc, s) => acc + s.total, 0);

  return {
    ok: errores === 0,
    ejercicio,
    periodo,
    resumen: {
      errores,
      advertencias,
      cuentas_revisadas: cuentasRevisadas,
      polizas_revisadas: polizasRevisadas,
    },
    secciones,
  };
}
