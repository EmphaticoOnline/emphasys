import { useMemo, useState } from 'react';
import { Box, IconButton, InputBase, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { MAIN_NAV_TYPE } from '../../theme/tokens';
import { formatearFechaBusqueda, normalizarBusqueda } from './buscadorMovimientosLogica';
import { fechaCivil } from './capturaMovimientoLogica';

export type OpcionSelector = {
  id: number | null;
  titulo: string;
  detalle?: string;
  clave?: string;
  variante?: 'normal' | 'transferencia';
};

type SelectorProps = {
  titulo: string;
  opciones: OpcionSelector[];
  seleccionadoId: number | null;
  seleccionadoClave?: string | null;
  onBack: () => void;
  onSelect: (opcion: OpcionSelector) => void;
  buscar?: boolean;
};

export function TesoreriaMobileSelector({
  titulo,
  opciones,
  seleccionadoId,
  seleccionadoClave = null,
  onBack,
  onSelect,
  buscar = true,
}: SelectorProps) {
  const tokens = useTheme().emphasys;
  const [query, setQuery] = useState('');
  const visibles = useMemo(() => {
    const texto = normalizarBusqueda(query);
    if (!texto) return opciones;
    return opciones.filter((opcion) => opcion.id != null && (
      normalizarBusqueda(opcion.titulo).includes(texto)
      || normalizarBusqueda(opcion.detalle).includes(texto)
    ));
  }, [opciones, query]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily }}>
      <Encabezado titulo={titulo} onBack={onBack} />
      {buscar ? (
        <Box sx={{ px: 2, pb: 1 }}>
          <InputBase
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            inputProps={{ 'aria-label': `Buscar ${titulo}` }}
            sx={{
              width: '100%',
              px: 1.25,
              py: 0.75,
              borderRadius: '12px',
              bgcolor: tokens.content.elevated,
              border: `1px solid ${tokens.content.border}`,
              fontFamily: 'inherit',
              fontSize: 16,
              color: tokens.content.foreground,
            }}
          />
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {visibles.length === 0 ? (
          <Typography sx={{ px: 2, py: 3, fontSize: 14, color: tokens.content.muted }}>
            Nada coincide con la búsqueda.
          </Typography>
        ) : visibles.map((opcion) => {
          const activa = seleccionadoClave ? opcion.clave === seleccionadoClave : opcion.id === seleccionadoId;
          const transferencia = opcion.variante === 'transferencia';
          const prefijo = 'Transfer: ';
          const tituloTransferencia = transferencia && opcion.titulo.startsWith(prefijo)
            ? opcion.titulo.slice(prefijo.length)
            : opcion.titulo;
          return (
            <Box
              key={opcion.clave ?? opcion.id ?? 'ninguno'}
              component="button"
              type="button"
              onClick={() => onSelect(opcion)}
              sx={filaSx(tokens, activa, transferencia)}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 16, fontWeight: activa ? 700 : 600, color: tokens.content.foreground }}>
                  {transferencia ? (
                    <>
                      <Box component="span" sx={{ color: tokens.content.secondary, fontWeight: 600 }}>Transfer: </Box>
                      {tituloTransferencia}
                    </>
                  ) : opcion.titulo}
                </Typography>
                {opcion.detalle ? (
                  <Typography noWrap sx={{ mt: 0.15, fontSize: 13, color: tokens.content.muted }}>
                    {opcion.detalle}
                  </Typography>
                ) : null}
              </Box>
              <ChevronRightIcon sx={{ fontSize: 20, color: tokens.content.muted }} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function etiquetaFechaConcreta(iso: string) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [year, month, day] = iso.slice(0, 10).split('-');
  const mes = meses[Number(month) - 1] ?? '';
  return `${Number(day)} ${mes} ${year}`;
}

export function etiquetaFechaMovil(iso: string, hoy = new Date()) {
  const clave = iso.slice(0, 10);
  if (clave === fechaCivil(hoy)) return 'Hoy';
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (clave === fechaCivil(ayer)) return 'Ayer';
  return formatearFechaBusqueda(clave);
}

type FechaProps = {
  fecha: string;
  onBack: () => void;
  onSelect: (fecha: string) => void;
};

export function TesoreriaMobileFecha({ fecha, onBack, onSelect }: FechaProps) {
  const tokens = useTheme().emphasys;

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily }}>
      <Encabezado titulo="Fecha" onBack={onBack} />
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pb: 2 }}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
          <StaticDatePicker
            value={dayjs(fecha)}
            onChange={(valor) => {
              if (valor?.isValid()) onSelect(valor.format('YYYY-MM-DD'));
            }}
            slotProps={{ actionBar: { actions: [] } }}
            sx={{
              bgcolor: 'transparent',
              width: '100%',
              '& .MuiDateCalendar-root': { width: '100%', maxHeight: 'none', margin: 0 },
              '& .MuiPickersCalendarHeader-label, & .MuiDayCalendar-weekDayLabel, & .MuiPickersArrowSwitcher-button': {
                color: tokens.content.foreground,
                fontFamily: MAIN_NAV_TYPE.fontFamily,
              },
              '& .MuiPickersDay-root': {
                color: tokens.content.foreground,
                fontFamily: MAIN_NAV_TYPE.fontFamily,
                '&.Mui-selected': {
                  bgcolor: tokens.action.primary,
                  color: tokens.action.primaryForeground,
                  '&:hover, &:focus': { bgcolor: tokens.action.primaryHover },
                },
              },
            }}
          />
        </LocalizationProvider>
      </Box>
    </Box>
  );
}

function Encabezado({ titulo, onBack }: { titulo: string; onBack: () => void }) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ px: 0.5, minHeight: 52, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
      <IconButton aria-label="Volver" onClick={onBack} sx={{ width: 40, height: 40, color: tokens.content.foreground }}>
        <ArrowBackIcon fontSize="small" />
      </IconButton>
      <Typography noWrap sx={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em', color: tokens.content.foreground }}>
        {titulo}
      </Typography>
    </Box>
  );
}

function filaSx(
  tokens: { content: { border: string; foreground: string; hover: string } },
  activa: boolean,
  transferencia = false,
) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 2,
    py: 1.35,
    border: 0,
    borderBottom: `1px solid ${tokens.content.border}`,
    boxShadow: transferencia ? `inset 2px 0 0 ${tokens.content.border}` : 'none',
    bgcolor: activa ? tokens.content.hover : 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left' as const,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    '&:active': { bgcolor: tokens.content.hover },
  };
}
