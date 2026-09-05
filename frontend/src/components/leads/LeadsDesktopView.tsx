import React from 'react';
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
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Select,
  Slider,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
} from '@mui/material';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DoneIcon from '@mui/icons-material/Done';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ForwardIcon from '@mui/icons-material/Forward';
import FilterListIcon from '@mui/icons-material/FilterList';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import SearchIcon from '@mui/icons-material/Search';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import type { NavigateFunction } from 'react-router-dom';
import { SendWhatsappTemplateDialog } from '../SendWhatsappTemplateDialog';
import { ForwardMessageDialog, type ForwardableMessage } from '../ForwardMessageDialog';
import { LeadDetailPanel, leadSelectMenuProps } from './LeadDetailPanel';
import { LeadTagsManager } from './LeadTagsManager';
import { linkifyMessageText } from '../LinkifiedText';
import { computeListContinuation } from '../../utils/messageListContinuation';
import { useMessageHighlight } from '../../hooks/useMessageHighlight';
import {
  REACTION_EMOJIS,
  buildLeadOwnerLabel,
  buildReplyPreviewText,
  formatMinutesAgo,
  getDayLabel,
  getLeadAvatarColor,
  getLeadInitials,
  getWindowDisplayState,
} from '../../utils/leadsDerivation';
import { NOTIFICATION_TONE_OPTIONS, type NotificationTone } from '../../utils/notificationSound';
import type { Contacto } from '../../types/contactos.types';
import type {
  EtapaOportunidad,
  Lead,
  LeadConPrioridad,
  LeadScope,
  ConversationViewMode,
  WhatsappWindowFilter,
  MotivoFinalizacion,
  OpportunityFilter,
  OportunidadVenta,
  Priority,
  QuickFilter,
  ReplyPreview,
  WhatsappEtiqueta,
} from '../../pages/LeadsPage';

// Vista de escritorio del módulo de Leads/conversaciones de WhatsApp.
// LeadsPage.tsx sigue siendo dueño de todo el estado y la lógica de negocio
// (ventana de 24h, prioridad, permisos, polling, envío, etc.); este componente
// solo recibe esos valores ya resueltos y el JSX de presentación.
export interface LeadsDesktopViewProps {
  // Menú de etapa de oportunidad
  etapaMenu: { leadId: string; anchorEl: HTMLElement | null } | null;
  etapaMenuLead: Lead | null | undefined;
  handleCloseEtapaMenu: () => void;
  handleSelectEtapa: (etapa: EtapaOportunidad) => void;

  // Menú y gestión de etiquetas de conversación
  tagsMenuAnchor: HTMLElement | null;
  handleCloseTagsMenu: () => void;
  availableTags: WhatsappEtiqueta[];
  conversationTags: WhatsappEtiqueta[];
  toggleConversationTag: (tag: WhatsappEtiqueta) => void;
  isCreatingTag: boolean;
  newTagName: string;
  setNewTagName: React.Dispatch<React.SetStateAction<string>>;
  newTagColor: string;
  setNewTagColor: React.Dispatch<React.SetStateAction<string>>;
  handleCancelCreateTag: () => void;
  handleSaveNewTag: () => void;
  handleStartCreateTag: () => void;
  manageTagsOpen: boolean;
  handleCloseManageTags: () => void;
  tagActionError: string | null;
  setTagActionError: React.Dispatch<React.SetStateAction<string | null>>;
  handleOpenEditTagForm: (tag: WhatsappEtiqueta) => void;
  handleDeactivateTag: (tag: WhatsappEtiqueta) => void;
  tagDeactivatingId: number | null;
  tagFormOpen: boolean;
  tagFormId: number | null;
  tagFormName: string;
  setTagFormName: React.Dispatch<React.SetStateAction<string>>;
  tagFormColor: string;
  setTagFormColor: React.Dispatch<React.SetStateAction<string>>;
  tagFormError: string | null;
  handleCancelTagForm: () => void;
  handleSubmitTagForm: () => void;
  tagFormSaving: boolean;
  handleOpenCreateTagForm: () => void;
  handleOpenManageTags: () => void;
  handleOpenTagsMenu: (event: React.MouseEvent<HTMLElement>) => void;
  motivoFinalizacionLabel: Record<MotivoFinalizacion, string>;
  motivoFinalizacionOptions: Array<{ value: MotivoFinalizacion; label: string }>;

  // Chips de resumen superiores
  urgentLeads: LeadConPrioridad[];
  followUpLeads: LeadConPrioridad[];
  newLeads: LeadConPrioridad[];

  // Columna izquierda: filtros y lista de leads
  leadsFiltradosOrdenados: LeadConPrioridad[];
  leadsRecientes: LeadConPrioridad[];
  conversationViewMode: ConversationViewMode;
  onConversationViewModeChange: (mode: ConversationViewMode) => void;
  leadsRiesgo: LeadConPrioridad[];
  leadsSeguimiento: LeadConPrioridad[];
  leadsActividad: LeadConPrioridad[];
  riesgoTooltip: React.ReactNode;
  seguimientoTooltip: React.ReactNode;
  actividadTooltip: React.ReactNode;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  isAdmin: boolean;
  vendedorFilterId: number | null;
  setVendedorFilterId: React.Dispatch<React.SetStateAction<number | null>>;
  leadScope: LeadScope;
  // Reemplaza a los setters sueltos (setLeadScope + setScopeTouched): además
  // de actualizar el estado, persiste la preferencia en 'leads-chat' (ver
  // handleLeadScopeChange en LeadsPage.tsx). Única forma de cambiar el scope
  // manualmente, para no tener dos caminos que puedan desincronizarse.
  onLeadScopeChange: (scope: LeadScope) => void;
  selectedTagIds: number[];
  setSelectedTagIds: React.Dispatch<React.SetStateAction<number[]>>;
  tagsSelectOpen: boolean;
  setTagsSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTags: WhatsappEtiqueta[];
  canToggleScope: boolean;
  showMisChip: boolean;
  showTodosChip: boolean;
  shouldShowScopeChipGroup: boolean;
  showQuickFilterChips: boolean;
  leadFilter: QuickFilter;
  setLeadFilter: React.Dispatch<React.SetStateAction<QuickFilter>>;
  opportunityFilter: OpportunityFilter;
  setOpportunityFilter: React.Dispatch<React.SetStateAction<OpportunityFilter>>;
  whatsappWindowFilter: WhatsappWindowFilter;
  setWhatsappWindowFilter: React.Dispatch<React.SetStateAction<WhatsappWindowFilter>>;
  vistaFinalizadas: boolean;
  setVistaFinalizadas: React.Dispatch<React.SetStateAction<boolean>>;
  vendorOptions: Contacto[];
  renderLeadCard: (lead: LeadConPrioridad) => React.ReactNode;
  onSelectLead: (id: string) => void;

  // Columna derecha: detalle del lead seleccionado
  selectedLead: LeadConPrioridad | undefined;
  selectedLeadPriority: Priority;
  selectedContactoId: number | null;
  selectedContacto: Contacto | undefined;
  selectedVendedorId: number | null;
  vendedoresById: Record<number, Contacto>;
  vendedorContactoId: number | null;
  isUpdatingOwner: boolean;
  openCompleteContactDialog: () => void;
  handleOwnerChange: (nextValue: string) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  handleOpenFinalizarDialog: (leadId: string) => void;
  handleReabrirConversacion: (leadId: string) => void;
  reabrirSavingId: string | null;

  // Acciones de envío / plantilla / cotización
  isSending: boolean;
  sendSuccess: boolean;
  handleSendWhatsapp: (event?: React.FormEvent<HTMLFormElement>) => void;
  isSuggesting: boolean;
  handleSuggestMessage: () => void;
  handleSendTemplate: () => void;
  handleGenerarCotizacion: () => void;
  navigate: NavigateFunction;

  // Oportunidades
  oportunidadesOpen: boolean;
  setOportunidadesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingOportunidades: boolean;
  oportunidadesError: string | null;
  oportunidades: OportunidadVenta[];

  // Plantillas y reenvío
  isTemplateDialogOpen: boolean;
  setIsTemplateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleTemplateSuccess: (plantillaNombre: string) => void;
  forwardMessage: ForwardableMessage | null;
  setForwardMessage: React.Dispatch<React.SetStateAction<ForwardableMessage | null>>;
  loadConversations: (opts?: { incremental?: boolean }) => void;

  // Conversación / chat
  conversationScrollRef: React.RefObject<HTMLDivElement | null>;
  conversationEndRef: React.RefObject<HTMLDivElement | null>;
  replyingTo: ReplyPreview | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<ReplyPreview | null>>;
  focusReplyInput: () => void;
  handleRetryWhatsappSend: (leadId: string, tempId: string) => void;
  handleReactToMessage: (leadId: string, messageId: string, emoji: string | null) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  selectedTone: NotificationTone;
  onChangeTone: (tone: NotificationTone) => void;
  onPreviewTone: () => void;
  onResendAttachment: (message: ForwardableMessage) => void;
  notificationVolume: number;
  onChangeNotificationVolume: (volume: number) => void;

