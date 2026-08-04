import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import type { ContactoTelefonoMatch } from '../../types/contactos.types';
import { formatearTelefonoParaMostrar } from '../../utils/telefono';

type Props = {
  open: boolean;
  matches: ContactoTelefonoMatch[];
  saving: boolean;
  onCancel: () => void;
  onContinue: () => void;
};

const fieldLabel = (field: ContactoTelefonoMatch['matched_field']) =>
  field === 'telefono' ? 'Teléfono principal' : 'Teléfono secundario';

export default function TelefonoDuplicadoDialog({ open, matches, saving, onCancel, onContinue }: Props) {
  return (
    <Dialog open={open} onClose={saving ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Teléfono ya registrado</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          El teléfono ya está registrado en uno o más contactos. Puedes revisarlos o guardar de todos modos.
        </Typography>
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {matches.map((match, index) => (
            <Stack
              key={`${match.contacto_id}-${match.input_field}-${match.matched_field}-${index}`}
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              gap={1}
            >
              <div>
                <Typography fontWeight={600}>{match.nombre}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {match.tipo_contacto} · {fieldLabel(match.matched_field)} · {formatearTelefonoParaMostrar(match.normalized_phone)}
                </Typography>
              </div>
              <Button
                component="a"
                href={`/contactos/${match.contacto_id}`}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
              >
                Ver contacto
              </Button>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={onContinue} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar de todos modos'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
