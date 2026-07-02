import { Button, CircularProgress, Paper } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

type FloatingFormActionsProps = {
  onBack: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  onSave?: () => void;
  saveType?: 'button' | 'submit';
  saveLabel?: string;
  savingLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  bottomOffset?: number;
};

export default function FloatingFormActions({
  onBack,
  backLabel = 'Volver',
  backDisabled = false,
  onSave,
  saveType = 'button',
  saveLabel = 'Guardar',
  savingLabel = 'Guardando...',
  saving = false,
  saveDisabled = false,
  bottomOffset = 24,
}: FloatingFormActionsProps) {
  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        right: 24,
        bottom: bottomOffset,
        zIndex: (theme) => theme.zIndex.fab,
        display: 'flex',
        gap: 1,
        p: 1,
        borderRadius: 2,
      }}
    >
      <Button variant="outlined" onClick={onBack} disabled={backDisabled}>
        {backLabel}
      </Button>
      <Button
        variant="contained"
        type={saveType}
        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
        onClick={saveType === 'submit' ? undefined : onSave}
        disabled={saveDisabled || saving}
        sx={{
          backgroundColor: '#1d2f68',
          '&:hover': { backgroundColor: '#162551' },
        }}
      >
        {saving ? savingLabel : saveLabel}
      </Button>
    </Paper>
  );
}