  // Composer / adjuntos / audio
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectUpload: () => void;
  isRecording: boolean;
  handleToggleRecording: () => void;
  quickReply: string;
  setQuickReply: React.Dispatch<React.SetStateAction<string>>;
  quickReplyRef: React.RefObject<HTMLInputElement | null>;
  handleQuickReplyPaste: (event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isUploadingImage: boolean;
  uploadFileType: 'image' | 'document' | 'audio' | 'video' | null;
  uploadError: string | null;
  pendingAttachmentFile: File | null;
  uploadFileName: string | null;
  pendingAttachmentPreviewUrl: string | null;
  recordedAudioUrl: string | null;
  handleRemoveAttachment: () => void;

  // Diálogo "Completar contacto"
  isCompleteContactOpen: boolean;
  closeCompleteContactDialog: () => void;
  completeContactForm: { nombre: string; email: string; empresa: string; observaciones: string };
  setCompleteContactForm: React.Dispatch<React.SetStateAction<{ nombre: string; email: string; empresa: string; observaciones: string }>>;
  handleSaveCompleteContact: () => void;

  // Diálogo "Finalizar conversación"
  finalizarDialogOpen: boolean;
  handleCloseFinalizarDialog: () => void;
  finalizarTargetLead: LeadConPrioridad | null;
  finalizarMotivo: MotivoFinalizacion | '';
  setFinalizarMotivo: React.Dispatch<React.SetStateAction<MotivoFinalizacion | ''>>;
  finalizarObservaciones: string;
  setFinalizarObservaciones: React.Dispatch<React.SetStateAction<string>>;
  finalizarError: string | null;
  handleConfirmFinalizar: () => void;
  finalizarSaving: boolean;

  // Snackbar y diálogos de error / ventana cerrada
  snackbar: { open: boolean; message: string; severity: 'success' | 'error' };
  setSnackbar: React.Dispatch<React.SetStateAction<{ open: boolean; message: string; severity: 'success' | 'error' }>>;
  sendErrorDialog: {
    leadId: string;
    tempId: string;
    mensajeUsuario: string;
    accionSugerida: string | null;
    recuperable: boolean;
  } | null;
  setSendErrorDialog: React.Dispatch<React.SetStateAction<{
    leadId: string;
    tempId: string;
    mensajeUsuario: string;
    accionSugerida: string | null;
    recuperable: boolean;
  } | null>>;
  ventanaCerradaDialogOpen: boolean;
  setVentanaCerradaDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

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

const MANAGE_TAGS_OPTION_VALUE = '__manage_tags__';
const etapaOptions: EtapaOportunidad[] = ['nuevo', 'contactado', 'interesado', 'cotizado', 'negociacion', 'convertida', 'perdida'];

// Anchos fijos de las columnas laterales del layout de 3 columnas (inbox /
// conversación / detalle), dentro del rango 300-340px aprobado. La columna
// de conversación siempre toma el resto vía flex:1.
const INBOX_COLUMN_WIDTH = 340;
const DETAIL_COLUMN_WIDTH = 320;

// Separación entre columnas del layout de 3 (o 2, en modo tablet) columnas
// — mismo valor que el `gap={2}` (spacing de MUI, 8px por unidad) del Box
// que las contiene, para poder calcular el ancho de contenedor real que se
// necesita antes de mostrar 3 columnas.
const LEADS_COLUMN_GAP = 16;

// Ancho mínimo de la columna de conversación para considerarla "cómoda":
// no una cifra arbitraria, sino el ancho que ya se validó visualmente como
// cómodo en las capturas aprobadas a 1440px con los anchos de inbox/detalle
// de arriba (~462px reales en ese ancho). El modo de 3 columnas solo debe
// activarse cuando, restando inbox + detalle + separaciones, todavía quede
// al menos este espacio real para el chat — nunca por debajo, aunque eso
// signifique quedarse en el modo tablet (2 columnas + Drawer) en anchos de
// viewport que en teoría MUI consideraría "desktop" (`lg`, 1200px).
const LEADS_MIN_COMFORTABLE_CHAT_WIDTH = 460;

// Ancho de contenedor (el área real disponible para Leads, ya descontado el
// sidebar fijo y el padding de página — no el ancho del viewport) necesario
// para mostrar las 3 columnas sin comprimir el chat por debajo del mínimo
// cómodo definido arriba.
const LEADS_THREE_COLUMN_MIN_CONTAINER_WIDTH =
  INBOX_COLUMN_WIDTH + DETAIL_COLUMN_WIDTH + LEADS_MIN_COMFORTABLE_CHAT_WIDTH + LEADS_COLUMN_GAP * 2;

// Margen inferior a reservar al anclar la altura del layout al viewport,
// igual al padding inferior (mitad de `py: 2`) del wrapper de contenido que
// envuelve las páginas en SidebarLayout.tsx — para no terminar pegados al
// borde inferior real del navegador.
const CONTENT_WRAPPER_BOTTOM_GUTTER = 16;

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

type ChatImageProps = {
  src: string;
  alt: string;
  maxWidth: number | string;
  maxHeight: number;
  marginBottom?: number;
  // Estilos opcionales para reutilizar el mismo componente (y la misma
  // precarga) en el preview de adjunto pendiente del compositor, que hoy
  // usa borde y objectFit distintos a la burbuja del mensaje enviado.
  border?: boolean;
  objectFit?: 'cover' | 'contain';
};

// Causa confirmada del "barrido" en el mensaje recién enviado: cuando el
// mensaje optimista (id = tempId) se reemplaza por el mensaje real que
// devuelve el servidor (id real), la conversación pasa de tener una entrada
// con id=tempId a una con id=<id real> — mismo mediaUrl, pero distinta
// `key` en el .map() de abajo. React desmonta el ChatImage anterior y monta
// uno nuevo, reiniciando la precarga/decodificación aunque el navegador ya
// tenía la imagen lista momentos antes. Esta caché (solo de sesión, en
// memoria, sin persistencia) recuerda qué URLs ya se decodificaron con
// éxito, para que un ChatImage que remonta con una URL ya vista se muestre
// de inmediato sin volver a pasar por el Skeleton. No cambia el merge/polling
// de LeadsPage.tsx (sin tocar) ni introduce lógica de negocio nueva.
const decodedChatImageUrls = new Set<string>();

// Precarga la imagen fuera del DOM (Image().decode(), con fallback a onload
// si el navegador no soporta decode()) y solo la revela cuando ya está
// completamente decodificada, para que la burbuja nunca muestre la imagen
// pintándose progresivamente ("barrido") mientras se descarga — igual que
// hace WhatsApp. Mientras tanto se muestra un Skeleton del mismo tamaño
// máximo. No cambia de dónde viene `src` (msg.mediaUrl, sin tocar) ni el
// tamaño final de la imagen ya mostrada (mismos maxWidth/maxHeight de
// siempre): solo controla CUÁNDO se revela.
function ChatImage({ src, alt, maxWidth, maxHeight, marginBottom, border, objectFit }: ChatImageProps) {
  // Si esta URL ya se decodificó con éxito antes en esta sesión (p. ej. el
  // mismo mensaje visto un momento antes como optimista), arranca ya listo:
  // evita el remount-tras-cambio-de-key (ver decodedChatImageUrls arriba).
  const [ready, setReady] = React.useState(() => decodedChatImageUrls.has(src));

  React.useEffect(() => {
    if (decodedChatImageUrls.has(src)) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setReady(false);

    const preloader = new Image();
    preloader.src = src;

    const markReady = (via: 'decode' | 'decode-error' | 'onload' | 'onerror') => {
      if (cancelled) {
        return;
      }
      if (via === 'decode' || via === 'onload') {
        decodedChatImageUrls.add(src);
      }
      setReady(true);
    };

    if (typeof preloader.decode === 'function') {
      preloader.decode().then(() => markReady('decode')).catch(() => markReady('decode-error'));
    } else {
      preloader.onload = () => markReady('onload');
      preloader.onerror = () => markReady('onerror');
    }

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!ready) {
    return <Skeleton variant="rounded" width={maxWidth} height={maxHeight} sx={{ mb: marginBottom }} />;
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{
        display: 'block',
        maxWidth,
        maxHeight,
        borderRadius: 1,
        mb: marginBottom,
        ...(border ? { border: '1px solid', borderColor: 'divider' } : {}),
        ...(objectFit ? { objectFit } : {}),
      }}
    />
  );
}

export default function LeadsDesktopView(props: LeadsDesktopViewProps) {
  const {
    etapaMenu,
    etapaMenuLead,
    handleCloseEtapaMenu,
    handleSelectEtapa,
    tagsMenuAnchor,
    handleCloseTagsMenu,
    availableTags,
    conversationTags,
    toggleConversationTag,
    isCreatingTag,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    handleCancelCreateTag,
    handleSaveNewTag,
    handleStartCreateTag,
    manageTagsOpen,
    handleCloseManageTags,
    tagActionError,
    setTagActionError,
    handleOpenEditTagForm,
    handleDeactivateTag,
    tagDeactivatingId,
    tagFormOpen,
    tagFormId,
    tagFormName,
    setTagFormName,
    tagFormColor,
    setTagFormColor,
    tagFormError,
    handleCancelTagForm,
    handleSubmitTagForm,
    tagFormSaving,
    handleOpenCreateTagForm,
    handleOpenManageTags,
    handleOpenTagsMenu,
    motivoFinalizacionLabel,
    motivoFinalizacionOptions,
    urgentLeads,
    followUpLeads,
    newLeads,
    leadsFiltradosOrdenados,
    leadsRecientes,
    conversationViewMode,
    onConversationViewModeChange,
    leadsRiesgo,
    leadsSeguimiento,
    leadsActividad,
    riesgoTooltip,
    seguimientoTooltip,
    actividadTooltip,
    searchTerm,
    setSearchTerm,
    isAdmin,
    vendedorFilterId,
    setVendedorFilterId,
    leadScope,
    onLeadScopeChange,
    selectedTagIds,
    setSelectedTagIds,
    tagsSelectOpen,
    setTagsSelectOpen,
    selectedTags,
    canToggleScope,
    showMisChip,
    showTodosChip,
    shouldShowScopeChipGroup,
    showQuickFilterChips,
    leadFilter,
    setLeadFilter,
    opportunityFilter,
    setOpportunityFilter,
    whatsappWindowFilter,
    setWhatsappWindowFilter,
    vistaFinalizadas,
    setVistaFinalizadas,
    vendorOptions,
    renderLeadCard,
    onSelectLead,
    selectedLead,
    selectedLeadPriority,
    selectedContactoId,
    selectedContacto,
    selectedVendedorId,
    vendedoresById,
    vendedorContactoId,
    isUpdatingOwner,
    openCompleteContactDialog,
    handleOwnerChange,
    updateLead,
    handleOpenFinalizarDialog,
    handleReabrirConversacion,
    reabrirSavingId,
    isSending,
    sendSuccess,
    handleSendWhatsapp,
    isSuggesting,
    handleSuggestMessage,
    handleSendTemplate,
    handleGenerarCotizacion,
    navigate,
    oportunidadesOpen,
    setOportunidadesOpen,
    isLoadingOportunidades,
    oportunidadesError,
    oportunidades,
    isTemplateDialogOpen,
    setIsTemplateDialogOpen,
    handleTemplateSuccess,
    forwardMessage,
    setForwardMessage,
    loadConversations,
    conversationScrollRef,
    conversationEndRef,
    replyingTo,
    setReplyingTo,
    focusReplyInput,
    handleRetryWhatsappSend,
    handleReactToMessage,
    soundEnabled,
    onToggleSound,
    selectedTone,
    onChangeTone,
    onPreviewTone,
    onResendAttachment,
    notificationVolume,
    onChangeNotificationVolume,
    uploadInputRef,
    handleUploadFile,
    handleSelectUpload,
    isRecording,
    handleToggleRecording,
    quickReply,
    setQuickReply,
    quickReplyRef,
    handleQuickReplyPaste,
    isUploadingImage,
    uploadFileType,
    uploadError,
    pendingAttachmentFile,
    uploadFileName,
    pendingAttachmentPreviewUrl,
    recordedAudioUrl,
    handleRemoveAttachment,
    isCompleteContactOpen,
    closeCompleteContactDialog,
    completeContactForm,
    setCompleteContactForm,
    handleSaveCompleteContact,
    finalizarDialogOpen,
    handleCloseFinalizarDialog,
    finalizarTargetLead,
    finalizarMotivo,
    setFinalizarMotivo,
    finalizarObservaciones,
    setFinalizarObservaciones,
    finalizarError,
    handleConfirmFinalizar,
    finalizarSaving,
    snackbar,
    setSnackbar,
    sendErrorDialog,
    setSendErrorDialog,
    ventanaCerradaDialogOpen,
    setVentanaCerradaDialogOpen,
  } = props;

  // Al tocar la cita de un mensaje respondido, hace scroll hasta el mensaje
  // original (dentro del mismo Paper con overflow:auto que ya usa
  // conversationScrollRef) y lo resalta ~2s. Mismo hook que usa
  // LeadsMobileView, ninguna lógica de scroll/resaltado duplicada.
  const { highlightedMessageId, scrollToMessage } = useMessageHighlight(conversationScrollRef);

  // Selector compacto de reacciones (Popover anclado al botón hover de la
  // burbuja). Estado puramente de presentación: vive aquí, no en LeadsPage.
  const [reactionPickerAnchor, setReactionPickerAnchor] = React.useState<{
    el: HTMLElement;
    messageId: string;
  } | null>(null);

  // Popover compacto de preferencias de sonido (activado/desactivado + tono
  // + probar), anclado al ícono de volumen del header de la conversación.
  const [soundSettingsAnchor, setSoundSettingsAnchor] = React.useState<HTMLElement | null>(null);
  const [conversationSearchOpen, setConversationSearchOpen] = React.useState(false);
  const [conversationSearchMode, setConversationSearchMode] = React.useState<'messages' | 'files'>('messages');
  const [attachmentMenu, setAttachmentMenu] = React.useState<{ anchor: HTMLElement; message: ForwardableMessage } | null>(null);
  const [conversationSearchQuery, setConversationSearchQuery] = React.useState('');
  const [conversationSearchIndex, setConversationSearchIndex] = React.useState(0);
  const conversationSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const conversationMatchRefs = React.useRef<Record<string, HTMLSpanElement | null>>({});

  const conversationSearchMatches = React.useMemo(() => {
    const query = conversationSearchQuery.trim().toLocaleLowerCase();
    if (!query || !selectedLead) return [];
    const result: Array<{ key: string; messageId: string; field: 'text' | 'caption'; start: number; end: number }> = [];
    selectedLead.conversation.forEach((message) => {
      (['text', 'caption'] as const).forEach((field) => {
        const value = message[field] || '';
        const lowerValue = value.toLocaleLowerCase();
        let start = lowerValue.indexOf(query);
        while (start >= 0) {
          result.push({ key: `${message.id}:${field}:${start}`, messageId: message.id, field, start, end: start + query.length });
          start = lowerValue.indexOf(query, start + query.length);
        }
      });
    });
    return result;
  }, [conversationSearchQuery, selectedLead]);

  const closeConversationSearch = React.useCallback(() => {
    setConversationSearchOpen(false);
    setConversationSearchQuery('');
    setConversationSearchIndex(0);
    conversationMatchRefs.current = {};
  }, []);

  React.useEffect(() => {
    closeConversationSearch();
    setConversationSearchMode('messages');
  }, [selectedLead?.id, closeConversationSearch]);

  const conversationAttachments = React.useMemo(() => (selectedLead?.conversation ?? [])
    .filter((message) => ['image', 'video', 'document'].includes(message.tipoContenido ?? ''))
    .map((message) => ({
      message,
      filename: message.caption || (message.mediaUrl ? message.mediaUrl.split('/').pop()?.split('?')[0] : '') || 'Documento',
      searchable: [message.caption, message.text, message.mediaUrl].filter(Boolean).join(' ').toLocaleLowerCase(),
    }))
    .filter((item) => !conversationSearchQuery.trim() || item.searchable.includes(conversationSearchQuery.trim().toLocaleLowerCase())),
  [conversationSearchQuery, selectedLead]);

  React.useEffect(() => {
    setConversationSearchIndex((current) => conversationSearchMatches.length
      ? Math.min(current, conversationSearchMatches.length - 1)
      : 0);
  }, [conversationSearchMatches.length]);

  React.useEffect(() => {
    const match = conversationSearchMatches[conversationSearchIndex];
    if (!match) return undefined;
    const frame = window.requestAnimationFrame(() => {
      conversationMatchRefs.current[match.key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversationSearchIndex, conversationSearchMatches]);

  const moveConversationMatch = React.useCallback((delta: number) => {
    if (!conversationSearchMatches.length) return;
    setConversationSearchIndex((current) => (
      (current + delta + conversationSearchMatches.length) % conversationSearchMatches.length
    ));
  }, [conversationSearchMatches.length]);

  const renderSearchableText = React.useCallback((value: string, messageId: string, field: 'text' | 'caption') => {
    const matches = conversationSearchMatches.filter((match) => match.messageId === messageId && match.field === field);
    if (!matches.length) return linkifyMessageText(value);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    matches.forEach((match) => {
      if (match.start > cursor) nodes.push(linkifyMessageText(value.slice(cursor, match.start)));
      nodes.push(
        <Box
          component="span"
          key={match.key}
          ref={(element: HTMLSpanElement | null) => { conversationMatchRefs.current[match.key] = element; }}
          sx={{ bgcolor: conversationSearchMatches[conversationSearchIndex]?.key === match.key ? '#facc15' : '#fef08a', borderRadius: 0.25 }}
        >
          {value.slice(match.start, match.end)}
        </Box>,
      );
      cursor = match.end;
    });
    if (cursor < value.length) nodes.push(linkifyMessageText(value.slice(cursor)));
    return nodes;
  }, [conversationSearchIndex, conversationSearchMatches]);

  // Ancla la altura del layout al espacio real disponible del viewport, y
  // mide el ancho real del contenedor de Leads (ya descontados el sidebar
  // fijo de SidebarLayout.tsx y el padding de página — nada que ver con el
  // ancho del viewport). No asume un offset fijo tipo el que usa
  // LeadsMobileView (TOPBAR_HEIGHT), porque ese offset solo es válido ahí:
  // en mobile, CRMPage oculta su propio header/tabs mientras el chat está
  // abierto. Acá en desktop/tablet ese header/tabs de CRMPage sigue siempre
  // visible arriba de esta vista, y ni su alto ni el ancho del sidebar son
  // constantes conocidas de antemano — así que ambos se miden en vivo sobre
  // este contenedor. Al recalcularse solo con el resize de la ventana (no
  // con valores hardcodeados), si el sidebar o el header de CRMPage cambian
  // de tamaño en el futuro este cálculo se sigue ajustando solo, sin tocar
  // este archivo. CONTENT_WRAPPER_BOTTOM_GUTTER reserva el mismo margen
  // inferior que ya usa el wrapper de contenido de SidebarLayout.tsx.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [anchoredHeight, setAnchoredHeight] = React.useState<number | null>(null);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setAnchoredHeight(window.innerHeight - rect.top - CONTENT_WRAPPER_BOTTOM_GUTTER);
      setContainerWidth(rect.width);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // El modo de 3 columnas (inbox + chat + detalle fijo) solo se activa
  // cuando el ancho REAL del contenedor de Leads alcanza para las 3 sin
  // comprimir el chat por debajo de su mínimo cómodo — prevalece el espacio
  // útil real sobre el breakpoint `lg` (1200px) de MUI, que no tiene forma
  // de saber cuánto sidebar hay a la izquierda. Por debajo de ese umbral
  // real (independientemente de qué tan "ancho" sea el viewport reportado
  // por el navegador), se mantiene el modo tablet: inbox + chat en 2
  // columnas, con el panel de detalle como Drawer overlay. Antes de la
  // primera medición (containerWidth null, un instante antes del primer
  // pintado) se asume tablet — el modo siempre seguro, nunca comprimido.
  const isTabletLayout = containerWidth == null || containerWidth < LEADS_THREE_COLUMN_MIN_CONTAINER_WIDTH;

  // Panel derecho de detalle: estado puramente de presentación, local a
  // esta vista (no vive en LeadsPage) — ningún otro componente necesita
  // leerlo ni persistirlo todavía. Abierto por defecto en desktop (fijo);
  // cerrado por defecto en tablet (se abre "bajo demanda" como overlay). El
  // valor inicial se computa una sola vez según el layout vigente al montar
  // (p. ej. al pasar de mobile a tablet, este componente recién se monta).
  const [detailOpen, setDetailOpen] = React.useState(() => !isTabletLayout);

  // Si el layout cruza el umbral tablet/desktop en vivo (resize del
  // navegador, sin desmontar el componente), vuelve al default de cada
  // modo — evita que el Drawer quede abierto "de sorpresa" al achicar la
  // ventana, o que el panel quede cerrado sin querer al agrandarla.
  // useLayoutEffect (no useEffect): corrige el estado antes de que el
  // navegador pinte, para que un resize desktop→tablet con el panel ya
  // abierto no llegue a mostrar, ni por un instante, el Drawer superpuesto
  // sobre el chat con el valor viejo de `detailOpen`.
  const prevTabletLayoutRef = React.useRef(isTabletLayout);
  React.useLayoutEffect(() => {
    if (prevTabletLayoutRef.current === isTabletLayout) return;
    prevTabletLayoutRef.current = isTabletLayout;
    setDetailOpen(!isTabletLayout);
  }, [isTabletLayout]);

  // Popover de filtros secundarios del inbox (vendedor/etiquetas/oportunidad/
  // finalizadas). Mismo patrón que `detailOpen`: estado puramente de
  // presentación, local a esta vista — la lógica de cada filtro (qué hace,
  // qué handler dispara) no cambia, solo dónde se muestra.
  const [filtrosAnchor, setFiltrosAnchor] = React.useState<HTMLElement | null>(null);

  // Colapso de los grupos del inbox (Riesgo de perder / Requiere seguimiento
  // / Actividad reciente): estado puramente de presentación, local a esta
  // vista, igual que `detailOpen`/`filtrosAnchor` — no se persiste, no toca
  // la derivación (leadsRiesgo/leadsSeguimiento/leadsActividad siguen
  // calculándose en LeadsPage.tsx sin cambios). Los tres arrancan
  // expandidos.
  const [riesgoOpen, setRiesgoOpen] = React.useState(true);
  const [seguimientoOpen, setSeguimientoOpen] = React.useState(true);
  const [actividadOpen, setActividadOpen] = React.useState(true);

  // Contenido del panel de detalle (inspector del lead), calculado una sola
  // vez y reutilizado tal cual en los dos contenedores posibles: la columna
  // fija de desktop y el Drawer overlay de tablet — mismo JSX, mismos
  // handlers, ninguna lógica duplicada entre ambos layouts.
  const detailContent = selectedLead ? (
    <LeadDetailPanel
      selectedLead={selectedLead}
      isAdmin={isAdmin}
      selectedContactoId={selectedContactoId}
      selectedVendedorId={selectedVendedorId}
      vendedoresById={vendedoresById}
      vendedorContactoId={vendedorContactoId}
      isUpdatingOwner={isUpdatingOwner}
      vendorOptions={vendorOptions}
      openCompleteContactDialog={openCompleteContactDialog}
      handleOwnerChange={handleOwnerChange}
      updateLead={updateLead}
      conversationTags={conversationTags}
      toggleConversationTag={toggleConversationTag}
      handleOpenTagsMenu={handleOpenTagsMenu}
      selectedLeadPriority={selectedLeadPriority}
      isSending={isSending}
      sendSuccess={sendSuccess}
      handleSendWhatsapp={handleSendWhatsapp}
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
    />
  ) : (
    <Typography variant="body1" color="text.secondary" sx={{ p: 1 }}>
      Selecciona un lead para ver el detalle.
    </Typography>
  );

  // Diálogos de plantilla y reenvío: se renderizan UNA sola vez aquí (ya no
  // dentro de detailContent, que ahora es LeadDetailPanel y se monta dos
  // veces —columna fija y Drawer— según el layout). Mismo estado/handlers de
  // siempre, solo se reubicó el JSX para no arriesgar una segunda instancia
  // montada en paralelo.
  const detailDialogs = (
    <>
      <SendWhatsappTemplateDialog
        open={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        telefono={selectedLead?.phone ?? ''}
        contacto={{
          nombre: selectedContacto?.nombre || selectedLead?.name || null,
          telefono: selectedLead?.phone || null,
          empresa: selectedContacto?.zona || null,
        }}
        onSuccess={handleTemplateSuccess}
      />

      <ForwardMessageDialog
        open={Boolean(forwardMessage)}
        message={forwardMessage}
        excludeConversationId={selectedLead?.id ?? null}
        onClose={() => setForwardMessage(null)}
        onForwarded={() => {
          void loadConversations({ incremental: true });
        }}
      />
    </>
  );

  return (
    <>
    <Box
      ref={rootRef}
      sx={{
        p: 2,
        height: anchoredHeight != null ? `${anchoredHeight}px` : '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
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

      <LeadTagsManager
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
      />

      <Popover
        open={Boolean(reactionPickerAnchor)}
        anchorEl={reactionPickerAnchor?.el ?? null}
        onClose={() => setReactionPickerAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Stack direction="row" spacing={0.25} sx={{ p: 0.5 }}>
          {REACTION_EMOJIS.map((emoji) => (
            <IconButton
              key={emoji}
              size="small"
              aria-label={`Reaccionar con ${emoji}`}
              onClick={() => {
                if (selectedLead && reactionPickerAnchor) {
                  handleReactToMessage(selectedLead.id, reactionPickerAnchor.messageId, emoji);
                }
                setReactionPickerAnchor(null);
              }}
              sx={{ fontSize: 20 }}
            >
              {emoji}
            </IconButton>
          ))}
        </Stack>
      </Popover>

      {/* Franja superior a todo el ancho de la página: una sola fila que
          reúne los controles del inbox (título/contador/buscador/alcance/
          filtros) a la izquierda y los indicadores globales a la derecha.
          El buscador es el único elemento con flex:1 — se lleva todo el
          espacio libre y empuja el resto hacia la derecha, sin recurrir a
          flexWrap. Se movieron aquí tal cual (mismos handlers, mismo
          estado) los controles que antes vivían apretados dentro de la
          columna izquierda de 340px, para que esa columna, el header del
          chat y el panel derecho arranquen a la misma altura. */}
      <Stack direction="row" alignItems="center" sx={{ minHeight: 32 }}>
        {/* Bloque izquierdo con el mismo ancho exacto que la columna del
            inbox (INBOX_COLUMN_WIDTH, sin hardcodear otro valor) — contiene
            únicamente el buscador, para que su borde izquierdo y derecho
            coincidan visualmente con los bordes de la columna izquierda de
            abajo. */}
        <Box
          sx={{
            flex: `0 0 ${INBOX_COLUMN_WIDTH}px`,
            maxWidth: INBOX_COLUMN_WIDTH,
            minWidth: 0,
          }}
        >
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
        </Box>

        {/* Todo lo que sigue arranca exactamente LEADS_COLUMN_GAP después
            del bloque de arriba — la misma separación que usa el layout de
            3 columnas entre inbox y conversación — para que este grupo
            quede alineado con el inicio de la columna central de abajo. */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: `${LEADS_COLUMN_GAP}px`, flexShrink: 0 }}>
          {shouldShowScopeChipGroup && (
            <>
              {showMisChip && (
                <Chip
                  label="Mis leads"
                  size="small"
                  color={leadScope === 'mis' ? 'primary' : 'default'}
                  variant={leadScope === 'mis' ? 'filled' : 'outlined'}
                  onClick={canToggleScope ? () => onLeadScopeChange('mis') : undefined}
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              )}
              {showTodosChip && (
                <Chip
                  label="Todos"
                  size="small"
                  color={leadScope === 'todos' ? 'primary' : 'default'}
                  variant={leadScope === 'todos' ? 'filled' : 'outlined'}
                  onClick={canToggleScope ? () => onLeadScopeChange('todos') : undefined}
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              )}
            </>
          )}
          {(() => {
            const filtrosActivos = Boolean(vendedorFilterId) || selectedTagIds.length > 0 || opportunityFilter !== 'todos' || whatsappWindowFilter !== 'todos' || vistaFinalizadas;
            return (
              <Chip
                icon={<FilterListIcon fontSize="small" />}
                label="Filtros"
                size="small"
                color={filtrosActivos ? 'primary' : 'default'}
                variant={filtrosActivos ? 'filled' : 'outlined'}
                onClick={(event) => setFiltrosAnchor(event.currentTarget)}
                sx={{ fontWeight: 700, flexShrink: 0 }}
              />
            );
          })()}

          <Tooltip title="Guía de ayuda">
            <IconButton
              aria-label="Abrir guía de ayuda"
              size="small"
              onClick={() => window.open('/docs/guia-leads.html', '_blank')}
              sx={{ color: '#64748b', p: 0.25, flexShrink: 0 }}
            >
              <HelpOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

          {/* Solo Riesgo/Seguimiento/Actividad — corresponden 1:1 a los
              grupos colapsables reales del inbox (leadsRiesgo/
              leadsSeguimiento/leadsActividad, agrupados por prioridad
              calculada). Se dejaron de renderizar aquí los indicadores
              temporales (Urgentes/En seguimiento/Nuevos, agrupados por
              minutos de inactividad): no correspondían a ningún grupo
              visible y usaban un criterio distinto con el mismo nombre,
              lo que generaba confusión. Sus derivaciones
              (urgentLeads/followUpLeads/newLeads) siguen intactas en
              LeadsPage.tsx por si se usan en otro lado — no se tocaron.
              Mismo condicional vistaFinalizadas de siempre. */}
          {vistaFinalizadas ? (
            <Stack direction="row" spacing={0.5} alignItems="baseline">
              <Typography variant="caption" color="text.secondary">Finalizadas</Typography>
              <Typography variant="body2" fontWeight={700}>
                {leadsFiltradosOrdenados.length}
              </Typography>
            </Stack>
          ) : (
            <>
              <Stack direction="row" spacing={0.5} alignItems="baseline">
                <Typography variant="caption" color="text.secondary">Riesgo</Typography>
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  {leadsRiesgo.length}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="baseline">
                <Typography variant="caption" color="text.secondary">Seguimiento</Typography>
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  {leadsSeguimiento.length}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="baseline">
                <Typography variant="caption" color="text.secondary">Actividad</Typography>
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  {leadsActividad.length}
                </Typography>
              </Stack>
            </>
          )}

          {/* Contador de visibles: se movió acá desde el bloque del
              buscador (que ahora contiene únicamente el campo de
              búsqueda) — misma jerarquía tipográfica que Riesgo/
              Seguimiento/Actividad (caption + número en negrita), mismo
              valor de siempre (leadsFiltradosOrdenados.length). */}
          <Stack direction="row" spacing={0.5} alignItems="baseline">
            <Typography variant="body2" fontWeight={700} color="text.secondary">
              {leadsFiltradosOrdenados.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">visibles</Typography>
          </Stack>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          flex: 1,
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            order: 0,
            flex: `0 0 ${INBOX_COLUMN_WIDTH}px`,
            maxWidth: INBOX_COLUMN_WIDTH,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {/* Título, contador, buscador, alcance (Mis leads/Todos) y
              Filtros se movieron a la franja superior de la página (mismos
              handlers/estado, ver más arriba) para que esta columna de
              340px no tenga que apretarlos — acá dentro solo queda la
              línea secundaria de agrupaciones y, enseguida, la lista. */}

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

          <Popover
            open={Boolean(filtrosAnchor)}
            anchorEl={filtrosAnchor}
            onClose={() => setFiltrosAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Stack spacing={1.5} sx={{ p: 2, minWidth: 300, maxWidth: 340 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Filtros
              </Typography>

              <Stack spacing={1}>
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
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Ventana de WhatsApp
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {([
                    { key: 'todos', label: 'Todos' },
                    { key: 'por-expirar', label: 'Por expirar' },
                    { key: 'expirada', label: 'Expirada' },
                  ] as const).map((opt) => (
                    <Chip
                      key={opt.key}
                      label={opt.label}
                      variant={whatsappWindowFilter === opt.key ? 'filled' : 'outlined'}
                      onClick={() => setWhatsappWindowFilter(opt.key)}
                      sx={{
                        fontWeight: 700,
                        color: whatsappWindowFilter === opt.key ? '#ffffff' : '#0f766e',
                        backgroundColor: whatsappWindowFilter === opt.key ? '#0f766e' : '#f0fdfa',
                        borderColor: '#99f6e4',
                      }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Oportunidad
                </Typography>
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
              </Stack>
            </Stack>
          </Popover>

          {/* El desglose Riesgo/Seguimiento/Actividad (y Finalizadas) que
              vivía acá como línea propia se movió a la franja superior
              (mismas variables, mismo condicional vistaFinalizadas) para
              que esta columna arranque exactamente a la misma altura que
              el header del chat y el panel derecho — sin línea de texto
              exclusiva encima de la lista. */}

          <Stack direction="row" sx={{ minHeight: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Stack direction="row" spacing={0.25} sx={{ p: 0.25, borderRadius: 1, bgcolor: 'action.hover' }}>
              {([['priority', 'Prioridad'], ['recent', 'Recientes']] as const).map(([mode, label]) => (
                <Button
                  key={mode}
                  size="small"
                  onClick={() => onConversationViewModeChange(mode)}
                  variant={conversationViewMode === mode ? 'contained' : 'text'}
                  sx={{ minHeight: 24, py: 0, px: 1.25, fontSize: 11, textTransform: 'none', boxShadow: 'none' }}
                >
                  {label}
                </Button>
              ))}
            </Stack>
          </Stack>

          {/* Columna central: lista de leads */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
            <Stack spacing={1.5} sx={{ overflow: 'auto', pr: 0.5, flex: 1, minHeight: 0 }}>
              {leadsFiltradosOrdenados.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                  {vistaFinalizadas ? 'No hay conversaciones finalizadas.' : 'No hay más leads en cola.'}
                </Typography>
              ) : conversationViewMode === 'recent' ? (
                <List disablePadding>
                  {leadsRecientes.map((conversationLead) => {
                    const stamp = conversationLead.ultimoMensajeEn ? new Date(conversationLead.ultimoMensajeEn) : null;
                    const validStamp = stamp && !Number.isNaN(stamp.getTime());
                    const sameDay = validStamp && stamp!.toDateString() === new Date().toDateString();
                    const timeLabel = validStamp ? (sameDay ? stamp!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : stamp!.toLocaleDateString([], { day: '2-digit', month: '2-digit' })) : '';
                    return (
                      <ListItem disablePadding key={conversationLead.id}>
                        <ListItemButton selected={conversationLead.id === selectedLead?.id} onClick={() => onSelectLead(conversationLead.id)} sx={{ alignItems: 'flex-start', gap: 1, px: 1.25 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: getLeadAvatarColor(conversationLead.id) }}>{getLeadInitials(conversationLead.name)}</Avatar>
                          <Stack minWidth={0} flex={1} spacing={0.25}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography variant="body2" fontWeight={700} noWrap>{conversationLead.name?.trim() || conversationLead.phone || 'Sin nombre'}</Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Typography variant="caption" color="text.secondary" noWrap>{timeLabel}</Typography>
                                {conversationLead.unreadCount && conversationLead.unreadCount > 0 ? (
                                  <Box sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: '50%', bgcolor: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{conversationLead.unreadCount}</Box>
                                ) : null}
                              </Stack>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" noWrap>{conversationLead.lastMessage || 'Sin mensajes'}</Typography>
                          </Stack>
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : vistaFinalizadas ? (
                <List disablePadding>
                  {leadsFiltradosOrdenados.map(renderLeadCard)}
                </List>
              ) : (
                <>
                  {leadsRiesgo.length > 0 && (
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.25}
                        onClick={() => setRiesgoOpen((prev) => !prev)}
                        sx={{ px: 0.5, cursor: 'pointer', userSelect: 'none' }}
                      >
                        <ExpandMoreIcon
                          fontSize="small"
                          sx={{
                            color: 'error.main',
                            transition: 'transform 0.15s',
                            transform: riesgoOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                          }}
                        />
                        <Tooltip title={riesgoTooltip} arrow>
                          <Typography variant="subtitle2" fontWeight={700} color="error.main">
                            🔴 Riesgo de perder ({leadsRiesgo.length})
                          </Typography>
                        </Tooltip>
                      </Stack>
                      {riesgoOpen && (
                        <List disablePadding>
                          {leadsRiesgo.map(renderLeadCard)}
                        </List>
                      )}
                    </Stack>
                  )}

                  {leadsRiesgo.length > 0 && (leadsSeguimiento.length > 0 || leadsActividad.length > 0) && <Divider />}

                  {leadsSeguimiento.length > 0 && (
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.25}
                        onClick={() => setSeguimientoOpen((prev) => !prev)}
                        sx={{ px: 0.5, cursor: 'pointer', userSelect: 'none' }}
                      >
                        <ExpandMoreIcon
                          fontSize="small"
                          sx={{
                            color: 'warning.main',
                            transition: 'transform 0.15s',
                            transform: seguimientoOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                          }}
                        />
                        <Tooltip title={seguimientoTooltip} arrow>
                          <Typography variant="subtitle2" fontWeight={700} color="warning.main">
                            🟡 Requiere seguimiento ({leadsSeguimiento.length})
                          </Typography>
                        </Tooltip>
                      </Stack>
                      {seguimientoOpen && (
                        <List disablePadding>
                          {leadsSeguimiento.map(renderLeadCard)}
                        </List>
                      )}
                    </Stack>
                  )}

                  {leadsSeguimiento.length > 0 && leadsActividad.length > 0 && <Divider />}

                  {leadsActividad.length > 0 && (
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.25}
                        onClick={() => setActividadOpen((prev) => !prev)}
                        sx={{ px: 0.5, cursor: 'pointer', userSelect: 'none' }}
                      >
                        <ExpandMoreIcon
                          fontSize="small"
                          sx={{
                            color: 'success.main',
                            transition: 'transform 0.15s',
                            transform: actividadOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                          }}
                        />
                        <Tooltip title={actividadTooltip} arrow>
                          <Typography variant="subtitle2" fontWeight={700} color="success.main">
                            🟢 Actividad reciente ({leadsActividad.length})
                          </Typography>
                        </Tooltip>
                      </Stack>
                      {actividadOpen && (
                        <List disablePadding>
                          {leadsActividad.map(renderLeadCard)}
                        </List>
                      )}
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        </Box>

        {/* Panel de detalle: columna fija en desktop (>=1200px), Drawer
            overlay en tablet (900-1199px) — mismo `detailContent` en ambos,
            sin duplicar JSX ni handlers. En tablet nunca se renderiza como
            columna (no compite por ancho con el chat); en desktop nunca se
            renderiza como Drawer. */}
        {!isTabletLayout && detailOpen && (
        <Box
          sx={{
            order: 2,
            flex: `0 0 ${DETAIL_COLUMN_WIDTH}px`,
            maxWidth: DETAIL_COLUMN_WIDTH,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {detailContent}
        </Box>
        )}

        {/* El Drawer se mantiene siempre montado (no condicionado a
            isTabletLayout) y su `open` se deriva en una sola expresión —
            evita el glitch de montar el Drawer ya "abierto" justo al cruzar
            a tablet con `detailOpen` todavía en true desde desktop, que
            dejaba el backdrop bloqueando clics indefinidamente. */}
        <Drawer
          anchor="right"
          open={isTabletLayout && detailOpen}
          onClose={() => setDetailOpen(false)}
          PaperProps={{
            sx: {
              width: DETAIL_COLUMN_WIDTH,
              maxWidth: '90vw',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          {detailContent}
        </Drawer>

        <Box
          sx={{
            order: 1,
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {/* Header fijo y compacto de la conversación. Persiste aunque no
              haya lead seleccionado para que sonido y acceso al panel de
              detalle sigan disponibles siempre — solo la identidad del lead
              (avatar/nombre/teléfono/vendedor/ventana) es condicional.
              El trigger de sonido + su Popover son el mismo control que
              antes vivía sobre el historial (movido, no duplicado); el
              toggle del panel de detalle es el mismo que antes vivía en el
              encabezado de página (movido, no duplicado). */}
          <Box
            sx={{
              flexShrink: 0,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            {selectedLead ? (
              <>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: 13,
                    fontWeight: 700,
                    bgcolor: getLeadAvatarColor(selectedLead.id),
                    flexShrink: 0,
                  }}
                >
                  {getLeadInitials(selectedLead.name)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {selectedLead.name?.trim() || `WhatsApp ${selectedLead.phone}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {selectedLead.phone}
                    {' · '}
                    {buildLeadOwnerLabel(selectedLead, vendedoresById, vendedorContactoId)}
                  </Typography>
                </Box>
                {(() => {
                  const windowInfo = getWindowDisplayState(selectedLead);
                  return (
                    <Tooltip title={windowInfo.label} arrow>
                      <Typography variant="caption" noWrap sx={{ color: windowInfo.color, fontWeight: 600, flexShrink: 0 }}>
                        {windowInfo.dot} {windowInfo.shortLabel}
                      </Typography>
                    </Tooltip>
                  );
                })()}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }} noWrap>
                Selecciona un lead para ver la conversación.
              </Typography>
            )}
            {selectedLead && (
              <Tooltip title="Buscar en conversación">
                <IconButton
                  size="small"
                  color={conversationSearchOpen ? 'primary' : 'default'}
                  onClick={() => {
                    setConversationSearchOpen(true);
                    window.requestAnimationFrame(() => conversationSearchInputRef.current?.focus());
                  }}
                  aria-label="Buscar en conversación"
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Preferencias de sonido">
              <IconButton
                size="small"
                onClick={(event) => setSoundSettingsAnchor(event.currentTarget)}
                aria-label="Preferencias de sonido de mensajes"
              >
                {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Popover
              open={Boolean(soundSettingsAnchor)}
              anchorEl={soundSettingsAnchor}
              onClose={() => setSoundSettingsAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Stack spacing={1.25} sx={{ p: 1.5, minWidth: 240 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">Sonido de mensajes</Typography>
                  <Switch
                    size="small"
                    checked={soundEnabled}
                    onChange={onToggleSound}
                    inputProps={{ 'aria-label': 'Alternar sonido de mensajes' }}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" sx={{ flexShrink: 0 }}>Tono</Typography>
                  <Select
                    size="small"
                    value={selectedTone}
                    onChange={(event) => onChangeTone(event.target.value as NotificationTone)}
                    sx={{ flex: 1 }}
                  >
                    {NOTIFICATION_TONE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <Tooltip title="Probar sonido">
                    <IconButton size="small" onClick={onPreviewTone} aria-label="Probar sonido">
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack spacing={0.25}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Volumen de alerta</Typography><Typography variant="caption">{Math.round(notificationVolume * 100)}%</Typography></Stack>
                  <Slider size="small" value={notificationVolume * 100} min={0} max={500} onChange={(_, value) => onChangeNotificationVolume(Number(value) / 100)} aria-label="Volumen de alerta de nuevos mensajes" />
                </Stack>
              </Stack>
            </Popover>
            <Tooltip title={detailOpen ? 'Ocultar panel de detalle' : 'Mostrar panel de detalle'}>
              <IconButton
                size="small"
                onClick={() => setDetailOpen((prev) => !prev)}
                aria-label={detailOpen ? 'Ocultar panel de detalle' : 'Mostrar panel de detalle'}
              >
                {detailOpen ? <KeyboardDoubleArrowRightIcon fontSize="small" /> : <KeyboardDoubleArrowLeftIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          {selectedLead ? (
            <>
              {conversationSearchOpen && (
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Select size="small" value={conversationSearchMode} onChange={(event) => setConversationSearchMode(event.target.value as 'messages' | 'files')} aria-label="Modo de búsqueda" sx={{ minWidth: 112 }}>
                    <MenuItem value="messages">Mensajes</MenuItem>
                    <MenuItem value="files">Archivos</MenuItem>
                  </Select>
                  <TextField
                    inputRef={conversationSearchInputRef}
                    autoFocus
                    size="small"
                    fullWidth
                    placeholder="Buscar en conversación…"
                    value={conversationSearchQuery}
                    onChange={(event) => setConversationSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        closeConversationSearch();
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        moveConversationMatch(event.shiftKey ? -1 : 1);
                      }
                    }}
                    inputProps={{ 'aria-label': 'Buscar en conversación' }}
                  />
                  <Typography variant="caption" sx={{ minWidth: 42, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {conversationSearchMatches.length ? `${conversationSearchIndex + 1}/${conversationSearchMatches.length}` : '0/0'}
                  </Typography>
                  <IconButton size="small" disabled={!conversationSearchMatches.length} onClick={() => moveConversationMatch(-1)} aria-label="Resultado anterior">
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={!conversationSearchMatches.length} onClick={() => moveConversationMatch(1)} aria-label="Siguiente resultado">
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={closeConversationSearch} aria-label="Cerrar búsqueda">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
              <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
                <Paper
                  variant="outlined"
                  ref={conversationScrollRef}
                  sx={{ p: 1.25, flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                >
                  {conversationSearchMode === 'files' ? (
                    <Stack spacing={1} sx={{ p: 0.5 }}>
                      <Typography variant="subtitle2">Imágenes y videos</Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {conversationAttachments.filter(({ message }) => message.tipoContenido === 'image' || message.tipoContenido === 'video').map(({ message, filename }) => (
                          <Box key={message.id} component="a" href={message.mediaUrl ?? undefined} target="_blank" rel="noopener noreferrer" sx={{ position: 'relative', width: 120, height: 100, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                            {message.tipoContenido === 'image' && message.mediaUrl ? <Box component="img" src={message.mediaUrl} alt={filename} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : message.tipoContenido === 'video' && message.mediaUrl ? <Box component="video" src={message.mediaUrl} muted sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Typography variant="caption">{filename}</Typography>}
                            {message.tipoContenido === 'video' && <VideoLibraryIcon sx={{ position: 'absolute', right: 4, bottom: 4, color: 'white', filter: 'drop-shadow(0 1px 2px black)' }} />}
                            <IconButton size="small" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAttachmentMenu({ anchor: event.currentTarget, message: { id: message.id, tipoContenido: message.tipoContenido!, text: message.text || '', caption: message.caption, mediaUrl: message.mediaUrl } }); }} sx={{ position: 'absolute', top: 2, right: 2, color: 'white', bgcolor: 'rgba(0,0,0,.45)', '&:hover': { bgcolor: 'rgba(0,0,0,.7)' } }} aria-label="Acciones del archivo"><MoreVertIcon fontSize="small" /></IconButton>
                          </Box>
                        ))}
                      </Stack>
                      <Typography variant="subtitle2">Documentos</Typography>
                      <Stack spacing={0.5}>
                        {conversationAttachments.filter(({ message }) => message.tipoContenido === 'document').map(({ message, filename }) => (
                          <Stack key={message.id} component="a" href={message.mediaUrl ?? undefined} target="_blank" rel="noopener noreferrer" direction="row" spacing={1} alignItems="center" sx={{ color: 'inherit', textDecoration: 'none', p: 0.75, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                            <DescriptionIcon fontSize="small" /><Typography variant="body2" noWrap>{filename}</Typography><Typography variant="caption" color="text.secondary">{message.mimeType || ''}</Typography><Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', flexShrink: 0 }}>{message.sentAt ? new Date(message.sentAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : ''}</Typography><IconButton size="small" onClick={(event) => { event.preventDefault(); setAttachmentMenu({ anchor: event.currentTarget, message: { id: message.id, tipoContenido: message.tipoContenido!, text: message.text || '', caption: message.caption, mediaUrl: message.mediaUrl } }); }} aria-label="Acciones del archivo"><MoreVertIcon fontSize="small" /></IconButton>
                          </Stack>
                        ))}
                      </Stack>
                      {conversationAttachments.length === 0 && <Typography variant="body2" color="text.secondary">No se encontraron archivos.</Typography>}
                      <Menu anchorEl={attachmentMenu?.anchor} open={Boolean(attachmentMenu)} onClose={() => setAttachmentMenu(null)}>
                        <MenuItem onClick={() => { if (attachmentMenu) { setReplyingTo({ id: attachmentMenu.message.id, from: 'lead', preview: attachmentMenu.message.caption || attachmentMenu.message.text || buildReplyPreviewText(attachmentMenu.message.tipoContenido, '', attachmentMenu.message.caption) }); setConversationSearchMode('messages'); setConversationSearchQuery(''); setAttachmentMenu(null); focusReplyInput(); } }}>Responder</MenuItem>
                        <MenuItem onClick={() => { if (attachmentMenu) { onResendAttachment(attachmentMenu.message); setAttachmentMenu(null); } }}>Enviar nuevamente</MenuItem>
                        <MenuItem onClick={() => { if (attachmentMenu) { setForwardMessage(attachmentMenu.message); setAttachmentMenu(null); } }}>Reenviar</MenuItem>
                        <MenuItem component="a" href={attachmentMenu?.message.mediaUrl || undefined} target="_blank" rel="noopener noreferrer" onClick={() => setAttachmentMenu(null)}>Descargar</MenuItem>
                      </Menu>
                    </Stack>
                  ) : selectedLead.conversation.map((msg, index) => {
                    // Separador de día (Hoy/Ayer/fecha) y agrupación visual de
                    // mensajes consecutivos del mismo remitente: ambos
                    // derivados puramente de datos ya presentes en cada
                    // mensaje (sentAt, from), sin estado ni lógica nueva.
                    const prevMsg = index > 0 ? selectedLead.conversation[index - 1] : null;
                    const dayLabel = getDayLabel(msg.sentAt);
                    const showDateSeparator = Boolean(dayLabel) && dayLabel !== (prevMsg ? getDayLabel(prevMsg.sentAt) : null);
                    const isGroupedWithPrev = !showDateSeparator && Boolean(prevMsg) && prevMsg!.from === msg.from;

                    // Solo se puede responder/reenviar un mensaje que ya quedó
                    // persistido en el backend (tiene un id real de
                    // crm.mensajes): los mensajes optimistas "sending"/"failed"
                    // todavía usan un tempId local y no existen en la base de
                    // datos, así que no hay nada a lo que referenciar todavía.
                    const canReply = !msg.tempId;
                    // Reaccionar requiere el id_externo (gsId/wamid) que
                    // Gupshup necesita para ubicar el mensaje objetivo — igual
                    // que Responder, solo disponible una vez que el mensaje ya
                    // quedó persistido (sin tempId).
                    const canReact = !msg.tempId;
                    const canForward = !msg.tempId;

                    // Barra compacta de acciones (responder/reaccionar/reenviar),
                    // agrupada en un solo contenedor icon-only con tooltip que
                    // aparece en hover sobre la fila — mismos handlers de
                    // siempre, solo se consolidó la presentación.
                    const actionsBar = (canReply || canReact || canForward) ? (
                      <Stack
                        direction="row"
                        className="msg-actions-bar"
                        spacing={0.25}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.15s',
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 5,
                          p: 0.25,
                          flexShrink: 0,
                        }}
                      >
                        {canReply && (
                          <Tooltip title="Responder" arrow>
                            <IconButton
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
                              sx={{ p: 0.5 }}
                            >
                              <ReplyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canReact && (
                          <Tooltip title="Reaccionar" arrow>
                            <IconButton
                              size="small"
                              aria-label="Reaccionar al mensaje"
                              onClick={(event) => setReactionPickerAnchor({ el: event.currentTarget, messageId: msg.id })}
                              sx={{ p: 0.5 }}
                            >
                              <AddReactionOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canForward && (
                          <Tooltip title="Reenviar" arrow>
                            <IconButton
                              size="small"
                              aria-label="Reenviar mensaje"
                              onClick={() => {
                                setForwardMessage({
                                  id: msg.id,
                                  tipoContenido: msg.tipoContenido ?? 'text',
                                  text: msg.text || '',
                                  caption: msg.caption ?? null,
                                  mediaUrl: msg.mediaUrl ?? null,
                                });
                              }}
                              sx={{ p: 0.5 }}
                            >
                              <ForwardIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    ) : null;

                    const bubble = (
                      <Box
                        data-message-id={msg.id}
                        sx={{
                          maxWidth: '68%',
                          px: 1.25,
                          py: 0.6,
                          borderRadius: 1.5,
                          bgcolor: msg.from === 'me' ? 'primary.main' : 'grey.100',
                          color: msg.from === 'me' ? 'primary.contrastText' : 'text.primary',
                          transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                          ...(highlightedMessageId === msg.id
                            ? {
                              boxShadow: (theme) => `0 0 0 2px ${theme.palette.warning.main}`,
                              bgcolor: 'warning.light',
                              color: 'text.primary',
                            }
                            : {}),
                        }}
                      >
                        {msg.replyTo && (
                          <Box
                            role="button"
                            tabIndex={0}
                            aria-label="Ir al mensaje original"
                            onClick={() => scrollToMessage(msg.replyTo!.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                scrollToMessage(msg.replyTo!.id);
                              }
                            }}
                            sx={{
                              borderLeft: '3px solid',
                              borderColor: msg.from === 'me' ? 'rgba(255,255,255,0.6)' : 'primary.main',
                              bgcolor: msg.from === 'me' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)',
                              borderRadius: 0.75,
                              px: 1,
                              py: 0.5,
                              mb: 0.75,
                              cursor: 'pointer',
                              '&:hover': { opacity: 0.85 },
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
                            <ChatImage
                              src={msg.mediaUrl}
                              alt="Imagen enviada"
                              maxWidth={250}
                              maxHeight={250}
                              marginBottom={msg.text ? 0.5 : 0}
                            />
                          </Box>
                        )}
                        {msg.tipoContenido === 'video' && msg.mediaUrl && (
                          msg.isGif ? (
                            // GIF de WhatsApp (gif_playback/filename .gif, ver
                            // whatsapp.mapper.ts): se comporta visualmente
                            // como un GIF (loop/autoplay/mute, sin controles),
                            // envuelto en el mismo wrapper <a target="_blank">
                            // que ya usa la imagen para "ver ampliado".
                            <Box
                              component="a"
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ display: 'block' }}
                            >
                              <Box
                                component="video"
                                src={msg.mediaUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                sx={{
                                  display: 'block',
                                  maxWidth: 250,
                                  maxHeight: 250,
                                  borderRadius: 1,
                                  mb: (msg.text || msg.caption) ? 0.5 : 0,
                                }}
                              />
                            </Box>
                          ) : (
                            // Video normal: NO se envuelve en <a> (mismo
                            // criterio que <audio controls> más abajo) porque
                            // los controles nativos (play/seek) están dentro
                            // del elemento y un wrapper clicable competiría
                            // con ellos, abriendo la pestaña en vez de
                            // reproducir/pausar.
                            <Box
                              component="video"
                              src={msg.mediaUrl}
                              controls
                              playsInline
                              sx={{
                                display: 'block',
                                maxWidth: 250,
                                maxHeight: 250,
                                borderRadius: 1,
                                mb: (msg.text || msg.caption) ? 0.5 : 0,
                              }}
                            />
                          )
                        )}
                        {(msg.tipoContenido === 'image' || msg.tipoContenido === 'audio' || msg.tipoContenido === 'document' || msg.tipoContenido === 'video') && !msg.mediaUrl && (
                          <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.85 }}>
                            {msg.caption ? renderSearchableText(msg.caption, msg.id, 'caption') : 'Archivo recibido'}
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
                              {msg.caption ? renderSearchableText(msg.caption, msg.id, 'caption') : 'Documento adjunto'}
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
                        {(msg.tipoContenido === 'image' || msg.tipoContenido === 'video') && msg.caption && (
                          <Typography variant="body2">{renderSearchableText(msg.caption, msg.id, 'caption')}</Typography>
                        )}
                        {msg.text && (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {renderSearchableText(msg.text, msg.id, 'text')}
                          </Typography>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: msg.reactions && msg.reactions.length > 0 ? 'space-between' : 'flex-end',
                            alignItems: 'center',
                            gap: 0.75,
                            mt: 0.25,
                          }}
                        >
                          {msg.reactions && msg.reactions.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                              {msg.reactions.map((reaction) => (
                                <Box
                                  key={reaction.autor}
                                  component={reaction.autor === 'agente' ? 'button' : 'span'}
                                  type={reaction.autor === 'agente' ? 'button' : undefined}
                                  onClick={reaction.autor === 'agente'
                                    ? () => handleReactToMessage(selectedLead.id, msg.id, null)
                                    : undefined}
                                  aria-label={reaction.autor === 'agente' ? 'Quitar tu reacción' : undefined}
                                  sx={{
                                    fontSize: 12,
                                    lineHeight: 1.3,
                                    px: 0.6,
                                    py: 0.15,
                                    borderRadius: 10,
                                    bgcolor: 'background.paper',
                                    color: 'text.primary',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: reaction.autor === 'agente' ? 'pointer' : 'default',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  {reaction.emoji}
                                </Box>
                              ))}
                            </Stack>
                          )}
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                            <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11 }}>
                              {formatMinutesAgo(msg.minutesAgo)}
                            </Typography>
                            {msg.from === 'me' && msg.status && msg.status !== 'failed' && (
                              <Typography variant="caption" sx={{ opacity: 0.75, display: 'flex' }}>
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
                          </Stack>
                        </Box>
                      </Box>
                    );

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSeparator && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                            <Divider sx={{ flex: 1 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                              {dayLabel}
                            </Typography>
                            <Divider sx={{ flex: 1 }} />
                          </Box>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            gap: 0.25,
                            mt: index === 0 || showDateSeparator ? 0 : isGroupedWithPrev ? 0.25 : 1,
                            '&:hover .msg-actions-bar': { opacity: 1 },
                          }}
                        >
                          {msg.from === 'me' ? (
                            <>
                              {actionsBar}
                              {bubble}
                            </>
                          ) : (
                            <>
                              {bubble}
                              {actionsBar}
                            </>
                          )}
                        </Box>
                      </React.Fragment>
                    );
                  })}
                  <Box ref={conversationEndRef} />
                </Paper>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1 }}>
                {/* Franja de contexto compacta: respuesta activa, adjunto
                    pendiente y errores de subida, todo agrupado encima del
                    textarea (antes el adjunto/error vivían debajo). Mismo
                    estado y misma lógica de cada uno, solo se unificó dónde
                    se muestran. */}
                {(replyingTo || pendingAttachmentFile || uploadError || isUploadingImage) && (
                  <Stack spacing={0.5} sx={{ mb: 1 }}>
                    {replyingTo && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
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
                    {isUploadingImage && (
                      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                        {uploadFileType === 'audio' ? 'Subiendo audio...' : 'Subiendo imagen...'}
                      </Typography>
                    )}
                    {uploadError && (
                      <Typography variant="caption" color="error" sx={{ px: 0.5 }}>
                        {uploadError}
                      </Typography>
                    )}
                    {pendingAttachmentFile && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
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
                            <ChatImage
                              src={pendingAttachmentPreviewUrl}
                              alt="Vista previa"
                              maxWidth={200}
                              maxHeight={200}
                              border
                            />
                          )}
                          {uploadFileType === 'audio' && recordedAudioUrl && (
                            <Box component="audio" controls src={recordedAudioUrl} />
                          )}
                          {uploadFileType === 'video' && pendingAttachmentPreviewUrl && (
                            <Box component="video" controls src={pendingAttachmentPreviewUrl} sx={{ maxWidth: 250, maxHeight: 250 }} />
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
                )}
                <Box component="form" onSubmit={handleSendWhatsapp}>
                  <Stack direction="row" spacing={0.5} alignItems="flex-end">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      hidden
                      onChange={handleUploadFile}
                    />
                    <Tooltip title="Adjuntar imagen o documento">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label="Adjuntar imagen"
                          onClick={handleSelectUpload}
                          disabled={isSending}
                        >
                          <AttachFileIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={isRecording ? 'Detener grabación' : 'Grabar audio'}>
                      <span>
                        <IconButton
                          size="small"
                          color={isRecording ? 'error' : 'primary'}
                          aria-label="Grabar audio"
                          onClick={handleToggleRecording}
                          disabled={isSending}
                        >
                          🎤
                        </IconButton>
                      </span>
                    </Tooltip>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={1}
                      maxRows={5}
                      placeholder="Escribe una respuesta rápida"
                      value={quickReply}
                      onChange={(e) => setQuickReply(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (isSending) return;
                          handleSendWhatsapp();
                          return;
                        }
                        if (event.key === 'Enter' && event.shiftKey) {
                          const el = quickReplyRef.current;
                          if (!el) return;
                          const result = computeListContinuation(
                            quickReply,
                            el.selectionStart ?? quickReply.length,
                            el.selectionEnd ?? quickReply.length
                          );
                          if (!result) return; // no es una línea de lista: deja el salto de línea normal
                          event.preventDefault();
                          setQuickReply(result.text);
                          requestAnimationFrame(() => {
                            el.selectionStart = result.cursorPos;
                            el.selectionEnd = result.cursorPos;
                          });
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
                          size="small"
                          color="primary"
                          aria-label="Enviar"
                          type="submit"
                          disabled={isSending || isUploadingImage}
                        >
                          <SendIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
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
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  color: 'text.disabled',
                }}
              >
                <ChatBubbleOutlineIcon sx={{ fontSize: 40 }} />
                <Typography variant="body2" color="text.secondary">
                  Selecciona un lead para ver la conversación.
                </Typography>
              </Box>
            )}
        </Box>
      </Box>
    </Box>
    {detailDialogs}
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
