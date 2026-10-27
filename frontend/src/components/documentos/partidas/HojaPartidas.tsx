// Partidas y descuentos de la pestaña "Documento" (la hoja ligera de facturas,
// cotizaciones y órdenes de compra). Usa el mismo cálculo que la pestaña
// Partidas: importe sin IVA = cantidad × precio − descuento de la partida; el
// descuento global va en los totales.
import * as React from 'react';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import type { CotizacionPartida } from '../../../types/cotizacion';
import { calcularPartidas, currency, percent, quantity, textoDescuentoPartida, type TotalesDocumento } from './PartidasDocumentoTabla';

/** Lista de partidas de la hoja. `extra` agrega una línea propia del tipo (p. ej. avance de recepción). */
export function HojaPartidasLista({
  partidas,
  extra,
}: {
  partidas: CotizacionPartida[];
  extra?: (partida: CotizacionPartida) => React.ReactNode;
}) {
  const tokens = useTheme().emphasys;
  const { lineas } = calcularPartidas(partidas);

  return (
    <Box sx={{ flex: '1 0 auto', border: `1px solid ${tokens.content.border}`, borderRadius: 1 }}>
      {lineas.map(({ partida, descuento, importe }, index) => {
        const textoDescuento = textoDescuentoPartida(descuento);
        return (
          <Stack
            key={partida.id}
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={2}
            sx={{ px: 1, py: 0.5, borderBottom: index < lineas.length - 1 ? `1px solid ${tokens.content.border}` : 'none' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12.5 }} noWrap>{partida.producto_descripcion || partida.descripcion_alterna || '—'}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                {partida.producto_clave ? `${partida.producto_clave} · ` : ''}
                Cant. {quantity.format(Number(partida.cantidad || 0))} × {currency.format(Number(partida.precio_unitario || 0))}
                {textoDescuento ? ` · ${textoDescuento}` : ''}
              </Typography>
              {extra?.(partida)}
            </Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {currency.format(importe)}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}

/** Filas "Suma de partidas" y "Descuento global" que van antes del Subtotal, sólo si hay descuento global. */
export function HojaFilasDescuentoGlobal({ partidas, totales }: { partidas: CotizacionPartida[]; totales: TotalesDocumento }) {
  const { sumaPartidas, descuentoGlobalPct, descuentoGlobalMonto } = calcularPartidas(partidas, totales);
  if (descuentoGlobalMonto <= 0) return null;
  return (
    <>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Typography variant="caption" color="text.secondary">Suma de partidas</Typography>
        <Typography variant="caption">{currency.format(sumaPartidas)}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Typography variant="caption" color="text.secondary">Descuento global ({percent.format(descuentoGlobalPct)} %)</Typography>
        <Typography variant="caption">−{currency.format(descuentoGlobalMonto)}</Typography>
      </Stack>
    </>
  );
}
