import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type HTMLAttributes, type Key, type KeyboardEvent, type ReactNode } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import type { Contacto } from '../../types/contactos.types';
import type { Concepto, FinanzasCuenta, FinanzasMetodoPago, FinanzasOperacion } from '../../types/finanzas';
import { fetchConceptos } from '../../services/conceptosService';
import { fetchContactos } from '../../services/contactosService';
import {
  actualizarOperacion,
  actualizarTransferencia,
  crearOperacion,
  crearTransferencia,
  fetchMetodosPago,
} from '../../services/finanzasService';
import {
  fechaCivil,
  formatearMontoVisible,
  limpiarMonto,
  validarBorradorCaptura,
} from './capturaMovimientoLogica';
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

export const CAPTURA_FILA_ID = -1;

const popupsCaptura = { abiertos: 0 };

export function capturaPopupAbierto() {
  return popupsCaptura.abiertos > 0;
}

function marcarPopupCaptura(abierto: boolean) {
  popupsCaptura.abiertos = Math.max(0, popupsCaptura.abiertos + (abierto ? 1 : -1));
}

function reiniciarPopupsCaptura() {
  popupsCaptura.abiertos = 0;
}

export type CapturaInline =
  | { tipo: 'nueva'; token: number }
  | { tipo: 'edicion'; operacion: FinanzasOperacion };

type OpcionConcepto = { id: number; nombre_concepto: string };

export function movimientoOriginadoEnTesoreria(op: Pick<
  FinanzasOperacion,
  'es_transferencia' | 'transferencia_id' | 'documento_origen_id' | 'factura_id' | 'naturaleza_operacion'
>): boolean {
  if (op.es_transferencia || op.transferencia_id) return true;
  if (op.documento_origen_id || op.factura_id) return false;
  return (op.naturaleza_operacion ?? 'movimiento_general') === 'movimiento_general';
}

export function movimientoGeneralPendiente(op: FinanzasOperacion): boolean {
  if (!movimientoOriginadoEnTesoreria(op) || op.es_transferencia || op.transferencia_id) return false;
  return String(op.estado_conciliacion || 'pendiente').toLowerCase() === 'pendiente';
}

export function movimientoTransferenciaPendiente(op: FinanzasOperacion): boolean {
  if (!op.transferencia_id || !(op.es_transferencia || op.transferencia_id)) return false;
  return String(op.estado_conciliacion || 'pendiente').toLowerCase() === 'pendiente';
}

export function movimientoEditableEnLinea(op: FinanzasOperacion): boolean {
  return movimientoGeneralPendiente(op) || movimientoTransferenciaPendiente(op);
}

type TokensCaptura = {
  action: {
    disabled: string;
    primary: string;
    primaryForeground: string;
    primaryHover: string;
    hoverTint: string;
    tint: string;
    destructive: string;
  };
  content: {
    background: string;
    elevated: string;
    border: string;
    foreground: string;
    secondary: string;
    hover: string;
  };
  metric: {
    amount: { background: string };
    applied: { foreground: string };
    available: { background: string; foreground: string };
  };
};

type CampoPendiente = 'fecha' | 'monto' | 'contacto' | 'concepto' | 'referencia' | null;

export type VistaCaptura = {
  fecha: string;
  setFecha: (value: string) => void;
  referencia: string;
  setReferencia: (value: string) => void;
  salida: string;
  ingreso: string;
  escribirSalida: (value: string) => void;
  escribirIngreso: (value: string) => void;
  contacto: OpcionContactoTesoreria | null;
  setContacto: (value: OpcionContactoTesoreria | null) => void;
  contactos: OpcionContactoTesoreria[];
  concepto: OpcionConcepto | null;
  setConcepto: (value: OpcionConcepto | null) => void;
  conceptos: OpcionConcepto[];
  modoTransferencia: boolean;
  montoBloqueado: 'salida' | 'ingreso' | null;
  cargandoCatalogos: boolean;
  guardando: boolean;
  campoPendiente: CampoPendiente;
  guardar: () => void;
  cancelar: () => void;
  focoFecha: number;
  focoReferencia: number;
  tokens: TokensCaptura;
};

export type CapturaStore = {
  subscribe: (fn: () => void) => () => void;
  getSnapshot: () => VistaCaptura | null;
};

