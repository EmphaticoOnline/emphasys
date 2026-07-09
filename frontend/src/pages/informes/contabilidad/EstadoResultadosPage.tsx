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
  fetchEstadoResultados,
  descargarEstadoResultados,
} from '../../../services/reportesContablesService';
import type { EstadoResultadosResultado } from '../../../types/reportesContables';
import { NOMBRES_MESES } from '../../../types/saldosCuentas';

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SeccionResultados({ titulo, cuentas, totalLabel, total }: {
  titulo: string;
  cuentas: EstadoResultadosResultado['ingresos'];
  totalLabel: string;
  total: number;
}) {
  // Reporte de presentación financiera: no se muestra el número de cuenta,
  // solo la descripción (a diferencia de la Balanza Analítica).
  return (
    <>
      <TableRow>
        <TableCell colSpan={2} sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }}>{titulo}</TableCell>
      </TableRow>
      {cuentas.map((c) => (
        <TableRow key={c.id} hover>
          <TableCell sx={{ pl: 3 }}>{c.descripcion}</TableCell>
          <TableCell align="right">{formatMoneda(c.importe)}</TableCell>
        </TableRow>
      ))}
      <TableRow sx={{ bgcolor: '#f3f4f6' }}>
        <TableCell sx={{ fontWeight: 700 }}>{totalLabel}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoneda(total)}</TableCell>
      </TableRow>
    </>
  );
}

export default function EstadoResultadosPage() {
  const navigate = useNavigate();

  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodoInicial, setPeriodoInicial] = React.useState(1);
  const [periodoFinal, setPeriodoFinal] = React.useState(new Date().getMonth() + 1);
  const [mostrarDetalle, setMostrarDetalle] = React.useState(true);

  const [resultado, setResultado] = React.useState<EstadoResultadosResultado | null>(null);
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
      const data = await fetchEstadoResultados({
        ejercicio,
        periodo_inicial: periodoInicial,
        periodo_final: periodoFinal,
        mostrar_detalle: mostrarDetalle,
      });
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo consultar el estado de resultados');
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }, [ejercicio, periodoInicial, periodoFinal, mostrarDetalle]);

  React.useEffect(() => {
    void consultar();
  }, [consultar]);

  const handleDescargar = async (formato: 'pdf' | 'excel') => {
    if (!ejercicio || descargando) return;
    setDescargando(formato);
    try {
      await descargarEstadoResultados(
        { ejercicio, periodo_inicial: periodoInicial, periodo_final: periodoFinal, mostrar_detalle: mostrarDetalle },
        formato
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el archivo');
    } finally {
      setDescargando(null);
    }
  };

  const esUtilidad = (resultado?.utilidad_periodo ?? 0) >= 0;

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')} sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Contabilidad</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Estado de Resultados</Typography>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Estado de Resultados</Typography>
          <Typography variant="caption" color="text.secondary">
            Ingresos, egresos y utilidad o pérdida del periodo, basado en pólizas aplicadas.
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
            control={<Checkbox size="small" checked={mostrarDetalle} onChange={(e) => setMostrarDetalle(e.target.checked)} />}
            label={<Typography variant="body2">Mostrar detalle por cuenta</Typography>}
          />
          <Button size="small" variant="contained" startIcon={<RefreshIcon />} onClick={() => void consultar()} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table size="small" stickyHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={20} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && resultado && (
                <>
                  <SeccionResultados titulo="INGRESOS" cuentas={resultado.ingresos} totalLabel="TOTAL INGRESOS" total={resultado.total_ingresos} />
                  <SeccionResultados titulo="EGRESOS" cuentas={resultado.egresos} totalLabel="TOTAL EGRESOS" total={resultado.total_egresos} />
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {resultado && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: esUtilidad ? '#ecfdf5' : '#fef2f2',
            borderColor: esUtilidad ? '#166534' : '#b91c1c',
          }}
        >
          <Typography sx={{ fontWeight: 700, color: esUtilidad ? '#166534' : '#b91c1c' }}>
            {esUtilidad ? 'UTILIDAD' : 'PÉRDIDA'} DEL PERIODO: {formatMoneda(Math.abs(resultado.utilidad_periodo))}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
