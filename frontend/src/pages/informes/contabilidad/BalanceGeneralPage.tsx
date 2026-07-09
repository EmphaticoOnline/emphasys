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
  fetchBalanceGeneral,
  descargarBalanceGeneral,
} from '../../../services/reportesContablesService';
import type { BalanceGeneralResultado } from '../../../types/reportesContables';
import { NOMBRES_MESES } from '../../../types/saldosCuentas';

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SeccionBalance({ titulo, grupos, totalLabel, total }: {
  titulo: string;
  grupos: BalanceGeneralResultado['activo'];
  totalLabel: string;
  total: number;
}) {
  // Reporte de presentación financiera: no se muestra el número de cuenta;
  // la jerarquía grupo → cuenta se refleja solo con sangría en la descripción.
  return (
    <>
      <TableRow>
        <TableCell colSpan={2} sx={{ bgcolor: '#1d2f68', color: '#fff', fontWeight: 700 }}>{titulo}</TableCell>
      </TableRow>
      {grupos.map((g) => (
        <React.Fragment key={g.grupo}>
          <TableRow sx={{ bgcolor: '#eef2ff' }}>
            <TableCell sx={{ fontWeight: 700, color: '#1d2f68' }}>{g.grupo}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, color: '#1d2f68' }}>{formatMoneda(g.subtotal)}</TableCell>
          </TableRow>
          {g.cuentas.map((c) => (
            <TableRow key={c.id} hover>
              <TableCell sx={{ pl: 4 }}>{c.descripcion}</TableCell>
              <TableCell align="right">{formatMoneda(c.saldo)}</TableCell>
            </TableRow>
          ))}
        </React.Fragment>
      ))}
      <TableRow sx={{ bgcolor: '#f3f4f6' }}>
        <TableCell sx={{ fontWeight: 700 }}>{totalLabel}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoneda(total)}</TableCell>
      </TableRow>
    </>
  );
}

export default function BalanceGeneralPage() {
  const navigate = useNavigate();

  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState(new Date().getMonth() + 1);
  const [mostrarDetalle, setMostrarDetalle] = React.useState(true);

  const [resultado, setResultado] = React.useState<BalanceGeneralResultado | null>(null);
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
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBalanceGeneral({ ejercicio, periodo, mostrar_detalle: mostrarDetalle });
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo consultar el balance general');
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }, [ejercicio, periodo, mostrarDetalle]);

  React.useEffect(() => {
    void consultar();
  }, [consultar]);

  const handleDescargar = async (formato: 'pdf' | 'excel') => {
    if (!ejercicio || descargando) return;
    setDescargando(formato);
    try {
      await descargarBalanceGeneral({ ejercicio, periodo, mostrar_detalle: mostrarDetalle }, formato);
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
        <Typography variant="body2" fontWeight={600}>Balance General</Typography>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Balance General</Typography>
          <Typography variant="caption" color="text.secondary">
            Situación financiera acumulada al cierre del periodo seleccionado.
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
          <Select size="small" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} sx={{ minWidth: 130 }}>
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
                  <SeccionBalance titulo="ACTIVO" grupos={resultado.activo} totalLabel="TOTAL ACTIVO" total={resultado.total_activo} />
                  <SeccionBalance titulo="PASIVO" grupos={resultado.pasivo} totalLabel="TOTAL PASIVO" total={resultado.total_pasivo} />
                  <SeccionBalance titulo="CAPITAL" grupos={resultado.capital} totalLabel="TOTAL CAPITAL" total={resultado.total_capital} />
                  <TableRow sx={{ bgcolor: '#e5e7eb' }}>
                    <TableCell sx={{ fontWeight: 700 }}>TOTAL PASIVO + CAPITAL</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatMoneda(resultado.total_pasivo + resultado.total_capital)}
                    </TableCell>
                  </TableRow>
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
            bgcolor: resultado.cuadrado ? '#ecfdf5' : '#fef2f2',
            borderColor: resultado.cuadrado ? '#166534' : '#b91c1c',
          }}
        >
          <Typography sx={{ fontWeight: 700, color: resultado.cuadrado ? '#166534' : '#b91c1c' }}>
            {resultado.cuadrado ? 'Balance cuadrado' : `Diferencia: ${formatMoneda(resultado.diferencia)}`}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
