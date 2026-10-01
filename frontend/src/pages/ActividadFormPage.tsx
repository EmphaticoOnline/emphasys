import * as React from 'react';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Link,
  CircularProgress,
  Collapse,
  FormControlLabel,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { abrirCotizacionPdfEnNuevaVentana, getCotizacion } from '../services/cotizacionesService';
import { apiFetch } from '../services/apiFetch';
import { getContacto } from '../services/contactos.api';
import { loadSession } from '../session/sessionStorage';
import type { Contacto, ContactoDetalle } from '../types/contactos.types';
import type { CotizacionPartida } from '../types/cotizacion';
import { SendWhatsappTemplateDialog } from '../components/SendWhatsappTemplateDialog';
import RichTextEditor from '../components/RichTextEditor';
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx } from '../components/catalogo/catalogoSurfaces';

dayjs.locale('es');

type ActividadDetalle = {
  id: number;
  tipo_actividad: string;
  descripcion: string | null;
  observaciones: string | null;
  fecha_programada: string;
  contacto_id: number | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  estatus: string | null;
  resultado: string | null;
  recordatorio: boolean | null;
  recordatorio_minutos: number | null;
  contacto: ContactoActividad | null;
  meta_lead: MetaLeadActividad | null;
  whatsapp_conversacion: ConversacionActividad | null;
};

type ContactoActividad = {
  id: number;
  nombre: string | null;
  nombre_contacto: string | null;
  telefono: string | null;
  telefono_secundario: string | null;
  email: string | null;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  zona: string | null;
  observaciones: string | null;
};

type MetaLeadActividad = {
  leadgen_id: string;
  form_id: string | null;
  form_name: string | null;
  created_time: string | null;
  recibido_at: string | null;
  field_data: unknown;
  campaign_name: string | null;
};

type ConversacionActividad = {
  id: number;
  estado: string | null;
  creada_en: string | null;
  ultimo_mensaje_en: string | null;
};

type ActividadFormState = {
  tipo_actividad: string;
  descripcion: string;
  observaciones: string;
  fecha_programada: string;
  contacto_id: string;
  oportunidad_id: string;
  recordatorio: boolean;
  recordatorio_minutos: string;
};

type ContactoResumen = {
  id: number;
  nombre: string;
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
      descripcion: form.descripcion,
      observaciones: form.observaciones,
      fecha_programada: new Date(form.fecha_programada).toISOString(),
      contacto_id: form.contacto_id ? Number(form.contacto_id) : null,
      oportunidad_id: form.oportunidad_id ? Number(form.oportunidad_id) : null,
      recordatorio: form.recordatorio,
      recordatorio_minutos: form.recordatorio && form.recordatorio_minutos.trim()
        ? Number(form.recordatorio_minutos)
        : null,
    },
  });
}

async function crearActividad(form: ActividadFormState, usuarioAsignadoId: number) {
  return apiFetch<ActividadDetalle>('/api/crm/actividades', {
    method: 'POST',
    body: {
      usuario_asignado_id: usuarioAsignadoId,
      tipo_actividad: form.tipo_actividad,
      descripcion: form.descripcion,
      observaciones: form.observaciones,
      fecha_programada: new Date(form.fecha_programada).toISOString(),
      contacto_id: form.contacto_id ? Number(form.contacto_id) : null,
      oportunidad_id: form.oportunidad_id ? Number(form.oportunidad_id) : null,
      recordatorio: form.recordatorio,
      recordatorio_minutos: form.recordatorio && form.recordatorio_minutos.trim()
        ? Number(form.recordatorio_minutos)
        : null,
    },
  });
}

function normalizarContactoNombre(contacto: Contacto | ContactoDetalle) {
  const base = 'contacto' in contacto ? contacto.contacto : contacto;
  return base.nombre_contacto?.trim() || base.nombre?.trim() || `Contacto #${base.id}`;
}

