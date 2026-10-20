import type { MouseEvent, ReactNode } from 'react';
import { ListItemIcon, Menu, MenuItem } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useBrand } from '../../theme/brand/useBrand';

export type WorkspaceContextItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
};

type WorkspaceRowContextMenuProps = {
  anchorPosition: { top: number; left: number } | null;
  items: WorkspaceContextItem[];
  onClose: () => void;
};

export function WorkspaceRowContextMenu({ anchorPosition, items, onClose }: WorkspaceRowContextMenuProps) {
  const { brandElevation } = useBrand();
  const tokens = useTheme().emphasys;
  return (
    <Menu
      open={Boolean(anchorPosition) && items.length > 0}
      onClose={onClose}
      anchorReference="anchorPosition"
      {...(anchorPosition ? { anchorPosition } : {})}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            minWidth: 228,
            borderRadius: 2,
            bgcolor: tokens.content.elevated,
            color: tokens.content.foreground,
            border: `1px solid ${tokens.content.border}`,
            boxShadow: brandElevation.floating,
            py: 0.75,
            '& .MuiMenuItem-root': {
              minHeight: 34,
              px: 1.25,
              mx: 0.5,
              borderRadius: 1.5,
              fontSize: 13,
              fontWeight: 600,
              color: tokens.content.foreground,
              '&:hover': { bgcolor: tokens.content.hover },
              '&.Mui-disabled': { opacity: 0.48 },
            },
          },
        },
      }}
    >
      {items.map((item) => (
        <MenuItem
          key={item.id}
          disabled={Boolean(item.disabled)}
          onClick={(event) => {
            onClose();
            item.onClick?.(event);
          }}
        >
          {item.icon ? (
            <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}>{item.icon}</ListItemIcon>
          ) : null}
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
