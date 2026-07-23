import type { Theme } from '@mui/material/styles';
import type { StatusSize, StatusTone } from './status.types';

export function getStatusToneColor(theme: Theme, tone: StatusTone): string {
  if (tone === 'success') return theme.palette.success.main;
  if (tone === 'info') return theme.palette.info.main;
  if (tone === 'warning') return theme.palette.warning.dark;
  if (tone === 'error') return theme.palette.error.main;
  if (tone === 'blocked') return theme.palette.text.disabled;
  return theme.palette.text.secondary;
}

export function getStatusMetrics(size: StatusSize) {
  return size === 'small'
    ? { visualSize: 28, interactiveSize: 32, iconSize: 20 }
    : { visualSize: 24, interactiveSize: 32, iconSize: 18 };
}
