import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { Contacto } from '../../../types/contactos.types';
import type { Producto } from '../../../types/producto';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import { getStatusToneColor } from '../../status/status.semantics';
import { timbrarDocumentoCfdi, updateDocumento, replacePartidas } from '../../../services/documentosService';
import { fetchProductos } from '../../../services/productosService';
import { obtenerViajePorDocumento, obtenerViajeAggregate } from '../../../services/transporte.api';

type Props = {
  rows: CotizacionListado[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (row: CotizacionListado) => void;
  search: string;
  onSearch: (value: string) => void;
  onCreate: (contactoId: number) => void | Promise<void>;
  onDelete: (row: CotizacionListado) => void;
  onCartaPorte: (row: CotizacionListado) => void;
  onPdf: (row: CotizacionListado) => void;
  onUpdate: (row: CotizacionListado) => void;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: unknown) => string;
  contactos: Contacto[];
};

const estadoLabel = (value: unknown) => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'timbrado') return 'Timbrado';
  if (normalized === 'emitido') return 'Emitido';
  if (normalized === 'cancelado' || normalized === 'cancelada') return 'Cancelado';
  return 'Borrador';
};

function AccionIcono({
  caption,
  icon,
  disabled,
  onClick,
}: {
  caption: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const tokens = useTheme().emphasys;
  const apagado = Boolean(disabled);
  return (
    <Tooltip title={caption} arrow>
      <Box component="span" sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.35, minWidth: 58, flexShrink: 0 }}>
        <IconButton
          size="small"
          aria-label={caption}
          disabled={apagado}
          onClick={onClick}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            bgcolor: apagado ? tokens.action.disabled : tokens.action.primary,
            color: tokens.action.primaryForeground,
            '&:hover': { bgcolor: apagado ? tokens.action.disabled : tokens.action.primaryHover },
            '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
          }}
        >
          {icon}
        </IconButton>
        <Typography sx={{ fontSize: 10.5, lineHeight: 1.15, fontWeight: 650, color: tokens.content.secondary, textAlign: 'center' }}>
          {caption}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default function TrasladosWorkspaceView({
  rows, isLoading, selectedId, onSelect, search, onSearch, onCreate, onDelete, onCartaPorte, onPdf, onUpdate, formatFolio, formatDate, contactos,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fecha, setFecha] = useState('');
  const [contactoId, setContactoId] = useState<number | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [partidasEditables, setPartidasEditables] = useState<Array<Record<string, any>>>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [timbrando, setTimbrando] = useState(false);
  const [viajeLoading, setViajeLoading] = useState(false);
  const [viajeListo, setViajeListo] = useState(false);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoContactoId, setNuevoContactoId] = useState<number | null>(null);
  const selectedRow = useMemo(() => rows.find((row) => Number(row.id) === Number(selectedId)) ?? rows[0] ?? null, [rows, selectedId]);
  const detalle = useDocumentoDetalleData(selectedRow?.id ?? null, 'traslado', Boolean(selectedRow), refreshKey);
  const partidas = partidasEditables;
  const esBorrador = estadoLabel(selectedRow?.estatus_documento) === 'Borrador';
  const yaTimbrado = String(selectedRow?.estatus_documento ?? '').toLowerCase() === 'timbrado' || Boolean((selectedRow as any)?.cfdi_uuid);

  useEffect(() => {
    let activo = true;
    const cargarEstadoFiscal = async () => {
      if (!selectedRow?.id || yaTimbrado) {
        setViajeListo(false);
        return;
      }
      setViajeLoading(true);
      try {
        const viaje = await obtenerViajePorDocumento(Number(selectedRow.id));
        if (!viaje?.viaje_id) {
          if (activo) setViajeListo(false);
          return;
        }
        const aggregate = await obtenerViajeAggregate(Number(viaje.viaje_id));
        if (activo) {
          setViajeListo(
            String(aggregate.viaje?.estatus ?? '').toLowerCase() === 'validado'
              && String(aggregate.cartaPorte?.estatus ?? '').toLowerCase() === 'validado',
          );
        }
      } catch {
        if (activo) setViajeListo(false);
      } finally {
        if (activo) setViajeLoading(false);
      }
    };
    void cargarEstadoFiscal();
    return () => { activo = false; };
  }, [selectedRow?.id, yaTimbrado, refreshKey]);

  const timbrar = async () => {
    if (!selectedRow || !esBorrador || yaTimbrado || !viajeListo || timbrando) return;
    const folio = formatFolio(selectedRow);
    const confirmado = window.confirm(`¿Timbrar el CFDI de Traslado ${folio}?\n\nSe utilizará la Carta Porte validada asociada.`);
    if (!confirmado) return;
    setTimbrando(true);
    setErrorEdicion(null);
    try {
      const resultado: any = await timbrarDocumentoCfdi(Number(selectedRow.id), 'traslado');
      const uuid = resultado?.timbre?.uuid ?? resultado?.timbre?.UUID ?? resultado?.uuid ?? null;
      const updatedRow = {
        ...selectedRow,
        estatus_documento: 'Timbrado',
        ...(uuid ? { cfdi_uuid: uuid } : {}),
      } as CotizacionListado;
      onUpdate(updatedRow);
      setEditando(false);
      setRefreshKey((value) => value + 1);
      onSelect(updatedRow);
    } catch (error: any) {
      setErrorEdicion(error?.message || 'No se pudo timbrar el CFDI de Traslado.');
    } finally {
      setTimbrando(false);
    }
  };

  useEffect(() => {
    if (selectedRow) onSelect(selectedRow);
  }, [onSelect, selectedRow]);

  useEffect(() => {
    if (!selectedRow || !detalle.data) return;
    setFecha(String(detalle.data.documento?.fecha_documento ?? selectedRow.fecha_documento ?? '').slice(0, 10));
    setContactoId(Number(detalle.data.documento?.contacto_principal_id ?? selectedRow.contacto_principal_id ?? 0) || null);
    setObservaciones(String(detalle.data.documento?.observaciones ?? selectedRow.observaciones ?? ''));
    setPartidasEditables((detalle.data.partidas ?? []).map((partida: any) => ({ ...partida, cantidad: Number(partida.cantidad ?? 0), descripcion_alterna: partida.descripcion_alterna ?? partida.descripcion ?? '' })));
    setEditando(false);
    setErrorEdicion(null);
  }, [detalle.data, selectedRow]);

  useEffect(() => {
    void fetchProductos().then(setProductos).catch(() => setProductos([]));
  }, []);

  const guardar = async () => {
    if (!selectedRow) return;
    if (!contactoId) {
      setErrorEdicion('Selecciona un contacto operativo para guardar el Traslado.');
      return;
    }
    setGuardando(true);
    setErrorEdicion(null);
    try {
      const updatedDocumento = await updateDocumento(Number(selectedRow.id), 'traslado', {
        fecha_documento: fecha,
        contacto_principal_id: contactoId,
        observaciones,
        subtotal: 0,
        iva: 0,
        total: 0,
        saldo: 0,
      } as any);
      await replacePartidas(Number(selectedRow.id), 'traslado', partidasEditables.map((partida) => ({
        producto_id: partida.producto_id ? Number(partida.producto_id) : null,
        descripcion_alterna: partida.descripcion_alterna ?? '',
        cantidad: Number(partida.cantidad ?? 0),
        precio_unitario: 0,
        descuento: 0,
        descuento_monto: 0,
        subtotal_partida: 0,
        total_partida: 0,
        impuestos: [],
      })) as any);
      const updatedRow = {
        ...selectedRow,
        ...(updatedDocumento as Partial<CotizacionListado>),
        fecha_documento: fecha,
        contacto_principal_id: contactoId,
        observaciones,
        nombre_cliente: contactos.find((c) => c.id === contactoId)?.nombre ?? selectedRow.nombre_cliente,
      } as CotizacionListado;
      onUpdate(updatedRow);
      setEditando(false);
      setRefreshKey((value) => value + 1);
      onSelect(updatedRow);
    } catch (error: any) {
      setErrorEdicion(error?.message || 'No se pudo guardar el Traslado.');
    } finally {
      setGuardando(false);
    }
  };

  const selectRow = (row: CotizacionListado) => {
    onSelect(row);
    setDetalleMovil(true);
  };

  const listaVisible = !compacto || !detalleMovil;
  const campoSx = {
    '& .MuiInputLabel-root': { color: tokens.content.muted },
    '& .MuiInputLabel-root.Mui-focused': { color: tokens.content.foreground },
    '& .MuiOutlinedInput-root': {
      color: tokens.content.foreground,
      bgcolor: tokens.content.elevated,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.foreground },
      '&.Mui-focused fieldset': { borderColor: tokens.content.foreground },
    },
  };
  const encabezadoCelda = {
    bgcolor: tokens.table.headerBg,
    color: tokens.table.headerFg,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    borderBottom: `1px solid ${tokens.table.line}`,
    py: 0.9,
    px: 1.5,
  };
  const celda = {
    color: tokens.table.cell,
    fontSize: 13,
    borderBottom: `1px solid ${tokens.table.line}`,
    py: 0.9,
    px: 1.5,
    minWidth: 0,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: compacto ? 'column' : 'row', height: compacto ? 'calc(100dvh - 112px)' : 'calc(100dvh - 96px)', minHeight: compacto ? 0 : 560, overflow: 'hidden', bgcolor: tokens.content.background }}>
      <Box sx={{
        width: compacto ? '100%' : 372,
        flexShrink: 0,
        display: listaVisible ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        flex: compacto ? 1 : undefined,
        bgcolor: tokens.navigation.background,
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
                onClick={() => { setNuevoContactoId(null); setNuevoAbierto(true); }}
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
          <TextField
            fullWidth
            size="small"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar folio o cliente…"
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
              mt: 1.35,
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
            const estadoVisual = estadoVisualDocumento(row);
            return (
              <Box
                key={row.id}
                onClick={() => selectRow(row)}
                sx={{
                  px: 1.15,
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                  <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.1 }}>{formatFolio(row)}</Typography>
                  <Typography sx={{ fontSize: 11, color: active ? tokens.navigation.selectionForeground : tokens.navigation.muted }}>{formatDate(row.fecha_documento)}</Typography>
                </Box>
                <Typography variant="figure" sx={{ fontSize: 14, mt: 0.25, color: active ? tokens.navigation.selectionForeground : tokens.navigation.foreground, lineHeight: 1.2 }} noWrap>
                  {row.nombre_cliente || 'Empresa activa'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', mt: 0.35 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'inherit' }}>{estado}</Typography>
                  <Tooltip title={estado} arrow>
                    <Box component="span" aria-label={estado} sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoVisual.tone), display: 'inline-block' }} />
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && listaVisible ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: tokens.content.background }}>
        {selectedRow ? (
          <>
            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 1.2, flexShrink: 0 }}>
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
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 12, fontWeight: 700 }}>
                  <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoVisualDocumento(selectedRow).tone) }} />
                  {estadoLabel(selectedRow.estatus_documento)}
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', px: { xs: 1, md: 2.25 }, minHeight: 40, flexShrink: 0, gap: 0.5, overflowX: 'auto' }}>
              <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ py: 0.5, flexShrink: 0 }}>
                <AccionIcono caption="Carta Porte" icon={<LocalShippingOutlinedIcon fontSize="small" />} onClick={() => onCartaPorte(selectedRow)} />
                {esBorrador && (
                  <AccionIcono
                    caption={timbrando ? 'Timbrando…' : 'Timbrar'}
                    icon={timbrando || viajeLoading ? <CircularProgress size={16} sx={{ color: tokens.action.primaryForeground }} /> : <NotificationsActiveOutlinedIcon fontSize="small" />}
                    disabled={timbrando || viajeLoading || !viajeListo || yaTimbrado}
                    onClick={() => void timbrar()}
                  />
                )}
                <AccionIcono caption="PDF" icon={<PrintOutlinedIcon fontSize="small" />} onClick={() => onPdf(selectedRow)} />
              </Stack>
              <Box sx={{ flex: 1, minWidth: 12 }} />
              <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ py: 0.5, flexShrink: 0, ml: 'auto' }}>
                {esBorrador && !editando && (
                  <AccionIcono caption="Editar" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => setEditando(true)} />
                )}
                {esBorrador && editando && (
                  <AccionIcono
                    caption={guardando ? 'Guardando…' : 'Guardar'}
                    icon={guardando ? <CircularProgress size={16} sx={{ color: tokens.action.primaryForeground }} /> : <SaveOutlinedIcon fontSize="small" />}
                    disabled={guardando}
                    onClick={() => void guardar()}
                  />
                )}
                {estadoLabel(selectedRow.estatus_documento) === 'Borrador' && (
                  <AccionIcono caption="Eliminar" icon={<DeleteOutlineIcon fontSize="small" />} onClick={() => onDelete(selectedRow)} />
                )}
              </Stack>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.5, md: 2.75 }, pb: { xs: 1.5, md: 2 } }}>
              {errorEdicion && (
                <Typography sx={{ mb: 1, fontSize: 13, color: tokens.action.destructive }}>{errorEdicion}</Typography>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 0.8 }}>
                <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>ESTATUS</Typography>
                  <Typography sx={{ mt: 0.35, fontSize: 14, fontWeight: 650, lineHeight: 1.3 }}>{estadoLabel(selectedRow.estatus_documento)}</Typography>
                </Box>
                <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.metric.applied.background, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>FECHA</Typography>
                  {editando ? (
                    <TextField fullWidth size="small" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} sx={{ mt: 0.6, ...campoSx }} />
                  ) : (
                    <Typography sx={{ mt: 0.35, fontSize: 14, fontWeight: 650, lineHeight: 1.3 }}>{formatDate(selectedRow.fecha_documento)}</Typography>
                  )}
                </Box>
                <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.metric.available.background, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>CONTACTO</Typography>
                  {editando ? (
                    <Autocomplete
                      options={contactos}
                      value={contactos.find((c) => c.id === contactoId) ?? null}
                      getOptionLabel={(c) => c.nombre}
                      onChange={(_, value) => setContactoId(value?.id ?? null)}
                      renderInput={(params) => <TextField {...params} size="small" placeholder="Contacto operativo" sx={campoSx} />}
                      sx={{ mt: 0.6 }}
                    />
                  ) : (
                    <Typography sx={{ mt: 0.35, fontSize: 14, fontWeight: 650, lineHeight: 1.3 }} noWrap>{selectedRow.nombre_cliente || 'Empresa activa'}</Typography>
                  )}
                </Box>
                <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.content.elevated, color: tokens.content.foreground, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>OBSERVACIONES</Typography>
                  {editando ? (
                    <TextField fullWidth size="small" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} sx={{ mt: 0.6, ...campoSx }} />
                  ) : (
                    <Typography sx={{ mt: 0.35, fontSize: 14, fontWeight: 650, lineHeight: 1.3 }} noWrap>{observaciones || '—'}</Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{
                mt: 1.25,
                bgcolor: tokens.content.well,
                borderRadius: 3,
                border: `1px solid ${tokens.content.border}`,
                overflow: 'hidden',
              }}>
                <Box sx={{ px: 1.75, py: 1.05, borderBottom: `1px solid ${tokens.content.border}` }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.content.foreground }}>Mercancías</Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr 120px' }, ...encabezadoCelda }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: tokens.table.headerFg }}>PRODUCTO</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: tokens.table.headerFg, display: { xs: 'none', sm: 'block' } }}>DESCRIPCIÓN</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: tokens.table.headerFg, textAlign: { xs: 'left', sm: 'right' }, display: { xs: 'none', sm: 'block' } }}>CANTIDAD</Typography>
                </Box>
                {partidas.map((partida, index) => (
                  <Box
                    key={String(partida.id ?? index)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr 120px' },
                      gap: { xs: 0.75, sm: 1 },
                      alignItems: 'center',
                      ...celda,
                      bgcolor: index % 2 === 1 ? tokens.grid.stripe : 'transparent',
                    }}
                  >
                    {editando ? (
                      <Autocomplete options={productos} value={productos.find((p) => p.id === Number(partida.producto_id)) ?? null} getOptionLabel={(p) => `${p.clave ?? ''} — ${p.descripcion ?? ''}`} onChange={(_, value) => setPartidasEditables((prev) => prev.map((item, i) => i === index ? { ...item, producto_id: value?.id ?? null, producto_nombre: value?.descripcion ?? '' } : item))} renderInput={(params) => <TextField {...params} size="small" label="Producto" sx={campoSx} />} />
                    ) : (
                      <Typography sx={{ fontSize: 13, color: tokens.table.cell }}>{String(partida.producto_nombre ?? partida.producto_id ?? '—')}</Typography>
                    )}
                    {editando ? (
                      <TextField size="small" label="Descripción" value={partida.descripcion_alterna ?? ''} onChange={(e) => setPartidasEditables((prev) => prev.map((item, i) => i === index ? { ...item, descripcion_alterna: e.target.value } : item))} sx={campoSx} />
                    ) : (
                      <Typography sx={{ fontSize: 13, color: tokens.table.cell }}>{String(partida.descripcion_alterna ?? partida.descripcion ?? '—')}</Typography>
                    )}
                    {editando ? (
                      <TextField size="small" type="number" label="Cantidad" value={partida.cantidad ?? 0} onChange={(e) => setPartidasEditables((prev) => prev.map((item, i) => i === index ? { ...item, cantidad: Number(e.target.value) } : item))} sx={{ ...campoSx, '& input': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }} />
                    ) : (
                      <Typography sx={{ fontSize: 13, color: tokens.table.cell, textAlign: { xs: 'left', sm: 'right' }, fontVariantNumeric: 'tabular-nums' }}>{String(partida.cantidad ?? 0)}</Typography>
                    )}
                  </Box>
                ))}
                {partidas.length === 0 && (
                  <Typography sx={{ px: 2, py: 3, fontSize: 13, color: tokens.content.muted, textAlign: 'center' }}>
                    Sin mercancías capturadas.
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
        open={nuevoAbierto}
        onClose={() => setNuevoAbierto(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.content.card,
              color: tokens.content.foreground,
              border: `1px solid ${tokens.content.border}`,
              borderRadius: 2,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, color: tokens.content.foreground }}>Nuevo Traslado</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 13, color: tokens.content.muted }}>
            Selecciona el contacto operativo antes de crear el borrador.
          </Typography>
          <Autocomplete
            options={contactos}
            getOptionLabel={(contacto) => contacto.nombre || ''}
            value={contactos.find((contacto) => Number(contacto.id) === Number(nuevoContactoId)) ?? null}
            onChange={(_, contacto) => setNuevoContactoId(contacto?.id ? Number(contacto.id) : null)}
            renderInput={(params) => <TextField {...params} label="Contacto operativo" required sx={campoSx} />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNuevoAbierto(false)} sx={{ textTransform: 'none', color: tokens.content.foreground }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!nuevoContactoId}
            onClick={() => { const contactoId = nuevoContactoId; if (!contactoId) return; setNuevoAbierto(false); void onCreate(contactoId); }}
            sx={{
              textTransform: 'none',
              bgcolor: tokens.action.primary,
              color: tokens.action.primaryForeground,
              '&:hover': { bgcolor: tokens.action.primaryHover },
              '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
            }}
          >Crear Traslado</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
