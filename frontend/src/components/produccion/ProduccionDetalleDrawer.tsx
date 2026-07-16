import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { resolverFolioVisual } from '../../utils/documentos.utils';
import {
  getDetalleOperativoProduccion,
  getSeguimientoProduccionPorDocumento,
  type ProduccionDetalleOperativo,
  type ProduccionPartidaOperativa,
  type SeguimientoProduccionHistorialRow,
} from '../../services/produccionService';

const formatCivilDate = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-MX');
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString('es-MX');
};

const formatProductionDateTime = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
};

function normalizeHexColor(color: string | null | undefined) {
  const raw = String(color ?? '').trim();
  const match = raw.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!match) {
    return null;
  }

  return `#${match[1]!.toUpperCase()}`;
}

function getContrastingTextColor(color: string | null | undefined) {
  const hex = normalizeHexColor(color);
  if (!hex) {
    return '#111827';
  }

  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const transform = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = (0.2126 * transform(red)) + (0.7152 * transform(green)) + (0.0722 * transform(blue));

  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithDark = (luminance + 0.05) / 0.05;

  return contrastWithWhite >= contrastWithDark ? '#ffffff' : '#111827';
}

function formatCantidad(cantidad: number) {
  return Number(cantidad || 0).toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {mensaje}
      </Typography>
    </Box>
  );
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return (
    <Box role="tabpanel" sx={{ pt: 2 }}>
      {children}
    </Box>
  );
}

const TEXTO_LARGO_UMBRAL = 160;

