import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

/**
 * Lenguaje visual de Contabilidad.
 * Lee `theme.emphasys` (el tema activo de la ruta). No define paleta propia.
 * La densidad se mantiene: filas de 30px y controles compactos.
 */

export const CONTABILIDAD_FONT = 13;
export const CONTABILIDAD_ROW_HEIGHT = 30;

export function pestanasModuloSx(theme: Theme): SystemStyleObject<Theme> {
  const nav = theme.emphasys.documentNav;
  return {
    minHeight: 0,
    '& .MuiTabs-flexContainer': { alignItems: 'flex-end' },
    '& .MuiTab-root': {
      minHeight: 0,
      textTransform: 'none',
      fontWeight: 650,
      fontSize: 13.5,
      letterSpacing: '0.01em',
      color: nav.foreground,
      borderTop: '3px solid transparent',
      borderRadius: '8px 8px 0 0',
      padding: '7px 12px',
      mr: 0.5,
      alignItems: 'flex-end',
    },
    '& .Mui-selected': {
      color: nav.selectedForeground,
      backgroundColor: nav.selectedBackground,
      borderTop: `3px solid ${nav.indicator}`,
      borderLeft: `1px solid ${nav.border}`,
      borderRight: `1px solid ${nav.border}`,
      borderBottom: `1px solid ${nav.selectedBackground}`,
    },
    '& .MuiTab-root:hover': {
      color: nav.hoverForeground,
      backgroundColor: nav.hoverBackground,
    },
  };
}

export function shellModuloSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.75,
    px: { xs: 1.5, md: 2 },
    py: 1,
    minHeight: 0,
    color: theme.emphasys.content.foreground,
  };
}

/** Superficie base para catálogos: deja la acción en la misma línea que el contexto. */
export function superficieCatalogoSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    px: { xs: 1.5, md: 2 },
    py: 1.25,
    color: tokens.content.foreground,
  };
}

export function barraVistaSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    minHeight: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,
  };
}

export function tabsInternasSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    minHeight: 32,
    borderBottom: `1px solid ${theme.emphasys.content.border}`,
    '& .MuiTab-root': {
      minHeight: 32,
      textTransform: 'none',
      fontWeight: 650,
      fontSize: 13,
      py: 0.5,
      px: 1.25,
      color: theme.emphasys.content.muted,
    },
    '& .Mui-selected': { color: theme.emphasys.content.foreground },
    '& .MuiTabs-indicator': { backgroundColor: theme.emphasys.action.info, height: 2 },
  };
}

export function mesesToggleSx(theme: Theme, height = 26, fontSize = 12): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
    '& .MuiToggleButton-root': {
      height,
      px: 0.9,
      py: 0,
      fontSize,
      fontWeight: 650,
      textTransform: 'none',
      border: `1px solid ${tokens.content.border}`,
      bgcolor: tokens.content.elevated,
      color: tokens.content.secondary,
      '&:hover': { bgcolor: tokens.content.hover, color: tokens.content.foreground },
      '&.Mui-selected': {
        bgcolor: tokens.action.primary,
        color: tokens.action.primaryForeground,
        borderColor: tokens.action.primary,
        '&:hover': { bgcolor: tokens.action.primaryHover },
      },
    },
  };
}

export function campoCompactoSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    '& .MuiInputBase-root': {
      backgroundColor: tokens.content.card,
      fontSize: CONTABILIDAD_FONT,
    },
    '& .MuiInputBase-input': { fontSize: CONTABILIDAD_FONT },
    '& .MuiInputLabel-root': { fontSize: CONTABILIDAD_FONT },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.content.border },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: tokens.content.foreground,
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: tokens.content.foreground,
    },
  };
}

export function botonPrimarioSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    textTransform: 'none',
    fontWeight: 650,
    fontSize: CONTABILIDAD_FONT,
    borderRadius: 1,
    backgroundColor: tokens.action.primary,
    color: tokens.action.primaryForeground,
    boxShadow: 'none',
    '&:hover': { backgroundColor: tokens.action.primaryHover, boxShadow: 'none' },
    '&.Mui-disabled': {
      backgroundColor: tokens.action.disabled,
      color: tokens.action.primaryForeground,
    },
  };
}

