import type { PoolClient } from 'pg';
import pool from '../../config/database';
import { resolverCuentaContable, type CuentaResuelta } from './configuracionCuentasContables.repository';
import { obtenerOCrearConfiguracion } from './configuracion.repository';
import { obtenerTipoPolizaAutomatico } from './configuracionTiposAutomaticos.repository';
import {
  crearPolizaConMovimientos,
  obtenerPolizaPorId,
  listarMovimientosPoliza,
  type PolizaEncabezado,
  type PolizaMovimientoInput,
} from './polizas.repository';
import {
  registrarContabilizacion,
  registrarReversa,
  estaContabilizado,
  obtenerContabilizacionPorId,
  type Contabilizacion,
  type ModoContabilizacion,
} from './contabilizaciones.repository';

// ---------------------------------------------------------------------------
// Fase 1 del motor de contabilización automática: solo factura de venta
// estándar, evento "emision". No toca compras, cobros, pagos, inventario ni
// notas de crédito.
// ---------------------------------------------------------------------------

export class CuentaFaltanteError extends Error {
  faltantes: Array<{ uso_contable: string; contexto: string }>;

  constructor(faltantes: Array<{ uso_contable: string; contexto: string }>) {
    super('VALIDATION_ERROR: Faltan cuentas contables configuradas para contabilizar esta factura.');
    this.name = 'CuentaFaltanteError';
    this.faltantes = faltantes;
  }
}

interface FacturaVentaDocumento {
  id: number;
  empresa_id: number;
  tipo_documento: string;
  estatus_documento: string;
  tratamiento_impuestos: string;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  fecha_cancelacion: string | null;
  contacto_principal_id: number | null;
  cliente_nombre: string | null;
  subtotal: number;
  total: number;
  timbrada: boolean;
}

interface PartidaVenta {
  id: number;
  producto_id: number | null;
  subtotal_partida: number;
  producto_familia: string | null;
  producto_linea: string | null;
  producto_clasificacion: string | null;
  producto_tipo: string | null;
}

interface PartidaImpuesto {
  partida_id: number;
  impuesto_id: string;
  nombre: string | null;
  tipo: string;
  tasa: number;
  monto: number;
}

interface DatosFacturaVenta {
  doc: FacturaVentaDocumento;
  partidas: PartidaVenta[];
  impuestos: PartidaImpuesto[];
}

export interface MovimientoAsiento {
  cuenta_id: number;
  cuenta: string;
  descripcion: string;
  cargo: number;
  abono: number;
  origen: string;
  concepto: string;
}

export interface AsientoFacturaVenta {
  documento_id: number;
  folio: string;
  fecha_documento: string;
  movimientos: MovimientoAsiento[];
  total_cargos: number;
  total_abonos: number;
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function folioDeDocumento(doc: Pick<FacturaVentaDocumento, 'serie' | 'numero' | 'id'>): string {
  if (doc.serie) return `${doc.serie}-${String(doc.numero ?? '').padStart(3, '0')}`;
  if (doc.numero != null) return String(doc.numero);
  return `#${doc.id}`;
}

const MESES_ES = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
] as const;

// grupo.clave (y la clave de periodo del estado-contable) usan 'YYYY-MM'.
function formatearPeriodoMes(claveAnioMes: string): string {
  const [anio, mes] = claveAnioMes.split('-');
  const nombreMes = MESES_ES[Number(mes) - 1] ?? mes;
  return `${nombreMes} ${anio}`;
}

// impuestos.tasa/documentos_partidas_impuestos.tasa no documentan si es
// fracción (0.16) o porcentaje (16); se asume fracción cuando es <= 1 (caso
// típico de tasas de IVA/IEPS en México) y se formatea sin decimales
// sobrantes (16, no 16.00; 8.5 si aplica).
function formatearTasaPorcentaje(tasa: number): string {
  const pct = tasa <= 1 ? tasa * 100 : tasa;
  return String(Math.round(pct * 100) / 100);
}

type FinalidadTipoPolizaVenta = 'factura' | 'cancelacion';

const MENSAJES_TIPO_POLIZA_FALTANTE: Record<FinalidadTipoPolizaVenta, string> = {
  factura: 'No está configurado el tipo de póliza para facturas de venta.',
  cancelacion: 'No está configurado el tipo de póliza para cancelaciones de factura de venta.',
};

const CLAVE_MOVIMIENTO_POR_FINALIDAD: Record<FinalidadTipoPolizaVenta, 'venta_factura' | 'venta_factura_cancelacion'> = {
  factura: 'venta_factura',
  cancelacion: 'venta_factura_cancelacion',
};

// El tipo de póliza ya no se pregunta en cada operación: se resuelve desde
// contabilidad.configuracion_tipos_automaticos (clave venta_factura /
// venta_factura_cancelacion), vía el helper centralizado
// obtenerTipoPolizaAutomatico. Un tipo_poliza_id explícito (endpoint llamado
// directamente, o UI antigua) sigue funcionando como override, para no
// romper integraciones existentes, pero el flujo principal de la UI ya no lo
// envía.
async function resolverTipoPolizaVenta(
  empresaId: number,
  finalidad: FinalidadTipoPolizaVenta,
  tipoPolizaIdExplicito?: number | null
): Promise<number> {
  if (tipoPolizaIdExplicito != null) return Number(tipoPolizaIdExplicito);

  const configurado = await obtenerTipoPolizaAutomatico(empresaId, CLAVE_MOVIMIENTO_POR_FINALIDAD[finalidad]);

  if (configurado == null) {
    throw new Error(`VALIDATION_ERROR: ${MENSAJES_TIPO_POLIZA_FALTANTE[finalidad]}`);
  }
  return configurado;
}

async function obtenerDatosFactura(empresaId: number, documentoId: number): Promise<DatosFacturaVenta | null> {
  const { rows: docRows } = await pool.query(
    `SELECT d.id, d.empresa_id, d.tipo_documento, d.estatus_documento, d.tratamiento_impuestos,
            d.serie, d.numero, to_char(d.fecha_documento, 'YYYY-MM-DD') AS fecha_documento,
            to_char(d.fecha_cancelacion, 'YYYY-MM-DD') AS fecha_cancelacion,
            d.contacto_principal_id, ct.nombre AS cliente_nombre, d.subtotal, d.total,
            EXISTS(SELECT 1 FROM public.documentos_cfdi c WHERE c.documento_id = d.id) AS timbrada
       FROM public.documentos d
       LEFT JOIN public.contactos ct ON ct.id = d.contacto_principal_id
      WHERE d.id = $1 AND d.empresa_id = $2`,
    [documentoId, empresaId]
  );
  const doc = docRows[0] as FacturaVentaDocumento | undefined;
  if (!doc) return null;

  const { rows: partidas } = await pool.query<PartidaVenta>(
    `SELECT dp.id, dp.producto_id, dp.subtotal_partida,
            p.familia AS producto_familia, p.linea AS producto_linea,
            p.clasificacion AS producto_clasificacion, p.tipo_producto AS producto_tipo
       FROM public.documentos_partidas dp
       LEFT JOIN public.productos p ON p.id = dp.producto_id
      WHERE dp.documento_id = $1
      ORDER BY dp.id`,
    [documentoId]
  );

  let impuestos: PartidaImpuesto[] = [];
  if (partidas.length > 0) {
    const partidaIds = partidas.map((p) => p.id);
    const { rows } = await pool.query<PartidaImpuesto>(
      `SELECT dpi.partida_id, dpi.impuesto_id, dpi.tasa, dpi.monto, i.nombre, i.tipo
         FROM public.documentos_partidas_impuestos dpi
         JOIN public.impuestos i ON i.id = dpi.impuesto_id
        WHERE dpi.partida_id = ANY($1::int[])`,
      [partidaIds]
    );
    impuestos = rows;
  }

  return { doc, partidas, impuestos };
}

