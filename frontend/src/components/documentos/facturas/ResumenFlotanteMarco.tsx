import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { neutralColors, whiteSurfaces } from '../../../theme/structural';
import { activeBrand } from '../../../theme/brand/active';
import { elevation } from '../../../theme/elevation';

export type ResumenFlotantePosicion = { x: number; y: number };

type Props = {
  containerRef: React.RefObject<HTMLElement | null>;
  position: ResumenFlotantePosicion | null;
  onPositionChange: (position: ResumenFlotantePosicion) => void;
  onReset: () => void;
  onExpand: () => void;
  titulo?: string;
  children: React.ReactNode;
  apariencia?: 'factura' | 'tema';
};

const MARGEN_ARRASTRE = 16;
const POSICION_INICIAL: ResumenFlotantePosicion = { x: 16, y: 16 };

// Marco arrastrable del resumen que Facturas muestra al colapsar el rail
// derecho. El contenido lo aporta cada formulario; la posición, el límite
// al área visible y el control de expandir viven aquí.
export default function ResumenFlotanteMarco({
  containerRef,
  position,
  onPositionChange,
  onReset,
  onExpand,
  titulo = 'Resumen',
  children,
  apariencia = 'factura',
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

  const initialPosition = useCallback((): ResumenFlotantePosicion => {
    if (!boundaryRect || !panelRef.current) return POSICION_INICIAL;
    return {
      x: Math.max(MARGEN_ARRASTRE, boundaryRect.right - panelRef.current.offsetWidth - MARGEN_ARRASTRE),
      y: Math.max(MARGEN_ARRASTRE, boundaryRect.bottom - panelRef.current.offsetHeight - MARGEN_ARRASTRE),
    };
  }, [boundaryRect]);
  const pos = position ?? initialPosition();
  const movido = position !== null;

  const getBoundary = useCallback((): HTMLElement | null => {
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

  const clampPosition = useCallback((next: ResumenFlotantePosicion): ResumenFlotantePosicion => {
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
  }, [clampPosition, getBoundary, onPositionChange, position, updateBoundaryRect]);

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

  return (
    <Box
      ref={panelRef}
      sx={(theme) => ({
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 300,
        maxWidth: 'calc(100% - 32px)',
        bgcolor: apariencia === 'tema' ? theme.emphasys.content.elevated : whiteSurfaces.floatingSummary,
        border: `1px solid ${apariencia === 'tema' ? theme.emphasys.content.border : neutralColors.steel.panelBorder}`,
        borderRadius: 2.5,
        boxShadow: dragging ? elevation.dragging : elevation.draggable,
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: 5,
      })}
    >
      <Box
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
        sx={(theme) => ({
          px: 1.25,
          py: 1,
          borderBottom: `1px solid ${apariencia === 'tema' ? theme.emphasys.content.border : neutralColors.steel.dividerSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          bgcolor: dragging
            ? (apariencia === 'tema' ? theme.emphasys.content.hover : neutralColors.steel.hover)
            : (apariencia === 'tema' ? theme.emphasys.content.elevated : whiteSurfaces.floatingSummary),
        })}
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
            <Box key={i} sx={(theme) => ({ width: 3, height: 3, borderRadius: '50%', bgcolor: apariencia === 'tema' ? theme.emphasys.content.muted : neutralColors.steel.dot })} />
          ))}
        </Box>
        <Typography sx={(theme) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: apariencia === 'tema' ? theme.emphasys.content.muted : neutralColors.steel.label })}>
          {titulo}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {movido && (
          <Box
            component="button"
            onClick={onReset}
            sx={(theme) => ({
              border: 'none',
              background: 'transparent',
              color: apariencia === 'tema' ? theme.emphasys.content.muted : neutralColors.steel.label,
              font: 'inherit',
              fontSize: 11,
              px: 0.75,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': {
                color: apariencia === 'tema' ? theme.emphasys.content.foreground : activeBrand.colors.blue.base,
                bgcolor: apariencia === 'tema' ? theme.emphasys.content.hover : neutralColors.steel.hover,
              },
            })}
          >
            Restablecer
          </Box>
        )}
        <Box
          component="button"
          onClick={onExpand}
          sx={(theme) => ({
            border: `1px solid ${apariencia === 'tema' ? theme.emphasys.content.border : neutralColors.steel.panelBorder}`,
            background: apariencia === 'tema' ? theme.emphasys.content.elevated : whiteSurfaces.floatingSummary,
            color: apariencia === 'tema' ? theme.emphasys.content.foreground : activeBrand.colors.blue.base,
            font: 'inherit',
            fontSize: 11.5,
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: apariencia === 'tema' ? theme.emphasys.content.hover : neutralColors.steel.hoverAlt },
          })}
        >
          Expandir panel
        </Box>
      </Box>
      {children}
    </Box>
  );
}
