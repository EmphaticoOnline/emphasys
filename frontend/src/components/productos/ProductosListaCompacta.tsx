import * as React from 'react';
import { Box, Chip, CircularProgress, TablePagination, Typography } from '@mui/material';
import type { GridPaginationModel } from '@mui/x-data-grid';
import type { Producto } from '../../types/producto';

type ProductosListaCompactaProps = {
  productos: Producto[];
  rowCount: number;
  loading: boolean;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  selectedProductoId: number | null;
  onSelectProducto: (productoId: number) => void;
};

function subtitleFor(producto: Producto) {
  return [producto.familia, producto.unidad_venta_clave].filter(Boolean).join(' · ');
}

export default function ProductosListaCompacta({
  productos,
  rowCount,
  loading,
  paginationModel,
  onPaginationModelChange,
  selectedProductoId,
  onSelectProducto,
}: ProductosListaCompactaProps) {
  return (
    <Box
      sx={{
        width: { xs: '100%', md: 380 },
        flexShrink: 0,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e5e7eb',
        borderRadius: 2,
        backgroundColor: '#fff',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #e5e7eb' }}>
        <Typography variant="body2" color="#6b7280" fontWeight={600}>
          {productos.length} de {rowCount.toLocaleString('es-MX')} productos
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        ) : productos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            <Typography variant="body2" color="#6b7280">
              No hay productos para mostrar.
            </Typography>
          </Box>
        ) : (
          productos.map((producto) => {
            const isSelected = selectedProductoId === producto.id;
            const subtitle = subtitleFor(producto);
            return (
              <Box
                key={producto.id}
                onClick={() => onSelectProducto(producto.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  px: 2,
                  py: 1.25,
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#eef1f7' : 'transparent',
                  borderLeft: isSelected ? '3px solid #1d2f68' : '3px solid transparent',
                  '&:hover': { backgroundColor: isSelected ? '#eef1f7' : '#f8fafc' },
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    mt: 0.75,
                    flexShrink: 0,
                    backgroundColor: producto.activo ? '#16a34a' : '#d1d5db',
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="#1d2f68"
                      sx={{ fontFamily: '"Roboto Mono", monospace' }}
                      noWrap
                    >
                      {producto.clave}
                    </Typography>
                    {producto.tipo_producto ? (
                      <Chip label={producto.tipo_producto} size="small" sx={{ fontWeight: 600, flexShrink: 0, height: 18 }} />
                    ) : null}
                  </Box>
                  <Typography variant="body2" fontWeight={600} color="#111827" noWrap>
                    {producto.descripcion}
                  </Typography>
                  {subtitle ? (
                    <Typography variant="caption" color="#6b7280" noWrap sx={{ display: 'block' }}>
                      {subtitle}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={{ borderTop: '1px solid #e5e7eb' }}>
        <TablePagination
          component="div"
          count={rowCount}
          page={paginationModel.page}
          onPageChange={(_, nextPage) => onPaginationModelChange({ ...paginationModel, page: nextPage })}
          rowsPerPage={paginationModel.pageSize}
          onRowsPerPageChange={(event) => onPaginationModelChange({ page: 0, pageSize: Number(event.target.value) })}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Filas"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count === -1 ? `más de ${to}` : count}`}
          sx={{ '& .MuiTablePagination-toolbar': { px: 1.5 } }}
        />
      </Box>
    </Box>
  );
}
