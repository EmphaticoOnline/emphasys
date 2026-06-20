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
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StoreIcon from '@mui/icons-material/Store';
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
  ComprasPorProveedorParams,
  ComprasPorProveedorResult,
  ProveedorCompras,
  FacturaCompraDetalle,
} from '../../services/reportesService';

export type VolumenComprasPageConfig = {
  titulo: string;
  descripcion: string;
  categoriaLabel: string;
  contactoLabel: string;
  tiposContacto: string[];
  fetchFn: (params: ComprasPorProveedorParams) => Promise<ComprasPorProveedorResult>;
  buildExportUrl: (params: ComprasPorProveedorParams, formato: 'excel' | 'pdf') => string;
};

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

const formatMXN = (val: number) =>
  val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ── Tarjeta de resumen ────────────────────────────────────────────────────────

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
    <Paper
      variant="outlined"
      sx={{ p: 1.5, flex: '1 1 160px', minWidth: 140, borderRadius: 2 }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            bgcolor: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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

// ── Columnas vista resumen ────────────────────────────────────────────────────

function buildColumnsResumen(): GridColDef<ProveedorCompras>[] {
  return [
    { field: 'nombre', headerName: 'Proveedor', flex: 1, minWidth: 200 },
    { field: 'rfc', headerName: 'RFC', width: 120 },
    {
      field: 'cantidad_facturas',
      headerName: 'Facturas',
      width: 80,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'subtotal',
      headerName: 'Subtotal',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProveedorCompras, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'iva',
      headerName: 'IVA',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProveedorCompras, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'total_comprado',
      headerName: 'Total Comprado',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProveedorCompras, number>) => (
        <Typography variant="body2" fontWeight={700} color="primary.main">
          {formatMXN(p.value ?? 0)}
        </Typography>
      ),
    },
    {
      field: 'pct_participacion',
      headerName: '% Participación',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProveedorCompras, number>) => (
        <Typography variant="body2" color="text.secondary">
          {(p.value ?? 0).toFixed(2)} %
        </Typography>
      ),
    },
  ];
}

// ── Vista detallada ───────────────────────────────────────────────────────────