export function useCapturaMovimiento(opts: {
  captura: CapturaInline | null;
  cuentaId: number | null;
  cuentas?: FinanzasCuenta[];
  tokens: TokensCaptura;
  onGuardada: (detalle?: { transferencia: boolean }) => Promise<void> | void;
  onCancelada: () => void;
  onError: (mensaje: string) => void;
  focoCampoRef?: React.RefObject<string | null>;
}) {
  const { captura, cuentaId, cuentas = [], tokens, onGuardada, onCancelada, onError, focoCampoRef } = opts;
  const guardandoRef = useRef(false);
  const storeRef = useRef<{ vista: VistaCaptura | null; listeners: Set<() => void> }>({
    vista: null,
    listeners: new Set(),
  });
  const [fecha, setFecha] = useState('');
  const [referencia, setReferencia] = useState('');
  const [salida, setSalida] = useState('');
  const [ingreso, setIngreso] = useState('');
  const [contactoId, setContactoId] = useState<number | null>(null);
  const [conceptoId, setConceptoId] = useState<number | null>(null);
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [origenFijoId, setOrigenFijoId] = useState<number | null>(null);
  const [transferenciaId, setTransferenciaId] = useState<number | null>(null);
  const [lado, setLado] = useState<'origen' | 'destino'>('origen');
  const [contactos, setContactos] = useState<Array<{ id: number; nombre: string }>>([]);
  const [conceptos, setConceptos] = useState<OpcionConcepto[]>([]);
  const [metodos, setMetodos] = useState<FinanzasMetodoPago[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [campoPendiente, setCampoPendiente] = useState<CampoPendiente>(null);
  const [focoReferencia, setFocoReferencia] = useState(0);

  const clave = !captura
    ? ''
    : captura.tipo === 'nueva'
      ? `nueva:${captura.token}`
      : `edicion:${captura.operacion.id}`;

  useEffect(() => () => reiniciarPopupsCaptura(), [clave]);

  useEffect(() => {
    if (!captura) return;
    const op = captura.tipo === 'edicion' ? captura.operacion : null;
    const transferencia = esTransferenciaOperacion(op) && op ? reconstruirLadosTransferencia(op) : null;
    setFecha(op?.fecha ? op.fecha.slice(0, 10) : fechaCivil());
    setReferencia(op?.referencia ?? '');
    setContactoId(transferencia ? null : op?.contacto_id ?? null);
    setConceptoId(transferencia ? null : op?.concepto_id ?? null);
    setDestinoId(transferencia?.destinoId ?? null);
    setOrigenFijoId(transferencia?.origenId ?? null);
    setTransferenciaId(transferencia?.transferenciaId ?? null);
    setLado(op && transferencia ? ladoCapturaTransferencia(op, transferencia) : 'origen');
    if (op?.tipo_movimiento === 'Retiro') {
      setSalida(String(Math.abs(Number(op.monto) || 0)));
      setIngreso('');
    } else if (op) {
      setIngreso(String(Math.abs(Number(op.monto) || 0)));
      setSalida('');
    } else {
      setSalida('');
      setIngreso('');
    }
    guardandoRef.current = false;
    setGuardando(false);
    setCampoPendiente(null);
    const campo = focoCampoRef?.current ?? null;
    if (focoCampoRef) focoCampoRef.current = null;
    setFocoReferencia(campo === 'referencia' ? Date.now() : 0);
  }, [clave, focoCampoRef]);

  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    setCargandoCatalogos(true);
    Promise.all([
      fetchConceptos().catch(() => [] as Concepto[]),
      fetchContactos().catch(() => [] as Contacto[]),
      fetchMetodosPago(true).catch(() => [] as FinanzasMetodoPago[]),
    ]).then(([listaConceptos, listaContactos, listaMetodos]) => {
      if (!vivo) return;
      setConceptos(
        listaConceptos
          .filter((item) => item.activo)
          .map((item) => ({ id: item.id, nombre_concepto: item.nombre_concepto })),
      );
      setContactos(listaContactos.map((item) => ({ id: item.id, nombre: item.nombre || '' })));
      setMetodos(listaMetodos);
    }).finally(() => {
      if (vivo) setCargandoCatalogos(false);
    });
    return () => {
      vivo = false;
    };
  }, [clave]);

  const escribirSalida = (value: string) => {
    const limpio = limpiarMonto(value);
    setSalida(limpio);
    if (limpio) setIngreso('');
  };

  const escribirIngreso = (value: string) => {
    const limpio = limpiarMonto(value);
    setIngreso(limpio);
    if (limpio) setSalida('');
  };

  const opEdicion = captura?.tipo === 'edicion' ? captura.operacion : null;
  const modoTransferencia = destinoId != null || transferenciaId != null;
  const ofreceTransferencias = !opEdicion || esTransferenciaOperacion(opEdicion);
  const cuentaLado = opEdicion?.cuenta_id ?? cuentaId;
  const contraparteId = !modoTransferencia ? null : lado === 'destino' ? origenFijoId : destinoId;
  const opcionesContacto = construirOpcionesContacto({
    contactos,
    cuentas: ofreceTransferencias ? cuentas : [],
    cuentaOrigenId: cuentaLado,
    cuentaDestinoId: contraparteId,
    modo: opEdicion == null ? 'alta' : esTransferenciaOperacion(opEdicion) ? 'transferencia' : 'movimiento',
  });
  const contacto: OpcionContactoTesoreria | null = modoTransferencia
    ? opcionTransferenciaSeleccionada(cuentas, contraparteId)
    : contactoId == null
      ? null
      : opcionesContacto.find((item) => item.tipo === 'contacto' && item.contactoId === contactoId)
        ?? {
          tipo: 'contacto',
          clave: `contacto:${contactoId}`,
          etiqueta: opEdicion?.contacto_id === contactoId ? opEdicion.contacto_nombre || '' : '',
          nombre: opEdicion?.contacto_id === contactoId ? opEdicion.contacto_nombre || '' : '',
          contactoId,
          cuentaId: null,
        };

  const concepto: OpcionConcepto | null = conceptoId == null
    ? null
    : conceptos.find((item) => item.id === conceptoId)
      ?? (captura?.tipo === 'edicion' && captura.operacion.concepto_id === conceptoId
        ? { id: conceptoId, nombre_concepto: captura.operacion.concepto_nombre || '' }
        : null);

  const guardar = () => {
    if (guardandoRef.current || !captura) return;
    const op = captura.tipo === 'edicion' ? captura.operacion : null;
    const cuenta = op ? op.cuenta_id : cuentaId;
    const metodo = op?.metodo_pago_id ? metodos.find((item) => item.id === op.metodo_pago_id) : undefined;
    const enTransferencia = destinoId != null || transferenciaId != null || esTransferenciaOperacion(op);
    if (enTransferencia) {
      const origen = lado === 'destino' ? origenFijoId : cuenta;
      const resultadoTransferencia = validarTransferencia({
        cuentaOrigenId: origen,
        cuentaDestinoId: destinoId,
        fecha,
        monto: lado === 'destino' ? ingreso : salida,
        referencia,
        observaciones: op?.observaciones || '',
      });
      if (!resultadoTransferencia.ok) {
        if (!origen || !destinoId || Number(origen) === Number(destinoId)) setCampoPendiente('contacto');
        else if (!fecha) setCampoPendiente('fecha');
        else setCampoPendiente('monto');
        onError(resultadoTransferencia.mensaje);
        return;
      }
      if (!transferenciaId && op?.id) {
        onError('Un movimiento ya registrado no se convierte en transferencia desde aquí.');
        return;
      }
      setCampoPendiente(null);
      guardandoRef.current = true;
      setGuardando(true);
      const peticionTransferencia = transferenciaId
        ? actualizarTransferencia(transferenciaId, resultadoTransferencia.payload)
        : crearTransferencia(resultadoTransferencia.payload);
      peticionTransferencia
        .then(() => onGuardada({ transferencia: true }))
        .catch((err: { message?: string }) => {
          onError(err?.message || 'No se pudo guardar la transferencia');
        })
        .finally(() => {
          guardandoRef.current = false;
          setGuardando(false);
        });
      return;
    }
    const resultado = validarBorradorCaptura({
      cuentaId: cuenta,
      fecha,
      salida,
      ingreso,
      referencia,
      contactoId,
      conceptoId,
      metodoPagoId: op?.metodo_pago_id ?? null,
      observaciones: op?.observaciones ?? null,
      naturaleza: op?.naturaleza_operacion,
      documentoOrigenId: op?.documento_origen_id ?? null,
      metodo,
    });
    if (!resultado.ok) {
      setCampoPendiente(resultado.campo);
      onError(resultado.mensaje);
      return;
    }
    setCampoPendiente(null);
    const payload = resultado.payload;

    guardandoRef.current = true;
    setGuardando(true);
    const peticion = op ? actualizarOperacion(op.id, payload) : crearOperacion(payload);
    peticion
      .then(() => onGuardada({ transferencia: false }))
      .catch((err: { message?: string }) => {
        onError(err?.message || 'No se pudo guardar la operación');
      })
      .finally(() => {
        guardandoRef.current = false;
        setGuardando(false);
      });
  };

  storeRef.current.vista = captura
    ? {
        fecha,
        setFecha: (value) => {
          setFecha(value);
          setCampoPendiente((prev) => (prev === 'fecha' ? null : prev));
        },
        referencia,
        setReferencia: (value) => {
          setReferencia(value);
          setCampoPendiente((prev) => (prev === 'referencia' ? null : prev));
        },
        salida,
        ingreso,
        escribirSalida: (value) => {
          escribirSalida(value);
          setCampoPendiente((prev) => (prev === 'monto' ? null : prev));
        },
        escribirIngreso: (value) => {
          escribirIngreso(value);
          setCampoPendiente((prev) => (prev === 'monto' ? null : prev));
        },
        contacto,
        setContacto: (value) => {
          if (value?.tipo === 'transferencia' && value.cuentaId != null) {
            setContactoId(null);
            setConceptoId(null);
            if (transferenciaId && lado === 'destino') {
              setOrigenFijoId(value.cuentaId);
            } else {
              setDestinoId(value.cuentaId);
              setLado('origen');
              setIngreso((previo) => {
                if (previo) setSalida((salidaActual) => salidaActual || previo);
                return '';
              });
            }
            setCampoPendiente((prev) => (prev === 'contacto' || prev === 'concepto' ? null : prev));
            return;
          }
          if (transferenciaId || esTransferenciaOperacion(opEdicion)) {
            onError('Esta transferencia se actualiza eligiendo otra cuenta. No pasa a ser un movimiento general.');
            return;
          }
          setDestinoId(null);
          setContactoId(value?.contactoId ?? null);
          setCampoPendiente((prev) => (prev === 'contacto' ? null : prev));
        },
        contactos: opcionesContacto,
        concepto,
        setConcepto: (value) => {
          if (modoTransferencia) return;
          setConceptoId(value?.id ?? null);
          setCampoPendiente((prev) => (prev === 'concepto' ? null : prev));
        },
        conceptos,
        modoTransferencia,
        montoBloqueado: modoTransferencia ? (lado === 'destino' ? 'salida' : 'ingreso') : null,
        cargandoCatalogos,
        guardando,
        campoPendiente,
        guardar,
        cancelar: () => {
          if (guardandoRef.current) return;
          onCancelada();
        },
        focoFecha: captura.tipo === 'nueva' ? captura.token : 0,
        focoReferencia,
        tokens,
      }
    : null;

  useLayoutEffect(() => {
    storeRef.current.listeners.forEach((fn) => fn());
  });

  return useMemo<CapturaStore>(() => ({
    subscribe: (fn) => {
      storeRef.current.listeners.add(fn);
      return () => {
        storeRef.current.listeners.delete(fn);
      };
    },
    getSnapshot: () => storeRef.current.vista,
  }), []);
}

