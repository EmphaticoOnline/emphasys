import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type {
  GridColDef,
  GridRowSelectionModel,
  GridSortModel,
  GridFilterModel,
  GridColumnVisibilityModel,
  GridDensity,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { fetchContactosPaginados, fetchVendedores } from '../services/contactosService.js';
import { eliminarContacto } from '../services/contactos.api';
import type { Contacto } from '../types/contactos.types';
import { GridContextMenu } from '../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../hooks/useGridContextMenu';

type ContactoRow = Contacto & {
  vendedor_nombre?: string | null;
};

export default function ContactosPage() {
  const navigate = useNavigate();
  const [contactos, setContactos] = useState<ContactoRow[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowSelectionModel>([]);
  const lastSearchRef = useRef('');

  const STORAGE_KEY = 'contactos_grid_state';

  const readStoredState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {} as any;
      return JSON.parse(raw) as {
        sortModel?: GridSortModel;
        filterModel?: GridFilterModel;
        columnVisibilityModel?: GridColumnVisibilityModel;
        columnWidths?: Record<string, number>;
        columnOrder?: string[];
        density?: GridDensity;
      };
    } catch (e) {
      console.warn('No se pudo leer estado de la tabla', e);
      return {} as any;
    }
  };

  const vendedorNombre = useMemo(() => {
    const map = new Map<number, string>();
    vendedores.forEach((v: any) => {
      if (v?.id) map.set(Number(v.id), v.nombre || '');
    });
    return map;
  }, [vendedores]);

  const tiposOpciones = ['Todos', 'Cliente', 'Proveedor', 'Vendedor', 'Lead'];
  const isTodosActivo = selectedTipos.length === 0;

  const handleEditarContacto = (contactoId: number | string) => {
    navigate(`/contactos/${contactoId}`);
  };

  const handleEliminarContacto = async (contactoId: number | string) => {
    const confirmed = window.confirm('¿Eliminar el contacto?');
    if (!confirmed) return;
    try {
      await eliminarContacto(Number(contactoId));
      setSelectedRowIds([]);
      loadContactos();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar';
      setError(message);
    }
  };

  const handleToggleTipo = (tipo: string) => {
    if (tipo === 'Todos') {
      setSelectedTipos([]);
      return;
    }

    setSelectedTipos((prev) => {
      const next = prev.filter((t) => t !== 'Todos');
      if (next.includes(tipo)) {
        return next.filter((t) => t !== tipo);
      }
      return [...next, tipo];
    });
  };

  const baseColumns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1, minWidth: 180, headerClassName: 'finanzas-header' },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200, headerClassName: 'finanzas-header' },
    {
      field: 'clasificacion',
      headerName: 'Clasificación',
      width: 150,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams) => params.value || '',
    },
    {
      field: 'origen_contacto',
      headerName: 'Origen Contacto',
      width: 160,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams) => params.value || '',
    },
    {
      field: 'vendedor_id',
      headerName: 'Vendedor(a)',
      width: 160,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams) => {
        const value = Number(params.value);
        if (!value) return '';
        return params.row?.vendedor_nombre || vendedorNombre.get(value) || String(params.value ?? '');
      },
    },
    { field: 'telefono', headerName: 'Celular', width: 130, headerClassName: 'finanzas-header' },
    { field: 'telefono_secundario', headerName: 'Teléfono', width: 130, headerClassName: 'finanzas-header' },
    { field: 'tipo_contacto', headerName: 'Tipo contacto', width: 150, headerClassName: 'finanzas-header' },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 110,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(event) => event.stopPropagation()}>
          <IconButton size="small" onClick={() => handleEditarContacto(params.id)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              void handleEliminarContacto(params.id);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const stored = readStoredState();

  const [sortModel, setSortModel] = useState<GridSortModel>(stored.sortModel || []);
  const [filterModel, setFilterModel] = useState<GridFilterModel>(stored.filterModel || { items: [] });
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>(
    stored.columnVisibilityModel || {}
  );
  const [density] = useState<GridDensity>('standard');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(stored.columnWidths || {});
  const [columnOrder, setColumnOrder] = useState<string[]>(
    stored.columnOrder || baseColumns.map((c) => c.field)
  );

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(contactos, {
    onOpen: (row) => {
      setSelectedRowIds([row.id]);
    },
  });

  const contextMenuTriggerColumn = useMemo<GridColDef>(
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
      renderCell: (params: GridRenderCellParams) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row as ContactoRow)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const columns: GridColDef[] = useMemo(
    () =>
      [contextMenuTriggerColumn, ...baseColumns].map((col) => {
        const savedWidth = columnWidths[col.field];
        if (savedWidth !== undefined) {
          const { flex, ...rest } = col;
          return { ...rest, width: savedWidth } as GridColDef;
        }
        return col;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnWidths, vendedorNombre, contextMenuTriggerColumn]
  );

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.field, c]));
    const menuColumn = map.get('menu');
    const ordered = columnOrder
      .map((field) => map.get(field))
      .filter((c): c is GridColDef => c != null && c.field !== 'menu');
    const remaining = columns.filter((c) => !columnOrder.includes(c.field) && c.field !== 'menu');
    return [...(menuColumn ? [menuColumn] : []), ...ordered, ...remaining];
  }, [columnOrder, columns]);

  const effectiveColumnVisibilityModel = useMemo(
    () => ({ ...columnVisibilityModel, menu: true, actions: SHOW_GRID_ACTIONS }),
    [columnVisibilityModel]
  );

  const contextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'editar',
        label: 'Editar contacto',
        icon: <EditIcon fontSize="small" />,
        shortcut: 'Enter',
        onClick: () => handleEditarContacto(contextMenuRow.id),
      },
      {
        id: 'separator-primary',
        type: 'separator',
      },
      {
        id: 'eliminar',
        label: 'Eliminar',
        icon: <DeleteIcon fontSize="small" />,
        shortcut: 'Del',
        destructive: true,
        onClick: () => handleEliminarContacto(contextMenuRow.id),
      },
    ];
  }, [contextMenuRow]);

  useEffect(() => {
    setSelectedRowIds((prev) => prev.filter((rowId) => contactos.some((contacto) => String(contacto.id) === String(rowId))));
  }, [contactos]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedRowIds.length === 0) {
        return;
      }

      const selectedRowId = selectedRowIds[0];
      if (selectedRowId === undefined) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        handleEditarContacto(selectedRowId);
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }

      event.preventDefault();
      void handleEliminarContacto(selectedRowId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRowIds]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  const loadContactos = () => {
    setLoading(true);
    if (lastSearchRef.current !== debouncedSearch) {
      lastSearchRef.current = debouncedSearch;
      if (page !== 0) {
        setPage(0);
        setLoading(false);
        return;
      }
    }
    const tiposParam = selectedTipos.length ? selectedTipos : undefined;
    fetchContactosPaginados(
      tiposParam
        ? debouncedSearch
          ? { page: page + 1, limit: pageSize, search: debouncedSearch, tipos: tiposParam }
          : { page: page + 1, limit: pageSize, tipos: tiposParam }
        : debouncedSearch
          ? { page: page + 1, limit: pageSize, search: debouncedSearch }
          : { page: page + 1, limit: pageSize }
    )
      .then((response) => {
        setContactos(response.data);
        setRowCount(response.total);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContactos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, selectedTipos]);

  useEffect(() => {
    setPage(0);
  }, [selectedTipos]);

  useEffect(() => {
    fetchVendedores()
      .then((data) => setVendedores(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const stateToPersist = {
      sortModel,
      filterModel,
      columnVisibilityModel,
      columnWidths,
      columnOrder,
      density,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
  }, [sortModel, filterModel, columnVisibilityModel, columnWidths, columnOrder, density]);

  if (error) return <div>Error: {error}</div>;

  return (
    <Box sx={{ width: '100%', px: 3, py: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 260 }}>
            <Box>
              <Typography variant="h5" fontWeight={600} color="#1d2f68">Contactos</Typography>
              <Typography variant="body2" color="#4b5563">Gestiona y consulta tus contactos registrados.</Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Buscar por nombre, email o teléfono"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ maxWidth: 360 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton aria-label="Borrar búsqueda" size="small" onClick={() => setSearchTerm('')} edge="end">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {tiposOpciones.map((tipo) => {
                const selected = tipo === 'Todos' ? isTodosActivo : selectedTipos.includes(tipo);
                return (
                  <Chip
                    key={tipo}
                    label={tipo}
                    clickable
                    onClick={() => handleToggleTipo(tipo)}
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    size="small"
                  />
                );
              })}
            </Stack>
          </Box>
          <Button
            variant="contained"
            onClick={() => navigate('/contactos/nuevo')}
            sx={{
              textTransform: 'uppercase',
              fontWeight: 700,
              backgroundColor: '#1d2f68',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#162551' },
              alignSelf: 'flex-end',
            }}
          >
            + NUEVO
          </Button>
        </Box>

        <Box sx={{ width: '100%', backgroundColor: '#fff', borderRadius: 1, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <DataGrid
            rows={contactos}
            columns={orderedColumns}
            rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
            columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
            autoHeight
            pagination
            paginationMode="server"
            rowCount={rowCount}
            loading={loading}
            paginationModel={{ page, pageSize }}
            pageSizeOptions={[25, 50, 100]}
            onPaginationModelChange={(model) => {
              if (model.pageSize !== pageSize) {
                setPageSize(Math.min(model.pageSize, 100));
                setPage(0);
              } else {
                setPage(model.page);
              }
            }}
            density={density}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
            columnVisibilityModel={effectiveColumnVisibilityModel}
            onColumnVisibilityModelChange={(model) =>
              setColumnVisibilityModel({ ...model, menu: true, actions: SHOW_GRID_ACTIONS })
            }
            onColumnWidthChange={(params) =>
              setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }))
            }
            onColumnOrderChange={({ column, targetIndex }) => {
              setColumnOrder((prev) => {
                const next = prev.filter((f) => f !== column.field);
                next.splice(targetIndex, 0, column.field);
                return next;
              });
            }}
            rowSelectionModel={selectedRowIds}
            onRowSelectionModelChange={(selectionModel) => {
              const lastSelectedId = selectionModel[selectionModel.length - 1];
              setSelectedRowIds(selectionModel.length > 1 && lastSelectedId !== undefined ? [lastSelectedId] : selectionModel);
            }}
            onRowDoubleClick={(params, event) => {
              event.defaultMuiPrevented = true;
              handleEditarContacto(params.id);
            }}
            {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
            localeText={esES.components.MuiDataGrid.defaultProps.localeText}
            hideFooterSelectedRowCount
            sx={[
              standardDataGridSx,
              {
                '--DataGrid-overlayHeight': '200px',
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-row': {
                  cursor: 'default',
                },
              },
            ]}
          />
          <GridContextMenu
            actions={contextMenuActions}
            anchorPosition={contextMenuPosition}
            open={Boolean(contextMenuRow)}
            onClose={closeContextMenu}
          />
        </Box>
      </Box>
    </Box>
  );
}
