import * as React from 'react';
import { Box } from '@mui/material';
import { ConfigPageFrame } from './configVisual';

/** Capa visual para pantallas legacy que aún conservan su composición funcional. */
export default function ConfiguracionVisualCompat({ children }: { children: React.ReactNode }) {
  return (
    <ConfigPageFrame>
      <Box sx={(theme) => ({
        minWidth: 0,
        '& .MuiToolbar-root': { minHeight: 38, gap: theme.spacing(1), flexWrap: 'wrap' },
        '& .MuiPaper-root': {
          borderColor: theme.emphasys.content.border,
          backgroundColor: theme.emphasys.content.elevated,
          borderRadius: 2.5,
          boxShadow: 'none',
        },
        '& .MuiTableHead-root .MuiTableCell-root': {
          backgroundColor: theme.emphasys.table.headerBg,
          color: theme.emphasys.table.headerFg,
          fontWeight: 700,
          borderBottom: `1px solid ${theme.emphasys.table.line}`,
        },
        '& .MuiTableCell-root': { borderColor: theme.emphasys.table.line, fontSize: 13 },
        '& .MuiButton-contained': {
          backgroundColor: theme.emphasys.action.primary,
          '&:hover': { backgroundColor: theme.emphasys.action.primaryHover },
        },
        '& .MuiDialog-paper': {
          borderRadius: 2.5,
          backgroundColor: theme.emphasys.content.elevated,
        },
        '& .MuiDialogTitle-root': { color: theme.emphasys.content.foreground, fontSize: 18, fontWeight: 700 },
        '& .MuiDialogContent-root': { borderColor: theme.emphasys.content.border },
        '& .MuiTabs-root': { minHeight: 38 },
        '& .MuiTab-root': { minHeight: 38, textTransform: 'none', fontSize: 13 },
        '& .MuiTypography-h5, & .MuiTypography-subtitle1': { color: `${theme.emphasys.content.foreground} !important` },
        '& .MuiDivider-root': { borderColor: `${theme.emphasys.content.border} !important` },
      })}
    >
      {children}
    </Box>
    </ConfigPageFrame>
  );
}
