import * as React from 'react';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import dayjs from 'dayjs';
import {
  Alert,
  Box,
  Button,
  Link,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
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
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { abrirCotizacionPdfEnNuevaVentana, getCotizacion } from '../services/cotizacionesService';
import { apiFetch } from '../services/apiFetch';
import type { CotizacionPartida } from '../types/cotizacion';

type ActividadDetalle = {
  id: number;
  tipo_actividad: string;
  notas: string | null;
  fecha_programada: string;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
};

type ActividadFormState = {
  tipo_actividad: string;
  notas: string;
  fecha_programada: string;
  oportunidad_id: string;
};

type OportunidadDetalle = {
  id: number;
  folio: string;
  cotizacion_principal_id: number | null;
  contacto_nombre: string | null;
  vendedor_nombre: string | null;
  estatus: string | null;
  comentarios_no_cierre: string;
  monto_oportunidad: number | string | null;
  fecha_cotizacion: string | null;
  fecha_creacion: string | null;
  fecha_estimada_cierre: string | null;
};

const TIPO_OPTIONS = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
  { value: 'tarea', label: 'Tarea' },
];

function toDateTimeLocal(value: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

async function fetchActividad(id: string) {
  return apiFetch<ActividadDetalle>(`/api/crm/actividades/${id}`);
}

async function fetchOportunidad(id: number) {
  return apiFetch<OportunidadDetalle>(`/api/crm/oportunidades/${id}`);
}

async function guardarActividad(id: string, form: ActividadFormState) {
  return apiFetch<ActividadDetalle>(`/api/crm/actividades/${id}`, {
    method: 'PUT',
    body: {
      tipo_actividad: form.tipo_actividad,
      notas: form.notas,
      fecha_programada: new Date(form.fecha_programada).toISOString(),
      oportunidad_id: form.oportunidad_id ? Number(form.oportunidad_id) : null,
    },
  });
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCurrency(value: number | string | null) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '$0.00';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>{value}</Typography>
    </Stack>
  );
}

