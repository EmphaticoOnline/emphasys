import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InventoryIcon from '@mui/icons-material/Inventory';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/apiClient';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import type {
  VolumenProductoParams,
  VolumenProductoResult,
  ProductoVolumen,
  PartidaVolumenDetalle,
} from '../../services/reportesService';

export type VolumenProductoPageConfig = {
  titulo: string;
  descripcion: string;
  categoriaLabel: string;
  contactoLabel: string;
  ultimoPrecioLabel: string;
  totalLabel: string;
  tiposContacto: string[];
  fetchFn: (params: VolumenProductoParams) => Promise<VolumenProductoResult>;
  buildExportUrl: (params: VolumenProductoParams, formato: 'excel' | 'pdf') => string;
};

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };
type ProductoOpcion = { id: number; clave: string; descripcion: string };

const formatMXN = (val: number) =>
  val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCantidad = (val: number) =>
  val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso || '—';
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

// ── Tarjeta KPI ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 160px', minWidth: 140, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5,
            bgcolor: `${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
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

// ── Columnas DataGrid resumen ─────────────────────────────────────────────────

function buildColumnsResumen(ultimoPrecioLabel: string): GridColDef<ProductoVolumen>[] {
  return [
    { field: 'clave', headerName: 'Clave', width: 85 },
    { field: 'descripcion', headerName: 'Descripción', flex: 1, minWidth: 180 },
    { field: 'unidad', headerName: 'Unidad', width: 65 },
    {
      field: 'cantidad_total',
      headerName: 'Cantidad',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, number>) =>
        formatCantidad(p.value ?? 0),
    },
    {
      field: 'cantidad_documentos',
      headerName: 'Docs.',
      width: 68,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'precio_promedio',
      headerName: 'Precio prom.',
      width: 118,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'ultimo_precio_unitario',
      headerName: ultimoPrecioLabel,
      width: 118,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'subtotal',
      headerName: 'Subtotal',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, number>) => (
        <Typography variant="body2" fontWeight={700} color="primary.main">
          {formatMXN(p.value ?? 0)}
        </Typography>
      ),
    },
    {
      field: 'ultimo_movimiento',
      headerName: 'Últ. movimiento',
      width: 125,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, string>) => (
        <Typography variant="body2" color="text.secondary">
          {formatFecha(p.value ?? '')}
        </Typography>
      ),
    },
    {
      field: 'pct_participacion',
      headerName: '% Participación',
      width: 118,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProductoVolumen, number>) => (
        <Typography variant="body2" color="text.secondary">
          {(p.value ?? 0).toFixed(2)} %
        </Typography>
      ),
    },
  ];
}

// ── Vista detalle ─────────────────────────────────────────────────────────────

function DetalleTable({
  productos,
  partidas,
  contactoLabel,
}: {
  productos: ProductoVolumen[];
  partidas: PartidaVolumenDetalle[];
  contactoLabel: string;
}) {
  const partidasPorGrupo = useMemo(() => {
    const m = new Map<string, PartidaVolumenDetalle[]>();
    for (const p of partidas) {
      if (!m.has(p.grupo_key)) m.set(p.grupo_key, []);
      m.get(p.grupo_key)!.push(p);
    }
    return m;
  }, [partidas]);

  if (productos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin resultados para el período indicado.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {productos.map((prod) => {
        const items = partidasPorGrupo.get(prod.grupo_key) ?? [];
        return (
          <Box key={prod.grupo_key}>
            {/* Encabezado del producto */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: '#f1f5f9',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '6px 6px 0 0',
                px: 1.5,
                py: 0.75,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={700} color="text.primary">
                  {prod.clave} — {prod.descripcion}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {prod.unidad || '—'} · {prod.cantidad_documentos} doc{prod.cantidad_documentos !== 1 ? 's' : ''} · Últ. mov.: {formatFecha(prod.ultimo_movimiento)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 2 }}>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {formatMXN(prod.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {prod.pct_participacion.toFixed(2)} %
                </Typography>
              </Box>
            </Box>

            {/* Tabla de partidas */}
            <Table
              size="small"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderTop: 'none',
                borderRadius: '0 0 6px 6px',
                '& .MuiTableCell-root': { fontSize: '0.78rem', py: 0.5 },
              }}
            >
              <TableHead>
                <TableRow sx={{ bgcolor: '#1d2f6808' }}>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Folio</TableCell>
                  <TableCell>{contactoLabel}</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Precio unit.</TableCell>
                  <TableCell align="right">Descuento</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="caption" color="text.disabled">
                        Sin partidas en el período
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{formatFecha(item.fecha)}</TableCell>
                      <TableCell>{item.folio}</TableCell>
                      <TableCell>{item.contacto_nombre}</TableCell>
                      <TableCell align="right">{formatCantidad(item.cantidad)}</TableCell>
                      <TableCell align="right">{formatMXN(item.precio_unitario)}</TableCell>
                      <TableCell align="right">
                        {item.descuento > 0 ? formatMXN(item.descuento) : '—'}
                      </TableCell>
                      <TableCell align="right">{formatMXN(item.subtotal)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatMXN(item.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {/* Subtotal del producto */}
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell
                    colSpan={7}
                    align="right"
                    sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.74rem' }}
                  >
                    Total {prod.clave} — {formatCantidad(prod.cantidad_total)} {prod.unidad || 'uds'}:
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatMXN(prod.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        );
      })}
    </Stack>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function VolumenProductoPage({ config }: { config: VolumenProductoPageConfig }) {
  const navigate = useNavigate();

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [producto, setProducto] = useState<ProductoOpcion | null>(null);
  const [contacto, setContacto] = useState<ContactoOpcion | null>(null);
  const [opcionesProducto, setOpcionesProducto] = useState<ProductoOpcion[]>([]);
  const [opcionesContacto, setOpcionesContacto] = useState<ContactoOpcion[]>([]);
  const [buscandoProducto, setBuscandoProducto] = useState(false);
  const [buscandoContacto, setBuscandoContacto] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [excluirSinMovimiento, setExcluirSinMovimiento] = useState(true);

  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<VolumenProductoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      } finally {
        setBuscandoProducto(false);
      }
    }, 250);
  }, []);

  const buscarContactos = useCallback(
    (input: string) => {
      if (contactoTimer.current) clearTimeout(contactoTimer.current);
      contactoTimer.current = setTimeout(async () => {
        setBuscandoContacto(true);
        try {
          const qs = new URLSearchParams({ limit: '40', tipos: config.tiposContacto.join(',') });
          if (input.trim()) qs.set('search', input.trim());
          const res = await apiFetch(`/api/contactos?${qs.toString()}`);
          if (res.ok) {
            const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[] };
            const items = Array.isArray(raw) ? raw : ((raw as { data?: ContactoOpcion[] }).data ?? []);
            setOpcionesContacto(items);
          }
        } finally {
          setBuscandoContacto(false);
        }
      }, 250);
    },
    [config.tiposContacto]
  );

  // Auto-refresh con debounce
  useEffect(() => {
    if (!fechaInicio || !fechaFin) return;
    const params: VolumenProductoParams = {
      fecha_inicio: fechaInicio,
      fecha_fin:    fechaFin,
      producto_id:  producto?.id ?? null,
      contacto_id:  contacto?.id ?? null,
      detalle:      mostrarDetalle,
      excluir_sin_movimiento: excluirSinMovimiento,
    };
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await config.fetchFn(params);
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
  }, [fechaInicio, fechaFin, producto, contacto, mostrarDetalle, excluirSinMovimiento]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!resultado || exportando) return;
    setExportando(formato);
    try {
      const params: VolumenProductoParams = {
        fecha_inicio: fechaInicio,
        fecha_fin:    fechaFin,
        producto_id:  producto?.id ?? null,
        contacto_id:  contacto?.id ?? null,
        detalle:      mostrarDetalle,
        excluir_sin_movimiento: excluirSinMovimiento,
      };
      const url = config.buildExportUrl(params, formato);
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const ext = formato === 'excel' ? 'xlsx' : 'pdf';
      const filename = match?.[1] ?? `reporte-producto.${ext}`;
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

  const columnsResumen = useMemo(
    () => buildColumnsResumen(config.ultimoPrecioLabel),
    [config.ultimoPrecioLabel]
  );

  // ── Indicadores resumen ──
  const productos     = resultado?.productos ?? [];
  const totalGeneral  = productos.reduce((s, p) => s + p.total, 0);
  const totalSubtotal = productos.reduce((s, p) => s + p.subtotal, 0);
  const totalCantidad = productos.reduce((s, p) => s + p.cantidad_total, 0);
  const precioProm    = totalCantidad > 0 ? totalSubtotal / totalCantidad : 0;
  const principal     = productos[0] ?? null;

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/informes')}
          sx={{ color: 'text.secondary' }}
        >
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">
          {config.categoriaLabel}
        </Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>
          {config.titulo}
        </Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>{config.titulo}</Typography>
        <Typography variant="caption" color="text.secondary">{config.descripcion}</Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Fecha inicial"
            type="date"
            size="small"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
          <TextField
            label="Fecha final"
            type="date"
            size="small"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />

          {/* Autocomplete de producto */}
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
            sx={{ width: 240 }}
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

          {/* Autocomplete de contacto */}
          <Autocomplete<ContactoOpcion>
            options={opcionesContacto}
            loading={buscandoContacto}
            value={contacto}
            onChange={(_, val) => setContacto(val)}
            onInputChange={(_, input) => buscarContactos(input)}
            onOpen={() => { if (!opcionesContacto.length) buscarContactos(''); }}
            getOptionLabel={(o) => o.nombre}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 220 }}
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

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox
                size="small"
                checked={excluirSinMovimiento}
                onChange={(e) => setExcluirSinMovimiento(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                Excluir sin movimiento
              </Typography>
            }
          />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox
                size="small"
                checked={mostrarDetalle}
                onChange={(e) => setMostrarDetalle(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                Mostrar detalle
              </Typography>
            }
          />

          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={!resultado || !!exportando}
              startIcon={exportando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={() => void handleExportar('pdf')}
            >
              PDF
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!resultado || !!exportando}
              startIcon={exportando === 'excel' ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar('excel')}
            >
              Excel
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Tarjetas KPI */}
      {resultado && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <SummaryCard
            icon={InventoryIcon}
            label="Artículos con movimiento"
            value={String(productos.length)}
            color="#1d2f68"
          />
          <SummaryCard
            icon={AttachMoneyIcon}
            label={config.totalLabel}
            value={`$${formatMXN(totalGeneral)}`}
            color="#006261"
          />
          <SummaryCard
            icon={TrendingUpIcon}
            label="Precio prom. ponderado"
            value={totalCantidad > 0 ? `$${formatMXN(precioProm)}` : '—'}
            color="#7c3aed"
          />
          <SummaryCard
            icon={StarIcon}
            label="Artículo principal"
            value={principal ? `${principal.clave}` : '—'}
            color="#b45309"
          />
        </Box>
      )}

      {/* Contenido */}
      <Paper sx={{ p: 1.5 }}>
        {!resultado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}

        {resultado && !mostrarDetalle && (
          <>
            <Box sx={{ height: 520 }}>
              <DataGrid
                density="standard"
                rows={productos}
                columns={columnsResumen}
                getRowId={(row) => (row as ProductoVolumen).grupo_key}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                localeText={{
                  ...esES.components.MuiDataGrid.defaultProps.localeText,
                  noRowsLabel: 'Sin productos con movimiento en el período indicado',
                }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
              />
            </Box>
            {productos.length > 0 && (
              <Box
                sx={{
                  display: 'flex', gap: 3, mt: 1.5, pt: 1.5,
                  borderTop: '2px solid', borderColor: 'primary.main',
                  justifyContent: 'flex-end', flexWrap: 'wrap',
                }}
              >
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Artículos</Typography>
                  <Typography variant="body2" fontWeight={700}>{productos.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Cantidad total</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatCantidad(totalCantidad)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">{config.totalLabel}</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                    ${formatMXN(totalGeneral)}
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        )}

        {resultado && mostrarDetalle && (
          <>
            <DetalleTable
              productos={productos}
              partidas={resultado.partidas}
              contactoLabel={config.contactoLabel}
            />
            {productos.length > 0 && (
              <Box
                sx={{
                  display: 'flex', gap: 3, mt: 2, pt: 1.5,
                  borderTop: '2px solid', borderColor: 'primary.main',
                  justifyContent: 'flex-end', flexWrap: 'wrap',
                }}
              >
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Artículos</Typography>
                  <Typography variant="body2" fontWeight={700}>{productos.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Cantidad total</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatCantidad(totalCantidad)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">{config.totalLabel}</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                    ${formatMXN(totalGeneral)}
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        )}

        {resultado && productos.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Sin productos con movimiento en el período indicado.
          </Typography>
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