// Reglas de elegibilidad (fase 1, solo emisión de factura de venta estándar):
// - Solo tipo_documento = factura.
// - No cancelada.
// - tratamiento_impuestos = normal (sin_iva es nota de venta y no se
//   contabiliza; tasa_cero/exento/venta_publico_general/factura_global quedan
//   fuera de alcance de esta fase, no se asume su tratamiento contable).
// - Timbrada, salvo que la empresa tenga permitir_venta_no_timbrada = true.
// - No contabilizada ya para evento_contable = emision.
//
// TODO(periodos contables): cuando exista un módulo de apertura/cierre de
// periodos, aquí debe validarse que el periodo de fecha_documento esté
// abierto. Hoy no existe esa lógica en el proyecto y no se inventa aquí.
async function validarElegibilidadFacturaVenta(empresaId: number, doc: FacturaVentaDocumento): Promise<void> {
  if (String(doc.tipo_documento ?? '').trim().toLowerCase() !== 'factura') {
    throw new Error('VALIDATION_ERROR: Solo se pueden contabilizar documentos de tipo factura.');
  }

  const estatus = String(doc.estatus_documento ?? '').trim().toLowerCase();
  if (estatus === 'borrador') {
    throw new Error('VALIDATION_ERROR: La factura está en borrador y no puede contabilizarse.');
  }
  if (estatus === 'cancelado' || estatus === 'cancelada') {
    throw new Error('VALIDATION_ERROR: La factura está cancelada y no puede contabilizarse.');
  }

  const tratamiento = String(doc.tratamiento_impuestos ?? '').trim().toLowerCase();
  if (tratamiento === 'sin_iva') {
    throw new Error('VALIDATION_ERROR: Las notas de venta (tratamiento sin_iva) no se contabilizan.');
  }
  if (tratamiento !== 'normal') {
    throw new Error(
      `VALIDATION_ERROR: El tratamiento fiscal "${doc.tratamiento_impuestos}" no está soportado todavía por la contabilización automática. Por ahora solo se contabilizan facturas con tratamiento normal.`
    );
  }

  if (!doc.timbrada) {
    const configuracion = await obtenerOCrearConfiguracion(empresaId);
    if (!configuracion.permitir_venta_no_timbrada) {
      throw new Error(
        'VALIDATION_ERROR: La factura no está timbrada. Actívelo explícitamente con permitir_venta_no_timbrada en la configuración contable de la empresa si necesita esta excepción.'
      );
    }
  }

  const yaContabilizada = await estaContabilizado(empresaId, { documento_id: doc.id }, 'emision');
  if (yaContabilizada) {
    throw new Error('VALIDATION_ERROR: La factura ya fue contabilizada para el evento de emisión.');
  }
}

type BucketImpuesto = 'iva_trasladado' | 'retencion_iva' | 'retencion_isr' | 'ieps';

// public.impuestos no distingue IVA/ISR/IEPS en una columna dedicada, solo
// "tipo" (traslado/retencion) y nombre libre. Se clasifica por texto en
// impuesto_id/nombre; si no se reconoce, se trata como cuenta faltante en vez
// de omitirlo silenciosamente (evita descuadrar o perder impuesto).
function clasificarImpuesto(impuestoId: string, nombre: string | null, tipo: string): BucketImpuesto | null {
  const texto = `${impuestoId} ${nombre ?? ''}`.toLowerCase();
  const esRetencion = String(tipo ?? '').trim().toLowerCase() === 'retencion';
  if (texto.includes('isr')) return 'retencion_isr';
  if (texto.includes('ieps')) return 'ieps';
  if (texto.includes('iva')) return esRetencion ? 'retencion_iva' : 'iva_trasladado';
  return null;
}

type DatosAcumulado = {
  cuenta: string;
  descripcion: string;
  cargo: number;
  abono: number;
  origenes: Set<string>;
  numPartidas: number;
  tasas: Set<number>;
  clienteNombre?: string;
};

type Acumulador = Map<number, DatosAcumulado>;

function acumular(
  mapa: Acumulador,
  cuenta: CuentaResuelta,
  monto: number,
  campo: 'cargo' | 'abono',
  origen: string,
  extra?: { incrementarPartidas?: boolean; tasa?: number; clienteNombre?: string | null }
): void {
  if (monto === 0) return;
  const actual = mapa.get(cuenta.cuenta_id) ?? {
    cuenta: cuenta.cuenta,
    descripcion: cuenta.descripcion,
    cargo: 0,
    abono: 0,
    origenes: new Set<string>(),
    numPartidas: 0,
    tasas: new Set<number>(),
  };
  actual[campo] += monto;
  actual.origenes.add(origen);
  if (extra?.incrementarPartidas) actual.numPartidas += 1;
  if (extra?.tasa != null) actual.tasas.add(extra.tasa);
  if (extra?.clienteNombre) actual.clienteNombre = extra.clienteNombre;
  mapa.set(cuenta.cuenta_id, actual);
}

// Concepto explícito por línea para que el detalle de póliza nunca quede en
// blanco. Cuando una cuenta agrupa más de un origen (config atípica: dos
// buckets distintos resolviendo a la misma cuenta) se usa un texto genérico,
// ya que no hay una sola frase que describa ambos con precisión.
function construirConceptoFactura(folio: string, datos: DatosAcumulado): string {
  if (datos.origenes.size !== 1) {
    return `Factura ${folio}`;
  }
  const [origen] = datos.origenes;
  switch (origen) {
    case 'cliente_cxc':
      return datos.clienteNombre ? `Factura ${folio} - Cliente ${datos.clienteNombre}` : `Factura ${folio} - Cliente`;
    case 'venta_producto': {
      const n = datos.numPartidas || 1;
      return `Factura ${folio} - Venta de ${n} partida${n === 1 ? '' : 's'}`;
    }
    case 'iva_trasladado':
      return datos.tasas.size === 1
        ? `Factura ${folio} - IVA trasladado ${formatearTasaPorcentaje([...datos.tasas][0])}%`
        : `Factura ${folio} - IVA trasladado varias tasas`;
    case 'ieps':
      return datos.tasas.size === 1
        ? `Factura ${folio} - IEPS ${formatearTasaPorcentaje([...datos.tasas][0])}%`
        : `Factura ${folio} - IEPS`;
    case 'retencion_iva':
      return `Factura ${folio} - Retención IVA`;
    case 'retencion_isr':
      return `Factura ${folio} - Retención ISR`;
    default:
      return `Factura ${folio}`;
  }
}