function useVista(store: CapturaStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

const ALTO_CONTROL = 26;

const lineaCampo = (tokens: TokensCaptura, alerta: boolean, enfocado: boolean) => {
  if (!alerta && !enfocado) return 'none';
  const color = alerta ? tokens.action.destructive : tokens.action.primary;
  return `inset 0 -1px 0 ${color}`;
};

const campoSx = (
  tokens: TokensCaptura,
  alinear: 'left' | 'right' = 'left',
  color?: string,
  alerta = false,
) => {
  const beige = tokens.metric.amount.background;
  const fondo = `${beige} !important`;
  const tinta = color || tokens.action.primary;
  return ({
  width: '100%',
  minWidth: 0,
  flex: 1,
  bgcolor: fondo,
  backgroundColor: fondo,
  '& .MuiInputBase-root, & .MuiAutocomplete-inputRoot, & .MuiOutlinedInput-root, & .MuiInputBase-root:hover, & .MuiAutocomplete-inputRoot:hover, & .MuiOutlinedInput-root:hover, & .MuiInputBase-root.Mui-focused, & .MuiAutocomplete-inputRoot.Mui-focused, & .MuiOutlinedInput-root.Mui-focused, & .MuiInputBase-root.Mui-disabled, & .MuiOutlinedInput-root.Mui-disabled': {
    height: `${ALTO_CONTROL}px !important`,
    minHeight: `${ALTO_CONTROL}px !important`,
    maxHeight: `${ALTO_CONTROL}px !important`,
    boxSizing: 'border-box',
    alignItems: 'center',
    fontSize: 12.5,
    fontWeight: alinear === 'right' ? 700 : 500,
    bgcolor: fondo,
    backgroundColor: fondo,
    backgroundImage: 'none',
    color: tinta,
    caretColor: tinta,
    borderRadius: 0,
    padding: '0 6px !important',
    boxShadow: lineaCampo(tokens, alerta, false),
  },
  '& .MuiInputBase-input, & .MuiAutocomplete-input, & .MuiOutlinedInput-input, & .MuiInputBase-input:hover, & .MuiInputBase-input:focus, & .MuiAutocomplete-input:hover, & .MuiAutocomplete-input:focus, & .MuiOutlinedInput-input:hover, & .MuiOutlinedInput-input:focus': {
    py: '0 !important',
    px: '0 !important',
    height: `${ALTO_CONTROL}px !important`,
    minHeight: '0 !important',
    boxSizing: 'border-box',
    fontSize: 12.5,
    lineHeight: `${ALTO_CONTROL}px`,
    fontWeight: alinear === 'right' ? 700 : 500,
    textAlign: alinear,
    color: `${tinta} !important`,
    WebkitTextFillColor: tinta,
    caretColor: tinta,
    bgcolor: fondo,
    backgroundColor: fondo,
    backgroundImage: 'none',
  },
  '& .MuiInputBase-input.Mui-disabled, & .MuiAutocomplete-input.Mui-disabled': {
    WebkitTextFillColor: `${tinta} !important`,
    color: `${tinta} !important`,
    opacity: 1,
  },
  '& .MuiInputBase-input:-webkit-autofill, & .MuiInputBase-input:-webkit-autofill:hover, & .MuiInputBase-input:-webkit-autofill:focus': {
    WebkitBoxShadow: `0 0 0 1000px ${beige} inset !important`,
    WebkitTextFillColor: tinta,
    caretColor: tinta,
    transition: 'background-color 9999s ease-out',
  },
  '& .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: 'none',
    backgroundColor: 'transparent',
  },
  '& .MuiOutlinedInput-root.Mui-focused, & .MuiInputBase-root.Mui-focused, & .MuiAutocomplete-inputRoot.Mui-focused': {
    bgcolor: fondo,
    backgroundColor: fondo,
    boxShadow: lineaCampo(tokens, alerta, true),
  },
});
};

