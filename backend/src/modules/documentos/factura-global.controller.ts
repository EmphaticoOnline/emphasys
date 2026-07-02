import { Request, Response } from 'express';
import pool from '../../config/database';
import type { PoolClient } from 'pg';

type VentaElegible = {
  id: number;
  contacto_principal_id: number | null;
  moneda: string;
  tipo_cambio: string;
  subtotal: string;
  iva: string;
  total: string;
  saldo: string;
};

// Ventas público general que aún no pertenecen a ninguna factura global y no han sido timbradas individualmente.
async function buscarVentasElegibles(
  empresaId: number,
  fechaDesde: string,
  fechaHasta: string,
  client?: PoolClient
): Promise<VentaElegible[]> {
  const executor = client ?? pool;
  const { rows } = await executor.query<VentaElegible>(
    `SELECT d.id,
            d.contacto_principal_id,
            d.moneda,
            d.tipo_cambio,
            d.subtotal,
            d.iva,
            d.total,
            GREATEST(
              d.total - COALESCE(SUM(a.monto_moneda_documento), 0),
              0
            ) AS saldo
       FROM documentos d
       LEFT JOIN aplicaciones_saldo a
         ON a.documento_destino_id = d.id
        AND a.empresa_id = d.empresa_id
       LEFT JOIN documentos_cfdi dc
         ON dc.documento_id = d.id
      WHERE d.empresa_id = $1
        AND d.tipo_documento = 'factura'
        AND LOWER(d.tratamiento_impuestos) = 'venta_publico_general'
        AND d.es_publico_general = true
        AND d.factura_global_id IS NULL
        AND dc.documento_id IS NULL
        AND d.fecha_documento BETWEEN $2 AND $3
      GROUP BY d.id, d.contacto_principal_id, d.moneda, d.tipo_cambio, d.subtotal, d.iva, d.total
     HAVING d.total - COALESCE(SUM(a.monto_moneda_documento), 0) > 0.001
     ORDER BY d.fecha_documento, d.id`,
    [empresaId, fechaDesde, fechaHasta]
  );
  return rows;
}

export async function previewFacturaGlobal(req: Request, res: Response) {
  const empresaId = Number(req.context?.empresaId);
  const { fecha_desde, fecha_hasta } = req.body as { fecha_desde?: string; fecha_hasta?: string };

  if (!empresaId || !fecha_desde || !fecha_hasta) {
    return res.status(400).json({ error: 'Parámetros requeridos: fecha_desde, fecha_hasta' });
  }

  try {
    const ventas = await buscarVentasElegibles(empresaId, fecha_desde, fecha_hasta);

    const subtotal = ventas.reduce((s, v) => s + Number(v.subtotal || 0), 0);
    const iva = ventas.reduce((s, v) => s + Number(v.iva || 0), 0);
    const total = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalSaldo = ventas.reduce((s, v) => s + Number(v.saldo || 0), 0);

    return res.json({
      count: ventas.length,
      subtotal,
      iva,
      total,
      total_saldo: totalSaldo,
      ventas_ids: ventas.map((v) => v.id),
    });
  } catch (err: any) {
    console.error('[factura-global] previewFacturaGlobal error:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener preview' });
  }
}

