import * as React from 'react';
import { Box, Chip, CircularProgress, IconButton, InputAdornment, TablePagination, TextField, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../documentos/WorkspaceRowContextMenu';
import type { GridPaginationModel } from '@mui/x-data-grid';
import type { Producto } from '../../types/producto';
import { catalogoRailIconButtonSx, catalogoRailSearchSx } from '../catalogo/catalogoSurfaces';
import { CatalogoRailVistaAyuda } from '../catalogo/CatalogoModuloToolbar';

type ProductosListaCompactaProps = {
  productos: Producto[];
  rowCount: number;
  loading: boolean;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  selectedProductoId: number | null;
  onSelectProducto: (productoId: number) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  onCreate: () => void;
  onExport: () => void;
  exportLoading: boolean;
  onEditProducto: (productoId: number) => void;
  onDeleteProducto: (producto: Producto) => void;
  onAlternarActivo: (producto: Producto) => Promise<Producto | void>;
  togglingId: number | null;
  viewMode: 'lista' | 'tabla';
  onViewModeChange: (mode: 'lista' | 'tabla') => void;
  helpHref: string;
  onOpenBiblioteca?: () => void;
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
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onCreate,
  onExport,
  exportLoading,
  onEditProducto,
  onDeleteProducto,
  onAlternarActivo,
  togglingId,
  viewMode,
  onViewModeChange,
  helpHref,
  onOpenBiblioteca,
}: ProductosListaCompactaProps) {
  const [menuFila, setMenuFila] = React.useState<{ top: number; left: number; rowId: number } | null>(null);
  const productoMenu = productos.find((producto) => producto.id === menuFila?.rowId) ?? null;
  const itemsMenu: WorkspaceContextItem[] = productoMenu ? [
    { id: 'editar', label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => onEditProducto(productoMenu.id) },
    {
      id: 'activo',
      label: productoMenu.activo ? 'Desactivar' : 'Activar',
      icon: <PowerSettingsNewIcon fontSize="small" />,
      disabled: togglingId === productoMenu.id,
      onClick: () => { void onAlternarActivo(productoMenu); },
    },
    { id: 'eliminar', label: 'Eliminar', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => onDeleteProducto(productoMenu) },
  ] : [];
  return (
    <Box
      sx={{
        width: { xs: '100%', md: 372 },
        maxWidth: { md: 372 },
        flexShrink: 0,
        m: 0,
        alignSelf: 'stretch',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: (theme) => theme.emphasys.navigation.background,
        color: (theme) => theme.emphasys.navigation.foreground,
        borderRight: (theme) => `1px solid ${theme.emphasys.navigation.border}`,
      }}
    >
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0, flex: '1 1 88px' }}>
            <Typography noWrap sx={(theme) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: theme.emphasys.navigation.muted })}>
              PRODUCTOS
            </Typography>
            <Typography noWrap sx={(theme) => ({ mt: 0.25, fontSize: 13, color: theme.emphasys.navigation.subtle })}>
              {productos.length} de {rowCount.toLocaleString('es-MX')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4, flexWrap: 'wrap', flexShrink: 1, minWidth: 0 }}>
          <Tooltip title="Exportar" arrow>
            <span>
              <IconButton aria-label="Exportar" disabled={exportLoading} onClick={onExport} sx={catalogoRailIconButtonSx}>
                {exportLoading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <IosShareOutlinedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </span>
          </Tooltip>
          {onOpenBiblioteca ? (
            <Tooltip title="Biblioteca global de especificaciones" arrow>
              <IconButton aria-label="Biblioteca global de especificaciones" onClick={onOpenBiblioteca} sx={catalogoRailIconButtonSx}>
                <MenuBookOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : null}
          <CatalogoRailVistaAyuda viewMode={viewMode} onViewModeChange={onViewModeChange} helpHref={helpHref} />
          <Tooltip title="Nuevo producto" arrow>
            <IconButton
              aria-label="Nuevo producto"
              onClick={onCreate}
              sx={(theme) => ({
                width: 34,
                height: 34,
                flexShrink: 0,
                bgcolor: theme.emphasys.navigation.control,
                color: theme.emphasys.navigation.controlForeground,
                boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                '&:hover': { bgcolor: theme.emphasys.content.elevated },
              })}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          </Box>
        </Box>
        <Box sx={{ mt: 1.1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por clave o descripción…"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            sx={catalogoRailSearchSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={(theme) => ({ fontSize: 18, color: theme.emphasys.navigation.muted })} />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton aria-label="Borrar búsqueda" size="small" onClick={onClearSearch} edge="end" sx={(theme) => ({ color: theme.emphasys.navigation.muted })}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>
      </Box>

      <Box sx={(theme) => ({ flex: 1, overflow: 'auto', px: 1, pb: 1.2, scrollbarWidth: 'thin', scrollbarColor: `${theme.emphasys.navigation.progress} ${theme.emphasys.navigation.background}` })}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        ) : productos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.navigation.muted })}>
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
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectProducto(producto.id);
                  setMenuFila({ top: event.clientY, left: event.clientX, rowId: producto.id });
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  px: 1.25,
                  py: 1.05,
                  mb: 0.45,
                  borderRadius: 2,
                  cursor: 'pointer',
                  backgroundColor: (theme) => (isSelected ? theme.emphasys.navigation.selection : 'transparent'),
                  color: (theme) => (isSelected ? theme.emphasys.navigation.selectionForeground : theme.emphasys.navigation.foreground),
                  boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                  '&:hover': { backgroundColor: (theme) => (isSelected ? theme.emphasys.navigation.selection : theme.emphasys.navigation.hover) },
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    mt: 0.75,
                    flexShrink: 0,
                    backgroundColor: (theme) => (producto.activo ? theme.emphasys.metric.progressDone : theme.emphasys.navigation.track),
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="figure"
                      noWrap
                      sx={(theme) => ({ fontSize: 16, lineHeight: 1.1, color: theme.emphasys.navigation.foreground })}
                    >
                      {producto.clave}
                    </Typography>
                    {producto.tipo_producto ? (
                      <Chip label={producto.tipo_producto} size="small" sx={(theme) => ({ fontWeight: 700, flexShrink: 0, height: 18, bgcolor: theme.emphasys.navigation.summary, color: theme.emphasys.navigation.foreground })} />
                    ) : null}
                  </Box>
                  <Typography variant="figure" noWrap sx={(theme) => ({ fontSize: 14, mt: 0.25, lineHeight: 1.2, color: theme.emphasys.navigation.foreground })}>
                    {producto.descripcion}
                  </Typography>
                  {subtitle ? (
                    <Typography noWrap sx={(theme) => ({ display: 'block', fontSize: 12, color: theme.emphasys.navigation.muted })}>
                      {subtitle}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={(theme) => ({ color: theme.emphasys.navigation.muted, '& .MuiTablePagination-root': { color: theme.emphasys.navigation.muted } })}>
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
      <WorkspaceRowContextMenu
        anchorPosition={menuFila && productoMenu ? { top: menuFila.top, left: menuFila.left } : null}
        items={itemsMenu}
        onClose={() => setMenuFila(null)}
      />
    </Box>
  );
}
