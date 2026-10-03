import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, Divider, Drawer, FormControlLabel,
  IconButton, MenuItem, Stack, TextField, Tooltip, Typography, Autocomplete, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import RouteIcon from '@mui/icons-material/Route';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BadgeIcon from '@mui/icons-material/Badge';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  actualizarViaje, crearViajeDesdeDocumento, obtenerOperadoresDisponibles,
  obtenerRemolques, obtenerUbicacionesDisponibles, obtenerVehiculos, obtenerViajeAggregate, obtenerViajePorDocumento,
  validarCartaPorte,
  type CartaPorteIssue, type CartaPorteIssueSection, type OperadorDisponible,
  type RemolqueTransporte, type UbicacionDisponible, type VehiculoTransporte, type ViajeAggregate,
  type ViajeMercanciaInput, type ViajePutPayload,
} from '../../../services/transporte.api';
import { fetchProducto, fetchProductos } from '../../../services/productosService';
import {
  buscarBienesTransportadosSat, buscarMaterialesPeligrososSat, buscarTiposEmbalajeSat, buscarUnidadesSat,
  type SatMaterialPeligroso,
} from '../../../services/satCatalogos.api';
import type { Producto } from '../../../types/producto';

type Props = {
  open: boolean;
  documentoId: number | null;
  folio: string;
  tipoDocumento?: 'factura' | 'traslado';
  layout?: 'drawer' | 'modal';
  onClose: () => void;
  onFirstSave?: () => void;
};

const AZUL = '#1d2f68';

const pad = (n: number) => String(n).padStart(2, '0');
const formatLocalDateTime = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const text = String(iso).trim();
  const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(text);
  const conZona = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  if (naive && !conZona) return `${naive[1]}T${naive[2]}:${naive[3]}`;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocalDateTime(d);
};
/** Siguiente hora en punto, estrictamente después de `desde`. 13:22 → 14:00; 23:20 → 00:00 del día siguiente. */
const siguienteHoraCerrada = (desde = new Date()): Date => {
  const d = new Date(desde);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d;
};
const sumarHoras = (base: Date, horas: number): Date => {
  const d = new Date(base);
  d.setHours(d.getHours() + horas);
  return d;
};
const HORAS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTOS_INTERVALO = ['00', '15', '30', '45'];
const partirFechaHora = (value: string): { fecha: string; hora: string; minuto: string } => {
  const [fecha = '', hm = ''] = value.split('T');
  const [hora = '', minutoRaw = ''] = hm.split(':');
  return { fecha, hora, minuto: minutoRaw.slice(0, 2) };
};
const FONDO_SECCION_MODAL: Partial<Record<CartaPorteIssueSection, string>> = {
  ruta: '#e4eef6',
  unidad: '#e5f0e8',
  operador: '#f8efe4',
  generales: '#f3ecf6',
  mercancias: '#e8f2f0',
};
const numStr = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));
const aDosDecimales = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '';
};
const formatearMonto = (raw: string): string => {
  const n = Number(String(raw).replace(/,/g, ''));
  if (String(raw).trim() === '' || !Number.isFinite(n)) return '';
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const filtrarMonto = (raw: string): string => {
  const limpio = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const corte = limpio.indexOf('.');
  if (corte === -1) return limpio;
  return `${limpio.slice(0, corte + 1)}${limpio.slice(corte + 1).replace(/\./g, '').slice(0, 2)}`;
};

const domicilioLinea = (u: UbicacionDisponible): string => {
  const partes = [
    [u.calle, u.numero_exterior].filter(Boolean).join(' '),
    u.colonia, u.ciudad, u.estado, u.codigo_postal,
  ].filter((x) => x && String(x).trim());
  return partes.join(', ');
};
const ubicacionLabel = (u: UbicacionDisponible): string =>
  `${u.propietario_nombre} — ${u.identificador}${domicilioLinea(u) ? ` — ${domicilioLinea(u)}` : ''}`;

const vehiculoLabel = (v: VehiculoTransporte): string =>
  `${v.clave_interna} — ${v.placas}${v.configuracion_vehicular_sat ? ` — ${v.configuracion_vehicular_sat}` : ''}`;
const remolqueLabel = (r: RemolqueTransporte): string =>
  `${r.clave_interna} — ${r.placas}${r.subtipo_remolque_sat ? ` — ${r.subtipo_remolque_sat}${r.subtipo_descripcion ? ` (${r.subtipo_descripcion})` : ''}` : ''}`;
const operadorLabel = (o: OperadorDisponible): string =>
  `${o.nombre} — Lic. ${o.numero_licencia}${o.vigencia_licencia ? ` — Vig. ${String(o.vigencia_licencia).slice(0, 10)}` : ''}`;
const productoLabel = (p: Producto): string => `${p.clave} — ${p.descripcion}`;

const SECCION_LABEL: Record<CartaPorteIssueSection, string> = {
  ruta: 'Ruta',
  unidad: 'Unidad / Remolques',
  operador: 'Operador',
  mercancias: 'Mercancías',
  generales: 'Datos generales',
};
// A qué ancla del drawer lleva cada sección de error.
const SECCION_ANCLA: Partial<Record<CartaPorteIssueSection, string>> = {
  ruta: 'cp-sec-ruta',
  unidad: 'cp-sec-unidad',
  operador: 'cp-sec-operador',
  mercancias: 'cp-sec-mercancias',
};

// Fila editable de mercancía (todos los campos como texto para edición cómoda).
type MercanciaFila = {
  key: string;
  productoId: number | null;
  descripcion: string;
  cantidad: string;
  pesoKg: string;
  valorMercancia: string;
  unidadDescripcion: string;
  claveUnidadSat: string;
  claveBienesTransportadosSat: string;
  materialPeligroso: boolean;
  claveMaterialPeligroso: string;
  embalaje: string;
  descripcionEmbalaje: string;
  origenSecuencia: number | null;
  destinoSecuencia: number | null;
};

let filaSeq = 0;
let paradaSeq = 0;
type ParadaRuta = { key: string; domicilioId: number | null; fecha: string; distancia: string };
const nuevaParada = (fecha = ''): ParadaRuta => ({ key: `p${++paradaSeq}`, domicilioId: null, fecha, distancia: '' });
const fechaInicialParada = (origen: string): string => {
  const partes = partirFechaHora(origen);
  if (partes.fecha) return `${partes.fecha}T${partes.hora || '00'}:${partes.minuto || '00'}`;
  return `${formatLocalDateTime(new Date()).slice(0, 10)}T00:00`;
};
const nuevaFila = (base: Partial<MercanciaFila> = {}): MercanciaFila => ({
  key: `f${++filaSeq}`,
  productoId: null, descripcion: '', cantidad: '', pesoKg: '', valorMercancia: '',
  unidadDescripcion: '', claveUnidadSat: '', claveBienesTransportadosSat: '',
  materialPeligroso: false, claveMaterialPeligroso: '', embalaje: '', descripcionEmbalaje: '',
  origenSecuencia: null, destinoSecuencia: null,
  ...base,
});

type OpcionSat = SatMaterialPeligroso;

const mergeByClave = (a: OpcionSat[], b: OpcionSat[]): OpcionSat[] => {
  const map = new Map<string, OpcionSat>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.clave);
    // conserva la descripción no vacía si ya la teníamos
    map.set(x.clave, x.descripcion || !prev ? x : prev);
  }
  return [...map.values()];
};

type LineasOpcion = { titulo: string; detalle?: string; nota?: string; codigo?: boolean };

const altoResumen = (lineas: LineasOpcion): number => {
  const n = 1 + (lineas.detalle?.trim() ? 1 : 0) + (lineas.nota?.trim() ? 1 : 0);
  return n >= 3 ? 84 : n === 2 ? 68 : 40;
};

const adornosLista = (tokens: { content: { card: string; border: string } }) => ({
  paper: {
    sx: {
      bgcolor: tokens.content.card,
      border: `1px solid ${tokens.content.border}`,
      boxShadow: '0 10px 28px rgba(62, 52, 40, 0.08)',
    },
  },
  listbox: {
    sx: {
      py: 0.5,
      maxHeight: 340,
      '& .MuiAutocomplete-option': {
        alignItems: 'flex-start',
        whiteSpace: 'normal',
        minHeight: 0,
        py: 1.25,
        px: 1.75,
        borderBottom: `1px solid ${tokens.content.border}`,
      },
      '& .MuiAutocomplete-option:last-of-type': { borderBottom: 'none' },
    },
  },
});

function DetalleCatalogo({ lineas, compacto = false }: { lineas: LineasOpcion; compacto?: boolean }) {
  const tokens = useTheme().emphasys;
  const detalle = lineas.detalle?.trim();
  const nota = lineas.nota?.trim();
  return (
    <Box sx={{ minWidth: 0, width: '100%', py: compacto ? 0 : 0.15 }}>
      <Typography sx={{
        fontWeight: 700,
        letterSpacing: lineas.codigo ? '0.06em' : 0,
        textTransform: lineas.codigo ? 'uppercase' : 'none',
        fontSize: compacto ? '0.68rem' : '0.78rem',
        lineHeight: 1.3,
        color: tokens.content.foreground,
      }}>
        {lineas.titulo}
      </Typography>
      {detalle && (
        <Typography noWrap={compacto} sx={{
          mt: 0.2,
          fontSize: compacto ? '0.75rem' : '0.8125rem',
          lineHeight: 1.35,
          fontWeight: 500,
          color: tokens.content.secondary,
        }}>
          {detalle}
        </Typography>
      )}
      {nota && (
        <Typography noWrap={compacto} sx={{
          mt: 0.2,
          fontSize: compacto ? '0.72rem' : '0.75rem',
          lineHeight: 1.4,
          color: tokens.content.muted,
        }}>
          {nota}
        </Typography>
      )}
    </Box>
  );
}