const calendarioSx = (tokens: TokensCaptura) => ({
  bgcolor: tokens.content.elevated,
  color: tokens.content.foreground,
  border: `1px solid ${tokens.content.border}`,
  '& .MuiPickersCalendarHeader-label, & .MuiPickersArrowSwitcher-button, & .MuiDayCalendar-weekDayLabel': {
    color: tokens.content.foreground,
  },
  '& .MuiPickersArrowSwitcher-button:hover': { bgcolor: tokens.metric.amount.background },
  '& .MuiPickersDay-root': {
    color: tokens.content.foreground,
    '&:hover': { bgcolor: tokens.metric.amount.background },
    '&.MuiPickersDay-today': { borderColor: tokens.action.primary },
    '&.Mui-selected': {
      bgcolor: tokens.action.primary,
      color: tokens.action.primaryForeground,
      '&:hover, &:focus': { bgcolor: tokens.action.primaryHover },
    },
  },
});

const teclaDeFila = (event: KeyboardEvent, vista: VistaCaptura, popupAbierto = false) => {
  if (event.key === 'Escape' && popupAbierto) return;
  event.stopPropagation();
  if (event.shiftKey || event.nativeEvent.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    vista.cancelar();
    return;
  }
  if (event.key !== 'Enter' || popupAbierto) return;
  event.preventDefault();
  vista.guardar();
};

