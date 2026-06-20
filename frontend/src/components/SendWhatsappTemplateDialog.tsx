import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  fetchWhatsappPlantillas,
  type OrigenParametro,
  type ParametroPlantilla,
  type WhatsappPlantillaOption,
} from '../services/whatsappPlantillasService';
import { apiFetch } from '../services/apiFetch';

export interface ContactoAutoFill {
  nombre?: string | null;
  telefono?: string | null;
  empresa?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  telefono: string;
  contacto?: ContactoAutoFill;
  onSuccess: (plantillaNombre: string) => void;
}

function extractVariableIndices(contenido: string): number[] {
  const matches = contenido.match(/\{\{(\d+)\}\}/g) ?? [];
  const indices = [...new Set(matches.map((m) => Number(m.replace(/\{\{|\}\}/g, ''))))];
  indices.sort((a, b) => a - b);
  return indices.filter((n) => n > 0);
}

function resolveAutoValue(
  origen: OrigenParametro,
  contacto: ContactoAutoFill | undefined,
  telefono: string
): string {
  switch (origen) {
    case 'contacto.nombre': return contacto?.nombre ?? '';
    case 'contacto.telefono': return contacto?.telefono ?? telefono;
    case 'contacto.empresa': return contacto?.empresa ?? '';
    default: return '';
  }
}

function getParamConfig(
  variableIndex: number,
  config: ParametroPlantilla[] | null | undefined
): ParametroPlantilla | null {
  if (!config) return null;
  return config.find((p) => p.variable === variableIndex) ?? null;
}

function isAutoFill(origen: OrigenParametro): boolean {
  return origen !== 'manual';
}

const TIPO_LABELS: Record<string, string> = {
  reactivacion: 'Reactivación',
  seguimiento: 'Seguimiento',
  envio_cotizacion: 'Cotización',
  envio_orden_servicio: 'Orden de servicio',
  envio_cfdi: 'Factura (CFDI)',
  envio_nota_venta: 'Nota de venta',
};

const ORIGEN_LABELS: Record<OrigenParametro, string> = {
  'manual': 'Manual',
  'contacto.nombre': 'Nombre del contacto',
  'contacto.telefono': 'Teléfono del contacto',
  'contacto.empresa': 'Empresa del contacto',
};

