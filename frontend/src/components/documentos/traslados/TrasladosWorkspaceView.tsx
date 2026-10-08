import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { Contacto } from '../../../types/contactos.types';
import type { Producto } from '../../../types/producto';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../WorkspaceRowContextMenu';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import { getStatusToneColor } from '../../status/status.semantics';
import type { StatusTone } from '../../status/status.types';
import { prevalidarCancelacionDocumento, timbrarDocumentoCfdi } from '../../../services/documentosService';
import { fetchProductos } from '../../../services/productosService';
import { obtenerViajePorDocumento, obtenerViajeAggregate, validarCartaPorte, type CartaPorteIssue, type ViajeMercancia } from '../../../services/transporte.api';
import CartaPorteIssuesDialog from '../facturas/CartaPorteIssuesDialog';

type Props = {
  rows: CotizacionListado[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (row: CotizacionListado) => void;
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void | Promise<void>;
  onDelete: (row: CotizacionListado) => void;
  onCartaPorte: (row: CotizacionListado) => void;
  onPdf: (row: CotizacionListado) => void;
  onCancelar: (row: CotizacionListado) => void;
  onUpdate: (row: CotizacionListado) => void;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: unknown) => string;
  contactos: Contacto[];
  viajeRevision?: number;
};

const estadoLabel = (value: unknown) => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'timbrado') return 'Timbrado';
  if (normalized === 'emitido') return 'Emitido';
  if (normalized === 'cancelado' || normalized === 'cancelada') return 'Cancelado';
  return 'Borrador';
};

/** Mismos tonos que el punto de FacturasWorkspace: Timbrado success, Borrador draft, Cancelado error. */
const tonoEstatusDocumento = (value: unknown): StatusTone => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'cancelado' || normalized === 'cancelada') return 'error';
  if (normalized === 'timbrado') return 'success';
  return 'draft';
};

