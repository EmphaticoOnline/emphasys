import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { ApiFetchError } from '../../services/apiFetch';
import {
  fetchCfdiSatImportacionPreview,
  importarCfdiSatComprobanteACompras,
  type CfdiSatDocumentoImportado,
  type CfdiSatImportacionPreview,
} from '../../services/cfdiSatService';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-MX');
}

function extraerCodigoError(err: unknown): string | null {
  const payload = (err as ApiFetchError)?.payload as { code?: unknown } | undefined;
  return typeof payload?.code === 'string' ? payload.code : null;
}

export default function ImportarComprasDialog({
  comprobanteId,
  rfcEmisor,
  nombreEmisor,
  onClose,
  onImportado,
}: {
  comprobanteId: number | null;
  /** RFC/nombre del emisor tal como vienen del comprobante SAT — se usan para prellenar
   *  "Crear proveedor" cuando el preview falla porque el proveedor no existe todavía. */
  rfcEmisor?: string | null;
  nombreEmisor?: string | null;
  onClose: () => void;
  onImportado: (documento: CfdiSatDocumentoImportado) => void;
}) {
  const navigate = useNavigate();
  const [preview, setPreview] = React.useState<CfdiSatImportacionPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [importando, setImportando] = React.useState(false);
  const [documentoCreado, setDocumentoCreado] = React.useState<CfdiSatDocumentoImportado | null>(null);

  React.useEffect(() => {
    if (!comprobanteId) {
      setPreview(null);
      setError(null);
      setErrorCode(null);
      setDocumentoCreado(null);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setPreview(null);
    setDocumentoCreado(null);

    fetchCfdiSatImportacionPreview(comprobanteId)
      .then((data) => {
        if (!cancelado) setPreview(data);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No se pudo previsualizar la importación');
          setErrorCode(extraerCodigoError(err));
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [comprobanteId]);

  const handleImportar = async () => {
    if (!comprobanteId) return;
    setImportando(true);
    setError(null);
    setErrorCode(null);
    try {
      const documento = await importarCfdiSatComprobanteACompras(comprobanteId);
      setDocumentoCreado(documento);
      onImportado(documento);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el comprobante');
      setErrorCode(extraerCodigoError(err));
    } finally {
      setImportando(false);
    }
  };

  const handleCrearProveedor = () => {
    const rfc = preview?.emisor.rfc ?? rfcEmisor ?? '';
    const nombre = preview?.emisor.nombre ?? nombreEmisor ?? '';
    const params = new URLSearchParams({ tipo_contacto: 'Proveedor' });
    if (rfc) params.set('rfc', rfc);
    if (nombre) params.set('nombre', nombre);
    navigate(`/contactos/nuevo?${params.toString()}`);
  };

  const mostrarCrearProveedor = errorCode === 'PROVEEDOR_NO_ENCONTRADO';

  return (
    <Dialog open={Boolean(comprobanteId)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Importar CFDI a Compras</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : documentoCreado ? (
          <Alert severity="success">
            Factura de compra creada en borrador: {[documentoCreado.serie, documentoCreado.numero].filter(Boolean).join('') || `#${documentoCreado.id}`}.
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error">{error}</Alert>}
            {mostrarCrearProveedor && (
              <Button
                variant="outlined"
                onClick={handleCrearProveedor}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                Crear proveedor con este RFC
              </Button>
            )}
            {preview && (
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>UUID:</strong> {preview.uuid}
                </Typography>
                <Typography variant="body2">
                  <strong>Proveedor:</strong> {preview.proveedor.nombre} ({preview.emisor.rfc})
                </Typography>
                <Typography variant="body2">
                  <strong>Fecha:</strong> {formatFecha(preview.fecha)}
                </Typography>
                <Typography variant="body2">
                  <strong>Total:</strong>{' '}
                  {Number(preview.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {preview.moneda}
                </Typography>
                <Typography variant="body2">
                  <strong>Conceptos:</strong> {preview.numero_conceptos}
                </Typography>
                <Typography variant="caption" color="#6b7280">
                  Se creará como factura de compra en estado Borrador. No se generan pagos ni movimientos bancarios.
                </Typography>
              </Stack>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {documentoCreado ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!documentoCreado && (
          <Button
            variant="contained"
            disabled={!preview || importando}
            onClick={() => void handleImportar()}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
          >
            {importando ? 'Importando...' : 'Confirmar importación'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
