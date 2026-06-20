import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  Paper,
  Snackbar,
  Alert,
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
  EstadoCuentaParams,
  EstadoCuentaResult,
  MovimientoEstadoCuenta,
} from '../../services/reportesService';

export type EstadoCuentaPageConfig = {
  titulo: string;
  descripcion: string;
  contactoLabel: string;
  tiposContacto: string[];
  categoriaLabel: string;
  fetchFn: (params: EstadoCuentaParams) => Promise<EstadoCuentaResult>;
  buildExportUrl: (params: EstadoCuentaParams, formato: 'excel' | 'csv' | 'pdf') => string;
};

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

// Fila plana para el DataGrid en modo detalle.
// Las columnas de análisis documental (total_doc, aplicado, saldo) son distintas
// de las del estado de cuenta estándar (cargo, abono, saldo acumulado).
type FilaPlana = {
  _id: string;
  _nivel: 0 | 1;
  _es_cargo: boolean;
  fecha: string;
  folio: string;
  tipo_etiqueta: string;
  concepto: string;
  total_doc: number;   // importe original del documento; 0 para filas de aplicación
  aplicado: number;    // monto aplicado al doc. (doc: total-saldo_actual); (aplicacion: monto)
  saldo: number;       // saldo_actual del doc para nivel 0; 0 para nivel 1
  cancelado: boolean;
};

const formatMXN = (val: number) =>
  val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const colorSaldo = (v: number, cancelado = false) => {
  if (cancelado) return '#9ca3af';
  if (v > 0) return '#dc2626';
  if (v < 0) return '#16a34a';
  return '#111827';
};

const hoy = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function flattenMovimientos(movimientos: MovimientoEstadoCuenta[]): FilaPlana[] {
  const filas: FilaPlana[] = [];
  for (const m of movimientos) {
    const totalDoc = m.total_original ?? 0;
    const saldoAct = m.cancelado ? 0 : (m.saldo_actual ?? 0);
    const aplicado = m.cancelado ? 0 : Math.max(0, totalDoc - saldoAct);
    filas.push({
      _id:           `doc-${m.id}`,
      _nivel:        0,
      _es_cargo:     m.es_cargo,
      fecha:         m.fecha,
      folio:         m.folio,
      tipo_etiqueta: m.tipo_etiqueta,
      concepto:      m.concepto,
      total_doc:     totalDoc,
      aplicado,
      saldo:         saldoAct,
      cancelado:     m.cancelado,
    });
    for (const a of m.aplicaciones ?? []) {
      filas.push({
        _id:           `apl-${m.id}-${a.id}`,
        _nivel:        1,
        _es_cargo:     false,
        fecha:         a.fecha,
        folio:         a.folio,
        tipo_etiqueta: a.tipo_etiqueta,
        concepto:      '',
        total_doc:     0,
        aplicado:      a.monto,
        saldo:         0,
        cancelado:     false,
      });
    }
  }
  return filas;
}

function buildColumnsEstandar(): GridColDef<MovimientoEstadoCuenta>[] {
  return [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, string>) => (
        <span style={p.row.cancelado ? { color: '#9ca3af', textDecoration: 'line-through' } : {}}>
          {formatFecha(p.value ?? '')}
        </span>
      ),
    },
    {
      field: 'folio',
      headerName: 'Folio',
      width: 120,
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, string>) => (
        <span style={p.row.cancelado ? { color: '#9ca3af', textDecoration: 'line-through' } : {}}>
          {p.value}
        </span>
      ),
    },
    {
      field: 'tipo_etiqueta',
      headerName: 'Tipo',
      width: 105,
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, string>) =>
        p.row.cancelado ? (
          <Chip label="Cancelado" size="small" sx={{ fontSize: 10, height: 18, color: '#9ca3af' }} variant="outlined" />
        ) : (
          <span>{p.value}</span>
        ),
    },
    {
      field: 'concepto',
      headerName: 'Concepto',
      flex: 1,
      minWidth: 150,
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, string>) => (
        <span style={p.row.cancelado ? { color: '#9ca3af' } : {}}>{p.value}</span>
      ),
    },
    {
      field: 'cargo',
      headerName: 'Cargo',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, number>) => {
        const v = p.value ?? 0;
        return v > 0 ? (
          <span style={p.row.cancelado ? { color: '#9ca3af' } : {}}>{formatMXN(v)}</span>
        ) : null;
      },
    },
    {
      field: 'abono',
      headerName: 'Abono',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, number>) => {
        const v = p.value ?? 0;
        return v > 0 ? (
          <span style={p.row.cancelado ? { color: '#9ca3af' } : {}}>{formatMXN(v)}</span>
        ) : null;
      },
    },
    {
      field: 'saldo_actual',
      headerName: 'Saldo',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<MovimientoEstadoCuenta, number>) => {
        const v = p.value ?? 0;
        const color = p.row.cancelado
          ? '#9ca3af'
          : v === 0
          ? '#111827'
          : p.row.es_cargo
          ? '#dc2626'
          : '#16a34a';
        return (
          <Typography variant="body2" fontWeight={600} color={color}>
            {formatMXN(v)}
          </Typography>
        );
      },
    },
  ];
}

