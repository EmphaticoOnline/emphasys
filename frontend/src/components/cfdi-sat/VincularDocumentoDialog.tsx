import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  fetchCfdiSatCandidatosVinculacion,
  vincularCfdiSatDocumento,
  type CfdiSatCandidatoVinculacion,
  type CfdiSatComprobante,
  type CfdiSatConfianzaDuplicado,
  type CfdiSatVinculacionResultado,
} from '../../services/cfdiSatService';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-MX');
}

function formatMonto(valor: number | string | null): string {
  if (valor == null) return '—';
  return Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2 });
}

const CONFIANZA_COLOR: Record<CfdiSatConfianzaDuplicado, 'success' | 'warning' | 'default'> = {
  alta: 'success',
  media: 'warning',
  baja: 'default',
};

export default function VincularDocumentoDialog({
  comprobante,
  onClose,
  onVinculado,
}: {
  comprobante: CfdiSatComprobante | null;
  onClose: () => void;
  onVinculado: (resultado: CfdiSatVinculacionResultado) => void;
}) {
  const navigate = useNavigate();
  const [candidatos, setCandidatos] = React.useState<CfdiSatCandidatoVinculacion[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [candidatoSeleccionado, setCandidatoSeleccionado] = React.useState<CfdiSatCandidatoVinculacion | null>(null);
  const [vinculando, setVinculando] = React.useState(false);
  const [resultado, setResultado] = React.useState<CfdiSatVinculacionResultado | null>(null);

  const comprobanteId = comprobante?.id ?? null;

  React.useEffect(() => {
    setCandidatoSeleccionado(null);
    setResultado(null);
    setError(null);

    if (!comprobanteId) {
      setCandidatos(null);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setCandidatos(null);

    fetchCfdiSatCandidatosVinculacion(comprobanteId)
      .then((data) => {
        if (!cancelado) setCandidatos(data);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudieron obtener los candidatos');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [comprobanteId]);

  const handleConfirmarVinculacion = async () => {
    if (!comprobanteId || !candidatoSeleccionado) return;
    setVinculando(true);
    setError(null);
    try {
      const data = await vincularCfdiSatDocumento(comprobanteId, candidatoSeleccionado.documento_id);
      setResultado(data);
      onVinculado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular el comprobante');
    } finally {
      setVinculando(false);
    }
  };

  return (
    <Dialog open={Boolean(comprobante)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Vincular a factura de compra existente</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {comprobante && (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              <strong>UUID:</strong> <span style={{ fontFamily: 'monospace' }}>{comprobante.uuid}</span>
            </Typography>
            <Typography variant="body2">
              <strong>Emisor:</strong> {comprobante.rfc_emisor}
              {comprobante.nombre_emisor ? ` — ${comprobante.nombre_emisor}` : ''}
            </Typography>
            <Typography variant="body2">
              <strong>Fecha:</strong> {formatFecha(comprobante.fecha_emision)}
            </Typography>
            <Typography variant="body2">
              <strong>Total:</strong> {formatMonto(comprobante.total)} {comprobante.moneda ?? ''}
            </Typography>
          </Stack>
        )}

        <Divider />

        {resultado ? (
          <Alert severity="success">
            Comprobante vinculado con la factura #{resultado.documento_id}. Ya no se puede volver a importar ni
            vincular este UUID a otro documento.
          </Alert>
        ) : loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : candidatoSeleccionado ? (
          <Stack spacing={1.5}>
            <Alert severity="warning">
              Vas a vincular este CFDI con la factura de compra #{candidatoSeleccionado.documento_id}. El
              comprobante quedará marcado como importado y la factura tomará el UUID del CFDI. Esta acción no crea
              ningún documento nuevo.
            </Alert>
            <Typography variant="body2">
              <strong>Proveedor:</strong> {candidatoSeleccionado.proveedor_nombre ?? '—'}
            </Typography>
            <Typography variant="body2">
              <strong>Fecha:</strong> {formatFecha(candidatoSeleccionado.fecha_documento)}
            </Typography>
            <Typography variant="body2">
              <strong>Total:</strong> {formatMonto(candidatoSeleccionado.total)}
            </Typography>
            <Typography variant="body2">
              <strong>Confianza:</strong> {candidatoSeleccionado.confianza} — {candidatoSeleccionado.motivo}
            </Typography>
          </Stack>
        ) : candidatos && candidatos.length === 0 ? (
          <Alert severity="info">
            No se encontraron facturas de compra existentes que coincidan con este CFDI (mismo proveedor y total
            similar).
          </Alert>
        ) : candidatos ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Serie/folio externo</TableCell>
                  <TableCell>Estatus</TableCell>
                  <TableCell>Confianza</TableCell>
                  <TableCell align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidatos.map((candidato) => (
                  <TableRow key={candidato.documento_id} hover>
                    <TableCell>
                      {[candidato.serie, candidato.numero].filter(Boolean).join('') || `#${candidato.documento_id}`}
                    </TableCell>
                    <TableCell>{candidato.proveedor_nombre ?? '—'}</TableCell>
                    <TableCell>{formatFecha(candidato.fecha_documento)}</TableCell>
                    <TableCell align="right">{formatMonto(candidato.total)}</TableCell>
                    <TableCell>
                      {candidato.serie_externa || candidato.numero_externo != null
                        ? `${candidato.serie_externa ?? ''}${candidato.numero_externo ?? ''}`
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{candidato.estatus_documento}</TableCell>
                    <TableCell>
                      <Chip label={candidato.confianza} size="small" color={CONFIANZA_COLOR[candidato.confianza]} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setCandidatoSeleccionado(candidato)}
                        sx={{ textTransform: 'none' }}
                      >
                        Vincular
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {candidatoSeleccionado && !resultado ? (
          <>
            <Button onClick={() => setCandidatoSeleccionado(null)} disabled={vinculando} sx={{ textTransform: 'none' }}>
              Regresar
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleConfirmarVinculacion()}
              disabled={vinculando}
              sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
            >
              {vinculando ? 'Vinculando...' : 'Confirmar vinculación'}
            </Button>
          </>
        ) : resultado ? (
          <>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>
              Cerrar
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(`/compras/factura_compra/${resultado.documento_id}`)}
              sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
            >
              Ver factura
            </Button>
          </>
        ) : (
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
