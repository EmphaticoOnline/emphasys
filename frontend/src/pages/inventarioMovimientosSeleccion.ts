export function idsIguales(izquierdo: unknown, derecho: unknown): boolean {
  const a = Number(izquierdo);
  const b = Number(derecho);
  return Number.isInteger(a) && a > 0 && a === b;
}

export type DecisionSeleccionMovimiento = {
  selectedId: number | null;
  pendiente: number | null;
  limpiarFiltros: boolean;
};

/**
 * El movimiento recién guardado tiene prioridad sobre el primer renglón
 * visible hasta que la carga terminó y ese id ya está en la lista.
 * Los ids del listado llegan como texto (bigint); el guardado entrega un número.
 */
export function decidirSeleccionMovimiento(input: {
  pendiente: number | null;
  selectedId: number | string | null;
  movimientos: { id: number | string }[];
  filtrados: { id: number | string }[];
  cargaTerminada: boolean;
  hayFiltros: boolean;
}): DecisionSeleccionMovimiento {
  const pendiente = Number.isInteger(input.pendiente) && (input.pendiente ?? 0) > 0 ? input.pendiente : null;

  if (pendiente != null && !input.cargaTerminada) {
    return { selectedId: pendiente, pendiente, limpiarFiltros: false };
  }

  if (pendiente != null && input.cargaTerminada) {
    const existe = input.movimientos.some((movimiento) => idsIguales(movimiento.id, pendiente));
    const visible = input.filtrados.some((movimiento) => idsIguales(movimiento.id, pendiente));
    if (existe && visible) {
      return { selectedId: pendiente, pendiente: null, limpiarFiltros: false };
    }
    if (existe && input.hayFiltros) {
      return { selectedId: pendiente, pendiente, limpiarFiltros: true };
    }
  }

  const actual = Number(input.selectedId);
  if (input.filtrados.some((movimiento) => idsIguales(movimiento.id, actual))) {
    return { selectedId: actual, pendiente: null, limpiarFiltros: false };
  }
  const primero = input.filtrados[0];
  return {
    selectedId: primero == null ? null : Number(primero.id),
    pendiente: null,
    limpiarFiltros: false,
  };
}
