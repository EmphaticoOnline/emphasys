import pool from '../../config/database';

export type ProductoHistorialModo = 'ventas' | 'compras';
export type ProductoHistorialRow = {
  documento_id: number; partida_id: number; tipo_documento: string;
  tratamiento_impuestos: string | null; estatus_documento: string | null;
  contacto_id: number | null; contacto_nombre: string | null; contacto_tipo: string | null;
  fecha_documento: string; folio: string; producto_id: number | null; producto_clave: string | null;
  producto_descripcion: string | null; cantidad: number;
  unidad: string | null; cantidad_inventariable: number | null; factor_conversion: number | null;
  precio_unitario: number | null; descuento: number | null; subtotal_partida: number | null;
  total_partida: number | null; observaciones: string | null; signo_comercial: number;
};
export type ProductoHistorialResult = {
  modo: ProductoHistorialModo; producto_id: number | null; contacto_id: number | null; fecha_inicio: string | null; fecha_fin: string | null;
  total_filas: number; cantidad_total: number; importe_total: number; filas: ProductoHistorialRow[];
};
type Params = { empresaId: number; fechaInicio?: string; fechaFin?: string; limit: number; offset: number };
const CONFIG: Record<ProductoHistorialModo, string[]> = {
  ventas: ['factura', 'nota_credito'], compras: ['factura_compra', 'nota_credito_compra'],
};
const toDate = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

type Filtro = { productoId: number; contactoId?: undefined } | { contactoId: number; productoId?: undefined };

export function listarHistorialProducto(modo: ProductoHistorialModo, params: Params & { productoId: number }): Promise<ProductoHistorialResult> {
  return listarHistorialComercial(modo, params, { productoId: params.productoId });
}

export function listarHistorialContacto(modo: ProductoHistorialModo, params: Params & { contactoId: number }): Promise<ProductoHistorialResult> {
  return listarHistorialComercial(modo, params, { contactoId: params.contactoId });
}

async function listarHistorialComercial(modo: ProductoHistorialModo, params: Params, filtro: Filtro): Promise<ProductoHistorialResult> {
  const porProducto = filtro.productoId != null;
  const args: unknown[] = [params.empresaId, porProducto ? filtro.productoId : filtro.contactoId, CONFIG[modo]];
  const filters = [
    'd.empresa_id = $1', porProducto ? 'dp.producto_id = $2' : 'd.contacto_principal_id = $2', 'LOWER(d.tipo_documento) = ANY($3::text[])',
    "LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('borrador', 'cancelado', 'cancelada')",
  ];
  if (params.fechaInicio) { args.push(params.fechaInicio); filters.push(`d.fecha_documento >= $${args.length}::date`); }
  if (params.fechaFin) { args.push(params.fechaFin); filters.push(`d.fecha_documento <= $${args.length}::date`); }
  const where = filters.join(' AND ');
  const sign = "CASE WHEN LOWER(d.tipo_documento) IN ('nota_credito', 'nota_credito_compra') THEN -1 ELSE 1 END";
  const totals = await pool.query(`SELECT COUNT(*)::int AS total_filas,
      COALESCE(SUM(dp.cantidad * (${sign})), 0)::numeric AS cantidad_total,
      COALESCE(SUM(COALESCE(dp.subtotal_partida, 0) * (${sign})), 0)::numeric AS importe_total
    FROM public.documentos d JOIN public.documentos_partidas dp ON dp.documento_id = d.id WHERE ${where}`, args);
  const pageArgs = [...args, params.limit, params.offset];
  const limitIndex = pageArgs.length - 1; const offsetIndex = pageArgs.length;
  const result = await pool.query<ProductoHistorialRow>(`SELECT d.id AS documento_id, dp.id AS partida_id,
      d.tipo_documento, d.tratamiento_impuestos, d.estatus_documento,
      d.contacto_principal_id AS contacto_id, c.nombre AS contacto_nombre, c.tipo_contacto AS contacto_tipo,
      d.fecha_documento, COALESCE(NULLIF(TRIM(d.serie), ''), '') || CASE WHEN d.numero IS NULL THEN '' ELSE '-' || d.numero::text END AS folio,
      dp.producto_id, p.clave AS producto_clave, COALESCE(NULLIF(TRIM(dp.descripcion_alterna), ''), p.descripcion) AS producto_descripcion, dp.cantidad, dp.unidad, dp.cantidad_inventariable, dp.factor_conversion,
      dp.precio_unitario, dp.descuento, dp.subtotal_partida, dp.total_partida, dp.observaciones,
      (${sign})::int AS signo_comercial
    FROM public.documentos d JOIN public.documentos_partidas dp ON dp.documento_id = d.id
    LEFT JOIN public.contactos c ON c.id = d.contacto_principal_id AND c.empresa_id = d.empresa_id
    LEFT JOIN public.productos p ON p.id = dp.producto_id
    WHERE ${where} ORDER BY d.fecha_documento DESC NULLS LAST, d.id DESC, dp.id DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}`, pageArgs);
  const total = totals.rows[0] as any;
  return {
    modo, producto_id: filtro.productoId ?? null, contacto_id: filtro.contactoId ?? null, fecha_inicio: params.fechaInicio ?? null, fecha_fin: params.fechaFin ?? null,
    total_filas: Number(total?.total_filas ?? 0), cantidad_total: Number(total?.cantidad_total ?? 0), importe_total: Number(total?.importe_total ?? 0),
    filas: result.rows.map((row) => ({ ...row, fecha_documento: toDate(row.fecha_documento), cantidad: Number(row.cantidad ?? 0),
      cantidad_inventariable: row.cantidad_inventariable == null ? null : Number(row.cantidad_inventariable),
      factor_conversion: row.factor_conversion == null ? null : Number(row.factor_conversion), precio_unitario: row.precio_unitario == null ? null : Number(row.precio_unitario),
      descuento: row.descuento == null ? null : Number(row.descuento), subtotal_partida: row.subtotal_partida == null ? null : Number(row.subtotal_partida), total_partida: row.total_partida == null ? null : Number(row.total_partida) }))
  };
}