function construirConceptoConcentrado(periodoLabel: string, origenes: Set<string>): string {
  if (origenes.size !== 1) {
    return `Ventas concentradas ${periodoLabel}`;
  }
  const [origen] = origenes;
  switch (origen) {
    case 'cliente_cxc':
      return `Ventas concentradas ${periodoLabel} - Clientes`;
    case 'venta_producto':
      return `Ventas concentradas ${periodoLabel} - Ventas`;
    case 'iva_trasladado':
      return `Ventas concentradas ${periodoLabel} - IVA trasladado`;
    case 'ieps':
      return `Ventas concentradas ${periodoLabel} - IEPS`;
    case 'retencion_iva':
      return `Ventas concentradas ${periodoLabel} - Retención IVA`;
    case 'retencion_isr':
      return `Ventas concentradas ${periodoLabel} - Retención ISR`;
    default:
      return `Ventas concentradas ${periodoLabel}`;
  }
}

// Construye el asiento de emisión de factura de venta: cliente/CxC + retenciones
// como cargo, ventas + IVA trasladado + IEPS como abono. No toca inventario,
// costo de ventas, bancos/cajas ni cobros (fuera de alcance de esta fase).
async function construirAsientoFacturaVenta(
  empresaId: number,
  doc: FacturaVentaDocumento,
  partidas: PartidaVenta[],
  impuestos: PartidaImpuesto[]
): Promise<AsientoFacturaVenta> {
  const acumulado: Acumulador = new Map();
  const faltantes: Array<{ uso_contable: string; contexto: string }> = [];

  // 1) Cliente / CxC
  if (doc.contacto_principal_id == null) {
    faltantes.push({ uso_contable: 'cliente_cxc', contexto: 'La factura no tiene un cliente (contacto principal) asignado' });
  } else {
    const cuentaCliente = await resolverCuentaContable({
      empresaId,
      usoContable: 'cliente_cxc',
      contactoId: doc.contacto_principal_id,
    });
    if (!cuentaCliente) {
      faltantes.push({ uso_contable: 'cliente_cxc', contexto: `Cliente #${doc.contacto_principal_id}` });
    } else {
      acumular(acumulado, cuentaCliente, redondear(Number(doc.total)), 'cargo', 'cliente_cxc', {
        clienteNombre: doc.cliente_nombre,
      });
    }
  }

  // 2) Ventas por partida (subtotal_partida ya es neto de descuento de partida)
  const cuentaVentaPorProducto = new Map<number | 'sin_producto', CuentaResuelta | null>();
  for (const partida of partidas) {
    const monto = redondear(Number(partida.subtotal_partida));
    if (monto === 0) continue;

    const key = partida.producto_id ?? 'sin_producto';
    let cuentaVenta = cuentaVentaPorProducto.get(key);
    if (cuentaVenta === undefined) {
      cuentaVenta = await resolverCuentaContable({
        empresaId,
        usoContable: 'venta_producto',
        productoId: partida.producto_id ?? undefined,
        productoFamilia: partida.producto_familia ?? undefined,
        productoLinea: partida.producto_linea ?? undefined,
        productoClasificacion: partida.producto_clasificacion ?? undefined,
        productoTipo: partida.producto_tipo ?? undefined,
      });
      cuentaVentaPorProducto.set(key, cuentaVenta);
    }

    if (!cuentaVenta) {
      faltantes.push({
        uso_contable: 'venta_producto',
        contexto: partida.producto_id
          ? `Producto #${partida.producto_id} (partida #${partida.id})`
          : `Partida #${partida.id} sin producto asignado`,
      });
      continue;
    }
    acumular(acumulado, cuentaVenta, monto, 'abono', 'venta_producto', { incrementarPartidas: true });
  }

  // 3) Impuestos por partida: IVA trasladado, retención IVA, retención ISR, IEPS
  const montosPorBucketImpuesto = new Map<string, number>();
  const tasaPorBucketImpuesto = new Map<string, number>();
  for (const imp of impuestos) {
    const monto = redondear(Number(imp.monto));
    if (monto === 0) continue;
    const bucket = clasificarImpuesto(imp.impuesto_id, imp.nombre, imp.tipo);
    if (!bucket) {
      faltantes.push({
        uso_contable: 'impuesto_no_clasificado',
        contexto: `El impuesto "${imp.impuesto_id}" (partida #${imp.partida_id}) no pudo clasificarse en IVA trasladado, retención IVA, retención ISR o IEPS`,
      });
      continue;
    }
    const key = `${bucket}|${imp.impuesto_id}`;
    montosPorBucketImpuesto.set(key, redondear((montosPorBucketImpuesto.get(key) ?? 0) + monto));
    if (!tasaPorBucketImpuesto.has(key)) tasaPorBucketImpuesto.set(key, Number(imp.tasa ?? 0));
  }

  const cuentaImpuestoResuelta = new Map<string, CuentaResuelta | null>();
  for (const [key, monto] of montosPorBucketImpuesto) {
    const [bucket, impuestoId] = key.split('|') as [BucketImpuesto, string];
    let cuentaImpuesto = cuentaImpuestoResuelta.get(key);
    if (cuentaImpuesto === undefined) {
      cuentaImpuesto = await resolverCuentaContable({ empresaId, usoContable: bucket, impuestoId });
      cuentaImpuestoResuelta.set(key, cuentaImpuesto);
    }
    if (!cuentaImpuesto) {
      faltantes.push({ uso_contable: bucket, contexto: `Impuesto ${impuestoId}` });
      continue;
    }
    const campo: 'cargo' | 'abono' = bucket === 'retencion_iva' || bucket === 'retencion_isr' ? 'cargo' : 'abono';
    acumular(acumulado, cuentaImpuesto, monto, campo, bucket, { tasa: tasaPorBucketImpuesto.get(key) });
  }

  if (faltantes.length > 0) {
    throw new CuentaFaltanteError(faltantes);
  }

  // Neteo por cuenta: polizas_detalle no permite cargo y abono en la misma
  // línea, así que si una cuenta acumuló ambos (config atípica) se neta aquí.
  const folio = folioDeDocumento(doc);
  const movimientos: MovimientoAsiento[] = [];
  let totalCargos = 0;
  let totalAbonos = 0;
  for (const [cuentaId, datos] of acumulado) {
    const neto = redondear(datos.cargo - datos.abono);
    if (neto === 0) continue;
    const origen = [...datos.origenes].join(',');
    const concepto = construirConceptoFactura(folio, datos);
    if (neto > 0) {
      movimientos.push({ cuenta_id: cuentaId, cuenta: datos.cuenta, descripcion: datos.descripcion, cargo: neto, abono: 0, origen, concepto });
      totalCargos = redondear(totalCargos + neto);
    } else {
      movimientos.push({ cuenta_id: cuentaId, cuenta: datos.cuenta, descripcion: datos.descripcion, cargo: 0, abono: -neto, origen, concepto });
      totalAbonos = redondear(totalAbonos + -neto);
    }
  }

  if (Math.abs(totalCargos - totalAbonos) > 0.01) {
    throw new Error(
      `VALIDATION_ERROR: La póliza no cuadra (cargos ${totalCargos} vs abonos ${totalAbonos}). Puede deberse a un descuento global del documento, que esta fase todavía no distribuye entre cuentas.`
    );
  }

  return {
    documento_id: doc.id,
    folio,
    fecha_documento: doc.fecha_documento,
    movimientos,
    total_cargos: totalCargos,
    total_abonos: totalAbonos,
  };
}

