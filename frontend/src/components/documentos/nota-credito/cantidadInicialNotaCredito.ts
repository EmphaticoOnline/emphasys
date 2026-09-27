export type CapturaGuardadaNotaCredito = {
  valor: number;
};

/**
 * Cantidad o monto con el que nace una partida al incorporarse.
 * `null` significa que la sesión ya tiene un valor y no debe reemplazarse.
 * Una partida ya guardada en la nota se reconoce por `capturaGuardada`,
 * aunque su valor sea 0. Una partida nueva de devolución usa el pendiente
 * (`cantidad_pendiente_sugerida`), no la cantidad original de la factura.
 */
export function resolverValorInicialNotaCredito(args: {
  valorEnSesion: number | null | undefined;
  capturaGuardada: CapturaGuardadaNotaCredito | null | undefined;
  devolucion: boolean;
  cantidadPendiente: number;
}): number | null {
  if (args.valorEnSesion != null && Number.isFinite(Number(args.valorEnSesion))) {
    return null;
  }
  if (args.capturaGuardada) {
    return Number(args.capturaGuardada.valor ?? 0);
  }
  if (args.devolucion) {
    return Number(args.cantidadPendiente ?? 0);
  }
  return 0;
}
