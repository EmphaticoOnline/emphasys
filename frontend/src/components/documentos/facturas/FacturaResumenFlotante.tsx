import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';

export type FacturaResumenFlotantePosicion = { right: number; bottom: number };

type Props = {
  containerRef: React.RefObject<HTMLElement | null>;
  position: FacturaResumenFlotantePosicion | null;
  onPositionChange: (position: FacturaResumenFlotantePosicion) => void;
  onReset: () => void;
  onExpandRail: () => void;
  subtotal: number;
  iva: number;
  retenciones: number;
  total: number;
  ocultarIva?: boolean;
  formatCurrency: (value: number) => string;
  fiscalCompleto: boolean;
  fiscalLabel: string;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
};

const MARGEN_ARRASTRE = 16;
const POSICION_INICIAL: FacturaResumenFlotantePosicion = { right: 16, bottom: 16 };

// Panel flotante de solo lectura con el resumen financiero de la factura,
// mostrado cuando el rail derecho está colapsado. Arrastrable solo desde su
// encabezado, limitado al workspace donde se monta con un margen de 16px.
export default function FacturaResumenFlotante({
  containerRef,
  position,
  onPositionChange,
  onReset,
  onExpandRail,
  subtotal,
  iva,
  retenciones,
  total,
  ocultarIva,
  formatCurrency,
  fiscalCompleto,
  fiscalLabel,
  onBack,
  onSave,
  saving = false,
  saveDisabled = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null);

  const pos = position ?? POSICION_INICIAL;
  const movido = position !== null;

  const handleMove = useCallback(
    (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      const container = containerRef.current;
      const panel = panelRef.current;
      if (!dragState || !container || !panel) return;

      const clamp = (value: number, max: number) => Math.max(MARGEN_ARRASTRE, Math.min(value, Math.max(MARGEN_ARRASTRE, max)));

      const nextRight = clamp(
        dragState.startRight - (event.clientX - dragState.startX),
        container.clientWidth - panel.offsetWidth - MARGEN_ARRASTRE
      );
      const nextBottom = clamp(
        dragState.startBottom - (event.clientY - dragState.startY),
        container.clientHeight - panel.offsetHeight - MARGEN_ARRASTRE
      );
      onPositionChange({ right: nextRight, bottom: nextBottom });
    },
    [containerRef, onPositionChange]
  );

  const handleUp = useCallback(() => {
    setDragging(false);
    dragStateRef.current = null;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
  }, [handleMove]);

  useEffect(() => () => {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
  }, [handleMove, handleUp]);

  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, startRight: pos.right, startBottom: pos.bottom };
    setDragging(true);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const filas: Array<{ label: string; value: number; strong?: boolean }> = [
    { label: 'Subtotal', value: subtotal },
    ...(ocultarIva ? [] : [{ label: 'IVA', value: iva }, { label: 'Retenciones', value: -retenciones }]),
  ];

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'absolute',
        right: pos.right,
        bottom: pos.bottom,
        width: 300,
        maxWidth: 'calc(100% - 32px)',
        bgcolor: '#fff',
        border: '1px solid #d9dde6',
        borderRadius: 2.5,
        boxShadow: dragging ? '0 20px 46px rgba(15,22,38,0.30)' : '0 12px 32px rgba(15,22,38,0.18)',
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: 5,
      }}
    >
      <Box
        onMouseDown={handleHeaderMouseDown}
        sx={{
          px: 1.25,
          py: 1,
          borderBottom: '1px solid #eef0f4',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: dragging ? 'grabbing' : 'grab',
          bgcolor: dragging ? '#f0f2f6' : '#fff',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 3px)',
            gridTemplateRows: 'repeat(3, 3px)',
            gap: '3px',
            mr: 0.5,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#a6adbd' }} />
          ))}
        </Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8b93a7' }}>
          Resumen
        </Typography>
        <Box sx={{ flex: 1 }} />
        {movido && (
          <Box
            component="button"
            onClick={onReset}
            sx={{
              border: 'none',
              background: 'transparent',
              color: '#8b93a7',
              font: 'inherit',
              fontSize: 11,
              px: 0.75,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { color: '#1d2f68', bgcolor: '#f0f2f6' },
            }}
          >
            Restablecer
          </Box>
        )}
        <Box
          component="button"
          onClick={onExpandRail}
          sx={{
            border: '1px solid #d9dde6',
            background: '#fff',
            color: '#1d2f68',
            font: 'inherit',
            fontSize: 11.5,
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: '#eef1f8' },
          }}
        >
          Expandir panel
        </Box>
      </Box>

      <Stack spacing={0.75} sx={{ px: 1.5, py: 1.25 }}>
        {filas.map((fila) => (
          <Box key={fila.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: '#5b6479' }}>{fila.label}</Typography>
            <Typography sx={{ fontSize: 12.5, color: '#3d4557', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(fila.value)}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Box sx={{ bgcolor: '#1d2f68', px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
          Total
        </Typography>
        <Typography sx={{ fontSize: 17, color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(total)}
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid #eef0f4', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 10.5,
            fontWeight: 600,
            px: 1,
            py: 0.4,
            borderRadius: 999,
            bgcolor: fiscalCompleto ? '#e8f4ee' : '#fdf3e3',
            color: fiscalCompleto ? '#1c6b47' : '#9a5b00',
            border: '1px solid',
            borderColor: fiscalCompleto ? '#c9e3d5' : '#ecd9b4',
          }}
        >
          <Box component="span" sx={{ fontSize: 9 }}>●</Box>
          {fiscalLabel}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Volver">
          <span>
            <IconButton
              size="small"
              onClick={onBack}
              disabled={saving}
              aria-label="Volver"
              sx={{ width: 30, height: 30, border: '1px solid rgba(29,47,104,0.5)', color: '#1d2f68', borderRadius: 1 }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={saving ? 'Guardando...' : 'Guardar factura'}>
          <span>
            <IconButton
              size="small"
              onClick={onSave}
              disabled={saveDisabled || saving}
              aria-label="Guardar factura"
              sx={{ width: 30, height: 30, bgcolor: '#1d2f68', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#162551' }, '&.Mui-disabled': { bgcolor: '#c9d2e8', color: '#fff' } }}
            >
              {saving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
