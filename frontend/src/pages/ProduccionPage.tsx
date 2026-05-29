import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { GridContextMenu } from '../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, standardDataGridSx } from '../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import {
  listEtapasProduccion,
  listSeguimientosProduccion,
  updateSeguimientoProduccion,
  type EtapaProduccion,
  type SeguimientoProduccionRow,
} from '../services/produccionService';

const formatCivilDate = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-MX');
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString('es-MX');
};

function normalizeHexColor(color: string | null | undefined) {
  const raw = String(color ?? '').trim();
  const match = raw.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!match) {
    return null;
  }

  return `#${match[1].toUpperCase()}`;
}

function getContrastingTextColor(color: string | null | undefined) {
  const hex = normalizeHexColor(color);
  if (!hex) {
    return '#111827';
  }

  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const transform = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = (0.2126 * transform(red)) + (0.7152 * transform(green)) + (0.0722 * transform(blue));

  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithDark = (luminance + 0.05) / 0.05;

  return contrastWithWhite >= contrastWithDark ? '#ffffff' : '#111827';
}

type AdvanceDialogState = {
  open: boolean;
  row: SeguimientoProduccionRow | null;
  etapaId: number | null;
  fechaPromesa: string | null;
  comentario: string;
};

const EMPTY_ADVANCE_DIALOG: AdvanceDialogState = {
  open: false,
  row: null,
  etapaId: null,
  fechaPromesa: null,
  comentario: '',
};

