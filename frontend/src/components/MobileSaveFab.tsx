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
        sx={{
          backgroundColor: '#1d2f68',
          color: '#ffffff',
          boxShadow: '0 12px 28px rgba(29, 47, 104, 0.28)',
          '&:hover': { backgroundColor: '#162551' },
        }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : <SaveIcon />}
      </Fab>
    </Box>
  );
}
