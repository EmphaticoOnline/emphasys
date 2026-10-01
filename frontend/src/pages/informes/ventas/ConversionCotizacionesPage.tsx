import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, LinearProgress,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { fetchVendedores } from '../../../services/contactosService';
import type { Contacto } from '../../../types/contactos.types';
import {
  fetchConversionCotizaciones,
  type ConversionCotizacionesResult,
} from '../../../services/reportesService';

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => `${hoy().slice(0, 8)}01`;
const porcentaje = (value: number) => `${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`;

export default function ConversionCotizacionesPage() {
  const navigate = useNavigate();
  const tokens = useTheme().emphasys;
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [vendedor, setVendedor] = useState<Contacto | null>(null);
  const [resultado, setResultado] = useState<ConversionCotizacionesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVendedores().then(setVendedores).catch(() => setVendedores([]));
  }, []);

  const consultar = async () => {
    setLoading(true);
    setError(null);
    try {
      setResultado(await fetchConversionCotizaciones({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        vendedor_id: vendedor?.id ?? null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const campoSx: SxProps<Theme> = {
    '& .MuiOutlinedInput-root': {
      bgcolor: tokens.content.well,
      borderRadius: 2,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.muted },
      '&.Mui-focused fieldset': { borderColor: tokens.action.info },
    },
    '& .MuiInputLabel-root': { color: tokens.content.muted },
    '& .MuiInputBase-input': { color: tokens.content.foreground },
  };

  const kpis: Array<[string, string]> = resultado ? [
    ['Cotizaciones', String(resultado.cotizaciones)],
    ['Convertidas', String(resultado.convertidas)],
    ['No convertidas', String(resultado.no_convertidas)],
    ['% Conversión', porcentaje(resultado.porcentaje_conversion)],
  ] : [];

  return (
    <Stack spacing={1.5} sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <Box
          component="button"
          type="button"
          onClick={() => navigate('/informes')}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted, flexShrink: 0 }}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          INFORMES
        </Box>
        <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted, minWidth: 0 }}>
          VENTAS
        </Typography>
        <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 11, letterSpacing: '0.14em', color: tokens.content.foreground, minWidth: 0 }}>
          CONVERSIÓN DE COTIZACIONES A VENTAS
        </Typography>
      </Stack>

      <Box>
        <Typography variant="figure" sx={{ fontSize: { xs: 26, sm: 30 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
          Conversión de Cotizaciones a Ventas
        </Typography>
        <Typography sx={{ mt: 0.6, fontSize: 13, lineHeight: 1.45, color: tokens.content.muted, maxWidth: 640 }}>
          Cotizaciones que se convierten efectivamente en factura.
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.elevated, overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: tokens.metric.track, '& .MuiLinearProgress-bar': { bgcolor: tokens.action.info } }} />}
        <TextField label="Fecha desde" type="date" size="small" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 158 }, ...campoSx }} />
        <TextField label="Fecha hasta" type="date" size="small" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 158 }, ...campoSx }} />
        <Autocomplete
          options={vendedores}
          value={vendedor}
          onChange={(_, value) => setVendedor(value)}
          getOptionLabel={(option) => option.nombre}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} label="Vendedor" size="small" />}
          sx={{ width: { xs: '100%', sm: 240 }, ...campoSx }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={consultar}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 650, borderRadius: 2, boxShadow: 'none', px: 1.75, minHeight: 40, width: { xs: '100%', sm: 'auto' } }}
        >
          {loading ? <CircularProgress size={16} color="inherit" /> : 'Consultar'}
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {resultado && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 0.8 }}>
            {kpis.map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0, bgcolor: tokens.metric.amount.background, borderRadius: 2, px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{label}</Typography>
                <Typography variant="figure" sx={{ mt: 0.15, fontSize: { xs: 20, sm: 24 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ width: '100%', maxWidth: 960, borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well, overflow: 'auto' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: tokens.table.headerBg, '& th': { color: tokens.table.headerFg, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${tokens.table.line}`, py: 1, whiteSpace: 'nowrap' } }}>
                  <TableCell>Vendedor</TableCell>
                  <TableCell align="right">Cotizaciones</TableCell>
                  <TableCell align="right">Convertidas</TableCell>
                  <TableCell align="right">No convertidas</TableCell>
                  <TableCell align="right">% Conversión</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resultado.vendedores.map((row) => (
                  <TableRow key={row.vendedor_id ?? 'sin-vendedor'} sx={{ '& td': { borderBottom: `1px solid ${tokens.table.line}`, color: tokens.table.cell, fontSize: 13, fontVariantNumeric: 'tabular-nums', py: 0.75 }, '&:hover': { bgcolor: tokens.content.hover } }}>
                    <TableCell sx={{ color: tokens.content.foreground, fontWeight: 600 }}>{row.vendedor}</TableCell>
                    <TableCell align="right">{row.cotizaciones}</TableCell>
                    <TableCell align="right">{row.convertidas}</TableCell>
                    <TableCell align="right">{row.no_convertidas}</TableCell>
                    <TableCell align="right">{porcentaje(row.porcentaje_conversion)}</TableCell>
                  </TableRow>
                ))}
                {!vendedor && (
                  <TableRow sx={{ bgcolor: tokens.metric.amount.background, '& td': { borderBottom: 0, color: tokens.content.foreground, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', py: 1 } }}>
                    <TableCell>TOTAL</TableCell>
                    <TableCell align="right">{resultado.cotizaciones}</TableCell>
                    <TableCell align="right">{resultado.convertidas}</TableCell>
                    <TableCell align="right">{resultado.no_convertidas}</TableCell>
                    <TableCell align="right">{porcentaje(resultado.porcentaje_conversion)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </>
      )}
    </Stack>
  );
}
