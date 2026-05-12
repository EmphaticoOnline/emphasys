import type { NavigateFunction } from 'react-router-dom';
import type { TipoDocumento } from '../../types/documentos.types';

export type DocumentoModulo = 'ventas' | 'compras';

export type GeneratedDocumentFocus = {
  documentoId: number;
  tipoDocumento: TipoDocumento;
  modulo: DocumentoModulo;
  nonce: string;
};

type GeneratedDocumentNavigationState = {
  generatedDocumentFocus?: GeneratedDocumentFocus;
};

export function resolveDocumentoModulo(pathname?: string | null): DocumentoModulo {
  return pathname?.startsWith('/compras') ? 'compras' : 'ventas';
}

export function resolveDocumentosListPath(tipoDocumento: TipoDocumento, modulo: DocumentoModulo = 'ventas'): string {
  return `/${modulo}/${tipoDocumento}`;
}

export function resolveDocumentoFormPath(tipoDocumento: TipoDocumento, documentoId: number | string, modulo: DocumentoModulo = 'ventas'): string {
  return `${resolveDocumentosListPath(tipoDocumento, modulo)}/${documentoId}`;
}

export function buildGeneratedDocumentFocus(
  documentoId: number,
  tipoDocumento: TipoDocumento,
  modulo: DocumentoModulo
): GeneratedDocumentFocus {
  return {
    documentoId,
    tipoDocumento,
    modulo,
    nonce: `${modulo}:${tipoDocumento}:${documentoId}:${Date.now()}`,
  };
}

export function navigateToGeneratedDocument(
  navigate: NavigateFunction,
  options: {
    documentoId: number;
    tipoDocumento: TipoDocumento;
    modulo?: DocumentoModulo;
    pathname?: string;
  }
): void {
  const modulo = options.modulo ?? resolveDocumentoModulo(options.pathname);
  navigate(resolveDocumentosListPath(options.tipoDocumento, modulo), {
    state: {
      generatedDocumentFocus: buildGeneratedDocumentFocus(options.documentoId, options.tipoDocumento, modulo),
    } satisfies GeneratedDocumentNavigationState,
  });
}

export function parseGeneratedDocumentFocus(state: unknown): GeneratedDocumentFocus | null {
  const candidate = (state as GeneratedDocumentNavigationState | null | undefined)?.generatedDocumentFocus;
  if (!candidate) return null;

  const documentoId = Number(candidate.documentoId);
  const tipoDocumento = String(candidate.tipoDocumento ?? '').trim();
  const modulo = candidate.modulo === 'compras' ? 'compras' : 'ventas';
  const nonce = String(candidate.nonce ?? '');

  if (!Number.isFinite(documentoId) || documentoId <= 0 || !tipoDocumento || !nonce) {
    return null;
  }

  return {
    documentoId,
    tipoDocumento,
    modulo,
    nonce,
  };
}