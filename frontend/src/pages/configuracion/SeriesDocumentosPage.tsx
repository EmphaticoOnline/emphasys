import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Typography,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { compareDocumentoVisualOrder } from '../../modules/documentos/documentoVisualOrder';
import {
  createAsignacionSerieDocumento,
  createSerieDocumento,
  deleteAsignacionSerieDocumento,
  fetchAsignacionesSeriesDocumento,
  fetchSeriesDocumento,
  updateAsignacionSerieDocumento,
  updateSerieDocumento,
  updateSerieDocumentoActiva,
  type AsignacionSerieDocumentoItem,
  type SerieDocumentoItem,
} from '../../services/seriesDocumentoService';
import { fetchTiposDocumentoHabilitados, type TipoDocumentoEmpresa } from '../../services/tiposDocumentoService';
import { fetchUsuariosHabilitados } from '../../services/usuariosService';
import type { Usuario } from '../../types/usuario';

const TAB_SERIES = 0;
const TAB_ASIGNACIONES = 1;
const TIPOS_CON_VARIANTE_FISCAL = new Set(['factura', 'nota_credito']);

type SerieFormState = {
  id: number | null;
  serie: string;
  descripcion: string;
  tipo_documento: string;
  es_fiscal: boolean;
  activa: boolean;
};

type AsignacionFormState = {
  id: number | null;
  usuario_id: number | '';
  tipo_documento: string;
  serie_documento_id: number | '';
};

const emptySerieForm = (): SerieFormState => ({
  id: null,
  serie: '',
  descripcion: '',
  tipo_documento: '',
  es_fiscal: false,
  activa: true,
});

const emptyAsignacionForm = (): AsignacionFormState => ({
  id: null,
  usuario_id: '',
  tipo_documento: '',
  serie_documento_id: '',
});

