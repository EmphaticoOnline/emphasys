import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  aplicarAnticiposDocumento,
  fetchAnticiposDisponiblesDocumento,
  fetchSaldoDocumento,
} from '../../services/finanzasService';
import type {
  AnticipoDisponible,
  DocumentoAnticiposDisponibles,
} from '../../types/finanzas';

const toCivilDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateShort = (value?: string | null) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const buildApplyAllPlan = (anticipos: AnticipoDisponible[], saldoFactura: number) => {
  let remaining = Math.max(Number(saldoFactura || 0), 0);
  const next: Record<number, string> = {};
  anticipos.forEach((anticipo) => {
    const available = Math.max(Number(anticipo.monto_disponible || 0), 0);
    const amount = Math.min(available, remaining);
    next[anticipo.finanzas_operacion_id] = amount > 0 ? String(Number(amount.toFixed(2))) : '';
    remaining -= amount;
  });
  return next;
};

type AnticiposAplicacionDialogProps = {
  open: boolean;
  documentoOrigenId: number | null;
  documentoDestinoId: number | null;
  documentoDestinoTipo: string | null;
  initialData?: DocumentoAnticiposDisponibles | null;
  onSkip: () => void;
  onApplied: () => void;
  onClose: () => void;
};

export function AnticiposAplicacionDialog({
  open,
  documentoOrigenId,
  documentoDestinoId,
  documentoDestinoTipo,
  initialData,
  onSkip,
  onApplied,
  onClose,
}: AnticiposAplicacionDialogProps) {
  const [data, setData] = useState<DocumentoAnticiposDisponibles | null>(initialData ?? null);
  const [saldoFactura, setSaldoFactura] = useState<number>(0);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  useEffect(() => {
    if (!open || !documentoOrigenId || !documentoDestinoId) return;

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [anticiposData, saldoData] = await Promise.all([
          initialData ? Promise.resolve(initialData) : fetchAnticiposDisponiblesDocumento(documentoOrigenId),
          fetchSaldoDocumento(documentoDestinoId),
        ]);
        if (cancelled) return;
        setData(anticiposData);
        const nextSaldo = Number(saldoData?.saldo ?? 0);
        setSaldoFactura(nextSaldo);
        setAmounts(buildApplyAllPlan(anticiposData?.anticipos ?? [], nextSaldo));
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'No se pudo cargar anticipos disponibles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, documentoOrigenId, documentoDestinoId, initialData]);

  const anticipos = data?.anticipos ?? [];
  const totalIngresado = useMemo(
    () => Object.values(amounts).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [amounts]
  );

  const handleChangeAmount = (operacionId: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setAmounts((prev) => ({ ...prev, [operacionId]: cleaned }));
  };

  const validatePayload = (aplicaciones: Array<{ finanzas_operacion_id: number; monto: number }>) => {
    if (!documentoOrigenId || !documentoDestinoId) return 'Documento origen o destino inválido';
    if (aplicaciones.length === 0) return 'Captura al menos un monto a aplicar';
    if (aplicaciones.some((item) => !item.monto || Number.isNaN(item.monto) || item.monto <= 0)) {
      return 'Todos los montos deben ser mayores a cero';
    }
    const amountById = new Map(aplicaciones.map((item) => [item.finanzas_operacion_id, item.monto]));
    for (const anticipo of anticipos) {
      const amount = Number(amountById.get(anticipo.finanzas_operacion_id) ?? 0);
      if (amount > Number(anticipo.monto_disponible ?? 0)) {
        return 'Uno de los montos excede el disponible del anticipo';
      }
    }
    const total = aplicaciones.reduce((sum, item) => sum + item.monto, 0);
    if (total > saldoFactura) {
      return 'La suma a aplicar excede el saldo actual de la factura';
    }
    return null;
  };

  const submit = async (nextAmounts: Record<number, string>) => {
    if (!documentoOrigenId || !documentoDestinoId) return;
    const aplicaciones = anticipos
      .map((anticipo) => {
        const amount = Number(nextAmounts[anticipo.finanzas_operacion_id] || 0);
        return {
          finanzas_operacion_id: anticipo.finanzas_operacion_id,
          monto: amount,
          monto_moneda_documento: amount,
          fecha_aplicacion: toCivilDate(),
        };
      })
      .filter((item) => item.monto > 0);

    const validationError = validatePayload(aplicaciones);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await aplicarAnticiposDocumento(documentoOrigenId, {
        documento_destino_id: documentoDestinoId,
        fecha_aplicacion: toCivilDate(),
        aplicaciones,
      });
      onApplied();
    } catch (err: any) {
      setError(err?.message || 'No se pudo aplicar anticipos');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyAll = async () => {
    const nextAmounts = buildApplyAllPlan(anticipos, saldoFactura);
    setAmounts(nextAmounts);
    await submit(nextAmounts);
  };

  const handleApplyPartial = async () => {
    await submit(amounts);
  };

  const destinationLabel = documentoDestinoTipo === 'factura_compra' ? 'factura de compra' : 'factura';

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Aplicar anticipos disponibles</DialogTitle>
      <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="info">
          {`Hay anticipos disponibles por aplicar a esta ${destinationLabel}: ${formatter.format(Number(data?.total_disponible ?? 0))}`}
        </Alert>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Box sx={{ flex: 1, p: 1.5, border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">Saldo actual de la factura</Typography>
            <Typography variant="h6" color="#1d2f68">{formatter.format(saldoFactura)}</Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1.5, border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">Total a aplicar</Typography>
            <Typography variant="h6" color="#006261">{formatter.format(totalIngresado)}</Typography>
          </Box>
        </Stack>

        {loading ? (
          <Typography variant="body2">Cargando anticipos disponibles…</Typography>
        ) : null}

        {!loading && anticipos.length === 0 ? (
          <Alert severity="warning">No hay anticipos disponibles para aplicar.</Alert>
        ) : null}

        {!loading && anticipos.length > 0 ? (
          <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Cuenta</TableCell>
                  <TableCell align="right">Monto total</TableCell>
                  <TableCell align="right">Aplicado</TableCell>
                  <TableCell align="right">Disponible</TableCell>
                  <TableCell align="right">Monto a aplicar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {anticipos.map((anticipo) => (
                  <TableRow key={anticipo.finanzas_operacion_id}>
                    <TableCell>{formatDateShort(anticipo.fecha)}</TableCell>
                    <TableCell>{anticipo.cuenta_identificador || `Cuenta #${anticipo.cuenta_id}`}</TableCell>
                    <TableCell align="right">{formatter.format(Number(anticipo.monto_total || 0))}</TableCell>
                    <TableCell align="right">{formatter.format(Number(anticipo.monto_aplicado || 0))}</TableCell>
                    <TableCell align="right">{formatter.format(Number(anticipo.monto_disponible || 0))}</TableCell>
                    <TableCell align="right" sx={{ width: 180 }}>
                      <TextField
                        size="small"
                        value={amounts[anticipo.finanzas_operacion_id] ?? ''}
                        onChange={(event) => handleChangeAmount(anticipo.finanzas_operacion_id, event.target.value)}
                        inputProps={{ inputMode: 'decimal', min: 0 }}
                        fullWidth
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onSkip} disabled={submitting} sx={{ textTransform: 'none' }}>No aplicar</Button>
        <Button
          onClick={handleApplyPartial}
          disabled={loading || submitting || anticipos.length === 0}
          variant="outlined"
          sx={{ textTransform: 'none' }}
        >
          {submitting ? 'Aplicando…' : 'Aplicar parcial'}
        </Button>
        <Button
          onClick={handleApplyAll}
          disabled={loading || submitting || anticipos.length === 0}
          variant="contained"
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          {submitting ? 'Aplicando…' : 'Aplicar todo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AnticiposAplicacionDialog;