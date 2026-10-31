import pool from '../../config/database';

export type MovimientoRow = {
  id: number;
  serie: string | null;
  numero: number | null;
  estatus_afectacion: number;
  es_reversion: boolean;
  movimiento_origen_id: number | null;
  fecha: string;
  tipo_movimiento: string;
  observaciones: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  documento_id: number | null;
  documento_serie: string | null;
  documento_numero: number | null;
  documento_serie_externa: string | null;
  documento_numero_externo: number | null;
  documento_tipo: string | null;
  documento_estatus: string | null;
  documento_fecha: string | null;
  documento_origen_id: number | null;
  contacto_id: number | null;
  contacto_nombre: string | null;
  contacto_tipo: string | null;
  referencia: string | null;
  /** Número de partidas del movimiento (los de Clarion pueden no tener ninguna). */
  partidas: number;
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
  costo_unitario: number | null;
  existencia_resultante: number | null;
  valor_movimiento: number | null;
};

export type MovimientoDetalle = {
  movimiento: MovimientoRow;
  partidas: MovimientoPartidaDetalle[];
};

export type FiltrosMovimientos = {
  /** Periodo: año y, opcionalmente, mes (1-12). Se ignora cuando hay texto de búsqueda. */
  anio?: number | null;
  mes?: number | null;
  /** Búsqueda libre en todos los periodos. */
  texto?: string | null;
  /** Solo movimientos capturados en inventario (sin documento y que no son reversión). */
  soloManuales?: boolean;
  /** Tamaño de página; sin límite trae todo (exportación). */
  limite?: number | null;
  /** Cursor: el último renglón de la página anterior (orden fecha DESC, id DESC). */
  despues?: { fecha: string; id: number } | null;
};

const SELECT_MOVIMIENTO = `
    SELECT m.id,
           m.serie,
           m.numero,
           COALESCE(m.estatus_afectacion, 1) AS estatus_afectacion,
           COALESCE(m.es_reversion, false) AS es_reversion,
           m.movimiento_origen_id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
           m.usuario_id,
           u.nombre AS usuario_nombre,
           m.documento_id,
           d.serie   AS documento_serie,
           d.numero  AS documento_numero,
           d.serie_externa AS documento_serie_externa,
           d.numero_externo AS documento_numero_externo,
           d.tipo_documento AS documento_tipo,
           d.estatus_documento AS documento_estatus,
           d.fecha_documento AS documento_fecha,
           d.documento_origen_id,
           COALESCE(m.contacto_id, d.contacto_principal_id) AS contacto_id,
           c.nombre AS contacto_nombre,
           c.tipo_contacto AS contacto_tipo,
           m.referencia,
           (SELECT count(*) FROM inventario.movimientos_partidas mp WHERE mp.movimiento_id = m.id)::int AS partidas
      FROM inventario.movimientos m
     LEFT JOIN core.usuarios u ON u.id = m.usuario_id
     LEFT JOIN public.documentos d ON d.id = m.documento_id
     LEFT JOIN public.contactos c ON c.id = COALESCE(m.contacto_id, d.contacto_principal_id) AND c.empresa_id = m.empresa_id`;

// Folio escrito como "INV-6883", "INV-006883" o "INV6883": serie y número sin ceros a la izquierda.
function folioBuscado(texto: string): { serie: string; numero: number } | null {
  const match = texto.trim().match(/^([A-Za-zÑñ]+)\s*-?\s*0*(\d{1,15})$/);
  return match ? { serie: match[1].toUpperCase(), numero: Number(match[2]) } : null;
}

