import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { fetchBitacoraPaquetes } from '../../services/eContabilidadService';
import type { ItemBitacoraPaquete } from '../../types/bitacora';

const BRAND = '#1d2f68';

function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function FilaDetalle({ item }: { item: ItemBitacoraPaquete }) {
  return (
    <Box sx={{ p: 2, bgcolor: '#f8fafc' }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Archivos incluidos
      </Typography>
      <TableContainer sx={{ mb: 2 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: 12, py: 0.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Archivo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Nombre XML</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                Estado
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                Errores
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                Advertencias
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {item.archivos_incluidos.map((a) => (
              <TableRow key={a.clave} hover>
                <TableCell>{a.titulo}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>{a.nombre}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={a.ok ? 'Correcto' : 'Con errores'}
                    size="small"
                    sx={a.ok ? { bgcolor: '#f0fdf4', color: '#166534', fontWeight: 600, fontSize: 11 } : { bgcolor: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 11 }}
                  />
                </TableCell>
                <TableCell align="center" sx={{ color: a.errores > 0 ? '#b91c1c' : 'inherit' }}>
                  {a.errores}
                </TableCell>
                <TableCell align="center" sx={{ color: a.advertencias > 0 ? '#92400e' : 'inherit' }}>
                  {a.advertencias}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={4} flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Parámetros usados
          </Typography>
          <Typography component="pre" sx={{ fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
            {JSON.stringify(item.parametros, null, 2)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Resumen
          </Typography>
          <Typography component="pre" sx={{ fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
            {JSON.stringify(item.resumen, null, 2)}
          </Typography>
        </Box>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        Hash completo ({item.hash_algoritmo ?? 'SHA-256'})
      </Typography>
      <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', wordBreak: 'break-all', mb: 1.5 }}>{item.hash_zip ?? '—'}</Typography>

      {item.observaciones && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Observaciones
          </Typography>
          <Typography sx={{ fontSize: 12.5, mb: 1.5 }}>{item.observaciones}</Typography>
        </>
      )}

      <Alert severity="info" sx={{ fontSize: 12.5 }}>
        El ZIP no se almacena. Esta bitácora registra la generación y el hash, pero no conserva el archivo.
      </Alert>
    </Box>
  );
}

export default function BitacoraView() {
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | ''>('');
  const [periodo, setPeriodo] = React.useState<number | ''>('');
  const [buscar, setBuscar] = React.useState('');
  const [items, setItems] = React.useState<ItemBitacoraPaquete[]>([]);
  const [expandidos, setExpandidos] = React.useState<Set<number>>(new Set());
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchEjerciciosDisponibles()
      .then((lista) => setEjercicios(lista))
      .catch(() => setEjercicios([new Date().getFullYear()]));
  }, []);

  const handleBuscar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await fetchBitacoraPaquetes({
        ejercicio: ejercicio === '' ? undefined : ejercicio,
        periodo: periodo === '' ? undefined : periodo,
        buscar: buscar.trim() || undefined,
      });
      setItems(data.items);
    } catch (err: any) {
      setError(err?.message || 'No se pudo consultar la bitácora');
      setItems([]);
    } finally {
      setCargando(false);
    }
  }, [ejercicio, periodo, buscar]);

  React.useEffect(() => {
    handleBuscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpandido = (id: number) => {
    setExpandidos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="bitacora-ejercicio-label">Ejercicio</InputLabel>
            <Select<number | ''>
              labelId="bitacora-ejercicio-label"
              label="Ejercicio"
              value={ejercicio}
              onChange={(e) => setEjercicio(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">Todos</MenuItem>
              {ejercicios.map((anio) => (
                <MenuItem key={anio} value={anio}>
                  {anio}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel id="bitacora-periodo-label">Periodo</InputLabel>
            <Select<number | ''>
              labelId="bitacora-periodo-label"
              label="Periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">Todos</MenuItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                <MenuItem key={mes} value={mes}>
                  {String(mes).padStart(2, '0')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Buscar (nombre ZIP / hash)"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            sx={{ minWidth: 220 }}
          />

          <Button
            variant="contained"
            startIcon={<SearchIcon fontSize="small" />}
            onClick={handleBuscar}
            disabled={cargando}
            sx={{ textTransform: 'none', bgcolor: BRAND, '&:hover': { bgcolor: '#162551' } }}
          >
            {cargando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Buscar'}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: 12.5, py: 0.75 } }}>
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: BRAND, color: '#fff', fontWeight: 700 } }}>
                <TableCell />
                <TableCell>Fecha/hora</TableCell>
                <TableCell align="center">Ejercicio</TableCell>
                <TableCell align="center">Periodo</TableCell>
                <TableCell>ZIP</TableCell>
                <TableCell align="center">Archivos</TableCell>
                <TableCell align="center">Errores</TableCell>
                <TableCell align="center">Advertencias</TableCell>
                <TableCell>Generado por</TableCell>
                <TableCell>Hash</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const expandido = expandidos.has(item.id);
                return (
                  <React.Fragment key={item.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleExpandido(item.id)}>
                          {expandido ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatearFechaHora(item.generado_en)}</TableCell>
                      <TableCell align="center">{item.ejercicio}</TableCell>
                      <TableCell align="center">{String(item.periodo).padStart(2, '0')}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>{item.nombre_zip}</TableCell>
                      <TableCell align="center">{item.resumen.archivos_seleccionados}</TableCell>
                      <TableCell align="center" sx={{ color: item.resumen.errores > 0 ? '#b91c1c' : 'inherit' }}>
                        {item.resumen.errores}
                      </TableCell>
                      <TableCell align="center" sx={{ color: item.resumen.advertencias > 0 ? '#92400e' : 'inherit' }}>
                        {item.resumen.advertencias}
                      </TableCell>
                      <TableCell>{item.generado_por_nombre ?? (item.generado_por ? `#${item.generado_por}` : '—')}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {item.hash_zip ? `${item.hash_zip.slice(0, 10)}…` : '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={10} sx={{ p: 0, borderBottom: expandido ? undefined : 'none' }}>
                        <Collapse in={expandido} timeout="auto" unmountOnExit>
                          <FilaDetalle item={item} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
              {items.length === 0 && !cargando && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No hay paquetes registrados en la bitácora con estos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
