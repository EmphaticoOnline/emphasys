import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton, InputBase, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import type { FinanzasCuenta, FinanzasOperacion } from '../../types/finanzas';
import { MAIN_NAV_TYPE } from '../../theme/tokens';
import {
  etiquetaChip,
  etiquetaSugerencia,
  mismaSugerencia,
  sugerirMovimientos,
  type FiltroMovimiento,
  type SugerenciaMovimiento,
} from './buscadorMovimientosLogica';
import { TesoreriaMobileMovementCard } from './TesoreriaMobileMovementCard';
import { agruparMovimientos } from './tesoreriaMobilePresentacion';

type Props = {
  cuenta: FinanzasCuenta;
  operaciones: FinanzasOperacion[];
  operacionesVisibles: FinanzasOperacion[];
  loading: boolean;
  error: string | null;
  formatoMoneda: Intl.NumberFormat;
  query: string;
  setQuery: (value: string) => void;
  filtros: FiltroMovimiento[];
  setFiltros: (value: FiltroMovimiento[]) => void;
  onBack: () => void;
  onNuevoMovimiento: () => void;
  onEditarCuenta: (cuenta: FinanzasCuenta) => void;
  onEliminarCuenta: (cuenta: FinanzasCuenta) => void;
  onProgramacionPagos: () => void;
  onOpenMovimiento: (operacion: FinanzasOperacion) => void;
  onOpenOrigen: (ruta: string) => void;
};

