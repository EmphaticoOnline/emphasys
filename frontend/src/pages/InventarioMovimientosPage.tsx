import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useNavigate } from 'react-router-dom';

import type { MovimientoDetalle, MovimientoListadoItem } from '../types/inventario';
import { listarMovimientos, obtenerMovimientoDetalle } from '../services/inventarioService';

dayjs.locale('es');

export default function InventarioMovimientosPage() {
  const navigate = useNavigate();

  const [movimientos, setMovimientos] = useState<MovimientoListadoItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<MovimientoDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const formatoFecha = (value: string) => dayjs(value).format('DD/MM/YYYY');

  const cargarDetalle = async (movimientoId: number) => {
    try {
      setDetalleLoading(true);
      setDetalleError(null);
      const data = await obtenerMovimientoDetalle(movimientoId);
      setDetalle(data);
    } catch (err) {
      setDetalleError(err instanceof Error ? err.message : 'No se pudo cargar el detalle');
      setDetalle(null);
    } finally {
      setDetalleLoading(false);
    }
  };

  const cargarMovimientos = async () => {
    try {
      setListLoading(true);
      const data = await listarMovimientos();
      setMovimientos(data);
      setListError(null);
      const first = data[0];
      if (first) {
        setSelectedId(first.id);
        void cargarDetalle(first.id);
      } else {
        setSelectedId(null);
        setDetalle(null);
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void cargarMovimientos();
  }, []);

  useEffect(() => {
    if (selectedId != null) {
      void cargarDetalle(selectedId);
    }
  }, [selectedId]);

  const handleSeleccion = (id: number) => {
    setSelectedId(id);
  };

  const handleAccionNoImplementada = () => {
    setSnackbar({ open: true, message: 'Acción aún no implementada', severity: 'error' });
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Movimientos de inventario
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vista maestro-detalle: selecciona un movimiento para ver sus partidas.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void cargarMovimientos()} disabled={listLoading}>
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/inventario/movimientos/nuevo')}
          >
            Nuevo movimiento
          </Button>
        </Stack>
      </Box>

      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Movimientos</Typography>
          {listError && <Alert severity="error">{listError}</Alert>}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Documento</TableCell>
                  <TableCell align="center">Ver detalle</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientos.length === 0 && !listLoading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No hay movimientos registrados aún.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {movimientos.map((m) => (
                  <TableRow
                    key={m.id}
                    hover
                    selected={selectedId === m.id}
                    onClick={() => handleSeleccion(m.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{formatoFecha(m.fecha)}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{m.tipo_movimiento}</TableCell>
                    <TableCell>{m.observaciones || '—'}</TableCell>
                    <TableCell>{m.usuario_nombre ?? '—'}</TableCell>
                    <TableCell>{m.documento_id ?? '—'}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={() => handleSeleccion(m.id)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {listLoading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                        <CircularProgress size={18} />
                        <Typography variant="body2" color="text.secondary">
                          Cargando movimientos…
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Partidas</Typography>
          {detalleError && <Alert severity="error">{detalleError}</Alert>}
          {!selectedId && (
            <Typography variant="body2" color="text.secondary">Selecciona un movimiento para ver sus partidas.</Typography>
          )}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell>Producto</TableCell>
                  <TableCell>Almacén origen</TableCell>
                  <TableCell>Almacén destino</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detalleLoading && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                        <CircularProgress size={18} />
                        <Typography variant="body2" color="text.secondary">Cargando partidas…</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
                {!detalleLoading && detalle && detalle.partidas.length === 0 && ( 
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">Sin partidas para este movimiento.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!detalleLoading && detalle?.partidas.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.producto_id ?? '—'}</TableCell>
                    <TableCell>{p.almacen_origen_id ?? '—'}</TableCell>
                    <TableCell>{p.almacen_destino_id ?? '—'}</TableCell>
                    <TableCell align="right">{p.cantidad}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
