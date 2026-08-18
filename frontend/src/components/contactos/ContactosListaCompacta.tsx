import * as React from 'react';
import { Box, Chip, CircularProgress, IconButton, Stack, TablePagination, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import type { GridPaginationModel } from '@mui/x-data-grid';
import type { ContactoRow } from './ContactosView.types';
import { formatearTelefonoParaMostrar } from '../../utils/telefono';

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
}: ContactosListaCompactaProps) {
  return (
    <Box
      sx={{
        width: { xs: '100%', md: 380 },
        flexShrink: 0,
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
          {contactos.length} de {rowCount.toLocaleString('es-MX')} registros
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Box>
        ) : contactos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            <Typography variant="body2" color="#6b7280">
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
                sx={{
                  px: 2,
                  py: 1.25,
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#eef1f7' : 'transparent',
                  borderLeft: isSelected ? '3px solid #1d2f68' : '3px solid transparent',
                  '&:hover': { backgroundColor: isSelected ? '#eef1f7' : '#f8fafc' },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} color="#111827" noWrap>
                      {contacto.nombre}
                    </Typography>
                    {subtitle ? (
                      <Typography variant="caption" color="#6b7280" noWrap sx={{ display: 'block' }}>
                        {subtitle}
                      </Typography>
                    ) : null}
                  </Box>
                  {contacto.tipo_contacto ? (
                    <Chip label={contacto.tipo_contacto} size="small" sx={{ fontWeight: 600, flexShrink: 0 }} />
                  ) : null}
                </Stack>

                {isSelected ? (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} onClick={(event) => event.stopPropagation()}>
                    <Tooltip title="Ver actividades">
                      <IconButton size="small" onClick={() => onViewActividades(contacto)}>
                        <EventNoteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => onEditContacto(contacto.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => onDeleteContacto(contacto.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : null}
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
          sx={{ '& .MuiTablePagination-toolbar': { px: 1.5 } }}
        />
      </Box>
    </Box>
  );
}
