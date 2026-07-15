import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { ApiFetchError } from '../../services/apiFetch';
import {
  contabilizarFacturasVentaLote,
  type AgrupacionLoteVenta,
  type ResultadoLoteVenta,
} from '../../services/facturaVentaContabilizacionService';
import { fetchTiposPoliza } from '../../services/tiposPolizaService';
import { fetchConfiguracionTiposAutomaticos } from '../../services/contabilidadService';

interface ContabilizarFacturasVentaLoteDialogProps {
  open: boolean;
  onClose: () => void;
  onContabilizado?: () => void;
}

export default function ContabilizarFacturasVentaLoteDialog({
  open,
  onClose,
  onContabilizado,
}: ContabilizarFacturasVentaLoteDialogProps) {
  const navigate = useNavigate();
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [agrupacion, setAgrupacion] = useState<AgrupacionLoteVenta>('individual');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLoteVenta | null>(null);
  // Ya no se pregunta el tipo de póliza aquí: se resuelve desde Configuración
  // contable → Tipos automáticos.
  const [tipoPolizaIdentificador, setTipoPolizaIdentificador] = useState<string | null>(null);
  const [tipoPolizaResuelto, setTipoPolizaResuelto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFechaDesde('');
    setFechaHasta('');
    setAgrupacion('individual');
    setError(null);
    setResultado(null);
    setTipoPolizaIdentificador(null);
    setTipoPolizaResuelto(false);

    Promise.all([fetchConfiguracionTiposAutomaticos(), fetchTiposPoliza(true)])
      .then(([configuraciones, tiposPoliza]) => {
        const tipoPolizaVentaFacturaId = configuraciones.find(
          (c) => c.clave_movimiento === 'venta_factura'
        )?.tipo_poliza_id;
        // contabilidad.tipos_poliza.id es bigserial: node-pg lo regresa como
        // string aunque TipoPoliza.id esté tipado como number. Se normaliza
        // con Number(...) en ambos lados para que la comparación no falle
        // silenciosamente contra el number real que ya castea el backend.
        const tipoConfigurado = tiposPoliza.find((t) => Number(t.id) === Number(tipoPolizaVentaFacturaId));
        setTipoPolizaIdentificador(tipoConfigurado?.identificador ?? null);
        setTipoPolizaResuelto(true);
      })
      .catch(() => setTipoPolizaResuelto(true));
  }, [open]);

  const puedeEjecutar =
    Boolean(fechaDesde) && Boolean(fechaHasta) && Boolean(tipoPolizaIdentificador) && !procesando;

  const handleEjecutar = async () => {
    if (!puedeEjecutar) return;
    setProcesando(true);
    setError(null);
    try {
      const resultadoLote = await contabilizarFacturasVentaLote({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        agrupacion,
      });
      setResultado(resultadoLote);
      onContabilizado?.();
    } catch (err) {
      const apiError = err as ApiFetchError;
      setError(apiError.message || 'No se pudo contabilizar el lote de facturas de venta.');
    } finally {
      setProcesando(false);
    }
  };

  const resumen = resultado?.resumen;
  const errores = resultado?.resultados.filter((r) => r.estado === 'error') ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Contabilizar ventas</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Typography variant="body2" color="text.secondary">
            Contabiliza la emisión de todas las facturas de venta estándar, timbradas y no contabilizadas dentro del
            rango de fechas. Las notas de venta y facturas canceladas quedan excluidas automáticamente.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fecha desde"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              disabled={procesando}
            />
            <TextField
              label="Fecha hasta"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              disabled={procesando}
            />
          </Stack>

          {tipoPolizaResuelto && tipoPolizaIdentificador && (
            <Typography variant="body2" color="text.secondary">
              Tipo de póliza: <strong>{tipoPolizaIdentificador}</strong>
            </Typography>
          )}

          {tipoPolizaResuelto && !tipoPolizaIdentificador && (
            <Alert
              severity="warning"
              action={
                <Button size="small" onClick={() => navigate('/contabilidad/configuracion?seccion=tipos-automaticos')}>
                  Ir a Configuración
                </Button>
              }
            >
              Falta configurar el tipo de póliza para facturas de venta.
            </Alert>
          )}

          <Stack spacing={1}>
            <Typography variant="subtitle2" fontWeight={700} color="#1d2f68">
              Agrupación
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={agrupacion}
              onChange={(_, value) => value && setAgrupacion(value)}
              disabled={procesando}
            >
              <ToggleButton value="individual">Una póliza por factura</ToggleButton>
              <ToggleButton value="concentrado">Póliza concentrada</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {resultado && resumen && (
            <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2 }}>
              <Typography variant="body2" fontWeight={700} gutterBottom>
                Resultado: {resumen.total_en_rango} factura(s) en rango, {resumen.contabilizadas} contabilizada(s),{' '}
                {resumen.omitidas_ya_contabilizadas} omitida(s) por ya contabilizadas, {resumen.con_error} con error.
              </Typography>
              {resultado.mensaje && (
                <Alert severity="info" sx={{ mt: 1 }}>{resultado.mensaje}</Alert>
              )}
              {resultado.polizas && resultado.polizas.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Pólizas generadas: {resultado.polizas.map((p) => `${p.tipo_poliza_identificador} ${p.numero}`).join(', ')}
                </Typography>
              )}
              {errores.length > 0 && (
                <Stack spacing={0.5} mt={1}>
                  {errores.map((r) => (
                    <Typography key={r.documento_id} variant="caption" color="error">
                      Documento #{r.documento_id}: {r.motivo}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
        {!resultado && (
          <Button variant="contained" disabled={!puedeEjecutar} onClick={() => void handleEjecutar()}>
            {procesando ? 'Procesando…' : 'Contabilizar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
