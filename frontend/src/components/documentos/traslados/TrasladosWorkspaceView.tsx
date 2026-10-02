import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete, Box, Button, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { Contacto } from '../../../types/contactos.types';
import type { Producto } from '../../../types/producto';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
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
  onCreate: () => void | Promise<void>;
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
  if (normalized === 'timbrado' || normalized === 'emitido') return 'Emitido';
  if (normalized === 'cancelado' || normalized === 'cancelada') return 'Cancelado';
  return 'Borrador';
};

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

  return (
    <Box sx={{ display: 'flex', flexDirection: compacto ? 'column' : 'row', height: 'calc(100dvh - 96px)', minHeight: 560, overflow: 'hidden', bgcolor: tokens.content.background }}>
      <Box sx={{ width: compacto ? '100%' : 380, display: listaVisible ? 'flex' : 'none', flexDirection: 'column', minHeight: 0, bgcolor: tokens.navigation.background, color: tokens.navigation.foreground, borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}` }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: tokens.navigation.muted }}>TRASLADOS</Typography>
              <Typography sx={{ mt: 0.4, fontSize: 13, color: tokens.navigation.subtle }}>{rows.length} en vista</Typography>
            </Box>
            <Tooltip title="Nuevo Traslado"><IconButton onClick={() => void onCreate()} sx={{ bgcolor: tokens.navigation.control, color: tokens.navigation.controlForeground, '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground } }}><AddIcon /></IconButton></Tooltip>
          </Stack>
          <TextField
            fullWidth size="small" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar folio o cliente…"
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.75, fontSize: 18, color: tokens.navigation.muted }} /> }}
            sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { color: tokens.navigation.foreground, bgcolor: tokens.navigation.summary, borderRadius: 2, '& fieldset': { borderColor: 'transparent' } }, '& input': { fontSize: 13 } }}
          />
        </Box>
        <Box sx={{ overflowY: 'auto', flex: 1, px: 1, pb: 1 }}>
          {isLoading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={24} /></Box> : rows.map((row) => {
            const active = Number(row.id) === Number(selectedRow?.id);
            return (
              <Box key={row.id} onClick={() => selectRow(row)} sx={{ p: 1.4, mb: 0.6, borderRadius: 1.5, cursor: 'pointer', bgcolor: active ? tokens.navigation.selected : 'transparent', border: `1px solid ${active ? tokens.navigation.border : 'transparent'}`, '&:hover': { bgcolor: tokens.navigation.hover } }}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{formatFolio(row)}</Typography>
                  <Typography sx={{ fontSize: 11, color: tokens.navigation.muted }}>{estadoLabel(row.estatus_documento)}</Typography>
                </Stack>
                <Typography sx={{ mt: 0.35, fontSize: 12, color: tokens.navigation.subtle }}>{formatDate(row.fecha_documento)}</Typography>
                <Typography sx={{ mt: 0.35, fontSize: 12.5, color: tokens.navigation.foreground }} noWrap>{row.nombre_cliente || 'Empresa activa'}</Typography>
              </Box>
            );
          })}
          {!isLoading && rows.length === 0 && <Typography sx={{ p: 2, color: tokens.navigation.muted, fontSize: 13 }}>No hay Traslados.</Typography>}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: listaVisible ? (compacto ? 'none' : 'flex') : 'flex', flexDirection: 'column', overflow: 'auto', p: { xs: 1.5, md: 2.5 } }}>
        {selectedRow ? (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                {compacto && <IconButton onClick={() => setDetalleMovil(false)}><ArrowBackIcon /></IconButton>}
                <Box><Typography variant="overline" sx={{ color: tokens.content.muted, letterSpacing: '0.14em' }}>TRASLADO</Typography><Typography variant="h5" sx={{ fontWeight: 800, color: tokens.content.foreground }}>{formatFolio(selectedRow)}</Typography></Box>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end">
                <Button size="small" variant="contained" startIcon={<LocalShippingOutlinedIcon />} onClick={() => onCartaPorte(selectedRow)}>Carta Porte</Button>
                {esBorrador && <Button size="small" variant="contained" color="success" startIcon={timbrando ? <CircularProgress size={16} color="inherit" /> : <NotificationsActiveOutlinedIcon />} disabled={timbrando || viajeLoading || !viajeListo || yaTimbrado} onClick={() => void timbrar()}>{timbrando ? 'Timbrando…' : 'Timbrar'}</Button>}
                {esBorrador && !editando && <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditando(true)}>Editar</Button>}
                {esBorrador && editando && <Button size="small" variant="contained" disabled={guardando} onClick={() => void guardar()}>Guardar</Button>}
                <Button size="small" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => onPdf(selectedRow)}>PDF</Button>
                {estadoLabel(selectedRow.estatus_documento) === 'Borrador' && <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete(selectedRow)}>Eliminar</Button>}
              </Stack>
            </Stack>
            {errorEdicion && <Typography color="error" sx={{ mb: 1 }}>{errorEdicion}</Typography>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
              <Paper variant="outlined" sx={{ p: 1.4, flex: 1, borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">Estatus</Typography><Typography sx={{ mt: 0.35, fontWeight: 700, fontSize: 13 }}>{estadoLabel(selectedRow.estatus_documento)}</Typography></Paper>
              <Paper variant="outlined" sx={{ p: 1.4, flex: 1, borderRadius: 1.5 }}>{editando ? <TextField fullWidth size="small" type="date" label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} InputLabelProps={{ shrink: true }} /> : <><Typography variant="caption" color="text.secondary">Fecha</Typography><Typography sx={{ mt: 0.35, fontWeight: 700, fontSize: 13 }}>{formatDate(selectedRow.fecha_documento)}</Typography></>}</Paper>
              <Paper variant="outlined" sx={{ p: 1.4, flex: 1, borderRadius: 1.5 }}>{editando ? <Autocomplete options={contactos} value={contactos.find((c) => c.id === contactoId) ?? null} getOptionLabel={(c) => c.nombre} onChange={(_, value) => setContactoId(value?.id ?? null)} renderInput={(params) => <TextField {...params} size="small" label="Contacto operativo" />} /> : <><Typography variant="caption" color="text.secondary">Contacto operativo</Typography><Typography sx={{ mt: 0.35, fontWeight: 700, fontSize: 13 }}>{selectedRow.nombre_cliente || 'Empresa activa'}</Typography></>}</Paper>
              <Paper variant="outlined" sx={{ p: 1.4, flex: 1, borderRadius: 1.5 }}>{editando ? <TextField fullWidth size="small" label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /> : <><Typography variant="caption" color="text.secondary">Observaciones</Typography><Typography sx={{ mt: 0.35, fontWeight: 700, fontSize: 13 }} noWrap>{observaciones || '—'}</Typography></>}</Paper>
            </Stack>
            <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.3, borderBottom: `1px solid ${tokens.content.border}` }}><Typography sx={{ fontWeight: 800 }}>Mercancías</Typography></Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 120px', gap: 1, px: 2, py: 1, bgcolor: tokens.content.subtle }}><Typography variant="caption">Producto</Typography><Typography variant="caption">Descripción</Typography><Typography variant="caption" textAlign="right">Cantidad</Typography></Box>
              {partidas.map((partida, index) => <Box key={String(partida.id ?? index)} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr 120px' }, gap: 1, px: 2, py: 1.25, borderTop: `1px solid ${tokens.content.border}` }}>
                {editando ? <Autocomplete options={productos} value={productos.find((p) => p.id === Number(partida.producto_id)) ?? null} getOptionLabel={(p) => `${p.clave ?? ''} — ${p.descripcion ?? ''}`} onChange={(_, value) => setPartidasEditables((prev) => prev.map((item, i) => i === index ? { ...item, producto_id: value?.id ?? null, producto_nombre: value?.descripcion ?? '' } : item))} renderInput={(params) => <TextField {...params} size="small" label="Producto" />} /> : <Typography variant="body2">{String(partida.producto_nombre ?? partida.producto_id ?? '—')}</Typography>}
                {editando ? <TextField size="small" label="Descripción" value={partida.descripcion_alterna ?? ''} onChange={(e) => setPartidasEditables((prev) => prev.map((item, i) => i === index ? { ...item, descripcion_alterna: e.target.value } : item))} /> : <Typography variant="body2">{String(partida.descripcion_alterna ?? partida.descripcion ?? '—')}</Typography>}
                {editando ? <TextField size="small" type="number" label="Cantidad" value={partida.cantidad ?? 0} onChange={(e) => setPartidasEditables((prev) => prev.map((item, i) => i === index ? { ...item, cantidad: Number(e.target.value) } : item))} /> : <Typography variant="body2" textAlign="right">{String(partida.cantidad ?? 0)}</Typography>}
              </Box>)}
              {partidas.length === 0 && <Typography sx={{ p: 2 }} color="text.secondary">Sin mercancías capturadas.</Typography>}
            </Paper>
          </>
        ) : <Typography color="text.secondary">Selecciona un Traslado.</Typography>}
      </Box>
    </Box>
  );
}
