import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Snackbar } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { GridColDef, GridColumnVisibilityModel, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';

import type { Producto } from '../types/producto';
import type { ProductoColumnConfig } from './productosColumns';
import { productoColumns } from './productosColumns';
import {
  createProducto,
  deleteProducto,
  exportarProductos,
  fetchProductosPaginados,
  fetchConfiguracionEspecificaciones,
  updateProducto,
} from '../services/productosService';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { useGridPreferences } from '../hooks/useGridPreferences';
import ProductosDesktopView from '../components/productos/ProductosDesktopView';
import EspecificacionesBibliotecaEditor from '../components/productos/EspecificacionesBibliotecaEditor';
import { useSession } from '../session/useSession';
import { esRolAdmin } from '../session/rolScope';
import { fetchExistenciasPorAlmacen, type ExistenciaPorAlmacen } from '../services/reportesService';
import {
  guardarProductosOrigen,
  olvidarProductosOrigen,
  PRODUCTOS_ORIGEN_STATE,
  resolverProductosOrigen,
  type ProductosOrigenNavegacion,
} from '../modules/productos/productosOrigenNavegacion';
import { PRODUCTOS_ORDEN_DEFAULT, resolverOrdenProductos } from '../modules/productos/productosOrden';

function sumarExistenciasPorProducto(lineas: ExistenciaPorAlmacen[]): Record<number, number> {
  const mapa: Record<number, number> = {};
  for (const linea of lineas) {
    const cantidad = Number(linea.existencia);
    if (!Number.isFinite(cantidad)) continue;
    mapa[linea.producto_id] = (mapa[linea.producto_id] ?? 0) + cantidad;
  }
  return mapa;
}

export default function ProductosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { session } = useSession();
  const empresaId = Number(session.empresaActivaId ?? 0);
  const origenRef = useRef<{ listo: boolean; valor: ProductosOrigenNavegacion | null }>({ listo: false, valor: null });
  if (!origenRef.current.listo && empresaId > 0) {
    origenRef.current = {
      listo: true,
      valor: resolverProductosOrigen(location.state, navigationType, empresaId),
    };
  }
  const origen = origenRef.current.valor;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const perfilDispositivo = useDeviceProfile();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [existenciasPorProducto, setExistenciasPorProducto] = useState<Record<number, number> | null>(null);
  const [search, setSearch] = useState(origen?.busqueda ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(origen?.busqueda.trim() ?? '');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [exportLoading, setExportLoading] = useState(false);
  const [globalSpecsOpen, setGlobalSpecsOpen] = useState(false);
  const [especificacionesHabilitadas, setEspecificacionesHabilitadas] = useState(false);
  const [selectedProductoId, setSelectedProductoId] = useState<number | null>(origen?.productoId ?? null);
  const scrollListaRef = useRef(origen?.scrollLista ?? 0);
  const scrollDetalleRef = useRef(origen?.scrollDetalle ?? 0);
  const esAdmin = Boolean(session.user?.es_superadmin) || esRolAdmin(session.roles);

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
    defaultSortModel: PRODUCTOS_ORDEN_DEFAULT,
    defaultColumnVisibilityModel: {},
    defaultColumnOrder: [],
    defaultExternalFilters: { searchTerm: '' },
    onLoadExternalFilters: (value) => {
      const restaurado = origenRef.current.valor;
      setSearch(restaurado ? restaurado.busqueda : String(value.searchTerm ?? ''));
    },
  });

  // Preferencias guardadas antes del selector pueden traer [] o columnas no ordenables en servidor
  const ordenActivo = useMemo(() => resolverOrdenProductos(sortModel), [sortModel]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  const loadProductos = async () => {
    if (loadingPreferences) return;
    try {
      setLoading(true);
      const [result, existencias] = await Promise.all([
        fetchProductosPaginados({
          page: page + 1,
          limit: pageSize,
          search: debouncedSearch,
          sort: ordenActivo.field,
          dir: ordenActivo.sort,
        }),
        fetchExistenciasPorAlmacen({}).catch(() => null),
      ]);
      setProductos(result.data);
      setRowCount(result.total);
      setExistenciasPorProducto(existencias ? sumarExistenciasPorProducto(existencias.lineas) : null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const origenAplicadoRef = useRef(false);
  useEffect(() => {
    if (!origen || origenAplicadoRef.current) return;
    origenAplicadoRef.current = true;
    setSearch(origen.busqueda);
    setDebouncedSearch(origen.busqueda.trim());
    setSelectedProductoId(origen.productoId);
  }, [origen]);

  useEffect(() => {
    if (!origen || !origenAplicadoRef.current) return;
    if (search === origen.busqueda && selectedProductoId === origen.productoId) return;
    olvidarProductosOrigen();
  }, [origen, search, selectedProductoId]);

  // Debounce search
  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(handler);
  }, [search]);

  // Reset page when search or sort changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, ordenActivo.field, ordenActivo.sort]);

  useEffect(() => {
    loadProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, ordenActivo.field, ordenActivo.sort, loadingPreferences]);

  useEffect(() => {
    persistExternalFilters({ searchTerm: search });
  }, [persistExternalFilters, search]);

  useEffect(() => {
    void fetchConfiguracionEspecificaciones()
      .then((config) => setEspecificacionesHabilitadas(config.habilitado))
      .catch(() => setEspecificacionesHabilitadas(false));
  }, [session.empresaActivaId]);

  // Autoselección del primer producto visible en la vista Lista, igual que Contactos.
  useEffect(() => {
    if (isMobile || loading) return;
    if (origen && selectedProductoId === origen.productoId) return;
    if (productos.length === 0) {
      setSelectedProductoId(null);
      return;
    }
    const stillVisible = selectedProductoId != null && productos.some((producto) => producto.id === selectedProductoId);
    if (!stillVisible && productos[0]) {
      setSelectedProductoId(productos[0].id);
    }
  }, [origen, productos, isMobile, loading, selectedProductoId]);

  const handleDelete = async (producto: Producto) => {
    const confirmed = window.confirm(`¿Eliminar el producto "${producto.descripcion}"?`);
    if (!confirmed) return;

    try {
      await deleteProducto(producto.id);
      setSnackbar({ open: true, message: 'Producto eliminado', severity: 'success' });
      if (selectedProductoId === producto.id) setSelectedProductoId(null);
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
      const existencia = existenciasPorProducto?.[producto.id];
      return existencia === null || existencia === undefined ? '—' : Number(existencia).toLocaleString('es-MX');
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
  } = useGridContextMenu(productos);

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
  }, [navigate, handleDelete, contextMenuTriggerColumn, applySavedWidthsToColumns, existenciasPorProducto]);

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

  const effectiveColumnVisibilityModel = useMemo<GridColumnVisibilityModel>(
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
      productos={productos}
      columns={orderedColumns}
      loading={loading || loadingPreferences}
      error={error}
      rowCount={rowCount}
      paginationModel={{ page, pageSize }}
      onPaginationModelChange={(model) => {
        if (model.pageSize !== pageSize) {
          setPageSize(Math.min(model.pageSize, 100));
          setPage(0);
        } else {
          setPage(model.page);
        }
      }}
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
      esAdmin={esAdmin}
      selectedProductoId={selectedProductoId}
      existenciasPorProducto={existenciasPorProducto}
      onSelectProducto={setSelectedProductoId}
      onEditProducto={(productoId) => navigate(`/productos/${productoId}`)}
      onDeleteProducto={(producto) => void handleDelete(producto)}
      {...(especificacionesHabilitadas ? { onOpenBiblioteca: () => setGlobalSpecsOpen(true) } : {})}
      {...(origen ? { scrollListaInicial: origen.scrollLista, restauracion: { productoId: origen.productoId, tipoDocumento: origen.tipoDocumento, scrollDetalle: origen.scrollDetalle } } : {})}
      onScrollLista={(valor) => {
        scrollListaRef.current = valor;
      }}
      onScrollDetalle={(valor) => {
        scrollDetalleRef.current = valor;
      }}
      onAbrirDocumentoRelacionado={(ruta, tipo) => {
        if (!selectedProductoId || empresaId <= 0) {
          navigate(ruta);
          return;
        }
        const contexto: ProductosOrigenNavegacion = {
          empresaId,
          productoId: selectedProductoId,
          busqueda: search,
          tab: 'relacionados',
          tipoDocumento: tipo,
          scrollLista: scrollListaRef.current,
          scrollDetalle: scrollDetalleRef.current,
        };
        guardarProductosOrigen(contexto);
        navigate(ruta, { state: { [PRODUCTOS_ORIGEN_STATE]: contexto } });
      }}
    />
  );

  return <Box sx={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    {desktopView}
    <Dialog open={globalSpecsOpen} onClose={() => setGlobalSpecsOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>Biblioteca global de especificaciones</DialogTitle>
      <DialogContent dividers><EspecificacionesBibliotecaEditor alcance="global" titulo={null} onError={(message) => setSnackbar({ open: true, message, severity: 'error' })} /></DialogContent>
    </Dialog>
    <Snackbar open={snackbar.open} autoHideDuration={3200} onClose={() => setSnackbar((p) => ({ ...p, open: false }))} message={snackbar.message} />
  </Box>;
}
