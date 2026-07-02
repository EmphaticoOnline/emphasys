import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
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
import { useNavigate } from 'react-router-dom';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import { apiFetch } from '../../../api/apiClient';
import {
  fetchKardexProducto,
  buildKardexExportUrl,
  type KardexParams,
  type KardexResult,
  type KardexLinea,
} from '../../../services/reportesService';

const COLOR = '#7c3aed';
const fmt = (v: number) => v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCant = (v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: 4 });
const fmtFecha = (iso: string) => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

function primerDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ProductoOpcion = { id: number; clave: string; descripcion: string };
type AlmacenOpcion = { id: number; nombre: string };

export default function KardexProductoPage() {
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [producto, setProducto] = useState<ProductoOpcion | null>(null);
  const [opcProductos, setOpcProductos] = useState<ProductoOpcion[]>([]);
  const [buscandoP, setBuscandoP] = useState(false);
  const [almacen, setAlmacen] = useState<AlmacenOpcion | null>(null);
  const [almacenes, setAlmacenes] = useState<AlmacenOpcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<KardexResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const timerP = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch('/api/inventario/almacenes?activo=true&limit=100')
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : (data as { data?: AlmacenOpcion[] }).data ?? [];
        setAlmacenes(items);
      })
      .catch(() => {});
  }, []);

  const buscarProductos = (input: string) => {
    if (timerP.current) clearTimeout(timerP.current);
    timerP.current = setTimeout(async () => {
      setBuscandoP(true);
      try {
        const qs = new URLSearchParams({ limit: '40' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/productos?${qs.toString()}`);
        if (res.ok) {
          const raw = await res.json() as ProductoOpcion[] | { data?: ProductoOpcion[] };
          setOpcProductos(Array.isArray(raw) ? raw : raw.data ?? []);
        }
      } finally {
        setBuscandoP(false);
      }
    }, 250);
  };

  useEffect(() => {
    if (!producto || !fechaInicio || !fechaFin) return;
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchKardexProducto({
          producto_id: producto.id,
          almacen_id: almacen?.id ?? null,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        });
        setResultado(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar kardex';
        setError(msg);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [producto, almacen, fechaInicio, fechaFin]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!resultado || !producto || exportando) return;
    setExportando(formato);
    try {
      const params: KardexParams = {
        producto_id: producto.id,
        almacen_id: almacen?.id ?? null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      };
      const url = buildKardexExportUrl(params, formato);
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `kardex.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar');
      setSnackbarOpen(true);
    } finally {
      setExportando(null);
    }
  };

  const lineas = resultado?.lineas ?? [];
  const totalEntradas = lineas.reduce((s, l) => s + l.entrada, 0);
  const totalSalidas  = lineas.reduce((s, l) => s + l.salida, 0);
  const totalValor    = lineas.reduce((s, l) => s + l.valor, 0);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')} sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Inventario</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Kardex de Producto</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Kardex de Producto</Typography>
        <Typography variant="caption" color="text.secondary">Historial cronológico de movimientos de un producto con saldo acumulado.</Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Autocomplete<ProductoOpcion>
            options={opcProductos}
            loading={buscandoP}
            value={producto}
            onChange={(_, val) => setProducto(val)}
            onInputChange={(_, input) => buscarProductos(input)}
            onOpen={() => { if (!opcProductos.length) buscarProductos(''); }}
            getOptionLabel={(o) => `${o.clave} – ${o.descripcion}`}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 280 }}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{o.clave}</Typography>
                  <Typography variant="caption" color="text.secondary">{o.descripcion}</Typography>
                </Box>
              </li>
            )}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            renderInput={(inputProps) => <TextField {...(inputProps as any)} label="Producto *" size="small" />}
          />
          <TextField label="Fecha inicial" type="date" size="small" value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
          <TextField label="Fecha final" type="date" size="small" value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
          <Box
            component="select"
            value={almacen?.id ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const id = Number(e.target.value);
              setAlmacen(id ? (almacenes.find((a) => a.id === id) ?? null) : null);
            }}
            sx={{ height: 36, px: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider', fontSize: '0.875rem', minWidth: 160 }}
          >
            <option value="">Todos los almacenes</option>
            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Button size="small" variant="outlined" color="error" disabled={!resultado || !!exportando}
              startIcon={exportando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={() => void handleExportar('pdf')}>PDF</Button>
            <Button size="small" variant="outlined" disabled={!resultado || !!exportando}
              startIcon={exportando === 'excel' ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar('excel')}>Excel</Button>
          </Box>
        </Box>
      </Paper>

      {!producto && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          Selecciona un producto para ver su kardex.
        </Typography>
      )}

      {/* Tabla kardex */}
      {resultado && (
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mb: 1 }}>
            {resultado.producto_clave} – {resultado.producto_descripcion}
          </Typography>
          {lineas.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Sin movimientos en el período indicado.</Typography>
          ) : (
            <>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 800, '& .MuiTableCell-root': { fontSize: '0.78rem', py: 0.5 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: COLOR }}>
                      {['Fecha', 'Tipo', 'Folio', 'Almacén', 'Entrada', 'Salida', 'Existencia', 'Costo', 'Valor', 'Obs.'].map((h) => (
                        <TableCell key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}
                          align={['Entrada', 'Salida', 'Existencia', 'Costo', 'Valor'].includes(h) ? 'right' : 'left'}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineas.map((l: KardexLinea, i) => (
                      <TableRow key={i} sx={{ '&:nth-of-type(even)': { bgcolor: '#f8f8ff' } }}>
                        <TableCell>{fmtFecha(l.fecha)}</TableCell>
                        <TableCell>{l.tipo_movimiento}</TableCell>
                        <TableCell>
                          {resolverFolioVisual(
                            { serie: l.doc_serie, numero: l.doc_numero, serie_externa: l.doc_serie_externa, numero_externo: l.doc_numero_externo },
                            l.doc_tipo ?? ''
                          )}
                        </TableCell>
                        <TableCell>{l.almacen}</TableCell>
                        <TableCell align="right" sx={{ color: '#16a34a', fontWeight: l.entrada > 0 ? 600 : 400 }}>
                          {l.entrada > 0 ? fmtCant(l.entrada) : ''}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#dc2626', fontWeight: l.salida > 0 ? 600 : 400 }}>
                          {l.salida > 0 ? fmtCant(l.salida) : ''}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCant(l.existencia_despues)}</TableCell>
                        <TableCell align="right">{l.costo_unitario != null ? `$${fmt(l.costo_unitario)}` : '—'}</TableCell>
                        <TableCell align="right" sx={{ color: COLOR }}>{l.valor > 0 ? `$${fmt(l.valor)}` : ''}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.observaciones ?? ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, pt: 1.5, borderTop: '2px solid', borderColor: COLOR, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Movimientos</Typography>
                  <Typography variant="body2" fontWeight={700}>{lineas.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Total Entradas</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{fmtCant(totalEntradas)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Total Salidas</Typography>
                  <Typography variant="body2" fontWeight={700} color="error.main">{fmtCant(totalSalidas)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Valor Total</Typography>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: COLOR }}>${fmt(totalValor)}</Typography>
                </Box>
              </Box>
            </>
          )}
        </Paper>
      )}

      {loading && !resultado && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Cargando…</Typography>
        </Box>
      )}

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
