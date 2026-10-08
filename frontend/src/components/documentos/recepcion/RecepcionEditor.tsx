import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
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
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  getDocumento,
  getDocumentoDetalle,
  getRecepcionResumen,
  replacePartidas,
  updateDocumento,
  type PartidaRecepcionResumen,
} from '../../../services/documentosService';
import type { CotizacionDocumento, CotizacionPartida, CotizacionPartidaPayload } from '../../../types/cotizacion';
import { formatearFolioDocumento } from '../../../utils/documentos.utils';

type DocumentoRecepcion = CotizacionDocumento & { cliente_nombre?: string | null };

type LineaEditor = {
  partidaOrigenId: number;
  productoId: number | null;
  clave: string;
  descripcion: string;
  unidad: string;
  ordenada: number;
  maximo: number;
  cantidad: string;
  precio: number;
};

type RecepcionEditorProps = {
  documentoId: number | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function fechaCivil(value: unknown): string {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
}

function cantidadTexto(value: number): string {
  return Number(value).toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

function parseCantidad(value: string): number {
  const numero = Number(String(value).replace(',', '.'));
  return Number.isFinite(numero) ? numero : NaN;
}

function mensajeError(error: unknown): string {
  const texto = error instanceof Error ? error.message : 'No se pudo guardar la recepción';
  return texto.replace(/^VALIDATION_ERROR:\s*/i, '');
}

function armarLineas(
  partidas: CotizacionPartida[],
  resumen: PartidaRecepcionResumen[],
  precios: Map<number, number>,
): LineaEditor[] {
  return partidas.flatMap((partida) => {
    const origenId = Number(partida.partida_origen_id ?? 0);
    if (!origenId) return [];
    const oc = resumen.find((item) => item.partida_oc_id === origenId);
    const cantidad = Number(partida.cantidad ?? 0);
    const ordenada = oc ? Number(oc.cantidad_ordenada) : cantidad;
    const recibidoTotal = oc ? Number(oc.cantidad_recibida) : cantidad;
    const recibidoOtras = Math.max(recibidoTotal - cantidad, 0);
    const maximo = Math.max(ordenada - recibidoOtras, cantidad);
    const precio = precios.get(origenId) ?? Number(partida.precio_unitario ?? 0);
    return [{
      partidaOrigenId: origenId,
      productoId: partida.producto_id,
      clave: String(partida.producto_clave ?? oc?.producto_clave ?? ''),
      descripcion: String(partida.producto_descripcion || partida.descripcion_alterna || oc?.producto_descripcion || oc?.descripcion_alterna || 'Partida'),
      unidad: String(oc?.unidad ?? ''),
      ordenada,
      maximo,
      cantidad: String(cantidad),
      precio,
    }];
  });
}

export function RecepcionEditorRoute() {
  const { id } = useParams();
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    return <Navigate to="/compras/recepcion" replace />;
  }
  return <Navigate to="/compras/recepcion" replace state={{ recepcionEditorId: documentoId }} />;
}

export default function RecepcionEditor({ documentoId, onClose, onSaved }: RecepcionEditorProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const pantallaChica = useMediaQuery(theme.breakpoints.down('md'));
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [folio, setFolio] = useState('');
  const [folioOrigen, setFolioOrigen] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fecha, setFecha] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estatus, setEstatus] = useState('borrador');
  const [ivaRegistrado, setIvaRegistrado] = useState(0);
  const [totalRegistrado, setTotalRegistrado] = useState(0);
  const [lineas, setLineas] = useState<LineaEditor[]>([]);
  const [pendientes, setPendientes] = useState<PartidaRecepcionResumen[]>([]);
  const [preciosOrigen, setPreciosOrigen] = useState<Map<number, number>>(new Map());
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [seleccionPendiente, setSeleccionPendiente] = useState<number[]>([]);
  const [ultimaPartidaDialogAbierto, setUltimaPartidaDialogAbierto] = useState(false);

  const borrador = estatus === 'borrador';
  const cancelado = estatus === 'cancelado' || estatus === 'cancelada';
  const abierto = documentoId != null && documentoId > 0;

  useEffect(() => {
    if (!abierto || documentoId == null) return;
    let canceladoCarga = false;
    setCargando(true);
    setListo(false);
    setError('');
    setAgregarAbierto(false);
    void (async () => {
      try {
        const detalle = await getDocumentoDetalle(documentoId, 'recepcion');
        const documento = detalle.documento as DocumentoRecepcion;
        const origenId = Number(documento.documento_origen_id ?? 0);
        const [resumen, orden] = await Promise.all([
          getRecepcionResumen(documentoId),
          origenId > 0 ? getDocumento(origenId, 'orden_compra').catch(() => null) : Promise.resolve(null),
        ]);
        if (canceladoCarga) return;
        const precios = new Map<number, number>();
        (orden?.partidas ?? []).forEach((partida) => {
          precios.set(Number(partida.id), Number(partida.precio_unitario ?? 0));
        });
        const origen = detalle.documentosOrigen.find((doc) => String(doc.tipo_documento).toLowerCase() === 'orden_compra')
          ?? detalle.documentosOrigen[0]
          ?? null;
        const folioOc = origen
          ? formatearFolioDocumento(origen.serie ?? '', Number(origen.numero ?? 0))
          : orden
            ? formatearFolioDocumento(orden.documento.serie ?? '', Number(orden.documento.numero ?? 0))
            : '';
        setFolio(formatearFolioDocumento(documento.serie ?? '', Number(documento.numero ?? 0)));
        setFolioOrigen(folioOc);
        setProveedor(String(documento.cliente_nombre ?? '').trim() || 'Sin proveedor');
        setFecha(fechaCivil(documento.fecha_documento));
        setObservaciones(String(documento.observaciones ?? ''));
        setEstatus(String(documento.estatus_documento ?? 'borrador').trim().toLowerCase());
        setIvaRegistrado(Number(documento.iva ?? 0));
        setTotalRegistrado(Number(documento.total ?? 0));
        setPreciosOrigen(precios);
        setLineas(armarLineas(detalle.partidas, resumen?.partidas ?? [], precios));
        setPendientes(resumen?.partidas ?? []);
        setListo(true);
      } catch (err) {
        if (!canceladoCarga) setError(mensajeError(err));
      } finally {
        if (!canceladoCarga) setCargando(false);
      }
    })();
    return () => {
      canceladoCarga = true;
    };
  }, [abierto, documentoId]);

  const candidatos = useMemo(
    () => pendientes.filter((partida) => (
      Number(partida.cantidad_pendiente) > 0.000001
      && !lineas.some((linea) => linea.partidaOrigenId === partida.partida_oc_id)
    )),
    [lineas, pendientes],
  );

  const importeReferencia = lineas.reduce((suma, linea) => {
    const cantidad = parseCantidad(linea.cantidad);
    if (!Number.isFinite(cantidad)) return suma;
    return suma + Number((cantidad * linea.precio).toFixed(2));
  }, 0);

  const actualizarCantidad = (origenId: number, valor: string) => {
    setLineas((actual) => actual.map((linea) => (
      linea.partidaOrigenId === origenId ? { ...linea, cantidad: valor } : linea
    )));
  };

  const quitarLinea = (origenId: number) => {
    if (borrador && lineas.length <= 1) {
      setUltimaPartidaDialogAbierto(true);
      return;
    }
    setLineas((actual) => actual.filter((linea) => linea.partidaOrigenId !== origenId));
  };

  const agregarSeleccion = () => {
    const nuevas = candidatos
      .filter((partida) => seleccionPendiente.includes(partida.partida_oc_id))
      .map((partida): LineaEditor => ({
        partidaOrigenId: partida.partida_oc_id,
        productoId: partida.producto_id,
        clave: String(partida.producto_clave ?? ''),
        descripcion: String(partida.producto_descripcion || partida.descripcion_alterna || 'Partida'),
        unidad: String(partida.unidad ?? ''),
        ordenada: Number(partida.cantidad_ordenada),
        maximo: Number(partida.cantidad_pendiente),
        cantidad: String(partida.cantidad_pendiente),
        precio: preciosOrigen.get(partida.partida_oc_id) ?? 0,
      }));
    setLineas((actual) => [...actual, ...nuevas]);
    setSeleccionPendiente([]);
    setAgregarAbierto(false);
  };

  const guardar = async () => {
    if (documentoId == null || cancelado || !listo) return;
    const normalizadas = lineas.map((linea) => ({ ...linea, cantidadNumero: parseCantidad(linea.cantidad) }));
    const invalida = normalizadas.find((linea) => (
      !Number.isFinite(linea.cantidadNumero)
      || linea.cantidadNumero <= 0
      || linea.cantidadNumero > linea.maximo + 0.000001
    ));
    if (borrador && invalida) {
      setError(invalida.cantidadNumero > invalida.maximo
        ? `La cantidad de ${invalida.descripcion} excede el pendiente (${cantidadTexto(invalida.maximo)}).`
        : 'Cada partida debe tener una cantidad recibida mayor a cero.');
      return;
    }
    if (borrador && normalizadas.length === 0) {
      setError('La recepción debe conservar al menos una partida de la orden de compra.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (borrador) {
        const payload: Array<CotizacionPartidaPayload & { partida_origen_id: number }> = normalizadas.map((linea) => {
          const subtotal = Number((linea.cantidadNumero * linea.precio).toFixed(2));
          return {
            partida_origen_id: linea.partidaOrigenId,
            producto_id: linea.productoId,
            descripcion_alterna: linea.descripcion,
            cantidad: linea.cantidadNumero,
            precio_unitario: linea.precio,
            descuento: 0,
            descuento_tipo: 'porcentaje',
            descuento_monto: 0,
            subtotal_partida: subtotal,
            total_partida: subtotal,
            observaciones: '',
          };
        });
        await replacePartidas(documentoId, 'recepcion', payload);
      }
      const encabezado = borrador
        ? { fecha_documento: fecha, observaciones: observaciones.trim() || null }
        : { observaciones: observaciones.trim() || null };
      await updateDocumento(documentoId, 'recepcion', encabezado);
      await onSaved();
      onClose();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const campoSoloLectura = {
    size: 'small' as const,
    fullWidth: true,
    disabled: true,
    InputLabelProps: { shrink: true },
  };

  return (
    <Dialog
      open={abierto}
      onClose={guardando ? undefined : onClose}
      fullWidth
      maxWidth="md"
      fullScreen={pantallaChica}
      PaperProps={{ sx: { bgcolor: tokens.content.background, color: tokens.content.foreground, backgroundImage: 'none' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pr: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
            RECEPCIÓN
          </Typography>
          <Typography variant="figure" sx={{ fontSize: 28, lineHeight: 1.1 }}>{folio || 'Recepción'}</Typography>
        </Box>
        <IconButton aria-label="Cerrar editor" onClick={onClose} disabled={guardando}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: tokens.content.border }}>
        {cargando ? (
          <Stack alignItems="center" py={6}><CircularProgress size={28} /></Stack>
        ) : (
          <Stack spacing={2}>
            {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
            <Box sx={{ display: 'grid', gridTemplateColumns: pantallaChica ? '1fr' : '1fr 1fr', gap: 1.5 }}>
              <TextField {...campoSoloLectura} label="Folio" value={folio} />
              <TextField {...campoSoloLectura} label="Orden de compra origen" value={folioOrigen || 'Sin orden de compra'} />
              <TextField {...campoSoloLectura} label="Proveedor" value={proveedor} />
              <TextField
                size="small"
                fullWidth
                label="Fecha"
                type="date"
                value={fecha}
                disabled={!listo || !borrador || guardando}
                onChange={(event) => setFecha(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label="Observaciones"
              value={observaciones}
              disabled={!listo || cancelado || guardando}
              onChange={(event) => setObservaciones(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: tokens.content.muted }}>
                PARTIDAS DE LA ORDEN
              </Typography>
              {borrador ? (
                <Button size="small" variant="outlined" disabled={candidatos.length === 0 || guardando} onClick={() => { setSeleccionPendiente([]); setAgregarAbierto(true); }}>
                  Agregar pendientes
                </Button>
              ) : null}
            </Stack>
            <Box sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 2, overflow: 'auto' }}>
              {lineas.length === 0 ? (
                <Typography sx={{ px: 1.5, py: 2, fontSize: 13, color: tokens.content.muted }}>Sin partidas en esta recepción.</Typography>
              ) : lineas.map((linea, index) => {
                const cantidad = parseCantidad(linea.cantidad);
                const excede = !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > linea.maximo + 0.000001;
                const importe = Number.isFinite(cantidad) ? cantidad * linea.precio : 0;
                return (
                  <Stack
                    key={linea.partidaOrigenId}
                    direction={pantallaChica ? 'column' : 'row'}
                    spacing={1.25}
                    alignItems={pantallaChica ? 'stretch' : 'center'}
                    sx={{ px: 1.5, py: 1.1, borderTop: index ? `1px solid ${tokens.content.border}` : 'none' }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 650 }} noWrap>{linea.descripcion}</Typography>
                      <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>
                        {[linea.clave, linea.unidad].filter(Boolean).join(' · ') || 'Partida heredada'}
                        {' · '}Ordenada {cantidadTexto(linea.ordenada)}
                        {' · '}Disponible {cantidadTexto(linea.maximo)}
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      label="Cantidad recibida"
                      type="number"
                      value={linea.cantidad}
                      disabled={!borrador || guardando}
                      error={borrador && excede}
                      onChange={(event) => actualizarCantidad(linea.partidaOrigenId, event.target.value)}
                      inputProps={{ min: 0, step: 'any', 'aria-label': `Cantidad recibida de ${linea.descripcion}` }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: pantallaChica ? '100%' : 150 }}
                    />
                    <Box sx={{ width: pantallaChica ? '100%' : 148, textAlign: pantallaChica ? 'left' : 'right' }}>
                      <Typography sx={{ fontSize: 11, color: tokens.content.muted }}>Precio ref. {moneda.format(linea.precio)}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{moneda.format(importe)}</Typography>
                    </Box>
                    {borrador ? (
                      <IconButton aria-label={`Quitar ${linea.descripcion}`} disabled={guardando} onClick={() => quitarLinea(linea.partidaOrigenId)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                );
              })}
            </Box>
            <Stack alignItems="flex-end" spacing={0.25}>
              <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>Importe de referencia {moneda.format(importeReferencia)}</Typography>
              <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>IVA registrado {moneda.format(ivaRegistrado)}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Total registrado {moneda.format(totalRegistrado)}</Typography>
              <Typography sx={{ fontSize: 11, color: tokens.content.muted, maxWidth: 360, textAlign: 'right' }}>
                Precio, IVA y total se muestran como referencia. Al guardar se recalculan con el precio de la orden de compra.
              </Typography>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={guardando}>Cerrar</Button>
        {listo && !cancelado && !cargando ? (
          <Button variant="contained" onClick={() => { void guardar(); }} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        ) : null}
      </DialogActions>

      <Dialog open={agregarAbierto} onClose={() => setAgregarAbierto(false)} fullWidth maxWidth="sm">
        <DialogTitle>Partidas pendientes de la orden</DialogTitle>
        <DialogContent dividers>
          {candidatos.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>No hay partidas pendientes por agregar.</Typography>
          ) : candidatos.map((partida) => {
            const marcado = seleccionPendiente.includes(partida.partida_oc_id);
            return (
              <Stack key={partida.partida_oc_id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.6 }}>
                <Checkbox
                  checked={marcado}
                  onChange={(event) => {
                    setSeleccionPendiente((actual) => (
                      event.target.checked
                        ? [...actual, partida.partida_oc_id]
                        : actual.filter((id) => id !== partida.partida_oc_id)
                    ));
                  }}
                  inputProps={{ 'aria-label': `Agregar ${partida.producto_descripcion || 'partida'}` }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5 }} noWrap>{partida.producto_descripcion || partida.descripcion_alterna || 'Partida'}</Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>
                    Pendiente {cantidadTexto(Number(partida.cantidad_pendiente))} de {cantidadTexto(Number(partida.cantidad_ordenada))}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgregarAbierto(false)}>Cancelar</Button>
          <Button variant="contained" disabled={seleccionPendiente.length === 0} onClick={agregarSeleccion}>Agregar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ultimaPartidaDialogAbierto}
        onClose={() => setUltimaPartidaDialogAbierto(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { bgcolor: tokens.content.background, color: tokens.content.foreground, backgroundImage: 'none' } }}
      >
        <DialogTitle>Partida requerida</DialogTitle>
        <DialogContent dividers sx={{ borderColor: tokens.content.border }}>
          <Typography sx={{ fontSize: 14 }}>
            La recepción debe conservar al menos una partida. Si deseas quitarla, elimina la recepción.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setUltimaPartidaDialogAbierto(false)}>Entendido</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
