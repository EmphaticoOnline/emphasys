import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DoneIcon from '@mui/icons-material/Done';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MicIcon from '@mui/icons-material/Mic';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { linkifyMessageText } from '../LinkifiedText';
import { ForwardMessageDialog, type ForwardableMessage } from '../ForwardMessageDialog';
import { MessageActionsSheet, type ActionableMessage } from './MessageActionsSheet';
import { buildLeadOwnerLabel, buildReplyPreviewText, formatMinutesAgo } from '../../utils/leadsDerivation';
import { computeListContinuation } from '../../utils/messageListContinuation';
import { useMessageHighlight } from '../../hooks/useMessageHighlight';
import { TOPBAR_HEIGHT } from '../layoutConstants';
import type { Contacto } from '../../types/contactos.types';
import type { EtapaOportunidad, LeadConPrioridad, LeadScope, ReplyPreview } from '../../pages/LeadsPage';

// SidebarLayout (mobile) envuelve el <Outlet/> en un Box con mt: '56px' pero
// SIN height propio (solo compensa el AppBar fijo), así que un simple
// height: '100%' aquí no tiene contra qué resolverse y el historial no
// quedaría acotado para hacer scroll interno. Se ancla directamente al alto
// real de viewport menos el AppBar fijo (misma constante que ya usa
// SidebarLayout para ese AppBar), sin tocar el layout compartido.
const MOBILE_VIEWPORT_HEIGHT = `calc(100vh - ${TOPBAR_HEIGHT}px)`;

// Igual que MOBILE_VIEWPORT_HEIGHT pero solo para la pantalla de chat, con
// unidad dinámica de iOS (dvh) cuando el navegador la soporta: 100vh en
// Safari no descuenta la barra de direcciones/el teclado, lo que puede dejar
// la pantalla más alta que el viewport real visible. dvh sí se ajusta. Se
// declara aparte (no se toca MOBILE_VIEWPORT_HEIGHT, que sigue usando la
// bandeja) para no alterar el comportamiento ya validado de la bandeja.
const MOBILE_CHAT_HEIGHT_SX = {
  height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
  '@supports (height: 100dvh)': {
    height: `calc(100dvh - ${TOPBAR_HEIGHT}px)`,
  },
} as const;

