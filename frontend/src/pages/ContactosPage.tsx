import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { fetchContactosPaginados, fetchVendedores } from '../services/contactosService.js';
import { obtenerCatalogosConfigurablesContacto } from '../services/contactos.api';
import { eliminarContacto } from '../services/contactos.api';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { useGridPreferences } from '../hooks/useGridPreferences';
import ContactosDesktopView from '../components/contactos/ContactosDesktopView';
import ContactosMobileView from '../components/contactos/ContactosMobileView';
import ActividadSeguimientoDrawer from '../components/crm/ActividadSeguimientoDrawer';
import type {
  ContactoActivoFilter,
  ContactoOrigenOption,
  ContactoRow,
  ContactosAdvancedFiltersState,
} from '../components/contactos/ContactosView.types';

const TIPOS_CONTACTO_OPCIONES = ['Cliente', 'Proveedor', 'Vendedor', 'Lead'];

const CONTACTOS_ADVANCED_FILTERS_INITIAL: ContactosAdvancedFiltersState = {
  selectedTipos: [],
  origenContactoId: null,
  vendedorId: null,
  activo: 'todos',
  fechaAltaDesde: '',
  fechaAltaHasta: '',
  interesInicial: '',
  observaciones: '',
  filtersOpen: false,
};

const normalizeFilterLookup = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function ContactosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const perfilDispositivo = useDeviceProfile();
  const [contactos, setContactos] = useState<ContactoRow[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [origenOptions, setOrigenOptions] = useState<ContactoOrigenOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowSelectionModel>([]);
  const [advancedFilters, setAdvancedFilters] = useState<ContactosAdvancedFiltersState>(CONTACTOS_ADVANCED_FILTERS_INITIAL);
  const [seguimientoContacto, setSeguimientoContacto] = useState<ContactoRow | null>(null);
  const [seguimientoDrawerOpen, setSeguimientoDrawerOpen] = useState(false);
  const drawerReopenHandled = useRef(false);

  const vendedorNombre = useMemo(() => {
    const map = new Map<number, string>();
    vendedores.forEach((v: any) => {
      if (v?.id) map.set(Number(v.id), v.nombre || '');
    });
    return map;
  }, [vendedores]);

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

  const handleVerActividades = (contacto: ContactoRow) => {
    setSeguimientoContacto(contacto);
    setSeguimientoDrawerOpen(true);
  };

  const openDrawerContactoId = (location.state as { openDrawerContactoId?: number } | null)?.openDrawerContactoId ?? null;

  useEffect(() => {
    if (!openDrawerContactoId || drawerReopenHandled.current || contactos.length === 0) return;
    const contacto = contactos.find((c) => c.id === openDrawerContactoId);
    if (contacto) {
      drawerReopenHandled.current = true;
      handleVerActividades(contacto);
    }
  }, [contactos, openDrawerContactoId]);

  const closeSeguimientoDrawer = () => {
    setSeguimientoDrawerOpen(false);
  };

  const seguimientoTarget = useMemo(() => {
    if (!seguimientoContacto) {
      return null;
    }

    const contactoNombre = seguimientoContacto.nombre_contacto?.trim();
    const empresaNombre = seguimientoContacto.nombre?.trim() || `Contacto #${seguimientoContacto.id}`;

    return {
      kind: 'contacto' as const,
      id: seguimientoContacto.id,
      title: contactoNombre || empresaNombre,
      subtitle: contactoNombre && contactoNombre !== empresaNombre
        ? empresaNombre
        : seguimientoContacto.email?.trim() || seguimientoContacto.telefono?.trim() || 'Sin oportunidad',
    };
  }, [seguimientoContacto]);

  const baseColumns: GridColDef[] = [
    { field: 'nombre', headerName: 'Empresa', flex: 1, minWidth: 180, headerClassName: 'finanzas-header' },
    { field: 'nombre_contacto', headerName: 'Contacto', flex: 1, minWidth: 180, headerClassName: 'finanzas-header' },
    { field: 'telefono', headerName: 'Teléfono', width: 130, headerClassName: 'finanzas-header' },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200, headerClassName: 'finanzas-header' },
    { field: 'tipo_contacto', headerName: 'Tipo contacto', width: 150, headerClassName: 'finanzas-header' },
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
      field: 'interes_inicial',
      headerName: 'Interés inicial',
      width: 220,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams) => params.value || '',
    },
    { field: 'telefono_secundario', headerName: 'Teléfono', width: 130, headerClassName: 'finanzas-header' },
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

  const [density] = useState<GridDensity>('standard');
  const {
    loadingPreferences,
    sortModel,
    setSortModel,
    filterModel,
    setFilterModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    setColumnWidths,
    columnOrder,
    setColumnOrder,
    applySavedWidthsToColumns,
    persistExternalFilters,
  } = useGridPreferences<{
    searchTerm: string;
    advancedFilters: ContactosAdvancedFiltersState;
  }>({
    pantalla: 'contactos.list',
    perfilDispositivo,
    defaultSortModel: [],
    defaultFilterModel: { items: [] },
    defaultColumnVisibilityModel: { origen_contacto: false, interes_inicial: false },
    defaultColumnOrder: ['menu', ...baseColumns.map((column) => column.field)],
    defaultExternalFilters: { searchTerm: '', advancedFilters: CONTACTOS_ADVANCED_FILTERS_INITIAL },
    onLoadExternalFilters: (value) => {
      setSearchTerm(String(value.searchTerm ?? ''));
      if (value.advancedFilters && typeof value.advancedFilters === 'object') {
        setAdvancedFilters({
          ...CONTACTOS_ADVANCED_FILTERS_INITIAL,
          ...(value.advancedFilters as ContactosAdvancedFiltersState),
        });
      }
    },
  });

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
    () => applySavedWidthsToColumns([contextMenuTriggerColumn, ...baseColumns]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applySavedWidthsToColumns, vendedorNombre, contextMenuTriggerColumn]
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
        id: 'ver-actividades',
        label: 'Ver actividades',
        icon: <EventNoteOutlinedIcon fontSize="small" />,
        onClick: () => handleVerActividades(contextMenuRow),
      },
      {
        id: 'separator-schedule',
        type: 'separator',
      },
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
    if (loadingPreferences) {
      return;
    }

    setLoading(true);
    const payload = {
      page: page + 1,
      limit: pageSize,
      activo: advancedFilters.activo,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(advancedFilters.selectedTipos.length ? { tipos: advancedFilters.selectedTipos } : {}),
      ...(advancedFilters.origenContactoId != null ? { origenContactoId: advancedFilters.origenContactoId } : {}),
      ...(advancedFilters.vendedorId != null ? { vendedorId: advancedFilters.vendedorId } : {}),
      ...(advancedFilters.fechaAltaDesde ? { fechaAltaDesde: advancedFilters.fechaAltaDesde } : {}),
      ...(advancedFilters.fechaAltaHasta ? { fechaAltaHasta: advancedFilters.fechaAltaHasta } : {}),
      ...(advancedFilters.interesInicial ? { interesInicial: advancedFilters.interesInicial } : {}),
      ...(advancedFilters.observaciones ? { observaciones: advancedFilters.observaciones } : {}),
    };

    fetchContactosPaginados(payload)
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
  }, [page, pageSize, debouncedSearch, advancedFilters, loadingPreferences]);

  useEffect(() => {
    setPage(0);
  }, [
    debouncedSearch,
    advancedFilters.selectedTipos,
    advancedFilters.origenContactoId,
    advancedFilters.vendedorId,
    advancedFilters.activo,
    advancedFilters.fechaAltaDesde,
    advancedFilters.fechaAltaHasta,
    advancedFilters.interesInicial,
    advancedFilters.observaciones,
  ]);

  useEffect(() => {
    Promise.all([fetchVendedores(), obtenerCatalogosConfigurablesContacto()])
      .then(([vendedoresData, catalogosData]) => {
        setVendedores(vendedoresData);

        const origenTipo = (catalogosData.tipos || []).find((tipo) =>
          normalizeFilterLookup(String(tipo.nombre || '')).includes('origen')
        );

        const nextOrigenOptions = (origenTipo?.valores || []).map((valor) => ({
          id: valor.id,
          clave: valor.clave,
          descripcion: valor.descripcion,
          label: valor.clave || valor.descripcion,
        }));

        setOrigenOptions(nextOrigenOptions);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    persistExternalFilters({ searchTerm, advancedFilters });
  }, [persistExternalFilters, searchTerm, advancedFilters]);

  const advancedFiltersCount = useMemo(
    () =>
      [
        advancedFilters.selectedTipos.length ? advancedFilters.selectedTipos.join(',') : '',
        advancedFilters.origenContactoId,
        advancedFilters.vendedorId,
        advancedFilters.activo !== 'todos' ? advancedFilters.activo : '',
        advancedFilters.fechaAltaDesde,
        advancedFilters.fechaAltaHasta,
        advancedFilters.interesInicial,
        advancedFilters.observaciones,
      ].filter((value) => value !== '' && value !== null && value !== undefined).length,
    [advancedFilters]
  );

  if (error) return <div>Error: {error}</div>;

  const commonViewProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    onClearSearch: () => setSearchTerm(''),
    onCreateContacto: () => navigate('/contactos/nuevo'),
    rowCount,
    vendedores,
    origenOptions,
    tiposOpciones: TIPOS_CONTACTO_OPCIONES,
    advancedFilters,
    advancedFiltersCount,
    onToggleFilters: () => setAdvancedFilters((prev) => ({ ...prev, filtersOpen: !prev.filtersOpen })),
    onSelectedTiposChange: (selectedTipos: string[]) => setAdvancedFilters((prev) => ({ ...prev, selectedTipos })),
    onOrigenContactoIdChange: (origenContactoId: number | null) => setAdvancedFilters((prev) => ({ ...prev, origenContactoId })),
    onVendedorIdChange: (vendedorId: number | null) => setAdvancedFilters((prev) => ({ ...prev, vendedorId })),
    onActivoChange: (activo: ContactoActivoFilter) => setAdvancedFilters((prev) => ({ ...prev, activo })),
    onFechaAltaDesdeChange: (fechaAltaDesde: string) => setAdvancedFilters((prev) => ({ ...prev, fechaAltaDesde })),
    onFechaAltaHastaChange: (fechaAltaHasta: string) => setAdvancedFilters((prev) => ({ ...prev, fechaAltaHasta })),
    onInteresInicialChange: (interesInicial: string) => setAdvancedFilters((prev) => ({ ...prev, interesInicial })),
    onObservacionesChange: (observaciones: string) => setAdvancedFilters((prev) => ({ ...prev, observaciones })),
    onClearAdvancedFilters: () => setAdvancedFilters((prev) => ({
      ...CONTACTOS_ADVANCED_FILTERS_INITIAL,
      filtersOpen: prev.filtersOpen,
    })),
  };

  const desktopView = (
    <ContactosDesktopView
      {...commonViewProps}
      contactos={contactos}
      orderedColumns={orderedColumns}
      rowCount={rowCount}
      loading={loading || loadingPreferences}
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
      onViewActividades={handleVerActividades}
      onDeleteContacto={(contactoId) => {
        void handleEliminarContacto(contactoId);
      }}
    />
  );

  return (
    <Box sx={{ width: '100%' }}>
      {isMobile ? mobileView : desktopView}
      <ActividadSeguimientoDrawer
        open={seguimientoDrawerOpen}
        onClose={closeSeguimientoDrawer}
        target={seguimientoTarget}
      />
    </Box>
  );
}
