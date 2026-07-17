import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReplyIcon from '@mui/icons-material/Reply';
import ReplayIcon from '@mui/icons-material/Replay';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useNavigate } from 'react-router-dom';
import ForwardIcon from '@mui/icons-material/Forward';
import { apiFetch, buildAuthHeaders } from '../api/apiClient';
import { useSession } from '../session/useSession';
import { SendWhatsappTemplateDialog } from '../components/SendWhatsappTemplateDialog';
import { ForwardMessageDialog, type ForwardableMessage } from '../components/ForwardMessageDialog';
import LeadsDesktopView from '../components/leads/LeadsDesktopView';
import LeadsMobileView from '../components/leads/LeadsMobileView';
import { fetchContactos } from '../services/contactosService';
import type { Contacto } from '../types/contactos.types';
import { actualizarContacto } from '../services/contactos.api';
import { computeListContinuation } from '../utils/messageListContinuation';
import { linkifyMessageText } from '../components/LinkifiedText';
import { fetchConversaciones, fetchMensajesConversacion } from '../services/conversacionesService';
import {
  DEFAULT_REGLAS_SEGUIMIENTO,
  applyDerivedLeadState,
  buildLeadOwnerLabel,
  buildReplyPreviewText,
  buildWhatsappSendErrorInfo,
  deriveLeadState,
  deriveNextAction,
  esSeguimientoPendiente,
  filterWhatsappMessages,
  formatFechaHora,
  formatMinutes,
  formatMinutesAgo,
  getIdleSeverity,
  getLastWhatsappPreview,
  mapMessages,
  minutesSince,
  normalizeEtapaOportunidad,
  ordenarLeads,
} from '../utils/leadsDerivation';

export type Priority = 'Alta' | 'Media' | 'Baja';
export type NextAction = 'Responder' | 'Llamar' | 'Enviar cotización' | 'Agendar demo' | 'Cerrar';
export type EtapaOportunidad =
  | 'nuevo'
  | 'contactado'
  | 'interesado'
  | 'cotizado'
  | 'negociacion'
  | 'convertida'
  | 'perdida';

export type MotivoFinalizacion =
  | 'venta_cerrada'
  | 'informacion_entregada'
  | 'no_interesado'
  | 'sin_respuesta'
  | 'fuera_de_perfil'
  | 'duplicada'
  | 'prueba'
  | 'otro';

type ConversationSummary = {
  id: string;
  contactoId: string | null;
  telefono: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeTipo?: 'entrante' | 'saliente' | null;
  ultimoMensajeEn: string | null;
  nombre?: string | null;
  vendedor_id?: number | null;
  etapa_oportunidad?: EtapaOportunidad | null;
  estado?: string | null;
  finalizada_en?: string | null;
  finalizada_por?: number | null;
  motivo_finalizacion?: MotivoFinalizacion | null;
  observaciones_finalizacion?: string | null;
  reactivada_en?: string | null;
  tiene_oportunidad?: boolean;
  tags?: WhatsappEtiqueta[];
};

export type ConversationMessage = {
  id: string;
  telefono: string | null;
  tipo_mensaje: 'entrante' | 'saliente';
  canal: string | null;
  contenido: string | null;
  tipo_contenido?: 'text' | 'image' | 'audio' | 'document' | null;
  media_url?: string | null;
  caption?: string | null;
  fecha_envio: string | null;
  creado_en?: string | null;
  status: string | null;
  mensaje_respuesta_id?: string | number | null;
  respuesta_tipo_mensaje?: 'entrante' | 'saliente' | null;
  respuesta_tipo_contenido?: 'text' | 'image' | 'audio' | 'document' | null;
  respuesta_contenido?: string | null;
  respuesta_caption?: string | null;
};

export type ReplyPreview = {
  id: string;
  from: 'lead' | 'me';
  preview: string;
};

export type OportunidadVenta = {
  id: number;
  folio?: string | null;
  cotizacion_principal_id: number | null;
  serie: string | null;
  numero: number | null;
  estatus: string;
  monto_oportunidad: number | null;
};

export type ReglasSeguimiento = {
  tiempo_tolerancia_respuesta_a_cliente: number;
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: number;
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: number;
};

export type WhatsappEtiqueta = {
  id: number;
  nombre: string;
  color: string;
};

export type LeadStatusType = 'attention' | 'waiting' | 'neutral' | 'active';

export type WhatsappSendErrorInfo = {
  codigo: string;
  mensajeUsuario: string;
  accionSugerida: string | null;
  recuperable: boolean;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTimeMinutesAgo: number;
  idleMinutes: number;
  awaitingResponse: boolean;
  statusLabel: string;
  statusType: LeadStatusType;
  within24hWindow: boolean;
  windowExpiresInMinutes: number;
  canSendFreeMessage: boolean;
  requiresTemplate: boolean;
  conversation: Array<{
    id: string;
    from: 'lead' | 'me';
    text: string;
    minutesAgo: number;
    sentAt: string | null;
    tipoContenido?: 'text' | 'image' | 'audio' | 'document';
    mediaUrl?: string | null;
    caption?: string | null;
    status?: 'sending' | 'sent' | 'failed';
    tempId?: string;
    replyTo?: ReplyPreview | null;
    errorInfo?: WhatsappSendErrorInfo | null;
    // Solo para mensajes propios pendientes/fallidos: permite reintentar
    // exactamente el mismo envío sin depender del estado actual del composer.
    telefonoEnvio?: string;
    requestBody?: Record<string, unknown>;
  }>;
  contactoId: string | null;
  vendedor_id: number | null;
  ultimoMensajeEn: string | null;
  priority: Priority;
  nextAction: NextAction;
  owner: string;
  hot: boolean;
  etapa_oportunidad: EtapaOportunidad;
  tiene_oportunidad: boolean;
  tags?: WhatsappEtiqueta[];
  estado: string | null;
  finalizada_en: string | null;
  motivo_finalizacion: MotivoFinalizacion | null;
  observaciones_finalizacion: string | null;
  reactivada_en: string | null;
};

export type LeadConPrioridad = Lead & { computedPriority: Priority; seguimientoPendiente: boolean };
export type QuickFilter = 'todos' | 'seguimiento' | 'alta' | 'activos';
export type OpportunityFilter = 'todos' | 'con' | 'sin';
export type LeadScope = 'mis' | 'todos';
type UserRole = { id: number; nombre: string; descripcion?: string | null };
const AUDIO_MIME_PREFERENCES = [
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mpeg',
  'audio/webm;codecs=opus',
  'audio/webm',
  // Último recurso: Safari/iOS no soporta confiablemente ninguno de los
  // anteriores en MediaRecorder, pero sí genera (y WhatsApp/Gupshup acepta)
  // audio/mp4 (AAC). No se fuerza; solo se usa si ningún otro es compatible.
  'audio/mp4',
];
// Notas de voz: sin límite previo en el proyecto. 180s (3 min) es el límite
// acordado para el compositor móvil — evita archivos muy pesados o
// grabaciones olvidadas encendidas, sin ser tan corto como para estorbar una
// nota de voz normal. Al alcanzarlo, se detiene automáticamente, igual que
// si el usuario presionara "Detener".
const MAX_RECORDING_SECONDS = 180;
// Grabaciones más cortas que esto (p. ej. un toque accidental) se descartan
// con un error en vez de ofrecerse como adjunto para enviar.
const MIN_RECORDING_SECONDS = 1;

