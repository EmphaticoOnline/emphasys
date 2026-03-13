import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Stack,
  TextField,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { crearConcepto, eliminarConcepto, fetchConceptos, actualizarConcepto } from '../../services';
import type { Concepto } from '../../types/finanzas';

interface ConceptoDialogState {
  open: boolean;
  concepto?: Concepto | null;
}

export function ConceptosPage() {
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [dialog, setDialog] = useState<ConceptoDialogState>({ open: false, concepto: null });
  const [nombre, setNombre] = useState('');
  const [esGasto, setEsGasto] = useState(true);
  const [activo, setActivo] = useState(true);
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' }
  );

  const load = async () => {
    try {
      const data = await fetchConceptos();
      setConceptos(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los conceptos');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openDialog = (concepto?: Concepto | null) => {
    setDialog({ open: true, concepto: concepto ?? null });
    setNombre(concepto?.nombre_concepto || '');
    setEsGasto(concepto?.es_gasto ?? true);
    setActivo(concepto?.activo ?? true);
    setObservaciones(concepto?.observaciones || '');
    setError(null);
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      setError('El nombre del concepto es obligatorio');
      return;
    }
    const payload = {
      nombre_concepto: nombre.trim(),
      es_gasto: esGasto,
      activo,
      observaciones: observaciones.trim() || null,
    };
    try {
      setSaving(true);
      setError(null);
      if (dialog.concepto?.id) {
        await actualizarConcepto(dialog.concepto.id, payload);
        setSnackbar({ open: true, message: 'Concepto actualizado', severity: 'success' });
      } else {
        await crearConcepto(payload);
        setSnackbar({ open: true, message: 'Concepto creado', severity: 'success' });
      }
      setDialog({ open: false, concepto: null });
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el concepto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (concepto: Concepto) => {
    const confirmed = window.confirm(`¿Eliminar el concepto "${concepto.nombre_concepto}"?`);
    if (!confirmed) return;
    try {
      await eliminarConcepto(concepto.id);
      setSnackbar({ open: true, message: 'Concepto eliminado', severity: 'success' });
      await load();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
    }
  };

  return (
    <Box sx={{ px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Conceptos financieros
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Clasifica tus movimientos financieros por concepto.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openDialog(null)}
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          Nuevo concepto
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre concepto</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Activo</TableCell>
              <TableCell>Observaciones</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {conceptos.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.nombre_concepto}</TableCell>
                <TableCell>
                  <Chip label={c.es_gasto ? 'Gasto' : 'Ingreso'} color={c.es_gasto ? 'default' : 'success'} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={c.activo ? 'Sí' : 'No'} color={c.activo ? 'primary' : 'default'} size="small" />
                </TableCell>
                <TableCell>{c.observaciones || '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openDialog(c)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(c)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {conceptos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No hay conceptos registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, concepto: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.concepto ? 'Editar concepto' : 'Nuevo concepto'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Nombre concepto"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              inputProps={{ maxLength: 60 }}
              size="small"
              fullWidth
            />

            <FormControlLabel
              control={<Switch checked={esGasto} onChange={(e) => setEsGasto(e.target.checked)} />}
              label={esGasto ? 'Tipo: Gasto' : 'Tipo: Ingreso'}
            />

            <FormControlLabel
              control={<Switch checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
              label={activo ? 'Activo' : 'Inactivo'}
            />

            <TextField
              label="Observaciones"
              size="small"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog({ open: false, concepto: null })} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ConceptosPage;
