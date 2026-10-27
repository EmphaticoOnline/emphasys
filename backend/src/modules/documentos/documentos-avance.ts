import { Request, Response } from 'express';
import pool from '../../config/database';
import type { TipoDocumento } from '../../types/documentos';
import { evaluarScopeVentas, resolverContextoScopeComercial } from '../auth/scope-comercial';
import { debeAplicarScopeVentas } from './documento-scope';

/**
 * Avance de un documento hacia los documentos que se generaron desde él
 * (pedido → remisión, orden de compra → recepción, cotización → factura, …).
 *
 * Solo lectura. Se calcula con `documentos_partidas_vinculos`, igual que
 * "generar desde origen": cada vínculo dice cuánta cantidad de una partida
 * origen pasó a una partida destino. Los destinos cancelados no cuentan.
 * Solo considera el primer nivel (destinos directos del documento).
 */

export type AvanceDestino = {
  tipo_documento: string;
  /** Documentos destino distintos (sin cancelados). */
  documentos: number;
  /** Cantidad total que pasó a este tipo, topada por partida a lo ordenado. */
  cantidad: number;
  /** Parte proporcional del total de las partidas (con impuestos) que pasó a este tipo. */
  importe: number;
  /** Lo mismo sin impuestos: es lo que cuantifica la venta o compra. */
  subtotal: number;
};

export type AvancePartida = {
  partida_id: number;
  cantidad: number;
  /** Cantidad que pasó a cada tipo destino. */
  por_destino: Record<string, number>;
};

export type AvanceDocumentoResponse = {
  documento_id: number;
  tipo_documento: string;
  cantidad_total: number;
  importe_total: number;
  subtotal_total: number;
  destinos: AvanceDestino[];
  partidas: AvancePartida[];
};

const redondear = (value: number) => Math.round(value * 100) / 100;

export async function obtenerAvanceDocumentoRepository(
  documentoId: number,
  empresaId: number,
  agenteId: number | null,
): Promise<AvanceDocumentoResponse | null> {
  const { rows: docRows } = await pool.query<{ id: number; tipo_documento: string }>(
    `SELECT id, tipo_documento
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
        AND ($3::int IS NULL OR agente_id = $3)
      LIMIT 1`,
    [documentoId, empresaId, agenteId],
  );
  const documento = docRows[0];
  if (!documento) return null;

  const { rows: partidaRows } = await pool.query<{ id: number; cantidad: string; total_partida: string | null; subtotal_partida: string | null }>(
    `SELECT id, cantidad, total_partida, subtotal_partida
       FROM documentos_partidas
      WHERE documento_id = $1
      ORDER BY numero_partida NULLS LAST, id`,
    [documentoId],
  );

  const { rows: vinculoRows } = await pool.query<{
    partida_origen_id: number;
    tipo_destino: string;
    cantidad: string;
    documentos: string[];
  }>(
    `SELECT v.partida_origen_id,
            LOWER(d.tipo_documento) AS tipo_destino,
            SUM(v.cantidad) AS cantidad,
            ARRAY_AGG(DISTINCT d.id::text) AS documentos
       FROM documentos_partidas_vinculos v
       JOIN documentos d ON d.id = v.documento_destino_id
      WHERE v.documento_origen_id = $1
        AND d.empresa_id = $2
        AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
      GROUP BY v.partida_origen_id, LOWER(d.tipo_documento)`,
    [documentoId, empresaId],
  );

  const partidas: AvancePartida[] = partidaRows.map((row) => ({
    partida_id: Number(row.id),
    cantidad: Number(row.cantidad) || 0,
    por_destino: {},
  }));
  const partidaPorId = new Map(partidas.map((partida) => [partida.partida_id, partida]));
  const totalPorPartida = new Map(partidaRows.map((row) => [Number(row.id), Number(row.total_partida) || 0]));
  // subtotal_partida ya trae prorrateado el descuento global: su suma es el subtotal del documento.
  const subtotalPorPartida = new Map(partidaRows.map((row) => [Number(row.id), Number(row.subtotal_partida) || 0]));
  const destinos = new Map<string, { cantidad: number; importe: number; subtotal: number; documentos: Set<string> }>();

  vinculoRows.forEach((row) => {
    const partida = partidaPorId.get(Number(row.partida_origen_id));
    if (!partida) return;
    // Nunca más de lo ordenado en la partida, aunque haya vínculos de más.
    const cantidad = Math.min(Number(row.cantidad) || 0, partida.cantidad);
    partida.por_destino[row.tipo_destino] = cantidad;

    const destino = destinos.get(row.tipo_destino) ?? { cantidad: 0, importe: 0, subtotal: 0, documentos: new Set<string>() };
    destino.cantidad += cantidad;
    if (partida.cantidad > 0) {
      const proporcion = cantidad / partida.cantidad;
      destino.importe += (totalPorPartida.get(partida.partida_id) ?? 0) * proporcion;
      destino.subtotal += (subtotalPorPartida.get(partida.partida_id) ?? 0) * proporcion;
    }
    row.documentos.forEach((id) => destino.documentos.add(id));
    destinos.set(row.tipo_destino, destino);
  });

  return {
    documento_id: Number(documento.id),
    tipo_documento: String(documento.tipo_documento).toLowerCase(),
    cantidad_total: partidas.reduce((acc, partida) => acc + partida.cantidad, 0),
    importe_total: redondear([...totalPorPartida.values()].reduce((acc, total) => acc + total, 0)),
    subtotal_total: redondear([...subtotalPorPartida.values()].reduce((acc, subtotal) => acc + subtotal, 0)),
    destinos: [...destinos.entries()].map(([tipo, destino]) => ({
      tipo_documento: tipo,
      documentos: destino.documentos.size,
      cantidad: destino.cantidad,
      importe: redondear(destino.importe),
      subtotal: redondear(destino.subtotal),
    })),
    partidas,
  };
}

export async function obtenerAvanceDocumentoHandler(req: Request, res: Response) {
  try {
    const empresaId = Number(req.context?.empresaId ?? (req as any).empresaActiva?.id);
    const id = Number(req.params.id);
    if (!empresaId || !id) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    // Mismo alcance que el detalle: en ventas, un vendedor sólo ve sus documentos.
    const tipo = String(req.query.tipo_documento ?? '').toLowerCase() as TipoDocumento;
    const scope = evaluarScopeVentas(
      await resolverContextoScopeComercial(empresaId, req.auth?.userId, req.auth?.esSuperadmin),
    );
    const aplicaScope = !tipo || debeAplicarScopeVentas(tipo);
    if (aplicaScope && scope.sinAcceso) {
      return res.status(403).json({ error: 'Su usuario no tiene un vendedor asociado; no puede consultar documentos.' });
    }

    const resultado = await obtenerAvanceDocumentoRepository(id, empresaId, aplicaScope ? scope.agenteId : null);
    if (!resultado) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    return res.json(resultado);
  } catch (error: any) {
    console.error('[avance-documento] Error', error);
    return res.status(500).json({ error: error?.message ?? 'Error al obtener el avance del documento' });
  }
}
