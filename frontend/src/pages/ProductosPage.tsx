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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { Producto } from '../types/producto';
import type { ProductoColumnConfig } from './productosColumns';
import { productoColumns } from './productosColumns';
import {
  createProducto,
  deleteProducto,
  fetchProductos,
  updateProducto,
} from '../services/productosService';

export default function ProductosPage() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<Producto[]>([]);
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

    if (field === 'precio_publico') {
      return value === null || value === undefined
        ? '—'
        : formatter.format(Number(value));
    }

    if (field === 'existencia_actual') {
      return value === null || value === undefined ? '—' : Number(value).toLocaleString('es-MX');
    }

    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Productos
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Gestiona el catálogo básico de productos. Existencias son solo de lectura.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadProductos} disabled={loading}>
            Recargar
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/productos/nuevo')}>
            Nuevo
          </Button>
        </Stack>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="medium" sx={{ minWidth: 750 }}>
            <TableHead sx={{ backgroundColor: '#f6f8fa' }}>
              <TableRow>
                {productoColumns.map((col) => (
                  <TableCell
                    key={col.field}
                    align={col.align || 'left'}
                    sx={{ fontWeight: 700, color: '#1d2f68', minWidth: col.minWidth, width: col.flex ? undefined : col.minWidth }}
                  >
                    {col.headerName}
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 700, color: '#1d2f68', minWidth: 140 }}>
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={productoColumns.length + 1} align="center" sx={{ py: 4 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                      <CircularProgress size={22} />
                      <Typography variant="body2" color="text.secondary">
                        Cargando productos...
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : productos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={productoColumns.length + 1} align="center" sx={{ py: 4, color: '#4b5563' }}>
                    No hay productos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                productos.map((producto) => (
                  <TableRow
                    key={producto.id}
                    hover
                    sx={{
                      '&:hover': { backgroundColor: '#f8fbfa' },
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    {productoColumns.map((col) => (
                      <TableCell key={col.field} align={col.align || 'left'} sx={{ verticalAlign: 'middle' }}>
                        {renderCell(producto, col.field)}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" size="small" onClick={() => navigate(`/productos/${producto.id}`)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton color="error" size="small" onClick={() => handleDelete(producto)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
