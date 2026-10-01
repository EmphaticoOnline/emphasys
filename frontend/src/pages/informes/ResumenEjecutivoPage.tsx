import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { apiFetch } from '../../api/apiClient';

type Indicador = Record<string, unknown>;

type Foco = { texto: string; indicadores: string[] };

type Respuesta = {
  dataset: { periodo: { comparativo?: { etiqueta?: string } }; indicadores: Record<string, Indicador> };
  interpretacion: { resumen: string[]; focos_atencion: Foco[] } | null;
  interpretacion_error?: string;
};

type Tono = 'up' | 'down' | 'flat';

type Tarjeta = {
  label: string;
  value: string;
  hint: string | null;
  tono?: Tono;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const isoToday = new Date().toISOString().slice(0, 10);
const monthStart = `${isoToday.slice(0, 8)}01`;

const money = (v: unknown, moneda = 'MXN') =>
  typeof v === 'number'
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(v)
    : 'No disponible';

const pct = (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)}%` : 'No disponible');

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatCorte(iso: unknown): string | null {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const month = MESES[Number(iso.slice(5, 7)) - 1];
  if (!month) return null;
  return `${Number(iso.slice(8, 10))} ${month}`;
}

function contar(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString('es-MX')} ${n === 1 ? singular : plural}`;
}

function tonoVariacion(valor: number): Tono {
  if (valor > 0) return 'up';
  if (valor < 0) return 'down';
  return 'flat';
}

function tarjetaMonetaria(label: string, indicador: Indicador | undefined, hintDisponible: string | null): Tarjeta {
  if (!indicador || indicador.available === false) {
    return {
      label,
      value: 'No disponible',
      hint: asString(indicador?.reason),
    };
  }
  const moneda = asString(indicador.moneda) ?? 'MXN';
  return {
    label,
    value: money(indicador.valor, moneda),
    hint: hintDisponible,
  };
}

function construirTarjetas(indicadores: Record<string, Indicador>, comparativoEtiqueta: string | null): Tarjeta[] {
  const ventas = indicadores.ventas ?? {};
  const variacion = asNumber(ventas.variacion_porcentual);
  const facturas = asNumber(ventas.documentos);
  const cartera = indicadores.cartera_vencida;
  const pedidos = indicadores.pedidos_pendientes_facturar;
  const tesoreria = indicadores.posicion_tesoreria;
  const corteCartera = formatCorte(cartera?.fecha_corte);
  const corteTesoreria = formatCorte(tesoreria?.fecha_corte);
  const cantidadPedidos = asNumber(pedidos?.documentos);
  const anterior = asNumber(ventas.valor_anterior);

  return [
    {
      label: 'Ventas',
      value: money(ventas.valor, asString(ventas.moneda) ?? 'MXN'),
      hint: facturas === null ? null : contar(facturas, 'factura', 'facturas'),
    },
    {
      label: 'Variación',
      value: pct(variacion),
      hint: variacion === null
        ? (anterior === 0 ? 'El periodo anterior no tiene ventas' : null)
        : `vs ${comparativoEtiqueta ?? 'periodo comparativo'}`,
      tono: variacion === null ? undefined : tonoVariacion(variacion),
    },
    {
      label: 'Ticket promedio',
      value: money(ventas.ticket_promedio, asString(ventas.moneda) ?? 'MXN'),
      hint: null,
    },
    tarjetaMonetaria('Cartera vencida', cartera, corteCartera ? `Corte al ${corteCartera}` : null),
    tarjetaMonetaria(
      'Pedidos pendientes',
      pedidos,
      cantidadPedidos === null ? null : contar(cantidadPedidos, 'pedido', 'pedidos'),
    ),
    tarjetaMonetaria('Tesorería', tesoreria, corteTesoreria ? `Corte al ${corteTesoreria}` : null),
  ];
}

