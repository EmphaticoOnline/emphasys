import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
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
import { createFilterOptions } from '@mui/material/Autocomplete';
import type { Concepto, FinanzasCuenta, FinanzasMetodoPago, FinanzasOperacion, NaturalezaOperacion, TipoMovimiento } from '../../types/finanzas';
import type { Contacto } from '../../types/contactos.types';
import type { ContactoTipoPermitido } from '../documentos/documentoTypes';
import { actualizarOperacion, crearOperacion, fetchMetodosPago, type OperacionPayload } from '../../services/finanzasService';
import { fetchConceptos, crearConcepto } from '../../services/conceptosService';
import { fetchContactos } from '../../services/contactosService';
import { crearContacto } from '../../services/contactos.api';
import ContactCaptureDialog from '../../components/contactos/ContactCaptureDialog';

const toCivilDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface OperacionDialogProps {
  open: boolean;
  cuentas: FinanzasCuenta[];
  defaultCuentaId?: number | null;
  operacion?: FinanzasOperacion | null;
  title?: string;
  saveLabel?: string;
  presetPayload?: Partial<OperacionPayload> | null;
  lockedFields?: {
    tipo_movimiento?: boolean;
    naturaleza_operacion?: boolean;
    contacto_id?: boolean;
  };
  onClose: () => void;
  onSaved: (documentoOrigenId?: number | null) => void;
}

type ConceptoOption = Concepto & { inputValue?: string; isNew?: boolean };

type ContactoAutocompleteOption = Contacto | {
  kind: 'create';
  id: -1;
  nombre: string;
  inputValue: string;
};

