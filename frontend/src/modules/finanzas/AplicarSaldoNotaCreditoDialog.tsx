import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import UndoIcon from '@mui/icons-material/Undo';
import {
  aplicarSaldoNotaCredito,
  fetchAplicacionesDocumento,
  fetchEstadoCuenta,
  fetchSaldoDocumento,
} from '../../services/finanzasService';
import {
  debeGuardarOmitirConfirmacion,
  guardarOmitirConfirmacionQuitarAplicacion,
  omiteConfirmacionQuitarAplicacion,
} from './omitirConfirmacionQuitarAplicacion';
import type { AplicacionOperacion, DocumentoSaldo, EstadoCuentaItem } from '../../types/finanzas';
import { formatearFolioDocumento } from '../../utils/documentos.utils';
import {
  filtrarFacturasCandidatas,
  montosAplicacion,
  resumirDistribucionSaldo,
  roundMoney,
  sugerirAplicacion,
} from './aplicarSaldoNotaCredito.logic';

const headSx = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: (theme: Theme) => theme.emphasys.table.headerFg,
  bgcolor: (theme: Theme) => theme.emphasys.table.headerBg,
  borderBottom: (theme: Theme) => `1px solid ${theme.emphasys.table.line}`,
  py: 0.55,
  px: 1.25,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const cellSx = {
  fontSize: 13,
  fontWeight: 500,
  color: (theme: Theme) => theme.emphasys.table.cell,
  borderBottom: (theme: Theme) => `1px solid ${theme.emphasys.table.line}`,
  py: 0.35,
  px: 1.25,
  lineHeight: 1.25,
  fontVariantNumeric: 'tabular-nums',
};

type Props = {
  open: boolean;
  documentoId: number;
  contactoId: number;
  tipoDocumento: string;
  folio: string;
  clienteNombre: string;
  usuarioId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

const formatDateShort = (value?: string | null) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-MX');
};

const fechaAplicacion = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

function parseNumero(raw: string): number | null {
  const compacto = raw.trim().replace(/[$,\s]/g, '');
  if (!compacto) return 0;
  const parsed = Number(compacto);
  return Number.isFinite(parsed) ? parsed : null;
}