// Estilos base para texto en filas de aplicación (nivel 1)
const APL_TEXT: React.CSSProperties = { color: '#4b5563', fontSize: '0.72rem' };

function buildColumnsDetalle(): GridColDef<FilaPlana>[] {
  return [
    // ── Fecha ──────────────────────────────────────────────────────────────
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<FilaPlana, string>) => {
        if (!p.row) return null;
        if (p.row._nivel === 1) {
          return <span style={{ ...APL_TEXT, color: '#9ca3af' }}>{formatFecha(p.value ?? '')}</span>;
        }
        return (
          <span style={p.row.cancelado ? { color: '#9ca3af', textDecoration: 'line-through' } : {}}>
            {formatFecha(p.value ?? '')}
          </span>
        );
      },
    },
    // ── Folio ──────────────────────────────────────────────────────────────
    {
      field: 'folio',
      headerName: 'Folio',
      width: 125,
      renderCell: (p: GridRenderCellParams<FilaPlana, string>) => {
        if (!p.row || p.row._nivel === 1) return null;
        return (
          <span style={p.row.cancelado ? { color: '#9ca3af', textDecoration: 'line-through' } : {}}>
            {p.value}
          </span>
        );
      },
    },
    // ── Tipo ───────────────────────────────────────────────────────────────
    {
      field: 'tipo_etiqueta',
      headerName: 'Tipo',
      width: 100,
      renderCell: (p: GridRenderCellParams<FilaPlana, string>) => {
        if (!p.row || p.row._nivel === 1) return null;
        if (p.row.cancelado) {
          return <Chip label="Cancelado" size="small" sx={{ fontSize: 10, height: 18, color: '#9ca3af' }} variant="outlined" />;
        }
        return <span>{p.value}</span>;
      },
    },
    // ── Concepto ──────────────────────────────────────────────────────────
    // Filas principales: concepto del documento.
    // Filas hijas: línea explicativa "↳ [tipo] [folio] por [monto]".
    {
      field: 'concepto',
      headerName: 'Concepto',
      flex: 1,
      minWidth: 130,
      renderCell: (p: GridRenderCellParams<FilaPlana, string>) => {
        if (!p.row) return null;
        if (p.row._nivel === 1) {
          const desc = `${p.row.tipo_etiqueta} ${p.row.folio} por ${formatMXN(p.row.aplicado)}`;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 1 }}>
              <Typography component="span" sx={{ color: '#c0c9d6', fontSize: '0.72rem', lineHeight: 1, flexShrink: 0 }}>
                ↳
              </Typography>
              <span style={APL_TEXT}>{desc}</span>
            </Box>
          );
        }
        return (
          <span style={p.row.cancelado ? { color: '#9ca3af' } : {}}>
            {p.value}
          </span>
        );
      },
    },
    // ── Total doc. — sólo filas principales ────────────────────────────────
    {
      field: 'total_doc',
      headerName: 'Total doc.',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaPlana, number>) => {
        if (!p.row || p.row._nivel === 1) return null;
        const v = p.value ?? 0;
        return (
          <span style={p.row.cancelado ? { color: '#9ca3af', textDecoration: 'line-through' } : {}}>
            {v > 0 ? formatMXN(v) : '—'}
          </span>
        );
      },
    },
    // ── Aplicado — exclusivo para el total acumulado del documento ─────────
    // Esta columna nunca muestra importes de aplicaciones individuales.
    {
      field: 'aplicado',
      headerName: 'Aplicado',
      width: 115,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaPlana, number>) => {
        if (!p.row || p.row._nivel === 1) return null;
        const v = p.value ?? 0;
        if (v === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
        return (
          <span style={p.row.cancelado ? { color: '#9ca3af' } : {}}>
            {formatMXN(v)}
          </span>
        );
      },
    },
    // ── Saldo — sólo filas principales ────────────────────────────────────
    {
      field: 'saldo',
      headerName: 'Saldo',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<FilaPlana, number>) => {
        if (!p.row || p.row._nivel === 1) return null;
        const v = p.value ?? 0;
        const color = p.row.cancelado
          ? '#9ca3af'
          : v === 0
          ? '#111827'
          : p.row._es_cargo
          ? '#dc2626'
          : '#16a34a';
        return (
          <Typography variant="body2" fontWeight={700} color={color}>
            {formatMXN(v)}
          </Typography>
        );
      },
    },
  ];
}