function DetalleTable({
  proveedores,
  facturas,
}: {
  proveedores: ProveedorCompras[];
  facturas: FacturaCompraDetalle[];
}) {
  const facturasPorProveedor = useMemo(() => {
    const m = new Map<number, FacturaCompraDetalle[]>();
    for (const f of facturas) {
      if (!m.has(f.proveedor_id)) m.set(f.proveedor_id, []);
      m.get(f.proveedor_id)!.push(f);
    }
    return m;
  }, [facturas]);

  if (proveedores.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin resultados para el período indicado.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {proveedores.map((p) => {
        const facs = facturasPorProveedor.get(p.proveedor_id) ?? [];
        return (
          <Box key={p.proveedor_id}>
            {/* Encabezado del proveedor */}
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
                  {p.nombre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  RFC: {p.rfc || '—'} · {p.cantidad_facturas} factura{p.cantidad_facturas === 1 ? '' : 's'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {formatMXN(p.total_comprado)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {p.pct_participacion.toFixed(2)} %
                </Typography>
              </Box>
            </Box>

            {/* Tabla de facturas */}
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
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell align="right">IVA</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {facs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="caption" color="text.disabled">
                        Sin facturas en el período
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  facs.map((f) => (
                    <TableRow
                      key={f.id}
                      sx={f.cancelado ? { opacity: 0.45, textDecoration: 'line-through' } : {}}
                    >
                      <TableCell>{formatFecha(f.fecha)}</TableCell>
                      <TableCell>{f.folio}</TableCell>
                      <TableCell align="right">{formatMXN(f.subtotal)}</TableCell>
                      <TableCell align="right">{formatMXN(f.iva)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{formatMXN(f.total)}</TableCell>
                    </TableRow>
                  ))
                )}
                {/* Subtotal del proveedor */}
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.74rem' }}>
                    Total {p.nombre}:
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatMXN(p.total_comprado)}
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

export default function VolumenComprasPage({ config }: { config: VolumenComprasPageConfig }) {
  const navigate = useNavigate();

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [proveedor, setProveedor] = useState<ContactoOpcion | null>(null);
  const [opciones, setOpciones] = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<ComprasPorProveedorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarContactos = useCallback(
    (input: string) => {
      if (contactoTimerRef.current) clearTimeout(contactoTimerRef.current);
      contactoTimerRef.current = setTimeout(async () => {
        setBuscando(true);
        try {
          const qs = new URLSearchParams({ limit: '40', tipos: config.tiposContacto.join(',') });
          if (input.trim()) qs.set('search', input.trim());
          const res = await apiFetch(`/api/contactos?${qs.toString()}`);
          if (res.ok) {
            const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
            const items = Array.isArray(raw) ? raw : (raw as { data?: ContactoOpcion[] }).data ?? (raw as { items?: ContactoOpcion[] }).items ?? [];
            setOpciones(items);
          }
        } finally {
          setBuscando(false);
        }
      }, 250);
    },
    [config.tiposContacto]
  );

  // Auto-refresh con debounce
  useEffect(() => {
    if (!fechaInicio || !fechaFin) return;
    const params: ComprasPorProveedorParams = {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      proveedor_id: proveedor?.id ?? null,
      detalle: mostrarDetalle,
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
  }, [fechaInicio, fechaFin, proveedor, mostrarDetalle]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!resultado || exportando) return;
    setExportando(formato);
    try {
      const params: ComprasPorProveedorParams = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        proveedor_id: proveedor?.id ?? null,
        detalle: mostrarDetalle,
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
      const filename = match?.[1] ?? `compras-por-proveedor.${ext}`;
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

  const columnsResumen = useMemo(() => buildColumnsResumen(), []);

  // ── Indicadores resumen ──
  const proveedores = resultado?.proveedores ?? [];
  const totalComprado = proveedores.reduce((s, p) => s + p.total_comprado, 0);
  const totalFacturas = proveedores.reduce((s, p) => s + p.cantidad_facturas, 0);
  const facturaPromedio = totalFacturas > 0 ? totalComprado / totalFacturas : 0;
  const principal = proveedores[0] ?? null;

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
          <Autocomplete<ContactoOpcion>
            options={opciones}
            loading={buscando}
            value={proveedor}
            onChange={(_, val) => setProveedor(val)}
            onInputChange={(_, input) => buscarContactos(input)}
            onOpen={() => { if (!opciones.length) buscarContactos(''); }}
            getOptionLabel={(o) => o.nombre}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 240 }}
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
                checked={mostrarDetalle}
                onChange={(e) => setMostrarDetalle(e.target.checked)}
              />
            }
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Mostrar detalle</Typography>}
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

      {/* Tarjetas resumen */}
      {resultado && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <SummaryCard
            icon={StoreIcon}
            label="Proveedores activos"
            value={String(proveedores.length)}
            color="#1d2f68"
          />
          <SummaryCard
            icon={ShoppingCartIcon}
            label="Compras totales"
            value={`$${formatMXN(totalComprado)}`}
            color="#006261"
          />
          <SummaryCard
            icon={ReceiptIcon}
            label="Factura promedio"
            value={totalFacturas > 0 ? `$${formatMXN(facturaPromedio)}` : '—'}
            color="#7c3aed"
          />
          <SummaryCard
            icon={TrendingUpIcon}
            label="Principal proveedor"
            value={principal ? principal.nombre : '—'}
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
                rows={proveedores}
                columns={columnsResumen}
                getRowId={(row) => (row as ProveedorCompras).proveedor_id}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                localeText={{
                  ...esES.components.MuiDataGrid.defaultProps.localeText,
                  noRowsLabel: 'Sin compras en el período indicado',
                }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
              />
            </Box>
            {/* Totales */}
            {proveedores.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  mt: 1.5,
                  pt: 1.5,
                  borderTop: '2px solid',
                  borderColor: 'primary.main',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Proveedores</Typography>
                  <Typography variant="body2" fontWeight={700}>{proveedores.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Facturas</Typography>
                  <Typography variant="body2" fontWeight={700}>{totalFacturas.toLocaleString('es-MX')}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Total Comprado</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                    ${formatMXN(totalComprado)}
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        )}

        {resultado && mostrarDetalle && (
          <>
            <DetalleTable proveedores={proveedores} facturas={resultado.facturas} />
            {/* Totales generales */}
            {proveedores.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  mt: 2,
                  pt: 1.5,
                  borderTop: '2px solid',
                  borderColor: 'primary.main',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Proveedores</Typography>
                  <Typography variant="body2" fontWeight={700}>{proveedores.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Facturas</Typography>
                  <Typography variant="body2" fontWeight={700}>{totalFacturas.toLocaleString('es-MX')}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Total Comprado</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                    ${formatMXN(totalComprado)}
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        )}

        {resultado && proveedores.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Sin compras en el período indicado.
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