export async function previsualizarFacturaVenta(empresaId: number, documentoId: number): Promise<AsientoFacturaVenta> {
  const datos = await obtenerDatosFactura(empresaId, documentoId);
  if (!datos) {
    throw new Error('VALIDATION_ERROR: La factura no existe en esta empresa.');
  }
  await validarElegibilidadFacturaVenta(empresaId, datos.doc);
  return construirAsientoFacturaVenta(empresaId, datos.doc, datos.partidas, datos.impuestos);
}

export type ContabilizarFacturaVentaInput = {
  // Override manual opcional; el flujo normal de UI ya no lo envía y deja
  // que se resuelva desde contabilidad.configuracion_tipos_automaticos (clave venta_factura).
  tipo_poliza_id?: number | null;
  usuario_id?: number | null;
  modo_contabilizacion?: ModoContabilizacion;
};

export interface ResultadoContabilizacionFacturaVenta {
  poliza: PolizaEncabezado;
  contabilizacion: Contabilizacion;
  asiento: AsientoFacturaVenta;
}

export async function contabilizarFacturaVenta(
  empresaId: number,
  documentoId: number,
  input: ContabilizarFacturaVentaInput
): Promise<ResultadoContabilizacionFacturaVenta> {
  const tipoPolizaId = await resolverTipoPolizaVenta(empresaId, 'factura', input.tipo_poliza_id);

  const datos = await obtenerDatosFactura(empresaId, documentoId);
  if (!datos) {
    throw new Error('VALIDATION_ERROR: La factura no existe en esta empresa.');
  }
  await validarElegibilidadFacturaVenta(empresaId, datos.doc);
  const asiento = await construirAsientoFacturaVenta(empresaId, datos.doc, datos.partidas, datos.impuestos);

  const movimientos: PolizaMovimientoInput[] = asiento.movimientos.map((m) => ({
    cuenta_id: m.cuenta_id,
    concepto_texto: m.concepto,
    cargo: m.cargo,
    abono: m.abono,
  }));

  const poliza = await crearPolizaConMovimientos(
    empresaId,
    {
      tipo_poliza_id: tipoPolizaId,
      fecha: asiento.fecha_documento,
      referencia: asiento.folio,
      observaciones: `Factura de venta ${asiento.folio}`,
      estatus: 'aplicada',
      movimientos,
    },
    input.usuario_id ?? null
  );

  const contabilizacion = await registrarContabilizacion(empresaId, {
    poliza_id: poliza.id,
    tipo_movimiento: 'venta',
    tipo_documento: 'factura_venta',
    documento_id: documentoId,
    evento_contable: 'emision',
    modo_contabilizacion: input.modo_contabilizacion ?? 'individual',
    fecha_documento: asiento.fecha_documento,
    usuario_id: input.usuario_id ?? null,
  });

  return { poliza, contabilizacion, asiento };
}

interface CandidatoLoteFacturaVenta {
  id: number;
  ya_contabilizada: boolean;
}

// Candidatas = mismo filtro base de siempre (factura, tratamiento normal, no
// cancelada, dentro del rango). Se marcan aparte las que ya tienen
// contabilización de emisión activa, para que el lote las trate como
// "omitidas" y no como error ni las vuelva a intentar.
async function listarFacturasVentaCandidatasRango(
  empresaId: number,
  fechaDesde: string,
  fechaHasta: string
): Promise<CandidatoLoteFacturaVenta[]> {
  const { rows } = await pool.query<{ id: number; ya_contabilizada: boolean }>(
    `SELECT d.id,
            EXISTS (
              SELECT 1 FROM contabilidad.contabilizaciones ct
              WHERE ct.empresa_id = d.empresa_id AND ct.documento_id = d.id
                AND ct.evento_contable = 'emision' AND ct.es_reversa = false
            ) AS ya_contabilizada
       FROM public.documentos d
      WHERE d.empresa_id = $1
        AND LOWER(d.tipo_documento) = 'factura'
        AND LOWER(d.tratamiento_impuestos) = 'normal'
        AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada', 'borrador')
        AND d.fecha_documento BETWEEN $2 AND $3
      ORDER BY d.fecha_documento, d.id`,
    [empresaId, fechaDesde, fechaHasta]
  );
  return rows.map((r) => ({ id: Number(r.id), ya_contabilizada: Boolean(r.ya_contabilizada) }));
}

interface CandidatoLoteFacturaVentaSeleccion {
  ya_contabilizada: boolean;
  // null = elegible; string = motivo por el que se excluye antes de intentar
  // contabilizar (no existe/no es de la empresa, cancelada, no es factura
  // estándar, o no timbrada sin permiso).
  no_elegible: string | null;
}

// A diferencia del rango (un solo filtro SQL sobre todo el universo de
// facturas), aquí se parte de los IDs que el usuario seleccionó en la grilla
// y se clasifica cada uno explícitamente, para poder reportar "seleccionadas
// / elegibles / omitidas" en vez de simplemente excluirlos en el WHERE.
async function listarFacturasVentaCandidatasSeleccion(
  empresaId: number,
  documentoIds: number[]
): Promise<Map<number, CandidatoLoteFacturaVentaSeleccion>> {
  const resultado = new Map<number, CandidatoLoteFacturaVentaSeleccion>();
  if (documentoIds.length === 0) return resultado;

  const configuracion = await obtenerOCrearConfiguracion(empresaId);

  const { rows } = await pool.query<{
    id: number;
    tipo_documento: string | null;
    tratamiento_impuestos: string | null;
    estatus_documento: string | null;
    timbrada: boolean;
    ya_contabilizada: boolean;
  }>(
    `SELECT d.id, d.tipo_documento, d.tratamiento_impuestos, d.estatus_documento,
            EXISTS(SELECT 1 FROM public.documentos_cfdi c WHERE c.documento_id = d.id) AS timbrada,
            EXISTS (
              SELECT 1 FROM contabilidad.contabilizaciones ct
              WHERE ct.empresa_id = d.empresa_id AND ct.documento_id = d.id
                AND ct.evento_contable = 'emision' AND ct.es_reversa = false
            ) AS ya_contabilizada
       FROM public.documentos d
      WHERE d.empresa_id = $1 AND d.id = ANY($2::bigint[])`,
    [empresaId, documentoIds]
  );
  const encontrados = new Map(rows.map((r) => [Number(r.id), r]));

  for (const id of documentoIds) {
    const fila = encontrados.get(id);
    if (!fila) {
      resultado.set(id, { ya_contabilizada: false, no_elegible: 'El documento no existe o no pertenece a la empresa.' });
      continue;
    }
    const tipo = String(fila.tipo_documento ?? '').trim().toLowerCase();
    if (tipo !== 'factura') {
      resultado.set(id, { ya_contabilizada: false, no_elegible: 'Solo se pueden contabilizar documentos de tipo factura.' });
      continue;
    }
    const estatus = String(fila.estatus_documento ?? '').trim().toLowerCase();
    if (estatus === 'borrador') {
      resultado.set(id, { ya_contabilizada: false, no_elegible: 'La factura está en borrador y no puede contabilizarse.' });
      continue;
    }
    if (estatus === 'cancelado' || estatus === 'cancelada') {
      resultado.set(id, { ya_contabilizada: false, no_elegible: 'La factura está cancelada y no puede contabilizarse.' });
      continue;
    }
    const tratamiento = String(fila.tratamiento_impuestos ?? '').trim().toLowerCase();
    if (tratamiento === 'sin_iva') {
      resultado.set(id, {
        ya_contabilizada: false,
        no_elegible: 'Las notas de venta (tratamiento sin_iva) no se contabilizan.',
      });
      continue;
    }
    if (tratamiento !== 'normal') {
      resultado.set(id, {
        ya_contabilizada: false,
        no_elegible: `El tratamiento fiscal "${fila.tratamiento_impuestos}" no está soportado todavía por la contabilización automática.`,
      });
      continue;
    }
    if (!fila.timbrada && !configuracion.permitir_venta_no_timbrada) {
      resultado.set(id, { ya_contabilizada: false, no_elegible: 'La factura no está timbrada.' });
      continue;
    }
    resultado.set(id, { ya_contabilizada: Boolean(fila.ya_contabilizada), no_elegible: null });
  }

  return resultado;
}

