import pool from '../../config/database';
import { TipoSolicitudPolizas } from './tipoSolicitudSat';

// ---------------------------------------------------------------------------
// Fase 10A de Contabilidad Electrónica: generación del XML de Auxiliar de
// folios fiscales (Anexo 24, esquema AuxiliarFolios versión 1.3). Esta capa
// NO construye el XML (ver auxiliarFoliosXml.builder.ts); arma la lista de
// folios (movimientos con UUID CFDI) y corre las validaciones bloqueantes/de
// advertencia.
//
// HALLAZGO IMPORTANTE verificado en el XSD oficial: a diferencia de lo que
// sugieren varias fuentes no oficiales, el nodo de comprobante del Auxiliar
// de folios (ComprNal, hijo de DetAuxFol) NO tiene atributos de cuenta
// contable, concepto ni cargo/abono -- solo UUID_CFDI, MontoTotal, RFC,
// MetPagoAux (opcional), Moneda (opcional) y TipCamb (opcional). DetAuxFol
// (por póliza) solo tiene NumUnIdenPol y Fecha. Es decir: el XML real es
// mucho más simple que el preview -- el preview conserva cuenta/concepto/
// cargo/abono por cada folio SOLO para que el usuario tenga contexto en
// pantalla (de dónde sale ese UUID), pero esos campos NO viajan al XML.
// Esto se documenta explícitamente para no generar expectativas equivocadas
// sobre el contenido real del archivo.
//
// El cruce UUID/RFC contra CFDI SAT reutiliza el mismo criterio ya
// establecido en polizasSat.repository.ts / polizasPeriodoXml.repository.ts
// (Fases 8/9): normalizar a minúsculas antes de comparar, sin modificar el
// dato capturado.
// ---------------------------------------------------------------------------

export type EstadoFolioXml = 'correcto' | 'uuid_no_encontrado' | 'cfdi_cancelado' | 'rfc_no_coincide' | 'uuid_sin_rfc' | 'error';

export interface ErrorFolioXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface AdvertenciaFolioXml {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

export interface FolioXml {
  uuid_cfdi: string;
  rfc: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: number | null;
  moneda: string | null;
  estatus_sat: string | null;
  poliza: string;
  fecha: string;
  renglon: number;
  cuenta: string | null;
  descripcion_cuenta: string | null;
  concepto: string | null;
  cargo: number;
  abono: number;
  estado: EstadoFolioXml;
  motivo: string | null;
  // Campos internos para el builder (nodo ComprNal): si el folio no reúne
  // datos suficientes/válidos, no se incluye en el XML aunque sí se muestre
  // en el preview (criterio explícito del pedido: no bloquear la
  // generación solo por folios incompletos).
  incluir_en_xml: boolean;
  rfc_comprobante: string | null;
}

export interface AuxiliarFoliosResultado {
  ok: boolean;
  empresa: { rfc: string; razon_social: string };
  ejercicio: number;
  periodo: number;
  tipo_solicitud: TipoSolicitudPolizas;
  num_orden: string | null;
  num_tramite: string | null;
  resumen: {
    folios: number;
    polizas: number;
    movimientos: number;
    uuid_encontrados: number;
    uuid_no_encontrados: number;
    cfdi_cancelados: number;
    errores: number;
    advertencias: number;
  };
  folios: FolioXml[];
  errores: ErrorFolioXml[];
  advertencias: AdvertenciaFolioXml[];
}

interface FilaFolio {
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
  concepto: string | null;
  cargo: string;
  abono: string;
  uuid_cfdi: string;
  rfc: string | null;
  cfdi_uuid: string | null;
  estatus_sat: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total_cfdi: string | null;
  moneda_cfdi: string | null;
  tipo_descarga: string | null;
}

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Misma resolución que polizasPeriodoXml.repository.ts: si el RFC capturado
// ya coincide con emisor o receptor se usa tal cual; si no, se deriva de
// tipo_descarga (recibidos->emisor, emitidos->receptor). Nunca se inventa.
function resolverRfcComprobante(f: FilaFolio): string | null {
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

// Validación 9: pólizas aplicadas descuadradas (defensivo, mismo criterio
// que en Balanza/Pólizas XML).
async function validarPolizasDescuadradas(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorFolioXml[]> {
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
    motivo: 'Póliza aplicada descuadrada (cargos ≠ abonos); no puede incluirse en el auxiliar de folios.',
  }));
}

