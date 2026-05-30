import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

type MobileBackIconButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export default function MobileBackIconButton({
  onClick,
  disabled = false,
  ariaLabel = 'Regresar',
}: MobileBackIconButtonProps) {
  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      sx={{
        backgroundColor: '#ffffff',
        color: '#1d2f68',
        border: '1px solid #dbe3f0',
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
        '&:hover': { backgroundColor: '#f8fafc' },
      }}
    >
      <ArrowBackIcon />
    </IconButton>
  );
}
