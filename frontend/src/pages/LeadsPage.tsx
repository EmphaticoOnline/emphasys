import React from 'react';
import { alpha } from '@mui/material/styles';
import {
  Alert,
  Avatar,
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
import { enviarReaccionMensaje, fetchConversaciones, fetchMensajesConversacion } from '../services/conversacionesService';
import { fetchChatSoundPreferences, guardarChatSoundPreferences } from '../services/chatPreferencesService';
import { DEFAULT_NOTIFICATION_TONE, playNotificationSound, unlockAudioContext, type NotificationTone } from '../utils/notificationSound';
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
  getLeadAvatarColor,
  getLeadInitials,
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
  ultimoMensajeTipoContenido?: 'text' | 'image' | 'audio' | 'document' | 'video' | null;
  ultimoMensajeCaption?: string | null;
  ultimoMensajeEsGif?: boolean | null;
  ultimoMensajeEn: string | null;
  unreadCount?: number;
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

export type MessageReaction = {
  autor: 'contacto' | 'agente';
  emoji: string;
};

export type ConversationMessage = {
  id: string;
  telefono: string | null;
  tipo_mensaje: 'entrante' | 'saliente';
  canal: string | null;
  contenido: string | null;
  tipo_contenido?: 'text' | 'image' | 'audio' | 'document' | 'video' | null;
  media_url?: string | null;
  mime_type?: string | null;
  // true solo si tipo_contenido es 'video' y WhatsApp lo identificó como GIF
  // animado (gif_playback o filename .gif — ver whatsapp.mapper.ts). Decide
  // si el <video> se reproduce en loop/autoplay/mute sin controles o como un
  // video normal con controles.
  es_gif?: boolean | null;
  caption?: string | null;
  fecha_envio: string | null;
  creado_en?: string | null;
  status: string | null;
  mensaje_respuesta_id?: string | number | null;
  respuesta_tipo_mensaje?: 'entrante' | 'saliente' | null;
  respuesta_tipo_contenido?: 'text' | 'image' | 'audio' | 'document' | 'video' | null;
  respuesta_contenido?: string | null;
  respuesta_caption?: string | null;
  reacciones?: MessageReaction[] | null;
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
    tipoContenido?: 'text' | 'image' | 'audio' | 'document' | 'video';
    mediaUrl?: string | null;
    mimeType?: string | null;
    isGif?: boolean;
    caption?: string | null;
    status?: 'sending' | 'sent' | 'failed';
    tempId?: string;
    replyTo?: ReplyPreview | null;
    reactions?: MessageReaction[];
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
export type WhatsappWindowFilter = 'todos' | 'por-expirar' | 'expirada';
export type LeadScope = 'mis' | 'todos';
export type ConversationViewMode = 'priority' | 'recent';
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
  // Los borradores pertenecen a la conversación (selectedLeadId es el
  // conversationId estable en este módulo), no al contacto ni al componente
  // visual. Así desktop y mobile comparten una única fuente de verdad.
  const [draftsByConversation, setDraftsByConversation] = React.useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = React.useState<ReplyPreview | null>(null);
  // Sonido de mensaje nuevo: activado por defecto hasta que se cargue la
  // preferencia guardada (fetchChatSoundPreferences también devuelve `true`
  // por defecto), para no arrancar en silencio mientras se resuelve la llamada.
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  // Tono elegido para el sonido de mensaje nuevo. 'discreto' es el default
  // tanto aquí como en el backend (fetchChatSoundPreferences) para usuarios
  // sin preferencia guardada — es, además, el sonido original de esta
  // feature, así que no cambia el comportamiento por defecto de nadie.
  const [selectedTone, setSelectedTone] = React.useState<NotificationTone>(DEFAULT_NOTIFICATION_TONE);
  const notificationVolumeKey = `crm.notifications.volume.${session.user?.id ?? 'unknown'}`;
  const [notificationVolume, setNotificationVolume] = React.useState(() => {
    const storedValue = window.localStorage.getItem(notificationVolumeKey);
    if (storedValue === null) return 1;
    const stored = Number(storedValue);
    return Number.isFinite(stored) && stored >= 0 && stored <= 5 ? stored : 1;
  });
  const notificationVolumeRef = React.useRef(notificationVolume);
  React.useEffect(() => { notificationVolumeRef.current = notificationVolume; }, [notificationVolume]);
  const handleChangeNotificationVolume = React.useCallback((volume: number) => {
    const next = Math.max(0, Math.min(5, volume));
    setNotificationVolume(next);
    window.localStorage.setItem(notificationVolumeKey, String(next));
  }, [notificationVolumeKey]);
  // Refs espejo de soundEnabled/selectedTone: loadConversations (callback de
  // larga vida, reutilizado por el intervalo de polling de 5s) necesita leer
  // el valor más reciente de ambos sin tener que reconstruirse cada vez que
  // cambia alguna preferencia (evita resetear el intervalo de polling).
  const soundEnabledRef = React.useRef(soundEnabled);
  React.useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  const selectedToneRef = React.useRef(selectedTone);
  React.useEffect(() => {
    selectedToneRef.current = selectedTone;
  }, [selectedTone]);
  const [forwardMessage, setForwardMessage] = React.useState<ForwardableMessage | null>(null);
  // Archivo local pendiente (seleccionado, pegado o grabado) que todavía no
  // se ha subido al servidor: solo viaja a /api/uploads cuando el usuario
  // presiona enviar. pendingAttachmentPreviewUrl es la URL blob: local usada
  // únicamente para previsualizar imágenes (nunca una URL remota).
  const [pendingAttachmentFile, setPendingAttachmentFile] = React.useState<File | null>(null);
  const [pendingAttachmentPreviewUrl, setPendingAttachmentPreviewUrl] = React.useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = React.useState<'image' | 'document' | 'audio' | 'video' | null>(null);
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
  const [oportunidadesOpen, setOportunidadesOpen] = React.useState(false);
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
  const [whatsappWindowFilter, setWhatsappWindowFilter] = React.useState<WhatsappWindowFilter>('todos');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  const [vistaFinalizadas, setVistaFinalizadas] = React.useState(false);
  const conversationViewStorageKey = `crm.conversations.viewMode.${session.user?.id ?? 'unknown'}`;
  const [conversationViewMode, setConversationViewMode] = React.useState<ConversationViewMode>(() => {
    if (typeof window === 'undefined') return 'priority';
    return window.localStorage.getItem(`crm.conversations.viewMode.${session.user?.id ?? 'unknown'}`) === 'recent' ? 'recent' : 'priority';
  });
  const handleConversationViewModeChange = React.useCallback((mode: ConversationViewMode) => {
    setConversationViewMode(mode);
    window.localStorage.setItem(conversationViewStorageKey, mode);
  }, [conversationViewStorageKey]);
  const [finalizarDialogOpen, setFinalizarDialogOpen] = React.useState(false);
  const [finalizarTargetLeadId, setFinalizarTargetLeadId] = React.useState<string | null>(null);
  const [finalizarMotivo, setFinalizarMotivo] = React.useState<MotivoFinalizacion | ''>('');
  const [finalizarObservaciones, setFinalizarObservaciones] = React.useState('');
  const [finalizarSaving, setFinalizarSaving] = React.useState(false);
  const [finalizarError, setFinalizarError] = React.useState<string | null>(null);
  const [reabrirSavingId, setReabrirSavingId] = React.useState<string | null>(null);
  const [leadScope, setLeadScope] = React.useState<LeadScope>('todos');
  const [scopeTouched, setScopeTouched] = React.useState(false);
  // true una vez que se resolvió la carga de 'leads-chat' (ver más abajo):
  // hasta entonces, ni el auto-default de scope ni la primera carga de
  // conversaciones corren, para no aplicar primero un scope y corregirlo un
  // instante después (el usuario vería la lista "saltar" de un scope a otro).
  const [leadScopePreferenceResolved, setLeadScopePreferenceResolved] = React.useState(false);
  // Espejo de leadScope: handleToggleSound/handleChangeTone lo necesitan
  // para guardar el trío completo de 'leads-chat' sin depender de leadScope
  // en su propio arreglo de dependencias (mismo patrón que soundEnabledRef/
  // selectedToneRef, arriba).
  const leadScopeRef = React.useRef(leadScope);
  React.useEffect(() => {
    leadScopeRef.current = leadScope;
  }, [leadScope]);
  // Espejo de selectedLeadId: mismo motivo que leadScopeRef — handleToggleSound/
  // handleChangeTone/handleLeadScopeChange necesitan su valor vigente sin
  // depender de él en su propio arreglo de dependencias.
  const selectedLeadIdRef = React.useRef(selectedLeadId);
  React.useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);
  // selectedLeadId persistido en 'leads-chat', guardado acá (no en estado)
  // mientras se resuelve la colección: recién se aplica/consume dentro de la
  // rama "replace" de loadConversations (más abajo), una sola vez, validando
  // primero que siga existiendo en la colección recién cargada — así nunca
  // se dispara loadMessages para un id todavía sin confirmar, y nunca hay un
  // render intermedio con el primer lead antes de saltar al restaurado.
  const persistedSelectedLeadIdRef = React.useRef<string | null>(null);
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
  // Contador incremental: cada llamada a loadConversations captura su valor
  // al iniciar. Si al resolver la respuesta ya no coincide con el valor
  // actual del ref, significa que se disparó una llamada más nueva mientras
  // esta estaba en vuelo (p. ej. vendedorContactoId recién resuelto
  // cambiando leadScope de 'todos' a 'mis' un render después) y esta
  // respuesta, más vieja, se descarta en vez de sobrescribir el estado.
  const loadConversationsRequestIdRef = React.useRef(0);
  const lastConversationLengthRef = React.useRef(0);
  const lastSelectedLeadIdRef = React.useRef<string | null>(null);
  const lastWasLoadingMessagesRef = React.useRef(false);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const renderCountRef = React.useRef(0);

  renderCountRef.current += 1;
  console.log('[LeadsPage] render', {
    count: renderCountRef.current,
    leads: leads.length,
    conversations: conversations.length,
    selectedLeadId,
  });

  // Preferencias de 'leads-chat': sonido de mensajes + scope (Mis leads/
  // Todos). Se cargan una sola vez al montar, reutilizando el backend
  // genérico de preferencias por usuario (core.grid_preferences vía
  // /api/grid-preferences, ver chatPreferencesService.ts). perfilDispositivo
  // distingue desktop/mobile igual que ya hace el resto del proyecto con
  // useGridPreferences.
  const chatDeviceProfile = isMobile ? 'mobile' : 'desktop';
  React.useEffect(() => {
    let cancelled = false;
    fetchChatSoundPreferences(chatDeviceProfile).then(({ sonidoActivado, tonoMensajes, leadScope: storedLeadScope, selectedLeadId: storedSelectedLeadId }) => {
      if (cancelled) return;
      setSoundEnabled(sonidoActivado);
      setSelectedTone(tonoMensajes);
      // Si el usuario ya había elegido Mis leads/Todos antes, esa preferencia
      // manda sobre el auto-default (isAdmin/vendedorContactoId): se marca
      // scopeTouched para que ese efecto no la pise. Si no hay preferencia
      // guardada (storedLeadScope === null), no se toca leadScope acá — sigue
      // el comportamiento default existente.
      if (storedLeadScope) {
        setLeadScope(storedLeadScope);
        setScopeTouched(true);
      }
      // No se aplica a selectedLeadId todavía (la colección aún no cargó):
      // se guarda en un ref y lo consume/valida la rama "replace" de
      // loadConversations una sola vez, más abajo.
      persistedSelectedLeadIdRef.current = storedSelectedLeadId;
      setLeadScopePreferenceResolved(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDeviceProfile]);

  // El PUT de preferencias reemplaza el JSON completo (no lo mezcla — ver
  // chatPreferencesService.ts), así que el toggle de sonido, el selector de
  // tono, el cambio de scope y el cambio de conversación seleccionada
  // siempre guardan el conjunto completo, usando el ref del campo que NO
  // están cambiando para no perderlo.
  const handleToggleSound = React.useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      void guardarChatSoundPreferences(chatDeviceProfile, {
        sonidoActivado: next,
        tonoMensajes: selectedToneRef.current,
        leadScope: leadScopeRef.current,
        selectedLeadId: selectedLeadIdRef.current || null,
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDeviceProfile]);

  const handleChangeTone = React.useCallback((tone: NotificationTone) => {
    setSelectedTone(tone);
    void guardarChatSoundPreferences(chatDeviceProfile, {
      sonidoActivado: soundEnabledRef.current,
      tonoMensajes: tone,
      leadScope: leadScopeRef.current,
      selectedLeadId: selectedLeadIdRef.current || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDeviceProfile]);

  // Única vía para cambiar el scope manualmente (chips Mis leads/Todos en
  // desktop y mobile, ambos vía onLeadScopeChange): además de actualizar el
  // estado, marca scopeTouched (para que el auto-default no lo pise) y
  // persiste el conjunto completo de 'leads-chat' de inmediato.
  const handleLeadScopeChange = React.useCallback((next: LeadScope) => {
    setLeadScope(next);
    setScopeTouched(true);
    void guardarChatSoundPreferences(chatDeviceProfile, {
      sonidoActivado: soundEnabledRef.current,
      tonoMensajes: selectedToneRef.current,
      leadScope: next,
      selectedLeadId: selectedLeadIdRef.current || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDeviceProfile]);

  // Única vía para persistir la conversación seleccionada manualmente: se
  // llama junto a cada setSelectedLeadId(id) real (clic en una fila,
  // responder rápido, selección en mobile) — nunca junto al reset a '' del
  // cambio de filtros, ni junto al auto-select del primer lead.
  const persistSelectedLeadId = React.useCallback((id: string) => {
    void guardarChatSoundPreferences(chatDeviceProfile, {
      sonidoActivado: soundEnabledRef.current,
      tonoMensajes: selectedToneRef.current,
      leadScope: leadScopeRef.current,
      selectedLeadId: id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDeviceProfile]);

  // "Probar sonido": reproduce el tono actualmente seleccionado reutilizando
  // el mismo AudioContext ya desbloqueado. No toca ninguna conversación ni
  // genera ningún evento de mensaje — es una llamada directa a
  // playNotificationSound, igual que la que dispara un mensaje entrante real.
  const handlePreviewTone = React.useCallback(() => {
    void playNotificationSound(selectedTone, notificationVolumeRef.current);
  }, [selectedTone]);

  // Desbloquea el AudioContext del sonido de notificaciones en la primera
  // interacción real del usuario con la página (clic, touch o tecla): un
  // AudioContext creado/reanudado fuera de un gesto real puede quedar
  // atascado en 'suspended' (política de autoplay, especialmente en
  // Safari) — ver notificationSound.ts. Se retira a sí mismo tras la
  // primera interacción o al desmontar la página.
  React.useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudioContext();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

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
    // Espera a que se resuelva 'leads-chat' (arriba): si había una
    // preferencia guardada, ya vino con scopeTouched=true y este efecto no
    // hace nada; si no había ninguna, recién ahora aplica el default de
    // siempre. Evita que se vea primero un scope (este default) y luego otro
    // (la preferencia restaurada) en el mismo montaje.
    if (!leadScopePreferenceResolved) return;
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
  }, [leadScopePreferenceResolved, isAdmin, vendedorContactoId, scopeTouched]);

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
      const matchesWindow = whatsappWindowFilter === 'todos'
        || (whatsappWindowFilter === 'por-expirar' && lead.within24hWindow === true && lead.windowExpiresInMinutes > 0 && lead.windowExpiresInMinutes <= 60)
        || (whatsappWindowFilter === 'expirada' && (!lead.within24hWindow || lead.windowExpiresInMinutes <= 0));
      if (!matchesWindow) return false;
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
  }, [debouncedSearchTerm, leadFilter, leadsConPrioridad, opportunityFilter, whatsappWindowFilter]);

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

  // La selección siempre debe pertenecer al mismo conjunto que alimenta la
  // lista visible. Antes se resolvía contra leadsConPrioridad (sin filtros),
  // dejando el detalle abierto sobre una conversación ya excluida.
  const selectedLead = leadsFiltradosOrdenados.find((l) => l.id === selectedLeadId) ?? leadsFiltradosOrdenados[0];
  React.useEffect(() => {
    const nextSelectedId = leadsFiltradosOrdenados[0]?.id ?? '';
    if (selectedLeadId !== nextSelectedId && !leadsFiltradosOrdenados.some((lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(nextSelectedId);
      persistSelectedLeadId(nextSelectedId);
      setReplyingTo(null);
      clearPendingAttachment();
      setUploadError(null);
    }
  }, [leadsFiltradosOrdenados, persistSelectedLeadId, selectedLeadId]);
  const leadsRecientes = React.useMemo(() => [...leadsFiltradosOrdenados].sort((a, b) => {
    const aTime = a.ultimoMensajeEn ? Date.parse(a.ultimoMensajeEn) : 0;
    const bTime = b.ultimoMensajeEn ? Date.parse(b.ultimoMensajeEn) : 0;
    return bTime - aTime;
  }), [leadsFiltradosOrdenados]);
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
    const ultimoMensajeTexto = conv.ultimoMensaje?.trim() || conv.ultimoMensajeCaption?.trim() || '';
    const lastMessage = ultimoMensajeTexto || (conv.ultimoMensajeTipoContenido === 'image'
      ? '📷 Imagen'
      : conv.ultimoMensajeTipoContenido === 'video'
        ? (conv.ultimoMensajeEsGif ? 'GIF' : '🎥 Video')
        : conv.ultimoMensajeTipoContenido === 'audio'
          ? '🎤 Audio'
          : conv.ultimoMensajeTipoContenido === 'document'
            ? '📄 Documento'
            : '');
    const baseLead: Lead = {
      id: conv.id,
      name: conv.nombre?.trim() || conv.telefono || 'WhatsApp',
      phone: conv.telefono || '',
      lastMessage,
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
      unreadCount: conv.unreadCount ?? 0,
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
    // Identificador de ESTA llamada. Si para cuando la respuesta llegue ya
    // se disparó una llamada más nueva (p. ej. porque vendedorContactoId
    // recién terminó de cargar y leadScope pasó de 'todos' a 'mis' un
    // render después), esta respuesta quedó obsoleta y no debe aplicarse:
    // sin esto, la que responda más tarde gana sin importar cuál sea la
    // vigente, y el scope visual puede quedar desincronizado de la lista.
    const requestId = ++loadConversationsRequestIdRef.current;

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

      if (requestId !== loadConversationsRequestIdRef.current) {
        console.log('[LeadsPage] loadConversations response stale, discarded', {
          incremental,
          requestId,
          latest: loadConversationsRequestIdRef.current,
        });
        return;
      }

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

        // Sonido de mensaje nuevo: se evalúa aquí, ANTES de decidir la rama
        // de reemplazo completo (!incremental) o de merge incremental, para
        // que corra siempre — antes vivía solo dentro de la rama incremental
        // (más abajo), y el polling pasa incremental:false en TODO tick
        // mientras leadScope === 'todos' (el valor por defecto de la
        // página), así que en ese caso el sonido nunca llegaba a evaluarse.
        // Usa `prev` (estado justo antes de esta actualización, nunca un
        // closure potencialmente obsoleto) y no toca la lógica de
        // reemplazo/merge que sigue debajo. Solo suena si el último mensaje
        // de una conversación es entrante Y es más nuevo que el último que
        // ya conocíamos (o la conversación es nueva): así no vuelve a sonar
        // si el mismo dato se repite en un poll posterior, no suena en la
        // carga inicial ni al enviar nosotros un mensaje (tipo saliente).
        //
        // `prev.length > 0` es la guarda clave contra la carga inicial de la
        // página (mount, loadConversations() sin argumentos → prev siempre
        // es [] la primera vez): sin ella, CADA conversación cuyo último
        // mensaje fuera entrante sonaría al abrir/refrescar la página,
        // porque toda comparación contra un `prev` vacío parece "más nueva".
        // Con `prev` ya poblado (cualquier poll posterior al primero), la
        // comparación por conversación individual sigue funcionando igual
        // para detectar leads genuinamente nuevos.
        if (soundEnabledRef.current && prev.length > 0) {
          const prevById = new Map(prev.map((lead) => [lead.id, lead] as const));
          data.forEach((conv) => {
            if (conv.ultimoMensajeTipo !== 'entrante') return;
            const nuevoTs = conv.ultimoMensajeEn ? new Date(conv.ultimoMensajeEn).getTime() : NaN;
            if (!Number.isFinite(nuevoTs)) return;
            const previo = prevById.get(conv.id)?.ultimoMensajeEn ?? null;
            const previoTs = previo ? new Date(previo).getTime() : NaN;
            const esMasNuevo = !Number.isFinite(previoTs) || nuevoTs > previoTs;
            if (esMasNuevo) {
              void playNotificationSound(selectedToneRef.current, notificationVolumeRef.current);
            }
          });
        }

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

            // El texto de previsualización (lastMessage) sí toma el último
            // mensaje de WhatsApp del historial cacheado, porque el resumen
            // del backend (baseLead.lastMessage) siempre llega vacío. Pero
            // el ORDEN (lastMessageTimeMinutesAgo/ultimoMensajeEn) queda con
            // los valores frescos de baseLead — la misma fuente que usan
            // TODOS los leads, se haya cargado su historial o no — para que
            // abrir una conversación no la reordene sin actividad real.
            return applyDerivedLeadState({
              ...existing,
              ...baseLead,
              lastMessage: baseLead.lastMessage,
              conversation: existing.conversation,
            }, reglasSeguimiento);
          });
          console.log('[LeadsPage] setLeads replace', {
            count: initialLeads.length,
            preservedConversations: initialLeads.filter((lead) => lead.conversation.length > 0).length,
          });
          const firstId = initialLeads[0]?.id;
          // El selectedLeadId persistido (si existe) se consume una sola vez,
          // acá, ni un instante antes: recién ahora hay una colección real
          // contra la cual validarlo. Prioridad: selección real ya en curso
          // (current) > selectedLeadId persistido, SI sigue existiendo en
          // esta colección > primer lead disponible. Se limpia el ref tras
          // consumirlo para que un cambio de filtro/scope posterior (que
          // resetea selectedLeadId a '') no vuelva a saltar a esta misma
          // conversación restaurada de sesiones pasadas.
          const persisted = persistedSelectedLeadIdRef.current;
          persistedSelectedLeadIdRef.current = null;
          setSelectedLeadId((current) => {
            if (current) return current;
            if (persisted && initialLeads.some((lead) => lead.id === persisted)) {
              return persisted;
            }
            return firstId ?? current;
          });
          return initialLeads;
        }

        const map = new Map(prev.map((l) => [l.id, l] as const));

        data.forEach((conv) => {
          const existing = map.get(conv.id);

          if (existing) {
            // Igual que en la rama "replace": lastMessage (texto) sí puede
            // tomar el último mensaje de WhatsApp cacheado, porque el
            // resumen no trae texto de preview. El orden
            // (lastMessageTimeMinutesAgo/ultimoMensajeEn/idleMinutes/
            // awaitingResponse) se recalcula desde el propio `conv` fresco
            // (buildLeadFromConversation), la misma fuente que usan todos
            // los leads — no desde el historial cacheado del lead
            // seleccionado, que lo desincronizaba del resto apenas se abría.
            const baseLead = buildLeadFromConversation(conv);
            const updatedLead = {
              ...existing,
              name: conv.nombre?.trim() || conv.telefono || existing.name,
              phone: conv.telefono || existing.phone,
              lastMessage: baseLead.lastMessage,
              lastMessageTimeMinutesAgo: baseLead.lastMessageTimeMinutesAgo,
              idleMinutes: baseLead.idleMinutes,
              awaitingResponse: baseLead.awaitingResponse,
              nextAction: baseLead.nextAction,
              ultimoMensajeEn: baseLead.ultimoMensajeEn,
              vendedor_id: conv.vendedor_id ?? existing.vendedor_id,
              etapa_oportunidad: conv.etapa_oportunidad ? normalizeEtapaOportunidad(conv.etapa_oportunidad) : existing.etapa_oportunidad,
              tiene_oportunidad: conv.tiene_oportunidad ?? existing.tiene_oportunidad,
              tags: conv.tags ?? existing.tags ?? [],
              unreadCount: conv.unreadCount ?? 0,
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
      // Igual que con la respuesta: si ya hay una llamada más nueva en
      // vuelo, esta (obsoleta) no debe apagar isFilterTransitionRef ni
      // isLoadingConversations por ella — se lo dejamos a la vigente.
      if (!incremental && requestId === loadConversationsRequestIdRef.current) {
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

        // El orden/prioridad del inbox (lastMessage, idleMinutes,
        // awaitingResponse, nextAction, ultimoMensajeEn) es responsabilidad
        // EXCLUSIVA de loadConversations — la misma fuente para TODOS los
        // leads, se haya abierto su historial o no. Si loadMessages también
        // recalculaba esos campos a partir del historial (filtrado a
        // WhatsApp), un lead cambiaba de lugar en el inbox por el solo
        // hecho de seleccionarlo, sin ninguna actividad real nueva. Acá solo
        // se actualiza `conversation` (para pintar el chat) y las señales
        // que sí dependen genuinamente del historial completo — ventana de
        // 24h / si requiere plantilla, que buscan el último mensaje
        // ENTRANTE real — todo lo demás se conserva tal cual lo tenía `l`.
        const derived = applyDerivedLeadState({ ...l, conversation: mergedConversation }, reglasSeguimiento);
        const recalculated: Lead = {
          ...l,
          conversation: mergedConversation,
          within24hWindow: derived.within24hWindow,
          windowExpiresInMinutes: derived.windowExpiresInMinutes,
          canSendFreeMessage: derived.canSendFreeMessage,
          requiresTemplate: derived.requiresTemplate,
        };
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
    persistSelectedLeadId(leadId);
    setQuickReply(draftsByConversation[leadId] ?? '');
    setReplyingTo(null);
    clearPendingAttachment();
    setUploadError(null);
    focusReplyInput();
  };

  const handleQuickReplyChange = React.useCallback((value: React.SetStateAction<string>) => {
    setQuickReply((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      if (selectedLeadId) {
        setDraftsByConversation((drafts) => {
          if (!next) {
            if (!(selectedLeadId in drafts)) return drafts;
            const { [selectedLeadId]: _removed, ...rest } = drafts;
            return rest;
          }
          return { ...drafts, [selectedLeadId]: next };
        });
      }
      return next;
    });
  }, [selectedLeadId]);

  const handleSelectLead = React.useCallback((id: string) => {
    setSelectedLeadId(id);
    persistSelectedLeadId(id);
    setQuickReply(draftsByConversation[id] ?? '');
    setReplyingTo(null);
    // Los adjuntos son objetos File locales y no deben cruzar de chat. Se
    // descartan al navegar; el texto sí se conserva en draftsByConversation.
    clearPendingAttachment();
    setUploadError(null);
  }, [draftsByConversation, persistSelectedLeadId]);

  React.useEffect(() => {
    if (!selectedLeadId) return;

    const conversationId = selectedLeadId;
    const timeoutId = window.setTimeout(async () => {
      // El cleanup cancela el timeout al cambiar de chat; esta guarda cubre
      // además cualquier callback que ya estuviera encolado.
      if (selectedLeadId !== conversationId) return;

      try {
        const response = await apiFetch(`/api/whatsapp/conversaciones/${encodeURIComponent(conversationId)}/leer`, { method: 'POST' });
        if (!response.ok || selectedLeadId !== conversationId) return;
        const result = await response.json() as { marked?: boolean };
        // El backend es la autoridad: un usuario no responsable no limpia
        // el contador que corresponde al responsable.
        if (!result.marked || selectedLeadId !== conversationId) return;

        setLeads((prev) => prev.map((lead) => lead.id === conversationId ? { ...lead, unreadCount: 0 } : lead));
        setConversations((prev) => prev.map((conversation) => conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation));
      } catch (error) {
        console.error('Error marcando conversación como leída:', error);
      }
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [selectedLeadId]);

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
    // Espera al mismo gate que el auto-default de scope: no dispara la
    // primera carga hasta tener el leadScope FINAL (preferencia restaurada
    // o default), para no traer una colección con un scope y mostrar
    // después el chip con otro (la carrera que ya se corrigió con
    // loadConversationsRequestIdRef sigue intacta para carreras posteriores,
    // esto solo evita generar una de más en el montaje).
    if (!leadScopePreferenceResolved) return;
    console.log('[LeadsPage] useEffect(loadConversations) init');
    lastConversationsFetchRef.current = null;
    isFilterTransitionRef.current = true;
    setSelectedLeadId('');
    loadConversations();
  }, [leadScopePreferenceResolved, leadScope, selectedTagIds, vendedorContactoId, vendedorFilterId, vistaFinalizadas, debouncedSearchTerm]);

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

      // loadConversations se espera antes de disparar loadMessages (antes
      // corrían en paralelo, sin orden garantizado) para eliminar una
      // carrera con el sonido de mensaje nuevo: si loadMessages actualizaba
      // primero el ultimoMensajeEn de la conversación abierta, la
      // comparación "es más nuevo" dentro de loadConversations podía
      // encontrarlo ya actualizado y saltarse el sonido para esa
      // conversación específica. No cambia qué se pide, cuántas veces, ni
      // cada cuánto (sigue siendo cada REFRESH_INTERVAL_MS): solo el orden
      // relativo de estas dos llamadas dentro del mismo tick.
      void (async () => {
        if (!isFilterTransitionRef.current) {
          await loadConversations({ incremental: leadScope !== 'todos' });
        }

        if (selectedLeadId) {
          const since = getLastSentAtForLead(selectedLeadId);
          loadMessages(selectedLeadId, { since, append: true, silent: true });
        }
      })();

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
    // Valor de isLoadingMessages en el render ANTERIOR a este efecto (no el
    // actual): así, cuando la carga inicial (no incremental, no silenciosa)
    // de la conversación termina, este efecto todavía ve "estaba cargando"
    // en la misma pasada en la que el historial creció, y distingue ese
    // asentamiento inicial de un mensaje nuevo llegando por polling.
    const wasLoadingInitialHistory = lastWasLoadingMessagesRef.current;

    lastSelectedLeadIdRef.current = currentLeadId;
    lastConversationLengthRef.current = currentLength;
    lastWasLoadingMessagesRef.current = isLoadingMessages;

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

    // Si el historial creció mientras la carga inicial de esta conversación
    // seguía en curso (restauración al montar / cambio de lead cuyo fetch
    // completo de mensajes aún no resolvía), es esa misma carga asentándose:
    // posicionamiento instantáneo, sin animación visible. Solo un mensaje
    // nuevo llegando con la conversación ya asentada anima el scroll.
    scrollToBottom(wasLoadingInitialHistory ? 'auto' : 'smooth');
  }, [isAtBottom, isLoadingMessages, scrollToBottom, selectedLeadId, selectedLead?.conversation.length]);

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

      handleQuickReplyChange(data.mensaje);
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
    const isVideoMessage = fileType === 'video';
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
            : fileUrl && isVideoMessage
              ? { tipo: 'video', media_url: fileUrl, mensaje: trimmedMessage || null }
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
            : isVideoMessage
              ? ('video' as const)
            : ('text' as const),
      mediaUrl: fileUrl,
      caption: isImageMessage
        ? (trimmedMessage || null)
        : isDocumentMessage
          ? (uploadFileName || null)
          : isVideoMessage ? (trimmedMessage || null) : null,
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
              : isVideoMessage
                ? 'Video enviado'
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

  // Reacciona (o quita la reacción, con emoji null) a un mensaje propio o del
  // lead. Envía la reacción real a Gupshup vía el backend y, si tiene éxito,
  // refresca con el mismo mecanismo ya usado tras enviar un mensaje
  // (loadMessages append+silent) — sin polling nuevo, la reacción llega en el
  // mismo shape que ya trae el resto de la conversación.
  const handleReactToMessage = async (leadId: string, messageId: string, emoji: string | null) => {
    try {
      const response = await enviarReaccionMensaje(messageId, emoji);
      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        throw new Error(payload?.mensaje_usuario || payload?.message || 'No se pudo enviar la reacción');
      }

      const since = getLastSentAtForLead(leadId);
      await loadMessages(leadId, { since, append: true, silent: true });
    } catch (error: any) {
      console.error('[WhatsApp Reaction] Error al reaccionar', error);
      setSnackbar({
        open: true,
        message: error?.message || 'No se pudo enviar la reacción',
        severity: 'error',
      });
    }
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

  const MAX_VIDEO_SIZE_BYTES = 16 * 1024 * 1024;
  const ALLOWED_ATTACHMENT_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/3gpp',
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
      setUploadError('Formato no compatible. Puedes adjuntar imágenes, PDF o videos MP4/3GP.');
      return;
    }
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE_BYTES) {
      setUploadError('El video no puede superar 16 MB.');
      return;
    }

    clearPendingAttachment();
    setUploadError(null);
    const nextType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
    setPendingAttachmentFile(file);
    setUploadFileType(nextType);
    setUploadFileName(file.name || null);
    setPendingAttachmentPreviewUrl(nextType === 'image' || nextType === 'video' ? URL.createObjectURL(file) : null);
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
    const displayName = lead.name?.trim() || `WhatsApp ${lead.phone}`;
    return (
      <ListItem disablePadding key={lead.id}>
        <ListItemButton
          selected={lead.id === selectedLead?.id}
          onClick={() => {
            void handleSelectLead(lead.id);
          }}
          sx={{
            alignItems: 'flex-start',
            gap: 1,
            px: 1.25,
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
            // El fondo de la fila indica exclusivamente si ES la conversación
            // seleccionada (identidad de lead.id contra selectedLead?.id).
            // La atención/riesgo ya se comunica con el borde izquierdo
            // (borderLeftColor arriba); no debe pintar también el fondo, o
            // varias filas sin relación con la selección se ven "resaltadas"
            // a la vez.
            backgroundColor: lead.id === selectedLead?.id
              ? alpha(theme.palette.primary.main, 0.18)
              : 'background.paper',
            '&:hover': {
              backgroundColor: lead.id === selectedLead?.id
                ? alpha(theme.palette.primary.main, 0.24)
                : 'action.hover',
            },
            '&:hover .lead-row-hover-btn': { opacity: 1 },
          }}
        >
          {/* Avatar puramente visual: iniciales + color determinístico a
              partir del id del lead, sin datos nuevos ni backend. */}
          <Avatar
            sx={{
              width: 30,
              height: 30,
              fontSize: 12,
              fontWeight: 700,
              bgcolor: getLeadAvatarColor(lead.id),
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            {getLeadInitials(lead.name)}
          </Avatar>

          <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
            {/* Línea 1: nombre + tiempo relativo (siempre visible) + Finalizar
                (solo al pasar el mouse, mismo patrón ya usado en las
                burbujas del chat para no ocupar espacio permanente). */}
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {formatMinutesAgo(lead.lastMessageTimeMinutesAgo)}
              </Typography>
              {lead.estado !== 'finalizada' && (
                <Tooltip title="Marcar como finalizada" arrow>
                  <IconButton
                    className="lead-row-hover-btn"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFinalizarDialog(lead.id);
                    }}
                    aria-label="Marcar como finalizada"
                    sx={{
                      color: 'text.disabled',
                      '&:hover': { color: 'text.secondary' },
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      p: 0.25,
                      ml: -0.5,
                    }}
                  >
                    <TaskAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {/* Línea 2: último mensaje */}
            <Typography variant="body2" color="text.secondary" noWrap>
              {lead.lastMessage}
            </Typography>

            {/* Línea 3 (secundaria, compacta): señales de atención primero
                (punto + prioridad), etapa/vendedor al final como
                información menos prioritaria. */}
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ color: 'text.secondary', rowGap: 0.25 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: requiresAttention ? 'error.main' : 'grey.400',
                  flexShrink: 0,
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
              <Chip
                size="small"
                label={computedPriority}
                sx={{
                  height: 16,
                  fontSize: 10,
                  fontWeight: 700,
                  border: '1px solid',
                  '& .MuiChip-label': { px: 0.6 },
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
              {lead.etapa_oportunidad && (
                <Chip
                  size="small"
                  label={lead.etapa_oportunidad}
                  color={etapaChipColor[lead.etapa_oportunidad]}
                  onClick={(e) => handleOpenEtapaMenu(lead.id, e.currentTarget)}
                  clickable
                  sx={{ height: 16, fontSize: 10, textTransform: 'capitalize', fontWeight: 600, '& .MuiChip-label': { px: 0.6 } }}
                />
              )}
              <Typography variant="caption" color="text.disabled" noWrap>
                {ownerLabel}
              </Typography>
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
  const handleSelectLeadMobile = handleSelectLead;

  const handleResendAttachment = React.useCallback((message: ForwardableMessage) => {
    if (!selectedLead || !message.mediaUrl) return;
    void apiFetch('/api/whatsapp/enviar', {
      method: 'POST',
      body: JSON.stringify({ telefono: selectedLead.phone, tipo: message.tipoContenido, media_url: message.mediaUrl, mensaje: message.caption || null }),
    }).then(() => loadMessages(selectedLead.id)).then(() => loadConversations({ incremental: true }));
  }, [selectedLead, loadConversations, loadMessages]);

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
        onLeadScopeChange={handleLeadScopeChange}
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
        setQuickReply={handleQuickReplyChange}
        quickReplyRef={quickReplyRef}
        handleSendWhatsapp={handleSendWhatsapp}
        isSending={isSending}
        sendErrorDialog={sendErrorDialog}
        setSendErrorDialog={setSendErrorDialog}
        handleRetryWhatsappSend={handleRetryWhatsappSend}
        handleReactToMessage={handleReactToMessage}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        selectedTone={selectedTone}
        onChangeTone={handleChangeTone}
      onPreviewTone={handlePreviewTone}
      onResendAttachment={handleResendAttachment}
        notificationVolume={notificationVolume}
        onChangeNotificationVolume={handleChangeNotificationVolume}
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
        isAdmin={isAdmin}
        vendorOptions={vendorOptions}
        vendedorFilterId={vendedorFilterId}
        setVendedorFilterId={setVendedorFilterId}
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
        setSelectedTagIds={setSelectedTagIds}
        tagsSelectOpen={tagsSelectOpen}
        setTagsSelectOpen={setTagsSelectOpen}
        selectedTags={selectedTags}
        opportunityFilter={opportunityFilter}
        setOpportunityFilter={setOpportunityFilter}
        whatsappWindowFilter={whatsappWindowFilter}
        setWhatsappWindowFilter={setWhatsappWindowFilter}
        vistaFinalizadas={vistaFinalizadas}
        setVistaFinalizadas={setVistaFinalizadas}
        selectedContactoId={selectedContactoId}
        selectedContacto={selectedContacto}
        selectedVendedorId={selectedVendedorId}
        isUpdatingOwner={isUpdatingOwner}
        openCompleteContactDialog={openCompleteContactDialog}
        handleOwnerChange={handleOwnerChange}
        updateLead={updateLead}
        conversationTags={conversationTags}
        toggleConversationTag={toggleConversationTag}
        handleOpenTagsMenu={handleOpenTagsMenu}
        selectedLeadPriority={selectedLeadPriority}
        sendSuccess={sendSuccess}
        isSuggesting={isSuggesting}
        handleSuggestMessage={handleSuggestMessage}
        handleSendTemplate={handleSendTemplate}
        handleGenerarCotizacion={handleGenerarCotizacion}
        oportunidadesOpen={oportunidadesOpen}
        setOportunidadesOpen={setOportunidadesOpen}
        isLoadingOportunidades={isLoadingOportunidades}
        oportunidadesError={oportunidadesError}
        oportunidades={oportunidades}
        navigate={navigate}
        motivoFinalizacionLabel={motivoFinalizacionLabel}
        handleOpenFinalizarDialog={handleOpenFinalizarDialog}
        handleReabrirConversacion={handleReabrirConversacion}
        reabrirSavingId={reabrirSavingId}
        tagsMenuAnchor={tagsMenuAnchor}
        handleCloseTagsMenu={handleCloseTagsMenu}
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
        isTemplateDialogOpen={isTemplateDialogOpen}
        setIsTemplateDialogOpen={setIsTemplateDialogOpen}
        handleTemplateSuccess={handleTemplateSuccess}
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
      leadsRecientes={leadsRecientes}
      conversationViewMode={conversationViewMode}
      onConversationViewModeChange={handleConversationViewModeChange}
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
      onLeadScopeChange={handleLeadScopeChange}
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
      whatsappWindowFilter={whatsappWindowFilter}
      setWhatsappWindowFilter={setWhatsappWindowFilter}
      vistaFinalizadas={vistaFinalizadas}
      setVistaFinalizadas={setVistaFinalizadas}
      vendorOptions={vendorOptions}
      renderLeadCard={renderLeadCard}
      onSelectLead={handleSelectLeadMobile}
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
      handleOpenFinalizarDialog={handleOpenFinalizarDialog}
      handleReabrirConversacion={handleReabrirConversacion}
      reabrirSavingId={reabrirSavingId}
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
      handleReactToMessage={handleReactToMessage}
      soundEnabled={soundEnabled}
      onToggleSound={handleToggleSound}
      selectedTone={selectedTone}
      onChangeTone={handleChangeTone}
        onPreviewTone={handlePreviewTone}
        onResendAttachment={handleResendAttachment}
        notificationVolume={notificationVolume}
        onChangeNotificationVolume={handleChangeNotificationVolume}
      uploadInputRef={uploadInputRef}
      handleUploadFile={handleUploadFile}
      handleSelectUpload={handleSelectUpload}
      isRecording={isRecording}
      handleToggleRecording={handleToggleRecording}
      quickReply={quickReply}
      setQuickReply={handleQuickReplyChange}
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