export function botonSecundarioSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    textTransform: 'none',
    fontWeight: 650,
    fontSize: CONTABILIDAD_FONT,
    color: tokens.content.foreground,
    borderColor: tokens.content.border,
    '&:hover': {
      borderColor: tokens.content.foreground,
      backgroundColor: tokens.action.hoverTint,
    },
  };
}

export function iconoAccionSx(theme: Theme): SystemStyleObject<Theme> {
  return { color: theme.emphasys.content.foreground };
}

export function iconoPeligroSx(theme: Theme): SystemStyleObject<Theme> {
  return { color: theme.emphasys.action.destructive };
}

export function panelSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    backgroundColor: tokens.content.card,
    borderColor: tokens.content.border,
    color: tokens.content.foreground,
    borderRadius: 1,
    overflow: 'hidden',
  };
}

export function formularioPaperSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    p: 2,
    maxWidth: 560,
    backgroundColor: tokens.content.elevated,
    border: `1px solid ${tokens.content.border}`,
    boxShadow: 'none',
    color: tokens.content.foreground,
  };
}

export function tituloVistaSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.3,
    color: theme.emphasys.content.foreground,
    mb: 0.5,
  };
}

export function seccionLabelSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: theme.emphasys.content.muted,
  };
}

export function grillaCompactaSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    fontSize: CONTABILIDAD_FONT,
    border: 'none',
    '& .MuiDataGrid-cell': {
      display: 'flex',
      alignItems: 'center',
      fontVariantNumeric: 'tabular-nums',
      color: theme.emphasys.table.cell,
    },
    '& .MuiDataGrid-row': { cursor: 'pointer' },
  };
}

export function filaSeleccionadaSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    '& .MuiDataGrid-row.fila-seleccionada': {
      backgroundColor: `${tokens.grid.selected} !important`,
      boxShadow: `inset 3px 0 0 ${tokens.action.info}`,
    },
    '& .MuiDataGrid-row.fila-seleccionada:hover': {
      backgroundColor: `${tokens.grid.selectedHover} !important`,
    },
    '& .MuiDataGrid-row.fila-seleccionada .MuiDataGrid-cell': {
      color: `${tokens.content.foreground} !important`,
    },
  };
}

export function filaLocalizadaSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    '& .MuiDataGrid-row.fila-localizada': {
      backgroundColor: tokens.metric.amount.background,
      boxShadow: `inset 3px 0 0 ${tokens.metric.amount.foreground}`,
      transition: 'background-color 0.3s ease',
    },
    '& .MuiDataGrid-row.fila-localizada:hover': {
      backgroundColor: tokens.content.hover,
    },
  };
}

export function descripcionJerarquiaSx(theme: Theme, nivel: number, afectable: boolean): SystemStyleObject<Theme> {
  const depth = Math.max(0, nivel - 1);
  const tokens = theme.emphasys;
  return {
    pl: `${depth * 24}px`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
    color: afectable ? tokens.content.foreground : tokens.content.muted,
    fontWeight: afectable ? 650 : 450,
    boxShadow: depth > 0 ? `inset 2px 0 0 ${tokens.content.border}` : 'none',
  };
}

export function codigoCuentaSx(theme: Theme, afectable: boolean): SystemStyleObject<Theme> {
  return {
    color: afectable ? theme.emphasys.content.foreground : theme.emphasys.content.muted,
    fontWeight: afectable ? 650 : 450,
    fontVariantNumeric: 'tabular-nums',
  };
}

export function importeSx(theme: Theme, negativo: boolean): SystemStyleObject<Theme> {
  return {
    color: negativo ? theme.emphasys.action.destructive : 'inherit',
    fontVariantNumeric: 'tabular-nums',
  };
}

