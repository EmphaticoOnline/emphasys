import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import type { ApiFetchError } from '../../services/apiFetch';
import {
  previsualizarFacturaVenta,
  contabilizarFacturaVenta,
  fetchContabilizacionesDocumento,
  type AsientoFacturaVenta,
  type EstadoContableFacturaVentaInfo,
  type FaltanteCuentaContable,
  type PolizaEncabezadoResumen,
} from '../../services/facturaVentaContabilizacionService';
import { fetchPoliza } from '../../services/polizasService';
import { fetchTiposPoliza } from '../../services/tiposPolizaService';
import { fetchConfiguracionTiposAutomaticos } from '../../services/contabilidadService';

interface ContabilizarFacturaVentaDrawerProps {
  open: boolean;
  onClose: () => void;
  documentoId: number;
  folio?: string;
  // Estado ya calculado para la columna "Estado contable" de la grilla: evita
  // repetir la lógica de elegibilidad o llamar al preview cuando ya sabemos
  // que la factura está contabilizada (mostramos la póliza) o no es
  // contabilizable (mostramos el motivo directo, sin round-trip extra).
  estadoContable?: EstadoContableFacturaVentaInfo | undefined;
  onContabilizado?: () => void;
}

const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

export default function ContabilizarFacturaVentaDrawer({
  open,
  onClose,
  documentoId,
  folio,
  estadoContable,
  onContabilizado,
}: ContabilizarFacturaVentaDrawerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [asiento, setAsiento] = useState<AsientoFacturaVenta | null>(null);
  const [motivoNoContabilizable, setMotivoNoContabilizable] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<FaltanteCuentaContable[] | null>(null);
  // Ya no se pide el tipo de póliza en cada operación: se resuelve desde
  // Configuración contable → Tipos automáticos. null = todavía no se sabe /
  // no está configurado (se distingue con tipoPolizaResuelto).
  const [tipoPolizaIdentificador, setTipoPolizaIdentificador] = useState<string | null>(null);
  const [tipoPolizaResuelto, setTipoPolizaResuelto] = useState(false);
  const [contabilizando, setContabilizando] = useState(false);
  const [polizaVista, setPolizaVista] = useState<PolizaEncabezadoResumen | null>(null);
  const [polizaRecienContabilizada, setPolizaRecienContabilizada] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  useEffect(() => {
    if (!open || !documentoId) return;

    setAsiento(null);
    setMotivoNoContabilizable(null);
    setFaltantes(null);
    setPolizaVista(null);
    setPolizaRecienContabilizada(false);
    setTipoPolizaIdentificador(null);
    setTipoPolizaResuelto(false);

    // Ya sabemos por el estado contable de la grilla que no es contabilizable:
    // mostramos el motivo directo, sin llamar al backend otra vez.
    if (estadoContable?.estado === 'no_contabilizable') {
      setMotivoNoContabilizable(estadoContable.motivo || 'La factura no se puede contabilizar.');
      return;
    }

    // Ya sabemos que está contabilizada: en vez de re-ejecutar el preview
    // (que fallaría con "ya contabilizada"), vamos directo a mostrar la
    // póliza generada.
    if (estadoContable?.estado === 'contabilizada') {
      const cargarPolizaExistente = async () => {
        setLoading(true);
        try {
          const contabilizaciones = await fetchContabilizacionesDocumento(documentoId);
          const activa = contabilizaciones.find((c) => !c.es_reversa && c.evento_contable === 'emision');
          if (!activa) {
            throw new Error('No se encontró la póliza contable de esta factura.');
          }
          const polizaData = await fetchPoliza(activa.poliza_id);
          setAsiento({
            documento_id: documentoId,
            folio: folio || `#${documentoId}`,
            fecha_documento: polizaData.encabezado.fecha,
            movimientos: polizaData.movimientos.map((m) => ({
              cuenta_id: m.cuenta_id,
              cuenta: m.cuenta,
              descripcion: m.cuenta_descripcion,
              cargo: Number(m.cargo),
              abono: Number(m.abono),
              origen: '',
              concepto: m.concepto_texto || m.concepto_descripcion || '',
            })),
            total_cargos: Number(polizaData.encabezado.total_cargos),
            total_abonos: Number(polizaData.encabezado.total_abonos),
          });
          setPolizaVista({
            id: polizaData.encabezado.id,
            numero: polizaData.encabezado.numero,
            tipo_poliza_identificador: polizaData.encabezado.tipo_poliza_identificador,
            fecha: polizaData.encabezado.fecha,
            estatus: polizaData.encabezado.estatus,
            total_cargos: Number(polizaData.encabezado.total_cargos),
            total_abonos: Number(polizaData.encabezado.total_abonos),
            referencia: polizaData.encabezado.referencia,
          });
        } catch (err) {
          setMotivoNoContabilizable((err as Error).message || 'No se pudo obtener la póliza contable de esta factura.');
        } finally {
          setLoading(false);
        }
      };
      void cargarPolizaExistente();
      return;
    }

    // Estado 'pendiente' (o desconocido, ej. la grilla aún no había resuelto
    // el estado contable de esta fila): comportamiento normal de preview, más
    // la resolución del tipo de póliza configurado (Configuración contable →
    // Tipos automáticos), que ya no se pregunta en el drawer.
    const cargar = async () => {
      setLoading(true);
      try {
        const [configuraciones, tiposPoliza, asientoData] = await Promise.all([
          fetchConfiguracionTiposAutomaticos(),
          fetchTiposPoliza(true),
          previsualizarFacturaVenta(documentoId),
        ]);
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
        setAsiento(asientoData);
      } catch (err) {
        const apiError = err as ApiFetchError;
        const faltantesPayload = (apiError.payload as { faltantes?: FaltanteCuentaContable[] } | undefined)?.faltantes;
        if (faltantesPayload && faltantesPayload.length > 0) {
          setFaltantes(faltantesPayload);
        } else {
          setMotivoNoContabilizable(apiError.message || 'La factura no se puede contabilizar.');
        }
      } finally {
        setLoading(false);
      }
    };

    void cargar();
  }, [open, documentoId, estadoContable, folio]);

  const diferencia = useMemo(() => {
    if (!asiento) return 0;
    return Math.round((asiento.total_cargos - asiento.total_abonos) * 100) / 100;
  }, [asiento]);

  const puedeContabilizar =
    Boolean(asiento) &&
    !faltantes &&
    !motivoNoContabilizable &&
    !polizaVista &&
    Boolean(tipoPolizaIdentificador) &&
    !contabilizando;

  const handleContabilizar = async () => {
    if (!asiento || !tipoPolizaIdentificador) return;
    setContabilizando(true);
    try {
      const resultadoContabilizacion = await contabilizarFacturaVenta(documentoId);
      setPolizaVista(resultadoContabilizacion.poliza);
      setPolizaRecienContabilizada(true);
      setSnackbar({ open: true, message: 'Factura contabilizada correctamente.', severity: 'success' });
      onContabilizado?.();
    } catch (err) {
      const apiError = err as ApiFetchError;
      setSnackbar({ open: true, message: apiError.message || 'No se pudo contabilizar la factura.', severity: 'error' });
    } finally {
      setContabilizando(false);
    }
  };

  const headerCellSx = {
    backgroundColor: '#1d2f68',
    color: '#fff',
    fontWeight: 600,
    fontSize: '13px',
    py: '6px',
  };
  const bodyCellSx = { fontSize: '13px', py: '6px', borderBottom: '1px solid #e5e7eb' };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', md: 640 }, maxWidth: '100%' } }}
    >
      <Box sx={{ p: 3, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700} color="#1d2f68">
            {polizaVista ? 'Póliza contable de factura' : 'Contabilizar factura'} {folio || `#${documentoId}`}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {loading && (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando…</Typography>
          </Stack>
        )}

        {!loading && motivoNoContabilizable && (
          <Alert severity="warning">{motivoNoContabilizable}</Alert>
        )}

        {!loading && faltantes && (
          <Alert severity="error">
            <Typography variant="body2" fontWeight={700} gutterBottom>
              Faltan cuentas contables configuradas:
            </Typography>
            <Stack spacing={0.5}>
              {faltantes.map((f, idx) => (
                <Typography key={idx} variant="body2">
                  • {f.uso_contable}: {f.contexto}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}

        {!loading && asiento && (
          <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>Cuenta</TableCell>
                  <TableCell sx={headerCellSx}>Concepto</TableCell>
                  <TableCell align="right" sx={headerCellSx}>Cargo</TableCell>
                  <TableCell align="right" sx={headerCellSx}>Abono</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {asiento.movimientos.map((m, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={bodyCellSx}>
                      <Typography variant="body2" sx={{ fontSize: 'inherit' }}>{m.cuenta}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.descripcion}</Typography>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>{m.concepto || ''}</TableCell>
                    <TableCell align="right" sx={bodyCellSx}>{m.cargo > 0 ? formatter.format(m.cargo) : ''}</TableCell>
                    <TableCell align="right" sx={bodyCellSx}>{m.abono > 0 ? formatter.format(m.abono) : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} sx={{ ...bodyCellSx, fontWeight: 700 }}>Totales</TableCell>
                  <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700 }}>{formatter.format(asiento.total_cargos)}</TableCell>
                  <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700 }}>{formatter.format(asiento.total_abonos)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        )}

        {!loading && asiento && !polizaVista && Math.abs(diferencia) > 0.005 && (
          <Alert severity="error">La póliza no cuadra: diferencia de {formatter.format(diferencia)}.</Alert>
        )}

        {!loading && asiento && !polizaVista && (
          <>
            <Divider />

            {tipoPolizaResuelto && tipoPolizaIdentificador && (
              <Typography variant="body2" color="text.secondary">
                Se generará póliza de tipo: <strong>{tipoPolizaIdentificador}</strong>
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

            <Button
              variant="contained"
              disabled={!puedeContabilizar}
              onClick={() => void handleContabilizar()}
            >
              {contabilizando ? 'Contabilizando…' : 'Contabilizar'}
            </Button>
          </>
        )}

        {polizaVista && (
          <Stack spacing={2}>
            {polizaRecienContabilizada && <Alert severity="success">La factura se contabilizó correctamente.</Alert>}
            <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">Póliza:</Typography>
                <Chip
                  label={`${polizaVista.tipo_poliza_identificador} ${polizaVista.numero}`}
                  size="small"
                  color="primary"
                />
                <Chip label={polizaVista.estatus} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Fecha: {polizaVista.fecha} · Total: {formatter.format(polizaVista.total_cargos)}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate('/contabilidad/polizas')}>
              Ir a Pólizas
            </Button>
            <Button variant="text" onClick={onClose}>
              Cerrar
            </Button>
          </Stack>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Drawer>
  );
}
