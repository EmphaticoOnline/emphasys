import * as React from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { fetchCfdiSatPaquetesDeSolicitud, type CfdiSatPaqueteResumen } from '../../services/cfdiSatService';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-MX');
}

const ESTATUS_COLOR: Record<CfdiSatPaqueteResumen['estatus'], 'default' | 'success' | 'error'> = {
  pendiente: 'default',
  descargado: 'success',
  error: 'error',
};

export default function PaquetesSolicitudDialog({
  solicitudId,
  onClose,
}: {
  solicitudId: number | null;
  onClose: () => void;
}) {
  const [paquetes, setPaquetes] = React.useState<CfdiSatPaqueteResumen[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!solicitudId) {
      setPaquetes([]);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);

    fetchCfdiSatPaquetesDeSolicitud(solicitudId)
      .then((data) => {
        if (!cancelado) setPaquetes(data);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudieron cargar los paquetes');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [solicitudId]);

  return (
    <Dialog open={Boolean(solicitudId)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Paquetes de la solicitud #{solicitudId}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : paquetes.length === 0 ? (
          <Alert severity="info">Esta solicitud aún no tiene paquetes (verifica la solicitud primero).</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Package ID (SAT)</TableCell>
                  <TableCell>Estatus</TableCell>
                  <TableCell>Descargado</TableCell>
                  <TableCell align="right">Comprobantes</TableCell>
                  <TableCell align="right">ZIP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paquetes.map((paquete) => (
                  <TableRow key={paquete.id}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{paquete.sat_package_id}</TableCell>
                    <TableCell>
                      <Tooltip title={paquete.mensaje_error ?? ''} disableHoverListener={!paquete.mensaje_error}>
                        <Chip label={paquete.estatus.toUpperCase()} size="small" color={ESTATUS_COLOR[paquete.estatus]} />
                      </Tooltip>
                    </TableCell>
                    <TableCell>{formatFecha(paquete.descargado_en)}</TableCell>
                    <TableCell align="right">{paquete.total_comprobantes}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={paquete.tiene_zip ? 'success.main' : 'text.disabled'}>
                        {paquete.tiene_zip ? 'Sí' : 'No'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
