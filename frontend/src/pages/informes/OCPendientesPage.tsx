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
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
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
  OCPendientesParams,
  OCPendientesResult,
  OCPendienteOC,
  OCPendientePartida,
} from '../../services/reportesService';

export type OCPendientesPageConfig = {
  titulo: string;
  descripcion: string;
  categoriaLabel: string;
  tiposContacto: string[];
  contactoLabel: string;
  fetchFn: (params: OCPendientesParams) => Promise<OCPendientesResult>;
  buildExportUrl: (params: OCPendientesParams, formato: 'excel' | 'pdf') => string;
};

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

type FilaDetalle =
  | ({ _tipo: 'oc' } & OCPendienteOC)
  | ({ _tipo: 'partida' } & OCPendientePartida & { _folio_oc: string });

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCant = (v: number) =>
  v.toLocaleString('es-MX', { maximumFractionDigits: 4 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function flattenDetalle(ordenes: OCPendienteOC[], partidas: OCPendientePartida[]): FilaDetalle[] {
  const porOC = new Map<number, OCPendientePartida[]>();
  for (const p of partidas) {
    if (!porOC.has(p.oc_id)) porOC.set(p.oc_id, []);
    porOC.get(p.oc_id)!.push(p);
  }
  const filas: FilaDetalle[] = [];
  for (const o of ordenes) {
    filas.push({ _tipo: 'oc', ...o });
    for (const p of porOC.get(o.oc_id) ?? []) {
      filas.push({ _tipo: 'partida', ...p, _folio_oc: o.folio });
    }
  }
  return filas;
}

function buildColumnsResumen(): GridColDef<OCPendienteOC>[] {
  return [
    {
      field: 'fecha_oc',
      headerName: 'Fecha OC',
      width: 100,
      renderCell: (p: GridRenderCellParams<OCPendienteOC, string>) => formatFecha(p.value ?? ''),
    },
    { field: 'folio', headerName: 'Folio', width: 110 },
    { field: 'proveedor_nombre', headerName: 'Proveedor', flex: 1, minWidth: 160 },
    {
      field: 'total_oc',
      headerName: 'Importe OC',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<OCPendienteOC, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'cantidad_ordenada',
      headerName: 'Cant. Ordenada',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<OCPendienteOC, number>) => formatCant(p.value ?? 0),
    },
    {
      field: 'cantidad_materializada',
      headerName: 'Cant. Recibida',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<OCPendienteOC, number>) => formatCant(p.value ?? 0),
    },
    {
      field: 'cantidad_pendiente',
      headerName: 'Cant. Pendiente',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<OCPendienteOC, number>) => {
        const v = p.value ?? 0;
        return (
          <Typography variant="body2" fontWeight={700} color={v > 0 ? 'error.main' : 'text.primary'}>
            {formatCant(v)}
          </Typography>
        );
      },
    },
    {
      field: 'pct_recibido',
      headerName: '% Recibido',
      width: 105,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<OCPendienteOC, number>) => `${(p.value ?? 0).toFixed(1)} %`,
    },
    {
      field: 'dias_transcurridos',
      headerName: 'Días',
      width: 70,
      align: 'right',
      headerAlign: 'right',
    },
  ];
}

function buildColumnsDetalle(): GridColDef<FilaDetalle>[] {
  return [
    {
      field: '_folio_col',
      headerName: 'Folio / Clave',
      width: 130,
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        if (row._tipo === 'oc') {
          return (
            <Typography variant="body2" fontWeight={700} color="primary">
              {row.folio}
            </Typography>
          );
        }
        return <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5 }}>{row.clave}</Typography>;
      },
    },
    {
      field: '_desc_col',
      headerName: 'Proveedor / Descripción',
      flex: 1,
      minWidth: 180,
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        if (row._tipo === 'oc') {
          return <Typography variant="body2">{row.proveedor_nombre}</Typography>;
        }
        return (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5 }}>
            {row.descripcion}
          </Typography>
        );
      },
    },
    {
      field: '_fecha_col',
      headerName: 'Fecha / Ud.',
      width: 100,
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        if (row._tipo === 'oc') {
          return <Typography variant="body2">{formatFecha(row.fecha_oc)}</Typography>;
        }
        return <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5 }}>{row.unidad}</Typography>;
      },
    },
    {
      field: 'cantidad_ordenada',
      headerName: 'Ordenado',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        const v = 'cantidad_ordenada' in row ? row.cantidad_ordenada : 0;
        const bold = row._tipo === 'oc';
        return (
          <Typography variant="body2" fontWeight={bold ? 700 : 400}>
            {formatCant(v)}
          </Typography>
        );
      },
    },
    {
      field: 'cantidad_materializada',
      headerName: 'Recibido',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        const v = 'cantidad_materializada' in row ? row.cantidad_materializada : 0;
        const bold = row._tipo === 'oc';
        return (
          <Typography variant="body2" fontWeight={bold ? 700 : 400}>
            {formatCant(v)}
          </Typography>
        );
      },
    },
    {
      field: 'cantidad_pendiente',
      headerName: 'Pendiente',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        const v = 'cantidad_pendiente' in row ? row.cantidad_pendiente : 0;
        const bold = row._tipo === 'oc';
        return (
          <Typography variant="body2" fontWeight={bold ? 700 : 400} color={v > 0 ? 'error.main' : 'text.primary'}>
            {formatCant(v)}
          </Typography>
        );
      },
    },
    {
      field: 'pct_recibido',
      headerName: '% Recibido',
      width: 95,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaDetalle>) => {
        const row = p.row as FilaDetalle;
        const v = 'pct_recibido' in row ? row.pct_recibido : 0;
        return `${v.toFixed(1)} %`;
      },
    },
  ];
}

