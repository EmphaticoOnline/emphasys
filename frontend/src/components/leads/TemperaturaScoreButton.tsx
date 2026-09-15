import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { LeadConPrioridad, TemperaturaResumen } from '../../pages/LeadsPage';
import TemperaturaProspectoModal from './TemperaturaProspectoModal';

export const temperaturaLabel = (nivel: TemperaturaResumen['nivel']) =>
  nivel === 'muy_caliente' ? 'Muy caliente' : nivel.charAt(0).toUpperCase() + nivel.slice(1);

export const temperaturaColor = (nivel: TemperaturaResumen['nivel']) => ({
  frio: '#607d8b',
  tibio: '#1976d2',
  caliente: '#ed6c02',
  muy_caliente: '#d32f2f',
}[nivel]);

const motivoLabel: Record<NonNullable<TemperaturaResumen['motivos_desactualizacion']>[number], string> = {
  mensajes_nuevos: 'Hay mensajes posteriores al análisis',
  historial_modificado: 'El historial de la conversación cambió',
  metodologia_actualizada: 'Método de análisis actualizado',
  modelo_actualizado: 'Modelo de IA actualizado',
};

export const motivosTooltip = (motivos: TemperaturaResumen['motivos_desactualizacion']) =>
  motivos?.map((motivo) => motivoLabel[motivo]).filter(Boolean).join(' · ') || '';

type Props = {
  lead: LeadConPrioridad;
  updateLead: (id: string, updates: Partial<LeadConPrioridad>) => void;
  desktop?: boolean;
};

export default function TemperaturaScoreButton({ lead, updateLead, desktop = false }: Props) {
  const [open, setOpen] = useState(false);
  const analysis = lead.temperatura ?? null;
  const motivoTexto = analysis ? motivosTooltip(analysis.motivos_desactualizacion) : '';
  const label = analysis
    ? `${temperaturaLabel(analysis.nivel)} · ${analysis.puntuacion}${motivoTexto ? ` · ${motivoTexto}` : ''}`
    : 'Analizar temperatura comercial';

  return (
    <>
      <Tooltip title={label} arrow>
        <IconButton
          size="small"
          aria-label={label}
          className="temperature-score-button"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
          }}
          sx={{
            width: 28,
            height: 28,
            minWidth: 28,
            minHeight: 28,
            maxWidth: 28,
            maxHeight: 28,
            p: 0,
            flexShrink: 0,
            bgcolor: 'transparent',
            opacity: analysis || !desktop ? 1 : 0,
            pointerEvents: analysis || !desktop ? 'auto' : 'none',
            '&:focus-visible': { opacity: 1, pointerEvents: 'auto' },
            '&:hover': { opacity: 1, bgcolor: 'transparent' },
          }}
        >
          <Box
            component="span"
            sx={{
              width: 20,
              height: 20,
              minWidth: 20,
              minHeight: 20,
              maxWidth: 20,
              maxHeight: 20,
              boxSizing: 'border-box',
              p: 0,
              borderRadius: '50%',
              display: 'block',
              textAlign: 'center',
              lineHeight: '20px',
              flexShrink: 0,
              ...(analysis
                ? {
                  bgcolor: analysis.desactualizado ? '#fff' : temperaturaColor(analysis.nivel),
                  color: analysis.desactualizado ? temperaturaColor(analysis.nivel) : '#fff',
                  border: `1px solid ${temperaturaColor(analysis.nivel)}`,
                  fontSize: analysis.puntuacion === 100 ? 8 : 9,
                  fontWeight: 600,
                }
                : {
                  color: 'text.secondary',
                  fontSize: 0,
                }),
            }}
          >
            {analysis ? analysis.puntuacion : <AutoAwesomeIcon sx={{ width: 20, height: 20, fontSize: 14, display: 'block', p: 0.25 }} />}
          </Box>
        </IconButton>
      </Tooltip>
      <TemperaturaProspectoModal
        open={open}
        lead={lead}
        onClose={() => setOpen(false)}
        onUpdated={(next) => updateLead(lead.id, { temperatura: next })}
      />
    </>
  );
}
