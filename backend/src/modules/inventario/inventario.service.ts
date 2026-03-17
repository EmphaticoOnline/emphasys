import pool from '../../config/database';
import {
  listarMovimientosRepository,
  MovimientoRow,
  obtenerMovimientoDetalleRepository,
  MovimientoDetalle,
} from './inventario.repository';
import type { PoolClient } from 'pg';

type TipoMovimiento = 'entrada' | 'salida' | 'transferencia';

type MovimientoPartidaPayload = {
  documento_partida_id?: number | null;
  producto_id: number;
  almacen_id: number;
  almacen_destino_id?: number | null;
  cantidad: number;
  signo: 1 | -1;
  tipo_partida?: 'normal' | 'salida_transferencia' | 'entrada_transferencia';
  costo_unitario?: number | null;
};

export type CrearMovimientoManualPayload = {
  empresaId: number;
  usuarioId: number;
  tipoMovimiento: TipoMovimiento;
  fecha?: Date | string;
  observaciones?: string | null;
  partidas: Array<{
    productoId: number;
    almacenId: number;
    cantidad: number;
    almacenDestinoId?: number | null;
    costoUnitario?: number | null;
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
};

type PartidaDocumentoRow = {
  documento_partida_id: number;
  producto_id: number;
  cantidad: number;
  factor_conversion: number | null;
  cantidad_inventariable: number | null;
  partida_almacen_id: number | null;
  costo: number | null;
  tipo_producto: string;
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
    partidas: MovimientoPartidaPayload[];
    esReversion?: boolean;
  },
  client: PoolClient
): Promise<number> {
  const { empresaId, tipoMovimiento, fecha, usuarioId, documentoId, observaciones, partidas, esReversion } = params;

  if (!Array.isArray(partidas) || partidas.length === 0) {
    throw buildError('SIN_PARTIDAS', 'No hay partidas para aplicar el movimiento de inventario');
  }

  const { rows } = await client.query<{ movimiento_id: number }>(
    `SELECT inventario.aplicar_movimiento($1, $2, $3, $4, $5, $6, $7::jsonb) AS movimiento_id`,
    [
      empresaId,
      tipoMovimiento,
      fecha,
      usuarioId,
      documentoId,
      observaciones ?? null,
      JSON.stringify(partidas),
    ]
  );

  const movimientoId = rows[0]?.movimiento_id ?? null;
  if (!movimientoId) {
    throw buildError('MOVIMIENTO_NO_CREADO', 'No se pudo crear el movimiento de inventario');
  }

  if (typeof esReversion === 'boolean') {
    await client.query(`UPDATE inventario.movimientos SET es_reversion = $1 WHERE id = $2`, [esReversion, movimientoId]);
  }

  return movimientoId;
}