// Vista móvil del módulo de Leads/conversaciones de WhatsApp (bandeja +
// historial + compositor de texto). LeadsPage.tsx sigue siendo dueño de todo
// el estado, el polling y la lógica de negocio (ventana de 24h, prioridad,
// permisos, orden, filtros, envío); este componente solo recibe esos valores
// ya resueltos y reutiliza exactamente handleSendWhatsapp para enviar. No
// incluye todavía adjuntos, audio, plantillas, reenvío ni respuesta a
// mensajes citados.
export interface LeadsMobileViewProps {
  leadsFiltradosOrdenados: LeadConPrioridad[];
  selectedLeadId: string;
  selectedLead: LeadConPrioridad | undefined;
  onSelectLead: (id: string) => void;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  leadScope: LeadScope;
  setLeadScope: React.Dispatch<React.SetStateAction<LeadScope>>;
  setScopeTouched: React.Dispatch<React.SetStateAction<boolean>>;
  canToggleScope: boolean;
  showMisChip: boolean;
  showTodosChip: boolean;
  shouldShowScopeChipGroup: boolean;
  vendedoresById: Record<number, Contacto>;
  vendedorContactoId: number | null;
  contactosById: Record<number, Contacto>;
  conversationScrollRef: React.RefObject<HTMLDivElement | null>;
  conversationEndRef: React.RefObject<HTMLDivElement | null>;
  quickReply: string;
  setQuickReply: React.Dispatch<React.SetStateAction<string>>;
  quickReplyRef: React.RefObject<HTMLInputElement | null>;
  handleSendWhatsapp: (event?: React.FormEvent<HTMLFormElement>) => void;
  isSending: boolean;
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
  handleRetryWhatsappSend: (leadId: string, tempId: string) => void;
  ventanaCerradaDialogOpen: boolean;
  setVentanaCerradaDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Adjuntos (imagen/documento): mismos estados, ref y funciones que ya usa
  // LeadsDesktopView, sin ninguna lógica nueva de subida ni validación.
  pendingAttachmentFile: File | null;
  pendingAttachmentPreviewUrl: string | null;
  uploadFileType: 'image' | 'document' | 'audio' | null;
  uploadFileName: string | null;
  uploadError: string | null;
  isUploadingImage: boolean;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  handleSelectUpload: () => void;
  handleUploadFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachment: () => void;
  // Notas de voz: mismos estados/funciones que ya usa (o podría usar)
  // LeadsDesktopView — MediaRecorder, MIME, cronómetro y límite de duración
  // viven enteramente en LeadsPage.tsx. Este componente solo agrega los
  // controles de grabación/preview/cancelar del compositor móvil.
  isRecording: boolean;
  recordingElapsedSeconds: number;
  recordedAudioUrl: string | null;
  recordedAudioDurationSeconds: number | null;
  handleToggleRecording: () => void;
  handleCancelRecording: () => void;
  // Menú de acciones por pulsación prolongada (copiar/ver/descargar) y
  // reenvío: forwardMessage/setForwardMessage y ForwardMessageDialog son
  // exactamente los mismos que ya usa LeadsDesktopView (mismo componente,
  // mismo estado en LeadsPage, ninguna lógica de reenvío duplicada).
  // snackbar/setSnackbar también son el mismo estado que ya usa desktop, solo
  // que hoy no se renderizaba ningún <Snackbar/> en esta vista.
  forwardMessage: ForwardableMessage | null;
  setForwardMessage: React.Dispatch<React.SetStateAction<ForwardableMessage | null>>;
  snackbar: { open: boolean; message: string; severity: 'success' | 'error' };
  setSnackbar: React.Dispatch<React.SetStateAction<{ open: boolean; message: string; severity: 'success' | 'error' }>>;
  loadConversations: (opts?: { incremental?: boolean }) => void;
  // Responder citando: mismo estado (replyingTo/setReplyingTo) y misma
  // focusReplyInput que ya usa LeadsDesktopView, viven en LeadsPage.tsx. La
  // barra "Respondiendo a" del compositor y el disparador "Responder" del
  // menú de pulsación prolongada son la única lógica nueva de esta vista.
  replyingTo: ReplyPreview | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<ReplyPreview | null>>;
  focusReplyInput: () => void;
  // Notifica (opcional) cuándo la pantalla de chat está mostrándose, para que
  // CRMPage pueda dejar de ocupar espacio con su encabezado/pestañas mientras
  // el chat móvil está abierto. No se usa para nada más: LeadsMobileView
  // sigue siendo la única fuente de verdad de qué pantalla mostrar.
  onChatOpenChange?: ((open: boolean) => void) | undefined;
}

// Duplicado deliberadamente pequeño de LeadsDesktopView (no se comparte
// todavía un módulo de presentación común, por indicación explícita de este
// bloque): mapa de color por etapa, puramente visual, sin lógica.
const etapaChipColor: Record<EtapaOportunidad, 'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success' | 'error'> = {
  nuevo: 'default',
  contactado: 'info',
  interesado: 'primary',
  cotizado: 'warning',
  negociacion: 'secondary',
  convertida: 'success',
  perdida: 'error',
};

// Duplicado deliberadamente pequeño de LeadsDesktopView: función pura sin
// closures, solo mapea un status a un ícono. Ver nota en el reporte del
// bloque sobre por qué no se comparte todavía.
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

// Formatea segundos como mm:ss para el cronómetro de grabación y la
// duración de la nota de voz pendiente. Función pura, sin closures.
function formatRecordingTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

// Duplicado deliberadamente pequeño de LeadsDesktopView (mismo criterio de
// no compartir todavía infraestructura nueva entre vistas). Precarga la
// imagen fuera del DOM (Image().decode(), con fallback a onload) y solo la
// revela cuando ya está completamente decodificada, para que la burbuja
// nunca muestre la imagen pintándose progresivamente ("barrido") mientras se
// descarga. Mientras tanto se muestra un Skeleton del mismo tamaño máximo.
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

type MobileMessage = LeadConPrioridad['conversation'][number];

// Copia value al portapapeles. navigator.clipboard requiere contexto seguro
// (https/localhost) y no siempre está disponible en Safari según el
// contexto de la llamada; el fallback con execCommand('copy') vía un
// <textarea> oculto cubre esos casos. Devuelve si realmente se copió, para
// no mostrar "Mensaje copiado" cuando en realidad falló.
async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // sigue al fallback
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

