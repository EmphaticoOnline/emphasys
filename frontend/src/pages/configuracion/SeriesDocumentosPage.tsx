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
import RichTextEditor from '../../components/RichTextEditor';
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
import { useSession } from '../../session/useSession';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { Tooltip } from '@mui/material';
import { CloseRounded, SaveOutlined } from '@mui/icons-material';
import { catalogoTabsSx } from '../../components/catalogo/catalogoSurfaces';
import { PanelBar, Pill, Section, actionIconSx, dialogContentSx, dialogPaperSx, dialogTitleSx, editorialTableSx, emptyCellSx, fieldsOnIvorySx, formWellSx, rowIconSx, strongCellSx, wellSx } from '../../components/transporte/transporteVisual';

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
  ultimo_numero: number;
  condiciones_impresion: string;
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
  ultimo_numero: 0,
  condiciones_impresion: '',
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
  const { session } = useSession();
  const isSuperadmin = Boolean(session.user?.es_superadmin);

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
      ultimo_numero: item.ultimo_numero ?? 0,
      condiciones_impresion: item.condiciones_impresion ?? '',
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
        condiciones_impresion: serieForm.condiciones_impresion || null,
        ...(serieForm.id && isSuperadmin ? { ultimo_numero: serieForm.ultimo_numero } : {}),
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
      <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={editorialTableSx}>
        <TableHead>
          <TableRow>
            <TableCell>Serie</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell>Tipo de documento</TableCell>
            <TableCell>Fiscal / No fiscal</TableCell>
            <TableCell align="right">Último folio</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {seriesOrdenadas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={emptyCellSx}>
                No hay series configuradas.
              </TableCell>
            </TableRow>
          ) : (
            seriesOrdenadas.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={strongCellSx}>{item.serie}</TableCell>
                <TableCell>{item.descripcion || '—'}</TableCell>
                <TableCell>{item.tipo_documento_nombre || item.tipo_documento}</TableCell>
                <TableCell>
                  <Pill active={item.es_fiscal} label={item.es_fiscal ? 'Fiscal' : 'No fiscal'} />
                </TableCell>
                <TableCell align="right">{Number(item.ultimo_numero ?? 0).toLocaleString('es-MX')}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                    <Tooltip title="Editar">
                      <IconButton size="small" sx={rowIconSx} onClick={() => handleOpenEditSerie(item)}>
                        <EditIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={item.activa ? 'Desactivar' : 'Activar'}>
                      <Switch
                        size="small"
                        checked={item.activa}
                        onChange={(event) => void handleToggleSerieActiva(item, event.target.checked)}
                      />
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderAsignacionesTable = () => (
      <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={editorialTableSx}>
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
              <TableCell colSpan={4} align="center" sx={emptyCellSx}>
                No hay asignaciones por usuario.
              </TableCell>
            </TableRow>
          ) : (
            asignaciones.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={strongCellSx}>{item.usuario_nombre}</TableCell>
                <TableCell>{item.tipo_documento_nombre || item.tipo_documento}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={700} sx={(theme) => ({ color: theme.emphasys.content.foreground })}>{item.serie}</Typography>
                    <Pill active={item.es_fiscal} label={item.es_fiscal ? 'Fiscal' : 'No fiscal'} />
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Editar">
                      <IconButton size="small" sx={rowIconSx} onClick={() => handleOpenEditAsignacion(item)}>
                        <EditIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" sx={rowIconSx} onClick={() => void handleDeleteAsignacion(item)}>
                        <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <ConfigPageFrame>
      <ConfigPageHeader title="Series de documentos" description="Administra las series por tipo de documento y sus asignaciones por usuario, sin cambiar el motor de resolución." />

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={wellSx}>
        <Tabs value={tab} onChange={(_event, nextValue) => setTab(nextValue)} sx={catalogoTabsSx}>
          <Tab label="Series" />
          <Tab label="Asignaciones por usuario" />
        </Tabs>

        <Box>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <>
              <TabPanel value={tab} index={TAB_SERIES}>
                <PanelBar title="Series configuradas">
                  <Tooltip title="Alta">
                    <IconButton size="small" sx={actionIconSx} onClick={handleOpenCreateSerie}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </PanelBar>
                {renderSeriesTable()}
              </TabPanel>

              <TabPanel value={tab} index={TAB_ASIGNACIONES}>
                <PanelBar title="Asignaciones por usuario">
                  <Tooltip title="Alta">
                    <IconButton size="small" sx={actionIconSx} onClick={handleOpenCreateAsignacion}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </PanelBar>
                {renderAsignacionesTable()}
              </TabPanel>
            </>
          )}
        </Box>
      </Box>

      <Dialog open={serieDialogOpen} onClose={serieSaving ? undefined : handleCloseSerieDialog} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <ConfigPageHeader
            eyebrow="Series de documentos"
            title={serieForm.id ? 'Editar serie' : 'Alta de serie'}
            actions={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={
                    <Switch
                      size="small"
                      checked={serieForm.activa}
                      onChange={(event) => handleSerieFormChange('activa', event.target.checked)}
                    />
                  }
                  label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Activa</Typography>}
                />
                <Tooltip title="Cancelar">
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={handleCloseSerieDialog} disabled={serieSaving}><CloseRounded fontSize="small" /></IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={serieSaving ? 'Guardando...' : 'Guardar'}>
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={() => void handleSubmitSerie()} disabled={serieSaving}>
                      {serieSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
            {serieFormError && <Alert severity="error">{serieFormError}</Alert>}
          <Section title="Serie" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>

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

          </Stack>
          </Section>

          <Section title="Condiciones para impresión" inset>
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={(theme) => ({ color: theme.emphasys.content.muted })}>
                Texto que aparecerá al pie del PDF para esta serie documental.
              </Typography>
              <RichTextEditor
                content={serieForm.condiciones_impresion}
                onChange={(html) => handleSerieFormChange('condiciones_impresion', html)}
                placeholder="Captura condiciones, advertencias o notas legales para esta serie..."
                minHeight={180}
              />
            </Stack>
          </Section>

            {serieForm.id && isSuperadmin && (
              <Section title="Folio" inset>
              <TextField
                label="Último folio"
                type="number"
                value={serieForm.ultimo_numero}
                onChange={(event) => handleSerieFormChange('ultimo_numero', Math.max(0, parseInt(event.target.value, 10) || 0))}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
                helperText="El siguiente documento generado usará este número + 1."
              />
              </Section>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={asignacionDialogOpen} onClose={asignacionSaving ? undefined : handleCloseAsignacionDialog} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <ConfigPageHeader
            eyebrow="Series de documentos"
            title={asignacionForm.id ? 'Editar asignación' : 'Alta de asignación'}
            actions={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Cancelar">
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={handleCloseAsignacionDialog} disabled={asignacionSaving}><CloseRounded fontSize="small" /></IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={asignacionSaving ? 'Guardando...' : 'Guardar'}>
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={() => void handleSubmitAsignacion()} disabled={asignacionSaving}>
                      {asignacionSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
            {asignacionFormError && <Alert severity="error">{asignacionFormError}</Alert>}
          <Section title="Asignación" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>

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
          </Section>
          </Box>
        </DialogContent>
      </Dialog>
    </ConfigPageFrame>
  );
}
