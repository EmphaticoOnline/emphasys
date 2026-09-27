import { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  IconButton,
} from '@mui/material';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  CLIENTE,
  CONCEPTOS_OTRO,
  PARTIDAS,
  disponibleDe,
  formatCantidad,
  formatFecha,
  formatMoney,
  formatMoneyInput,
  parseNumero,
  partidasIniciales,
  round2,
  seedCantidades,
  seedMontos,
  seedOtro,
  seedReferencia,
  type Escena,
  type Motivo,
  type PartidaMock,
} from './datos';

const NAVY = '#1d2f68';
const TASA_IVA = 0.16;

type Lectura = {
  valor: number;
  estado: 'vacio' | 'ok' | 'excede' | 'invalido';
};

type Resumen = {
  subtotal: number;
  iva: number;
  total: number;
  capturadas: number;
  problemas: number;
  folios: string[];
};

const headSx = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#8b93a7',
  bgcolor: '#f8fafc',
  borderBottom: '1px solid #e5eaf1',
  py: 0.7,
  px: 1.25,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
} as const;

const headCapturaSx = {
  ...headSx,
  textTransform: 'none',
  letterSpacing: 0,
  fontSize: 12,
  fontWeight: 800,
  color: NAVY,
  bgcolor: '#e7eef8',
} as const;

const cellSx = {
  fontSize: 13,
  color: '#334155',
  borderBottom: '1px solid #eef1f5',
  py: 0.3,
  px: 1.25,
  fontVariantNumeric: 'tabular-nums',
} as const;

const numHeadSx = {
  ...headSx,
  width: '1%',
  px: 0.75,
  letterSpacing: '0.04em',
} as const;

const numCellSx = {
  ...cellSx,
  width: '1%',
  px: 0.75,
  whiteSpace: 'nowrap',
} as const;

const idHeadSx = {
  ...headSx,
  width: '1%',
  px: 1,
  whiteSpace: 'nowrap',
} as const;

const idCellSx = {
  ...cellSx,
  width: '1%',
  px: 1,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'normal',
} as const;

const capturaHeadSx = {
  ...headCapturaSx,
  width: '1%',
  px: 0.75,
  whiteSpace: 'nowrap',
} as const;

function leerNumero(raw: string, maximo: number): Lectura {
  const compacto = raw.trim();
  if (!compacto) return { valor: 0, estado: 'vacio' };
  const parsed = parseNumero(compacto);
  if (parsed == null || parsed < 0) return { valor: 0, estado: 'invalido' };
  if (parsed === 0) return { valor: 0, estado: 'vacio' };
  if (parsed > maximo + 0.000001) return { valor: parsed, estado: 'excede' };
  return { valor: parsed, estado: 'ok' };
}

function fraseCaptura(folios: string[], capturadas: number): string {
  if (capturadas === 0) return 'Nada capturado todavía';
  const partidas = `${capturadas} ${capturadas === 1 ? 'partida' : 'partidas'}`;
  if (folios.length === 1) return `${partidas} en ${folios[0]}`;
  const previa = folios.slice(0, -1).join(', ');
  return `${partidas} en ${previa} y ${folios[folios.length - 1]}`;
}

function CapturaNumero({
  value,
  onChange,
  onBlur,
  activo,
  invalido,
  dinero,
  ariaLabel,
  width,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  activo: boolean;
  invalido: boolean;
  dinero?: boolean;
  ariaLabel: string;
  width: number;
}) {
  return (
    <TextField
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onFocus={(event) => event.target.select()}
      size="small"
      hiddenLabel
      placeholder={dinero ? '0.00' : '0'}
      autoComplete="off"
      inputProps={{ 'aria-label': ariaLabel, inputMode: 'decimal' }}
      {...(dinero
        ? {
            InputProps: {
              startAdornment: (
                <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: activo ? NAVY : '#94a3b8', pl: 0.75 }}>
                  $
                </Box>
              ),
            },
          }
        : {})}
      sx={{
        width,
        '& .MuiOutlinedInput-root': {
          height: 28,
          bgcolor: '#fff',
          borderRadius: '6px',
          '& fieldset': { borderColor: invalido ? '#d97706' : activo ? NAVY : '#d5dce6' },
          '&:hover fieldset': { borderColor: invalido ? '#d97706' : NAVY },
          '&.Mui-focused fieldset': { borderWidth: 1.5, borderColor: invalido ? '#d97706' : NAVY },
        },
        '& .MuiOutlinedInput-input': {
          py: 0,
          px: 1,
          textAlign: 'right',
          fontWeight: 700,
          fontSize: 13,
          color: invalido ? '#9a3412' : activo ? NAVY : '#64748b',
          fontVariantNumeric: 'tabular-nums',
          '&::placeholder': { color: '#c5cdd8', opacity: 1, fontWeight: 600 },
        },
      }}
    />
  );
}

