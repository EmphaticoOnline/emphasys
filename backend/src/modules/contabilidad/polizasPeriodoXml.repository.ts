import pool from '../../config/database';

// ---------------------------------------------------------------------------
// Fase 9 de Contabilidad Electrónica: generación del XML de Pólizas del
// periodo (Anexo 24, esquema PolizasPeriodo versión 1.3). Esta capa NO
// construye el XML (ver polizasPeriodoXml.builder.ts); arma la estructura
// póliza -> movimientos -> comprobante relacionado y corre las validaciones
// bloqueantes/de advertencia.
//
// A diferencia de Catálogo/Balanza (información periódica obligatoria), las
// pólizas del periodo SOLO se presentan cuando el SAT las requiere en un
// acto de fiscalización, fiscalización por compulsa, devolución o
// compensación (Anexo 24, apartado "C. PÓLIZAS DEL PERIODO", texto oficial:
// "Tipo de Solicitud: Es el motivo por el cual se solicitan las pólizas del
// periodo y podrán ser: Acto de Fiscalización, Fiscalización por Compulsa,
// Devolución y Compensación."). Por eso TipoSolicitud es SIEMPRE obligatorio
// (sin valor por omisión), y NumOrden/NumTramite se piden condicionalmente
// (verificado en el XSD y en el texto del Anexo 24: "Número de Orden...
// aplicando sólo para el Acto de Fiscalización y Fiscalización por
// Compulsa"; "Número de Trámite... aplicando sólo para Devolución y
// Compensación").
//
// El cruce UUID/RFC contra CFDI SAT reutiliza el mismo criterio ya
// establecido en polizasSat.repository.ts (Fase 8): normalizar a minúsculas
// antes de comparar, sin modificar el dato capturado.
// ---------------------------------------------------------------------------

export type TipoSolicitudPolizas = 'AF' | 'FC' | 'DE' | 'CO';

export type EstadoMovimientoPolizaXml =
  | 'correcto'
  | 'uuid_no_encontrado'
  | 'cfdi_cancelado'
  | 'rfc_no_coincide'
  | 'uuid_sin_rfc'
  | 'sin_uuid'
  | 'error';

export interface ErrorPolizaXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaPolizaXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface MovimientoPolizaXml {
  renglon: number;
  cuenta: string | null;
  descripcion: string | null;
  concepto: string | null;
  debe: number;
  haber: number;
  uuid_cfdi: string | null;
  rfc: string | null;
  cfdi_encontrado: boolean;
  estatus_sat: string | null;
  estado: EstadoMovimientoPolizaXml;
  motivo: string | null;
  // Campos internos usados por el builder para el nodo CompNal (viajan en
  // el JSON de preview también, por si el frontend los necesita a futuro).
  incluir_comprobante: boolean;
  monto_cfdi: number | null;
  moneda_cfdi: string | null;
  rfc_comprobante: string | null;
}

export interface PolizaXml {
  poliza_id: number;
  tipo: string;
  numero: number;
  fecha: string;
  concepto: string;
  num_un_iden_pol: string;
  movimientos: MovimientoPolizaXml[];
}

export interface PolizasPeriodoXmlResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_solicitud: TipoSolicitudPolizas;
  num_orden: string | null;
  num_tramite: string | null;
  resumen: {
    polizas: number;
    movimientos: number;
    comprobantes: number;
    errores: number;
    advertencias: number;
  };
  polizas: PolizaXml[];
  errores: ErrorPolizaXml[];
  advertencias: AdvertenciaPolizaXml[];
}

interface FilaMovimiento {
  poliza_id: number;
  tipo_poliza: string;
  numero: number;
  fecha: string;
  observaciones: string | null;
  referencia: string | null;
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
  moneda_cfdi: string | null;
  tipo_descarga: string | null;
}

