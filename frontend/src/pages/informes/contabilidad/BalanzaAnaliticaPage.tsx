import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GridOnIcon from '@mui/icons-material/GridOn';
import { useNavigate } from 'react-router-dom';
import { fetchEjerciciosDisponibles } from '../../../services/saldosCuentasService';
import {
  fetchBalanzaAnalitica,
  descargarBalanzaAnalitica,
} from '../../../services/reportesContablesService';
import type { BalanzaAnaliticaResultado } from '../../../types/reportesContables';
import { NOMBRES_MESES } from '../../../types/saldosCuentas';

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BalanzaAnaliticaPage() {
  const navigate = useNavigate();

  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodoInicial, setPeriodoInicial] = React.useState(1);
  const [periodoFinal, setPeriodoFinal] = React.useState(new Date().getMonth() + 1);
  const [mostrarCeros, setMostrarCeros] = React.useState(true);
  const [soloAfectables, setSoloAfectables] = React.useState(false);

  const [resultado, setResultado] = React.useState<BalanzaAnaliticaResultado | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [descargando, setDescargando] = React.useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchEjerciciosDisponibles()
      .then((lista) => {
        setEjercicios(lista);
        setEjercicio((prev) => prev ?? lista[0] ?? new Date().getFullYear());
      })
      .catch(() => {
        setEjercicios([new Date().getFullYear()]);
        setEjercicio((prev) => prev ?? new Date().getFullYear());
      });
  }, []);

  const consultar = React.useCallback(async () => {
    if (!ejercicio) return;
    if (periodoInicial > periodoFinal) {
      setError('El periodo inicial no puede ser mayor que el periodo final');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBalanzaAnalitica({
        ejercicio,
        periodo_inicial: periodoInicial,
        periodo_final: periodoFinal,
        mostrar_ceros: mostrarCeros,
        solo_afectables: soloAfectables,
      });
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo consultar la balanza analítica');
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }, [ejercicio, periodoInicial, periodoFinal, mostrarCeros, soloAfectables]);

  React.useEffect(() => {
    void consultar();
  }, [consultar]);

  const handleDescargar = async (formato: 'pdf' | 'excel') => {
    if (!ejercicio || descargando) return;
    setDescargando(formato);
    try {
      await descargarBalanzaAnalitica(
        { ejercicio, periodo_inicial: periodoInicial, periodo_final: periodoFinal, mostrar_ceros: mostrarCeros, solo_afectables: soloAfectables },
        formato
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el archivo');
    } finally {
      setDescargando(null);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')} sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Contabilidad</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Balanza Analítica</Typography>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Balanza Analítica</Typography>
          <Typography variant="caption" color="text.secondary">
            Saldo inicial, cargos, abonos y saldo final por cuenta, basado en pólizas aplicadas.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" disabled={!resultado || descargando !== null}
            startIcon={descargando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
            onClick={() => void handleDescargar('pdf')}>
            PDF
          </Button>
          <Button size="small" variant="outlined" disabled={!resultado || descargando !== null}
            startIcon={descargando === 'excel' ? <CircularProgress size={14} color="inherit" /> : <GridOnIcon />}
            onClick={() => void handleDescargar('excel')}>
            Excel
          </Button>
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Select size="small" value={ejercicio ?? ''} onChange={(e) => setEjercicio(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {ejercicios.map((e) => (
              <MenuItem key={e} value={e}>{e}</MenuItem>
            ))}
          </Select>
          <Select size="small" value={periodoInicial} onChange={(e) => setPeriodoInicial(Number(e.target.value))} sx={{ minWidth: 130 }}>
            {NOMBRES_MESES.map((nombre, index) => (
              <MenuItem key={nombre} value={index + 1}>{nombre}</MenuItem>
            ))}
          </Select>
          <Typography variant="body2" color="text.secondary">a</Typography>
          <Select size="small" value={periodoFinal} onChange={(e) => setPeriodoFinal(Number(e.target.value))} sx={{ minWidth: 130 }}>
            {NOMBRES_MESES.map((nombre, index) => (
              <MenuItem key={nombre} value={index + 1}>{nombre}</MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={<Checkbox size="small" checked={mostrarCeros} onChange={(e) => setMostrarCeros(e.target.checked)} />}
            label={<Typography variant="body2">Mostrar cuentas en cero</Typography>}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={soloAfectables} onChange={(e) => setSoloAfectables(e.target.checked)} />}
            label={<Typography variant="body2">Solo afectables</Typography>}
          />
          <Button size="small" variant="contained" startIcon={<RefreshIcon />} onClick={() => void consultar()} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      )}

      {resultado && !resultado.cuadra && (
        <Alert severity="warning">La balanza no cuadra. Revise pólizas aplicadas del periodo.</Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: '65vh' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }}>Cuenta</TableCell>
                <TableCell sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }}>Descripción</TableCell>
                <TableCell sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }} align="right">Saldo inicial</TableCell>
                <TableCell sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }} align="right">Cargos</TableCell>
                <TableCell sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }} align="right">Abonos</TableCell>
                <TableCell sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }} align="right">Saldo final</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={20} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && (resultado?.cuentas.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No hay cuentas para mostrar con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
              {!loading && resultado?.cuentas.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ color: c.afectable ? '#1d2f68' : 'text.secondary', fontWeight: c.afectable ? 600 : 400 }}>
                    {c.cuenta}
                  </TableCell>
                  <TableCell
                    sx={{
                      pl: `${16 + Math.max(0, c.nivel - 1) * 20}px`,
                      color: c.afectable ? '#1d2f68' : 'text.secondary',
                      fontWeight: c.afectable ? 600 : 400,
                    }}
                  >
                    {c.descripcion}
                  </TableCell>
                  <TableCell align="right">{formatMoneda(c.saldo_inicial)}</TableCell>
                  <TableCell align="right">{formatMoneda(c.cargos)}</TableCell>
                  <TableCell align="right">{formatMoneda(c.abonos)}</TableCell>
                  <TableCell align="right">{formatMoneda(c.saldo_final)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {resultado && resultado.cuentas.length > 0 && (
              <TableBody>
                <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                  <TableCell colSpan={3} sx={{ fontWeight: 700 }}>Totales</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoneda(resultado.totales.cargos)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoneda(resultado.totales.abonos)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            )}
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
