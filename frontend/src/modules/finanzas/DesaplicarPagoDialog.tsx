import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

const MOTIVO_MAX = 500;

type Props = {
  open: boolean;
  pagoFolio: string;
  facturaFolio: string;
  importe: string;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
};

export function DesaplicarPagoDialog({
  open,
  pagoFolio,
  facturaFolio,
  importe,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const motivoNormalizado = motivo.trim();
  const motivoValido = motivoNormalizado.length <= MOTIVO_MAX;
  const helperText = useMemo(() => {
    if (!motivo.length) return `Opcional, máximo ${MOTIVO_MAX} caracteres.`;
    if (motivoNormalizado.length > MOTIVO_MAX) return `El motivo no puede exceder ${MOTIVO_MAX} caracteres.`;
    return `${motivoNormalizado.length}/${MOTIVO_MAX}`;
  }, [motivo, motivoNormalizado.length]);

  useEffect(() => {
    if (!open) setMotivo('');
  }, [open]);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Desaplicar pago</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Se quitará la aplicación de {importe} del pago {pagoFolio || 'seleccionado'} a la factura
          {' '}{facturaFolio || 'seleccionada'}. La factura volverá a tener {importe} pendientes y el pago
          {' '}recuperará {importe} disponibles. El documento de pago no se eliminará.
        </DialogContentText>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          label="Motivo"
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          error={motivo.length > 0 && !motivoValido}
          helperText={helperText}
          inputProps={{ maxLength: MOTIVO_MAX + 1 }}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!motivoValido || loading}
          onClick={() => onConfirm(motivoNormalizado)}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Desaplicar pago
        </Button>
      </DialogActions>
    </Dialog>
  );
}
