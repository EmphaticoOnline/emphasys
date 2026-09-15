import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress,
  Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
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

function Resumen({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 180px', borderRadius: 2 }}>
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={700} sx={{ color }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function ConversionCotizacionesPage() {
  const navigate = useNavigate();
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')}>
          Informes
        </Button>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <PointOfSaleIcon sx={{ color: '#006261' }} />
        <Typography variant="h5" fontWeight={700}>Conversión de Cotizaciones a Ventas</Typography>
      </Stack>
      <Typography color="text.secondary" mb={2.5}>Cotizaciones que se convierten efectivamente en factura.</Typography>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField label="Fecha desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <TextField label="Fecha hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
          <Autocomplete
            options={vendedores}
            value={vendedor}
            onChange={(_, value) => setVendedor(value)}
            getOptionLabel={(option) => option.nombre}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Vendedor" size="small" />}
            sx={{ minWidth: 240 }}
          />
          <Button variant="contained" onClick={consultar} disabled={loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Consultar'}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {resultado && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2}>
            <Resumen label="Cotizaciones" value={String(resultado.cotizaciones)} color="#006261" />
            <Resumen label="Convertidas" value={String(resultado.convertidas)} color="#15803d" />
            <Resumen label="No convertidas" value={String(resultado.no_convertidas)} color="#b45309" />
            <Resumen label="% Conversión" value={porcentaje(resultado.porcentaje_conversion)} color="#1d4ed8" />
          </Stack>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Vendedor</TableCell><TableCell align="right">Cotizaciones</TableCell>
                <TableCell align="right">Convertidas</TableCell><TableCell align="right">No convertidas</TableCell>
                <TableCell align="right">% Conversión</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {resultado.vendedores.map((row) => <TableRow key={row.vendedor_id ?? 'sin-vendedor'}>
                  <TableCell>{row.vendedor}</TableCell><TableCell align="right">{row.cotizaciones}</TableCell>
                  <TableCell align="right">{row.convertidas}</TableCell><TableCell align="right">{row.no_convertidas}</TableCell>
                  <TableCell align="right">{porcentaje(row.porcentaje_conversion)}</TableCell>
                </TableRow>)}
                {!vendedor && <TableRow sx={{ '& td': { fontWeight: 700 } }}>
                  <TableCell>TOTAL</TableCell><TableCell align="right">{resultado.cotizaciones}</TableCell>
                  <TableCell align="right">{resultado.convertidas}</TableCell><TableCell align="right">{resultado.no_convertidas}</TableCell>
                  <TableCell align="right">{porcentaje(resultado.porcentaje_conversion)}</TableCell>
                </TableRow>}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
