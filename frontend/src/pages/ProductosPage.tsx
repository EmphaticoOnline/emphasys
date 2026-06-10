import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, IconButton, Snackbar } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { GridColDef, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';

import type { Producto } from '../types/producto';
import type { ProductoColumnConfig } from './productosColumns';
import { productoColumns } from './productosColumns';
import {
  createProducto,
  deleteProducto,
  exportarProductos,
  fetchProductos,
  updateProducto,
} from '../services/productosService';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { useGridPreferences } from '../hooks/useGridPreferences';
import ProductosDesktopView from '../components/productos/ProductosDesktopView';
import ProductosMobileView from '../components/productos/ProductosMobileView';

export default function ProductosPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const perfilDispositivo = useDeviceProfile();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [exportLoading, setExportLoading] = useState(false);

  const {
    loadingPreferences,
    sortModel,
    setSortModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    setColumnWidths,
    columnOrder,
    setColumnOrder,
    applySavedWidthsToColumns,
    persistExternalFilters,
  } = useGridPreferences<{ searchTerm: string }>({
    pantalla: 'productos.list',
    perfilDispositivo,
    defaultSortModel: [],
    defaultColumnVisibilityModel: {},
    defaultColumnOrder: [],
    defaultExternalFilters: { searchTerm: '' },
    onLoadExternalFilters: (value) => {
      setSearch(String(value.searchTerm ?? ''));
    },
  });

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  const filteredProductos = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter((p) =>
      [p.clave, p.descripcion]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [productos, search]);

  const loadProductos = async () => {
    try {
      setLoading(true);
      const data = await fetchProductos();
      setProductos(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductos();
  }, []);

  useEffect(() => {
    persistExternalFilters({ searchTerm: search });
  }, [persistExternalFilters, search]);

  const handleDelete = async (producto: Producto) => {
    const confirmed = window.confirm(`¿Eliminar el producto "${producto.descripcion}"?`);
    if (!confirmed) return;

    try {
      await deleteProducto(producto.id);
      setSnackbar({ open: true, message: 'Producto eliminado', severity: 'success' });
      loadProductos();
    } catch (e) {
      setSnackbar({
        open: true,
        message: e instanceof Error ? e.message : 'No se pudo eliminar',
        severity: 'error',
      });
    }
  };

  const renderCell = (producto: Producto, field: ProductoColumnConfig['field']) => {
    const value = producto[field];

    if (field === 'activo') {
      const isActive = Boolean(value);
      return <Chip label={isActive ? 'Activo' : 'Inactivo'} size="small" color={isActive ? 'success' : 'default'} />;
    }

    if (field === 'existencia_actual') {
      return value === null || value === undefined ? '—' : Number(value).toLocaleString('es-MX');
    }

    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(filteredProductos);

  const contextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'editar',
        label: 'Editar producto',
        icon: <EditIcon fontSize="small" />,
        onClick: () => navigate(`/productos/${contextMenuRow.id}`),
      },
      {
        id: 'separator-primary',
        type: 'separator',
      },
      {
        id: 'eliminar',
        label: 'Eliminar',
        icon: <DeleteIcon fontSize="small" />,
        destructive: true,
        onClick: () => void handleDelete(contextMenuRow),
      },
    ];
  }, [contextMenuRow, navigate]);

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
      renderCell: (params: GridRenderCellParams<Producto>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const columns: GridColDef[] = useMemo(() => {
    const mapped: GridColDef[] = productoColumns.map((col) => {
      const base: GridColDef = {
        field: col.field as string,
        headerName: col.headerName,
        renderCell: (params: GridRenderCellParams<Producto>) => renderCell(params.row, col.field),
        sortable: true,
        filterable: true,
        type: 'string',
        headerClassName: 'finanzas-header',
      };
      if (col.align !== undefined) {
        base.align = col.align;
        base.headerAlign = col.align;
      }
      if (col.flex !== undefined) base.flex = col.flex;
      if (col.minWidth !== undefined) base.minWidth = col.minWidth;
      return base;
    });

    mapped.push({
      field: 'actions',
      headerName: 'Acciones',
      width: 140,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<Producto>) => (
        <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
          <IconButton color="primary" size="small" onClick={() => navigate(`/productos/${params.id}`)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton color="error" size="small" onClick={() => handleDelete(params.row)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    });

    return applySavedWidthsToColumns([contextMenuTriggerColumn, ...mapped]);
  }, [navigate, handleDelete, contextMenuTriggerColumn, applySavedWidthsToColumns]);

  const orderedColumns = useMemo(() => {
    if (!columnOrder.length) {
      return columns;
    }

    const map = new Map(columns.map((column) => [column.field, column]));
    const menuColumn = map.get('menu');
    const ordered = columnOrder
      .map((field) => map.get(field))
      .filter((column): column is GridColDef => Boolean(column && column.field !== 'menu'));
    const remaining = columns.filter((column) => !columnOrder.includes(column.field) && column.field !== 'menu');

    return [...(menuColumn ? [menuColumn] : []), ...ordered, ...remaining];
  }, [columnOrder, columns]);

  const effectiveColumnVisibilityModel = useMemo(
    () => ({ ...columnVisibilityModel, menu: true, actions: SHOW_GRID_ACTIONS }),
    [columnVisibilityModel]
  );

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const exportColumns = orderedColumns
        .filter(
          (col) =>
            col.field !== 'menu' &&
            col.field !== 'actions' &&
            effectiveColumnVisibilityModel[col.field] !== false
        )
        .map((col) => ({ field: col.field, headerName: String(col.headerName ?? col.field) }));
      await exportarProductos({
        filters: search.trim() ? { search: search.trim() } : {},
        columns: exportColumns,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExportLoading(false);
    }
  };

  const commonViewProps = {
    searchTerm: search,
    onSearchTermChange: setSearch,
    onClearSearch: () => setSearch(''),
    onRefresh: loadProductos,
    onCreateProducto: () => navigate('/productos/nuevo'),
  };

  const desktopView = (
    <ProductosDesktopView
      {...commonViewProps}
      productos={filteredProductos}
      columns={orderedColumns}
      loading={loading || loadingPreferences}
      error={error}
      onClearError={() => setError(null)}
      onRowClick={(params: GridRowParams) => navigate(`/productos/${params.id}`)}
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      columnVisibilityModel={effectiveColumnVisibilityModel}
      onColumnVisibilityModelChange={(model) =>
        setColumnVisibilityModel({ ...model, menu: true, actions: SHOW_GRID_ACTIONS })
      }
      onColumnWidthChange={(params) => {
        setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
      }}
      onColumnOrderChange={({ column, targetIndex }) => {
        setColumnOrder((prev) => {
          const seed = prev.length ? prev : orderedColumns.map((item) => item.field);
          const next = seed.filter((field) => field !== column.field);
          next.splice(targetIndex, 0, column.field);
          return next;
        });
      }}
      slotProps={rowSlotProps ? { row: rowSlotProps } : undefined}
      contextMenuActions={contextMenuActions}
      contextMenuPosition={contextMenuPosition}
      contextMenuOpen={Boolean(contextMenuRow && contextMenuPosition)}
      onCloseContextMenu={closeContextMenu}
      onExport={() => void handleExport()}
      exportLoading={exportLoading}
    />
  );

  const mobileView = (
    <ProductosMobileView
      {...commonViewProps}
      productos={filteredProductos}
      loading={loading}
      error={error}
      onClearError={() => setError(null)}
      onEditProducto={(productoId) => navigate(`/productos/${productoId}`)}
      onDeleteProducto={(producto) => {
        void handleDelete(producto);
      }}
    />
  );

  return <Box sx={{ width: '100%' }}>{isMobile ? mobileView : desktopView}</Box>;
}
