import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  type AutocompleteRenderInputParams,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
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
} from '@mui/material';
import ArrowBackIcon         from '@mui/icons-material/ArrowBack';
import FileDownloadIcon      from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon      from '@mui/icons-material/PictureAsPdf';
import AttachMoneyIcon       from '@mui/icons-material/AttachMoney';
import ReceiptIcon           from '@mui/icons-material/Receipt';
import GroupIcon             from '@mui/icons-material/Group';
import InventoryIcon         from '@mui/icons-material/Inventory';
import TrendingUpIcon        from '@mui/icons-material/TrendingUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/apiClient';
import type {
  MovimientosPorPeriodoParams,
  MovimientosPorPeriodoResult,
  PeriodoResumen,
  DocumentoPeriodo,
  Agrupacion,
} from '../../services/reportesService';
import { fetchOrigenesContacto, type OrigenContacto } from '../../services/reportesService';
import { fetchVendedores } from '../../services/contactosService';
import type { Contacto } from '../../types/contactos.types';

// ── Configuración del reporte (inyectada desde el wrapper) ────────────────────

export type MovimientosPorPeriodoPageConfig = {
  titulo:          string;
  descripcion:     string;
  categoriaLabel:  string;
  contactoLabel:   string;
  montoLabel?:     string;
  cantidadLabel?:  string;
  tiposContacto:   string[];
  fetchFn:         (p: MovimientosPorPeriodoParams) => Promise<MovimientosPorPeriodoResult>;
  buildExportUrl:  (p: MovimientosPorPeriodoParams, f: 'excel' | 'pdf') => string;
};

