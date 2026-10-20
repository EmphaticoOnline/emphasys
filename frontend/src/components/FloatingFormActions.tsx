import { Button, CircularProgress, Paper } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import SaveIcon from '@mui/icons-material/Save';
import { useBrand } from '../theme/brand/useBrand';

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
  appearance?: 'default' | 'graphite';
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
  appearance = 'default',
}: FloatingFormActionsProps) {
  const { activeBrand, brandElevation } = useBrand();
  const graphite = appearance === 'graphite';
  return (
    <Paper
      elevation={graphite ? 0 : 6}
      sx={(theme) => ({
        position: 'fixed',
        right: 24,
        bottom: bottomOffset,
        zIndex: theme.zIndex.fab,
        display: 'flex',
        gap: 1,
        p: 1,
        borderRadius: 2,
        ...(graphite ? {
          bgcolor: theme.emphasys.content.elevated,
          border: `1px solid ${theme.emphasys.content.border}`,
          boxShadow: brandElevation.floating,
        } : {}),
      })}
    >
      <Button
        variant="outlined"
        onClick={onBack}
        disabled={backDisabled}
        startIcon={graphite ? <CloseOutlinedIcon sx={{ fontSize: 18 }} /> : undefined}
        sx={(theme) => graphite ? ({
          textTransform: 'none',
          fontWeight: 700,
          color: theme.emphasys.content.foreground,
          borderColor: theme.emphasys.content.border,
          bgcolor: theme.emphasys.content.card,
          '&:hover': { borderColor: theme.emphasys.content.foreground, bgcolor: theme.emphasys.content.hover },
        }) : {}}
      >
        {backLabel}
      </Button>
      <Button
        variant="contained"
        type={saveType}
        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
        onClick={saveType === 'submit' ? undefined : onSave}
        disabled={saveDisabled || saving}
        sx={graphite ? (theme) => ({
          textTransform: 'none',
          fontWeight: 700,
          backgroundColor: theme.emphasys.action.primary,
          color: theme.emphasys.action.primaryForeground,
          '&:hover': { backgroundColor: theme.emphasys.action.primaryHover },
          '&.Mui-disabled': { backgroundColor: theme.emphasys.action.disabled, color: theme.emphasys.action.primaryForeground },
        }) : {
          backgroundColor: activeBrand.colors.blue.base,
          '&:hover': { backgroundColor: activeBrand.colors.blue.hover },
        }}
      >
        {saving ? savingLabel : saveLabel}
      </Button>
    </Paper>
  );
}
