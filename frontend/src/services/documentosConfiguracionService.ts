import { apiFetch } from './apiFetch';
import type { AfectaInventario, DocumentoEmpresa, FlujoDocumentosResponse } from '../types/documentosConfiguracion';

const BASE_URL = '/api/configuracion/documentos-empresa';
const FLUJO_URL = '/api/configuracion/documentos-flujo';

export async function fetchDocumentosEmpresa(): Promise<DocumentoEmpresa[]> {
  return apiFetch<DocumentoEmpresa[]>(BASE_URL);
}

export async function updateDocumentoEmpresa(
  tipoDocumentoId: number,
  payload: {
    activo: boolean;
    whatsapp_plantilla_default_id?: number | null;
    afecta_inventario?: AfectaInventario | null;
    afecta_reservado?: boolean;
  }
) {
  return apiFetch(`${BASE_URL}/${tipoDocumentoId}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function fetchFlujoDocumentos(): Promise<FlujoDocumentosResponse> {
  return apiFetch<FlujoDocumentosResponse>(FLUJO_URL);
}

export async function updateTransicionDocumento(origenId: number, destinoId: number, activo: boolean) {
  return apiFetch(FLUJO_URL, {
    method: 'PUT',
    body: {
      tipo_documento_origen_id: origenId,
      tipo_documento_destino_id: destinoId,
      activo,
    } as any,
  });
}