const teclaDeLista = (event: KeyboardEvent, vista: VistaCaptura, listaAbierta: boolean) => {
  event.stopPropagation();
  if (event.shiftKey || event.nativeEvent.isComposing) return;
  if (event.key === 'Escape') {
    if (listaAbierta) return;
    event.preventDefault();
    (event as KeyboardEvent & { defaultMuiPrevented: boolean }).defaultMuiPrevented = true;
    vista.cancelar();
    return;
  }
  if (event.key !== 'Enter' || listaAbierta) return;
  event.preventDefault();
  vista.guardar();
};

const listaOpcionSx = (tokens: TokensCaptura) => ({
  bgcolor: `${tokens.content.elevated} !important`,
  color: tokens.action.primary,
  border: `1px solid ${tokens.action.primary}`,
  borderRadius: '6px',
  boxShadow: `0 10px 28px color-mix(in srgb, ${tokens.action.primary} 18%, transparent)`,
  '& .MuiAutocomplete-listbox': { p: '4px', bgcolor: 'transparent' },
  '& .MuiAutocomplete-option': {
    fontSize: 12.5,
    minHeight: 32,
    py: 0.5,
    px: 1.25,
    borderRadius: '4px',
    fontWeight: 500,
    color: tokens.action.primary,
    bgcolor: 'transparent',
  },
  '& .MuiAutocomplete-option[aria-selected="true"]': {
    bgcolor: `${tokens.action.tint} !important`,
    color: `${tokens.action.primary} !important`,
    fontWeight: 700,
    boxShadow: `inset 3px 0 0 ${tokens.action.primary}`,
  },
  '& .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option.Mui-focusVisible, & .MuiAutocomplete-option[aria-selected="true"].Mui-focused, & .MuiAutocomplete-option[aria-selected="true"].Mui-focusVisible': {
    bgcolor: `${tokens.action.primary} !important`,
    color: `${tokens.action.primaryForeground} !important`,
    fontWeight: 700,
    boxShadow: `inset 3px 0 0 ${tokens.action.primaryForeground}`,
  },
  '& .MuiAutocomplete-option:hover:not(.Mui-focusVisible)': {
    bgcolor: `${tokens.content.hover} !important`,
    color: `${tokens.action.primary} !important`,
    fontWeight: 600,
    boxShadow: 'none',
  },
  '& .MuiAutocomplete-option[aria-selected="true"]:hover:not(.Mui-focusVisible)': {
    bgcolor: `${tokens.action.tint} !important`,
    color: `${tokens.action.primary} !important`,
    fontWeight: 700,
    boxShadow: `inset 3px 0 0 ${tokens.action.primary}`,
  },
  '& .MuiAutocomplete-option[aria-disabled="true"], & .MuiAutocomplete-option[aria-disabled="true"]:hover': {
    opacity: '1 !important',
    bgcolor: 'transparent !important',
    color: `${tokens.content.secondary} !important`,
    fontWeight: 500,
    boxShadow: 'none',
  },
  '& .MuiAutocomplete-option[data-transferencia="true"]': {
    boxShadow: `inset 2px 0 0 ${tokens.content.border}`,
  },
});