export function barraTotalesSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    borderTop: `2px solid ${tokens.content.border}`,
    backgroundColor: tokens.content.elevated,
    color: tokens.content.foreground,
    px: 1,
    py: 0.5,
  };
}

export function encabezadoTablaSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    '& .MuiTableCell-root, & th': {
      backgroundColor: tokens.grid.header,
      color: tokens.grid.headerForeground,
      fontWeight: 650,
      fontSize: 12,
      borderBottom: 'none',
    },
  };
}

export function filaTotalesTablaSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    backgroundColor: tokens.content.elevated,
    '& .MuiTableCell-root, & td': {
      fontWeight: 700,
      color: tokens.content.foreground,
      borderTop: `2px solid ${tokens.content.border}`,
      borderBottom: 'none',
      fontVariantNumeric: 'tabular-nums',
      backgroundColor: tokens.content.elevated,
    },
  };
}

export function barraLoteSx(theme: Theme): SystemStyleObject<Theme> {
  const frame = theme.emphasys.frame;
  return {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.snackbar,
    backgroundColor: frame.background,
    color: frame.foreground,
    borderRadius: 999,
    pl: 1,
    pr: 2,
    py: 0.75,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  };
}

type Tono = 'ok' | 'warn' | 'error' | 'neutral';

function tonoMetric(theme: Theme, tono: Tono) {
  if (tono === 'ok') return theme.emphasys.metric.applied;
  if (tono === 'warn') return theme.emphasys.metric.amount;
  if (tono === 'neutral') {
    return { background: theme.emphasys.content.hover, foreground: theme.emphasys.content.secondary };
  }
  return theme.emphasys.metric.blocked;
}

export function panelEstadoSx(theme: Theme, tono: Tono): SystemStyleObject<Theme> {
  const metric = tonoMetric(theme, tono);
  return {
    p: 1.5,
    borderRadius: 1,
    borderColor: metric.foreground,
    backgroundColor: metric.background,
    color: metric.foreground,
  };
}

export function tonoDeClave(clave: string): Tono {
  if (clave === 'no_seleccionado') return 'neutral';
  if (clave === 'correcto' || clave === 'ok' || clave === 'success' || clave === 'listo') return 'ok';
  if (clave === 'error' || clave.includes('error')) return 'error';
  return 'warn';
}

export function chipEstadoSx(theme: Theme, tono: Tono): SystemStyleObject<Theme> {
  const metric = tonoMetric(theme, tono);
  return {
    backgroundColor: metric.background,
    color: metric.foreground,
    fontWeight: 650,
    fontSize: 11,
  };
}

export function textoEstadoSx(theme: Theme, tono: Tono): SystemStyleObject<Theme> {
  return { color: tonoMetric(theme, tono).foreground };
}

export function bandaCapturaSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    px: 1,
    py: 0.75,
    backgroundColor: tokens.content.elevated,
    borderBottom: `1px solid ${tokens.content.border}`,
  };
}

export function tablaCapturaSx(theme: Theme): SystemStyleObject<Theme> {
  const tokens = theme.emphasys;
  return {
    '& .MuiTableCell-root': {
      padding: '2px 4px',
      fontSize: CONTABILIDAD_FONT,
      lineHeight: 1.2,
      fontVariantNumeric: 'tabular-nums',
    },
    '& tbody .MuiTableRow-root': { height: 32 },
    '& tbody .MuiTableRow-root:nth-of-type(even)': { backgroundColor: tokens.grid.stripe },
    '& tbody .MuiTableRow-root:hover': { backgroundColor: tokens.grid.hover },
    '& tbody .MuiTableRow-root.Mui-selected': { backgroundColor: tokens.grid.selected },
    '& tbody .MuiTableRow-root.Mui-selected:hover': { backgroundColor: tokens.grid.selectedHover },
  };
}

export function cajonPaperSx(theme: Theme): SystemStyleObject<Theme> {
  return {
    backgroundColor: theme.emphasys.content.background,
    color: theme.emphasys.content.foreground,
  };
}
