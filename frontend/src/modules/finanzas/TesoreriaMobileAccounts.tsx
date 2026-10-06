import React from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SyncIcon from '@mui/icons-material/Sync';
import type { FinanzasCuenta } from '../../types/finanzas';
import { MAIN_NAV_TYPE } from '../../theme/tokens';
import { detalleCuenta, formatearMoneda, totalesDisponibles } from './tesoreriaMobilePresentacion';

type Props = {
  cuentas: FinanzasCuenta[];
  loading: boolean;
  error: string | null;
  onDismissError: () => void;
  onSelect: (cuenta: FinanzasCuenta) => void;
  onSelectTodas: () => void;
  onNuevaCuenta: () => void;
  onProgramacionPagos: () => void;
  onRecalcularSaldos?: (() => void) | undefined;
};

export function TesoreriaMobileAccounts({
  cuentas,
  loading,
  error,
  onDismissError,
  onSelect,
  onSelectTodas,
  onNuevaCuenta,
  onProgramacionPagos,
  onRecalcularSaldos,
}: Props) {
  const tokens = useTheme().emphasys;
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const totales = totalesDisponibles(cuentas);
  const resumen = totales.map((item) => formatearMoneda(item.total, item.moneda)).join(' · ');

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily }}>
      <Box
        sx={{
          px: 1.25,
          pt: 0.75,
          pb: 0.75,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, px: 0.75, pt: 0.65 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.1, color: tokens.content.foreground }}>
            Tesorería
          </Typography>
          {!loading && resumen ? (
            <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.content.secondary, fontVariantNumeric: 'tabular-nums' }}>
              {resumen}
            </Typography>
          ) : null}
        </Box>
        <IconButton aria-label="Nueva cuenta" onClick={onNuevaCuenta} sx={iconoSx(tokens)}>
          <AddIcon fontSize="small" />
        </IconButton>
        <IconButton aria-label="Más acciones" onClick={(event) => setMenuAnchor(event.currentTarget)} sx={iconoSx(tokens)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: menuPaperSx(tokens) } }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onProgramacionPagos();
            }}
            sx={{ fontFamily: 'inherit' }}
          >
            <ListItemIcon><CalendarMonthIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Programación de pagos</ListItemText>
          </MenuItem>
          {onRecalcularSaldos ? (
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                onRecalcularSaldos();
              }}
              sx={{ fontFamily: 'inherit' }}
            >
              <ListItemIcon><SyncIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Recalcular saldos</ListItemText>
            </MenuItem>
          ) : null}
        </Menu>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error ? (
          <Typography
            role="alert"
            onClick={onDismissError}
            sx={{ mx: 2, mb: 1, fontSize: 13, color: tokens.action.destructive }}
          >
            {error}
          </Typography>
        ) : null}

        <Typography sx={{
          px: 2,
          py: 0.7,
          bgcolor: tokens.metric.amount.background,
          color: tokens.content.muted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          lineHeight: 1.3,
        }}> 
          CUENTAS
        </Typography>

        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <Box key={index} sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${tokens.content.border}` }}>
                <Skeleton width="46%" height={18} sx={{ bgcolor: tokens.content.hover }} />
                <Skeleton width="28%" height={14} sx={{ bgcolor: tokens.content.hover }} />
              </Box>
            ))
          : <>
            <Box component="button" type="button" onClick={onSelectTodas} sx={{ width: '100%', display: 'block', px: 2, py: 1.15, border: 0, borderBottom: `1px solid ${tokens.content.border}`, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', textAlign: 'left' }}>
              <Typography sx={{ fontSize: 15.5, fontWeight: 600 }}>Todas las cuentas</Typography>
              <Typography sx={{ mt: 0.2, fontSize: 12.5, color: tokens.content.muted }}>Vista consolidada</Typography>
            </Box>
            {cuentas.map((cuenta) => (
              <Box
                key={cuenta.id}
                component="button"
                type="button"
                onClick={() => onSelect(cuenta)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 2,
                  py: 1.15,
                  border: 0,
                  borderBottom: `1px solid ${tokens.content.border}`,
                  bgcolor: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  '&:active': { bgcolor: tokens.content.hover },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.25, color: tokens.content.foreground }}>
                    {cuenta.identificador}
                  </Typography>
                  <Typography noWrap sx={{ mt: 0.2, fontSize: 12.5, lineHeight: 1.3, color: tokens.content.muted }}>
                    {detalleCuenta(cuenta)}
                  </Typography>
                </Box>
                <Typography
                  variant="figure"
                  sx={{
                    flex: '0 0 auto',
                    minWidth: 96,
                    textAlign: 'right',
                    fontSize: 16,
                    lineHeight: 1.1,
                    color: tokens.content.foreground,
                  }}
                >
                  {formatearMoneda(Number(cuenta.saldo) || 0, cuenta.moneda || 'MXN')}
                </Typography>
                <ChevronRightIcon sx={{ flexShrink: 0, fontSize: 20, color: tokens.content.muted }} />
              </Box>
            ))}
          </>}

        {!loading && cuentas.length === 0 ? (
          <Typography sx={{ px: 2, py: 3, fontSize: 14, color: tokens.content.muted }}>
            No hay cuentas registradas todavía.
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function iconoSx(tokens: { content: { foreground: string; hover: string } }) {
  return {
    width: 40,
    height: 40,
    color: tokens.content.foreground,
    '&:hover': { bgcolor: tokens.content.hover },
  };
}

function menuPaperSx(tokens: { content: { elevated: string; foreground: string; border: string } }) {
  return {
    bgcolor: tokens.content.elevated,
    color: tokens.content.foreground,
    border: `1px solid ${tokens.content.border}`,
    minWidth: 220,
  };
}
