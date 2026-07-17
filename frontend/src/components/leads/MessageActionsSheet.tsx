import React from 'react';
import {
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import ForwardIcon from '@mui/icons-material/Forward';
import ReplyIcon from '@mui/icons-material/Reply';
import { findSingleUrl } from '../LinkifiedText';

// Mensaje mínimo que necesita este menú para decidir qué acciones mostrar.
// Deliberadamente más chico que el tipo completo de mensaje de LeadsPage
// (MobileMessage): solo los campos que realmente se usan aquí, para que este
// componente no dependa de la forma exacta de esa lista.
export type ActionableMessage = {
  id: string;
  tempId?: string;
  from: 'lead' | 'me';
  text: string;
  tipoContenido?: 'text' | 'image' | 'audio' | 'document';
  mediaUrl?: string | null;
  caption?: string | null;
};

type Props = {
  open: boolean;
  message: ActionableMessage | null;
  onClose: () => void;
  onCopyText: (text: string) => void;
  onCopyLink: (url: string) => void;
  onView: (url: string) => void;
  onDownload: (message: ActionableMessage) => void;
  onReply: (message: ActionableMessage) => void;
  onForward: (message: ActionableMessage) => void;
};

type SheetAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

// Menú inferior (bottom sheet) de acciones sobre un mensaje, disparado por
// pulsación prolongada desde LeadsMobileView (ver useLongPress ahí). Decide
// qué acciones mostrar según tipoContenido/tempId/mediaUrl; la ejecución real
// de cada acción (portapapeles, descarga, abrir, reenviar) vive en
// LeadsMobileView/LeadsPage, este componente solo la dispara.
export function MessageActionsSheet({
  open,
  message,
  onClose,
  onCopyText,
  onCopyLink,
  onView,
  onDownload,
  onReply,
  onForward,
}: Props) {
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);

  // Conserva el último mensaje no nulo mientras el Drawer hace su animación
  // de cierre (open pasa a false pero el contenido no debe desaparecer de
  // golpe): LeadsMobileView limpia el mensaje seleccionado inmediatamente al
  // cerrar, no espera a que termine la transición.
  const [displayMessage, setDisplayMessage] = React.useState<ActionableMessage | null>(message);
  React.useEffect(() => {
    if (message) setDisplayMessage(message);
  }, [message]);

  // Foco razonable al abrir: al botón menos destructivo (Cancelar).
  React.useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const singleUrl = React.useMemo(() => {
    if (!displayMessage || (displayMessage.tipoContenido ?? 'text') !== 'text') return null;
    return findSingleUrl(displayMessage.text);
  }, [displayMessage]);

  if (!displayMessage) return null;

  const tipo = displayMessage.tipoContenido ?? 'text';
  const hasMedia = Boolean(displayMessage.mediaUrl);
  // Solo se puede responder/reenviar un mensaje ya persistido en el backend
  // (tiene un id real, no un tempId local optimista) — misma regla que
  // LeadsDesktopView.
  const canReply = !displayMessage.tempId;
  const canForward = !displayMessage.tempId;

  const actions: SheetAction[] = [];

  if (canReply) {
    actions.push({
      key: 'reply',
      label: 'Responder',
      icon: <ReplyIcon fontSize="small" />,
      onClick: () => onReply(displayMessage),
    });
  }

  if (tipo === 'text') {
    if (displayMessage.text) {
      actions.push({
        key: 'copy-text',
        label: 'Copiar texto',
        icon: <ContentCopyIcon fontSize="small" />,
        onClick: () => onCopyText(displayMessage.text),
      });
    }
    if (singleUrl) {
      actions.push({
        key: 'copy-link',
        label: 'Copiar enlace',
        icon: <LinkIcon fontSize="small" />,
        onClick: () => onCopyLink(singleUrl),
      });
    }
  } else if (tipo === 'image' && hasMedia) {
    actions.push({
      key: 'view',
      label: 'Ver imagen',
      icon: <VisibilityIcon fontSize="small" />,
      onClick: () => onView(displayMessage.mediaUrl as string),
    });
    actions.push({
      key: 'download',
      label: 'Descargar',
      icon: <DownloadIcon fontSize="small" />,
      onClick: () => onDownload(displayMessage),
    });
  } else if (tipo === 'document' && hasMedia) {
    actions.push({
      key: 'open',
      label: 'Abrir documento',
      icon: <DescriptionIcon fontSize="small" />,
      onClick: () => onView(displayMessage.mediaUrl as string),
    });
    actions.push({
      key: 'download',
      label: 'Descargar',
      icon: <DownloadIcon fontSize="small" />,
      onClick: () => onDownload(displayMessage),
    });
  } else if (tipo === 'audio' && hasMedia) {
    actions.push({
      key: 'download',
      label: 'Descargar',
      icon: <DownloadIcon fontSize="small" />,
      onClick: () => onDownload(displayMessage),
    });
  }

  if (canForward) {
    actions.push({
      key: 'forward',
      label: 'Reenviar',
      icon: <ForwardIcon fontSize="small" />,
      onClick: () => onForward(displayMessage),
    });
  }

  const previewText = tipo === 'document'
    ? (displayMessage.caption || 'Documento adjunto')
    : tipo === 'image'
      ? (displayMessage.caption || 'Imagen')
      : tipo === 'audio'
        ? 'Nota de voz'
        : displayMessage.text;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { borderTopLeftRadius: 12, borderTopRightRadius: 12, pb: 'env(safe-area-inset-bottom, 0px)' },
      }}
      // role/aria-label sobre el propio contenido del panel, no sobre
      // PaperProps: MUI no reenvía atributos aria arbitrarios vía PaperProps
      // de forma consistente entre versiones, así que se aplican aquí.
    >
      <Box role="menu" aria-label="Acciones del mensaje">
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {previewText}
          </Typography>
        </Box>
        <List sx={{ py: 0 }}>
          {actions.map((action) => (
            <ListItemButton
              key={action.key}
              role="menuitem"
              onClick={() => {
                action.onClick();
                onClose();
              }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{action.icon}</ListItemIcon>
              <ListItemText primary={action.label} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
          <Button
            ref={cancelButtonRef}
            fullWidth
            variant="outlined"
            color="inherit"
            aria-label="Cancelar"
            onClick={onClose}
            sx={{ minHeight: 48 }}
          >
            Cancelar
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