function CifraOperacion({ label, value, tono }: { label: string; value: string; tono: 'base' | 'activa' | 'vacia' | 'alerta' }) {
  const color = tono === 'alerta' ? '#9a3412' : tono === 'activa' ? 'primary.main' : tono === 'vacia' ? '#94a3b8' : '#334155';
  return (
    <Box sx={{ flex: '1 1 0', minWidth: 0, px: { xs: 1.25, sm: 1.75 }, py: 1.15 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b93a7', lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography noWrap sx={{ mt: 0.55, fontSize: 16, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
        {value}
      </Typography>
    </Box>
  );
}

function CapturaImporte({
  valor,
  invalido,
  disabled,
  ariaLabel,
  onCommit,
}: {
  valor: number;
  invalido: boolean;
  disabled: boolean;
  ariaLabel: string;
  onCommit: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(valor > 0 ? valor.toFixed(2) : '');
  const [enfocado, setEnfocado] = useState(false);
  const activo = valor > 0 && !invalido;
  const visible = enfocado ? texto : (valor > 0 ? valor.toFixed(2) : '');

  return (
    <TextField
      value={visible}
      disabled={disabled}
      size="small"
      hiddenLabel
      placeholder="0.00"
      autoComplete="off"
      onFocus={(event) => {
        setEnfocado(true);
        setTexto(valor > 0 ? String(valor) : '');
        event.target.select();
      }}
      onChange={(event) => {
        setTexto(event.target.value);
        const parsed = parseNumero(event.target.value);
        if (parsed != null && parsed >= 0) onCommit(parsed);
      }}
      onBlur={() => {
        setEnfocado(false);
        const parsed = parseNumero(texto);
        onCommit(parsed != null && parsed > 0 ? roundMoney(parsed) : 0);
      }}
      inputProps={{ 'aria-label': ariaLabel, inputMode: 'decimal' }}
      InputProps={{
        startAdornment: (
          <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: activo ? 'primary.main' : '#94a3b8', pl: 0.5 }}>$</Box>
        ),
      }}
      sx={{
        width: 112,
        '& .MuiOutlinedInput-root': {
          height: 28,
          bgcolor: '#fff',
          borderRadius: '6px',
          '& fieldset': { borderColor: invalido ? '#d97706' : activo ? 'primary.main' : '#d5dce6' },
          '&:hover fieldset': { borderColor: invalido ? '#d97706' : 'primary.main' },
          '&.Mui-focused fieldset': { borderWidth: 1.5, borderColor: invalido ? '#d97706' : 'primary.main' },
        },
        '& .MuiOutlinedInput-input': {
          py: 0,
          px: 0.75,
          textAlign: 'right',
          fontWeight: 700,
          fontSize: 13,
          color: invalido ? '#9a3412' : activo ? 'primary.main' : '#64748b',
          fontVariantNumeric: 'tabular-nums',
          '&::placeholder': { color: '#c5cdd8', opacity: 1, fontWeight: 600 },
        },
      }}
    />
  );
}

export function AplicarSaldoNotaCreditoDialog({
  open,
  documentoId,
  contactoId,
  tipoDocumento,
  folio,
  clienteNombre,
  usuarioId,
  onClose,
  onSaved,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendientesQuitar, setPendientesQuitar] = useState<Set<number>>(() => new Set());
  const [confirmacion, setConfirmacion] = useState<AplicacionOperacion | null>(null);
  const [omitirConfirmacion, setOmitirConfirmacion] = useState(false);
  const [saldoDocumento, setSaldoDocumento] = useState<DocumentoSaldo | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [facturas, setFacturas] = useState<EstadoCuentaItem[]>([]);
  const [montos, setMontos] = useState<Record<number, number>>({});

  const moneda = String(saldoDocumento?.moneda || 'MXN').toUpperCase();
  const formatter = useMemo(() => {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, minimumFractionDigits: 2 });
    } catch {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
    }
  }, [moneda]);

  const tipoDestino = String(tipoDocumento).toLowerCase() === 'nota_credito_compra' ? 'factura_compra' : 'factura';
  const saldoDisponible = Number(saldoDocumento?.saldo ?? 0);
  const totalNota = Number(saldoDocumento?.total ?? 0);
  const tipoCambio = Math.abs(Number(saldoDocumento?.tipo_cambio || 1)) || 1;
  const aplicacionesPrevias = aplicaciones.filter((item) => Number(item.documento_origen_id) === documentoId);
  const yaAplicado = roundMoney(aplicacionesPrevias.reduce((sum, item) => sum + Number(item.monto_moneda_documento || item.monto || 0), 0));
  const recuperadoPorDestino = new Map<number, number>();
  for (const item of aplicacionesPrevias) {
    if (!pendientesQuitar.has(item.id)) continue;
    const destinoId = Number(item.documento_destino_id);
    if (!destinoId) continue;
    const monto = Number(item.monto_moneda_documento || item.monto || 0);
    recuperadoPorDestino.set(destinoId, roundMoney((recuperadoPorDestino.get(destinoId) ?? 0) + monto));
  }
  const saldoRecuperado = roundMoney([...recuperadoPorDestino.values()].reduce((sum, monto) => sum + monto, 0));
  const saldoOperable = roundMoney(saldoDisponible + saldoRecuperado);
  const yaAplicadoVisible = roundMoney(yaAplicado - saldoRecuperado);
  const facturasOperables: EstadoCuentaItem[] = facturas.map((factura) => {
    const extra = recuperadoPorDestino.get(factura.id) ?? 0;
    if (!(extra > 0)) return factura;
    return { ...factura, saldo: roundMoney(Number(factura.saldo ?? 0) + extra) };
  });
  const idsVisibles = new Set(facturasOperables.map((factura) => factura.id));
  for (const [destinoId, monto] of recuperadoPorDestino) {
    if (idsVisibles.has(destinoId)) continue;
    const origen = aplicacionesPrevias.find((item) => Number(item.documento_destino_id) === destinoId);
    facturasOperables.push({
      id: destinoId,
      contacto_id: contactoId,
      empresa_id: 0,
      origen: 'documento',
      tipo: tipoDestino,
      moneda,
      monto: Number(origen?.total_documento ?? 0),
      saldo: monto,
      fecha: origen?.fecha_documento || '',
      serie: origen?.serie ?? null,
      numero: origen?.numero ?? null,
    });
    idsVisibles.add(destinoId);
  }
  const lineas = facturasOperables.map((factura) => ({
    saldoPendiente: Number(factura.saldo ?? 0),
    aplicar: Number(montos[factura.id] ?? 0),
  }));
  const resumen = resumirDistribucionSaldo(saldoOperable, lineas);
  const hayCambiosPendientes = resumen.totalAplicar > 0.000001 || pendientesQuitar.size > 0;
  const puedeGuardar = hayCambiosPendientes && !resumen.excedeFactura && !resumen.excedeNota;
  const cargaFallida = Boolean(error && !saldoDocumento);

  const publicarCarga = (
    saldoData: DocumentoSaldo | null,
    aplicacionesData: AplicacionOperacion[] | null,
    estadoCuenta: EstadoCuentaItem[] | null,
  ) => {
    setSaldoDocumento(saldoData);
    setAplicaciones(aplicacionesData ?? []);
    const candidatas = filtrarFacturasCandidatas(estadoCuenta ?? [], {
      notaCreditoId: documentoId,
      tipoDestino,
      moneda: String(saldoData?.moneda || 'MXN'),
      tratamientoImpuestos: saldoData?.tratamiento_impuestos,
    });
    const porId = new Map((estadoCuenta ?? []).map((item) => [Number(item.id), item]));
    setFacturas(candidatas.map((item) => porId.get(item.id)).filter((item): item is EstadoCuentaItem => Boolean(item)));
  };

  const leerDatos = () => Promise.all([
    fetchSaldoDocumento(documentoId),
    fetchAplicacionesDocumento(documentoId),
    fetchEstadoCuenta(contactoId),
  ] as const);

  useEffect(() => {
    if (!open) return;
    let activo = true;
    setMontos({});
    setPendientesQuitar(new Set());
    setConfirmacion(null);
    setOmitirConfirmacion(false);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const [saldoData, aplicacionesData, estadoCuenta] = await leerDatos();
        if (!activo) return;
        publicarCarga(saldoData, aplicacionesData, estadoCuenta);
      } catch (err: any) {
        if (!activo) return;
        setError(err?.message || 'No se pudo cargar el saldo de la nota de crédito');
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [open, documentoId, contactoId, tipoDestino]);

  const asignarMonto = (facturaId: number, valor: number) => {
    setMontos((prev) => ({ ...prev, [facturaId]: valor > 0 ? valor : 0 }));
  };

  const aplicarMaximo = (factura: EstadoCuentaItem) => {
    const actual = Number(montos[factura.id] ?? 0);
    const sugerido = sugerirAplicacion(Number(factura.saldo ?? 0), saldoOperable, actual, resumen.totalAplicar);
    asignarMonto(factura.id, sugerido);
  };

  const marcarParaQuitar = (id: number) => {
    setPendientesQuitar((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const conservarAplicacion = (id: number) => {
    setPendientesQuitar((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const solicitarQuitar = (item: AplicacionOperacion) => {
    if (guardando) return;
    if (pendientesQuitar.has(item.id)) {
      conservarAplicacion(item.id);
      return;
    }
    if (omiteConfirmacionQuitarAplicacion(usuarioId)) {
      marcarParaQuitar(item.id);
      return;
    }
    setOmitirConfirmacion(false);
    setConfirmacion(item);
  };

  const rechazarQuitar = () => {
    setConfirmacion(null);
    setOmitirConfirmacion(false);
  };

  const aceptarQuitar = () => {
    if (!confirmacion) return;
    if (debeGuardarOmitirConfirmacion(true, omitirConfirmacion)) {
      guardarOmitirConfirmacionQuitarAplicacion(usuarioId);
    }
    marcarParaQuitar(confirmacion.id);
    setConfirmacion(null);
    setOmitirConfirmacion(false);
  };

  const guardar = async () => {
    if (!puedeGuardar || guardando) return;
    const aplicacionesNuevas = facturasOperables
      .map((factura) => {
        const aplicar = Number(montos[factura.id] ?? 0);
        if (!(aplicar > 0)) return null;
        return {
          documento_destino_id: factura.id,
          ...montosAplicacion(aplicar, tipoCambio),
          fecha_aplicacion: fechaAplicacion(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (aplicacionesNuevas.length === 0 && pendientesQuitar.size === 0) return;

    try {
      setGuardando(true);
      setError(null);
      await aplicarSaldoNotaCredito(documentoId, {
        aplicaciones: aplicacionesNuevas,
        quitar: [...pendientesQuitar],
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'No se pudieron guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  const mensajeTope = resumen.excedeNota
    ? 'El total a aplicar excede el saldo disponible de la nota de crédito.'
    : resumen.excedeFactura
      ? 'Hay un importe mayor al saldo pendiente de la factura.'
      : null;

  const confirmacionFolio = confirmacion
    ? (formatearFolioDocumento(confirmacion.serie || '', confirmacion.numero || 0) || 'la factura')
    : '';
  const confirmacionImporte = confirmacion
    ? formatter.format(Number(confirmacion.monto_moneda_documento || confirmacion.monto || 0))
    : '';

  return (
    <>
    <Dialog
      open={open}
      onClose={guardando ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 2,
          maxHeight: fullScreen ? '100%' : 'calc(100% - 48px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ px: 2.5, pt: 1.75, pb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
              Aplicar saldo
            </Typography>
            <Typography noWrap sx={{ mt: 0.45, fontSize: 13, fontWeight: 500, color: '#475569', lineHeight: 1.3 }}>
              {folio || `#${documentoId}`}
              <Box component="span" sx={{ mx: 0.75, color: '#cbd5e1' }}>·</Box>
              {clienteNombre || 'Sin cliente'}
            </Typography>
          </Box>
          <IconButton aria-label="Cerrar" onClick={onClose} disabled={guardando} size="small" sx={{ mt: -0.25 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pt: 0, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {!cargaFallida && <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            border: '1px solid #e5eaf1',
            borderRadius: 1.5,
            bgcolor: '#f8fafc',
            overflow: 'hidden',
          }}
        >
          <CifraOperacion label="Disponible" value={formatter.format(saldoOperable)} tono="base" />
          <Box sx={{ width: '1px', bgcolor: '#e5eaf1', my: 1.15 }} />
          <CifraOperacion
            label="A aplicar"
            value={formatter.format(resumen.totalAplicar)}
            tono={resumen.totalAplicar > 0 ? 'activa' : 'vacia'}
          />
          <Box sx={{ width: '1px', bgcolor: '#e5eaf1', my: 1.15 }} />
          <CifraOperacion
            label="Restante"
            value={formatter.format(resumen.saldoRestante)}
            tono={resumen.excedeNota ? 'alerta' : 'base'}
          />
        </Box>}

        {aplicacionesPrevias.length > 0 && (
          <Box sx={{ border: '1px solid #e5eaf1', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 0.7, bgcolor: '#f8fafc', borderBottom: '1px solid #e5eaf1' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                Aplicaciones previas · {formatter.format(yaAplicadoVisible)} de {formatter.format(totalNota)}
              </Typography>
            </Box>
            <Box sx={{ maxHeight: 112, overflow: 'auto' }}>
              <Table size="small">
                <TableBody>
                  {aplicacionesPrevias.map((item) => {
                    const folioFactura = formatearFolioDocumento(item.serie || '', item.numero || 0) || 'Factura';
                    const marcada = pendientesQuitar.has(item.id);
                    return (
                      <TableRow key={item.id} sx={{ bgcolor: marcada ? '#f8fafc' : '#fff' }}>
                        <TableCell sx={{ ...cellSx, color: marcada ? '#94a3b8' : '#334155', textDecoration: marcada ? 'line-through' : 'none' }}>{folioFactura}</TableCell>
                        <TableCell sx={{ ...cellSx, color: marcada ? '#b45309' : '#64748b', fontWeight: marcada ? 700 : 500 }}>
                          {marcada ? 'Se quitará al guardar' : formatDateShort(item.fecha_aplicacion || item.fecha_documento)}
                        </TableCell>
                        <TableCell align="right" sx={{ ...cellSx, fontWeight: 700, color: marcada ? '#94a3b8' : '#334155', textDecoration: marcada ? 'line-through' : 'none' }}>{formatter.format(Number(item.monto_moneda_documento || item.monto || 0))}</TableCell>
                        <TableCell align="right" sx={{ ...cellSx, width: 44, px: 0.5, py: 0.15 }}>
                          <Tooltip title={marcada ? 'Conservar aplicación' : 'Desaplicar saldo'}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={marcada ? `Conservar aplicación de ${folioFactura}` : `Desaplicar saldo de ${folioFactura}`}
                                disabled={guardando}
                                onClick={() => solicitarQuitar(item)}
                                sx={{
                                  width: 28,
                                  height: 28,
                                  color: marcada ? '#475569' : '#dc2626',
                                  '&:hover': { color: marcada ? 'primary.main' : '#b91c1c', bgcolor: marcada ? (theme: Theme) => theme.emphasys.action.hoverTint : 'rgba(220, 38, 38, 0.08)' },
                                }}
                              >
                                {marcada
                                  ? <UndoIcon sx={{ fontSize: 18 }} />
                                  : <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
        {mensajeTope && <Alert severity="warning" sx={{ py: 0 }}>{mensajeTope}</Alert>}

        {loading ? (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">Cargando facturas pendientes…</Typography>
          </Stack>
        ) : cargaFallida ? null : (
          <Box sx={{ border: '1px solid #e5eaf1', borderRadius: 1.5, overflow: 'auto', maxHeight: { xs: 'calc(100vh - 292px)', sm: 'min(460px, calc(100vh - 292px))' } }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Factura</TableCell>
                  <TableCell sx={headSx}>Fecha</TableCell>
                  <TableCell align="right" sx={headSx}>Total</TableCell>
                  <TableCell align="right" sx={headSx} title="Clic en el saldo para capturar el máximo posible">Saldo pendiente</TableCell>
                  <TableCell align="right" sx={headSx}>Aplicar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {facturasOperables.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ ...cellSx, py: 3, textAlign: 'center', color: '#64748b' }}>
                      No hay facturas pendientes de este cliente en {moneda}.
                    </TableCell>
                  </TableRow>
                )}
                {facturasOperables.map((factura, index) => {
                  const folioFactura = formatearFolioDocumento(factura.serie || '', factura.numero || 0) || `#${factura.id}`;
                  const aplicar = Number(montos[factura.id] ?? 0);
                  const excede = aplicar - Number(factura.saldo ?? 0) > 0.000001;
                  return (
                    <TableRow key={factura.id} sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f4f6f8' }}>
                      <TableCell sx={{ ...cellSx, fontWeight: 700, color: 'primary.main' }}>{folioFactura}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#64748b' }}>{formatDateShort(factura.fecha)}</TableCell>
                      <TableCell align="right" sx={{ ...cellSx, color: '#475569' }}>{formatter.format(Number(factura.monto || 0))}</TableCell>
                      <TableCell align="right" sx={cellSx}>
                        <Box
                          component="button"
                          type="button"
                          tabIndex={-1}
                          title={`Aplicar ${formatter.format(sugerirAplicacion(Number(factura.saldo ?? 0), saldoOperable, aplicar, resumen.totalAplicar))}`}
                          aria-label={`Capturar el máximo posible de ${folioFactura}`}
                          disabled={guardando || saldoOperable <= 0}
                          onClick={() => aplicarMaximo(factura)}
                          sx={{
                            border: 0,
                            p: 0,
                            m: 0,
                            width: '100%',
                            bgcolor: 'transparent',
                            cursor: 'pointer',
                            font: 'inherit',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'primary.main',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            '&:hover': { textDecoration: 'underline' },
                            '&:disabled': { color: '#94a3b8', cursor: 'default', textDecoration: 'none' },
                          }}
                        >
                          {formatter.format(Number(factura.saldo || 0))}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        <CapturaImporte
                          valor={aplicar}
                          invalido={excede}
                          disabled={guardando || saldoOperable <= 0}
                          ariaLabel={`Aplicar a ${folioFactura}`}
                          onCommit={(valor) => asignarMonto(factura.id, valor)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <Box
        sx={{
          px: 2.5,
          py: 1.25,
          borderTop: '1px solid #e5eaf1',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          bgcolor: '#fff',
        }}
      >
        <Button onClick={onClose} disabled={guardando} sx={{ textTransform: 'none', fontWeight: 700, color: '#475569' }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => void guardar()}
          disabled={!puedeGuardar || guardando || loading}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: 'primary.main', minWidth: 112, boxShadow: 'none' }}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </Box>
    </Dialog>
    <Dialog open={Boolean(confirmacion)} onClose={rechazarQuitar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700, color: 'primary.main', pb: 1 }}>
        Quitar aplicación
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#334155', lineHeight: 1.5 }}>
          ¿Quitar la aplicación de {confirmacionImporte} a la factura {confirmacionFolio}? La nota de crédito y la factura se conservan. El cambio queda pendiente hasta Guardar.
        </Typography>
        <FormControlLabel
          sx={{ mt: 1.75, mx: 0, alignItems: 'center' }}
          control={(
            <Checkbox
              size="small"
              checked={omitirConfirmacion}
              onChange={(event) => setOmitirConfirmacion(event.target.checked)}
              sx={{ py: 0.25 }}
            />
          )}
          label={(
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>
              No volver a mostrar esta ventana
            </Typography>
          )}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 0.5, gap: 1 }}>
        <Button onClick={rechazarQuitar} sx={{ textTransform: 'none', fontWeight: 700, color: '#475569' }}>
          No quitar aplicación
        </Button>
        <Button
          variant="contained"
          onClick={aceptarQuitar}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#dc2626', boxShadow: 'none', '&:hover': { bgcolor: '#b91c1c' } }}
        >
          Quitar aplicación
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

export default AplicarSaldoNotaCreditoDialog;
