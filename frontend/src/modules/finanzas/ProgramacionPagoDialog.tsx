import React, { useEffect, useState, useCallback } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { resolverFolioVisual } from '../../utils/documentos.utils';
import {
  fetchFacturasCompraPendientes,
  fetchMetodosPago,
  crearProgramacionPago,
  actualizarProgramacionPago,
  fetchCuentas,
} from '../../services/finanzasService';
import { apiFetch } from '../../api/apiClient';

const toCivilDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface ProgramacionPagoDialogProps {
  open: boolean;
  // Cuando se abre desde VencimientosProveedores, la factura ya viene prefijada
  facturaPreseleccionada?: FacturaCompraPendiente | null;
  programacion?: ProgramacionPago | null;
  onClose: () => void;
  onSaved: () => void;
}

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

// Mapa: documento_id → monto a pagar (como string para el input)
type SeleccionMap = Map<number, string>;

const sanitizeNumber = (v: string) => v.replace(/[^0-9.]/g, '');

const formatFecha = (iso?: string | null): string => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso).slice(0, 10);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dia = d
    .toLocaleDateString('es-MX', { weekday: 'short' })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase());
  return `${dia} ${m[3]}/${m[2]}/${m[1]}`;
};

const formatMonto = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProgramacionPagoDialog({
  open,
  facturaPreseleccionada,
  programacion,
  onClose,
  onSaved,
}: ProgramacionPagoDialogProps) {
  const isEdit = !!programacion;

  // ── Proveedor ──────────────────────────────────────────────────────────────
  const [proveedorBloqueado, setProveedorBloqueado] = useState<ContactoOpcion | null>(null);
  const [proveedor, setProveedor] = useState<ContactoOpcion | null>(null);
  const [opcionesProveedor, setOpcionesProveedor] = useState<ContactoOpcion[]>([]);
  const [buscandoProv, setBuscandoProv] = useState(false);

  // ── Facturas ───────────────────────────────────────────────────────────────
  const [facturas, setFacturas] = useState<FacturaCompraPendiente[]>([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [seleccion, setSeleccion] = useState<SeleccionMap>(new Map());

  // ── Cabecera ───────────────────────────────────────────────────────────────
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [metodosPago, setMetodosPago] = useState<FinanzasMetodoPago[]>([]);
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [cuentaOrigenId, setCuentaOrigenId] = useState<number | ''>('');
  const [metodoPagoId, setMetodoPagoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoy = toCivilDate();
  const proveedorEfectivo = proveedorBloqueado ?? proveedor;
  const metodoSeleccionado = metodosPago.find((m) => m.id === Number(metodoPagoId)) ?? null;
  const referenciaObligatoria = metodoSeleccionado?.requiere_referencia === true;

  // Total programado (suma de los seleccionados)
  const total = Array.from(seleccion.values()).reduce(
    (acc, v) => acc + (parseFloat(sanitizeNumber(v)) || 0),
    0
  );

  // Moneda: derivada de las facturas seleccionadas (todas deben ser la misma)
  const primeraFacturaSeleccionada = facturas.find((f) => seleccion.has(f.id));
  const moneda = primeraFacturaSeleccionada?.moneda ?? 'MXN';

  // ── Cargar catálogos ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetchCuentas()
      .then((data) => setCuentas(data.filter((c) => !c.cuenta_cerrada)))
      .catch(() => setCuentas([]));
    fetchMetodosPago(true)
      .then(setMetodosPago)
      .catch(() => setMetodosPago([]));
  }, [open]);

  // ── Inicializar al abrir ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(null);

    if (isEdit && programacion) {
      // Modo edición: proveedor bloqueado
      const prov: ContactoOpcion = {
        id: programacion.proveedor_id ?? 0,
        nombre: programacion.proveedor_nombre ?? `Proveedor #${programacion.proveedor_id}`,
      };
      setProveedorBloqueado(prov);
      setProveedor(null);
      setFechaProgramada(programacion.fecha_programada ?? hoy);
      setCuentaOrigenId(programacion.cuenta_origen_id ?? '');
      setMetodoPagoId(programacion.metodo_pago_id ?? '');
      setReferencia(programacion.referencia ?? '');
      setNotas(programacion.notas ?? '');

      // Pre-llenar selección desde detalles
      const mapa: SeleccionMap = new Map();
      for (const det of programacion.detalles ?? []) {
        mapa.set(det.documento_id, formatMonto(det.monto_programado));
      }
      setSeleccion(mapa);
    } else if (facturaPreseleccionada) {
      // Desde VencimientosProveedores: proveedor bloqueado, factura pre-seleccionada
      const prov: ContactoOpcion = {
        id: facturaPreseleccionada.proveedor_id,
        nombre: facturaPreseleccionada.proveedor_nombre,
      };
      setProveedorBloqueado(prov);
      setProveedor(null);
      setFechaProgramada(hoy);
      setCuentaOrigenId('');
      setMetodoPagoId('');
      setReferencia('');
      setNotas('');
      setSeleccion(
        new Map([[
          facturaPreseleccionada.id,
          formatMonto(facturaPreseleccionada.saldo_disponible_programar),
        ]])
      );
    } else {
      // Modo creación normal
      setProveedorBloqueado(null);
      setProveedor(null);
      setSeleccion(new Map());
      setFechaProgramada(hoy);
      setCuentaOrigenId('');
      setMetodoPagoId('');
      setReferencia('');
      setNotas('');
    }
  }, [open, isEdit, programacion, facturaPreseleccionada]);

  // ── Cargar facturas al cambiar proveedor ───────────────────────────────────
  const cargarFacturas = useCallback(async (proveedorId: number) => {
    setCargandoFacturas(true);
    try {
      const data = await fetchFacturasCompraPendientes({
        proveedorId,
        excludeProgramacionId: isEdit && programacion ? programacion.id : null,
      });
      setFacturas(data);

      // En edición: re-verificar que las facturas previamente seleccionadas siguen disponibles
      if (isEdit && programacion) {
        setSeleccion((prev) => {
          const nuevo: SeleccionMap = new Map();
          for (const det of programacion.detalles ?? []) {
            const montoStr = formatMonto(det.monto_programado);
            nuevo.set(det.documento_id, prev.get(det.documento_id) ?? montoStr);
          }
          return nuevo;
        });
      }
    } finally {
      setCargandoFacturas(false);
    }
  }, [isEdit, programacion]);

  useEffect(() => {
    if (!open) return;
    const pid = proveedorEfectivo?.id;
    if (pid) {
      void cargarFacturas(pid);
    } else {
      setFacturas([]);
    }
  }, [open, proveedorEfectivo, cargarFacturas]);

  // ── Búsqueda de proveedores ────────────────────────────────────────────────
  const buscarProveedores = useCallback((input: string) => {
    setBuscandoProv(true);
    const qs = new URLSearchParams({ limit: '40', tipos: 'proveedor,varios' });
    if (input.trim()) qs.set('search', input.trim());
    apiFetch(`/api/contactos?${qs.toString()}`)
      .then(async (res) => {
        if (!res.ok) { setOpcionesProveedor([]); return; }
        const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
        const items: ContactoOpcion[] = Array.isArray(raw)
          ? raw
          : (raw as any).data ?? (raw as any).items ?? [];
        setOpcionesProveedor(items);
      })
      .catch(() => setOpcionesProveedor([]))
      .finally(() => setBuscandoProv(false));
  }, []);

  // ── Manipulación de selección ──────────────────────────────────────────────
  const toggleFactura = (factura: FacturaCompraPendiente) => {
    setSeleccion((prev) => {
      const nuevo = new Map(prev);
      if (nuevo.has(factura.id)) {
        nuevo.delete(factura.id);
      } else {
        nuevo.set(factura.id, formatMonto(factura.saldo_disponible_programar));
      }
      return nuevo;
    });
  };

  const actualizarMonto = (documentoId: number, valor: string) => {
    setSeleccion((prev) => {
      const nuevo = new Map(prev);
      nuevo.set(documentoId, sanitizeNumber(valor));
      return nuevo;
    });
  };

  const formatearMonto = (documentoId: number) => {
    setSeleccion((prev) => {
      const nuevo = new Map(prev);
      const raw = sanitizeNumber(prev.get(documentoId) ?? '');
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) nuevo.set(documentoId, formatMonto(n));
      return nuevo;
    });
  };

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null);

    if (!proveedorEfectivo?.id) {
      setError('Selecciona un proveedor.');
      return;
    }
    if (seleccion.size === 0) {
      setError('Selecciona al menos una factura.');
      return;
    }
    if (!fechaProgramada) {
      setError('La fecha programada es requerida.');
      return;
    }

    // Validar montos
    for (const [docId, montoStr] of seleccion.entries()) {
      const monto = parseFloat(sanitizeNumber(montoStr));
      if (!monto || monto <= 0) {
        setError(`El monto de la factura ${docId} debe ser mayor a 0.`);
        return;
      }
      const factura = facturas.find((f) => f.id === docId);
      if (factura && monto > factura.saldo_disponible_programar + 0.001) {
        setError(
          `El monto para ${resolverFolioVisual(factura, 'factura_compra')} excede el saldo disponible (${formatMonto(factura.saldo_disponible_programar)}).`
        );
        return;
      }
    }

    if (referenciaObligatoria && !referencia.trim()) {
      setError(`El método "${metodoSeleccionado?.nombre}" requiere una referencia.`);
      return;
    }

    const detalles = Array.from(seleccion.entries()).map(([documento_id, montoStr]) => ({
      documento_id,
      monto_programado: parseFloat(sanitizeNumber(montoStr)),
    }));

    const payload: ProgramacionPagoInput = {
      proveedor_id: proveedorEfectivo.id,
      fecha_programada: fechaProgramada,
      moneda,
      cuenta_origen_id: cuentaOrigenId ? Number(cuentaOrigenId) : null,
      metodo_pago_id: metodoPagoId ? Number(metodoPagoId) : null,
      referencia: referencia.trim() || null,
      notas: notas.trim() || null,
      detalles,
    };

    try {
      setSaving(true);
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

  // ── Facturas a mostrar: las disponibles + las ya seleccionadas (edit) que no aparecen ──
  const facturasEnListaNegra = new Set(facturas.map((f) => f.id));
  const facturasAdicionales: FacturaCompraPendiente[] = [];
  if (isEdit && programacion) {
    for (const det of programacion.detalles ?? []) {
      if (!facturasEnListaNegra.has(det.documento_id)) {
        facturasAdicionales.push({
          id: det.documento_id,
          serie: det.documento_serie ?? '',
          numero: det.documento_numero ?? 0,
          serie_externa: det.documento_serie_externa ?? null,
          numero_externo: det.documento_numero_externo ?? null,
          folio: `${det.documento_serie ?? ''}${det.documento_numero ?? 0}`,
          folio_proveedor: '',
          fecha_documento: '',
          fecha_vencimiento: det.documento_fecha_vencimiento ?? null,
          proveedor_id: programacion.proveedor_id ?? 0,
          proveedor_nombre: programacion.proveedor_nombre ?? '',
          moneda: det.moneda,
          total: det.monto_programado,
          saldo: det.monto_programado,
          saldo_disponible_programar: det.monto_programado,
        });
      }
    }
  }
  const facturasCompletas = [...facturas, ...facturasAdicionales];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEdit ? 'Editar programación de pago' : 'Programar pago a proveedor'}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={1}>

          {/* ── Proveedor ─────────────────────────────────────────────────── */}
          {proveedorBloqueado ? (
            <Box>
              <Typography variant="caption" color="text.secondary">Proveedor</Typography>
              <Typography variant="body2" fontWeight={600}>{proveedorBloqueado.nombre}</Typography>
            </Box>
          ) : (
            <Autocomplete<ContactoOpcion>
              options={opcionesProveedor}
              loading={buscandoProv}
              value={proveedor}
              onChange={(_, val) => {
                setProveedor(val);
                setSeleccion(new Map());
              }}
              onInputChange={(_, input) => buscarProveedores(input)}
              onOpen={() => { if (!opcionesProveedor.length) buscarProveedores(''); }}
              getOptionLabel={(o) => o.nombre}
              getOptionKey={(o) => o.id}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2">{o.nombre}</Typography>
                    {o.rfc && <Typography variant="caption" color="text.secondary">{o.rfc}</Typography>}
                  </Box>
                </li>
              )}
              renderInput={(p) => (
                <TextField
                  {...(p as any)}
                  label="Proveedor"
                  size="small"
                  placeholder="Buscar proveedor..."
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    ...(p.InputProps as any),
                    endAdornment: (
                      <>
                        {buscandoProv ? <CircularProgress size={16} color="inherit" /> : null}
                        {p.InputProps?.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          {/* ── Tabla de facturas ─────────────────────────────────────────── */}
          {proveedorEfectivo && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Facturas pendientes
              </Typography>
              {cargandoFacturas ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">Cargando facturas…</Typography>
                </Box>
              ) : facturasCompletas.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No hay facturas pendientes para este proveedor.
                </Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 260, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>Folio</TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>Vence</TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700 }} align="right">Saldo disponible</TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700 }} align="right">A pagar</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {facturasCompletas.map((f) => {
                        const checked = seleccion.has(f.id);
                        const montoVal = seleccion.get(f.id) ?? '';
                        const montoNum = parseFloat(sanitizeNumber(montoVal)) || 0;
                        const excede = montoNum > f.saldo_disponible_programar + 0.001;
                        return (
                          <TableRow
                            key={f.id}
                            hover
                            onClick={() => toggleFactura(f)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                size="small"
                                checked={checked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleFactura(f)}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              {resolverFolioVisual(f, 'factura_compra')}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                              {f.fecha_vencimiento ? formatFecha(f.fecha_vencimiento) : '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }} align="right">
                              {formatMonto(f.saldo_disponible_programar)}
                              <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                                {f.moneda}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, width: 140 }} align="right" onClick={(e) => e.stopPropagation()}>
                              {checked ? (
                                <TextField
                                  size="small"
                                  value={montoVal}
                                  onChange={(e) => actualizarMonto(f.id, e.target.value)}
                                  onBlur={() => formatearMonto(f.id)}
                                  error={excede}
                                  helperText={excede ? 'Excede saldo' : undefined}
                                  inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 8px' } }}
                                  sx={{ width: 120 }}
                                />
                              ) : (
                                <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12 }}>
                                  {formatMonto(f.saldo_disponible_programar)}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Total */}
              {seleccion.size > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.75 }}>
                  <Typography variant="body2" fontWeight={700}>
                    Total: {formatMonto(total)} {moneda}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({seleccion.size} factura{seleccion.size !== 1 ? 's' : ''})
                    </Typography>
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* ── Fecha ─────────────────────────────────────────────────────── */}
          <TextField
            label="Fecha programada"
            type="date"
            size="small"
            value={fechaProgramada}
            onChange={(e) => setFechaProgramada(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          {/* ── Cuenta origen ─────────────────────────────────────────────── */}
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
                  {c.identificador}{c.moneda !== 'MXN' ? ` (${c.moneda})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── Método de pago ────────────────────────────────────────────── */}
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
                <MenuItem key={m.id} value={String(m.id)}>{m.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── Referencia ────────────────────────────────────────────────── */}
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

          {/* ── Notas ─────────────────────────────────────────────────────── */}
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
          disabled={saving || seleccion.size === 0}
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