export function CampoFechaCaptura({ store }: { store: CapturaStore }) {
  const vista = useVista(store);
  const calendarioAbierto = useRef(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const focoFecha = vista?.focoFecha ?? 0;
  useEffect(() => {
    if (!focoFecha) return;
    const enfocar = () => {
      raizRef.current?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus();
    };
    const inmediato = window.setTimeout(enfocar, 0);
    const despues = window.setTimeout(enfocar, 40);
    return () => {
      window.clearTimeout(inmediato);
      window.clearTimeout(despues);
    };
  }, [focoFecha]);
  if (!vista) return null;
  const alerta = vista.campoPendiente === 'fecha';
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <div ref={raizRef} style={{ width: '100%' }}>
      <DatePicker
        value={vista.fecha ? dayjs(vista.fecha) : null}
        onChange={(value) => vista.setFecha(value?.isValid() ? value.format('YYYY-MM-DD') : '')}
        onOpen={() => { calendarioAbierto.current = true; marcarPopupCaptura(true); }}
        onClose={() => { calendarioAbierto.current = false; marcarPopupCaptura(false); }}
        format="DD/MM/YYYY"
        disabled={vista.guardando}
        slotProps={{
          textField: {
            size: 'small',
            fullWidth: true,
            autoFocus: focoFecha > 0,
            onKeyDown: (event) => teclaDeFila(event, vista, calendarioAbierto.current),
            inputProps: { 'aria-label': 'Fecha', 'aria-invalid': alerta },
            sx: {
              width: '100%',
              bgcolor: `${vista.tokens.metric.amount.background} !important`,
              backgroundColor: `${vista.tokens.metric.amount.background} !important`,
              '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root, & .MuiPickersInputBase-root, & .MuiPickersInputBase-root:hover, & .MuiPickersOutlinedInput-root:hover, & .MuiOutlinedInput-root:hover, & .MuiPickersInputBase-root.Mui-focused, & .MuiPickersOutlinedInput-root.Mui-focused, & .MuiOutlinedInput-root.Mui-focused': {
                height: `${ALTO_CONTROL}px !important`,
                minHeight: `${ALTO_CONTROL}px !important`,
                maxHeight: `${ALTO_CONTROL}px !important`,
                boxSizing: 'border-box',
                alignItems: 'center',
                fontSize: 12.5,
                fontWeight: 500,
                bgcolor: `${vista.tokens.metric.amount.background} !important`,
                backgroundColor: `${vista.tokens.metric.amount.background} !important`,
                backgroundImage: 'none',
                color: vista.tokens.action.primary,
                borderRadius: 0,
                padding: '0 6px !important',
                boxShadow: lineaCampo(vista.tokens, alerta, false),
                '& fieldset, & .MuiPickersOutlinedInput-notchedOutline': { border: 'none', backgroundColor: 'transparent' },
              },
              '& .MuiOutlinedInput-root.Mui-focused, & .MuiPickersOutlinedInput-root.Mui-focused, & .MuiPickersInputBase-root.Mui-focused': {
                bgcolor: `${vista.tokens.metric.amount.background} !important`,
                backgroundColor: `${vista.tokens.metric.amount.background} !important`,
                boxShadow: lineaCampo(vista.tokens, alerta, true),
              },
              '& .MuiPickersSectionList-root, & .MuiPickersInputBase-sectionsContainer, & .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiOutlinedInput-input, & .MuiPickersInputBase-sectionContent': {
                py: '0 !important',
                px: '0 !important',
                height: 'auto',
                minHeight: 0,
                fontSize: 12.5,
                fontWeight: 500,
                lineHeight: `${ALTO_CONTROL}px`,
                alignItems: 'center',
                color: `${vista.tokens.action.primary} !important`,
                WebkitTextFillColor: vista.tokens.action.primary,
                bgcolor: `${vista.tokens.metric.amount.background} !important`,
                backgroundColor: `${vista.tokens.metric.amount.background} !important`,
                backgroundImage: 'none',
              },
              '& .MuiInputAdornment-root': { ml: 0, height: ALTO_CONTROL, maxHeight: ALTO_CONTROL },
            },
          },
          openPickerButton: {
            size: 'small',
            sx: {
              p: 0,
              width: 18,
              height: 18,
              color: vista.tokens.action.primary,
              '&:hover': { bgcolor: 'transparent', color: vista.tokens.action.primaryHover },
            },
          },
          desktopPaper: { sx: calendarioSx(vista.tokens) },
          popper: { className: 'captura-popup' },
        }}
      />
      </div>
    </LocalizationProvider>
  );
}

