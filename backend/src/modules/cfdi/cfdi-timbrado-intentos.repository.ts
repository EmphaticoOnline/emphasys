import type { PoolClient } from 'pg';
import pool from '../../config/database';

export type EstadoIntentoTimbrado =
  | 'aceptado_pendiente_descarga'
  | 'xml_recuperado'
  | 'persistido'
  | 'error_descarga'
  | 'error_validacion'
  | 'error_previo_pac'
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
  cfdiPacConfigId: number;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO public.cfdi_intentos_timbrado
       (empresa_id, documento_id, proveedor, proveedor_cfdi_id, endpoint, estado, cfdi_pac_config_id)
     VALUES ($1, $2, 'facturama', $3, $4, 'aceptado_pendiente_descarga', $5)
     ON CONFLICT (proveedor, proveedor_cfdi_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [params.empresaId, params.documentoId, params.proveedorCfdiId, params.endpoint, params.cfdiPacConfigId]
  );
  return rows[0].id;
}

/** Registra un fallo que ocurrió antes de que Facturama devolviera un ID. */
export async function registrarErrorTimbrado(params: {
  empresaId: number;
  documentoId: number;
  tipoDocumento: string;
  errorCodigo: string;
  errorMensaje: unknown;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO public.cfdi_intentos_timbrado
       (empresa_id, documento_id, proveedor, proveedor_cfdi_id, endpoint, estado,
        error_codigo, error_mensaje_sanitizado, metadata_sanitizada)
     VALUES ($1, $2, 'facturama', NULL, 'not-requested', 'error_previo_pac', $3, $4, $5::jsonb)
     RETURNING id`,
    [
      params.empresaId,
      params.documentoId,
      params.errorCodigo,
      sanitizarMensaje(params.errorMensaje),
      JSON.stringify({ tipo_documento: params.tipoDocumento, fase: 'antes_de_respuesta_pac' }),
    ],
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
