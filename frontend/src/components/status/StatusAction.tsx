import * as React from 'react';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { getStatusMetrics, getStatusToneColor } from './status.semantics';
import type { StatusActionProps } from './status.types';

export default function StatusAction({
  icon: Icon,
  label,
  ariaLabel = label,
  tone = 'neutral',
  onClick,
  menuId,
  menuOpen,
  disabled = false,
  loading = false,
  tooltip,
  showMenuAffordance = false,
  size = 'compact',
  stopRowEvents = true,
  testId,
}: StatusActionProps) {
  const theme = useTheme();
  const metrics = getStatusMetrics(size);
  const blocked = disabled || loading;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopRowEvents) {
      event.preventDefault();
      event.stopPropagation();
      (event as React.MouseEvent<HTMLButtonElement> & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
    }
    if (!blocked) onClick?.(event);
  };

  return (
    <Tooltip title={tooltip ?? label} describeChild>
      <span>
        <IconButton
          size="small"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          aria-disabled={blocked || undefined}
          aria-haspopup={showMenuAffordance ? 'menu' : undefined}
          aria-expanded={showMenuAffordance ? Boolean(menuOpen) : undefined}
          aria-controls={showMenuAffordance && menuOpen ? menuId : undefined}
          disabled={blocked}
          data-testid={testId}
          onClick={handleClick}
          onMouseDown={stopRowEvents ? (event) => {
            event.stopPropagation();
            (event as React.MouseEvent<HTMLButtonElement> & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
          } : undefined}
          sx={{
            width: metrics.interactiveSize,
            height: metrics.interactiveSize,
            border: '1px solid transparent',
            backgroundColor: menuOpen ? theme.palette.action.selected : 'transparent',
            color: getStatusToneColor(theme, tone),
            cursor: blocked ? undefined : 'pointer',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: alpha(theme.palette.text.primary, 0.12),
            },
            '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            ...(menuOpen ? { borderColor: alpha(theme.palette.text.primary, 0.16) } : {}),
            '&.Mui-disabled': {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
          }}
        >
          {loading ? <CircularProgress size={16} color="inherit" /> : <Icon sx={{ fontSize: metrics.iconSize }} />}
          {showMenuAffordance ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={{ display: 'flex', position: 'absolute', right: 2, bottom: 1, opacity: 0.72, pointerEvents: 'none' }}
            >
              <ArrowDropDownIcon sx={{ fontSize: 11 }} />
            </Box>
          ) : null}
        </IconButton>
      </span>
    </Tooltip>
  );
}
