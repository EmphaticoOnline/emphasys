import * as React from 'react';
import { IconButton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

type GridContextMenuTriggerProps = {
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  ariaLabel?: string;
};

export function GridContextMenuTrigger({ onOpen, ariaLabel = 'Abrir menú contextual' }: GridContextMenuTriggerProps) {
  return (
    <IconButton
      size="small"
      aria-label={ariaLabel}
      onClick={onOpen}
      onMouseDown={(event) => event.stopPropagation()}
      sx={{
        width: 28,
        height: 28,
        borderRadius: 1.5,
        color: '#475569',
        '&:hover': {
          backgroundColor: 'rgba(15, 23, 42, 0.06)',
        },
      }}
    >
      <MoreVertIcon sx={{ fontSize: 18 }} />
    </IconButton>
  );
}