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
  Typography,
} from '@mui/material';
import {
  importarCfdiSatComprobantesLote,
  type CfdiSatImportacionLoteResultado,
} from '../../services/cfdiSatService';

export default function ImportarLoteComprasDialog({
  comprobanteIds,
  onClose,
  onFinalizado,
}: {
  comprobanteIds: number[] | null;
  onClose: () => void;
  onFinalizado: () => void;
}) {
  const [procesando, setProcesando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<CfdiSatImportacionLoteResultado | null>(null);

  React.useEffect(() => {
    if (!comprobanteIds) {
      setResultado(null);
      setError(null);
      setProcesando(false);
    }
  }, [comprobanteIds]);

  const handleConfirmar = async () => {
    if (!comprobanteIds || comprobanteIds.length === 0) return;
    setProcesando(true);
    setError(null);
    try {
      const data = await importarCfdiSatComprobantesLote(comprobanteIds);
      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la importación por lote');
    } finally {
      setProcesando(false);
    }
  };

  const handleCerrar = () => {
    const huboIntento = Boolean(resultado);
    onClose();
    if (huboIntento) {
      onFinalizado();
    }
  };

  const cantidad = comprobanteIds?.length ?? 0;

  return (
    <Dialog open={Boolean(comprobanteIds && cantidad > 0)} onClose={handleCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Importar comprobantes seleccionados a Compras</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {!resultado && !procesando && (
          <Typography variant="body2">
            ¿Importar <strong>{cantidad}</strong> comprobante{cantidad === 1 ? '' : 's'} seleccionado
            {cantidad === 1 ? '' : 's'} a Compras? Cada uno se creará como factura de compra en borrador. Los que
            fallen no afectan a los demás.
          </Typography>
        )}

        {procesando && (
          <Stack alignItems="center" spacing={1} py={4}>
            <CircularProgress size={28} />
            <Typography variant="caption" color="text.secondary">
              Importando {cantidad} comprobante{cantidad === 1 ? '' : 's'}...
            </Typography>
          </Stack>
        )}

        {resultado && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Chip label={`Total: ${resultado.resumen.total}`} size="small" />
              <Chip label={`Importados: ${resultado.resumen.importados}`} size="small" color="success" />
              <Chip
                label={`Fallidos: ${resultado.resumen.fallidos}`}
                size="small"
                color={resultado.resumen.fallidos > 0 ? 'error' : 'default'}
              />
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>UUID</TableCell>
                    <TableCell>Resultado</TableCell>
                    <TableCell>Detalle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resultado.resultados.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{item.uuid ?? `#${item.id}`}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.ok ? 'OK' : 'ERROR'}
                          size="small"
                          color={item.ok ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        {item.ok ? `Documento #${item.documento_id}` : item.mensaje_error ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCerrar} disabled={procesando} sx={{ textTransform: 'none' }}>
          {resultado ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!resultado && (
          <Button
            variant="contained"
            disabled={procesando}
            onClick={() => void handleConfirmar()}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
          >
            {procesando ? 'Importando...' : `Importar ${cantidad}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
