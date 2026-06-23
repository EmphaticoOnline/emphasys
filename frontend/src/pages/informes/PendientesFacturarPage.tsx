import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
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
  PendientesFacturarParams,
  PendientesFacturarResult,
  PendienteFacturarDoc,
} from '../../services/reportesService';

export type PendientesFacturarPageConfig = {
  titulo:         string;
  descripcion:    string;
  categoriaLabel: string;
  docLabel:       string;
  conAvance:      boolean;
  tiposContacto:  string[];
  contactoLabel:  string;
  fetchFn:        (params: PendientesFacturarParams) => Promise<PendientesFacturarResult>;
  buildExportUrl: (params: PendientesFacturarParams, formato: 'excel' | 'pdf') => string;
};

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function buildColumns(docLabel: string, conAvance: boolean): GridColDef<PendienteFacturarDoc>[] {
  const cols: GridColDef<PendienteFacturarDoc>[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<PendienteFacturarDoc, string>) => formatFecha(p.value ?? ''),
    },
    { field: 'folio', headerName: 'Folio', width: 120 },
    { field: 'cliente_nombre', headerName: 'Cliente', flex: 1, minWidth: 160 },
    {
      field: 'total_doc',
      headerName: `Total ${docLabel}`,
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<PendienteFacturarDoc, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'total_facturado',
      headerName: 'Facturado',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<PendienteFacturarDoc, number>) => (
        <Typography variant="body2" color="success.main">
          {formatMXN(p.value ?? 0)}
        </Typography>
      ),
    },
    {
      field: 'total_pendiente',
      headerName: 'Pendiente',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<PendienteFacturarDoc, number>) => (
        <Typography variant="body2" fontWeight={700} color="error.main">
          {formatMXN(p.value ?? 0)}
        </Typography>
      ),
    },
  ];

  if (conAvance) {
    cols.push({
      field: 'pct_avance',
      headerName: '% Avance',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<PendienteFacturarDoc, number>) =>
        `${(p.value ?? 0).toFixed(1)} %`,
    });
  }

  return cols;
}

export default function PendientesFacturarPage({ config }: { config: PendientesFacturarPageConfig }) {
  const navigate = useNavigate();

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin]       = useState(hoy());
  const [cliente, setCliente]         = useState<ContactoOpcion | null>(null);
  const [opciones, setOpciones]       = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando]       = useState(false);

  const [loading, setLoading]       = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado]   = useState<PendientesFacturarResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clienteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarContactos = useCallback(
    (input: string) => {
      if (clienteTimer.current) clearTimeout(clienteTimer.current);
      clienteTimer.current = setTimeout(async () => {
        setBuscando(true);
        try {
          const qs = new URLSearchParams({ limit: '40', tipos: config.tiposContacto.join(',') });
          if (input.trim()) qs.set('search', input.trim());
          const res = await apiFetch(`/api/contactos?${qs.toString()}`);
          if (res.ok) {
            const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[] };
            const items = Array.isArray(raw) ? raw : ((raw as { data?: ContactoOpcion[] }).data ?? []);
            setOpciones(items);
          }
        } finally {
          setBuscando(false);
        }
      }, 250);
    },
    [config.tiposContacto]
  );

  const buildParams = (): PendientesFacturarParams => ({
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    ...(cliente ? { contacto_id: cliente.id } : {}),
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
  }, [fechaInicio, fechaFin, cliente]);

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
      const filename = match?.[1] ?? `pendientes-facturar.${ext}`;
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

  const columns = useMemo(
    () => buildColumns(config.docLabel, config.conAvance),
    [config.docLabel, config.conAvance]
  );
  const rows = resultado?.documentos ?? [];

  const totalDoc       = rows.reduce((s, r) => s + r.total_doc, 0);
  const totalFacturado = rows.reduce((s, r) => s + r.total_facturado, 0);
  const totalPendiente = rows.reduce((s, r) => s + r.total_pendiente, 0);

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
            value={cliente}
            onChange={(_, val) => setCliente(val)}
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
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Paper variant="outlined" sx={{ p: 1.5, flex: '0 1 120px', minWidth: 100, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Documentos</Typography>
            <Typography variant="subtitle2" fontWeight={700}>{rows.length}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 140px', minWidth: 130, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Total {config.docLabel}
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              {formatMXN(totalDoc)}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 140px', minWidth: 130, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Total Facturado</Typography>
            <Typography variant="subtitle2" fontWeight={700} color="success.main">
              {formatMXN(totalFacturado)}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 140px', minWidth: 130, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Total Pendiente</Typography>
            <Typography variant="subtitle2" fontWeight={700} color="error.main">
              {formatMXN(totalPendiente)}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Tabla */}
      <Paper sx={{ p: 1.5 }}>
        {!resultado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}

        {resultado && (
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="standard"
              rows={rows}
              columns={columns}
              getRowId={(row) => (row as PendienteFacturarDoc).doc_id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: `No hay ${config.docLabel.toLowerCase()}s pendientes de facturar en el período`,
              }}
              sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
            />
          </Box>
        )}

        {resultado && !loading && rows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No hay {config.docLabel.toLowerCase()}s pendientes de facturar en el período{' '}
            {formatFecha(fechaInicio)} – {formatFecha(fechaFin)}.
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
