import * as React from 'react';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import StatusDetailPopover from './StatusDetailPopover';
import type { StatusIndicatorGroupProps } from './status.types';

export default function StatusIndicatorGroup({
  items,
  maxVisible = items.length,
  spacing = 0.5,
  ariaLabel,
  overflowLabel = (count) => `${count} indicadores adicionales`,
  overflowTitle = 'Más indicadores',
  stopRowEvents = true,
}: StatusIndicatorGroupProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const titleId = React.useId();
  const ordered = React.useMemo(
    () => items.map((item, index) => ({ item, index })).sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index)).map(({ item }) => item),
    [items]
  );
  const visible = ordered.slice(0, Math.max(0, maxVisible));
  const hidden = ordered.slice(visible.length);

  const stop = (event: React.SyntheticEvent) => {
    if (!stopRowEvents) return;
    event.stopPropagation();
    (event as React.SyntheticEvent & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
  };

  return (
    <Box role="group" aria-label={ariaLabel} onClick={stop} onMouseDown={stop} sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Stack direction="row" spacing={spacing} alignItems="center">
        {visible.map((item) => <React.Fragment key={item.id}>{item.indicator}</React.Fragment>)}
        {hidden.length > 0 ? (
          <ButtonBase
            aria-label={overflowLabel(hidden.length)}
            aria-haspopup="dialog"
            aria-expanded={Boolean(anchorEl)}
            onClick={(event) => { stop(event); setAnchorEl(event.currentTarget); }}
            sx={{
              minWidth: 32,
              minHeight: 32,
              borderRadius: 1,
              color: 'text.secondary',
              '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            }}
          >
            <Typography variant="caption" fontWeight={700}>+{hidden.length}</Typography>
          </ButtonBase>
        ) : null}
      </Stack>
      <StatusDetailPopover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        title={overflowTitle}
        onClose={() => setAnchorEl(null)}
        ariaLabelledBy={titleId}
      >
        <Stack spacing={1}>
          {hidden.map((item) => (
            <Box key={item.id}>
              <Typography variant="caption" fontWeight={700}>{item.detailLabel ?? item.id}</Typography>
              {item.detailContent ?? item.indicator}
            </Box>
          ))}
        </Stack>
      </StatusDetailPopover>
    </Box>
  );
}
