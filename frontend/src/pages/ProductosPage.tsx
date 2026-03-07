import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import type { Producto } from '../types/producto';
import type { ProductoColumnConfig } from './productosColumns';
import { productoColumns } from './productosColumns';
import {
  createProducto,
  deleteProducto,
  fetchProductos,
  updateProducto,
} from '../services/productosService';
import { esES } from '@mui/x-data-grid/locales';

export default function ProductosPage() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

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

  const columns: GridColDef[] = useMemo(() => {
    const mapped: GridColDef[] = productoColumns.map((col) => {
      const base: GridColDef = {
        field: col.field as string,
        headerName: col.headerName,
        renderCell: (params: GridRenderCellParams<Producto>) => renderCell(params.row, col.field),
        sortable: true,
        filterable: true,
        type: 'string',
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

    return mapped;
  }, [navigate, handleDelete]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
  <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'flex-end', pb: 1 }}>
        <Stack spacing={1} sx={{ maxWidth: 480 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              Productos
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Gestiona el catálogo básico de productos. Existencias son solo de lectura.
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Buscar por clave o descripción"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton aria-label="Borrar búsqueda" size="small" onClick={() => setSearch('')} edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Stack>
  <Stack direction="row" spacing={1} sx={{ alignSelf: 'flex-end' }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadProductos} disabled={loading}>
            Recargar
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/productos/nuevo')}
            sx={{
              textTransform: 'uppercase',
              fontWeight: 700,
              backgroundColor: '#1d2f68',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#162551' },
            }}
          >
            + NUEVO
          </Button>
        </Stack>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={filteredProductos}
          columns={columns}
          autoHeight
          density="compact"
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(params: GridRowParams) => navigate(`/productos/${params.id}`)}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f6f8fa',
            },
            '& .MuiDataGrid-columnHeader': {
              userSelect: 'none',
              color: '#1d2f68',
              fontWeight: 700,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              color: '#1d2f68',
              fontWeight: 700,
            },
            '& .MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row:nth-of-type(even)': {
              backgroundColor: '#f7fbfa',
            },
            '& .MuiDataGrid-row.Mui-hovered': {
              backgroundColor: '#eef7f4',
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="#4b5563">
                  {search.trim()
                    ? `No hay productos que coincidan con "${search}".`
                    : 'No hay productos registrados.'}
                </Typography>
              </Stack>
            ),
            loadingOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Cargando productos...
                </Typography>
              </Stack>
            ),
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
        />
      </Paper>
    </Box>
  );
}
