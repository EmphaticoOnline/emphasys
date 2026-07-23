import * as React from 'react';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import { Box, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import StatusDetailPopover from './StatusDetailPopover';
import { getStatusMetrics, getStatusToneColor } from './status.semantics';
import type { StatusIndicatorProps } from './status.types';

function stopGridEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
  const muiEvent = event as React.SyntheticEvent & { defaultMuiPrevented?: boolean };
  muiEvent.defaultMuiPrevented = true;
}

export default function StatusIndicator({
  icon: Icon,
  label,
  ariaLabel = label,
  tone = 'neutral',
  shortText,
  tooltip,
  detail,
  size = 'compact',
  unknown = false,
  stopRowEvents = true,
  testId,
}: StatusIndicatorProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const titleId = React.useId();
  const metrics = getStatusMetrics(size);
  const EffectiveIcon = unknown ? HelpOutlineOutlinedIcon : Icon;
  const color = getStatusToneColor(theme, unknown ? 'neutral' : tone);
  const hasDetail = detail != null;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (stopRowEvents) stopGridEvent(event);
    if (hasDetail) setAnchorEl(event.currentTarget);
  };

  const content = (
    <Box
      {...(hasDetail
        ? {
            component: 'button' as const,
            type: 'button' as const,
            'aria-haspopup': 'dialog' as const,
            'aria-expanded': Boolean(anchorEl),
          }
        : { component: 'span' as const, role: 'img' })}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={handleClick}
      onMouseDown={stopRowEvents ? stopGridEvent : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        minWidth: hasDetail ? metrics.interactiveSize : metrics.visualSize,
        minHeight: hasDetail ? metrics.interactiveSize : metrics.visualSize,
        p: 0,
        m: 0,
        border: 0,
        borderRadius: 1,
        background: 'transparent',
        color,
        font: 'inherit',
        cursor: hasDetail ? 'pointer' : 'default',
        '&:focus-visible': hasDetail
          ? { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 }
          : undefined,
      }}
    >
      <EffectiveIcon sx={{ fontSize: metrics.iconSize, flexShrink: 0 }} />
      {shortText != null ? (
        <Typography component="span" variant="caption" color="text.primary" noWrap sx={{ maxWidth: 72, fontWeight: 600 }}>
          {shortText}
        </Typography>
      ) : null}
    </Box>
  );

  return (
    <>
      <Tooltip title={tooltip ?? label} describeChild enterTouchDelay={700}>
        {content}
      </Tooltip>
      {hasDetail ? (
        <StatusDetailPopover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          title={label}
          onClose={() => setAnchorEl(null)}
          ariaLabelledBy={titleId}
        >
          {detail}
        </StatusDetailPopover>
      ) : null}
    </>
  );
}
