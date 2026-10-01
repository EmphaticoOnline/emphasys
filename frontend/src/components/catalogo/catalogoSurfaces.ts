import type { SxProps, Theme } from '@mui/material/styles';

export const catalogoCardSx: SxProps<Theme> = (theme) => ({
  border: `1px solid ${theme.emphasys.content.border}`,
  backgroundColor: theme.emphasys.content.card,
  borderRadius: 2,
});

export const catalogoPrimaryButtonSx: SxProps<Theme> = (theme) => ({
  textTransform: 'none',
  fontWeight: 700,
  backgroundColor: theme.emphasys.action.primary,
  color: theme.emphasys.action.primaryForeground,
  '&:hover': { backgroundColor: theme.emphasys.action.primaryHover },
  '&.Mui-disabled': {
    backgroundColor: theme.emphasys.action.disabled,
    color: theme.emphasys.action.primaryForeground,
  },
});

export const catalogoOutlinedButtonSx: SxProps<Theme> = (theme) => ({
  textTransform: 'none',
  fontWeight: 700,
  color: theme.emphasys.content.foreground,
  borderColor: theme.emphasys.content.border,
  backgroundColor: theme.emphasys.content.card,
  '&:hover': {
    borderColor: theme.emphasys.content.foreground,
    backgroundColor: theme.emphasys.content.hover,
  },
});

export const catalogoTabsSx: SxProps<Theme> = (theme) => ({
  px: 1.5,
  minHeight: 46,
  borderBottom: `1px solid ${theme.emphasys.content.border}`,
  '& .MuiTab-root': {
    minHeight: 46,
    textTransform: 'none',
    fontWeight: 650,
    color: theme.emphasys.content.muted,
  },
  '& .Mui-selected': { color: `${theme.emphasys.content.foreground} !important` },
  '& .MuiTabs-indicator': { height: 2, backgroundColor: theme.emphasys.content.foreground },
});

export const catalogoRailIconButtonSx: SxProps<Theme> = (theme) => ({
  width: 28,
  height: 28,
  borderRadius: 2,
  backgroundColor: theme.emphasys.navigation.summary,
  color: theme.emphasys.navigation.foreground,
  '&:hover': { backgroundColor: theme.emphasys.navigation.hover },
  '&.Mui-disabled': { color: theme.emphasys.navigation.muted },
});

export const catalogoRailSearchSx: SxProps<Theme> = (theme) => ({
  '& .MuiOutlinedInput-root': {
    color: theme.emphasys.navigation.foreground,
    backgroundColor: theme.emphasys.navigation.summary,
    borderRadius: 2,
    '& fieldset': { borderColor: 'transparent' },
  },
  '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.9 },
  '& .MuiOutlinedInput-input::placeholder': { color: theme.emphasys.navigation.muted, opacity: 1 },
});

export const catalogoSearchSx: SxProps<Theme> = (theme) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.emphasys.content.card,
    borderRadius: 2,
    '& fieldset': { borderColor: theme.emphasys.content.border },
  },
});

export const catalogoHeaderIconSx: SxProps<Theme> = (theme) => ({
  color: theme.emphasys.grid.headerForeground,
  '&:hover': { backgroundColor: theme.emphasys.navigation.hover },
});