export function OperacionDialog({
  open,
  cuentas,
  defaultCuentaId,
  operacion,
  title,
  saveLabel,
  presetPayload,
  lockedFields,
  onClose,
  onSaved,
}: OperacionDialogProps) {
  const [cuentaId, setCuentaId] = useState<number | ''>(defaultCuentaId || '');
  const [fecha, setFecha] = useState<string>('');
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('Deposito');
  const [naturaleza, setNaturaleza] = useState<NaturalezaOperacion>('movimiento_general');
  const [contactoId, setContactoId] = useState<string>('');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [monto, setMonto] = useState<string>('');
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [conceptoId, setConceptoId] = useState<string>('');
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [metodosPago, setMetodosPago] = useState<FinanzasMetodoPago[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingConceptos, setLoadingConceptos] = useState(false);
  const [loadingContactos, setLoadingContactos] = useState(false);
  const [crearContactoOpen, setCrearContactoOpen] = useState(false);
  const [crearContactoNombre, setCrearContactoNombre] = useState('');
  const [crearContactoTipo, setCrearContactoTipo] = useState<ContactoTipoPermitido>('Cliente');
  const [crearContactoLoading, setCrearContactoLoading] = useState(false);

  // El selector de contacto de Finanzas no restringe por tipo (a diferencia de
  // Documentos, que sí fija cliente/proveedor por reglas de venta/compra), así
  // que se ofrecen todos los tipos válidos del catálogo de contactos.
  const contactoTiposPermitidos: ContactoTipoPermitido[] = ['Lead', 'Cliente', 'Proveedor', 'Varios', 'Vendedor'];
  // La naturaleza de la operación solo sugiere el tipo por defecto al abrir el alta.
  const contactoDefaultTipo = useMemo<ContactoTipoPermitido>(
    () => (naturaleza === 'pago_proveedor' ? 'Proveedor' : 'Cliente'),
    [naturaleza]
  );

  const sanitizeNumber = (value: string) => value.replace(/[^0-9.]/g, '');
  const formatCurrency = (value: string | number) => {
    const num = Number(typeof value === 'string' ? sanitizeNumber(value) : value);
    if (Number.isNaN(num)) return '';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
  };

  const conceptoFilter = createFilterOptions<ConceptoOption>();
  const contactoFilter = createFilterOptions<ContactoAutocompleteOption>({
    stringify: (option) => ('kind' in option && option.kind === 'create' ? option.inputValue : option.nombre || ''),
  });

  // Método seleccionado — usado para saber si referencia es obligatoria
  const metodoSeleccionado = metodosPago.find((m) => m.id === metodoPagoId) ?? null;
  const referenciaObligatoria = metodoSeleccionado?.requiere_referencia === true;

  useEffect(() => {
    if (operacion) {
      setCuentaId(operacion.cuenta_id);
      setFecha(operacion.fecha?.slice(0, 10) || '');
      setTipoMovimiento(operacion.tipo_movimiento);
      setContactoId(operacion.contacto_id ? String(operacion.contacto_id) : '');
      setReferencia(operacion.referencia || '');
      setObservaciones(operacion.observaciones || '');
      setMonto(formatCurrency(operacion.monto ?? ''));
      setConceptoId(operacion.concepto_id ? String(operacion.concepto_id) : '');
      setNaturaleza((operacion.naturaleza_operacion as NaturalezaOperacion) || 'movimiento_general');
      setMetodoPagoId(operacion.metodo_pago_id ?? null);
    } else {
      setCuentaId(presetPayload?.cuenta_id ?? defaultCuentaId ?? '');
      setFecha(presetPayload?.fecha || toCivilDate());
      setTipoMovimiento(presetPayload?.tipo_movimiento || 'Deposito');
      setNaturaleza(presetPayload?.naturaleza_operacion || 'movimiento_general');
      setContactoId(presetPayload?.contacto_id ? String(presetPayload.contacto_id) : '');
      setReferencia(presetPayload?.referencia || '');
      setObservaciones(presetPayload?.observaciones || '');
      setMonto(presetPayload?.monto ? formatCurrency(presetPayload.monto) : '');
      setConceptoId(presetPayload?.concepto_id ? String(presetPayload.concepto_id) : '');
      setMetodoPagoId(presetPayload?.metodo_pago_id ?? null);
    }
    setError(null);
  }, [operacion, defaultCuentaId, open, presetPayload]);

  useEffect(() => {
    if (!open) return;
    setLoadingConceptos(true);
    setLoadingContactos(true);

    fetchConceptos()
      .then((data) => setConceptos(data.filter((c) => c.activo)))
      .catch(() => setConceptos([]))
      .finally(() => setLoadingConceptos(false));

    fetchContactos()
      .then((data) => setContactos(data))
      .catch(() => setContactos([]))
      .finally(() => setLoadingContactos(false));

    fetchMetodosPago(true)
      .then((data) => setMetodosPago(data))
      .catch(() => setMetodosPago([]));
  }, [open]);

  const handleSave = async () => {
    const montoNumerico = sanitizeNumber(monto);

    if (!cuentaId || !fecha || !montoNumerico) {
      setError('Completa la cuenta, fecha y monto.');
      return;
    }
    if (referenciaObligatoria && !referencia.trim()) {
      setError(`El método "${metodoSeleccionado?.nombre}" requiere una referencia (número de cheque, SPEI, etc.).`);
      return;
    }

    const payload: OperacionPayload = {
      cuenta_id: Number(cuentaId),
      fecha,
      tipo_movimiento: tipoMovimiento,
      naturaleza_operacion: naturaleza || 'movimiento_general',
      documento_origen_id: presetPayload?.documento_origen_id ?? operacion?.documento_origen_id ?? null,
      contacto_id: contactoId ? Number(contactoId) : null,
      referencia: referencia || null,
      observaciones: observaciones || null,
      monto: Number(montoNumerico),
      concepto_id: conceptoId ? Number(conceptoId) : null,
      metodo_pago_id: metodoPagoId ?? null,
    };

    try {
      setSaving(true);
      setError(null);
      if (operacion?.id) {
        await actualizarOperacion(operacion.id, payload);
      } else {
        await crearOperacion(payload);
      }
      onSaved(payload.documento_origen_id ?? null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la operación');
    } finally {
      setSaving(false);
    }
  };

  const conceptosOptions: ConceptoOption[] = conceptos;

  const handleCerrarCrearContacto = () => {
    if (crearContactoLoading) return;
    setCrearContactoOpen(false);
    setCrearContactoNombre('');
    setCrearContactoTipo(contactoDefaultTipo);
  };

  const handleCrearContactoSubmit = async () => {
    const nombre = crearContactoNombre.trim();
    if (!nombre) {
      setError('Ingresa el nombre del contacto');
      return;
    }

    try {
      setCrearContactoLoading(true);
      const nuevo = await crearContacto({ nombre, tipo_contacto: crearContactoTipo });
      setContactos((prev) => [nuevo, ...prev.filter((c) => c.id !== nuevo.id)]);
      setContactoId(String(nuevo.id));
      setCrearContactoOpen(false);
      setCrearContactoNombre('');
      setCrearContactoTipo(contactoDefaultTipo);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el contacto');
    } finally {
      setCrearContactoLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title || (operacion ? 'Editar operación' : 'Nueva operación')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={1}>
          <FormControl size="small" fullWidth>
            <InputLabel id="cuenta-label">Cuenta</InputLabel>
            <Select
              labelId="cuenta-label"
              value={cuentaId}
              label="Cuenta"
              onChange={(e) => setCuentaId(Number(e.target.value))}
            >
              {cuentas.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.identificador}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
            <FormControl size="small" fullWidth>
              <InputLabel id="tipo-label">Tipo</InputLabel>
              <Select
                labelId="tipo-label"
                value={tipoMovimiento}
                label="Tipo"
                disabled={Boolean(lockedFields?.tipo_movimiento)}
                onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimiento)}
              >
                <MenuItem value="Deposito">Depósito</MenuItem>
                <MenuItem value="Retiro">Retiro</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <FormControl size="small" fullWidth>
            <InputLabel id="naturaleza-label">Naturaleza de la operación</InputLabel>
            <Select
              labelId="naturaleza-label"
              value={naturaleza}
              label="Naturaleza de la operación"
              disabled={Boolean(lockedFields?.naturaleza_operacion)}
              onChange={(e) => setNaturaleza((e.target.value as NaturalezaOperacion) || 'movimiento_general')}
            >
              <MenuItem value="cobro_cliente">Cobro de cliente</MenuItem>
              <MenuItem value="pago_proveedor">Pago a proveedor</MenuItem>
              <MenuItem value="movimiento_general">Movimiento general</MenuItem>
            </Select>
          </FormControl>

          <Autocomplete<ContactoAutocompleteOption>
            options={contactos}
            getOptionLabel={(option) => option.nombre || ''}
            filterOptions={(options, state) => {
              const filtered = contactoFilter(options, state);
              const inputValue = state.inputValue.trim();

              if (!inputValue || lockedFields?.contacto_id) {
                return filtered;
              }

              const normalizedInput = inputValue.toLocaleLowerCase();
              const hasExactMatch = options.some((option) => {
                if ('kind' in option && option.kind === 'create') return false;
                return (option.nombre || '').trim().toLocaleLowerCase() === normalizedInput;
              });

              if (hasExactMatch) {
                return filtered;
              }

              return [
                { kind: 'create', id: -1, nombre: `➕ Crear contacto "${inputValue}"`, inputValue },
                ...filtered,
              ];
            }}
            loading={loadingContactos}
            value={contactos.find((c) => c.id === Number(contactoId)) || null}
            onChange={(_e, value) => {
              if (lockedFields?.contacto_id) return;
              if (value && 'kind' in value && value.kind === 'create') {
                setCrearContactoNombre(value.inputValue);
                setCrearContactoTipo(contactoDefaultTipo);
                setCrearContactoOpen(true);
                return;
              }
              setContactoId(value ? String(value.id) : '');
            }}
            isOptionEqualToValue={(option, value) => {
              const optionIsCreate = 'kind' in option && option.kind === 'create';
              const valueIsCreate = !!value && 'kind' in value && value.kind === 'create';
              if (optionIsCreate || valueIsCreate) {
                return optionIsCreate && valueIsCreate && option.id === value.id;
              }
              return option.id === value.id;
            }}
            disabled={Boolean(lockedFields?.contacto_id)}
            renderInput={(params) => {
              const { InputLabelProps: _ignoredLabelProps, ...rest } = params;
              return (
                <TextField
                  {...rest}
                  label="Contacto"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    ...(rest.InputProps as any),
                    endAdornment: (
                      <>
                        {loadingContactos ? <CircularProgress color="inherit" size={16} /> : null}
                        {rest.InputProps?.endAdornment}
                      </>
                    ),
                  }}
                />
              );
            }}
          />

          <Autocomplete<ConceptoOption>
            options={conceptosOptions}
            filterOptions={(options, params) => {
              const filtered = conceptoFilter(options, params);
              const { inputValue } = params;
              const exists = options.some((o) => o.nombre_concepto.toLowerCase() === inputValue.toLowerCase());
              if (inputValue && !exists) {
                filtered.push({
                  id: -1,
                  empresa_id: 0,
                  nombre_concepto: `Crear "${inputValue}"`,
                  es_gasto: true,
                  activo: true,
                  inputValue,
                  isNew: true,
                });
              }
              return filtered;
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              if ((option as ConceptoOption).isNew && (option as ConceptoOption).inputValue) return option.nombre_concepto;
              return option.nombre_concepto;
            }}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            loading={loadingConceptos}
            value={conceptosOptions.find((c) => c.id === Number(conceptoId)) || null}
            onChange={async (_e, value) => {
              if (!value) {
                setConceptoId('');
                return;
              }
              const option = value as ConceptoOption;
              if (option.isNew && option.inputValue) {
                try {
                  setSaving(true);
                  const creado = await crearConcepto({ nombre_concepto: option.inputValue, es_gasto: true });
                  const refreshed = await fetchConceptos();
                  const activos = refreshed.filter((c) => c.activo);
                  setConceptos(activos);
                  setConceptoId(String(creado.id));
                } catch (err: any) {
                  setError(err?.message || 'No se pudo crear el concepto');
                } finally {
                  setSaving(false);
                }
              } else {
                setConceptoId(String(value.id));
              }
            }}
            renderInput={(params) => {
              const { InputLabelProps: _ignoredLabelProps, ...rest } = params;
              return (
                <TextField
                  {...rest}
                  label="Concepto"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    ...(rest.InputProps as any),
                    endAdornment: (
                      <>
                        {loadingConceptos ? <CircularProgress color="inherit" size={16} /> : null}
                        {rest.InputProps?.endAdornment}
                      </>
                    ),
                  }}
                />
              );
            }}
          />

          {/* Método de pago operativo */}
          <FormControl size="small" fullWidth>
            <InputLabel id="metodo-pago-label">Método de pago</InputLabel>
            <Select
              labelId="metodo-pago-label"
              value={metodoPagoId !== null ? String(metodoPagoId) : ''}
              label="Método de pago"
              onChange={(e) => setMetodoPagoId(e.target.value ? Number(e.target.value) : null)}
            >
              <MenuItem value=""><em>Sin especificar</em></MenuItem>
              {metodosPago.map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>
                  {m.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={referenciaObligatoria ? 'Referencia *' : 'Referencia'}
            size="small"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder={referenciaObligatoria ? 'Requerido para este método' : 'Referencia o folio'}
            fullWidth
            error={referenciaObligatoria && !referencia.trim()}
            helperText={referenciaObligatoria && !referencia.trim()
              ? `El método "${metodoSeleccionado?.nombre ?? ''}" requiere una referencia`
              : undefined}
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
          {saving ? 'Guardando...' : saveLabel || 'Guardar'}
        </Button>
      </DialogActions>
      </Dialog>

      <ContactCaptureDialog
        open={crearContactoOpen}
        loading={crearContactoLoading}
        nombre={crearContactoNombre}
        tipoContacto={crearContactoTipo}
        tiposPermitidos={contactoTiposPermitidos}
        captureMode="simple"
        title="Crear contacto"
        infoMessage="Se asignará a la operación con el tipo seleccionado."
        submitLabel="Crear y asignar"
        onNombreChange={setCrearContactoNombre}
        onTipoContactoChange={setCrearContactoTipo}
        onClose={handleCerrarCrearContacto}
        onSubmit={() => void handleCrearContactoSubmit()}
      />
    </>
  );
}

export default OperacionDialog;
