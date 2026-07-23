import * as React from 'react';
import { Box, Popover, Typography } from '@mui/material';

export interface StatusDetailPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  title: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  ariaLabelledBy?: string;
  maxWidth?: number;
  restoreFocus?: boolean;
}

export default function StatusDetailPopover({
  open,
  anchorEl,
  title,
  children,
  onClose,
  ariaLabelledBy,
  maxWidth = 360,
  restoreFocus = true,
}: StatusDetailPopoverProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      disableRestoreFocus={!restoreFocus}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { onClick: (event) => event.stopPropagation() } }}
    >
      <Box
        role="dialog"
        aria-modal="false"
        aria-labelledby={ariaLabelledBy}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        sx={{ p: 1.5, minWidth: 220, maxWidth }}
      >
        <Typography id={ariaLabelledBy} variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          {title}
        </Typography>
        {children}
      </Box>
    </Popover>
  );
}
