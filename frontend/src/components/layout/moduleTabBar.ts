import type { SxProps, Theme } from '@mui/material/styles';
import { experimentalTokens, MAIN_NAV_TYPE } from '../../theme/tokens';

/**
 * Cromado aprobado en Ventas. Compras y CRM leen estas mismas piezas
 * para que los tres módulos compartan un solo listón.
 */
const chrome = {
  idle: experimentalTokens.content.foreground,
  hoverSurface: `color-mix(in srgb, ${experimentalTokens.frame.background} 8%, transparent)`,
  hoverInk: experimentalTokens.frame.background,
  activeSurface: experimentalTokens.frame.background,
  activeInk: experimentalTokens.frame.foreground,
  activeHover: experimentalTokens.action.primary,
} as const;

export function moduleTabStripSx(): SxProps<Theme> {
  return {
    background: experimentalTokens.canvas.page,
    borderBottom: `1px solid ${experimentalTokens.documentNav.border}`,
    boxShadow: 'none',
    px: 2,
    pt: 0.75,
    pb: 0.5,
    flexShrink: 0,
  };
}

export function moduleTabBarSx(): SxProps<Theme> {
  return {
    minHeight: 30,
    '& .MuiTabs-scroller': {
      paddingBottom: '6px',
      marginBottom: '-6px',
    },
    '& .MuiTabs-flexContainer': {
      alignItems: 'center',
      gap: '4px',
    },
    '& .MuiTabs-scrollButtons': {
      width: 28,
      color: chrome.idle,
    },
    '&& .MuiTab-root': {
      minHeight: 30,
      height: 30,
      minWidth: 0,
      maxWidth: 220,
      boxSizing: 'border-box',
      textTransform: 'none',
      fontFamily: MAIN_NAV_TYPE.fontFamily,
      fontWeight: 500,
      fontSize: 13,
      letterSpacing: '0.01em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      overflow: 'visible',
      color: chrome.idle,
      opacity: 1,
      borderRadius: '6px',
      border: '1px solid transparent',
      backgroundColor: 'transparent',
      padding: '0 12px',
      margin: 0,
      gap: 0,
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    },
    '&& .MuiTab-root.MuiTab-labelIcon': {
      minHeight: 30,
      height: 30,
      paddingTop: 0,
      paddingBottom: 0,
    },
    '&& .MuiTab-root > .MuiTab-icon': {
      fontSize: 15,
      width: 15,
      height: 15,
      marginRight: '6px',
      marginLeft: 0,
      marginTop: 0,
      marginBottom: 0,
      color: 'inherit',
    },
    '&& .MuiTab-root:not(.Mui-selected):hover': {
      color: chrome.hoverInk,
      backgroundColor: chrome.hoverSurface,
      borderColor: 'transparent',
    },
    '&& .MuiTab-root.Mui-selected': {
      color: chrome.activeInk,
      fontWeight: 700,
      letterSpacing: '0.01em',
      opacity: 1,
      backgroundColor: chrome.activeSurface,
      borderColor: chrome.activeSurface,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px color-mix(in srgb, ${chrome.activeSurface} 55%, transparent), 0 4px 10px color-mix(in srgb, ${chrome.activeSurface} 28%, transparent)`,
    },
    '&& .MuiTab-root.Mui-selected:hover': {
      color: chrome.activeInk,
      backgroundColor: chrome.activeHover,
      borderColor: chrome.activeHover,
    },
    '&& .MuiTab-root.Mui-selected > .MuiTab-icon': {
      color: chrome.activeInk,
    },
  };
}