export default function ActividadFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actividad, setActividad] = React.useState<ActividadDetalle | null>(null);
  const [oportunidad, setOportunidad] = React.useState<OportunidadDetalle | null>(null);
  const [partidas, setPartidas] = React.useState<CotizacionPartida[]>([]);
  const [form, setForm] = React.useState<ActividadFormState>({
    tipo_actividad: 'llamada',
    notas: '',
    fecha_programada: '',
    oportunidad_id: '',
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;

    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchActividad(id);
        const oportunidadData = data.oportunidad_id ? await fetchOportunidad(data.oportunidad_id) : null;
        const cotizacion = oportunidadData?.cotizacion_principal_id
          ? await getCotizacion(oportunidadData.cotizacion_principal_id)
          : null;

        if (!mounted) return;

        setActividad(data);
        setOportunidad(oportunidadData);
        setPartidas(cotizacion?.partidas ?? []);
        setForm({
          tipo_actividad: data.tipo_actividad || 'llamada',
          notas: data.notas ?? '',
          fecha_programada: toDateTimeLocal(data.fecha_programada),
          oportunidad_id: data.oportunidad_id ? String(data.oportunidad_id) : '',
        });
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar la actividad');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleChange = (field: keyof ActividadFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!id) return;

    try {
      setSaving(true);
      await guardarActividad(id, form);
      navigate('/crm/actividades');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la actividad');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!oportunidad?.cotizacion_principal_id) {
      return;
    }

    try {
      setDownloadingPdf(true);
      await abrirCotizacionPdfEnNuevaVentana(oportunidad.cotizacion_principal_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, borderColor: '#dbe3ee' }}>
          <Stack spacing={1.5} alignItems="center" justifyContent="center">
            <CircularProgress size={30} />
            <Typography sx={{ color: '#475569' }}>Cargando actividad...</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, maxWidth: 'lg', mx: 'auto' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Editar actividad
          </Typography>
          <Typography sx={{ color: '#475569', mt: 0.35 }}>
            Ajusta los datos básicos de la actividad.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5}>
              {actividad?.oportunidad_id ? (
                <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 3, borderColor: '#dbe3ee' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ color: '#334155' }}>
                      Oportunidad: {actividad.cliente_nombre ?? 'Sin cliente'}
                    </Typography>
                    <Link
                      component="button"
                      type="button"
                      underline="hover"
                      onClick={() => navigate(`/crm/oportunidades/${actividad.oportunidad_id}`)}
                      sx={{ fontWeight: 600 }}
                    >
                      Abrir
                    </Link>
                  </Stack>
                </Paper>
              ) : null}

              <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#dbe3ee' }}>
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Tipo"
                    value={form.tipo_actividad}
                    onChange={handleChange('tipo_actividad')}
                    fullWidth
                  >
                    {TIPO_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label="Notas"
                    value={form.notas}
                    onChange={handleChange('notas')}
                    fullWidth
                    multiline
                    minRows={3}
                  />

                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateTimePicker
                      label="Fecha programada"
                      value={form.fecha_programada ? dayjs(form.fecha_programada) : null}
                      onChange={(value) => {
                        setForm((prev) => ({
                          ...prev,
                          fecha_programada: value ? value.format('YYYY-MM-DDTHH:mm') : '',
                        }));
                      }}
                      ampm
                      slotProps={{
                        textField: {
                          fullWidth: true,
                        },
                        popper: {
                          placement: 'bottom-start',
                        },
                      }}
                    />
                  </LocalizationProvider>

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                    <Button color="inherit" onClick={() => navigate('/crm/actividades')}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="contained" disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            {oportunidad ? (
              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, borderColor: '#dbe3ee' }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        Detalle de la oportunidad
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<PrintOutlinedIcon />}
                        onClick={handlePrintPdf}
                        disabled={!oportunidad.cotizacion_principal_id || downloadingPdf || loading}
                      >
                        {downloadingPdf ? 'Generando...' : 'PDF'}
                      </Button>
                    </Stack>
                    <DetailRow label="Folio" value={oportunidad.folio || 'Sin folio'} />
                    <DetailRow label="Cliente" value={oportunidad.contacto_nombre || 'Sin cliente'} />
                    <DetailRow label="Vendedor" value={oportunidad.vendedor_nombre || 'Sin vendedor'} />
                    <DetailRow label="Estatus" value={oportunidad.estatus || 'Sin estatus'} />
                    <DetailRow label="Monto" value={formatCurrency(oportunidad.monto_oportunidad)} />
                    <DetailRow label="Fecha de cotización" value={formatDate(oportunidad.fecha_cotizacion)} />
                    <DetailRow label="Fecha estimada de cierre" value={formatDate(oportunidad.fecha_estimada_cierre)} />
                    {oportunidad.comentarios_no_cierre ? (
                      <DetailRow label="Comentarios" value={oportunidad.comentarios_no_cierre} />
                    ) : null}
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, borderColor: '#dbe3ee' }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      Partidas de la cotización
                    </Typography>

                    {partidas.length ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Producto</TableCell>
                              <TableCell align="right">Cantidad</TableCell>
                              <TableCell align="right">Precio</TableCell>
                              <TableCell align="right">Importe</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {partidas.map((partida) => (
                              <TableRow key={partida.id} hover>
                                <TableCell>
                                  {partida.producto_descripcion || partida.descripcion_alterna || 'Sin producto'}
                                </TableCell>
                                <TableCell align="right">{partida.cantidad}</TableCell>
                                <TableCell align="right">{formatCurrency(partida.precio_unitario)}</TableCell>
                                <TableCell align="right">{formatCurrency(partida.subtotal_partida)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography sx={{ color: '#64748b' }}>
                        Esta cotización no tiene partidas registradas.
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            ) : null}
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}