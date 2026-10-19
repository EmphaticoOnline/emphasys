import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { neutralColors } from '../theme/structural';
import { activeBrand } from '../theme/brand/active';
import { elevation } from '../theme/elevation';

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
        boxShadow: elevation.floatingButton,
        '&:hover': { backgroundColor: neutralColors.slate[50] },
      }}
    >
      <ArrowBackIcon />
    </IconButton>
  );
}
