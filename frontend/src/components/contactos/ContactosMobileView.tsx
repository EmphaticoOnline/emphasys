import * as React from 'react';
import { Box, Card, CardContent, Chip, CircularProgress, Fab, IconButton, InputAdornment, Menu, MenuItem, Stack, TablePagination, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import type { ContactosMobileViewProps } from './ContactosView.types';

function hasValue(value?: string | number | null) {
  return value != null && String(value).trim() !== '';
}

function renderValue(value?: string | number | null) {
  return hasValue(value) ? String(value) : '';
}

function getPrimarySubtitle(email?: string | null, telefono?: string | null, telefonoSecundario?: string | null) {
  if (hasValue(email)) return renderValue(email);
  if (hasValue(telefono)) return renderValue(telefono);
  if (hasValue(telefonoSecundario)) return renderValue(telefonoSecundario);
  return '';
}

export default function ContactosMobileView({
  contactos,
  rowCount,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEditContacto,
  onDeleteContacto,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  tiposOpciones,
  selectedTipos,
  isTodosActivo,
  onToggleTipo,
  onCreateContacto,
}: ContactosMobileViewProps) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuContactoId, setMenuContactoId] = React.useState<number | string | null>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, contactoId: number | string) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuContactoId(contactoId);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuContactoId(null);
  };

  const handleEditSelected = () => {
    if (menuContactoId == null) return;
    onEditContacto(menuContactoId);
    handleCloseMenu();
  };

  const handleDeleteSelected = () => {
    if (menuContactoId == null) return;
    onDeleteContacto(menuContactoId);
    handleCloseMenu();
  };

  return (
    <Box sx={{ width: '100%', px: 2, py: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 10 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, position: 'sticky', top: 72, zIndex: 2, py: 1, backgroundColor: '#eef1f4' }}>
          <Box>
            <Typography variant="h5" fontWeight={600} color="#1d2f68">Contactos</Typography>
            <Typography variant="body2" color="#4b5563">Gestiona y consulta tus contactos registrados.</Typography>
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por empresa, contacto, email o teléfono"
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
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {tiposOpciones.map((tipo) => {
              const selected = tipo === 'Todos' ? isTodosActivo : selectedTipos.includes(tipo);
              return (
                <Chip
                  key={tipo}
                  label={tipo}
                  clickable
                  onClick={() => onToggleTipo(tipo)}
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  size="small"
                />
              );
            })}
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : contactos.length === 0 ? (
            <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#fff', px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="#4b5563">No hay contactos para mostrar.</Typography>
            </Box>
          ) : (
            contactos.map((contacto) => {
              const detailItems = [
                { label: 'Contacto', value: contacto.nombre_contacto },
                { label: 'Tipo', value: contacto.tipo_contacto },
                { label: 'Clasificación', value: contacto.clasificacion },
                { label: 'Teléfono', value: contacto.telefono || contacto.telefono_secundario },
                { label: 'Vendedor', value: contacto.vendedor_nombre },
              ].filter((item) => hasValue(item.value));

              const subtitle = getPrimarySubtitle(contacto.email, contacto.telefono, contacto.telefono_secundario);

              return (
                <Card
                  key={contacto.id}
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
                          {renderValue(contacto.nombre)}
                        </Typography>
                        {hasValue(contacto.nombre_contacto) ? (
                          <Typography variant="body2" color="#374151" sx={{ mt: 0.25, lineHeight: 1.3 }}>
                            {renderValue(contacto.nombre_contacto)}
                          </Typography>
                        ) : null}
                        {subtitle ? (
                          <Typography variant="body2" color="#4b5563" sx={{ mt: 0.25, wordBreak: 'break-word', lineHeight: 1.3 }}>
                            {subtitle}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        size="small"
                        aria-label="Abrir acciones"
                        onClick={(event) => handleOpenMenu(event, contacto.id)}
                        sx={{ mt: -0.25, mr: -0.5 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {detailItems.length > 0 ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}> 
                        {detailItems.map((item) => (
                          <Box key={`${contacto.id}-${item.label}`} sx={{ minWidth: 0 }}>
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

        <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#fff', overflow: 'hidden' }}>
          <TablePagination
            component="div"
            count={rowCount}
            page={page}
            onPageChange={(_, nextPage) => onPageChange(nextPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="Filas por página"
          />
        </Box>

        <Fab
          color="primary"
          aria-label="Nuevo contacto"
          onClick={onCreateContacto}
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