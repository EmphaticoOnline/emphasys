import { createTheme, type Theme } from '@mui/material/styles';
import './augmentation';
import {
  EDITORIAL_FIGURE_FAMILY,
  FUNCTIONAL_FONT_FAMILY,
  type EmphasysTokens,
} from './tokens';

const mobileEditableInputMediaQuery = '@media (max-width:899.95px)';
const mobileEditableInputFontSize = '16px !important';

const inputFontSize = {
  [mobileEditableInputMediaQuery]: {
    fontSize: mobileEditableInputFontSize,
  },
};

export function createEmphasysTheme(
  tokens: EmphasysTokens,
  options: { editorialFigures: boolean; restyleSurfaces: boolean },
): Theme {
  return createTheme({
    palette: {
      primary: {
        main: tokens.action.primary,
        dark: tokens.action.primaryHover,
        contrastText: tokens.action.primaryForeground,
      },
      ...(options.restyleSurfaces
        ? {
            background: {
              default: tokens.canvas.page,
              paper: tokens.content.elevated,
            },
            text: {
              primary: tokens.content.foreground,
              secondary: tokens.content.secondary,
            },
            divider: tokens.content.border,
          }
        : {}),
    },
    emphasys: tokens,
    typography: {
      fontFamily: FUNCTIONAL_FONT_FAMILY,
      figure: {
        fontFamily: options.editorialFigures ? EDITORIAL_FIGURE_FAMILY : FUNCTIONAL_FONT_FAMILY,
        fontWeight: 500,
        fontSize: '1.5rem',
        lineHeight: 1.15,
        fontVariantNumeric: 'tabular-nums',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: tokens.canvas.page,
          },
        },
      },
      MuiInputBase: { styleOverrides: { input: inputFontSize } },
      MuiOutlinedInput: { styleOverrides: { input: inputFontSize } },
      MuiFilledInput: { styleOverrides: { input: inputFontSize } },
      MuiInput: { styleOverrides: { input: inputFontSize } },
      MuiSelect: { styleOverrides: { select: inputFontSize } },
      MuiAutocomplete: { styleOverrides: { input: inputFontSize } },
      MuiTablePagination: {
        defaultProps: {
          labelDisplayedRows: ({ from, to, count }) =>
            `${from}–${to} de ${count === -1 ? `más de ${to}` : count}`,
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      ...(options.restyleSurfaces
        ? {
            MuiDialog: {
              styleOverrides: {
                paper: {
                  backgroundColor: tokens.content.elevated,
                  color: tokens.content.foreground,
                  backgroundImage: 'none',
                },
              },
            },
            MuiMenu: {
              styleOverrides: {
                paper: {
                  backgroundColor: tokens.content.elevated,
                  color: tokens.content.foreground,
                  backgroundImage: 'none',
                },
              },
            },
            MuiPopover: {
              styleOverrides: {
                paper: {
                  backgroundColor: tokens.content.elevated,
                  color: tokens.content.foreground,
                  backgroundImage: 'none',
                },
              },
            },
            MuiTooltip: {
              styleOverrides: {
                tooltip: {
                  backgroundColor: tokens.frame.background,
                  color: tokens.frame.foreground,
                },
                arrow: {
                  color: tokens.frame.background,
                },
              },
            },
            MuiSnackbarContent: {
              styleOverrides: {
                root: {
                  backgroundColor: tokens.frame.background,
                  color: tokens.frame.foreground,
                },
              },
            },
            MuiTouchRipple: {
              styleOverrides: {
                // El ripple de MUI anima la opacidad hasta 0.3 usando currentColor.
                // En botones claros eso dibuja un disco gris muy visible. Bajar la
                // opacidad del contenedor lo atenúa sin cambiar el color del botón
                // ni quitar el ripple.
                root: {
                  opacity: 0.42,
                },
              },
            },
            MuiButton: {
              styleOverrides: {
                root: {
                  '&.Mui-focusVisible': {
                    outline: `2px solid ${tokens.content.foreground}`,
                    outlineOffset: 2,
                    boxShadow: `0 0 0 2px ${tokens.content.card}`,
                  },
                },
                containedPrimary: {
                  backgroundColor: tokens.action.primary,
                  color: tokens.action.primaryForeground,
                  '&:hover': { backgroundColor: tokens.action.primaryHover },
                  '&:active': { backgroundColor: tokens.action.primaryHover },
                  '&.Mui-disabled': {
                    backgroundColor: tokens.action.disabled,
                    color: tokens.action.primaryForeground,
                  },
                },
                outlined: {
                  '@media (hover: hover)': {
                    '&:hover': { backgroundColor: tokens.action.hoverTint },
                  },
                  '&:active': { backgroundColor: tokens.content.hover },
                },
                text: {
                  '@media (hover: hover)': {
                    '&:hover': { backgroundColor: tokens.action.hoverTint },
                  },
                  '&:active': { backgroundColor: tokens.content.hover },
                },
              },
            },
            MuiIconButton: {
              styleOverrides: {
                root: {
                  '&.Mui-focusVisible': {
                    outline: `2px solid ${tokens.content.foreground}`,
                    outlineOffset: 2,
                    boxShadow: `0 0 0 2px ${tokens.content.card}`,
                  },
                },
              },
            },
          }
        : {}),
    },
  });
}
