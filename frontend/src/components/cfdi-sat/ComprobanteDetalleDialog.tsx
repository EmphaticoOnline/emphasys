import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  descargarXmlComprobante,
  fetchCfdiSatComprobanteDetalle,
  type CfdiSatComprobanteDetalle,
} from '../../services/cfdiSatService';
import { ESTADO_IMPORTACION_INFO, POSIBLE_DUPLICADO_LABEL } from './estadoImportacion';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-MX');
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="#6b7280">
        {label}
      </Typography>
      <Typography variant="body2" color="#1f2937">
        {value}
      </Typography>
    </Stack>
  );
}

export default function ComprobanteDetalleDialog({
  comprobanteId,
  onClose,
}: {
  comprobanteId: number | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [detalle, setDetalle] = React.useState<CfdiSatComprobanteDetalle | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [descargando, setDescargando] = React.useState(false);

  React.useEffect(() => {
    if (!comprobanteId) {
      setDetalle(null);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);

    fetchCfdiSatComprobanteDetalle(comprobanteId)
      .then((data) => {
        if (!cancelado) setDetalle(data);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [comprobanteId]);

  const handleDescargarXml = async () => {
    if (!comprobanteId) return;
    setDescargando(true);
    try {
      await descargarXmlComprobante(comprobanteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el XML');
    } finally {
      setDescargando(false);
    }
  };

  const comprobante = detalle?.comprobante;

  return (
    <Dialog open={Boolean(comprobanteId)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Detalle del comprobante</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : comprobante ? (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {comprobante.uuid}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={comprobante.tipo_descarga.toUpperCase()}
                  size="small"
                  color={comprobante.tipo_descarga === 'recibidos' ? 'info' : 'default'}
                />
                {comprobante.estatus_sat && (
                  <Chip
                    label={comprobante.estatus_sat.toUpperCase()}
                    size="small"
                    color={comprobante.estatus_sat === 'cancelado' ? 'error' : 'success'}
                  />
                )}
              </Stack>
            </Stack>

            <Divider />

            <Stack direction="row" flexWrap="wrap" gap={2}>
              <Campo label="Fecha de emisión" value={formatFecha(comprobante.fecha_emision)} />
              <Campo label="Tipo de comprobante" value={comprobante.tipo_comprobante ?? '—'} />
              <Campo
                label="Total"
                value={
                  comprobante.total != null
                    ? `${Number(comprobante.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${comprobante.moneda ?? ''}`
                    : '—'
                }
              />
            </Stack>

            <Divider />

            <Campo
              label="Emisor"
              value={`${comprobante.rfc_emisor}${comprobante.nombre_emisor ? ` — ${comprobante.nombre_emisor}` : ''}`}
            />
            <Campo
              label="Receptor"
              value={`${comprobante.rfc_receptor}${comprobante.nombre_receptor ? ` — ${comprobante.nombre_receptor}` : ''}`}
            />

            <Divider />

            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="#6b7280">
                  Estado operativo de importación
                </Typography>
                {detalle?.evaluacion && (
                  <Chip
                    label={ESTADO_IMPORTACION_INFO[detalle.evaluacion.estado_importacion_operativo].label}
                    size="small"
                    color={ESTADO_IMPORTACION_INFO[detalle.evaluacion.estado_importacion_operativo].color}
                  />
                )}
                {detalle?.evaluacion?.posible_documento_existente && (
                  <Chip label={POSIBLE_DUPLICADO_LABEL} size="small" variant="outlined" color="warning" />
                )}
              </Stack>

              {detalle?.evaluacion && (
                <Typography variant="body2" color="#1f2937">
                  {detalle.evaluacion.mensaje}
                </Typography>
              )}

              {detalle?.evaluacion?.proveedor_nombre && (
                <Typography variant="body2" color="#4b5563">
                  Proveedor detectado: {detalle.evaluacion.proveedor_nombre} (#{detalle.evaluacion.proveedor_id})
                </Typography>
              )}

              {detalle?.evaluacion?.documento_id && (
                <Typography variant="body2" color="#4b5563">
                  Documento relacionado: #{detalle.evaluacion.documento_id}
                </Typography>
              )}

              {detalle?.evaluacion?.posible_documento_existente && (
                <Typography variant="body2" color="#92400e">
                  Posible duplicado (documento #{detalle.evaluacion.posible_documento_existente.documento_id},
                  confianza {detalle.evaluacion.posible_documento_existente.confianza}):{' '}
                  {detalle.evaluacion.posible_documento_existente.motivo}
                </Typography>
              )}
            </Stack>

            <Divider />

            <Stack direction="row" flexWrap="wrap" gap={2}>
              <Campo
                label="Solicitud origen"
                value={
                  detalle?.solicitud
                    ? `#${detalle.solicitud.id} (${detalle.solicitud.tipo_descarga}, ${detalle.solicitud.fecha_inicio} a ${detalle.solicitud.fecha_fin})`
                    : '—'
                }
              />
              <Campo label="Paquete origen" value={detalle?.paquete ? detalle.paquete.sat_package_id : '—'} />
            </Stack>

            <Divider />

            <Stack direction="row" flexWrap="wrap" gap={2}>
              <Campo label="XML disponible" value={comprobante.tiene_xml ? 'Sí' : 'No'} />
              <Campo label="Importado a compras" value={comprobante.importado_compras ? 'Sí' : 'No'} />
              <Campo label="Documento de compra" value={comprobante.documento_id ?? '—'} />
            </Stack>
          </>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Cerrar
        </Button>
        <Button
          variant="outlined"
          disabled={!comprobante?.tiene_xml || descargando}
          onClick={() => void handleDescargarXml()}
          sx={{ textTransform: 'none' }}
        >
          {descargando ? 'Descargando...' : 'Descargar XML'}
        </Button>
        {(() => {
          const documentoObjetivo = comprobante?.documento_id ?? detalle?.evaluacion?.documento_id ?? null;
          if (!documentoObjetivo) return null;
          return (
            <Button
              variant="contained"
              onClick={() => navigate(`/compras/factura_compra/${documentoObjetivo}`)}
              sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
            >
              Ver factura
            </Button>
          );
        })()}
      </DialogActions>
    </Dialog>
  );
}