function BotonTope({ valor, titulo, onClick }: { valor: string; titulo: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      sx={{
        border: 0,
        p: 0,
        m: 0,
        width: '100%',
        bgcolor: 'transparent',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        color: NAVY,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      {valor}
    </Box>
  );
}

function CeldaFactura({ folio, fecha }: { folio: string; fecha: string }) {
  const fechaCorta = formatFecha(fecha);
  return (
    <TableCell sx={idCellSx}>
      <Tooltip title={fechaCorta} placement="top" enterDelay={250}>
        <Box
          component="span"
          aria-label={`${folio}, ${fechaCorta}`}
          sx={{
            fontSize: 13,
            fontWeight: 700,
            color: NAVY,
            cursor: 'help',
            borderBottom: '1px dotted #94a3b8',
            lineHeight: 1.2,
          }}
        >
          {folio}
        </Box>
      </Tooltip>
    </TableCell>
  );
}

function CeldaClave({ clave }: { clave: string }) {
  return (
    <TableCell sx={idCellSx}>
      <Box component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.01em', color: '#1e293b' }}>
        {clave}
      </Box>
    </TableCell>
  );
}

function CeldaProducto({
  descripcion,
  activo,
  onQuitar,
}: {
  descripcion: string;
  activo: boolean;
  onQuitar?: () => void;
}) {
  return (
    <TableCell sx={{ ...cellSx, fontVariantNumeric: 'normal', width: '99%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 28 }}>
        <Typography
          title={descripcion}
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: activo ? 600 : 500,
            color: activo ? '#0f172a' : '#334155',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {descripcion}
        </Typography>
        {onQuitar && (
          <Tooltip title="Quitar de la nota de crédito" placement="top">
            <IconButton
              size="small"
              aria-label="Quitar de la nota de crédito"
              onClick={onQuitar}
              sx={{
                flexShrink: 0,
                width: 28,
                height: 28,
                color: '#dc2626',
                '&:hover': { color: '#b91c1c', bgcolor: 'rgba(220, 38, 38, 0.08)' },
              }}
            >
              <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </TableCell>
  );
}

function CeldaNumero({ children, color, peso }: { children: string; color?: string; peso?: number }) {
  return (
    <TableCell align="right" sx={{ ...numCellSx, color: color ?? '#334155', fontWeight: peso ?? 500 }}>
      {children}
    </TableCell>
  );
}

function fondoFila(index: number): string {
  return index % 2 === 0 ? '#fff' : '#f4f6f8';
}

export default function NotaCreditoCaptura({ escena }: { escena: Escena }) {
  const otroInicial = seedOtro(escena);
  const [motivo, setMotivo] = useState<Motivo>('devolucion');
  const [clienteId, setClienteId] = useState<string | null>(CLIENTE.id);
  const [fecha, setFecha] = useState('2026-09-25');
  const [referencia, setReferencia] = useState(seedReferencia(escena));
  const [cantidades, setCantidades] = useState(() => seedCantidades(escena));
  const [montos, setMontos] = useState(() => seedMontos(escena));
  const [incluidas, setIncluidas] = useState<string[]>(() => partidasIniciales(escena));
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [conceptoId, setConceptoId] = useState(otroInicial.conceptoId);
  const [importeOtro, setImporteOtro] = useState(otroInicial.importe);
  const [dirty, setDirty] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const clienteActivo = clienteId === CLIENTE.id;
  const desdeFactura = escena === 'desde-factura';
  const visibles = useMemo(
    () => PARTIDAS.filter((partida) => incluidas.includes(partida.id)),
    [incluidas],
  );
  const candidatas = useMemo(
    () => PARTIDAS.filter((partida) => !incluidas.includes(partida.id)),
    [incluidas],
  );

  const resumen = useMemo<Resumen>(() => {
    if (motivo === 'otro') {
      const lectura = leerNumero(importeOtro, Number.POSITIVE_INFINITY);
      const subtotal = lectura.estado === 'ok' ? round2(lectura.valor) : 0;
      const iva = round2(subtotal * TASA_IVA);
      return {
        subtotal,
        iva,
        total: round2(subtotal + iva),
        capturadas: lectura.estado === 'ok' ? 1 : 0,
        problemas: lectura.estado === 'invalido' ? 1 : 0,
        folios: [],
      };
    }

    let subtotal = 0;
    let capturadas = 0;
    let problemas = 0;
    const folios: string[] = [];

    for (const partida of visibles) {
      const lectura =
        motivo === 'devolucion'
          ? leerNumero(cantidades[partida.id] ?? '', disponibleDe(partida))
          : leerNumero(montos[partida.id] ?? '', partida.maximo);
      if (lectura.estado === 'excede' || lectura.estado === 'invalido') {
        problemas += 1;
        continue;
      }
      if (lectura.estado !== 'ok') continue;
      capturadas += 1;
      if (!folios.includes(partida.factura)) folios.push(partida.factura);
      subtotal += motivo === 'devolucion' ? round2(lectura.valor * partida.precio) : round2(lectura.valor);
    }

    subtotal = round2(subtotal);
    const iva = round2(subtotal * TASA_IVA);
    return { subtotal, iva, total: round2(subtotal + iva), capturadas, problemas, folios };
  }, [motivo, cantidades, montos, importeOtro, visibles]);

  function cambiarCantidad(id: string, value: string) {
    setCantidades((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
  }

  function cambiarMonto(id: string, value: string) {
    setMontos((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
  }

  function formatearCantidad(id: string) {
    setCantidades((prev) => {
      const parsed = parseNumero(prev[id] ?? '');
      if (parsed == null) return prev;
      return { ...prev, [id]: parsed === 0 ? '' : String(parsed) };
    });
  }

  function formatearMonto(id: string) {
    setMontos((prev) => {
      const parsed = parseNumero(prev[id] ?? '');
      if (parsed == null) return prev;
      return { ...prev, [id]: parsed === 0 ? '' : formatMoneyInput(parsed) };
    });
  }

  function usarDisponible(partida: PartidaMock) {
    cambiarCantidad(partida.id, String(disponibleDe(partida)));
  }

  function usarMaximo(partida: PartidaMock) {
    cambiarMonto(partida.id, formatMoneyInput(partida.maximo));
  }

  function abrirSelector() {
    setSeleccion([]);
    setSelectorAbierto(true);
  }

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function alternarTodas(marcar: boolean) {
    setSeleccion(marcar ? candidatas.map((partida) => partida.id) : []);
  }

  function agregarSeleccion() {
    if (seleccion.length === 0) return;
    setIncluidas((prev) => {
      const juntas = new Set([...prev, ...seleccion]);
      return PARTIDAS.filter((partida) => juntas.has(partida.id)).map((partida) => partida.id);
    });
    setDirty(true);
    setSeleccion([]);
    window.setTimeout(() => setSelectorAbierto(false), 0);
  }

  function quitarPartida(id: string) {
    setIncluidas((prev) => prev.filter((item) => item !== id));
    setDirty(true);
  }

  function onCancelar() {
    setAviso('Prototipo: Cancelar no cierra la pantalla.');
  }

  function onGuardar() {
    if (resumen.problemas > 0) {
      setAviso(
        motivo === 'devolucion'
          ? 'Hay cantidades por encima de lo disponible. El prototipo no guarda.'
          : 'Hay montos por encima del máximo. El prototipo no guarda.'
      );
      return;
    }
    if (motivo === 'otro' && !conceptoId) {
      setAviso('Falta el concepto. El prototipo no guarda.');
      return;
    }
    if (resumen.total <= 0) {
      setAviso('No hay importe capturado. El prototipo no guarda.');
      return;
    }
    setAviso(
      escena === 'editar'
        ? 'Prototipo: NC-004 seguiría en borrador. No se guardó nada.'
        : 'Prototipo: aquí se generaría la nota en borrador. No se guardó nada.'
    );
  }

  const titulo = escena === 'editar' ? 'NC-004' : 'Nueva nota de crédito';
  const accion = 'Guardar';
  const muestraPartidas = motivo !== 'otro' && clienteActivo;
  const otroBloqueado = escena === 'editar' && motivo === 'otro';
  const detalle =
    motivo === 'otro'
      ? 'Sin factura origen'
      : fraseCaptura(resumen.folios, resumen.capturadas);
  const detalleProblema =
    resumen.problemas > 0
      ? ` · ${resumen.problemas} ${resumen.problemas === 1 ? 'excede' : 'exceden'} ${
          motivo === 'devolucion' ? 'lo disponible' : 'el máximo'
        }`
      : '';

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: NAVY, letterSpacing: '-0.02em' }}>
          {titulo}
        </Typography>
        <Chip
          label="Borrador"
          size="small"
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            color: NAVY,
            bgcolor: '#e7eef8',
            border: '1px solid #d3deef',
          }}
        />
      </Stack>
      {escena === 'editar' && (
        <Typography sx={{ mt: 0.35, fontSize: 13, color: '#64748b' }}>Editar nota de crédito</Typography>
      )}

      {motivo !== 'otro' && (
      <Paper variant="outlined" sx={{ flexShrink: 0, mt: escena === 'editar' ? 1.5 : 2, p: { xs: 1.5, md: 2 }, borderRadius: 2, borderColor: '#d7dde7' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: '1fr 1fr',
              lg: 'minmax(280px, 1.7fr) 160px 200px minmax(180px, 1fr)',
            },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Autocomplete
            size="small"
            options={[CLIENTE]}
            value={clienteActivo ? CLIENTE : null}
            disabled={desdeFactura}
            getOptionLabel={(option) => option.nombre}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => {
              setClienteId(value?.id ?? null);
              setDirty(true);
            }}
            renderInput={(params) => <TextField {...(params as object)} label="Cliente" />}
            sx={{
              minWidth: 0,
              '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1e293b' },
            }}
          />
          <TextField
            label="Fecha"
            type="date"
            size="small"
            value={fecha}
            onChange={(event) => {
              setFecha(event.target.value);
              setDirty(true);
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Motivo"
            size="small"
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value as Motivo);
              setDirty(true);
            }}
          >
            <MenuItem value="devolucion">Devolución</MenuItem>
            <MenuItem value="bonificacion">Bonificación</MenuItem>
            <MenuItem value="otro">Otro</MenuItem>
          </TextField>
          <TextField
            label="Referencia"
            size="small"
            placeholder={motivo === 'otro' ? 'Observaciones, opcional' : 'Opcional'}
            value={referencia}
            onChange={(event) => {
              setReferencia(event.target.value);
              setDirty(true);
            }}
          />
        </Box>
      </Paper>
      )}

      {motivo === 'otro' && (
        <Paper
          variant="outlined"
          sx={{
            flexShrink: 0,
            mt: escena === 'editar' ? 1.5 : 2,
            p: { xs: 1.5, md: 2 },
            borderRadius: '8px 8px 0 0',
            borderColor: '#d7dde7',
            borderBottom: 'none',
            bgcolor: '#fff',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '1fr 1fr',
                lg: 'minmax(280px, 1.7fr) 160px 200px minmax(180px, 1fr)',
              },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <Autocomplete
              size="small"
              options={[CLIENTE]}
              value={clienteActivo ? CLIENTE : null}
              disabled={desdeFactura || otroBloqueado}
              getOptionLabel={(option) => option.nombre}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => {
                setClienteId(value?.id ?? null);
                setDirty(true);
              }}
              renderInput={(params) => <TextField {...(params as object)} label="Cliente" />}
              sx={{
                minWidth: 0,
                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1e293b' },
              }}
            />
            <TextField
              label="Fecha"
              type="date"
              size="small"
              value={fecha}
              onChange={(event) => {
                setFecha(event.target.value);
                setDirty(true);
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Motivo"
              size="small"
              value={motivo}
              disabled={otroBloqueado}
              onChange={(event) => {
                setMotivo(event.target.value as Motivo);
                setDirty(true);
              }}
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1e293b' } }}
            >
              <MenuItem value="devolucion">Devolución</MenuItem>
              <MenuItem value="bonificacion">Bonificación</MenuItem>
              <MenuItem value="otro">Otro</MenuItem>
            </TextField>
            <TextField
              label="Referencia"
              size="small"
              placeholder="Observaciones, opcional"
              value={referencia}
              onChange={(event) => {
                setReferencia(event.target.value);
                setDirty(true);
              }}
            />
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 200px' },
              gap: 1.5,
              alignItems: 'start',
              mt: 1.5,
            }}
          >
            <TextField
              select
              label="Concepto"
              size="small"
              value={conceptoId}
              disabled={!clienteActivo}
              onChange={(event) => {
                setConceptoId(event.target.value);
                setDirty(true);
              }}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
              sx={{
                minWidth: 0,
                '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis' },
                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1e293b' },
              }}
            >
              <MenuItem value="" disabled>
                Selecciona un concepto
              </MenuItem>
              {CONCEPTOS_OTRO.map((concepto) => (
                <MenuItem key={concepto.id} value={concepto.id}>
                  {concepto.descripcion}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Importe"
              size="small"
              value={importeOtro}
              disabled={!clienteActivo}
              onChange={(event) => {
                setImporteOtro(event.target.value);
                setDirty(true);
              }}
              onBlur={() => {
                const parsed = parseNumero(importeOtro);
                if (parsed == null) return;
                setImporteOtro(parsed === 0 ? '' : formatMoneyInput(parsed));
              }}
              onFocus={(event) => event.target.select()}
              placeholder="0.00"
              error={leerNumero(importeOtro, Number.POSITIVE_INFINITY).estado === 'invalido'}
              autoComplete="off"
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{
                inputMode: 'decimal',
                'aria-label': 'Importe de la nota de crédito',
                style: { textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
              }}
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1e293b' } }}
            />
          </Box>
        </Paper>
      )}

      {desdeFactura && motivo !== 'otro' && (
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 1.5, flexShrink: 0 }}>
          <Chip
            label="Desde factura A-007"
            size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: NAVY }}
          />
          <Typography sx={{ fontSize: 13, color: '#475569' }}>
            12 ago 2026 · puedes sumar partidas de otras facturas del cliente
          </Typography>
        </Stack>
      )}

      <Box sx={motivo === 'otro'
        ? { flexShrink: 0 }
        : { mt: 2.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {motivo !== 'otro' && (
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0, mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap flexWrap="wrap">
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: NAVY }}>
            {motivo === 'devolucion' && 'Partidas a devolver'}
            {motivo === 'bonificacion' && 'Partidas a bonificar'}
          </Typography>
          {muestraPartidas && candidatas.length > 0 && (
            <Tooltip title="Agregar partidas de otras facturas" placement="top">
              <IconButton
                size="small"
                aria-label="Agregar partidas de otras facturas"
                onClick={abrirSelector}
                sx={{
                  width: 32,
                  height: 32,
                  color: NAVY,
                  '&:hover': { bgcolor: 'rgba(29, 47, 104, 0.08)' },
                }}
              >
                <PostAddOutlinedIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {muestraPartidas && (
          <Typography sx={{ fontSize: 13, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            {resumen.capturadas} de {visibles.length}
          </Typography>
        )}
      </Stack>
      )}

      {motivo !== 'otro' && !clienteActivo && (
        <Paper
          variant="outlined"
          sx={{
            borderStyle: 'dashed',
            borderColor: '#d7dde7',
            borderRadius: 2,
            py: 7,
            px: 3,
            textAlign: 'center',
            bgcolor: '#fff',
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Selecciona un cliente</Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: '#64748b' }}>
            Después podrás elegir partidas de todas sus facturas compatibles.
          </Typography>
        </Paper>
      )}

      {motivo === 'devolucion' && clienteActivo && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderColor: '#d7dde7',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: '0 1 auto',
            minHeight: 0,
            borderBottom: 'none',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          <Box sx={{ overflow: 'auto', minHeight: 0, flex: '1 1 auto' }}>
            <Table stickyHeader size="small" sx={{ width: '100%', minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={idHeadSx}>Factura</TableCell>
                  <TableCell sx={idHeadSx}>Clave</TableCell>
                  <TableCell sx={{ ...headSx, width: '99%' }}>Descripción</TableCell>
                  <TableCell align="right" sx={numHeadSx}>Facturado</TableCell>
                  <TableCell align="right" sx={numHeadSx}>Devuelto</TableCell>
                  <TableCell align="right" title="Clic en el número para capturar todo lo disponible" sx={numHeadSx}>
                    Disponible
                  </TableCell>
                  <TableCell align="right" sx={capturaHeadSx}>
                    A devolver
                  </TableCell>
                  <TableCell align="right" sx={numHeadSx}>Precio</TableCell>
                  <TableCell align="right" sx={numHeadSx}>Importe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ ...cellSx, py: 3, color: '#64748b', textAlign: 'center' }}>
                      Esta nota no tiene partidas. Puedes agregarlas desde otras facturas del cliente.
                    </TableCell>
                  </TableRow>
                )}
                {visibles.map((partida, index) => {
                  const disponible = disponibleDe(partida);
                  const lectura = leerNumero(cantidades[partida.id] ?? '', disponible);
                  const activo = lectura.estado === 'ok';
                  const invalido = lectura.estado === 'excede' || lectura.estado === 'invalido';
                  const importe = activo ? round2(lectura.valor * partida.precio) : 0;
                  return (
                    <TableRow key={partida.id} sx={{ bgcolor: fondoFila(index) }}>
                      <CeldaFactura folio={partida.factura} fecha={partida.fecha} />
                      <CeldaClave clave={partida.clave} />
                      <CeldaProducto
                        descripcion={partida.descripcion}
                        activo={activo}
                        {...(escena === 'editar' ? { onQuitar: () => quitarPartida(partida.id) } : {})}
                      />
                      <CeldaNumero>{formatCantidad(partida.facturado)}</CeldaNumero>
                      <CeldaNumero color={partida.devuelto > 0 ? '#9a3412' : '#94a3b8'} peso={partida.devuelto > 0 ? 700 : 500}>
                        {formatCantidad(partida.devuelto)}
                      </CeldaNumero>
                      <TableCell align="right" sx={numCellSx}>
                        <BotonTope
                          valor={formatCantidad(disponible)}
                          titulo={`Devolver ${formatCantidad(disponible)} disponibles`}
                          onClick={() => usarDisponible(partida)}
                        />
                      </TableCell>
                      <TableCell align="right" sx={numCellSx}>
                        <CapturaNumero
                          value={cantidades[partida.id] ?? ''}
                          onChange={(value) => cambiarCantidad(partida.id, value)}
                          onBlur={() => formatearCantidad(partida.id)}
                          activo={activo}
                          invalido={invalido}
                          ariaLabel={`A devolver de ${partida.descripcion}`}
                          width={72}
                        />
                      </TableCell>
                      <CeldaNumero color="#475569">{formatMoney(partida.precio)}</CeldaNumero>
                      <TableCell align="right" sx={numCellSx}>
                        {activo ? (
                          <Box component="span" sx={{ fontWeight: 700, color: NAVY }}>
                            {formatMoney(importe)}
                          </Box>
                        ) : (
                          <Box component="span" sx={{ fontWeight: 700, color: invalido ? '#c2410c' : '#cbd5e1' }}>
                            {invalido ? 'Excede' : '—'}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {motivo === 'bonificacion' && clienteActivo && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderColor: '#d7dde7',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: '0 1 auto',
            minHeight: 0,
            borderBottom: 'none',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          <Box sx={{ overflow: 'auto', minHeight: 0, flex: '1 1 auto' }}>
            <Table stickyHeader size="small" sx={{ width: '100%', minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={idHeadSx}>Factura</TableCell>
                  <TableCell sx={idHeadSx}>Clave</TableCell>
                  <TableCell sx={{ ...headSx, width: '99%' }}>Descripción</TableCell>
                  <TableCell align="right" sx={numHeadSx}>Base</TableCell>
                  <TableCell align="right" title="Clic en el monto para capturar el máximo" sx={numHeadSx}>
                    Máximo
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ ...capturaHeadSx, whiteSpace: 'normal', lineHeight: 1.15, width: 118 }}
                  >
                    Monto a bonificar
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ ...cellSx, py: 3, color: '#64748b', textAlign: 'center' }}>
                      Esta nota no tiene partidas. Puedes agregarlas desde otras facturas del cliente.
                    </TableCell>
                  </TableRow>
                )}
                {visibles.map((partida, index) => {
                  const lectura = leerNumero(montos[partida.id] ?? '', partida.maximo);
                  const activo = lectura.estado === 'ok';
                  const invalido = lectura.estado === 'excede' || lectura.estado === 'invalido';
                  return (
                    <TableRow key={partida.id} sx={{ bgcolor: fondoFila(index) }}>
                      <CeldaFactura folio={partida.factura} fecha={partida.fecha} />
                      <CeldaClave clave={partida.clave} />
                      <CeldaProducto
                        descripcion={partida.descripcion}
                        activo={activo}
                        {...(escena === 'editar' ? { onQuitar: () => quitarPartida(partida.id) } : {})}
                      />
                      <CeldaNumero color="#475569">{formatMoney(partida.base)}</CeldaNumero>
                      <TableCell align="right" sx={numCellSx}>
                        <BotonTope
                          valor={formatMoney(partida.maximo)}
                          titulo={`Bonificar el máximo ${formatMoney(partida.maximo)}`}
                          onClick={() => usarMaximo(partida)}
                        />
                      </TableCell>
                      <TableCell align="right" sx={numCellSx}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <CapturaNumero
                            value={montos[partida.id] ?? ''}
                            onChange={(value) => cambiarMonto(partida.id, value)}
                            onBlur={() => formatearMonto(partida.id)}
                            activo={activo}
                            invalido={invalido}
                            dinero
                            ariaLabel={`Monto a bonificar de ${partida.descripcion}`}
                            width={108}
                          />
                          {invalido && (
                            <Typography sx={{ mt: 0.35, fontSize: 11, fontWeight: 700, color: '#c2410c' }}>
                              Excede
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      <Paper
        elevation={0}
        sx={muestraPartidas || motivo === 'otro' ? {
          flexShrink: 0,
          px: { xs: 1.5, md: 2 },
          py: 1,
          borderRadius: '0 0 8px 8px',
          border: '1px solid #d7dde7',
          borderTop: '1px solid #e5eaf1',
          bgcolor: '#fff',
          boxShadow: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
        } : {
          mt: 2,
          px: { xs: 1.5, md: 2 },
          py: 1.25,
          borderRadius: 2,
          border: '1px solid #d7dde7',
          bgcolor: '#fff',
          boxShadow: '0 10px 28px rgba(29, 47, 104, 0.1)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography
          sx={{
            flex: '1 1 220px',
            fontSize: 13,
            fontWeight: 600,
            color: resumen.problemas > 0 ? '#9a3412' : '#475569',
            minWidth: 180,
          }}
        >
          {detalle}
          {detalleProblema}
        </Typography>

        <Stack direction="row" spacing={2.5} alignItems="flex-end" useFlexGap flexWrap="wrap">
          <TotalDato label="Subtotal" value={formatMoney(resumen.subtotal)} />
          <TotalDato label="IVA 16%" value={formatMoney(resumen.iva)} />
          <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: '#e5eaf1' }} />
          <TotalDato label="Total" value={formatMoney(resumen.total)} emphasis />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {escena === 'editar' && dirty && (
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#b45309', pr: 0.5 }}>Sin guardar</Typography>
          )}
          <Button
            variant="outlined"
            onClick={onCancelar}
            sx={{
              height: 40,
              px: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#334155',
              borderColor: '#cbd5e1',
              '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={onGuardar}
            sx={{
              height: 40,
              px: 2.25,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: NAVY,
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#162551' },
            }}
          >
            {accion}
          </Button>
        </Stack>
      </Paper>
      </Box>

      <Dialog
        open={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 3, pb: 1 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>
            Agregar partidas de otras facturas
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 13, fontWeight: 500, color: '#64748b' }}>
            {CLIENTE.nombre}. Las que elijas se suman a esta captura.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 0, py: 0 }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ ...headSx, width: 42, px: 1 }}>
                  <Checkbox
                    size="small"
                    checked={candidatas.length > 0 && seleccion.length === candidatas.length}
                    indeterminate={seleccion.length > 0 && seleccion.length < candidatas.length}
                    onChange={(_, checked) => alternarTodas(checked)}
                    inputProps={{ 'aria-label': 'Seleccionar todas las partidas' }}
                    sx={{ color: '#94a3b8', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: NAVY } }}
                  />
                </TableCell>
                <TableCell sx={idHeadSx}>Factura</TableCell>
                <TableCell sx={idHeadSx}>Fecha</TableCell>
                <TableCell sx={idHeadSx}>Clave</TableCell>
                <TableCell sx={{ ...headSx, width: '99%' }}>Descripción</TableCell>
                <TableCell align="right" sx={numHeadSx}>Disponible</TableCell>
                {motivo === 'bonificacion' && (
                  <TableCell align="right" sx={numHeadSx}>Máximo</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {candidatas.map((partida) => {
                const marcada = seleccion.includes(partida.id);
                return (
                  <TableRow
                    key={partida.id}
                    hover
                    onClick={() => alternarSeleccion(partida.id)}
                    sx={{ cursor: 'pointer', bgcolor: marcada ? '#f4f7fc' : '#fff' }}
                  >
                    <TableCell padding="checkbox" sx={{ ...cellSx, width: 42, px: 1 }}>
                      <Checkbox
                        size="small"
                        checked={marcada}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => alternarSeleccion(partida.id)}
                        inputProps={{ 'aria-label': `Agregar ${partida.clave} de ${partida.factura}` }}
                        sx={{ color: '#94a3b8', '&.Mui-checked': { color: NAVY } }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...idCellSx, fontWeight: 700, color: NAVY }}>{partida.factura}</TableCell>
                    <TableCell sx={idCellSx}>{formatFecha(partida.fecha)}</TableCell>
                    <TableCell sx={{ ...idCellSx, fontWeight: 600, color: '#1e293b' }}>{partida.clave}</TableCell>
                    <TableCell sx={{ ...cellSx, fontVariantNumeric: 'normal' }}>{partida.descripcion}</TableCell>
                    <TableCell align="right" sx={{ ...numCellSx, fontWeight: 700, color: NAVY }}>
                      {formatCantidad(disponibleDe(partida))}
                    </TableCell>
                    {motivo === 'bonificacion' && (
                      <TableCell align="right" sx={{ ...numCellSx, fontWeight: 700, color: NAVY }}>
                        {formatMoney(partida.maximo)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setSelectorAbierto(false)}
            sx={{
              height: 36,
              px: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#334155',
              borderColor: '#cbd5e1',
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={seleccion.length === 0}
            onClick={agregarSeleccion}
            sx={{
              height: 36,
              px: 2,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: NAVY,
              '&:hover': { bgcolor: '#162551' },
            }}
          >
            {seleccion.length === 0
              ? 'Agregar'
              : `Agregar ${seleccion.length} ${seleccion.length === 1 ? 'partida' : 'partidas'}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(aviso)}
        autoHideDuration={3200}
        onClose={() => setAviso(null)}
        message={aviso ?? ''}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
}

function TotalDato({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Box sx={{ textAlign: 'right', minWidth: emphasis ? 112 : 84 }}>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: emphasis ? NAVY : '#8b93a7',
          lineHeight: 1,
          mb: 0.45,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: emphasis ? 22 : 14,
          fontWeight: emphasis ? 800 : 600,
          color: emphasis ? NAVY : '#334155',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: emphasis ? '-0.02em' : 0,
          lineHeight: 1.05,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