const motivoFinalizacionOptions: Array<{ value: MotivoFinalizacion; label: string }> = [
  { value: 'venta_cerrada', label: 'Venta cerrada' },
  { value: 'informacion_entregada', label: 'Información entregada' },
  { value: 'no_interesado', label: 'No interesado' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'fuera_de_perfil', label: 'Fuera de perfil' },
  { value: 'duplicada', label: 'Duplicada' },
  { value: 'prueba', label: 'Prueba' },
  { value: 'otro', label: 'Otro' },
];
const motivoFinalizacionLabel: Record<MotivoFinalizacion, string> = motivoFinalizacionOptions.reduce(
  (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
  {} as Record<MotivoFinalizacion, string>
);
const REFRESH_INTERVAL_MS = 5000;
const etapaChipColor: Record<EtapaOportunidad, 'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success' | 'error'> = {
  nuevo: 'default',
  contactado: 'info',
  interesado: 'primary',
  cotizado: 'warning',
  negociacion: 'secondary',
  convertida: 'success',
  perdida: 'error',
};

function buildApiUrl(path: string) {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  const trimmedBase = baseUrl?.toString().replace(/\/$/, '') || '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${trimmedBase}${path}`;
  return `${trimmedBase}/${path}`;
}

export type LeadsPageProps = {
  // Lo llama LeadsMobileView (vía onChatOpenChange) cuando el chat móvil se
  // abre/cierra, para que CRMPage pueda dejar de ocupar espacio con su
  // encabezado/pestañas mientras el chat está a pantalla completa. Opcional:
  // quien monte LeadsPage fuera de CRMPage puede simplemente omitirlo.
  onMobileConversationOpenChange?: (open: boolean) => void;
};

export default function LeadsPage({ onMobileConversationOpenChange }: LeadsPageProps = {}) {
  const { session } = useSession();
  const navigate = useNavigate();
  // Mismo patrón de detección responsiva usado en el resto del proyecto
  // (DocumentosPage, ContactosPage, ProductosPage): breakpoint md de MUI,
  // sin detección por user-agent.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>('');
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [quickReply, setQuickReply] = React.useState('');
  const [replyingTo, setReplyingTo] = React.useState<ReplyPreview | null>(null);
  const [forwardMessage, setForwardMessage] = React.useState<ForwardableMessage | null>(null);
  // Archivo local pendiente (seleccionado, pegado o grabado) que todavía no
  // se ha subido al servidor: solo viaja a /api/uploads cuando el usuario
  // presiona enviar. pendingAttachmentPreviewUrl es la URL blob: local usada
  // únicamente para previsualizar imágenes (nunca una URL remota).
  const [pendingAttachmentFile, setPendingAttachmentFile] = React.useState<File | null>(null);
  const [pendingAttachmentPreviewUrl, setPendingAttachmentPreviewUrl] = React.useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = React.useState<'image' | 'document' | 'audio' | null>(null);
  const [uploadFileName, setUploadFileName] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  // URL blob: local del audio grabado, para reproducir la vista previa antes de subirlo.
  const [recordedAudioUrl, setRecordedAudioUrl] = React.useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  // Segundos transcurridos de la grabación en curso (para mm:ss en vivo) y
  // duración final ya congelada de la última grabación detenida (para
  // mostrarla junto a la vista previa reproducible). Se calcula aparte de
  // HTMLMediaElement.duration porque ese valor no es confiable para blobs de
  // MediaRecorder recién creados en varios navegadores (puede ser Infinity).
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = React.useState(0);
  const [recordedAudioDurationSeconds, setRecordedAudioDurationSeconds] = React.useState<number | null>(null);
  const recordingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  // true mientras handleCancelRecording está descartando una grabación en
  // curso: le indica al onstop del MediaRecorder que descarte todo en vez de
  // armar un adjunto pendiente, sin duplicar la lógica de detención.
  const cancelRecordingRef = React.useRef(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = React.useState(false);
  const [sendSuccess, setSendSuccess] = React.useState(false);
  const [reglasSeguimiento, setReglasSeguimiento] = React.useState<ReglasSeguimiento>(DEFAULT_REGLAS_SEGUIMIENTO);
  const [oportunidades, setOportunidades] = React.useState<OportunidadVenta[]>([]);
  const [isLoadingOportunidades, setIsLoadingOportunidades] = React.useState(false);
  const [oportunidadesError, setOportunidadesError] = React.useState<string | null>(null);
  const [oportunidadesOpen, setOportunidadesOpen] = React.useState(true);
  const [etapaMenu, setEtapaMenu] = React.useState<{ leadId: string; anchorEl: HTMLElement | null } | null>(null);
  const [availableTags, setAvailableTags] = React.useState<WhatsappEtiqueta[]>([]);
  const [selectedTagIds, setSelectedTagIds] = React.useState<number[]>([]);
  const [conversationTags, setConversationTags] = React.useState<WhatsappEtiqueta[]>([]);
  const [tagsMenuAnchor, setTagsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isCreatingTag, setIsCreatingTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState('#25D366');
  const [tagsSelectOpen, setTagsSelectOpen] = React.useState(false);
  const [manageTagsOpen, setManageTagsOpen] = React.useState(false);
  const [tagFormOpen, setTagFormOpen] = React.useState(false);
  const [tagFormId, setTagFormId] = React.useState<number | null>(null);
  const [tagFormName, setTagFormName] = React.useState('');
  const [tagFormColor, setTagFormColor] = React.useState('#25D366');
  const [tagFormSaving, setTagFormSaving] = React.useState(false);
  const [tagFormError, setTagFormError] = React.useState<string | null>(null);
  const [tagActionError, setTagActionError] = React.useState<string | null>(null);
  const [tagDeactivatingId, setTagDeactivatingId] = React.useState<number | null>(null);
  const [leadFilter, setLeadFilter] = React.useState<QuickFilter>('todos');
  const [opportunityFilter, setOpportunityFilter] = React.useState<OpportunityFilter>('todos');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  const [vistaFinalizadas, setVistaFinalizadas] = React.useState(false);
  const [finalizarDialogOpen, setFinalizarDialogOpen] = React.useState(false);
  const [finalizarTargetLeadId, setFinalizarTargetLeadId] = React.useState<string | null>(null);
  const [finalizarMotivo, setFinalizarMotivo] = React.useState<MotivoFinalizacion | ''>('');
  const [finalizarObservaciones, setFinalizarObservaciones] = React.useState('');
  const [finalizarSaving, setFinalizarSaving] = React.useState(false);
  const [finalizarError, setFinalizarError] = React.useState<string | null>(null);
  const [reabrirSavingId, setReabrirSavingId] = React.useState<string | null>(null);
  const [leadScope, setLeadScope] = React.useState<LeadScope>('todos');
  const [scopeTouched, setScopeTouched] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(Boolean(session.user?.es_superadmin));
  const [vendedorContactoId, setVendedorContactoId] = React.useState<number | null>(
    session.user?.vendedor_contacto_id ?? null
  );
  const [contactosById, setContactosById] = React.useState<Record<number, Contacto>>({});
  const [vendedoresById, setVendedoresById] = React.useState<Record<number, Contacto>>({});
  const contactosLoadedRef = React.useRef(false);
  const [isUpdatingOwner, setIsUpdatingOwner] = React.useState(false);
  const [vendedorFilterId, setVendedorFilterId] = React.useState<number | null>(null);
  const [isCompleteContactOpen, setIsCompleteContactOpen] = React.useState(false);
  const [completeContactForm, setCompleteContactForm] = React.useState({
    nombre: '',
    email: '',
    empresa: '',
    observaciones: '',
  });
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [sendErrorDialog, setSendErrorDialog] = React.useState<{
    leadId: string;
    tempId: string;
    mensajeUsuario: string;
    accionSugerida: string | null;
    recuperable: boolean;
  } | null>(null);
  const [ventanaCerradaDialogOpen, setVentanaCerradaDialogOpen] = React.useState(false);
  const quickReplyRef = React.useRef<HTMLInputElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null);
  const conversationScrollRef = React.useRef<HTMLDivElement | null>(null);
  const lastConversationsFetchRef = React.useRef<string | null>(null);
  const isFilterTransitionRef = React.useRef(false);
  const lastConversationLengthRef = React.useRef(0);
  const lastSelectedLeadIdRef = React.useRef<string | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const renderCountRef = React.useRef(0);

  renderCountRef.current += 1;
  console.log('[LeadsPage] render', {
    count: renderCountRef.current,
    leads: leads.length,
    conversations: conversations.length,
    selectedLeadId,
  });

  // Libera la URL blob: de la vista previa de imagen al reemplazarla y al
  // desmontar el componente (p. ej. si el usuario navega fuera con un
  // adjunto pendiente sin enviar).
  React.useEffect(() => {
    return () => {
      if (pendingAttachmentPreviewUrl) {
        URL.revokeObjectURL(pendingAttachmentPreviewUrl);
      }
    };
  }, [pendingAttachmentPreviewUrl]);

  // Mismo criterio para la vista previa del audio grabado.
  React.useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Si cambia la conversación seleccionada mientras hay una grabación en
  // curso (p. ej. el polling reselecciona otro lead), se cancela en vez de
  // dejar el micrófono activo apuntando a un chat que ya no está abierto.
  // Se consulta mediaRecorderRef.current.state directamente (no el estado
  // isRecording) para no depender de un closure que podría quedar obsoleto.
  React.useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        handleCancelRecording();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId]);

  // Desmontaje completo de la página (el usuario navega fuera del módulo de
  // Leads): mismo criterio, para no dejar el micrófono activo ni el
  // cronómetro corriendo en segundo plano.
  React.useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!session.token || !session.empresaActivaId) return undefined;

    let active = true;

    const loadProfile = async () => {
      try {
        const response = await apiFetch('/auth/me');
        if (!response.ok) {
          throw new Error('No se pudo cargar el perfil');
        }

        const data = await response.json();
        if (!active) return;

        const roles = Array.isArray(data?.roles) ? data.roles : [];
        const roleNames = roles.map((r: UserRole) => String(r?.nombre ?? '').toLowerCase());
        const admin = Boolean(data?.user?.es_superadmin)
          || roleNames.includes('administrador')
          || roleNames.includes('admin');

        setIsAdmin(admin);
        setVendedorContactoId(data?.user?.vendedor_contacto_id ?? session.user?.vendedor_contacto_id ?? null);
      } catch (error) {
        console.error('[LeadsPage] Error cargando perfil:', error);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [session.token, session.empresaActivaId, session.user?.vendedor_contacto_id]);

  React.useEffect(() => {
    if (scopeTouched) return;
    if (!isAdmin) {
      setLeadScope('mis');
      return;
    }
    if (vendedorContactoId) {
      setLeadScope('mis');
    } else {
      setLeadScope('todos');
    }
  }, [isAdmin, vendedorContactoId, scopeTouched]);

  React.useEffect(() => {
    if (!isAdmin) {
      setLeadScope('mis');
      return;
    }

    if (!vendedorContactoId && leadScope !== 'todos') {
      setLeadScope('todos');
    }
  }, [isAdmin, leadScope, vendedorContactoId]);

  React.useEffect(() => {
    if (leadScope === 'mis') {
      setVendedorFilterId(null);
    }
  }, [leadScope]);

  React.useEffect(() => {
    if (contactosLoadedRef.current) return;
    if (!session.token || !session.empresaActivaId) return;

    let active = true;

    const loadContactos = async () => {
      try {
        const contactos = await fetchContactos();
        if (!active) return;

        const byId: Record<number, Contacto> = {};
        const vendedores: Record<number, Contacto> = {};

        contactos.forEach((c) => {
          if (!Number.isFinite(c.id)) return;
          byId[c.id] = c;
          if ((c.tipo_contacto || '').toLowerCase() === 'vendedor') {
            vendedores[c.id] = c;
          }
        });

        setContactosById(byId);
        setVendedoresById(vendedores);
        contactosLoadedRef.current = true;
      } catch (error) {
        console.error('[LeadsPage] Error cargando contactos:', error);
      }
    };

    void loadContactos();

    return () => {
      active = false;
    };
  }, [session.token, session.empresaActivaId]);

  const leadsConPrioridad = React.useMemo<LeadConPrioridad[]>(() => {
    const enriched = leads.map((lead) => {
      const computedPriority = lead.priority;
      const seguimientoPendiente = esSeguimientoPendiente(lead);
      return {
        ...lead,
        computedPriority,
        seguimientoPendiente,
      };
    });

    const pendientes = enriched.filter((l) => l.seguimientoPendiente).map((l) => ({ id: l.id, etapa: l.etapa_oportunidad, minutos: l.idleMinutes }));
    console.log('[seguimiento pendiente] leads', pendientes);

    return enriched;
  }, [leads]);

  const leadsFiltradosOrdenados = React.useMemo<LeadConPrioridad[]>(() => {
    const filteredByQuickFilter = leadsConPrioridad.filter((lead) => {
      switch (leadFilter) {
        case 'seguimiento':
          return lead.seguimientoPendiente;
        case 'alta':
          return lead.computedPriority === 'Alta';
        case 'activos':
          return lead.etapa_oportunidad !== 'convertida' && lead.etapa_oportunidad !== 'perdida';
        case 'todos':
        default:
          return true;
      }
    });

    const filtered = filteredByQuickFilter.filter((lead) => {
      switch (opportunityFilter) {
        case 'con':
          return lead.tiene_oportunidad;
        case 'sin':
          return !lead.tiene_oportunidad;
        case 'todos':
        default:
          return true;
      }
    });

    // La búsqueda por nombre, teléfono y contenido de mensajes ya se resuelve
    // en el backend (ver `search` en loadConversations), por lo que `leads`
    // aquí ya viene acotado al término buscado; no se vuelve a filtrar en el
    // cliente para no tener dos implementaciones del mismo filtro.
    const sorted = [...filtered].sort(ordenarLeads);
    console.log('[leads filtrados/ordenados]', {
      filtro: leadFilter,
      filtroOportunidad: opportunityFilter,
      searchTerm: debouncedSearchTerm,
      total: sorted.length,
      ids: sorted.map((l) => l.id),
    });
    return sorted;
  }, [debouncedSearchTerm, leadFilter, leadsConPrioridad, opportunityFilter]);

  React.useEffect(() => {
    console.log('[LeadsPage] leadsConPrioridad updated', {
      total: leadsConPrioridad.length,
      sample: leadsConPrioridad.slice(0, 3).map((l) => ({
        id: l.id,
        lastMessage: l.lastMessage,
        awaitingResponse: l.awaitingResponse,
        lastFrom: l.conversation[l.conversation.length - 1]?.from,
        idleMinutes: l.idleMinutes,
        computedPriority: l.computedPriority,
      })),
    });
  }, [leadsConPrioridad]);

  React.useEffect(() => {
    console.log('[LeadsPage] leadsFiltradosOrdenados updated', {
      total: leadsFiltradosOrdenados.length,
      ids: leadsFiltradosOrdenados.map((l) => l.id),
    });
  }, [leadsFiltradosOrdenados]);

  const selectedLead = leadsConPrioridad.find((l) => l.id === selectedLeadId) ?? leadsConPrioridad[0];
  const selectedLeadPriority = selectedLead?.computedPriority ?? 'Media';
  const finalizarTargetLead = leadsConPrioridad.find((l) => l.id === finalizarTargetLeadId) ?? null;
  const selectedContactoId = selectedLead?.contactoId ? Number(selectedLead.contactoId) : null;
  const selectedContacto = selectedContactoId ? contactosById[selectedContactoId] : undefined;
  const selectedVendedorId = selectedLead?.vendedor_id ?? null;
  const vendorOptions = React.useMemo(
    () => Object.values(vendedoresById).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [vendedoresById]
  );
  const selectedTags = React.useMemo(
    () => availableTags.filter((tag) => selectedTagIds.includes(tag.id)),
    [availableTags, selectedTagIds]
  );
  const canSelectMis = Boolean(vendedorContactoId);
  const canToggleScope = isAdmin && canSelectMis;
  const showMisChip = !isAdmin || canSelectMis;
  const showTodosChip = isAdmin;
  const shouldShowScopeChipGroup = showMisChip || (showTodosChip && canToggleScope);
  const showQuickFilterChips = false;

  const buildLeadFromConversation = React.useCallback((conv: ConversationSummary): Lead => {
    const idle = minutesSince(conv.ultimoMensajeEn);
    const awaitingResponse = conv.ultimoMensajeTipo === 'saliente'
      ? false
      : conv.ultimoMensajeTipo === 'entrante'
        ? true
        : true;
    const baseLead: Lead = {
      id: conv.id,
      name: conv.nombre?.trim() || conv.telefono || 'WhatsApp',
      phone: conv.telefono || '',
      lastMessage: '',
      lastMessageTimeMinutesAgo: idle,
      idleMinutes: idle,
      awaitingResponse,
      statusLabel: awaitingResponse ? 'Sin responder' : 'Esperando cliente',
      statusType: awaitingResponse ? 'attention' : 'waiting',
      within24hWindow: true,
      windowExpiresInMinutes: 1440,
      canSendFreeMessage: true,
      requiresTemplate: false,
      conversation: [],
      contactoId: conv.contactoId,
      vendedor_id: conv.vendedor_id ?? null,
      ultimoMensajeEn: conv.ultimoMensajeEn,
      priority: awaitingResponse ? 'Media' : 'Baja',
      nextAction: deriveNextAction(awaitingResponse),
      owner: 'WhatsApp',
      hot: false,
      etapa_oportunidad: normalizeEtapaOportunidad(conv.etapa_oportunidad),
      tiene_oportunidad: Boolean(conv.tiene_oportunidad),
      tags: conv.tags ?? [],
      estado: conv.estado ?? null,
      finalizada_en: conv.finalizada_en ?? null,
      motivo_finalizacion: conv.motivo_finalizacion ?? null,
      observaciones_finalizacion: conv.observaciones_finalizacion ?? null,
      reactivada_en: conv.reactivada_en ?? null,
    };
    return applyDerivedLeadState(baseLead, reglasSeguimiento);
  }, [reglasSeguimiento]);

  const loadConversations = React.useCallback(async (opts?: { incremental?: boolean }) => {
    const incremental = opts?.incremental ?? false;
    if (incremental && isFilterTransitionRef.current) {
      console.log('[LeadsPage] loadConversations skipped: filter transition in progress');
      return;
    }
    console.log('[LeadsPage] loadConversations start', { incremental });
    if (!incremental) {
      isFilterTransitionRef.current = true;
      setIsLoadingConversations(true);
    }

    try {
      const vendedorFiltro = !isAdmin
        ? vendedorContactoId
        : leadScope === 'mis'
          ? vendedorContactoId
          : vendedorFilterId;

      const response = await fetchConversaciones({
        since: incremental ? lastConversationsFetchRef.current : null,
        vendedorId: vendedorFiltro,
        tagIds: selectedTagIds,
        estadoFinalizada: vistaFinalizadas,
        search: debouncedSearchTerm,
      });
      if (!response.ok) {
        throw new Error('Error al obtener conversaciones');
      }
      const data: ConversationSummary[] = await response.json();
      console.log('[LeadsPage] loadConversations response', {
        incremental,
        count: data.length,
        url: response.url,
        ids: data.map((c) => c.id),
      });

      const nowIso = new Date().toISOString();
      lastConversationsFetchRef.current = nowIso;

      if (!incremental) {
        setConversations(data);
      } else if (data.length) {
        setConversations((prev) => {
          console.log('[LeadsPage] setConversations merge', {
            prevCount: prev.length,
            incoming: data.length,
          });
          const existingIds = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          data.forEach((c) => {
            const idx = merged.findIndex((m) => m.id === c.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...c };
            } else {
              merged.unshift(c);
            }
          });
          return merged;
        });
      }

      setLeads((prev) => {
        console.log('[LeadsPage] setLeads start', { prevCount: prev.length, incoming: data.length, incremental });
        if (!incremental) {
          const isSame = prev.length === data.length && prev.every((lead) => {
            const match = data.find((conv) => conv.id === lead.id);
            return match && lead.ultimoMensajeEn === match.ultimoMensajeEn;
          });

          if (isSame) {
            return prev;
          }

          const previousById = new Map(prev.map((lead) => [lead.id, lead] as const));
          const initialLeads = data.map((conv) => {
            const existing = previousById.get(conv.id);
            const baseLead = buildLeadFromConversation(conv);

            if (!existing) {
              return baseLead;
            }

            const whatsappPreview = getLastWhatsappPreview(existing.conversation);

            return applyDerivedLeadState({
              ...existing,
              ...baseLead,
              lastMessage: whatsappPreview?.text ?? '',
              lastMessageTimeMinutesAgo: whatsappPreview?.sentAt
                ? minutesSince(whatsappPreview.sentAt)
                : baseLead.lastMessageTimeMinutesAgo,
              ultimoMensajeEn: whatsappPreview?.sentAt ?? baseLead.ultimoMensajeEn,
              conversation: existing.conversation,
            }, reglasSeguimiento);
          });
          console.log('[LeadsPage] setLeads replace', {
            count: initialLeads.length,
            preservedConversations: initialLeads.filter((lead) => lead.conversation.length > 0).length,
          });
          const firstId = initialLeads[0]?.id;
          if (firstId) {
            setSelectedLeadId((current) => current || firstId);
          }
          return initialLeads;
        }

        const map = new Map(prev.map((l) => [l.id, l] as const));

        data.forEach((conv) => {
          const existing = map.get(conv.id);

          if (existing) {
            const whatsappPreview = getLastWhatsappPreview(existing.conversation);
            const updatedLead = {
              ...existing,
              name: conv.nombre?.trim() || conv.telefono || existing.name,
              phone: conv.telefono || existing.phone,
              lastMessage: whatsappPreview?.text ?? '',
              lastMessageTimeMinutesAgo: whatsappPreview?.sentAt
                ? minutesSince(whatsappPreview.sentAt)
                : existing.lastMessageTimeMinutesAgo,
              ultimoMensajeEn: whatsappPreview?.sentAt ?? existing.ultimoMensajeEn,
              vendedor_id: conv.vendedor_id ?? existing.vendedor_id,
              etapa_oportunidad: conv.etapa_oportunidad ? normalizeEtapaOportunidad(conv.etapa_oportunidad) : existing.etapa_oportunidad,
              tiene_oportunidad: conv.tiene_oportunidad ?? existing.tiene_oportunidad,
              tags: conv.tags ?? existing.tags ?? [],
              estado: conv.estado ?? existing.estado,
              finalizada_en: conv.finalizada_en ?? existing.finalizada_en,
              motivo_finalizacion: conv.motivo_finalizacion ?? existing.motivo_finalizacion,
              observaciones_finalizacion: conv.observaciones_finalizacion ?? existing.observaciones_finalizacion,
              reactivada_en: conv.reactivada_en ?? existing.reactivada_en,
            };
            map.set(conv.id, applyDerivedLeadState(updatedLead, reglasSeguimiento));
          } else {
            map.set(conv.id, buildLeadFromConversation(conv));
          }
        });

        const mergedLeads = Array.from(map.values());
        console.log('[LeadsPage] setLeads merged', {
          count: mergedLeads.length,
          ids: mergedLeads.map((l) => l.id),
        });

        const firstId = mergedLeads[0]?.id;
        if (!selectedLeadId && firstId) {
          setSelectedLeadId((current) => current || firstId);
        }

        return mergedLeads;
      });
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      if (!incremental) {
        alert('No se pudieron cargar las conversaciones de WhatsApp');
      }
    } finally {
      if (!incremental) {
        setIsLoadingConversations(false);
        isFilterTransitionRef.current = false;
      }
    }
  }, [buildLeadFromConversation, debouncedSearchTerm, isAdmin, leadScope, reglasSeguimiento, selectedLeadId, selectedTagIds, vendedorContactoId, vendedorFilterId, vistaFinalizadas]);

  const loadMessages = React.useCallback(async (
    conversationId: string,
    opts?: { since?: string | null; append?: boolean; silent?: boolean }
  ) => {
    if (!conversationId) return;

    const append = opts?.append ?? false;
    const silent = opts?.silent ?? false;
    const since = opts?.since;

    if (!silent) {
      setIsLoadingMessages(true);
    }

    try {
      const response = await fetchMensajesConversacion(conversationId, { since });
      if (!response.ok) {
        throw new Error('Error al obtener mensajes');
      }
      const data: ConversationMessage[] = await response.json();
      const whatsappMessages = filterWhatsappMessages(data);
      console.log('[LeadsPage] loadMessages response', {
        conversationId,
        append,
        silent,
        count: data.length,
        whatsappCount: whatsappMessages.length,
        url: response.url,
        lastTipo: data[data.length - 1]?.tipo_mensaje,
      });

      if (append && whatsappMessages.length === 0) {
        return;
      }

      const lastMsg = whatsappMessages[whatsappMessages.length - 1];
      const lastSentAt = lastMsg?.fecha_envio ?? lastMsg?.creado_en ?? null;
      const idleMinutes = minutesSince(lastSentAt);
      const awaitingResponse = lastMsg?.tipo_mensaje === 'entrante';
      const nextAction = deriveNextAction(awaitingResponse);
      const lastMessageText = lastMsg?.contenido || '';

      setLeads((prev) => prev.map((l) => {
        if (l.id !== conversationId) return l;

        const shouldMergeConversation = append || l.conversation.length > 0;
        const baseConversation = append
          ? l.conversation.filter((m) => !(m.tempId && m.status === 'sent'))
          : l.conversation;
        const mappedNew = mapMessages(whatsappMessages);
        const mergedConversation = shouldMergeConversation
          ? Array.from(mappedNew.reduce((map, message) => {
            const existing = map.get(message.id);
            map.set(message.id, existing ? { ...existing, ...message } : message);
            return map;
          }, new Map(baseConversation.map((m) => [m.id, m]))).values())
          : mappedNew;

        const updatedLead: Lead = {
          ...l,
          lastMessage: lastMsg ? lastMessageText : l.lastMessage,
          lastMessageTimeMinutesAgo: lastMsg ? idleMinutes : l.lastMessageTimeMinutesAgo,
          idleMinutes: lastMsg ? idleMinutes : l.idleMinutes,
          nextAction: lastMsg ? nextAction : l.nextAction,
          awaitingResponse: lastMsg ? awaitingResponse : l.awaitingResponse,
          ultimoMensajeEn: lastSentAt ?? l.ultimoMensajeEn,
          conversation: mergedConversation,
        };

      const recalculated = applyDerivedLeadState(updatedLead, reglasSeguimiento);
        console.log('[LeadsPage] setLeads from messages', {
          id: recalculated.id,
          awaitingResponse: recalculated.awaitingResponse,
          lastMessage: recalculated.lastMessage,
          lastFrom: recalculated.conversation[recalculated.conversation.length - 1]?.from,
          idleMinutes: recalculated.idleMinutes,
        });
        return recalculated;
      }));

      setConversations((prev) => prev.map((c) => (c.id === conversationId && lastSentAt
        ? { ...c, ultimoMensaje: lastMessageText, ultimoMensajeEn: lastSentAt }
        : c)));
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      if (!silent) {
        alert('No se pudieron cargar los mensajes de la conversación');
      }
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  }, [reglasSeguimiento]);

  const focusReplyInput = () => {
    requestAnimationFrame(() => quickReplyRef.current?.focus());
  };

  const handleReplyAction = (leadId: string) => {
    setSelectedLeadId(leadId);
    setReplyingTo(null);
    focusReplyInput();
  };

  const handleGenerarCotizacion = () => {
    if (!selectedContactoId || !selectedLead) return;
    navigate(`/ventas/cotizacion/nuevo?contactoId=${selectedContactoId}&conversacionId=${selectedLead.id}`);
  };

  const loadAvailableTags = React.useCallback(async () => {
    try {
      const response = await apiFetch('/api/whatsapp/etiquetas');
      if (!response.ok) {
        throw new Error('Error al obtener etiquetas');
      }
      const data: WhatsappEtiqueta[] = await response.json();
      setAvailableTags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando etiquetas:', error);
    }
  }, []);

  const loadReglasSeguimiento = React.useCallback(async () => {
    try {
      const response = await apiFetch('/api/whatsapp/reglas-seguimiento');
      if (!response.ok) {
        throw new Error('Error al obtener reglas de seguimiento');
      }

      const data = await response.json();
      setReglasSeguimiento({
        tiempo_tolerancia_respuesta_a_cliente: Number(data?.tiempo_tolerancia_respuesta_a_cliente) || DEFAULT_REGLAS_SEGUIMIENTO.tiempo_tolerancia_respuesta_a_cliente,
        tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: Number(data?.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente) || DEFAULT_REGLAS_SEGUIMIENTO.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente,
        tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: Number(data?.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente) || DEFAULT_REGLAS_SEGUIMIENTO.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente,
      });
    } catch (error) {
      console.error('Error cargando reglas de seguimiento:', error);
      setReglasSeguimiento(DEFAULT_REGLAS_SEGUIMIENTO);
    }
  }, []);

  const loadConversationTags = React.useCallback(async (conversationId: string) => {
    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${conversationId}/etiquetas`);
      if (!response.ok) {
        throw new Error('Error al obtener etiquetas de conversación');
      }
      const data: WhatsappEtiqueta[] = await response.json();
      setConversationTags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando etiquetas de conversación:', error);
    }
  }, []);

  const toggleConversationTag = React.useCallback(async (tag: WhatsappEtiqueta) => {
    if (!selectedLeadId) return;
    const isAssigned = conversationTags.some((t) => t.id === tag.id);
    const prev = conversationTags;
    setConversationTags((prevState) => (
      isAssigned
        ? prevState.filter((t) => t.id !== tag.id)
        : [...prevState, tag]
    ));
    handleCloseTagsMenu();

    try {
      const response = await apiFetch(
        isAssigned
          ? `/api/whatsapp/conversaciones/${selectedLeadId}/etiquetas/${tag.id}`
          : `/api/whatsapp/conversaciones/${selectedLeadId}/etiquetas`,
        isAssigned
          ? { method: 'DELETE' }
          : {
            method: 'POST',
            body: JSON.stringify({ etiqueta_id: tag.id }),
          }
      );

      if (!response.ok) {
        throw new Error('Error al actualizar etiqueta');
      }
    } catch (error) {
      console.error('Error actualizando etiqueta:', error);
      setConversationTags(prev);
    }
  }, [conversationTags, selectedLeadId]);

  const getLastSentAtForLead = React.useCallback((leadId: string): string | null => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    const last = lead.conversation[lead.conversation.length - 1];
    return last?.sentAt ?? lead.ultimoMensajeEn ?? null;
  }, [leads]);

  const refreshIdleTimers = React.useCallback(() => {
    console.log('[LeadsPage] refreshIdleTimers');
    setLeads((prev) => prev.map((l) => {
      const updatedLead = {
        ...l,
      };
      return applyDerivedLeadState(updatedLead, reglasSeguimiento);
    }));
  }, [reglasSeguimiento]);

  React.useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  React.useEffect(() => {
    console.log('[LeadsPage] useEffect(loadConversations) init');
    lastConversationsFetchRef.current = null;
    isFilterTransitionRef.current = true;
    setSelectedLeadId('');
    loadConversations();
  }, [leadScope, selectedTagIds, vendedorContactoId, vendedorFilterId, vistaFinalizadas, debouncedSearchTerm]);

  React.useEffect(() => {
    if (!session.token || !session.empresaActivaId) return;
    loadAvailableTags();
    loadReglasSeguimiento();
  }, [loadAvailableTags, loadReglasSeguimiento, session.empresaActivaId, session.token]);

  React.useEffect(() => {
    setLeads((prev) => prev.map((lead) => applyDerivedLeadState(lead, reglasSeguimiento)));
  }, [reglasSeguimiento]);

  React.useEffect(() => {
    if (!selectedLeadId) {
      setConversationTags([]);
      return;
    }
    loadConversationTags(selectedLeadId);
  }, [loadConversationTags, selectedLeadId]);

  React.useEffect(() => {
    if (selectedLeadId) {
      loadMessages(selectedLeadId);
    }
  }, [loadMessages, selectedLeadId]);

  React.useEffect(() => {
    if (!selectedLead?.id) {
      setOportunidades([]);
      setOportunidadesError(null);
      return;
    }

    let active = true;

    const loadOportunidades = async () => {
      try {
        setIsLoadingOportunidades(true);
        setOportunidadesError(null);
        const response = await apiFetch(`/api/crm/oportunidades?conversacionId=${encodeURIComponent(selectedLead.id)}`);
        if (!response.ok) {
          throw new Error('No se pudieron cargar las oportunidades');
        }

        const data: OportunidadVenta[] = await response.json();
        if (!active) return;
        setOportunidades(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!active) return;
        console.error('Error cargando oportunidades:', error);
        setOportunidades([]);
        setOportunidadesError(error instanceof Error ? error.message : 'No se pudieron cargar las oportunidades');
      } finally {
        if (active) {
          setIsLoadingOportunidades(false);
        }
      }
    };

    void loadOportunidades();

    return () => {
      active = false;
    };
  }, [selectedLead?.id]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log('[LeadsPage] polling refresh: conversations/messages');
      if (!isFilterTransitionRef.current) {
        loadConversations({ incremental: leadScope !== 'todos' });
      }

      if (selectedLeadId) {
        const since = getLastSentAtForLead(selectedLeadId);
        loadMessages(selectedLeadId, { since, append: true, silent: true });
      }

      refreshIdleTimers();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getLastSentAtForLead, loadConversations, loadMessages, refreshIdleTimers, selectedLeadId]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  React.useEffect(() => {
    const el = conversationScrollRef.current;
    if (!el) return undefined;

    const handleScroll = () => {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsAtBottom(distanceToBottom <= 48);
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [selectedLeadId]);

  React.useEffect(() => {
    const currentLeadId = selectedLeadId || null;
    const currentLength = selectedLead?.conversation.length ?? 0;
    const leadChanged = lastSelectedLeadIdRef.current !== currentLeadId;
    const hasNewMessage = !leadChanged && currentLength > lastConversationLengthRef.current;

    lastSelectedLeadIdRef.current = currentLeadId;
    lastConversationLengthRef.current = currentLength;

    if (isFilterTransitionRef.current) return;

    // Al abrir/cambiar de conversación siempre se posiciona al final (mensajes más
    // recientes), sin importar en qué punto se había quedado el scroll anterior.
    if (leadChanged) {
      setIsAtBottom(true);
      scrollToBottom('auto');
      return;
    }

    if (!isAtBottom) return;
    if (!hasNewMessage) return;

    scrollToBottom();
  }, [isAtBottom, scrollToBottom, selectedLeadId, selectedLead?.conversation.length]);

  const updateLead = (id: string, updates: Partial<Lead>) => {
    console.log('[LeadsPage] updateLead', { id, updates });
    setLeads((prev) => prev.map((l) => (l.id === id ? applyDerivedLeadState({ ...l, ...updates }, reglasSeguimiento) : l)));
  };

  const updateMessageStatus = (
    leadId: string,
    tempId: string,
    status: 'sending' | 'sent' | 'failed',
    errorInfo?: WhatsappSendErrorInfo | null
  ) => {
    setLeads((prev) => prev.map((lead) => {
      if (lead.id !== leadId) return lead;
      const updatedConversation = lead.conversation.map((msg) => (
        msg.tempId === tempId
          ? { ...msg, status, errorInfo: status === 'failed' ? (errorInfo ?? null) : null }
          : msg
      ));
      return applyDerivedLeadState({ ...lead, conversation: updatedConversation }, reglasSeguimiento);
    }));
  };

  const openCompleteContactDialog = () => {
    if (!selectedLead || !selectedContactoId) return;
    setCompleteContactForm({
      nombre: selectedContacto?.nombre || selectedLead.name || '',
      email: selectedContacto?.email || '',
      empresa: selectedContacto?.zona || '',
      observaciones: selectedContacto?.observaciones || '',
    });
    setIsCompleteContactOpen(true);
  };

  const closeCompleteContactDialog = () => {
    setIsCompleteContactOpen(false);
  };

  const handleSaveCompleteContact = async () => {
    if (!selectedContactoId) return;
    const payload: Partial<Contacto> = {
      nombre: completeContactForm.nombre.trim(),
      email: completeContactForm.email.trim() || null,
      zona: completeContactForm.empresa.trim() || null,
      observaciones: completeContactForm.observaciones.trim() || null,
    };

    try {
      const updated = await actualizarContacto(selectedContactoId, payload);
      setContactosById((prev) => ({
        ...prev,
        [selectedContactoId]: { ...(prev[selectedContactoId] ?? {}), ...updated },
      }));
      if (selectedLeadId) {
        const nextName = updated.nombre || payload.nombre || selectedLead?.name || '';
        updateLead(selectedLeadId, { name: nextName });
      }
      setSnackbar({ open: true, message: 'Contacto actualizado correctamente', severity: 'success' });
      setIsCompleteContactOpen(false);
    } catch (error: any) {
      console.error('Error actualizando contacto:', error);
      setSnackbar({ open: true, message: error?.message || 'No se pudo actualizar el contacto', severity: 'error' });
    }
  };

  const handleOwnerChange = async (nextValue: string) => {
    if (!selectedContactoId) return;
    const vendedorId = nextValue ? Number(nextValue) : null;

    setIsUpdatingOwner(true);
    try {
      const updated = await actualizarContacto(selectedContactoId, { vendedor_id: vendedorId } as Partial<Contacto>);
      setContactosById((prev) => ({
        ...prev,
        [selectedContactoId]: { ...(prev[selectedContactoId] ?? {}), ...updated },
      }));
      if (selectedLeadId) {
        updateLead(selectedLeadId, { vendedor_id: vendedorId });
      }
      setSnackbar({ open: true, message: 'Lead asignado correctamente', severity: 'success' });
    } catch (error: any) {
      console.error('Error asignando vendedor al lead:', error);
      setSnackbar({ open: true, message: error?.message || 'No se pudo asignar el lead', severity: 'error' });
    } finally {
      setIsUpdatingOwner(false);
    }
  };

  const handleOpenEtapaMenu = (leadId: string, anchorEl: HTMLElement) => {
    const lead = leads.find((l) => l.id === leadId);
    console.log('[etapa] abrir menú', { leadId, etapa: lead?.etapa_oportunidad, lead });
    setEtapaMenu({ leadId, anchorEl });
  };

  const handleCloseEtapaMenu = () => setEtapaMenu(null);

  const handleOpenTagsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setTagsMenuAnchor(event.currentTarget);
  };

  const handleCloseTagsMenu = () => {
    setTagsMenuAnchor(null);
    setIsCreatingTag(false);
    setNewTagName('');
    setNewTagColor('#25D366');
  };

  const handleStartCreateTag = () => {
    setIsCreatingTag(true);
  };

  const handleCancelCreateTag = () => {
    setIsCreatingTag(false);
    setNewTagName('');
    setNewTagColor('#25D366');
  };

  const handleSaveNewTag = async () => {
    const nombre = newTagName.trim();
    const color = newTagColor.trim();
    const colorValido = /^#([0-9A-Fa-f]{6})$/.test(color);
    if (!nombre || !colorValido) {
      return;
    }

    try {
      const response = await apiFetch('/api/whatsapp/etiquetas', {
        method: 'POST',
        body: JSON.stringify({ nombre, color }),
      });

      if (!response.ok) {
        throw new Error('Error al crear etiqueta');
      }

      const created: WhatsappEtiqueta = await response.json();
      setAvailableTags((prev) => [created, ...prev]);
      setIsCreatingTag(false);
      setNewTagName('');
      setNewTagColor('#25D366');
      await toggleConversationTag(created);
    } catch (error) {
      console.error('Error creando etiqueta:', error);
    }
  };

  const handleOpenManageTags = () => {
    setTagActionError(null);
    setManageTagsOpen(true);
  };

  const handleCloseManageTags = () => {
    setManageTagsOpen(false);
    setTagFormOpen(false);
    setTagFormId(null);
    setTagFormName('');
    setTagFormColor('#25D366');
    setTagFormError(null);
    setTagActionError(null);
  };

  const handleOpenCreateTagForm = () => {
    setTagFormId(null);
    setTagFormName('');
    setTagFormColor('#25D366');
    setTagFormError(null);
    setTagFormOpen(true);
  };

  const handleOpenEditTagForm = (tag: WhatsappEtiqueta) => {
    setTagFormId(tag.id);
    setTagFormName(tag.nombre);
    setTagFormColor(tag.color);
    setTagFormError(null);
    setTagFormOpen(true);
  };

  const handleCancelTagForm = () => {
    setTagFormOpen(false);
    setTagFormId(null);
    setTagFormName('');
    setTagFormColor('#25D366');
    setTagFormError(null);
  };

  const handleSubmitTagForm = async () => {
    const nombre = tagFormName.trim();
    const color = tagFormColor.trim();

    if (!nombre) {
      setTagFormError('El nombre de la etiqueta es requerido');
      return;
    }
    if (!/^#([0-9A-Fa-f]{6})$/.test(color)) {
      setTagFormError('Selecciona un color válido');
      return;
    }
    const nombreLower = nombre.toLowerCase();
    const duplicada = availableTags.some(
      (tag) => tag.id !== tagFormId && tag.nombre.trim().toLowerCase() === nombreLower
    );
    if (duplicada) {
      setTagFormError('Ya existe una etiqueta con ese nombre');
      return;
    }

    setTagFormSaving(true);
    setTagFormError(null);
    try {
      if (tagFormId == null) {
        const response = await apiFetch('/api/whatsapp/etiquetas', {
          method: 'POST',
          body: JSON.stringify({ nombre, color }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.message || 'No se pudo crear la etiqueta');
        }
        const created: WhatsappEtiqueta = data;
        setAvailableTags((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } else {
        const response = await apiFetch(`/api/whatsapp/etiquetas/${tagFormId}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre, color }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.message || 'No se pudo actualizar la etiqueta');
        }
        const updated: WhatsappEtiqueta = data;
        setAvailableTags((prev) =>
          prev.map((tag) => (tag.id === updated.id ? updated : tag)).sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
        setConversationTags((prev) => prev.map((tag) => (tag.id === updated.id ? updated : tag)));
      }
      handleCancelTagForm();
    } catch (error) {
      setTagFormError(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setTagFormSaving(false);
    }
  };

  const handleDeactivateTag = async (tag: WhatsappEtiqueta) => {
    setTagDeactivatingId(tag.id);
    setTagActionError(null);
    try {
      const response = await apiFetch(`/api/whatsapp/etiquetas/${tag.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: false }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo desactivar la etiqueta');
      }
      setAvailableTags((prev) => prev.filter((t) => t.id !== tag.id));
      setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
      setConversationTags((prev) => prev.filter((t) => t.id !== tag.id));
      if (tagFormId === tag.id) {
        handleCancelTagForm();
      }
    } catch (error) {
      setTagActionError(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setTagDeactivatingId(null);
    }
  };

  const handleSelectEtapa = async (etapa: EtapaOportunidad) => {
    if (!etapaMenu?.leadId) return;
    const leadId = etapaMenu.leadId;
    const prev = leads.find((l) => l.id === leadId)?.etapa_oportunidad;
    console.log('[etapa] seleccionar', { leadId, etapaNueva: etapa, etapaPrev: prev });
    updateLead(leadId, { etapa_oportunidad: etapa });
    handleCloseEtapaMenu();

    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${leadId}/etapa`, {
        method: 'PATCH',
        body: JSON.stringify({ etapa_oportunidad: etapa }),
      });
      const data = await response.json();
      console.log('[etapa] respuesta PATCH', { status: response.status, data });
      if (!response.ok) {
        throw new Error('PATCH etapa no OK');
      }
      // Actualiza con el valor real devuelto por backend
      updateLead(leadId, { etapa_oportunidad: data?.etapa_oportunidad ?? etapa });
    } catch (error) {
      console.error('Error actualizando etapa_oportunidad:', error);
      if (prev) {
        updateLead(leadId, { etapa_oportunidad: prev });
      }
    }
  };

  const handleOpenFinalizarDialog = (leadId: string) => {
    setFinalizarTargetLeadId(leadId);
    setFinalizarMotivo('');
    setFinalizarObservaciones('');
    setFinalizarError(null);
    setFinalizarDialogOpen(true);
  };

  const handleCloseFinalizarDialog = () => {
    if (finalizarSaving) return;
    setFinalizarDialogOpen(false);
    setFinalizarTargetLeadId(null);
  };

  const handleConfirmFinalizar = async () => {
    if (!finalizarTargetLeadId) return;
    const targetLeadId = finalizarTargetLeadId;

    if (!finalizarMotivo) {
      setFinalizarError('Selecciona un motivo');
      return;
    }
    if (finalizarMotivo === 'otro' && !finalizarObservaciones.trim()) {
      setFinalizarError('Las observaciones son obligatorias cuando el motivo es "Otro"');
      return;
    }

    setFinalizarSaving(true);
    setFinalizarError(null);
    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${targetLeadId}/finalizar`, {
        method: 'PATCH',
        body: JSON.stringify({
          motivo_finalizacion: finalizarMotivo,
          observaciones_finalizacion: finalizarObservaciones.trim() || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo finalizar la conversación');
      }

      updateLead(targetLeadId, {
        estado: data?.estado ?? 'finalizada',
        finalizada_en: data?.finalizada_en ?? new Date().toISOString(),
        motivo_finalizacion: data?.motivo_finalizacion ?? finalizarMotivo,
        observaciones_finalizacion: data?.observaciones_finalizacion ?? (finalizarObservaciones.trim() || null),
      });
      setSnackbar({ open: true, message: 'Conversación marcada como finalizada', severity: 'success' });
      setFinalizarDialogOpen(false);
      setFinalizarTargetLeadId(null);
    } catch (error) {
      setFinalizarError(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setFinalizarSaving(false);
    }
  };

  const handleReabrirConversacion = async (leadId: string) => {
    setReabrirSavingId(leadId);
    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${leadId}/reabrir`, {
        method: 'PATCH',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'No se pudo reabrir la conversación');
      }

      updateLead(leadId, {
        estado: data?.estado ?? 'abierta',
        finalizada_en: null,
        motivo_finalizacion: null,
        observaciones_finalizacion: null,
        reactivada_en: data?.reactivada_en ?? new Date().toISOString(),
        etapa_oportunidad: normalizeEtapaOportunidad(data?.etapa_oportunidad ?? 'contactado'),
      });
      setSnackbar({ open: true, message: 'Conversación reabierta', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'No se pudo reabrir la conversación',
        severity: 'error',
      });
    } finally {
      setReabrirSavingId(null);
    }
  };

  const handleSuggestMessage = async () => {
    if (!selectedLead) return;
    setIsSuggesting(true);
    try {
      const tiempoSinRespuesta = formatMinutesAgo(selectedLead.idleMinutes);
      const tipoLead = selectedLead.idleMinutes > 180
        ? 'Urgente'
        : selectedLead.idleMinutes >= 60
          ? 'Seguimiento'
          : 'Nuevo';

      const response = await apiFetch('/api/leads/sugerir-mensaje', {
        method: 'POST',
        body: JSON.stringify({
          nombre: selectedLead.name,
          ultimoMensaje: selectedLead.lastMessage,
          siguienteAccion: selectedLead.nextAction,
          tiempoSinRespuesta,
          prioridad: selectedLeadPriority,
          tipoLead,
          canal: 'WhatsApp',
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la solicitud');
      }

      const data = await response.json();

      if (!data?.mensaje) {
        throw new Error('Respuesta inválida');
      }

      setQuickReply(data.mensaje);
      focusReplyInput();
    } catch (error) {
      console.error('Error al sugerir mensaje:', error);
      alert('No se pudo sugerir el mensaje. Intenta de nuevo.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // Compartido entre el envío inicial y "Reintentar": hace el POST, clasifica
  // el resultado y actualiza el mismo mensaje (por tempId) en vez de crear
  // uno nuevo, para no duplicar burbujas en la conversación.
  const performWhatsappSend = async (
    leadId: string,
    tempId: string,
    telefono: string,
    requestBody: Record<string, unknown>
  ) => {
    setIsSending(true);
    try {
      const lastSentAtBeforeSend = getLastSentAtForLead(leadId);

      let response: Response;
      try {
        response = await apiFetch('/api/whatsapp/enviar-mensaje', {
          method: 'POST',
          body: JSON.stringify({ telefono, ...requestBody }),
        });
      } catch (networkError) {
        console.error('[WhatsApp Send] Error de red', networkError);
        const info = buildWhatsappSendErrorInfo(null, true);
        updateMessageStatus(leadId, tempId, 'failed', info);
        setSendErrorDialog({
          leadId,
          tempId,
          mensajeUsuario: info.mensajeUsuario,
          accionSugerida: info.accionSugerida,
          recuperable: info.recuperable,
        });
        return;
      }

      let responsePayload: any = null;
      try {
        responsePayload = await response.clone().json();
      } catch {
        responsePayload = null;
      }

      console.log('[WhatsApp Send] Respuesta', {
        status: response.status,
        ok: response.ok,
        body: responsePayload,
      });

      if (!response.ok) {
        const info = buildWhatsappSendErrorInfo(responsePayload, false);
        updateMessageStatus(leadId, tempId, 'failed', info);
        setSendErrorDialog({
          leadId,
          tempId,
          mensajeUsuario: info.mensajeUsuario,
          accionSugerida: info.accionSugerida,
          recuperable: info.recuperable,
        });
        return;
      }

      updateMessageStatus(leadId, tempId, 'sent');
      setQuickReply('');
      setReplyingTo(null);
      clearPendingAttachment();
      setUploadError(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2000);

      setIsAtBottom(true);
      await loadMessages(leadId, { since: lastSentAtBeforeSend, append: true, silent: true });
      await loadConversations({ incremental: true });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendWhatsapp = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    // Guard contra doble envío: cubre tanto el click del botón (que ya queda
    // disabled) como el atajo de Enter en el textarea, que no pasaba por el
    // botón y podía disparar dos POST casi simultáneos.
    if (!selectedLead || isSending) return;

    // La ventana de 24h está cerrada: se intercepta ANTES de tocar el
    // backend (no se arma el mensaje optimista ni se hace el POST), así no
    // queda un mensaje "fallido" en el historial ni se pierde el texto ya
    // escrito. El backend sigue siendo la validación definitiva por si el
    // estado cambia entre que se calculó aquí y que se intenta enviar.
    if (selectedLead.requiresTemplate) {
      setVentanaCerradaDialogOpen(true);
      return;
    }

    const trimmedMessage = quickReply.trim();
    const attachmentFile = pendingAttachmentFile;
    const fileType = uploadFileType;

    if (!trimmedMessage && !attachmentFile) {
      focusReplyInput();
      return;
    }

    // El archivo (imagen, documento o audio grabado) solo se sube en este
    // punto, justo antes de enviar el mensaje. Si la subida falla, no se
    // arma ni se envía el mensaje: el texto y el adjunto local permanecen
    // intactos para que el usuario pueda reintentar.
    let fileUrl: string | null = null;
    if (attachmentFile) {
      setIsSending(true);
      setIsUploadingImage(true);
      setUploadError(null);
      try {
        fileUrl = await uploadAttachmentFile(attachmentFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado al subir el archivo.';
        setUploadError(message);
        setIsUploadingImage(false);
        setIsSending(false);
        return;
      }
      setIsUploadingImage(false);
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const isImageMessage = fileType === 'image';
    const isDocumentMessage = fileType === 'document';
    const isAudioMessage = fileType === 'audio';
    const nowIso = new Date().toISOString();

    const requestBody: Record<string, unknown> = {
      ...(fileUrl && isImageMessage
        ? { tipo: 'image', media_url: fileUrl, mensaje: trimmedMessage || null }
        : fileUrl && isDocumentMessage
          ? {
            tipo: 'document',
            media_url: fileUrl,
            mensaje: uploadFileName || null,
            contenido: trimmedMessage || null,
          }
          : fileUrl && isAudioMessage
            ? {
              tipo: 'audio',
              media_url: fileUrl,
              contenido: trimmedMessage || '',
            }
            : { mensaje: trimmedMessage }),
      ...(replyingTo ? { mensaje_respuesta_id: replyingTo.id } : {}),
    };

    const optimisticMessage = {
      id: tempId,
      tempId,
      from: 'me' as const,
      text: trimmedMessage,
      minutesAgo: 0,
      sentAt: nowIso,
      tipoContenido: isImageMessage
        ? ('image' as const)
        : isDocumentMessage
          ? ('document' as const)
          : isAudioMessage
            ? ('audio' as const)
            : ('text' as const),
      mediaUrl: fileUrl,
      caption: isImageMessage
        ? (trimmedMessage || null)
        : isDocumentMessage
          ? (uploadFileName || null)
          : null,
      status: 'sending' as const,
      replyTo: replyingTo,
      telefonoEnvio: selectedLead.phone,
      requestBody,
    };

    updateLead(selectedLead.id, {
      conversation: [...selectedLead.conversation, optimisticMessage],
      lastMessage: trimmedMessage
        || (isImageMessage
          ? 'Imagen enviada'
          : isDocumentMessage
            ? 'Documento enviado'
            : isAudioMessage
              ? 'Audio enviado'
              : ''),
      ultimoMensajeEn: nowIso,
      lastMessageTimeMinutesAgo: 0,
    });

    await performWhatsappSend(selectedLead.id, tempId, selectedLead.phone, requestBody);
  };

  const handleRetryWhatsappSend = async (leadId: string, tempId: string) => {
    if (isSending) return;
    const lead = leads.find((l) => l.id === leadId);
    const msg = lead?.conversation.find((m) => m.tempId === tempId);
    if (!lead || !msg || !msg.requestBody || !msg.telefonoEnvio) return;

    setSendErrorDialog(null);
    updateMessageStatus(leadId, tempId, 'sending');
    await performWhatsappSend(leadId, tempId, msg.telefonoEnvio, msg.requestBody);
  };

  const handleSelectUpload = () => {
    uploadInputRef.current?.click();
  };

  // Limpia el intervalo del cronómetro de grabación y su ancla de inicio.
  // La usan tanto onstop (grabación normal) como handleCancelRecording y el
  // efecto de desmontaje/cambio de conversación, para no duplicar la lógica
  // de limpieza en cada salida posible.
  const stopRecordingTimer = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    recordingStartedAtRef.current = null;
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setUploadError('Este navegador no permite grabar audio.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setUploadError('Este navegador no permite grabar audio.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Error al solicitar permiso de micrófono:', error);
      const name = error instanceof DOMException ? error.name : '';
      const message = name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Permiso de micrófono denegado. Actívalo en los ajustes del navegador para grabar audio.'
        : name === 'NotFoundError' || name === 'DevicesNotFoundError'
          ? 'No se encontró un micrófono disponible en este dispositivo.'
          : 'No se pudo acceder al micrófono. Intenta de nuevo.';
      setUploadError(message);
      return;
    }

    audioChunksRef.current = [];
    const preferredMimeType = AUDIO_MIME_PREFERENCES.find((type) => MediaRecorder.isTypeSupported(type));

    if (!preferredMimeType) {
      setUploadError('Tu navegador no soporta grabación de audio en formatos compatibles.');
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: preferredMimeType });
    } catch (error) {
      console.error('Error al iniciar el grabador de audio:', error);
      setUploadError('No se pudo iniciar la grabación de audio.');
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cancelRecordingRef.current = false;
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      console.error('Error durante la grabación de audio:', event);
      setUploadError('Ocurrió un error durante la grabación. Intenta de nuevo.');
      stopRecordingTimer();
      audioChunksRef.current = [];
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingElapsedSeconds(0);
    };

    recorder.onstop = () => {
      // El audio grabado se queda en memoria como File pendiente; la subida
      // a /api/uploads solo ocurre al presionar enviar, igual que con
      // imágenes y documentos.
      stream.getTracks().forEach((track) => track.stop());
      const finalElapsedSeconds = recordingStartedAtRef.current != null
        ? Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
        : 0;
      stopRecordingTimer();

      if (cancelRecordingRef.current) {
        cancelRecordingRef.current = false;
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingElapsedSeconds(0);
        return;
      }

      clearPendingAttachment();

      const blob = new Blob(audioChunksRef.current, { type: preferredMimeType });
      audioChunksRef.current = [];

      if (blob.size === 0 || finalElapsedSeconds < MIN_RECORDING_SECONDS) {
        setUploadError('La grabación es demasiado corta. Mantén presionado un poco más e intenta de nuevo.');
        setIsRecording(false);
        setRecordingElapsedSeconds(0);
        return;
      }

      const previewUrl = URL.createObjectURL(blob);
      const extension = preferredMimeType.includes('ogg')
        ? 'ogg'
        : preferredMimeType.includes('mpeg')
          ? 'mp3'
          : preferredMimeType.includes('mp4')
            ? 'm4a'
            : 'webm';
      const filename = `audio-${Date.now()}.${extension}`;
      const audioFile = new File([blob], filename, { type: preferredMimeType });

      setUploadError(null);
      setPendingAttachmentFile(audioFile);
      setUploadFileType('audio');
      setUploadFileName(filename);
      setRecordedAudioUrl(previewUrl);
      setRecordedAudioDurationSeconds(finalElapsedSeconds);
      setIsRecording(false);
      setRecordingElapsedSeconds(0);
    };

    recorder.start();
    setUploadError(null);
    setRecordedAudioUrl(null);
    setRecordedAudioDurationSeconds(null);
    setRecordingElapsedSeconds(0);
    recordingStartedAtRef.current = Date.now();
    recordingIntervalRef.current = setInterval(() => {
      if (recordingStartedAtRef.current == null) return;
      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordingElapsedSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS && mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, 200);
    setIsRecording(true);
  };

  // Cancela una grabación en curso sin conservar nada: detiene el
  // MediaRecorder y todas las pistas del micrófono, descarta los chunks
  // acumulados y no arma ningún adjunto pendiente ni mensaje (a diferencia
  // de handleToggleRecording, cuyo onstop sí arma el adjunto). Se usa tanto
  // para el botón "Cancelar" durante la grabación como para salidas
  // involuntarias (cambiar de conversación, volver a la bandeja en móvil,
  // desmontar la página).
  const handleCancelRecording = () => {
    if (!mediaRecorderRef.current) {
      stopRecordingTimer();
      setIsRecording(false);
      setRecordingElapsedSeconds(0);
      return;
    }

    if (mediaRecorderRef.current.state === 'recording') {
      cancelRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      return;
    }

    // Ya estaba inactivo (no debería ocurrir en el flujo normal): limpia
    // manualmente para no dejar pistas del micrófono activas.
    mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
    stopRecordingTimer();
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingElapsedSeconds(0);
  };

  const ALLOWED_ATTACHMENT_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  // Limpia únicamente el estado local del adjunto pendiente (archivo, sus
  // previews blob: y el nombre/tipo asociados). No toca quickReply ni hace
  // ninguna llamada al backend: la usan tanto "quitar adjunto" como el
  // reemplazo por un nuevo archivo/grabación y la limpieza tras enviar.
  const clearPendingAttachment = () => {
    if (pendingAttachmentPreviewUrl) {
      URL.revokeObjectURL(pendingAttachmentPreviewUrl);
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setPendingAttachmentFile(null);
    setPendingAttachmentPreviewUrl(null);
    setUploadFileType(null);
    setUploadFileName(null);
    setRecordedAudioUrl(null);
    setRecordedAudioDurationSeconds(null);
  };

  // Validación + preparación 100% local (selector manual y pegado de
  // portapapeles la comparten): guarda el File en memoria y arma su vista
  // previa. No sube nada al servidor.
  const preparePendingAttachment = (file: File) => {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
      setUploadError('Solo se permiten imágenes o PDF.');
      return;
    }

    clearPendingAttachment();
    setUploadError(null);
    const nextType = file.type.startsWith('image/') ? 'image' : 'document';
    setPendingAttachmentFile(file);
    setUploadFileType(nextType);
    setUploadFileName(file.name || null);
    setPendingAttachmentPreviewUrl(nextType === 'image' ? URL.createObjectURL(file) : null);
  };

  // Única función que efectivamente sube al backend: se invoca exclusivamente
  // desde el flujo de envío (handleSendWhatsapp), nunca desde la selección,
  // el pegado o la grabación. Devuelve la URL remota o lanza si falla.
  const uploadAttachmentFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers = buildAuthHeaders();

    const response = await fetch(buildApiUrl('/api/uploads'), {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let message = 'No se pudo subir el archivo.';
      try {
        const data = await response.json();
        if (data?.message) message = String(data.message);
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    const data = await response.json();
    if (!data?.url) {
      throw new Error('La respuesta del servidor no incluye la URL.');
    }

    return String(data.url);
  };

  const handleUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se limpia de inmediato (y no en un finally tras subir) para poder
    // volver a seleccionar el mismo archivo justo después.
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    if (!file) return;
    preparePendingAttachment(file);
  };

  const buildPastedImageFileName = (mimeType: string) => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const extension = mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/jpeg' || mimeType === 'image/jpg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'png';
    return `captura-${stamp}.${extension}`;
  };

  const handleQuickReplyPaste = (event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageItem = Array.from(items).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );
    if (!imageItem) return; // sin imagen: deja que el pegado de texto siga su curso normal

    const blob = imageItem.getAsFile();
    if (!blob) return;

    // Evita que el navegador intente insertar la imagen dentro del textarea.
    event.preventDefault();

    const mimeType = imageItem.type || blob.type || 'image/png';
    const file = new File([blob], buildPastedImageFileName(mimeType), { type: mimeType });
    preparePendingAttachment(file);
  };

  const handleRemoveAttachment = () => {
    clearPendingAttachment();
    setUploadError(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const handleSendTemplate = () => {
    if (!selectedLead) return;
    setIsTemplateDialogOpen(true);
  };

  const handleTemplateSuccess = (plantillaNombre: string) => {
    if (!selectedLead) return;
    const nowIso = new Date().toISOString();
    updateLead(selectedLead.id, {
      ultimoMensajeEn: nowIso,
      lastMessage: 'Plantilla enviada — esperando respuesta del cliente',
    });
    setSnackbar({
      open: true,
      message: `Plantilla "${plantillaNombre}" enviada — esperando respuesta del cliente`,
      severity: 'success',
    });
    loadConversations({ incremental: true });
    setIsTemplateDialogOpen(false);
  };

  const urgentLeads = leadsFiltradosOrdenados.filter((l) => l.idleMinutes > 180);
  const followUpLeads = leadsFiltradosOrdenados.filter((l) => l.idleMinutes >= 60 && l.idleMinutes <= 180);
  const newLeads = leadsFiltradosOrdenados.filter((l) => l.idleMinutes < 60);

  const leadsRiesgo = leadsFiltradosOrdenados.filter((l) => l.estado !== 'finalizada' && l.computedPriority === 'Alta');
  const leadsSeguimiento = leadsFiltradosOrdenados.filter((l) => l.estado !== 'finalizada' && l.computedPriority === 'Media');
  const leadsActividad = leadsFiltradosOrdenados.filter((l) => l.estado !== 'finalizada' && l.computedPriority === 'Baja');
  const toleranciaRespuestaMin = reglasSeguimiento.tiempo_tolerancia_respuesta_a_cliente;
  const seguimientoDespuesRespuestaHoras = reglasSeguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente;
  const maxSinRespuestaHoras = reglasSeguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente;
  const riesgoTooltip = (
    <>
      <Typography variant="body2">Si cliente escribió: Más de {toleranciaRespuestaMin} minutos sin responder</Typography>
      <Typography variant="body2">Si vendedor escribió: Más de {maxSinRespuestaHoras} horas sin respuesta del cliente</Typography>
    </>
  );
  const seguimientoTooltip = (
    <>
      <Typography variant="body2">Si cliente escribió: Menos de {toleranciaRespuestaMin} minutos sin responder</Typography>
      <Typography variant="body2">Si vendedor escribió: Entre {seguimientoDespuesRespuestaHoras} y {maxSinRespuestaHoras} horas sin respuesta</Typography>
    </>
  );
  const actividadTooltip = (
    <Typography variant="body2">Menos de {seguimientoDespuesRespuestaHoras} horas desde el último mensaje</Typography>
  );
  console.log('[LeadsPage] list sections', {
    riesgo: leadsRiesgo.map((l) => l.id),
    seguimiento: leadsSeguimiento.map((l) => l.id),
    actividad: leadsActividad.map((l) => l.id),
  });

  const renderLeadCard = (lead: LeadConPrioridad) => {
    const { computedPriority } = lead;
  const ownerLabel = buildLeadOwnerLabel(lead, vendedoresById, vendedorContactoId);
    console.log('[render lead]', {
      id: lead.id,
      etapa: lead.etapa_oportunidad,
      priority: computedPriority,
      awaitingResponse: lead.awaitingResponse,
      lastMessage: lead.lastMessage,
      ultimoMensajeEn: lead.ultimoMensajeEn,
      conversationLastFrom: lead.conversation[lead.conversation.length - 1]?.from,
    });

    const idleSeverity = getIdleSeverity(lead.idleMinutes);
    const requiresAttention = lead.statusType === 'attention';
    return (
      <ListItem disablePadding key={lead.id}>
        <ListItemButton
          selected={lead.id === selectedLead?.id}
          onClick={() => {
            setSelectedLeadId(lead.id);
            setReplyingTo(null);
          }}
          sx={{
            alignItems: 'center',
            px: 1.5,
            py: 0.75,
            borderRadius: 0,
            borderLeft: '3px solid',
            borderLeftColor: requiresAttention
              ? 'error.main'
              : idleSeverity.color === 'warning'
                ? 'warning.main'
                : 'transparent',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            backgroundColor: lead.id === selectedLead?.id
              ? 'primary.main + 08'
              : requiresAttention
                ? 'error.light + 12'
                : 'background.paper',
            '&:hover': {
              backgroundColor: lead.id === selectedLead?.id
                ? 'primary.main + 12'
                : requiresAttention
                  ? 'error.light + 16'
                  : 'action.hover',
            },
          }}
        >
          <Stack spacing={0.2} sx={{ width: '100%', minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {lead.name?.trim() || `WhatsApp ${lead.phone}`}
              </Typography>
              {lead.etapa_oportunidad && (
                <Chip
                  size="small"
                  label={lead.etapa_oportunidad}
                  color={etapaChipColor[lead.etapa_oportunidad]}
                  sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                  onClick={(e) => handleOpenEtapaMenu(lead.id, e.currentTarget)}
                  clickable
                />
              )}
              {lead.estado !== 'finalizada' && (
                <Tooltip title="Marcar como finalizada" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFinalizarDialog(lead.id);
                    }}
                    aria-label="Marcar como finalizada"
                    sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
                  >
                    <TaskAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
              <PersonIcon fontSize="inherit" sx={{ fontSize: 14 }} />
              <Typography variant="caption">{ownerLabel}</Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" noWrap>
              {lead.lastMessage}
            </Typography>

            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: requiresAttention ? 'error.main' : 'grey.400',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: requiresAttention ? 700 : 500,
                  color: requiresAttention ? 'error.main' : 'text.secondary',
                }}
              >
                {lead.statusLabel}
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption">{lead.owner}</Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption">
                {lead.awaitingResponse
                  ? `${formatMinutesAgo(lead.lastMessageTimeMinutesAgo)} sin responder`
                  : `${formatMinutesAgo(lead.lastMessageTimeMinutesAgo)} esperando respuesta`}
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Chip
                size="small"
                label={computedPriority}
                sx={{
                  height: 20,
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: computedPriority === 'Alta'
                    ? 'error.light'
                    : computedPriority === 'Media'
                      ? 'warning.light'
                      : 'grey.200',
                  color: computedPriority === 'Alta'
                    ? 'error.dark'
                    : computedPriority === 'Media'
                      ? '#7c5a00'
                      : 'grey.700',
                  bgcolor: computedPriority === 'Alta'
                    ? 'error.light + 14'
                    : computedPriority === 'Media'
                      ? 'warning.light + 16'
                      : 'grey.100',
                }}
              />
            </Stack>
            {lead.estado === 'finalizada' && (
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ color: 'text.secondary' }}>
                <Typography variant="caption">
                  Finalizada {formatFechaHora(lead.finalizada_en)}
                  {lead.motivo_finalizacion ? ` · ${motivoFinalizacionLabel[lead.motivo_finalizacion]}` : ''}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  disabled={reabrirSavingId === lead.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleReabrirConversacion(lead.id);
                  }}
                  sx={{ textTransform: 'none', minWidth: 'auto', px: 0.5 }}
                >
                  {reabrirSavingId === lead.id ? 'Reabriendo…' : 'Reabrir'}
                </Button>
              </Stack>
            )}
          </Stack>
        </ListItemButton>
      </ListItem>
    );
  };

  const etapaMenuLead = etapaMenu ? leads.find((l) => l.id === etapaMenu.leadId) : null;

  // Mismo comportamiento que ya ejecuta renderLeadCard al tocar un lead en
  // escritorio (seleccionar + limpiar una respuesta en curso); no es lógica
  // nueva, solo se reutiliza para la tarjeta de la bandeja móvil.
  const handleSelectLeadMobile = (id: string) => {
    setSelectedLeadId(id);
    setReplyingTo(null);
  };

  if (isMobile) {
    return (
      <LeadsMobileView
        leadsFiltradosOrdenados={leadsFiltradosOrdenados}
        selectedLeadId={selectedLeadId}
        selectedLead={selectedLead}
        onSelectLead={handleSelectLeadMobile}
        isLoadingConversations={isLoadingConversations}
        isLoadingMessages={isLoadingMessages}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        leadScope={leadScope}
        setLeadScope={setLeadScope}
        setScopeTouched={setScopeTouched}
        canToggleScope={canToggleScope}
        showMisChip={showMisChip}
        showTodosChip={showTodosChip}
        shouldShowScopeChipGroup={shouldShowScopeChipGroup}
        vendedoresById={vendedoresById}
        vendedorContactoId={vendedorContactoId}
        contactosById={contactosById}
        conversationScrollRef={conversationScrollRef}
        conversationEndRef={conversationEndRef}
        quickReply={quickReply}
        setQuickReply={setQuickReply}
        quickReplyRef={quickReplyRef}
        handleSendWhatsapp={handleSendWhatsapp}
        isSending={isSending}
        sendErrorDialog={sendErrorDialog}
        setSendErrorDialog={setSendErrorDialog}
        handleRetryWhatsappSend={handleRetryWhatsappSend}
        ventanaCerradaDialogOpen={ventanaCerradaDialogOpen}
        setVentanaCerradaDialogOpen={setVentanaCerradaDialogOpen}
        pendingAttachmentFile={pendingAttachmentFile}
        pendingAttachmentPreviewUrl={pendingAttachmentPreviewUrl}
        uploadFileType={uploadFileType}
        uploadFileName={uploadFileName}
        uploadError={uploadError}
        isUploadingImage={isUploadingImage}
        uploadInputRef={uploadInputRef}
        handleSelectUpload={handleSelectUpload}
        handleUploadFile={handleUploadFile}
        handleRemoveAttachment={handleRemoveAttachment}
        isRecording={isRecording}
        recordingElapsedSeconds={recordingElapsedSeconds}
        recordedAudioUrl={recordedAudioUrl}
        recordedAudioDurationSeconds={recordedAudioDurationSeconds}
        handleToggleRecording={handleToggleRecording}
        handleCancelRecording={handleCancelRecording}
        forwardMessage={forwardMessage}
        setForwardMessage={setForwardMessage}
        snackbar={snackbar}
        setSnackbar={setSnackbar}
        loadConversations={loadConversations}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        focusReplyInput={focusReplyInput}
        onChatOpenChange={onMobileConversationOpenChange}
      />
    );
  }

  return (
    <LeadsDesktopView
      etapaMenu={etapaMenu}
      etapaMenuLead={etapaMenuLead}
      handleCloseEtapaMenu={handleCloseEtapaMenu}
      handleSelectEtapa={handleSelectEtapa}
      tagsMenuAnchor={tagsMenuAnchor}
      handleCloseTagsMenu={handleCloseTagsMenu}
      availableTags={availableTags}
      conversationTags={conversationTags}
      toggleConversationTag={toggleConversationTag}
      isCreatingTag={isCreatingTag}
      newTagName={newTagName}
      setNewTagName={setNewTagName}
      newTagColor={newTagColor}
      setNewTagColor={setNewTagColor}
      handleCancelCreateTag={handleCancelCreateTag}
      handleSaveNewTag={handleSaveNewTag}
      handleStartCreateTag={handleStartCreateTag}
      manageTagsOpen={manageTagsOpen}
      handleCloseManageTags={handleCloseManageTags}
      tagActionError={tagActionError}
      setTagActionError={setTagActionError}
      handleOpenEditTagForm={handleOpenEditTagForm}
      handleDeactivateTag={handleDeactivateTag}
      tagDeactivatingId={tagDeactivatingId}
      tagFormOpen={tagFormOpen}
      tagFormId={tagFormId}
      tagFormName={tagFormName}
      setTagFormName={setTagFormName}
      tagFormColor={tagFormColor}
      setTagFormColor={setTagFormColor}
      tagFormError={tagFormError}
      handleCancelTagForm={handleCancelTagForm}
      handleSubmitTagForm={handleSubmitTagForm}
      tagFormSaving={tagFormSaving}
      handleOpenCreateTagForm={handleOpenCreateTagForm}
      handleOpenManageTags={handleOpenManageTags}
      handleOpenTagsMenu={handleOpenTagsMenu}
      motivoFinalizacionLabel={motivoFinalizacionLabel}
      motivoFinalizacionOptions={motivoFinalizacionOptions}
      urgentLeads={urgentLeads}
      followUpLeads={followUpLeads}
      newLeads={newLeads}
      leadsFiltradosOrdenados={leadsFiltradosOrdenados}
      leadsRiesgo={leadsRiesgo}
      leadsSeguimiento={leadsSeguimiento}
      leadsActividad={leadsActividad}
      riesgoTooltip={riesgoTooltip}
      seguimientoTooltip={seguimientoTooltip}
      actividadTooltip={actividadTooltip}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      isAdmin={isAdmin}
      vendedorFilterId={vendedorFilterId}
      setVendedorFilterId={setVendedorFilterId}
      leadScope={leadScope}
      setLeadScope={setLeadScope}
      setScopeTouched={setScopeTouched}
      selectedTagIds={selectedTagIds}
      setSelectedTagIds={setSelectedTagIds}
      tagsSelectOpen={tagsSelectOpen}
      setTagsSelectOpen={setTagsSelectOpen}
      selectedTags={selectedTags}
      canToggleScope={canToggleScope}
      showMisChip={showMisChip}
      showTodosChip={showTodosChip}
      shouldShowScopeChipGroup={shouldShowScopeChipGroup}
      showQuickFilterChips={showQuickFilterChips}
      leadFilter={leadFilter}
      setLeadFilter={setLeadFilter}
      opportunityFilter={opportunityFilter}
      setOpportunityFilter={setOpportunityFilter}
      vistaFinalizadas={vistaFinalizadas}
      setVistaFinalizadas={setVistaFinalizadas}
      vendorOptions={vendorOptions}
      renderLeadCard={renderLeadCard}
      selectedLead={selectedLead}
      selectedLeadPriority={selectedLeadPriority}
      selectedContactoId={selectedContactoId}
      selectedContacto={selectedContacto}
      selectedVendedorId={selectedVendedorId}
      vendedoresById={vendedoresById}
      vendedorContactoId={vendedorContactoId}
      isUpdatingOwner={isUpdatingOwner}
      openCompleteContactDialog={openCompleteContactDialog}
      handleOwnerChange={handleOwnerChange}
      updateLead={updateLead}
      isSending={isSending}
      sendSuccess={sendSuccess}
      handleSendWhatsapp={handleSendWhatsapp}
      isSuggesting={isSuggesting}
      handleSuggestMessage={handleSuggestMessage}
      handleSendTemplate={handleSendTemplate}
      handleGenerarCotizacion={handleGenerarCotizacion}
      navigate={navigate}
      oportunidadesOpen={oportunidadesOpen}
      setOportunidadesOpen={setOportunidadesOpen}
      isLoadingOportunidades={isLoadingOportunidades}
      oportunidadesError={oportunidadesError}
      oportunidades={oportunidades}
      isTemplateDialogOpen={isTemplateDialogOpen}
      setIsTemplateDialogOpen={setIsTemplateDialogOpen}
      handleTemplateSuccess={handleTemplateSuccess}
      forwardMessage={forwardMessage}
      setForwardMessage={setForwardMessage}
      loadConversations={loadConversations}
      conversationScrollRef={conversationScrollRef}
      conversationEndRef={conversationEndRef}
      replyingTo={replyingTo}
      setReplyingTo={setReplyingTo}
      focusReplyInput={focusReplyInput}
      handleRetryWhatsappSend={handleRetryWhatsappSend}
      uploadInputRef={uploadInputRef}
      handleUploadFile={handleUploadFile}
      handleSelectUpload={handleSelectUpload}
      isRecording={isRecording}
      handleToggleRecording={handleToggleRecording}
      quickReply={quickReply}
      setQuickReply={setQuickReply}
      quickReplyRef={quickReplyRef}
      handleQuickReplyPaste={handleQuickReplyPaste}
      isUploadingImage={isUploadingImage}
      uploadFileType={uploadFileType}
      uploadError={uploadError}
      pendingAttachmentFile={pendingAttachmentFile}
      uploadFileName={uploadFileName}
      pendingAttachmentPreviewUrl={pendingAttachmentPreviewUrl}
      recordedAudioUrl={recordedAudioUrl}
      handleRemoveAttachment={handleRemoveAttachment}
      isCompleteContactOpen={isCompleteContactOpen}
      closeCompleteContactDialog={closeCompleteContactDialog}
      completeContactForm={completeContactForm}
      setCompleteContactForm={setCompleteContactForm}
      handleSaveCompleteContact={handleSaveCompleteContact}
      finalizarDialogOpen={finalizarDialogOpen}
      handleCloseFinalizarDialog={handleCloseFinalizarDialog}
      finalizarTargetLead={finalizarTargetLead}
      finalizarMotivo={finalizarMotivo}
      setFinalizarMotivo={setFinalizarMotivo}
      finalizarObservaciones={finalizarObservaciones}
      setFinalizarObservaciones={setFinalizarObservaciones}
      finalizarError={finalizarError}
      handleConfirmFinalizar={handleConfirmFinalizar}
      finalizarSaving={finalizarSaving}
      snackbar={snackbar}
      setSnackbar={setSnackbar}
      sendErrorDialog={sendErrorDialog}
      setSendErrorDialog={setSendErrorDialog}
      ventanaCerradaDialogOpen={ventanaCerradaDialogOpen}
      setVentanaCerradaDialogOpen={setVentanaCerradaDialogOpen}
    />
  );
}