function obtenerContactoBase(contacto: Contacto | ContactoDetalle): Contacto {
  return 'contacto' in contacto ? contacto.contacto : contacto;
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

function formatMetaRequestDate(createdTime: string | null, recibidoAt: string | null) {
  const candidates = [createdTime, recibidoAt];

  for (const candidate of candidates) {
    if (!candidate || !String(candidate).trim()) continue;

    const raw = String(candidate).trim();
    const numericTimestamp = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
    const date = numericTimestamp !== null && Number.isFinite(numericTimestamp)
      ? new Date(numericTimestamp * 1000)
      : new Date(raw);

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
  }

  return null;
}

function formatCurrency(value: number | string | null) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '$0.00';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

function DetailRow({ label, value, dense = false }: { label: string; value: string; dense?: boolean }) {
  const tokens = useTheme().emphasys;
  return (
    <Stack spacing={dense ? 0 : 0.15}>
      <Typography variant="caption" sx={{ color: tokens.content.muted, fontWeight: 700, letterSpacing: '0.04em', fontSize: dense ? 10 : 11, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography sx={{ color: tokens.content.foreground, fontWeight: 650, fontSize: dense ? 13 : 14, lineHeight: 1.25 }}>{value}</Typography>
    </Stack>
  );
}

function readableFieldName(value: string) {
  const labels: Record<string, string> = { full_name: 'Nombre', company_name: 'Empresa', phone_number: 'Teléfono', email: 'Correo', state: 'Estado' };
  if (labels[value]) return labels[value];
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CAMPOS_IDENTIDAD_META = new Set([
  'full_name',
  'nombre',
  'email',
  'correo',
  'phone_number',
  'telefono',
  'phone',
  'company_name',
  'empresa',
]);

function valorContactoParaCampoMeta(
  key: string,
  contacto: ContactoActividad,
  personaNombre: string,
  empresaNombre: string,
) {
  switch (key) {
    case 'full_name':
    case 'nombre':
      return personaNombre;
    case 'email':
    case 'correo':
      return contacto.email ?? '';
    case 'phone_number':
    case 'telefono':
    case 'phone':
      return contacto.telefono ?? '';
    case 'company_name':
    case 'empresa':
      return empresaNombre;
    default:
      return null;
  }
}

function valoresCoinciden(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function esNotaAutomaticaMeta(notas: string) {
  return notas.trim().startsWith('Nueva solicitud comercial de Meta Leads.');
}

function fieldValues(item: any): string[] {
  const values = item?.values ?? item?.value;
  if (Array.isArray(values)) return values.map((value) => typeof value === 'string' ? value : JSON.stringify(value));
  if (values == null) return [];
  return [typeof values === 'string' ? values : JSON.stringify(values)];
}

type ActividadFormPageProps = {
  embedded?: boolean;
  actividadId?: number | null;
  onSaved?: () => void;
};

export default function ActividadFormPage({ embedded = false, actividadId = null, onSaved }: ActividadFormPageProps = {}) {
  const { id: idRuta } = useParams();
  const id = embedded ? (actividadId ? String(actividadId) : undefined) : idRuta;
  const location = useLocation();
  const navigate = useNavigate();
  const session = React.useMemo(() => loadSession(), []);
  const sessionUserId = session.user?.id ?? null;
  const contactoIdParam = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('contacto_id');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [location.search]);
  const locationState = location.state as { returnTo?: string; openDrawerContactoId?: number } | null;
  const returnTo = locationState?.returnTo ?? '/crm/actividades';
  const openDrawerContactoId = locationState?.openDrawerContactoId ?? null;
  const isCreateMode = !id;
  const [actividad, setActividad] = React.useState<ActividadDetalle | null>(null);
  const [oportunidad, setOportunidad] = React.useState<OportunidadDetalle | null>(null);
  const [contacto, setContacto] = React.useState<ContactoResumen | null>(null);
  const [partidas, setPartidas] = React.useState<CotizacionPartida[]>([]);
  const [form, setForm] = React.useState<ActividadFormState>({
    tipo_actividad: 'llamada',
    descripcion: '',
    observaciones: '',
    fecha_programada: '',
    contacto_id: '',
    oportunidad_id: '',
    recordatorio: false,
    recordatorio_minutos: '',
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [respuestasAbiertas, setRespuestasAbiertas] = React.useState(false);
  const theme = useTheme();
  const tokens = theme.emphasys;
  const movil = useMediaQuery(theme.breakpoints.down('md'));
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: tokens.content.well,
      ...(embedded ? { minHeight: 32, fontSize: 13 } : {}),
      '& fieldset': { borderColor: tokens.content.border },
    },
    '& .MuiInputLabel-root': {
      color: tokens.content.muted,
      ...(embedded ? { fontSize: 12 } : {}),
    },
    '& .MuiOutlinedInput-input, & .MuiSelect-select': embedded
      ? { fontSize: 13, py: '6px' }
      : {},
  };
  const seccionSx = {
    color: tokens.content.muted,
    fontSize: embedded ? 11 : 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    lineHeight: 1.2,
  };

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        if (id) {
          const data = await fetchActividad(id);
          const oportunidadData = data.oportunidad_id ? await fetchOportunidad(data.oportunidad_id) : null;
          const cotizacion = oportunidadData?.cotizacion_principal_id
            ? await getCotizacion(oportunidadData.cotizacion_principal_id)
            : null;

          if (!mounted) return;

          setActividad(data);
          setOportunidad(oportunidadData);
          setPartidas(cotizacion?.partidas ?? []);
          setContacto(data.contacto_id
            ? {
              id: data.contacto_id,
              nombre: data.cliente_nombre?.trim() || `Contacto #${data.contacto_id}`,
            }
            : null);
          setForm({
            tipo_actividad: data.tipo_actividad || 'llamada',
            descripcion: data.descripcion ?? '',
            observaciones: data.observaciones ?? '',
            fecha_programada: toDateTimeLocal(data.fecha_programada),
            contacto_id: data.contacto_id ? String(data.contacto_id) : '',
            oportunidad_id: data.oportunidad_id ? String(data.oportunidad_id) : '',
            recordatorio: Boolean(data.recordatorio),
            recordatorio_minutos: data.recordatorio_minutos ? String(data.recordatorio_minutos) : '',
          });
        } else {
          const contactoData = contactoIdParam ? await getContacto(contactoIdParam) : null;

          if (!mounted) return;

          const contactoBase = contactoData ? obtenerContactoBase(contactoData) : null;
          setActividad(null);
          setOportunidad(null);
          setPartidas([]);
          setContacto(contactoBase
            ? {
              id: contactoBase.id,
              nombre: normalizarContactoNombre(contactoData!),
            }
            : null);
          setForm({
            tipo_actividad: 'llamada',
            descripcion: '',
            observaciones: '',
            fecha_programada: '',
            contacto_id: contactoBase ? String(contactoBase.id) : '',
            oportunidad_id: '',
            recordatorio: false,
            recordatorio_minutos: '',
          });
        }

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
  }, [contactoIdParam, id]);

  const handleChange = (field: keyof ActividadFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.fecha_programada) {
      setError('Debes capturar la fecha programada');
      return;
    }

    if (!form.contacto_id && !form.oportunidad_id) {
      setError('Debe existir un contacto o una oportunidad para guardar la actividad');
      return;
    }

    if (form.recordatorio) {
      const minutos = Number(form.recordatorio_minutos.trim());
      if (!form.recordatorio_minutos.trim() || !Number.isInteger(minutos) || minutos <= 0) {
        setError('Debes capturar minutos antes con un entero positivo');
        return;
      }
    }

    if (!id && !sessionUserId) {
      setError('No se pudo identificar al usuario actual');
      return;
    }

    try {
      setSaving(true);
      if (id) {
        await guardarActividad(id, form);
      } else {
        await crearActividad(form, Number(sessionUserId));
      }
      if (embedded) onSaved?.();
      else navigate(returnTo, { state: { openDrawerContactoId } });
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

  const handleTemplateSuccess = async (_plantillaNombre: string, result?: { conversacion_id?: number | string | null }) => {
    setTemplateOpen(false);
    if (!id) return;
    const conversationId = result?.conversacion_id;
    if (conversationId) {
      navigate(`/crm/conversaciones?conversation=${encodeURIComponent(String(conversationId))}`);
      return;
    }
    const refreshed = await fetchActividad(id);
    setActividad(refreshed);
  };

  const handleWhatsappAction = () => {
    if (actividad?.whatsapp_conversacion) {
      navigate(`/crm/conversaciones?conversation=${actividad.whatsapp_conversacion.id}`);
      return;
    }
    setTemplateOpen(true);
  };

  const metaFields = actividad?.meta_lead && Array.isArray(actividad.meta_lead.field_data)
    ? actividad.meta_lead.field_data
    : [];
  const metaRequestDate = actividad?.meta_lead
    ? formatMetaRequestDate(actividad.meta_lead.created_time, actividad.meta_lead.recibido_at)
    : null;
  const canStartWhatsapp = Boolean(actividad?.meta_lead && (actividad.whatsapp_conversacion || actividad.contacto?.telefono));
  const personaNombre = actividad?.contacto?.nombre_contacto?.trim() || actividad?.contacto?.nombre?.trim() || (actividad?.contacto ? `Contacto #${actividad.contacto.id}` : '');
  const empresaNombre = actividad?.contacto?.nombre?.trim() || '';
  const mostrarEmpresa = Boolean(empresaNombre && empresaNombre !== personaNombre);
  const respuestasMeta = metaFields.map((item: any, index: number) => {
    const key = String(item?.field_name ?? item?.field ?? item?.name ?? `campo_${index + 1}`);
    return {
      key,
      label: readableFieldName(key),
      value: fieldValues(item).join(', ') || 'Sin valor',
    };
  });
  const resumenMeta = actividad?.contacto
    ? respuestasMeta.filter((item) => {
      if (!CAMPOS_IDENTIDAD_META.has(item.key)) return true;
      const actual = valorContactoParaCampoMeta(item.key, actividad.contacto!, personaNombre, empresaNombre);
      if (actual == null) return true;
      return !valoresCoinciden(actual, item.value);
    })
    : respuestasMeta;
  const notaAutomatica = Boolean(actividad?.meta_lead && esNotaAutomaticaMeta(form.observaciones));
  const etiquetaEstatus = (actividad?.estatus?.trim() || 'Sin estatus').replace(/^./, (letter) => letter.toUpperCase());
  const estatusClave = (actividad?.estatus ?? '').trim().toLowerCase();
  const tonoEstatus = estatusClave === 'realizada'
    ? tokens.metric.applied
    : estatusClave === 'cancelada'
      ? tokens.metric.blocked
      : estatusClave === 'pendiente'
        ? tokens.metric.available
        : { background: tokens.action.wash, foreground: tokens.content.foreground };

  if (loading) {
    return (
      <Box sx={{ p: embedded ? 2 : { xs: 2, md: 3 }, ...(embedded ? { height: '100%', display: 'flex', alignItems: 'center' } : {}) }}>
        <Paper variant="outlined" sx={{ p: embedded ? 2 : 4, width: embedded ? '100%' : undefined, borderRadius: 2, borderColor: tokens.content.border, backgroundColor: tokens.content.elevated }}>
          <Stack spacing={1.5} alignItems="center" justifyContent="center">
            <CircularProgress size={28} sx={{ color: tokens.content.foreground }} />
            <Typography sx={{ color: tokens.content.secondary }}>Cargando actividad...</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  const seguimiento = (
    <Stack spacing={embedded ? 0.75 : 1.5} {...(embedded ? {} : { component: 'form' as const, onSubmit: handleSubmit })}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography sx={seccionSx}>
          SEGUIMIENTO
        </Typography>
        {!actividad?.meta_lead && !isCreateMode ? (
          <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: tonoEstatus.background, color: tonoEstatus.foreground, fontSize: 12, fontWeight: 700 }}>
            {etiquetaEstatus}
          </Box>
        ) : null}
      </Stack>
      {!isCreateMode && actividad?.resultado ? <DetailRow dense={embedded} label="Resultado" value={actividad.resultado} /> : null}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={embedded ? 0.75 : 1.5}>
        <TextField select label="Tipo" value={form.tipo_actividad} onChange={handleChange('tipo_actividad')} fullWidth size="small" sx={fieldSx}>
          {TIPO_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
          <DateTimePicker
            label="Fecha programada"
            value={form.fecha_programada ? dayjs(form.fecha_programada) : null}
            onChange={(value) => {
              setForm((prev) => ({
                ...prev,
                fecha_programada: value ? value.format('YYYY-MM-DDTHH:mm') : '',
              }));
            }}
            format="DD/MM/YYYY HH:mm"
            ampm
            slotProps={{
              textField: { fullWidth: true, size: 'small', sx: fieldSx },
              popper: { placement: 'bottom-start' },
            }}
          />
        </LocalizationProvider>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControlLabel
          sx={embedded ? { m: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } } : undefined}
          control={(
            <Checkbox
              size={embedded ? 'small' : 'medium'}
              checked={form.recordatorio}
              onChange={(event) => {
                const checked = event.target.checked;
                setForm((prev) => ({
                  ...prev,
                  recordatorio: checked,
                  recordatorio_minutos: checked ? prev.recordatorio_minutos : '',
                }));
              }}
              sx={{ color: tokens.content.muted, '&.Mui-checked': { color: tokens.content.foreground } }}
            />
          )}
          label="Recordatorio"
        />
        {form.recordatorio ? (
          <TextField
            label="Minutos antes"
            value={form.recordatorio_minutos}
            onChange={handleChange('recordatorio_minutos')}
            type="number"
            size="small"
            inputProps={{ min: 1 }}
            sx={{ width: 140, ...fieldSx }}
          />
        ) : null}
      </Stack>
      <TextField
        label="Descripción"
        multiline
        minRows={embedded ? 2 : 3}
        value={form.descripcion}
        onChange={handleChange('descripcion')}
        inputProps={{ maxLength: 240 }}
        fullWidth
        sx={{ ...fieldSx, '& .MuiInputBase-input': { fontSize: 13 } }}
      />
      <Typography variant="caption" sx={{ color: tokens.content.muted, fontSize: embedded ? 11 : 12, fontWeight: 700, letterSpacing: '0.04em' }}>Observaciones</Typography>
      <RichTextEditor content={form.observaciones} onChange={(html) => setForm((prev) => ({ ...prev, observaciones: html }))} minHeight={embedded ? 72 : 140} maxHeight={embedded ? 160 : 360} denseToolbar={embedded} />
      {embedded ? null : (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button type="button" onClick={() => navigate(returnTo, { state: { openDrawerContactoId } })} sx={catalogoOutlinedButtonSx}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving} sx={catalogoPrimaryButtonSx}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </Stack>
      )}
    </Stack>
  );

  const origen = actividad?.meta_lead ? (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography sx={seccionSx}>
          ORIGEN
        </Typography>
        <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: tonoEstatus.background, color: tonoEstatus.foreground, fontSize: 12, fontWeight: 700 }}>
          {etiquetaEstatus}
        </Box>
      </Stack>
      <Typography sx={{ color: tokens.content.foreground, fontWeight: 700, fontSize: embedded ? 14 : 16, lineHeight: 1.25 }}>
        Meta · {actividad.meta_lead.form_name?.trim() || 'Formulario no disponible'}
      </Typography>
      {metaRequestDate ? <Typography sx={{ color: tokens.content.secondary }}>Llegó el {metaRequestDate}</Typography> : null}
      {actividad.meta_lead.campaign_name?.trim() ? <DetailRow dense={embedded} label="Campaña" value={actividad.meta_lead.campaign_name} /> : null}
      {resumenMeta.map((item) => (
        <Stack key={`${item.key}-resumen`} direction={movil ? 'column' : 'row'} spacing={movil ? 0.25 : 1.5}>
          <Typography sx={{ color: tokens.content.muted, fontSize: 13, width: movil ? 'auto' : 168, flexShrink: 0 }}>
            {item.key === 'phone_number' || item.key === 'telefono' || item.key === 'phone' ? 'Teléfono en la solicitud' : item.label}
          </Typography>
          <Typography sx={{ color: tokens.content.foreground, fontWeight: 600 }}>{item.value}</Typography>
        </Stack>
      ))}
      {respuestasMeta.length ? (
        <Box>
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => setRespuestasAbiertas((open) => !open)}
            sx={{ fontWeight: 700, fontSize: 13, color: tokens.content.foreground }}
          >
            {respuestasAbiertas ? 'Ocultar respuestas del formulario' : `Ver respuestas del formulario (${respuestasMeta.length})`}
          </Link>
          <Collapse in={respuestasAbiertas}>
            <Stack spacing={0.75} sx={{ pt: 1 }}>
              {respuestasMeta.map((item) => (
                <Stack key={`${item.key}-completa`} direction={movil ? 'column' : 'row'} spacing={movil ? 0 : 1.5}>
                  <Typography sx={{ color: tokens.content.muted, fontSize: 13, width: movil ? 'auto' : 168, flexShrink: 0 }}>{item.label}</Typography>
                  <Typography sx={{ color: tokens.content.foreground, fontSize: 13 }}>{item.value}</Typography>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Box>
      ) : null}
    </Stack>
  ) : null;

  const whatsappButton = actividad?.meta_lead ? (
    <Button variant="contained" size={embedded ? 'small' : 'medium'} disabled={!canStartWhatsapp} onClick={handleWhatsappAction} fullWidth={!embedded} sx={catalogoPrimaryButtonSx}>
      {actividad.whatsapp_conversacion ? 'Abrir conversación' : 'Iniciar WhatsApp'}
    </Button>
  ) : null;

  const persona = actividad?.contacto ? (
    <Stack spacing={embedded ? 0.75 : 2}>
      <Stack spacing={0.25}>
        <Typography sx={{ color: tokens.content.foreground, fontWeight: 700, fontSize: embedded ? 15 : 22, lineHeight: 1.15 }}>
          {personaNombre}
        </Typography>
        {mostrarEmpresa ? <Typography sx={{ color: tokens.content.secondary }}>{empresaNombre}</Typography> : null}
      </Stack>
      {actividad.contacto.vendedor_nombre ? (
        <Stack spacing={0.25}>
          <Typography sx={{ color: tokens.content.muted, fontSize: 12 }}>Atiende</Typography>
          <Typography sx={{ color: tokens.content.foreground, fontWeight: 600 }}>{actividad.contacto.vendedor_nombre}</Typography>
        </Stack>
      ) : null}
      <Stack spacing={embedded ? 0.5 : 1}>
        {actividad.contacto.telefono ? <DetailRow dense={embedded} label="Teléfono" value={actividad.contacto.telefono} /> : null}
        {actividad.contacto.telefono_secundario ? <DetailRow dense={embedded} label="Teléfono secundario" value={actividad.contacto.telefono_secundario} /> : null}
        {actividad.contacto.email ? <DetailRow dense={embedded} label="Email" value={actividad.contacto.email} /> : null}
      </Stack>
      <Link
        component="button"
        type="button"
        underline="hover"
        onClick={() => navigate(`/contactos/${actividad.contacto!.id}`)}
        sx={{ fontWeight: 700, fontSize: 13, alignSelf: 'flex-start', color: tokens.content.foreground }}
      >
        Abrir contacto
      </Link>
      {!movil ? whatsappButton : null}
    </Stack>
  ) : null;

  const oportunidadPanel = oportunidad ? (
    <Stack spacing={embedded ? 0.75 : 1.5}>
      <Paper variant="outlined" sx={{ p: embedded ? 1.25 : 2.25, borderRadius: 2, borderColor: tokens.content.border, backgroundColor: tokens.content.elevated }}>
        <Stack spacing={embedded ? 0.75 : 2}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontSize: embedded ? 13 : 18, fontWeight: 700, color: tokens.content.foreground }}>Detalle de la oportunidad</Typography>
            <Button
              variant="outlined"
              startIcon={<PrintOutlinedIcon />}
              size={embedded ? 'small' : 'medium'}
              onClick={handlePrintPdf}
              disabled={!oportunidad.cotizacion_principal_id || downloadingPdf || loading}
              sx={catalogoOutlinedButtonSx}
            >
              {downloadingPdf ? 'Generando...' : 'PDF'}
            </Button>
          </Stack>
          <DetailRow dense={embedded} label="Folio" value={oportunidad.folio || 'Sin folio'} />
          <DetailRow dense={embedded} label="Cliente" value={oportunidad.contacto_nombre || 'Sin cliente'} />
          <DetailRow dense={embedded} label="Vendedor" value={oportunidad.vendedor_nombre || 'Sin vendedor'} />
          <DetailRow dense={embedded} label="Estatus" value={oportunidad.estatus || 'Sin estatus'} />
          <DetailRow dense={embedded} label="Monto" value={formatCurrency(oportunidad.monto_oportunidad)} />
          <DetailRow dense={embedded} label="Fecha de cotización" value={formatDate(oportunidad.fecha_cotizacion)} />
          <DetailRow dense={embedded} label="Fecha estimada de cierre" value={formatDate(oportunidad.fecha_estimada_cierre)} />
          {oportunidad.comentarios_no_cierre ? <DetailRow dense={embedded} label="Comentarios" value={oportunidad.comentarios_no_cierre} /> : null}
          {actividad?.oportunidad_id ? (
            <Link component="button" type="button" underline="hover" onClick={() => navigate(`/crm/oportunidades/${actividad.oportunidad_id}`)} sx={{ fontWeight: 700, alignSelf: 'flex-start', color: tokens.content.foreground }}>
              Abrir oportunidad
            </Link>
          ) : null}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: embedded ? 1.25 : 2.25, borderRadius: 2, borderColor: tokens.content.border, backgroundColor: tokens.content.elevated }}>
        <Stack spacing={embedded ? 0.75 : 1.5}>
          <Typography sx={{ fontSize: embedded ? 13 : 18, fontWeight: 700, color: tokens.content.foreground }}>Partidas de la cotización</Typography>
          {partidas.length ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: tokens.table.headerFg, fontWeight: 700, borderColor: tokens.table.line }}>Producto</TableCell>
                    <TableCell align="right" sx={{ color: tokens.table.headerFg, fontWeight: 700, borderColor: tokens.table.line }}>Cantidad</TableCell>
                    <TableCell align="right" sx={{ color: tokens.table.headerFg, fontWeight: 700, borderColor: tokens.table.line }}>Precio</TableCell>
                    <TableCell align="right" sx={{ color: tokens.table.headerFg, fontWeight: 700, borderColor: tokens.table.line }}>Importe</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {partidas.map((partida) => (
                    <TableRow key={partida.id} hover>
                      <TableCell>{partida.producto_descripcion || partida.descripcion_alterna || 'Sin producto'}</TableCell>
                      <TableCell align="right">{partida.cantidad}</TableCell>
                      <TableCell align="right">{formatCurrency(partida.precio_unitario)}</TableCell>
                      <TableCell align="right">{formatCurrency(partida.subtotal_partida)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography sx={{ color: tokens.content.muted }}>Esta cotización no tiene partidas registradas.</Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  ) : null;

  const cuerpo = (
    <Box sx={{ p: embedded ? 0 : { xs: 2, md: 3 }, width: '100%', maxWidth: embedded ? 'none' : 920, mx: 'auto' }}>
      <Stack spacing={embedded ? 1 : 2}>
        {isCreateMode ? (
          <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.content.foreground }}>Nueva actividad</Typography>
        ) : null}
        {contacto && isCreateMode ? (
          <Typography sx={{ color: tokens.content.secondary }}>{contacto.nombre}</Typography>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {isCreateMode ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: tokens.content.border, backgroundColor: tokens.content.elevated }}>{seguimiento}</Paper>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: tokens.content.border, backgroundColor: tokens.content.elevated, overflow: 'hidden' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: embedded ? '1fr' : { xs: '1fr', md: '272px minmax(0, 1fr)' } }}>
              <Box sx={{ bgcolor: tokens.content.hover, p: embedded ? '10px 12px' : '20px 18px 16px', borderRight: embedded ? 'none' : { md: `1px solid ${tokens.content.border}` }, borderBottom: embedded ? `1px solid ${tokens.content.border}` : { xs: `1px solid ${tokens.content.border}`, md: 'none' } }}>
                {persona}
                {movil ? <Box sx={{ mt: persona ? 2 : 0 }}>{whatsappButton}</Box> : null}
              </Box>
              <Stack spacing={embedded ? 1 : 2} sx={{ p: embedded ? '10px 12px' : '18px 20px 16px' }}>
                {origen}
                {origen ? <Box sx={{ borderTop: `1px solid ${tokens.content.border}` }} /> : null}
                {seguimiento}
              </Stack>
            </Box>
          </Paper>
        )}
        {oportunidadPanel}
      </Stack>
      {actividad?.meta_lead && actividad.contacto?.telefono && !actividad.whatsapp_conversacion ? (
        <SendWhatsappTemplateDialog
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
          contactoId={actividad.contacto.id}
          telefono={actividad.contacto.telefono}
          actividadId={actividad.id}
          contacto={{ nombre: actividad.contacto.nombre, vendedor: actividad.contacto.vendedor_nombre, formularioMeta: actividad.meta_lead.form_name }}
          onSuccess={(plantillaNombre, result) => { void handleTemplateSuccess(plantillaNombre, result); }}
        />
      ) : null}
    </Box>
  );

  if (!embedded) return cuerpo;

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        component="form"
        id="actividad-detalle-form"
        onSubmit={handleSubmit}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.25, py: 1 }}
      >
        {cuerpo}
      </Box>
      <Box sx={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderTop: `1px solid ${tokens.content.border}`,
        bgcolor: tokens.content.elevated,
      }}>
        <Button type="submit" form="actividad-detalle-form" variant="contained" size="small" disabled={saving || loading} sx={catalogoPrimaryButtonSx}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Box>
    </Box>
  );
}
