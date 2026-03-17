export type ImpuestoEntrada = {
  id: string;
  nombre: string;
  tipo?: string | null;
  tasa: number | string;
  monto?: number;
  base?: number | null;
  impuesto_id?: string;
};

export type ImpuestoCalculadoUI = {
  impuestoId: string;
  nombre: string;
  tipo?: string | undefined;
  tasa: number;
  monto: number;
};

/**
 * Calcula impuestos para un subtotal en frontend (uso visual).
 * - Convierte tasas > 1 a proporción (16 => 0.16)
 * - Redondea a 2 decimales
 */
export function calcularImpuestosPartida(subtotal: number, impuestos: ImpuestoEntrada[] = []): ImpuestoCalculadoUI[] {
  const base = Number(subtotal) || 0;
  if (!Number.isFinite(base) || base < 0) return [];

  return impuestos.map((imp) => {
    const tasaNum = Number(imp.tasa);
    const tasa = Number.isFinite(tasaNum) ? tasaNum : 0;
    const tasaValor = tasa > 1 ? tasa / 100 : tasa;
    console.log('DEBUG impuestos', {
      subtotal,
      tasa: imp.tasa,
      tipoSubtotal: typeof subtotal,
      tipoTasa: typeof imp.tasa,
    });
    const monto = Math.round((base * tasaValor + Number.EPSILON) * 100) / 100;
    const tipo = imp.tipo ?? undefined;
    return {
      impuestoId: imp.id,
      nombre: imp.nombre,
      tipo,
      tasa,
      monto,
    };
  });
}
