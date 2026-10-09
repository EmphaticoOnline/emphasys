import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Popover,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import GroupIcon from '@mui/icons-material/Group';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useNavigate } from 'react-router-dom';

import type { MovimientoDetalle, MovimientoEncabezado, MovimientoListadoItem, MovimientoPartidaDetalle } from '../types/inventario';
import { exportarMovimientos, listarMovimientos, obtenerMovimientoDetalle } from '../services/inventarioService';
import { fetchParametrosSistema } from '../services/parametrosService';
import { getDocumentoTypeConfig } from '../modules/documentos/documentoTypeConfig';
import type { TipoDocumento } from '../types/documentos.types';
import { formatearFolioDocumento } from '../utils/documentos.utils';

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
] as const;

const EXPORT_COLUMNS = [
  { field: 'fecha', headerName: 'Fecha' },
  { field: 'tipo_movimiento', headerName: 'Tipo' },
  { field: 'observaciones', headerName: 'Observaciones' },
  { field: 'usuario_nombre', headerName: 'Usuario' },
  { field: 'documento_id', headerName: 'Documento' },
];

function fechaCivil(value: string | null | undefined): string {
  return String(value ?? '').slice(0, 10);
}

function formatoFecha(value: string | null | undefined): string {
  const civil = fechaCivil(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civil)) return civil || '—';
  const [year, month, day] = civil.split('-');
  return `${day}/${month}/${year}`;
}

const TIPOS_VENTAS = new Set([
  'cotizacion',
  'factura',
  'nota_credito',
  'orden_servicio',
  'pedido',
  'remision',
  'orden_entrega',
  'traslado',
  'pago_cliente',
  'ajuste_cliente',
]);

const TIPOS_COMPRAS = new Set([
  'requisicion',
  'orden_compra',
  'recepcion',
  'factura_compra',
  'nota_credito_compra',
  'pago_proveedor',
  'ajuste_proveedor',
]);

type OrigenModulo = 'ventas' | 'compras' | 'inventarios';

const ORIGEN_VISUAL: Record<OrigenModulo, { tooltip: string; Icon: typeof GroupIcon }> = {
  ventas: { tooltip: 'Origen: Ventas', Icon: GroupIcon },
  compras: { tooltip: 'Origen: Compras', Icon: ShoppingCartIcon },
  inventarios: { tooltip: 'Origen: Inventarios', Icon: Inventory2Icon },
};

function origenModulo(movimiento: Pick<MovimientoEncabezado, 'documento_id' | 'documento_tipo'>): OrigenModulo | null {
  if (movimiento.documento_id == null) return 'inventarios';
  const tipo = String(movimiento.documento_tipo ?? '').trim().toLowerCase();
  if (TIPOS_COMPRAS.has(tipo)) return 'compras';
  if (TIPOS_VENTAS.has(tipo)) return 'ventas';
  const modulo = tipo ? getDocumentoTypeConfig(tipo as TipoDocumento)?.modulo : undefined;
  if (modulo === 'compras') return 'compras';
  if (modulo === 'ventas') return 'ventas';
  return null;
}

function lineaTarjeta(contacto: string | null | undefined, observaciones: string | null | undefined): string {
  const nombre = contacto?.trim() || '';
  const motivo = observaciones?.trim() || '';
  if (nombre && motivo) return `${nombre} · ${motivo}`;
  return nombre || motivo || 'Sin motivo';
}