// Mismo patrón de RFC "de formato básico" que catalogoCuentasXml.repository.ts
// / balanzaComprobacionXml.repository.ts.
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
// Patrón UUID exigido por el XSD para CompNal/UUID_CFDI (formato estándar,
// sin validar versión/variante del UUID).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Misma heurística SUAVE que polizasSat.repository.ts (Fase 8): no bloquea,
// solo advierte. No se combina con más condiciones para no volverla agresiva.
function pareceCuentaProveedorOCliente(codigoAgrupador: string | null, descripcion: string | null): boolean {
  const codigo = codigoAgrupador?.trim() ?? '';
  if (codigo.startsWith('105') || codigo.startsWith('201')) return true;
  const desc = (descripcion ?? '').toLowerCase();
  return desc.includes('proveedor') || desc.includes('cliente');
}

// Resuelve el RFC del "tercero" para el nodo CompNal: si el RFC capturado en
// polizas_detalle ya coincide con emisor o receptor, se usa tal cual (ya
// validado). Si no, se deriva de tipo_descarga: en un CFDI "recibido" el
// tercero es el emisor; en uno "emitido", el tercero es el receptor. Ninguna
// de las dos rutas inventa un RFC: ambas usan datos reales ya existentes en
// core.cfdi_sat_comprobantes.
function resolverRfcComprobante(f: FilaMovimiento): string | null {
  const rfcCapturado = f.rfc?.trim().toUpperCase() || null;
  const emisor = f.rfc_emisor?.trim().toUpperCase() || null;
  const receptor = f.rfc_receptor?.trim().toUpperCase() || null;
  if (rfcCapturado && (rfcCapturado === emisor || rfcCapturado === receptor)) return rfcCapturado;
  if (f.tipo_descarga === 'recibidos') return emisor;
  if (f.tipo_descarga === 'emitidos') return receptor;
  return rfcCapturado || emisor || receptor || null;
}

