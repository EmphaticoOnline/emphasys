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
import { apiFetch, buildAuthHeaders } from '../api/apiClient';
import { useSession } from '../session/useSession';
import { SendWhatsappTemplateDialog } from '../components/SendWhatsappTemplateDialog';
import { fetchContactos } from '../services/contactosService';
import type { Contacto } from '../types/contactos.types';
import { actualizarContacto } from '../services/contactos.api';

type Priority = 'Alta' | 'Media' | 'Baja';
type NextAction = 'Responder' | 'Llamar' | 'Enviar cotización' | 'Agendar demo' | 'Cerrar';
type EtapaOportunidad =
  | 'nuevo'
  | 'contactado'
  | 'interesado'
  | 'cotizado'
  | 'negociacion'
  | 'convertida'
  | 'perdida';

type MotivoFinalizacion =
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

type ConversationMessage = {
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

type ReplyPreview = {
  id: string;
  from: 'lead' | 'me';
  preview: string;
};

type OportunidadVenta = {
  id: number;
  folio?: string | null;
  cotizacion_principal_id: number | null;
  serie: string | null;
  numero: number | null;
  estatus: string;
  monto_oportunidad: number | null;
};

type ReglasSeguimiento = {
  tiempo_tolerancia_respuesta_a_cliente: number;
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: number;
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: number;
};

type WhatsappEtiqueta = {
  id: number;
  nombre: string;
  color: string;
};

type LeadStatusType = 'attention' | 'waiting' | 'neutral' | 'active';

type WhatsappSendErrorInfo = {
  codigo: string;
  mensajeUsuario: string;
  accionSugerida: string | null;
  recuperable: boolean;
};

type Lead = {
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

type LeadConPrioridad = Lead & { computedPriority: Priority; seguimientoPendiente: boolean };
type QuickFilter = 'todos' | 'seguimiento' | 'alta' | 'activos';
type OpportunityFilter = 'todos' | 'con' | 'sin';
type LeadScope = 'mis' | 'todos';
type UserRole = { id: number; nombre: string; descripcion?: string | null };
const MANAGE_TAGS_OPTION_VALUE = '__manage_tags__';
const AUDIO_MIME_PREFERENCES = [
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mpeg',
  'audio/webm;codecs=opus',
  'audio/webm',
];
const leadSelectMenuProps = {
  PaperProps: {
    sx: {
      '& .MuiMenuItem-root': {
        fontSize: '0.85rem',
      },
    },
  },
};

const nextActionOptions: NextAction[] = ['Responder', 'Llamar', 'Enviar cotización', 'Agendar demo', 'Cerrar'];
const priorityOptions: Priority[] = ['Alta', 'Media', 'Baja'];
const etapaOptions: EtapaOportunidad[] = ['nuevo', 'contactado', 'interesado', 'cotizado', 'negociacion', 'convertida', 'perdida'];
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
function formatFechaHora(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}
const REFRESH_INTERVAL_MS = 5000;
const DEFAULT_REGLAS_SEGUIMIENTO: ReglasSeguimiento = {
  tiempo_tolerancia_respuesta_a_cliente: 30,
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: 4,
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: 24,
};
const etapaChipColor: Record<EtapaOportunidad, 'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success' | 'error'> = {
  nuevo: 'default',
  contactado: 'info',
  interesado: 'primary',
  cotizado: 'warning',
  negociacion: 'secondary',
  convertida: 'success',
  perdida: 'error',
};

function normalizeEtapaOportunidad(value: unknown): EtapaOportunidad {
  const normalized = String(value ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'contactado':
    case 'interesado':
    case 'cotizado':
    case 'negociacion':
      return normalized;
    case 'convertida':
    case 'ganado':
    case 'ganada':
      return 'convertida';
    case 'perdida':
    case 'perdido':
      return 'perdida';
    case 'nuevo':
    default:
      return 'nuevo';
  }
}

const getIdleSeverity = (min: number): { color: 'default' | 'warning' | 'error'; showIcon: boolean } => {
  if (min > 180) return { color: 'error', showIcon: true };
  if (min >= 60) return { color: 'warning', showIcon: false };
  return { color: 'default', showIcon: false };
};

function formatMinutesAgo(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return `${d}d ${h}h`;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return `${d}d ${h}h`;
}

function renderStatusIcon(status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed') {
  switch (status) {
    case 'sending':
      return <ScheduleIcon fontSize="small" />;
    case 'sent':
      return <DoneIcon fontSize="small" />;
    case 'delivered':
      return <DoneAllIcon fontSize="small" sx={{ color: '#9e9e9e' }} />;
    case 'read':
      return <DoneAllIcon fontSize="small" sx={{ color: '#4fc3f7' }} />;
    case 'failed':
      return <ErrorOutlineIcon fontSize="small" color="error" />;
    default:
      return null;
  }
}

// Traduce la respuesta de error del backend (o un fallo de red del propio
// fetch) a un mensaje comprensible para el usuario. Nunca muestra códigos
// HTTP, JSON crudo ni stack traces en la interfaz.
function buildWhatsappSendErrorInfo(payload: any, isNetworkError: boolean): WhatsappSendErrorInfo {
  if (isNetworkError) {
    return {
      codigo: 'CONEXION_FRONTEND_BACKEND',
      mensajeUsuario: 'No se pudo conectar con el servidor de Emphasys.',
      accionSugerida: 'Verifica tu conexión a internet e intenta nuevamente.',
      recuperable: true,
    };
  }

  if (payload?.codigo && payload?.mensaje_usuario) {
    return {
      codigo: String(payload.codigo),
      mensajeUsuario: String(payload.mensaje_usuario),
      accionSugerida: payload.accion_sugerida ? String(payload.accion_sugerida) : null,
      recuperable: Boolean(payload.recuperable),
    };
  }

  return {
    codigo: 'ERROR_DESCONOCIDO',
    mensajeUsuario: (typeof payload?.message === 'string' && payload.message) || 'No fue posible enviar el mensaje por una causa no identificada.',
    accionSugerida: 'Intenta nuevamente. Si el problema continúa, repórtalo al administrador.',
    recuperable: true,
  };
}

function buildApiUrl(path: string) {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  const trimmedBase = baseUrl?.toString().replace(/\/$/, '') || '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${trimmedBase}${path}`;
  return `${trimmedBase}/${path}`;
}

function minutesSince(dateString: string | null): number {
  if (!dateString) return 0;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function deriveNextAction(hasUnrepliedIncoming: boolean): NextAction {
  return hasUnrepliedIncoming ? 'Responder' : 'Responder';
}

// La ventana de 24h de WhatsApp solo se abre con un mensaje ENTRANTE real del
// cliente (igual que el backend en validateWhatsapp24hWindow). Un mensaje
// saliente, incluida una plantilla, nunca la reabre ni la simula.
function findLastIncomingSentAt(conversation: Lead['conversation']): string | null {
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    const item = conversation[i];
    if (item?.from === 'lead') {
      return item.sentAt ?? null;
    }
  }
  return null;
}

function deriveLeadState(lead: Lead, reglasSeguimiento: ReglasSeguimiento = DEFAULT_REGLAS_SEGUIMIENTO): {
  awaitingResponse: boolean;
  statusLabel: string;
  statusType: LeadStatusType;
  idleMinutes: number;
  priority: Priority;
  nextAction: NextAction;
  within24hWindow: boolean;
  windowExpiresInMinutes: number;
  canSendFreeMessage: boolean;
  requiresTemplate: boolean;
} {
  const lastMessage = lead.conversation[lead.conversation.length - 1];
  const lastFrom = lastMessage?.from ?? null;
  const idleMinutes = minutesSince(lastMessage?.sentAt ?? lead.ultimoMensajeEn);

  let awaitingResponse = lead.awaitingResponse;
  if (lastFrom === 'lead') {
    awaitingResponse = true;
  } else if (lastFrom === 'me') {
    awaitingResponse = false;
  }

  const statusLabel = awaitingResponse ? 'Sin responder' : 'Esperando cliente';
  const statusType: LeadStatusType = awaitingResponse ? 'attention' : 'waiting';
  const toleranciaRespuestaMin = reglasSeguimiento.tiempo_tolerancia_respuesta_a_cliente;
  const seguimientoDespuesRespuestaMin = reglasSeguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente * 60;
  const maxSinRespuestaMin = reglasSeguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente * 60;
  const priority: Priority = awaitingResponse
    ? idleMinutes > toleranciaRespuestaMin
      ? 'Alta'
      : 'Media'
    : idleMinutes > maxSinRespuestaMin
      ? 'Alta'
      : idleMinutes > seguimientoDespuesRespuestaMin
        ? 'Media'
        : 'Baja';
  const nextAction = deriveNextAction(awaitingResponse);
  // Ojo: se basa en el último mensaje ENTRANTE, no en el último mensaje de la
  // conversación. Enviar una plantilla (o cualquier mensaje "me") no reabre
  // la ventana; solo una respuesta real del cliente lo hace.
  const lastIncomingSentAt = findLastIncomingSentAt(lead.conversation);
  const minutesSinceLastIncoming = lastIncomingSentAt ? minutesSince(lastIncomingSentAt) : null;
  const windowExpiresInMinutes = minutesSinceLastIncoming === null ? 0 : Math.max(0, 1440 - minutesSinceLastIncoming);
  const within24hWindow = windowExpiresInMinutes > 0;
  const canSendFreeMessage = within24hWindow;
  const requiresTemplate = !within24hWindow;

  return {
    awaitingResponse,
    statusLabel,
    statusType,
    idleMinutes,
    priority,
    nextAction,
    within24hWindow,
    windowExpiresInMinutes,
    canSendFreeMessage,
    requiresTemplate,
  };
}

function esSeguimientoPendiente(lead: Lead): boolean {
  const etapa = lead.etapa_oportunidad ?? 'nuevo';
  if (etapa === 'convertida' || etapa === 'perdida') return false;

  const last = lead.conversation[lead.conversation.length - 1];
  const lastFrom = last?.from;
  if (lastFrom !== 'lead') return false;

  const minutos = minutesSince(last?.sentAt ?? lead.ultimoMensajeEn);
  const limites: Record<EtapaOportunidad, number> = {
    nuevo: 15,
    contactado: 60,
    interesado: 120,
    cotizado: 360,
    negociacion: 360,
    convertida: Infinity,
    perdida: Infinity,
  };

  const limite = limites[etapa] ?? 120;
  return minutos > limite;
}

const prioridadRank: Record<Priority, number> = { Alta: 2, Media: 1, Baja: 0 };

const getLastTimestampMs = (lead: Lead): number => {
  const last = lead.conversation[lead.conversation.length - 1];
  const ts = last?.sentAt ?? lead.ultimoMensajeEn;
  const d = ts ? new Date(ts).getTime() : 0;
  return Number.isNaN(d) ? 0 : d;
};

const ordenarLeads = (a: LeadConPrioridad, b: LeadConPrioridad): number => {
  // 1) seguimiento pendiente primero
  if (a.seguimientoPendiente !== b.seguimientoPendiente) {
    return a.seguimientoPendiente ? -1 : 1;
  }

  // 2) prioridad alta > media > baja
  const prioDiff = prioridadRank[b.computedPriority] - prioridadRank[a.computedPriority];
  if (prioDiff !== 0) return prioDiff;

  // 3) más reciente primero
  return getLastTimestampMs(b) - getLastTimestampMs(a);
};

const buildLeadOwnerLabel = (
  lead: Lead,
  vendedoresMap: Record<number, Contacto>,
  currentVendedorId: number | null
): string => {
  const vendedorId = lead.vendedor_id ?? null;
  if (vendedorId && currentVendedorId && vendedorId === currentVendedorId) return 'Tú';
  if (vendedorId && vendedoresMap[vendedorId]) return vendedoresMap[vendedorId].nombre;
  return 'Sin asignar';
};

function applyDerivedLeadState(lead: Lead, reglasSeguimiento: ReglasSeguimiento = DEFAULT_REGLAS_SEGUIMIENTO): Lead {
  const derived = deriveLeadState(lead, reglasSeguimiento);
  return {
    ...lead,
    ...derived,
    lastMessageTimeMinutesAgo: derived.idleMinutes,
    hot: derived.priority === 'Alta',
  };
}

const getLatestTimestamp = (messages: ConversationMessage[]): string | null => {
  const last = messages[messages.length - 1];
  return last?.fecha_envio ?? last?.creado_en ?? null;
};

type ConversationView = Lead['conversation'][number];

const filterWhatsappMessages = (messages: ConversationMessage[]): ConversationMessage[] => (
  messages.filter((msg) => msg.canal === 'whatsapp')
);

const getLastWhatsappPreview = (conversation: ConversationView[]): { text: string; sentAt: string | null } | null => {
  const last = conversation[conversation.length - 1];
  if (!last) return null;

  return {
    text: last.text || '',
    sentAt: last.sentAt ?? null,
  };
};

const buildReplyPreviewText = (
  tipoContenido: 'text' | 'image' | 'audio' | 'document',
  contenido: string | null | undefined,
  caption: string | null | undefined
): string => {
  if (tipoContenido === 'image') return caption || 'Foto';
  if (tipoContenido === 'audio') return 'Audio';
  if (tipoContenido === 'document') return caption || 'Documento';
  return contenido || '';
};

const mapMessages = (messages: ConversationMessage[]): ConversationView[] => messages.map((msg) => {
  const sentAt = msg.fecha_envio || msg.creado_en || null;
  const tipoContenido = msg.tipo_contenido ?? 'text';
  let mediaUrl = msg.media_url ?? null;

  if ((tipoContenido === 'image' || tipoContenido === 'audio' || tipoContenido === 'document') && !mediaUrl) {
    mediaUrl = msg.contenido ?? null;
  }

  const replyTo: ReplyPreview | null = msg.mensaje_respuesta_id
    ? {
      id: String(msg.mensaje_respuesta_id),
      from: msg.respuesta_tipo_mensaje === 'entrante' ? 'lead' : 'me',
      preview: buildReplyPreviewText(msg.respuesta_tipo_contenido ?? 'text', msg.respuesta_contenido, msg.respuesta_caption),
    }
    : null;

  return {
    id: msg.id,
    from: msg.tipo_mensaje === 'entrante' ? 'lead' : 'me',
    text: (tipoContenido === 'image' || tipoContenido === 'audio' || tipoContenido === 'document')
      ? ''
      : (msg.contenido || ''),
    minutesAgo: minutesSince(sentAt),
    sentAt,
    tipoContenido,
    mediaUrl,
    caption: msg.caption ?? null,
    status: ((msg.status || '').toLowerCase().trim() as 'sending' | 'sent' | 'delivered' | 'read' | 'failed') || 'sent',
    replyTo,
  } as ConversationView;
});

export default function LeadsPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>('');
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [quickReply, setQuickReply] = React.useState('');
  const [replyingTo, setReplyingTo] = React.useState<ReplyPreview | null>(null);
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
  const leadFilterSelectSx = {
    flex: 1,
    minWidth: 220,
    '& .MuiInputLabel-root': {
      fontSize: 16,
    },
    '& .MuiOutlinedInput-root': {
      minHeight: 40,
      fontSize: 16,
    },
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      fontSize: 16,
      paddingTop: '8.5px',
      paddingBottom: '8.5px',
      paddingLeft: '14px',
      paddingRight: '32px',
      boxSizing: 'border-box',
    },
  } as const;

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

      const params = new URLSearchParams();
      if (incremental && lastConversationsFetchRef.current) {
        params.set('since', lastConversationsFetchRef.current);
      }
      if (vendedorFiltro) {
        params.set('vendedor_id', String(vendedorFiltro));
      }
      if (selectedTagIds.length > 0) {
        params.set('tag_ids', selectedTagIds.join(','));
      }
      if (vistaFinalizadas) {
        params.set('estado', 'finalizada');
      }
      if (debouncedSearchTerm) {
        params.set('search', debouncedSearchTerm);
      }

      const queryString = params.toString();
      const response = await apiFetch(`/api/whatsapp/conversaciones${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) {
        throw new Error('Error al obtener conversaciones');
      }
      const data: ConversationSummary[] = await response.json();
      console.log('[LeadsPage] loadConversations response', {
        incremental,
        count: data.length,
        queryString,
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
      const sinceParam = since ? `?since=${encodeURIComponent(since)}` : '';
      const response = await apiFetch(`/api/whatsapp/conversacion/${conversationId}${sinceParam}`);
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
        sinceParam,
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

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const preferredMimeType = AUDIO_MIME_PREFERENCES.find((type) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
      );

      if (!preferredMimeType) {
        setUploadError('Tu navegador no soporta grabación de audio en formatos compatibles.');
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType: preferredMimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // El audio grabado se queda en memoria como File pendiente; la
        // subida a /api/uploads solo ocurre al presionar enviar, igual que
        // con imágenes y documentos.
        clearPendingAttachment();

        const blob = new Blob(audioChunksRef.current, { type: preferredMimeType });
        const previewUrl = URL.createObjectURL(blob);
        const extension = preferredMimeType.includes('ogg')
          ? 'ogg'
          : preferredMimeType.includes('mpeg')
            ? 'mp3'
            : 'webm';
        const filename = `audio-${Date.now()}.${extension}`;
        const audioFile = new File([blob], filename, { type: preferredMimeType });

        setUploadError(null);
        setPendingAttachmentFile(audioFile);
        setUploadFileType('audio');
        setUploadFileName(filename);
        setRecordedAudioUrl(previewUrl);
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordedAudioUrl(null);
      setIsRecording(true);
    } catch (error) {
      console.error('Error al iniciar grabación de audio:', error);
      setIsRecording(false);
    }
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

  return (
    <>
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Menu
        anchorEl={etapaMenu?.anchorEl ?? null}
        open={Boolean(etapaMenu)}
        onClose={handleCloseEtapaMenu}
        MenuListProps={{ dense: true }}
      >
        {etapaOptions.map((etapa) => (
          <MenuItem
            key={etapa}
            selected={etapaMenuLead?.etapa_oportunidad === etapa}
            onClick={() => handleSelectEtapa(etapa)}
            sx={{ textTransform: 'capitalize' }}
          >
            {etapa}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={tagsMenuAnchor}
        open={Boolean(tagsMenuAnchor)}
        onClose={handleCloseTagsMenu}
        MenuListProps={{ dense: true }}
      >
        {availableTags.length === 0 ? (
          <MenuItem disabled>Sin etiquetas disponibles</MenuItem>
        ) : availableTags.map((tag) => {
          const isAssigned = conversationTags.some((t) => t.id === tag.id);
          return (
            <MenuItem
              key={tag.id}
              selected={isAssigned}
              onClick={() => toggleConversationTag(tag)}
              sx={{ gap: 1 }}
            >
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: tag.color }} />
              <Typography variant="body2" fontWeight={600}>
                {tag.nombre}
              </Typography>
            </MenuItem>
          );
        })}
        {isCreatingTag ? (
          <Box
            sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 220 }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TextField
              size="small"
              label="Nombre"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <TextField
              size="small"
              label="Color"
              type="color"
              value={newTagColor}
              onChange={(event) => setNewTagColor(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: 140 }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="text" onClick={handleCancelCreateTag}>
                Cancelar
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveNewTag}
                disabled={!newTagName.trim() || !/^#([0-9A-Fa-f]{6})$/.test(newTagColor.trim())}
              >
                Guardar
              </Button>
            </Stack>
          </Box>
        ) : (
          <MenuItem onClick={handleStartCreateTag}>
            <Typography variant="body2" fontWeight={600}>
              ➕ Crear nueva etiqueta
            </Typography>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={manageTagsOpen} onClose={handleCloseManageTags} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocalOfferIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Administrar etiquetas
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleCloseManageTags} aria-label="Cerrar">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {tagActionError && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setTagActionError(null)}>
              {tagActionError}
            </Alert>
          )}

          <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto', mb: 1.5, pr: 0.5 }}>
            {availableTags.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Aún no hay etiquetas. Crea la primera abajo.
              </Typography>
            ) : availableTags.map((tag) => (
              <Stack
                key={tag.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tag.color, flexShrink: 0 }} />
                <Chip
                  size="small"
                  label={tag.nombre}
                  sx={{
                    bgcolor: `${tag.color}22`,
                    color: 'text.primary',
                    fontWeight: 600,
                    maxWidth: 160,
                  }}
                />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => handleOpenEditTagForm(tag)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Desactivar">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleDeactivateTag(tag)}
                      disabled={tagDeactivatingId === tag.id}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {tagFormOpen ? (
            <Stack spacing={1.25}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {tagFormId == null ? 'Nueva etiqueta' : 'Editar etiqueta'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextField
                  size="small"
                  label="Nombre"
                  value={tagFormName}
                  onChange={(event) => setTagFormName(event.target.value)}
                  fullWidth
                  autoFocus
                />
                <TextField
                  size="small"
                  label="Color"
                  type="color"
                  value={tagFormColor}
                  onChange={(event) => setTagFormColor(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 88 }}
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Vista previa:
                </Typography>
                <Chip
                  size="small"
                  label={tagFormName.trim() || 'Nombre de etiqueta'}
                  sx={{ bgcolor: `${tagFormColor}22`, color: 'text.primary', fontWeight: 600 }}
                />
              </Stack>
              {tagFormError && (
                <Typography variant="caption" color="error">
                  {tagFormError}
                </Typography>
              )}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={handleCancelTagForm} disabled={tagFormSaving}>
                  Cancelar
                </Button>
                <Button size="small" variant="contained" onClick={handleSubmitTagForm} disabled={tagFormSaving}>
                  {tagFormId == null ? 'Guardar etiqueta' : 'Guardar cambios'}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Button size="small" startIcon={<AddIcon />} onClick={handleOpenCreateTagForm}>
              Nueva etiqueta
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          Leads
        </Typography>
        <Chip label="MVP operativo" color="primary" variant="outlined" />
        <Tooltip title="Guía de ayuda">
          <IconButton
            aria-label="Abrir guía de ayuda"
            size="small"
            onClick={() => window.open('/docs/guia-leads.html', '_blank')}
            sx={{ color: '#64748b' }}
          >
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip label={`Urgentes: ${urgentLeads.length}`} color={urgentLeads.length ? 'error' : 'default'} variant={urgentLeads.length ? 'filled' : 'outlined'} />
        <Chip label={`En seguimiento: ${followUpLeads.length}`} color={followUpLeads.length ? 'warning' : 'default'} variant={followUpLeads.length ? 'filled' : 'outlined'} />
        <Chip label={`Nuevos: ${newLeads.length}`} color={newLeads.length ? 'primary' : 'default'} variant={newLeads.length ? 'filled' : 'outlined'} />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 1.1fr' },
          gap: 2,
          minHeight: '70vh',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 72,
            }}
          >
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Lista de leads
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Agrupados por urgencia. Ajusta prioridad y siguiente acción en línea.
              </Typography>
            </Stack>
            <Chip label={`${leadsFiltradosOrdenados.length} visibles`} size="small" sx={{ ml: 1.5, flexShrink: 0 }} />
          </Box>

          <TextField
            size="small"
            placeholder="Buscar por nombre, teléfono o mensajes"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            fullWidth
            InputProps={{
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearchTerm('')}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {isAdmin && (
              <TextField
                select
                size="small"
                label="Vendedor"
                value={vendedorFilterId ? String(vendedorFilterId) : ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setVendedorFilterId(value ? Number(value) : null);
                }}
                SelectProps={{ MenuProps: leadSelectMenuProps }}
                sx={leadFilterSelectSx}
                disabled={leadScope === 'mis'}
              >
                <MenuItem value="">Todos los vendedores</MenuItem>
                {vendorOptions.map((v) => (
                  <MenuItem key={v.id} value={String(v.id)}>
                    {v.nombre}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              size="small"
              value={selectedTagIds}
              onChange={(event) => {
                const value = event.target.value;
                const rawValues = Array.isArray(value)
                  ? value
                  : typeof value === 'string'
                    ? value.split(',')
                    : [];

                if (rawValues.includes(MANAGE_TAGS_OPTION_VALUE)) {
                  setTagsSelectOpen(false);
                  handleOpenManageTags();
                  return;
                }

                const nextValues = rawValues.map((item) => Number(item)).filter((item) => Number.isFinite(item));
                setSelectedTagIds(nextValues);
              }}
              SelectProps={{
                multiple: true,
                displayEmpty: true,
                open: tagsSelectOpen,
                onOpen: () => setTagsSelectOpen(true),
                onClose: () => setTagsSelectOpen(false),
                renderValue: () => (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {selectedTags.length ? selectedTags.map((tag) => (
                      <Chip
                        key={tag.id}
                        size="small"
                        label={tag.nombre}
                        sx={{ bgcolor: `${tag.color}22`, color: 'text.primary' }}
                      />
                    )) : (
                      <Typography variant="caption" color="text.secondary">
                        Etiquetas
                      </Typography>
                    )}
                  </Stack>
                ),
                MenuProps: leadSelectMenuProps,
              }}
              inputProps={{ 'aria-label': 'Etiquetas' }}
              sx={leadFilterSelectSx}
            >
              {availableTags.length === 0 ? (
                <MenuItem value="" disabled>
                  Sin etiquetas disponibles
                </MenuItem>
              ) : availableTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tag.color }} />
                    <Typography variant="body2" fontWeight={600}>
                      {tag.nombre}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem value={MANAGE_TAGS_OPTION_VALUE} sx={{ color: 'primary.main' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SettingsIcon fontSize="small" />
                  <Typography variant="body2" fontWeight={600}>
                    Administrar etiquetas
                  </Typography>
                </Stack>
              </MenuItem>
            </TextField>
            {isAdmin && leadScope === 'mis' && (
              <Typography variant="caption" color="text.secondary">
                Cambia a “Todos” para filtrar por vendedor.
              </Typography>
            )}
          </Box>

          {shouldShowScopeChipGroup && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {showMisChip && (
                <Chip
                  label="Mis leads"
                  color={leadScope === 'mis' ? 'primary' : 'default'}
                  variant={leadScope === 'mis' ? 'filled' : 'outlined'}
                  onClick={canToggleScope ? () => {
                    setLeadScope('mis');
                    setScopeTouched(true);
                  } : undefined}
                  sx={{ fontWeight: 700 }}
                />
              )}
              {showTodosChip && (
                <Chip
                  label="Todos"
                  color={leadScope === 'todos' ? 'primary' : 'default'}
                  variant={leadScope === 'todos' ? 'filled' : 'outlined'}
                  onClick={canToggleScope ? () => {
                    setLeadScope('todos');
                    setScopeTouched(true);
                  } : undefined}
                  sx={{ fontWeight: 700 }}
                />
              )}
            </Stack>
          )}

          {showQuickFilterChips && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(
                [
                  { key: 'todos', label: 'Todos' },
                  { key: 'seguimiento', label: 'Seguimiento pendiente' },
                  { key: 'alta', label: 'Alta prioridad' },
                  { key: 'activos', label: 'Activos' },
                ] as const
              ).map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  color={leadFilter === opt.key ? 'primary' : 'default'}
                  variant={leadFilter === opt.key ? 'filled' : 'outlined'}
                  onClick={() => setLeadFilter(opt.key)}
                  sx={{ fontWeight: 700 }}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(
              [
                { key: 'todos', label: 'Todos' },
                { key: 'con', label: 'Con oportunidad' },
                { key: 'sin', label: 'Sin oportunidad' },
              ] as const
            ).map((opt) => (
              <Chip
                key={opt.key}
                label={opt.label}
                color="default"
                variant={opportunityFilter === opt.key ? 'filled' : 'outlined'}
                onClick={() => setOpportunityFilter(opt.key)}
                sx={{
                  fontWeight: 700,
                  color: opportunityFilter === opt.key ? '#ffffff' : '#0f766e',
                  backgroundColor: opportunityFilter === opt.key ? '#0f766e' : '#f0fdfa',
                  borderColor: '#99f6e4',
                  '&.MuiChip-filled': {
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                  },
                  '&.MuiChip-outlined': {
                    backgroundColor: '#f0fdfa',
                    color: '#0f766e',
                    borderColor: '#99f6e4',
                  },
                  '&:hover': {
                    backgroundColor: opportunityFilter === opt.key ? '#115e59' : '#ccfbf1',
                  },
                }}
              />
            ))}
            <Chip
              label="Finalizadas"
              onClick={() => setVistaFinalizadas((prev) => !prev)}
              sx={{
                fontWeight: 700,
                color: vistaFinalizadas ? '#ffffff' : 'text.secondary',
                backgroundColor: vistaFinalizadas ? 'text.secondary' : 'transparent',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Stack>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="h6" fontWeight={700}>
              {vistaFinalizadas ? 'Conversaciones finalizadas' : 'Leads abiertos'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
              <AccessTimeIcon fontSize="small" />
              {vistaFinalizadas ? (
                <Typography variant="body2">Finalizadas: {leadsFiltradosOrdenados.length}</Typography>
              ) : (
                <>
                  <Typography variant="body2">Riesgo: {leadsRiesgo.length}</Typography>
                  <Typography variant="body2" color="text.disabled">· Seguimiento: {leadsSeguimiento.length}</Typography>
                  <Typography variant="body2" color="text.disabled">· Actividad reciente: {leadsActividad.length}</Typography>
                  <Typography variant="body2" color="text.disabled">· Visibles: {leadsFiltradosOrdenados.length}</Typography>
                </>
              )}
            </Stack>
          </Box>

          {/* Columna central: lista de leads */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
            <Stack spacing={1.5} sx={{ overflow: 'auto', pr: 0.5 }}>
              {leadsFiltradosOrdenados.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                  {vistaFinalizadas ? 'No hay conversaciones finalizadas.' : 'No hay más leads en cola.'}
                </Typography>
              ) : vistaFinalizadas ? (
                <List disablePadding>
                  {leadsFiltradosOrdenados.map(renderLeadCard)}
                </List>
              ) : (
                <>
                  {leadsRiesgo.length > 0 && (
                    <Stack spacing={0.5}>
                      <Tooltip title={riesgoTooltip} arrow>
                        <Typography variant="subtitle2" fontWeight={700} color="error.main" sx={{ px: 1 }}>
                          🔴 Riesgo de perder
                        </Typography>
                      </Tooltip>
                      <List disablePadding>
                        {leadsRiesgo.map(renderLeadCard)}
                      </List>
                    </Stack>
                  )}

                  {leadsRiesgo.length > 0 && (leadsSeguimiento.length > 0 || leadsActividad.length > 0) && <Divider />}

                  {leadsSeguimiento.length > 0 && (
                    <Stack spacing={0.5}>
                      <Tooltip title={seguimientoTooltip} arrow>
                        <Typography variant="subtitle2" fontWeight={700} color="warning.main" sx={{ px: 1 }}>
                          🟡 Requiere seguimiento
                        </Typography>
                      </Tooltip>
                      <List disablePadding>
                        {leadsSeguimiento.map(renderLeadCard)}
                      </List>
                    </Stack>
                  )}

                  {leadsSeguimiento.length > 0 && leadsActividad.length > 0 && <Divider />}

                  {leadsActividad.length > 0 && (
                    <Stack spacing={0.5}>
                      <Tooltip title={actividadTooltip} arrow>
                        <Typography variant="subtitle2" fontWeight={700} color="success.main" sx={{ px: 1 }}>
                          🟢 Actividad reciente
                        </Typography>
                      </Tooltip>
                      <List disablePadding>
                        {leadsActividad.map(renderLeadCard)}
                      </List>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 72,
            }}
          >
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Detalle del lead
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Seguimiento, contexto y acciones del lead seleccionado.
              </Typography>
            </Stack>
            <Chip label="Seleccionado" size="small" variant="outlined" sx={{ ml: 1.5, flexShrink: 0 }} />
          </Box>

          {/* Columna derecha: detalle del lead */}
          {selectedLead ? (
            <>
            <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
              <Box>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={700}>
                    {selectedLead.name}
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={openCompleteContactDialog}
                    disabled={!selectedContactoId}
                    sx={{ textTransform: 'none', color: 'text.secondary', px: 0.5, minWidth: 'auto' }}
                  >
                    Editar datos
                  </Button>
                </Stack>
                <Stack spacing={0.35} sx={{ color: 'text.secondary' }}>
                  {isAdmin ? (
                    <TextField
                      select
                      size="small"
                      label="Asignado a"
                      value={selectedVendedorId ? String(selectedVendedorId) : ''}
                      onChange={(e) => handleOwnerChange(e.target.value)}
                      disabled={isUpdatingOwner || !selectedContactoId}
                      SelectProps={{ MenuProps: leadSelectMenuProps }}
                      sx={{ maxWidth: 240 }}
                      helperText={isUpdatingOwner ? 'Actualizando…' : undefined}
                    >
                      <MenuItem value="">
                        Sin asignar
                      </MenuItem>
                      {vendorOptions.map((v) => (
                        <MenuItem key={v.id} value={String(v.id)}>
                          {v.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Asignado a: {buildLeadOwnerLabel(selectedLead, vendedoresById, vendedorContactoId)}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                    {conversationTags.map((tag) => (
                      <Chip
                        key={tag.id}
                        size="small"
                        label={tag.nombre}
                        onDelete={() => toggleConversationTag(tag)}
                        sx={{
                          bgcolor: tag.color,
                          color: '#fff',
                          fontWeight: 500,
                          height: 24,
                          mr: 0.5,
                          '& .MuiChip-deleteIcon': { color: '#fff' },
                        }}
                      />
                    ))}
                    <IconButton
                      size="small"
                      onClick={handleOpenTagsMenu}
                      aria-label="Agregar etiqueta"
                      sx={{ border: '1px dashed', borderColor: 'divider' }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <PersonIcon fontSize="small" />
                    <Typography variant="body2">{selectedLead.owner}</Typography>
                    {selectedLead.seguimientoPendiente && (
                      <Chip
                        size="small"
                        label="Seguimiento pendiente"
                        color="warning"
                        variant="filled"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{
                        color: selectedLead.statusType === 'attention'
                          ? 'error.main'
                          : selectedLead.statusType === 'waiting'
                            ? 'text.secondary'
                            : 'text.primary',
                      }}
                    >
                      {selectedLead.statusLabel}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" fontWeight={600}>
                      · {formatMinutesAgo(selectedLead.idleMinutes)}
                    </Typography>
                    <Chip
                      size="small"
                      label={selectedLead.priority}
                      sx={{
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor: selectedLead.priority === 'Alta'
                          ? 'error.light'
                          : selectedLead.priority === 'Media'
                            ? 'warning.light'
                            : 'grey.200',
                        color: selectedLead.priority === 'Alta'
                          ? 'error.dark'
                          : selectedLead.priority === 'Media'
                            ? '#7c5a00'
                            : 'grey.700',
                        bgcolor: selectedLead.priority === 'Alta'
                          ? 'error.light + 14'
                          : selectedLead.priority === 'Media'
                            ? 'warning.light + 16'
                            : 'grey.100',
                      }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      👉 {selectedLead.statusType === 'attention' ? 'Responder ahora' : 'Esperar respuesta del cliente'}
                    </Typography>
                  </Stack>
                  {(() => {
                    const expiresIn = selectedLead.windowExpiresInMinutes;
                    const windowState = selectedLead.requiresTemplate || expiresIn <= 0
                      ? 'closed'
                      : selectedLead.within24hWindow
                      ? expiresIn <= 120
                        ? 'warning'
                        : 'open'
                      : 'closed';
                    const windowLabel = windowState === 'closed'
                      ? 'Ventana cerrada · requiere plantilla'
                      : windowState === 'warning'
                        ? `Expira pronto · ${formatMinutes(expiresIn)} restantes`
                        : `Ventana abierta · expira en ${formatMinutes(expiresIn)}`;
                    const windowColor = windowState === 'closed'
                      ? 'error.main'
                      : windowState === 'warning'
                        ? 'warning.main'
                        : 'success.main';
                    const windowDot = windowState === 'closed' ? '🔴' : windowState === 'warning' ? '🟡' : '🟢';

                    return (
                      <Typography variant="caption" sx={{ color: windowColor, fontWeight: 600 }}>
                        {windowDot} {windowLabel}
                      </Typography>
                    );
                  })()}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {selectedLead.hot && <WhatshotIcon color="error" fontSize="small" titleAccess="Lead caliente" />}
              </Stack>
            </Stack>

            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
              <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: '#f8fafc' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }} flexWrap="wrap" useFlexGap>
                  <TextField
                    select
                    size="small"
                    label="Acción recomendada"
                    value={selectedLead.nextAction}
                    onChange={(e) => updateLead(selectedLead.id, { nextAction: e.target.value as NextAction })}
                    color="primary"
                    SelectProps={{ MenuProps: leadSelectMenuProps }}
                    sx={{
                      flex: '1 1 240px',
                      minWidth: 0,
                      '& .MuiInputBase-input': { fontWeight: 700, fontSize: '0.85rem' },
                      '& .MuiInputLabel-root': { fontWeight: 700, fontSize: '0.85rem' },
                    }}
                  >
                    {nextActionOptions.map((a) => (
                      <MenuItem key={a} value={a}>
                        {a}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Prioridad"
                    value={selectedLeadPriority}
                    onChange={(e) => updateLead(selectedLead.id, { priority: e.target.value as Priority })}
                    SelectProps={{ MenuProps: leadSelectMenuProps }}
                    sx={{
                      flex: '0 1 140px',
                      minWidth: 0,
                      '& .MuiInputBase-input': { color: 'text.secondary', fontSize: '0.85rem' },
                      '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.85rem' },
                    }}
                  >
                    {priorityOptions.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Tooltip
                      arrow
                      disableHoverListener={!selectedLead.requiresTemplate}
                      title={(
                        <Box sx={{ maxWidth: 280 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                            No puedes enviar un mensaje libre porque han pasado más de 24 horas desde el último mensaje del cliente.
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 0.75 }}>
                            Puedes enviar una plantilla autorizada, pero debes esperar a que el cliente responda antes de continuar con mensajes normales.
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            👉 Usa el botón “Enviar plantilla”.
                          </Typography>
                        </Box>
                      )}
                    >
                      <span>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<ReplyIcon />}
                          onClick={() => handleSendWhatsapp()}
                          disabled={isSending || selectedLead.requiresTemplate}
                          sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                        >
                          {isSending ? 'Enviando…' : sendSuccess ? 'Enviado ✓' : 'Escribir en el chat'}
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={handleSuggestMessage}
                      disabled={isSuggesting}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      {isSuggesting ? 'Generando…' : '✨ Sugerir mensaje'}
                    </Button>
                    <Button
                      variant={selectedLead.requiresTemplate ? 'contained' : 'outlined'}
                      color={selectedLead.requiresTemplate ? 'warning' : 'inherit'}
                      size="small"
                      startIcon={<DescriptionIcon />}
                      onClick={handleSendTemplate}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      Enviar plantilla
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DescriptionIcon />}
                      onClick={handleGenerarCotizacion}
                      disabled={!selectedContactoId}
                      sx={{ textTransform: 'none', px: 1.5, whiteSpace: 'nowrap' }}
                    >
                      Generar cotización
                    </Button>
                  </Stack>
                  {selectedLead.estado === 'finalizada' && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Finalizada el {formatFechaHora(selectedLead.finalizada_en)}
                      {selectedLead.motivo_finalizacion ? ` · Motivo: ${motivoFinalizacionLabel[selectedLead.motivo_finalizacion]}` : ''}
                      {selectedLead.observaciones_finalizacion ? ` · ${selectedLead.observaciones_finalizacion}` : ''}
                      {' · Usa "Reabrir" desde la conversación en la lista para reactivarla.'}
                    </Alert>
                  )}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Oportunidades
                  </Typography>
                  <Button size="small" variant="text" onClick={() => setOportunidadesOpen((prev) => !prev)}>
                    {oportunidadesOpen ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </Stack>

                {oportunidadesOpen && (
                  <Stack spacing={1} sx={{ mt: 1.25 }}>
                    {isLoadingOportunidades && (
                      <Typography variant="body2" color="text.secondary">
                        Cargando oportunidades...
                      </Typography>
                    )}

                    {!isLoadingOportunidades && oportunidadesError && (
                      <Alert severity="error">{oportunidadesError}</Alert>
                    )}

                    {!isLoadingOportunidades && !oportunidadesError && oportunidades.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Sin oportunidades asociadas.
                      </Typography>
                    )}

                    {!isLoadingOportunidades && !oportunidadesError && oportunidades.map((oportunidad) => {
                      const cotizacionPrincipalId = oportunidad.cotizacion_principal_id;
                      const folio = oportunidad.folio
                        ?? (oportunidad.serie && oportunidad.numero != null
                          ? `${oportunidad.serie}-${oportunidad.numero}`
                          : oportunidad.serie
                            ? oportunidad.serie
                            : oportunidad.numero != null
                              ? String(oportunidad.numero)
                              : 'Sin folio');

                      return (
                        <Box
                          key={oportunidad.id}
                          onClick={() => {
                            if (!cotizacionPrincipalId) return;
                            navigate(`/ventas/cotizacion/${cotizacionPrincipalId}`);
                          }}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            px: 1.25,
                            py: 1,
                            cursor: cotizacionPrincipalId ? 'pointer' : 'default',
                            transition: 'background-color 0.15s ease, border-color 0.15s ease',
                            '&:hover': cotizacionPrincipalId
                              ? {
                                  backgroundColor: 'action.hover',
                                  borderColor: 'primary.main',
                                }
                              : undefined,
                          }}
                        >
                          <Typography variant="body2" fontWeight={700}>
                            Folio: {folio}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Estatus: {oportunidad.estatus}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Monto oportunidad: {Number(oportunidad.monto_oportunidad ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              <SendWhatsappTemplateDialog
                open={isTemplateDialogOpen}
                onClose={() => setIsTemplateDialogOpen(false)}
                telefono={selectedLead.phone ?? ''}
                contacto={{
                  nombre: selectedContacto?.nombre || selectedLead.name || null,
                  telefono: selectedLead.phone || null,
                  empresa: selectedContacto?.zona || null,
                }}
                onSuccess={handleTemplateSuccess}
              />

              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Último mensaje
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="body1">{selectedLead.lastMessage}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hace {formatMinutesAgo(selectedLead.lastMessageTimeMinutesAgo)}
                  </Typography>
                </Paper>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notas
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.25, minHeight: 80 }}>
                  <Typography variant="body2" color="text.disabled">
                    Añade notas rápidas sobre el lead.
                  </Typography>
                </Paper>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Conversación
                </Typography>
                <Paper
                  variant="outlined"
                  ref={conversationScrollRef}
                  sx={{ p: 1.25, maxHeight: '50vh', minHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}
                >
                  {selectedLead.conversation.map((msg) => {
                    const replyButton = (
                      <IconButton
                        className="reply-hover-btn"
                        size="small"
                        aria-label="Responder mensaje"
                        onClick={() => {
                          setReplyingTo({
                            id: msg.id,
                            from: msg.from,
                            preview: msg.text || buildReplyPreviewText(msg.tipoContenido ?? 'text', msg.text, msg.caption),
                          });
                          focusReplyInput();
                        }}
                        sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.5 }}
                      >
                        <ReplyIcon fontSize="small" />
                      </IconButton>
                    );

                    const bubble = (
                      <Box
                        sx={{
                          maxWidth: '75%',
                          px: 1.25,
                          py: 0.75,
                          borderRadius: 1.5,
                          bgcolor: msg.from === 'me' ? 'primary.main' : 'grey.100',
                          color: msg.from === 'me' ? 'primary.contrastText' : 'text.primary',
                        }}
                      >
                        {msg.replyTo && (
                          <Box
                            sx={{
                              borderLeft: '3px solid',
                              borderColor: msg.from === 'me' ? 'rgba(255,255,255,0.6)' : 'primary.main',
                              bgcolor: msg.from === 'me' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)',
                              borderRadius: 1,
                              px: 1,
                              py: 0.5,
                              mb: 0.5,
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', opacity: 0.9 }}>
                              {msg.replyTo.from === 'me' ? 'Tú' : (selectedLead.name || 'Contacto')}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                opacity: 0.8,
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {msg.replyTo.preview}
                            </Typography>
                          </Box>
                        )}
                        {msg.tipoContenido === 'image' && msg.mediaUrl && (
                          <Box
                            component="a"
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'block' }}
                          >
                            <Box
                              component="img"
                              src={msg.mediaUrl}
                              alt="Imagen enviada"
                              sx={{
                                display: 'block',
                                maxWidth: 250,
                                maxHeight: 250,
                                borderRadius: 1,
                                mb: msg.text ? 0.5 : 0,
                              }}
                            />
                          </Box>
                        )}
                        {(msg.tipoContenido === 'image' || msg.tipoContenido === 'audio' || msg.tipoContenido === 'document') && !msg.mediaUrl && (
                          <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.85 }}>
                            {msg.caption || 'Archivo recibido'}
                          </Typography>
                        )}
                        {msg.tipoContenido === 'document' && msg.mediaUrl && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <DescriptionIcon fontSize="small" />
                            <Typography
                              variant="body2"
                              component="a"
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: 'inherit', textDecoration: 'none' }}
                            >
                              {msg.caption || 'Documento adjunto'}
                            </Typography>
                          </Stack>
                        )}
                        {msg.tipoContenido === 'audio' && msg.mediaUrl && (
                          <Box
                            component="audio"
                            controls
                            src={msg.mediaUrl}
                            sx={{ maxWidth: 250 }}
                          />
                        )}
                        {msg.tipoContenido === 'image' && msg.caption && (
                          <Typography variant="body2">{msg.caption}</Typography>
                        )}
                        {msg.text && <Typography variant="body2">{msg.text}</Typography>}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ opacity: 0.75 }}>
                            {formatMinutesAgo(msg.minutesAgo)}
                          </Typography>
                          {msg.from === 'me' && msg.status && msg.status !== 'failed' && (
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              {renderStatusIcon(msg.status)}
                            </Typography>
                          )}
                          {msg.from === 'me' && msg.status === 'failed' && (
                            <Stack direction="row" spacing={0.25} alignItems="center">
                              <Tooltip
                                arrow
                                title={(
                                  <Box sx={{ maxWidth: 260 }}>
                                    <Typography variant="body2">
                                      {msg.errorInfo?.mensajeUsuario || 'No se pudo enviar el mensaje.'}
                                    </Typography>
                                    {msg.errorInfo?.accionSugerida && (
                                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                        {msg.errorInfo.accionSugerida}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              >
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                                  {renderStatusIcon(msg.status)}
                                </Typography>
                              </Tooltip>
                              {msg.errorInfo?.recuperable && msg.tempId && (
                                <Tooltip arrow title="Reintentar envío">
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={isSending}
                                      onClick={() => handleRetryWhatsappSend(selectedLead.id, msg.tempId as string)}
                                      sx={{ p: 0.25 }}
                                    >
                                      <ReplayIcon fontSize="inherit" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </Stack>
                          )}
                        </Box>
                      </Box>
                    );

                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start',
                          alignItems: 'center',
                          gap: 0.25,
                          '&:hover .reply-hover-btn': { opacity: 1 },
                        }}
                      >
                        {msg.from === 'me' ? (
                          <>
                            {replyButton}
                            {bubble}
                          </>
                        ) : (
                          <>
                            {bubble}
                            {replyButton}
                          </>
                        )}
                      </Box>
                    );
                  })}
                  <Box ref={conversationEndRef} />
                </Paper>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                {replyingTo && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      mb: 1,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: 'grey.100',
                      borderLeft: '3px solid',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                        {replyingTo.from === 'me' ? 'Tú' : (selectedLead.name || 'Contacto')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {replyingTo.preview}
                      </Typography>
                    </Box>
                    <IconButton size="small" aria-label="Cancelar respuesta" onClick={() => setReplyingTo(null)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
                <Box component="form" onSubmit={handleSendWhatsapp}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      onChange={handleUploadFile}
                    />
                    <IconButton
                      color="primary"
                      aria-label="Adjuntar imagen"
                      onClick={handleSelectUpload}
                      disabled={isSending}
                    >
                      <AttachFileIcon />
                    </IconButton>
                    <IconButton
                      color={isRecording ? "error" : "primary"}
                      aria-label="Grabar audio"
                      onClick={handleToggleRecording}
                      disabled={isSending}
                    >
                      🎤
                    </IconButton>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={1}
                      maxRows={3}
                      placeholder="Escribe una respuesta rápida"
                      value={quickReply}
                      onChange={(e) => setQuickReply(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (isSending) return;
                          handleSendWhatsapp();
                        }
                      }}
                      inputRef={quickReplyRef}
                      inputProps={{ onPaste: handleQuickReplyPaste }}
                    />
                    <Tooltip
                      arrow
                      disableHoverListener={!selectedLead.requiresTemplate}
                      title="La ventana de atención está cerrada. Envía una plantilla y espera la respuesta del cliente."
                    >
                      <span>
                        <IconButton
                          color="primary"
                          aria-label="Enviar"
                          type="submit"
                          disabled={isSending || isUploadingImage}
                        >
                          <SendIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {isUploadingImage && (
                      <Typography variant="caption" color="text.secondary">
                        {uploadFileType === 'audio' ? 'Subiendo audio...' : 'Subiendo imagen...'}
                      </Typography>
                    )}
                    {uploadError && (
                      <Typography variant="caption" color="error">
                        {uploadError}
                      </Typography>
                    )}
                    {pendingAttachmentFile && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          {uploadFileType === 'document' && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <DescriptionIcon fontSize="small" />
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {uploadFileName || 'Documento adjunto'}
                              </Typography>
                            </Stack>
                          )}
                          {uploadFileType === 'image' && pendingAttachmentPreviewUrl && (
                            <Box
                              component="img"
                              src={pendingAttachmentPreviewUrl}
                              alt="Vista previa"
                              sx={{
                                maxWidth: 200,
                                maxHeight: 200,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            />
                          )}
                          {uploadFileType === 'audio' && recordedAudioUrl && (
                            <Box component="audio" controls src={recordedAudioUrl} />
                          )}
                        </Box>
                        <Tooltip title="Quitar archivo adjunto">
                          <IconButton
                            size="small"
                            aria-label="Quitar archivo adjunto"
                            onClick={handleRemoveAttachment}
                            disabled={isSending}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </Paper>
              </Paper>
              <Dialog
                open={isCompleteContactOpen}
                onClose={closeCompleteContactDialog}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>Completar contacto</DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={2} sx={{ pt: 0.5 }}>
                    <TextField
                      label="Nombre"
                      value={completeContactForm.nombre}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, nombre: e.target.value }))}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Email"
                      value={completeContactForm.email}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, email: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Empresa"
                      value={completeContactForm.empresa}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, empresa: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Observaciones"
                      value={completeContactForm.observaciones}
                      onChange={(e) => setCompleteContactForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                      fullWidth
                      multiline
                      minRows={3}
                    />
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={closeCompleteContactDialog} variant="text">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveCompleteContact}
                    variant="contained"
                    disabled={!completeContactForm.nombre.trim() || !selectedContactoId}
                  >
                    Guardar
                  </Button>
                </DialogActions>
              </Dialog>
              <Dialog
                open={finalizarDialogOpen}
                onClose={handleCloseFinalizarDialog}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>Marcar conversación como finalizada</DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={2} sx={{ pt: 0.5 }}>
                    {finalizarTargetLead && (
                      <Typography variant="body2">
                        Conversación: <strong>{finalizarTargetLead.name?.trim() || `WhatsApp ${finalizarTargetLead.phone}`}</strong>
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Las conversaciones finalizadas ya no aparecerán en Riesgo de perder, Requiere atención ni Actividad reciente.
                    </Typography>
                    <TextField
                      select
                      label="Motivo"
                      value={finalizarMotivo}
                      onChange={(e) => setFinalizarMotivo(e.target.value as MotivoFinalizacion)}
                      required
                      fullWidth
                    >
                      {motivoFinalizacionOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    {finalizarMotivo === 'otro' && (
                      <TextField
                        label="Observaciones"
                        value={finalizarObservaciones}
                        onChange={(e) => setFinalizarObservaciones(e.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        required
                      />
                    )}
                    {finalizarError && <Alert severity="error">{finalizarError}</Alert>}
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={handleCloseFinalizarDialog} variant="text" disabled={finalizarSaving}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmFinalizar}
                    variant="contained"
                    disabled={finalizarSaving || !finalizarMotivo}
                  >
                    {finalizarSaving ? 'Guardando…' : 'Marcar como finalizada'}
                  </Button>
                </DialogActions>
              </Dialog>
              </>
            ) : (
              <Typography variant="body1">Selecciona un lead para ver el detalle.</Typography>
            )}
        </Box>
      </Box>
    </Box>
    <Snackbar
      open={snackbar.open}
      autoHideDuration={2500}
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
    <Dialog
      open={Boolean(sendErrorDialog)}
      onClose={() => setSendErrorDialog(null)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>No se pudo enviar el mensaje</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2">{sendErrorDialog?.mensajeUsuario}</Typography>
          {sendErrorDialog?.accionSugerida && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {sendErrorDialog.accionSugerida}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {sendErrorDialog?.recuperable && (
          <Button
            onClick={() => {
              if (sendErrorDialog) {
                void handleRetryWhatsappSend(sendErrorDialog.leadId, sendErrorDialog.tempId);
              }
            }}
            variant="outlined"
          >
            Reintentar
          </Button>
        )}
        <Button onClick={() => setSendErrorDialog(null)} variant="contained">
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog
      open={ventanaCerradaDialogOpen}
      onClose={() => setVentanaCerradaDialogOpen(false)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>No puedes enviar este mensaje todavía</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            Han pasado más de 24 horas desde el último mensaje del cliente.
          </Typography>
          <Typography variant="body2">
            Puedes enviar una plantilla autorizada para contactarlo. Cuando el cliente responda, podrás continuar enviando mensajes normales.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setVentanaCerradaDialogOpen(false)} variant="text">
          Entendido
        </Button>
        <Button
          onClick={() => {
            setVentanaCerradaDialogOpen(false);
            handleSendTemplate();
          }}
          variant="contained"
        >
          Enviar plantilla
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
