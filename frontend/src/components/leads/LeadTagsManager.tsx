import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { WhatsappEtiqueta } from '../../pages/LeadsPage';

// Menú de alternar/crear etiquetas (anclado al botón "Agregar etiqueta" del
// inspector) + diálogo "Administrar etiquetas" (editar/desactivar/crear),
// extraídos de LeadsDesktopView.tsx para reutilizarlos tal cual en
// LeadsMobileView — mismo estado y mismos handlers de LeadsPage.tsx, sin
// duplicar la lógica de creación/edición/desactivación de etiquetas.
export interface LeadTagsManagerProps {
  tagsMenuAnchor: HTMLElement | null;
  handleCloseTagsMenu: () => void;
  availableTags: WhatsappEtiqueta[];
  conversationTags: WhatsappEtiqueta[];
  toggleConversationTag: (tag: WhatsappEtiqueta) => void;
  isCreatingTag: boolean;
  newTagName: string;
  setNewTagName: React.Dispatch<React.SetStateAction<string>>;
  newTagColor: string;
  setNewTagColor: React.Dispatch<React.SetStateAction<string>>;
  handleCancelCreateTag: () => void;
  handleSaveNewTag: () => void;
  handleStartCreateTag: () => void;
  manageTagsOpen: boolean;
  handleCloseManageTags: () => void;
  tagActionError: string | null;
  setTagActionError: React.Dispatch<React.SetStateAction<string | null>>;
  handleOpenEditTagForm: (tag: WhatsappEtiqueta) => void;
  handleDeactivateTag: (tag: WhatsappEtiqueta) => void;
  tagDeactivatingId: number | null;
  tagFormOpen: boolean;
  tagFormId: number | null;
  tagFormName: string;
  setTagFormName: React.Dispatch<React.SetStateAction<string>>;
  tagFormColor: string;
  setTagFormColor: React.Dispatch<React.SetStateAction<string>>;
  tagFormError: string | null;
  handleCancelTagForm: () => void;
  handleSubmitTagForm: () => void;
  tagFormSaving: boolean;
  handleOpenCreateTagForm: () => void;
}

export function LeadTagsManager(props: LeadTagsManagerProps) {
  const {
    tagsMenuAnchor,
    handleCloseTagsMenu,
    availableTags,
    conversationTags,
    toggleConversationTag,
    isCreatingTag,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    handleCancelCreateTag,
    handleSaveNewTag,
    handleStartCreateTag,
    manageTagsOpen,
    handleCloseManageTags,
    tagActionError,
    setTagActionError,
    handleOpenEditTagForm,
    handleDeactivateTag,
    tagDeactivatingId,
    tagFormOpen,
    tagFormId,
    tagFormName,
    setTagFormName,
    tagFormColor,
    setTagFormColor,
    tagFormError,
    handleCancelTagForm,
    handleSubmitTagForm,
    tagFormSaving,
    handleOpenCreateTagForm,
  } = props;

  return (
    <>
      <Menu
        anchorEl={tagsMenuAnchor}
        open={Boolean(tagsMenuAnchor)}
        onClose={handleCloseTagsMenu}
        MenuListProps={{ dense: true }}
      >
        {availableTags.length === 0 ? (
          <MenuItem disabled>Sin etiquetas disponibles</MenuItem>
        ) : availableTags.map((tag) => {
          const isAssigned = conversationTags.some((t) => t.id === tag.id);
          return (
            <MenuItem
              key={tag.id}
              selected={isAssigned}
              onClick={() => toggleConversationTag(tag)}
              sx={{ gap: 1 }}
            >
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: tag.color }} />
              <Typography variant="body2" fontWeight={600}>
                {tag.nombre}
              </Typography>
            </MenuItem>
          );
        })}
        {isCreatingTag ? (
          <Box
            sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 220 }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TextField
              size="small"
              label="Nombre"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <TextField
              size="small"
              label="Color"
              type="color"
              value={newTagColor}
              onChange={(event) => setNewTagColor(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: 140 }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="text" onClick={handleCancelCreateTag}>
                Cancelar
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveNewTag}
                disabled={!newTagName.trim() || !/^#([0-9A-Fa-f]{6})$/.test(newTagColor.trim())}
              >
                Guardar
              </Button>
            </Stack>
          </Box>
        ) : (
          <MenuItem onClick={handleStartCreateTag}>
            <Typography variant="body2" fontWeight={600}>
              ➕ Crear nueva etiqueta
            </Typography>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={manageTagsOpen} onClose={handleCloseManageTags} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocalOfferIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Administrar etiquetas
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleCloseManageTags} aria-label="Cerrar">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {tagActionError && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setTagActionError(null)}>
              {tagActionError}
            </Alert>
          )}

          <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto', mb: 1.5, pr: 0.5 }}>
            {availableTags.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Aún no hay etiquetas. Crea la primera abajo.
              </Typography>
            ) : availableTags.map((tag) => (
              <Stack
                key={tag.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tag.color, flexShrink: 0 }} />
                <Chip
                  size="small"
                  label={tag.nombre}
                  sx={{
                    bgcolor: `${tag.color}22`,
                    color: 'text.primary',
                    fontWeight: 600,
                    maxWidth: 160,
                  }}
                />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => handleOpenEditTagForm(tag)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Desactivar">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleDeactivateTag(tag)}
                      disabled={tagDeactivatingId === tag.id}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {tagFormOpen ? (
            <Stack spacing={1.25}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {tagFormId == null ? 'Nueva etiqueta' : 'Editar etiqueta'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextField
                  size="small"
                  label="Nombre"
                  value={tagFormName}
                  onChange={(event) => setTagFormName(event.target.value)}
                  fullWidth
                  autoFocus
                />
                <TextField
                  size="small"
                  label="Color"
                  type="color"
                  value={tagFormColor}
                  onChange={(event) => setTagFormColor(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 88 }}
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Vista previa:
                </Typography>
                <Chip
                  size="small"
                  label={tagFormName.trim() || 'Nombre de etiqueta'}
                  sx={{ bgcolor: `${tagFormColor}22`, color: 'text.primary', fontWeight: 600 }}
                />
              </Stack>
              {tagFormError && (
                <Typography variant="caption" color="error">
                  {tagFormError}
                </Typography>
              )}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={handleCancelTagForm} disabled={tagFormSaving}>
                  Cancelar
                </Button>
                <Button size="small" variant="contained" onClick={handleSubmitTagForm} disabled={tagFormSaving}>
                  {tagFormId == null ? 'Guardar etiqueta' : 'Guardar cambios'}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Button size="small" startIcon={<AddIcon />} onClick={handleOpenCreateTagForm}>
              Nueva etiqueta
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
