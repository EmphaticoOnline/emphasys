import pool from '../../config/database';

// ---------------------------------------------------------------------------
// Fase 8 de Contabilidad Electrónica: validación de pólizas aplicadas del
// periodo contra CFDI SAT descargados, como preparación para el futuro XML
// de Pólizas del periodo (PolizasPeriodo_1_3). Esta fase es SOLO diagnóstico:
// no genera XML, no modifica pólizas/movimientos/UUID/RFC ni CFDI SAT.
//
// El cruce UUID reutiliza el mismo criterio ya establecido en
// eContabilidad.repository.ts -> obtenerCruceMovimientosCfdi: normalizar a
// minúsculas ambos lados antes de comparar (polizas_detalle.uuid_cfdi es
// `uuid` nativo de Postgres, cfdi_sat_comprobantes.uuid es varchar(36); el
// cast a texto + lower() es necesario y suficiente, sin tocar el dato
// capturado).
// ---------------------------------------------------------------------------

export type EstadoMovimientoPolizaSat =
  | 'correcto'
  | 'uuid_no_encontrado'
  | 'cfdi_cancelado'
  | 'rfc_no_coincide'
  | 'uuid_sin_rfc'
  | 'sin_uuid'
  | 'error';

export interface ErrorPolizaSat {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaPolizaSat {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface MovimientoPolizaSat {
  poliza_id: number;
  tipo_poliza: string;
  numero: number;
  fecha: string;
  renglon: number;
  cuenta: string | null;
  descripcion_cuenta: string | null;
  concepto: string | null;
  cargo: number;
  abono: number;
  uuid_cfdi: string | null;
  rfc: string | null;
  cfdi_encontrado: boolean;
  estatus_sat: string | null;
  rfc_coincide: boolean | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: number | null;
  tipo_comprobante: string | null;
  estado: EstadoMovimientoPolizaSat;
  motivo: string | null;
}

export interface PolizasSatResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  resumen: {
    polizas: number;
    movimientos: number;
    movimientos_con_uuid: number;
    uuid_encontrados: number;
    uuid_no_encontrados: number;
    cfdi_cancelados: number;
    rfc_no_coincide: number;
    errores: number;
    advertencias: number;
  };
  movimientos: MovimientoPolizaSat[];
  errores: ErrorPolizaSat[];
  advertencias: AdvertenciaPolizaSat[];
}

interface FilaMovimiento {
  poliza_id: number;
  tipo_poliza: string;
  numero: number;
  fecha: string;
  renglon: number;
  cuenta_id: number | null;
  cuenta: string | null;
  descripcion_cuenta: string | null;
  cuenta_activa: boolean | null;
  cuenta_afectable: boolean | null;
  codigo_agrupador_sat: string | null;
  concepto: string | null;
  cargo: string;
  abono: string;
  uuid_cfdi: string | null;
  rfc: string | null;
  cfdi_uuid: string | null;
  estatus_sat: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: string | null;
  tipo_comprobante: string | null;
}

// Heurística SUAVE (no bloqueante, no es regla oficial) para detectar
// cuentas que probablemente representan un proveedor/cliente y por lo tanto
// "podrían" requerir CFDI relacionado. Dos señales, cualquiera basta:
//  - codigo_agrupador_sat en la familia 105.xx (Clientes) o 201.xx
//    (Proveedores) del Anexo 24 (si el catálogo SAT ya está cargado).
//  - descripción de la cuenta contiene "proveedor" o "cliente" (señal de
//    texto libre, la única disponible siempre, sin depender de que el
//    catálogo de códigos agrupadores esté cargado).
// Deliberadamente NO se exige naturaleza/grupo específico: agregar más
// condiciones encadenadas sería inventar una regla más agresiva de lo que
// se pidió ("no inventar reglas demasiado agresivas").
function pareceCuentaProveedorOCliente(codigoAgrupador: string | null, descripcion: string | null): boolean {
  const codigo = codigoAgrupador?.trim() ?? '';
  if (codigo.startsWith('105') || codigo.startsWith('201')) return true;
  const desc = (descripcion ?? '').toLowerCase();
  return desc.includes('proveedor') || desc.includes('cliente');
}

async function obtenerEmpresa(empresaId: number): Promise<{ rfc: string; razon_social: string }> {
  const { rows } = await pool.query<{ rfc: string | null; razon_social: string | null }>(
    `SELECT rfc, razon_social FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const row = rows[0];
  return { rfc: row?.rfc?.trim() ?? '', razon_social: row?.razon_social?.trim() ?? '' };
}

// Validación 1: pólizas aplicadas descuadradas (defensivo — mismo criterio
// que validarPolizasDescuadradas en eContabilidad.repository.ts).
async function validarPolizasDescuadradas(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorPolizaSat[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.numero, tp.identificador AS tipo, p.total_cargos, p.total_abonos,
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
  return rows.map((r) => ({
    tipo: 'poliza_descuadrada',
    poliza: `${r.tipo} ${r.numero}`,
    motivo: 'Póliza aplicada descuadrada (cargos ≠ abonos); no se puede preparar para XML de pólizas hasta corregirse.',
  }));
}

// Validación 8: pólizas aplicadas sin movimientos.
async function validarPolizasSinMovimientos(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorPolizaSat[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.numero, tp.identificador AS tipo
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND NOT EXISTS (SELECT 1 FROM contabilidad.polizas_detalle pd WHERE pd.poliza_id = p.id)
     ORDER BY p.numero`,
    [empresaId, ejercicio, periodo]
  );
  return rows.map((r) => ({
    tipo: 'poliza_sin_movimientos',
    poliza: `${r.tipo} ${r.numero}`,
    motivo: 'Póliza aplicada sin movimientos; no puede incluirse en el XML de pólizas.',
  }));
}

async function contarPolizasAplicadas(empresaId: number, ejercicio: number, periodo: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM contabilidad.polizas
     WHERE empresa_id = $1 AND ejercicio = $2 AND periodo = $3 AND estatus = 'aplicada'`,
    [empresaId, ejercicio, periodo]
  );
  return Number(rows[0]?.count ?? 0);
}

async function obtenerMovimientos(empresaId: number, ejercicio: number, periodo: number): Promise<FilaMovimiento[]> {
  const { rows } = await pool.query(
    `SELECT p.id AS poliza_id, tp.identificador AS tipo_poliza, p.numero, to_char(p.fecha, 'YYYY-MM-DD') AS fecha,
       pd.renglon, pd.cuenta_id, c.cuenta, c.descripcion AS descripcion_cuenta,
       c.activa AS cuenta_activa, c.afectable AS cuenta_afectable, c.codigo_agrupador_sat,
       co.nombre_concepto AS concepto,
       pd.cargo, pd.abono, pd.uuid_cfdi, pd.rfc,
       cc.uuid AS cfdi_uuid, cc.estatus_sat, cc.rfc_emisor, cc.rfc_receptor, cc.total AS total_cfdi, cc.tipo_comprobante
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     JOIN contabilidad.polizas_detalle pd ON pd.poliza_id = p.id
     LEFT JOIN contabilidad.cuentas c ON c.id = pd.cuenta_id AND c.empresa_id = p.empresa_id
     LEFT JOIN public.conceptos co ON co.id = pd.concepto_id
     LEFT JOIN core.cfdi_sat_comprobantes cc
       ON cc.empresa_id = p.empresa_id AND pd.uuid_cfdi IS NOT NULL AND lower(cc.uuid) = lower(pd.uuid_cfdi::text)
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
     ORDER BY p.numero, pd.renglon`,
    [empresaId, ejercicio, periodo]
  );
  return rows;
}

export async function construirPolizasSatResultado(
  empresaId: number,
  ejercicio: number,
  periodo: number
): Promise<PolizasSatResultado> {
  const [empresa, polizasCount, filas, errPolizasDescuadradas, errPolizasSinMovimientos] = await Promise.all([
    obtenerEmpresa(empresaId),
    contarPolizasAplicadas(empresaId, ejercicio, periodo),
    obtenerMovimientos(empresaId, ejercicio, periodo),
    validarPolizasDescuadradas(empresaId, ejercicio, periodo),
    validarPolizasSinMovimientos(empresaId, ejercicio, periodo),
  ]);

  const errores: ErrorPolizaSat[] = [...errPolizasDescuadradas, ...errPolizasSinMovimientos];
  const advertencias: AdvertenciaPolizaSat[] = [];
  const movimientos: MovimientoPolizaSat[] = [];

  let movimientosConUuid = 0;
  let uuidEncontrados = 0;
  let uuidNoEncontrados = 0;
  let cfdiCancelados = 0;
  let rfcNoCoincide = 0;

  for (const f of filas) {
    const identificadorPoliza = `${f.tipo_poliza} ${f.numero}`;
    const cuentaInvalida = f.cuenta_id == null || f.cuenta == null || f.cuenta_activa === false || f.cuenta_afectable === false;

    // Validación 9: cuenta inválida/inactiva/no afectable → error.
    if (cuentaInvalida) {
      const motivo =
        f.cuenta_id == null || f.cuenta == null
          ? 'La cuenta del movimiento no existe o no pertenece a esta empresa.'
          : f.cuenta_activa === false
          ? 'La cuenta del movimiento está inactiva.'
          : 'La cuenta del movimiento no es afectable (tiene subcuentas).';
      errores.push({
        tipo: 'movimiento_cuenta_invalida',
        poliza: identificadorPoliza,
        cuenta: f.cuenta ?? undefined,
        motivo,
      });
      movimientos.push({
        poliza_id: Number(f.poliza_id),
        tipo_poliza: f.tipo_poliza,
        numero: Number(f.numero),
        fecha: f.fecha,
        renglon: Number(f.renglon),
        cuenta: f.cuenta,
        descripcion_cuenta: f.descripcion_cuenta,
        concepto: f.concepto,
        cargo: Number(f.cargo),
        abono: Number(f.abono),
        uuid_cfdi: f.uuid_cfdi,
        rfc: f.rfc,
        cfdi_encontrado: f.cfdi_uuid != null,
        estatus_sat: f.estatus_sat,
        rfc_coincide: null,
        rfc_emisor: f.rfc_emisor,
        rfc_receptor: f.rfc_receptor,
        total_cfdi: f.total_cfdi != null ? Number(f.total_cfdi) : null,
        tipo_comprobante: f.tipo_comprobante,
        estado: 'error',
        motivo,
      });
      continue;
    }

    const tieneUuid = !!f.uuid_cfdi;
    const tieneRfc = !!f.rfc?.trim();
    let estado: EstadoMovimientoPolizaSat = 'correcto';
    let motivoFila: string | null = null;
    let rfcCoincide: boolean | null = null;

    if (tieneUuid) {
      movimientosConUuid += 1;
      const encontrado = f.cfdi_uuid != null;

      if (!encontrado) {
        uuidNoEncontrados += 1;
        estado = 'uuid_no_encontrado';
        motivoFila = 'UUID CFDI capturado no encontrado en CFDI SAT.';
        advertencias.push({ tipo: 'uuid_no_encontrado', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
      } else {
        uuidEncontrados += 1;
        const cancelado = f.estatus_sat === 'cancelado';
        if (cancelado) cfdiCancelados += 1;

        if (tieneRfc) {
          const rfcNormalizado = f.rfc!.trim().toUpperCase();
          const emisor = f.rfc_emisor?.trim().toUpperCase() ?? '';
          const receptor = f.rfc_receptor?.trim().toUpperCase() ?? '';
          rfcCoincide = rfcNormalizado === emisor || rfcNormalizado === receptor;
          if (!rfcCoincide) rfcNoCoincide += 1;
        }

        if (cancelado) {
          estado = 'cfdi_cancelado';
          motivoFila = 'El CFDI relacionado está cancelado ante el SAT.';
          advertencias.push({ tipo: 'cfdi_cancelado', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
        } else if (rfcCoincide === false) {
          estado = 'rfc_no_coincide';
          motivoFila = 'El RFC capturado no coincide con emisor ni receptor del CFDI.';
          advertencias.push({ tipo: 'rfc_no_coincide', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
        } else if (!tieneRfc) {
          estado = 'uuid_sin_rfc';
          motivoFila = 'El movimiento tiene UUID CFDI pero no RFC capturado.';
          advertencias.push({ tipo: 'uuid_sin_rfc', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
        }
      }
    } else if (tieneRfc) {
      estado = 'sin_uuid';
      motivoFila = 'El movimiento tiene RFC pero no UUID CFDI.';
      advertencias.push({ tipo: 'rfc_sin_uuid', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
    } else if (pareceCuentaProveedorOCliente(f.codigo_agrupador_sat, f.descripcion_cuenta)) {
      estado = 'sin_uuid';
      motivoFila = 'El movimiento podría requerir CFDI relacionado para XML de pólizas.';
      advertencias.push({ tipo: 'posible_requiere_cfdi', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
    }

    movimientos.push({
      poliza_id: Number(f.poliza_id),
      tipo_poliza: f.tipo_poliza,
      numero: Number(f.numero),
      fecha: f.fecha,
      renglon: Number(f.renglon),
      cuenta: f.cuenta,
      descripcion_cuenta: f.descripcion_cuenta,
      concepto: f.concepto,
      cargo: Number(f.cargo),
      abono: Number(f.abono),
      uuid_cfdi: f.uuid_cfdi,
      rfc: f.rfc,
      cfdi_encontrado: f.cfdi_uuid != null,
      estatus_sat: f.estatus_sat,
      rfc_coincide: rfcCoincide,
      rfc_emisor: f.rfc_emisor,
      rfc_receptor: f.rfc_receptor,
      total_cfdi: f.total_cfdi != null ? Number(f.total_cfdi) : null,
      tipo_comprobante: f.tipo_comprobante,
      estado,
      motivo: motivoFila,
    });
  }

  return {
    ok: errores.length === 0,
    empresa,
    ejercicio,
    periodo,
    resumen: {
      polizas: polizasCount,
      movimientos: movimientos.length,
      movimientos_con_uuid: movimientosConUuid,
      uuid_encontrados: uuidEncontrados,
      uuid_no_encontrados: uuidNoEncontrados,
      cfdi_cancelados: cfdiCancelados,
      rfc_no_coincide: rfcNoCoincide,
      errores: errores.length,
      advertencias: advertencias.length,
    },
    movimientos,
    errores,
    advertencias,
  };
}
