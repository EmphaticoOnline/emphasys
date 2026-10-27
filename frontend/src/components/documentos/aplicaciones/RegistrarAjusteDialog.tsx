// Registrar un ajuste pequeño (redondeos, centavos; no más de $99.00):
// - Desde Facturas: crea un ajuste de saldo y lo aplica a la factura.
// - Desde Pagos o Notas de crédito: cancela el saldo a favor (lo por aplicar o
//   el disponible) que no se quiere seguir arrastrando.
// El tope es sólo de frontend: será configurable por empresa.
import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { createDocumento } from '../../../services/documentosService';
import { cancelarSaldoFavor } from '../../../services/finanzasService';
import type { CotizacionCrearPayload, CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import { getEmpresaActivaId } from '../../../utils/empresaUtils';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import { FechaInput } from '../../../shared/dates/DateFields';
import { currency, redondear } from '../partidas/PartidasDocumentoTabla';

/** Monto máximo de un ajuste registrado desde aquí. */
export const LIMITE_AJUSTE = 99;

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

function FilaSaldo({ label, value, fuerte = false, tono }: { label: string; value: string; fuerte?: boolean; tono?: string | undefined }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.35 }}>
      <Typography sx={(theme) => ({ fontSize: 13, color: fuerte ? theme.emphasys.content.foreground : theme.emphasys.content.muted, fontWeight: fuerte ? 700 : 500 })}>
        {label}
      </Typography>
      <Typography
        variant={fuerte ? 'figure' : 'body2'}
        sx={(theme) => ({ fontSize: fuerte ? 20 : 14, fontWeight: fuerte ? 400 : 600, fontVariantNumeric: 'tabular-nums', color: tono ?? theme.emphasys.content.foreground })}
      >
        {value}
      </Typography>
    </Box>
  );
}

const normalizar = (value: unknown) => String(value ?? '').trim().toLowerCase();

/**
 * Por qué no se puede registrar un ajuste sobre el documento, o null si sí se
 * puede. Replica las reglas que valida el backend al aplicar saldo, para que
 * el botón se deshabilite con su motivo en lugar de fallar al guardar.
 */
export function razonNoAjustable(row: CotizacionListado | null | undefined, tipoDocumento: string): string | null {
  if (!row) return 'Selecciona un documento.';
  const tipo = normalizar(tipoDocumento);
  const estatus = normalizar(row.estatus_documento);
  const saldo = Number(row.saldo ?? 0);
  const cancelado = estatus === 'cancelado' || estatus === 'cancelada';
  const sinIva = normalizar(row.tratamiento_impuestos) === 'sin_iva';

  if (tipo.startsWith('pago_')) {
    if (cancelado) return 'El pago está cancelado.';
    if (saldo <= 0) return 'El pago no tiene saldo por aplicar.';
    return null;
  }

  if (tipo === 'nota_credito_compra' || tipo === 'nota_credito') {
    if (cancelado) return 'La nota de crédito está cancelada.';
    if (tipo === 'nota_credito_compra' || sinIva) {
      if (estatus !== 'emitido') return 'La nota de crédito debe estar emitida antes de aplicar saldo.';
    } else if (estatus !== 'timbrado' || !row.cfdi_uuid) {
      return 'La nota de crédito debe estar timbrada antes de aplicar saldo.';
    }
    if (saldo <= 0) return 'La nota de crédito no tiene saldo disponible.';
    return null;
  }

  // Facturas de venta y de compra.
  if (cancelado) return 'La factura está cancelada.';
  if (estatus === 'borrador') return 'La factura está en borrador.';
  if (tipo === 'factura_compra' && estatus !== 'emitido') return 'La factura de compra debe estar confirmada.';
  if (tipo === 'factura' && !sinIva && !row.cfdi_uuid) return 'La factura no tiene un CFDI timbrado y vigente.';
  if (row.cobro_bloqueado) return 'Saldo suspendido por cancelación pendiente.';
  if (Number(row.contacto_principal_id ?? 0) <= 0) return 'Documento sin contacto principal.';
  if (saldo <= 0) return 'La factura ya está liquidada.';
  return null;
}

