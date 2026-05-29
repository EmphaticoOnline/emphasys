import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
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
import { fetchContactosPaginados, fetchVendedores } from '../services/contactosService.js';
import { eliminarContacto } from '../services/contactos.api';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import ContactosDesktopView from '../components/contactos/ContactosDesktopView';
import ContactosMobileView from '../components/contactos/ContactosMobileView';
import type { ContactoRow } from '../components/contactos/ContactosView.types';

export default function ContactosPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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

  const commonViewProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    onClearSearch: () => setSearchTerm(''),
    tiposOpciones,
    selectedTipos,
    isTodosActivo,
    onToggleTipo: handleToggleTipo,
    onCreateContacto: () => navigate('/contactos/nuevo'),
  };

  const desktopView = (
    <ContactosDesktopView
      {...commonViewProps}
      contactos={contactos}
      orderedColumns={orderedColumns}
      rowCount={rowCount}
      loading={loading}
      paginationModel={{ page, pageSize }}
      density={density}
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      filterModel={filterModel}
      onFilterModelChange={setFilterModel}
      columnVisibilityModel={effectiveColumnVisibilityModel}
      onColumnVisibilityModelChange={(model) =>
        setColumnVisibilityModel({ ...model, menu: true, actions: SHOW_GRID_ACTIONS })
      }
      onPaginationModelChange={(model) => {
        if (model.pageSize !== pageSize) {
          setPageSize(Math.min(model.pageSize, 100));
          setPage(0);
        } else {
          setPage(model.page);
        }
      }}
      onColumnWidthChange={(params) =>
        setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }))
      }
      onColumnOrderChange={({ column, targetIndex }) => {
        setColumnOrder((prev) => {
          const next = prev.filter((field) => field !== column.field);
          next.splice(targetIndex, 0, column.field);
          return next;
        });
      }}
      selectedRowIds={selectedRowIds}
      onRowSelectionModelChange={(selectionModel) => {
        const lastSelectedId = selectionModel[selectionModel.length - 1];
        setSelectedRowIds(selectionModel.length > 1 && lastSelectedId !== undefined ? [lastSelectedId] : selectionModel);
      }}
      onRowDoubleClick={(params, event) => {
        event.defaultMuiPrevented = true;
        handleEditarContacto(params.id);
      }}
      slotProps={rowSlotProps ? { row: rowSlotProps } : undefined}
      contextMenuActions={contextMenuActions}
      contextMenuPosition={contextMenuPosition}
      contextMenuOpen={Boolean(contextMenuRow)}
      onCloseContextMenu={closeContextMenu}
    />
  );

  const mobileView = (
    <ContactosMobileView
      {...commonViewProps}
      contactos={contactos}
      rowCount={rowCount}
      loading={loading}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPageSize(Math.min(nextPageSize, 100));
        setPage(0);
      }}
      onEditContacto={handleEditarContacto}
      onDeleteContacto={(contactoId) => {
        void handleEliminarContacto(contactoId);
      }}
    />
  );

  return <Box sx={{ width: '100%' }}>{isMobile ? mobileView : desktopView}</Box>;
}