// Último segmento de la ruta de una mediaUrl (mismo origen, /uploads/<archivo>
// servido por express.static — ver backend/src/app.ts), para conservar al
// menos la extensión real del archivo al descargar.
function extractFilenameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const last = pathname.split('/').pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

// Documento: el nombre original se conservó en caption al enviarlo (ver
// handleSendWhatsapp en LeadsPage.tsx: caption = uploadFileName). Imagen y
// audio nunca tuvieron un nombre original guardado aparte (no existía esta
// función antes de este bloque): se usa el nombre real del archivo en el
// servidor, que al menos conserva la extensión correcta.
function resolveDownloadFilename(message: ActionableMessage): string {
  if (message.tipoContenido === 'document' && message.caption) return message.caption;
  const fromUrl = message.mediaUrl ? extractFilenameFromUrl(message.mediaUrl) : null;
  if (fromUrl) return fromUrl;
  if (message.tipoContenido === 'audio') return 'nota-de-voz';
  if (message.tipoContenido === 'image') return 'imagen';
  return 'archivo';
}

// Mismo patrón de descarga programática (ancla oculta con download=filename)
// que ya usa el módulo de documentos (documentosService.ts), adaptado a
// mediaUrl: al ser una URL propia del mismo origen (/uploads/...) servida sin
// autenticación (igual que los <a href> que ya abren estos archivos hoy), no
// hace falta fetch+blob — solo la navegación nativa del navegador. No se
// introduce ningún fetch ni se toca la protección SSRF del backend (esa
// protección aplica a la descarga server-side de medios ENTRANTES de
// WhatsApp, un flujo completamente distinto). En Safari/iOS el atributo
// download no siempre se respeta: el archivo se abre en pestaña nueva en vez
// de forzar "Guardar como", limitación conocida del navegador, no de esta
// implementación.
function triggerBrowserDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.target = '_blank';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

type LongPressHandlers = {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
  onPointerLeave: (event: React.PointerEvent) => void;
  onClickCapture: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
};

// Pulsación prolongada vía Pointer Events: cubre touch y mouse de forma
// unificada (incluye Safari/iOS 13+) sin depender de contextmenu, que en iOS
// no ofrece suficiente control. Arranca un timer en pointerdown; se cancela
// sin disparar nada si el dedo se mueve más allá de moveTolerance, si suelta
// antes de tiempo (pointerup), si el navegador toma el gesto como scroll
// nativo (pointercancel — ver touchAction:'pan-y' en el bubble) o si el
// componente se desmonta. Si el timer llega a completarse, dispara
// onLongPress y marca firedRef para que onClickCapture intercepte (preventDefault
// + stopPropagation) el "click" fantasma que el navegador dispara al soltar,
// evitando que además se abra el enlace/imagen normal.
function useLongPress(onLongPress: () => void, delay = 550, moveTolerance = 10): LongPressHandlers {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const firedRef = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  const onPointerDown = React.useCallback((event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    clearTimer();
    firedRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      onLongPress();
    }, delay);
  }, [clearTimer, delay, onLongPress]);

  const onPointerMove = React.useCallback((event: React.PointerEvent) => {
    if (!startRef.current || !timerRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > moveTolerance) {
      clearTimer();
    }
  }, [clearTimer, moveTolerance]);

  const onPointerUp = React.useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerCancel = React.useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerLeave = React.useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onClickCapture = React.useCallback((event: React.MouseEvent) => {
    if (firedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      firedRef.current = false;
    }
  }, []);

  const onContextMenu = React.useCallback((event: React.MouseEvent) => {
    // No se usa contextmenu para disparar el menú (insuficiente en iOS):
    // solo se suprime el menú contextual nativo para que no compita con el
    // ActionSheet propio.
    event.preventDefault();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onClickCapture, onContextMenu };
}

type MessageBubbleProps = {
  msg: MobileMessage;
  contactName: string;
  onLongPressMessage: (msg: MobileMessage) => void;
  highlightedMessageId: string | null;
  scrollToMessage: (messageId: string) => void;
};

