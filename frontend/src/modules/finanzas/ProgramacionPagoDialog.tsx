import React, { useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
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
import type {
  FacturaCompraPendiente,
  FinanzasCuenta,
  FinanzasMetodoPago,
  ProgramacionPago,
  ProgramacionPagoInput,
} from '../../types/finanzas';
import {
  fetchFacturasCompraPendientes,
  fetchMetodosPago,
  crearProgramacionPago,
  actualizarProgramacionPago,
} from '../../services/finanzasService';
import { fetchCuentas } from '../../services/finanzasService';

interface ProgramacionPagoDialogProps {
  open: boolean;
  // Si se abre desde VencimientosProveedores, la factura ya viene prefijada
  facturaPreseleccionada?: FacturaCompraPendiente | null;
  programacion?: ProgramacionPago | null;
  onClose: () => void;
  onSaved: () => void;
}

const sanitizeNumber = (v: string) => v.replace(/[^0-9.]/g, '');
const formatCurrency = (v: string | number) => {
  const n = Number(typeof v === 'string' ? sanitizeNumber(v) : v);
  if (Number.isNaN(n)) return '';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
};

export default function ProgramacionPagoDialog({
  open,
  facturaPreseleccionada,
  programacion,
  onClose,
  onSaved,
}: ProgramacionPagoDialogProps) {
  const isEdit = !!programacion;
  const facturaLocked = !!facturaPreseleccionada;

  const [facturas, setFacturas] = useState<FacturaCompraPendiente[]>([]);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaCompraPendiente | null>(null);
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [cargandoFacturas, setCargandoFacturas] = useState(false);

  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [metodosPago, setMetodosPago] = useState<FinanzasMetodoPago[]>([]);

  const [fechaProgramada, setFechaProgramada] = useState('');
  const [monto, setMonto] = useState('');
  const [cuentaOrigenId, setCuentaOrigenId] = useState<number | ''>('');
  const [metodoPagoId, setMetodoPagoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metodoSeleccionado = metodosPago.find((m) => m.id === Number(metodoPagoId)) ?? null;
  const referenciaObligatoria = metodoSeleccionado?.requiere_referencia === true;

  const hoy = new Date().toISOString().slice(0, 10);

  // Cargar cuentas y métodos de pago al abrir
  useEffect(() => {
    if (!open) return;
    fetchCuentas()
      .then((data) => setCuentas(data.filter((c) => !c.cuenta_cerrada)))
      .catch(() => setCuentas([]));
    fetchMetodosPago(true)
      .then((data) => setMetodosPago(data))
      .catch(() => setMetodosPago([]));
  }, [open]);

  // Inicializar estado cuando se abre
  useEffect(() => {
    if (!open) return;
    setError(null);

    if (isEdit && programacion) {
      setFechaProgramada(programacion.fecha_programada ?? hoy);
      setMonto(formatCurrency(programacion.monto_programado));
      setCuentaOrigenId(programacion.cuenta_origen_id ?? '');
      setMetodoPagoId(programacion.metodo_pago_id ?? '');
      setReferencia(programacion.referencia ?? '');
      setNotas(programacion.notas ?? '');
      setFacturaSeleccionada(null);
    } else {
      setFechaProgramada(hoy);
      setMonto('');
      setCuentaOrigenId('');
      setMetodoPagoId('');
      setReferencia('');
      setNotas('');
      if (facturaPreseleccionada) {
        setFacturaSeleccionada(facturaPreseleccionada);
      } else {
        setFacturaSeleccionada(null);
      }
    }
  }, [open, isEdit, programacion, facturaPreseleccionada]);

  // Buscar facturas con debounce
  useEffect(() => {
    if (facturaLocked || isEdit) return;
    const timer = setTimeout(async () => {
      setCargandoFacturas(true);
      try {
        const data = await fetchFacturasCompraPendientes({ search: busquedaFactura || null });
        setFacturas(data);
      } finally {
        setCargandoFacturas(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busquedaFactura, facturaLocked, isEdit]);

  const facturaEfectiva = facturaPreseleccionada ?? facturaSeleccionada;
  const monedaDocumento = facturaEfectiva?.moneda ?? 'MXN';
  const saldoMaximo = facturaEfectiva?.saldo_disponible_programar;

  const handleSave = async () => {
    const montoNum = parseFloat(sanitizeNumber(monto));

    if (!fechaProgramada) {
      setError('La fecha programada es requerida.');
      return;
    }
    if (!montoNum || montoNum <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }
    if (!isEdit && !facturaEfectiva) {
      setError('Selecciona una factura de compra.');
      return;
    }
    if (referenciaObligatoria && !referencia.trim()) {
      setError(`El método "${metodoSeleccionado?.nombre}" requiere una referencia.`);
      return;
    }

    const payload: ProgramacionPagoInput = {
      documento_id: facturaEfectiva?.id ?? programacion!.documento_id,
      fecha_programada: fechaProgramada,
      monto_programado: montoNum,
      moneda: facturaEfectiva?.moneda ?? programacion?.moneda ?? 'MXN',
      cuenta_origen_id: cuentaOrigenId ? Number(cuentaOrigenId) : null,
      metodo_pago_id: metodoPagoId ? Number(metodoPagoId) : null,
      referencia: referencia.trim() || null,
      notas: notas.trim() || null,
    };

    try {
      setSaving(true);
      setError(null);
      if (isEdit && programacion) {
        await actualizarProgramacionPago(programacion.id, payload);
      } else {
        await crearProgramacionPago(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la programación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? 'Editar programación de pago' : 'Programar pago a proveedor'}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={1}>
          {/* Factura */}
          {facturaLocked || isEdit ? (
            <Box>
              <Typography variant="caption" color="text.secondary">Factura</Typography>
              <Typography variant="body2" fontWeight={600}>
                {facturaEfectiva
                  ? `${facturaEfectiva.folio}${facturaEfectiva.folio_proveedor ? ` / Ref: ${facturaEfectiva.folio_proveedor}` : ''} — ${facturaEfectiva.proveedor_nombre}`
                  : isEdit
                  ? `Doc #${programacion?.documento_id}`
                  : '—'}
              </Typography>
              {facturaEfectiva && (
                <Typography variant="caption" color="text.secondary">
                  Moneda: {facturaEfectiva.moneda} · Saldo disponible:{' '}
                  {facturaEfectiva.saldo_disponible_programar.toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                  })}
                </Typography>
              )}
            </Box>
          ) : (
            <Autocomplete<FacturaCompraPendiente>
              options={facturas}
              loading={cargandoFacturas}
              value={facturaSeleccionada}
              onChange={(_, val) => setFacturaSeleccionada(val)}
              onInputChange={(_, v) => setBusquedaFactura(v)}
              onOpen={() => { if (!facturas.length) setBusquedaFactura(''); }}
              getOptionLabel={(o) =>
                `${o.folio}${o.folio_proveedor ? ` (${o.folio_proveedor})` : ''} — ${o.proveedor_nombre}`
              }
              getOptionKey={(o) => o.id}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2">
                      {o.folio}{o.folio_proveedor ? ` / ${o.folio_proveedor}` : ''} — {o.proveedor_nombre}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {o.moneda} · Saldo: {o.saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      {o.fecha_vencimiento ? ` · Vence: ${o.fecha_vencimiento}` : ''}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(p) => (
                <TextField
                  {...(p as any)}
                  label="Factura de compra"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    ...(p.InputProps as any),
                    endAdornment: (
                      <>
                        {cargandoFacturas ? <CircularProgress size={16} color="inherit" /> : null}
                        {p.InputProps?.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          {/* Fecha */}
          <TextField
            label="Fecha programada"
            type="date"
            size="small"
            value={fechaProgramada}
            onChange={(e) => setFechaProgramada(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          {/* Monto */}
          <TextField
            label={`Monto (${monedaDocumento})${saldoMaximo !== undefined ? ` — disponible: ${saldoMaximo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : ''}`}
            size="small"
            value={monto}
            onChange={(e) => setMonto(sanitizeNumber(e.target.value))}
            onBlur={() => monto && setMonto(formatCurrency(monto))}
            onFocus={() => setMonto(sanitizeNumber(monto))}
            placeholder="$0.00"
            fullWidth
          />

          {/* Cuenta origen */}
          <FormControl size="small" fullWidth>
            <InputLabel id="cuenta-origen-label">Cuenta de origen</InputLabel>
            <Select
              labelId="cuenta-origen-label"
              value={cuentaOrigenId}
              label="Cuenta de origen"
              onChange={(e) => setCuentaOrigenId(e.target.value as number | '')}
            >
              <MenuItem value=""><em>Sin especificar</em></MenuItem>
              {cuentas.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.identificador}
                  {c.moneda !== 'MXN' ? ` (${c.moneda})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Método de pago */}
          <FormControl size="small" fullWidth>
            <InputLabel id="metodo-pago-label">Método de pago</InputLabel>
            <Select
              labelId="metodo-pago-label"
              value={metodoPagoId !== '' ? String(metodoPagoId) : ''}
              label="Método de pago"
              onChange={(e) => setMetodoPagoId(e.target.value ? Number(e.target.value) : '')}
            >
              <MenuItem value=""><em>Sin especificar</em></MenuItem>
              {metodosPago.map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>
                  {m.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Referencia */}
          <TextField
            label={referenciaObligatoria ? 'Referencia *' : 'Referencia'}
            size="small"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder={referenciaObligatoria ? 'Requerido para este método' : 'Número de cheque, SPEI, etc.'}
            fullWidth
            error={referenciaObligatoria && !referencia.trim()}
            helperText={
              referenciaObligatoria && !referencia.trim()
                ? `El método "${metodoSeleccionado?.nombre ?? ''}" requiere una referencia`
                : undefined
            }
          />

          {/* Notas */}
          <TextField
            label="Notas"
            size="small"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones o notas adicionales"
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
          sx={{
            textTransform: 'none',
            borderRadius: 999,
            bgcolor: '#1d2f68',
            '&:hover': { bgcolor: '#162551' },
          }}
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Programar pago'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
