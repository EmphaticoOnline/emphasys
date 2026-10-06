import type { FinanzasOperacion } from '../../types/finanzas';
import { DOCUMENTO_TYPE_CONFIG } from '../documentos/documentoTypeConfig';
import { resolveDocumentoFormPath, type DocumentoModulo } from '../documentos/documentoNavigation';
import { resolverFolioVisual } from '../../utils/documentos.utils';

const ETIQUETA_NATURALEZA: Record<string, string> = {
  cobro_cliente: 'Cobro de cliente',
  pago_proveedor: 'Pago a proveedor',
};

const MODULO_DOCUMENTO_FINANZAS: Record<string, DocumentoModulo> = {
  pago_cliente: 'ventas',
  pago_proveedor: 'compras',
};

export type OrigenMovimiento = {
  titulo: string;
  ruta: string | null;
};

/** Referencia capturada por el usuario. El número secuencial del documento origen no es una referencia. */
export function referenciaCapturada(op: Pick<
  FinanzasOperacion,
  'referencia' | 'documento_origen_id' | 'documento_origen_numero'
>): string {
  const referencia = String(op.referencia ?? '').trim();
  if (!referencia) return '';
  const numero = op.documento_origen_numero;
  if (op.documento_origen_id && numero != null && referencia === String(numero)) return '';
  return referencia;
}

function idPositivo(value: number | null | undefined): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function rutaDocumento(tipo: string, documentoId: number): string | null {
  const config = DOCUMENTO_TYPE_CONFIG[tipo];
  if (!config) return null;
  const modulo = config.modulo === 'ventas' || config.modulo === 'compras'
    ? config.modulo
    : MODULO_DOCUMENTO_FINANZAS[tipo] ?? null;
  if (!modulo) return null;
  return resolveDocumentoFormPath(tipo, documentoId, modulo);
}

export function origenMovimiento(op: Pick<
  FinanzasOperacion,
  | 'naturaleza_operacion'
  | 'documento_origen_id'
  | 'documento_origen_tipo_documento'
  | 'documento_origen_serie'
  | 'documento_origen_numero'
  | 'documento_origen_serie_externa'
  | 'documento_origen_numero_externo'
  | 'factura_id'
>): OrigenMovimiento | null {
  const naturaleza = String(op.naturaleza_operacion ?? 'movimiento_general');
  const documentoId = idPositivo(op.documento_origen_id);
  const facturaId = idPositivo(op.factura_id);
  const naturalezaExterna = naturaleza !== 'movimiento_general';
  if (!naturalezaExterna && !documentoId && !facturaId) return null;

  const tipo = String(op.documento_origen_tipo_documento ?? '').trim();
  const etiquetaDocumento = tipo ? DOCUMENTO_TYPE_CONFIG[tipo]?.label : '';
  const folio = documentoId && tipo
    ? resolverFolioVisual(
        {
          serie: op.documento_origen_serie ?? null,
          numero: op.documento_origen_numero ?? null,
          serie_externa: op.documento_origen_serie_externa ?? null,
          numero_externo: op.documento_origen_numero_externo ?? null,
        },
        tipo,
      )
    : '';
  const documento = [etiquetaDocumento, folio].filter(Boolean).join(' ');
  const etiquetaNaturaleza = ETIQUETA_NATURALEZA[naturaleza];

  let detalle = etiquetaNaturaleza || documento;
  if (!detalle && (documentoId || facturaId)) detalle = 'documento asociado';
  if (!detalle) detalle = 'otro módulo';
  const titulo = etiquetaNaturaleza && documento
    ? `Origen: ${etiquetaNaturaleza} · ${documento}`
    : `Origen: ${detalle}`;

  return {
    titulo,
    ruta: documentoId && tipo ? rutaDocumento(tipo, documentoId) : null,
  };
}