export default function ResumenEjecutivoPage() {
  const navigate = useNavigate();
  const [inicio, setInicio] = useState(monthStart);
  const [fin, setFin] = useState(isoToday);
  const [data, setData] = useState<Respuesta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generar = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/reportes/resumen-ejecutivo', {
        method: 'POST',
        body: JSON.stringify({ fecha_inicio: inicio, fecha_fin: fin }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'No se pudo generar el resumen');
      setData(payload as Respuesta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el resumen');
    } finally {
      setLoading(false);
    }
  };

  const theme = useTheme();
  const tokens = theme.emphasys;
  const interpretacion = data?.interpretacion ?? null;
  const tarjetas = data ? construirTarjetas(data.dataset.indicadores, asString(data.dataset.periodo.comparativo?.etiqueta)) : [];
  const focos = interpretacion?.focos_atencion ?? [];

  const campoFechaSx = {
    width: { xs: '100%', sm: 168 },
    '& .MuiOutlinedInput-root': {
      bgcolor: tokens.content.elevated,
      borderRadius: 2,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.muted },
      '&.Mui-focused fieldset': { borderColor: tokens.action.info },
    },
    '& .MuiInputLabel-root': { color: tokens.content.muted },
    '& .MuiInputBase-input': { color: tokens.content.foreground },
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3.5 }, py: { xs: 2.5, md: 3.25 }, maxWidth: 1160, width: '100%', mx: 'auto', minWidth: 0, boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.75, minWidth: 0 }}>
        <Box
          component="button"
          type="button"
          onClick={() => navigate('/informes')}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.4,
            border: 0,
            bgcolor: 'transparent',
            p: 0,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: tokens.content.muted,
            flexShrink: 0,
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          INFORMES
        </Box>
        <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.foreground, minWidth: 0 }}>
          RESUMEN EJECUTIVO
        </Typography>
      </Stack>

      <Box sx={{ mb: 2.75, maxWidth: 640 }}>
        <Typography variant="figure" sx={{ fontSize: { xs: 28, sm: 32 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
          Resumen ejecutivo
        </Typography>
        <Typography sx={{ mt: 0.85, fontSize: 14, lineHeight: 1.5, color: tokens.content.muted }}>
          Una lectura ejecutiva de los principales indicadores de tu empresa.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.25,
          mb: 3.25,
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.content.muted, mr: { sm: 0.5 } }}>
          PERIODO
        </Typography>
        <TextField
          label="Fecha inicial"
          type="date"
          size="small"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={campoFechaSx}
        />
        <Typography sx={{ display: { xs: 'none', sm: 'block' }, color: tokens.content.muted, px: 0.25, lineHeight: 1 }}>
          —
        </Typography>
        <TextField
          label="Fecha final"
          type="date"
          size="small"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={campoFechaSx}
        />
        <Button
          variant="contained"
          onClick={() => void generar()}
          disabled={loading}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            ml: { sm: 0.25 },
            textTransform: 'none',
            fontWeight: 650,
            px: 2,
            borderRadius: 2,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {loading ? 'Generando…' : 'Generar resumen'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      {!data && (
        <Box
          sx={{
            px: { xs: 2.25, sm: 3 },
            py: { xs: 3, sm: 3.5 },
            borderRadius: 3,
            border: `1px solid ${tokens.content.border}`,
            bgcolor: tokens.content.well,
            maxWidth: 680,
          }}
        >
          <Typography sx={{ maxWidth: 460, fontSize: 15, lineHeight: 1.6, color: tokens.content.secondary }}>
            {loading
              ? 'Generando la lectura ejecutiva…'
              : 'Selecciona un periodo y genera una lectura ejecutiva de tu empresa.'}
          </Typography>
        </Box>
      )}

      {data && (
        <Stack spacing={3.25}>
          <Box>
            <Seccion titulo="Lectura ejecutiva" />
            <Box
              sx={{
                mt: 1,
                px: { xs: 2.25, sm: 3 },
                py: { xs: 2.25, sm: 2.75 },
                borderRadius: 3,
                border: `1px solid ${tokens.content.border}`,
                borderLeftWidth: 3,
                borderLeftColor: tokens.action.info,
                bgcolor: tokens.content.well,
              }}
            >
              {interpretacion?.resumen.length ? (
                <Stack spacing={1.6} sx={{ maxWidth: 680 }}>
                  {interpretacion.resumen.map((texto, index) => (
                    <Typography
                      key={index}
                      sx={{ fontSize: { xs: 15, sm: 16 }, lineHeight: 1.65, color: tokens.content.foreground }}
                    >
                      {texto}
                    </Typography>
                  ))}
                </Stack>
              ) : null}

              {!interpretacion && (
                <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: tokens.content.secondary }}>
                  No fue posible generar la interpretación en este momento. Los indicadores calculados siguen disponibles.
                </Typography>
              )}
            </Box>
          </Box>

          <Box>
            <Seccion titulo="Indicadores clave" />
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 0.8,
              }}
            >
              {tarjetas.map((tarjeta) => (
                <IndicadorCard key={tarjeta.label} tarjeta={tarjeta} />
              ))}
            </Box>
          </Box>

          {focos.length > 0 && (
            <Box>
              <Seccion titulo="Focos de atención" />
              <Typography sx={{ mt: 0.35, mb: 1.15, fontSize: 13, color: tokens.content.muted }}>
                Vale la pena revisar
              </Typography>
              <Stack spacing={0.8}>
                {focos.map((foco, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      px: { xs: 1.6, sm: 1.8 },
                      py: 1.35,
                      borderRadius: 2,
                      bgcolor: tokens.content.elevated,
                      border: `1px solid ${tokens.content.border}`,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      sx={{
                        pt: 0.15,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: tokens.action.info,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Typography>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: tokens.content.foreground, minWidth: 0, overflowWrap: 'anywhere' }}>
                      {foco.texto}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

function Seccion({ titulo }: { titulo: string }) {
  const tokens = useTheme().emphasys;
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.muted }}>
      {titulo}
    </Typography>
  );
}

function IndicadorCard({ tarjeta }: { tarjeta: Tarjeta }) {
  const tokens = useTheme().emphasys;
  const noDisponible = tarjeta.value === 'No disponible';
  const Icono = tarjeta.tono === 'up'
    ? TrendingUpIcon
    : tarjeta.tono === 'down'
      ? TrendingDownIcon
      : tarjeta.tono === 'flat'
        ? TrendingFlatIcon
        : null;
  const tintaCifra = noDisponible
    ? tokens.content.muted
    : tarjeta.tono === 'up'
      ? tokens.metric.applied.foreground
      : tokens.content.foreground;

  return (
    <Box
      sx={{
        minWidth: 0,
        bgcolor: noDisponible ? tokens.content.elevated : tokens.metric.amount.background,
        borderRadius: 2,
        px: 1.6,
        py: 1.15,
      }}
    >
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>
        {tarjeta.label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 0.35, minWidth: 0 }}>
        {Icono && (
          <Icono sx={{ fontSize: 16, flexShrink: 0, color: tintaCifra }} />
        )}
        <Typography
          variant="figure"
          sx={{
            fontSize: noDisponible ? 20 : { xs: 22, sm: 26 },
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: tintaCifra,
            overflowWrap: 'anywhere',
          }}
        >
          {tarjeta.value}
        </Typography>
      </Stack>
      <Typography sx={{ mt: 0.35, minHeight: 18, fontSize: 12, lineHeight: 1.35, color: tokens.metric.caption }}>
        {tarjeta.hint ?? ''}
      </Typography>
    </Box>
  );
}
