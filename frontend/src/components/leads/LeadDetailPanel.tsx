import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import type { NavigateFunction } from 'react-router-dom';
import { buildLeadOwnerLabel, formatFechaHora, formatMinutesAgo, getWindowDisplayState } from '../../utils/leadsDerivation';
import type { Contacto } from '../../types/contactos.types';
import type {
  Lead,
  LeadConPrioridad,
  MotivoFinalizacion,
  NextAction,
  OportunidadVenta,
  Priority,
  WhatsappEtiqueta,
} from '../../pages/LeadsPage';

// Menu/select props compartidos por los selects compactos del inspector
// (mismo criterio visual que ya usaban los selects de LeadsDesktopView).
export const leadSelectMenuProps = {
  PaperProps: {
    sx: {
      '& .MuiMenuItem-root': {
        fontSize: '0.85rem',
      },
    },
  },
};

export const nextActionOptions: NextAction[] = ['Responder', 'Llamar', 'Enviar cotización', 'Agendar demo', 'Cerrar'];
export const priorityOptions: Priority[] = ['Alta', 'Media', 'Baja'];

// Inspector contextual del lead (secciones 1-8: contacto, vendedor/etiquetas/
// prioridad, acción recomendada, indicadores, oportunidades, último mensaje,
// notas placeholder, acciones comerciales), extraído de LeadsDesktopView.tsx
// para reutilizarlo tal cual — mismo JSX, mismos handlers — en LeadsMobileView
// (bottom sheet) sin duplicar ni un ápice de lógica de negocio. Los diálogos
// de plantilla y reenvío NO viven aquí a propósito: cada vista (desktop/
// mobile) ya los renderiza (o pasa a renderizar) una sola vez a su propio
// nivel, para no arriesgar una segunda instancia montada en paralelo a la que
// ya usa el chat (p. ej. el reenvío disparado desde el long-press del menú de
// mensajes en mobile, independiente de si este panel está abierto o no).
export interface LeadDetailPanelProps {
  selectedLead: LeadConPrioridad;
  isAdmin: boolean;
  selectedContactoId: number | null;
  selectedVendedorId: number | null;
  vendedoresById: Record<number, Contacto>;
  vendedorContactoId: number | null;
  isUpdatingOwner: boolean;
  vendorOptions: Contacto[];
  openCompleteContactDialog: () => void;
  handleOwnerChange: (nextValue: string) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  conversationTags: WhatsappEtiqueta[];
  toggleConversationTag: (tag: WhatsappEtiqueta) => void;
  handleOpenTagsMenu: (event: React.MouseEvent<HTMLElement>) => void;
  selectedLeadPriority: Priority;
  isSending: boolean;
  sendSuccess: boolean;
  handleSendWhatsapp: (event?: React.FormEvent<HTMLFormElement>) => void;
  isSuggesting: boolean;
  handleSuggestMessage: () => void;
  handleSendTemplate: () => void;
  handleGenerarCotizacion: () => void;
  oportunidadesOpen: boolean;
  setOportunidadesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingOportunidades: boolean;
  oportunidadesError: string | null;
  oportunidades: OportunidadVenta[];
  navigate: NavigateFunction;
  motivoFinalizacionLabel: Record<MotivoFinalizacion, string>;
  handleOpenFinalizarDialog: (leadId: string) => void;
  handleReabrirConversacion: (leadId: string) => void;
  reabrirSavingId: string | null;
}

