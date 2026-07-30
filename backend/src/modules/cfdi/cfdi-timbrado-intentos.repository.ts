import type { PoolClient } from 'pg';
import pool from '../../config/database';

export type EstadoIntentoTimbrado =
  | 'aceptado_pendiente_descarga'
  | 'xml_recuperado'
  | 'persistido'
  | 'error_descarga'
  | 'error_validacion'
  | 'reconciliado';

function sanitizarMensaje(value: unknown): string | null {
  const message = value instanceof Error ? value.message : String(value ?? '');
  return message.trim().slice(0, 500) || null;
}

export async function registrarIdAceptado(params: {
  empresaId: number;
  documentoId: number;
  proveedorCfdiId: string;
  endpoint: string;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO public.cfdi_intentos_timbrado
       (empresa_id, documento_id, proveedor, proveedor_cfdi_id, endpoint, estado)
     VALUES ($1, $2, 'facturama', $3, $4, 'aceptado_pendiente_descarga')
     ON CONFLICT (proveedor, proveedor_cfdi_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [params.empresaId, params.documentoId, params.proveedorCfdiId, params.endpoint]
  );
  return rows[0].id;
}

export async function actualizarIntentoTimbrado(
  intentoId: number,
  estado: EstadoIntentoTimbrado,
  extras: {
    uuid?: string | null;
    errorCodigo?: string | null;
    errorMensaje?: unknown;
    incrementarDescarga?: boolean;
  } = {},
  client?: PoolClient
): Promise<void> {
  const executor = client ?? pool;
  await executor.query(
    `UPDATE public.cfdi_intentos_timbrado
        SET estado = $2,
            uuid = COALESCE($3, uuid),
            error_codigo = $4,
            error_mensaje_sanitizado = $5,
            intentos_descarga = intentos_descarga + CASE WHEN $6 THEN 1 ELSE 0 END,
            updated_at = NOW()
      WHERE id = $1`,
    [
      intentoId,
      estado,
      extras.uuid ?? null,
      extras.errorCodigo ?? null,
      sanitizarMensaje(extras.errorMensaje),
      extras.incrementarDescarga === true,
    ]
  );
}

