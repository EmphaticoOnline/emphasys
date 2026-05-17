import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import {
  fetchPreciosCaptura,
  savePreciosBatch,
  type PrecioBatchItem,
  type PreciosCapturaResponse,
} from '../../services/preciosService';

const EMPTY_DATA: PreciosCapturaResponse = {
  listas: [],
  productos: [],
  filtros: {
    clasificaciones: [],
    familias: [],
  },
};

const SAVE_DEBOUNCE_MS = 700;
const STICKY_LEFT_CLAVE = 0;
const STICKY_LEFT_DESCRIPCION = 140;

function getCellKey(productoId: number, listaId: number): string {
  return `${productoId}:${listaId}`;
}

function precioToInputValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function parsePrecioInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('El precio debe ser numérico y mayor o igual a cero');
  }

  return parsed;
}

export default function PreciosPage() {
  const [data, setData] = React.useState<PreciosCapturaResponse>(EMPTY_DATA);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = React.useState<Set<string>>(new Set());
  const [filters, setFilters] = React.useState({
    clave: '',
    descripcion: '',
    clasificacion: '',
    familia: '',
  });
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const pendingRef = React.useRef<Map<string, PrecioBatchItem>>(new Map());
  const flushTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async (nextFilters = filters) => {
    try {
      setLoading(true);
      const response = await fetchPreciosCaptura(nextFilters);
      setData(response);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la captura masiva de precios');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const applySavedItems = React.useCallback((items: PrecioBatchItem[]) => {
    setData((prev) => ({
      ...prev,
      productos: prev.productos.map((producto) => {
        const updates = items.filter((item) => item.producto_id === producto.producto_id);
        if (!updates.length) return producto;

        const nextPrecios = { ...producto.precios };
        for (const update of updates) {
          nextPrecios[String(update.precio_lista_id)] = update.precio;
        }

        return {
          ...producto,
          precios: nextPrecios,
        };
      }),
    }));
  }, []);

  const clearSavedKeys = React.useCallback((keys: string[]) => {
    setDrafts((prev) => {
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  const releaseSavingKeys = React.useCallback((keys: string[]) => {
    setSavingKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.delete(key));
      return next;
    });
  }, []);

  const executeBatchSave = React.useCallback(async (entries: Array<[string, PrecioBatchItem]>) => {
    if (!entries.length) return;

    const keys = entries.map(([key]) => key);
    const items = entries.map(([, item]) => item);

    try {
      setSaving(true);
      const response = await savePreciosBatch(items);
      applySavedItems(items);
      clearSavedKeys(keys);

      const totalGuardados = response.deleted_count + response.updated_count + response.inserted_count;
      setSnackbar({
        open: true,
        message: totalGuardados === 1 ? '1 precio guardado' : `${totalGuardados} precios guardados`,
        severity: 'success',
      });
    } catch (saveError) {
      setSnackbar({
        open: true,
        message: saveError instanceof Error ? saveError.message : 'No se pudieron guardar los precios',
        severity: 'error',
      });
    } finally {
      setSaving(false);
      releaseSavingKeys(keys);
    }
  }, [applySavedItems, clearSavedKeys, releaseSavingKeys]);

  const scheduleFlush = React.useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    flushTimeoutRef.current = setTimeout(() => {
      const entries = Array.from(pendingRef.current.entries());
      if (!entries.length) return;
      pendingRef.current.clear();
      void executeBatchSave(entries);
    }, SAVE_DEBOUNCE_MS);
  }, [executeBatchSave]);

  const flushNow = React.useCallback(async () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    const entries = Array.from(pendingRef.current.entries());
    if (!entries.length) return;
    pendingRef.current.clear();
    await executeBatchSave(entries);
  }, [executeBatchSave]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      void load(filters);
    }, 250);

    return () => clearTimeout(timeout);
  }, [filters, load]);

  React.useEffect(() => () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
  }, []);

  const queueSave = React.useCallback((productoId: number, listaId: number, rawValue: string) => {
    const key = getCellKey(productoId, listaId);

    try {
      const parsed = parsePrecioInput(rawValue);
      pendingRef.current.set(key, {
        producto_id: productoId,
        precio_lista_id: listaId,
        precio: parsed,
      });

      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      scheduleFlush();
    } catch (parseError) {
      setSnackbar({
        open: true,
        message: parseError instanceof Error ? parseError.message : 'Valor inválido',
        severity: 'error',
      });
    }
  }, [scheduleFlush]);

  const pendientesCount = pendingRef.current.size;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Administración de precios
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Captura precios por producto y por lista de precios activa en una cuadrícula tipo Excel.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load(filters)} disabled={loading || saving}>
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => void flushNow()}
            disabled={saving || pendientesCount === 0}
          >
            Guardar pendientes
          </Button>
        </Stack>
      </Toolbar>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!data.listas.length && !loading ? (
        <Alert severity="warning">No hay listas de precios VENTA activas. Primero crea y activa tus listas.</Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Buscar por clave"
            value={filters.clave}
            onChange={(event) => setFilters((prev) => ({ ...prev, clave: event.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            size="small"
            label="Buscar por descripción"
            value={filters.descripcion}
            onChange={(event) => setFilters((prev) => ({ ...prev, descripcion: event.target.value }))}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="precios-clasificacion-label">Clasificación</InputLabel>
            <Select
              labelId="precios-clasificacion-label"
              label="Clasificación"
              value={filters.clasificacion}
              onChange={(event) => setFilters((prev) => ({ ...prev, clasificacion: event.target.value }))}
            >
              <MenuItem value="">Todas</MenuItem>
              {data.filtros.clasificaciones.map((clasificacion) => (
                <MenuItem key={clasificacion} value={clasificacion}>
                  {clasificacion}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="precios-familia-label">Familia</InputLabel>
            <Select
              labelId="precios-familia-label"
              label="Familia"
              value={filters.familia}
              onChange={(event) => setFilters((prev) => ({ ...prev, familia: event.target.value }))}
            >
              <MenuItem value="">Todas</MenuItem>
              {data.filtros.familias.map((familia) => (
                <MenuItem key={familia} value={familia}>
                  {familia}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 260px)', overflowX: 'auto' }}>
          <Table stickyHeader sx={{ minWidth: 740 + data.listas.length * 160 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: STICKY_LEFT_CLAVE,
                    zIndex: 4,
                    backgroundColor: '#1d2f68',
                    color: '#fff',
                    minWidth: 140,
                    fontWeight: 700,
                  }}
                >
                  Clave
                </TableCell>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: STICKY_LEFT_DESCRIPCION,
                    zIndex: 4,
                    backgroundColor: '#1d2f68',
                    color: '#fff',
                    minWidth: 260,
                    fontWeight: 700,
                  }}
                >
                  Descripción
                </TableCell>
                <TableCell sx={{ minWidth: 160, backgroundColor: '#1d2f68', color: '#fff', fontWeight: 700 }}>
                  Clasificación
                </TableCell>
                <TableCell sx={{ minWidth: 160, backgroundColor: '#1d2f68', color: '#fff', fontWeight: 700 }}>
                  Familia
                </TableCell>
                {data.listas.map((lista) => (
                  <TableCell key={lista.id} align="center" sx={{ minWidth: 160, backgroundColor: '#1d2f68', color: '#fff', fontWeight: 700 }}>
                    <Stack spacing={0.5} alignItems="center">
                      <span>{lista.nombre}</span>
                      {lista.es_default ? <Chip size="small" color="primary" label="Default" /> : null}
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4 + data.listas.length} align="center" sx={{ py: 6 }}>
                    <Stack spacing={1} alignItems="center">
                      <CircularProgress size={24} />
                      <Typography variant="body2" color="text.secondary">
                        Cargando precios...
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading && !data.productos.length ? (
                <TableRow>
                  <TableCell colSpan={4 + data.listas.length} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No hay productos para los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading && data.productos.map((producto, rowIndex) => (
                <TableRow key={producto.producto_id} hover sx={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : 'rgba(0,120,70,0.03)' }}>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: STICKY_LEFT_CLAVE,
                      zIndex: 3,
                      backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#f9fcfa',
                      fontWeight: 600,
                    }}
                  >
                    {producto.clave || '—'}
                  </TableCell>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: STICKY_LEFT_DESCRIPCION,
                      zIndex: 3,
                      backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#f9fcfa',
                    }}
                  >
                    <Stack spacing={0.25}>
                      <Typography variant="body2" fontWeight={600}>
                        {producto.descripcion}
                      </Typography>
                      {!producto.activo ? <Chip size="small" label="Inactivo" variant="outlined" /> : null}
                    </Stack>
                  </TableCell>
                  <TableCell>{producto.clasificacion || '—'}</TableCell>
                  <TableCell>{producto.familia || '—'}</TableCell>
                  {data.listas.map((lista) => {
                    const key = getCellKey(producto.producto_id, lista.id);
                    const currentValue = drafts[key] ?? precioToInputValue(producto.precios[String(lista.id)]);
                    const isSavingCell = savingKeys.has(key);

                    return (
                      <TableCell key={lista.id} align="center">
                        <TextField
                          size="small"
                          type="text"
                          value={currentValue}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDrafts((prev) => ({ ...prev, [key]: value }));
                          }}
                          onBlur={() => queueSave(producto.producto_id, lista.id, currentValue)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              queueSave(producto.producto_id, lista.id, currentValue);
                              void flushNow();
                            }
                          }}
                          inputProps={{
                            inputMode: 'decimal',
                            style: { textAlign: 'right', minWidth: 110 },
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: isSavingCell ? 'rgba(37, 99, 235, 0.08)' : '#fff',
                            },
                          }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Productos cargados: {data.productos.length}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Listas activas: {data.listas.length}
        </Typography>
        <Typography variant="body2" color={pendientesCount > 0 ? '#b45309' : 'text.secondary'}>
          Pendientes por guardar: {pendientesCount}
        </Typography>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}