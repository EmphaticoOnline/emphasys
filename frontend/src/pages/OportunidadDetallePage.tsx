import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { getCotizacion } from '../services/cotizacionesService';
import { apiFetch } from '../services/apiFetch';
import type { CotizacionPartida } from '../types/cotizacion';

type OportunidadDetalle = {
  id: number;
  folio: string;
  cotizacion_principal_id: number | null;
  contacto_nombre: string | null;
  vendedor_nombre: string | null;
  estatus: string | null;
  comentarios_no_cierre: string;
  monto_oportunidad: number | string | null;
  fecha_cotizacion: string | null;
  fecha_creacion: string | null;
  fecha_estimada_cierre: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCurrency(value: number | string | null) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '$0.00';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

async function fetchOportunidad(id: string) {
  return apiFetch<OportunidadDetalle>(`/api/crm/oportunidades/${id}`);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>{value}</Typography>
    </Stack>
  );
}

export default function OportunidadDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [oportunidad, setOportunidad] = React.useState<OportunidadDetalle | null>(null);
  const [partidas, setPartidas] = React.useState<CotizacionPartida[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;

    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchOportunidad(id);
        const cotizacion = data.cotizacion_principal_id
          ? await getCotizacion(data.cotizacion_principal_id)
          : null;

        if (!mounted) return;

        setOportunidad(data);
        setPartidas(cotizacion?.partidas ?? []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar la oportunidad');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 'md', mx: 'auto' }}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, borderColor: '#dbe3ee' }}>
          <Stack spacing={1.5} alignItems="center" justifyContent="center">
            <CircularProgress size={30} />
            <Typography sx={{ color: '#475569' }}>Cargando oportunidad...</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 'md', mx: 'auto' }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Detalle de oportunidad
            </Typography>
            <Typography sx={{ color: '#475569', mt: 0.35 }}>
              Consulta la cotización relacionada en modo lectura.
            </Typography>
          </Box>
          <Button color="inherit" onClick={() => navigate('/crm/actividades')}>
            Volver
          </Button>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {oportunidad ? (
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#dbe3ee' }}>
              <Stack spacing={2}>
              <DetailRow label="Folio" value={oportunidad.folio || 'Sin folio'} />
              <DetailRow label="Cliente" value={oportunidad.contacto_nombre || 'Sin cliente'} />
              <DetailRow label="Vendedor" value={oportunidad.vendedor_nombre || 'Sin vendedor'} />
              <DetailRow label="Estatus" value={oportunidad.estatus || 'Sin estatus'} />
              <DetailRow label="Monto" value={formatCurrency(oportunidad.monto_oportunidad)} />
              <DetailRow label="Fecha de cotización" value={formatDate(oportunidad.fecha_cotizacion)} />
              <DetailRow label="Fecha estimada de cierre" value={formatDate(oportunidad.fecha_estimada_cierre)} />
              {oportunidad.comentarios_no_cierre ? (
                <DetailRow label="Comentarios" value={oportunidad.comentarios_no_cierre} />
              ) : null}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: '#dbe3ee' }}>
              <Stack spacing={1.5}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  Partidas de la cotización
                </Typography>

                {partidas.length ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="right">Cantidad</TableCell>
                          <TableCell align="right">Precio</TableCell>
                          <TableCell align="right">Importe</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {partidas.map((partida) => (
                          <TableRow key={partida.id} hover>
                            <TableCell>
                              {partida.producto_descripcion || partida.descripcion_alterna || 'Sin producto'}
                            </TableCell>
                            <TableCell align="right">{partida.cantidad}</TableCell>
                            <TableCell align="right">{formatCurrency(partida.precio_unitario)}</TableCell>
                            <TableCell align="right">{formatCurrency(partida.subtotal_partida)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography sx={{ color: '#64748b' }}>
                    Esta cotización no tiene partidas registradas.
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}