const armarLineas = (titulo: string, detalle: string, nota: string, codigo = false): LineasOpcion => {
  const lineas: LineasOpcion = { titulo };
  if (detalle) lineas.detalle = detalle;
  if (nota) lineas.nota = nota;
  if (codigo) lineas.codigo = true;
  return lineas;
};

const lineasVehiculo = (v: VehiculoTransporte): LineasOpcion => armarLineas(
  v.clave_interna,
  v.placas || '',
  [
    v.configuracion_vehicular_sat,
    v.modelo_anio ? String(v.modelo_anio) : '',
    v.peso_bruto_vehicular != null ? `${v.peso_bruto_vehicular} kg` : '',
  ].filter(Boolean).join(' · '),
  true,
);

const lineasRemolque = (r: RemolqueTransporte): LineasOpcion => armarLineas(
  r.clave_interna,
  r.placas || '',
  [r.subtipo_remolque_sat, r.subtipo_descripcion].filter(Boolean).join(' · '),
  true,
);

const lineasOperador = (o: OperadorDisponible): LineasOpcion => armarLineas(
  o.nombre,
  `Licencia ${o.numero_licencia}${o.tipo_licencia ? ` · ${o.tipo_licencia}` : ''}`,
  [o.rfc ? `RFC ${o.rfc}` : '', o.vigencia_licencia ? `Vigencia ${String(o.vigencia_licencia).slice(0, 10)}` : ''].filter(Boolean).join(' · '),
);

const lineasProducto = (p: Producto): LineasOpcion => armarLineas(
  p.clave,
  p.descripcion,
  [p.unidad_venta_descripcion, p.clave_bienes_transportados_sat ? `Bienes ${p.clave_bienes_transportados_sat}` : ''].filter(Boolean).join(' · '),
  true,
);

function CampoSeleccion<T>({
  label, placeholder, options, value, disabled, loading, onChange, getOptionLabel, igual, lineas, onOpen, noOptionsText, valorSimple,
}: {
  label: string;
  placeholder?: string;
  options: T[];
  value: T | null;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: T | null) => void;
  getOptionLabel: (option: T) => string;
  igual: (option: T, value: T) => boolean;
  lineas: (option: T) => LineasOpcion;
  onOpen?: () => void;
  noOptionsText?: string;
  valorSimple?: boolean;
}) {
  const tokens = useTheme().emphasys;
  const [abierto, setAbierto] = useState(false);
  const vista = value ? lineas(value) : null;
  const resumen = Boolean(vista?.titulo) && !abierto && !valorSimple;
  const etiqueta = (option: T) => (valorSimple ? (lineas(option).titulo || getOptionLabel(option)) : getOptionLabel(option));
  return (
    <Autocomplete
      options={options}
      size="small"
      fullWidth
      {...(disabled ? { disabled: true } : {})}
      {...(loading ? { loading: true } : {})}
      {...(noOptionsText ? { noOptionsText } : {})}
      value={value}
      open={abierto}
      onOpen={() => { setAbierto(true); onOpen?.(); }}
      onClose={() => setAbierto(false)}
      onChange={(_, seleccionado) => onChange(seleccionado)}
      getOptionLabel={etiqueta}
      filterOptions={valorSimple ? (opts, state) => {
        const consulta = state.inputValue.trim().toLowerCase();
        if (!consulta) return opts;
        return opts.filter((option) => {
          const detalle = lineas(option);
          return [detalle.titulo, detalle.detalle, detalle.nota, getOptionLabel(option)]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(consulta);
        });
      } : undefined}
      isOptionEqualToValue={igual}
      slotProps={adornosLista(tokens)}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest}>
            <DetalleCatalogo lineas={lineas(option)} />
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={resumen ? '' : (placeholder ?? '')}
          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          inputProps={{
            ...params.inputProps,
            ...(resumen ? { style: { color: 'transparent', WebkitTextFillColor: 'transparent' } } : {}),
          }}
          InputProps={{
            ...params.InputProps,
            ...(resumen && vista ? { sx: { minHeight: altoResumen(vista), alignItems: 'flex-start', py: 0.75 } } : {}),
            startAdornment: resumen && vista ? (
              <Box sx={{ position: 'absolute', left: 14, right: 36, top: 8, pointerEvents: 'none' }}>
                <DetalleCatalogo lineas={vista} compacto />
              </Box>
            ) : params.InputProps.startAdornment,
          }}
        />
      )}
    />
  );
}

function CampoMonto({ label, value, onChange, disabled, helperText }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
}) {
  const [foco, setFoco] = useState(false);
  const [borrador, setBorrador] = useState('');
  return (
    <TextField
      label={label}
      value={foco ? borrador : formatearMonto(value)}
      size="small"
      fullWidth
      {...(disabled ? { disabled: true } : {})}
      placeholder="0.00"
      {...(helperText ? { helperText } : {})}
      onFocus={() => {
        const crudo = value.replace(/,/g, '');
        const n = Number(crudo);
        setBorrador(crudo.trim() === '' || !Number.isFinite(n) ? crudo : n.toFixed(2));
        setFoco(true);
      }}
      onBlur={() => {
        setFoco(false);
        const limpio = filtrarMonto(borrador);
        if (limpio === '' || limpio === '.') {
          if (value.trim() !== '') onChange('');
          return;
        }
        const n = Number(limpio);
        if (!Number.isFinite(n)) return;
        const actual = Number(value.replace(/,/g, ''));
        if (value.trim() !== '' && Number.isFinite(actual) && actual === n) return;
        onChange(n.toFixed(2));
      }}
      onChange={(e) => setBorrador(filtrarMonto(e.target.value))}
      inputProps={{ inputMode: 'decimal' }}
    />
  );
}

/**
 * Selector de clave SAT contra un catálogo del servidor. Persiste únicamente
 * la clave y resuelve la descripción de un valor precargado.
 * `rico` aplica la jerarquía visual del modal de traslado.
 */
function SatClaveField({ label, catalogo, value, onChange, onSelect, alResolver, disabled, rico }: {
  label: string;
  catalogo: 'bienes' | 'unidades' | 'materiales' | 'embalajes';
  value: string;
  onChange: (clave: string) => void;
  onSelect?: (opcion: OpcionSat | null) => void;
  alResolver?: (opcion: OpcionSat) => void;
  disabled?: boolean;
  rico?: boolean;
}) {
  const tokens = useTheme().emphasys;
  const buscar = catalogo === 'unidades'
    ? buscarUnidadesSat
    : catalogo === 'bienes'
      ? buscarBienesTransportadosSat
      : catalogo === 'materiales'
        ? buscarMaterialesPeligrososSat
        : buscarTiposEmbalajeSat;
  const [options, setOptions] = useState<OpcionSat[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);

  // Resuelve la descripción del valor precargado que aún no está en opciones.
  useEffect(() => {
    if (!value || options.some((o) => o.clave === value && o.descripcion)) return;
    let cancel = false;
    buscar(value)
      .then((items) => {
        if (cancel) return;
        setOptions((prev) => mergeByClave(prev, [{ clave: value, descripcion: '' }, ...items]));
        const match = items.find((item) => item.clave === value && item.descripcion.trim());
        if (match) alResolver?.(match);
      })
      .catch(() => { if (!cancel) setOptions((prev) => mergeByClave(prev, [{ clave: value, descripcion: '' }])); });
    return () => { cancel = true; };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) return;
    let cancel = false;
    setLoading(true);
    const t = setTimeout(() => {
      buscar(q)
        .then((items) => { if (!cancel) setOptions((prev) => mergeByClave(prev, items)); })
        .catch(() => {})
        .finally(() => { if (!cancel) setLoading(false); });
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((o) => o.clave === value) ?? (value ? { clave: value, descripcion: '' } : null);
  const resumen = rico && Boolean(selected?.clave) && !abierto;
  const elegir = (opcion: OpcionSat | null) => {
    onChange(opcion?.clave ?? '');
    onSelect?.(opcion);
  };
  const etiqueta = (o: OpcionSat) => (o.descripcion ? `${o.clave} — ${o.descripcion}` : o.clave);
  const sinResultados = loading ? 'Buscando…' : input.trim().length < 2 ? 'Escribe para buscar' : 'Sin resultados';

  if (!rico) {
    return (
      <Autocomplete
        sx={{ flex: '1 1 100%', minWidth: 160 }}
        size="small"
        {...(disabled ? { disabled: true } : {})}
        options={options}
        loading={loading}
        value={selected}
        filterOptions={(o) => o}
        onInputChange={(_, v, reason) => { if (reason === 'input') setInput(v); }}
        onChange={(_, v) => elegir(v)}
        getOptionLabel={etiqueta}
        isOptionEqualToValue={(o, v) => o.clave === v.clave}
        renderInput={(p) => <TextField {...p} label={label} placeholder="Buscar por clave o descripción" />}
        noOptionsText={sinResultados}
      />
    );
  }

  return (
    <Autocomplete
      sx={{ width: '100%' }}
      size="small"
      {...(disabled ? { disabled: true } : {})}
      options={options}
      loading={loading}
      value={selected}
      open={abierto}
      onOpen={() => setAbierto(true)}
      onClose={() => setAbierto(false)}
      filterOptions={(o) => o}
      onInputChange={(_, v, reason) => { if (reason === 'input') setInput(v); }}
      onChange={(_, v) => elegir(v)}
      getOptionLabel={etiqueta}
      isOptionEqualToValue={(o, v) => o.clave === v.clave}
      slotProps={{
        paper: adornosLista(tokens).paper,
        listbox: {
          sx: {
            py: 0.25,
            maxHeight: 340,
            '& .MuiAutocomplete-option': {
              alignItems: 'center',
              minHeight: 36,
              py: 0.5,
              px: 1.5,
            },
          },
        },
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest}>
            <ResumenSat opcion={option} />
          </Box>
        );
      }}
      renderInput={(p) => (
        <TextField
          {...p}
          label={label}
          placeholder={resumen ? '' : 'Buscar por clave o descripción'}
          InputLabelProps={{ ...p.InputLabelProps, shrink: true }}
          inputProps={{
            ...p.inputProps,
            ...(resumen ? { style: { color: 'transparent', WebkitTextFillColor: 'transparent' } } : {}),
          }}
          InputProps={{
            ...p.InputProps,
            ...(resumen && selected ? { sx: { minHeight: 40, alignItems: 'center' } } : {}),
            startAdornment: resumen && selected ? (
              <Box sx={{ position: 'absolute', left: 14, right: 36, display: 'flex', alignItems: 'center', pointerEvents: 'none', minWidth: 0 }}>
                <ResumenSat opcion={selected} />
              </Box>
            ) : p.InputProps.startAdornment,
          }}
        />
      )}
      noOptionsText={sinResultados}
    />
  );
}

function ResumenSat({ opcion }: { opcion: OpcionSat }) {
  const tokens = useTheme().emphasys;
  const descripcion = opcion.descripcion?.trim() ?? '';
  const extra = [opcion.clase_division ? `Clase ${opcion.clase_division}` : '', opcion.nombre_tecnico?.trim() ?? ''].filter(Boolean).join(' · ');
  return (
    <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0, width: '100%' }}>
      <Typography noWrap sx={{ flexShrink: 0, fontWeight: 700, letterSpacing: '0.04em', fontSize: '0.8125rem', lineHeight: 1.4, color: tokens.content.foreground }}>
        {opcion.clave}
      </Typography>
      {descripcion && (
        <Typography noWrap sx={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.4, color: tokens.content.secondary }}>
          {descripcion}
        </Typography>
      )}
      {extra && (
        <Typography noWrap sx={{ flex: '0 1 auto', maxWidth: '34%', minWidth: 0, fontSize: '0.75rem', lineHeight: 1.4, color: tokens.content.muted }}>
          {extra}
        </Typography>
      )}
    </Stack>
  );
}

