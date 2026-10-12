import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { EmphasysDataGrid } from '../components/grids/EmphasysDataGrid';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT } from '../components/grids/standardDataGridSx';
import { catalogoPrimaryButtonSx } from '../components/catalogo/catalogoSurfaces';
import { analizarRecalculo, ejecutarRecalculo, type RecalculoResultado } from '../services/inventarioService';
import { fetchProductos } from '../services/productosService';
import type { Producto } from '../types/producto';

type Alcance = 'producto' | 'todos';

type DiferenciaApi = {
  producto_id: number;
  almacen_id: number;
  almacen?: string | null;
  existencia_anterior?: string;
  existencia_recalculada?: string;
  diferencia_existencia?: string;
  valor_anterior?: string;
  valor_recalculado?: string;
  diferencia_valor?: string;
  costo_anterior?: string | null;
  costo_recalculado?: string | null;
  diferencia_costo?: string | null;
};

type FilaDiferencia = {
  id: string;
  producto: string;
  almacen: string;
  existencia_anterior: string;
  existencia_recalculada: string;
  diferencia_existencia: string;
  diferencia_valor: string;
  diferencia_costo: string;
};

const etiquetaProps = { sx: { fontSize: 13 } };
const textoProps = { style: { fontSize: 13 } };

function formatoDuracion(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} s`;
}

export default function RecalculoInventarioPage() {
  const theme = useTheme();
  const [alcance, setAlcance] = React.useState<Alcance>('producto');
  const [producto, setProducto] = React.useState('');
  const [desde, setDesde] = React.useState('');
  const [productos, setProductos] = React.useState<Producto[]>([]);
  const [analisis, setAnalisis] = React.useState<RecalculoResultado | null>(null);
  const [ejecucion, setEjecucion] = React.useState<RecalculoResultado | null>(null);
  const [revision, setRevision] = React.useState<string | null>(null);
  const [confirmar, setConfirmar] = React.useState(false);
  const [analizando, setAnalizando] = React.useState(false);
  const [ejecutando, setEjecutando] = React.useState(false);
  const [error, setError] = React.useState('');
  const [snack, setSnack] = React.useState('');

  const ocupado = analizando || ejecutando;
  const faltaProducto = alcance === 'producto' && !producto;
  const analisisVigente = analisis != null && !faltaProducto;

  React.useEffect(() => {
    fetchProductos().then(setProductos).catch(() => setError('No se pudieron cargar los productos.'));
  }, []);

  const invalidar = () => {
    setAnalisis(null);
    setEjecucion(null);
    setRevision(null);
  };

  const nombreProducto = React.useCallback((id: number) => {
    const encontrado = productos.find((item) => item.id === id);
    return encontrado ? `${encontrado.clave} · ${encontrado.descripcion}` : `Producto ${id}`;
  }, [productos]);

  const filas = React.useMemo<FilaDiferencia[]>(() => {
    const diferencias = (analisis?.diferencias ?? []) as DiferenciaApi[];
    return diferencias.filter((fila) => (
      Number(fila.diferencia_existencia ?? 0) !== 0
      || Number(fila.diferencia_valor ?? 0) !== 0
      || (fila.diferencia_costo != null && Number(fila.diferencia_costo) !== 0)
    )).map((fila) => ({
      id: `${fila.producto_id}-${fila.almacen_id}`,
      producto: nombreProducto(Number(fila.producto_id)),
      almacen: fila.almacen?.trim() ? fila.almacen : `Almacén ${fila.almacen_id}`,
      existencia_anterior: fila.existencia_anterior ?? '—',
      existencia_recalculada: fila.existencia_recalculada ?? '—',
      diferencia_existencia: fila.diferencia_existencia ?? '—',
      diferencia_valor: fila.diferencia_valor ?? '—',
      diferencia_costo: fila.diferencia_costo ?? '—',
    }));
  }, [analisis, nombreProducto]);

  const columns = React.useMemo<GridColDef<FilaDiferencia>[]>(() => [
    { field: 'producto', headerName: 'Producto', flex: 1.4, minWidth: 200 },
    { field: 'almacen', headerName: 'Almacén', flex: 1, minWidth: 160 },
    { field: 'existencia_anterior', headerName: 'Existencia anterior', flex: 0.7, minWidth: 150 },
    { field: 'existencia_recalculada', headerName: 'Existencia recalculada', flex: 0.8, minWidth: 170 },
    { field: 'diferencia_existencia', headerName: 'Diferencia', flex: 0.6, minWidth: 120 },
    { field: 'diferencia_valor', headerName: 'Diferencia de valor', flex: 0.8, minWidth: 150 },
    { field: 'diferencia_costo', headerName: 'Diferencia de costo', flex: 0.8, minWidth: 150 },
  ], []);

  const payload = () => ({
    alcance,
    ...(alcance === 'producto' ? { producto_id: Number(producto) } : {}),
    desde: desde || null,
    revision,
  });

  const analizar = async () => {
    try {
      setAnalizando(true);
      setError('');
      setEjecucion(null);
      const resultado = await analizarRecalculo(payload());
      setRevision(resultado.revision ?? null);
      setAnalisis(resultado);
    } catch (e) {
      setAnalisis(null);
      setError(e instanceof Error ? e.message : 'No se pudo analizar.');
    } finally {
      setAnalizando(false);
    }
  };

  const ejecutar = async () => {
    try {
      setEjecutando(true);
      setConfirmar(false);
      setError('');
      const resultado = await ejecutarRecalculo(payload());
      setEjecucion(resultado);
      setAnalisis(resultado);
      setSnack('Recálculo ejecutado correctamente.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ejecutar.');
    } finally {
      setEjecutando(false);
    }
  };

  const superficie = {
    width: '100%',
    backgroundColor: theme.emphasys.content.background,
    border: `1px solid ${theme.emphasys.content.border}`,
    borderRadius: 2,
    px: { xs: 1.5, md: 2 },
    py: 1.5,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.25,
  } as const;

  const tituloSeccion = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'text.secondary',
  } as const;

  return (
    <Box sx={{ width: '100%', px: { xs: 1.5, md: 3 }, pt: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={superficie}>
        <Typography variant="h5" fontWeight={700} color="primary.main">Recálculo de existencias y costos</Typography>
        <Typography variant="body2" color="text.secondary">
          La reconstrucción recorre todo el historial. La fecha únicamente filtra las diferencias mostradas.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
          <FormControl size="small" sx={{ flex: '1 1 200px', minWidth: 180 }}>
            <InputLabel sx={etiquetaProps.sx}>Alcance</InputLabel>
            <Select
              label="Alcance"
              value={alcance}
              onChange={(event) => {
                setAlcance(event.target.value as Alcance);
                invalidar();
              }}
              inputProps={textoProps}
            >
              <MenuItem value="producto">Un producto</MenuItem>
              <MenuItem value="todos">Todos los productos</MenuItem>
            </Select>
          </FormControl>
          {alcance === 'producto' && (
            <FormControl size="small" sx={{ flex: '2 1 280px', minWidth: 220 }}>
              <InputLabel sx={etiquetaProps.sx}>Producto</InputLabel>
              <Select
                label="Producto"
                value={producto}
                onChange={(event) => {
                  setProducto(String(event.target.value));
                  invalidar();
                }}
                inputProps={textoProps}
              >
                {productos.map((item) => (
                  <MenuItem key={item.id} value={String(item.id)}>{item.clave} · {item.descripcion}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            size="small"
            type="date"
            label="Mostrar diferencias desde"
            value={desde}
            onChange={(event) => {
              setDesde(event.target.value);
              invalidar();
            }}
            InputLabelProps={{ shrink: true, sx: etiquetaProps.sx }}
            inputProps={textoProps}
            sx={{ flex: '1 1 190px', minWidth: 180 }}
          />
          <Button
            variant="outlined"
            color="primary"
            disabled={ocupado || faltaProducto}
            onClick={() => void analizar()}
            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { sm: 'center' }, minHeight: 40 }}
          >
            {analizando ? 'Analizando…' : 'Analizar'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Box sx={superficie}>
        <Typography sx={tituloSeccion}>Análisis</Typography>
        {analisis ? (
          <Typography variant="body2" color="text.secondary">
            Productos analizados: {analisis.productos}
            {' · '}
            Movimientos procesados: {analisis.movimientos}
            {' · '}
            Diferencias detectadas: {(analisis.diferencias ?? []).length}
            {' · '}
            Duración del análisis: {formatoDuracion(analisis.duracion_ms)}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Aún no hay un análisis. Elige el alcance y pulsa Analizar.
          </Typography>
        )}
        <Box sx={{
          width: '100%',
          backgroundColor: theme.emphasys.content.well,
          borderRadius: 2,
          border: `1px solid ${theme.emphasys.content.border}`,
          overflow: 'hidden',
        }}>
          <EmphasysDataGrid<FilaDiferencia>
            rows={analisis ? filas : []}
            columns={columns}
            getRowId={(row) => row.id}
            autoHeight
            rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
            columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
            loading={analizando}
            disableRowSelectionOnClick
            hideFooterSelectedRowCount
            pagination
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
            localeText={{
              ...esES.components.MuiDataGrid.defaultProps.localeText,
              noRowsLabel: analisis
                ? 'El análisis no devolvió diferencias para este criterio.'
                : 'Los resultados del análisis aparecerán aquí.',
            }}
            sx={{
              width: '100%',
              border: 0,
              bgcolor: theme.emphasys.content.well,
              '--DataGrid-overlayHeight': '120px',
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
                borderColor: theme.emphasys.content.border,
                fontVariantNumeric: 'tabular-nums',
              },
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                outline: 'none !important',
              },
              '& .MuiDataGrid-footerContainer': {
                borderTop: `1px solid ${theme.emphasys.content.border}`,
                backgroundColor: theme.emphasys.content.well,
                color: theme.emphasys.content.secondary,
                minHeight: 44,
              },
              '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: theme.emphasys.content.secondary,
              },
            }}
          />
        </Box>
      </Box>

      <Box sx={superficie}>
        <Typography sx={tituloSeccion}>Ejecución</Typography>
        <Typography variant="body2" color="text.secondary">
          El recálculo actualiza existencias y los resultados derivados de las partidas afectadas.
          Cantidad, fecha, almacén y signo de los movimientos permanecen.
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
          <Button
            variant="contained"
            color="primary"
            disabled={ocupado || !analisisVigente}
            onClick={() => setConfirmar(true)}
            sx={catalogoPrimaryButtonSx}
          >
            {ejecutando ? 'Recalculando…' : 'Recalcular'}
          </Button>
          {!analisisVigente && (
            <Typography variant="body2" color="text.secondary">
              Disponible después de un análisis de la configuración actual.
            </Typography>
          )}
        </Stack>
        {ejecucion && (
          <Typography variant="body2" color="text.primary">
            Recálculo ejecutado. Productos: {ejecucion.productos}
            {' · '}
            Movimientos: {ejecucion.movimientos}
            {' · '}
            Duración: {formatoDuracion(ejecucion.duracion_ms)}
            {Array.isArray(ejecucion.antes) ? ` · Existencias antes: ${ejecucion.antes.length}` : ''}
            {Array.isArray(ejecucion.despues) ? ` · Existencias después: ${ejecucion.despues.length}` : ''}
          </Typography>
        )}
      </Box>

      <Dialog open={confirmar} onClose={() => { if (!ejecutando) setConfirmar(false); }}>
        <DialogTitle>Confirmar recálculo</DialogTitle>
        <DialogContent>
          Se actualizarán únicamente resultados derivados. Los movimientos originales permanecerán intactos.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmar(false)} disabled={ejecutando} sx={{ textTransform: 'none' }}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={() => void ejecutar()} disabled={ejecutando} sx={catalogoPrimaryButtonSx}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={3500} message={snack} onClose={() => setSnack('')} />
    </Box>
  );
}
