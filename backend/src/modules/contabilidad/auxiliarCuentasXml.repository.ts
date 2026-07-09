import pool from '../../config/database';
import { listarCuentasConSaldoMes } from './saldos.repository';
import { TipoSolicitudPolizas } from './tipoSolicitudSat';

// ---------------------------------------------------------------------------
// Fase 10B de Contabilidad Electrónica: generación del XML de Auxiliar de
// cuentas y/o subcuentas (Anexo 24, esquema AuxiliarCtas versión 1.3). Esta
// capa NO construye el XML (ver auxiliarCuentasXml.builder.ts); arma la
// lista de cuentas con su detalle de movimientos y corre las validaciones
// bloqueantes/de advertencia.
//
// Estructura verificada en el XSD oficial: a diferencia del Auxiliar de
// folios, este XML NO tiene ninguna referencia a CFDI/UUID -- es
// exclusivamente saldo inicial/final por cuenta (Cuenta: NumCta, DesCta,
// SaldoIni, SaldoFin) más el detalle de movimientos que lo componen
// (DetalleAux: Fecha, NumUnIdenPol, Concepto, Debe, Haber). El documento
// "integra todos los auxiliares de cuenta y/o subcuenta" del periodo, pero
// en la práctica solo tiene sentido listar cuentas AFECTABLES con al menos
// un movimiento en el periodo (una cuenta sin movimientos no tiene detalle
// que auxiliar) -- mismo criterio de alcance que ya usa el "Auxiliar de
// cuenta" existente en Saldos por mes/año (obtenerAuxiliarCuenta en
// saldos.repository.ts).
//
// SaldoIni/SaldoFin reutilizan el mismo cálculo ya probado en
// listarCuentasConSaldoMes (saldos.repository.ts), que a su vez usa
// aplicarNaturaleza/saldoFirmadoASaldoNormal -- la misma convención de signo
// "positivo cuando coincide con la naturaleza esperada" ya usada en Balanza
// XML, sin reinventar el cálculo por tercera vez.
// ---------------------------------------------------------------------------

export type EstadoCuentaAuxiliar = 'correcto' | 'error';

