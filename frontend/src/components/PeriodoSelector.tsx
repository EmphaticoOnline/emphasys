import React, { useMemo, useState } from 'react';
import { Box, ButtonBase, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useBrand } from '../theme/brand/useBrand';
import { MESES_CORTOS, MESES_LARGOS, aniosDisponibles, moverPeriodo, type Periodo } from './periodoSelector.utils';

type Conteo = { anio: number; mes: number; total: number };

type Props = {
  value: Periodo;
  onChange: (periodo: Periodo) => void;
  /** Movimientos por año y mes: atenúa los meses vacíos y muestra el conteo al pasar el mouse. */
  conteos?: Conteo[];
  /** Deshabilitado (por ejemplo, mientras se busca en todos los periodos). */
  disabled?: boolean;
  /** Texto que sustituye al periodo cuando está deshabilitado. */
  textoDeshabilitado?: string;
};

const plural = (n: number) => `${n.toLocaleString('es-MX')} movimiento${n === 1 ? '' : 's'}`;

/**
 * Selector de periodo para listas con historial: flechas para ir mes a mes y pop-ups para saltar
 * directo a un mes o a un año. Pensado para el panel lateral (tokens de navegación).
 */
export default function PeriodoSelector({ value, onChange, conteos = [], disabled = false, textoDeshabilitado }: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const { brandElevation } = useBrand();
  const [anclaMes, setAnclaMes] = useState<HTMLElement | null>(null);
  const [anclaAnio, setAnclaAnio] = useState<HTMLElement | null>(null);

  const totales = useMemo(() => {
    const porMes = new Map<string, number>();
    const porAnio = new Map<number, number>();
    conteos.forEach((c) => {
      porMes.set(`${c.anio}-${c.mes}`, c.total);
      porAnio.set(c.anio, (porAnio.get(c.anio) ?? 0) + c.total);
    });
    return { porMes, porAnio };
  }, [conteos]);
  const anios = useMemo(() => aniosDisponibles(conteos, value), [conteos, value]);
  const hayConteos = conteos.length > 0;

  const elegir = (periodo: Periodo) => {
    setAnclaMes(null);
    setAnclaAnio(null);
    onChange(periodo);
  };

  const paperSx = {
    mt: 0.75,
    p: 1.25,
    borderRadius: 2,
    bgcolor: tokens.content.card,
    color: tokens.content.foreground,
    border: `1px solid ${tokens.content.border}`,
    boxShadow: brandElevation.floating,
  };

  const celdaSx = (seleccionada: boolean, vacia: boolean) => ({
    height: 34,
    borderRadius: 1.5,
    fontSize: 13,
    fontWeight: seleccionada ? 800 : 600,
    color: seleccionada ? tokens.action.primaryForeground : tokens.content.foreground,
    bgcolor: seleccionada ? tokens.action.primary : 'transparent',
    opacity: vacia && !seleccionada ? 0.4 : 1,
    '&:hover': { bgcolor: seleccionada ? tokens.action.primaryHover : tokens.content.elevated },
  });

  const botonSx = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.1,
    px: 0.9,
    height: 30,
    borderRadius: 1.5,
    fontSize: 13.5,
    fontWeight: 750,
    color: tokens.navigation.foreground,
    '&:hover': { bgcolor: tokens.navigation.hover },
  };

  const flechaSx = { width: 30, height: 30, color: tokens.navigation.foreground };

  if (disabled) {
    return (
      <Box sx={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, bgcolor: tokens.navigation.summary }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: tokens.navigation.muted }}>
          {textoDeshabilitado ?? 'Todos los periodos'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 2, bgcolor: tokens.navigation.summary, px: 0.25 }}>
      <Tooltip title={value.mes == null ? 'Año anterior' : 'Mes anterior'}>
        <IconButton size="small" aria-label={value.mes == null ? 'Año anterior' : 'Mes anterior'} onClick={() => onChange(moverPeriodo(value, -1))} sx={flechaSx}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <ButtonBase aria-label="Elegir mes" onClick={(event) => setAnclaMes(event.currentTarget)} sx={botonSx}>
          {value.mes == null ? 'Todo el año' : MESES_LARGOS[value.mes - 1]}
          <ArrowDropDownIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
        </ButtonBase>
        <ButtonBase aria-label="Elegir año" onClick={(event) => setAnclaAnio(event.currentTarget)} sx={botonSx}>
          {value.anio}
          <ArrowDropDownIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
        </ButtonBase>
      </Box>

      <Tooltip title={value.mes == null ? 'Año siguiente' : 'Mes siguiente'}>
        <IconButton size="small" aria-label={value.mes == null ? 'Año siguiente' : 'Mes siguiente'} onClick={() => onChange(moverPeriodo(value, 1))} sx={flechaSx}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anclaMes)}
        anchorEl={anclaMes}
        onClose={() => setAnclaMes(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { ...paperSx, width: 232 } } }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: tokens.content.muted, mb: 1 }}>
          {value.anio}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {MESES_CORTOS.map((nombre, indice) => {
            const mes = indice + 1;
            const total = totales.porMes.get(`${value.anio}-${mes}`) ?? 0;
            return (
              <Tooltip key={nombre} title={hayConteos ? plural(total) : ''} placement="top">
                <ButtonBase onClick={() => elegir({ anio: value.anio, mes })} sx={celdaSx(value.mes === mes, hayConteos && total === 0)}>
                  {nombre}
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
        <ButtonBase
          onClick={() => elegir({ anio: value.anio, mes: null })}
          sx={{ ...celdaSx(value.mes == null, hayConteos && !totales.porAnio.get(value.anio)), width: '100%', mt: 0.75 }}
        >
          Todo el año{hayConteos ? ` · ${plural(totales.porAnio.get(value.anio) ?? 0)}` : ''}
        </ButtonBase>
      </Popover>

      <Popover
        open={Boolean(anclaAnio)}
        anchorEl={anclaAnio}
        onClose={() => setAnclaAnio(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { ...paperSx, width: 232, maxHeight: 320 } } }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {anios.map((anio) => {
            const total = totales.porAnio.get(anio) ?? 0;
            return (
              <Tooltip key={anio} title={hayConteos ? plural(total) : ''} placement="top">
                {/* Al cambiar de año se conserva el mes elegido. */}
                <ButtonBase onClick={() => elegir({ anio, mes: value.mes })} sx={celdaSx(value.anio === anio, hayConteos && total === 0)}>
                  {anio}
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
      </Popover>
    </Box>
  );
}
