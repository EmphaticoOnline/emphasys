import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { FinanzasCuenta, TransferenciaPayload, TransferenciaUpdatePayload } from '../../types/finanzas';
import { crearTransferencia, actualizarTransferencia } from '../../services/finanzasService';

interface TransferenciaDialogProps {
  open: boolean;
  cuentas: FinanzasCuenta[];
  defaultOrigenId?: number | null;
  transferencia?: TransferenciaUpdatePayload | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TransferenciaDialog({ open, cuentas, defaultOrigenId, transferencia, onClose, onSaved }: TransferenciaDialogProps) {
  const [cuentaOrigen, setCuentaOrigen] = useState<number | ''>(defaultOrigenId || '');
  const [cuentaDestino, setCuentaDestino] = useState<number | ''>('');
  const [fecha, setFecha] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitizeNumber = (value: string) => value.replace(/[^0-9.]/g, '');
  const formatCurrency = (value: string | number) => {
    const num = Number(typeof value === 'string' ? sanitizeNumber(value) : value);
    if (Number.isNaN(num)) return '';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
  };

  useEffect(() => {
    if (open && transferencia) {
      setCuentaOrigen(transferencia.cuenta_origen_id);
      setCuentaDestino(transferencia.cuenta_destino_id);
      setFecha(transferencia.fecha.slice(0, 10));
  setMonto(formatCurrency(transferencia.monto));
      setReferencia(transferencia.referencia || '');
      setObservaciones(transferencia.observaciones || '');
      setError(null);
      return;
    }
    if (open) {
      setCuentaOrigen(defaultOrigenId || '');
      setCuentaDestino('');
      setFecha(new Date().toISOString().slice(0, 10));
  setMonto('');
      setReferencia('');
      setObservaciones('');
      setError(null);
    }
  }, [open, defaultOrigenId, transferencia]);

  const handleSave = async () => {
    const montoNumerico = sanitizeNumber(monto);

    if (!cuentaOrigen || !cuentaDestino || !fecha || !montoNumerico) {
      setError('Completa todos los campos obligatorios.');
      return;
    }
    if (cuentaOrigen === cuentaDestino) {
      setError('Selecciona cuentas distintas.');
      return;
    }

    const payload: TransferenciaPayload = {
      cuenta_origen_id: Number(cuentaOrigen),
      cuenta_destino_id: Number(cuentaDestino),
      fecha,
  monto: Number(montoNumerico),
      referencia: referencia || null,
      observaciones: observaciones || null,
    };

    try {
      setSaving(true);
      setError(null);
      if (transferencia?.id) {
        await actualizarTransferencia(transferencia.id, payload);
      } else {
        await crearTransferencia(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo registrar la transferencia');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{transferencia ? 'Editar transferencia' : 'Transferencia entre cuentas'}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="origen-label">Cuenta origen</InputLabel>
              <Select
                labelId="origen-label"
                value={cuentaOrigen}
                label="Cuenta origen"
                onChange={(e) => setCuentaOrigen(Number(e.target.value))}
              >
                {cuentas.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.identificador}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel id="destino-label">Cuenta destino</InputLabel>
              <Select
                labelId="destino-label"
                value={cuentaDestino}
                label="Cuenta destino"
                onChange={(e) => setCuentaDestino(Number(e.target.value))}
              >
                {cuentas.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.identificador}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fecha"
              type="date"
              size="small"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Monto"
              size="small"
              value={monto}
              onChange={(e) => setMonto(sanitizeNumber(e.target.value))}
              onBlur={() => monto && setMonto(formatCurrency(monto))}
              onFocus={() => setMonto(sanitizeNumber(monto))}
              placeholder="$0.00"
              fullWidth
            />
          </Stack>

          <TextField
            label="Referencia"
            size="small"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Folio o descripción"
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
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#006261', '&:hover': { bgcolor: '#014c4c' } }}
        >
          {saving ? 'Guardando...' : transferencia ? 'Actualizar' : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TransferenciaDialog;