// Validación 10: pólizas aplicadas sin movimientos (defensivo).
async function validarPolizasSinMovimientos(empresaId: number, ejercicio: number, periodo: number): Promise<ErrorFolioXml[]> {
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
    motivo: 'Póliza aplicada sin movimientos.',
  }));
}

// Advertencia 5 ("RFC sin UUID"): por diseño el auxiliar de folios solo
// incluye movimientos QUE SÍ tienen UUID (criterio explícito del pedido),
// así que esta condición no puede aparecer como fila de `folios`. Se
// reporta como advertencia agregada (conteo), igual que ya se hizo con
// "cuentas_incluidas_en_cero" en Balanza XML, para no violar ese criterio
// y aun así informar al usuario.
async function contarMovimientosRfcSinUuid(empresaId: number, ejercicio: number, periodo: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM contabilidad.polizas p
     JOIN contabilidad.polizas_detalle pd ON pd.poliza_id = p.id
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND pd.uuid_cfdi IS NULL AND pd.rfc IS NOT NULL AND btrim(pd.rfc) <> ''`,
    [empresaId, ejercicio, periodo]
  );
  return Number(rows[0]?.count ?? 0);
}

async function obtenerFolios(empresaId: number, ejercicio: number, periodo: number): Promise<FilaFolio[]> {
  const { rows } = await pool.query(
    `SELECT p.id AS poliza_id, tp.identificador AS tipo_poliza, p.numero,
       to_char(p.fecha, 'YYYY-MM-DD') AS fecha,
       pd.renglon, pd.cuenta_id, c.cuenta, c.descripcion AS descripcion_cuenta,
       c.activa AS cuenta_activa, c.afectable AS cuenta_afectable,
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
       ON cc.empresa_id = p.empresa_id AND lower(cc.uuid) = lower(pd.uuid_cfdi::text)
     WHERE p.empresa_id = $1 AND p.ejercicio = $2 AND p.periodo = $3 AND p.estatus = 'aplicada'
       AND pd.uuid_cfdi IS NOT NULL
     ORDER BY pd.uuid_cfdi ASC, p.fecha ASC, tp.identificador ASC, p.numero ASC, pd.renglon ASC`,
    [empresaId, ejercicio, periodo]
  );
  return rows;
}

export async function construirAuxiliarFoliosXml(
  empresaId: number,
  ejercicio: number,
  periodo: number,
  tipoSolicitud: TipoSolicitudPolizas,
  numOrden: string | null,
  numTramite: string | null
): Promise<AuxiliarFoliosResultado> {
  const errores: ErrorFolioXml[] = [];
  const advertencias: AdvertenciaFolioXml[] = [];

  const empresa = await obtenerEmpresa(empresaId);
  if (!empresa.rfc) {
    errores.push({ tipo: 'empresa_sin_rfc', motivo: 'La empresa no tiene RFC configurado.' });
  } else if (!RFC_REGEX.test(empresa.rfc)) {
    errores.push({ tipo: 'empresa_rfc_invalido', motivo: `El RFC "${empresa.rfc}" no tiene un formato válido.` });
  }

  const [errDescuadradas, errSinMovimientos, filas, rfcSinUuidCount] = await Promise.all([
    validarPolizasDescuadradas(empresaId, ejercicio, periodo),
    validarPolizasSinMovimientos(empresaId, ejercicio, periodo),
    obtenerFolios(empresaId, ejercicio, periodo),
    contarMovimientosRfcSinUuid(empresaId, ejercicio, periodo),
  ]);
  errores.push(...errDescuadradas, ...errSinMovimientos);

  if (rfcSinUuidCount > 0) {
    advertencias.push({
      tipo: 'rfc_sin_uuid',
      motivo: `${rfcSinUuidCount} movimiento(s) del periodo tienen RFC capturado pero no UUID CFDI; no se incluyen en el auxiliar de folios (solo aplica a movimientos con UUID).`,
    });
  }

  const folios: FolioXml[] = [];
  const polizasSet = new Set<number>();
  let uuidEncontrados = 0;
  let uuidNoEncontrados = 0;
  let cfdiCancelados = 0;

  for (const f of filas) {
    const identificadorPoliza = `${f.tipo_poliza} ${f.numero}`;
    polizasSet.add(f.poliza_id);
    const cargo = Number(f.cargo);
    const abono = Number(f.abono);

    // Validación 7: formato de UUID.
    const uuidFormatoValido = UUID_REGEX.test(f.uuid_cfdi);
    if (!uuidFormatoValido) {
      errores.push({ tipo: 'uuid_formato_invalido', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: `El UUID CFDI "${f.uuid_cfdi}" no tiene un formato válido.` });
    }

    // Validación 8: movimiento con UUID pero sin cuenta válida.
    const cuentaValida = f.cuenta_id != null && f.cuenta != null && f.cuenta_activa !== false && f.cuenta_afectable !== false;
    if (!cuentaValida) {
      const motivo =
        f.cuenta_id == null || f.cuenta == null
          ? 'La cuenta del movimiento no existe o no pertenece a esta empresa.'
          : f.cuenta_activa === false
          ? 'La cuenta del movimiento está inactiva.'
          : 'La cuenta del movimiento no es afectable (tiene subcuentas).';
      errores.push({ tipo: 'movimiento_uuid_sin_cuenta_valida', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo });
    }

    // Cruce CFDI SAT (mismo criterio de Fases 8/9).
    const cfdiEncontrado = uuidFormatoValido && f.cfdi_uuid != null;
    let estado: EstadoFolioXml = 'correcto';
    let motivoFila: string | null = null;

    if (!uuidFormatoValido || !cuentaValida) {
      estado = 'error';
    } else if (!cfdiEncontrado) {
      uuidNoEncontrados += 1;
      estado = 'uuid_no_encontrado';
      motivoFila = 'UUID CFDI capturado no encontrado en CFDI SAT.';
      advertencias.push({ tipo: 'uuid_no_encontrado', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: motivoFila });
    } else {
      uuidEncontrados += 1;
      const cancelado = f.estatus_sat === 'cancelado';
      if (cancelado) cfdiCancelados += 1;

      const tieneRfc = !!f.rfc?.trim();
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

    // Advertencia 6/7: moneda extranjera sin tipo de cambio / CFDI sin total.
    const totalCfdi = f.total_cfdi != null ? Number(f.total_cfdi) : null;
    const monedaCfdi = f.moneda_cfdi ?? null;
    const rfcComprobante = cfdiEncontrado ? resolverRfcComprobante(f) : null;
    if (cfdiEncontrado && totalCfdi == null) {
      advertencias.push({ tipo: 'cfdi_sin_total', poliza: identificadorPoliza, cuenta: f.cuenta ?? undefined, motivo: 'El CFDI encontrado no tiene monto total registrado; no se puede incluir en el XML (MontoTotal es requerido).' });
    }
    const monedaExtranjeraSinTipoCambio = !!monedaCfdi && monedaCfdi.toUpperCase() !== 'MXN';
    if (cfdiEncontrado && monedaExtranjeraSinTipoCambio) {
      advertencias.push({
        tipo: 'cfdi_sin_tipo_cambio',
        poliza: identificadorPoliza,
        cuenta: f.cuenta ?? undefined,
        motivo: `El CFDI está en moneda "${monedaCfdi}"; Emphasys no captura tipo de cambio, por lo que Moneda/TipCamb se omiten del comprobante en el XML.`,
      });
    }

    const incluirEnXml = uuidFormatoValido && cuentaValida && cfdiEncontrado && totalCfdi != null && !!rfcComprobante;

    folios.push({
      uuid_cfdi: f.uuid_cfdi,
      rfc: f.rfc,
      rfc_emisor: f.rfc_emisor,
      rfc_receptor: f.rfc_receptor,
      total_cfdi: totalCfdi,
      moneda: monedaCfdi,
      estatus_sat: f.estatus_sat,
      poliza: identificadorPoliza,
      fecha: f.fecha,
      renglon: Number(f.renglon),
      cuenta: f.cuenta,
      descripcion_cuenta: f.descripcion_cuenta,
      concepto: f.concepto,
      cargo,
      abono,
      estado,
      motivo: motivoFila,
      incluir_en_xml: incluirEnXml,
      rfc_comprobante: incluirEnXml ? rfcComprobante : null,
    });
  }

  return {
    ok: errores.length === 0,
    empresa,
    ejercicio,
    periodo,
    tipo_solicitud: tipoSolicitud,
    num_orden: (tipoSolicitud === 'AF' || tipoSolicitud === 'FC') ? numOrden : null,
    num_tramite: (tipoSolicitud === 'DE' || tipoSolicitud === 'CO') ? numTramite : null,
    resumen: {
      folios: folios.length,
      polizas: polizasSet.size,
      movimientos: folios.length,
      uuid_encontrados: uuidEncontrados,
      uuid_no_encontrados: uuidNoEncontrados,
      cfdi_cancelados: cfdiCancelados,
      errores: errores.length,
      advertencias: advertencias.length,
    },
    folios,
    errores,
    advertencias,
  };
}
