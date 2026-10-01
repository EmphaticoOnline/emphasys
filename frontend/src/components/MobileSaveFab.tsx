import { Box, CircularProgress, Fab } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

type MobileSaveFabProps = {
  loading: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
};

export default function MobileSaveFab({
  loading,
  disabled = false,
  ariaLabel,
  onClick,
  type = 'button',
}: MobileSaveFabProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: (theme) => theme.zIndex.fab,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Fab
        aria-label={ariaLabel ?? (loading ? 'Guardando' : 'Guardar')}
        color="primary"
        type={type}
        disabled={disabled}
        onClick={onClick}
        sx={(theme) => ({
          backgroundColor: theme.emphasys.action.primary,
          color: theme.emphasys.action.primaryForeground,
          boxShadow: '0 16px 40px rgba(44, 49, 56, 0.18)',
          '&:hover': { backgroundColor: theme.emphasys.action.primaryHover },
        })}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : <SaveIcon />}
      </Fab>
    </Box>
  );
}
