import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { TipoDocumento } from '../../types/documentos.types';
import { apiFetch } from '../../services/apiFetch';
import type { WhatsappPlantillaOption } from '../../services/whatsappPlantillasService';
import { fetchWhatsappPlantillas } from '../../services/whatsappPlantillasService';

type DocumentoWhatsappResumen = {
  id: number;
  tipoDocumento: TipoDocumento;
  tipoDocumentoLabel: string;
  folio: string;
  cliente: string;
  total?: number | null;
};

type DocumentoWhatsappDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  documento: DocumentoWhatsappResumen | null;
  telefonoInicial: string;
  plantillaDefaultId: number | null;
};

export function DocumentoWhatsappDialog({
  open,
  onClose,
  title = 'Enviar por WhatsApp',
  documento,
  telefonoInicial,
  plantillaDefaultId,
}: DocumentoWhatsappDialogProps) {
  const [telefono, setTelefono] = useState('');
  const [plantillas, setPlantillas] = useState<WhatsappPlantillaOption[]>([]);
  const [plantillaId, setPlantillaId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;

    setTelefono(telefonoInicial ?? '');
    setPlantillaId(plantillaDefaultId ?? null);
    setResultadoEnvio(null);

    console.info('[CFDI WhatsApp] Modal abierto', {
      documentoId: documento?.id ?? null,
      tipoDocumento: documento?.tipoDocumento ?? null,
      folio: documento?.folio ?? null,
      telefonoDetectado: telefonoInicial ?? '',
      plantillaDefaultId: plantillaDefaultId ?? null,
    });
  }, [open, telefonoInicial, plantillaDefaultId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadPlantillas = async () => {
      try {
        const data = await fetchWhatsappPlantillas();
        if (cancelled) return;

        const activas = data.filter((plantilla) => plantilla.activa);
        console.info('[CFDI WhatsApp] Plantillas activas cargadas', {
          documentoId: documento?.id ?? null,
          totalPlantillas: activas.length,
          plantillaDefaultId: plantillaDefaultId ?? null,
        });
        setPlantillas(activas);
        setPlantillaId((current) => {
          if (current != null && activas.some((plantilla) => plantilla.id === current)) {
            return current;
          }
          if (plantillaDefaultId != null && activas.some((plantilla) => plantilla.id === plantillaDefaultId)) {
            return plantillaDefaultId;
          }
          return activas[0]?.id ?? null;
        });
      } catch (error) {
        if (!cancelled) {
          setPlantillas([]);
          console.error('[CFDI WhatsApp] Error cargando plantillas activas', {
            documentoId: documento?.id ?? null,
            error,
          });
        }
      }
    };

    void loadPlantillas();

    return () => {
      cancelled = true;
    };
  }, [open, plantillaDefaultId]);

  const plantillaSeleccionada = useMemo(
    () => plantillas.find((plantilla) => plantilla.id === plantillaId) ?? null,
    [plantillaId, plantillas]
  );

  const totalFormateado = useMemo(() => {
    if (documento?.total == null) return null;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(documento.total));
  }, [documento?.total]);

  const telefonoVacio = telefono.trim().length === 0;

  const handleEnviar = async () => {
    const telefonoFinal = telefono.trim();
    const esFacturaCfdi = documento?.tipoDocumento === 'factura';
    const esCotizacion = documento?.tipoDocumento === 'cotizacion';

    if (!telefonoFinal) {
      const message = 'Captura un teléfono para continuar.';
      setResultadoEnvio({ severity: 'error', message });
      console.warn('[CFDI WhatsApp] Envio cancelado por telefono vacio', {
        documentoId: documento?.id ?? null,
      });
      return;
    }

    if (!plantillaSeleccionada?.tipo) {
      const message = 'No hay una plantilla de WhatsApp disponible para este documento.';
      setResultadoEnvio({ severity: 'error', message });
      console.warn('[CFDI WhatsApp] Envio cancelado por plantilla no resuelta', {
        documentoId: documento?.id ?? null,
        plantillaId,
      });
      return;
    }

    const payload = esFacturaCfdi
      ? {
          telefono: telefonoFinal,
          tipoPlantilla: plantillaSeleccionada.tipo,
        }
      : esCotizacion
        ? {
            telefono: telefonoFinal,
          }
        : {
            telefono: telefonoFinal,
            tipo: plantillaSeleccionada.tipo,
          };

    const endpoint = esFacturaCfdi && documento?.id
      ? `/api/facturas/${documento.id}/enviar-whatsapp-cfdi`
      : esCotizacion && documento?.id
        ? `/api/documentos/${documento.id}/enviar-whatsapp-cotizacion`
        : '/api/whatsapp/enviar-plantilla';

    console.info('[CFDI WhatsApp] Request envio WhatsApp documento', {
      documentoId: documento?.id ?? null,
      tipoDocumento: documento?.tipoDocumento ?? null,
      folio: documento?.folio ?? null,
      endpoint,
      payload,
      plantilla: {
        id: plantillaSeleccionada.id,
        tipo: plantillaSeleccionada.tipo,
        nombre_interno: plantillaSeleccionada.nombre_interno,
      },
    });

    try {
      setEnviando(true);
      setResultadoEnvio(null);

      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: payload,
      });

      console.info('[CFDI WhatsApp] Response envio WhatsApp documento', {
        documentoId: documento?.id ?? null,
        response,
      });

      setResultadoEnvio({
        severity: 'success',
        message: esFacturaCfdi
          ? 'Template, PDF y XML enviados correctamente por WhatsApp.'
          : esCotizacion
            ? 'Cotización enviada correctamente por WhatsApp.'
            : 'Plantilla enviada correctamente por WhatsApp.',
      });
    } catch (error: any) {
      const message = error?.message || (esFacturaCfdi
        ? 'No se pudo enviar el CFDI por WhatsApp.'
        : esCotizacion
          ? 'No se pudo enviar la cotización por WhatsApp.'
          : 'No se pudo enviar la plantilla por WhatsApp.');
      console.error('[CFDI WhatsApp] Error envio WhatsApp documento', {
        documentoId: documento?.id ?? null,
        endpoint,
        payload,
        error,
      });
      setResultadoEnvio({ severity: 'error', message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {resultadoEnvio && (
            <Alert severity={resultadoEnvio.severity}>{resultadoEnvio.message}</Alert>
          )}

          <Paper variant="outlined" sx={{ borderColor: '#e5e7eb', borderRadius: 2, p: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" sx={{ color: '#1d2f68', fontWeight: 700 }}>
                Documento
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Tipo de documento</Typography>
                  <Typography variant="body2" fontWeight={600}>{documento?.tipoDocumentoLabel || '—'}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Folio</Typography>
                  <Typography variant="body2" fontWeight={600}>{documento?.folio || '—'}</Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Cliente</Typography>
                  <Typography variant="body2" fontWeight={600}>{documento?.cliente || '—'}</Typography>
                </Box>
                {totalFormateado && (
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="body2" fontWeight={600}>{totalFormateado}</Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          </Paper>

          <TextField
            fullWidth
            label="Teléfono"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            placeholder="Ingresa el teléfono destino"
            error={telefonoVacio}
            helperText={telefonoVacio ? 'No se detectó un teléfono. Captura uno para continuar.' : ' '}
          />

          <Paper sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 2, boxShadow: 'none' }}>
            <Typography variant="body2" color="text.secondary">
              {documento?.tipoDocumento === 'factura'
                ? 'Se enviarán la plantilla, el PDF y el XML timbrado por WhatsApp.'
                : 'Se enviará la plantilla configurada por WhatsApp.'}
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={enviando}>Cancelar</Button>
        <Button variant="contained" onClick={() => void handleEnviar()} disabled={enviando}>
          {enviando ? (
            <>
              <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
              Enviando...
            </>
          ) : (
            'Enviar por WhatsApp'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}