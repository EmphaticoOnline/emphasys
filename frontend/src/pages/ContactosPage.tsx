import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, IconButton, Typography, TextField, InputAdornment, Stack } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type {
  GridColDef,
  GridSortModel,
  GridFilterModel,
  GridColumnVisibilityModel,
  GridDensity,
  GridRowParams,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { fetchContactosPaginados, fetchVendedores } from '../services/contactosService.js';
import { eliminarContacto } from '../services/contactos.api';

export default function ContactosPage() {
  const navigate = useNavigate();
  const [contactos, setContactos] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" onClick={() => navigate(`/contactos/${params.id}`)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={async () => {
              const confirmed = window.confirm('¿Eliminar el contacto?');
              if (!confirmed) return;
              try {
                await eliminarContacto(Number(params.id));
                loadContactos();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'No se pudo eliminar';
                setError(message);
              }
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
  const [density, setDensity] = useState<GridDensity>(stored.density || 'compact');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(stored.columnWidths || {});
  const [columnOrder, setColumnOrder] = useState<string[]>(
    stored.columnOrder || baseColumns.map((c) => c.field)
  );

  const columns: GridColDef[] = useMemo(
    () =>
      baseColumns.map((col) => {
        const savedWidth = columnWidths[col.field];
        if (savedWidth !== undefined) {
          const { flex, ...rest } = col;
          return { ...rest, width: savedWidth } as GridColDef;
        }
        return col;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnWidths, vendedorNombre]
  );

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.field, c]));
    const ordered = columnOrder
      .map((field) => map.get(field))
      .filter((c): c is GridColDef => Boolean(c));
    const remaining = columns.filter((c) => !columnOrder.includes(c.field));
    return [...ordered, ...remaining];
  }, [columnOrder, columns]);

  const effectiveColumnVisibilityModel = useMemo(
    () => ({ ...columnVisibilityModel, actions: true }),
    [columnVisibilityModel]
  );

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
            onDensityChange={setDensity}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
            columnVisibilityModel={effectiveColumnVisibilityModel}
            onColumnVisibilityModelChange={(model) =>
              setColumnVisibilityModel({ ...model, actions: true })
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
            disableRowSelectionOnClick
            onRowClick={(params: GridRowParams) => navigate(`/contactos/${params.id}`)}
            localeText={esES.components.MuiDataGrid.defaultProps.localeText}
            hideFooterSelectedRowCount
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
          />
        </Box>
      </Box>
    </Box>
  );
}
