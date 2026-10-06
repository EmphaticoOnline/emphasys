import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import type { FinanzasOperacion } from '../../types/finanzas';
import {
  etiquetaChip,
  etiquetaSugerencia,
  filtrarMovimientos,
  mismaSugerencia,
  sugerirMovimientos,
  type FiltroMovimiento,
  type SugerenciaMovimiento,
} from './buscadorMovimientosLogica';

type Props = {
  operaciones: FinanzasOperacion[];
  query: string;
  setQuery: (value: string) => void;
  filtros: FiltroMovimiento[];
  setFiltros: (value: FiltroMovimiento[]) => void;
};

export function BuscadorMovimientos({ operaciones, query, setQuery, filtros, setFiltros }: Props) {
  const tokens = useTheme().emphasys;
  const [abierto, setAbierto] = useState(false);
  const [resalte, setResalte] = useState(-1);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hayContenido = query.trim().length > 0 || filtros.length > 0;
  const sugerencias = useMemo(
    () => sugerirMovimientos(filtrarMovimientos(operaciones, filtros, ''), query),
    [operaciones, filtros, query],
  );

  useEffect(() => {
    const cerrar = (event: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const agregar = (sugerencia: SugerenciaMovimiento) => {
    if (!filtros.some((filtro) => mismaSugerencia(filtro, sugerencia))) setFiltros([...filtros, sugerencia]);
    setQuery('');
    setAbierto(false);
    setResalte(-1);
    inputRef.current?.focus();
  };

  const limpiar = () => {
    setQuery('');
    setFiltros([]);
    setAbierto(false);
    setResalte(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setAbierto(false);
      setResalte(-1);
      return;
    }
    if (!abierto || sugerencias.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setResalte((actual) => (actual + 1) % sugerencias.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setResalte((actual) => (actual <= 0 ? sugerencias.length - 1 : actual - 1));
    } else if (event.key === 'Enter' && resalte >= 0) {
      event.preventDefault();
      const elegida = sugerencias[resalte];
      if (elegida) agregar(elegida);
    }
  };

  const colorEtiqueta = (sugerencia: SugerenciaMovimiento) => {
    if (sugerencia.tipo === 'numerico' && sugerencia.campo === 'entrada') {
      return { color: tokens.metric.exhausted.foreground, bgcolor: tokens.metric.exhausted.background };
    }
    if (sugerencia.tipo === 'numerico' && sugerencia.campo === 'salida') {
      return { color: tokens.metric.blocked.foreground, bgcolor: tokens.metric.blocked.background };
    }
    return { color: tokens.action.primaryForeground, bgcolor: tokens.action.primary };
  };

  return (
    <Box ref={contenedorRef} sx={{ position: 'relative', flex: '1 1 280px', minWidth: { xs: '100%', sm: 280 }, maxWidth: 560, zIndex: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.5,
          px: 0.75,
          py: '3px',
          minHeight: 32,
          border: `1.5px solid ${tokens.action.primary}`,
          borderRadius: 1.5,
          bgcolor: tokens.metric.amount.background,
          '&:focus-within': { boxShadow: `0 0 0 2px ${tokens.action.hoverTint}` },
        }}
      >
        <SearchIcon sx={{ color: tokens.content.muted, fontSize: 18, flexShrink: 0 }} />
        {filtros.map((filtro, index) => {
          const texto = etiquetaChip(filtro);
          return (
            <Box
              key={`${filtro.tipo}-${filtro.campo}-${index}`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                maxWidth: '100%',
                pl: 0.75,
                pr: 0.25,
                py: '1px',
                borderRadius: 999,
                bgcolor: tokens.action.primary,
                color: tokens.action.primaryForeground,
                flexShrink: 0,
              }}
            >
              <Box component="span" sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{texto}</Box>
              <IconButton
                size="small"
                aria-label={`Quitar filtro ${texto}`}
                onClick={() => setFiltros(filtros.filter((_, i) => i !== index))}
                sx={{ p: '1px', ml: 0.25, color: 'rgba(244,240,232,0.72)', '&:hover': { color: tokens.action.primaryForeground, bgcolor: 'rgba(255,255,255,0.12)' } }}
              >
                <CloseIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Box>
          );
        })}
        <Box
          component="input"
          ref={inputRef}
          value={query}
          aria-label="Buscar movimientos"
          placeholder={filtros.length === 0 ? 'Buscar movimientos' : ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value);
            setAbierto(true);
            setResalte(-1);
          }}
          onFocus={() => { if (query.trim()) setAbierto(true); }}
          onKeyDown={onKeyDown}
          sx={{
            flex: 1,
            minWidth: 120,
            border: 'none',
            outline: 'none',
            bgcolor: 'transparent',
            color: tokens.content.foreground,
            font: 'inherit',
            fontSize: 12.5,
            p: 0,
            ml: 0.25,
            '::placeholder': { color: tokens.content.muted },
          }}
        />
        {hayContenido && (
          <IconButton size="small" aria-label="Limpiar búsqueda" onClick={limpiar} sx={{ color: tokens.content.muted, flexShrink: 0 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>
      {abierto && sugerencias.length > 0 && (
        <Box
          role="listbox"
          aria-label="Sugerencias de búsqueda"
          sx={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 320,
            overflow: 'auto',
            bgcolor: tokens.content.elevated,
            color: tokens.content.foreground,
            border: `1px solid ${tokens.content.border}`,
            borderRadius: 1.5,
            boxShadow: '0 8px 24px rgba(62, 52, 40, 0.12)',
          }}
        >
          {sugerencias.map((sugerencia, index) => {
            const { etiqueta, detalle } = etiquetaSugerencia(sugerencia);
            const tono = colorEtiqueta(sugerencia);
            return (
              <Box
                key={`${sugerencia.tipo}-${sugerencia.campo}-${index}-${detalle}`}
                role="option"
                aria-selected={index === resalte}
                onMouseDown={(event) => { event.preventDefault(); agregar(sugerencia); }}
                onMouseEnter={() => setResalte(index)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.1,
                  py: 0.65,
                  cursor: 'pointer',
                  bgcolor: index === resalte ? tokens.content.hover : 'transparent',
                  '&:not(:last-child)': { borderBottom: `1px solid ${tokens.content.border}` },
                }}
              >
                <Box component="span" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', px: 0.7, py: '2px', borderRadius: '4px', flexShrink: 0, ...tono }}>
                  {etiqueta}
                </Box>
                <Typography component="span" noWrap sx={{ fontSize: 12.5, color: tokens.content.foreground, fontVariantNumeric: sugerencia.tipo === 'numerico' ? 'tabular-nums' : undefined }}>
                  {detalle}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