// ── Helpers de formato ────────────────────────────────────────────────────────

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCant = (v: number) =>
  v.toLocaleString('es-MX', { maximumFractionDigits: 2 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

function primerDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const AGRUPACIONES: { value: Agrupacion; label: string }[] = [
  { value: 'dia',    label: 'Día'    },
  { value: 'semana', label: 'Semana' },
  { value: 'mes',    label: 'Mes'    },
  { value: 'anio',   label: 'Año'    },
];

// Exportación (Ventas): PDF anaranjado, Excel verde Excel
const PDF_NARANJA       = '#d9622b';
const PDF_NARANJA_HOVER = '#bf5321';
const EXCEL_VERDE       = '#217346';
const EXCEL_VERDE_HOVER = '#1a5c38';

// Color fijo por mes (enero → diciembre) para la gráfica de evolución de Ventas
const COLORES_MES = [
  '#3d5f86', '#6b86a8', '#4e8784', '#5f8a68', '#86965a', '#b39552',
  '#c27f4e', '#ad6250', '#96586a', '#775f92', '#59658f', '#7b7266',
];

/** Color del mes en que inicia el período (`periodo_key` = YYYY-MM-DD). */
function colorMes(periodoKey: string, fallback: string): string {
  const mes = Number(periodoKey.slice(5, 7));
  return COLORES_MES[mes - 1] ?? fallback;
}

// ── Filtros compactos (Ventas) ────────────────────────────────────────────────

function FiltroLabel({ children, color, sx }: { children: React.ReactNode; color: string; sx?: SxProps<Theme> }) {
  return (
    <Box component="span" sx={[
      { flexShrink: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color, lineHeight: 1, whiteSpace: 'nowrap' },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}>
      {children}
    </Box>
  );
}

function FiltroCompactoInput({ params, label, color }: { params: AutocompleteRenderInputParams; label: string; color: string }) {
  const { InputProps, ...rest } = params;
  return (
    <TextField
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(rest as any)}
      size="small"
      placeholder="Todos"
      slotProps={{
        input: {
          ...InputProps,
          startAdornment: <><FiltroLabel color={color}>{label}</FiltroLabel>{InputProps.startAdornment}</>,
        },
      }}
    />
  );
}

// ── Tarjeta KPI ───────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 150px', minWidth: 130, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{
          width: 32, height: 32, borderRadius: 1.5,
          bgcolor: `${color}18`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon sx={{ color, fontSize: 17 }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
            {label}
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.3 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

// ── Gráfica de barras SVG ─────────────────────────────────────────────────────

function PeriodosChart({ periodos, color, campo = 'total', colorPorMes = false }: { periodos: PeriodoResumen[]; color: string; campo?: 'total' | 'subtotal'; colorPorMes?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(640);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      if (entries[0]) setContainerW(entries[0].contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (periodos.length === 0) return null;

  const PAD_LEFT   = 68;
  const PAD_RIGHT  = 12;
  const PAD_TOP    = 10;
  const PAD_BOTTOM = 44;
  const CHART_H    = 140;
  const SVG_H      = CHART_H + PAD_TOP + PAD_BOTTOM;
  const chartW     = Math.max(1, containerW - PAD_LEFT - PAD_RIGHT);

  const n        = periodos.length;
  const monto = (p: PeriodoResumen) => p[campo];
  const maxTotal = Math.max(...periodos.map(monto), 1);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxTotal * f);

  const fmtAxisY = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
  };

  const barSpacing = chartW / n;
  const barW       = Math.min(44, Math.max(6, barSpacing * 0.65));
  const rotate     = n > 10;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width="100%" height={SVG_H} viewBox={`0 0 ${containerW} ${SVG_H}`}>
        {yTicks.map((tick, i) => {
          const yPos = PAD_TOP + CHART_H - (CHART_H * tick / maxTotal);
          return (
            <g key={i}>
              <line x1={PAD_LEFT} y1={yPos} x2={PAD_LEFT + chartW} y2={yPos}
                stroke="#e5e7eb" strokeWidth={i === 0 ? 1.5 : 1} />
              <text x={PAD_LEFT - 5} y={yPos + 3.5} textAnchor="end" fontSize={9} fill="#9ca3af">
                {fmtAxisY(tick)}
              </text>
            </g>
          );
        })}

        {periodos.map((p, i) => {
          const barH   = Math.max(2, CHART_H * monto(p) / maxTotal);
          const bx     = PAD_LEFT + i * barSpacing + (barSpacing - barW) / 2;
          const by     = PAD_TOP + CHART_H - barH;
          const labelX = PAD_LEFT + i * barSpacing + barSpacing / 2;
          const labelY = PAD_TOP + CHART_H + 10;
          return (
            <g key={p.periodo_key}>
              <title>{`${p.periodo_label}: $${formatMXN(monto(p))}`}</title>
              <rect x={bx} y={by} width={barW} height={barH} fill={colorPorMes ? colorMes(p.periodo_key, color) : color} rx={2} opacity={0.9} />
              {rotate ? (
                <text x={labelX} y={labelY} fontSize={8} fill="#6b7280"
                  textAnchor="end" transform={`rotate(-40, ${labelX}, ${labelY})`}>
                  {p.periodo_label}
                </text>
              ) : (
                <text x={labelX} y={labelY + 4} textAnchor="middle" fontSize={9} fill="#6b7280">
                  {p.periodo_label}
                </text>
              )}
            </g>
          );
        })}

        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + CHART_H}
          stroke="#d1d5db" strokeWidth={1} />
        <line x1={PAD_LEFT} y1={PAD_TOP + CHART_H} x2={PAD_LEFT + chartW} y2={PAD_TOP + CHART_H}
          stroke="#d1d5db" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Fila expandible de período ────────────────────────────────────────────────

function PeriodoRow({
  periodo,
  docs,
  contactoLabel,
  mostrarCantidad,
  esVentas,
}: {
  periodo:         PeriodoResumen;
  docs:            DocumentoPeriodo[];
  contactoLabel:   string;
  mostrarCantidad: boolean;
  esVentas:        boolean;
}) {
  const [open, setOpen] = useState(false);
  const tokens = useTheme().emphasys;

  const totalCols = (esVentas ? 5 : 7) + (mostrarCantidad ? 1 : 0);
  const ventasPeriodo = docs.reduce((s, d) => s + (esVentas ? d.subtotal : d.total), 0);

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: docs.length > 0 ? 'pointer' : 'default', '& > td': { py: 0.75, borderColor: esVentas ? tokens.table.line : undefined }, '&:hover': esVentas ? { bgcolor: tokens.content.hover } : undefined }}
        onClick={() => docs.length > 0 && setOpen((o) => !o)}
      >
        <TableCell sx={{ width: 36, pr: 0 }}>
          {docs.length > 0 && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600} color={esVentas ? tokens.content.foreground : 'primary.main'}>
            {periodo.periodo_label}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{periodo.cantidad_documentos.toLocaleString('es-MX')}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{periodo.cantidad_contactos.toLocaleString('es-MX')}</Typography>
        </TableCell>
        {mostrarCantidad && (
          <TableCell align="right">
            <Typography variant="body2">{formatCant(periodo.cantidad_total)}</Typography>
          </TableCell>
        )}
        {esVentas ? (
          <TableCell align="right">
            <Typography variant="body2" fontWeight={700}>{formatMXN(periodo.subtotal)}</Typography>
          </TableCell>
        ) : (
          <>
            <TableCell align="right">
              <Typography variant="body2">{formatMXN(periodo.subtotal)}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{formatMXN(periodo.iva)}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight={700} color="primary.main">
                ${formatMXN(periodo.total)}
              </Typography>
            </TableCell>
          </>
        )}
      </TableRow>

      {/* Detalle de documentos */}
      {docs.length > 0 && (
        <TableRow>
          <TableCell colSpan={totalCols} sx={{ p: 0, borderBottom: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 5, pr: 1, pb: 1, bgcolor: esVentas ? tokens.content.elevated : '#f8fafc' }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.76rem', py: 0.4 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: esVentas ? tokens.table.headerBg : '#1d2f6810' }}>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Documento</TableCell>
                      <TableCell>{contactoLabel}</TableCell>
                      {mostrarCantidad && <TableCell align="right">Cantidad</TableCell>}
                      <TableCell align="right">{esVentas ? 'Ventas' : 'Subtotal'}</TableCell>
                      {!esVentas && <TableCell align="right">IVA</TableCell>}
                      {!esVentas && <TableCell align="right">Total</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={d.id} hover>
                        <TableCell>{formatFecha(d.fecha)}</TableCell>
                        <TableCell>{d.folio}</TableCell>
                        <TableCell>{d.contacto_nombre}</TableCell>
                        {mostrarCantidad && (
                          <TableCell align="right">{formatCant(d.cantidad_total)}</TableCell>
                        )}
                        <TableCell align="right" sx={{ fontWeight: esVentas ? 700 : 400 }}>{formatMXN(d.subtotal)}</TableCell>
                        {!esVentas && <TableCell align="right">{formatMXN(d.iva)}</TableCell>}
                        {!esVentas && (
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            ${formatMXN(d.total)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: esVentas ? tokens.metric.amount.background : '#f1f5f9' }}>
                      <TableCell
                        colSpan={(esVentas ? 3 : 5) + (mostrarCantidad ? 1 : 0)}
                        align="right"
                        sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.73rem' }}
                      >
                        {esVentas ? 'Ventas' : 'Subtotal'} {periodo.periodo_label}:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: esVentas ? tokens.content.foreground : 'primary.main' }}>
                        ${formatMXN(ventasPeriodo)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Tipos para autocomplete ───────────────────────────────────────────────────

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };
type ProductoOpcion = { id: number; clave: string; descripcion: string };

// ── Página principal ──────────────────────────────────────────────────────────

export default function MovimientosPorPeriodoPage({ config }: { config: MovimientosPorPeriodoPageConfig }) {
  const navigate = useNavigate();

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin,    setFechaFin]    = useState(hoy());
  const [agrupacion,  setAgrupacion]  = useState<Agrupacion>('mes');
  const [proveedor,   setProveedor]   = useState<ContactoOpcion | null>(null);
  const [producto,    setProducto]    = useState<ProductoOpcion | null>(null);
  const [origen, setOrigen] = useState<OrigenContacto | null>(null);
  const [origenes, setOrigenes] = useState<OrigenContacto[]>([]);
  const [vendedor, setVendedor] = useState<Contacto | null>(null);
  const [vendedores, setVendedores] = useState<Contacto[]>([]);

  const [opcionesProveedor, setOpcionesProveedor] = useState<ContactoOpcion[]>([]);
  const [opcionesProducto,  setOpcionesProducto]  = useState<ProductoOpcion[]>([]);
  const [buscandoProveedor, setBuscandoProveedor] = useState(false);
  const [buscandoProducto,  setBuscandoProducto]  = useState(false);

  const [loading,    setLoading]    = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado,  setResultado]  = useState<MovimientosPorPeriodoResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proveedorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productoTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (config.tiposContacto.includes('cliente')) fetchOrigenesContacto().then(setOrigenes).catch(() => undefined); }, [config.tiposContacto]);
  useEffect(() => { if (config.tiposContacto.includes('cliente')) fetchVendedores().then(setVendedores).catch(() => setVendedores([])); }, [config.tiposContacto]);

  // La cantidad sólo es significativa cuando hay un único producto seleccionado
  const mostrarCantidad = !!producto;

  const buscarProveedores = useCallback((input: string) => {
    if (proveedorTimer.current) clearTimeout(proveedorTimer.current);
    proveedorTimer.current = setTimeout(async () => {
      setBuscandoProveedor(true);
      try {
        const qs = new URLSearchParams({ limit: '40', tipos: config.tiposContacto.join(',') });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/contactos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[] };
          const items = Array.isArray(raw) ? raw : ((raw as { data?: ContactoOpcion[] }).data ?? []);
          setOpcionesProveedor(items);
        }
      } finally { setBuscandoProveedor(false); }
    }, 250);
  }, [config.tiposContacto]);

  const buscarProductos = useCallback((input: string) => {
    if (productoTimer.current) clearTimeout(productoTimer.current);
    productoTimer.current = setTimeout(async () => {
      setBuscandoProducto(true);
      try {
        const qs = new URLSearchParams({ page: '1', limit: '40' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/productos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ProductoOpcion[] | { data?: ProductoOpcion[] };
          const items = Array.isArray(raw) ? raw : ((raw as { data?: ProductoOpcion[] }).data ?? []);
          setOpcionesProducto(items);
        }
      } finally { setBuscandoProducto(false); }
    }, 250);
  }, []);

  const buildParams = (): MovimientosPorPeriodoParams => ({
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    agrupacion,
    ...(proveedor ? { contacto_id: proveedor.id } : {}),
    ...(producto  ? { producto_id: producto.id  } : {}),
    ...(origen ? { origen_contacto_id: origen.id } : {}),
    ...(vendedor ? { vendedor_id: vendedor.id } : {}),
  });

  useEffect(() => {
    if (!fechaInicio || !fechaFin) return;
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await config.fetchFn(buildParams());
        setResultado(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al generar el reporte';
        setError(msg);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin, agrupacion, proveedor, producto, origen, vendedor]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (exportando) return;
    setExportando(formato);
    try {
      const url = config.buildExportUrl(buildParams(), formato);
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const ext      = formato === 'excel' ? 'xlsx' : 'pdf';
      const filename = match?.[1] ?? `compras-por-periodo.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al exportar';
      setError(msg);
      setSnackbarOpen(true);
    } finally {
      setExportando(null);
    }
  };

  const docsPorPeriodo = useMemo(() => {
    const m = new Map<string, DocumentoPeriodo[]>();
    for (const d of resultado?.documentos ?? []) {
      if (!m.has(d.periodo_key)) m.set(d.periodo_key, []);
      m.get(d.periodo_key)!.push(d);
    }
    return m;
  }, [resultado]);

  const periodos = resultado?.periodos ?? [];
  const kpis     = resultado?.kpis;

  const totalSubtotal = periodos.reduce((s, p) => s + p.subtotal, 0);
  const totalIva      = periodos.reduce((s, p) => s + p.iva, 0);
  const totalTotal    = periodos.reduce((s, p) => s + p.total, 0);
  const totalDocs     = periodos.reduce((s, p) => s + p.cantidad_documentos, 0);
  const totalCant     = periodos.reduce((s, p) => s + p.cantidad_total, 0);

  // Número de columnas del encabezado principal (para colSpan en estado vacío)
  const esVentas = config.contactoLabel === 'Cliente';
  const tokens = useTheme().emphasys;
  const totalColsHeader = (esVentas ? 5 : 7) + (mostrarCantidad ? 1 : 0);
  const ventas = totalSubtotal;
  const ticket = totalDocs > 0 ? (esVentas ? ventas / totalDocs : (kpis?.ticket_promedio ?? 0)) : 0;
  // Controles compactos (32px) de la barra de filtros de Ventas
  const campoCompactoSx = (activo: boolean): SxProps<Theme> => ({
    '& .MuiOutlinedInput-root': {
      height: 32,
      bgcolor: activo ? tokens.action.wash : tokens.content.well,
      borderRadius: 2,
      fontSize: 13,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.muted },
      '&.Mui-focused fieldset': { borderColor: tokens.action.info, borderWidth: 1 },
    },
    '& .MuiAutocomplete-inputRoot': { py: '0 !important', pl: '10px !important' },
    '& .MuiAutocomplete-input': { py: '0 !important', px: '4px !important', color: tokens.content.foreground },
  });
  const campoCompactoBoxSx: SxProps<Theme> = {
    height: 32, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 0.75,
    pl: 1.25, pr: 1, border: `1px solid ${tokens.content.border}`, borderRadius: 2,
    bgcolor: tokens.content.well, minWidth: 0,
    '&:hover': { borderColor: tokens.content.muted },
    '&:focus-within': { borderColor: tokens.action.info },
  };
  const fechaInputSx: SxProps<Theme> = {
    flex: '0 1 auto', width: 118, minWidth: 0, border: 0, outline: 0, p: 0, bgcolor: 'transparent',
    font: 'inherit', fontSize: 13, color: tokens.content.foreground, fontVariantNumeric: 'tabular-nums',
    colorScheme: 'inherit',
    '&::-webkit-calendar-picker-indicator': { opacity: 0.55, cursor: 'pointer' },
  };
  const exportBtnSx: SxProps<Theme> = {
    height: 32, px: 1.4, minWidth: 0, borderRadius: 2, textTransform: 'none', fontSize: 12.5, fontWeight: 600,
    color: 'common.white', boxShadow: 'none', '& .MuiButton-startIcon': { mr: 0.5 },
  };

  return (
    <Box sx={esVentas
      ? { px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', minWidth: 0, boxSizing: 'border-box' }
      : { p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {esVentas ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', lineHeight: '16px', textTransform: 'uppercase', color: tokens.content.muted, whiteSpace: 'nowrap' }}>
              <Box component="button" type="button" onClick={() => navigate('/informes')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit', flexShrink: 0 }}>
                <ArrowBackIcon sx={{ fontSize: 13 }} />
                Informes
              </Box>
              <Box component="span">/</Box>
              <Box component="span" sx={{ flexShrink: 0 }}>{config.categoriaLabel}</Box>
              <Box component="span">/</Box>
              <Box component="span" sx={{ color: tokens.content.foreground, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{config.titulo}</Box>
            </Stack>
            <Typography component="h1" variant="figure" sx={{ mt: 0.75, fontSize: 20, lineHeight: '24px', letterSpacing: '-0.01em', color: tokens.content.foreground }}>
              {config.titulo}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.25, fontSize: 12.5, lineHeight: '18px', color: tokens.content.muted, maxWidth: 720, whiteSpace: { lg: 'nowrap' }, overflow: { lg: 'hidden' }, textOverflow: { lg: 'ellipsis' } }}>
              {config.descripcion}
            </Typography>
          </Box>

          {/* Filtros: una línea en contenedores amplios, dos líneas (cuándo / quién-qué) en medianos, apilados en móvil */}
          <Paper elevation={0} sx={{
            position: 'relative', overflow: 'hidden', p: 0.75, borderRadius: 2.5,
            border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.elevated, boxShadow: 'none',
            display: 'flex', flexDirection: 'column', gap: 0.75, containerType: 'inline-size',
            '& .vp-when': { display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 },
            '& .vp-dims': { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.75 },
            '& .vp-spacer': { flex: 1 },
            '@container (min-width: 1340px)': {
              flexDirection: 'row', alignItems: 'center',
              '& .vp-when, & .vp-dims': { display: 'contents' },
              '& .vp-spacer': { display: 'none' },
              '& .vp-range': { order: 1 },
              '& .vp-cliente': { order: 2, flex: '1 1 0' },
              '& .vp-vendedor': { order: 3, flex: '1 1 0' },
              '& .vp-producto': { order: 4, flex: '1.35 1 0' },
              '& .vp-origen': { order: 5, flex: '0.95 1 0' },
              '& .vp-agrupacion': { order: 6 },
              '& .vp-export': { order: 7, ml: 'auto' },
            },
            '@container (max-width: 900px)': { '& .vp-dims': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            '@container (max-width: 640px)': {
              '& .vp-when': { flexWrap: 'wrap' },
              '& .vp-range': { flex: '1 1 100%' },
              '& .vp-range input': { flex: '1 1 0', width: 'auto' },
              '& .vp-agrupacion': { flex: '1 1 auto' },
              '& .vp-agrupacion button': { flex: 1 },
              '& .vp-spacer': { display: 'none' },
              '& .vp-export': { ml: 'auto' },
              '& .vp-dims': { gridTemplateColumns: 'minmax(0, 1fr)' },
            },
          }}>
            {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: tokens.metric.track, '& .MuiLinearProgress-bar': { bgcolor: tokens.action.info } }} />}

            <Box className="vp-when">
              <Box component="label" className="vp-range" sx={{ ...campoCompactoBoxSx, cursor: 'text' }}>
                <FiltroLabel color={tokens.content.muted}>Período</FiltroLabel>
                <Box component="input" type="date" aria-label="Fecha inicial" value={fechaInicio} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaInicio(e.target.value)} sx={fechaInputSx} />
                <Box component="span" aria-hidden sx={{ color: tokens.content.muted, fontSize: 12 }}>→</Box>
                <Box component="input" type="date" aria-label="Fecha final" value={fechaFin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaFin(e.target.value)} sx={fechaInputSx} />
              </Box>

              <Box className="vp-spacer" />

              <Box className="vp-agrupacion" role="radiogroup" aria-label="Agrupación" sx={{ ...campoCompactoBoxSx, px: 0.25, gap: 0.25, alignItems: 'stretch', py: 0.25, flexShrink: 0 }}>
                <FiltroLabel color={tokens.content.muted} sx={{ alignSelf: 'center', px: 0.75 }}>Agrupar</FiltroLabel>
                {AGRUPACIONES.map((a) => {
                  const activo = a.value === agrupacion;
                  return (
                    <Box key={a.value} component="button" type="button" role="radio" aria-checked={activo} onClick={() => setAgrupacion(a.value)}
                      sx={{ font: 'inherit', fontSize: 12.5, fontWeight: 500, border: 0, borderRadius: 1.5, px: 1.1, cursor: 'pointer', bgcolor: activo ? tokens.action.primary : 'transparent', color: activo ? tokens.action.primaryForeground : tokens.content.secondary, '&:hover': activo ? undefined : { bgcolor: tokens.content.hover }, '&:focus-visible': { outline: `2px solid ${tokens.action.info}`, outlineOffset: 1 } }}>
                      {a.label}
                    </Box>
                  );
                })}
              </Box>

              <Stack className="vp-export" direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                <Button
                  size="small" variant="contained" disableElevation
                  disabled={!resultado || !!exportando}
                  startIcon={exportando === 'pdf' ? <CircularProgress size={13} color="inherit" /> : <FileDownloadIcon sx={{ fontSize: '15px !important' }} />}
                  onClick={() => void handleExportar('pdf')}
                  sx={{ ...exportBtnSx, bgcolor: PDF_NARANJA, '&:hover': { bgcolor: PDF_NARANJA_HOVER } }}
                >
                  PDF
                </Button>
                <Button
                  size="small" variant="contained" disableElevation
                  disabled={!resultado || !!exportando}
                  startIcon={exportando === 'excel' ? <CircularProgress size={13} color="inherit" /> : <FileDownloadIcon sx={{ fontSize: '15px !important' }} />}
                  onClick={() => void handleExportar('excel')}
                  sx={{ ...exportBtnSx, bgcolor: EXCEL_VERDE, '&:hover': { bgcolor: EXCEL_VERDE_HOVER } }}
                >
                  Excel
                </Button>
              </Stack>
            </Box>

            <Box className="vp-dims">
              <Autocomplete<ContactoOpcion>
                className="vp-cliente"
                options={opcionesProveedor}
                loading={buscandoProveedor}
                value={proveedor}
                onChange={(_, val) => setProveedor(val)}
                onInputChange={(_, input) => buscarProveedores(input)}
                onOpen={() => { if (!opcionesProveedor.length) buscarProveedores(''); }}
                getOptionLabel={(o) => o.nombre}
                getOptionKey={(o) => o.id}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                sx={{ minWidth: 0, ...campoCompactoSx(!!proveedor) }}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2">{o.nombre}</Typography>
                      {o.rfc && <Typography variant="caption" color="text.secondary">{o.rfc}</Typography>}
                    </Box>
                  </li>
                )}
                renderInput={(p) => <FiltroCompactoInput params={p} label={config.contactoLabel} color={tokens.content.muted} />}
              />

              {/* Vendedor / agente que realizó la venta (documentos.agente_id) */}
              <Box className="vp-vendedor" sx={{ minWidth: 0 }}>
                <Autocomplete<Contacto>
                  options={vendedores}
                  value={vendedor}
                  onChange={(_, val) => setVendedor(val)}
                  getOptionLabel={(o) => o.nombre}
                  getOptionKey={(o) => o.id}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  sx={{ minWidth: 0, ...campoCompactoSx(!!vendedor) }}
                  renderInput={(p) => <FiltroCompactoInput params={p} label="Vendedor" color={tokens.content.muted} />}
                />
              </Box>

              <Autocomplete<ProductoOpcion>
                className="vp-producto"
                options={opcionesProducto}
                loading={buscandoProducto}
                value={producto}
                onChange={(_, val) => setProducto(val)}
                onInputChange={(_, input) => buscarProductos(input)}
                onOpen={() => { if (!opcionesProducto.length) buscarProductos(''); }}
                getOptionLabel={(o) => `${o.clave} — ${o.descripcion}`}
                getOptionKey={(o) => o.id}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                sx={{ minWidth: 0, ...campoCompactoSx(!!producto) }}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{o.clave}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.descripcion}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(p) => <FiltroCompactoInput params={p} label="Producto" color={tokens.content.muted} />}
              />

              <Tooltip title="Origen de contacto" placement="top" enterDelay={600}>
                <Autocomplete<OrigenContacto>
                  className="vp-origen"
                  options={origenes} value={origen} onChange={(_, val) => setOrigen(val)}
                  getOptionLabel={(o) => o.descripcion} getOptionKey={(o) => o.id}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  sx={{ minWidth: 0, ...campoCompactoSx(!!origen) }}
                  renderInput={(p) => <FiltroCompactoInput params={p} label="Origen" color={tokens.content.muted} />}
                />
              </Tooltip>
            </Box>
          </Paper>
        </Box>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')} sx={{ color: 'text.secondary' }}>
              Informes
            </Button>
            <Typography color="text.disabled">/</Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>{config.categoriaLabel}</Typography>
            <Typography color="text.disabled">/</Typography>
            <Typography variant="body2" fontWeight={600} noWrap>{config.titulo}</Typography>
          </Stack>

          <Box>
            <Typography variant="h6" fontWeight={700}>{config.titulo}</Typography>
            <Typography variant="caption" color="text.secondary">{config.descripcion}</Typography>
          </Box>

          {/* Filtros */}
          <Paper elevation={0} sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
            {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="Fecha inicial" type="date" size="small"
                value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 155 }}
              />
              <TextField
                label="Fecha final" type="date" size="small"
                value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 155 }}
              />

              <Autocomplete<ContactoOpcion>
                options={opcionesProveedor}
                loading={buscandoProveedor}
                value={proveedor}
                onChange={(_, val) => setProveedor(val)}
                onInputChange={(_, input) => buscarProveedores(input)}
                onOpen={() => { if (!opcionesProveedor.length) buscarProveedores(''); }}
                getOptionLabel={(o) => o.nombre}
                getOptionKey={(o) => o.id}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                sx={{ width: 210 }}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2">{o.nombre}</Typography>
                      {o.rfc && <Typography variant="caption" color="text.secondary">{o.rfc}</Typography>}
                    </Box>
                  </li>
                )}
                renderInput={(inputProps) => (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <TextField {...(inputProps as any)} label={`${config.contactoLabel} (todos)`} size="small" />
                )}
              />

              <Autocomplete<ProductoOpcion>
                options={opcionesProducto}
                loading={buscandoProducto}
                value={producto}
                onChange={(_, val) => setProducto(val)}
                onInputChange={(_, input) => buscarProductos(input)}
                onOpen={() => { if (!opcionesProducto.length) buscarProductos(''); }}
                getOptionLabel={(o) => `${o.clave} — ${o.descripcion}`}
                getOptionKey={(o) => o.id}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                sx={{ width: 230 }}
                renderOption={(props, o) => (
                  <li {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{o.clave}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.descripcion}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(inputProps) => (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <TextField {...(inputProps as any)} label="Producto (todos)" size="small" />
                )}
              />

              {config.tiposContacto.includes('cliente') && <Autocomplete<OrigenContacto>
                options={origenes} value={origen} onChange={(_, val) => setOrigen(val)}
                getOptionLabel={(o) => o.descripcion} getOptionKey={(o) => o.id}
                isOptionEqualToValue={(a,b) => a.id === b.id} sx={{ width: 190 }}
                renderInput={(p) => <TextField {...p} label="Origen de contacto (todos)" size="small" />}
              />}

              <Tooltip title="Agrupar por">
                <Select
                  size="small"
                  value={agrupacion}
                  onChange={(e) => setAgrupacion(e.target.value as Agrupacion)}
                  sx={{ minWidth: 100 }}
                >
                  {AGRUPACIONES.map((a) => (
                    <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                  ))}
                </Select>
              </Tooltip>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

              <Box sx={{ ml: { md: 'auto' }, display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Button
                  size="small" variant="outlined" color="error"
                  disabled={!resultado || !!exportando}
                  startIcon={exportando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
                  onClick={() => void handleExportar('pdf')}
                >
                  PDF
                </Button>
                <Button
                  size="small" variant="outlined"
                  disabled={!resultado || !!exportando}
                  startIcon={exportando === 'excel' ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
                  onClick={() => void handleExportar('excel')}
                >
                  Excel
                </Button>
              </Box>
            </Box>
          </Paper>
        </>
      )}

      {/* KPIs */}
      {kpis && (
        esVentas ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: mostrarCantidad ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }, gap: 0.8 }}>
            {[
              [config.montoLabel ?? 'Total vendido', `$${formatMXN(ventas)}`],
              ['Documentos', kpis.cantidad_documentos.toLocaleString('es-MX')],
              [`${config.contactoLabel}s`, kpis.cantidad_contactos.toLocaleString('es-MX')],
              ...(mostrarCantidad ? [[config.cantidadLabel ?? 'Cantidad vendida', formatCant(kpis.cantidad_total)] as [string, string]] : []),
              ['Ticket promedio', totalDocs > 0 ? `$${formatMXN(ticket)}` : '—'],
            ].map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0, bgcolor: tokens.metric.amount.background, borderRadius: 2, px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{label}</Typography>
                <Typography variant="figure" sx={{ mt: 0.15, fontSize: { xs: 20, sm: 24 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <KpiCard icon={AttachMoneyIcon} label={config.montoLabel ?? 'Total comprado'}
            value={`$${formatMXN(kpis.total)}`} color="#1d2f68" />
          <KpiCard icon={ReceiptIcon} label="Documentos"
            value={kpis.cantidad_documentos.toLocaleString('es-MX')} color="#006261" />
          <KpiCard icon={GroupIcon} label={`${config.contactoLabel}s`}
            value={kpis.cantidad_contactos.toLocaleString('es-MX')} color="#7c3aed" />
          {mostrarCantidad && (
            <KpiCard icon={InventoryIcon} label={config.cantidadLabel ?? 'Cantidad comprada'}
              value={formatCant(kpis.cantidad_total)} color="#b45309" />
          )}
          <KpiCard icon={TrendingUpIcon} label="Ticket promedio"
            value={kpis.cantidad_documentos > 0 ? `$${formatMXN(kpis.ticket_promedio)}` : '—'}
            color="#0369a1" />
        </Box>
        )
      )}

      {/* Gráfica */}
      {periodos.length > 0 && (
        <Paper elevation={0} sx={esVentas ? { px: { xs: 1.5, sm: 2 }, py: 1.25, borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well, boxShadow: 'none' } : { p: 1.5 }}>
          {esVentas ? (
            <>
              <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.muted }}>Evolución</Typography>
              <Typography sx={{ mt: 0.2, mb: 0.75, fontSize: 13, color: tokens.content.secondary }}>
                Evolución — {AGRUPACIONES.find((a) => a.value === agrupacion)?.label}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
              Evolución — {AGRUPACIONES.find((a) => a.value === agrupacion)?.label}
            </Typography>
          )}
          <PeriodosChart periodos={periodos} color={esVentas ? tokens.action.info : '#1d2f68'} campo={esVentas ? 'subtotal' : 'total'} colorPorMes={esVentas && agrupacion !== 'anio'} />
        </Paper>
      )}

      {/* Tabla principal */}
      <Paper elevation={0} sx={esVentas ? { p: 0, borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well, boxShadow: 'none', overflow: 'auto' } : { p: 1.5 }}>
        {!resultado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}

        {resultado && (
          <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.82rem' } }}>
            <TableHead>
              <TableRow sx={esVentas
                ? { bgcolor: tokens.table.headerBg, '& .MuiTableCell-root': { color: tokens.table.headerFg, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', py: 1, borderColor: tokens.table.line, whiteSpace: 'nowrap' } }
                : { bgcolor: '#1d2f68', '& .MuiTableCell-root': { color: 'common.white', fontWeight: 700, fontSize: '0.78rem', py: 0.75 } }}>
                <TableCell sx={{ width: 36 }} />
                <TableCell>Período</TableCell>
                <TableCell align="right">Documentos</TableCell>
                <TableCell align="right">{config.contactoLabel}s</TableCell>
                {mostrarCantidad && <TableCell align="right">Cantidad</TableCell>}
                {esVentas ? <TableCell align="right">Ventas</TableCell> : (
                  <>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">IVA</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {periodos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={totalColsHeader}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      Sin datos para los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                periodos.map((p) => (
                  <PeriodoRow
                    key={p.periodo_key}
                    periodo={p}
                    docs={docsPorPeriodo.get(p.periodo_key) ?? []}
                    contactoLabel={config.contactoLabel}
                    mostrarCantidad={mostrarCantidad}
                    esVentas={esVentas}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Totales */}
        {periodos.length > 0 && (
          <Box sx={esVentas ? {
            display: 'flex', gap: 3, px: 1.5, py: 1,
            bgcolor: tokens.metric.amount.background,
            justifyContent: 'flex-end', flexWrap: 'wrap',
          } : {
            display: 'flex', gap: 3, mt: 1.5, pt: 1.5,
            borderTop: '2px solid', borderColor: 'primary.main',
            justifyContent: 'flex-end', flexWrap: 'wrap',
          }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Documentos</Typography>
              <Typography variant="body2" fontWeight={700}>{totalDocs.toLocaleString('es-MX')}</Typography>
            </Box>
            {mostrarCantidad && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Cantidad</Typography>
                <Typography variant="body2" fontWeight={700}>{formatCant(totalCant)}</Typography>
              </Box>
            )}
            {esVentas ? (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Ventas</Typography>
                <Typography variant="body2" fontWeight={700} color={tokens.content.foreground}>
                  ${formatMXN(ventas)}
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatMXN(totalSubtotal)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">IVA</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatMXN(totalIva)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                    ${formatMXN(totalTotal)}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