export default function ProduccionPage() {
  const [rows, setRows] = React.useState<SeguimientoProduccionRow[]>([]);
  const [etapas, setEtapas] = React.useState<EtapaProduccion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [savingAdvance, setSavingAdvance] = React.useState(false);
  const [advanceDialog, setAdvanceDialog] = React.useState<AdvanceDialogState>(EMPTY_ADVANCE_DIALOG);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [etapasData, seguimientosData] = await Promise.all([listEtapasProduccion(), listSeguimientosProduccion()]);
      setEtapas(etapasData);
      setRows(seguimientosData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar Producción';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) =>
      [row.documento, row.cliente, row.etapa_nombre, row.comentarios]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(term))
    );
  }, [rows, search]);

  const openAdvanceDialog = React.useCallback((row: SeguimientoProduccionRow) => {
    setAdvanceDialog({
      open: true,
      row,
      etapaId: row.etapa_id ?? etapas[0]?.id ?? null,
      fechaPromesa: row.fecha_promesa ?? null,
      comentario: row.comentarios ?? '',
    });
  }, [etapas]);

  const closeAdvanceDialog = React.useCallback(() => {
    if (savingAdvance) return;
    setAdvanceDialog(EMPTY_ADVANCE_DIALOG);
  }, [savingAdvance]);

  const handleSaveAdvance = React.useCallback(async () => {
    if (!advanceDialog.row) return;

    const comentario = advanceDialog.comentario.trim();
    if (!comentario) {
      setSnackbar({ open: true, message: 'El comentario del avance es obligatorio', severity: 'warning' });
      return;
    }

    if (!advanceDialog.etapaId) {
      setSnackbar({ open: true, message: 'Selecciona una etapa', severity: 'warning' });
      return;
    }

    try {
      setSavingAdvance(true);
      await updateSeguimientoProduccion(advanceDialog.row.id, {
        etapa_id: advanceDialog.etapaId,
        fecha_promesa: advanceDialog.fechaPromesa || null,
        comentarios: comentario,
      });
      await load();
      setAdvanceDialog(EMPTY_ADVANCE_DIALOG);
      setSnackbar({ open: true, message: 'Avance actualizado', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el avance';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSavingAdvance(false);
    }
  }, [advanceDialog, load]);

  const stageOptions = React.useMemo(() => {
    const currentStageId = advanceDialog.row?.etapa_id ?? null;
    if (!currentStageId) return etapas;

    const existsInList = etapas.some((etapa) => etapa.id === currentStageId);
    if (existsInList) return etapas;

    return [
      {
        id: currentStageId,
        empresa_id: advanceDialog.row?.empresa_id ?? 0,
        nombre: advanceDialog.row?.etapa_nombre || 'Etapa actual',
        orden: 0,
        color: advanceDialog.row?.etapa_color ?? null,
        activo: false,
      },
      ...etapas,
    ];
  }, [advanceDialog.row, etapas]);

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(filteredRows);

  const contextMenuActions = React.useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'actualizar-avance',
        label: 'Actualizar avance',
        icon: <PlaylistAddCheckIcon fontSize="small" />,
        onClick: () => openAdvanceDialog(contextMenuRow),
      },
    ];
  }, [contextMenuRow, openAdvanceDialog]);

  const contextMenuTriggerColumn = React.useMemo<GridColDef<SeguimientoProduccionRow>>(
    () => ({
      field: 'menu',
      headerName: '',
      width: 42,
      minWidth: 42,
      maxWidth: 42,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      disableReorder: true,
      headerClassName: 'finanzas-header',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns = React.useMemo<GridColDef<SeguimientoProduccionRow>[]>(() => [
    {
      field: 'documento',
      headerName: 'Documento',
      headerClassName: 'finanzas-header',
      minWidth: 150,
      flex: 0.7,
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow, string>) => (
        <Typography variant="body2" noWrap title={params.value || ''}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'cliente',
      headerName: 'Cliente',
      headerClassName: 'finanzas-header',
      minWidth: 220,
      flex: 1,
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow, string>) => (
        <Typography variant="body2" noWrap title={params.value || ''}>
          {params.value || 'Sin cliente'}
        </Typography>
      ),
    },
    {
      field: 'etapa_id',
      headerName: 'Etapa actual',
      headerClassName: 'finanzas-header',
      minWidth: 190,
      flex: 0.8,
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow, number | null>) => {
        const backgroundColor = normalizeHexColor(params.row.etapa_color) || '#e5e7eb';
        const textColor = getContrastingTextColor(params.row.etapa_color);

        return (
          <Chip
            size="small"
            label={params.row.etapa_nombre || 'Sin etapa'}
            sx={{
              fontWeight: 700,
              backgroundColor,
              color: textColor,
              '& .MuiChip-label': {
                color: textColor,
              },
            }}
          />
        );
      },
    },
    {
      field: 'fecha_promesa',
      headerName: 'Fecha promesa',
      headerClassName: 'finanzas-header',
      minWidth: 150,
      flex: 0.7,
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow, string | null>) => (
        <Typography variant="body2">
          {formatCivilDate(params.value)}
        </Typography>
      ),
    },
    {
      field: 'comentarios',
      headerName: 'Comentarios',
      headerClassName: 'finanzas-header',
      minWidth: 260,
      flex: 1.4,
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow, string | null>) => (
        <Typography variant="body2" noWrap title={params.value || ''}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      headerClassName: 'finanzas-header',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<SeguimientoProduccionRow>) => (
        <Tooltip title="Actualizar avance">
          <IconButton size="small" color="primary" onClick={() => openAdvanceDialog(params.row)}>
            <PlaylistAddCheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [openAdvanceDialog]);

  const columns = React.useMemo<GridColDef<SeguimientoProduccionRow>[]>(
    () => [contextMenuTriggerColumn, ...baseColumns],
    [baseColumns, contextMenuTriggerColumn]
  );

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              Producción
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Seguimiento operativo de trabajos enviados desde Ventas.
            </Typography>
          </Stack>
          <IconButton color="primary" onClick={() => void load()} disabled={loading || savingAdvance}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>

        <TextField
          size="small"
          fullWidth
          placeholder="Buscar documento, cliente, etapa o comentario..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row.id}
            autoHeight
            density="standard"
            rowHeight={42}
            columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
            loading={loading || savingAdvance}
            disableRowSelectionOnClick
            columnVisibilityModel={{ menu: true, acciones: SHOW_GRID_ACTIONS }}
            {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
            hideFooterPagination
            hideFooterSelectedRowCount
            initialState={{
              sorting: {
                sortModel: [{ field: 'fecha_promesa', sort: 'asc' }],
              },
            }}
            localeText={{
              ...esES.components.MuiDataGrid.defaultProps.localeText,
              noRowsLabel: 'No hay seguimientos en producción',
            }}
            sx={[
              standardDataGridSx,
              {
                width: '100%',
                '--DataGrid-overlayHeight': '200px',
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
              },
            ]}
          />
        </Paper>

        <GridContextMenu
          actions={contextMenuActions}
          anchorPosition={contextMenuPosition}
          open={Boolean(contextMenuRow && contextMenuPosition)}
          onClose={closeContextMenu}
        />
      </Box>

      <Dialog open={advanceDialog.open} onClose={closeAdvanceDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Actualizar avance</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Etapa actual"
            value={advanceDialog.row?.etapa_nombre || 'Sin etapa'}
            InputProps={{ readOnly: true }}
            fullWidth
            size="small"
          />

          <TextField
            select
            label="Nueva etapa"
            value={advanceDialog.etapaId ?? ''}
            onChange={(event) => {
              const nextValue = event.target.value ? Number(event.target.value) : null;
              setAdvanceDialog((prev) => ({ ...prev, etapaId: nextValue }));
            }}
            fullWidth
            size="small"
          >
            {stageOptions.map((etapa) => (
              <MenuItem key={etapa.id} value={etapa.id}>
                {etapa.nombre}
              </MenuItem>
            ))}
          </TextField>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Fecha compromiso"
              value={advanceDialog.fechaPromesa ? dayjs(advanceDialog.fechaPromesa) : null}
              onChange={(value) => {
                setAdvanceDialog((prev) => ({
                  ...prev,
                  fechaPromesa: value ? value.format('YYYY-MM-DD') : null,
                }));
              }}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </LocalizationProvider>

          <TextField
            label="¿Qué pasó en este avance?"
            value={advanceDialog.comentario}
            onChange={(event) => setAdvanceDialog((prev) => ({ ...prev, comentario: event.target.value }))}
            fullWidth
            size="small"
            multiline
            minRows={3}
            required
            placeholder="En espera de material, cliente pidió cambio, pasa mañana a costura..."
            helperText="Registra el motivo o la acción realizada en este avance."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAdvanceDialog} disabled={savingAdvance}>Cancelar</Button>
          <Button onClick={() => void handleSaveAdvance()} variant="contained" disabled={savingAdvance}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