export function SendWhatsappTemplateDialog({ open, onClose, telefono, contacto, onSuccess }: Props) {
  const [templates, setTemplates] = React.useState<WhatsappPlantillaOption[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [manualValues, setManualValues] = React.useState<Record<number, string>>({});
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTemplates(null);
    setLoadError(null);
    setSelectedId('');
    setManualValues({});
    setSendError(null);

    fetchWhatsappPlantillas(false)
      .then(setTemplates)
      .catch((err: any) => setLoadError(err?.message ?? 'No se pudieron cargar las plantillas'));
  }, [open]);

  const selectedTemplate = templates?.find((t) => String(t.id) === selectedId) ?? null;

  const variableIndices = React.useMemo(
    () => (selectedTemplate?.contenido ? extractVariableIndices(selectedTemplate.contenido) : []),
    [selectedTemplate]
  );

  const resolvedValues = React.useMemo((): Record<number, string> => {
    if (!selectedTemplate) return {};
    const result: Record<number, string> = {};
    for (const idx of variableIndices) {
      const paramConfig = getParamConfig(idx, selectedTemplate.configuracion_parametros);
      if (paramConfig && isAutoFill(paramConfig.origen)) {
        result[idx] = resolveAutoValue(paramConfig.origen, contacto, telefono);
      } else {
        result[idx] = manualValues[idx] ?? '';
      }
    }
    return result;
  }, [selectedTemplate, variableIndices, manualValues, contacto, telefono]);

  const manualVariables = React.useMemo((): ParametroPlantilla[] => {
    return variableIndices
      .map((idx) => {
        const config = getParamConfig(idx, selectedTemplate?.configuracion_parametros);
        if (config && isAutoFill(config.origen)) return null;
        return config ?? { variable: idx, label: `Variable ${idx}`, origen: 'manual' as OrigenParametro };
      })
      .filter((p): p is ParametroPlantilla => p !== null);
  }, [variableIndices, selectedTemplate]);

  const autoFilledVariables = React.useMemo((): ParametroPlantilla[] => {
    if (!selectedTemplate?.configuracion_parametros) return [];
    return variableIndices
      .map((idx) => getParamConfig(idx, selectedTemplate.configuracion_parametros))
      .filter((p): p is ParametroPlantilla => p !== null && isAutoFill(p.origen));
  }, [variableIndices, selectedTemplate]);

  const handleTemplateChange = (id: string) => {
    setSelectedId(id);
    setManualValues({});
    setSendError(null);
  };

  const handleManualChange = (variable: number, value: string) => {
    setManualValues((prev) => ({ ...prev, [variable]: value }));
  };

  const allManualFilled = manualVariables.every((p) => (manualValues[p.variable] ?? '').trim() !== '');

  const handleSend = async () => {
    if (!selectedTemplate) return;
    setSendError(null);
    setIsSending(true);

    const params = variableIndices.map((idx) => resolvedValues[idx] ?? '');

    try {
      await apiFetch('/api/whatsapp/enviar-plantilla', {
        method: 'POST',
        body: { telefono, plantilla_id: Number(selectedTemplate.id), params } as any,
      });
      onSuccess(selectedTemplate.nombre_interno);
    } catch (err: any) {
      setSendError(err?.message ?? 'No se pudo enviar la plantilla');
    } finally {
      setIsSending(false);
    }
  };

  const renderPreview = () => {
    if (!selectedTemplate) return null;

    if (!selectedTemplate.contenido) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Sin vista previa — ID en proveedor: <strong>{selectedTemplate.provider_template_id}</strong>
        </Typography>
      );
    }

    let preview = selectedTemplate.contenido;
    variableIndices.forEach((idx) => {
      const val = (resolvedValues[idx] ?? '').trim();
      preview = preview.replace(
        new RegExp(`\\{\\{${idx}\\}\\}`, 'g'),
        val ? `[${val}]` : `{{${idx}}}`
      );
    });

    return (
      <Box
        sx={{
          backgroundColor: 'action.hover',
          borderRadius: 1,
          p: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '0.85rem',
          fontFamily: 'inherit',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {preview}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={() => !isSending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Enviar plantilla de WhatsApp</DialogTitle>

      <DialogContent>
        {templates === null && !loadError && (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary" mt={1}>
              Cargando plantillas...
            </Typography>
          </Stack>
        )}

        {loadError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {loadError}
          </Alert>
        )}

        {templates !== null && !loadError && templates.length === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No hay plantillas disponibles para esta empresa.
          </Alert>
        )}

        {templates !== null && !loadError && templates.length > 0 && (
          <Stack spacing={2} mt={1}>
            <FormControl fullWidth size="small">
              <InputLabel id="template-select-label">Plantilla</InputLabel>
              <Select
                labelId="template-select-label"
                label="Plantilla"
                value={selectedId}
                onChange={(e) => handleTemplateChange(String(e.target.value))}
              >
                {templates.map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2">{t.nombre_interno}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {TIPO_LABELS[t.tipo] ?? t.tipo}
                      </Typography>
                      {t.es_default && (
                        <Typography variant="caption" color="primary">
                          · default
                        </Typography>
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedTemplate && (
              <>
                {autoFilledVariables.length > 0 && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={0.5} mb={0.75}>
                      <AutoAwesomeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        Valores automáticos
                      </Typography>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {autoFilledVariables.map((p) => {
                        const val = resolvedValues[p.variable];
                        return (
                          <Chip
                            key={p.variable}
                            size="small"
                            label={`${p.label}: ${val || '(vacío)'}`}
                            variant="outlined"
                            color={val ? 'success' : 'warning'}
                            title={ORIGEN_LABELS[p.origen]}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                {manualVariables.length > 0 && (
                  <Stack spacing={1.5}>
                    <Typography variant="caption" color="text.secondary">
                      {manualVariables.length === variableIndices.length
                        ? 'Variables de la plantilla'
                        : 'Variables manuales'}
                    </Typography>
                    {manualVariables.map((p) => (
                      <TextField
                        key={p.variable}
                        label={p.label}
                        size="small"
                        fullWidth
                        value={manualValues[p.variable] ?? ''}
                        onChange={(e) => handleManualChange(p.variable, e.target.value)}
                        disabled={isSending}
                        helperText={`{{${p.variable}}}`}
                      />
                    ))}
                    {manualVariables.length > 0 && variableIndices.length > manualVariables.length && (
                      <FormHelperText>
                        Completa los campos manuales para enviar.
                      </FormHelperText>
                    )}
                  </Stack>
                )}

                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    Vista previa
                  </Typography>
                  {renderPreview()}
                </Box>
              </>
            )}

            {sendError && (
              <Alert severity="error">{sendError}</Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSending} variant="outlined">
          Cancelar
        </Button>
        <Button
          onClick={handleSend}
          disabled={
            isSending ||
            !selectedTemplate ||
            (manualVariables.length > 0 && !allManualFilled)
          }
          variant="contained"
          color="primary"
          startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
        >
          {isSending ? 'Enviando…' : 'Enviar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