function MessageBubble({ msg, contactName, onLongPressMessage, highlightedMessageId, scrollToMessage }: MessageBubbleProps) {
  const isMine = msg.from === 'me';
  const longPress = useLongPress(React.useCallback(() => onLongPressMessage(msg), [msg, onLongPressMessage]));
  const isHighlighted = highlightedMessageId === msg.id;

  return (
    <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
      <Box
        {...longPress}
        data-message-id={msg.id}
        role="button"
        aria-label="Mensaje. Mantén presionado para ver acciones."
        sx={{
          maxWidth: '82%',
          px: 1.25,
          py: 0.75,
          borderRadius: 1.5,
          bgcolor: isMine ? 'primary.main' : 'grey.100',
          color: isMine ? 'primary.contrastText' : 'text.primary',
          // pan-y: deja que el navegador maneje el scroll vertical nativo
          // (no lo bloquea) mientras Pointer Events sigue recibiendo los
          // eventos necesarios para detectar/cancelar la pulsación
          // prolongada. WebkitTouchCallout/userSelect apagan el callout y la
          // selección nativos de iOS/Android sobre la burbuja: se reemplazan
          // por las acciones explícitas del menú (Copiar texto, etc.), igual
          // que hace WhatsApp.
          touchAction: 'pan-y',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          ...(isHighlighted
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
              borderColor: isMine ? 'rgba(255,255,255,0.6)' : 'primary.main',
              bgcolor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              mb: 0.5,
              cursor: 'pointer',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', opacity: 0.9 }}>
              {msg.replyTo.from === 'me' ? 'Tú' : (contactName || 'Contacto')}
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
          <Box component="a" href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" sx={{ display: 'block' }}>
            <ChatImage
              src={msg.mediaUrl}
              alt="Imagen enviada"
              maxWidth="100%"
              maxHeight={280}
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
              sx={{ color: 'inherit', textDecoration: 'none', wordBreak: 'break-word' }}
            >
              {msg.caption || 'Documento adjunto'}
            </Typography>
          </Stack>
        )}
        {msg.tipoContenido === 'audio' && msg.mediaUrl && (
          <Box component="audio" controls src={msg.mediaUrl} sx={{ maxWidth: '100%' }} />
        )}
        {msg.tipoContenido === 'image' && msg.caption && (
          <Typography variant="body2">{msg.caption}</Typography>
        )}
        {msg.text && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {linkifyMessageText(msg.text)}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {formatMinutesAgo(msg.minutesAgo)}
          </Typography>
          {isMine && msg.status && (
            <Typography variant="caption" sx={{ opacity: 0.75, display: 'flex', alignItems: 'center' }}>
              {renderStatusIcon(msg.status)}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function LeadsMobileView(props: LeadsMobileViewProps) {
  const {
    leadsFiltradosOrdenados,
    selectedLeadId,
    selectedLead,
    onSelectLead,
    isLoadingConversations,
    isLoadingMessages,
    searchTerm,
    setSearchTerm,
    leadScope,
    setLeadScope,
    setScopeTouched,
    canToggleScope,
    showMisChip,
    showTodosChip,
    shouldShowScopeChipGroup,
    vendedoresById,
    vendedorContactoId,
    contactosById,
    conversationScrollRef,
    conversationEndRef,
    quickReply,
    setQuickReply,
    quickReplyRef,
    handleSendWhatsapp,
    isSending,
    sendErrorDialog,
    setSendErrorDialog,
    handleRetryWhatsappSend,
    ventanaCerradaDialogOpen,
    setVentanaCerradaDialogOpen,
    pendingAttachmentFile,
    pendingAttachmentPreviewUrl,
    uploadFileType,
    uploadFileName,
    uploadError,
    isUploadingImage,
    uploadInputRef,
    handleSelectUpload,
    handleUploadFile,
    handleRemoveAttachment,
    isRecording,
    recordingElapsedSeconds,
    recordedAudioUrl,
    recordedAudioDurationSeconds,
    handleToggleRecording,
    handleCancelRecording,
    forwardMessage,
    setForwardMessage,
    snackbar,
    setSnackbar,
    loadConversations,
    replyingTo,
    setReplyingTo,
    focusReplyInput,
    onChatOpenChange,
  } = props;

  // Scroll + resaltado ~2s al tocar la cita de un mensaje respondido. Mismo
  // hook que usa LeadsDesktopView, buscando dentro del mismo contenedor con
  // scroll (conversationScrollRef) que ya usa esta vista.
  const { highlightedMessageId, scrollToMessage } = useMessageHighlight(conversationScrollRef);

  // Estado puramente visual del menú de acciones (pulsación prolongada): qué
  // mensaje está seleccionado. El menú está "abierto" exactamente cuando hay
  // un mensaje seleccionado — no se necesita un booleano aparte. Las
  // acciones de negocio (reenviar, portapapeles del sistema) viven en
  // LeadsPage.tsx/ForwardMessageDialog, reutilizadas tal cual.
  const [selectedMessageForActions, setSelectedMessageForActions] = React.useState<MobileMessage | null>(null);
  const closeActionsSheet = React.useCallback(() => setSelectedMessageForActions(null), []);

  // Pantalla mostrada dentro del móvil (bandeja vs. chat). Es estado
  // puramente de presentación, local a esta vista: no toca selectedLeadId ni
  // ningún otro estado de LeadsPage. Se decidió así (en vez de limpiar
  // selectedLeadId al "regresar") porque el polling existente reselecciona
  // automáticamente el primer lead cuando no hay ninguno seleccionado
  // (loadConversations → setSelectedLeadId(current => current || firstId));
  // limpiar la selección real habría hecho que la bandeja "rebotara" de
  // vuelta al chat en el siguiente ciclo de polling (máx. 5s). Ver el
  // reporte del bloque para más detalle.
  const [manuallyBackToInbox, setManuallyBackToInbox] = React.useState(false);

  // Si el usuario (o el propio LeadsPage, p. ej. al cargar por primera vez)
  // cambia la conversación seleccionada, cualquier "regreso" manual previo
  // queda obsoleto y debe mostrarse el chat de la nueva conversación.
  React.useEffect(() => {
    setManuallyBackToInbox(false);
  }, [selectedLeadId]);

  // El menú de acciones de un mensaje deja de tener sentido si cambia la
  // conversación seleccionada (el mensaje seleccionado ya no es visible).
  React.useEffect(() => {
    setSelectedMessageForActions(null);
  }, [selectedLeadId]);

  // Una respuesta pendiente tampoco tiene sentido en otra conversación.
  // onSelectLead (handleSelectLeadMobile en LeadsPage.tsx) ya limpia
  // replyingTo al tocar un lead en la bandeja; este efecto es una
  // salvaguarda adicional para cualquier otra ruta que cambie selectedLeadId.
  React.useEffect(() => {
    setReplyingTo(null);
  }, [selectedLeadId, setReplyingTo]);

  const handleBack = () => {
    // Salir del chat mientras se graba no debe dejar el micrófono activo en
    // segundo plano: LeadsPage.tsx no ve este "regreso" (no toca
    // selectedLeadId, ver comentario arriba), así que se cancela aquí
    // explícitamente con la misma función que usa el botón "Cancelar".
    if (isRecording) {
      handleCancelRecording();
    }
    setSelectedMessageForActions(null);
    // Misma razón que arriba: "volver a la bandeja" es puramente local a
    // esta vista, LeadsPage.tsx no lo ve, así que la respuesta pendiente se
    // cancela aquí explícitamente.
    setReplyingTo(null);
    setManuallyBackToInbox(true);
  };

  const showChat = Boolean(selectedLeadId) && Boolean(selectedLead) && !manuallyBackToInbox;

  // CRMPage necesita saber si el chat está abierto para dejar de ocupar
  // espacio con su encabezado/pestañas (ver LeadsPage.tsx y CRMPage.tsx). No
  // decide nada aquí: solo informa hacia arriba el mismo valor ya calculado.
  React.useEffect(() => {
    onChatOpenChange?.(showChat);
  }, [showChat, onChatOpenChange]);

  // Acciones del menú de pulsación prolongada. MessageActionsSheet ya cierra
  // el menú después de invocar cualquiera de estas (ver onClose en su
  // ListItemButton), así que aquí solo se implementa el efecto de cada una.
  const handleCopyText = React.useCallback(async (text: string) => {
    const ok = await copyToClipboard(text);
    setSnackbar({
      open: true,
      message: ok ? 'Mensaje copiado' : 'No se pudo copiar el texto',
      severity: ok ? 'success' : 'error',
    });
  }, [setSnackbar]);

  const handleCopyLink = React.useCallback(async (url: string) => {
    const ok = await copyToClipboard(url);
    setSnackbar({
      open: true,
      message: ok ? 'Enlace copiado' : 'No se pudo copiar el enlace',
      severity: ok ? 'success' : 'error',
    });
  }, [setSnackbar]);

  // Ver imagen / Abrir documento: misma acción que ya ocurre al tocar
  // normalmente el <a href target="_blank"> de la burbuja — no es lógica
  // nueva, solo se ofrece también desde el menú.
  const handleViewMedia = React.useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleDownloadMedia = React.useCallback((message: ActionableMessage) => {
    if (!message.mediaUrl) return;
    triggerBrowserDownload(message.mediaUrl, resolveDownloadFilename(message));
  }, []);

  // Reenviar: arma el mismo ForwardableMessage que ya arma LeadsDesktopView
  // (mismo componente ForwardMessageDialog, mismo endpoint compartido por
  // mensaje_id — no vuelve a descargar ni subir el archivo).
  const handleForwardMessage = React.useCallback((message: ActionableMessage) => {
    setForwardMessage({
      id: message.id,
      tipoContenido: message.tipoContenido ?? 'text',
      text: message.text || '',
      caption: message.caption ?? null,
      mediaUrl: message.mediaUrl ?? null,
    });
  }, [setForwardMessage]);

  // Responder: arma el mismo ReplyPreview que ya arma LeadsDesktopView
  // (mismo estado replyingTo en LeadsPage.tsx, mismo mensaje_respuesta_id en
  // el requestBody de handleSendWhatsapp — no es un envío ni una persistencia
  // nueva, solo la selección visual de qué se está respondiendo).
  const handleReplyMessage = React.useCallback((message: ActionableMessage) => {
    setReplyingTo({
      id: message.id,
      from: message.from,
      preview: message.text || buildReplyPreviewText(message.tipoContenido ?? 'text', message.text, message.caption),
    });
    focusReplyInput();
  }, [setReplyingTo, focusReplyInput]);

  let screen: React.ReactNode;

  if (showChat && selectedLead) {
    const contacto = selectedLead.contactoId ? contactosById[Number(selectedLead.contactoId)] : undefined;
    const ownerLabel = buildLeadOwnerLabel(selectedLead, vendedoresById, vendedorContactoId);
    const subtitleParts = [selectedLead.phone, contacto?.zona, ownerLabel].filter(Boolean);

    screen = (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', ...MOBILE_CHAT_HEIGHT_SX }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <IconButton edge="start" aria-label="Regresar a la bandeja" onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {selectedLead.name?.trim() || `WhatsApp ${selectedLead.phone}`}
            </Typography>
            {subtitleParts.length > 0 && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {subtitleParts.join(' · ')}
              </Typography>
            )}
          </Box>
          {selectedLead.requiresTemplate && (
            <Chip size="small" label="Ventana cerrada" color="warning" variant="outlined" sx={{ flexShrink: 0 }} />
          )}
        </Box>

        <Box
          ref={conversationScrollRef}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {isLoadingMessages && selectedLead.conversation.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : selectedLead.conversation.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Aún no hay mensajes en esta conversación.
              </Typography>
            </Box>
          ) : (
            selectedLead.conversation.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                contactName={selectedLead.name}
                onLongPressMessage={setSelectedMessageForActions}
                highlightedMessageId={highlightedMessageId}
                scrollToMessage={scrollToMessage}
              />
            ))
          )}
          <Box ref={conversationEndRef} />
        </Box>

        {/* Compositor: mismo TextField/onKeyDown (Enter envía, Shift+Enter
            continúa listas vía computeListContinuation), mismo input de
            adjuntos (uploadInputRef/handleUploadFile), mismas notas de voz
            (isRecording/handleToggleRecording/handleCancelRecording) y el
            mismo handleSendWhatsapp de LeadsPage/LeadsDesktopView — misma
            lógica en los tres casos, sin duplicarla. Es un hijo flex normal
            (flexShrink: 0) del contenedor de altura controlada de la
            conversación, no position: fixed, tal como pide este bloque. */}
        <Box
          component="form"
          onSubmit={handleSendWhatsapp}
          sx={{
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            px: 1,
            pt: 1,
            pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
            bgcolor: 'background.paper',
          }}
        >
          {/* Barra "Respondiendo a": mismo estado (replyingTo/setReplyingTo)
              y mismo diseño que ya usa LeadsDesktopView (nombre + resumen
              truncado a una línea + botón X). Se cancela al tocar la X, al
              enviar (ver performWhatsappSend en LeadsPage.tsx, ya limpia
              replyingTo tras un envío exitoso), al cambiar de conversación,
              al volver a la bandeja (handleBack) y al desmontar (el estado
              vive en LeadsPage y desaparece con la página). Se muestra tanto
              en modo normal como durante una grabación: responder con una
              nota de voz es válido. */}
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
          {isRecording ? (
            // Mientras se graba, el compositor normal se reemplaza por
            // completo (sin campo de texto ni envío) por estos controles
            // mínimos: Cancelar y Detener, más el cronómetro en vivo. No se
            // sube ningún archivo todavía en este estado.
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
              <IconButton
                aria-label="Cancelar grabación"
                onClick={handleCancelRecording}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
              >
                <CloseIcon />
              </IconButton>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    flexShrink: 0,
                    animation: 'leadsMobileRecordingPulse 1.2s ease-in-out infinite',
                    '@keyframes leadsMobileRecordingPulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.25 },
                    },
                  }}
                />
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  Grabando · {formatRecordingTime(recordingElapsedSeconds)}
                </Typography>
              </Stack>
              <IconButton
                color="primary"
                aria-label="Detener grabación"
                onClick={handleToggleRecording}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
              >
                <StopIcon />
              </IconButton>
            </Stack>
          ) : (
            <>
              {isUploadingImage && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {uploadFileType === 'audio' ? 'Subiendo audio...' : 'Subiendo imagen...'}
                </Typography>
              )}
              {uploadError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
                  {uploadError}
                </Typography>
              )}
              {pendingAttachmentFile && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    {uploadFileType === 'document' && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DescriptionIcon fontSize="small" />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                          {uploadFileName || 'Documento adjunto'}
                        </Typography>
                      </Stack>
                    )}
                    {uploadFileType === 'image' && pendingAttachmentPreviewUrl && (
                      <ChatImage
                        src={pendingAttachmentPreviewUrl}
                        alt="Vista previa"
                        maxWidth={120}
                        maxHeight={120}
                        border
                        objectFit="cover"
                      />
                    )}
                    {uploadFileType === 'audio' && recordedAudioUrl && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          component="audio"
                          controls
                          src={recordedAudioUrl}
                          sx={{ height: 36, flexGrow: 1, minWidth: 0 }}
                        />
                        {recordedAudioDurationSeconds != null && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                            {formatRecordingTime(recordedAudioDurationSeconds)}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    aria-label="Quitar archivo adjunto"
                    onClick={handleRemoveAttachment}
                    disabled={isSending}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={handleUploadFile}
                />
                <IconButton
                  color="primary"
                  aria-label="Adjuntar archivo"
                  onClick={handleSelectUpload}
                  disabled={isSending || isUploadingImage}
                  sx={{ width: 44, height: 44, flexShrink: 0 }}
                >
                  <AttachFileIcon />
                </IconButton>
                <IconButton
                  color="primary"
                  aria-label="Grabar nota de voz"
                  onClick={handleToggleRecording}
                  disabled={isSending || isUploadingImage || Boolean(pendingAttachmentFile)}
                  sx={{ width: 44, height: 44, flexShrink: 0 }}
                >
                  <MicIcon />
                </IconButton>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  minRows={1}
                  maxRows={4}
                  placeholder="Escribe un mensaje"
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
                  sx={{ '& .MuiInputBase-root': { alignItems: 'flex-end' } }}
                />
                <IconButton
                  color="primary"
                  aria-label="Enviar"
                  type="submit"
                  disabled={isSending || isUploadingImage || Boolean(selectedLead.requiresTemplate)}
                  sx={{ width: 44, height: 44, flexShrink: 0 }}
                >
                  {isSending ? <CircularProgress size={22} /> : <SendIcon />}
                </IconButton>
              </Stack>
              {selectedLead.requiresTemplate && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                  La ventana de atención está cerrada. Envía una plantilla y espera la respuesta del cliente.
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    );
  } else {
    screen = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: MOBILE_VIEWPORT_HEIGHT, minHeight: 0 }}>
      <Box sx={{ px: 2, pt: 2, pb: 1, flexShrink: 0 }}>
        <Typography variant="h6" fontWeight={700}>
          Conversaciones
        </Typography>
      </Box>

      <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar por nombre, teléfono o mensajes"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" aria-label="Limpiar búsqueda" onClick={() => setSearchTerm('')}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
      </Box>

      {shouldShowScopeChipGroup && (
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 1, flexShrink: 0 }}>
          {showMisChip && (
            <Chip
              label="Mis leads"
              size="small"
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
              size="small"
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

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {isLoadingConversations && leadsFiltradosOrdenados.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : leadsFiltradosOrdenados.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No hay conversaciones para mostrar.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {leadsFiltradosOrdenados.map((lead) => {
              const contacto = lead.contactoId ? contactosById[Number(lead.contactoId)] : undefined;
              const ownerLabel = buildLeadOwnerLabel(lead, vendedoresById, vendedorContactoId);
              const requiresAttention = lead.statusType === 'attention';

              return (
                <React.Fragment key={lead.id}>
                  <ListItemButton
                    onClick={() => onSelectLead(lead.id)}
                    selected={lead.id === selectedLeadId}
                    sx={{
                      alignItems: 'flex-start',
                      py: 1.25,
                      px: 2,
                      borderLeft: '3px solid',
                      borderLeftColor: requiresAttention ? 'error.main' : 'transparent',
                    }}
                  >
                    <Stack spacing={0.35} sx={{ width: '100%', minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                          {lead.name?.trim() || `WhatsApp ${lead.phone}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {formatMinutesAgo(lead.lastMessageTimeMinutesAgo)}
                        </Typography>
                      </Stack>
                      {contacto?.zona && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {contacto.zona}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {lead.lastMessage || 'Sin mensajes'}
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        {lead.etapa_oportunidad && (
                          <Chip
                            size="small"
                            label={lead.etapa_oportunidad}
                            color={etapaChipColor[lead.etapa_oportunidad]}
                            sx={{ textTransform: 'capitalize', height: 20 }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {ownerLabel}
                        </Typography>
                        {requiresAttention && (
                          <Chip size="small" label="Requiere atención" color="error" sx={{ height: 20, fontWeight: 700 }} />
                        )}
                        {lead.requiresTemplate && (
                          <Chip size="small" label="Ventana cerrada" color="warning" variant="outlined" sx={{ height: 20 }} />
                        )}
                      </Stack>
                    </Stack>
                  </ListItemButton>
                  <Divider component="li" />
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
    );
  }

  return (
    <>
      {screen}

      {/* Misma representación de error de envío que LeadsDesktopView (mismo
          texto, mismo botón "Reintentar" cuando es recuperable), usando el
          estado y callback que siguen viviendo en LeadsPage: sendErrorDialog,
          setSendErrorDialog y handleRetryWhatsappSend. */}
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

      {/* Mismo texto que LeadsDesktopView para la ventana de 24h cerrada.
          Diferencia exclusivamente visual: se omite el botón "Enviar
          plantilla" porque el selector de plantillas todavía no existe en
          móvil (fuera de alcance de este bloque) — solo queda "Entendido". */}
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
          <Button onClick={() => setVentanaCerradaDialogOpen(false)} variant="contained">
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menú de acciones por pulsación prolongada. El estado (qué mensaje
          está seleccionado) es puramente visual y vive en esta vista; las
          acciones que ejecuta (copiar, ver, descargar, reenviar) están
          arriba. */}
      <MessageActionsSheet
        open={Boolean(selectedMessageForActions)}
        message={selectedMessageForActions}
        onClose={closeActionsSheet}
        onCopyText={handleCopyText}
        onCopyLink={handleCopyLink}
        onView={handleViewMedia}
        onDownload={handleDownloadMedia}
        onReply={handleReplyMessage}
        onForward={handleForwardMessage}
      />

      {/* Mismo componente y mismo estado (forwardMessage/setForwardMessage)
          que ya usa LeadsDesktopView: ningún flujo de reenvío nuevo ni
          duplicado. */}
      <ForwardMessageDialog
        open={Boolean(forwardMessage)}
        message={forwardMessage}
        excludeConversationId={selectedLead?.id ?? null}
        onClose={() => setForwardMessage(null)}
        onForwarded={() => {
          void loadConversations({ incremental: true });
        }}
      />

      {/* Mismo estado snackbar que ya usa LeadsDesktopView (pasado ahora
          también a esta vista); antes esta vista no renderizaba ningún
          Snackbar. */}
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
    </>
  );
}