function etiquetaTipo(tipo: string | null | undefined): string {
  const texto = String(tipo ?? '').trim();
  if (!texto) return 'Sin tipo';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const ESTATUS_DOCUMENTO: Record<string, string> = {
  borrador: 'Borrador',
  emitido: 'Emitido',
  enviado: 'Emitido',
  cancelado: 'Cancelado',
  cancelada: 'Cancelado',
  cerrado: 'Cerrado',
  timbrado: 'Timbrado',
  pagado: 'Pagado',
};

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function folioDocumento(movimiento: {
  documento_id: number | null;
  documento_serie?: string | null;
  documento_numero?: number | null;
}): string | null {
  if (movimiento.documento_id == null) return null;
  return formatearFolioDocumento(movimiento.documento_serie ?? '', movimiento.documento_numero ?? 0)
    || String(movimiento.documento_id);
}

function etiquetaDocumento(tipo: string | null | undefined): string | null {
  const codigo = String(tipo ?? '').trim();
  if (!codigo) return null;
  return getDocumentoTypeConfig(codigo as TipoDocumento)?.label ?? null;
}

function etiquetaEstatus(tipo: string | null | undefined, estatus: string | null | undefined): string | null {
  const normalizado = String(estatus ?? '').trim().toLowerCase();
  if (!normalizado) return null;
  if (String(tipo ?? '').trim().toLowerCase() === 'factura_compra' && (normalizado === 'emitido' || normalizado === 'enviado')) {
    return 'Confirmada';
  }
  return ESTATUS_DOCUMENTO[normalizado] ?? null;
}

function contextoDocumento(movimiento: MovimientoEncabezado): string | null {
  const partes = [
    etiquetaDocumento(movimiento.documento_tipo),
    etiquetaEstatus(movimiento.documento_tipo, movimiento.documento_estatus),
    movimiento.documento_fecha ? formatoFecha(movimiento.documento_fecha) : null,
  ].filter((parte): parte is string => Boolean(parte));
  return partes.length > 0 ? partes.join(' · ') : null;
}

function numeroRecibido(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const numero = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numero) ? numero : null;
}

function textoBusqueda(movimiento: MovimientoListadoItem): string {
  const folio = folioDocumento(movimiento);
  return [
    movimiento.id,
    movimiento.tipo_movimiento,
    movimiento.observaciones,
    movimiento.usuario_nombre,
    movimiento.usuario_id,
    movimiento.contacto_nombre,
    movimiento.documento_id,
    movimiento.documento_tipo,
    folio,
    movimiento.documento_serie,
    movimiento.documento_numero,
  ].filter((parte) => parte != null && String(parte).trim() !== '').join(' ').toLowerCase();
}

function nombreAlmacen(nombre: string | null | undefined, id: number | null | undefined): string | null {
  const limpio = String(nombre ?? '').trim();
  if (limpio) return limpio;
  if (id != null) return String(id);
  return null;
}

function celdaAlmacen(partida: MovimientoPartidaDetalle): string {
  const origen = nombreAlmacen(partida.almacen_origen_nombre, partida.almacen_origen_id);
  const destino = nombreAlmacen(partida.almacen_destino_nombre, partida.almacen_destino_id);
  if (origen && destino) return `${origen} → ${destino}`;
  return origen ?? destino ?? '—';
}