async function obtenerEmpresa(empresaId: number): Promise<{ rfc: string; razon_social: string }> {
  const { rows } = await pool.query<{ rfc: string | null; razon_social: string | null }>(
    `SELECT rfc, razon_social FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const row = rows[0];
  return { rfc: row?.rfc?.trim() ?? '', razon_social: row?.razon_social?.trim() ?? '' };
}

// Validación 8: pólizas aplicadas descuadradas (defensivo — mismo criterio
// que en eContabilidad.repository.ts / balanzaComprobacionXml.repository.ts).
async function validarPolizasDescuadradas(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorPolizaXml[]> {
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
  return rows.map((r) => ({
    tipo: 'poliza_descuadrada',
    poliza: `${r.tipo} ${r.numero}`,
    motivo: 'Póliza aplicada descuadrada (cargos ≠ abonos); no puede incluirse en el XML de pólizas.',
  }));
}

// Validación 9: pólizas aplicadas sin movimientos.
async function validarPolizasSinMovimientos(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorPolizaXml[]> {
  const { rows } = await pool.query(
    `SELECT p.numero, tp.identificador AS tipo
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

async function obtenerMovimientos(empresaId: number, ejercicio: number, periodo: number): Promise<FilaMovimiento[]> {
  const { rows } = await pool.query(
    `SELECT p.id AS poliza_id, tp.identificador AS tipo_poliza, p.numero,
       to_char(p.fecha, 'YYYY-MM-DD') AS fecha, p.observaciones, p.referencia,
       pd.renglon, pd.cuenta_id, c.cuenta, c.descripcion AS descripcion_cuenta,
       c.activa AS cuenta_activa, c.afectable AS cuenta_afectable, c.codigo_agrupador_sat,
       co.nombre_concepto AS concepto,
       pd.cargo, pd.abono, pd.uuid_cfdi, pd.rfc,
       cc.uuid AS cfdi_uuid, cc.estatus_sat, cc.rfc_emisor, cc.rfc_receptor,
       cc.total AS total_cfdi, cc.moneda AS moneda_cfdi, cc.tipo_descarga
     FROM contabilidad.polizas p
     JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
     JOIN contabilidad.polizas_detalle pd ON pd.poliza_id = p.id
     LEFT JOIN contabilidad.cuentas c ON c.id = pd.cuenta_id AND c.empresa_id = p.empresa_id
     LEFT JOIN public.conceptos co ON co.id = pd.concepto_id
     LEFT JOIN core.cfdi_sat_comprobantes cc
       ON cc.empresa_id = p.empresa_id AND pd.uuid_cfdi IS NOT NULL AND lower(cc.uuid) = lower(pd.uuid_cfdi::text)
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
     ORDER BY p.fecha ASC, tp.identificador ASC, p.numero ASC, pd.renglon ASC`,
    [empresaId, ejercicio, periodo]
  );
  return rows;
}

export async function construirPolizasPeriodoXml(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<PolizasPeriodoXmlResultado> {
  const errores: ErrorPolizaXml[] = [];
  const advertencias: AdvertenciaPolizaXml[] = [];

  // 1/2) Empresa: RFC y razón social.
  const empresa = await obtenerEmpresa(empresaId);
  if (!empresa.rfc) {
    errores.push({ tipo: 'empresa_sin_rfc', motivo: 'La empresa no tiene RFC configurado.' });
  } else if (!RFC_REGEX.test(empresa.rfc)) {
    errores.push({ tipo: 'empresa_rfc_invalido', motivo: `El RFC "${empresa.rfc}" no tiene un formato válido.` });
  }

  const [errPolizasDescuadradas, errPolizasSinMovimientos, filas] = await Promise.all([
    validarPolizasDescuadradas(empresaId, ejercicio, periodo),
    validarPolizasSinMovimientos(empresaId, ejercicio, periodo),
    obtenerMovimientos(empresaId, ejercicio, periodo),
  ]);
  errores.push(...errPolizasDescuadradas, ...errPolizasSinMovimientos);

  const polizasPorId = new Map<number, PolizaXml>();
  const ordenPolizas: number[] = [];
  let totalComprobantes = 0;

  for (const f of filas) {
    const identificadorPoliza = `${f.tipo_poliza} ${f.numero}`;
    let poliza = polizasPorId.get(f.poliza_id);
    if (!poliza) {
      const concepto = f.observaciones?.trim() || f.referencia?.trim() || identificadorPoliza;
      poliza = {
        poliza_id: Number(f.poliza_id),
        tipo: f.tipo_poliza,
        numero: Number(f.numero),
        fecha: f.fecha,
        concepto,
        num_un_iden_pol: identificadorPoliza,
        movimientos: [],
      };
      polizasPorId.set(f.poliza_id, poliza);
      ordenPolizas.push(f.poliza_id);
    }

    const cargo = Number(f.cargo);
    const abono = Number(f.abono);

    // Validaciones 10-13: cuenta.
    const sinCuenta = f.cuenta_id == null;
    const cuentaInexistente = !sinCuenta && f.cuenta == null;
    const cuentaInactiva = !sinCuenta && !cuentaInexistente && f.cuenta_activa === false;
    const cuentaNoAfectable = !sinCuenta && !cuentaInexistente && !cuentaInactiva && f.cuenta_afectable === false;

    if (sinCuenta) {
      errores.push({ tipo: 'movimiento_sin_cuenta', poliza: identificadorPoliza, motivo: 'El movimiento no tiene cuenta asignada.' });
    } else if (cuentaInexistente) {
      errores.push({ tipo: 'movimiento_cuenta_inexistente', poliza: identificadorPoliza, motivo: 'La cuenta del movimiento no existe o no pertenece a esta empresa.' });
    } else if (cuentaInactiva) {
      errores.push({ tipo: 'movimiento_cuenta_inactiva', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: 'La cuenta del movimiento está inactiva.' });
    } else if (cuentaNoAfectable) {
      errores.push({ tipo: 'movimiento_cuenta_no_afectable', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: 'La cuenta del movimiento no es afectable (tiene subcuentas).' });
    }
    const cuentaValida = !sinCuenta && !cuentaInexistente && !cuentaInactiva && !cuentaNoAfectable;

    // Validación 14: concepto/descripción suficiente para el nodo Transaccion.
    const sinConcepto = !f.concepto?.trim();
    if (sinConcepto) {
      errores.push({
        tipo: 'movimiento_sin_concepto',
        poliza: identificadorPoliza,
        cuenta: f.cuenta ?? undefined,
        motivo: 'El movimiento no tiene concepto/descripción capturado; el XSD exige un Concepto de 1 a 200 caracteres por transacción.',
      });
    }

    // Validaciones 15-17: defensivas (la BD ya tiene CHECK cargo/abono
    // mutuamente excluyentes y >= 0; se revalida aquí porque este es el
    // límite de lo que se convierte en XML SAT, igual que las
    // revalidaciones defensivas de Catálogo/Balanza XML).
    if (cargo === 0 && abono === 0) {
      errores.push({ tipo: 'movimiento_importes_en_cero', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: 'El movimiento tiene cargo y haber en cero.' });
    }
    if (cargo > 0 && abono > 0) {
      errores.push({ tipo: 'movimiento_cargo_y_abono', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: 'El movimiento tiene cargo y haber mayores a cero simultáneamente.' });
    }
    if (cargo < 0 || abono < 0) {
      errores.push({ tipo: 'movimiento_importe_negativo', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: 'El movimiento tiene un importe negativo.' });
    }

    // Validaciones 18-19: formato de UUID/RFC capturados.
    const uuidFormatoValido = !f.uuid_cfdi || UUID_REGEX.test(f.uuid_cfdi);
    if (!uuidFormatoValido) {
      errores.push({ tipo: 'uuid_formato_invalido', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: `El UUID CFDI "${f.uuid_cfdi}" no tiene un formato válido.` });
    }
    const rfcFormatoValido = !f.rfc || RFC_REGEX.test(f.rfc);
    if (!rfcFormatoValido) {
      errores.push({ tipo: 'rfc_formato_invalido', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: `El RFC "${f.rfc}" no tiene un formato válido.` });
    }

    // ── Cruce CFDI SAT (mismo criterio que Fase 8) ──────────────────────
    const tieneUuid = !!f.uuid_cfdi && uuidFormatoValido;
    const tieneRfc = !!f.rfc?.trim() && rfcFormatoValido;
    let estado: EstadoMovimientoPolizaXml = 'correcto';
    let motivoFila: string | null = null;
    const cfdiEncontrado = tieneUuid && f.cfdi_uuid != null;

    if (!cuentaValida || sinConcepto) {
      estado = 'error';
    } else if (tieneUuid) {
      if (!cfdiEncontrado) {
        estado = 'uuid_no_encontrado';
        motivoFila = 'UUID CFDI capturado no encontrado en CFDI SAT.';
        advertencias.push({ tipo: 'uuid_no_encontrado', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
      } else {
        const cancelado = f.estatus_sat === 'cancelado';
        let rfcCoincide: boolean | null = null;
        if (tieneRfc) {
          const rfcNorm = f.rfc!.trim().toUpperCase();
          const emisor = f.rfc_emisor?.trim().toUpperCase() ?? '';
          const receptor = f.rfc_receptor?.trim().toUpperCase() ?? '';
          rfcCoincide = rfcNorm === emisor || rfcNorm === receptor;
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

    // ── Nodo CompNal: solo si hay datos suficientes y verídicos ─────────
    // (UUID válido + encontrado + MontoTotal real del CFDI + RFC
    // resoluble). Si la moneda es distinta de MXN, el XSD exige TipCamb,
    // dato que Emphasys no captura hoy (core.cfdi_sat_comprobantes no
    // tiene tipo de cambio) -> se omite el nodo y se advierte (validación
    // de advertencia 7), en vez de generar un nodo con TipCamb inventado.
    const montoCfdi = f.total_cfdi != null ? Number(f.total_cfdi) : null;
    const monedaCfdi = f.moneda_cfdi ?? null;
    const rfcComprobante = cfdiEncontrado ? resolverRfcComprobante(f) : null;
    const monedaExtranjeraSinTipoCambio = !!monedaCfdi && monedaCfdi.toUpperCase() !== 'MXN';
    if (cfdiEncontrado && monedaExtranjeraSinTipoCambio) {
      advertencias.push({
        tipo: 'cfdi_sin_tipo_cambio',
        poliza: identificadorPoliza,
        cuenta: f.cuenta ?? undefined,
        motivo: `El CFDI está en moneda "${monedaCfdi}" y el XSD exige tipo de cambio; Emphasys no tiene ese dato capturado, no se incluye el comprobante en el XML.`,
      });
    }
    const incluirComprobante = cfdiEncontrado && montoCfdi != null && !!rfcComprobante && !monedaExtranjeraSinTipoCambio;
    if (incluirComprobante) totalComprobantes += 1;

    poliza.movimientos.push({
      renglon: Number(f.renglon),
      cuenta: f.cuenta,
      descripcion: f.descripcion_cuenta,
      concepto: f.concepto,
      debe: cargo,
      haber: abono,
      uuid_cfdi: f.uuid_cfdi,
      rfc: f.rfc,
      cfdi_encontrado: cfdiEncontrado,
      estatus_sat: f.estatus_sat,
      estado,
      motivo: motivoFila,
      incluir_comprobante: incluirComprobante,
      monto_cfdi: incluirComprobante ? montoCfdi : null,
      moneda_cfdi: incluirComprobante ? monedaCfdi : null,
      rfc_comprobante: incluirComprobante ? rfcComprobante : null,
    });
  }

  // Advertencia 8: pólizas sin ningún CFDI relacionado en ninguno de sus
  // movimientos (informativo, no bloquea).
  for (const polizaId of ordenPolizas) {
    const poliza = polizasPorId.get(polizaId)!;
    if (poliza.movimientos.length > 0 && poliza.movimientos.every((m) => !m.uuid_cfdi)) {
      advertencias.push({ tipo: 'poliza_sin_cfdi', poliza: poliza.num_un_iden_pol, motivo: 'Ninguno de los movimientos de esta póliza tiene CFDI relacionado.' });
    }
  }

  // Orden final: pólizas ya llegaron ordenadas por fecha/tipo/número desde
  // la consulta; se re-ordena en memoria para que la salida sea estable y
  // repetible sin depender solo del ORDER BY (mismo criterio que
  // Catálogo/Balanza XML). Los movimientos conservan su renglón original.
  const polizas = ordenPolizas.map((id) => polizasPorId.get(id)!);
  polizas.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo, 'es');
    return a.numero - b.numero;
  });

  // Duplicados de NumUnIdenPol: revalidación defensiva en memoria (aunque
  // la combinación tipo+número es única por construcción, ver comentario
  // en el archivo de referencia de esta fase).
  const vistos = new Set<string>();
  for (const p of polizas) {
    if (vistos.has(p.num_un_iden_pol)) {
      errores.push({ tipo: 'poliza_identificador_duplicado', poliza: p.num_un_iden_pol, motivo: `El identificador de póliza "${p.num_un_iden_pol}" está duplicado.` });
    }
    vistos.add(p.num_un_iden_pol);
  }

  const totalMovimientos = polizas.reduce((acc, p) => acc + p.movimientos.length, 0);

  return {
    ok: errores.length === 0,
    empresa,
    ejercicio,
    periodo,
    tipo_solicitud: tipoSolicitud,
    num_orden: (tipoSolicitud === 'AF' || tipoSolicitud === 'FC') ? numOrden : null,
    num_tramite: (tipoSolicitud === 'DE' || tipoSolicitud === 'CO') ? numTramite : null,
    resumen: {
      polizas: polizas.length,
      movimientos: totalMovimientos,
      comprobantes: totalComprobantes,
      errores: errores.length,
      advertencias: advertencias.length,
    },
    polizas,
    errores,
    advertencias,
  };
}
