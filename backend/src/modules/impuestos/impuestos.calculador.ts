import type { ImpuestoCalculado, ImpuestoCatalogo } from './impuestos.types';

// Redondeos específicos de impuestos
export function roundBase(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calcularImpuestosParaSubtotal(
  subtotal: number,
  impuestos: ImpuestoCatalogo[]
): ImpuestoCalculado[] {
  const subtotalNumber = parseFloat(subtotal as any);
  if (!Number.isFinite(subtotalNumber)) {
    throw new Error(`Subtotal inválido para cálculo de impuestos: ${subtotal}`);
  }
  if (subtotalNumber < 0) {
    throw new Error('El subtotal de la partida no puede ser negativo');
  }

  return impuestos.map((imp) => {
    const tasaNumber = parseFloat(imp.tasa as any);
    if (!Number.isFinite(tasaNumber)) {
      throw new Error(`Tasa inválida para impuesto ${imp.id}: ${imp.tasa}`);
    }
    const tasaValor = tasaNumber > 1 ? tasaNumber / 100 : tasaNumber;
    const base = roundBase(subtotalNumber);
    const monto = roundMoney(base * tasaValor);
    return {
      impuestoId: imp.id,
      tasa: tasaNumber,
      base,
      monto,
      tipo: imp.tipo,
    };
  });
}