export function CampoReferenciaCaptura({ store }: { store: CapturaStore }) {
  const vista = useVista(store);
  const inputRef = useRef<HTMLInputElement>(null);
  const focoReferencia = vista?.focoReferencia ?? 0;
  useEffect(() => {
    if (!focoReferencia) return;
    const enfocar = () => inputRef.current?.focus();
    const inmediato = window.setTimeout(enfocar, 0);
    const despues = window.setTimeout(enfocar, 50);
    return () => {
      window.clearTimeout(inmediato);
      window.clearTimeout(despues);
    };
  }, [focoReferencia]);
  if (!vista) return null;
  return (
    <TextField
      value={vista.referencia}
      onChange={(event) => vista.setReferencia(event.target.value)}
      size="small"
      placeholder=""
      disabled={vista.guardando}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => teclaDeFila(event, vista)}
      inputRef={inputRef}
      inputProps={{ 'aria-label': 'Referencia', 'aria-invalid': vista.campoPendiente === 'referencia' }}
      sx={campoSx(vista.tokens, 'left', undefined, vista.campoPendiente === 'referencia')}
    />
  );
}

export function CampoMontoCaptura({
  store,
  lado,
}: {
  store: CapturaStore;
  lado: 'salida' | 'ingreso';
}) {
  const vista = useVista(store);
  const [enfocado, setEnfocado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seleccionarAlEnfocar = useRef(false);
  const esSalida = lado === 'salida';
  const crudo = esSalida ? vista?.salida ?? '' : vista?.ingreso ?? '';
  const visible = enfocado || !crudo ? crudo : formatearMontoVisible(crudo);
  useEffect(() => {
    if (!enfocado || !seleccionarAlEnfocar.current) return;
    seleccionarAlEnfocar.current = false;
    inputRef.current?.select();
  }, [enfocado, visible]);
  if (!vista) return null;
  return (
    <TextField
      value={visible}
      onChange={(event) => (esSalida ? vista.escribirSalida(event.target.value) : vista.escribirIngreso(event.target.value))}
      onFocus={() => {
        seleccionarAlEnfocar.current = true;
        setEnfocado(true);
      }}
      onBlur={() => setEnfocado(false)}
      size="small"
      placeholder=""
      disabled={vista.guardando || (esSalida ? vista.montoBloqueado === 'salida' : vista.montoBloqueado === 'ingreso')}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => teclaDeFila(event, vista)}
      inputRef={inputRef}
      inputProps={{ 'aria-label': esSalida ? 'Retiro' : 'Depósito', inputMode: 'decimal', 'aria-invalid': vista.campoPendiente === 'monto' }}
      sx={campoSx(vista.tokens, 'right', vista.tokens.action.primary, vista.campoPendiente === 'monto')}
    />
  );
}