export default function EstadoCuentaPage({ config }: { config: EstadoCuentaPageConfig }) {
  const navigate = useNavigate();

  const [contacto, setContacto] = useState<ContactoOpcion | null>(null);
  const [opciones, setOpciones] = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fechaCorte, setFechaCorte] = useState(hoy());
  const [incluirCancelados, setIncluirCancelados] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(true);
  const [excluirSinSaldo, setExcluirSinSaldo] = useState(true);

  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<EstadoCuentaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarContactos = useCallback(
    (input: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setBuscando(true);
        try {
          const qs = new URLSearchParams({
            limit: '40',
            tipos: config.tiposContacto.join(','),
          });
          if (input.trim()) qs.set('search', input.trim());
          const res = await apiFetch(`/api/contactos?${qs.toString()}`);
          if (res.ok) {
            const raw = (await res.json()) as
              | ContactoOpcion[]
              | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
            const items = Array.isArray(raw)
              ? raw
              : (raw as { data?: ContactoOpcion[] }).data ??
                (raw as { items?: ContactoOpcion[] }).items ??
                [];
            setOpciones(items);
          }
        } finally {
          setBuscando(false);
        }
      }, 250);
    },
    [config.tiposContacto]
  );

  // buildParams sólo lo usa handleExportar (las consultas de vista se disparan por el useEffect)
  const buildParams = (): EstadoCuentaParams => ({
    contacto_id: contacto!.id,
    ...(fechaCorte ? { fecha_corte: fechaCorte } : {}),
    ...(incluirCancelados ? { incluir_cancelados: true } : {}),
    ...(mostrarDetalle ? { detalle: true } : {}),
  });

  // Auto-refresh: cualquier cambio de filtro dispara una nueva consulta con debounce.
  // excluirSinSaldo no está en las deps porque es un filtro de frontend (saldo_actual siempre viene).
  useEffect(() => {
    if (!contacto) {
      setResultado(null);
      return;
    }
    const params: EstadoCuentaParams = {
      contacto_id: contacto.id,
      ...(fechaCorte ? { fecha_corte: fechaCorte } : {}),
      ...(incluirCancelados ? { incluir_cancelados: true } : {}),
      ...(mostrarDetalle ? { detalle: true } : {}),
    };
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(async () => {
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
    return () => { if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacto, fechaCorte, incluirCancelados, mostrarDetalle]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!contacto || exportando) return;
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
      const filename = match?.[1] ?? `estado-cuenta.${ext}`;
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

  const columnsEstandar = useMemo(() => buildColumnsEstandar(), []);
  const columnsDetalle = useMemo(() => buildColumnsDetalle(), []);

  // "Excluir sin saldo" aplica en ambos modos. Los dos checkboxes son independientes:
  // uno controla QUÉ documentos se muestran, el otro controla CÓMO se presentan.
  const movimientosFiltrados = useMemo(() => {
    const movs = resultado?.movimientos ?? [];
    if (!excluirSinSaldo) return movs;
    return movs.filter((m) => (m.saldo_actual ?? 0) !== 0);
  }, [resultado, excluirSinSaldo]);

  const rowsEstandar = useMemo(() => movimientosFiltrados, [movimientosFiltrados]);
  const rowsDetalle = useMemo(() => flattenMovimientos(movimientosFiltrados), [movimientosFiltrados]);

  const saldoFinal = resultado?.saldo_final ?? 0;

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

      {/* Filtros — fila única */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
        )}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Autocomplete<ContactoOpcion>
            options={opciones}
            loading={buscando}
            value={contacto}
            onChange={(_, val) => setContacto(val)}
            onInputChange={(_, input) => buscarContactos(input)}
            onOpen={() => { if (!opciones.length) buscarContactos(''); }}
            getOptionLabel={(o) => o.nombre}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 260 }}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Box>
                  <Typography variant="body2">{o.nombre}</Typography>
                  {o.rfc && (
                    <Typography variant="caption" color="text.secondary">{o.rfc}</Typography>
                  )}
                </Box>
              </li>
            )}
            renderInput={(inputProps) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TextField {...(inputProps as any)} label={`${config.contactoLabel} *`} size="small" />
            )}
          />
          <TextField
            label="Fecha de corte"
            type="date"
            size="small"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox size="small" checked={mostrarDetalle}
                onChange={(e) => setMostrarDetalle(e.target.checked)} />
            }
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Mostrar aplicaciones</Typography>}
          />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox size="small" checked={excluirSinSaldo}
                onChange={(e) => setExcluirSinSaldo(e.target.checked)} />
            }
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Excluir sin saldo</Typography>}
          />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox size="small" checked={incluirCancelados}
                onChange={(e) => setIncluirCancelados(e.target.checked)} />
            }
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Incluir cancelados</Typography>}
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

      {/* Encabezado del reporte */}
      {resultado && (
        <Paper sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">{config.contactoLabel}</Typography>
              <Typography variant="body2" fontWeight={600}>{resultado.contacto?.nombre ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">RFC</Typography>
              <Typography variant="body2" fontWeight={600}>{resultado.contacto?.rfc ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Fecha de corte</Typography>
              <Typography variant="body2" fontWeight={600}>{formatFecha(resultado.fecha_corte)}</Typography>
            </Box>
            <Box sx={{ ml: 'auto', textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Saldo al corte</Typography>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                color={saldoFinal > 0 ? 'error.main' : saldoFinal < 0 ? 'success.main' : 'text.primary'}
                sx={{ lineHeight: 1.2 }}
              >
                {formatMXN(saldoFinal)}
              </Typography>
              {saldoFinal < 0 && (
                <Typography variant="caption" color="success.main">Saldo a favor</Typography>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Tabla */}
      <Paper sx={{ p: 1.5 }}>
        {!resultado && !loading && (
          <Typography variant="body2" color="text.secondary">
            Selecciona {config.contactoLabel === 'Proveedor' ? 'un' : 'un'} {config.contactoLabel.toLowerCase()} para ver los movimientos.
          </Typography>
        )}
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
              rows={rowsEstandar}
              columns={columnsEstandar}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'Sin movimientos hasta la fecha de corte indicada',
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
              getRowId={(row) => (row as FilaPlana)._id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              getRowClassName={(params) =>
                (params.row as FilaPlana)._nivel === 1 ? 'fila-aplicacion' : ''
              }
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'Sin movimientos hasta la fecha de corte indicada',
              }}
              sx={[
                standardDataGridSx,
                {
                  border: '1px solid',
                  borderColor: 'divider',
                  '& .fila-aplicacion': {
                    bgcolor: '#f8fafc',
                    borderLeft: '3px solid #e2e8f0',
                    '& .MuiDataGrid-cell': {
                      color: '#6b7280',
                    },
                  },
                },
              ]}
            />
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
