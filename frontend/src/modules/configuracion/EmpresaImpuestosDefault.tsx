import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import ReplayIcon from '@mui/icons-material/Replay';
import type { EmpresaImpuestoDefault, ImpuestoCatalogo } from '../../types/impuestos';
import {
  actualizarEmpresaImpuestoDefault,
  crearEmpresaImpuestoDefault,
  eliminarEmpresaImpuestoDefault,
  fetchEmpresaImpuestosDefault,
  fetchImpuestosCatalogo,
} from '../../services/impuestosService';
import { useSession } from '../../session/useSession';

function ordenarItems(items: EmpresaImpuestoDefault[]): EmpresaImpuestoDefault[] {
  return [...items].sort((a, b) => {
    const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
    const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
    if (ordenA !== ordenB) return ordenA - ordenB;
    const nombreA = a.impuesto?.nombre || a.impuesto_id || '';
    const nombreB = b.impuesto?.nombre || b.impuesto_id || '';
    return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
  });
}

function formatImpuesto(impuesto?: ImpuestoCatalogo | null): string {
  if (!impuesto) return '—';
  const tasa = impuesto.tasa ? `${Number(impuesto.tasa)}%` : '';
  return `${impuesto.nombre}${tasa ? ` (${tasa})` : ''}`;
}

export default function EmpresaImpuestosDefault() {
  const { session } = useSession();
  const empresaId = session?.empresaActivaId;

  const [impuestos, setImpuestos] = useState<ImpuestoCatalogo[]>([]);
  const [items, setItems] = useState<EmpresaImpuestoDefault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevoImpuesto, setNuevoImpuesto] = useState<ImpuestoCatalogo | null>(null);
  const [nuevoOrden, setNuevoOrden] = useState<string>('');
  const [ordenEdits, setOrdenEdits] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [catalogo, defaults] = await Promise.all([fetchImpuestosCatalogo(), fetchEmpresaImpuestosDefault()]);
      setImpuestos(catalogo);
      setItems(ordenarItems(defaults));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los impuestos de la empresa');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      void cargarDatos();
    }
  }, [empresaId]);

  const opcionesDisponibles = useMemo(
    () => impuestos.filter((imp) => !items.some((item) => item.impuesto_id === imp.id)),
    [impuestos, items]
  );

  const handleAgregar = async () => {
    if (!nuevoImpuesto) {
      setSnackbar({ open: true, message: 'Selecciona un impuesto para agregar', severity: 'error' });
      return;
    }

    const ordenNumber = nuevoOrden.trim() === '' ? null : Number(nuevoOrden);
    if (nuevoOrden.trim() !== '' && Number.isNaN(ordenNumber)) {
      setSnackbar({ open: true, message: 'El orden debe ser numérico', severity: 'error' });
      return;
    }

    try {
      const created = await crearEmpresaImpuestoDefault({
        impuesto_id: nuevoImpuesto.id,
        orden: ordenNumber,
      });
      const impuestoInfo = impuestos.find((imp) => imp.id === created.impuesto_id);
      const nuevoItem: EmpresaImpuestoDefault = {
        ...created,
        impuesto: impuestoInfo ?? created.impuesto ?? null,
      };
      setItems((prev) => ordenarItems([...prev, nuevoItem]));
      setNuevoImpuesto(null);
      setNuevoOrden('');
      setSnackbar({ open: true, message: 'Impuesto agregado', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo agregar el impuesto', severity: 'error' });
    }
  };

  const handleEliminar = async (id: number) => {
    const confirmar = window.confirm('¿Eliminar este impuesto default?');
    if (!confirmar) return;
    try {
      await eliminarEmpresaImpuestoDefault(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSnackbar({ open: true, message: 'Impuesto eliminado', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
    }
  };

  const handleOrdenChange = (id: number, value: string) => {
    setOrdenEdits((prev) => ({ ...prev, [id]: value }));
  };

  const handleGuardarOrden = async (id: number) => {
    const valor = (ordenEdits[id] ?? '').trim();
    const ordenNumber = valor === '' ? null : Number(valor);
    if (valor !== '' && Number.isNaN(ordenNumber)) {
      setSnackbar({ open: true, message: 'El orden debe ser numérico', severity: 'error' });
      return;
    }

    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const updated = await actualizarEmpresaImpuestoDefault(id, { orden: ordenNumber });
      const impuestoInfo = impuestos.find((imp) => imp.id === updated.impuesto_id);
      setItems((prev) =>
        ordenarItems(
          prev.map((item) =>
            item.id === id
              ? ({ ...item, ...updated, impuesto: impuestoInfo ?? updated.impuesto } as EmpresaImpuestoDefault)
              : item
          )
        )
      );
      setOrdenEdits((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      setSnackbar({ open: true, message: 'Orden actualizado', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo actualizar el orden', severity: 'error' });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const ordenEditado = (id: number, ordenActual: number | null | undefined) => {
    const valor = ordenEdits[id];
    if (valor === undefined) return false;
    if (valor === '' && (ordenActual === null || ordenActual === undefined)) return false;
    const numero = valor === '' ? null : Number(valor);
    if (Number.isNaN(numero)) return true;
    return numero !== (ordenActual ?? null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700} color="#1d2f68">
            Impuestos default de la empresa
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Jerarquía: impuestos del producto → impuestos default de la empresa → reglas de tratamiento.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={() => cargarDatos()}
          disabled={loading}
        >
          Recargar
        </Button>
      </Stack>

      {!empresaId && (
        <Alert severity="warning">Selecciona una empresa activa para administrar sus impuestos por default.</Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
          <Autocomplete
            options={opcionesDisponibles}
            getOptionLabel={(option) => formatImpuesto(option)}
            value={nuevoImpuesto}
            onChange={(_e, value) => setNuevoImpuesto(value)}
            renderInput={(params) => (
              <TextField {...(params as any)} label="Impuesto" size="small" fullWidth />
            )}
            sx={{ minWidth: { md: 280 } }}
            disabled={loading || !empresaId}
          />
          <TextField
            label="Orden"
            size="small"
            type="number"
            value={nuevoOrden}
            onChange={(e) => setNuevoOrden(e.target.value)}
            sx={{ width: { md: 140 } }}
            placeholder={items.length ? String((items[items.length - 1]?.orden ?? items.length) + 1) : '1'}
            disabled={loading || !empresaId}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => void handleAgregar()}
            disabled={loading || !empresaId}
            sx={{ textTransform: 'none', bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            Agregar impuesto
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#1d2f68' }}>
              <TableCell sx={{ color: 'white', fontWeight: 700 }}>Impuesto</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 700 }} width={140}>
                Orden
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 700 }} align="right" width={140}>
                Acciones
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" py={2}>
                    <CircularProgress size={18} />
                    <Typography variant="body2">Cargando impuestos...</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}

            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No hay impuestos default registrados para esta empresa.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading && items.map((item) => {
              const editValue = ordenEdits[item.id] ?? (item.orden ?? '').toString();
              const tieneCambios = ordenEditado(item.id, item.orden);
              const saving = savingIds.has(item.id);
              return (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="#111827">
                      {formatImpuesto(item.impuesto)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {item.impuesto_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={editValue}
                      onChange={(e) => handleOrdenChange(item.id, e.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Guardar orden">
                        <span>
                          <IconButton
                            color="primary"
                            onClick={() => void handleGuardarOrden(item.id)}
                            disabled={!tieneCambios || saving}
                            size="small"
                          >
                            {saving ? <CircularProgress size={18} /> : <SaveIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton color="error" onClick={() => void handleEliminar(item.id)} size="small">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
