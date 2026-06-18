import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Drawer, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import { CloseRounded, CheckCircleOutlineRounded, CancelOutlined, OpenInNewRounded } from '@mui/icons-material';
import {
  getBandeja, getMisSolicitudes, responderSolicitud, cancelarSolicitud,
  type AutorizacionSolicitud, type EstadoSolicitud,
} from '../services/autorizacionesService';

const ESTADO_CHIP: Record<EstadoSolicitud, { label: string; bgcolor: string; color: string }> = {
  pendiente: { label: 'Pendiente', bgcolor: '#fef3c7', color: '#92400e' },
  aprobada:  { label: 'Aprobada',  bgcolor: '#dcfce7', color: '#166534' },
  rechazada: { label: 'Rechazada', bgcolor: '#fee2e2', color: '#991b1b' },
  cancelada: { label: 'Cancelada', bgcolor: '#f3f4f6', color: '#6b7280' },
};

function EstadoChip({ estado }: { estado: EstadoSolicitud }) {
  const cfg = ESTADO_CHIP[estado] ?? ESTADO_CHIP.cancelada;
  return <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bgcolor, color: cfg.color, fontWeight: 600, fontSize: 11 }} />;
}

function fmtMonto(v: string) {
  return Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

function fmtFecha(v: string) {
  return new Date(v).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AutorizacionesBandejaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState(0);
  const [bandeja, setBandeja] = React.useState<AutorizacionSolicitud[]>([]);
  const [misSolicitudes, setMisSolicitudes] = React.useState<AutorizacionSolicitud[]>([]);
  const [filtroEstado, setFiltroEstado] = React.useState<string>('todas');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Drawer de respuesta
  const [drawerSol, setDrawerSol] = React.useState<AutorizacionSolicitud | null>(null);
  const [comentario, setComentario] = React.useState('');
  const [respondiendo, setRespondiendo] = React.useState(false);
  const [respuestaError, setRespuestaError] = React.useState<string | null>(null);

  const cargarBandeja = React.useCallback(() => {
    return getBandeja().then(setBandeja);
  }, []);

  const cargarMis = React.useCallback((estado: string) => {
    return getMisSolicitudes(estado === 'todas' ? undefined : estado).then(setMisSolicitudes);
  }, []);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([cargarBandeja(), cargarMis(filtroEstado)])
      .catch(() => setError('Error al cargar solicitudes'))
      .finally(() => setLoading(false));
  }, [cargarBandeja, cargarMis, filtroEstado]);

  async function responder(decision: 'aprobada' | 'rechazada') {
    if (!drawerSol) return;
    setRespondiendo(true);
    setRespuestaError(null);
    try {
      await responderSolicitud(drawerSol.id, decision, comentario || null);
      setDrawerSol(null);
      setComentario('');
      await Promise.all([cargarBandeja(), cargarMis(filtroEstado)]);
    } catch (e: any) {
      setRespuestaError(e.message ?? 'Error al responder');
    } finally {
      setRespondiendo(false);
    }
  }

  async function cancelar(id: number) {
    try {
      await cancelarSolicitud(id);
      await cargarMis(filtroEstado);
    } catch (e: any) {
      setError(e.message ?? 'Error al cancelar');
    }
  }

  const columnasBandeja = (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: '#f8fafc' }}>
          <TableCell>Documento</TableCell>
          <TableCell>Transición</TableCell>
          <TableCell>Monto</TableCell>
          <TableCell>Solicitante</TableCell>
          <TableCell>Fecha</TableCell>
          <TableCell>Estado</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {bandeja.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#9ca3af' }}>
              No hay solicitudes pendientes de autorizar
            </TableCell>
          </TableRow>
        )}
        {bandeja.map((s) => (
          <TableRow key={s.id} hover sx={{ cursor: 'pointer' }}
            onClick={() => { setDrawerSol(s); setComentario(''); setRespuestaError(null); }}>
            <TableCell>
              <Typography variant="body2" fontWeight={500}>{s.folio_documento_origen ?? `#${s.documento_origen_id}`}</Typography>
              <Typography variant="caption" color="text.secondary">{s.tipo_documento_origen}</Typography>
            </TableCell>
            <TableCell>{s.tipo_documento_origen} → {s.tipo_documento_destino}</TableCell>
            <TableCell>{fmtMonto(s.monto)}</TableCell>
            <TableCell>{s.usuario_solicitante_nombre}</TableCell>
            <TableCell>{fmtFecha(s.created_at)}</TableCell>
            <TableCell><EstadoChip estado={s.estado} /></TableCell>
            <TableCell>
              <Tooltip title="Ver documento">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/documentos/${s.documento_origen_id}`); }}>
                  <OpenInNewRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const columnasMis = (
    <>
      <Box mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Estado</InputLabel>
          <Select label="Estado" value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); cargarMis(e.target.value); }}>
            <MenuItem value="todas">Todas</MenuItem>
            <MenuItem value="pendiente">Pendientes</MenuItem>
            <MenuItem value="aprobada">Aprobadas</MenuItem>
            <MenuItem value="rechazada">Rechazadas</MenuItem>
            <MenuItem value="cancelada">Canceladas</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#f8fafc' }}>
            <TableCell>Documento</TableCell>
            <TableCell>Transición</TableCell>
            <TableCell>Monto</TableCell>
            <TableCell>Fecha</TableCell>
            <TableCell>Autorizador</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Comentario</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {misSolicitudes.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#9ca3af' }}>
                No hay solicitudes
              </TableCell>
            </TableRow>
          )}
          {misSolicitudes.map((s) => (
            <TableRow key={s.id} hover>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" fontWeight={500}>
                    {s.folio_documento_origen ?? `#${s.documento_origen_id}`}
                  </Typography>
                  <Tooltip title="Ver documento">
                    <IconButton size="small" onClick={() => navigate(`/documentos/${s.documento_origen_id}`)}>
                      <OpenInNewRounded sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" color="text.secondary">{s.tipo_documento_origen}</Typography>
              </TableCell>
              <TableCell>{s.tipo_documento_origen} → {s.tipo_documento_destino}</TableCell>
              <TableCell>{fmtMonto(s.monto)}</TableCell>
              <TableCell>{fmtFecha(s.created_at)}</TableCell>
              <TableCell>{s.usuario_autorizador_nombre ?? '—'}</TableCell>
              <TableCell><EstadoChip estado={s.estado} /></TableCell>
              <TableCell>
                <Tooltip title={s.comentario_autorizador ?? ''}>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                    {s.comentario_autorizador ?? '—'}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell>
                {s.estado === 'pendiente' && (
                  <Button size="small" color="error" onClick={() => cancelar(s.id)}>Cancelar</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} color="#1d2f68" mb={3}>Autorizaciones</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={`Por autorizar (${bandeja.length})`} />
          <Tab label="Mis solicitudes" />
        </Tabs>
        <Box p={2}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : tab === 0 ? columnasBandeja : columnasMis}
        </Box>
      </Paper>

      {/* Drawer de respuesta (autorizador) */}
      <Drawer anchor="right" open={Boolean(drawerSol)} onClose={() => setDrawerSol(null)}
        PaperProps={{ sx: { width: 400, p: 3 } }}>
        {drawerSol && (
          <Stack spacing={2.5} height="100%">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={600}>Solicitud de autorización</Typography>
              <IconButton onClick={() => setDrawerSol(null)}><CloseRounded /></IconButton>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">Documento</Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body1" fontWeight={600}>
                    {drawerSol.folio_documento_origen ?? `#${drawerSol.documento_origen_id}`}
                  </Typography>
                  <Tooltip title="Ver documento">
                    <IconButton size="small" onClick={() => navigate(`/documentos/${drawerSol.documento_origen_id}`)}>
                      <OpenInNewRounded sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Transición solicitada</Typography>
                <Typography variant="body2">{drawerSol.tipo_documento_origen} → {drawerSol.tipo_documento_destino}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Monto</Typography>
                <Typography variant="body1" fontWeight={600}>{fmtMonto(drawerSol.monto)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Solicitante</Typography>
                <Typography variant="body2">{drawerSol.usuario_solicitante_nombre}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Fecha</Typography>
                <Typography variant="body2">{fmtFecha(drawerSol.created_at)}</Typography>
              </Box>
              {drawerSol.comentario_solicitante && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Comentario del solicitante</Typography>
                  <Typography variant="body2">{drawerSol.comentario_solicitante}</Typography>
                </Box>
              )}
            </Stack>

            <Divider />

            {respuestaError && <Alert severity="error">{respuestaError}</Alert>}

            <TextField
              label="Comentario (opcional)" multiline rows={3} size="small" fullWidth
              value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe un comentario para el solicitante..."
            />

            <Stack direction="row" spacing={1.5} mt="auto">
              <Button fullWidth variant="outlined" color="error" disabled={respondiendo}
                startIcon={<CancelOutlined />} onClick={() => responder('rechazada')}>
                {respondiendo ? <CircularProgress size={18} /> : 'Rechazar'}
              </Button>
              <Button fullWidth variant="contained" color="success" disabled={respondiendo}
                startIcon={<CheckCircleOutlineRounded />} onClick={() => responder('aprobada')}>
                {respondiendo ? <CircularProgress size={18} /> : 'Aprobar'}
              </Button>
            </Stack>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
