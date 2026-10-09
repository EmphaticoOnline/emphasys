import { Box } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import type { ProductosDesktopViewProps } from './ProductosView.types';
import ProductosListaCompacta from './ProductosListaCompacta';
import ProductoWorkspace, { alternarActivoDeProducto } from './ProductoWorkspace';
import type { Producto } from '../../types/producto';

export default function ProductosDesktopView({
  productos,
  loading,
  error,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  onExport,
  exportLoading,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onCreateProducto,
  esAdmin,
  selectedProductoId,
  onSelectProducto,
  onEditProducto,
  onDeleteProducto,
  onRefresh,
  onOpenBiblioteca,
}: ProductosDesktopViewProps) {
  const theme = useTheme();
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [verDetalle, setVerDetalle] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    if (!compacto) setVerDetalle(false);
  }, [compacto]);

  useEffect(() => {
    if (selectedProductoId == null) setVerDetalle(false);
  }, [selectedProductoId]);

  const alternarActivo = async (producto: Producto) => {
    if (togglingId != null) return;
    setTogglingId(producto.id);
    try {
      const actualizado = await alternarActivoDeProducto(producto);
      onRefresh();
      return actualizado;
    } finally {
      setTogglingId(null);
    }
  };

  const seleccionar = (productoId: number) => {
    onSelectProducto(productoId);
    if (compacto) setVerDetalle(true);
  };

  const mostrarLista = !compacto || !verDetalle;

  return (
    <Box
      sx={{
        width: '100%',
        flex: 1,
        minHeight: compacto ? 'calc(100dvh - 112px)' : 0,
        bgcolor: theme.emphasys.canvas.page,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', alignItems: 'stretch', overflow: 'hidden' }}>
        <Box sx={{ display: mostrarLista ? 'flex' : 'none', flex: compacto ? 1 : '0 0 auto', minHeight: 0, minWidth: 0 }}>
          <ProductosListaCompacta
            productos={productos}
            rowCount={rowCount}
            loading={loading}
            error={error}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            selectedProductoId={selectedProductoId}
            onSelectProducto={seleccionar}
            searchTerm={searchTerm}
            onSearchTermChange={onSearchTermChange}
            onClearSearch={onClearSearch}
            onCreate={onCreateProducto}
            onExport={onExport}
            exportLoading={Boolean(exportLoading)}
            onEditProducto={onEditProducto}
            onDeleteProducto={onDeleteProducto}
            onAlternarActivo={alternarActivo}
            togglingId={togglingId}
            helpHref="/docs/guia-productos.html"
            anchoCompleto={compacto}
            {...(onOpenBiblioteca ? { onOpenBiblioteca } : {})}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && mostrarLista ? 'none' : 'flex' }}>
          <ProductoWorkspace
            productoId={selectedProductoId}
            esAdmin={esAdmin}
            onEditar={onEditProducto}
            onEliminar={onDeleteProducto}
            onChanged={onRefresh}
            onAlternarActivo={alternarActivo}
            alternando={togglingId === selectedProductoId}
            compacto={compacto}
            onVolver={() => setVerDetalle(false)}
          />
        </Box>
      </Box>
    </Box>
  );
}
