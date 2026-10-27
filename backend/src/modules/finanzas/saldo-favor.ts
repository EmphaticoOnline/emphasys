import { Request, Response } from 'express';
import pool from '../../config/database';
import { crearDocumentoRepository } from '../documentos/documentos.repository';
import type { TipoDocumento } from '../../types/documentos';
import { assertNotaCreditoElegibleParaAplicacion } from './aplicaciones-saldo.rules';

/**
 * Cancelar un saldo a favor que no se quiere seguir arrastrando: lo "por
 * aplicar" de un pago (cobrado o pagado de más) o el disponible de una nota
 * de crédito.
 *
 * En una sola transacción crea un documento `ajuste_favor_cliente` /
 * `ajuste_favor_proveedor` (naturaleza cargo, ya emitido) por el monto y le
 * aplica el pago o la nota (origen = pago/NC, destino = el ajuste). Así el
 * saldo del pago/NC baja sin tocar facturas.
 *
 * El tope del monto (hoy $99) lo valida el frontend: será configurable por
 * empresa. Aquí sólo se valida que no exceda el saldo disponible.
 */

const TIPO_AJUSTE_POR_ORIGEN: Record<string, TipoDocumento> = {
  pago_cliente: 'ajuste_favor_cliente',
  nota_credito: 'ajuste_favor_cliente',
  pago_proveedor: 'ajuste_favor_proveedor',
  nota_credito_compra: 'ajuste_favor_proveedor',
};

const redondear = (value: number) => Math.round(value * 100) / 100;

class SaldoFavorError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function cancelarSaldoFavorTx(
  documentoId: number,
  empresaId: number,
  data: { monto: number; fecha: string; motivo?: string | null; usuarioId?: number | null },
) {
  const monto = redondear(Number(data.monto));
  if (!(monto > 0)) throw new SaldoFavorError(400, 'El monto debe ser mayor a cero.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.fecha ?? ''))) throw new SaldoFavorError(400, 'La fecha no es válida.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{
      id: number; tipo_documento: string; estatus_documento: string | null; contacto_principal_id: number | null;
      moneda: string | null; tipo_cambio: string | null; serie: string | null; numero: number | null;
    }>(
      `SELECT id, LOWER(tipo_documento) AS tipo_documento, estatus_documento, contacto_principal_id,
              moneda, tipo_cambio, serie, numero
         FROM documentos
        WHERE id = $1 AND empresa_id = $2
        FOR UPDATE`,
      [documentoId, empresaId],
    );
    const origen = rows[0];
    if (!origen) throw new SaldoFavorError(404, 'Documento no encontrado.');
    const tipoAjuste = TIPO_AJUSTE_POR_ORIGEN[origen.tipo_documento];
    if (!tipoAjuste) throw new SaldoFavorError(409, 'Sólo se puede cancelar el saldo a favor de pagos y notas de crédito.');
    const estatus = String(origen.estatus_documento ?? '').trim().toLowerCase();
    if (estatus === 'cancelado' || estatus === 'cancelada') throw new SaldoFavorError(409, 'El documento está cancelado.');
    if (origen.tipo_documento.startsWith('nota_credito')) {
      await assertNotaCreditoElegibleParaAplicacion(client, documentoId, empresaId);
    }

    // Mismo cálculo de saldo que la vista documentos_saldo (abono: total − lo aplicado desde él).
    const { rows: saldoRows } = await client.query<{ saldo: string }>(
      `SELECT saldo FROM documentos_saldo WHERE id = $1 AND empresa_id = $2`,
      [documentoId, empresaId],
    );
    const saldo = redondear(Number(saldoRows[0]?.saldo ?? 0));
    if (monto - saldo > 0.000001) {
      throw new SaldoFavorError(409, `El monto excede el saldo disponible ($${saldo.toFixed(2)}).`);
    }

    const tipoCambio = Math.abs(Number(origen.tipo_cambio ?? 1)) || 1;
    const folioOrigen = [origen.serie, origen.numero].filter((parte) => parte !== null && parte !== '').join('-');
    const ajuste = await crearDocumentoRepository(
      {
        tipo_documento: tipoAjuste,
        estatus_documento: 'Emitido',
        contacto_principal_id: origen.contacto_principal_id,
        fecha_documento: data.fecha,
        moneda: origen.moneda || 'MXN',
        tipo_cambio: tipoCambio,
        subtotal: monto,
        iva: 0,
        total: monto,
        tratamiento_impuestos: 'normal',
        observaciones: String(data.motivo ?? '').trim() || `Cancelación de saldo a favor de ${folioOrigen || `#${documentoId}`}`,
        usuario_creacion_id: data.usuarioId ?? null,
      } as any,
      empresaId,
      tipoAjuste,
      client,
    );

    // Origen = pago/NC (abono), destino = el ajuste (cargo). `monto` va en la
    // moneda base del origen, como en el resto de aplicaciones.
    await client.query(
      `INSERT INTO aplicaciones_saldo
         (empresa_id, documento_origen_id, documento_destino_id, monto, monto_moneda_documento, fecha_aplicacion, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [empresaId, documentoId, ajuste.id, redondear(monto * tipoCambio), monto, data.fecha, data.usuarioId ?? null],
    );

    await client.query('COMMIT');
    return { ajuste_id: Number(ajuste.id), serie: ajuste.serie ?? null, numero: ajuste.numero ?? null, monto };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function postCancelarSaldoFavor(req: Request, res: Response) {
  try {
    const empresaId = Number(req.context?.empresaId);
    const id = Number(req.params.id);
    if (!empresaId || !id) return res.status(400).json({ error: 'Parámetros inválidos' });
    const resultado = await cancelarSaldoFavorTx(id, empresaId, {
      monto: Number(req.body?.monto),
      fecha: String(req.body?.fecha ?? ''),
      motivo: req.body?.motivo ?? null,
      usuarioId: req.auth?.userId ?? null,
    });
    return res.status(201).json(resultado);
  } catch (error: any) {
    const status = error instanceof SaldoFavorError ? error.status : Number(error?.status) || 500;
    if (status >= 500) console.error('[cancelar-saldo-favor] Error', error);
    return res.status(status).json({ error: error?.message ?? 'No se pudo cancelar el saldo a favor.' });
  }
}