// Modalidad "rango": todas las facturas de venta candidatas dentro de un
// rango de fechas (comportamiento histórico). Modalidad "seleccion": solo
// los documento_ids indicados explícitamente (selección en la grilla), sin
// requerir fechas.
export type ContabilizarLoteFacturaVentaInput =
  | {
      modo: 'rango';
      fecha_desde: string;
      fecha_hasta: string;
      // Override manual opcional; el flujo normal de UI ya no lo envía (ver
      // ContabilizarFacturaVentaInput.tipo_poliza_id).
      tipo_poliza_id?: number | null;
      usuario_id?: number | null;
      agrupacion: 'individual' | 'concentrado';
    }
  | {
      modo: 'seleccion';
      documento_ids: number[];
      tipo_poliza_id?: number | null;
      usuario_id?: number | null;
      agrupacion: 'individual' | 'concentrado';
    };

export type EstadoDocumentoLote =
  | 'contabilizada'
  | 'omitida_ya_contabilizada'
  // Solo aplica a modalidad "seleccion": documento no encontrado en la
  // empresa, cancelado, no es factura estándar o no timbrado sin permiso. Se
  // detecta antes de intentar contabilizar, por eso nunca cae en 'error'.
  | 'omitida_no_elegible'
  | 'error';

export type ResultadoDocumentoLote = {
  documento_id: number;
  estado: EstadoDocumentoLote;
  motivo?: string;
  contabilizacion_id?: number;
};

export type ResumenLoteFacturaVenta = {
  total_en_rango: number;
  contabilizadas: number;
  omitidas_ya_contabilizadas: number;
  omitidas_no_elegibles: number;
  con_error: number;
  // Solo poblados en modalidad "seleccion".
  seleccionadas?: number;
  elegibles?: number;
};

function construirResumenLote(
  totalEvaluado: number,
  resultados: ResultadoDocumentoLote[],
  extra?: { seleccionadas?: number; elegibles?: number }
): ResumenLoteFacturaVenta {
  return {
    total_en_rango: totalEvaluado,
    contabilizadas: resultados.filter((r) => r.estado === 'contabilizada').length,
    omitidas_ya_contabilizadas: resultados.filter((r) => r.estado === 'omitida_ya_contabilizada').length,
    omitidas_no_elegibles: resultados.filter((r) => r.estado === 'omitida_no_elegible').length,
    con_error: resultados.filter((r) => r.estado === 'error').length,
    ...(extra?.seleccionadas != null ? { seleccionadas: extra.seleccionadas } : {}),
    ...(extra?.elegibles != null ? { elegibles: extra.elegibles } : {}),
  };
}

export type ResultadoLoteIndividual = {
  modo: 'lote_individual';
  resumen: ResumenLoteFacturaVenta;
  resultados: ResultadoDocumentoLote[];
  mensaje?: string;
};

export type ResultadoLoteConcentrado = {
  modo: 'lote_concentrado';
  resumen: ResumenLoteFacturaVenta;
  resultados: ResultadoDocumentoLote[];
  polizas: PolizaEncabezado[];
  contabilizaciones: Contabilizacion[];
  mensaje?: string;
};

const MENSAJE_YA_CONTABILIZADA = 'La factura ya fue contabilizada para el evento de emisión.';

// Defensa adicional además del filtro SQL: si por una condición de carrera
// (otra pestaña, otro proceso) una factura se contabiliza justo entre el
// listado de candidatas y este punto, el error de "ya contabilizada" se
// reclasifica como omitida en vez de fallar el lote.
function esErrorYaContabilizada(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return message.replace('VALIDATION_ERROR:', '').trim() === MENSAJE_YA_CONTABILIZADA;
}

function validarRangoFechas(fechaDesde: string, fechaHasta: string): void {
  if (!FECHA_REGEX.test(fechaDesde ?? '') || !FECHA_REGEX.test(fechaHasta ?? '')) {
    throw new Error('VALIDATION_ERROR: fecha_desde y fecha_hasta deben tener formato YYYY-MM-DD.');
  }
  if (fechaDesde > fechaHasta) {
    throw new Error('VALIDATION_ERROR: fecha_desde no puede ser posterior a fecha_hasta.');
  }
}