function PartidaOperativaCard({ partida }: { partida: ProduccionPartidaOperativa }) {
  const [imagenConError, setImagenConError] = React.useState(false);
  const [observacionesExpandidas, setObservacionesExpandidas] = React.useState(false);

  const titulo = partida.productoDescripcion || partida.descripcionAlterna || partida.productoClave || `Partida ${partida.numeroPartida}`;
  const observaciones = (partida.observaciones || '').trim();
  const observacionesLargas = observaciones.length > TEXTO_LARGO_UMBRAL || observaciones.includes('\n');
  const mostrarImagen = Boolean(partida.imagenUrl) && !imagenConError;

  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        {mostrarImagen ? (
          <Box
            component="a"
            href={partida.imagenUrl!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver imagen completa de ${titulo} en una pestaña nueva`}
            sx={{
              position: 'relative',
              flexShrink: 0,
              width: 64,
              height: 64,
              borderRadius: 1.5,
              overflow: 'hidden',
              border: '1px solid #e5e7eb',
              display: 'block',
              '&:hover': { opacity: 0.85 },
            }}
          >
            <Box
              component="img"
              src={partida.imagenUrl!}
              alt={titulo}
              onError={() => setImagenConError(true)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 11, color: '#fff' }} />
            </Box>
          </Box>
        ) : null}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} useFlexGap flexWrap="wrap">
            <Typography variant="body2" fontWeight={700} sx={{ color: '#111827' }}>
              #{partida.numeroPartida} · {titulo}
            </Typography>
            <Chip
              size="small"
              label={`${formatCantidad(partida.cantidad)} ${partida.unidad || ''}`.trim()}
              sx={{ fontWeight: 600 }}
            />
          </Stack>

          {partida.productoClave && partida.productoDescripcion ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Clave: {partida.productoClave}
            </Typography>
          ) : null}

          {observaciones ? (
            <>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: '#374151',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ...(observacionesLargas && !observacionesExpandidas
                    ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                    : {}),
                }}
              >
                {observaciones}
              </Typography>
              {observacionesLargas ? (
                <Button
                  size="small"
                  onClick={() => setObservacionesExpandidas((prev) => !prev)}
                  sx={{ minWidth: 0, px: 0, py: 0.5, mt: 0.25, textTransform: 'none', fontSize: 12, fontWeight: 600 }}
                >
                  {observacionesExpandidas ? 'Ver menos' : 'Ver más'}
                </Button>
              ) : null}
            </>
          ) : null}

          {partida.camposConfigurables.length > 0 ? (
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 0.75 }}>
              {partida.camposConfigurables.map((campo) => (
                <Box
                  key={campo.campoId}
                  sx={{
                    ml: campo.campoPadreId ? 1.5 : 0,
                    backgroundColor: '#f1f5f9',
                    borderRadius: 1,
                    px: 0.75,
                    py: 0.25,
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#374151' }}>
                    {campo.campoPadreId ? '↳ ' : ''}
                    {campo.nombre}: <strong>{campo.valor}</strong>
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}

function ObservacionesCotizacion({ observaciones }: { observaciones: string | null }) {
  const [expandido, setExpandido] = React.useState(false);
  const texto = (observaciones || '').trim();
  if (!texto) return null;

  const esLargo = texto.length > TEXTO_LARGO_UMBRAL || texto.includes('\n');

  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#f8fafc', p: 1.5 }}>
      <Typography variant="subtitle2" fontWeight={700} color="#1d2f68" sx={{ mb: 0.5 }}>
        Observaciones de la cotización
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: '#374151',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          ...(esLargo && !expandido
            ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
            : {}),
        }}
      >
        {texto}
      </Typography>
      {esLargo ? (
        <Button
          size="small"
          onClick={() => setExpandido((prev) => !prev)}
          sx={{ minWidth: 0, px: 0, py: 0.5, mt: 0.25, textTransform: 'none', fontSize: 12, fontWeight: 600 }}
        >
          {expandido ? 'Ver menos' : 'Ver más'}
        </Button>
      ) : null}
    </Box>
  );
}

function PartidasOperativasList({
  partidas,
  observacionesCotizacion,
}: {
  partidas: ProduccionPartidaOperativa[];
  observacionesCotizacion: string | null;
}) {
  return (
    <Stack spacing={1.5}>
      {partidas.length === 0 ? (
        <EmptyState mensaje="Esta cotización no tiene partidas." />
      ) : (
        partidas.map((partida) => <PartidaOperativaCard key={partida.id} partida={partida} />)
      )}
      <ObservacionesCotizacion observaciones={observacionesCotizacion} />
    </Stack>
  );
}

function HistorialAvancesList({ historial }: { historial: SeguimientoProduccionHistorialRow[] }) {
  const [expandidos, setExpandidos] = React.useState<Record<number, boolean>>({});

  if (!historial.length) {
    return <EmptyState mensaje="Todavía no hay avances registrados." />;
  }

  return (
    <Stack spacing={0}>
      {historial.map((avance, index) => {
        const backgroundColor = normalizeHexColor(avance.etapa_color) || '#e5e7eb';
        const textColor = getContrastingTextColor(avance.etapa_color);
        const esUltimo = index === historial.length - 1;
        const comentario = (avance.comentarios || '').trim() || 'Sin comentario';
        const comentarioLargo = comentario.length > TEXTO_LARGO_UMBRAL || comentario.includes('\n');
        const comentarioExpandido = Boolean(expandidos[avance.id]);

        return (
          <Stack key={avance.id} direction="row" spacing={1.5}>
            <Stack alignItems="center" sx={{ width: 14, flexShrink: 0, pt: 0.6 }}>
              <Box
                sx={{
                  width: avance.activo ? 12 : 9,
                  height: avance.activo ? 12 : 9,
                  borderRadius: '50%',
                  backgroundColor,
                  boxShadow: avance.activo ? '0 0 0 2px #16a34a' : '0 0 0 1px #cbd5e1',
                  flexShrink: 0,
                }}
              />
              {!esUltimo ? (
                <Box sx={{ width: 2, flexGrow: 1, minHeight: 28, backgroundColor: '#e2e8f0', mt: 0.5 }} />
              ) : null}
            </Stack>

            <Box sx={{ flex: 1, minWidth: 0, pb: esUltimo ? 0.5 : 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} useFlexGap flexWrap="wrap">
                <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    label={avance.etapa_nombre || 'Sin etapa'}
                    sx={{
                      fontWeight: 700,
                      backgroundColor,
                      color: textColor,
                      '& .MuiChip-label': { color: textColor },
                    }}
                  />
                  {avance.activo ? (
                    <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700 }}>
                      Actual
                    </Typography>
                  ) : null}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatProductionDateTime(avance.created_at)}
                </Typography>
              </Stack>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color: '#111827',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ...(comentarioLargo && !comentarioExpandido
                    ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                    : {}),
                }}
              >
                {comentario}
              </Typography>

              {comentarioLargo ? (
                <Button
                  size="small"
                  onClick={() => setExpandidos((prev) => ({ ...prev, [avance.id]: !prev[avance.id] }))}
                  sx={{ minWidth: 0, px: 0, py: 0.5, mt: 0.25, textTransform: 'none', fontSize: 12, fontWeight: 600 }}
                >
                  {comentarioExpandido ? 'Ver menos' : 'Ver más'}
                </Button>
              ) : null}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {avance.usuario_nombre ? `${avance.usuario_nombre} · ` : ''}
                Compromiso: {formatCivilDate(avance.fecha_promesa)}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}

type ProduccionDetalleDrawerProps = {
  open: boolean;
  documentoId: number | null;
  onClose: () => void;
};

export default function ProduccionDetalleDrawer({ open, documentoId, onClose }: ProduccionDetalleDrawerProps) {
  const [tab, setTab] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detalle, setDetalle] = React.useState<ProduccionDetalleOperativo | null>(null);
  const [historial, setHistorial] = React.useState<SeguimientoProduccionHistorialRow[]>([]);

  React.useEffect(() => {
    if (!open || !documentoId) {
      setDetalle(null);
      setHistorial([]);
      setError(null);
      setTab(0);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);

    Promise.all([getDetalleOperativoProduccion(documentoId), getSeguimientoProduccionPorDocumento(documentoId)])
      .then(([detalleData, historialData]) => {
        if (cancelado) return;
        setDetalle(detalleData);
        setHistorial(historialData);
      })
      .catch((err: any) => {
        if (cancelado) return;
        setError(err?.message || 'No se pudo cargar el detalle de producción');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open, documentoId]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480, md: 600 }, maxWidth: '100%' } }}
    >
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: '#6b7280', letterSpacing: 0.8 }}>
              Producción
            </Typography>
            <Typography variant="h6" fontWeight={700} color="#1d2f68" noWrap>
              {detalle?.contacto?.nombre || 'Sin cliente'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {detalle
                ? `Cotización ${resolverFolioVisual(detalle.documento, detalle.documento.tipoDocumento) || String(detalle.documento.id)} · ${formatCivilDate(detalle.documento.fechaDocumento)}`
                : 'Detalle operativo del trabajo'}
            </Typography>
            {detalle?.contacto && (detalle.contacto.nombreContacto || detalle.contacto.telefono || detalle.contacto.email) ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {[detalle.contacto.nombreContacto, detalle.contacto.telefono, detalle.contacto.email].filter(Boolean).join(' · ')}
              </Typography>
            ) : null}
          </Box>
          <IconButton onClick={onClose} aria-label="Cerrar detalle de producción">
            <CloseIcon />
          </IconButton>
        </Stack>

        {loading ? (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Cargando detalle...
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        ) : detalle ? (
          <>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              useFlexGap
              flexWrap="wrap"
              sx={{ border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#f8fafc', p: 1.5 }}
            >
              <Chip
                size="small"
                label={detalle.etapaActual?.nombre || 'Sin etapa'}
                sx={{
                  fontWeight: 700,
                  backgroundColor: normalizeHexColor(detalle.etapaActual?.color) || '#e5e7eb',
                  color: getContrastingTextColor(detalle.etapaActual?.color),
                  '& .MuiChip-label': { color: getContrastingTextColor(detalle.etapaActual?.color) },
                }}
              />
              <Typography variant="body2" color="text.secondary">
                Compromiso: {formatCivilDate(detalle.fechaPromesa)}
              </Typography>
            </Stack>

            <Tabs
              value={tab}
              onChange={(_e, value) => setTab(value)}
              variant="fullWidth"
              sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 36 }}
            >
              <Tab label={`Avances en Producción (${historial.length})`} sx={{ minHeight: 36, textTransform: 'none' }} />
              <Tab label={`Partidas (${detalle.partidas.length})`} sx={{ minHeight: 36, textTransform: 'none' }} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <HistorialAvancesList historial={historial} />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              <PartidasOperativasList partidas={detalle.partidas} observacionesCotizacion={detalle.documento.observaciones} />
            </TabPanel>
          </>
        ) : null}
      </Box>
    </Drawer>
  );
}