export default function OCPendientesPage({ config }: { config: OCPendientesPageConfig }) {
  const navigate = useNavigate();

  const [proveedor, setProveedor] = useState<ContactoOpcion | null>(null);
  const [opciones, setOpciones] = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fechaCorte, setFechaCorte] = useState(hoy());
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [excluirRecibidas, setExcluirRecibidas] = useState(true);

  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<OCPendientesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarContactos = useCallback(
    (input: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setBuscando(true);
        try {
          const qs = new URLSearchParams({ limit: '40', tipos: config.tiposContacto.join(',') });
          if (input.trim()) qs.set('search', input.trim());
          const res = await apiFetch(`/api/contactos?${qs.toString()}`);
          if (res.ok) {
            const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
            const items = Array.isArray(raw)
              ? raw
              : (raw as { data?: ContactoOpcion[] }).data ?? (raw as { items?: ContactoOpcion[] }).items ?? [];
            setOpciones(items);
          }
        } finally {
          setBuscando(false);
        }
      }, 250);
    },
    [config.tiposContacto]
  );

  const buildParams = (): OCPendientesParams => ({
    ...(fechaCorte ? { fecha_corte: fechaCorte } : {}),
    ...(proveedor ? { contacto_id: proveedor.id } : {}),
    ...(excluirRecibidas === false ? { excluir_completamente_recibidas: false } : {}),
    ...(mostrarDetalle ? { detalle: true } : {}),
  });

  // Auto-refresh: se dispara inmediatamente en carga y ante cualquier cambio de filtro
  useEffect(() => {
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
  }, [proveedor, fechaCorte, mostrarDetalle, excluirRecibidas]);

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
      const ext = formato === 'excel' ? 'xlsx' : formato;
      const filename = match?.[1] ?? `oc-pendientes-recibir.${ext}`;
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
  const columnsDetalle = useMemo(() => buildColumnsDetalle(), []);

  const rowsResumen = resultado?.ordenes ?? [];
  const rowsDetalle = useMemo(
    () => flattenDetalle(resultado?.ordenes ?? [], resultado?.partidas ?? []),
    [resultado]
  );

  const totalOrdenes    = rowsResumen.length;
  const totalPendiente  = rowsResumen.reduce((s, o) => s + o.cantidad_pendiente, 0);
  const pctPromedio     = totalOrdenes > 0
    ? rowsResumen.reduce((s, o) => s + o.pct_recibido, 0) / totalOrdenes
    : 0;
  const ocMasAntigua    = rowsResumen.reduce<string | null>(
    (min, o) => (!min || o.fecha_oc < min ? o.fecha_oc : min), null
  );

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')}
          sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">{config.categoriaLabel}</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>{config.titulo}</Typography>
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
            label="Fecha de corte"
            type="date"
            size="small"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
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
              <TextField {...(inputProps as any)} label={config.contactoLabel} size="small" placeholder="Todos" />
            )}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={<Checkbox size="small" checked={excluirRecibidas} onChange={(e) => setExcluirRecibidas(e.target.checked)} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Excluir completamente recibidas</Typography>}
          />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={<Checkbox size="small" checked={mostrarDetalle} onChange={(e) => setMostrarDetalle(e.target.checked)} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Mostrar detalle</Typography>}
          />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, flexShrink: 0 }}>
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

      {/* KPIs */}
      {resultado && (
        <Paper sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Fecha de corte</Typography>
              <Typography variant="body2" fontWeight={600}>{formatFecha(resultado.fecha_corte)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">OC pendientes</Typography>
              <Typography variant="body2" fontWeight={600}>{totalOrdenes}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Cant. total pendiente</Typography>
              <Typography variant="body2" fontWeight={700} color="error.main">{formatCant(totalPendiente)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">% promedio recibido</Typography>
              <Typography variant="body2" fontWeight={600}>{pctPromedio.toFixed(1)} %</Typography>
            </Box>
            {ocMasAntigua && (
              <Box>
                <Typography variant="caption" color="text.secondary">OC más antigua</Typography>
                <Typography variant="body2" fontWeight={600}>{formatFecha(ocMasAntigua)}</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Tabla */}
      <Paper sx={{ p: 1.5 }}>
        {!resultado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}

        {resultado && !mostrarDetalle && (
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="standard"
              rows={rowsResumen}
              columns={columnsResumen}
              getRowId={(row) => (row as OCPendienteOC).oc_id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay órdenes de compra pendientes de recibir',
              }}
              sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
            />
          </Box>
        )}

        {resultado && mostrarDetalle && (
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="standard"
              rows={rowsDetalle}
              columns={columnsDetalle}
              getRowId={(row) => {
                const r = row as FilaDetalle;
                return r._tipo === 'oc'
                  ? `oc-${r.oc_id}`
                  : `partida-${r.partida_oc_id}`;
              }}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              getRowClassName={(params) => (params.row as FilaDetalle)._tipo === 'oc' ? 'fila-oc' : 'fila-partida'}
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay órdenes de compra pendientes de recibir',
              }}
              sx={[
                standardDataGridSx,
                {
                  border: '1px solid',
                  borderColor: 'divider',
                  '& .fila-oc': {
                    bgcolor: '#f0f4ff',
                    fontWeight: 700,
                    borderLeft: '3px solid #1d2f68',
                  },
                  '& .fila-partida': {
                    bgcolor: 'background.paper',
                  },
                },
              ]}
            />
          </Box>
        )}

        {resultado && !loading && rowsResumen.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No hay órdenes de compra pendientes de recibir al {formatFecha(resultado.fecha_corte)}.
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
