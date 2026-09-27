import type { Response } from 'express';
import { CfdiAcceptedPendingDownloadError } from './facturama.client';
import { CfdiValidationError } from './cfdi.service';
import { CfdiPacConfigurationError } from './cfdi-pac-config.resolver';
import { actualizarIntentoTimbrado, registrarErrorTimbrado } from './cfdi-timbrado-intentos.repository';

export type CfdiPublicError = {
  code: string;
  message: string;
  details?: string[];
};

const FALLBACK = 'No fue posible timbrar el documento. Intenta nuevamente.';

function safeLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 10);
}

function normalizeKnownMessage(message: string): CfdiPublicError | null {
  const normalized = message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\s*(at\s+|stack\s*trace|auth(orization)?\s*:|cookie\s*:)/i.test(line))
    .join('\n')
    .replace(/https?:\/\/\S+/gi, '[URL omitida]')
    .replace(/<[^>]+>/g, '[contenido omitido]')
    .trim();
  if (!normalized) return null;
  return {
    code: 'CFDI_VALIDATION_ERROR',
    message: normalized.slice(0, 1000),
  };
}

export function normalizarErrorCfdi(error: unknown): CfdiPublicError {
  if (error instanceof CfdiPacConfigurationError) {
    return {
      code: 'CFDI_PAC_CONFIG_MISSING',
      message: 'La empresa no tiene una configuración PAC activa para timbrar CFDI.',
    };
  }

  if (error instanceof CfdiAcceptedPendingDownloadError) {
    return {
      code: 'CFDI_ACCEPTED_PENDING_DOWNLOAD',
      message: error.message,
      details: [`intento_id: ${error.intentoId}`],
    };
  }

  const candidate = error as any;
  if (error instanceof CfdiValidationError || candidate?.isFacturamaValidation === true) {
    const known = normalizeKnownMessage(String(candidate?.message ?? ''));
    if (known) {
      const details = safeLines(candidate?.details);
      return {
        ...known,
        code: typeof candidate?.code === 'string' ? candidate.code : known.code,
        ...(details.length ? { details } : {}),
      };
    }
  }

  return { code: 'CFDI_TIMBRADO_ERROR', message: FALLBACK };
}

export async function responderErrorCfdi(params: {
  res: Response;
  error: unknown;
  documentoId: number;
  empresaId: number;
  tipoDocumento: string;
  status?: number;
  intentoId?: number;
}): Promise<void> {
  const publicError = normalizarErrorCfdi(params.error);
  const rawMessage = params.error instanceof Error ? params.error.message : String(params.error ?? '');
  console.error('[CFDI] Timbrado fallido', {
    documento_id: params.documentoId,
    empresa_id: params.empresaId,
    tipo_documento: params.tipoDocumento,
    intento_id: params.intentoId ?? null,
    error: params.error,
  });

  if (params.intentoId) {
    await actualizarIntentoTimbrado(params.intentoId, 'error_validacion', {
      errorCodigo: publicError.code,
      errorMensaje: rawMessage || publicError.message,
    }).catch((persistError) => console.error('[CFDI] No se pudo actualizar intento fallido', persistError));
  } else {
    await registrarErrorTimbrado({
      empresaId: params.empresaId,
      documentoId: params.documentoId,
      tipoDocumento: params.tipoDocumento,
      errorCodigo: publicError.code,
      errorMensaje: rawMessage || publicError.message,
    }).catch((persistError) => console.error('[CFDI] No se pudo registrar intento fallido', persistError));
  }

  params.res.status(params.status ?? (publicError.code === 'CFDI_TIMBRADO_ERROR' ? 500 : 400)).json(publicError);
}
