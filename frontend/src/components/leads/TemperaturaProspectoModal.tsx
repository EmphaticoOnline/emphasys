import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, Stack, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { apiFetch } from '../../api/apiClient';
import type { LeadConPrioridad, TemperaturaResumen } from '../../pages/LeadsPage';
import { motivosTooltip, temperaturaColor, temperaturaLabel } from './TemperaturaScoreButton';

type Props = {
  open: boolean;
  lead: LeadConPrioridad;
  onClose: () => void;
  onUpdated: (analysis: TemperaturaResumen) => void;
};

type ApiResponse = { analisis: TemperaturaResumen | null; desactualizado?: boolean; motivos_desactualizacion?: TemperaturaResumen['motivos_desactualizacion']; elegible_para_analisis?: boolean; motivo_no_elegible?: 'sin_interaccion_suficiente' | null };

export default function TemperaturaProspectoModal({ open, lead, onClose, onUpdated }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [analysis, setAnalysis] = useState<TemperaturaResumen | null>(lead.temperatura ?? null);
  const [stale, setStale] = useState(Boolean(lead.temperatura?.desactualizado));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState(lead.elegibleParaAnalisis !== false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch(`/api/whatsapp/conversaciones/${lead.id}/temperatura`)
      .then((response) => response.json().then((body: ApiResponse) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!active) return;
        if (!ok) throw new Error('No se pudo cargar el análisis de temperatura.');
        setEligible(body.elegible_para_analisis !== false);
        const next = body.analisis ? { ...body.analisis, motivos_desactualizacion: body.motivos_desactualizacion ?? body.analisis.motivos_desactualizacion ?? [] } : null;
        setAnalysis(body.elegible_para_analisis === false ? null : next);
        setStale(Boolean(body.desactualizado));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'No se pudo cargar el análisis.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [open, lead.id]);

  const runAnalysis = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/whatsapp/conversaciones/${lead.id}/temperatura`, { method: 'POST' });
      const body = await response.json() as ApiResponse & { code?: string; elegible_para_analisis?: boolean };
      if (!response.ok) {
        if (body.code === 'INTERACCION_INSUFICIENTE') {
          setEligible(false);
          setAnalysis(null);
          setStale(false);
          setError(null);
          return;
        }
        throw new Error(body && 'error' in body ? String((body as { error?: string }).error) : 'No se pudo analizar la conversación.');
      }
      if (!body.analisis) throw new Error('El análisis no devolvió información válida.');
      const next = { ...body.analisis, motivos_desactualizacion: body.motivos_desactualizacion ?? body.analisis.motivos_desactualizacion ?? [] };
      setAnalysis(next);
      setStale(Boolean(body.desactualizado));
      onUpdated({ ...next, desactualizado: Boolean(body.desactualizado) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo analizar la conversación.');
    } finally {
      setSaving(false);
    }
  };

  const finalized = lead.estado === 'finalizada';
  const current = analysis;
  const interactionInsufficient = !eligible;

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: current ? temperaturaColor(current.nivel) : 'action.hover', color: current ? '#fff' : 'text.secondary', flexShrink: 0 }}>
            {current ? <Typography fontWeight={800} fontSize={20}>{current.puntuacion}</Typography> : <AutoAwesomeIcon />}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6">Temperatura comercial</Typography>
            {current && <Typography variant="body2" color="text.secondary">{temperaturaLabel(current.nivel)} · Confianza {Math.round(current.confianza * 100)}%</Typography>}
          </Box>
          {eligible && (!current || stale) && (
            <Button variant="contained" size="small" onClick={runAnalysis} disabled={loading || saving || finalized} sx={{ flexShrink: 0 }}>
              {saving ? <CircularProgress size={18} color="inherit" /> : current ? 'Actualizar análisis' : 'Analizar conversación'}
            </Button>
          )}
          {eligible && current && !stale && <Typography variant="caption" color="success.main" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>Análisis vigente</Typography>}
        </Stack>
        <IconButton aria-label="Cerrar" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ overflowY: 'auto' }}>
        {loading && !current && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
        {finalized && <Alert severity="info" sx={{ mb: 2 }}>Las conversaciones finalizadas sólo muestran su análisis anterior.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {interactionInsufficient && !error && <Alert severity="info" sx={{ mb: 2 }}><Typography fontWeight={700}>Aún no hay suficiente interacción</Typography><Typography variant="body2">La temperatura estará disponible cuando el agente responda y el prospecto vuelva a participar en la conversación.</Typography></Alert>}
        {stale && <Alert severity="warning" sx={{ mb: 2 }}>{(analysis?.motivos_desactualizacion ?? []).map((motivo) => ({
          mensajes_nuevos: 'Hay mensajes posteriores a este análisis.',
          metodologia_actualizada: 'El método de evaluación fue actualizado. Conviene generar un nuevo análisis.',
          modelo_actualizado: 'El modelo de IA fue actualizado. Conviene generar un nuevo análisis.',
          historial_modificado: 'El historial utilizado para este análisis cambió.',
        }[motivo])).join(' ') || `Análisis desactualizado${motivosTooltip(analysis?.motivos_desactualizacion) ? `: ${motivosTooltip(analysis?.motivos_desactualizacion)}` : '.'}`}</Alert>}
        {eligible && current && <Stack spacing={2}>
          <Box><Typography variant="subtitle2">Explicación</Typography><Typography variant="body2">{current.explicacion || 'Sin explicación disponible.'}</Typography></Box>
          <Box><Typography variant="subtitle2">Razones</Typography>{current.principales_razones.length ? <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5 }}>{current.principales_razones.map((item) => <li key={item}><Typography variant="body2">{item}</Typography></li>)}</Box> : <Typography variant="body2" color="text.secondary">No especificadas.</Typography>}</Box>
          <Box><Typography variant="subtitle2">Información faltante</Typography>{current.riesgo_informacion_faltante.length ? <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5 }}>{current.riesgo_informacion_faltante.map((item) => <li key={item}><Typography variant="body2">{item}</Typography></li>)}</Box> : <Typography variant="body2" color="text.secondary">No especificada.</Typography>}</Box>
          <Box><Typography variant="subtitle2">Siguiente acción</Typography><Typography variant="body2">{current.siguiente_accion_recomendada || 'Sin acción recomendada.'}</Typography></Box>
          <Typography variant="caption" color="text.secondary">Analizado: {current.creado_en ? new Date(current.creado_en).toLocaleString() : '—'}</Typography>
        </Stack>}
        {eligible && !loading && !current && !error && <Typography color="text.secondary">Aún no existe un análisis para esta conversación.</Typography>}
      </DialogContent>
    </Dialog>
  );
}