export function TesoreriaMobileAccount({
  cuenta,
  operaciones,
  operacionesVisibles,
  loading,
  error,
  formatoMoneda,
  query,
  setQuery,
  filtros,
  setFiltros,
  onBack,
  onNuevoMovimiento,
  onEditarCuenta,
  onEliminarCuenta,
  onProgramacionPagos,
  onOpenMovimiento,
  onOpenOrigen,
}: Props) {
  const tokens = useTheme().emphasys;
  const inputRef = useRef<HTMLInputElement>(null);
  const [buscando, setBuscando] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const grupos = useMemo(() => agruparMovimientos(operacionesVisibles), [operacionesVisibles]);
  const sugerencias = useMemo(
    () => (buscando ? sugerirMovimientos(operaciones, query).slice(0, 6) : []),
    [buscando, operaciones, query],
  );
  const moneda = cuenta.moneda || 'MXN';

  useEffect(() => {
    if (buscando) inputRef.current?.focus();
  }, [buscando]);

  const cerrarBusqueda = () => {
    setBuscando(false);
    setQuery('');
    setFiltros([]);
  };

  const agregarFiltro = (sugerencia: SugerenciaMovimiento) => {
    if (!filtros.some((filtro) => mismaSugerencia(filtro, sugerencia))) setFiltros([...filtros, sugerencia]);
    setQuery('');
    inputRef.current?.focus();
  };

  const quitarFiltro = (objetivo: FiltroMovimiento) => {
    setFiltros(filtros.filter((filtro) => !mismaSugerencia(filtro, objetivo)));
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily }}>
      <Box sx={{ px: 0.5, pt: 0.5, pb: 0.25, display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, minHeight: 52 }}>
        {buscando ? (
          <>
            <IconButton aria-label="Cerrar búsqueda" onClick={cerrarBusqueda} sx={iconoSx(tokens)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <InputBase
              inputRef={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar movimientos"
              sx={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'inherit',
                fontSize: 16,
                color: tokens.content.foreground,
                '& input::placeholder': { color: tokens.content.muted, opacity: 1 },
              }}
            />
            {(query || filtros.length > 0) ? (
              <IconButton
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setQuery('');
                  setFiltros([]);
                  inputRef.current?.focus();
                }}
                sx={iconoSx(tokens)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : null}
          </>
        ) : (
          <>
            <IconButton aria-label="Volver a tesorería" onClick={onBack} sx={iconoSx(tokens)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em', color: tokens.content.foreground }}>
              {cuenta.identificador}
            </Typography>
            <IconButton aria-label="Buscar movimientos" onClick={() => setBuscando(true)} sx={iconoSx(tokens)}>
              <SearchIcon fontSize="small" />
            </IconButton>
            <IconButton aria-label="Más acciones" onClick={(event) => setMenuAnchor(event.currentTarget)} sx={iconoSx(tokens)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </>
        )}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: menuPaperSx(tokens) } }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onEditarCuenta(cuenta);
            }}
            sx={{ fontFamily: 'inherit' }}
          >
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Editar cuenta</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onEliminarCuenta(cuenta);
            }}
            sx={{ fontFamily: 'inherit' }}
          >
            <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Eliminar cuenta</ListItemText>
          </MenuItem>
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
        </Menu>
      </Box>

      {buscando && (sugerencias.length > 0 || filtros.length > 0) ? (
        <Box sx={{ px: 2, pb: 0.75, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          {filtros.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {filtros.map((filtro) => (
                <Box
                  key={etiquetaChip(filtro)}
                  component="button"
                  type="button"
                  onClick={() => quitarFiltro(filtro)}
                  sx={{
                    border: `1px solid ${tokens.content.border}`,
                    bgcolor: tokens.content.elevated,
                    color: tokens.content.foreground,
                    borderRadius: 99,
                    px: 1,
                    py: 0.35,
                    font: 'inherit',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {etiquetaChip(filtro)} ×
                </Box>
              ))}
            </Box>
          ) : null}
          {sugerencias.map((sugerencia) => {
            const { etiqueta, detalle } = etiquetaSugerencia(sugerencia);
            return (
              <Box
                key={`${sugerencia.tipo}-${sugerencia.campo}-${etiqueta}-${detalle}`}
                component="button"
                type="button"
                onClick={() => agregarFiltro(sugerencia)}
                sx={{
                  border: 0,
                  bgcolor: 'transparent',
                  color: tokens.content.secondary,
                  font: 'inherit',
                  fontSize: 13,
                  textAlign: 'left',
                  px: 0,
                  py: 0.35,
                  cursor: 'pointer',
                }}
              >
                {etiqueta}: {detalle}
              </Box>
            );
          })}
        </Box>
      ) : null}

      {error ? (
        <Typography role="alert" sx={{ px: 2, pb: 0.5, fontSize: 13, color: tokens.action.destructive }}>
          {error}
        </Typography>
      ) : null}

      <Box sx={{ px: 2, pt: 2, pb: 0.25, flexShrink: 0 }}>
        <Typography variant="figure" sx={{ fontSize: 36, lineHeight: 1.02, letterSpacing: '-0.03em', color: tokens.content.foreground }}>
          {formatoMoneda.format(Number(cuenta.saldo) || 0)}
        </Typography>
        <Typography sx={{ mt: 0.45, fontSize: 13, fontWeight: 500, color: tokens.content.muted }}>
          Disponible
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.25, px: 1.5, pt: 1.5, pb: 1.75, flexShrink: 0 }}>
        <IconButton
          aria-label="Nuevo movimiento"
          onClick={onNuevoMovimiento}
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: tokens.action.primary,
            color: tokens.action.primaryForeground,
            '&:hover': { bgcolor: tokens.action.primaryHover },
          }}
        >
          <AddIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pb: 'env(safe-area-inset-bottom)' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={22} sx={{ color: tokens.content.muted }} />
          </Box>
        ) : grupos.length === 0 ? (
          <Typography sx={{ px: 2, py: 3, fontSize: 14, color: tokens.content.muted }}>
            {query || filtros.length > 0 ? 'Ningún movimiento coincide.' : 'Esta cuenta todavía no tiene movimientos.'}
          </Typography>
        ) : grupos.map((grupo) => (
          <Box key={grupo.clave}>
            <Typography sx={{
              px: 2,
              py: 0.7,
              bgcolor: tokens.metric.amount.background,
              color: tokens.content.muted,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              lineHeight: 1.3,
            }}>
              {grupo.etiqueta}
            </Typography>
            {grupo.operaciones.map((operacion) => (
              <TesoreriaMobileMovementCard
                key={operacion.id}
                operacion={operacion}
                moneda={moneda}
                onOpen={onOpenMovimiento}
                onOpenOrigen={onOpenOrigen}
              />
            ))}
          </Box>
        ))}
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
