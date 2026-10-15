import type { SxProps, Theme } from '@mui/material/styles';

/** Nombre de contacto en el riel: dos líneas como máximo, sin ampliar la fila. */
export const workspaceRailContactNameSx: SxProps<Theme> = {
  display: '-webkit-box',
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  wordBreak: 'break-word',
};
