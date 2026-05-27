import * as React from 'react';
import { Box, Divider, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import type { GridContextMenuPosition } from '../../hooks/useGridContextMenu';

type GridContextMenuActionBase = {
  id: string;
  hidden?: boolean;
};

export type GridContextMenuActionItem = GridContextMenuActionBase & {
  type?: 'action';
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  closeOnClick?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void | Promise<void>;
};

export type GridContextMenuSeparatorItem = GridContextMenuActionBase & {
  type: 'separator';
};

export type GridContextMenuAction = GridContextMenuActionItem | GridContextMenuSeparatorItem;

type GridContextMenuProps = {
  actions: GridContextMenuAction[];
  anchorPosition: GridContextMenuPosition | null;
  open: boolean;
  onClose: () => void;
};

const normalizeActions = (actions: GridContextMenuAction[]): GridContextMenuAction[] => {
  const visibleActions = actions.filter((action) => !action.hidden);
  const normalized: GridContextMenuAction[] = [];

  visibleActions.forEach((action) => {
    const isSeparator = action.type === 'separator';
    const lastAction = normalized[normalized.length - 1];

    if (isSeparator) {
      if (!normalized.length || lastAction?.type === 'separator') return;
      normalized.push(action);
      return;
    }

    normalized.push(action);
  });

  while (normalized[normalized.length - 1]?.type === 'separator') {
    normalized.pop();
  }

  return normalized;
};

export function GridContextMenu({ actions, anchorPosition, open, onClose }: GridContextMenuProps) {
  const normalizedActions = React.useMemo(() => normalizeActions(actions), [actions]);

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      {...(anchorPosition ? { anchorPosition } : {})}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            minWidth: 220,
            borderRadius: 2,
            border: '1px solid #e5e7eb',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
            py: 0.75,
            '& .MuiMenuItem-root': {
              minHeight: 34,
              px: 1.25,
              mx: 0.5,
              borderRadius: 1.5,
              fontSize: 13,
              fontWeight: 500,
              color: '#111827',
              '&:hover': {
                backgroundColor: 'rgba(15, 23, 42, 0.06)',
              },
            },
          },
        },
      }}
    >
      {normalizedActions.map((action) => {
        if (action.type === 'separator') {
          return <Divider key={action.id} sx={{ my: 0.5 }} />;
        }

        return (
          <MenuItem
            key={action.id}
            disabled={action.disabled}
            onClick={(event) => {
              if (action.closeOnClick !== false) {
                onClose();
              }
              void action.onClick?.(event);
            }}
            sx={action.destructive ? { color: '#b91c1c !important' } : undefined}
          >
            {action.icon ? (
              <ListItemIcon
                sx={{
                  minWidth: 30,
                  color: action.destructive ? '#b91c1c' : 'inherit',
                }}
              >
                {action.icon}
              </ListItemIcon>
            ) : null}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
              <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: 'inherit' }}>
                {action.label}
              </Typography>
              {action.shortcut ? (
                <Typography component="span" sx={{ fontSize: 11, color: '#6b7280', letterSpacing: 0.2 }}>
                  {action.shortcut}
                </Typography>
              ) : null}
            </Box>
          </MenuItem>
        );
      })}
    </Menu>
  );
}