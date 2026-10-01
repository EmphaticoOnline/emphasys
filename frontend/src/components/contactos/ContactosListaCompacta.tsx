import * as React from 'react';
import type { ReactNode } from 'react';
import { Box, Chip, CircularProgress, IconButton, InputAdornment, Popover, Stack, TablePagination, TextField, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import AddIcon from '@mui/icons-material/Add';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../documentos/WorkspaceRowContextMenu';
import type { GridPaginationModel } from '@mui/x-data-grid';
import type { ContactoRow } from './ContactosView.types';
import { formatearTelefonoParaMostrar } from '../../utils/telefono';
import { catalogoRailIconButtonSx, catalogoRailSearchSx } from '../catalogo/catalogoSurfaces';
import { CatalogoRailVistaAyuda } from '../catalogo/CatalogoModuloToolbar';
type ContactosListaCompactaProps = {
  contactos: ContactoRow[];
  rowCount: number;
  loading: boolean;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  selectedContactoId: number | null;
  onSelectContacto: (contactoId: number) => void;
  onEditContacto: (contactoId: number) => void;
  onDeleteContacto: (contactoId: number) => void;
  onViewActividades: (contacto: ContactoRow) => void;
  vendedorNombre: Map<number, string>;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  onCreate: () => void;
  onExport: () => void;
  exportLoading: boolean;
  filtrosActivos: number;
  panelFiltros: ReactNode;
  viewMode: 'lista' | 'tabla';
  onViewModeChange: (mode: 'lista' | 'tabla') => void;
  helpHref: string;
};

function subtitleFor(contacto: ContactoRow) {
  const telefono = formatearTelefonoParaMostrar(contacto.telefono || contacto.telefono_secundario);
  return [telefono, contacto.nombre_contacto].filter(Boolean).join(' · ');
}

export default function ContactosListaCompacta({
  contactos,
  rowCount,
  loading,
  paginationModel,
  onPaginationModelChange,
  selectedContactoId,
  onSelectContacto,
  onEditContacto,
  onDeleteContacto,
  onViewActividades,
  vendedorNombre,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onCreate,
  onExport,
  exportLoading,
  filtrosActivos,
  panelFiltros,
  viewMode,
  onViewModeChange,
  helpHref,
}: ContactosListaCompactaProps) {
  const [anclaFiltros, setAnclaFiltros] = React.useState<HTMLElement | null>(null);
  const [menuFila, setMenuFila] = React.useState<{ top: number; left: number; rowId: number } | null>(null);
  const contactoMenu = contactos.find((contacto) => contacto.id === menuFila?.rowId) ?? null;
  const itemsMenu: WorkspaceContextItem[] = contactoMenu ? [
    { id: 'actividades', label: 'Ver actividades', icon: <EventNoteOutlinedIcon fontSize="small" />, onClick: () => onViewActividades(contactoMenu) },
    { id: 'editar', label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => onEditContacto(contactoMenu.id) },
    { id: 'eliminar', label: 'Eliminar', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => onDeleteContacto(contactoMenu.id) },
  ] : [];
  return (
    <Box
      sx={(theme) => ({
        width: { xs: '100%', md: 372 },
        maxWidth: { md: 372 },
        flexShrink: 0,
        m: 0,
        alignSelf: 'stretch',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.emphasys.navigation.background,
        color: theme.emphasys.navigation.foreground,
        borderRight: `1px solid ${theme.emphasys.navigation.border}`,
      })}
    >
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0, flex: '1 1 88px' }}>
            <Typography noWrap sx={(theme) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: theme.emphasys.navigation.muted })}>
              CONTACTOS
            </Typography>
            <Typography noWrap sx={(theme) => ({ mt: 0.25, fontSize: 13, color: theme.emphasys.navigation.subtle })}>
              {contactos.length} de {rowCount.toLocaleString('es-MX')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4, flexWrap: 'wrap', flexShrink: 1, minWidth: 0 }}>
          <Tooltip title="Exportar" arrow>
            <span>
              <IconButton
                aria-label="Exportar"
                disabled={exportLoading}
                onClick={onExport}
                sx={catalogoRailIconButtonSx}
              >
                {exportLoading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <IosShareOutlinedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Filtros avanzados" arrow>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <IconButton
                aria-label="Filtros avanzados"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => setAnclaFiltros((actual) => (actual ? null : event.currentTarget))}
                sx={(theme) => ({
                  width: 28,
                  height: 28,
                  borderRadius: 2,
                  backgroundColor: theme.emphasys.navigation.summary,
                  color: theme.emphasys.navigation.foreground,
                  border: '1px solid',
                  borderColor: filtrosActivos > 0 ? theme.emphasys.navigation.accent : 'transparent',
                  '&:hover': { backgroundColor: theme.emphasys.navigation.hover },
                })}
              >
                <FilterAltOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
              {filtrosActivos > 0 ? (
                <Box sx={(theme) => ({ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, px: 0.4, borderRadius: 99, bgcolor: theme.emphasys.navigation.accent, color: theme.emphasys.frame.background, fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', lineHeight: 1 })}>
                  {filtrosActivos}
                </Box>
              ) : null}
            </Box>
          </Tooltip>
          <CatalogoRailVistaAyuda viewMode={viewMode} onViewModeChange={onViewModeChange} helpHref={helpHref} />
          <Tooltip title="Nuevo contacto" arrow>
            <IconButton
              aria-label="Nuevo contacto"
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
          placeholder="Buscar por empresa, contacto, email…"
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
        <Popover
          open={Boolean(anclaFiltros)}
          anchorEl={anclaFiltros}
          onClose={() => setAnclaFiltros(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ width: { xs: 'min(92vw, 720px)', md: 720 }, maxHeight: '70vh', overflow: 'auto', p: 0.5 }}>
            {panelFiltros}
          </Box>
        </Popover>
      </Box>

      <Box sx={(theme) => ({
        flex: 1,
        overflow: 'auto',
        px: 1,
        pb: 1.2,
        scrollbarWidth: 'thin',
        scrollbarColor: `${theme.emphasys.navigation.progress} ${theme.emphasys.navigation.background}`,
      })}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        ) : contactos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.navigation.muted })}>
              No hay contactos para mostrar.
            </Typography>
          </Box>
        ) : (
          contactos.map((contacto) => {
            const isSelected = selectedContactoId === contacto.id;
            const subtitle = subtitleFor(contacto);
            return (
              <Box
                key={contacto.id}
                onClick={() => onSelectContacto(contacto.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectContacto(contacto.id);
                  setMenuFila({ top: event.clientY, left: event.clientX, rowId: contacto.id });
                }}
                sx={(theme) => ({
                  px: 1.25,
                  py: 1.05,
                  mb: 0.45,
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: isSelected ? theme.emphasys.navigation.selection : 'transparent',
                  color: isSelected ? theme.emphasys.navigation.selectionForeground : theme.emphasys.navigation.foreground,
                  boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                  '&:hover': { bgcolor: isSelected ? theme.emphasys.navigation.selection : theme.emphasys.navigation.hover },
                })}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="figure" noWrap sx={{ fontSize: 16, lineHeight: 1.1, color: 'inherit' }}>
                      {contacto.nombre}
                    </Typography>
                    {subtitle ? (
                      <Typography variant="caption" noWrap sx={(theme) => ({ display: 'block', color: theme.emphasys.navigation.muted })}>
                        {subtitle}
                      </Typography>
                    ) : null}
                  </Box>
                  {contacto.tipo_contacto ? (
                    <Chip label={contacto.tipo_contacto} size="small" sx={(theme) => ({ fontWeight: 600, flexShrink: 0, bgcolor: theme.emphasys.navigation.summary, color: theme.emphasys.navigation.foreground })} />
                  ) : null}
                </Stack>
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={(theme) => ({ borderTop: `1px solid ${theme.emphasys.navigation.border}`, color: theme.emphasys.navigation.muted, '& .MuiTablePagination-root': { color: theme.emphasys.navigation.muted } })}>
        <TablePagination
          component="div"
          count={rowCount}
          page={paginationModel.page}
          onPageChange={(_, nextPage) => onPaginationModelChange({ ...paginationModel, page: nextPage })}
          rowsPerPage={paginationModel.pageSize}
          onRowsPerPageChange={(event) => onPaginationModelChange({ page: 0, pageSize: Number(event.target.value) })}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Filas"
          sx={{ '& .MuiTablePagination-toolbar': { px: 1.5 } }}
        />
      </Box>
      <WorkspaceRowContextMenu
        anchorPosition={menuFila && contactoMenu ? { top: menuFila.top, left: menuFila.left } : null}
        items={itemsMenu}
        onClose={() => setMenuFila(null)}
      />
    </Box>
  );
}
