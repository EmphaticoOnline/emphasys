import React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BlockIcon from '@mui/icons-material/Block';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { apiFetch } from '../api/apiClient';
import { linkifyMessageText } from './LinkifiedText';

// Debe reflejar MAX_REENVIO_DESTINATARIOS en
// backend/src/whatsapp/whatsapp.service.ts. El backend es la fuente de
// verdad y vuelve a validar este límite; aquí solo se usa para dar
// retroalimentación inmediata en la interfaz sin esperar al servidor.
const MAX_FORWARD_RECIPIENTS = 20;
const MIN_SEARCH_CHARS = 2;

export type ForwardableMessage = {
  id: string;
  tipoContenido: 'text' | 'image' | 'audio' | 'document';
  text: string;
  caption?: string | null;
  mediaUrl?: string | null;
};

type ConversacionBusqueda = {
  id: string;
  nombre: string | null;
  telefono: string | null;
};

type ReenvioStatus =
  | 'enviado'
  | 'ventana_cerrada'
  | 'archivo_no_disponible'
  | 'no_autorizado'
  | 'conversacion_invalida'
  | 'error';

type ReenvioResultado = {
  conversacion_id: number;
  nombre: string | null;
  status: ReenvioStatus;
  mensaje_usuario: string | null;
};

const STATUS_LABEL: Record<ReenvioStatus, string> = {
  enviado: 'Enviado',
  ventana_cerrada: 'Ventana de 24h cerrada',
  archivo_no_disponible: 'Archivo no disponible',
  no_autorizado: 'Sin autorización',
  conversacion_invalida: 'Conversación inválida',
  error: 'Error al enviar',
};

function StatusIcon({ status }: { status: ReenvioStatus }) {
  if (status === 'enviado') return <CheckCircleIcon fontSize="small" color="success" />;
  if (status === 'ventana_cerrada') return <ScheduleIcon fontSize="small" color="warning" />;
  if (status === 'no_autorizado') return <BlockIcon fontSize="small" color="disabled" />;
  return <ErrorOutlineIcon fontSize="small" color="error" />;
}

type Props = {
  open: boolean;
  message: ForwardableMessage | null;
  excludeConversationId?: string | null;
  onClose: () => void;
  onForwarded?: () => void;
};

