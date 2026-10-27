import pool from '../../config/database';
import {
  listarMovimientosRepository,
  MovimientoRow,
  obtenerMovimientoDetalleRepository,
  MovimientoDetalle,
} from './inventario.repository';
import { isTraslado } from '../documentos/documento-policy.registry';
import type { PoolClient } from 'pg';
import { reservarNumeroMovimientoInventario } from '../documentos/series-documento.service';

type TipoMovimiento = 'entrada' | 'salida' | 'transferencia' | 'mixto';

type MovimientoPartidaPayload = {
  documento_partida_id?: number | null;
  producto_id: number;
  almacen_id: number;
  almacen_destino_id?: number | null;
  cantidad: number;
  signo: 1 | -1;
  tipo_partida?: 'normal' | 'salida_transferencia' | 'entrada_transferencia';
  costo_unitario?: number | null;
  sentido?: TipoMovimiento;
};

export type CrearMovimientoManualPayload = {
  empresaId: number;
  usuarioId: number;
  tipoMovimiento?: TipoMovimiento;
  fecha?: Date | string;
  observaciones?: string | null;
  contactoId?: number | null;
  partidas: Array<{
    productoId: number;
    almacenId: number;
    cantidad: number | string;
    almacenDestinoId?: number | null;
    costoUnitario?: number | null;
    sentido?: TipoMovimiento;
  }>;
};

type DocumentoInventarioRow = {
  id: number;
  empresa_id: number;
  tipo_documento: string;
  estatus_documento: string;
  fecha_documento: string;
  almacen_id: number | null;
  afecta_inventario: string | null;
  observaciones: string | null;
  contacto_id: number | null;
};

type PartidaDocumentoRow = {
  documento_partida_id: number;
  producto_id: number;
  cantidad: number;
  factor_conversion: number | null;
  cantidad_inventariable: number | null;
  partida_almacen_id: number | null;
  costo: number | null;
  precio_unitario: number | null;
  tipo_producto: string;
  producto_clave: string | null;
};

type MovimientoPartidaRow = {
  documento_partida_id: number | null;
  producto_id: number;
  almacen_id: number;
  almacen_destino_id: number | null;
  cantidad: number;
  signo: number;
  tipo_partida: 'normal' | 'salida_transferencia' | 'entrada_transferencia';
  costo_unitario: number | null;
};

function buildError(code: string, message: string) {
  const error = new Error(message);
  (error as any).code = code;
  return error;
}

