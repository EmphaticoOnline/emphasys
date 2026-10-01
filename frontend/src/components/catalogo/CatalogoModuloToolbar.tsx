import type { ReactNode } from 'react';
import { Button, CircularProgress, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx, catalogoRailIconButtonSx } from './catalogoSurfaces';

type ModoVista = 'lista' | 'tabla';

type CatalogoModuloToolbarProps = {
  viewMode: ModoVista;
  onViewModeChange: (mode: ModoVista) => void;
  helpHref: string;
  onExport: () => void;
  exportLoading?: boolean;
  onCreate: () => void;
  extra?: ReactNode;
  incluirColeccion?: boolean;
};

export function CatalogoRailVistaAyuda({
  viewMode,
  onViewModeChange,
  helpHref,
}: Pick<CatalogoModuloToolbarProps, 'viewMode' | 'onViewModeChange' | 'helpHref'>) {
  return (
    <>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={viewMode}
        onChange={(_, value: ModoVista | null) => {
          if (value) onViewModeChange(value);
        }}
        sx={(theme) => ({
          '& .MuiToggleButton-root': {
            width: 28,
            height: 28,
            p: 0,
            color: theme.emphasys.navigation.foreground,
            borderColor: 'transparent',
            backgroundColor: theme.emphasys.navigation.summary,
          },
          '& .Mui-selected': {
            color: `${theme.emphasys.navigation.selectionForeground} !important`,
            backgroundColor: `${theme.emphasys.navigation.selection} !important`,
          },
        })}
      >
        <ToggleButton value="lista" aria-label="Vista de lista">
          <Tooltip title="Vista de lista">
            <ViewListOutlinedIcon sx={{ fontSize: 16 }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="tabla" aria-label="Vista de tabla">
          <Tooltip title="Vista de tabla">
            <TableChartOutlinedIcon sx={{ fontSize: 16 }} />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title="Ayuda" arrow>
        <IconButton
          aria-label="Ayuda"
          onClick={() => window.open(helpHref, '_blank')}
          sx={catalogoRailIconButtonSx}
        >
          <HelpOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </>
  );
}

export default function CatalogoModuloToolbar({
  viewMode,
  onViewModeChange,
  helpHref,
  onExport,
  exportLoading = false,
  onCreate,
  extra,
  incluirColeccion = true,
}: CatalogoModuloToolbarProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ ml: 'auto', justifyContent: 'flex-end' }}>
      {incluirColeccion ? extra : null}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={viewMode}
        onChange={(_, value: ModoVista | null) => {
          if (value) onViewModeChange(value);
        }}
        sx={(theme) => ({
          bgcolor: theme.emphasys.content.card,
          '& .MuiToggleButton-root': { color: theme.emphasys.content.muted, borderColor: theme.emphasys.content.border },
          '& .Mui-selected': { color: `${theme.emphasys.content.foreground} !important`, bgcolor: `${theme.emphasys.content.hover} !important` },
        })}
      >
        <ToggleButton value="lista" aria-label="Vista de lista">
          <Tooltip title="Vista de lista">
            <ViewListOutlinedIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="tabla" aria-label="Vista de tabla">
          <Tooltip title="Vista de tabla">
            <TableChartOutlinedIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title="Guía de ayuda">
        <IconButton
          aria-label="Abrir guía de ayuda"
          size="small"
          onClick={() => window.open(helpHref, '_blank')}
          sx={{ color: (theme) => theme.emphasys.content.muted }}
        >
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {incluirColeccion ? (
        <Button
          variant="outlined"
          startIcon={exportLoading ? <CircularProgress size={14} /> : <DownloadIcon />}
          onClick={onExport}
          disabled={exportLoading}
          sx={catalogoOutlinedButtonSx}
        >
          Exportar
        </Button>
      ) : null}
      {incluirColeccion ? (
        <Button variant="contained" onClick={onCreate} sx={catalogoPrimaryButtonSx}>
          + Nuevo
        </Button>
      ) : null}
    </Stack>
  );
}
