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
  IconButton,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { createFilterOptions } from '@mui/material/Autocomplete';
import type { Concepto, FinanzasCuenta, FinanzasMetodoPago, FinanzasOperacion, NaturalezaOperacion, TipoMovimiento } from '../../types/finanzas';
import type { Contacto } from '../../types/contactos.types';
import type { ContactoTipoPermitido } from '../documentos/documentoTypes';
import { abrirAdjuntoOperacion, actualizarOperacion, actualizarTransferencia, crearOperacion, crearTransferencia, descargarAdjuntoOperacion, eliminarAdjuntoOperacion, fetchAdjuntosOperacion, fetchMetodosPago, subirAdjuntoOperacion, type FinanzasAdjunto, type OperacionPayload } from '../../services/finanzasService';
import { fetchConceptos, crearConcepto } from '../../services/conceptosService';
import { fetchContactos } from '../../services/contactosService';
import { crearContacto } from '../../services/contactos.api';
import ContactCaptureDialog from '../../components/contactos/ContactCaptureDialog';
import { validarBorradorCaptura } from './capturaMovimientoLogica';
import {
  ETIQUETA_CONCEPTO_TRANSFERENCIA,
  construirOpcionesContacto,
  esTransferenciaOperacion,
  ladoCapturaTransferencia,
  opcionTransferenciaSeleccionada,
  reconstruirLadosTransferencia,
  validarTransferencia,
  type OpcionContactoTesoreria,
} from './transferenciaLogica';

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

