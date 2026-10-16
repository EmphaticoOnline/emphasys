import * as React from 'react';
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { CloseRounded, SaveOutlined } from '@mui/icons-material';
import { ConfigPageHeader } from '../configuracion/configVisual';
import type { SxProps, Theme } from '@mui/material/styles';

/* Mismo lenguaje visual del panel derecho de Contactos (ContactoWorkspace). */
export const actionIconSx: SxProps<Theme> = (theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover }, '&.Mui-disabled': { bgcolor: theme.emphasys.action.disabled, color: theme.emphasys.action.primaryForeground } });
/* Acciones por renglón: solo icono, sin fondo (patrón de Empresas). */
export const rowIconSx: SxProps<Theme> = (theme) => ({ width: 30, height: 30, borderRadius: '9px', color: theme.emphasys.content.foreground, '&:hover': { bgcolor: theme.emphasys.content.hover } });
export const wellSx = (theme: Theme) => ({ bgcolor: theme.emphasys.content.well, borderRadius: 3, border: `1px solid ${theme.emphasys.content.border}`, overflow: 'hidden' });
export const panelBarSx: SxProps<Theme> = (theme) => ({ px: { xs: 1.5, md: 2.25 }, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, borderBottom: `1px solid ${theme.emphasys.content.border}` });
export const sectionTitleSx: SxProps<Theme> = (theme) => ({ mb: 1.25, fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.emphasys.content.foreground });

export const Pill = ({ active, label }: { active: boolean; label?: string }) => <Box component="span" sx={(theme) => ({ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: active ? theme.emphasys.metric.amount.background : theme.emphasys.content.elevated, color: active ? theme.emphasys.content.foreground : theme.emphasys.content.muted, fontSize: 12, fontWeight: 700 })}>{label ?? (active ? 'Activo' : 'Inactivo')}</Box>;
/* Igual que las tarjetas de Seguros: los campos viven sobre marfil para que el caption del outlined se lea. */
export const fieldCardSx = (theme: Theme) => ({ p: 1.5, borderRadius: 1.5, border: `1px solid ${theme.emphasys.content.border}`, bgcolor: theme.emphasys.content.well });
export const Section = ({ title, children, inset }: { title:string; children:React.ReactNode; inset?: boolean }) => <Box sx={(theme) => ({ p: { xs: 1.5, md: 2 }, borderRadius: 2, bgcolor: theme.emphasys.metric.amount.background })}><Typography sx={sectionTitleSx}>{title}</Typography>{inset ? <Box sx={fieldCardSx}>{children}</Box> : children}</Box>;
export const ColHead = ({ children, align }: { children: React.ReactNode; align?: 'right' }) => <Typography sx={(theme) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.emphasys.content.muted, textAlign: align })}>{children}</Typography>;

/* Panel de formulario: marfil con bloques beige separados (Vehículos/Remolques/Operadores). */
export const formWellSx = (theme: Theme) => ({ ...wellSx(theme), p: { xs: 1, md: 1.75 }, display: 'flex', flexDirection: 'column', gap: { xs: 1, md: 1.5 } });

/* Tablas MUI con el mismo encabezado beige y filas del listado de Vehículos. */
export const editorialTableSx = (theme: Theme) => ({
  '&& .MuiTableHead-root .MuiTableCell-root': { bgcolor: theme.emphasys.metric.amount.background, color: theme.emphasys.content.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `1px solid ${theme.emphasys.content.border}`, py: 1, px: 2.25 },
  '&& .MuiTableBody-root .MuiTableCell-root': { fontSize: 13, color: theme.emphasys.content.secondary, borderBottom: `1px solid ${theme.emphasys.content.border}`, py: 1.25, px: 2.25 },
  '&& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root': { borderBottom: 0 },
  '&& .MuiTableBody-root .MuiTableRow-hover:hover': { bgcolor: theme.emphasys.content.hover },
});

/* Dialogos de alta/edición con la misma superficie de página del patrón. */
export const dialogPaperSx = (theme: Theme) => ({ bgcolor: theme.emphasys.content.background, backgroundImage: 'none', borderRadius: 3, border: `1px solid ${theme.emphasys.content.border}` });

/* Botones con texto dentro de secciones (agregar, subir, registrar): estilos de catálogo con el radio de las acciones. */
const innerShape = { borderRadius: '10px', minHeight: 34, textTransform: 'none' as const, fontWeight: 700 };
export const innerPrimaryButtonSx = (theme: Theme) => ({ bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover }, '&.Mui-disabled': { bgcolor: theme.emphasys.action.disabled, color: theme.emphasys.action.primaryForeground }, boxShadow: 'none', ...innerShape });
export const innerOutlinedButtonSx = (theme: Theme) => ({ color: theme.emphasys.content.foreground, borderColor: theme.emphasys.content.border, bgcolor: theme.emphasys.content.card, '&:hover': { borderColor: theme.emphasys.content.foreground, bgcolor: theme.emphasys.content.hover }, ...innerShape });