export async function generarFacturaGlobal(req: Request, res: Response) {
  const empresaId = Number(req.context?.empresaId);
  const usuarioId = req.auth?.userId ?? null;
  const {
    fecha_desde,
    fecha_hasta,
    periodicidad,
    mes,
    anio,
  } = req.body as {
    fecha_desde?: string;
    fecha_hasta?: string;
    periodicidad?: string;
    mes?: string;
    anio?: string | number;
  };

  if (!empresaId || !fecha_desde || !fecha_hasta || !periodicidad || !mes || !anio) {
    return res.status(400).json({
      error: 'Parámetros requeridos: fecha_desde, fecha_hasta, periodicidad, mes, anio',
    });
  }

  const periodicidadStr = String(periodicidad).padStart(2, '0');
  const mesStr = String(mes).padStart(2, '0');
  const anioNum = Number(anio);

  if (!Number.isFinite(anioNum) || anioNum < 2000 || anioNum > 2099) {
    return res.status(400).json({ error: 'Año inválido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ventas = await buscarVentasElegibles(empresaId, fecha_desde, fecha_hasta, client);
    if (!ventas.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'No hay ventas elegibles para el período indicado' });
    }

    // Datos de la empresa
    const { rows: empresaRows } = await client.query(
      `SELECT e.codigo_postal_id FROM core.empresas e WHERE e.id = $1 LIMIT 1`,
      [empresaId]
    );
    const codigoPostalId = empresaRows[0]?.codigo_postal_id ?? null;

    // Totales agregados
    const subtotalGlobal = ventas.reduce((s, v) => s + Number(v.subtotal || 0), 0);
    const ivaGlobal = ventas.reduce((s, v) => s + Number(v.iva || 0), 0);
    const totalGlobal = ventas.reduce((s, v) => s + Number(v.total || 0), 0);

    // Reservar número de serie para la factura global (usa serie FAC u otra disponible)
    const { rows: serieRows } = await client.query(
      `SELECT id, serie FROM series_documento
        WHERE empresa_id = $1
          AND LOWER(tipo_documento) = 'factura'
          AND activa = true
        ORDER BY id
        LIMIT 1`,
      [empresaId]
    );
    const serieDoc = serieRows[0];
    let serieDocId: number | null = serieDoc?.id ?? null;
    let serie: string = serieDoc?.serie ?? 'FAC';
    let numero = 1;

    if (serieDocId) {
      const { rows: numRows } = await client.query(
        `UPDATE series_documento
            SET ultimo_numero = COALESCE(ultimo_numero, 0) + 1,
                updated_at = NOW()
          WHERE id = $1
          RETURNING ultimo_numero`,
        [serieDocId]
      );
      numero = numRows[0]?.ultimo_numero ?? 1;
    }

    // Crear el documento de factura global
    const { rows: factGlobRows } = await client.query(
      `INSERT INTO documentos (
          empresa_id,
          tipo_documento,
          tratamiento_impuestos,
          es_publico_general,
          serie,
          numero,
          fecha_documento,
          moneda,
          subtotal,
          iva,
          total,
          saldo,
          rfc_receptor,
          nombre_receptor,
          regimen_fiscal_receptor,
          uso_cfdi,
          forma_pago,
          metodo_pago,
          codigo_postal_receptor,
          periodicidad_global,
          meses_global,
          anio_global,
          estatus_documento,
          usuario_creacion_id
        ) VALUES (
          $1, 'factura', 'factura_global', true,
          $2, $3,
          CURRENT_DATE, 'MXN',
          $4, $5, $6, $6,
          'XAXX010101000', 'PUBLICO EN GENERAL', '616', 'S01', '99', 'PPD',
          $7,
          $8, $9, $10,
          'Borrador', $11
        ) RETURNING id`,
      [
        empresaId,
        serie,
        numero,
        subtotalGlobal.toFixed(2),
        ivaGlobal.toFixed(2),
        totalGlobal.toFixed(2),
        codigoPostalId,
        periodicidadStr,
        mesStr,
        anioNum,
        usuarioId,
      ]
    );
    const facturaGlobalId: number = factGlobRows[0].id;

    // Copiar partidas de todas las ventas a la factura global
    const ventasIds = ventas.map((v) => v.id);
    await client.query(
      `INSERT INTO documentos_partidas (
          documento_id,
          numero_partida,
          producto_id,
          descripcion_alterna,
          cantidad,
          precio_unitario,
          descuento,
          descuento_tipo,
          descuento_monto,
          subtotal_partida,
          total_partida,
          es_parte_oportunidad
        )
        SELECT $1,
               ROW_NUMBER() OVER (ORDER BY dp.documento_id, dp.numero_partida),
               dp.producto_id,
               dp.descripcion_alterna,
               dp.cantidad,
               dp.precio_unitario,
               dp.descuento,
               dp.descuento_tipo,
               dp.descuento_monto,
               dp.subtotal_partida,
               COALESCE(dp.total_partida, dp.subtotal_partida),
               false
          FROM documentos_partidas dp
         WHERE dp.documento_id = ANY($2::int[])
         ORDER BY dp.documento_id, dp.numero_partida`,
      [facturaGlobalId, ventasIds]
    );

    // Copiar impuestos de las partidas
    await client.query(
      `INSERT INTO documentos_partidas_impuestos (partida_id, impuesto_id, tasa, base, monto)
        SELECT nueva.id, dpi.impuesto_id, dpi.tasa, dpi.base, dpi.monto
          FROM documentos_partidas_impuestos dpi
          JOIN documentos_partidas original
            ON original.id = dpi.partida_id
           AND original.documento_id = ANY($1::int[])
          JOIN documentos_partidas nueva
            ON nueva.documento_id = $2
           AND nueva.numero_partida = (
                 SELECT ROW_NUMBER() OVER (ORDER BY dp2.documento_id, dp2.numero_partida)
                   FROM documentos_partidas dp2
                  WHERE dp2.documento_id = ANY($1::int[])
                  ORDER BY dp2.documento_id, dp2.numero_partida
                  LIMIT 1 OFFSET (original.numero_partida - 1)
               )`,
      [ventasIds, facturaGlobalId]
    );

    // Marcar ventas como incluidas en esta factura global
    await client.query(
      `UPDATE documentos
          SET factura_global_id = $1
        WHERE id = ANY($2::int[])
          AND empresa_id = $3`,
      [facturaGlobalId, ventasIds, empresaId]
    );

    // Crear y aplicar ajuste_cliente por cada venta (por su saldo pendiente)
    // Usar la serie ACL si existe, si no se usa serie sin número formal
    const { rows: serieAjusteRows } = await client.query(
      `SELECT id, serie FROM series_documento
        WHERE empresa_id = $1
          AND LOWER(tipo_documento) = 'ajuste_cliente'
          AND activa = true
        ORDER BY id
        LIMIT 1`,
      [empresaId]
    );
    const serieAjusteId: number | null = serieAjusteRows[0]?.id ?? null;
    const serieAjuste: string = serieAjusteRows[0]?.serie ?? 'ACL';

    for (const venta of ventas) {
      const saldoVenta = Number(venta.saldo || 0);
      if (saldoVenta <= 0.001) continue;

      // Reservar número del ajuste
      let numeroAjuste = 1;
      if (serieAjusteId) {
        const { rows: numAjRows } = await client.query(
          `UPDATE series_documento
              SET ultimo_numero = COALESCE(ultimo_numero, 0) + 1,
                  updated_at = NOW()
            WHERE id = $1
            RETURNING ultimo_numero`,
          [serieAjusteId]
        );
        numeroAjuste = numAjRows[0]?.ultimo_numero ?? 1;
      }

      // Insertar ajuste_cliente
      const { rows: ajusteRows } = await client.query(
        `INSERT INTO documentos (
            empresa_id,
            tipo_documento,
            tratamiento_impuestos,
            contacto_principal_id,
            moneda,
            tipo_cambio,
            subtotal,
            iva,
            total,
            saldo,
            serie,
            numero,
            fecha_documento,
            estatus_documento,
            usuario_creacion_id,
            factura_global_id
          ) VALUES (
            $1, 'ajuste_cliente', 'normal',
            $2, $3, $4,
            $5, 0, $5, $5,
            $6, $7,
            CURRENT_DATE, 'Activo', $8, $9
          ) RETURNING id`,
        [
          empresaId,
          venta.contacto_principal_id,
          venta.moneda || 'MXN',
          venta.tipo_cambio || 1,
          saldoVenta.toFixed(2),
          serieAjuste,
          numeroAjuste,
          usuarioId,
          facturaGlobalId,
        ]
      );
      const ajusteId: number = ajusteRows[0].id;

      // Aplicar ajuste_cliente contra la venta (aplicaciones_saldo)
      // monto = saldo en moneda base; monto_moneda_documento = saldo en moneda del destino
      const tipoCambio = Math.abs(Number(venta.tipo_cambio || 1)) || 1;
      const montoBase = Number((saldoVenta * tipoCambio).toFixed(6));
      const montoMonedaDoc = Number(saldoVenta.toFixed(6));

      await client.query(
        `INSERT INTO aplicaciones_saldo (
            empresa_id,
            documento_origen_id,
            documento_destino_id,
            monto,
            monto_moneda_documento,
            fecha_aplicacion,
            fecha_creacion
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NOW())`,
        [empresaId, ajusteId, venta.id, montoBase, montoMonedaDoc]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      factura_global_id: facturaGlobalId,
      ventas_incluidas: ventas.length,
      subtotal: subtotalGlobal,
      iva: ivaGlobal,
      total: totalGlobal,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[factura-global] generarFacturaGlobal error:', err);
    return res.status(500).json({ error: err.message || 'Error al generar factura global' });
  } finally {
    client.release();
  }
}