/** Textos de cada caso; la mecánica de la ventana es la misma. */
function textosDe(tipoDocumento: string) {
  const tipo = tipoDocumento.toLowerCase();
  const esCompra = tipo === 'factura_compra' || tipo === 'pago_proveedor' || tipo === 'nota_credito_compra';
  if (tipo.startsWith('pago_') || tipo.startsWith('nota_credito')) {
    const esPago = tipo.startsWith('pago_');
    const saldo = esPago ? 'Por aplicar' : 'Disponible';
    return {
      saldoAFavor: true,
      eyebrow: 'CANCELACIÓN DE SALDO A FAVOR',
      campo: 'Monto a cancelar',
      saldo,
      despues: `${saldo} después del ajuste`,
      liquidar: 'Cancelar todo el sobrante',
      sinSaldo: esPago ? 'El pago no tiene saldo por aplicar.' : 'La nota de crédito no tiene saldo disponible.',
      motivoDefault: (folio: string) => `Cancelación de saldo a favor de ${folio}`,
      exito: 'Se canceló el saldo a favor.',
    };
  }
  return {
    saldoAFavor: false,
    eyebrow: esCompra ? 'AJUSTE DE SALDO A PROVEEDOR' : 'AJUSTE DE SALDO DE CLIENTE',
    campo: 'Monto del ajuste',
    saldo: 'Saldo pendiente',
    despues: 'Saldo después del ajuste',
    liquidar: 'Liquidar saldo',
    sinSaldo: 'La factura no tiene saldo pendiente.',
    motivoDefault: (folio: string) => `Ajuste de saldo de ${folio}`,
    exito: 'El ajuste se aplicó a la factura.',
  };
}