function CampoListaCaptura<T>({
  store,
  opciones,
  value,
  onChange,
  etiqueta,
  texto,
  igual,
  alerta = false,
  deshabilitado = false,
  textoFijo,
  renderOpcion,
}: {
  store: CapturaStore;
  opciones: T[];
  value: T | null;
  onChange: (value: T | null) => void;
  etiqueta: string;
  texto: (opcion: T) => string;
  igual: (opcion: T, actual: T) => boolean;
  alerta?: boolean;
  deshabilitado?: boolean;
  textoFijo?: string;
  renderOpcion?: (opcion: T) => ReactNode;
}) {
  const vista = useVista(store);
  const listaAbierta = useRef(false);
  if (!vista) return null;
  const opcionVisible = renderOpcion
    ? (props: HTMLAttributes<HTMLLIElement> & { key?: Key }, opcion: T) => {
      const { key, ...resto } = props;
      const transferencia = texto(opcion).startsWith('Transfer: ');
      return (
        <li key={key} {...resto} data-transferencia={transferencia ? 'true' : 'false'}>
          {renderOpcion(opcion)}
        </li>
      );
    }
    : null;
  return (
    <Autocomplete
      options={opciones}
      value={value}
      onChange={(_event, siguiente) => onChange(siguiente)}
      getOptionLabel={(opcion) => texto(opcion)}
      isOptionEqualToValue={igual}
      loading={vista.cargandoCatalogos}
      disabled={vista.guardando || deshabilitado}
      autoHighlight
      openOnFocus
      onMouseDown={(event) => event.stopPropagation()}
      size="small"
      fullWidth
      forcePopupIcon={false}
      {...(textoFijo != null ? { inputValue: textoFijo, onInputChange: () => undefined } : {})}
      onOpen={() => { listaAbierta.current = true; marcarPopupCaptura(true); }}
      onClose={() => { listaAbierta.current = false; marcarPopupCaptura(false); }}
      onKeyDown={(event) => teclaDeLista(event, vista, listaAbierta.current)}
      {...(opcionVisible ? { renderOption: opcionVisible } : {})}
      slotProps={{
        popper: { className: 'captura-popup', sx: { zIndex: 1500 } },
        paper: { sx: listaOpcionSx(vista.tokens) },
      }}
      renderInput={(params) => {
        const { InputLabelProps: _etiqueta, ...resto } = params;
        return (
          <TextField
            {...resto}
            placeholder=""
            size="small"
            InputProps={{
              ...(resto.InputProps as any),
              endAdornment: vista.cargandoCatalogos ? <CircularProgress color="inherit" size={12} /> : null,
            }}
            inputProps={{ ...resto.inputProps, 'aria-label': etiqueta, 'aria-invalid': alerta }}
            sx={campoSx(vista.tokens, 'left', deshabilitado ? vista.tokens.content.secondary : vista.tokens.action.primary, alerta) as any}
          />
        );
      }}
    />
  );
}

export function CampoContactoCaptura({ store }: { store: CapturaStore }) {
  const vista = useVista(store);
  if (!vista) return null;
  return (
    <CampoListaCaptura
      store={store}
      opciones={vista.contactos}
      value={vista.contacto}
      onChange={vista.setContacto}
      etiqueta="Contacto"
      texto={(opcion) => opcion.etiqueta}
      igual={(opcion, actual) => opcion.clave === actual.clave}
      renderOpcion={(opcion) => opcion.tipo === 'transferencia' ? (
        <span>
          <span style={{ opacity: 0.72 }}>Transfer: </span>
          {opcion.nombre}
        </span>
      ) : opcion.etiqueta}
      alerta={vista.campoPendiente === 'contacto'}
    />
  );
}

export function CampoConceptoCaptura({ store }: { store: CapturaStore }) {
  const vista = useVista(store);
  if (!vista) return null;
  return (
    <CampoListaCaptura
      store={store}
      opciones={vista.conceptos}
      value={vista.concepto}
      onChange={vista.setConcepto}
      etiqueta="Concepto"
      texto={(opcion) => opcion.nombre_concepto || ''}
      igual={(opcion, actual) => opcion.id === actual.id}
      deshabilitado={vista.modoTransferencia}
      {...(vista.modoTransferencia ? { textoFijo: ETIQUETA_CONCEPTO_TRANSFERENCIA } : {})}
      alerta={vista.campoPendiente === 'concepto'}
    />
  );
}
