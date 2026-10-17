import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { neutralColors } from '../theme/structural';
import { activeBrand } from '../theme/brand/active';

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
        color: activeBrand.colors.blue.base,
        border: `1px solid ${neutralColors.steel.line}`,
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
        '&:hover': { backgroundColor: neutralColors.slate[50] },
      }}
    >
      <ArrowBackIcon />
    </IconButton>
  );
}
