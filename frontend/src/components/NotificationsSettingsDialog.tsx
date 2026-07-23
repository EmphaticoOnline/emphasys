import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DevicesIcon from '@mui/icons-material/Devices';
import {
  deactivateCurrentDevice,
  deactivateOtherDevice,
  getCurrentDeviceRecord,
  isIos,
  isStandalone,
  listActiveSubscriptions,
  resolvePushState,
  subscribeToPush,
  type PushSubscriptionRecord,
  type PushUiState,
} from '../services/pushNotificationsService';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ESTADO_TEXTO: Record<PushUiState, string> = {
  checking: 'Comprobando compatibilidad…',
  unsupported: 'Este navegador no es compatible.',
  'not-subscribed': 'Este dispositivo no está registrado.',
  subscribed: 'Notificaciones activadas en este dispositivo.',
  blocked: 'Las notificaciones están bloqueadas en el navegador.',
  error: 'No fue posible completar el registro.',
};

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function NotificationsSettingsDialog({ open, onClose }: Props) {
  const [state, setState] = React.useState<PushUiState>('checking');
  const [busy, setBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [devices, setDevices] = React.useState<PushSubscriptionRecord[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = React.useState<string | null>(null);

  // No se pide permiso aquí: este efecto solo LEE el estado actual del
  // navegador/Service Worker (resolvePushState, getCurrentDeviceRecord) y
  // el listado ya guardado en el backend. El permiso solo se solicita
  // dentro de handleActivar, en respuesta directa al clic del usuario.
  const refresh = React.useCallback(async () => {
    setErrorMessage(null);
    const nextState = await resolvePushState();
    setState(nextState);

    if (nextState === 'unsupported' || nextState === 'blocked') {
      setDevices([]);
      setCurrentDeviceId(null);
      return;
    }

    try {
      const [list, current] = await Promise.all([listActiveSubscriptions(), getCurrentDeviceRecord()]);
      setDevices(list);
      setCurrentDeviceId(current?.id ?? null);
    } catch (error: any) {
      console.error('[Notificaciones] Error al leer suscripciones:', error);
      // El estado de "este dispositivo" ya se resolvió arriba sin tocar el
      // backend; un fallo aquí solo afecta la lista de dispositivos.
      setDevices([]);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setState('checking');
    void refresh();
  }, [open, refresh]);

  const handleActivar = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await subscribeToPush();
      await refresh();
    } catch (error: any) {
      console.error('[Notificaciones] Error al activar:', error);
      setState((Notification.permission === 'denied') ? 'blocked' : 'error');
      setErrorMessage(error?.message || 'No se pudo activar las notificaciones.');
    } finally {
      setBusy(false);
    }
  };

  const handleDesactivarEsteDispositivo = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await deactivateCurrentDevice();
      await refresh();
    } catch (error: any) {
      console.error('[Notificaciones] Error al desactivar:', error);
      setErrorMessage(error?.message || 'No se pudo desactivar la suscripción de este dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  const handleDesactivarOtro = async (id: string) => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await deactivateOtherDevice(id);
      await refresh();
    } catch (error: any) {
      console.error('[Notificaciones] Error al desactivar dispositivo ajeno:', error);
      setErrorMessage(error?.message || 'No se pudo desactivar ese dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  const mostrarSugerenciaIphone = isIos() && !isStandalone();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Notificaciones de Emphasys
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <Alert severity={state === 'subscribed' ? 'success' : state === 'blocked' || state === 'error' ? 'warning' : 'info'}>
            {ESTADO_TEXTO[state]}
          </Alert>

          {state === 'blocked' && (
            <Typography variant="body2" color="text.secondary">
              El navegador ya no permite volver a solicitar el permiso. Actívalo manualmente desde los ajustes
              del sitio (ícono de candado o de información junto a la dirección) y vuelve a abrir esta ventana.
            </Typography>
          )}

          {mostrarSugerenciaIphone && (
            <Typography variant="body2" color="text.secondary">
              En iPhone, Emphasys debe instalarse desde "Agregar a pantalla de inicio" para recibir notificaciones.
            </Typography>
          )}

          {(state === 'not-subscribed' || state === 'error') && (
            <Button
              variant="contained"
              onClick={handleActivar}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {busy ? 'Activando…' : 'Activar notificaciones'}
            </Button>
          )}

          {state === 'subscribed' && (
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleDesactivarEsteDispositivo}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Desactivar en este dispositivo
            </Button>
          )}

          {devices.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DevicesIcon fontSize="small" /> Dispositivos registrados
              </Typography>
              <List dense disablePadding>
                {devices.map((device) => (
                  <ListItem
                    key={device.id}
                    disableGutters
                    secondaryAction={
                      device.id !== currentDeviceId ? (
                        <Button size="small" onClick={() => handleDesactivarOtro(device.id)} disabled={busy}>
                          Desactivar
                        </Button>
                      ) : (
                        <Chip label="Este dispositivo" size="small" color="primary" variant="outlined" />
                      )
                    }
                  >
                    <ListItemText
                      primary={device.nombre_dispositivo || device.plataforma || 'Dispositivo'}
                      secondary={`Registrado el ${formatFecha(device.creada_en)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
