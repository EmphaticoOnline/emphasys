import { ImpuestosResolver } from './impuestos.resolver';
import { calcularImpuestosParaSubtotal } from './impuestos.calculador';
import type { TratamientoImpuestos } from './impuestos.types';

const resolver = new ImpuestosResolver();

export type PreviewCalculoInput = {
  empresaId: number;
  productoId?: number | null;
  cantidad?: number | null;
  precioUnitario?: number | null;
  tratamientoImpuestos?: TratamientoImpuestos | null;
};

export type PreviewCalculoResultado = {
  subtotal_partida: number;
  impuestos: Array<{
    impuestoId: string;
    tipo?: string | null;
    tasa: number;
    base: number;
    monto: number;
  }>;
  iva_monto: number;
  total_partida: number;
};

export async function calcularImpuestosPreview({
  empresaId,
  productoId,
  cantidad,
  precioUnitario,
  tratamientoImpuestos,
}: PreviewCalculoInput): Promise<PreviewCalculoResultado> {
  console.log('[impuestos-preview] tratamiento recibido', tratamientoImpuestos);
  const cantidadNum = Number(cantidad ?? 0) || 0;
  const precioNum = Number(precioUnitario ?? 0) || 0;
  const subtotal_partida = Number((cantidadNum * precioNum).toFixed(2));

  if ((tratamientoImpuestos ?? '').toLowerCase() === 'sin_iva') {
    return {
      subtotal_partida,
      impuestos: [],
      iva_monto: 0,
      total_partida: subtotal_partida,
    };
  }

  // Resolver impuestos aplicables usando el mismo motor (sin insertar en DB)
  const impuestosAplicables = await resolver.resolverImpuestosAplicables(
    productoId ?? null,
    empresaId,
    tratamientoImpuestos ?? 'normal'
  );

  // Calcular montos con el mismo calculador del motor
  const impuestosCalculados = calcularImpuestosParaSubtotal(subtotal_partida, impuestosAplicables);

  const traslados = impuestosCalculados
    .filter((imp) => (imp.tipo ?? '').toLowerCase() === 'traslado')
    .reduce((acc, imp) => acc + Number(imp.monto), 0);
  const retenciones = impuestosCalculados
    .filter((imp) => (imp.tipo ?? '').toLowerCase() === 'retencion')
    .reduce((acc, imp) => acc + Number(imp.monto), 0);

  const iva_monto = traslados;
  const total_partida = subtotal_partida + traslados - retenciones;

  return {
    subtotal_partida,
    impuestos: impuestosCalculados.map((imp) => ({
      impuestoId: imp.impuestoId,
      tipo: imp.tipo,
      tasa: imp.tasa,
      base: imp.base,
      monto: imp.monto,
    })),
    iva_monto,
    total_partida,
  };
}
