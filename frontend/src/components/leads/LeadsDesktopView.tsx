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
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ForwardIcon from '@mui/icons-material/Forward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PersonIcon from '@mui/icons-material/Person';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import type { NavigateFunction } from 'react-router-dom';
import { SendWhatsappTemplateDialog } from '../SendWhatsappTemplateDialog';
import { ForwardMessageDialog, type ForwardableMessage } from '../ForwardMessageDialog';
import { linkifyMessageText } from '../LinkifiedText';
import { computeListContinuation } from '../../utils/messageListContinuation';
import { useMessageHighlight } from '../../hooks/useMessageHighlight';
import {
  buildLeadOwnerLabel,
  buildReplyPreviewText,
  formatFechaHora,
  formatMinutes,
  formatMinutesAgo,
} from '../../utils/leadsDerivation';
import type { Contacto } from '../../types/contactos.types';
import type {
  EtapaOportunidad,
  Lead,
  LeadConPrioridad,
  LeadScope,
  MotivoFinalizacion,
  NextAction,
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
  setLeadScope: React.Dispatch<React.SetStateAction<LeadScope>>;
  setScopeTouched: React.Dispatch<React.SetStateAction<boolean>>;
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
  vistaFinalizadas: boolean;
  setVistaFinalizadas: React.Dispatch<React.SetStateAction<boolean>>;
  vendorOptions: Contacto[];
  renderLeadCard: (lead: LeadConPrioridad) => React.ReactNode;

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
  uploadFileType: 'image' | 'document' | 'audio' | null;
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

const leadSelectMenuProps = {
  PaperProps: {
    sx: {
      '& .MuiMenuItem-root': {
        fontSize: '0.85rem',
      },
    },
  },
};

const MANAGE_TAGS_OPTION_VALUE = '__manage_tags__';
const nextActionOptions: NextAction[] = ['Responder', 'Llamar', 'Enviar cotización', 'Agendar demo', 'Cerrar'];
const priorityOptions: Priority[] = ['Alta', 'Media', 'Baja'];
const etapaOptions: EtapaOportunidad[] = ['nuevo', 'contactado', 'interesado', 'cotizado', 'negociacion', 'convertida', 'perdida'];

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
    setLeadScope,
    setScopeTouched,
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
    vistaFinalizadas,
    setVistaFinalizadas,
    vendorOptions,
    renderLeadCard,
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

              <ForwardMessageDialog
                open={Boolean(forwardMessage)}
                message={forwardMessage}
                excludeConversationId={selectedLead.id}
                onClose={() => setForwardMessage(null)}
                onForwarded={() => {
                  void loadConversations({ incremental: true });
                }}
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
                    // Solo se puede responder/reenviar un mensaje que ya quedó
                    // persistido en el backend (tiene un id real de
                    // crm.mensajes): los mensajes optimistas "sending"/"failed"
                    // todavía usan un tempId local y no existen en la base de
                    // datos, así que no hay nada a lo que referenciar todavía.
                    const canReply = !msg.tempId;
                    const replyButton = canReply ? (
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
                    ) : null;

                    const canForward = !msg.tempId;
                    const forwardButton = canForward ? (
                      <IconButton
                        className="reply-hover-btn"
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
                        sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.5 }}
                      >
                        <ForwardIcon fontSize="small" />
                      </IconButton>
                    ) : null;

                    const bubble = (
                      <Box
                        data-message-id={msg.id}
                        sx={{
                          maxWidth: '75%',
                          px: 1.25,
                          py: 0.75,
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
                              borderRadius: 1,
                              px: 1,
                              py: 0.5,
                              mb: 0.5,
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
                        {msg.text && (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {linkifyMessageText(msg.text)}
                          </Typography>
                        )}
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
                            {forwardButton}
                            {replyButton}
                            {bubble}
                          </>
                        ) : (
                          <>
                            {bubble}
                            {replyButton}
                            {forwardButton}
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
