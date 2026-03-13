import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import type { FinanzasCuenta } from '../../types/finanzas';
import { crearCuenta, actualizarCuenta } from '../../services/finanzasService';

interface NuevaCuentaDialogProps {
  open: boolean;
  cuenta?: FinanzasCuenta | null;
  onClose: () => void;
  onSaved: (cuenta: FinanzasCuenta) => void;
}

const monedas = ['MXN', 'USD', 'EUR'];
const tiposCuenta = ['Disponibilidad', 'Seguimiento'];

export function NuevaCuentaDialog({ open, cuenta, onClose, onSaved }: NuevaCuentaDialogProps) {
  const [identificador, setIdentificador] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState<string>('Disponibilidad');
  const [moneda, setMoneda] = useState<string>('MXN');
  const [saldoInicial, setSaldoInicial] = useState<string>('0');
  const [esEfectivo, setEsEfectivo] = useState<boolean>(false);
  const [afectaDisponible, setAfectaDisponible] = useState<boolean>(true);
  const [cuentaCerrada, setCuentaCerrada] = useState<boolean>(false);
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (cuenta) {
      setIdentificador(cuenta.identificador || '');
      setNumeroCuenta(cuenta.numero_cuenta || '');
      setTipoCuenta(cuenta.tipo_cuenta || 'Disponibilidad');
      setMoneda(cuenta.moneda || 'MXN');
      setSaldoInicial(String(cuenta.saldo_inicial ?? 0));
      setEsEfectivo(Boolean(cuenta.es_cuenta_efectivo));
      setAfectaDisponible(Boolean(cuenta.afecta_total_disponible ?? true));
      setCuentaCerrada(Boolean(cuenta.cuenta_cerrada));
      setObservaciones(cuenta.observaciones || '');
    } else {
      setIdentificador('');
      setNumeroCuenta('');
      setTipoCuenta('Disponibilidad');
      setMoneda('MXN');
      setSaldoInicial('0');
      setEsEfectivo(false);
      setAfectaDisponible(true);
      setCuentaCerrada(false);
      setObservaciones('');
    }
    setError(null);
  }, [open, cuenta]);

  const handleSave = async () => {
    if (!identificador.trim()) {
      setError('El identificador es obligatorio');
      return;
    }
    const monto = Number(saldoInicial || '0');
    if (Number.isNaN(monto) || monto < 0) {
      setError('El saldo inicial debe ser un número mayor o igual a 0');
      return;
    }

    const payload = {
      identificador: identificador.trim(),
      numero_cuenta: numeroCuenta.trim() || null,
      tipo_cuenta: tipoCuenta,
      moneda,
      saldo_inicial: monto,
      es_cuenta_efectivo: esEfectivo,
      afecta_total_disponible: afectaDisponible,
      cuenta_cerrada: cuentaCerrada,
      observaciones: observaciones.trim() || null,
    } as Partial<FinanzasCuenta>;

    try {
      setSaving(true);
      setError(null);
      if (cuenta?.id) {
        const actualizada = await actualizarCuenta(cuenta.id, payload);
        onSaved(actualizada);
      } else {
        const nueva = await crearCuenta(payload);
        onSaved(nueva);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{cuenta?.id ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Identificador"
            required
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            inputProps={{ maxLength: 40 }}
            size="small"
            fullWidth
          />

          <TextField
            label="Número de cuenta"
            value={numeroCuenta}
            onChange={(e) => setNumeroCuenta(e.target.value)}
            inputProps={{ maxLength: 30 }}
            size="small"
            fullWidth
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="tipo-cuenta-label">Tipo de cuenta</InputLabel>
              <Select
                labelId="tipo-cuenta-label"
                label="Tipo de cuenta"
                value={tipoCuenta}
                onChange={(e) => setTipoCuenta(e.target.value)}
              >
                {tiposCuenta.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="moneda-label">Moneda</InputLabel>
              <Select
                labelId="moneda-label"
                label="Moneda"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
              >
                {monedas.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <TextField
            label="Saldo inicial"
            type="number"
            size="small"
            value={saldoInicial}
            onChange={(e) => setSaldoInicial(e.target.value)}
            inputProps={{ step: '0.01', min: 0 }}
            fullWidth
          />

          <FormControlLabel
            control={<Switch checked={esEfectivo} onChange={(e) => setEsEfectivo(e.target.checked)} />}
            label="Cuenta de efectivo"
          />

          <FormControlLabel
            control={<Switch checked={afectaDisponible} onChange={(e) => setAfectaDisponible(e.target.checked)} />}
            label="Afecta disponible"
          />

          <FormControlLabel
            control={<Switch checked={cuentaCerrada} onChange={(e) => setCuentaCerrada(e.target.checked)} />}
            label="Cuenta cerrada"
          />

          <TextField
            label="Observaciones"
            size="small"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
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
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NuevaCuentaDialog;