function resolverCantidadInventariable(partida: PartidaDocumentoRow): number {
  const cantidadInventariable = parseNumeric(partida.cantidad_inventariable);
  if (cantidadInventariable && cantidadInventariable > 0) {
    return cantidadInventariable;
  }

  const baseCantidad = parseNumeric(partida.cantidad) ?? 0;
  const factor = parseNumeric(partida.factor_conversion) ?? 1;
  const calculada = baseCantidad * factor;
  if (calculada > 0) return calculada;

  throw buildError('CANTIDAD_INVALIDA', `Cantidad inválida para la partida ${partida.documento_partida_id}`);
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
            COALESCE(etd.afecta_inventario, 'none') AS afecta_inventario,
            d.observaciones
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
            COALESCE(p.tipo_producto, '') AS tipo_producto
       FROM documentos_partidas dp
       JOIN productos p ON p.id = dp.producto_id
      WHERE dp.documento_id = $1
        AND dp.producto_id IS NOT NULL`,
    [documentoId]
  );

  return rows;
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
  }>(
    `SELECT id, tipo_movimiento, fecha, observaciones
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

function normalizarFecha(fecha?: Date | string): Date | string {
  if (!fecha) return new Date();
  if (fecha instanceof Date) return fecha;
  const parsed = new Date(fecha);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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

    const documento = await obtenerDocumentoInventario(documentoId, empresaId, client);
    if (!documento) {
      throw buildError('DOCUMENTO_NO_ENCONTRADO', 'Documento no encontrado para la empresa indicada');
    }

    const afectaInventario = (documento.afecta_inventario || 'none').toLowerCase();
    if (afectaInventario === 'none') {
      throw buildError('TIPO_NO_AFECTA_INVENTARIO', 'El tipo de documento no afecta inventario');
    }

    const estatus = (documento.estatus_documento || '').toLowerCase();
    if (estatus !== 'confirmado') {
      throw buildError('DOCUMENTO_NO_CONFIRMADO', 'El documento debe estar confirmado antes de afectar inventario');
    }

    await asegurarMovimientoNoDuplicado(documentoId, empresaId, client);

    const partidasDocumento = await obtenerPartidasDocumento(documentoId, client);
    const partidasInventariables = partidasDocumento.filter((p) => (p.tipo_producto || '').toLowerCase() === 'inventariable');

    if (!partidasInventariables.length) {
      throw buildError('SIN_PARTIDAS_INVENTARIABLES', 'El documento no tiene partidas inventariables');
    }

    const almacenDefault = await obtenerParametroNumero('inventario.almacen_default', empresaId, client);

    const partidas: MovimientoPartidaPayload[] = partidasInventariables.map((p) => {
      const almacen = p.partida_almacen_id ?? documento.almacen_id ?? almacenDefault;
      if (!almacen) {
        throw buildError('ALMACEN_REQUERIDO', `No se encontró almacén para la partida ${p.documento_partida_id}`);
      }

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
        costo_unitario: p.costo ?? null,
      };
    });

    const movimientoId = await ejecutarAplicarMovimiento(
      {
        empresaId,
        tipoMovimiento: afectaInventario,
        fecha: normalizarFecha(opciones?.fecha ?? documento.fecha_documento),
        usuarioId,
        documentoId,
        observaciones: opciones?.observaciones ?? documento.observaciones ?? null,
        partidas,
        esReversion: false,
      },
      client
    );

    await client.query('COMMIT');
    return { movimientoId, partidas, tipoMovimiento: afectaInventario };
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

    const { rowCount: yaRevertido } = await client.query(
      `SELECT 1 FROM inventario.movimientos WHERE documento_id = $1 AND empresa_id = $2 AND es_reversion = true LIMIT 1`,
      [documentoId, empresaId]
    );
    if (yaRevertido && yaRevertido > 0) {
      throw buildError('YA_REVERTIDO', 'El documento ya cuenta con un movimiento de reversión');
    }

    const movimientoOriginal = await obtenerMovimientoOriginal(documentoId, empresaId, client);
    if (!movimientoOriginal) {
      throw buildError('MOVIMIENTO_NO_ENCONTRADO', 'No existe un movimiento original para revertir');
    }

    const partidasOriginales = await obtenerPartidasMovimiento(movimientoOriginal.id, empresaId, client);
    if (!partidasOriginales.length) {
      throw buildError('SIN_PARTIDAS_ORIGINALES', 'El movimiento original no tiene partidas');
    }

    const partidas: MovimientoPartidaPayload[] = partidasOriginales.map((p) => {
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
      };
    });

    const movimientoId = await ejecutarAplicarMovimiento(
      {
        empresaId,
        tipoMovimiento: movimientoOriginal.tipo_movimiento,
        fecha: normalizarFecha(opciones?.fecha ?? new Date()),
        usuarioId,
        documentoId,
        observaciones:
          opciones?.observaciones ??
          `Reversión del movimiento ${movimientoOriginal.id} generado por documento ${documentoId}`,
        partidas,
        esReversion: true,
      },
      client
    );

    await client.query('COMMIT');
    return { movimientoId, partidas, tipoMovimiento: movimientoOriginal.tipo_movimiento };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
    const tipoMovimiento = (payload.tipoMovimiento || '').toLowerCase() as TipoMovimiento;

    if (!['entrada', 'salida', 'transferencia'].includes(tipoMovimiento)) {
      throw buildError('TIPO_INVALIDO', 'tipoMovimiento debe ser entrada, salida o transferencia');
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

      if (tipoMovimiento === 'transferencia') {
        const almacenDestinoId = assertPositiveNumber(
          p.almacenDestinoId,
          'ALMACEN_DESTINO_REQUERIDO',
          `almacenDestinoId faltante en partida ${idx + 1}`
        );
        if (almacenDestinoId === almacenId) {
          throw buildError('ALMACEN_DESTINO_INVALIDO', `El almacén destino no puede ser igual al origen en partida ${idx + 1}`);
        }

        partidas.push(
          {
            producto_id: productoId,
            almacen_id: almacenId,
            almacen_destino_id: almacenDestinoId,
            cantidad,
            signo: -1,
            tipo_partida: 'salida_transferencia',
            costo_unitario: costoUnitario,
          },
          {
            producto_id: productoId,
            almacen_id: almacenId,
            almacen_destino_id: almacenDestinoId,
            cantidad,
            signo: 1,
            tipo_partida: 'entrada_transferencia',
            costo_unitario: costoUnitario,
          }
        );
      } else {
        const signo: 1 | -1 = tipoMovimiento === 'entrada' ? 1 : -1;
        partidas.push({
          producto_id: productoId,
          almacen_id: almacenId,
          cantidad,
          signo,
          tipo_partida: 'normal',
          costo_unitario: costoUnitario,
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