type ContactoAutocompleteOption = OpcionContactoTesoreria | {
  tipo: 'crear';
  clave: string;
  etiqueta: string;
  nombre: string;
  contactoId: null;
  cuentaId: null;
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
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [origenFijoId, setOrigenFijoId] = useState<number | null>(null);
  const [lado, setLado] = useState<'origen' | 'destino'>('origen');
  const [transferenciaId, setTransferenciaId] = useState<number | null>(null);
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
  const [operacionIdLocal, setOperacionIdLocal] = useState<number | null>(null);
  const [adjuntos, setAdjuntos] = useState<FinanzasAdjunto[]>([]);
  const [archivosPendientes, setArchivosPendientes] = useState<File[]>([]);
  const [loadingAdjuntos, setLoadingAdjuntos] = useState(false);

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
    stringify: (option) => option.etiqueta || option.nombre || '',
  });
  const documentoOrigenId = presetPayload?.documento_origen_id ?? operacion?.documento_origen_id ?? null;
  const modoTransferencia = destinoId != null || transferenciaId != null || esTransferenciaOperacion(operacion);
  const ofreceTransferencias = !lockedFields?.contacto_id
    && documentoOrigenId == null
    && (naturaleza === 'movimiento_general' || esTransferenciaOperacion(operacion))
    && (!operacion || esTransferenciaOperacion(operacion));

  // Método seleccionado — usado para saber si referencia es obligatoria
  const metodoSeleccionado = metodosPago.find((m) => m.id === metodoPagoId) ?? null;
  const referenciaObligatoria = !modoTransferencia && metodoSeleccionado?.requiere_referencia === true;
  const conceptoNumerico = conceptoId ? Number(conceptoId) : null;

  const evaluarCaptura = () => validarBorradorCaptura({
    cuentaId: cuentaId === '' ? null : Number(cuentaId),
    fecha,
    salida: tipoMovimiento === 'Retiro' ? monto : '',
    ingreso: tipoMovimiento === 'Deposito' ? monto : '',
    referencia,
    contactoId: contactoId ? Number(contactoId) : null,
    conceptoId: conceptoNumerico != null && conceptoNumerico > 0 ? conceptoNumerico : null,
    metodoPagoId,
    observaciones: observaciones.trim() ? observaciones : null,
    naturaleza,
    documentoOrigenId,
    metodo: metodoSeleccionado,
  });

  const opcionesContacto = useMemo(
    () => construirOpcionesContacto({
      contactos: contactos.map((contacto) => ({ id: contacto.id, nombre: contacto.nombre || '' })),
      cuentas: ofreceTransferencias ? cuentas : [],
      cuentaOrigenId: cuentaId === '' ? null : Number(cuentaId),
      cuentaDestinoId: !modoTransferencia ? null : lado === 'destino' ? origenFijoId : destinoId,
      modo: operacion == null ? 'alta' : esTransferenciaOperacion(operacion) ? 'transferencia' : 'movimiento',
    }),
    [contactos, cuentaId, cuentas, destinoId, lado, modoTransferencia, ofreceTransferencias, origenFijoId],
  );
  const valorContacto = modoTransferencia
    ? opcionTransferenciaSeleccionada(cuentas, lado === 'destino' ? origenFijoId : destinoId)
    : opcionesContacto.find((opcion) => opcion.tipo === 'contacto' && opcion.contactoId === Number(contactoId)) || null;

  const capturaValida = useMemo(
    () => {
      const cuentaNumerica = cuentaId === '' ? null : Number(cuentaId);
      return modoTransferencia
        ? validarTransferencia({
          cuentaOrigenId: transferenciaId && lado === 'destino' ? origenFijoId : cuentaNumerica,
          cuentaDestinoId: transferenciaId && lado === 'destino' ? cuentaNumerica : destinoId,
          fecha,
          monto,
          referencia,
          observaciones,
        }).ok
        : evaluarCaptura().ok;
    },
    [cuentaId, conceptoNumerico, contactoId, destinoId, documentoOrigenId, fecha, lado, metodoPagoId, metodoSeleccionado, modoTransferencia, monto, naturaleza, observaciones, origenFijoId, referencia, tipoMovimiento, transferenciaId],
  );

  useEffect(() => {
    if (operacion) {
      const lados = esTransferenciaOperacion(operacion) ? reconstruirLadosTransferencia(operacion) : null;
      setCuentaId(operacion.cuenta_id);
      setFecha(operacion.fecha?.slice(0, 10) || '');
      setTipoMovimiento(operacion.tipo_movimiento);
      setContactoId(lados ? '' : operacion.contacto_id ? String(operacion.contacto_id) : '');
      setDestinoId(lados?.destinoId ?? null);
      setOrigenFijoId(lados?.origenId ?? null);
      setLado(lados ? ladoCapturaTransferencia(operacion, lados) : 'origen');
      setTransferenciaId(lados?.transferenciaId ?? null);
      setReferencia(operacion.referencia || '');
      setObservaciones(operacion.observaciones || '');
      setMonto(formatCurrency(operacion.monto ?? ''));
      setConceptoId(lados ? '' : operacion.concepto_id ? String(operacion.concepto_id) : '');
      setNaturaleza((operacion.naturaleza_operacion as NaturalezaOperacion) || 'movimiento_general');
      setMetodoPagoId(lados ? null : operacion.metodo_pago_id ?? null);
    } else {
      setCuentaId(presetPayload?.cuenta_id ?? defaultCuentaId ?? '');
      setFecha(presetPayload?.fecha || toCivilDate());
      setTipoMovimiento(presetPayload?.tipo_movimiento || 'Deposito');
      setNaturaleza(presetPayload?.naturaleza_operacion || 'movimiento_general');
      setContactoId(presetPayload?.contacto_id ? String(presetPayload.contacto_id) : '');
      setDestinoId(null);
      setOrigenFijoId(null);
      setLado('origen');
      setTransferenciaId(null);
      setReferencia(presetPayload?.referencia || '');
      setObservaciones(presetPayload?.observaciones || '');
      setMonto(presetPayload?.monto ? formatCurrency(presetPayload.monto) : '');
      setConceptoId(presetPayload?.concepto_id ? String(presetPayload.concepto_id) : '');
      setMetodoPagoId(presetPayload?.metodo_pago_id ?? null);
    }
    setOperacionIdLocal(operacion?.id ?? null);
    setArchivosPendientes([]);
    setAdjuntos([]);
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

  useEffect(() => {
    const id = operacion?.id ?? operacionIdLocal;
    if (!open || !id) return;
    setLoadingAdjuntos(true);
    fetchAdjuntosOperacion(id)
      .then(setAdjuntos)
      .catch((err: any) => setError(err?.message || 'No se pudieron cargar los adjuntos'))
      .finally(() => setLoadingAdjuntos(false));
  }, [open, operacion?.id, operacionIdLocal]);

  const handleSave = async () => {
    if (modoTransferencia || esTransferenciaOperacion(operacion)) {
      const cuentaNumerica = cuentaId === '' ? null : Number(cuentaId);
      const actualTransferencia = validarTransferencia({
        cuentaOrigenId: transferenciaId && lado === 'destino' ? origenFijoId : cuentaNumerica,
        cuentaDestinoId: transferenciaId && lado === 'destino' ? cuentaNumerica : destinoId,
        fecha,
        monto,
        referencia,
        observaciones,
      });
      if (!actualTransferencia.ok) {
        setError(actualTransferencia.mensaje);
        return;
      }
      if (!transferenciaId && operacion?.id) {
        setError('Un movimiento ya registrado no se convierte en transferencia desde aquí.');
        return;
      }
      try {
        setSaving(true);
        setError(null);
        if (transferenciaId) await actualizarTransferencia(transferenciaId, actualTransferencia.payload);
        else {
          const creada = await crearTransferencia(actualTransferencia.payload) as { transferencia?: { id?: number } };
          const nuevoId = Number(creada?.transferencia?.id);
          if (Number.isFinite(nuevoId) && nuevoId > 0) setTransferenciaId(nuevoId);
        }
        if (!transferenciaId && archivosPendientes.length) {
          setArchivosPendientes([]);
          setError('La transferencia se guardó. Los archivos no se adjuntaron: un adjunto pertenece a una operación, no a la transferencia.');
          onSaved(null);
          return;
        }
        const idAdjuntos = operacion?.id ?? operacionIdLocal;
        if (transferenciaId && idAdjuntos && archivosPendientes.length) {
          const failed: File[] = [];
          const uploaded: FinanzasAdjunto[] = [];
          for (const archivo of archivosPendientes) {
            try {
              uploaded.push(await subirAdjuntoOperacion(idAdjuntos, archivo));
            } catch {
              failed.push(archivo);
            }
          }
          setAdjuntos((prev) => [...uploaded, ...prev]);
          setArchivosPendientes(failed);
          if (failed.length) {
            setError(`La transferencia se guardó, pero fallaron ${failed.length} archivo(s).`);
            onSaved(null);
            return;
          }
        }
        onSaved(null);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'No se pudo guardar la transferencia');
      } finally {
        setSaving(false);
      }
      return;
    }

    const actual = evaluarCaptura();
    if (!actual.ok) {
      setError(actual.mensaje);
      return;
    }
    const payload: OperacionPayload = actual.payload;

    try {
      setSaving(true);
      setError(null);
      const id = operacion?.id ?? operacionIdLocal;
      let savedId = id;
      if (id) {
        await actualizarOperacion(id, payload);
      } else {
        const created = await crearOperacion(payload);
        savedId = created.id;
        setOperacionIdLocal(created.id);
      }
      if (savedId && archivosPendientes.length) {
        const failed: File[] = [];
        const uploaded: FinanzasAdjunto[] = [];
        for (const archivo of archivosPendientes) {
          try {
            uploaded.push(await subirAdjuntoOperacion(savedId, archivo));
          } catch {
            failed.push(archivo);
          }
        }
        setAdjuntos((prev) => [...uploaded, ...prev]);
        setArchivosPendientes(failed);
        if (failed.length) {
          setError(`La operación se guardó, pero fallaron ${failed.length} archivo(s): ${failed.map((f) => f.name).join(', ')}. Puedes reintentarlo.`);
          return;
        }
      }
      onSaved(payload.documento_origen_id ?? null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la operación');
    } finally {
      setSaving(false);
    }
  };

  const operationId = operacion?.id ?? operacionIdLocal;

  const handleDownload = async (adjunto: FinanzasAdjunto) => {
    if (!operationId) return;
    try { await descargarAdjuntoOperacion(operationId, adjunto.id); }
    catch (err: any) { setError(err?.message || `No se pudo descargar ${adjunto.nombre_original}`); }
  };

  const handleOpenAttachment = async (adjunto: FinanzasAdjunto) => {
    if (!operationId) return;
    try { await abrirAdjuntoOperacion(operationId, adjunto.id); }
    catch (err: any) { setError(err?.message || `No se pudo abrir ${adjunto.nombre_original}`); }
  };

  const handleDeleteAttachment = async (adjunto: FinanzasAdjunto) => {
    if (!operationId) return;
    try {
      await eliminarAdjuntoOperacion(operationId, adjunto.id);
      setAdjuntos((prev) => prev.filter((item) => item.id !== adjunto.id));
    } catch (err: any) { setError(err?.message || `No se pudo eliminar ${adjunto.nombre_original}`); }
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
      setDestinoId(null);
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
              onChange={(e) => {
                const siguiente = Number(e.target.value);
                setCuentaId(siguiente);
                if (transferenciaId && lado === 'destino') {
                  setDestinoId(siguiente);
                  setOrigenFijoId((actual) => (actual === siguiente ? null : actual));
                  return;
                }
                setDestinoId((actual) => (actual === siguiente ? null : actual));
              }}
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
                disabled={modoTransferencia || Boolean(lockedFields?.tipo_movimiento)}
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
              disabled={modoTransferencia || Boolean(lockedFields?.naturaleza_operacion)}
              onChange={(e) => setNaturaleza((e.target.value as NaturalezaOperacion) || 'movimiento_general')}
            >
              <MenuItem value="cobro_cliente">Cobro de cliente</MenuItem>
              <MenuItem value="pago_proveedor">Pago a proveedor</MenuItem>
              <MenuItem value="movimiento_general">Movimiento general</MenuItem>
            </Select>
          </FormControl>

          <Autocomplete<ContactoAutocompleteOption>
            options={opcionesContacto}
            filterOptions={(options, state) => {
              const filtered = contactoFilter(options, state);
              const inputValue = state.inputValue.trim();
              const buscaTransferencia = /^transfer\b/i.test(inputValue);

              if (!inputValue || lockedFields?.contacto_id || buscaTransferencia || modoTransferencia && transferenciaId) {
                return filtered;
              }

              const normalizedInput = inputValue.toLocaleLowerCase();
              const hasExactMatch = options.some((option) => {
                if (option.tipo !== 'contacto') return false;
                return (option.nombre || '').trim().toLocaleLowerCase() === normalizedInput;
              });

              if (hasExactMatch) {
                return filtered;
              }

              return [
                {
                  tipo: 'crear' as const,
                  clave: 'crear',
                  etiqueta: `Crear contacto "${inputValue}"`,
                  nombre: `Crear contacto "${inputValue}"`,
                  contactoId: null,
                  cuentaId: null,
                  inputValue,
                },
                ...filtered,
              ];
            }}
            loading={loadingContactos}
            value={valorContacto}
            onChange={(_e, value) => {
              if (lockedFields?.contacto_id) return;
              if (value && value.tipo === 'crear') {
                setCrearContactoNombre(value.inputValue);
                setCrearContactoTipo(contactoDefaultTipo);
                setCrearContactoOpen(true);
                return;
              }
              if (value?.tipo === 'transferencia' && value.cuentaId != null) {
                setContactoId('');
                setConceptoId('');
                setMetodoPagoId(null);
                if (transferenciaId && lado === 'destino') setOrigenFijoId(value.cuentaId);
                else {
                  setDestinoId(value.cuentaId);
                  setLado('origen');
                  setTipoMovimiento('Retiro');
                }
                return;
              }
              if (transferenciaId || esTransferenciaOperacion(operacion)) {
                setError('Esta transferencia se actualiza eligiendo otra cuenta. No pasa a ser un movimiento general.');
                return;
              }
              setDestinoId(null);
              setContactoId(value?.contactoId ? String(value.contactoId) : '');
            }}
            isOptionEqualToValue={(option, value) => option.clave === value.clave}
            getOptionLabel={(option) => option.etiqueta || option.nombre || ''}
            renderOption={(props, option) => {
              const { key, ...resto } = props;
              return (
                <li key={key} {...resto} data-transferencia={option.tipo === 'transferencia' ? 'true' : undefined}>
                  {option.tipo === 'transferencia' ? (
                    <span>
                      <span style={{ opacity: 0.72 }}>Transfer: </span>
                      {option.nombre}
                    </span>
                  ) : option.etiqueta}
                </li>
              );
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
            options={modoTransferencia ? [] : conceptosOptions}
            disabled={modoTransferencia}
            {...(modoTransferencia ? { inputValue: ETIQUETA_CONCEPTO_TRANSFERENCIA, onInputChange: () => undefined } : {})}
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
            value={modoTransferencia ? null : conceptosOptions.find((c) => c.id === Number(conceptoId)) || null}
            onChange={async (_e, value) => {
              if (modoTransferencia) return;
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
              disabled={modoTransferencia}
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

          <Stack spacing={1}>
            <Typography variant="subtitle2">Adjuntos</Typography>
            <Button component="label" variant="outlined" size="small" disabled={saving} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
              Seleccionar archivos
              <input
                hidden
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  setArchivosPendientes((prev) => [...prev, ...Array.from(event.target.files || [])]);
                  event.target.value = '';
                }}
              />
            </Button>
            {archivosPendientes.map((archivo, index) => (
              <Stack key={`${archivo.name}-${index}`} direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ flex: 1 }}>{archivo.name}</Typography>
                <IconButton size="small" onClick={() => setArchivosPendientes((prev) => prev.filter((_, i) => i !== index))} aria-label={`Quitar ${archivo.name}`}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {loadingAdjuntos && <CircularProgress size={18} />}
            {adjuntos.map((adjunto) => (
              <Stack key={adjunto.id} direction="row" alignItems="center" spacing={1}>
                <Button variant="text" size="small" onClick={() => void handleOpenAttachment(adjunto)} sx={{ flex: 1, justifyContent: 'flex-start', minWidth: 0, overflow: 'hidden', textTransform: 'none' }}>
                  <Typography variant="body2" noWrap>{adjunto.nombre_original}</Typography>
                </Button>
                <IconButton size="small" onClick={() => void handleDownload(adjunto)} aria-label={`Descargar ${adjunto.nombre_original}`}><DownloadOutlinedIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => void handleDeleteAttachment(adjunto)} aria-label={`Eliminar ${adjunto.nombre_original}`}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            {!loadingAdjuntos && !adjuntos.length && !archivosPendientes.length && <Typography variant="caption" color="text.secondary">Puedes adjuntar varios comprobantes o documentos.</Typography>}
          </Stack>

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
          disabled={saving || !capturaValida}
          variant="contained"
          sx={{ textTransform: 'none', borderRadius: 999 }}
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