function condicionesMovimientos(empresaId: number, filtros: FiltrosMovimientos) {
  const condiciones = ['m.empresa_id = $1'];
  const params: unknown[] = [empresaId];
  const agregar = (valor: unknown) => {
    params.push(valor);
    return `$${params.length}`;
  };

  const texto = filtros.texto?.trim();
  if (texto) {
    const patron = agregar(`%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const opciones = [`concat_ws(' ', m.id, m.serie || '-' || m.numero, m.tipo_movimiento, m.observaciones,
                                 m.referencia, u.nombre, c.nombre, d.tipo_documento, d.serie || '-' || d.numero,
                                 d.serie_externa || '-' || d.numero_externo) ILIKE ${patron}`];
    const folio = folioBuscado(texto);
    if (folio) {
      const serie = agregar(folio.serie);
      const numero = agregar(folio.numero);
      opciones.push(`(upper(m.serie) = ${serie} AND m.numero = ${numero})`);
      opciones.push(`(upper(d.serie) = ${serie} AND d.numero = ${numero})`);
    }
    condiciones.push(`(${opciones.join(' OR ')})`);
  } else if (filtros.anio) {
    // Rango de fechas (no extract) para que use el índice por empresa y fecha.
    const desde = filtros.mes ? `${filtros.anio}-${String(filtros.mes).padStart(2, '0')}-01` : `${filtros.anio}-01-01`;
    const inicio = agregar(desde);
    condiciones.push(`m.fecha >= ${inicio}::date`);
    condiciones.push(`m.fecha < ${inicio}::date + ${filtros.mes ? "interval '1 month'" : "interval '1 year'"}`);
  }

  if (filtros.soloManuales) {
    condiciones.push('m.documento_id IS NULL AND NOT COALESCE(m.es_reversion, false)');
  }

  return { condiciones, params, agregar };
}

export async function listarMovimientosRepository(
  empresaId: number,
  filtros: FiltrosMovimientos = {}
): Promise<MovimientoRow[]> {
  const { condiciones, params, agregar } = condicionesMovimientos(empresaId, filtros);
  if (filtros.despues) {
    const fecha = agregar(filtros.despues.fecha);
    const id = agregar(filtros.despues.id);
    condiciones.push(`(m.fecha, m.id) < (${fecha}::date, ${id}::bigint)`);
  }
  const limite = filtros.limite ? `LIMIT ${agregar(filtros.limite)}` : '';

  const query = `${SELECT_MOVIMIENTO}
     WHERE ${condiciones.join(' AND ')}
     ORDER BY m.fecha DESC, m.id DESC
     ${limite}
  `;

  const { rows } = await pool.query<MovimientoRow>(query, params);
  return rows;
}

export async function contarMovimientosRepository(empresaId: number, filtros: FiltrosMovimientos = {}): Promise<number> {
  const { condiciones, params } = condicionesMovimientos(empresaId, filtros);
  const query = `
    SELECT count(*)::int AS total
      FROM inventario.movimientos m
     LEFT JOIN core.usuarios u ON u.id = m.usuario_id
     LEFT JOIN public.documentos d ON d.id = m.documento_id
     LEFT JOIN public.contactos c ON c.id = COALESCE(m.contacto_id, d.contacto_principal_id) AND c.empresa_id = m.empresa_id
     WHERE ${condiciones.join(' AND ')}
  `;
  const { rows } = await pool.query<{ total: number }>(query, params);
  return rows[0]?.total ?? 0;
}

export type PeriodoMovimientosRow = { anio: number; mes: number; total: number };

/** Cuántos movimientos hay por año y mes (para el selector de periodo). */
export async function listarPeriodosMovimientosRepository(empresaId: number): Promise<PeriodoMovimientosRow[]> {
  const { rows } = await pool.query<PeriodoMovimientosRow>(
    `SELECT extract(year FROM fecha)::int AS anio, extract(month FROM fecha)::int AS mes, count(*)::int AS total
       FROM inventario.movimientos
      WHERE empresa_id = $1
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2 DESC`,
    [empresaId]
  );
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
           m.serie,
           m.numero,
           COALESCE(m.estatus_afectacion, 1) AS estatus_afectacion,
           COALESCE(m.es_reversion, false) AS es_reversion,
           m.movimiento_origen_id,
           m.fecha,
           m.tipo_movimiento,
           m.observaciones,
           m.usuario_id,
           u.nombre AS usuario_nombre,
           m.documento_id,
           d.serie   AS documento_serie,
           d.numero  AS documento_numero,
           d.serie_externa AS documento_serie_externa,
           d.numero_externo AS documento_numero_externo,
           d.tipo_documento AS documento_tipo,
           d.estatus_documento AS documento_estatus,
           d.fecha_documento AS documento_fecha,
           d.documento_origen_id,
           COALESCE(m.contacto_id, d.contacto_principal_id) AS contacto_id,
           c.nombre AS contacto_nombre,
           c.tipo_contacto AS contacto_tipo,
           m.referencia,
           (SELECT count(*) FROM inventario.movimientos_partidas mp WHERE mp.movimiento_id = m.id)::int AS partidas
      FROM inventario.movimientos m
     LEFT JOIN core.usuarios u ON u.id = m.usuario_id
     LEFT JOIN public.documentos d ON d.id = m.documento_id
     LEFT JOIN public.contactos c ON c.id = COALESCE(m.contacto_id, d.contacto_principal_id) AND c.empresa_id = m.empresa_id
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
           mp.tipo_partida,
           mp.signo,
           ad.nombre              AS almacen_destino_nombre,
           mp.cantidad * mp.signo AS cantidad,
           mp.costo_unitario,
           mp.existencia_resultante,
           CASE WHEN mp.costo_unitario IS NULL THEN NULL
                ELSE mp.cantidad * mp.signo * mp.costo_unitario
           END AS valor_movimiento
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
