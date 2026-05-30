import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { GridDeviceProfile } from '../services/gridPreferencesService';

export function useDeviceProfile(): GridDeviceProfile {
  const theme = useTheme();
  const isTabletOrDown = useMediaQuery(theme.breakpoints.down('lg'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return useMemo<GridDeviceProfile>(() => {
    if (isMobile) return 'mobile';
    if (isTabletOrDown) return 'tablet';
    return 'desktop';
  }, [isMobile, isTabletOrDown]);
}
