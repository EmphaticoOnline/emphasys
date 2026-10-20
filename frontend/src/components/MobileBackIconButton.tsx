import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { neutralColors, whiteSurfaces } from '../theme/structural';
import { useBrand } from '../theme/brand/useBrand';
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
  const { activeBrand } = useBrand();
  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      sx={{
        backgroundColor: whiteSurfaces.floatingButton,
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