export async function contabilizarFacturasVentaLote(
  empresaId: number,
  input: ContabilizarLoteFacturaVentaInput
): Promise<ResultadoLoteIndividual | ResultadoLoteConcentrado> {
  // Se resuelve una sola vez para todo el lote: si no está configurado (y no
  // se pasó override), falla aquí mismo, antes de tocar ninguna factura.
  const tipoPolizaId = await resolverTipoPolizaVenta(empresaId, 'factura', input.tipo_poliza_id);

  const resultados: ResultadoDocumentoLote[] = [];
  let candidatos: CandidatoLoteFacturaVenta[];
  let totalEvaluado: number;
  let extraResumen: { seleccionadas?: number; elegibles?: number } | undefined;
  const esSeleccion = input.modo === 'seleccion';
  const prefijoReferencia = esSeleccion ? 'VENTAS SELECCIÓN' : 'VENTAS';
  const mensajeSinPendientes = esSeleccion
    ? 'No hay facturas pendientes de contabilizar en la selección.'
    : 'No hay facturas pendientes de contabilizar en el rango seleccionado.';

  if (input.modo === 'seleccion') {
    const idsUnicos = Array.from(new Set(input.documento_ids ?? []));
    if (idsUnicos.length === 0) {
      throw new Error('VALIDATION_ERROR: Debe indicar al menos una factura seleccionada para contabilizar.');
    }

    const clasificadas = await listarFacturasVentaCandidatasSeleccion(empresaId, idsUnicos);
    // Ya contabilizadas y no elegibles se resuelven de inmediato, antes de
    // intentar nada: nunca pasan por contabilizarFacturaVenta, así que jamás
    // aparecen como 'error' (rojo) en el resultado.
    for (const id of idsUnicos) {
      const info = clasificadas.get(id)!;
      if (info.no_elegible) {
        resultados.push({ documento_id: id, estado: 'omitida_no_elegible', motivo: info.no_elegible });
      } else if (info.ya_contabilizada) {
        resultados.push({ documento_id: id, estado: 'omitida_ya_contabilizada', motivo: MENSAJE_YA_CONTABILIZADA });
      }
    }
    candidatos = idsUnicos
      .filter((id) => {
        const info = clasificadas.get(id)!;
        return !info.no_elegible && !info.ya_contabilizada;
      })
      .map((id) => ({ id, ya_contabilizada: false }));

    totalEvaluado = idsUnicos.length;
    extraResumen = { seleccionadas: idsUnicos.length, elegibles: candidatos.length };
  } else {
    validarRangoFechas(input.fecha_desde, input.fecha_hasta);
    candidatos = await listarFacturasVentaCandidatasRango(empresaId, input.fecha_desde, input.fecha_hasta);

    // Las ya contabilizadas se registran como omitidas de inmediato: nunca
    // pasan por contabilizarFacturaVenta/construirAsientoFacturaVenta, así que
    // jamás pueden generar el error "ya fue contabilizada" para el lote.
    for (const candidato of candidatos) {
      if (candidato.ya_contabilizada) {
        resultados.push({ documento_id: candidato.id, estado: 'omitida_ya_contabilizada', motivo: MENSAJE_YA_CONTABILIZADA });
      }
    }
    totalEvaluado = candidatos.length;
  }

  const pendientes = candidatos.filter((c) => !c.ya_contabilizada);

  if (input.agrupacion === 'individual') {
    for (const candidato of pendientes) {
      try {
        const resultado = await contabilizarFacturaVenta(empresaId, candidato.id, {
          tipo_poliza_id: tipoPolizaId,
          usuario_id: input.usuario_id,
          modo_contabilizacion: 'lote_individual',
        });
        resultados.push({ documento_id: candidato.id, estado: 'contabilizada', contabilizacion_id: resultado.contabilizacion.id });
      } catch (error) {
        if (esErrorYaContabilizada(error)) {
          resultados.push({ documento_id: candidato.id, estado: 'omitida_ya_contabilizada', motivo: MENSAJE_YA_CONTABILIZADA });
        } else {
          resultados.push({ documento_id: candidato.id, estado: 'error', motivo: (error as Error).message });
        }
      }
    }
    return {
      modo: 'lote_individual',
      resumen: construirResumenLote(totalEvaluado, resultados, extraResumen),
      resultados,
      ...(pendientes.length === 0 ? { mensaje: mensajeSinPendientes } : {}),
    };
  }

  if (pendientes.length === 0) {
    return {
      modo: 'lote_concentrado',
      resumen: construirResumenLote(totalEvaluado, resultados, extraResumen),
      resultados,
      polizas: [],
      contabilizaciones: [],
      mensaje: mensajeSinPendientes,
    };
  }

  // Concentrado: un asiento por periodo contable (mes de fecha_documento), no
  // uno solo para todo el rango, porque una póliza no puede repartirse entre
  // dos periodos. Si un documento falla su elegibilidad o le faltan cuentas,
  // se excluye del concentrado y se reporta por separado (no bloquea al resto).
  const LIMITE_FOLIOS_OBSERVACIONES = 10;

  type GrupoPeriodo = {
    clave: string;
    fechaMax: string;
    acumulado: Map<number, { cargo: number; abono: number; origenes: Set<string> }>;
    documentos: Array<{ documento_id: number; fecha_documento: string; folio: string }>;
  };
  const grupos = new Map<string, GrupoPeriodo>();

  for (const candidato of pendientes) {
    try {
      const datos = await obtenerDatosFactura(empresaId, candidato.id);
      if (!datos) throw new Error('VALIDATION_ERROR: La factura no existe.');
      await validarElegibilidadFacturaVenta(empresaId, datos.doc);
      const asiento = await construirAsientoFacturaVenta(empresaId, datos.doc, datos.partidas, datos.impuestos);

      const clave = asiento.fecha_documento.slice(0, 7);
      const grupo = grupos.get(clave) ?? {
        clave,
        fechaMax: asiento.fecha_documento,
        acumulado: new Map<number, { cargo: number; abono: number; origenes: Set<string> }>(),
        documentos: [],
      };
      if (asiento.fecha_documento > grupo.fechaMax) grupo.fechaMax = asiento.fecha_documento;
      for (const mov of asiento.movimientos) {
        const actual = grupo.acumulado.get(mov.cuenta_id) ?? { cargo: 0, abono: 0, origenes: new Set<string>() };
        actual.cargo = redondear(actual.cargo + mov.cargo);
        actual.abono = redondear(actual.abono + mov.abono);
        mov.origen.split(',').filter(Boolean).forEach((o) => actual.origenes.add(o));
        grupo.acumulado.set(mov.cuenta_id, actual);
      }
      grupo.documentos.push({ documento_id: candidato.id, fecha_documento: asiento.fecha_documento, folio: asiento.folio });
      grupos.set(clave, grupo);

      resultados.push({ documento_id: candidato.id, estado: 'contabilizada' });
    } catch (error) {
      if (esErrorYaContabilizada(error)) {
        resultados.push({ documento_id: candidato.id, estado: 'omitida_ya_contabilizada', motivo: MENSAJE_YA_CONTABILIZADA });
      } else {
        resultados.push({ documento_id: candidato.id, estado: 'error', motivo: (error as Error).message });
      }
    }
  }

  const polizas: PolizaEncabezado[] = [];
  const contabilizaciones: Contabilizacion[] = [];

  for (const grupo of grupos.values()) {
    const periodoLabel = formatearPeriodoMes(grupo.clave);
    const movimientos: PolizaMovimientoInput[] = [];
    for (const [cuentaId, datos] of grupo.acumulado) {
      const neto = redondear(datos.cargo - datos.abono);
      if (neto === 0) continue;
      const concepto_texto = construirConceptoConcentrado(periodoLabel, datos.origenes);
      if (neto > 0) movimientos.push({ cuenta_id: cuentaId, concepto_texto, cargo: neto, abono: 0 });
      else movimientos.push({ cuenta_id: cuentaId, concepto_texto, cargo: 0, abono: -neto });
    }
    if (movimientos.length === 0) continue;

    const cantidadFacturas = grupo.documentos.length;
    const sufijoFacturas = `${cantidadFacturas} factura${cantidadFacturas === 1 ? '' : 's'}`;
    // En selección, si todo cae en un solo periodo (caso típico: se eligieron
    // facturas puntuales) se omite el periodo en la referencia, tal como pide
    // el flujo ("VENTAS SELECCIÓN - N facturas"). Si la selección abarca más
    // de un periodo, cada póliza sigue necesitando distinguirse por mes.
    const referencia =
      esSeleccion && grupos.size === 1
        ? `${prefijoReferencia} - ${sufijoFacturas}`
        : `${prefijoReferencia} ${periodoLabel} - ${sufijoFacturas}`;
    const folios = grupo.documentos.map((d) => d.folio);
    const foliosMostrados = folios.slice(0, LIMITE_FOLIOS_OBSERVACIONES).join(', ');
    const foliosRestantes = folios.length - LIMITE_FOLIOS_OBSERVACIONES;
    const observaciones =
      `Póliza concentrada de ventas. Incluye facturas: ${foliosMostrados}` +
      (foliosRestantes > 0 ? ` y ${foliosRestantes} más.` : '.') +
      ' El detalle completo por documento está en contabilidad.contabilizaciones.';

    const poliza = await crearPolizaConMovimientos(
      empresaId,
      {
        tipo_poliza_id: tipoPolizaId,
        fecha: grupo.fechaMax,
        referencia,
        observaciones,
        estatus: 'aplicada',
        movimientos,
      },
      input.usuario_id ?? null
    );
    polizas.push(poliza);

    for (const inc of grupo.documentos) {
      const contabilizacion = await registrarContabilizacion(empresaId, {
        poliza_id: poliza.id,
        tipo_movimiento: 'venta',
        tipo_documento: 'factura_venta',
        documento_id: inc.documento_id,
        evento_contable: 'emision',
        modo_contabilizacion: 'lote_concentrado',
        fecha_documento: inc.fecha_documento,
        usuario_id: input.usuario_id ?? null,
      });
      contabilizaciones.push(contabilizacion);
    }
  }

  return {
    modo: 'lote_concentrado',
    resumen: construirResumenLote(totalEvaluado, resultados, extraResumen),
    resultados,
    polizas,
    contabilizaciones,
  };
}

