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
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../api/apiClient';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../../components/grids/standardDataGridSx';
import {
  fetchPagosClientes,
  fetchPagosProveedores,
  buildPagosClientesExportUrl,
  buildPagosProveedoresExportUrl,
  type PagoRegistrado,
  type PagosParams,
  type PagosResult,
} from '../../../services/reportesService';

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };
type CuentaOpcion   = { id: number; identificador: string; moneda?: string };

type Modo = 'clientes' | 'proveedores';

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const primerDiaMes = () => hoy().slice(0, 8) + '01';

function buildColumns(labelContacto: string): GridColDef<PagoRegistrado>[] {
  return [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<PagoRegistrado, string>) => formatFecha(p.value ?? ''),
    },
    { field: 'folio',           headerName: 'Folio',    width: 110 },
    { field: 'contacto_nombre', headerName: labelContacto, flex: 1, minWidth: 150 },
    { field: 'cuenta_nombre',   headerName: 'Cuenta',   width: 150 },
    {
      field: 'monto',
      headerName: 'Monto',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<PagoRegistrado, number>) => (
        <Typography variant="body2" fontWeight={700}>{formatMXN(p.value ?? 0)}</Typography>
      ),
    },
    { field: 'cuenta_moneda',       headerName: 'Moneda',      width: 80  },
    {
      field: 'metodo_pago_nombre',
      headerName: 'Método',
      width: 140,
      renderCell: (p: GridRenderCellParams<PagoRegistrado, string>) => (
        <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
          {p.value ?? 'Sin especificar'}
        </Typography>
      ),
    },
    { field: 'referencia',          headerName: 'Referencia',  width: 120 },
    { field: 'concepto_nombre',     headerName: 'Concepto',    width: 130 },
    {
      field: 'estado_conciliacion',
      headerName: 'Conciliación',
      width: 110,
      renderCell: (p: GridRenderCellParams<PagoRegistrado, string>) => {
        const v = p.value ?? '';
        const color = v === 'conciliado' ? 'success.main' : v === 'cotejado' ? 'info.main' : 'text.secondary';
        return <Typography variant="caption" color={color} sx={{ textTransform: 'capitalize' }}>{v}</Typography>;
      },
    },
  ];
}

interface PagosPageProps {
  modo: Modo;
}

export default function PagosPage({ modo }: PagosPageProps) {
  const navigate = useNavigate();

  const [contacto, setContacto] = useState<ContactoOpcion | null>(null);
  const [cuenta,   setCuenta]   = useState<CuentaOpcion | null>(null);
  const [opcionesContacto, setOpcionesContacto] = useState<ContactoOpcion[]>([]);
  const [opcionesCuenta,   setOpcionesCuenta]   = useState<CuentaOpcion[]>([]);
  const [buscandoContacto, setBuscandoContacto] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin,    setFechaFin]    = useState(hoy());

  const [loading,    setLoading]    = useState(false);
  const [exportando, setExportando] = useState(false);
  const [resultado,  setResultado]  = useState<PagosResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const esClientes  = modo === 'clientes';
  const titulo      = esClientes ? 'Pagos Recibidos de Clientes' : 'Pagos a Proveedores';
  const subtitulo   = esClientes
    ? 'Cobros registrados en el período seleccionado.'
    : 'Pagos a proveedores registrados en el período seleccionado.';
  const tiposContacto = esClientes ? 'cliente,varios' : 'proveedor,varios';
  const labelContacto = esClientes ? 'Cliente' : 'Proveedor';

  useEffect(() => {
    apiFetch('/api/finanzas/cuentas').then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as CuentaOpcion[];
        setOpcionesCuenta(Array.isArray(data) ? data : []);
      }
    }).catch(() => {});
  }, []);

  const buscarContactos = useCallback((input: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setBuscandoContacto(true);
      try {
        const qs = new URLSearchParams({ limit: '40', tipos: tiposContacto });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/contactos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
          const items = Array.isArray(raw)
            ? raw
            : (raw as { data?: ContactoOpcion[] }).data ?? (raw as { items?: ContactoOpcion[] }).items ?? [];
          setOpcionesContacto(items);
        }
      } finally {
        setBuscandoContacto(false);
      }
    }, 250);
  }, [tiposContacto]);

  const buildParams = (): PagosParams => ({
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    ...(contacto ? { contacto_id: contacto.id } : {}),
    ...(cuenta   ? { cuenta_id:   cuenta.id   } : {}),
  });

  useEffect(() => {
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchFn = esClientes ? fetchPagosClientes : fetchPagosProveedores;
        const data = await fetchFn(buildParams());
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
  }, [modo, contacto, cuenta, fechaInicio, fechaFin]);

  const handleExportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const buildUrl = esClientes ? buildPagosClientesExportUrl : buildPagosProveedoresExportUrl;
      const url = buildUrl(buildParams(), 'excel');
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `pagos-${modo}.xlsx`;
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
      setExportando(false);
    }
  };

  const columns = useMemo(() => buildColumns(labelContacto), [labelContacto]);
  const rows = resultado?.pagos ?? [];

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')}
          sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Finanzas</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>{titulo}</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>{titulo}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitulo}</Typography>
      </Box>

      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Desde"
            type="date"
            size="small"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
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
              <TextField {...(inputProps as any)} label={labelContacto} size="small" placeholder="Todos" />
            )}
          />
          <Autocomplete<CuentaOpcion>
            options={opcionesCuenta}
            value={cuenta}
            onChange={(_, val) => setCuenta(val)}
            getOptionLabel={(o) => o.identificador}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 200 }}
            renderInput={(inputProps) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TextField {...(inputProps as any)} label="Cuenta" size="small" placeholder="Todas" />
            )}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              size="small" variant="outlined"
              disabled={!resultado || exportando}
              startIcon={exportando ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar()}
            >
              Excel
            </Button>
          </Box>
        </Box>
      </Paper>

      {resultado && (
        <Paper sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Período</Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatFecha(resultado.fecha_inicio)} — {formatFecha(resultado.fecha_fin)}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            <Box>
              <Typography variant="caption" color="text.secondary">Total del período</Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">
                {formatMXN(resultado.total)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Registros</Typography>
              <Typography variant="body2" fontWeight={600}>{rows.length}</Typography>
            </Box>
          </Box>
        </Paper>
      )}

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
              getRowId={(row) => (row as PagoRegistrado).id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay pagos registrados en el período seleccionado',
              }}
              sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
            />
          </Box>
        )}
        {resultado && !loading && rows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No se encontraron pagos en el período {formatFecha(resultado.fecha_inicio)} — {formatFecha(resultado.fecha_fin)}.
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
