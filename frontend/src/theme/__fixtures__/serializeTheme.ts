import type { Theme } from '@mui/material/styles';

/**
 * Vista serializable de un tema MUI para compararlo contra un fixture.
 * Las funciones se reemplazan por un marcador y se evalúan aparte con
 * entradas fijas, para no depender del código fuente interno de MUI.
 */
export function serializeTheme(theme: Theme) {
  // `brand` es la marca de origen del tema (E2), no apariencia: se verifica aparte.
  const { brand: _brand, ...appearance } = theme;
  const data: unknown = JSON.parse(
    JSON.stringify(appearance, (_key, value: unknown) => (typeof value === 'function' ? '[Function]' : value)),
  );
  const labelDisplayedRows = theme.components?.MuiTablePagination?.defaultProps?.labelDisplayedRows;
  return {
    data,
    probes: {
      spacing: [0.25, 0.5, 1, 1.5, 2, 3].map((value) => theme.spacing(value)),
      pxToRem: theme.typography.pxToRem(14),
      breakpointUpMd: theme.breakpoints.up('md'),
      contrastOnPrimary: theme.palette.getContrastText(theme.palette.primary.main),
      labelDisplayedRows: [
        labelDisplayedRows?.({ from: 1, to: 25, count: 120, page: 0 }),
        labelDisplayedRows?.({ from: 26, to: 50, count: -1, page: 1 }),
      ],
    },
  };
}