const formatearCantidad = (value: unknown): string => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '—';
  return numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function TrasladosWorkspaceView({
  rows, isLoading, selectedId, onSelect, search, onSearch, onCreate, onDelete, onCartaPorte, onPdf, onCancelar, onUpdate, formatFolio, formatDate,
  viajeRevision = 0,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [timbrando, setTimbrando] = useState(false);
  const [pasoTimbre, setPasoTimbre] = useState<'validando' | 'timbrando'>('timbrando');
  const [trasladoATimbrar, setTrasladoATimbrar] = useState<CotizacionListado | null>(null);
  const [erroresCartaPorte, setErroresCartaPorte] = useState<CartaPorteIssue[] | null>(null);
  const [viajeLoading, setViajeLoading] = useState(false);
  const [mercanciasViaje, setMercanciasViaje] = useState<ViajeMercancia[]>([]);
  const [cancelacionPermitida, setCancelacionPermitida] = useState(false);
  const [cancelacionRevisando, setCancelacionRevisando] = useState(false);
  const [menuFila, setMenuFila] = useState<{ top: number; left: number; rowId: number } | null>(null);
  const selectedRow = useMemo(() => rows.find((row) => Number(row.id) === Number(selectedId)) ?? rows[0] ?? null, [rows, selectedId]);
  const detalle = useDocumentoDetalleData(selectedRow?.id ?? null, 'traslado', Boolean(selectedRow), refreshKey);
  const partidas = detalle.data?.partidas ?? [];
  const observaciones = String(detalle.data?.documento?.observaciones ?? selectedRow?.observaciones ?? '');
  const esBorrador = estadoLabel(selectedRow?.estatus_documento) === 'Borrador';
  const esCancelado = estadoLabel(selectedRow?.estatus_documento) === 'Cancelado';
  const esTimbrado = estadoLabel(selectedRow?.estatus_documento) === 'Timbrado';
  const yaTimbrado = esTimbrado || Boolean((selectedRow as any)?.cfdi_uuid);
  const cartaPorteDeshabilitada = !selectedRow;
  const imprimirDeshabilitado = !selectedRow;
  const timbrarDeshabilitado = !selectedRow || !esBorrador || yaTimbrado || viajeLoading || timbrando;
  const editarDeshabilitado = !selectedRow || !esBorrador;
  const eliminarDeshabilitado = !selectedRow || !esBorrador;
  const cancelarDeshabilitado = !selectedRow || !esTimbrado || esCancelado || cancelacionRevisando || !cancelacionPermitida;

  useEffect(() => {
    if (!selectedRow?.id || !esTimbrado) {
      setCancelacionPermitida(false);
      setCancelacionRevisando(false);
      return;
    }
    let activo = true;
    setCancelacionRevisando(true);
    prevalidarCancelacionDocumento(Number(selectedRow.id))
      .then((resultado) => {
        if (activo) setCancelacionPermitida(Boolean(resultado.puedeSolicitarCancelacion));
      })
      .catch(() => {
        if (activo) setCancelacionPermitida(false);
      })
      .finally(() => {
        if (activo) setCancelacionRevisando(false);
      });
    return () => { activo = false; };
  }, [selectedRow?.id, esTimbrado, selectedRow?.cfdi_cancelacion_estado, refreshKey]);

  useEffect(() => {
    let activo = true;
    const cargarEstadoFiscal = async () => {
      if (!selectedRow?.id) {
        setMercanciasViaje([]);
        return;
      }
      setViajeLoading(true);
      try {
        const viaje = await obtenerViajePorDocumento(Number(selectedRow.id));
        if (!viaje?.viaje_id) {
          if (activo) setMercanciasViaje([]);
          return;
        }
        const aggregate = await obtenerViajeAggregate(Number(viaje.viaje_id));
        if (activo) setMercanciasViaje(aggregate.mercancias ?? []);
      } catch {
        if (activo) setMercanciasViaje([]);
      } finally {
        if (activo) setViajeLoading(false);
      }
    };
    void cargarEstadoFiscal();
    return () => { activo = false; };
  }, [selectedRow?.id, refreshKey, viajeRevision]);

  const solicitarTimbrado = () => {
    if (!selectedRow || !esBorrador || yaTimbrado || viajeLoading || timbrando) return;
    setTrasladoATimbrar(selectedRow);
  };

  const timbrar = async () => {
    const row = trasladoATimbrar;
    if (!row || timbrando) return;
    setTimbrando(true);
    setPasoTimbre('validando');
    setErrorEdicion(null);
    try {
      const viaje = await obtenerViajePorDocumento(Number(row.id));
      if (!viaje?.viaje_id) {
        setErroresCartaPorte([{ section: 'generales', message: 'Este traslado aún no tiene un Viaje asociado.' }]);
        setTrasladoATimbrar(null);
        return;
      }
      try {
        await validarCartaPorte(Number(viaje.viaje_id));
      } catch (error: any) {
        const issues: CartaPorteIssue[] = Array.isArray(error?.payload?.issues) ? error.payload.issues : [];
        setErroresCartaPorte(issues.length
          ? issues
          : [{ section: 'generales', message: error?.message || 'No se pudo validar la Carta Porte.' }]);
        setTrasladoATimbrar(null);
        return;
      }
      setPasoTimbre('timbrando');
      const resultado: any = await timbrarDocumentoCfdi(Number(row.id), 'traslado');
      const uuid = resultado?.timbre?.uuid ?? resultado?.timbre?.UUID ?? resultado?.uuid ?? null;
      const updatedRow = {
        ...row,
        estatus_documento: 'Timbrado',
        ...(uuid ? { cfdi_uuid: uuid } : {}),
      } as CotizacionListado;
      onUpdate(updatedRow);
      setRefreshKey((value) => value + 1);
      onSelect(updatedRow);
      setTrasladoATimbrar(null);
    } catch (error: any) {
      setErrorEdicion(error?.message || 'No se pudo timbrar el CFDI de Traslado.');
      setTrasladoATimbrar(null);
    } finally {
      setTimbrando(false);
    }
  };

  useEffect(() => {
    if (selectedRow) onSelect(selectedRow);
  }, [onSelect, selectedRow]);

  useEffect(() => {
    setErrorEdicion(null);
  }, [selectedRow?.id]);

  useEffect(() => {
    void fetchProductos().then(setProductos).catch(() => setProductos([]));
  }, []);

  const selectRow = (row: CotizacionListado) => {
    onSelect(row);
    setDetalleMovil(true);
  };

  const listaVisible = !compacto || !detalleMovil;
  const itemsMenuTraslado: WorkspaceContextItem[] = !menuFila || !selectedRow || Number(menuFila.rowId) !== Number(selectedRow.id) ? [] : [
    {
      id: 'carta-porte',
      label: 'Carta Porte / Viaje',
      icon: <LocalShippingOutlinedIcon fontSize="small" />,
      disabled: cartaPorteDeshabilitada,
      onClick: cartaPorteDeshabilitada ? undefined : () => onCartaPorte(selectedRow),
    },
    {
      id: 'imprimir',
      label: 'Imprimir',
      icon: <PrintOutlinedIcon fontSize="small" />,
      disabled: imprimirDeshabilitado,
      onClick: imprimirDeshabilitado ? undefined : () => onPdf(selectedRow),
    },
    {
      id: 'timbrar',
      label: 'Timbrar',
      icon: <NotificationsActiveOutlinedIcon fontSize="small" />,
      disabled: timbrarDeshabilitado,
      onClick: timbrarDeshabilitado ? undefined : solicitarTimbrado,
    },
    {
      id: 'cancelar',
      label: 'Cancelar',
      icon: <CancelIcon fontSize="small" />,
      disabled: cancelarDeshabilitado,
      onClick: cancelarDeshabilitado || !selectedRow ? undefined : () => onCancelar(selectedRow),
    },
    {
      id: 'editar',
      label: 'Editar',
      icon: <EditOutlinedIcon fontSize="small" />,
      disabled: editarDeshabilitado,
      onClick: editarDeshabilitado || !selectedRow ? undefined : () => onCartaPorte(selectedRow),
    },
    {
      id: 'eliminar',
      label: 'Eliminar',
      icon: <DeleteOutlineIcon fontSize="small" />,
      disabled: eliminarDeshabilitado,
      onClick: eliminarDeshabilitado ? undefined : () => onDelete(selectedRow),
    },
  ];
  const iconoSx = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });

  return (
    <Box sx={{ flex: 1, minHeight: compacto ? 'calc(100dvh - 112px)' : 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <Box sx={{
        width: compacto ? '100%' : 372,
        flexShrink: 0,
        display: listaVisible ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: tokens.workspaceRail.background,
        color: tokens.navigation.foreground,
        borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
      }}>
        <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
                TRASLADOS
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }} noWrap>
                {rows.length} en vista
              </Typography>
            </Box>
            <Tooltip title="Nuevo Traslado" arrow>
              <IconButton
                size="small"
                aria-label="Nuevo Traslado"
                onClick={() => { void onCreate(); }}
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: tokens.navigation.control,
                  color: tokens.navigation.controlForeground,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                  '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.35 }}>
            <TextField
              size="small"
              placeholder="Buscar folio o cliente…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => onSearch('')} sx={{ color: tokens.navigation.muted }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null,
              }}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: tokens.navigation.foreground,
                  bgcolor: tokens.navigation.summary,
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                },
                '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.9 },
                '& .MuiOutlinedInput-input::placeholder': { color: tokens.navigation.muted, opacity: 1 },
              }}
            />
          </Stack>
        </Box>
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          px: 1,
          pb: 1.2,
          scrollbarWidth: 'thin',
          scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`,
        }}>
          {isLoading && rows.length === 0 ? (
            <Stack alignItems="center" py={4}><CircularProgress size={24} sx={{ color: tokens.navigation.foreground }} /></Stack>
          ) : rows.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted, textAlign: 'center' }}>
              {search ? 'Ningún traslado coincide con la búsqueda.' : 'Sin traslados en esta vista.'}
            </Typography>
          ) : rows.map((row) => {
            const active = Number(row.id) === Number(selectedRow?.id);
            const estado = estadoLabel(row.estatus_documento);
            const tono = tonoEstatusDocumento(row.estatus_documento);
            return (
              <Box
                key={row.id}
                onClick={() => selectRow(row)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectRow(row);
                  setMenuFila({ top: event.clientY, left: event.clientX, rowId: Number(row.id) });
                }}
                sx={{
                  px: 1,
                  py: 1.05,
                  mb: 0.45,
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: active ? tokens.navigation.selection : 'transparent',
                  color: active ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                  '&:hover': { bgcolor: active ? tokens.navigation.selection : tokens.navigation.hover },
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography component="p" variant="figure" sx={{ display: 'block', m: 0, fontSize: 16, color: 'inherit', lineHeight: 1.15 }}>
                    {formatFolio(row)}
                  </Typography>
                  <Typography component="p" variant="figure" sx={{ display: 'block', m: 0, mt: 0.35, fontSize: 14, color: tokens.navigation.foreground, lineHeight: 1.25 }} noWrap>
                    {row.nombre_cliente || 'Sin contacto'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', mt: 0.45 }}>
                    <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', minWidth: 0 }}>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.navigation.foreground }}>{estado}</Typography>
                      <Tooltip title={estado} arrow>
                        <Box component="span" aria-label={estado} sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, tono), display: 'inline-block' }} />
                      </Tooltip>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: tokens.navigation.muted, flexShrink: 0 }}>{formatDate(row.fecha_documento)}</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        <WorkspaceRowContextMenu
          anchorPosition={menuFila && selectedRow && Number(menuFila.rowId) === Number(selectedRow.id) ? { top: menuFila.top, left: menuFila.left } : null}
          items={itemsMenuTraslado}
          onClose={() => setMenuFila(null)}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && listaVisible ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: tokens.content.background }}>
        {selectedRow ? (
          <>
            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 1.4, flexShrink: 0 }}>
              {compacto && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setDetalleMovil(false)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', mb: 0.5, p: 0 }}
                >
                  <ArrowBackIcon fontSize="small" /> Traslados
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: compacto ? 'column' : 'row' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
                    TRASLADO SELECCIONADO
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.35 }}>
                    <Typography variant="figure" sx={{ fontSize: compacto ? 26 : 32, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
                      {formatFolio(selectedRow)}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatDate(selectedRow.fecha_documento)}</Typography>
                    <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>id {selectedRow.id}</Typography>
                  </Box>
                  <Typography component="p" variant="figure" sx={{ display: 'block', m: 0, mt: 0.7, fontSize: 15, lineHeight: 1.3, color: tokens.content.foreground }}>
                    {selectedRow.nombre_cliente || 'Empresa activa'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 12, fontWeight: 700 }}>
                      {estadoLabel(selectedRow.estatus_documento)}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
                    <Tooltip title="Carta Porte" arrow>
                      <span>
                        <IconButton size="small" aria-label="Carta Porte" disabled={cartaPorteDeshabilitada} onClick={() => onCartaPorte(selectedRow)} sx={iconoSx(cartaPorteDeshabilitada)}>
                          <LocalShippingOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={timbrando ? (pasoTimbre === 'validando' ? 'Validando…' : 'Timbrando…') : 'Timbrar'} arrow>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={timbrando ? (pasoTimbre === 'validando' ? 'Validando…' : 'Timbrando…') : 'Timbrar'}
                          disabled={timbrarDeshabilitado}
                          onClick={solicitarTimbrado}
                          sx={iconoSx(timbrarDeshabilitado)}
                        >
                          {timbrando || viajeLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <NotificationsActiveOutlinedIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="PDF" arrow>
                      <span>
                        <IconButton size="small" aria-label="PDF" disabled={imprimirDeshabilitado} onClick={() => onPdf(selectedRow)} sx={iconoSx(imprimirDeshabilitado)}>
                          <PrintOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
                    <Tooltip title="Cancelar" arrow>
                      <span>
                        <IconButton size="small" aria-label="Cancelar" disabled={cancelarDeshabilitado} onClick={() => selectedRow && onCancelar(selectedRow)} sx={iconoSx(cancelarDeshabilitado)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Editar" arrow>
                      <span>
                        <IconButton size="small" aria-label="Editar" disabled={editarDeshabilitado} onClick={() => selectedRow && onCartaPorte(selectedRow)} sx={iconoSx(editarDeshabilitado)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Eliminar" arrow>
                      <span>
                        <IconButton size="small" aria-label="Eliminar" disabled={eliminarDeshabilitado} onClick={() => onDelete(selectedRow)} sx={iconoSx(eliminarDeshabilitado)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
              </Box>
            </Box>

            {errorEdicion && (
              <Typography sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1, fontSize: 13, color: tokens.action.destructive }}>{errorEdicion}</Typography>
            )}
            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1.6, flexShrink: 0 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : 'minmax(0, 0.7fr) minmax(0, 0.85fr) minmax(180px, 1.7fr)', gap: 0.8 }}>
                <Box sx={{ px: 1.4, py: 1.15, borderRadius: 2, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.metric.caption }}>ESTATUS</Typography>
                  <Typography variant="figure" sx={{ display: 'block', mt: 0.45, fontSize: 18, fontWeight: 400, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'inherit' }}>{estadoLabel(selectedRow.estatus_documento)}</Typography>
                </Box>
                <Box sx={{ px: 1.4, py: 1.15, borderRadius: 2, bgcolor: tokens.metric.applied.background, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.metric.caption }}>FECHA</Typography>
                  <Typography variant="figure" sx={{ display: 'block', mt: 0.45, fontSize: 18, fontWeight: 400, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'inherit' }}>{formatDate(selectedRow.fecha_documento)}</Typography>
                </Box>
                <Box sx={{ px: 1.4, py: 1.15, borderRadius: 2, bgcolor: tokens.metric.available.background, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.metric.caption }}>CONTACTO</Typography>
                  <Typography variant="figure" sx={{ display: 'block', mt: 0.45, fontSize: 18, fontWeight: 400, lineHeight: 1.3, letterSpacing: '-0.01em', color: 'inherit', overflowWrap: 'anywhere' }}>{selectedRow.nombre_cliente || 'Sin contacto'}</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{
              mx: { xs: 1, md: 1.75 },
              mb: 1,
              px: 1.5,
              py: 1.15,
              borderRadius: 2,
              border: `1px solid ${tokens.content.border}`,
              bgcolor: tokens.content.elevated,
              flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.metric.caption }}>OBSERVACIONES</Typography>
              {observaciones.trim() ? (
                <Typography sx={{ mt: 0.45, fontSize: 14, lineHeight: 1.45, color: tokens.content.secondary, whiteSpace: 'pre-wrap' }}>
                  {observaciones}
                </Typography>
              ) : null}
            </Box>

            <Box sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              mx: { xs: 1, md: 1.75 },
              mb: { xs: 1, md: 1.75 },
              bgcolor: tokens.content.well,
              borderRadius: 3,
              border: `1px solid ${tokens.content.border}`,
              overflow: 'hidden',
            }}>
              <Box sx={{ px: 2.25, minHeight: 48, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 650, fontSize: 14, letterSpacing: '-0.01em', color: tokens.content.foreground }}>Mercancías</Typography>
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 0.95fr) minmax(0, 1.5fr) minmax(72px, 0.7fr) 112px', md: 'minmax(148px, 0.9fr) minmax(0, 1.7fr) minmax(96px, 0.6fr) 132px' },
                  columnGap: 2.5,
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.2,
                  bgcolor: tokens.table.headerBg,
                  borderBottom: `1px solid ${tokens.table.line}`,
                }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.table.headerFg }}>PRODUCTO</Typography>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.table.headerFg }}>DESCRIPCIÓN</Typography>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.table.headerFg }}>UNIDAD</Typography>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: tokens.table.headerFg, textAlign: 'right' }}>CANTIDAD</Typography>
                </Box>
                {(mercanciasViaje.length > 0 ? mercanciasViaje : partidas).map((fila, index) => {
                  const esViaje = mercanciasViaje.length > 0;
                  const mercancia = esViaje ? mercanciasViaje[index] : null;
                  const partida = esViaje ? null : partidas[index];
                  const productoCatalogo = mercancia?.producto_id
                    ? productos.find((p) => p.id === mercancia.producto_id)
                    : (partida?.producto_id ? productos.find((p) => p.id === Number(partida.producto_id)) : null);
                  const claveProducto = productoCatalogo?.clave?.trim() || '';
                  const descripcionProducto = (productoCatalogo?.descripcion || mercancia?.descripcion_snapshot || String(partida?.descripcion_alterna ?? partida?.descripcion ?? '')).trim();
                  const unidad = (mercancia?.unidad_descripcion || productoCatalogo?.unidad_venta_descripcion || '').trim();
                  const cantidadTexto = formatearCantidad(mercancia ? mercancia.cantidad : partida?.cantidad);
                  const celdaTexto = { fontSize: 13.5, fontWeight: 400, lineHeight: 1.4, color: tokens.content.foreground, overflowWrap: 'anywhere' as const };
                  return (
                    <Box
                      key={String((mercancia?.id ?? partida?.id) ?? index)}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 0.95fr) minmax(0, 1.5fr) minmax(72px, 0.7fr) 112px', md: 'minmax(148px, 0.9fr) minmax(0, 1.7fr) minmax(96px, 0.6fr) 132px' },
                        columnGap: 2.5,
                        alignItems: 'center',
                        px: 2.5,
                        py: 1.65,
                        borderBottom: `1px solid ${tokens.table.line}`,
                        bgcolor: index % 2 === 1 ? tokens.grid.stripe : 'transparent',
                        transition: 'background-color 120ms ease',
                        '&:hover': { bgcolor: tokens.content.hover },
                        '&:last-of-type': { borderBottom: 'none' },
                      }}
                    >
                      <Typography sx={celdaTexto}>{claveProducto || '—'}</Typography>
                      <Typography sx={{ ...celdaTexto, color: tokens.content.secondary }}>{descripcionProducto || '—'}</Typography>
                      <Typography sx={{ ...celdaTexto, color: tokens.content.secondary }}>{unidad || '—'}</Typography>
                      <Typography variant="figure" sx={{ fontSize: 16, fontWeight: 400, lineHeight: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tokens.content.foreground }}>
                        {cantidadTexto}
                      </Typography>
                    </Box>
                  );
                })}
                {!viajeLoading && mercanciasViaje.length === 0 && partidas.length === 0 && (
                  <Typography sx={{ px: 2, py: 3, fontSize: 13, color: tokens.content.muted, textAlign: 'center' }}>
                    Sin mercancías capturadas.
                  </Typography>
                )}
                {viajeLoading && mercanciasViaje.length === 0 && partidas.length === 0 && (
                  <Typography sx={{ px: 2, py: 3, fontSize: 13, color: tokens.content.muted, textAlign: 'center' }}>
                    Cargando mercancías…
                  </Typography>
                )}
              </Box>
            </Box>
          </>
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.content.foreground }}>
              {rows.length > 0 ? 'Selecciona un traslado' : 'Sin traslados en esta vista'}
            </Typography>
            <Typography sx={{ mt: 0.6, fontSize: 13, color: tokens.content.muted, maxWidth: 360 }}>
              {rows.length > 0
                ? 'El documento, su contacto y sus mercancías aparecen aquí.'
                : 'Ajusta la búsqueda o crea un traslado nuevo.'}
            </Typography>
          </Stack>
        )}
      </Box>
      <Dialog
        open={trasladoATimbrar != null}
        onClose={() => { if (!timbrando) setTrasladoATimbrar(null); }}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: tokens.content.elevated,
            backgroundImage: 'none',
            color: tokens.content.foreground,
            border: `1px solid ${tokens.content.border}`,
            borderRadius: 2,
            boxShadow: '0 18px 48px rgba(62, 52, 40, 0.16)',
          },
        }}
      >
        <Box sx={{ px: 3, pt: 2.75, pb: 2.5 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: tokens.content.foreground }}>
            Timbrar CFDI de Traslado
          </Typography>
          <Typography sx={{ mt: 1.75, fontSize: 15, lineHeight: 1.45, color: tokens.content.foreground }}>
            ¿Timbrar el CFDI de Traslado {trasladoATimbrar ? formatFolio(trasladoATimbrar) : ''}?
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14, lineHeight: 1.45, color: tokens.content.secondary }}>
            Se validará la Carta Porte y, si está completa, el CFDI se timbra de inmediato.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button
              onClick={() => setTrasladoATimbrar(null)}
              disabled={timbrando}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '10px',
                color: tokens.content.foreground,
                px: 1.75,
                bgcolor: 'transparent',
                border: `1px solid ${tokens.content.foreground}`,
                '&:hover': { bgcolor: tokens.content.hover, borderColor: tokens.content.foreground },
                '&.Mui-disabled': { color: tokens.content.foreground, borderColor: tokens.content.foreground },
              }}
            >
              No timbrar
            </Button>
            <Button
              onClick={() => void timbrar()}
              disabled={timbrando}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 2,
                bgcolor: tokens.action.primary,
                color: tokens.action.primaryForeground,
                '&:hover': { bgcolor: tokens.action.primaryHover },
                '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
              }}
            >
              {timbrando ? (pasoTimbre === 'validando' ? 'Validando…' : 'Timbrando…') : 'Timbrar'}
            </Button>
          </Stack>
        </Box>
      </Dialog>
      <CartaPorteIssuesDialog issues={erroresCartaPorte} onClose={() => setErroresCartaPorte(null)} />
    </Box>
  );
}
