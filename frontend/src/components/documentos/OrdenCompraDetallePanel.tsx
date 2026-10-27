// Panel derecho de la orden de compra con el esqueleto común de los
// workspaces: cifras sin IVA (Subtotal · Recibido · Pendiente por recibir;
// el IVA no cuantifica la compra) y pestañas
// Documento · Partidas · Relacionados (las recepciones y facturas de compra
// aparecen en Relacionados).
import { useEffect, useState } from 'react';
import { CircularProgress, Stack } from '@mui/material';
import {
  getAvanceDocumento,
  type AvanceDocumentoResponse,
  type RecepcionResumenResponse,
} from '../../services/documentosService';
import type { DocumentoDetalleResponse } from '../../types/documentoDetalle';
import { PartidasTab, RelacionadosTab } from './DocumentoDetalleContent';
import OrdenCompraDocumentoHoja from './OrdenCompraDocumentoHoja';
import { DocumentoWorkspaceMetricas, DocumentoWorkspacePestanas } from './workspace/DocumentoWorkspaceSkeleton';

type Props = {
  documentoId: number;
  /** Subtotal sin IVA de la orden. */
  subtotal: number;
  detail: { data?: DocumentoDetalleResponse | null; loading: boolean };
  resumen: RecepcionResumenResponse | null;
  tokens: any;
  currency: Intl.NumberFormat;
  folio: string;
  provider: string;
  date: string;
  status: string;
  formatDate: (value: unknown) => string;
  compacto?: boolean;
};

function useAvance(documentoId: number) {
  const [avance, setAvance] = useState<AvanceDocumentoResponse | null>(null);
  useEffect(() => {
    let vivo = true;
    setAvance(null);
    getAvanceDocumento(documentoId, 'orden_compra')
      .then((value) => { if (vivo) setAvance(value); })
      .catch(() => { if (vivo) setAvance(null); });
    return () => { vivo = false; };
  }, [documentoId]);
  return avance;
}

export default function OrdenCompraDetallePanel({
  documentoId,
  subtotal,
  detail,
  resumen,
  tokens,
  currency,
  folio,
  provider,
  date,
  status,
  formatDate,
  compacto = false,
}: Props) {
  const avance = useAvance(documentoId);
  const recibido = avance?.destinos.find((destino) => destino.tipo_documento === 'recepcion')?.subtotal ?? 0;
  const pendiente = Math.max(0, Math.round((subtotal - recibido) * 100) / 100);
  const progreso = subtotal > 0 ? (recibido / subtotal) * 100 : 0;
  const lines = detail.data?.partidas ?? [];

  const cargando = <Stack alignItems="center" py={6}><CircularProgress size={26} /></Stack>;

  return (
    <>
      <DocumentoWorkspaceMetricas
        compacto={compacto}
        progreso={avance ? progreso : null}
        metricas={[
          { label: 'Subtotal', value: currency.format(subtotal), tono: 'amount' },
          { label: 'Recibido', value: avance ? currency.format(recibido) : '—', tono: 'applied' },
          { label: 'Pendiente por recibir', value: avance ? currency.format(pendiente) : '—', tono: pendiente > 0 ? 'blocked' : 'available' },
        ]}
      />
      <DocumentoWorkspacePestanas
        documentoKey={documentoId}
        pestanas={[
          {
            id: 'documento',
            label: 'Documento',
            render: () => (
              <OrdenCompraDocumentoHoja
                detail={detail}
                lines={lines}
                resumen={resumen}
                tokens={tokens}
                currency={currency}
                folio={folio}
                provider={provider}
                date={date}
                status={status}
                formatDate={formatDate}
              />
            ),
          },
          {
            id: 'partidas',
            label: 'Partidas',
            render: () => (detail.loading && !detail.data ? cargando : <PartidasTab partidas={lines} documento={detail.data?.documento ?? null} />),
          },
          {
            id: 'relacionados',
            label: 'Relacionados',
            render: () => (detail.loading && !detail.data
              ? cargando
              : <RelacionadosTab documentosRelacionados={detail.data?.documentosRelacionados ?? []} formatter={currency} />),
          },
        ]}
      />
    </>
  );
}