function TabPanel(props: { children: React.ReactNode; value: number; index: number }) {
  const { children, value, index } = props;
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

function formatBooleanLabel(value: boolean) {
  return value ? 'Sí' : 'No';
}

export default function SeriesDocumentosPage() {
  const [tab, setTab] = useState(TAB_SERIES);
  const [series, setSeries] = useState<SerieDocumentoItem[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionSerieDocumentoItem[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoEmpresa[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serieDialogOpen, setSerieDialogOpen] = useState(false);
  const [serieForm, setSerieForm] = useState<SerieFormState>(emptySerieForm());
  const [serieSaving, setSerieSaving] = useState(false);
  const [serieFormError, setSerieFormError] = useState<string | null>(null);

  const [asignacionDialogOpen, setAsignacionDialogOpen] = useState(false);
  const [asignacionForm, setAsignacionForm] = useState<AsignacionFormState>(emptyAsignacionForm());
  const [asignacionSaving, setAsignacionSaving] = useState(false);
  const [asignacionFormError, setAsignacionFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [seriesData, asignacionesData, tiposData, usuariosData] = await Promise.all([
        fetchSeriesDocumento(),
        fetchAsignacionesSeriesDocumento(),
        fetchTiposDocumentoHabilitados(),
        fetchUsuariosHabilitados(),
      ]);
      setSeries(seriesData);
      setAsignaciones(asignacionesData);
      setTiposDocumento(tiposData);
      setUsuarios(usuariosData);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la administración de series.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const tiposDocumentoOrdenados = useMemo(
    () => [...tiposDocumento].sort(compareDocumentoVisualOrder),
    [tiposDocumento]
  );

  const usuariosActivos = useMemo(
    () => [...usuarios].filter((usuario) => usuario.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [usuarios]
  );

  const seriesOrdenadas = useMemo(() => {
    const tipoNombreMap = new Map(tiposDocumentoOrdenados.map((tipo) => [tipo.codigo, tipo.nombre]));
    return [...series].sort((a, b) => {
      const tipoA = tipoNombreMap.get(a.tipo_documento) ?? a.tipo_documento;
      const tipoB = tipoNombreMap.get(b.tipo_documento) ?? b.tipo_documento;
      return tipoA.localeCompare(tipoB) || a.serie.localeCompare(b.serie);
    });
  }, [series, tiposDocumentoOrdenados]);

  const seriesDisponiblesAsignacion = useMemo(() => {
    if (!asignacionForm.tipo_documento) return [];
    return series
      .filter(
        (item) =>
          item.tipo_documento === asignacionForm.tipo_documento &&
          (item.activa || item.id === asignacionForm.serie_documento_id)
      )
      .sort((a, b) => a.serie.localeCompare(b.serie));
  }, [asignacionForm.serie_documento_id, asignacionForm.tipo_documento, series]);

  const serieTipoSoportaFiscal = TIPOS_CON_VARIANTE_FISCAL.has(serieForm.tipo_documento);

  const handleOpenCreateSerie = () => {
    setSerieForm(emptySerieForm());
    setSerieFormError(null);
    setSerieDialogOpen(true);
  };

  const handleOpenEditSerie = (item: SerieDocumentoItem) => {
    setSerieForm({
      id: item.id,
      serie: item.serie,
      descripcion: item.descripcion ?? '',
      tipo_documento: item.tipo_documento,
      es_fiscal: item.es_fiscal,
      activa: item.activa,
    });
    setSerieFormError(null);
    setSerieDialogOpen(true);
  };

  const handleCloseSerieDialog = () => {
    setSerieDialogOpen(false);
    setSerieForm(emptySerieForm());
    setSerieFormError(null);
  };

  const handleSerieFormChange = (field: keyof SerieFormState, value: string | boolean | number | null) => {
    setSerieForm((prev) => {
      const next = { ...prev, [field]: value } as SerieFormState;
      if (field === 'tipo_documento' && !TIPOS_CON_VARIANTE_FISCAL.has(String(value))) {
        next.es_fiscal = false;
      }
      return next;
    });
  };

  const handleSubmitSerie = async () => {
    if (!serieForm.serie.trim()) {
      setSerieFormError('La serie es obligatoria.');
      return;
    }
    if (!serieForm.tipo_documento) {
      setSerieFormError('Selecciona un tipo de documento.');
      return;
    }

    setSerieSaving(true);
    setSerieFormError(null);
    try {
      const payload = {
        serie: serieForm.serie.trim(),
        descripcion: serieForm.descripcion.trim() || null,
        tipo_documento: serieForm.tipo_documento,
        es_fiscal: serieTipoSoportaFiscal ? serieForm.es_fiscal : false,
        activa: serieForm.activa,
      };

      if (serieForm.id) {
        await updateSerieDocumento(serieForm.id, payload);
      } else {
        await createSerieDocumento(payload);
      }

      handleCloseSerieDialog();
      await loadData();
    } catch (err: any) {
      setSerieFormError(err?.message || 'No se pudo guardar la serie.');
    } finally {
      setSerieSaving(false);
    }
  };

  const handleToggleSerieActiva = async (item: SerieDocumentoItem, activa: boolean) => {
    try {
      setError(null);
      await updateSerieDocumentoActiva(item.id, activa);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el estatus de la serie.');
    }
  };

  const handleOpenCreateAsignacion = () => {
    setAsignacionForm(emptyAsignacionForm());
    setAsignacionFormError(null);
    setAsignacionDialogOpen(true);
  };

  const handleOpenEditAsignacion = (item: AsignacionSerieDocumentoItem) => {
    setAsignacionForm({
      id: item.id,
      usuario_id: item.usuario_id,
      tipo_documento: item.tipo_documento,
      serie_documento_id: item.serie_documento_id,
    });
    setAsignacionFormError(null);
    setAsignacionDialogOpen(true);
  };

  const handleCloseAsignacionDialog = () => {
    setAsignacionDialogOpen(false);
    setAsignacionForm(emptyAsignacionForm());
    setAsignacionFormError(null);
  };

  const handleAsignacionFormChange = (field: keyof AsignacionFormState, value: string | number | '') => {
    setAsignacionForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'tipo_documento') {
        next.serie_documento_id = '';
      }
      return next;
    });
  };

  const handleSubmitAsignacion = async () => {
    if (!asignacionForm.usuario_id) {
      setAsignacionFormError('Selecciona un usuario.');
      return;
    }
    if (!asignacionForm.tipo_documento) {
      setAsignacionFormError('Selecciona un tipo de documento.');
      return;
    }
    if (!asignacionForm.serie_documento_id) {
      setAsignacionFormError('Selecciona una serie.');
      return;
    }

    setAsignacionSaving(true);
    setAsignacionFormError(null);
    try {
      const payload = {
        usuario_id: Number(asignacionForm.usuario_id),
        serie_documento_id: Number(asignacionForm.serie_documento_id),
        tipo_documento: asignacionForm.tipo_documento,
      };

      if (asignacionForm.id) {
        await updateAsignacionSerieDocumento(asignacionForm.id, payload);
      } else {
        await createAsignacionSerieDocumento(payload);
      }

      handleCloseAsignacionDialog();
      await loadData();
    } catch (err: any) {
      setAsignacionFormError(err?.message || 'No se pudo guardar la asignación.');
    } finally {
      setAsignacionSaving(false);
    }
  };

  const handleDeleteAsignacion = async (item: AsignacionSerieDocumentoItem) => {
    const confirmed = window.confirm(`¿Eliminar la asignación de ${item.usuario_nombre} para ${item.tipo_documento_nombre ?? item.tipo_documento}?`);
    if (!confirmed) return;

    try {
      setError(null);
      await deleteAsignacionSerieDocumento(item.id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar la asignación.');
    }
  };

  const renderSeriesTable = () => (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#fff' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Serie</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell>Tipo de documento</TableCell>
            <TableCell>Fiscal / No fiscal</TableCell>
            <TableCell align="center">Activa</TableCell>
            <TableCell align="right">Último folio</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {seriesOrdenadas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No hay series configuradas.
              </TableCell>
            </TableRow>
          ) : (
            seriesOrdenadas.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{item.serie}</TableCell>
                <TableCell>{item.descripcion || '—'}</TableCell>
                <TableCell>{item.tipo_documento_nombre || item.tipo_documento}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={item.es_fiscal ? 'primary' : 'default'}
                    label={item.es_fiscal ? 'Fiscal' : 'No fiscal'}
                    variant={item.es_fiscal ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={item.activa}
                    onChange={(event) => void handleToggleSerieActiva(item, event.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="right">{Number(item.ultimo_numero ?? 0).toLocaleString('es-MX')}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpenEditSerie(item)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderAsignacionesTable = () => (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#fff' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Usuario</TableCell>
            <TableCell>Tipo de documento</TableCell>
            <TableCell>Serie</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {asignaciones.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No hay asignaciones por usuario.
              </TableCell>
            </TableRow>
          ) : (
            asignaciones.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.usuario_nombre}</TableCell>
                <TableCell>{item.tipo_documento_nombre || item.tipo_documento}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={700}>{item.serie}</Typography>
                    <Chip
                      size="small"
                      label={item.es_fiscal ? 'Fiscal' : 'No fiscal'}
                      variant={item.es_fiscal ? 'filled' : 'outlined'}
                      color={item.es_fiscal ? 'primary' : 'default'}
                    />
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpenEditAsignacion(item)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => void handleDeleteAsignacion(item)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Series de documentos
        </Typography>
        <Typography variant="body2" color="#4b5563">
          Administra las series por tipo de documento y sus asignaciones por usuario, sin cambiar el motor de resolución.
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ borderColor: '#e5e7eb', borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_event, nextValue) => setTab(nextValue)}>
          <Tab label="Series" />
          <Tab label="Asignaciones por usuario" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <>
              <TabPanel value={tab} index={TAB_SERIES}>
                <Toolbar disableGutters sx={{ justifyContent: 'space-between', pb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                    Series configuradas
                  </Typography>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateSerie}>
                    Alta
                  </Button>
                </Toolbar>
                {renderSeriesTable()}
              </TabPanel>

              <TabPanel value={tab} index={TAB_ASIGNACIONES}>
                <Toolbar disableGutters sx={{ justifyContent: 'space-between', pb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                    Asignaciones por usuario
                  </Typography>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateAsignacion}>
                    Alta
                  </Button>
                </Toolbar>
                {renderAsignacionesTable()}
              </TabPanel>
            </>
          )}
        </Box>
      </Paper>

      <Dialog open={serieDialogOpen} onClose={serieSaving ? undefined : handleCloseSerieDialog} fullWidth maxWidth="sm">
        <DialogTitle>{serieForm.id ? 'Editar serie' : 'Alta de serie'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {serieFormError && <Alert severity="error">{serieFormError}</Alert>}

            <TextField
              label="Serie"
              value={serieForm.serie}
              onChange={(event) => handleSerieFormChange('serie', event.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Descripción"
              value={serieForm.descripcion}
              onChange={(event) => handleSerieFormChange('descripcion', event.target.value)}
              fullWidth
            />

            <FormControl fullWidth required>
              <InputLabel id="series-documento-tipo-label">Tipo de documento</InputLabel>
              <Select
                labelId="series-documento-tipo-label"
                label="Tipo de documento"
                value={serieForm.tipo_documento}
                onChange={(event) => handleSerieFormChange('tipo_documento', event.target.value)}
              >
                {tiposDocumentoOrdenados.map((tipo) => (
                  <MenuItem key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={serieTipoSoportaFiscal ? serieForm.es_fiscal : false}
                    onChange={(event) => handleSerieFormChange('es_fiscal', event.target.checked)}
                    disabled={!serieTipoSoportaFiscal}
                  />
                }
                label={`Fiscal: ${formatBooleanLabel(serieTipoSoportaFiscal ? serieForm.es_fiscal : false)}`}
              />
              {!serieTipoSoportaFiscal && (
                <FormHelperText>Solo aplica para Factura y Nota de crédito.</FormHelperText>
              )}
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={serieForm.activa}
                  onChange={(event) => handleSerieFormChange('activa', event.target.checked)}
                />
              }
              label={`Activa: ${formatBooleanLabel(serieForm.activa)}`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSerieDialog} disabled={serieSaving}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSubmitSerie()} disabled={serieSaving}>
            {serieSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={asignacionDialogOpen} onClose={asignacionSaving ? undefined : handleCloseAsignacionDialog} fullWidth maxWidth="sm">
        <DialogTitle>{asignacionForm.id ? 'Editar asignación' : 'Alta de asignación'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {asignacionFormError && <Alert severity="error">{asignacionFormError}</Alert>}

            <FormControl fullWidth required>
              <InputLabel id="series-documento-usuario-label">Usuario</InputLabel>
              <Select
                labelId="series-documento-usuario-label"
                label="Usuario"
                value={asignacionForm.usuario_id}
                onChange={(event) => handleAsignacionFormChange('usuario_id', Number(event.target.value))}
              >
                {usuariosActivos.map((usuario) => (
                  <MenuItem key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel id="series-documento-asignacion-tipo-label">Tipo de documento</InputLabel>
              <Select
                labelId="series-documento-asignacion-tipo-label"
                label="Tipo de documento"
                value={asignacionForm.tipo_documento}
                onChange={(event) => handleAsignacionFormChange('tipo_documento', event.target.value)}
              >
                {tiposDocumentoOrdenados.map((tipo) => (
                  <MenuItem key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required disabled={!asignacionForm.tipo_documento}>
              <InputLabel id="series-documento-asignacion-serie-label">Serie</InputLabel>
              <Select
                labelId="series-documento-asignacion-serie-label"
                label="Serie"
                value={asignacionForm.serie_documento_id}
                onChange={(event) => handleAsignacionFormChange('serie_documento_id', Number(event.target.value))}
              >
                {seriesDisponiblesAsignacion.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.serie}
                    {item.descripcion ? ` · ${item.descripcion}` : ''}
                    {TIPOS_CON_VARIANTE_FISCAL.has(item.tipo_documento)
                      ? item.es_fiscal
                        ? ' · Fiscal'
                        : ' · No fiscal'
                      : ''}
                  </MenuItem>
                ))}
              </Select>
              {asignacionForm.tipo_documento && seriesDisponiblesAsignacion.length === 0 && (
                <FormHelperText>No hay series activas disponibles para ese tipo de documento.</FormHelperText>
              )}
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAsignacionDialog} disabled={asignacionSaving}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSubmitAsignacion()} disabled={asignacionSaving}>
            {asignacionSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}