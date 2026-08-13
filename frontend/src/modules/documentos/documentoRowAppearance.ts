import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import type { CotizacionListado } from '../../types/cotizacion';
import type { TipoDocumento } from '../../types/documentos.types';
import {
  ESTADO_SEGUIMIENTO_ROW_APPEARANCES,
  getEstadoSeguimientoRowAppearance,
} from '../cotizaciones/estadoSeguimiento';

export type DocumentoRowAppearance = {
  className: string;
  color: string;
};

type DocumentoRowAppearanceConfig = {
  resolve: (row: CotizacionListado) => DocumentoRowAppearance | null;
  appearances: DocumentoRowAppearance[];
};

const DOCUMENTO_ROW_APPEARANCE_CONFIGS: Partial<Record<TipoDocumento, DocumentoRowAppearanceConfig>> = {
  cotizacion: {
    resolve: (row) => getEstadoSeguimientoRowAppearance(row.estado_seguimiento),
    appearances: ESTADO_SEGUIMIENTO_ROW_APPEARANCES,
  },
};

export const getDocumentoRowAppearanceConfig = (tipoDocumento: TipoDocumento): DocumentoRowAppearanceConfig | null =>
  DOCUMENTO_ROW_APPEARANCE_CONFIGS[tipoDocumento] ?? null;

// Los colores recibidos ya son los fondos pastel de los chips. Se mezclan con
// la superficie de la grilla para mantenerlos aptos para un área mucho mayor.
export const createDocumentoRowAppearanceSx = (
  appearances: DocumentoRowAppearance[]
): SxProps<Theme> => (theme) => {
  const styles: Record<string, unknown> = {
    '& .MuiDataGrid-row, & .MuiDataGrid-row:nth-of-type(even)': {
      backgroundColor: theme.palette.background.paper,
    },
    '& .MuiDataGrid-row:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  };

  for (const appearance of appearances) {
    const selector = `& .${appearance.className}`;
    styles[selector] = {
      backgroundColor: alpha(appearance.color, 0.78),
      transition: theme.transitions.create('background-color', {
        duration: theme.transitions.duration.shortest,
      }),
    };
    styles[`${selector}:hover`] = {
      backgroundColor: alpha(appearance.color, 0.92),
    };
  }

  styles['& .MuiDataGrid-row.Mui-selected'] = {
    backgroundColor: alpha(theme.palette.primary.main, 0.13),
  };
  styles['& .MuiDataGrid-row.Mui-selected:hover'] = {
    backgroundColor: alpha(theme.palette.primary.main, 0.18),
  };

  return styles;
};