export default function RegistrarAjusteDialog({
  open,
  factura,
  tipoDocumento,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Documento a ajustar: factura (baja su saldo) o pago / nota de crédito (cancela su saldo a favor). */
  factura: CotizacionListado | null;
  tipoDocumento: TipoDocumento;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const [monto, setMonto] = React.useState('');
  const [fecha, setFecha] = React.useState(hoy());
  const [motivo, setMotivo] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setMonto('');
    setFecha(hoy());
    setMotivo('');
    setError(null);
  }, [open, factura?.id]);

  if (!factura) return null;

  // Si el documento no admite ajuste se avisa al abrir, con su motivo, en lugar
  // de dejar capturar y fallar al guardar.
  const razon = razonNoAjustable(factura, tipoDocumento);
  if (razon) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, bgcolor: tokens.content.background } }}>
        <DialogContent sx={{ px: 3, pt: 3.5, pb: 1.5, textAlign: 'center' }}>
          <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 1.5, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: tokens.metric.blocked.background, color: tokens.content.foreground }}>
            <BalanceOutlinedIcon />
          </Box>
          <Typography variant="figure" sx={{ display: 'block', fontSize: 20, color: tokens.content.foreground, mb: 0.75 }}>
            No se puede registrar el ajuste
          </Typography>
          <Typography sx={{ fontSize: 14, color: tokens.content.secondary }}>{razon}</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2.75, pt: 1 }}>
          <Button
            variant="contained"
            disableElevation
            autoFocus
            onClick={onClose}
            sx={{ minWidth: 140, borderRadius: '10px', fontWeight: 700, letterSpacing: '0.04em', bgcolor: tokens.action.primary, '&:hover': { bgcolor: tokens.action.primaryHover } }}
          >
            ENTENDIDO
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const textos = textosDe(tipoDocumento);
  const esCompra = tipoDocumento === 'factura_compra';
  const tipoAjuste: TipoDocumento = esCompra ? 'ajuste_proveedor' : 'ajuste_cliente';
  const folio = resolverFolioVisual(factura, tipoDocumento) || `#${factura.id}`;
  const saldo = redondear(Math.max(0, Number(factura.saldo ?? 0)));
  const maximo = redondear(Math.min(LIMITE_AJUSTE, saldo));
  const valor = redondear(Number(monto) || 0);
  const saldoDespues = redondear(saldo - valor);

  const errorMonto = !monto
    ? null
    : valor <= 0
      ? 'Captura un monto mayor a cero.'
      : valor > LIMITE_AJUSTE
        ? `Un ajuste no puede ser mayor a ${currency.format(LIMITE_AJUSTE)}.`
        : valor > saldo
          ? `No puede ser mayor al saldo (${currency.format(saldo)}).`
          : null;
  const puedeGuardar = valor > 0 && !errorMonto && Boolean(fecha) && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      if (textos.saldoAFavor) {
        await cancelarSaldoFavor(Number(factura.id), { monto: valor, fecha, motivo: motivo.trim() || textos.motivoDefault(folio) });
        await onSaved();
        onClose();
        return;
      }
      // El ajuste no lleva IVA: es una diferencia de saldo, igual que los ajustes capturados a mano.
      const payload = {
        tipo_documento: tipoAjuste,
        empresa_id: getEmpresaActivaId(),
        contacto_principal_id: factura.contacto_principal_id,
        fecha_documento: fecha,
        moneda: factura.moneda || 'MXN',
        tipo_cambio: 1,
        subtotal: valor,
        iva: 0,
        total: valor,
        tratamiento_impuestos: 'normal',
        observaciones: motivo.trim() || textos.motivoDefault(folio),
        aplicaciones_documento: [{
          documento_destino_id: Number(factura.id),
          monto: valor,
          monto_moneda_documento: valor,
          fecha_aplicacion: fecha,
        }],
      } as unknown as CotizacionCrearPayload;
      await createDocumento(tipoAjuste, payload);
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudo registrar el ajuste.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={guardando ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', bgcolor: tokens.content.background } }}
    >
      {/* Encabezado */}
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, display: 'flex', alignItems: 'flex-start', gap: 1.5, borderBottom: `1px solid ${tokens.content.border}` }}>
        <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: tokens.action.primary, color: tokens.action.primaryForeground }}>
          <BalanceOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted }}>
            {textos.eyebrow}
          </Typography>
          <Typography variant="figure" sx={{ display: 'block', fontSize: 22, lineHeight: 1.15, color: tokens.content.foreground }}>
            Registrar ajuste
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.content.secondary, mt: 0.25 }} noWrap>
            {folio} · {factura.nombre_cliente || 'Sin contacto'}
          </Typography>
        </Box>
        <IconButton size="small" aria-label="Cerrar" onClick={onClose} disabled={guardando}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Stack spacing={2}>
          <TextField
            autoFocus
            label={textos.campo}
            value={monto}
            onChange={(event) => setMonto(event.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={(event) => { if (event.key === 'Enter') void guardar(); }}
            inputMode="decimal"
            error={Boolean(errorMonto)}
            helperText={errorMonto ?? `Máximo ${currency.format(LIMITE_AJUSTE)} por ajuste.`}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
              sx: { fontSize: 22, fontVariantNumeric: 'tabular-nums' },
            }}
            fullWidth
          />

          {maximo > 0 ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {saldo <= LIMITE_AJUSTE ? (
                <Chip label={`${textos.liquidar} · ${currency.format(saldo)}`} onClick={() => setMonto(saldo.toFixed(2))} size="small" variant="outlined" />
              ) : null}
              {saldo % 1 !== 0 && saldo > LIMITE_AJUSTE ? (
                <Chip label={`Quitar centavos · ${currency.format(redondear(saldo % 1))}`} onClick={() => setMonto(redondear(saldo % 1).toFixed(2))} size="small" variant="outlined" />
              ) : null}
            </Stack>
          ) : (
            <Alert severity="info">{textos.sinSaldo}</Alert>
          )}

          <FechaInput
            label="Fecha del ajuste"
            value={fecha}
            onChange={(value) => setFecha(value ?? '')}
            slotProps={{ textField: { fullWidth: true } }}
          />

          <TextField
            label="Motivo"
            placeholder="Ej. Diferencia por redondeo"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          {/* Así queda el saldo */}
          <Box sx={{ borderRadius: 2, px: 1.75, py: 1.25, bgcolor: tokens.content.well, border: `1px solid ${tokens.content.border}` }}>
            <FilaSaldo label={textos.saldo} value={currency.format(saldo)} />
            <FilaSaldo label="Ajuste" value={valor > 0 ? `−${currency.format(valor)}` : '—'} />
            <Box sx={{ borderTop: `1px solid ${tokens.content.border}`, mt: 0.5, pt: 0.5 }}>
              <FilaSaldo
                label={textos.despues}
                value={currency.format(Math.max(0, saldoDespues))}
                fuerte
                tono={!errorMonto && valor > 0 && saldoDespues <= 0 ? tokens.metric.applied.foreground : undefined}
              />
            </Box>
          </Box>

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.25, pt: 1, gap: 1 }}>
        <Button onClick={onClose} disabled={guardando} sx={{ textTransform: 'none', color: tokens.content.secondary }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={() => { void guardar(); }}
          disabled={!puedeGuardar}
          startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <BalanceOutlinedIcon fontSize="small" />}
          sx={{ textTransform: 'none', borderRadius: '10px', px: 2, bgcolor: tokens.action.primary, '&:hover': { bgcolor: tokens.action.primaryHover } }}
        >
          {guardando ? 'Registrando…' : 'Registrar ajuste'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