export default function InventarioMovimientosPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));

  const [movimientos, setMovimientos] = useState<MovimientoListadoItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [cargaLista, setCargaLista] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [detalle, setDetalle] = useState<MovimientoDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);

  const [texto, setTexto] = useState('');
  const [anio, setAnio] = useState('');
  const [mes, setMes] = useState('');
  const [soloAjustes, setSoloAjustes] = useState(false);
  const [anclaFiltro, setAnclaFiltro] = useState<HTMLElement | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  );
  const [exportLoading, setExportLoading] = useState(false);
  const [decimalesCantidades, setDecimalesCantidades] = useState(2);

  useEffect(() => {
    void fetchParametrosSistema().then((modulos) => {
      const param = modulos.flatMap((m) => m.parametros).find((p) => p.clave === 'decimales_cantidades');
      const valor = parseInt(param?.valor_resuelto ?? '', 10);
      if (!isNaN(valor)) setDecimalesCantidades(valor);
    });
  }, []);

  const formatCantidad = (cantidad: number) => {
    const formatted = new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: decimalesCantidades,
      maximumFractionDigits: decimalesCantidades,
    }).format(Math.abs(cantidad));
    if (cantidad > 0) return `+${formatted}`;
    if (cantidad < 0) return `-${formatted}`;
    return formatted;
  };

  const anios = useMemo(() => {
    const encontrados = new Set<string>();
    movimientos.forEach((movimiento) => {
      const civil = fechaCivil(movimiento.fecha);
      if (/^\d{4}-\d{2}-\d{2}$/.test(civil)) encontrados.add(civil.slice(0, 4));
    });
    return Array.from(encontrados).sort((a, b) => b.localeCompare(a));
  }, [movimientos]);

  const filtrados = useMemo(() => {
    const consulta = texto.trim().toLowerCase();
    return movimientos.filter((movimiento) => {
      const civil = fechaCivil(movimiento.fecha);
      if (anio && !civil.startsWith(anio)) return false;
      if (mes && civil.slice(5, 7) !== mes) return false;
      if (soloAjustes && String(movimiento.tipo_movimiento ?? '').trim().toLowerCase() !== 'ajuste') return false;
      if (consulta && !textoBusqueda(movimiento).includes(consulta)) return false;
      return true;
    });
  }, [movimientos, texto, anio, mes, soloAjustes]);

  const criteriosFiltro = (anio ? 1 : 0) + (mes ? 1 : 0) + (soloAjustes ? 1 : 0);

  const cargarMovimientos = async () => {
    try {
      setListLoading(true);
      const data = await listarMovimientos();
      setMovimientos(data);
      setListError(null);
      setCargaLista((actual) => actual + 1);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void cargarMovimientos();
  }, []);

  useEffect(() => {
    if (listLoading && movimientos.length === 0) return;
    const primero = filtrados[0];
    if (!primero) {
      setSelectedId(null);
      return;
    }
    setSelectedId((actual) => (filtrados.some((movimiento) => movimiento.id === actual) ? actual : primero.id));
  }, [filtrados, listLoading, movimientos.length]);

  useEffect(() => {
    if (selectedId == null) {
      setDetalle(null);
      setDetalleError(null);
      setDetalleLoading(false);
      return;
    }

    let cancelado = false;
    setDetalle(null);
    setDetalleLoading(true);
    setDetalleError(null);

    obtenerMovimientoDetalle(selectedId)
      .then((data) => {
        if (!cancelado) setDetalle(data);
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setDetalle(null);
          setDetalleError(err instanceof Error ? err.message : 'No se pudo cargar el detalle');
        }
      })
      .finally(() => {
        if (!cancelado) setDetalleLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [selectedId, cargaLista]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await exportarMovimientos({ columns: EXPORT_COLUMNS });
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'No se pudo exportar', severity: 'error' });
    } finally {
      setExportLoading(false);
    }
  };

  const seleccionado = filtrados.find((movimiento) => movimiento.id === selectedId) ?? null;
  const encabezado = detalle?.movimiento.id === selectedId ? detalle.movimiento : seleccionado;
  const partidas = detalle?.movimiento.id === selectedId ? detalle.partidas : [];
  const verLista = !compacto || !detalleMovil;

  const elegir = (id: number) => {
    setSelectedId(id);
    if (compacto) setDetalleMovil(true);
  };

  const iconoRailSx = {
    width: 34,
    height: 34,
    color: tokens.navigation.foreground,
    border: `1px solid ${tokens.navigation.border}`,
    '&:hover': { bgcolor: tokens.navigation.hover },
    '&.Mui-disabled': { color: tokens.navigation.muted },
  };

  const campoFiltroSx = {
    '& .MuiInputLabel-root': { color: tokens.content.muted },
    '& .MuiInputLabel-root.Mui-focused': { color: tokens.content.foreground },
    '& .MuiOutlinedInput-root': {
      color: tokens.content.foreground,
      bgcolor: tokens.content.elevated,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.foreground },
      '&.Mui-focused fieldset': { borderColor: tokens.content.foreground },
    },
  };

  const formatExistencia = (cantidad: number) =>
    new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: decimalesCantidades,
      maximumFractionDigits: decimalesCantidades,
    }).format(cantidad);

  const importeSx = (valor: number | null, salida = false) => ({
    fontWeight: valor != null && valor !== 0 ? 700 : 500,
    fontVariantNumeric: 'tabular-nums' as const,
    whiteSpace: 'nowrap' as const,
    ...(salida ? { '&&': { color: tokens.action.destructive } } : {}),
  });

  const tonoTipo = (tipo: string) => {
    const normalizado = tipo.trim().toLowerCase();
    if (normalizado === 'entrada' || normalizado === 'compra') return tokens.metric.applied;
    if (normalizado === 'salida' || normalizado === 'venta') return tokens.metric.blocked;
    return { background: tokens.content.elevated, foreground: tokens.content.foreground };
  };

  return (
    <Box sx={{ flex: 1, minHeight: compacto ? 'calc(100dvh - 112px)' : 0, height: compacto ? undefined : '100%', display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <Box sx={{
        width: compacto ? '100%' : 372,
        flexShrink: 0,
        display: verLista ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: tokens.workspaceRail.background,
        color: tokens.navigation.foreground,
        borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
      }}>
        <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
                MOVIMIENTOS
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }} noWrap>
                {listLoading && movimientos.length === 0
                  ? 'Cargando…'
                  : filtrados.length === movimientos.length
                    ? `${filtrados.length} en vista`
                    : `${filtrados.length} de ${movimientos.length}`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Tooltip title="Recargar">
                <span>
                  <IconButton size="small" aria-label="Recargar" onClick={() => void cargarMovimientos()} disabled={listLoading} sx={iconoRailSx}>
                    {listLoading ? <CircularProgress size={16} sx={{ color: tokens.navigation.foreground }} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Exportar">
                <span>
                  <IconButton size="small" aria-label="Exportar" onClick={() => void handleExport()} disabled={exportLoading} sx={iconoRailSx}>
                    {exportLoading ? <CircularProgress size={16} sx={{ color: tokens.navigation.foreground }} /> : <DownloadIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Nuevo movimiento">
                <IconButton
                  size="small"
                  aria-label="Nuevo movimiento"
                  onClick={() => navigate('/inventario/movimientos/nuevo')}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: tokens.navigation.control,
                    color: tokens.navigation.controlForeground,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                    '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground },
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.35 }}>
            <TextField
              size="small"
              placeholder="Buscar folio, usuario, motivo…"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
                  </InputAdornment>
                ),
                endAdornment: texto ? (
                  <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setTexto('')} sx={{ color: tokens.navigation.muted }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null,
              }}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: tokens.navigation.foreground,
                  bgcolor: tokens.navigation.summary,
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                },
                '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.9 },
                '& .MuiOutlinedInput-input::placeholder': { color: tokens.navigation.muted, opacity: 1 },
              }}
            />
            <Tooltip title="Filtros">
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <IconButton size="small" aria-label="Filtros" onClick={(event) => setAnclaFiltro(event.currentTarget)} sx={{ color: tokens.navigation.foreground }}>
                  <FilterAltOutlinedIcon fontSize="small" />
                </IconButton>
                {criteriosFiltro > 0 && (
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    minWidth: 16,
                    height: 16,
                    px: 0.4,
                    borderRadius: 99,
                    bgcolor: tokens.navigation.accent,
                    color: tokens.frame.background,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    {criteriosFiltro}
                  </Box>
                )}
              </Box>
            </Tooltip>
          </Stack>
        </Box>

        <Popover
          open={Boolean(anclaFiltro)}
          anchorEl={anclaFiltro}
          onClose={() => setAnclaFiltro(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                p: 1.5,
                width: 280,
                borderRadius: 2,
                bgcolor: tokens.content.card,
                color: tokens.content.foreground,
                border: `1px solid ${tokens.content.border}`,
                boxShadow: '0 16px 40px rgba(44, 49, 56, 0.18)',
              },
            },
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: tokens.content.muted }}>FILTROS</Typography>
          <Box sx={{ display: 'grid', gap: 1.1, mt: 1.2 }}>
            <TextField
              select
              size="small"
              label="Año"
              value={anio}
              onChange={(event) => setAnio(event.target.value)}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              sx={campoFiltroSx}
            >
              <option value="">Todos</option>
              {anios.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Mes"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              sx={campoFiltroSx}
            >
              <option value="">Todos</option>
              {MESES.map((valor) => <option key={valor.value} value={valor.value}>{valor.label}</option>)}
            </TextField>
            <Box
              component="label"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.4, cursor: 'pointer', color: tokens.content.foreground }}
            >
              <Checkbox
                size="small"
                checked={soloAjustes}
                onChange={(event) => setSoloAjustes(event.target.checked)}
                sx={{ p: 0.4, color: tokens.content.muted, '&.Mui-checked': { color: tokens.content.foreground } }}
              />
              <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Solo ajustes</Typography>
            </Box>
          </Box>
        </Popover>

        {listError && <Alert severity="error" sx={{ mx: 1.5, mb: 1 }}>{listError}</Alert>}

        <Box sx={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          px: 1,
          pb: 1.2,
          scrollbarWidth: 'thin',
          scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`,
        }}>
          {listLoading && movimientos.length === 0 ? (
            <Stack alignItems="center" py={4}><CircularProgress size={24} sx={{ color: tokens.navigation.foreground }} /></Stack>
          ) : filtrados.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted, textAlign: 'center' }}>
              {texto || criteriosFiltro > 0 ? 'Ningún movimiento coincide con la búsqueda.' : 'No hay movimientos registrados aún.'}
            </Typography>
          ) : filtrados.map((movimiento, indice) => {
            const selected = movimiento.id === selectedId;
            const folio = folioDocumento(movimiento);
            const origen = origenModulo(movimiento);
            const OrigenIcon = origen ? ORIGEN_VISUAL[origen].Icon : null;
            return (
              <Box key={movimiento.id}>
                <Box
                  onClick={() => elegir(movimiento.id)}
                  sx={{
                    minWidth: 0,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    px: 1.15,
                    py: 1.05,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: selected ? tokens.navigation.selection : 'transparent',
                    color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                    boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                    '&:hover': { bgcolor: selected ? tokens.navigation.selection : tokens.navigation.hover },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, minWidth: 0 }}>
                      {origen && OrigenIcon ? (
                        <Tooltip title={ORIGEN_VISUAL[origen].tooltip}>
                          <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0, color: 'inherit', lineHeight: 0 }}>
                            <OrigenIcon sx={{ fontSize: 17 }} aria-label={ORIGEN_VISUAL[origen].tooltip} />
                          </Box>
                        </Tooltip>
                      ) : null}
                      <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.1, minWidth: 0 }}>
                        #{movimiento.id}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, flexShrink: 0, color: selected ? tokens.navigation.selectionForeground : tokens.navigation.muted }}>
                      {formatoFecha(movimiento.fecha)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, mt: 0.35, color: 'inherit', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {etiquetaTipo(movimiento.tipo_movimiento)}
                  </Typography>
                  <Typography variant="figure" sx={{
                    fontSize: 14,
                    mt: 0.25,
                    color: tokens.navigation.foreground,
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    maxWidth: '100%',
                  }}>
                    {lineaTarjeta(movimiento.contacto_nombre, movimiento.observaciones)}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mt: 0.45, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, color: tokens.navigation.subtle, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {movimiento.usuario_nombre?.trim() || 'Sin usuario'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.navigation.muted, textAlign: 'right', flexShrink: 0, maxWidth: '46%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folio ?? 'Sin documento'}
                    </Typography>
                  </Box>
                </Box>
                {indice < filtrados.length - 1 && (
                  <Box aria-hidden sx={{ mx: 1.15, borderTop: `1px solid ${tokens.navigation.track}` }} />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && verLista ? 'none' : 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
        {encabezado ? (
          <>
            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 1.25, flexShrink: 0 }}>
              {compacto && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setDetalleMovil(false)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', mb: 0.5, p: 0 }}
                >
                  <ArrowBackIcon fontSize="small" /> Movimientos
                </Box>
              )}
              <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
                TRANSACCIÓN SELECCIONADA
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.35 }}>
                <Typography variant="figure" sx={{ fontSize: compacto ? 26 : 32, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
                  #{encabezado.id}
                </Typography>
                <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatoFecha(encabezado.fecha)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tonoTipo(encabezado.tipo_movimiento).background, color: tonoTipo(encabezado.tipo_movimiento).foreground, fontSize: 12, fontWeight: 700 }}>
                  {etiquetaTipo(encabezado.tipo_movimiento)}
                </Box>
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1.4, flexShrink: 0 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.8 }}>
                <Dato tokens={tokens} etiqueta="Usuario" valor={encabezado.usuario_nombre?.trim() || '—'} />
                {encabezado.contacto_nombre?.trim() ? (
                  <Dato
                    tokens={tokens}
                    etiqueta={encabezado.contacto_tipo?.trim() || 'Contacto'}
                    valor={encabezado.contacto_nombre.trim()}
                  />
                ) : null}
                <Dato
                  tokens={tokens}
                  etiqueta="Documento"
                  valor={folioDocumento(encabezado) ?? '—'}
                  detalle={contextoDocumento(encabezado)}
                />
                <Box sx={{ gridColumn: { sm: '1 / -1' }, px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.content.elevated, color: tokens.content.foreground }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>MOTIVO</Typography>
                  <Typography sx={{ fontSize: 14, lineHeight: 1.35, mt: 0.25, whiteSpace: 'pre-wrap' }}>
                    {encabezado.observaciones?.trim() || '—'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              mx: { xs: 1, md: 1.75 },
              mb: { xs: 1, md: 1.75 },
              bgcolor: tokens.content.well,
              borderRadius: 3,
              border: `1px solid ${tokens.content.border}`,
              overflow: 'hidden',
            }}>
              <Box sx={{ px: 1.5, py: 1.15, borderBottom: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 750, color: tokens.content.foreground }}>Partidas</Typography>
              </Box>
              {detalleError && <Alert severity="error" sx={{ m: 1.5 }}>{detalleError}</Alert>}
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <Table size="small" stickyHeader sx={{
                  minWidth: 1080,
                  '& .MuiTableCell-root': {
                    borderBottom: `1px solid ${tokens.table.line}`,
                    color: tokens.table.cell,
                    fontSize: 13,
                    py: 0.7,
                    px: 1.25,
                    verticalAlign: 'middle',
                  },
                  '& .MuiTableHead-root .MuiTableCell-root': {
                    backgroundColor: tokens.grid.header,
                    color: tokens.grid.headerForeground,
                    fontSize: 12,
                    fontWeight: 650,
                    whiteSpace: 'nowrap',
                  },
                  '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
                    backgroundColor: tokens.grid.stripe,
                  },
                  '& .MuiTableBody-root .MuiTableRow-root:hover': {
                    backgroundColor: tokens.grid.hover,
                  },
                }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Almacén</TableCell>
                      <TableCell>Producto</TableCell>
                      <TableCell>Descripción</TableCell>
                      <TableCell align="right">Cantidad</TableCell>
                      <TableCell align="right">Costo unitario</TableCell>
                      <TableCell align="right">Existencia resultante</TableCell>
                      <TableCell align="right">Valor del movimiento</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detalleLoading && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ py: 2 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">Cargando partidas…</Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                    {!detalleLoading && !detalleError && partidas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Sin partidas para este movimiento.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {!detalleLoading && partidas.map((partida) => {
                      const cantidad = numeroRecibido(partida.cantidad);
                      const costo = numeroRecibido(partida.costo_unitario);
                      const existencia = numeroRecibido(partida.existencia_resultante);
                      const valor = numeroRecibido(partida.valor_movimiento);
                      return (
                        <TableRow key={partida.id} hover>
                          <TableCell>{celdaAlmacen(partida)}</TableCell>
                          <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{partida.producto_clave?.trim() || '—'}</TableCell>
                          <TableCell>{partida.producto_descripcion?.trim() || '—'}</TableCell>
                          <TableCell align="right" sx={importeSx(cantidad, cantidad != null && cantidad < 0)}>
                            {cantidad == null ? '—' : formatCantidad(cantidad)}
                          </TableCell>
                          <TableCell align="right" sx={importeSx(null)}>
                            {costo == null ? '—' : money.format(Math.abs(costo))}
                          </TableCell>
                          <TableCell align="right" sx={importeSx(null)}>
                            {existencia == null ? '—' : formatExistencia(existencia)}
                          </TableCell>
                          <TableCell align="right" sx={importeSx(valor, valor != null && valor < 0)}>
                            {valor == null ? '—' : money.format(valor)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.content.foreground }}>
              {movimientos.length > 0 ? 'Ningún movimiento coincide' : 'Sin movimientos en esta vista'}
            </Typography>
            <Typography sx={{ mt: 0.6, fontSize: 13, color: tokens.content.muted, maxWidth: 360 }}>
              {movimientos.length > 0
                ? 'Ajusta la búsqueda o los filtros para ver una transacción y sus partidas.'
                : 'Los movimientos registrados aparecen aquí.'}
            </Typography>
          </Stack>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function Dato({
  tokens,
  etiqueta,
  valor,
  detalle,
}: {
  tokens: { content: { elevated: string; foreground: string }; metric: { caption: string } };
  etiqueta: string;
  valor: string;
  detalle?: string | null;
}) {
  return (
    <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.content.elevated, color: tokens.content.foreground }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>{etiqueta.toUpperCase()}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 650, lineHeight: 1.25, mt: 0.25 }} noWrap>{valor}</Typography>
      {detalle ? <Typography sx={{ fontSize: 12, color: tokens.metric.caption, mt: 0.15 }}>{detalle}</Typography> : null}
    </Box>
  );
}
