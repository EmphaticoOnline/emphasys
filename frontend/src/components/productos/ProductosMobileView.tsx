import * as React from 'react';
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Fab, IconButton, InputAdornment, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import type { ProductosMobileViewProps } from './ProductosView.types';

function hasValue(value?: string | number | boolean | null) {
  return value != null && String(value).trim() !== '';
}

function renderValue(value?: string | number | boolean | null) {
  return hasValue(value) ? String(value) : '';
}

export default function ProductosMobileView({
  productos,
  loading,
  error,
  onClearError,
  onEditProducto,
  onDeleteProducto,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onCreateProducto,
}: ProductosMobileViewProps) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuProductoId, setMenuProductoId] = React.useState<number | null>(null);

  const selectedProducto = React.useMemo(
    () => productos.find((producto) => producto.id === menuProductoId) ?? null,
    [productos, menuProductoId]
  );

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, productoId: number) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuProductoId(productoId);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuProductoId(null);
  };

  const handleEditSelected = () => {
    if (menuProductoId == null) return;
    onEditProducto(menuProductoId);
    handleCloseMenu();
  };

  const handleDeleteSelected = () => {
    if (!selectedProducto) return;
    onDeleteProducto(selectedProducto);
    handleCloseMenu();
  };

  return (
    <Box sx={{ width: '100%', px: 2, py: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 10 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, position: 'sticky', top: 72, zIndex: 2, py: 1, backgroundColor: '#eef1f4' }}>
          <Box>
            <Typography variant="h5" fontWeight={600} color="#1d2f68">Productos</Typography>
            <Typography variant="body2" color="#4b5563">Gestiona el catálogo básico de productos. Existencias son solo de lectura.</Typography>
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por clave o descripción"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton aria-label="Borrar búsqueda" size="small" onClick={onClearSearch} edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {error ? (
          <Alert severity="error" onClose={onClearError}>
            {error}
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : productos.length === 0 ? (
            <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#fff', px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="#4b5563">
                {searchTerm.trim() ? `No hay productos que coincidan con "${searchTerm}".` : 'No hay productos registrados.'}
              </Typography>
            </Box>
          ) : (
            productos.map((producto) => {
              const detailItems = [
                { label: 'Clasificación', value: producto.clasificacion },
                { label: 'Tipo', value: producto.tipo_producto },
                { label: 'Existencia', value: producto.existencia_actual != null ? Number(producto.existencia_actual).toLocaleString('es-MX') : null },
              ].filter((item) => hasValue(item.value));

              return (
                <Card
                  key={producto.id}
                  variant="outlined"
                  sx={{
                    borderColor: '#e5e7eb',
                    borderRadius: 2.5,
                    backgroundColor: '#ffffff',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0, pr: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ lineHeight: 1.2 }}>
                          {renderValue(producto.descripcion)}
                        </Typography>
                        {hasValue(producto.clave) ? (
                          <Typography variant="body2" color="#4b5563" sx={{ mt: 0.25, wordBreak: 'break-word', lineHeight: 1.3 }}>
                            {producto.clave}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        size="small"
                        aria-label="Abrir acciones"
                        onClick={(event) => handleOpenMenu(event, producto.id)}
                        sx={{ mt: -0.25, mr: -0.5 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={producto.activo ? 'Activo' : 'Inactivo'}
                        size="small"
                        color={producto.activo ? 'success' : 'default'}
                      />
                    </Box>

                    {detailItems.length > 0 ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
                        {detailItems.map((item) => (
                          <Box key={`${producto.id}-${item.label}`} sx={{ minWidth: 0 }}>
                            <Typography variant="caption" color="#6b7280" sx={{ display: 'block', lineHeight: 1.1 }}>
                              {item.label}
                            </Typography>
                            <Typography variant="body2" color="#111827" sx={{ lineHeight: 1.25, wordBreak: 'break-word' }}>
                              {renderValue(item.value)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Box>

        <Fab
          color="primary"
          aria-label="Nuevo producto"
          onClick={onCreateProducto}
          sx={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            backgroundColor: '#1d2f68',
            color: '#ffffff',
            boxShadow: '0 10px 24px rgba(29, 47, 104, 0.28)',
            '&:hover': { backgroundColor: '#162551' },
          }}
        >
          <AddIcon />
        </Fab>

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleEditSelected}>
            <EditIcon fontSize="small" />
            <Typography component="span" sx={{ ml: 1 }}>Editar</Typography>
          </MenuItem>
          <MenuItem onClick={handleDeleteSelected} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" />
            <Typography component="span" sx={{ ml: 1 }}>Eliminar</Typography>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}