import pool from '../../config/database';

export type MovimientoRow = {
  id: number;
  fecha: string;
  tipo_movimiento: string;
  observaciones: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  documento_id: number | null;
  documento_serie: string | null;
  documento_numero: number | null;
};

export type MovimientoPartidaDetalle = {
  id: number;
  producto_id: number | null;
  producto_clave: string | null;
  producto_descripcion: string | null;
  almacen_origen_id: number | null;
  almacen_origen_nombre: string | null;
  almacen_destino_id: number | null;
  almacen_destino_nombre: string | null;
  cantidad: number;
};

export type MovimientoDetalle = {
  movimiento: MovimientoRow;
  partidas: MovimientoPartidaDetalle[];
};

export async function listarMovimientosRepository(empresaId: number): Promise<MovimientoRow[]> {
  const query = `
    SELECT m.id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
           m.usuario_id,
           u.nombre AS usuario_nombre,
           m.documento_id,
           d.serie   AS documento_serie,
           d.numero  AS documento_numero
      FROM inventario.movimientos m
     LEFT JOIN core.usuarios u ON u.id = m.usuario_id
     LEFT JOIN public.documentos d ON d.id = m.documento_id
     WHERE m.empresa_id = $1
     ORDER BY m.fecha DESC, m.id DESC
  `;

  const { rows } = await pool.query<MovimientoRow>(query, [empresaId]);
  return rows;
}

export type MovimientoPorDocumentoRow = {
  movimiento_id: number;
  fecha: string;
  tipo_movimiento: string;
  observaciones: string | null;
  producto_id: number | null;
  producto_clave: string | null;
  producto_descripcion: string | null;
  almacen_origen_id: number | null;
  almacen_origen_nombre: string | null;
  almacen_destino_id: number | null;
  almacen_destino_nombre: string | null;
  cantidad: number;
};

export async function listarMovimientosPorDocumentoRepository(
  documentoId: number,
  empresaId: number
): Promise<MovimientoPorDocumentoRow[]> {
  const query = `
    SELECT m.id AS movimiento_id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
           mp.producto_id,
           p.clave       AS producto_clave,
           p.descripcion AS producto_descripcion,
           mp.almacen_id          AS almacen_origen_id,
           ao.nombre              AS almacen_origen_nombre,
           mp.almacen_destino_id,
           ad.nombre              AS almacen_destino_nombre,
           mp.cantidad * mp.signo AS cantidad
      FROM inventario.movimientos m
      JOIN inventario.movimientos_partidas mp ON mp.movimiento_id = m.id AND mp.empresa_id = m.empresa_id
      LEFT JOIN public.productos p ON p.id = mp.producto_id
      LEFT JOIN inventario.almacenes ao ON ao.id = mp.almacen_id
      LEFT JOIN inventario.almacenes ad ON ad.id = mp.almacen_destino_id
     WHERE m.documento_id = $1
       AND m.empresa_id = $2
     ORDER BY m.fecha DESC, m.id DESC, mp.id ASC
  `;

  const { rows } = await pool.query<MovimientoPorDocumentoRow>(query, [documentoId, empresaId]);
  return rows;
}

export async function obtenerMovimientoDetalleRepository(id: number, empresaId: number): Promise<MovimientoDetalle | null> {
  const headerQuery = `
    SELECT m.id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
           m.usuario_id,
           u.nombre AS usuario_nombre,
           m.documento_id,
           d.serie   AS documento_serie,
           d.numero  AS documento_numero
      FROM inventario.movimientos m
      LEFT JOIN core.usuarios u ON u.id = m.usuario_id
      LEFT JOIN public.documentos d ON d.id = m.documento_id
     WHERE m.id = $1
       AND m.empresa_id = $2
     LIMIT 1
  `;

  const partidasQuery = `
    SELECT mp.id,
           mp.producto_id,
           p.clave       AS producto_clave,
           p.descripcion AS producto_descripcion,
           mp.almacen_id          AS almacen_origen_id,
           ao.nombre              AS almacen_origen_nombre,
           mp.almacen_destino_id,
           ad.nombre              AS almacen_destino_nombre,
           mp.cantidad * mp.signo AS cantidad
      FROM inventario.movimientos_partidas mp
      LEFT JOIN public.productos p ON p.id = mp.producto_id
      LEFT JOIN inventario.almacenes ao ON ao.id = mp.almacen_id
      LEFT JOIN inventario.almacenes ad ON ad.id = mp.almacen_destino_id
     WHERE mp.movimiento_id = $1
       AND mp.empresa_id = $2
     ORDER BY mp.id ASC
  `;

  const { rows: headerRows } = await pool.query<MovimientoRow>(headerQuery, [id, empresaId]);
  const movimiento = headerRows[0];
  if (!movimiento) return null;

  const { rows: partidas } = await pool.query<MovimientoPartidaDetalle>(partidasQuery, [id, empresaId]);

  return {
    movimiento,
    partidas,
  };
}