const lineaDomicilio = (u: UbicacionDisponible): string => {
  const calle = [u.calle, u.numero_exterior].filter(Boolean).join(' ');
  const interior = u.numero_interior ? `Int. ${u.numero_interior}` : '';
  const zona = [u.colonia, u.ciudad, u.estado].filter(Boolean).join(', ');
  const cp = u.codigo_postal ? `CP ${u.codigo_postal}` : '';
  return [calle, interior, zona, cp].filter(Boolean).join(' · ');
};

function DetalleUbicacion({ u, compacto = false }: { u: UbicacionDisponible; compacto?: boolean }) {
  const tokens = useTheme().emphasys;
  const domicilio = lineaDomicilio(u);
  return (
    <Box sx={{ minWidth: 0, width: '100%', py: compacto ? 0 : 0.25 }}>
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontSize: compacto ? '0.68rem' : '0.72rem',
          lineHeight: 1.3,
          color: tokens.content.foreground,
        }}>
          {u.identificador}
        </Typography>
        {u.es_principal && (
          <Typography sx={{ fontSize: '0.68rem', lineHeight: 1.3, color: tokens.content.muted, fontWeight: 500 }}>
            Principal
          </Typography>
        )}
      </Stack>
      <Typography noWrap={compacto} sx={{
        mt: 0.25,
        fontSize: compacto ? '0.75rem' : '0.8125rem',
        lineHeight: 1.35,
        fontWeight: 500,
        color: tokens.content.secondary,
      }}>
        {u.propietario_nombre}
      </Typography>
      {domicilio && (
        <Typography noWrap={compacto} sx={{
          mt: 0.25,
          fontSize: '0.75rem',
          lineHeight: 1.4,
          color: tokens.content.muted,
        }}>
          {domicilio}
        </Typography>
      )}
    </Box>
  );
}

function CampoUbicacion({
  label, options, value, disabled, onChange,
}: {
  label: string;
  options: UbicacionDisponible[];
  value: UbicacionDisponible | null;
  disabled?: boolean;
  onChange: (value: UbicacionDisponible | null) => void;
}) {
  const tokens = useTheme().emphasys;
  const [abierto, setAbierto] = useState(false);
  const resumen = Boolean(value) && !abierto;
  return (
    <Autocomplete
      options={options}
      size="small"
      disabled={disabled}
      value={value}
      open={abierto}
      onOpen={() => setAbierto(true)}
      onClose={() => setAbierto(false)}
      onChange={(_, seleccionado) => onChange(seleccionado)}
      getOptionLabel={ubicacionLabel}
      isOptionEqualToValue={(o, v) => o.domicilio_id === v.domicilio_id}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.content.card,
            border: `1px solid ${tokens.content.border}`,
            boxShadow: '0 10px 28px rgba(62, 52, 40, 0.08)',
          },
        },
        listbox: {
          sx: {
            py: 0.5,
            maxHeight: 340,
            '& .MuiAutocomplete-option': {
              alignItems: 'flex-start',
              whiteSpace: 'normal',
              minHeight: 0,
              py: 1.25,
              px: 1.75,
              borderBottom: `1px solid ${tokens.content.border}`,
            },
            '& .MuiAutocomplete-option:last-of-type': { borderBottom: 'none' },
          },
        },
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest}>
            <DetalleUbicacion u={option} />
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value ? '' : 'Buscar ubicación'}
          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          inputProps={{
            ...params.inputProps,
            style: resumen ? { color: 'transparent', WebkitTextFillColor: 'transparent' } : undefined,
          }}
          InputProps={{
            ...params.InputProps,
            sx: resumen ? { minHeight: 76, alignItems: 'flex-start', py: 1 } : undefined,
            startAdornment: resumen && value ? (
              <Box sx={{ position: 'absolute', left: 14, right: 36, top: 8, pointerEvents: 'none' }}>
                <DetalleUbicacion u={value} compacto />
              </Box>
            ) : params.InputProps.startAdornment,
          }}
        />
      )}
    />
  );
}

