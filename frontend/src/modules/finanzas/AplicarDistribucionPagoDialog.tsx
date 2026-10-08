import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { aplicarDistribucionPago, fetchAplicacionesDocumento, fetchEstadoCuenta, fetchSaldoDocumento } from '../../services/finanzasService';
import type { AplicacionOperacion, DocumentoSaldo, EstadoCuentaItem } from '../../types/finanzas';
import { formatearFolioDocumento } from '../../utils/documentos.utils';

type Props = {
  open: boolean; pagoId: number | null; pagoFolio: string; contactoId?: number | null;
  tipoPago: 'pago_cliente' | 'pago_proveedor'; onClose: () => void; onSaved: () => void | Promise<void>;
};

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const today = () => new Date().toISOString().slice(0, 10);

export function AplicarDistribucionPagoDialog({ open, pagoId, pagoFolio, contactoId, tipoPago, onClose, onSaved }: Props) {
  const [saldo, setSaldo] = useState<DocumentoSaldo | null>(null);
  const [apps, setApps] = useState<AplicacionOperacion[]>([]);
  const [destinos, setDestinos] = useState<EstadoCuentaItem[]>([]);
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [quitar, setQuitar] = useState<Record<number, string>>({});
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destinoTipo = tipoPago === 'pago_proveedor' ? 'factura_compra' : 'factura';
  const previas = apps.filter((a) => a.documento_origen_id === pagoId);

  const cargar = async () => {
    if (!pagoId) return;
    setCargando(true); setError(null);
    try {
      const [s, a, e] = await Promise.all([
        fetchSaldoDocumento(pagoId),
        fetchAplicacionesDocumento(pagoId),
        contactoId ? fetchEstadoCuenta(contactoId) : Promise.resolve([] as EstadoCuentaItem[]),
      ]);
      setSaldo(s); setApps(a ?? []);
      setDestinos((e ?? []).filter((x) => x.origen === 'documento' && x.tipo === destinoTipo && Number(x.saldo ?? 0) > 0));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la distribución.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { if (open) { setMontos({}); setQuitar({}); setMotivoId(null); setMotivo(''); void cargar(); } }, [open, pagoId, contactoId, destinoTipo]);

  const recuperado = useMemo(() => Object.keys(quitar).reduce((sum, id) => sum + Number(previas.find((a) => a.id === Number(id))?.monto_moneda_documento ?? 0), 0), [quitar, previas]);
  const totalNuevo = Object.values(montos).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const disponible = Number(saldo?.saldo ?? 0) + recuperado;
  const aplicacionesValidas = Object.entries(montos).filter(([, value]) => Number(value) > 0);
  const puedeGuardar = !guardando && (aplicacionesValidas.length > 0 || Object.keys(quitar).length > 0) && totalNuevo <= disponible + 0.005;

  const confirmarQuitar = (app: AplicacionOperacion) => { setMotivoId(app.id); setMotivo(''); };
  const aceptarQuitar = () => { if (motivoId && motivo.trim()) { setQuitar((p) => ({ ...p, [motivoId]: motivo.trim() })); setMotivoId(null); } };
  const guardar = async () => {
    if (!pagoId || !puedeGuardar) return;
    setGuardando(true); setError(null);
    try {
      await aplicarDistribucionPago(pagoId, {
        aplicaciones: aplicacionesValidas.map(([id, value]) => ({ documento_destino_id: Number(id), monto: Number(value), monto_moneda_documento: Number(value), fecha_aplicacion: today() })),
        quitar: Object.entries(quitar).map(([id, reason]) => ({ aplicacion_id: Number(id), motivo: reason })),
      });
      await onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la distribución.'); }
    finally { setGuardando(false); }
  };
  return <>
    <Dialog open={open} onClose={guardando ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Aplicar saldo — {pagoFolio}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {cargando ? <Typography>Cargando aplicaciones…</Typography> : <Stack spacing={2}>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Typography>Total: {money.format(Number(saldo?.total ?? 0))}</Typography>
            <Typography>Aplicado: {money.format(Number(saldo?.total ?? 0) - Number(saldo?.saldo ?? 0))}</Typography>
            <Typography>Disponible: {money.format(disponible)}</Typography>
            <Typography>A aplicar: {money.format(totalNuevo)}</Typography>
          </Stack>
          <Divider />
          <Typography variant="subtitle1" fontWeight={700}>Aplicaciones previas</Typography>
          <Table size="small"><TableHead><TableRow><TableCell>Factura</TableCell><TableCell align="right">Monto</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>
            {previas.length === 0 && <TableRow><TableCell colSpan={3}>Sin aplicaciones previas</TableCell></TableRow>}
            {previas.map((a) => { const folio = formatearFolioDocumento(a.serie || '', a.numero || 0); const marcada = Boolean(quitar[a.id]); return <TableRow key={a.id} sx={marcada ? { opacity: .55 } : undefined}><TableCell>{folio}</TableCell><TableCell align="right">{money.format(Number(a.monto_moneda_documento ?? a.monto))}</TableCell><TableCell align="right"><Button size="small" color="error" onClick={() => confirmarQuitar(a)} disabled={marcada}>{marcada ? 'Marcada para quitar' : `Desaplicar saldo de ${folio}`}</Button></TableCell></TableRow>; })}
          </TableBody></Table>
          <Typography variant="subtitle1" fontWeight={700}>Facturas pendientes</Typography>
          <Table size="small"><TableHead><TableRow><TableCell>Documento</TableCell><TableCell align="right">Saldo</TableCell><TableCell align="right">Monto</TableCell></TableRow></TableHead><TableBody>
            {destinos.map((d) => { const recuperadoDestino = previas.filter((a) => a.documento_destino_id === d.id && quitar[a.id]).reduce((s, a) => s + Number(a.monto_moneda_documento ?? a.monto), 0); const saldoDestino = Number(d.saldo ?? 0) + recuperadoDestino; return <TableRow key={d.id}><TableCell>{formatearFolioDocumento(d.serie || '', d.numero || 0)}</TableCell><TableCell align="right">{money.format(saldoDestino)}</TableCell><TableCell align="right"><TextField size="small" type="number" value={montos[d.id] ?? ''} onChange={(e) => setMontos((p) => ({ ...p, [d.id]: e.target.value }))} inputProps={{ min: 0, step: .01 }} /></TableCell></TableRow>; })}
          </TableBody></Table>
          {totalNuevo > disponible && <Alert severity="warning">La distribución excede el disponible recuperado del pago.</Alert>}
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={guardando}>Cancelar</Button><Button variant="contained" onClick={guardar} disabled={!puedeGuardar}>Guardar</Button></DialogActions>
    </Dialog>
    <Dialog open={motivoId !== null} onClose={() => setMotivoId(null)} maxWidth="sm" fullWidth>
      <DialogTitle>Confirmar desaplicación</DialogTitle><DialogContent><Typography sx={{ mb: 1 }}>Se quitará la aplicación seleccionada y el pago recuperará ese disponible.</Typography><TextField autoFocus fullWidth required label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></DialogContent><DialogActions><Button onClick={() => setMotivoId(null)}>Cancelar</Button><Button color="error" variant="contained" onClick={aceptarQuitar} disabled={!motivo.trim()}>Marcar para quitar</Button></DialogActions>
    </Dialog>
  </>;
}