// ---------------------------------------------------------------------------
// Reversa por cancelación. NO está enganchada al flujo real de cancelación de
// documentos (documentos-cancel.service.ts): se deja como servicio/endpoint
// independiente para que se invoque explícitamente hasta que se decida
// integrarla. Si la factura no tenía contabilización activa, no genera nada
// (regla: documento no contabilizado que se cancela no genera póliza).
// ---------------------------------------------------------------------------

export type ReversaCancelacionFacturaVentaInput = {
  usuario_id?: number | null;
  comentario?: string | null;
  tipo_poliza_id?: number;
};

export type ResultadoReversaCancelacion =
  | { generada: false; motivo: string }
  | { generada: true; poliza: PolizaEncabezado; contabilizacion: Contabilizacion };

// client opcional: cuando se pasa (p. ej. desde la transacción de
// cancelación de documentos-cancel.service.ts), toda la generación de la
// reversa —lectura de la contabilización/póliza original, creación de la
// póliza reversa y registro en contabilidad.contabilizaciones— corre sobre
// esa misma conexión/transacción en vez de abrir una segunda con
// pool.connect() (ver comentario detallado en crearPolizaConMovimientos).
export async function generarReversaCancelacionFacturaVenta(
  empresaId: number,
  documentoId: number,
  input: ReversaCancelacionFacturaVentaInput,
  client?: PoolClient
): Promise<ResultadoReversaCancelacion> {
  // Se resuelve primero: si no está configurado (y no se pasó override), no
  // se genera ninguna póliza de reversa.
  const tipoPolizaId = await resolverTipoPolizaVenta(empresaId, 'cancelacion', input.tipo_poliza_id);

  const db = client ?? pool;
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM contabilidad.contabilizaciones
      WHERE empresa_id = $1 AND documento_id = $2 AND evento_contable = 'emision' AND es_reversa = false
      ORDER BY id DESC
      LIMIT 1`,
    [empresaId, documentoId]
  );
  const contabilizacionOrigenId = rows[0]?.id;
  if (!contabilizacionOrigenId) {
    return {
      generada: false,
      motivo: 'La factura no tenía una contabilización de emisión activa; no se genera póliza de reversa.',
    };
  }

  const original = await obtenerContabilizacionPorId(contabilizacionOrigenId, empresaId, client);
  if (!original) {
    return { generada: false, motivo: 'No se encontró la contabilización original.' };
  }

  const polizaOriginal = await obtenerPolizaPorId(original.poliza_id, empresaId, client);
  // Movimientos de la póliza ORIGINAL: son datos ya confirmados de una
  // transacción previa (la contabilización de emisión), visibles igual desde
  // pool o desde el client de esta transacción — no hace falta el client aquí.
  const movimientosOriginales = await listarMovimientosPoliza(original.poliza_id, empresaId);
  if (!polizaOriginal || !movimientosOriginales) {
    throw new Error('VALIDATION_ERROR: No se pudo obtener la póliza original para generar la reversa.');
  }

  // Inversión exacta de la póliza original: no se recalculan cuentas con la
  // configuración actual (podría haber cambiado desde que se contabilizó).
  const movimientosReversa: PolizaMovimientoInput[] = movimientosOriginales.map((m) => ({
    cuenta_id: m.cuenta_id,
    concepto_id: m.concepto_id ?? undefined,
    concepto_texto: m.concepto_texto ? `Reversa - ${m.concepto_texto}` : undefined,
    cargo: m.abono,
    abono: m.cargo,
  }));

  const { rows: docRows } = await db.query<{ fecha_cancelacion: string | null }>(
    `SELECT to_char(fecha_cancelacion, 'YYYY-MM-DD') AS fecha_cancelacion
       FROM public.documentos
      WHERE id = $1 AND empresa_id = $2`,
    [documentoId, empresaId]
  );
  const fechaReversa = docRows[0]?.fecha_cancelacion ?? new Date().toISOString().slice(0, 10);

  const polizaReversa = await crearPolizaConMovimientos(
    empresaId,
    {
      tipo_poliza_id: tipoPolizaId,
      fecha: fechaReversa,
      referencia: `Reversa póliza ${polizaOriginal.numero}`,
      observaciones: `Reversa por cancelación de factura de venta (póliza original ${polizaOriginal.numero})`,
      estatus: 'aplicada',
      movimientos: movimientosReversa,
    },
    input.usuario_id ?? null,
    client
  );

  const reversa = (await registrarReversa(
    empresaId,
    contabilizacionOrigenId,
    {
      poliza_id: polizaReversa.id,
      evento_contable: 'cancelacion',
      fecha_documento: fechaReversa,
      usuario_id: input.usuario_id ?? null,
      comentario: input.comentario ?? null,
    },
    client
  )) as Contabilizacion;

  return { generada: true, poliza: polizaReversa, contabilizacion: reversa };
}

// ---------------------------------------------------------------------------
// Estado contable en lote, para pintar la columna de la grilla de documentos
// sin llamar al endpoint de preview (que resuelve cuentas) por cada fila.
// Solo repite las condiciones "baratas" de validarElegibilidadFacturaVenta
// (sin resolver cuentas contables); por eso no distingue el caso "faltan
// cuentas configuradas", que solo se conoce al ejecutar el preview real.
// ---------------------------------------------------------------------------

export type EstadoContableFacturaVenta = 'contabilizada' | 'no_contabilizable' | 'pendiente';

export type RelacionPolizaDocumento = 'emision' | 'cancelacion' | 'reversa' | 'ajuste' | 'otra';

export interface DocumentoPolizaRelacionadaDto {
  contabilizacionId: number;
  polizaId: number;
  relacion: RelacionPolizaDocumento;
  eventoContable: string;
  esReversa: boolean;
  contabilizacionOrigenId: number | null;
  tipoPolizaId: number | null;
  tipoPolizaIdentificador: string | null;
  tipoPolizaNombre: string | null;
  numero: number | string | null;
  fecha: string | null;
  estatus: string | null;
}

export interface EstadoContableFacturaVentaInfo {
  estado: EstadoContableFacturaVenta;
  motivo: string | null;
  poliza_id?: number;
  poliza_numero?: number;
  poliza_fecha?: string;
  tipo_poliza_identificador?: string;
  polizas_relacionadas: DocumentoPolizaRelacionadaDto[];
}

interface PolizaRelacionadaRow {
  documento_id: number;
  contabilizacion_id: number;
  poliza_id: number;
  evento_contable: string;
  es_reversa: boolean;
  contabilizacion_origen_id: number | null;
  tipo_poliza_id: number | null;
  tipo_poliza_identificador: string | null;
  poliza_numero: number | string | null;
  poliza_fecha: string | null;
  poliza_estatus: string | null;
}

function clasificarRelacionPoliza(row: PolizaRelacionadaRow): RelacionPolizaDocumento {
  const evento = String(row.evento_contable ?? '').trim().toLowerCase();
  if (row.es_reversa && row.contabilizacion_origen_id != null) return 'reversa';
  if (evento === 'emision' && !row.es_reversa) return 'emision';
  if (evento === 'cancelacion') return 'cancelacion';
  if (evento === 'ajuste') return 'ajuste';
  return 'otra';
}

function mapearPolizaRelacionada(row: PolizaRelacionadaRow): DocumentoPolizaRelacionadaDto {
  return {
    contabilizacionId: Number(row.contabilizacion_id),
    polizaId: Number(row.poliza_id),
    relacion: clasificarRelacionPoliza(row),
    eventoContable: String(row.evento_contable),
    esReversa: Boolean(row.es_reversa),
    contabilizacionOrigenId: row.contabilizacion_origen_id != null ? Number(row.contabilizacion_origen_id) : null,
    tipoPolizaId: row.tipo_poliza_id != null ? Number(row.tipo_poliza_id) : null,
    tipoPolizaIdentificador: row.tipo_poliza_identificador ?? null,
    tipoPolizaNombre: row.tipo_poliza_identificador ?? null,
    numero: row.poliza_numero ?? null,
    fecha: row.poliza_fecha ?? null,
    estatus: row.poliza_estatus ?? null,
  };
}

export async function obtenerEstadoContableFacturasVentaLote(
  empresaId: number,
  documentoIds: number[]
): Promise<Record<number, EstadoContableFacturaVentaInfo>> {
  if (documentoIds.length === 0) return {};

  const { rows: docs } = await pool.query(
    `SELECT d.id, d.tipo_documento, d.estatus_documento, d.tratamiento_impuestos,
            EXISTS(SELECT 1 FROM public.documentos_cfdi c WHERE c.documento_id = d.id) AS timbrada
       FROM public.documentos d
      WHERE d.empresa_id = $1 AND d.id = ANY($2::int[])`,
    [empresaId, documentoIds]
  );

  // Una sola consulta set-based trae todas las pólizas relacionadas con los
  // documentos visibles. No se resuelven cuentas ni se hace preview aquí.
  const { rows: contabilizadasRows } = await pool.query<PolizaRelacionadaRow>(
    `SELECT ct.documento_id, ct.id AS contabilizacion_id, p.id AS poliza_id,
            ct.evento_contable, ct.es_reversa, ct.contabilizacion_origen_id,
            p.tipo_poliza_id, tp.identificador AS tipo_poliza_identificador,
            p.numero AS poliza_numero, to_char(p.fecha, 'YYYY-MM-DD') AS poliza_fecha,
            p.estatus AS poliza_estatus
       FROM contabilidad.contabilizaciones ct
       JOIN contabilidad.polizas p ON p.id = ct.poliza_id
       JOIN contabilidad.tipos_poliza tp ON tp.id = p.tipo_poliza_id
      WHERE ct.empresa_id = $1 AND ct.documento_id = ANY($2::int[])
      ORDER BY ct.documento_id,
               CASE
                 WHEN ct.evento_contable = 'emision' AND ct.es_reversa = false THEN 0
                 WHEN ct.es_reversa = true AND ct.contabilizacion_origen_id IS NOT NULL THEN 1
                 WHEN ct.evento_contable = 'cancelacion' THEN 2
                 WHEN ct.evento_contable = 'ajuste' THEN 3
                 ELSE 4
               END,
               ct.fecha_contabilizacion,
               ct.id`,
    [empresaId, documentoIds]
  );
  const polizasPorDocumento = new Map<number, DocumentoPolizaRelacionadaDto[]>();
  for (const row of contabilizadasRows) {
    const documentoId = Number(row.documento_id);
    const existentes = polizasPorDocumento.get(documentoId) ?? [];
    existentes.push(mapearPolizaRelacionada(row));
    polizasPorDocumento.set(documentoId, existentes);
  }

  const configuracion = await obtenerOCrearConfiguracion(empresaId);

  const resultado: Record<number, EstadoContableFacturaVentaInfo> = {};
  for (const doc of docs) {
    const id = Number(doc.id);

    const polizasRelacionadas = polizasPorDocumento.get(id) ?? [];
    const polizaPrincipal = polizasRelacionadas.find((poliza) => poliza.relacion === 'emision') ?? polizasRelacionadas[0];
    if (polizaPrincipal) {
      resultado[id] = {
        estado: 'contabilizada',
        motivo: null,
        poliza_id: polizaPrincipal.polizaId,
        ...(polizaPrincipal.numero != null ? { poliza_numero: Number(polizaPrincipal.numero) } : {}),
        ...(polizaPrincipal.fecha ? { poliza_fecha: polizaPrincipal.fecha } : {}),
        ...(polizaPrincipal.tipoPolizaIdentificador
          ? { tipo_poliza_identificador: polizaPrincipal.tipoPolizaIdentificador }
          : {}),
        polizas_relacionadas: polizasRelacionadas,
      };
      continue;
    }
    if (String(doc.tipo_documento ?? '').trim().toLowerCase() !== 'factura') {
      resultado[id] = { estado: 'no_contabilizable', motivo: 'Solo se contabilizan documentos de tipo factura.', polizas_relacionadas: [] };
      continue;
    }
    const estatus = String(doc.estatus_documento ?? '').trim().toLowerCase();
    if (estatus === 'borrador') {
      resultado[id] = { estado: 'no_contabilizable', motivo: 'La factura está en borrador.', polizas_relacionadas: [] };
      continue;
    }
    if (estatus === 'cancelado' || estatus === 'cancelada') {
      resultado[id] = { estado: 'no_contabilizable', motivo: 'La factura está cancelada.', polizas_relacionadas: [] };
      continue;
    }
    const tratamiento = String(doc.tratamiento_impuestos ?? '').trim().toLowerCase();
    if (tratamiento === 'sin_iva') {
      resultado[id] = { estado: 'no_contabilizable', motivo: 'Nota de venta: no se contabiliza.', polizas_relacionadas: [] };
      continue;
    }
    if (tratamiento !== 'normal') {
      resultado[id] = {
        estado: 'no_contabilizable',
        motivo: `Tratamiento fiscal "${doc.tratamiento_impuestos}" no soportado todavía por la contabilización automática.`,
        polizas_relacionadas: [],
      };
      continue;
    }
    if (!doc.timbrada && !configuracion.permitir_venta_no_timbrada) {
      resultado[id] = { estado: 'no_contabilizable', motivo: 'La factura no está timbrada.', polizas_relacionadas: [] };
      continue;
    }
    resultado[id] = { estado: 'pendiente', motivo: null, polizas_relacionadas: [] };
  }

  return resultado;
}