function parseNumeric(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function assertPositiveNumber(value: any, code: string, message: string): number {
  const num = parseNumeric(value);
  if (!num || num <= 0) {
    throw buildError(code, message);
  }
  return num;
}

async function obtenerParametroNumero(clave: string, empresaId: number, client: PoolClient): Promise<number | null> {
  try {
    const { rows } = await client.query<{ valor: string | null }>(
      `SELECT COALESCE(pe.valor, p.valor_default) AS valor
         FROM core.parametros p
         LEFT JOIN core.parametros_empresa pe
                ON pe.parametro_id = p.parametro_id
               AND pe.empresa_id = $1
        WHERE p.clave = $2
        LIMIT 1`,
      [empresaId, clave]
    );

    if (!rows[0]?.valor) return null;
    const parsed = Number(rows[0].valor);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    throw buildError('PARAMETRO_ERROR', `Error al obtener parámetro ${clave}: ${(error as any)?.message ?? error}`);
  }
}

async function ejecutarAplicarMovimiento(
  params: {
    empresaId: number;
    tipoMovimiento: string;
    fecha: Date | string;
    usuarioId: number;
    documentoId: number | null;
    observaciones?: string | null;
    contactoId?: number | null;
    partidas: MovimientoPartidaPayload[];
    esReversion?: boolean;
    movimientoOrigenId?: number | null;
  },
  client: PoolClient
): Promise<number> {
  const { empresaId, tipoMovimiento, fecha, usuarioId, documentoId, observaciones, contactoId, partidas, esReversion, movimientoOrigenId } = params;

  if (!Array.isArray(partidas) || partidas.length === 0) {
    throw buildError('SIN_PARTIDAS', 'No hay partidas para aplicar el movimiento de inventario');
  }

  console.log(`[APLICAR_MOV] Antes de INSERT tipo=${tipoMovimiento} fecha=${fecha} esReversion=${esReversion} doc=${documentoId} empresa=${empresaId} partidas=${partidas.length}`);
  const { rows } = await client.query<{ movimiento_id: number }>(
    `SELECT inventario.aplicar_movimiento($1, $2, $3::date, $4, $5, $6, $7::jsonb, $8) AS movimiento_id`,
    [
      empresaId,
      tipoMovimiento,
      fecha,
      usuarioId,
      documentoId,
      observaciones ?? null,
      JSON.stringify(partidas),
      contactoId ?? null,
    ]
  );
  console.log(`[APLICAR_MOV] Después de INSERT rows=`, JSON.stringify(rows));

  const movimientoId = rows[0]?.movimiento_id ?? null;
  if (!movimientoId) {
    throw buildError('MOVIMIENTO_NO_CREADO', 'No se pudo crear el movimiento de inventario');
  }

  const folio = await reservarNumeroMovimientoInventario(empresaId, client);
  await client.query(
    `UPDATE inventario.movimientos
        SET serie = $2, numero = $3, estatus_afectacion = 1,
            afectado_at = now(), afectado_por = $4,
            es_reversion = COALESCE($5, false), movimiento_origen_id = $6
      WHERE id = $1 AND empresa_id = $7`,
    [movimientoId, folio.serie, folio.numero, usuarioId, esReversion ?? false, movimientoOrigenId ?? null, empresaId]
  );

  console.log(`[APLICAR_MOV] movimientoId=${movimientoId} es_reversion=${esReversion} guardado`);
  return movimientoId;
}

function resolverCantidadInventariable(partida: PartidaDocumentoRow): number {
  // Prioridad 1: campo precalculado
  const cantidadInventariable = parseNumeric(partida.cantidad_inventariable);
  if (cantidadInventariable != null && cantidadInventariable > 0) {
    return cantidadInventariable;
  }

  // Prioridad 2: cantidad base — único campo obligatorio
  const baseCantidad = parseNumeric(partida.cantidad);
  if (baseCantidad == null || baseCantidad <= 0) {
    throw buildError('CANTIDAD_INVALIDA', `Cantidad inválida para la partida ${partida.documento_partida_id}`);
  }

  // Prioridad 3: factor_conversion es opcional
  // Si existe y es > 0 se aplica; si no, la cantidad inventariable = cantidad
  const factor = parseNumeric(partida.factor_conversion);
  return factor != null && factor > 0 ? baseCantidad * factor : baseCantidad;
}

async function obtenerDocumentoInventario(
  documentoId: number,
  empresaId: number,
  client: PoolClient
): Promise<DocumentoInventarioRow | null> {
  const { rows } = await client.query<DocumentoInventarioRow>(
    `SELECT d.id,
            d.empresa_id,
            d.tipo_documento,
            d.estatus_documento,
            d.fecha_documento,
            d.almacen_id,
            COALESCE(etd.afecta_inventario, td.afecta_inventario, 'none') AS afecta_inventario,
            d.observaciones,
            d.contacto_principal_id AS contacto_id
       FROM documentos d
  LEFT JOIN core.tipos_documento td
         ON lower(td.codigo) = lower(d.tipo_documento)
  LEFT JOIN core.empresas_tipos_documento etd
         ON etd.tipo_documento_id = td.id
        AND etd.empresa_id = d.empresa_id
      WHERE d.id = $1
        AND d.empresa_id = $2
      LIMIT 1`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerPartidasDocumento(
  documentoId: number,
  client: PoolClient
): Promise<PartidaDocumentoRow[]> {
  const { rows } = await client.query<PartidaDocumentoRow>(
    `SELECT dp.id AS documento_partida_id,
            dp.producto_id,
            dp.cantidad,
            dp.factor_conversion,
            dp.cantidad_inventariable,
            dp.almacen_id AS partida_almacen_id,
            dp.costo,
            dp.precio_unitario,
            COALESCE(p.tipo_producto, '') AS tipo_producto,
            p.clave AS producto_clave
       FROM documentos_partidas dp
       JOIN productos p ON p.id = dp.producto_id
      WHERE dp.documento_id = $1
        AND dp.producto_id IS NOT NULL`,
    [documentoId]
  );

  return rows;
}

function resolverCostoDocumento(
  documento: DocumentoInventarioRow,
  partida: PartidaDocumentoRow,
): number | null {
  // Sólo las entradas documentales de compras pueden usar el precio como
  // respaldo. Ventas, salidas, notas de crédito de compra, transferencias y
  // movimientos manuales conservan su semántica de costo propia.
  const tipo = String(documento.tipo_documento || '').trim().toLowerCase();
  const esEntradaCompra = documento.afecta_inventario === 'entrada'
    && (tipo === 'factura_compra' || tipo === 'recepcion');

  if (partida.costo != null) return partida.costo;
  return esEntradaCompra ? partida.precio_unitario : null;
}

/**
 * Costo de entrada de una devolución de venta (nota de crédito de venta): el
 * producto regresa al almacén al costo con el que salió en la venta original.
 *
 * Prioridad, por partida de la nota:
 *  1. Enlace exacto: partida de la nota → partida de la factura
 *     (documentos_partidas_vinculos) → renglón de salida con ese
 *     documento_partida_id (guardado desde 20261026_02).
 *  2. Mismo producto en las salidas de los documentos origen (promedio
 *     ponderado), para movimientos sin enlace.
 *  3. Último costo promedio del producto en el almacén.
 * Ver docs/analisis-enlace-partida-movimientos-inventario.md.
 */
async function resolverCostosDevolucionVenta(
  client: PoolClient,
  documentoId: number,
  empresaId: number,
  partidas: Array<{ documento_partida_id?: number | null; producto_id: number; almacen_id: number }>,
): Promise<Map<number, number>> {
  const productos = Array.from(new Set(partidas.map((p) => Number(p.producto_id))));
  const costos = new Map<number, number>();
  if (productos.length === 0) return costos;

  const partidaIds = partidas.map((p) => Number(p.documento_partida_id ?? 0)).filter((id) => id > 0);
  const { rows: exactos } = await client.query<{ partida_id: number; costo: string | null }>(
    `SELECT v.partida_destino_id AS partida_id,
            SUM(mp.cantidad * mp.costo_unitario) / NULLIF(SUM(mp.cantidad), 0) AS costo
       FROM documentos_partidas_vinculos v
       JOIN inventario.movimientos_partidas mp
         ON mp.documento_partida_id = v.partida_origen_id AND mp.empresa_id = $1
       JOIN inventario.movimientos m
         ON m.id = mp.movimiento_id AND m.empresa_id = mp.empresa_id
      WHERE v.partida_destino_id = ANY($2::int[])
        AND COALESCE(m.es_reversion, false) = false
        AND mp.signo < 0
        AND mp.costo_unitario IS NOT NULL
      GROUP BY v.partida_destino_id`,
    [empresaId, partidaIds]
  );
  const costoExacto = new Map<number, number>();
  for (const row of exactos) {
    const costo = parseNumeric(row.costo);
    if (costo != null && costo >= 0) costoExacto.set(Number(row.partida_id), costo);
  }

  const { rows: venta } = await client.query<{ producto_id: number; costo: string | null }>(
    `WITH origenes AS (
       SELECT v.documento_origen_id AS documento_id
         FROM documentos_partidas_vinculos v
         JOIN documentos_partidas dp ON dp.id = v.partida_destino_id
        WHERE dp.documento_id = $1
       UNION
       SELECT dr.documento_origen_id
         FROM documentos_relaciones dr
        WHERE dr.empresa_id = $2 AND dr.documento_destino_id = $1
          AND dr.tipo_relacion = 'origen_nota_credito' AND dr.activa = true
       UNION
       SELECT d.documento_origen_id
         FROM documentos d
        WHERE d.id = $1 AND d.empresa_id = $2 AND d.documento_origen_id IS NOT NULL
     )
     SELECT mp.producto_id,
            SUM(mp.cantidad * mp.costo_unitario) / NULLIF(SUM(mp.cantidad), 0) AS costo
       FROM inventario.movimientos m
       JOIN inventario.movimientos_partidas mp
         ON mp.movimiento_id = m.id AND mp.empresa_id = m.empresa_id
      WHERE m.empresa_id = $2
        AND m.documento_id IN (SELECT documento_id FROM origenes)
        AND COALESCE(m.es_reversion, false) = false
        AND mp.signo < 0
        AND mp.costo_unitario IS NOT NULL
        AND mp.producto_id = ANY($3::int[])
      GROUP BY mp.producto_id`,
    [documentoId, empresaId, productos]
  );
  const costoVenta = new Map<number, number>();
  for (const row of venta) {
    const costo = parseNumeric(row.costo);
    if (costo != null && costo >= 0) costoVenta.set(Number(row.producto_id), costo);
  }

  const { rows: promedio } = await client.query<{ producto_id: number; almacen_id: number; costo: string | null }>(
    `SELECT DISTINCT ON (mp.producto_id, mp.almacen_id)
            mp.producto_id, mp.almacen_id, mp.costo_promedio_resultante AS costo
       FROM inventario.movimientos_partidas mp
       JOIN inventario.movimientos m ON m.id = mp.movimiento_id AND m.empresa_id = mp.empresa_id
      WHERE mp.empresa_id = $1
        AND mp.producto_id = ANY($2::int[])
        AND mp.costo_promedio_resultante IS NOT NULL
      ORDER BY mp.producto_id, mp.almacen_id, m.fecha DESC, m.id DESC, mp.id DESC`,
    [empresaId, productos]
  );
  const costoPromedio = new Map<string, number>();
  for (const row of promedio) {
    const costo = parseNumeric(row.costo);
    if (costo != null && costo >= 0) costoPromedio.set(`${row.producto_id}:${row.almacen_id}`, costo);
  }

  for (const partida of partidas) {
    const partidaId = Number(partida.documento_partida_id ?? 0);
    const costo = costoExacto.get(partidaId)
      ?? costoVenta.get(Number(partida.producto_id))
      ?? costoPromedio.get(`${partida.producto_id}:${partida.almacen_id}`);
    if (costo != null && partidaId > 0) costos.set(partidaId, costo);
  }
  return costos;
}

async function asegurarMovimientoNoDuplicado(documentoId: number, empresaId: number, client: PoolClient) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM inventario.movimientos WHERE documento_id = $1 AND empresa_id = $2 AND es_reversion = false LIMIT 1`,
    [documentoId, empresaId]
  );

  if (rowCount && rowCount > 0) {
    throw buildError('MOVIMIENTO_DUPLICADO', 'Ya existe un movimiento de inventario para este documento');
  }
}

async function obtenerMovimientoOriginal(documentoId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<{
    id: number;
    tipo_movimiento: string;
    fecha: Date;
    observaciones: string | null;
    contacto_id: number | null;
  }>(
    `SELECT id, tipo_movimiento, fecha, observaciones, contacto_id
       FROM inventario.movimientos
      WHERE documento_id = $1
        AND empresa_id = $2
        AND es_reversion = false
      ORDER BY id DESC
      LIMIT 1`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerPartidasMovimiento(movimientoId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<MovimientoPartidaRow>(
    `SELECT documento_partida_id,
            producto_id,
            almacen_id,
            almacen_destino_id,
            cantidad,
            signo,
            tipo_partida,
            costo_unitario
       FROM inventario.movimientos_partidas
      WHERE movimiento_id = $1
        AND empresa_id = $2
      ORDER BY id`,
    [movimientoId, empresaId]
  );

  return rows;
}

export async function revertirInventarioDocumentoEnTransaccion(
  client: PoolClient,
  documentoId: number,
  empresaId: number,
  usuarioId: number,
  opciones?: { fecha?: Date | string; observaciones?: string | null }
) {
  console.log(`[REVERSION] Inicio doc=${documentoId} empresa=${empresaId} usuario=${usuarioId}`);

  const { rowCount: yaRevertido } = await client.query(
    `SELECT 1 FROM inventario.movimientos WHERE documento_id = $1 AND empresa_id = $2 AND es_reversion = true LIMIT 1`,
    [documentoId, empresaId]
  );
  console.log(`[REVERSION] yaRevertido rowCount=`, yaRevertido);
  if (yaRevertido && yaRevertido > 0) {
    throw buildError('YA_REVERTIDO', 'El documento ya cuenta con un movimiento de reversión');
  }

  const movimientoOriginal = await obtenerMovimientoOriginal(documentoId, empresaId, client);
  console.log(`[REVERSION] movimientoOriginal=`, movimientoOriginal);
  if (!movimientoOriginal) {
    throw buildError('MOVIMIENTO_NO_ENCONTRADO', 'No existe un movimiento original para revertir');
  }

  const partidasOriginales = await obtenerPartidasMovimiento(movimientoOriginal.id, empresaId, client);
  console.log(`[REVERSION] partidasOriginales count=`, partidasOriginales.length, JSON.stringify(partidasOriginales));
  if (!partidasOriginales.length) {
    throw buildError('SIN_PARTIDAS_ORIGINALES', 'El movimiento original no tiene partidas');
  }

  const partidas: MovimientoPartidaPayload[] = partidasOriginales
    .filter((p) => p.tipo_partida !== 'entrada_transferencia')
    .map((p) => {
    const signoOriginal = Number(p.signo) || 0;
    if (signoOriginal === 0) {
      throw buildError('SIGNO_INVALIDO', `Signo inválido en partida del movimiento original (partida ${p.documento_partida_id ?? ''})`);
    }
    const signoInvertido: 1 | -1 = signoOriginal > 0 ? -1 : 1;

    return {
      documento_partida_id: p.documento_partida_id ?? undefined,
      producto_id: p.producto_id,
      almacen_id: p.almacen_id,
      almacen_destino_id: p.almacen_destino_id,
      cantidad: assertPositiveNumber(p.cantidad, 'CANTIDAD_INVALIDA', 'Cantidad inválida en partida original'),
      signo: signoInvertido,
      tipo_partida: p.tipo_partida,
      costo_unitario: p.costo_unitario ?? null,
      sentido: p.tipo_partida === 'salida_transferencia' || p.tipo_partida === 'entrada_transferencia' ? 'transferencia' : (signoInvertido > 0 ? 'entrada' : 'salida'),
    };
  });

  const tipoOriginal = movimientoOriginal.tipo_movimiento;
  const tipoReversion =
    tipoOriginal === 'entrada' ? 'salida' :
    tipoOriginal === 'salida'  ? 'entrada' :
    tipoOriginal;

  const movimientoId = await ejecutarAplicarMovimiento(
    {
      empresaId,
      tipoMovimiento: tipoReversion,
      // La reversión representa la fecha civil en que se cancela el
      // documento, no la fecha UTC del instante de ejecución.
      fecha: normalizarFecha(opciones?.fecha ?? await obtenerFechaCivilEmpresa(client, empresaId)),
      usuarioId,
      documentoId,
      observaciones:
        opciones?.observaciones ??
        `Reversión del movimiento ${movimientoOriginal.id} generado por documento ${documentoId}`,
      contactoId: movimientoOriginal.contacto_id,
      partidas,
      esReversion: true,
      movimientoOrigenId: movimientoOriginal.id,
    },
    client
  );

  return { movimientoId, partidas, tipoMovimiento: tipoReversion };
}

function normalizarFecha(fecha?: Date | string): Date | string {
  if (!fecha) return new Date();
  if (fecha instanceof Date) return fecha;
  // Cadenas fecha-solo (YYYY-MM-DD): devolverlas tal cual para que
  // PostgreSQL las trate como DATE sin conversión de zona horaria.
  // new Date('YYYY-MM-DD') las interpretaría como UTC midnight, lo que
  // causa un desfase de -6h al leerlas en zona horaria México.
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const parsed = new Date(fecha);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function obtenerFechaCivilEmpresa(client: PoolClient, empresaId: number): Promise<string> {
  const { rows } = await client.query<{ zona_horaria: string | null }>(
    `SELECT zona_horaria FROM core.empresas WHERE id = $1`,
    [empresaId]
  );
  const zona = String(rows[0]?.zona_horaria ?? 'America/Mexico_City').trim() || 'America/Mexico_City';
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

async function resolverAlmacenDefault(
  client: PoolClient,
  empresaId: number,
  almacenDocumentoId: number | null
): Promise<number> {
  if (almacenDocumentoId) return almacenDocumentoId;

  const almacenParametro = await obtenerParametroNumero('inventario.almacen_default', empresaId, client);
  if (almacenParametro) {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM inventario.almacenes
        WHERE id=$1 AND empresa_id=$2 AND activo=true
        LIMIT 1`,
      [almacenParametro, empresaId]
    );
    if (rows[0]?.id) return rows[0].id;
    throw buildError('ALMACEN_DEFAULT_INVALIDO', 'El almacén predeterminado configurado no pertenece a la empresa o está inactivo');
  }

  // Primero reutiliza un almacén general ya configurado. GRAL es la clave
  // histórica del catálogo; GENERAL queda como compatibilidad para empresas
  // que ya fueron inicializadas con esa clave. Solo se crea si no existe
  // ningún candidato válido.
  const existentes = await client.query<{ id: number; clave: string }>(
    `SELECT id, clave
       FROM inventario.almacenes
      WHERE empresa_id=$1
        AND activo=true
        AND (upper(trim(clave)) IN ('GRAL','GENERAL')
             OR lower(trim(nombre)) = 'almacén general')
      ORDER BY CASE upper(trim(clave)) WHEN 'GRAL' THEN 0 WHEN 'GENERAL' THEN 1 ELSE 2 END, id`,
    [empresaId]
  );
  if (existentes.rows.length > 0) {
    const [primero] = existentes.rows;
    const claves = new Set(existentes.rows.map((row) => String(row.clave ?? '').trim().toUpperCase()));
    if (existentes.rows.length > 1 && !claves.has('GRAL') && !claves.has('GENERAL')) {
      throw buildError('ALMACEN_DEFAULT_AMBIGUO', 'Existen varios almacenes generales activos y no hay una configuración predeterminada');
    }
    return primero.id;
  }

  // Crear o recuperar el almacén general de forma idempotente y concurrente.
  // El UNIQUE (empresa_id, clave) garantiza que no se creen duplicados aunque
  // dos transacciones lleguen simultáneamente: la segunda bloqueará hasta que
  // la primera haga commit/rollback, luego ON CONFLICT DO NOTHING no inserta
  // y el SELECT devuelve la fila ya comprometida.
  await client.query(
    `INSERT INTO inventario.almacenes (empresa_id, clave, nombre, tipo)
     VALUES ($1, 'GENERAL', 'Almacén General', 'normal')
     ON CONFLICT (empresa_id, clave) DO NOTHING`,
    [empresaId]
  );

  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM inventario.almacenes WHERE empresa_id = $1 AND clave = 'GENERAL' LIMIT 1`,
    [empresaId]
  );

  const almacenId = rows[0]?.id ?? null;
  if (!almacenId) {
    throw buildError('SIN_ALMACEN_RESOLVABLE', 'No se pudo crear ni recuperar el almacén general para la empresa');
  }

  console.log(`[inventario] Almacén General auto-resuelto id=${almacenId} empresa=${empresaId}`);
  return almacenId;
}

export async function aplicarInventarioDesdeDocumentoEnTransaccion(
  client: PoolClient,
  documentoId: number,
  empresaId: number,
  usuarioId: number,
  opciones?: { fecha?: Date | string; observaciones?: string | null }
): Promise<{ movimientoId: number; partidas: MovimientoPartidaPayload[]; tipoMovimiento: string }> {
  const documento = await obtenerDocumentoInventario(documentoId, empresaId, client);
  if (!documento) {
    throw buildError('DOCUMENTO_NO_ENCONTRADO', 'Documento no encontrado para la empresa indicada');
  }

  const afectaInventario = (documento.afecta_inventario || 'none').toLowerCase();
  if (isTraslado(documento.tipo_documento)) {
    throw buildError('TRASLADO_NO_AFECTA_INVENTARIO', 'Un Traslado no puede generar movimientos de inventario');
  }
  if (afectaInventario === 'none') {
    throw buildError('TIPO_NO_AFECTA_INVENTARIO', 'El tipo de documento no afecta inventario');
  }

  const estatus = (documento.estatus_documento || '').toLowerCase();
  if (estatus !== 'emitido' && estatus !== 'enviado' && estatus !== 'timbrado') {
    throw buildError('DOCUMENTO_NO_CONFIRMADO', 'El documento debe estar emitido antes de afectar inventario');
  }

  await asegurarMovimientoNoDuplicado(documentoId, empresaId, client);

  const partidasDocumento = await obtenerPartidasDocumento(documentoId, client);
  const partidasInventariables = partidasDocumento.filter((p) => (p.tipo_producto || '').toLowerCase() === 'inventariable');

  if (!partidasInventariables.length) {
    throw buildError('SIN_PARTIDAS_INVENTARIABLES', 'El documento no tiene partidas inventariables');
  }

  const almacenFallback = await resolverAlmacenDefault(client, empresaId, documento.almacen_id);

  const partidas: MovimientoPartidaPayload[] = partidasInventariables.map((p) => {
    const almacen = p.partida_almacen_id ?? almacenFallback;

    const cantidad = resolverCantidadInventariable(p);
    let signo: 1 | -1;
    if (afectaInventario === 'entrada') {
      signo = 1;
    } else if (afectaInventario === 'salida') {
      signo = -1;
    } else {
      throw buildError('AFECTA_INVENTARIO_INVALIDO', `Tipo de afectación de inventario no soportado: ${afectaInventario}`);
    }

    return {
      documento_partida_id: p.documento_partida_id,
      producto_id: p.producto_id,
      almacen_id: almacen,
      cantidad,
      signo,
      tipo_partida: 'normal',
      costo_unitario: resolverCostoDocumento(documento, p),
    };
  });

  // Devolución de venta: sin costo capturado, entra al costo de la venta original.
  if (String(documento.tipo_documento || '').toLowerCase() === 'nota_credito' && afectaInventario === 'entrada') {
    const sinCosto = partidas.filter((p) => p.costo_unitario == null);
    if (sinCosto.length > 0) {
      const costos = await resolverCostosDevolucionVenta(client, documentoId, empresaId, sinCosto);
      for (const partida of sinCosto) {
        const costo = costos.get(Number(partida.documento_partida_id ?? 0));
        if (costo == null) {
          const origen = partidasInventariables.find((p) => p.documento_partida_id === partida.documento_partida_id);
          throw buildError(
            'COSTO_DEVOLUCION_NO_DISPONIBLE',
            `No se pudo determinar el costo de entrada de ${origen?.producto_clave || `producto ${partida.producto_id}`}: no hay venta original ni costo promedio en el almacén.`,
          );
        }
        partida.costo_unitario = costo;
      }
    }
  }

  const movimientoId = await ejecutarAplicarMovimiento(
    {
      empresaId,
      tipoMovimiento: afectaInventario,
      fecha: normalizarFecha(opciones?.fecha ?? documento.fecha_documento),
      usuarioId,
      documentoId,
      observaciones: opciones?.observaciones ?? documento.observaciones ?? null,
      contactoId: documento.contacto_id,
      partidas,
      esReversion: false,
    },
    client
  );

  return { movimientoId, partidas, tipoMovimiento: afectaInventario };
}

export async function aplicarInventarioDesdeDocumento(
  documentoId: number,
  empresaId: number,
  usuarioId: number,
  opciones?: { fecha?: Date | string; observaciones?: string | null }
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await aplicarInventarioDesdeDocumentoEnTransaccion(client, documentoId, empresaId, usuarioId, opciones);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function revertirInventarioDocumento(
  documentoId: number,
  empresaId: number,
  usuarioId: number,
  opciones?: { fecha?: Date | string; observaciones?: string | null }
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await revertirInventarioDocumentoEnTransaccion(client, documentoId, empresaId, usuarioId, opciones);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reconstruirProductosMovimiento(client: PoolClient, movimientoId: number, empresaId: number) {
  const { rows } = await client.query<{ producto_id: number }>(
    `SELECT DISTINCT producto_id FROM inventario.movimientos_partidas
      WHERE movimiento_id = $1 AND empresa_id = $2`, [movimientoId, empresaId]
  );
  for (const row of rows) {
    await client.query('SELECT inventario.reconstruir_producto($1, $2)', [empresaId, row.producto_id]);
  }
}

export async function desafectarMovimientoManual(
  movimientoId: number,
  empresaId: number,
  usuarioId: number,
  motivo: string,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<any>(
      `SELECT id, documento_id, es_reversion, estatus_afectacion
         FROM inventario.movimientos
        WHERE id = $1 AND empresa_id = $2 FOR UPDATE`, [movimientoId, empresaId]
    );
    const movimiento = rows[0];
    if (!movimiento) throw buildError('MOVIMIENTO_NO_ENCONTRADO', 'El movimiento no existe.');
    if (movimiento.documento_id != null) throw buildError('MOVIMIENTO_DOCUMENTAL', 'Los movimientos originados en documentos se gestionan desde su documento.');
    if (movimiento.es_reversion) throw buildError('MOVIMIENTO_REVERSION', 'Las reversiones no se desafectan manualmente.');
    if (Number(movimiento.estatus_afectacion) !== 1) throw buildError('YA_DESAFECTADO', 'El movimiento ya está desafectado.');
    await client.query(
      `UPDATE inventario.movimientos
          SET estatus_afectacion = 0, desafectado_at = now(), desafectado_por = $3,
              motivo_desafectacion = $4, updated_at = now()
        WHERE id = $1 AND empresa_id = $2`, [movimientoId, empresaId, usuarioId, motivo || 'Desafectación manual']
    );
    await reconstruirProductosMovimiento(client, movimientoId, empresaId);
    await client.query(
      `INSERT INTO public.audit_log (empresa_id,usuario_id,modulo,entidad,entidad_id,accion,descripcion,datos_nuevos,origen)
       VALUES ($1,$2,'inventario','movimientos',$3,'desafectar',$4,$5::jsonb,'api')`,
      [empresaId, usuarioId, movimientoId, motivo || 'Desafectación manual', JSON.stringify({ estatus_afectacion: 0, motivo_desafectacion: motivo || 'Desafectación manual' })]
    );
    await client.query('COMMIT');
    return { movimientoId, estatusAfectacion: 0 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function afectarMovimientoManual(movimientoId: number, empresaId: number, usuarioId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<any>(
      `SELECT id, documento_id, es_reversion, estatus_afectacion
         FROM inventario.movimientos
        WHERE id = $1 AND empresa_id = $2 FOR UPDATE`, [movimientoId, empresaId]
    );
    const movimiento = rows[0];
    if (!movimiento) throw buildError('MOVIMIENTO_NO_ENCONTRADO', 'El movimiento no existe.');
    if (movimiento.documento_id != null) throw buildError('MOVIMIENTO_DOCUMENTAL', 'Los movimientos originados en documentos se gestionan desde su documento.');
    if (Number(movimiento.estatus_afectacion) === 1) throw buildError('YA_AFECTADO', 'El movimiento ya está afectado.');
    await client.query(
      `UPDATE inventario.movimientos
          SET estatus_afectacion = 1, afectado_at = now(), afectado_por = $3,
              updated_at = now()
        WHERE id = $1 AND empresa_id = $2`, [movimientoId, empresaId, usuarioId]
    );
    await reconstruirProductosMovimiento(client, movimientoId, empresaId);
    await client.query(
      `INSERT INTO public.audit_log (empresa_id,usuario_id,modulo,entidad,entidad_id,accion,descripcion,datos_nuevos,origen)
       VALUES ($1,$2,'inventario','movimientos',$3,'afectar',$4,$5::jsonb,'api')`,
      [empresaId, usuarioId, movimientoId, 'Afectó movimiento manual', JSON.stringify({ estatus_afectacion: 1 })]
    );
    await client.query('COMMIT');
    return { movimientoId, estatusAfectacion: 1 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function actualizarMovimientoManualDesafectado(
  movimientoId: number,
  payload: CrearMovimientoManualPayload,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<any>(
      `SELECT * FROM inventario.movimientos WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [movimientoId, payload.empresaId]
    );
    const actual = rows[0];
    if (!actual) throw buildError('MOVIMIENTO_NO_ENCONTRADO', 'El movimiento no existe.');
    if (actual.documento_id != null) throw buildError('MOVIMIENTO_DOCUMENTAL', 'Los movimientos originados en documentos no se pueden editar.');
    if (actual.es_reversion) throw buildError('MOVIMIENTO_REVERSION', 'Las reversiones no se pueden editar.');
    if (Number(actual.estatus_afectacion) !== 0) throw buildError('MOVIMIENTO_AFECTADO', 'Solo se pueden editar movimientos desafectados.');
    if (!Array.isArray(payload.partidas) || payload.partidas.length === 0) throw buildError('SIN_PARTIDAS', 'Se requiere al menos una partida.');

    const anteriores = await client.query(`SELECT * FROM inventario.movimientos_partidas WHERE movimiento_id=$1 AND empresa_id=$2 ORDER BY id`, [movimientoId, payload.empresaId]);
    const productos = new Set<number>(anteriores.rows.map((p: any) => Number(p.producto_id)));
    const normalizadas: MovimientoPartidaPayload[] = [];
    for (const [idx, p] of payload.partidas.entries()) {
      const productoId = assertPositiveNumber(p.productoId, 'PRODUCTO_REQUERIDO', `productoId faltante en partida ${idx + 1}`);
      const almacenId = assertPositiveNumber(p.almacenId, 'ALMACEN_REQUERIDO', `almacenId faltante en partida ${idx + 1}`);
      const cantidad = assertPositiveNumber(p.cantidad, 'CANTIDAD_INVALIDA', `cantidad inválida en partida ${idx + 1}`);
      const sentido = p.sentido;
      if (!sentido || !['entrada', 'salida', 'transferencia'].includes(sentido)) throw buildError('SENTIDO_REQUERIDO', `sentido faltante en partida ${idx + 1}`);
      productos.add(productoId);
      if (sentido === 'transferencia') {
        const destino = assertPositiveNumber(p.almacenDestinoId, 'ALMACEN_DESTINO_REQUERIDO', `almacenDestinoId faltante en partida ${idx + 1}`);
        if (destino === almacenId) throw buildError('ALMACEN_DESTINO_INVALIDO', 'El almacén destino no puede ser igual al origen.');
        normalizadas.push({ producto_id: productoId, almacen_id: almacenId, almacen_destino_id: destino, cantidad, signo: -1, tipo_partida: 'salida_transferencia', costo_unitario: null, sentido });
        normalizadas.push({ producto_id: productoId, almacen_id: destino, almacen_destino_id: almacenId, cantidad, signo: 1, tipo_partida: 'entrada_transferencia', costo_unitario: null, sentido });
      } else {
        const costo = p.costoUnitario == null ? null : parseNumeric(p.costoUnitario);
        if (sentido === 'entrada' && (costo == null || costo < 0)) throw buildError('COSTO_ENTRADA_REQUERIDO', `El costo unitario de la entrada es obligatorio en partida ${idx + 1}`);
        normalizadas.push({ producto_id: productoId, almacen_id: almacenId, cantidad, signo: sentido === 'entrada' ? 1 : -1, tipo_partida: 'normal', costo_unitario: costo, sentido });
      }
    }
    const antes = { ...actual, partidas: anteriores.rows };
    await client.query('DELETE FROM inventario.movimientos_partidas WHERE movimiento_id=$1 AND empresa_id=$2', [movimientoId, payload.empresaId]);
    for (const p of normalizadas) {
      await client.query(
        `INSERT INTO inventario.movimientos_partidas
          (empresa_id,movimiento_id,producto_id,almacen_id,almacen_destino_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)`,
        [payload.empresaId, movimientoId, p.producto_id, p.almacen_id, p.almacen_destino_id ?? null, normalizarFecha(payload.fecha), p.cantidad, p.signo, p.tipo_partida ?? 'normal', p.costo_unitario ?? null]
      );
    }
    await client.query(
      `UPDATE inventario.movimientos
          SET fecha=$3, observaciones=$4, contacto_id=$5, tipo_movimiento=$6,
              estatus_afectacion=1, afectado_at=now(), afectado_por=$7,
              updated_at=now()
        WHERE id=$1 AND empresa_id=$2`,
      [movimientoId, payload.empresaId, normalizarFecha(payload.fecha), payload.observaciones ?? null, payload.contactoId ?? null,
       payload.tipoMovimiento ?? 'mixto', payload.usuarioId]
    );
    const despues = await client.query(`SELECT * FROM inventario.movimientos_partidas WHERE movimiento_id=$1 AND empresa_id=$2 ORDER BY id`, [movimientoId, payload.empresaId]);
    await client.query(
      `INSERT INTO public.audit_log (empresa_id,usuario_id,modulo,entidad,entidad_id,accion,descripcion,datos_anteriores,datos_nuevos,origen)
       VALUES ($1,$2,'inventario','movimientos',$3,'editar_afectar',$4,$5::jsonb,$6::jsonb,'api')`,
      [payload.empresaId, payload.usuarioId, movimientoId, `Editó y afectó el movimiento ${actual.serie ?? ''}-${actual.numero ?? actual.id}`,
       JSON.stringify(antes), JSON.stringify({ ...actual, fecha: payload.fecha, observaciones: payload.observaciones, contacto_id: payload.contactoId, tipo_movimiento: payload.tipoMovimiento, estatus_afectacion: 1, partidas: despues.rows })]
    );
    for (const productoId of productos) await client.query('SELECT inventario.reconstruir_producto($1,$2)', [payload.empresaId, productoId]);
    await client.query('COMMIT');
    return { movimientoId, serie: actual.serie, numero: actual.numero, estatusAfectacion: 1 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function eliminarMovimientoManualDesafectado(movimientoId: number, empresaId: number, usuarioId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`inventario:${empresaId}`]);
    const { rows } = await client.query(`SELECT * FROM inventario.movimientos WHERE id=$1 AND empresa_id=$2 FOR UPDATE`, [movimientoId, empresaId]);
    const movimiento = rows[0];
    if (!movimiento) throw buildError('MOVIMIENTO_NO_ENCONTRADO', 'El movimiento no existe.');
    if (movimiento.documento_id != null) throw buildError('MOVIMIENTO_DOCUMENTAL', 'Los movimientos vinculados a documentos no se pueden eliminar.');
    if (movimiento.es_reversion) throw buildError('MOVIMIENTO_REVERSION', 'Las reversiones no se pueden eliminar.');
    if (Number(movimiento.estatus_afectacion) !== 0) throw buildError('MOVIMIENTO_AFECTADO', 'Solo se pueden eliminar movimientos desafectados.');
    await client.query('DELETE FROM inventario.movimientos_partidas WHERE movimiento_id=$1 AND empresa_id=$2', [movimientoId, empresaId]);
    await client.query('DELETE FROM inventario.movimientos WHERE id=$1 AND empresa_id=$2', [movimientoId, empresaId]);
    await client.query(
      `INSERT INTO public.audit_log (empresa_id,usuario_id,modulo,entidad,entidad_id,accion,descripcion,datos_anteriores,origen)
       VALUES ($1,$2,'inventario','movimientos',$3,'eliminar',$4,$5::jsonb,'api')`,
      [empresaId, usuarioId, movimientoId, `Eliminó movimiento ${movimiento.serie ?? ''}-${movimiento.numero ?? movimientoId}`, JSON.stringify(movimiento)]
    );
    await client.query('COMMIT');
    return { movimientoId };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function listarMovimientos(empresaId: number): Promise<MovimientoRow[]> {
  return listarMovimientosRepository(empresaId);
}

