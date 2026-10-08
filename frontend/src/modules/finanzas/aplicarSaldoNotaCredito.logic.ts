export type NotaCreditoAplicacionRow = {
  saldo?: number | null;
  tiene_aplicaciones_saldo_activas?: boolean | null;
  estatus_documento?: string | null;
  tratamiento_impuestos?: string | null;
  cfdi_uuid?: string | null;
  cfdi_fecha_cancelacion?: string | null;
  cfdi_estado_sat?: string | null;
  cfdi_cancelacion_estado?: string | null;
};

export type FacturaCandidataAplicacion = {
  id: number;
  origen?: string | null;
  tipo?: string | null;
  estatus_documento?: string | null;
  tratamiento_impuestos?: string | null;
  moneda?: string | null;
  saldo?: number | null;
  fecha?: string | null;
};

const normalizar = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function roundMoney(value: number, decimals = 2): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(decimals));
}

export function notaCreditoPuedeAplicarSaldo(tipoDocumento: string, row: NotaCreditoAplicacionRow): boolean {
  const tipo = normalizar(tipoDocumento);
  if (tipo !== 'nota_credito' && tipo !== 'nota_credito_compra') return false;
  if (!(Number(row.saldo ?? 0) > 0) && !row.tiene_aplicaciones_saldo_activas) return false;

  const estatus = normalizar(row.estatus_documento);
  if (['', 'borrador', 'cancelado', 'cancelada'].includes(estatus)) return false;

  if (tipo === 'nota_credito_compra') return true;

  if (normalizar(row.tratamiento_impuestos) === 'sin_iva') {
    return estatus === 'emitido';
  }

  const cfdiCancelado = Boolean(row.cfdi_fecha_cancelacion)
    || ['cancelado', 'cancelada'].includes(normalizar(row.cfdi_estado_sat))
    || ['cancelado', 'cancelada'].includes(normalizar(row.cfdi_cancelacion_estado));

  return estatus === 'timbrado' && Boolean(String(row.cfdi_uuid ?? '').trim()) && !cfdiCancelado;
}

export function filtrarFacturasCandidatas(
  items: FacturaCandidataAplicacion[],
  options: { notaCreditoId: number; tipoDestino: string; moneda: string; tratamientoImpuestos?: string | null },
): FacturaCandidataAplicacion[] {
  const moneda = normalizar(options.moneda);
  const tipoDestino = normalizar(options.tipoDestino);
  return items
    .filter((item) => normalizar(item.origen ?? 'documento') === 'documento')
    .filter((item) => normalizar(item.tipo) === tipoDestino)
    .filter((item) => normalizar(item.estatus_documento) !== 'borrador')
    .filter((item) => Number(item.id) !== Number(options.notaCreditoId))
    .filter((item) => Number(item.saldo ?? 0) > 0)
    .filter((item) => normalizar(item.moneda) === moneda)
    .filter((item) => !options.tratamientoImpuestos || normalizar(item.tratamiento_impuestos) === normalizar(options.tratamientoImpuestos))
    .sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')));
}

export function resumirDistribucionSaldo(
  saldoDisponible: number,
  lineas: Array<{ saldoPendiente: number; aplicar: number }>,
) {
  const totalAplicar = roundMoney(lineas.reduce((sum, linea) => sum + (linea.aplicar > 0 ? linea.aplicar : 0), 0));
  const saldoRestante = roundMoney(Number(saldoDisponible ?? 0) - totalAplicar);
  const excedeFactura = lineas.some((linea) => linea.aplicar - Number(linea.saldoPendiente ?? 0) > 0.000001);
  const excedeNota = totalAplicar - Number(saldoDisponible ?? 0) > 0.000001;
  return {
    totalAplicar,
    saldoRestante,
    excedeFactura,
    excedeNota,
    puedeAplicar: totalAplicar > 0.000001 && !excedeFactura && !excedeNota,
  };
}

export function sugerirAplicacion(
  saldoFactura: number,
  saldoDisponible: number,
  aplicarActual: number,
  totalAplicar: number,
): number {
  const actual = aplicarActual > 0 ? aplicarActual : 0;
  const otros = roundMoney(totalAplicar - actual);
  const cupo = roundMoney(Number(saldoDisponible ?? 0) - otros);
  return roundMoney(Math.min(Math.max(Number(saldoFactura ?? 0), 0), Math.max(cupo, 0)));
}

export function montosAplicacion(importeDocumento: number, tipoCambio: number) {
  const montoMoneda = roundMoney(importeDocumento, 2);
  const cambio = Math.abs(Number(tipoCambio) || 1) || 1;
  return {
    monto: roundMoney(montoMoneda * cambio, 6),
    monto_moneda_documento: montoMoneda,
  };
}
