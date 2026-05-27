type DocumentoOrdenable = {
  codigo: string;
  nombre: string;
  orden?: number | null;
};

const DOCUMENTO_VISUAL_PRIORITY: Record<string, number> = {
  cotizacion: 10,
  pedido: 20,
  orden_servicio: 30,
  orden_entrega: 40,
  remision: 50,
  factura: 60,
  pago_cliente: 70,
  pago_proveedor: 70,
};

export function compareDocumentoVisualOrder<T extends DocumentoOrdenable>(a: T, b: T): number {
  const aPriority = DOCUMENTO_VISUAL_PRIORITY[a.codigo] ?? Number.POSITIVE_INFINITY;
  const bPriority = DOCUMENTO_VISUAL_PRIORITY[b.codigo] ?? Number.POSITIVE_INFINITY;

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  return (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre);
}