export async function obtenerMovimientoDetalle(id: number, empresaId: number): Promise<MovimientoDetalle | null> {
  return obtenerMovimientoDetalleRepository(id, empresaId);
}

export async function crearMovimientoManual(payload: CrearMovimientoManualPayload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empresaId = assertPositiveNumber(payload.empresaId, 'EMPRESA_REQUERIDA', 'empresaId es requerido');
    const usuarioId = assertPositiveNumber(payload.usuarioId, 'USUARIO_REQUERIDO', 'usuarioId es requerido');
    const tipoMovimiento = (payload.tipoMovimiento || 'mixto').toLowerCase() as TipoMovimiento | 'mixto';
    const contactoId = payload.contactoId == null ? null : assertPositiveNumber(payload.contactoId, 'CONTACTO_INVALIDO', 'contactoId inválido');
    if (contactoId != null) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM public.contactos WHERE id = $1 AND empresa_id = $2`,
        [contactoId, empresaId]
      );
      if (!rowCount) throw buildError('CONTACTO_EMPRESA_INVALIDO', 'El contacto no pertenece a la empresa activa');
    }

    if (!['entrada', 'salida', 'transferencia', 'mixto'].includes(tipoMovimiento)) {
      throw buildError('TIPO_INVALIDO', 'tipoMovimiento debe ser entrada, salida, transferencia o mixto');
    }

    if (!Array.isArray(payload.partidas) || payload.partidas.length === 0) {
      throw buildError('SIN_PARTIDAS', 'Se requiere al menos una partida para crear el movimiento');
    }

    const partidas: MovimientoPartidaPayload[] = [];

    payload.partidas.forEach((p, idx) => {
      const productoId = assertPositiveNumber(p.productoId, 'PRODUCTO_REQUERIDO', `productoId faltante en partida ${idx + 1}`);
      const almacenId = assertPositiveNumber(p.almacenId, 'ALMACEN_REQUERIDO', `almacenId faltante en partida ${idx + 1}`);
      const cantidad = assertPositiveNumber(p.cantidad, 'CANTIDAD_INVALIDA', `cantidad inválida en partida ${idx + 1}`);
      const costoUnitario = p.costoUnitario !== undefined ? parseNumeric(p.costoUnitario) : null;
      const sentido = p.sentido ?? (tipoMovimiento === 'mixto' ? undefined : tipoMovimiento);
      if (!sentido) throw buildError('SENTIDO_REQUERIDO', `sentido faltante en partida ${idx + 1}`);

      if (sentido === 'transferencia') {
        const almacenDestinoId = assertPositiveNumber(
          p.almacenDestinoId,
          'ALMACEN_DESTINO_REQUERIDO',
          `almacenDestinoId faltante en partida ${idx + 1}`
        );
        if (almacenDestinoId === almacenId) {
          throw buildError('ALMACEN_DESTINO_INVALIDO', `El almacén destino no puede ser igual al origen en partida ${idx + 1}`);
        }

        // La función SQL recibe una transferencia lógica y crea internamente
        // sus afectaciones de salida y entrada. No expandirla aquí: hacerlo
        // duplicaría ambas afectaciones.
        partidas.push({
          producto_id: productoId,
          almacen_id: almacenId,
          almacen_destino_id: almacenDestinoId,
          cantidad,
          signo: -1,
          tipo_partida: 'salida_transferencia',
          costo_unitario: null,
          sentido,
        });
      } else {
        const signo: 1 | -1 = sentido === 'entrada' ? 1 : -1;
        if (sentido === 'entrada' && (costoUnitario == null || costoUnitario < 0)) {
          throw buildError('COSTO_ENTRADA_REQUERIDO', `El costo unitario de la entrada es obligatorio y no puede ser negativo en partida ${idx + 1}`);
        }
        partidas.push({
          producto_id: productoId,
          almacen_id: almacenId,
          cantidad,
          signo,
          tipo_partida: 'normal',
          costo_unitario: costoUnitario,
          sentido,
        });
      }
    });

    const movimientoId = await ejecutarAplicarMovimiento(
      {
        empresaId,
        tipoMovimiento,
        fecha: normalizarFecha(payload.fecha),
        usuarioId,
        documentoId: null,
        observaciones: payload.observaciones ?? null,
        contactoId,
        partidas,
        esReversion: false,
      },
      client
    );

    await client.query('COMMIT');
    return { movimientoId, partidas, tipoMovimiento };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
