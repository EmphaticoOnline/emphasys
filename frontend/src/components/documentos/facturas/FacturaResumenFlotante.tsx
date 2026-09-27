import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';

export type FacturaResumenFlotantePosicion = { x: number; y: number };

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
const POSICION_INICIAL: FacturaResumenFlotantePosicion = { x: 16, y: 16 };

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
  const [boundaryRect, setBoundaryRect] = useState<DOMRect | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    captureElement: HTMLDivElement;
  } | null>(null);

  const initialPosition = useCallback((): FacturaResumenFlotantePosicion => {
    if (!boundaryRect || !panelRef.current) return POSICION_INICIAL;
    return {
      x: Math.max(MARGEN_ARRASTRE, boundaryRect.right - panelRef.current.offsetWidth - MARGEN_ARRASTRE),
      y: Math.max(MARGEN_ARRASTRE, boundaryRect.bottom - panelRef.current.offsetHeight - MARGEN_ARRASTRE),
    };
  }, [boundaryRect]);
  const pos = position ?? initialPosition();
  const movido = position !== null;

  const getBoundary = useCallback((): HTMLElement | null => {
    // workspaceFacturaRef identifica la factura; el boundary real del panel es
    // el <main> visible que la contiene, no el rectángulo de la factura.
    return (containerRef.current?.closest('main') as HTMLElement | null) ?? containerRef.current;
  }, [containerRef]);

  const updateBoundaryRect = useCallback(() => {
    const boundary = getBoundary();
    if (boundary) setBoundaryRect(boundary.getBoundingClientRect());
  }, [getBoundary]);

  useEffect(() => {
    updateBoundaryRect();
    window.addEventListener('resize', updateBoundaryRect);
    window.addEventListener('scroll', updateBoundaryRect, true);
    return () => {
      window.removeEventListener('resize', updateBoundaryRect);
      window.removeEventListener('scroll', updateBoundaryRect, true);
    };
  }, [updateBoundaryRect]);

  const clampPosition = useCallback((next: FacturaResumenFlotantePosicion): FacturaResumenFlotantePosicion => {
    const panel = panelRef.current;
    const boundary = getBoundary()?.getBoundingClientRect();
    if (!boundary || !panel) {
      return {
        x: Math.max(MARGEN_ARRASTRE, next.x),
        y: Math.max(MARGEN_ARRASTRE, next.y),
      };
    }
    const minX = boundary.left + MARGEN_ARRASTRE;
    const maxX = Math.max(minX, boundary.right - panel.offsetWidth - MARGEN_ARRASTRE);
    const minY = boundary.top + MARGEN_ARRASTRE;
    const maxY = Math.max(minY, boundary.bottom - panel.offsetHeight - MARGEN_ARRASTRE);
    return {
      x: Math.max(minX, Math.min(next.x, maxX)),
      y: Math.max(minY, Math.min(next.y, maxY)),
    };
  }, [getBoundary]);

  const finishDrag = useCallback((pointerId?: number) => {
    const dragState = dragStateRef.current;
    if (!dragState || (pointerId !== undefined && dragState.pointerId !== pointerId)) return;
    if (dragState.captureElement.hasPointerCapture(dragState.pointerId)) {
      dragState.captureElement.releasePointerCapture(dragState.pointerId);
    }
    dragStateRef.current = null;
    setDragging(false);
  }, []);

  const handleHeaderPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    onPositionChange(clampPosition({
      x: dragState.startX + (event.clientX - dragState.startClientX),
      y: dragState.startY + (event.clientY - dragState.startClientY),
    }));
  }, [clampPosition, onPositionChange]);

  const handleHeaderPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    finishDrag(event.pointerId);
  }, [finishDrag]);

  useEffect(() => {
    if (position === null) return;
    const revalidarPosicion = () => {
      const next = clampPosition(position);
      if (next.x !== position.x || next.y !== position.y) onPositionChange(next);
    };
    const boundary = getBoundary();
    const observer = typeof ResizeObserver !== 'undefined' && boundary
      ? new ResizeObserver(() => {
          updateBoundaryRect();
          revalidarPosicion();
        })
      : null;
    if (boundary) observer?.observe(boundary);
    window.addEventListener('resize', revalidarPosicion);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', revalidarPosicion);
    };
  }, [clampPosition, containerRef, getBoundary, onPositionChange, position, updateBoundaryRect]);

  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (event.button !== 0 || dragStateRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: pos.x,
      startY: pos.y,
      captureElement: event.currentTarget,
    };
    setDragging(true);
  };

  const filas: Array<{ label: string; value: number; strong?: boolean }> = [
    { label: 'Subtotal', value: subtotal },
    ...(ocultarIva ? [] : [{ label: 'IVA', value: iva }, { label: 'Retenciones', value: -retenciones }]),
  ];

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
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
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
        sx={{
          px: 1.25,
          py: 1,
          borderBottom: '1px solid #eef0f4',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
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