export function LeadDetailPanel(props: LeadDetailPanelProps) {
  const {
    selectedLead,
    isAdmin,
    selectedContactoId,
    selectedVendedorId,
    vendedoresById,
    vendedorContactoId,
    isUpdatingOwner,
    vendorOptions,
    openCompleteContactDialog,
    handleOwnerChange,
    updateLead,
    conversationTags,
    toggleConversationTag,
    handleOpenTagsMenu,
    selectedLeadPriority,
    isSending,
    sendSuccess,
    handleSendWhatsapp,
    isSuggesting,
    handleSuggestMessage,
    handleSendTemplate,
    handleGenerarCotizacion,
    oportunidadesOpen,
    setOportunidadesOpen,
    isLoadingOportunidades,
    oportunidadesError,
    oportunidades,
    navigate,
    motivoFinalizacionLabel,
    handleOpenFinalizarDialog,
    handleReabrirConversacion,
    reabrirSavingId,
  } = props;

  return (
    <>
      <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflow: 'auto', pr: 0.5 }}>
        {/* 1. Datos del contacto */}
        <Stack spacing={0.5}>
          <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {selectedLead.name}
            </Typography>
            <Tooltip title="Editar datos del contacto">
              <span>
                <IconButton
                  size="small"
                  onClick={openCompleteContactDialog}
                  disabled={!selectedContactoId}
                  aria-label="Editar datos del contacto"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {selectedLead.phone}
          </Typography>
        </Stack>

        <Divider />

        {/* 2. Vendedor / etiquetas / prioridad, compactos */}
        <Stack spacing={1}>
          {isAdmin ? (
            <TextField
              select
              size="small"
              label="Vendedor"
              value={selectedVendedorId ? String(selectedVendedorId) : ''}
              onChange={(e) => handleOwnerChange(e.target.value)}
              disabled={isUpdatingOwner || !selectedContactoId}
              SelectProps={{ MenuProps: leadSelectMenuProps }}
              fullWidth
              helperText={isUpdatingOwner ? 'Actualizando…' : undefined}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.85rem' }, '& .MuiInputLabel-root': { fontSize: '0.85rem' } }}
            >
              <MenuItem value="">Sin asignar</MenuItem>
              {vendorOptions.map((v) => (
                <MenuItem key={v.id} value={String(v.id)}>
                  {v.nombre}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Vendedor: {buildLeadOwnerLabel(selectedLead, vendedoresById, vendedorContactoId)}
            </Typography>
          )}

          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {conversationTags.map((tag) => (
              <Chip
                key={tag.id}
                size="small"
                label={tag.nombre}
                onDelete={() => toggleConversationTag(tag)}
                sx={{
                  bgcolor: tag.color,
                  color: '#fff',
                  fontWeight: 500,
                  height: 22,
                  '& .MuiChip-deleteIcon': { color: '#fff' },
                }}
              />
            ))}
            <IconButton
              size="small"
              onClick={handleOpenTagsMenu}
              aria-label="Agregar etiqueta"
              sx={{ border: '1px dashed', borderColor: 'divider' }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>

          <TextField
            select
            size="small"
            label="Prioridad"
            value={selectedLeadPriority}
            onChange={(e) => updateLead(selectedLead.id, { priority: e.target.value as Priority })}
            SelectProps={{ MenuProps: leadSelectMenuProps }}
            sx={{
              maxWidth: 140,
              '& .MuiInputBase-input': { fontSize: '0.85rem' },
              '& .MuiInputLabel-root': { fontSize: '0.85rem' },
            }}
          >
            {priorityOptions.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Divider />

        {/* 3. Acción recomendada */}
        <Stack spacing={1}>
          <TextField
            select
            size="small"
            label="Acción recomendada"
            value={selectedLead.nextAction}
            onChange={(e) => updateLead(selectedLead.id, { nextAction: e.target.value as NextAction })}
            color="primary"
            SelectProps={{ MenuProps: leadSelectMenuProps }}
            fullWidth
            sx={{
              '& .MuiInputBase-input': { fontWeight: 700, fontSize: '0.85rem' },
              '& .MuiInputLabel-root': { fontWeight: 700, fontSize: '0.85rem' },
            }}
          >
            {nextActionOptions.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip
            arrow
            disableHoverListener={!selectedLead.requiresTemplate}
            title={(
              <Box sx={{ maxWidth: 280 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                  No puedes enviar un mensaje libre porque han pasado más de 24 horas desde el último mensaje del cliente.
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  Puedes enviar una plantilla autorizada, pero debes esperar a que el cliente responda antes de continuar con mensajes normales.
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  👉 Usa el botón “Enviar plantilla”.
                </Typography>
              </Box>
            )}
          >
            <span>
              <Button
                variant="text"
                size="small"
                startIcon={<ReplyIcon fontSize="small" />}
                onClick={() => handleSendWhatsapp()}
                disabled={isSending || selectedLead.requiresTemplate}
                sx={{ textTransform: 'none', px: 0.5, minWidth: 'auto' }}
              >
                {isSending ? 'Enviando…' : sendSuccess ? 'Enviado ✓' : 'Escribir en el chat'}
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Divider />

        {/* 4. Indicadores: estado/urgencia, seguimiento pendiente, hot lead, ventana 24h */}
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                color: selectedLead.statusType === 'attention'
                  ? 'error.main'
                  : selectedLead.statusType === 'waiting'
                    ? 'text.secondary'
                    : 'text.primary',
              }}
            >
              {selectedLead.statusLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              · {formatMinutesAgo(selectedLead.idleMinutes)}
              {selectedLead.statusType === 'attention' ? ' · 👉 Responder ahora' : ''}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            {selectedLead.seguimientoPendiente && (
              <Chip size="small" label="Seguimiento pendiente" color="warning" sx={{ fontWeight: 700, height: 22 }} />
            )}
            {selectedLead.hot && (
              <Chip
                size="small"
                icon={<WhatshotIcon fontSize="small" />}
                label="Hot lead"
                color="error"
                sx={{ fontWeight: 700, height: 22 }}
              />
            )}
          </Stack>
          {(() => {
            const windowInfo = getWindowDisplayState(selectedLead);
            return (
              <Typography variant="caption" sx={{ color: windowInfo.color, fontWeight: 600 }}>
                {windowInfo.dot} {windowInfo.label}
              </Typography>
            );
          })()}
        </Stack>

        <Divider />

        {/* 5. Oportunidades: acordeón compacto, no expandido por defecto salvo estado ya existente */}
        <Accordion
          disableGutters
          square
          elevation={0}
          expanded={oportunidadesOpen}
          onChange={() => setOportunidadesOpen((prev) => !prev)}
          sx={{
            '&:before': { display: 'none' },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            '&.Mui-expanded': { margin: 0 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon fontSize="small" />}
            sx={{ minHeight: 40, '&.Mui-expanded': { minHeight: 40 }, '& .MuiAccordionSummary-content': { my: 0.75 } }}
          >
            <Typography variant="body2" fontWeight={700}>
              Oportunidades{oportunidades.length > 0 ? ` (${oportunidades.length})` : ''}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack spacing={1}>
              {isLoadingOportunidades && (
                <Typography variant="body2" color="text.secondary">
                  Cargando oportunidades...
                </Typography>
              )}

              {!isLoadingOportunidades && oportunidadesError && (
                <Alert severity="error">{oportunidadesError}</Alert>
              )}

              {!isLoadingOportunidades && !oportunidadesError && oportunidades.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin oportunidades asociadas.
                </Typography>
              )}

              {!isLoadingOportunidades && !oportunidadesError && oportunidades.map((oportunidad) => {
                const cotizacionPrincipalId = oportunidad.cotizacion_principal_id;
                const folio = oportunidad.folio
                  ?? (oportunidad.serie && oportunidad.numero != null
                    ? `${oportunidad.serie}-${oportunidad.numero}`
                    : oportunidad.serie
                      ? oportunidad.serie
                      : oportunidad.numero != null
                        ? String(oportunidad.numero)
                        : 'Sin folio');

                return (
                  <Box
                    key={oportunidad.id}
                    onClick={() => {
                      if (!cotizacionPrincipalId) return;
                      navigate(`/ventas/cotizacion/${cotizacionPrincipalId}`);
                    }}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 1.25,
                      py: 1,
                      cursor: cotizacionPrincipalId ? 'pointer' : 'default',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                      '&:hover': cotizacionPrincipalId
                        ? {
                            backgroundColor: 'action.hover',
                            borderColor: 'primary.main',
                          }
                        : undefined,
                    }}
                  >
                    <Typography variant="body2" fontWeight={700}>
                      Folio: {folio}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Estatus: {oportunidad.estatus}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Monto oportunidad: {Number(oportunidad.monto_oportunidad ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* 6. Último mensaje: secundario visualmente */}
        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Último mensaje
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
            {selectedLead.lastMessage}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Hace {formatMinutesAgo(selectedLead.lastMessageTimeMinutesAgo)}
          </Typography>
        </Stack>

        <Divider />

        {/* 7. Notas: placeholder exacto, no editor */}
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Notas
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Añade notas rápidas sobre el lead.
          </Typography>
        </Stack>

        {selectedLead.estado === 'finalizada' && (
          <Typography variant="caption" color="text.secondary">
            Finalizada el {formatFechaHora(selectedLead.finalizada_en)}
            {selectedLead.motivo_finalizacion ? ` · ${motivoFinalizacionLabel[selectedLead.motivo_finalizacion]}` : ''}
            {selectedLead.observaciones_finalizacion ? ` · ${selectedLead.observaciones_finalizacion}` : ''}
          </Typography>
        )}
      </Stack>

      {/* 8. Acciones comerciales, compactas, fijas al fondo del panel */}
      <Box
        sx={{
          flexShrink: 0,
          mt: 1,
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0.75,
        }}
      >
        <Tooltip title="Genera una sugerencia de respuesta con IA para esta conversación.">
          <span style={{ display: 'block', width: '100%' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<AutoAwesomeIcon fontSize="small" />}
              onClick={handleSuggestMessage}
              disabled={isSuggesting}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
            >
              {isSuggesting ? 'Generando…' : 'Sugerir IA'}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Envía una plantilla de WhatsApp aprobada al contacto.">
          <span style={{ display: 'block', width: '100%' }}>
            <Button
              fullWidth
              variant={selectedLead.requiresTemplate ? 'contained' : 'outlined'}
              color={selectedLead.requiresTemplate ? 'warning' : 'inherit'}
              size="small"
              startIcon={<DescriptionIcon fontSize="small" />}
              onClick={handleSendTemplate}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
            >
              Plantilla
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Crea una cotización vinculada a este lead.">
          <span style={{ display: 'block', width: '100%' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<DescriptionIcon fontSize="small" />}
              onClick={handleGenerarCotizacion}
              disabled={!selectedContactoId}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
            >
              Cotización
            </Button>
          </span>
        </Tooltip>
        {selectedLead.estado === 'finalizada' ? (
          <Tooltip title="Reabre esta conversación para continuar su seguimiento.">
            <span style={{ display: 'block', width: '100%' }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<ReplayIcon fontSize="small" />}
                onClick={() => handleReabrirConversacion(selectedLead.id)}
                disabled={reabrirSavingId === selectedLead.id}
                sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
              >
                {reabrirSavingId === selectedLead.id ? 'Reabriendo…' : 'Reabrir'}
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Marca esta conversación como finalizada.">
            <span style={{ display: 'block', width: '100%' }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<TaskAltIcon fontSize="small" />}
                onClick={() => handleOpenFinalizarDialog(selectedLead.id)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
              >
                Finalizar
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>
    </>
  );
}
