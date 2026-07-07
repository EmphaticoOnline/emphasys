import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  generarFacturaGlobal,
  previewFacturaGlobal,
  type FacturaGlobalPreviewResult,
} from '../../services/facturaGlobalService';

const PERIODICIDADES = [
  { value: '01', label: '01 – Diario' },
  { value: '02', label: '02 – Semanal' },
  { value: '03', label: '03 – Quincenal' },
  { value: '04', label: '04 – Mensual' },
  { value: '05', label: '05 – Bimestral' },
];

const MESES_MENSUALES = [
  { value: '01', label: '01 – Enero' },
  { value: '02', label: '02 – Febrero' },
  { value: '03', label: '03 – Marzo' },
  { value: '04', label: '04 – Abril' },
  { value: '05', label: '05 – Mayo' },
  { value: '06', label: '06 – Junio' },
  { value: '07', label: '07 – Julio' },
  { value: '08', label: '08 – Agosto' },
  { value: '09', label: '09 – Septiembre' },
  { value: '10', label: '10 – Octubre' },
  { value: '11', label: '11 – Noviembre' },
  { value: '12', label: '12 – Diciembre' },
];

const MESES_BIMESTRALES = [
  { value: '13', label: '13 – Enero–Febrero' },
  { value: '14', label: '14 – Marzo–Abril' },
  { value: '15', label: '15 – Mayo–Junio' },
  { value: '16', label: '16 – Julio–Agosto' },
  { value: '17', label: '17 – Septiembre–Octubre' },
  { value: '18', label: '18 – Noviembre–Diciembre' },
];

function getMesesOpciones(periodicidad: string) {
  if (periodicidad === '05') return MESES_BIMESTRALES;
  return MESES_MENSUALES;
}

const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerado?: (facturaGlobalId: number) => void;
};

export default function FacturaGlobalDialog({ open, onClose, onGenerado }: Props) {
  const [fechaDesde, setFechaDesde] = useState(firstDayOfMonth);
  const [fechaHasta, setFechaHasta] = useState(todayStr);
  const [periodicidad, setPeriodicidad] = useState('04');
  const [mes, setMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [anio, setAnio] = useState(() => new Date().getFullYear());

  const [preview, setPreview] = useState<FacturaGlobalPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mesOpciones = getMesesOpciones(periodicidad);

  const handlePreview = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setWarning(null);
    setPreview(null);
    setLoadingPreview(true);
    try {
      const result = await previewFacturaGlobal({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
      setPreview(result);
    } catch (err: any) {
      setError(err?.message || 'No se pudo obtener el resumen');
    } finally {
      setLoadingPreview(false);
    }
  }, [fechaDesde, fechaHasta]);

  const handleGenerar = useCallback(async () => {
    if (!preview || preview.count === 0) return;
    setError(null);
    setSuccess(null);
    setWarning(null);
    setGenerating(true);
    try {
      const result = await generarFacturaGlobal({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        periodicidad,
        mes,
        anio,
      });
      setPreview(null);
      onGenerado?.(result.factura_global_id);

      if (result.timbrado) {
        setSuccess(
          `Factura global generada y timbrada correctamente (ID ${result.factura_global_id}). ` +
          `${result.ventas_incluidas} ventas incluidas. Total: ${formatter.format(result.total)}.`
        );
        onClose();
      } else {
        setWarning(
          `Factura global generada (ID ${result.factura_global_id}) pero no pudo timbrarse: ` +
          `${result.timbrado_error ?? 'Error desconocido'}. ` +
          `Puede timbrarse manualmente desde la lista de facturas.`
        );
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar la factura global');
    } finally {
      setGenerating(false);
    }
  }, [preview, fechaDesde, fechaHasta, periodicidad, mes, anio, onGenerado, onClose]);

  const handleClose = () => {
    if (generating) return;
    setPreview(null);
    setError(null);
    setSuccess(null);
    setWarning(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Generar factura global</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {warning && <Alert severity="warning">{warning}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Rango de fechas de las ventas
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Desde"
                type="date"
                size="small"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setPreview(null); }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Hasta"
                type="date"
                size="small"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setPreview(null); }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Información global SAT
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Periodicidad</InputLabel>
                <Select
                  value={periodicidad}
                  label="Periodicidad"
                  onChange={(e) => {
                    setPeriodicidad(e.target.value);
                    setMes(getMesesOpciones(e.target.value)[0]?.value ?? '01');
                    setPreview(null);
                  }}
                >
                  {PERIODICIDADES.map((p) => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Mes(es)</InputLabel>
                <Select
                  value={mes}
                  label="Mes(es)"
                  onChange={(e) => { setMes(e.target.value); setPreview(null); }}
                >
                  {mesOpciones.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Año"
                type="number"
                size="small"
                value={anio}
                onChange={(e) => { setAnio(Number(e.target.value)); setPreview(null); }}
                inputProps={{ min: 2020, max: 2099 }}
                sx={{ minWidth: 90 }}
              />
            </Stack>
          </Box>

          <Button
            variant="outlined"
            onClick={handlePreview}
            disabled={loadingPreview || !fechaDesde || !fechaHasta}
            startIcon={loadingPreview ? <CircularProgress size={14} /> : undefined}
          >
            {loadingPreview ? 'Consultando...' : 'Consultar ventas elegibles'}
          </Button>

          {preview !== null && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Resumen de ventas elegibles
                </Typography>
                {preview.count === 0 ? (
                  <Alert severity="warning">
                    No hay ventas de público general pendientes en el período seleccionado.
                  </Alert>
                ) : (
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      <strong>Ventas encontradas:</strong> {preview.count}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Subtotal:</strong> {formatter.format(preview.subtotal)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>IVA:</strong> {formatter.format(preview.iva)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total:</strong> {formatter.format(preview.total)}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={generating}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerar}
          disabled={generating || !preview || preview.count === 0}
          startIcon={generating ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
        >
          {generating ? 'Generando...' : 'Generar factura global'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
