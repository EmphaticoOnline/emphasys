import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { HistorialConciliacion, MovimientoConciliacion } from '../../types/finanzas';
import { resolverFolioVisual } from '../../utils/documentos.utils';

const fmt = (n: number, moneda = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(n);

const formatFecha = (value: string | null | undefined): string => {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(value).slice(0, 10);
};

const diferenciaVisible = (c: HistorialConciliacion): number | null => {
  if (c.diferencia != null) return c.diferencia;
  if (c.saldo_conciliado_calculado == null) return null;
  return c.saldo_banco - c.saldo_conciliado_calculado;
};

const folioDocumento = (row: MovimientoConciliacion): string | null => {
  if (!row.documento_tipo_documento) return null;
  return resolverFolioVisual(
    {
      serie: row.documento_serie,
      numero: row.documento_numero,
      serie_externa: row.documento_serie_externa,
      numero_externo: row.documento_numero_externo,
    },
    row.documento_tipo_documento,
  );
};

type Props = {
  open: boolean;
  onClose: () => void;
  cuentaNombre?: string;
  moneda: string;
  historial: HistorialConciliacion[];
  cargando: boolean;
  seleccionada: HistorialConciliacion | null;
  onSeleccionar: (conciliacion: HistorialConciliacion) => void;
  movimientos: MovimientoConciliacion[];
  cargandoMovimientos: boolean;
  onEliminar: (conciliacion: HistorialConciliacion) => void;
};

export function HistorialConciliacionesDialog({
  open,
  onClose,
  cuentaNombre,
  moneda,
  historial,
  cargando,
  seleccionada,
  onSeleccionar,
  movimientos,
  cargandoMovimientos,
  onEliminar,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const apilar = useMediaQuery(theme.breakpoints.down('md'));
  const pantallaCompleta = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={pantallaCompleta}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: tokens.content.background,
          color: tokens.content.foreground,
          backgroundImage: 'none',
          border: `1px solid ${tokens.content.border}`,
          width: pantallaCompleta ? '100%' : 'min(920px, calc(100vw - 80px))',
          maxWidth: pantallaCompleta ? '100%' : 920,
          height: pantallaCompleta ? '100%' : 'min(680px, calc(100vh - 96px))',
          maxHeight: pantallaCompleta ? '100%' : 'calc(100vh - 96px)',
          m: pantallaCompleta ? 0 : 2,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ px: 2.25, pt: 1.75, pb: 1.25, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
          TESORERÍA
        </Typography>
        <Typography variant="figure" sx={{ mt: 0.3, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
          Historial de conciliaciones
        </Typography>
        {cuentaNombre && (
          <Typography sx={{ mt: 0.45, fontSize: 13, color: tokens.content.secondary }}>
            {cuentaNombre}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ px: 0, pt: 0, pb: 0, flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {cargando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <CircularProgress />
          </Box>
        ) : historial.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">
              No hay conciliaciones registradas para esta cuenta.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: apilar ? 'column' : 'row',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: apilar ? '100%' : 280,
                flex: apilar ? '0 0 auto' : '0 0 280px',
                maxHeight: apilar ? 240 : 'none',
                minHeight: 0,
                overflow: 'auto',
                borderRight: apilar ? 'none' : `1px solid ${tokens.navigation.border}`,
                borderBottom: apilar ? `1px solid ${tokens.navigation.border}` : 'none',
                bgcolor: tokens.navigation.background,
                color: tokens.navigation.foreground,
                px: 1,
                py: 1,
                scrollbarWidth: 'thin',
                scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`,
              }}
            >
              {historial.map((c) => {
                const activa = seleccionada?.id === c.id;
                const anulada = c.estatus === 'anulada';
                const diferencia = diferenciaVisible(c);
                const cuadra = diferencia != null && Math.abs(diferencia) < 0.01;
                return (
                  <Box
                    key={c.id}
                    onClick={() => onSeleccionar(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSeleccionar(c);
                      }
                    }}
                    sx={{
                      mb: 0.45,
                      px: 1,
                      py: 0.9,
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: activa ? tokens.navigation.selection : 'transparent',
                      color: activa ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                      boxShadow: activa ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                      opacity: anulada ? 0.72 : 1,
                      '&:hover': {
                        bgcolor: activa ? tokens.navigation.selection : tokens.navigation.hover,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="figure" sx={{ fontSize: 15, lineHeight: 1.15, color: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                        {formatFecha(c.fecha_corte)}
                      </Typography>
                      <Typography
                        sx={{
                          ml: 'auto',
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: anulada ? tokens.navigation.muted : tokens.navigation.foreground,
                        }}
                      >
                        {anulada ? 'Anulada' : 'Cerrada'}
                      </Typography>
                      {c.es_ultima_reversible && (
                        <IconButton
                          size="small"
                          aria-label="Eliminar conciliación"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEliminar(c);
                          }}
                          sx={{
                            ml: 0.15,
                            p: 0.35,
                            color: tokens.navigation.foreground,
                            '&:hover': { bgcolor: tokens.navigation.hover },
                          }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </Box>
                    <Linea etiqueta="Saldo banco" valor={fmt(c.saldo_banco, moneda)} />
                    <Linea
                      etiqueta="Saldo conciliado"
                      valor={c.saldo_conciliado_calculado != null ? fmt(c.saldo_conciliado_calculado, moneda) : '—'}
                    />
                    <Linea
                      etiqueta="Diferencia"
                      valor={diferencia != null ? fmt(diferencia, moneda) : '—'}
                      color={diferencia == null || cuadra ? tokens.navigation.foreground : tokens.navigation.accent}
                    />
                    <Typography sx={{ mt: 0.35, fontSize: 11.5, color: tokens.navigation.subtle }}>
                      {c.cantidad_movimientos} {c.cantidad_movimientos === 1 ? 'movimiento' : 'movimientos'}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
              <Box sx={{ flex: 1, minHeight: apilar ? 240 : 0, overflow: 'auto', px: 1.25, py: 1.25 }}>
                {cargandoMovimientos ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 140 }}>
                    <CircularProgress size={22} />
                  </Box>
                ) : !seleccionada ? (
                  <Typography variant="body2" color="text.secondary">
                    Selecciona una conciliación.
                  </Typography>
                ) : movimientos.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No hay movimientos asociados.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                    {movimientos.map((movimiento) => (
                      <TarjetaMovimiento key={movimiento.id} movimiento={movimiento} moneda={moneda} />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.25, py: 1.25, flexShrink: 0 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: tokens.content.secondary }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TarjetaMovimiento({ movimiento, moneda }: { movimiento: MovimientoConciliacion; moneda: string }) {
  const tokens = useTheme().emphasys;
  const deposito = movimiento.tipo_movimiento === 'Deposito';
  const folio = folioDocumento(movimiento);
  return (
    <Box
      sx={{
        px: 1.15,
        py: 0.7,
        borderRadius: 1.5,
        bgcolor: tokens.metric.amount.background,
        border: `1px solid ${tokens.content.border}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tokens.content.foreground }}>
          {formatFecha(movimiento.fecha)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.content.secondary }}>
          {deposito ? 'Depósito' : 'Retiro'}
        </Typography>
        <Typography
          variant="figure"
          sx={{
            ml: 'auto',
            fontSize: 15,
            lineHeight: 1.1,
            fontWeight: 600,
            color: deposito ? tokens.metric.applied.foreground : tokens.content.foreground,
          }}
        >
          {deposito ? '+' : '−'}
          {fmt(Number(movimiento.monto), movimiento.cuenta_moneda || moneda)}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          columnGap: 1.5,
          rowGap: 0.15,
          mt: 0.4,
        }}
      >
        <Dato etiqueta="Referencia" valor={movimiento.referencia || '—'} />
        <Dato etiqueta="Contacto" valor={movimiento.contacto_nombre || '—'} />
        <Dato etiqueta="Concepto" valor={movimiento.concepto_nombre || '—'} />
        {folio ? <Dato etiqueta="Documento" valor={folio} /> : null}
      </Box>
    </Box>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const tokens = useTheme().emphasys;
  return (
    <Typography noWrap sx={{ fontSize: 12, lineHeight: 1.35, color: tokens.content.secondary }}>
      <Box component="span" sx={{ color: tokens.content.muted }}>{etiqueta} </Box>
      <Box component="span" sx={{ color: tokens.content.foreground, fontWeight: 600 }}>{valor}</Box>
    </Typography>
  );
}

function Linea({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.2 }}>
      <Typography sx={{ fontSize: 11.5, color: tokens.navigation.subtle }}>{etiqueta}</Typography>
      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: color ?? tokens.navigation.foreground }}>
        {valor}
      </Typography>
    </Box>
  );
}
