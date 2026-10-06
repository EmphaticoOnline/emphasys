import React from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SyncIcon from '@mui/icons-material/Sync';
import type { FinanzasCuenta } from '../../types/finanzas';

interface CuentasSidebarProps {
  cuentas: FinanzasCuenta[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onSelectTodas: () => void;
  onNew: () => void;
  onEdit: (cuenta: FinanzasCuenta) => void;
  onDelete: (cuenta: FinanzasCuenta) => void;
  loading?: boolean;
  /** Sólo se muestra el menú de mantenimiento si se provee este handler (control de permisos lo decide el padre). */
  onRecalcularSaldos?: (() => void) | undefined;
}

export function CuentasSidebar({ cuentas, selectedId, onSelect, onSelectTodas, onNew, onEdit, onDelete, loading, onRecalcularSaldos }: CuentasSidebarProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const currency = React.useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  return (
    <Box
      sx={{
        width: { xs: '100%', md: 236 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        maxHeight: { xs: 320, md: 'none' },
        bgcolor: tokens.navigation.background,
        color: tokens.navigation.foreground,
        borderRight: { md: `1px solid ${tokens.navigation.border}` },
        borderBottom: { xs: `1px solid ${tokens.navigation.border}`, md: 'none' },
      }}
    >
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
            CUENTAS
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }}>
            {loading ? 'Cargando…' : `${cuentas.length} en tesorería`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          {onRecalcularSaldos && (
            <>
              <Tooltip title="Mantenimiento" arrow>
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  aria-label="Más opciones"
                  sx={{ color: tokens.navigation.foreground }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onRecalcularSaldos();
                  }}
                >
                  <ListItemIcon>
                    <SyncIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Recalcular saldos</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
          <Tooltip title="Nueva cuenta" arrow>
            <IconButton
              aria-label="Nueva cuenta"
              onClick={onNew}
              sx={{
                width: 34,
                height: 34,
                bgcolor: tokens.navigation.control,
                color: tokens.navigation.controlForeground,
                '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 1,
          pb: 1.2,
          scrollbarWidth: 'thin',
          scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`,
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <Box key={`skeleton-${idx}`} sx={{ px: 1.25, py: 1.05 }}>
                <Skeleton width="60%" height={18} sx={{ bgcolor: tokens.navigation.hover }} />
                <Skeleton width="40%" height={16} sx={{ bgcolor: tokens.navigation.hover }} />
              </Box>
            ))
          : <>
            <Box onClick={onSelectTodas} sx={{ px: 1.25, py: 1.05, mb: 0.45, borderRadius: 2, cursor: 'pointer', bgcolor: selectedId === null ? tokens.navigation.selection : 'transparent', color: selectedId === null ? tokens.navigation.selectionForeground : tokens.navigation.foreground, '&:hover': { bgcolor: selectedId === null ? tokens.navigation.selection : tokens.navigation.hover } }}>
              <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.15 }}>Todas las cuentas</Typography>
              <Typography sx={{ mt: 0.35, fontSize: 13, color: 'inherit', opacity: 0.78 }}>Vista consolidada</Typography>
            </Box>
            {cuentas.map((cuenta) => {
              const selected = cuenta.id === selectedId;
              return (
                <Box
                  key={cuenta.id}
                  onClick={() => onSelect(cuenta.id)}
                  sx={{
                    px: 1.25,
                    py: 1.05,
                    mb: 0.45,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: selected ? tokens.navigation.selection : 'transparent',
                    color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                    '&:hover': { bgcolor: selected ? tokens.navigation.selection : tokens.navigation.hover },
                    '& .cuenta-acciones': { opacity: { xs: 1, md: selected ? 1 : 0 } },
                    '&:hover .cuenta-acciones': { opacity: 1 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.15 }} noWrap>
                        {cuenta.identificador}
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: selected ? 'inherit' : tokens.navigation.subtle }}>
                        {currency.format(Number(cuenta.saldo ?? 0))}
                      </Typography>
                      <Typography sx={{ mt: 0.2, fontSize: 11.5, color: tokens.navigation.muted }}>
                        {[cuenta.moneda || 'MXN', cuenta.tipo_cuenta, cuenta.cuenta_cerrada ? 'Cerrada' : ''].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <Box
                      className="cuenta-acciones"
                      sx={{ display: 'flex', alignItems: 'center', transition: 'opacity 120ms ease' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Editar" arrow>
                        <IconButton size="small" onClick={() => onEdit(cuenta)} sx={{ color: 'inherit' }} aria-label={`Editar ${cuenta.identificador}`}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar" arrow>
                        <IconButton size="small" onClick={() => onDelete(cuenta)} sx={{ color: tokens.navigation.foreground }} aria-label={`Eliminar ${cuenta.identificador}`}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </>}

        {!loading && cuentas.length === 0 && (
          <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted }}>
            No hay cuentas registradas todavía.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default CuentasSidebar;
