import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { crearConciliacion } from '../../services/finanzasService';
import type { ConciliacionPayload } from '../../types/finanzas';

interface ConciliacionDialogProps {
  open: boolean;
  cuentaId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ConciliacionDialog({ open, cuentaId, onClose, onSaved }: ConciliacionDialogProps) {
  const [fechaCorte, setFechaCorte] = useState<string>('');
  const [saldoBanco, setSaldoBanco] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFechaCorte(new Date().toISOString().slice(0, 10));
    setSaldoBanco('');
    setObservaciones('');
    setError(null);
  }, [open]);

  const handleSave = async () => {
    if (!cuentaId || !fechaCorte || !saldoBanco) {
      setError('Completa la fecha y el saldo bancario.');
      return;
    }

    const payload: ConciliacionPayload = {
      cuenta_id: cuentaId,
      fecha_corte: fechaCorte,
      saldo_banco: Number(saldoBanco),
      observaciones: observaciones || null,
    };

    try {
      setSaving(true);
      setError(null);
      await crearConciliacion(payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo conciliar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Conciliar cuenta</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Fecha de corte"
            type="date"
            size="small"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Saldo banco"
            type="number"
            size="small"
            value={saldoBanco}
            onChange={(e) => setSaldoBanco(e.target.value)}
            inputProps={{ step: '0.01' }}
            fullWidth
          />

          <TextField
            label="Observaciones"
            size="small"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas adicionales"
            fullWidth
            multiline
            minRows={2}
          />

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          {saving ? 'Guardando...' : 'Conciliar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConciliacionDialog;