export interface ErrorCuentaAuxiliar {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaCuentaAuxiliar {
  tipo: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface DetalleMovimientoAuxiliar {
  fecha: string;
  poliza: string;
  renglon: number;
  concepto: string | null;
  debe: number;
  haber: number;
}

export interface CuentaAuxiliar {
  cuenta_id: number;
  num_cta: string;
  descripcion: string;
  saldo_ini: number;
  saldo_fin: number;
  naturaleza: 'D' | 'A' | null;
  naturaleza_descripcion: string | null;
  estado: EstadoCuentaAuxiliar;
  motivo: string | null;
  detalle: DetalleMovimientoAuxiliar[];
}

export interface AuxiliarCuentasResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_solicitud: TipoSolicitudPolizas;
  num_orden: string | null;
  num_tramite: string | null;
  cuenta_id: number | null;
  resumen: {
    cuentas: number;
    movimientos: number;
    errores: number;
    advertencias: number;
  };
  cuentas: CuentaAuxiliar[];
  errores: ErrorCuentaAuxiliar[];
  advertencias: AdvertenciaCuentaAuxiliar[];
}

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const NATURALEZA_DESCRIPCION: Record<'D' | 'A', string> = { D: 'Deudora', A: 'Acreedora' };

async function obtenerEmpresa(empresaId: number): Promise<{ rfc: string; razon_social: string }> {
  const { rows } = await pool.query<{ rfc: string | null; razon_social: string | null }>(
    `SELECT rfc, razon_social FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const row = rows[0];
  return { rfc: row?.rfc?.trim() ?? '', razon_social: row?.razon_social?.trim() ?? '' };
}

async function validarPolizasDescuadradas(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorCuentaAuxiliar[]> {
  const { rows } = await pool.query(
    `SELECT p.numero, tp.identificador AS tipo, p.total_cargos, p.total_abonos,
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
  return rows.map((r) => ({ tipo: 'poliza_descuadrada', motivo: `Póliza ${r.tipo} ${r.numero} descuadrada (cargos ≠ abonos); no puede incluirse en el auxiliar de cuentas.` }));
}

async function validarPolizasSinMovimientos(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorCuentaAuxiliar[]> {
  const { rows } = await pool.query(
    `SELECT p.numero, tp.identificador AS tipo
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND NOT EXISTS (SELECT 1 FROM contabilidad.polizas_detalle pd WHERE pd.poliza_id = p.id)
     ORDER BY p.numero`,
    [empresaId, ejercicio, periodo]
  );
  return rows.map((r) => ({ tipo: 'poliza_sin_movimientos', motivo: `Póliza ${r.tipo} ${r.numero} aplicada sin movimientos.` }));
}

interface FilaDetalle {
  cuenta_id: number;
  tipo_poliza: string;
  numero: number;
  fecha: string;
  renglon: number;
  concepto: string | null;
  cargo: string;
  abono: string;
}

async function obtenerDetalleMovimientos(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  cuentaIds: number[]
): Promise<Map<number, FilaDetalle[]>> {
  const mapa = new Map<number, FilaDetalle[]>();
  if (cuentaIds.length === 0) return mapa;

  const { rows } = await pool.query<FilaDetalle>(
    `SELECT pd.cuenta_id, tp.identificador AS tipo_poliza, p.numero,
       to_char(p.fecha, 'YYYY-MM-DD') AS fecha, pd.renglon,
       co.nombre_concepto AS concepto, pd.cargo, pd.abono
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     JOIN contabilidad.polizas_detalle pd ON pd.poliza_id = p.id
     LEFT JOIN public.conceptos co ON co.id = pd.concepto_id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND pd.cuenta_id = ANY($4::bigint[])
     ORDER BY pd.cuenta_id ASC, p.fecha ASC, tp.identificador ASC, p.numero ASC, pd.renglon ASC`,
    [empresaId, ejercicio, periodo, cuentaIds]
  );
  for (const row of rows) {
    const cuentaId = Number(row.cuenta_id);
    const lista = mapa.get(cuentaId) ?? [];
    lista.push(row);
    mapa.set(cuentaId, lista);
  }
  return mapa;
}

export async function construirAuxiliarCuentasXml(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null,
  cuentaId: number | null
): Promise<AuxiliarCuentasResultado> {
  const errores: ErrorCuentaAuxiliar[] = [];
  const advertencias: AdvertenciaCuentaAuxiliar[] = [];

  const empresa = await obtenerEmpresa(empresaId);
  if (!empresa.rfc) {
    errores.push({ tipo: 'empresa_sin_rfc', motivo: 'La empresa no tiene RFC configurado.' });
  } else if (!RFC_REGEX.test(empresa.rfc)) {
    errores.push({ tipo: 'empresa_rfc_invalido', motivo: `El RFC "${empresa.rfc}" no tiene un formato válido.` });
  }

  const [errDescuadradas, errSinMovimientos, todasLasCuentas, rangoNuloRows] = await Promise.all([
    validarPolizasDescuadradas(empresaId, ejercicio, periodo),
    validarPolizasSinMovimientos(empresaId, ejercicio, periodo),
    listarCuentasConSaldoMes(empresaId, ejercicio, periodo),
    pool.query<{ id: number }>(
      `SELECT id FROM contabilidad.cuentas WHERE empresa_id = $1 AND activa = true AND rango_cuenta_id IS NULL`,
      [empresaId]
    ),
  ]);
  errores.push(...errDescuadradas, ...errSinMovimientos);
  const cuentasSinNaturaleza = new Set(rangoNuloRows.rows.map((r) => Number(r.id)));

  // Alcance: cuentas afectables con al menos un movimiento (cargos/abonos)
  // en el periodo, o la cuenta específica solicitada (aunque esté en cero,
  // si el usuario la pidió explícitamente).
  let cuentasConMovimiento = todasLasCuentas.filter((c) => c.afectable && (c.cargos !== 0 || c.abonos !== 0));
  if (cuentaId != null) {
    const cuenta = todasLasCuentas.find((c) => c.id === cuentaId);
    if (!cuenta) {
      errores.push({ tipo: 'cuenta_filtro_invalida', motivo: `La cuenta solicitada (id ${cuentaId}) no existe, no está activa o no es afectable.` });
      cuentasConMovimiento = [];
    } else if (!cuenta.afectable) {
      errores.push({ tipo: 'cuenta_filtro_invalida', cuenta: cuenta.cuenta, motivo: 'La cuenta solicitada no es afectable.' });
      cuentasConMovimiento = [];
    } else {
      cuentasConMovimiento = [cuenta];
    }
  }

  const cuentaIds = cuentasConMovimiento.map((c) => c.id);
  const detallePorCuenta = await obtenerDetalleMovimientos(empresaId, ejercicio, periodo, cuentaIds);

  const cuentas: CuentaAuxiliar[] = [];
  let totalMovimientos = 0;

  for (const c of cuentasConMovimiento) {
    const sinNaturaleza = cuentasSinNaturaleza.has(c.id);
    if (sinNaturaleza) {
      errores.push({ tipo: 'cuenta_sin_naturaleza', cuenta: c.cuenta, descripcion: c.descripcion, motivo: 'La cuenta no tiene rango/naturaleza resoluble; no se puede determinar el signo de SaldoIni/SaldoFin.' });
    }

    const filasDetalle = detallePorCuenta.get(c.id) ?? [];
    const detalle: DetalleMovimientoAuxiliar[] = [];
    let cuentaConMotivo: string | null = null;

    for (const f of filasDetalle) {
      const sinConcepto = !f.concepto?.trim();
      if (sinConcepto) {
        errores.push({
          tipo: 'movimiento_sin_concepto',
          cuenta: c.cuenta,
          descripcion: c.descripcion,
          motivo: `Movimiento de la póliza ${f.tipo_poliza} ${f.numero} (renglón ${f.renglon}) sin concepto capturado; el XSD exige un Concepto de 1 a 200 caracteres por DetalleAux.`,
        });
        cuentaConMotivo = 'Tiene movimientos sin concepto capturado.';
      }
      detalle.push({
        fecha: f.fecha,
        poliza: `${f.tipo_poliza} ${f.numero}`,
        renglon: Number(f.renglon),
        concepto: f.concepto,
        debe: Number(f.cargo),
        haber: Number(f.abono),
      });
      totalMovimientos += 1;
    }

    const naturaleza: 'D' | 'A' | null = sinNaturaleza ? null : (c.naturaleza_saldo as 'D' | 'A');
    cuentas.push({
      cuenta_id: c.id,
      num_cta: c.cuenta,
      descripcion: c.descripcion,
      saldo_ini: Math.round(c.saldo_inicial * 100) / 100,
      saldo_fin: Math.round(c.saldo_final * 100) / 100,
      naturaleza,
      naturaleza_descripcion: naturaleza ? NATURALEZA_DESCRIPCION[naturaleza] : null,
      estado: sinNaturaleza ? 'error' : 'correcto',
      motivo: sinNaturaleza ? 'La cuenta no tiene naturaleza resoluble.' : cuentaConMotivo,
      detalle,
    });
  }

  // Advertencias: saldos iniciales del ejercicio (mismo criterio que Balanza XML).
  const { rows: saldosInicialesRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.cuentas_saldos_iniciales WHERE empresa_id = $1 AND ejercicio = $2`,
    [empresaId, ejercicio]
  );
  if (Number(saldosInicialesRows[0]?.count ?? 0) === 0) {
    advertencias.push({ tipo: 'sin_saldos_iniciales_ejercicio', motivo: `No hay saldos iniciales registrados para el ejercicio ${ejercicio}; se asumen en cero.` });
  }

  return {
    ok: errores.length === 0,
    empresa,
    ejercicio,
    periodo,
    tipo_solicitud: tipoSolicitud,
    num_orden: (tipoSolicitud === 'AF' || tipoSolicitud === 'FC') ? numOrden : null,
    num_tramite: (tipoSolicitud === 'DE' || tipoSolicitud === 'CO') ? numTramite : null,
    cuenta_id: cuentaId,
    resumen: {
      cuentas: cuentas.length,
      movimientos: totalMovimientos,
      errores: errores.length,
      advertencias: advertencias.length,
    },
    cuentas,
    errores,
    advertencias,
  };
}