/* Campos dentro de un contenedor: aplica el mismo estilo de campo (catalogoSearchSx) a todos los TextField/Select. */
export const fieldsOnIvorySx = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': { backgroundColor: theme.emphasys.content.card, borderRadius: 2, '& fieldset': { borderColor: theme.emphasys.content.border } },
});

/* Barra superior de un panel con título, dato secundario y acciones. */
export const PanelBar = ({ title, meta, children }: { title: React.ReactNode; meta?: React.ReactNode; children?: React.ReactNode }) => (
  <Box sx={panelBarSx}>
    <Box sx={{ minWidth: 0, py: 1 }}>
      {typeof title === 'string' ? <Typography sx={(theme) => ({ fontSize: 14, fontWeight: 700, color: theme.emphasys.content.foreground })}>{title}</Typography> : title}
      {meta ? <Typography sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>{meta}</Typography> : null}
    </Box>
    {children ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>{children}</Box> : null}
  </Box>
);

/* Celdas especiales para tablas con editorialTableSx. */
export const emptyCellSx = (theme: Theme) => ({ py: '48px !important', color: `${theme.emphasys.content.muted} !important` });
export const strongCellSx = (theme: Theme) => ({ fontSize: '14px !important', fontWeight: 700, color: `${theme.emphasys.content.foreground} !important` });

/* DataGrid existentes: mismo encabezado beige y filas del patrón (se aplica después de standardDataGridSx). */
export const editorialDataGridSx = (theme: Theme) => ({
  border: 0,
  bgcolor: 'transparent',
  '--DataGrid-containerBackground': theme.emphasys.metric.amount.background,
  '--DataGrid-rowBorderColor': theme.emphasys.content.border,
  '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: `${theme.emphasys.metric.amount.background} !important`, color: theme.emphasys.content.muted, borderBottom: `1px solid ${theme.emphasys.content.border} !important` },
  '& .MuiDataGrid-columnHeaderTitle': { color: theme.emphasys.content.secondary, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' },
  '& .MuiDataGrid-columnHeader .MuiSvgIcon-root, & .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIcon': { color: theme.emphasys.content.secondary },
  /* standardDataGridSx fuerza el texto claro del header oscuro en .finanzas-header con !important; aquí se reemplaza por texto legible sobre beige. */
  '&& .finanzas-header': { backgroundColor: `${theme.emphasys.metric.amount.background} !important`, color: `${theme.emphasys.content.secondary} !important` },
  '&& .finanzas-header .MuiDataGrid-columnHeaderTitle, && .finanzas-header .MuiDataGrid-sortIcon, && .finanzas-header .MuiDataGrid-menuIcon, && .finanzas-header .MuiIconButton-root, && .finanzas-header .MuiSvgIcon-root': { color: `${theme.emphasys.content.secondary} !important` },
  '& .MuiDataGrid-cell': { fontSize: 13, color: theme.emphasys.content.secondary, borderColor: theme.emphasys.content.border },
  '& .MuiDataGrid-row:hover': { bgcolor: theme.emphasys.content.hover },
  '& .MuiDataGrid-footerContainer': { borderColor: theme.emphasys.content.border },
});

/* Espaciado de título/contenido de diálogos del patrón. */
export const dialogTitleSx = { px: { xs: 1.5, md: 2.25 }, pt: 2, pb: 1.5 };
export const dialogContentSx = { px: { xs: 1.5, md: 2.25 }, pb: { xs: 1.5, md: 2.25 } };

/* Botón destructivo con texto (confirmaciones de eliminación). */
export const innerDestructiveButtonSx = (theme: Theme) => ({ bgcolor: theme.emphasys.action.destructive, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.destructive, filter: 'brightness(0.92)' }, boxShadow: 'none', ...innerShape });

/* Encabezado de diálogo del patrón: título editorial y acciones Cancelar/Guardar arriba a la derecha. */
export function PatternDialogHeader({
  eyebrow,
  title,
  description,
  onCancel,
  onSave,
  saving = false,
  saveDisabled = false,
  cancelDisabled = false,
  saveLabel = 'Guardar',
  extra,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  onCancel: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  saveLabel?: string;
  extra?: React.ReactNode;
}) {
  return (
    <ConfigPageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <Stack direction="row" spacing={0.5} alignItems="center">
          {extra}
          <Tooltip title="Cancelar">
            <span>
              <IconButton size="small" sx={actionIconSx} onClick={onCancel} disabled={cancelDisabled}>
                <CloseRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {onSave ? (
            <Tooltip title={saving ? 'Guardando…' : saveLabel}>
              <span>
                <IconButton size="small" sx={actionIconSx} onClick={onSave} disabled={saving || saveDisabled}>
                  {saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </Stack>
      }
    />
  );
}

/* Etiqueta compacta para switches/casillas en el encabezado o dentro de secciones. */
export const ControlLabel = ({ children }: { children: React.ReactNode }) => <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{children}</Typography>;