export function ForwardMessageDialog({ open, message, excludeConversationId, onClose, onForwarded }: Props) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<ConversacionBusqueda[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<Map<string, ConversacionBusqueda>>(new Map());
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [resultados, setResultados] = React.useState<ReenvioResultado[] | null>(null);

  const resetState = React.useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSearchResults([]);
    setSelected(new Map());
    setIsSending(false);
    setSendError(null);
    setResultados(null);
  }, []);

  React.useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  React.useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  React.useEffect(() => {
    if (!open) return;
    if (debouncedSearchTerm.length < MIN_SEARCH_CHARS) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    apiFetch(`/api/whatsapp/conversaciones?search=${encodeURIComponent(debouncedSearchTerm)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('search failed'))))
      .then((data: Array<{ id: string; nombre?: string | null; telefono?: string | null }>) => {
        if (cancelled) return;
        // El endpoint no pagina: se limita en el cliente a un puñado de
        // resultados para mantener el selector usable con búsquedas amplias.
        const mapped = data
          .filter((c) => String(c.id) !== String(excludeConversationId ?? ''))
          .slice(0, MAX_FORWARD_RECIPIENTS)
          .map((c) => ({ id: String(c.id), nombre: c.nombre ?? null, telefono: c.telefono ?? null }));
        setSearchResults(mapped);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm, open, excludeConversationId]);

  const toggleSelected = (conv: ConversacionBusqueda) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(conv.id)) {
        next.delete(conv.id);
      } else if (next.size < MAX_FORWARD_RECIPIENTS) {
        next.set(conv.id, conv);
      }
      return next;
    });
  };

  const removeSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!message || selected.size === 0 || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      const response = await apiFetch('/api/whatsapp/reenviar-mensaje', {
        method: 'POST',
        body: JSON.stringify({
          mensaje_id: Number(message.id),
          conversaciones_destino: Array.from(selected.keys()).map((id) => Number(id)),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setSendError(payload?.message || 'No se pudo reenviar el mensaje.');
        return;
      }

      setResultados(payload?.resultados ?? []);
      onForwarded?.();
    } catch (error) {
      console.error('[ForwardMessageDialog] Error de red al reenviar', error);
      setSendError('Error de red al reenviar el mensaje. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  const renderPreview = () => {
    if (!message) return null;
    if (message.tipoContenido === 'image' && message.mediaUrl) {
      return (
        <Stack spacing={0.5}>
          <Box component="img" src={message.mediaUrl} alt="Vista previa" sx={{ maxWidth: 200, maxHeight: 200, borderRadius: 1 }} />
          {message.caption && <Typography variant="body2">{message.caption}</Typography>}
        </Stack>
      );
    }
    if (message.tipoContenido === 'document') {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <DescriptionIcon fontSize="small" />
          <Typography variant="body2">{message.caption || 'Documento adjunto'}</Typography>
        </Stack>
      );
    }
    if (message.tipoContenido === 'audio' && message.mediaUrl) {
      return <Box component="audio" controls src={message.mediaUrl} sx={{ maxWidth: 250 }} />;
    }
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {linkifyMessageText(message.text)}
      </Typography>
    );
  };

  return (
    <Dialog open={open} onClose={isSending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Reenviar mensaje
        <IconButton size="small" onClick={onClose} disabled={isSending}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={{ p: 1.25, bgcolor: 'grey.100', borderRadius: 1 }}>{renderPreview()}</Box>

          {resultados ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Resultado del reenvío</Typography>
              <List dense disablePadding>
                {resultados.map((r) => (
                  <Box key={r.conversacion_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <StatusIcon status={r.status} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" noWrap>{r.nombre || `Conversación ${r.conversacion_id}`}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {STATUS_LABEL[r.status]}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </List>
            </Stack>
          ) : (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Destinatarios ({selected.size}/{MAX_FORWARD_RECIPIENTS})
                </Typography>
                {selected.size > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {Array.from(selected.values()).map((conv) => (
                      <Chip
                        key={conv.id}
                        label={conv.nombre || conv.telefono || conv.id}
                        size="small"
                        onDelete={() => removeSelected(conv.id)}
                        disabled={isSending}
                      />
                    ))}
                  </Stack>
                )}
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Buscar lead o contacto por nombre o teléfono"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isSending}
                />
                {isSearching && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <CircularProgress size={20} />
                  </Box>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <List dense sx={{ maxHeight: 220, overflow: 'auto' }}>
                    {searchResults.map((conv) => {
                      const isSelected = selected.has(conv.id);
                      return (
                        <ListItemButton
                          key={conv.id}
                          onClick={() => toggleSelected(conv)}
                          disabled={isSending || (!isSelected && selected.size >= MAX_FORWARD_RECIPIENTS)}
                          dense
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox edge="start" checked={isSelected} tabIndex={-1} disableRipple size="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={conv.nombre || 'Sin nombre'}
                            secondary={conv.telefono || undefined}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                )}
                {!isSearching && debouncedSearchTerm.length >= MIN_SEARCH_CHARS && searchResults.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Sin resultados para "{debouncedSearchTerm}".
                  </Typography>
                )}
                {debouncedSearchTerm.length > 0 && debouncedSearchTerm.length < MIN_SEARCH_CHARS && (
                  <Typography variant="caption" color="text.secondary">
                    Escribe al menos {MIN_SEARCH_CHARS} caracteres para buscar.
                  </Typography>
                )}
              </Stack>
            </>
          )}

          {sendError && <Alert severity="error">{sendError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {resultados ? (
          <Button onClick={onClose} variant="contained">Cerrar</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={isSending}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              disabled={selected.size === 0 || isSending}
              startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isSending ? 'Enviando...' : `Reenviar (${selected.size})`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