export default function CartaPorteViajeEditor({ open, documentoId, folio, tipoDocumento = 'factura', layout = 'drawer', onClose, onFirstSave }: Props) {
  const theme = useTheme();
  const pantallaCompacta = useMediaQuery(theme.breakpoints.down('sm'));
  const tokens = theme.emphasys;
  const modal = layout === 'modal';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [viajeId, setViajeId] = useState<number | null>(null);
  const [aggregate, setAggregate] = useState<ViajeAggregate | null>(null);

  const [ubicaciones, setUbicaciones] = useState<UbicacionDisponible[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoTransporte[]>([]);
  const [remolques, setRemolques] = useState<RemolqueTransporte[]>([]);
  const [operadores, setOperadores] = useState<OperadorDisponible[]>([]);

  // Estado editable
  const [origenId, setOrigenId] = useState<number | null>(null);
  const [origenFecha, setOrigenFecha] = useState('');
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [destinoFecha, setDestinoFecha] = useState('');
  const [destinoDistancia, setDestinoDistancia] = useState(''); // km recorridos (requerido por Carta Porte en el destino)
  const [paradas, setParadas] = useState<ParadaRuta[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [vehiculoId, setVehiculoId] = useState<number | null>(null);
  const [remolqueIds, setRemolqueIds] = useState<number[]>([]);
  const [operadorId, setOperadorId] = useState<number | null>(null);
  const [mercancias, setMercancias] = useState<MercanciaFila[]>([]);

  // Mercancías: catálogo de productos
  const [productos, setProductos] = useState<Producto[] | null>(null);

  // Validación de Carta Porte
  const [validando, setValidando] = useState(false);
  const [validationResult, setValidationResult] = useState<{ ok: boolean; issues: CartaPorteIssue[] } | null>(null);
  const [touchedSinceValidation, setTouchedSinceValidation] = useState(false);
  const touch = useCallback(() => setTouchedSinceValidation(true), []);

  const handledVehRef = useRef<Set<number>>(new Set());
  const dismissedRemolqueRef = useRef<Set<number>>(new Set());

  const readOnly = useMemo(() => {
    const est = aggregate?.viaje?.estatus;
    const cp = aggregate?.cartaPorte?.estatus;
    return est === 'timbrado' || est === 'cancelado' || cp === 'timbrado' || cp === 'cancelado';
  }, [aggregate]);

  const reconstruirDesdeAggregate = useCallback((agg: ViajeAggregate) => {
    handledVehRef.current = new Set();
    dismissedRemolqueRef.current = new Set();
    const origen = agg.ubicaciones.find((u) => u.tipo === 'origen');
    const destinosPorSecuencia = agg.ubicaciones
      .filter((u) => u.tipo === 'destino')
      .sort((a, b) => a.secuencia - b.secuencia);
    const destino = modal
      ? destinosPorSecuencia[destinosPorSecuencia.length - 1]
      : agg.ubicaciones.find((u) => u.tipo === 'destino');
    setParadas(modal
      ? destinosPorSecuencia.slice(0, -1).map((u) => ({
        key: `p${++paradaSeq}`,
        domicilioId: u.domicilio_id,
        fecha: toLocalInput(u.fecha_hora_programada),
        distancia: aDosDecimales(u.distancia_recorrida),
      }))
      : []);
    setOrigenId(origen?.domicilio_id ?? null);
    const origenGuardada = toLocalInput(origen?.fecha_hora_programada);
    const destinoGuardada = toLocalInput(destino?.fecha_hora_programada);
    if (modal && !origenGuardada && !destinoGuardada) {
      const salida = siguienteHoraCerrada();
      setOrigenFecha(formatLocalDateTime(salida));
      setDestinoFecha(formatLocalDateTime(sumarHoras(salida, 3)));
    } else {
      setOrigenFecha(origenGuardada);
      setDestinoFecha(destinoGuardada);
    }
    setDestinoId(destino?.domicilio_id ?? null);
    setDestinoDistancia(modal ? aDosDecimales(destino?.distancia_recorrida) : numStr(destino?.distancia_recorrida));
    setObservaciones(agg.viaje.observaciones ?? '');
    setVehiculoId(agg.viaje.vehiculo_id ?? null);
    setRemolqueIds([...agg.remolques].sort((a, b) => a.orden - b.orden).map((r) => r.remolque_id));
    const operador = agg.figuras.find((f) => f.tipo_figura === 'operador' && f.operador_id);
    setOperadorId(operador?.operador_id ?? null);
    setMercancias(agg.mercancias.map((m) => nuevaFila({
      key: `m${m.id}`,
      productoId: m.producto_id == null || Number.isNaN(Number(m.producto_id)) ? null : Number(m.producto_id),
      descripcion: m.descripcion_snapshot ?? '',
      cantidad: modal ? aDosDecimales(m.cantidad) : numStr(m.cantidad),
      pesoKg: modal ? aDosDecimales(m.peso_kg) : numStr(m.peso_kg),
      valorMercancia: modal ? aDosDecimales(m.valor_mercancia) : numStr(m.valor_mercancia),
      unidadDescripcion: m.unidad_descripcion ?? '',
      claveUnidadSat: m.clave_unidad_sat ?? '',
      claveBienesTransportadosSat: m.clave_bienes_transportados_sat ?? '',
      materialPeligroso: !!m.material_peligroso,
      claveMaterialPeligroso: m.clave_material_peligroso ?? '',
      embalaje: m.embalaje ?? '',
      descripcionEmbalaje: m.descripcion_embalaje ?? '',
      origenSecuencia: m.origen_secuencia ?? null,
      destinoSecuencia: m.destino_secuencia ?? null,
    })));
    setAviso(null);
    setValidationResult(null);
    setTouchedSinceValidation(false);
  }, [modal]);

  const cargarViaje = useCallback(async (id: number) => {
    const agg = await obtenerViajeAggregate(id);
    setAggregate(agg);
    reconstruirDesdeAggregate(agg);
  }, [reconstruirDesdeAggregate]);

  const cargarTodo = useCallback(async () => {
    if (!documentoId) return;
    setLoading(true);
    setError(null);
    setAviso(null);
    setAggregate(null);
    setViajeId(null);
    try {
      const [ubi, veh, rem, ope, listaProductos] = await Promise.all([
        obtenerUbicacionesDisponibles(),
        obtenerVehiculos(),
        obtenerRemolques(),
        obtenerOperadoresDisponibles(),
        modal ? fetchProductos().catch(() => [] as Producto[]) : Promise.resolve(null),
      ]);
      setUbicaciones(ubi);
      setVehiculos(veh);
      setRemolques(rem);
      setOperadores(ope);
      if (listaProductos) setProductos(listaProductos.map((p) => ({ ...p, id: Number(p.id) })));
      const viaje = await obtenerViajePorDocumento(documentoId);
      if (viaje?.viaje_id) {
        setViajeId(viaje.viaje_id);
        await cargarViaje(viaje.viaje_id);
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el Viaje.');
    } finally {
      setLoading(false);
    }
  }, [documentoId, cargarViaje, modal]);

  useEffect(() => {
    if (open && documentoId) void cargarTodo();
    if (!open) {
      setAggregate(null);
      setViajeId(null);
      setError(null);
    }
  }, [open, documentoId, cargarTodo]);

  const crearViaje = useCallback(async () => {
    if (!documentoId) return;
    setLoading(true);
    setError(null);
    try {
      const viaje = await crearViajeDesdeDocumento(documentoId);
      setViajeId(viaje.viaje_id);
      await cargarViaje(viaje.viaje_id);
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el Viaje.');
    } finally {
      setLoading(false);
    }
  }, [documentoId, cargarViaje]);

  const onVehiculoChange = useCallback((v: VehiculoTransporte | null) => {
    touch();
    setVehiculoId(v?.id ?? null);
    if (
      v?.remolque_predeterminado_id
      && remolqueIds.length === 0
      && !handledVehRef.current.has(v.id)
      && !dismissedRemolqueRef.current.has(v.remolque_predeterminado_id)
    ) {
      handledVehRef.current.add(v.id);
      setRemolqueIds([v.remolque_predeterminado_id]);
      setAviso(`Se propuso el remolque predeterminado del vehículo (${v.remolque_predeterminado_clave ?? v.remolque_predeterminado_id}). Puedes quitarlo si no aplica.`);
    }
  }, [remolqueIds.length]);

  const setRemolquesSeleccionados = useCallback((ids: number[]) => {
    touch();
    for (const prev of remolqueIds) {
      if (!ids.includes(prev)) dismissedRemolqueRef.current.add(prev);
    }
    setRemolqueIds(ids);
  }, [remolqueIds, touch]);

  const remolqueOptions = useMemo<RemolqueTransporte[]>(() => {
    const map = new Map<number, RemolqueTransporte>();
    for (const r of remolques) map.set(r.id, r);
    const veh = vehiculos.find((v) => v.id === vehiculoId);
    if (veh?.remolque_predeterminado_id && !map.has(veh.remolque_predeterminado_id)) {
      map.set(veh.remolque_predeterminado_id, {
        id: veh.remolque_predeterminado_id,
        clave_interna: veh.remolque_predeterminado_clave ?? `#${veh.remolque_predeterminado_id}`,
        placas: veh.remolque_predeterminado_placas ?? '',
        subtipo_remolque_sat: veh.remolque_predeterminado_subtipo ?? null,
        subtipo_descripcion: null,
        activo: true,
      });
    }
    for (const id of remolqueIds) {
      if (!map.has(id)) map.set(id, { id, clave_interna: `#${id}`, placas: '', subtipo_remolque_sat: null, subtipo_descripcion: null, activo: true });
    }
    return [...map.values()];
  }, [remolques, remolqueIds, vehiculos, vehiculoId]);

  const operadorSel = operadores.find((o) => o.operador_id === operadorId) ?? null;

  // ---- Mercancías: helpers ----
  const asegurarProductos = useCallback(async () => {
    if (productos !== null) return;
    try { setProductos((await fetchProductos()).map((p) => ({ ...p, id: Number(p.id) }))); } catch { setProductos([]); }
  }, [productos]);

  useEffect(() => {
    if (!modal || productos === null) return;
    const faltantes = [...new Set(
      mercancias
        .map((fila) => fila.productoId)
        .filter((id): id is number => id != null && !productos.some((p) => p.id === id)),
    )];
    if (faltantes.length === 0) return;
    let cancelado = false;
    void Promise.all(faltantes.map((id) => fetchProducto(id).catch(() => null))).then((filas) => {
      if (cancelado) return;
      const extras = filas
        .filter((p): p is Producto => p != null && Number.isFinite(Number(p.id)))
        .map((p) => ({ ...p, id: Number(p.id) }));
      if (extras.length === 0) return;
      setProductos((prev) => {
        const base = prev ?? [];
        const ids = new Set(base.map((p) => p.id));
        return [...extras.filter((p) => !ids.has(p.id)), ...base];
      });
    });
    return () => { cancelado = true; };
  }, [modal, productos, mercancias]);

  const patchFila = useCallback((key: string, patch: Partial<MercanciaFila>) => {
    touch();
    setMercancias((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, [touch]);

  const completarUnidadDesdeSat = useCallback((key: string, opcion: OpcionSat) => {
    const descripcion = opcion.descripcion.trim();
    if (!descripcion) return;
    setMercancias((prev) => prev.map((fila) => (
      fila.key === key && fila.claveUnidadSat === opcion.clave && !fila.unidadDescripcion.trim()
        ? { ...fila, unidadDescripcion: descripcion }
        : fila
    )));
  }, []);

  const quitarFila = useCallback((key: string) => {
    touch();
    setMercancias((prev) => prev.filter((f) => f.key !== key));
  }, [touch]);

  const seleccionarProducto = useCallback((key: string, p: Producto | null) => {
    if (!p) { patchFila(key, { productoId: null }); return; }
    patchFila(key, {
      productoId: p.id,
      descripcion: p.descripcion ?? '',
      claveBienesTransportadosSat: p.clave_bienes_transportados_sat ?? '',
      claveUnidadSat: (p as { clave_unidad_sat?: string | null }).clave_unidad_sat ?? p.unidad_sat ?? '',
      unidadDescripcion: p.unidad_venta_descripcion ?? p.unidad_inventario_descripcion ?? '',
      materialPeligroso: !!p.es_material_peligroso,
      claveMaterialPeligroso: p.clave_material_peligroso_sat ?? '',
      embalaje: p.clave_embalaje_sat ?? '',
      descripcionEmbalaje: p.descripcion_embalaje ?? '',
    });
  }, [patchFila]);

  // El drawer sigue con un origen (secuencia 1) y un destino (secuencia 2).
  // El modal reutiliza el mismo contrato: las paradas son destinos previos
  // al destino final y las mercancías se asignan del origen a ese destino final.
  const rutaAsignable = !!(origenId && destinoId);
  const origenResumen = useMemo(() => {
    const u = ubicaciones.find((x) => x.domicilio_id === origenId);
    return u ? `${u.propietario_nombre} — ${u.identificador}` : null;
  }, [ubicaciones, origenId]);
  const destinoResumen = useMemo(() => {
    const u = ubicaciones.find((x) => x.domicilio_id === destinoId);
    return u ? `${u.propietario_nombre} — ${u.identificador}` : null;
  }, [ubicaciones, destinoId]);

  const guardar = useCallback(async (): Promise<boolean> => {
    if (!viajeId || !aggregate) return false;
    const distanciaCapturada = (raw: string, etiqueta: string): number | null | undefined => {
      if (raw.trim() === '') return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError(`La distancia recorrida de ${etiqueta} debe ser un número mayor a cero.`);
        return undefined;
      }
      return n;
    };

    const ubicacionesPayload: ViajePutPayload['ubicaciones'] = [];
    let origenSecuencia: number | null = null;
    let destinoSecuencia: number | null = null;

    if (!modal) {
      if (origenId && !origenFecha) { setError('Indica la fecha/hora programada de origen.'); return false; }
      if (destinoId && !destinoFecha) { setError('Indica la fecha/hora programada de destino.'); return false; }
      const distanciaDestino = destinoDistancia.trim() === '' ? null : Number(destinoDistancia);
      if (distanciaDestino !== null && (!Number.isFinite(distanciaDestino) || distanciaDestino <= 0)) {
        setError('La distancia recorrida del destino debe ser un número mayor a cero.');
        return false;
      }
      if (origenId && origenFecha) ubicacionesPayload.push({ domicilioId: origenId, tipo: 'origen', secuencia: 1, fechaHoraProgramada: origenFecha });
      if (destinoId && destinoFecha) ubicacionesPayload.push({ domicilioId: destinoId, tipo: 'destino', secuencia: 2, fechaHoraProgramada: destinoFecha, distanciaRecorrida: distanciaDestino });
      origenSecuencia = rutaAsignable ? 1 : null;
      destinoSecuencia = rutaAsignable ? 2 : null;
    } else {
      if (paradas.length > 0 && !destinoId) {
        setError('Indica el destino final para conservar las paradas.');
        return false;
      }
      if (origenId && !origenFecha) { setError('Indica la fecha/hora programada de origen.'); return false; }
      if (destinoId && !destinoFecha) { setError('Indica la fecha/hora programada de destino.'); return false; }
      const distanciaDestino = distanciaCapturada(destinoDistancia, 'el destino final');
      if (distanciaDestino === undefined) return false;
      const paradasPayload: ViajePutPayload['ubicaciones'] = [];
      for (let i = 0; i < paradas.length; i++) {
        const parada = paradas[i]!;
        const etiqueta = `la parada ${i + 1}`;
        if (!parada.domicilioId) { setError(`Indica el domicilio de ${etiqueta}.`); return false; }
        if (!parada.fecha) { setError(`Indica la fecha/hora de ${etiqueta}.`); return false; }
        const distancia = distanciaCapturada(parada.distancia, etiqueta);
        if (distancia === undefined) return false;
        paradasPayload.push({
          domicilioId: parada.domicilioId,
          tipo: 'destino',
          secuencia: i + 2,
          fechaHoraProgramada: parada.fecha,
          distanciaRecorrida: distancia,
        });
      }
      if (origenId && origenFecha) ubicacionesPayload.push({ domicilioId: origenId, tipo: 'origen', secuencia: 1, fechaHoraProgramada: origenFecha });
      ubicacionesPayload.push(...paradasPayload);
      const secuenciaDestino = paradas.length + 2;
      if (destinoId && destinoFecha) ubicacionesPayload.push({ domicilioId: destinoId, tipo: 'destino', secuencia: secuenciaDestino, fechaHoraProgramada: destinoFecha, distanciaRecorrida: distanciaDestino });
      origenSecuencia = rutaAsignable ? 1 : null;
      destinoSecuencia = rutaAsignable ? secuenciaDestino : null;
    }

    const mercPayload: ViajeMercanciaInput[] = [];
    for (let i = 0; i < mercancias.length; i++) {
      const f = mercancias[i]!;
      const cantidad = Number(f.cantidad);
      const pesoKg = Number(f.pesoKg);
      const etiqueta = f.descripcion.trim() || (f.productoId ? `producto ${f.productoId}` : `#${i + 1}`);
      // En la UI el producto es obligatorio. El API de factura_servicio sigue
      // aceptando mercancía libre (productoId o descripción) para DICOR.
      if ((modal || tipoDocumento === 'traslado') && !f.productoId) {
        setError(`Mercancía ${etiqueta}: selecciona un producto.`);
        return false;
      }
      if (!f.productoId && !f.descripcion.trim()) { setError(`Mercancía ${etiqueta}: indica un producto o una descripción.`); return false; }
      if (!Number.isFinite(cantidad) || cantidad <= 0) { setError(`Mercancía ${etiqueta}: la cantidad debe ser mayor a cero.`); return false; }
      if (!Number.isFinite(pesoKg) || pesoKg <= 0) { setError(`Mercancía ${etiqueta}: el peso (kg) debe ser mayor a cero.`); return false; }
      const valor = f.valorMercancia.trim() === '' ? null : Number(f.valorMercancia);
      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) { setError(`Mercancía ${etiqueta}: el valor no es válido.`); return false; }
      mercPayload.push({
        productoId: f.productoId,
        descripcion: f.descripcion.trim() || null,
        cantidad,
        pesoKg,
        valorMercancia: valor,
        claveBienesTransportadosSat: f.claveBienesTransportadosSat.trim() || null,
        claveUnidadSat: f.claveUnidadSat.trim() || null,
        unidadDescripcion: f.unidadDescripcion.trim() || null,
        materialPeligroso: f.materialPeligroso,
        claveMaterialPeligroso: f.materialPeligroso ? (f.claveMaterialPeligroso.trim() || null) : null,
        embalaje: f.materialPeligroso ? (f.embalaje.trim() || null) : null,
        descripcionEmbalaje: f.materialPeligroso ? (f.descripcionEmbalaje.trim() || null) : null,
        origenSecuencia,
        destinoSecuencia,
      });
    }

    const payload: ViajePutPayload = {
      folioInterno: aggregate.viaje.folio_interno,
      clienteContactoId: aggregate.viaje.cliente_contacto_id,
      estatus: 'borrador',
      observaciones: observaciones.trim() || null,
      vehiculoId,
      ubicaciones: ubicacionesPayload,
      mercancias: mercPayload,
      figuras: operadorId ? [{ tipoFigura: 'operador', operadorId, secuencia: 1 }] : [],
      remolques: remolqueIds.map((remolqueId, i) => ({ remolqueId, orden: i + 1 })),
    };
    setSaving(true);
    setError(null);
    try {
      await actualizarViaje(viajeId, payload);
      onFirstSave?.();
      await cargarViaje(viajeId); // recarga desde backend, drawer permanece abierto
      return true;
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el Viaje.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [viajeId, aggregate, origenId, origenFecha, destinoId, destinoFecha, destinoDistancia, paradas, modal, observaciones, vehiculoId, remolqueIds, operadorId, mercancias, cargarViaje, onFirstSave, tipoDocumento, rutaAsignable]);

  const irASeccion = useCallback((section: CartaPorteIssueSection) => {
    const id = SECCION_ANCLA[section];
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const validar = useCallback(async () => {
    if (!viajeId) return;
    // 1. Guardar siempre para que el backend valide exactamente lo que se ve.
    const saved = await guardar();
    if (!saved) return; // el error de validación de captura ya se mostró
    setValidando(true);
    setError(null);
    try {
      await validarCartaPorte(viajeId);
      await cargarViaje(viajeId); // refleja estatus 'validado' y la Carta Porte materializada
      setValidationResult({ ok: true, issues: [] });
      setTouchedSinceValidation(false);
    } catch (e: any) {
      const issues: CartaPorteIssue[] = Array.isArray(e?.payload?.issues) ? e.payload.issues : [];
      setValidationResult({
        ok: false,
        issues: issues.length
          ? issues
          : [{ section: 'generales', message: e?.message || 'No se pudo validar la Carta Porte.' }],
      });
      setTouchedSinceValidation(false);
    } finally {
      setValidando(false);
    }
  }, [viajeId, guardar, cargarViaje]);

  const issuesPorSeccion = useMemo(() => {
    const map = new Map<CartaPorteIssueSection, CartaPorteIssue[]>();
    for (const it of validationResult?.ok === false ? validationResult.issues : []) {
      const arr = map.get(it.section) ?? [];
      arr.push(it);
      map.set(it.section, arr);
    }
    return map;
  }, [validationResult]);

  const cartaPorteLista = (validationResult?.ok || aggregate?.cartaPorte?.estatus === 'validado') && !touchedSinceValidation;

  const seccion = (
    icon: React.ReactNode, titulo: string, children: React.ReactNode,
    opts: { extra?: React.ReactNode; anchorId?: string; section?: CartaPorteIssueSection } = {},
  ) => {
    const conErrores = opts.section ? (issuesPorSeccion.get(opts.section)?.length ?? 0) > 0 : false;
    const fondo = modal && opts.section ? FONDO_SECCION_MODAL[opts.section] : undefined;
    return (
      <Box
        id={opts.anchorId}
        sx={{
          border: '1px solid',
          borderColor: conErrores ? 'error.main' : (modal ? tokens.content.border : 'divider'),
          borderRadius: 2, p: 1.5,
          ...(fondo ? { bgcolor: fondo } : {}),
          ...(fondo ? { '& .MuiOutlinedInput-root': { bgcolor: tokens.content.card } } : {}),
          ...(conErrores ? { boxShadow: (t: any) => `0 0 0 1px ${t.palette.error.main} inset` } : {}),
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {icon}
          <Typography variant="subtitle2" fontWeight={700} color={conErrores ? 'error.main' : (modal ? tokens.content.foreground : AZUL)}>{titulo}</Typography>
          <Box sx={{ flex: 1 }} />
          {opts.extra}
        </Stack>
        <Stack spacing={1.25}>{children}</Stack>
      </Box>
    );
  };

  const dtField = (label: string, value: string, onChange: (v: string) => void) => (
    <TextField
      type="datetime-local" label={label} value={value} size="small" fullWidth
      onChange={(e) => { touch(); onChange(e.target.value); }}
      InputLabelProps={{ shrink: true }}
      disabled={readOnly}
    />
  );

  const fechaHoraModal = (label: string, value: string, onChange: (v: string) => void) => {
    const partes = partirFechaHora(value);
    const minutos = partes.minuto && !MINUTOS_INTERVALO.includes(partes.minuto)
      ? [...MINUTOS_INTERVALO, partes.minuto].sort()
      : MINUTOS_INTERVALO;
    const escribir = (fecha: string, hora: string, minuto: string) => {
      touch();
      if (!fecha) { onChange(''); return; }
      onChange(`${fecha}T${hora || '00'}:${minuto || '00'}`);
    };
    return (
      <Box>
        <Typography variant="caption" sx={{ display: 'block', mb: 0.75, color: tokens.content.secondary, fontWeight: 600 }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="flex-start">
          <TextField
            type="date"
            label="Fecha"
            value={partes.fecha}
            size="small"
            disabled={readOnly}
            onChange={(e) => escribir(e.target.value, partes.hora, partes.minuto)}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: '1 1 150px' }}
          />
          <TextField
            select
            label="Hora"
            value={partes.hora}
            size="small"
            disabled={readOnly}
            onChange={(e) => escribir(partes.fecha, e.target.value, partes.minuto || '00')}
            sx={{ flex: '0 1 96px', minWidth: 88 }}
          >
            {partes.hora === '' ? <MenuItem value="" sx={{ display: 'none' }} /> : null}
            {HORAS.map((hora) => <MenuItem key={hora} value={hora}>{hora}</MenuItem>)}
          </TextField>
          <TextField
            select
            label="Min"
            value={partes.minuto}
            size="small"
            disabled={readOnly}
            onChange={(e) => escribir(partes.fecha, partes.hora || '00', e.target.value)}
            sx={{ flex: '0 1 96px', minWidth: 88 }}
          >
            {partes.minuto === '' ? <MenuItem value="" sx={{ display: 'none' }} /> : null}
            {minutos.map((minuto) => <MenuItem key={minuto} value={minuto}>{minuto}</MenuItem>)}
          </TextField>
        </Stack>
      </Box>
    );
  };

  const mini = (label: string, value: string, onChange: (v: string) => void, opts: { type?: string } = {}) => (
    <TextField
      label={label} value={value} size="small" type={opts.type}
      onChange={(e) => onChange(e.target.value)} disabled={readOnly}
      sx={{ flex: '1 1 45%', minWidth: 120 }}
    />
  );

  const renderMercancia = (f: MercanciaFila, idx: number) => {
    const productoSel = f.productoId == null
      ? null
      : (productos?.find((p) => p.id === f.productoId) ?? null);
    const encabezado = (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">Mercancía {idx + 1}</Typography>
        <Box sx={{ flex: 1 }} />
        {!readOnly && (
          <IconButton
            size="small"
            onClick={() => quitarFila(f.key)}
            aria-label="Eliminar mercancía"
            {...(modal ? { sx: { color: tokens.action.destructive } } : {})}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    );
    const avisoRuta = rutaAsignable ? (
      <Typography variant="caption" color="text.secondary">
        {modal && paradas.length > 0
          ? `Origen → ${paradas.length} parada${paradas.length === 1 ? '' : 's'} → Destino final: ${origenResumen} → ${destinoResumen}. Las mercancías se asignan del origen al destino final.`
          : `Origen → Destino: ${origenResumen} → ${destinoResumen} (asignado automáticamente)`}
      </Typography>
    ) : (
      <Typography variant="caption" color="warning.main">
        Define el origen y el destino en la sección Ruta para asignarlos a esta mercancía.
      </Typography>
    );
    if (!modal) {
      return (
        <Box key={f.key} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1, bgcolor: '#fbfcfe' }}>
          {encabezado}
          <Stack spacing={1}>
            <Autocomplete
              options={productos ?? []}
              size="small"
              disabled={readOnly}
              loading={productos === null}
              value={productoSel}
              onOpen={() => void asegurarProductos()}
              onChange={(_, p) => seleccionarProducto(f.key, p)}
              getOptionLabel={productoLabel}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => <TextField {...p} label="Producto (opcional)" placeholder="Clave o descripción" />}
            />
            <TextField
              label="Descripción" value={f.descripcion} size="small" fullWidth disabled={readOnly}
              onChange={(e) => patchFila(f.key, { descripcion: e.target.value })}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {mini('Cantidad', f.cantidad, (v) => patchFila(f.key, { cantidad: v }), { type: 'number' })}
              {mini('Unidad', f.unidadDescripcion, (v) => patchFila(f.key, { unidadDescripcion: v }))}
              {mini('Peso (kg)', f.pesoKg, (v) => patchFila(f.key, { pesoKg: v }), { type: 'number' })}
              {mini('Valor', f.valorMercancia, (v) => patchFila(f.key, { valorMercancia: v }), { type: 'number' })}
            </Stack>
            <SatClaveField
              label="Bienes/servicios transportados (SAT)"
              catalogo="bienes"
              value={f.claveBienesTransportadosSat}
              disabled={readOnly}
              onChange={(clave) => patchFila(f.key, { claveBienesTransportadosSat: clave })}
            />
            <SatClaveField
              label="Unidad SAT"
              catalogo="unidades"
              value={f.claveUnidadSat}
              disabled={readOnly}
              onChange={(clave) => patchFila(f.key, { claveUnidadSat: clave })}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={f.materialPeligroso} disabled={readOnly}
                onChange={(e) => patchFila(f.key, { materialPeligroso: e.target.checked })} />}
              label={<Typography variant="body2">Material peligroso</Typography>}
            />
            {f.materialPeligroso && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {mini('Clave mat. peligroso', f.claveMaterialPeligroso, (v) => patchFila(f.key, { claveMaterialPeligroso: v }))}
                {mini('Embalaje', f.embalaje, (v) => patchFila(f.key, { embalaje: v }))}
                {mini('Descripción embalaje', f.descripcionEmbalaje, (v) => patchFila(f.key, { descripcionEmbalaje: v }))}
              </Stack>
            )}
            {avisoRuta}
          </Stack>
        </Box>
      );
    }
    const ancho = pantallaCompacta ? 'auto' : '1 / -1';
    return (
      <Box key={f.key} sx={{ border: '1px solid', borderColor: tokens.content.border, borderRadius: 1.5, p: 1.25, bgcolor: tokens.content.well }}>
        {encabezado}
        <Box sx={{ display: 'grid', gridTemplateColumns: pantallaCompacta ? '1fr' : '1fr 1fr', gap: 1.25, alignItems: 'start' }}>
          <Box sx={{ gridColumn: ancho }}>
            <CampoSeleccion
              label="Producto"
              placeholder="Clave o descripción"
              options={productos ?? []}
              loading={productos === null}
              disabled={readOnly}
              value={productoSel}
              onOpen={() => void asegurarProductos()}
              onChange={(p) => seleccionarProducto(f.key, p)}
              getOptionLabel={productoLabel}
              igual={(o, v) => o.id === v.id}
              lineas={lineasProducto}
              valorSimple
              noOptionsText={productos === null ? 'Cargando…' : 'Sin productos'}
            />
          </Box>
          <TextField
            label="Descripción" value={f.descripcion} size="small" fullWidth disabled={readOnly}
            onChange={(e) => patchFila(f.key, { descripcion: e.target.value })}
            sx={{ gridColumn: ancho }}
          />
          <CampoMonto label="Cantidad" value={f.cantidad} disabled={readOnly} onChange={(v) => patchFila(f.key, { cantidad: v })} />
          <CampoMonto label="Peso (kg)" value={f.pesoKg} disabled={readOnly} onChange={(v) => patchFila(f.key, { pesoKg: v })} />
          <CampoMonto label="Valor de la mercancía (opcional)" value={f.valorMercancia} disabled={readOnly} onChange={(v) => patchFila(f.key, { valorMercancia: v })} />
          <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 40 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={f.materialPeligroso} disabled={readOnly}
                onChange={(e) => patchFila(f.key, { materialPeligroso: e.target.checked })} />}
              label={<Typography variant="body2">Material peligroso</Typography>}
            />
          </Box>
          <SatClaveField
            label="Bienes/servicios transportados SAT"
            catalogo="bienes"
            value={f.claveBienesTransportadosSat}
            disabled={readOnly}
            rico
            onChange={(clave) => patchFila(f.key, { claveBienesTransportadosSat: clave })}
          />
          <SatClaveField
            label="Unidad SAT"
            catalogo="unidades"
            value={f.claveUnidadSat}
            disabled={readOnly}
            rico
            alResolver={(opcion) => completarUnidadDesdeSat(f.key, opcion)}
            onChange={(clave) => patchFila(f.key, clave ? { claveUnidadSat: clave } : { claveUnidadSat: '', unidadDescripcion: '' })}
            onSelect={(opcion) => {
              const descripcion = opcion?.descripcion.trim();
              if (opcion && descripcion) patchFila(f.key, { claveUnidadSat: opcion.clave, unidadDescripcion: descripcion });
            }}
          />
          {f.materialPeligroso && (
            <>
              <SatClaveField
                label="Material peligroso SAT"
                catalogo="materiales"
                value={f.claveMaterialPeligroso}
                disabled={readOnly}
                rico
                onChange={(clave) => patchFila(f.key, { claveMaterialPeligroso: clave })}
              />
              <SatClaveField
                label="Embalaje"
                catalogo="embalajes"
                value={f.embalaje}
                disabled={readOnly}
                rico
                onChange={(clave) => patchFila(f.key, clave ? { embalaje: clave } : { embalaje: '', descripcionEmbalaje: '' })}
                onSelect={(opcion) => {
                  const descripcion = opcion?.descripcion.trim();
                  if (opcion && descripcion) patchFila(f.key, { embalaje: opcion.clave, descripcionEmbalaje: descripcion });
                }}
              />
              <TextField
                label="Descripción embalaje"
                value={f.descripcionEmbalaje}
                size="small"
                fullWidth
                disabled={readOnly}
                onChange={(e) => patchFila(f.key, { descripcionEmbalaje: e.target.value })}
                sx={{ gridColumn: ancho }}
              />
            </>
          )}
          <Box sx={{ gridColumn: ancho }}>{avisoRuta}</Box>
        </Box>
      </Box>
    );
  };

  const acento = modal ? tokens.action.info : AZUL;

  const secRuta = seccion(<RouteIcon fontSize="small" htmlColor={acento} />, 'Ruta', (
        <>
          {modal ? (
            <CampoUbicacion
              label="Origen"
              options={ubicaciones}
              disabled={readOnly}
              value={ubicaciones.find((u) => u.domicilio_id === origenId) ?? null}
              onChange={(v) => { touch(); setOrigenId(v?.domicilio_id ?? null); }}
            />
          ) : (
            <Autocomplete
              options={ubicaciones}
              size="small"
              disabled={readOnly}
              value={ubicaciones.find((u) => u.domicilio_id === origenId) ?? null}
              onChange={(_, v) => { touch(); setOrigenId(v?.domicilio_id ?? null); }}
              getOptionLabel={ubicacionLabel}
              isOptionEqualToValue={(o, v) => o.domicilio_id === v.domicilio_id}
              renderInput={(p) => <TextField {...p} label="Origen" placeholder="Buscar ubicación" />}
            />
          )}
          {modal
            ? fechaHoraModal('Salida', origenFecha, setOrigenFecha)
            : dtField('Fecha/hora programada origen', origenFecha, setOrigenFecha)}
          {modal && paradas.map((parada, index) => (
            <Box key={parada.key} sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, p: 1.25, bgcolor: tokens.content.well }}>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">Parada {index + 1}</Typography>
                <Box sx={{ flex: 1 }} />
                {!readOnly && (
                  <>
                    <IconButton size="small" aria-label="Subir parada" disabled={index === 0} onClick={() => {
                      touch();
                      setParadas((prev) => {
                        const next = [...prev];
                        const [item] = next.splice(index, 1);
                        if (!item) return prev;
                        next.splice(index - 1, 0, item);
                        return next;
                      });
                    }}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Bajar parada" disabled={index === paradas.length - 1} onClick={() => {
                      touch();
                      setParadas((prev) => {
                        const next = [...prev];
                        const [item] = next.splice(index, 1);
                        if (!item) return prev;
                        next.splice(index + 1, 0, item);
                        return next;
                      });
                    }}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Eliminar parada" onClick={() => { touch(); setParadas((prev) => prev.filter((item) => item.key !== parada.key)); }} sx={{ color: tokens.action.destructive }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Stack>
              <Stack spacing={1.25}>
                <CampoUbicacion
                  label="Domicilio"
                  options={ubicaciones}
                  disabled={readOnly}
                  value={ubicaciones.find((u) => u.domicilio_id === parada.domicilioId) ?? null}
                  onChange={(v) => {
                    touch();
                    setParadas((prev) => prev.map((item) => item.key === parada.key ? { ...item, domicilioId: v?.domicilio_id ?? null } : item));
                  }}
                />
                {fechaHoraModal('Llegada', parada.fecha, (fecha) => {
                  setParadas((prev) => prev.map((item) => item.key === parada.key ? { ...item, fecha } : item));
                })}
                <CampoMonto
                  label="Distancia desde la ubicación anterior (km)"
                  value={parada.distancia}
                  disabled={readOnly}
                  helperText={index === 0 ? 'Origen → Parada 1' : `Parada ${index} → Parada ${index + 1}`}
                  onChange={(distancia) => {
                    touch();
                    setParadas((prev) => prev.map((item) => item.key === parada.key ? { ...item, distancia } : item));
                  }}
                />
              </Stack>
            </Box>
          ))}
          {modal && !readOnly && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { touch(); setParadas((prev) => [...prev, nuevaParada(fechaInicialParada(origenFecha))]); }}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 1.75,
                bgcolor: tokens.action.primary,
                color: tokens.action.primaryForeground,
                '&:hover': { bgcolor: tokens.action.primaryHover },
                '& .MuiButton-startIcon': { color: 'inherit' },
              }}
            >
              Agregar parada
            </Button>
          )}
          {modal ? (
            <CampoUbicacion
              label="Destino final"
              options={ubicaciones}
              disabled={readOnly}
              value={ubicaciones.find((u) => u.domicilio_id === destinoId) ?? null}
              onChange={(v) => { touch(); setDestinoId(v?.domicilio_id ?? null); }}
            />
          ) : (
            <Autocomplete
              options={ubicaciones}
              size="small"
              disabled={readOnly}
              value={ubicaciones.find((u) => u.domicilio_id === destinoId) ?? null}
              onChange={(_, v) => { touch(); setDestinoId(v?.domicilio_id ?? null); }}
              getOptionLabel={ubicacionLabel}
              isOptionEqualToValue={(o, v) => o.domicilio_id === v.domicilio_id}
              renderInput={(p) => <TextField {...p} label="Destino" placeholder="Buscar ubicación" />}
            />
          )}
          {modal
            ? fechaHoraModal('Llegada', destinoFecha, setDestinoFecha)
            : dtField('Fecha/hora programada destino', destinoFecha, setDestinoFecha)}
          {destinoId && (modal ? (
            <CampoMonto
              label="Distancia desde la ubicación anterior (km)"
              value={destinoDistancia}
              disabled={readOnly}
              helperText={paradas.length === 0 ? 'Origen → Destino final' : `Parada ${paradas.length} → Destino final`}
              onChange={(v) => { touch(); setDestinoDistancia(v); }}
            />
          ) : (
            <TextField
              label="Distancia recorrida (km)"
              type="number"
              size="small"
              fullWidth
              disabled={readOnly}
              value={destinoDistancia}
              onChange={(e) => { touch(); setDestinoDistancia(e.target.value); }}
              helperText="Requerida por la Carta Porte para el destino."
              inputProps={{ min: 0, step: 'any' }}
            />
          ))}
        </>
      ), { anchorId: 'cp-sec-ruta', section: 'ruta' });

  const secUnidad = seccion(<LocalShippingIcon fontSize="small" htmlColor={acento} />, 'Unidad', (
        <>
          {modal ? (
            <CampoSeleccion
              label="Vehículo"
              placeholder="Clave o placas"
              options={vehiculos}
              disabled={readOnly}
              value={vehiculos.find((v) => v.id === vehiculoId) ?? null}
              onChange={(v) => onVehiculoChange(v)}
              getOptionLabel={vehiculoLabel}
              igual={(o, v) => o.id === v.id}
              lineas={lineasVehiculo}
            />
          ) : (
            <Autocomplete
              options={vehiculos}
              size="small"
              disabled={readOnly}
              value={vehiculos.find((v) => v.id === vehiculoId) ?? null}
              onChange={(_, v) => onVehiculoChange(v)}
              getOptionLabel={vehiculoLabel}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => <TextField {...p} label="Vehículo" placeholder="Clave o placas" />}
            />
          )}
          {modal ? (
            <Autocomplete
              multiple
              options={remolqueOptions}
              size="small"
              disabled={readOnly}
              value={remolqueOptions.filter((r) => remolqueIds.includes(r.id))}
              onChange={(_, v) => setRemolquesSeleccionados(v.map((r) => r.id))}
              getOptionLabel={remolqueLabel}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              slotProps={adornosLista(tokens)}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                return (
                  <Box component="li" key={key} {...rest}>
                    <DetalleCatalogo lineas={lineasRemolque(option)} />
                  </Box>
                );
              }}
              renderTags={(value, getTagProps) =>
                value.map((r, index) => (
                  <Chip size="small" label={`${r.clave_interna}${r.placas ? ` · ${r.placas}` : ''}`} {...getTagProps({ index })} key={r.id} />
                ))}
              renderInput={(p) => <TextField {...p} label="Remolques" placeholder="Agregar remolque" />}
            />
          ) : (
            <Autocomplete
              multiple
              options={remolqueOptions}
              size="small"
              disabled={readOnly}
              value={remolqueOptions.filter((r) => remolqueIds.includes(r.id))}
              onChange={(_, v) => setRemolquesSeleccionados(v.map((r) => r.id))}
              getOptionLabel={remolqueLabel}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderTags={(value, getTagProps) =>
                value.map((r, index) => (
                  <Chip size="small" label={`${r.clave_interna}${r.placas ? ` · ${r.placas}` : ''}`} {...getTagProps({ index })} key={r.id} />
                ))}
              renderInput={(p) => <TextField {...p} label="Remolques" placeholder="Agregar remolque" />}
            />
          )}
        </>
      ), { anchorId: 'cp-sec-unidad', section: 'unidad' });

  const secOperador = seccion(<BadgeIcon fontSize="small" htmlColor={acento} />, 'Operador', (
        <>
          {modal ? (
            <CampoSeleccion
              label="Operador"
              placeholder="Nombre o licencia"
              options={operadores}
              disabled={readOnly}
              value={operadorSel}
              onChange={(v) => { touch(); setOperadorId(v?.operador_id ?? null); }}
              getOptionLabel={operadorLabel}
              igual={(o, v) => o.operador_id === v.operador_id}
              lineas={lineasOperador}
            />
          ) : (
            <Autocomplete
              options={operadores}
              size="small"
              disabled={readOnly}
              value={operadorSel}
              onChange={(_, v) => { touch(); setOperadorId(v?.operador_id ?? null); }}
              getOptionLabel={operadorLabel}
              isOptionEqualToValue={(o, v) => o.operador_id === v.operador_id}
              renderInput={(p) => <TextField {...p} label="Operador" placeholder="Nombre o licencia" />}
            />
          )}
          {operadorSel && !modal && (
            <Box sx={{ bgcolor: modal ? tokens.content.well : '#f8fafc', borderRadius: 1.5, p: 1 }}>
              <Typography variant="caption" display="block" color="text.secondary">
                RFC: {operadorSel.rfc ?? '—'} · CURP: {operadorSel.curp ?? '—'}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                Licencia: {operadorSel.numero_licencia} · Tipo: {operadorSel.tipo_licencia ?? '—'} · Vigencia: {operadorSel.vigencia_licencia ? String(operadorSel.vigencia_licencia).slice(0, 10) : '—'}
              </Typography>
            </Box>
          )}
        </>
      ), { anchorId: 'cp-sec-operador', section: 'operador' });

  const secGenerales = seccion(<Typography variant="body2" color="text.secondary">▤</Typography>, 'Datos generales', (
        <TextField
          label="Observaciones"
          value={observaciones}
          onChange={(e) => { touch(); setObservaciones(e.target.value); }}
          disabled={readOnly}
          multiline
          minRows={modal ? 2 : 4}
          fullWidth
          placeholder="Notas operativas del viaje"
        />
      ), { section: 'generales' });

  const secMercancias = seccion(
        <Inventory2OutlinedIcon fontSize="small" htmlColor={acento} />, 'Mercancías',
        (
          <>
            {mercancias.length === 0 && (
              <Typography variant="caption" color="text.secondary">Sin mercancías. Agrega una para capturarla.</Typography>
            )}
            {mercancias.map((f, i) => renderMercancia(f, i))}

            {!readOnly && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => { touch(); setMercancias((prev) => [...prev, nuevaFila()]); }} sx={{ alignSelf: 'flex-start' }}>
                Agregar mercancía
              </Button>
            )}
          </>
        ),
        {
          anchorId: 'cp-sec-mercancias',
          section: 'mercancias',
        },
  );

  const formulario = !viajeId ? null : (
    <>
      {secRuta}
      {secUnidad}
      {secOperador}
      {secGenerales}
      {secMercancias}
    </>
  );

  const hayAvisoValidacion = Boolean(
    !readOnly && viajeId && (
      cartaPorteLista
      || (validationResult?.ok && touchedSinceValidation)
      || (validationResult && !validationResult.ok)
    )
  );
  const avisosValidacion = hayAvisoValidacion ? (
    <>
      {cartaPorteLista && (
        <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success">
          Carta Porte lista para timbrar
        </Alert>
      )}
      {validationResult?.ok && touchedSinceValidation && (
        <Alert severity="warning">
          Cambiaste datos después de validar. Vuelve a validar la Carta Porte.
        </Alert>
      )}
      {validationResult && !validationResult.ok && (
        <Stack spacing={1}>
          <Alert severity="error" sx={{ py: 0 }}>
            La Carta Porte no puede timbrarse todavía. {validationResult.issues.length} punto(s) por resolver
            {touchedSinceValidation ? ' (revisa; los datos cambiaron desde la última validación)' : ''}.
          </Alert>
          {[...issuesPorSeccion.entries()].map(([section, list]) => (
            <Box key={section} sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 1.5, p: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" fontWeight={700} color="error.main">
                  {SECCION_LABEL[section]} ({list.length})
                </Typography>
                <Box sx={{ flex: 1 }} />
                {SECCION_ANCLA[section] && (
                  <Button size="small" sx={{ minWidth: 0, py: 0 }} onClick={() => irASeccion(section)}>Ir</Button>
                )}
              </Stack>
              <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                {list.map((it, i) => (
                  <li key={i}>
                    <Typography variant="caption" color="text.primary">{it.message}</Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </>
  ) : null;

  if (!modal) return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, maxWidth: '100%' } }}>
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75, height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color={AZUL}>Carta Porte / Viaje</Typography>
            <Typography variant="caption" color="text.secondary">
              {tipoDocumento === 'traslado' ? 'Traslado' : 'Factura'} {folio}{viajeId ? ` · Viaje #${viajeId}` : ''}{aggregate?.viaje?.estatus ? ` · ${aggregate.viaje.estatus}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Stack>
        <Divider />

        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
        ) : error && !aggregate && !viajeId ? (
          <Alert severity="error">{error}</Alert>
        ) : !viajeId ? (
          <Stack spacing={1.5} sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">Este {tipoDocumento === 'traslado' ? 'traslado' : 'factura'} aún no tiene Viaje relacionado.</Typography>
            <Button variant="contained" size="small" onClick={() => void crearViaje()}>Crear viaje</Button>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ overflowY: 'auto', pr: 0.5 }}>
            {readOnly && <Alert severity="info" sx={{ py: 0 }}>Viaje en sólo lectura ({aggregate?.viaje?.estatus}).</Alert>}
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {aviso && <Alert severity="warning" onClose={() => setAviso(null)}>{aviso}</Alert>}

            {formulario}

            {/* ---- Validación de Carta Porte ---- */}
            {!readOnly && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CheckCircleOutlineIcon fontSize="small" htmlColor={AZUL} />
                  <Typography variant="subtitle2" fontWeight={700} color={AZUL}>Validación</Typography>
                </Stack>

                {cartaPorteLista && (
                  <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{ mb: 1 }}>
                    Carta Porte lista para timbrar
                  </Alert>
                )}
                {validationResult?.ok && touchedSinceValidation && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Cambiaste datos después de validar. Vuelve a validar la Carta Porte.
                  </Alert>
                )}

                {validationResult && !validationResult.ok && (
                  <Stack spacing={1} sx={{ mb: 1 }}>
                    <Alert severity="error" sx={{ py: 0 }}>
                      La Carta Porte no puede timbrarse todavía. {validationResult.issues.length} punto(s) por resolver
                      {touchedSinceValidation ? ' (revisa; los datos cambiaron desde la última validación)' : ''}.
                    </Alert>
                    {[...issuesPorSeccion.entries()].map(([section, list]) => (
                      <Box key={section} sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 1.5, p: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="caption" fontWeight={700} color="error.main">
                            {SECCION_LABEL[section]} ({list.length})
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          {SECCION_ANCLA[section] && (
                            <Button size="small" sx={{ minWidth: 0, py: 0 }} onClick={() => irASeccion(section)}>Ir</Button>
                          )}
                        </Stack>
                        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                          {list.map((it, i) => (
                            <li key={i}>
                              <Typography variant="caption" color="text.primary">{it.message}</Typography>
                            </li>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}

                <Button
                  fullWidth variant="outlined" color="primary"
                  disabled={saving || validando}
                  onClick={() => void validar()}
                >
                  {validando ? 'Validando…' : 'Validar Carta Porte'}
                </Button>
              </Box>
            )}

            {!readOnly && (
              <Button variant="contained" onClick={() => void guardar()} disabled={saving || validando}>
                {saving ? 'Guardando…' : 'Guardar viaje'}
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );

  const estatusViaje = aggregate?.viaje?.estatus ?? '';
  const estatusCarta = aggregate?.cartaPorte?.estatus ?? '';
  const iconoModalSx = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });
  const iconoCerrarSx = {
    width: 34,
    height: 34,
    borderRadius: '10px',
    color: tokens.content.secondary,
    '&:hover': { bgcolor: tokens.content.hover },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={pantallaCompacta}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          bgcolor: tokens.content.elevated,
          backgroundImage: 'none',
          color: tokens.content.foreground,
          border: pantallaCompacta ? 'none' : `1px solid ${tokens.content.border}`,
          borderRadius: pantallaCompacta ? 0 : 2,
          height: pantallaCompacta ? '100%' : 'min(92vh, 960px)',
          maxHeight: pantallaCompacta ? '100%' : 'min(92vh, 960px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          m: pantallaCompacta ? 0 : 2,
        },
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.25, pb: 2, borderBottom: `1px solid ${tokens.content.border}`, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.content.foreground, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Viaje</Typography>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.content.foreground }}>{folio}</Typography>
            {estatusViaje && (
              <Chip size="small" label={estatusViaje} sx={{ bgcolor: tokens.action.wash, color: tokens.content.foreground, fontWeight: 600, textTransform: 'capitalize' }} />
            )}
            {estatusCarta && (
              <Chip size="small" variant="outlined" label={`Carta Porte · ${estatusCarta}`} sx={{ borderColor: tokens.content.border, color: tokens.content.secondary, textTransform: 'capitalize' }} />
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          {viajeId && !readOnly && !loading && (
            <>
              <Tooltip title={validando ? 'Validando…' : 'Validar Carta Porte'} arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label={validando ? 'Validando…' : 'Validar Carta Porte'}
                    disabled={saving || validando || !viajeId}
                    onClick={() => void validar()}
                    sx={iconoModalSx(saving || validando || !viajeId)}
                  >
                    {validando ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <FactCheckOutlinedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={saving ? 'Guardando…' : 'Guardar viaje'} arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label={saving ? 'Guardando…' : 'Guardar viaje'}
                    disabled={saving || validando || !viajeId}
                    onClick={() => void guardar()}
                    sx={iconoModalSx(saving || validando || !viajeId)}
                  >
                    {saving ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SaveOutlinedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title="Cerrar" arrow>
            <IconButton size="small" onClick={onClose} aria-label="Cerrar" sx={iconoCerrarSx}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {hayAvisoValidacion && (
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderBottom: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
          {avisosValidacion}
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 2 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={28} /></Stack>
        ) : error && !aggregate && !viajeId ? (
          <Alert severity="error">{error}</Alert>
        ) : !viajeId ? (
          <Stack spacing={1.5} sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">Este {tipoDocumento === 'traslado' ? 'traslado' : 'factura'} aún no tiene Viaje relacionado.</Typography>
            <Button variant="contained" size="small" onClick={() => void crearViaje()} sx={{ alignSelf: 'flex-start' }}>Crear viaje</Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {readOnly && <Alert severity="info" sx={{ py: 0 }}>Viaje en sólo lectura ({aggregate?.viaje?.estatus}).</Alert>}
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {aviso && <Alert severity="warning" onClose={() => setAviso(null)}>{aviso}</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, alignItems: 'start' }}>
              <Stack spacing={1.5} sx={{ minWidth: 0, alignSelf: 'start' }}>
                {secRuta}
                {secOperador}
              </Stack>
              <Stack spacing={1.5} sx={{ minWidth: 0, alignSelf: 'start' }}>
                {secUnidad}
                {secGenerales}
              </Stack>
              <Box sx={{ gridColumn: { md: '1 / -1' }, minWidth: 0 }}>
                {secMercancias}
              </Box>
            </Box>
          </Stack>
        )}
      </Box>
    </Dialog>
  );
}
