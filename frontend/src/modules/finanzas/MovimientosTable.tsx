import React from 'react';
import { Chip, IconButton, Paper, Stack, Typography, Tooltip, TextField, InputAdornment } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { DataGrid, GridToolbarContainer } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { FinanzasOperacion } from '../../types/finanzas';

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
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  showToolbar?: boolean;
  onEditTransferencia?: (op: FinanzasOperacion) => void;
  onDeleteTransferencia?: (op: FinanzasOperacion) => void;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // If it already comes as yyyy-mm-dd, reformat it
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, day] = value.slice(0, 10).split('-');
      const month = MONTHS_SHORT[Number(m) - 1] || m;
      return `${day}-${month}-${y}`;
    }
    return value;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_SHORT[d.getMonth()] || String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
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
  searchTerm,
  onSearchChange,
  showToolbar = true,
}: MovimientosTableProps) {
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

  const renderEstadoChip = (estado?: string) => {
    const value = estado || 'pendiente';
    const color = value === 'conciliado' ? 'success' : value === 'cotejado' ? 'info' : 'default';
    return <Chip label={value} size="small" color={color as any} variant={color === 'default' ? 'outlined' : 'filled'} />;
  };

  const columns = React.useMemo<GridColDef<Row>[]>(
    () => [
      {
        field: 'fecha',
        headerName: 'Fecha',
        width: 130,
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
        flex: 1,
        minWidth: 160,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Typography variant="body2" fontWeight={600} color="#111827">
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'concepto_display',
        headerName: 'Concepto',
        flex: 1,
        minWidth: 160,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Stack spacing={0.25}>
            <Typography variant="body2" fontWeight={700} color="#1d2f68">
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
        flex: 1,
        minWidth: 140,
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
        width: 140,
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
        width: 150,
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
        width: 120,
        sortable: true,
        filterable: true,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Stack direction="row" spacing={0.5} justifyContent="center" width="100%">
            {onEdit && (
              <Tooltip title="Editar">
                <span>
                  <IconButton
                    size="small"
                    onClick={() =>
                      params.row.es_transferencia && onEditTransferencia
                        ? onEditTransferencia(params.row)
                        : onEdit(params.row)
                    }
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
                    onClick={() =>
                      params.row.es_transferencia && onDeleteTransferencia
                        ? onDeleteTransferencia(params.row)
                        : onDelete(params.row)
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
      {
        field: 'estado_conciliacion',
        headerName: 'Estado',
        width: 130,
        sortable: true,
        filterable: true,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => renderEstadoChip(params.value as string),
      },
    ],
    [formatter, onDelete, onEdit]
  );

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>
      <DataGrid<Row>
        autoHeight
        rows={rows}
        columns={columns}
  rowHeight={32}
        loading={!!loading}
        initialState={{
          sorting: {
            sortModel: [{ field: 'fecha', sort: 'desc' }],
          },
        }}
        localeText={esES.components.MuiDataGrid.defaultProps.localeText}
        hideFooterPagination
        disableRowSelectionOnClick
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
          '--DataGrid-overlayHeight': '200px',
          '& .MuiDataGrid-cell': {
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiDataGrid-row:nth-of-type(even)': {
            backgroundColor: 'rgba(0, 120, 70, 0.05)',
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
    </Paper>
  );
}

export default MovimientosTable;
