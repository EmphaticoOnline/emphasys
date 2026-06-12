import React from 'react';
import { Chip, IconButton, Paper, Stack, Typography, Tooltip, TextField, InputAdornment } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { DataGrid, GridToolbarContainer } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams, GridSortModel } from '@mui/x-data-grid';
import type { FinanzasOperacion } from '../../types/finanzas';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';
import { useDeviceProfile } from '../../hooks/useDeviceProfile';
import { useGridPreferences } from '../../hooks/useGridPreferences';

export type FinanzasSearchToolbarProps = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
};

export function FinanzasSearchToolbar({ value, onChange, onClear }: FinanzasSearchToolbarProps) {
  return (
    <GridToolbarContainer sx={{ px: 2, py: 1, gap: 1, justifyContent: 'flex-end' }}>
      <TextField
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder="Buscar contacto, concepto, referencia o monto"
        size="small"
        onKeyDown={(event) => event.stopPropagation()}
        sx={{ minWidth: 320 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={onClear} aria-label="Limpiar búsqueda" disabled={!value}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </GridToolbarContainer>
  );
}

interface MovimientosTableProps {
  operaciones: FinanzasOperacion[];
  loading?: boolean;
  initialBalance?: number;
  moneda?: string;
  onEdit?: (op: FinanzasOperacion) => void;
  onDelete?: (op: FinanzasOperacion) => void;
  onView?: (op: FinanzasOperacion) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  showToolbar?: boolean;
  onEditTransferencia?: (op: FinanzasOperacion) => void;
  onDeleteTransferencia?: (op: FinanzasOperacion) => void;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, day] = value.slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function MovimientosTable({
  operaciones,
  loading,
  initialBalance = 0,
  moneda = 'MXN',
  onEdit,
  onDelete,
  onEditTransferencia,
  onDeleteTransferencia,
  onView,
  searchTerm,
  onSearchChange,
  showToolbar = true,
}: MovimientosTableProps) {
  const perfilDispositivo = useDeviceProfile();

  type Row = FinanzasOperacion & {
    runningSaldo: number;
    fecha_fmt: string;
    concepto_display: string;
    contacto_display: string;
    referencia_display: string;
  };
  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 2,
      }),
    [moneda]
  );

  const [search, setSearch] = React.useState('');
  const effectiveSearch = searchTerm ?? search;
  const handleSearchChange = onSearchChange ?? setSearch;

  const defaultSort: GridSortModel = [{ field: 'fecha', sort: 'desc' }];
  const {
    loadingPreferences,
    sortModel,
    setSortModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    columnWidths,
    setColumnWidths,
    persistExternalFilters,
  } = useGridPreferences<{ searchTerm: string }>({
    pantalla: 'finanzas.movimientos',
    perfilDispositivo,
    defaultSortModel: defaultSort,
    defaultColumnVisibilityModel: {},
    defaultExternalFilters: { searchTerm: '' },
    onLoadExternalFilters: (value) => {
      if (onSearchChange) return;
      setSearch(String(value.searchTerm ?? ''));
    },
  });

  React.useEffect(() => {
    persistExternalFilters({ searchTerm: effectiveSearch });
  }, [persistExternalFilters, effectiveSearch]);

  // Precompute ledger saldo per operación id using chronological order
  const ledgerById = React.useMemo(() => {
    const sorted = [...operaciones].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime() || a.id - b.id);
    let saldo = Number(initialBalance || 0);
    const map: Record<number, number> = {};
    for (const op of sorted) {
      const monto = Number(op.monto || 0);
      saldo = op.tipo_movimiento === 'Deposito' ? saldo + monto : saldo - monto;
      map[op.id] = op.saldo ?? saldo;
    }
    return map;
  }, [operaciones, initialBalance]);

  const rows = React.useMemo(() => {
    const term = effectiveSearch.trim().toLowerCase();
    const base: Row[] = operaciones.map((op) => ({
      ...op,
      runningSaldo: ledgerById[op.id] ?? op.saldo ?? 0,
      fecha_fmt: formatDate(op.fecha),
      concepto_display: op.es_transferencia ? 'Transferencia' : op.concepto_nombre || '—',
      contacto_display: op.contacto_nombre || '—',
      referencia_display:
        op.es_transferencia && (op.transferencia_origen_nombre || op.transferencia_destino_nombre)
          ? `${op.transferencia_origen_nombre || 'Origen'} → ${op.transferencia_destino_nombre || 'Destino'}`
          : op.referencia || '—',
    }));
    if (!term) return base;
    return base.filter((op) =>
      [
        op.contacto_display,
        op.concepto_display,
        op.referencia_display,
        typeof op.monto === 'number' ? String(op.monto) : op.monto,
      ].some((field) => (field || '').toLowerCase().includes(term))
    );
  }, [operaciones, ledgerById, effectiveSearch]);

  const handleEditRow = React.useCallback(
    (row: Row) => {
      if (!onEdit) return;

      if (row.es_transferencia && onEditTransferencia) {
        onEditTransferencia(row);
        return;
      }

      onEdit(row);
    },
    [onEdit, onEditTransferencia]
  );

  const handleDeleteRow = React.useCallback(
    (row: Row) => {
      if (!onDelete) return;

      if (row.es_transferencia && onDeleteTransferencia) {
        onDeleteTransferencia(row);
        return;
      }

      onDelete(row);
    },
    [onDelete, onDeleteTransferencia]
  );

  const canViewRowDetail = React.useCallback(
    (row: Row) => Boolean(onView) && row.naturaleza_operacion === 'cobro_cliente',
    [onView]
  );

  const handleViewRow = React.useCallback(
    (row: Row) => {
      if (!canViewRowDetail(row) || !onView) return;
      onView(row);
    },
    [canViewRowDetail, onView]
  );

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(rows);

  const contextMenuActions = React.useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'editar',
        label: 'Editar',
        icon: <EditIcon fontSize="small" />,
        hidden: !onEdit,
        onClick: () => handleEditRow(contextMenuRow),
      },
      {
        id: 'eliminar',
        label: 'Eliminar',
        icon: <DeleteIcon fontSize="small" />,
        hidden: !onDelete,
        destructive: true,
        onClick: () => handleDeleteRow(contextMenuRow),
      },
      {
        id: 'separator-detalle',
        type: 'separator',
      },
      {
        id: 'ver-detalle',
        label: 'Ver detalle',
        icon: <VisibilityIcon fontSize="small" />,
        disabled: !canViewRowDetail(contextMenuRow),
        onClick: () => handleViewRow(contextMenuRow),
      },
    ];
  }, [canViewRowDetail, contextMenuRow, handleDeleteRow, handleEditRow, handleViewRow, onDelete, onEdit]);

  const contextMenuTriggerColumn = React.useMemo<GridColDef<Row>>(
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
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Row>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const renderEstadoChip = (estado?: string) => {
    const value = estado || 'pendiente';
    const color = value === 'conciliado' ? 'success' : value === 'cotejado' ? 'info' : 'default';
    return <Chip label={value} size="small" color={color as any} variant={color === 'default' ? 'outlined' : 'filled'} />;
  };

  const columns = React.useMemo<GridColDef<Row>[]>(
    () => [
      contextMenuTriggerColumn,
      {
        field: 'fecha',
        headerName: 'Fecha',
  width: columnWidths.fecha ?? 105,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Typography variant="body2">{formatDate(params.row.fecha)}</Typography>
        ),
      },
      {
        field: 'contacto_display',
        headerName: 'Contacto',
        width: columnWidths.contacto_display ?? 180,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Typography variant="body2" fontWeight={400} color="#111827">
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'concepto_display',
        headerName: 'Concepto',
  flex: 1,
  minWidth: 140,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Stack spacing={0.25}>
            <Typography variant="body2" fontWeight={400} color="#1d2f68">
              {params.value || '—'}
            </Typography>
            {params.row.observaciones && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {params.row.observaciones}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'referencia',
        headerName: 'Referencia',
  width: columnWidths.referencia_display ?? 120,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.row.referencia_display || '—'}
          </Typography>
        ),
      },
      {
        field: 'monto',
        headerName: 'Monto',
  width: columnWidths.monto ?? 120,
        align: 'right',
        headerAlign: 'right',
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row, number>) => {
          const isDeposito = params.row.tipo_movimiento === 'Deposito';
          const display = formatter.format(isDeposito ? params.value ?? 0 : -Math.abs(params.value ?? 0));
          return (
            <Typography variant="body2" fontWeight={700} color={isDeposito ? '#006261' : '#b91c1c'}>
              {display}
            </Typography>
          );
        },
      },
      {
        field: 'runningSaldo',
        headerName: 'Saldo',
  width: columnWidths.runningSaldo ?? 130,
        align: 'right',
        headerAlign: 'right',
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row, number>) => (
          <Typography variant="body2" fontWeight={700} color="#1d2f68">
            {formatter.format(params.value ?? 0)}
          </Typography>
        ),
      },
      {
        field: 'acciones',
        headerName: 'Acciones',
  width: columnWidths.acciones ?? 100,
        sortable: true,
        filterable: true,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ width: '100%' }}>
            {onEdit && (
              <Tooltip title="Editar">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleEditRow(params.row)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {onDelete && (
              <Tooltip title="Eliminar">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteRow(params.row)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            <Tooltip title="Ver detalle">
              <span>
                <IconButton
                  size="small"
                  disabled={!canViewRowDetail(params.row)}
                  onClick={() => handleViewRow(params.row)}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
      {
        field: 'estado_conciliacion',
        headerName: 'Estado',
  width: columnWidths.estado_conciliacion ?? 120,
        sortable: true,
        filterable: true,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => renderEstadoChip(params.value as string),
      },
    ],
    [canViewRowDetail, columnWidths, contextMenuTriggerColumn, formatter, handleDeleteRow, handleEditRow, handleViewRow, onDelete, onEdit]
  );

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>
      <DataGrid<Row>
    rows={rows}
    columns={columns}
  density="standard"
  rowHeight={42}
  columnHeaderHeight={42}
  columnBufferPx={2}
        loading={!!loading || loadingPreferences}
        sortModel={sortModel}
        onSortModelChange={(model) => setSortModel(model.length ? model : defaultSort)}
        localeText={esES.components.MuiDataGrid.defaultProps.localeText}
        hideFooterPagination
        disableRowSelectionOnClick
        columnVisibilityModel={{ ...columnVisibilityModel, menu: true, acciones: SHOW_GRID_ACTIONS }}
        onColumnVisibilityModelChange={(model) => {
          setColumnVisibilityModel({ ...model, menu: true, acciones: SHOW_GRID_ACTIONS });
        }}
        {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
        onColumnWidthChange={(params) => {
          if (!params.colDef?.field || typeof params.width !== 'number') return;
          setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
        }}
        slots={
          showToolbar
            ? {
                toolbar: ((props) => (
                  <FinanzasSearchToolbar
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    {...props}
                    value={effectiveSearch}
                    onChange={(v: string) => handleSearchChange(v)}
                    onClear={() => handleSearchChange('')}
                  />
                )) as React.ComponentType,
              }
            : {}
        }
        sx={{
          height: '100%',
          fontSize: 12.5,
          '--DataGrid-overlayHeight': '200px',
          '& .MuiDataGrid-cell': {
            display: 'flex',
            alignItems: 'center',
            fontSize: 13,
          },
          '& .MuiDataGrid-columnHeaders': {
            fontSize: 13,
            minHeight: 42,
            maxHeight: 42,
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontSize: 13,
            fontWeight: 600,
          },
          '& .MuiDataGrid-row:nth-of-type(even)': {
            backgroundColor: 'rgba(0, 120, 70, 0.05)',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(15, 23, 42, 0.04)',
          },
          '& .MuiDataGrid-row.Mui-selected': {
            backgroundColor: 'rgba(29, 47, 104, 0.08)',
          },
          '& .MuiDataGrid-row.Mui-selected:hover': {
            backgroundColor: 'rgba(29, 47, 104, 0.12)',
          },
          '& .finanzas-header': {
            backgroundColor: '#1d2f68 !important',
            color: '#ffffff !important',
            fontWeight: 600,
          },
          '& .finanzas-header .MuiDataGrid-columnHeaderTitle': {
            color: '#ffffff !important',
            fontWeight: 600,
          },
          '& .finanzas-header .MuiDataGrid-sortIcon': {
            color: '#ffffff !important',
          },
          '& .finanzas-header .MuiDataGrid-menuIcon': {
            color: '#ffffff !important',
          },
          '& .finanzas-header:hover .MuiDataGrid-menuIcon': {
            color: '#ffffff !important',
          },
          '& .finanzas-header .MuiIconButton-root': {
            color: '#ffffff !important',
          },
          '& .MuiDataGrid-columnSeparator': {
            color: 'rgba(255,255,255,0.25) !important',
          },
        }}
        getRowId={(row) => row.id}
      />

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuRow && contextMenuPosition)}
        onClose={closeContextMenu}
      />
    </Paper>
  );
}

export default MovimientosTable;
