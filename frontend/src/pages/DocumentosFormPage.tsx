import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
  Divider,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';

import Grid from '@mui/material/Grid';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import type {
  CotizacionDetalle,
  CotizacionPartidaPayload,
  CotizacionCrearPayload,
  CotizacionPartida,
} from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import { getDocumento, createDocumento, updateDocumento, replacePartidas, downloadDocumentoPdf } from '../services/documentosService';
import { fetchContactos } from '../services/contactosService';
import { fetchProductos } from '../services/productosService';
import type { Producto } from '../types/producto';
import type { Contacto, ContactoDetalle } from '../types/contactos.types';
import { getEmpresaActivaId } from '../utils/empresaUtils';
import { DocumentoDatosFiscalesTab } from '../modules/documentos';
import { getContacto } from '../services/contactos.api';

const defaultFecha = () => new Date().toISOString().substring(0, 10);
const validarRFC = (rfc: string) => /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i.test(rfc);

type PartidaForm = CotizacionPartidaPayload & {
  id?: number;
  producto?: Producto | null;
};

const emptyPartida = (): PartidaForm => ({
  producto_id: null,
  descripcion_alterna: '',
  cantidad: 1,
  precio_unitario: 0,
  subtotal_partida: 0,
  iva_monto: 0,
  total_partida: 0,
  producto: null,
  observaciones: '',
});

type DocumentosFormPageProps = {
  tipoDocumento?: TipoDocumento;
};

const TEXTOS: Record<TipoDocumento, { nuevo: string; editar: string; descripcion: string; guardado: string; cargando: string; singular: string }> = {
  cotizacion: {
    nuevo: 'Nueva cotización',
    editar: 'Editar cotización',
    descripcion: 'Captura el encabezado y las partidas de la cotización.',
    guardado: 'Cotización guardada',
    cargando: 'Cargando cotización...',
    singular: 'cotización',
  },
  factura: {
    nuevo: 'Nueva factura',
    editar: 'Editar factura',
    descripcion: 'Captura el encabezado y las partidas de la factura.',
    guardado: 'Factura guardada',
    cargando: 'Cargando factura...',
    singular: 'factura',
  },
  pedido: {
    nuevo: 'Nuevo pedido',
    editar: 'Editar pedido',
    descripcion: 'Captura el encabezado y las partidas del pedido.',
    guardado: 'Pedido guardado',
    cargando: 'Cargando pedido...',
    singular: 'pedido',
  },
  remision: {
    nuevo: 'Nueva remisión',
    editar: 'Editar remisión',
    descripcion: 'Captura el encabezado y las partidas de la remisión.',
    guardado: 'Remisión guardada',
    cargando: 'Cargando remisión...',
    singular: 'remisión',
  },
};

export default function DocumentosFormPage({ tipoDocumento = 'cotizacion' }: DocumentosFormPageProps) {
  const { id } = useParams();
  const isEdit = Boolean(id && id !== 'nuevo');
  const navigate = useNavigate();
  const basePath = tipoDocumento === 'factura' ? '/facturas' : '/documentos';
  const showFiscalTab = tipoDocumento === 'factura';

  const [form, setForm] = useState<CotizacionCrearPayload>({
    tipo_documento: tipoDocumento,
    contacto_principal_id: null,
    fecha_documento: defaultFecha(),
    moneda: 'MXN',
    observaciones: '',
    subtotal: 0,
    iva: 0,
    total: 0,
    usuario_creacion_id: 1,
    empresa_id: getEmpresaActivaId(),
    rfc_receptor: '',
    nombre_receptor: '',
    regimen_fiscal_receptor: '',
    uso_cfdi: '',
    forma_pago: '',
    metodo_pago: '',
    codigo_postal_receptor: '',
  });

  const [partidas, setPartidas] = useState<PartidaForm[]>([emptyPartida()]);
  const [expandedObs, setExpandedObs] = useState<boolean[]>([false]);
  const [editingPrecio, setEditingPrecio] = useState<boolean[]>([false]);
  const [precioInputs, setPrecioInputs] = useState<string[]>(['']);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [activeTab, setActiveTab] = useState<number>(0);

  const precioRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cantidadRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevContactoRef = useRef<number | null | undefined>(undefined);
  const skipFiscalFetchRef = useRef<boolean>(false);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: form.moneda || 'MXN',
        minimumFractionDigits: 2,
      }),
    [form.moneda]
  );

  const recalcTotales = (partidasList: PartidaForm[]) => {
    const subtotal = partidasList.reduce((acc, p) => acc + (p.subtotal_partida || 0), 0);
    const iva = partidasList.reduce((acc, p) => acc + (p.iva_monto || 0), 0);
    const total = partidasList.reduce((acc, p) => acc + (p.total_partida || 0), 0);
    setForm((prev) => ({ ...prev, subtotal, iva, total }));
  };

  const calcularPartida = (partida: PartidaForm): PartidaForm => {
    const cantidad = Number(partida.cantidad) || 0;
    const precio = Number(partida.precio_unitario) || 0;
    const ivaPorcentaje = partida.producto?.iva_porcentaje ?? 16;
    const subtotal_partida = cantidad * precio;
    const iva_monto = subtotal_partida * (ivaPorcentaje / 100);
    const total_partida = subtotal_partida + iva_monto;
    return {
      ...partida,
      cantidad,
      precio_unitario: precio,
      subtotal_partida,
      iva_monto,
      total_partida,
    };
  };

  const setPartidaAt = (index: number, updater: (prev: PartidaForm) => PartidaForm) => {
    setPartidas((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = calcularPartida(updater(current));
      setTimeout(() => recalcTotales(next), 0);
      return next;
    });
  };

  const addRow = () => {
    setPartidas((prev) => [...prev, emptyPartida()]);
    setExpandedObs((prev) => [...prev, false]);
    setEditingPrecio((prev) => [...prev, false]);
    setPrecioInputs((prev) => [...prev, '']);
  };

  const removeRow = (index: number) => {
    setPartidas((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      const next = filtered.length === 0 ? [emptyPartida()] : filtered;
      setExpandedObs((expPrev) => {
        const filteredExp = expPrev.filter((_, i) => i !== index);
        let aligned = filteredExp;
        if (next.length > filteredExp.length) aligned = [...filteredExp, false];
        if (aligned.length === 0) aligned = [false];
        return aligned;
      });
      setEditingPrecio((editPrev) => {
        const filteredEdit = editPrev.filter((_, i) => i !== index);
        let aligned = filteredEdit;
        if (next.length > filteredEdit.length) aligned = [...filteredEdit, false];
        if (aligned.length === 0) aligned = [false];
        return aligned;
      });
      setPrecioInputs((inputsPrev) => {
        const filteredInputs = inputsPrev.filter((_, i) => i !== index);
        let aligned = filteredInputs;
        if (next.length > filteredInputs.length) aligned = [...filteredInputs, ''];
        if (aligned.length === 0) aligned = [''];
        return aligned;
      });
      recalcTotales(next);
      return next;
    });
  };

  const loadCombos = async () => {
    try {
      const [c, p] = await Promise.all([fetchContactos(), fetchProductos()]);
      setContactos(c);
      setProductos(p);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDocumento = async () => {
    if (!isEdit || !id) return;
    try {
      setLoading(true);
      const data: CotizacionDetalle = await getDocumento(Number(id), tipoDocumento);
      const doc = data.documento;
      setForm({
        tipo_documento: doc.tipo_documento ?? tipoDocumento,
        contacto_principal_id: doc.contacto_principal_id,
        fecha_documento: doc.fecha_documento?.substring(0, 10) || defaultFecha(),
        moneda: doc.moneda || 'MXN',
        observaciones: doc.observaciones || '',
        subtotal: doc.subtotal || 0,
        iva: doc.iva || 0,
        total: doc.total || 0,
        usuario_creacion_id: doc.usuario_creacion_id || 1,
        empresa_id: doc.empresa_id,
        rfc_receptor: (doc as any).rfc_receptor || (doc as any).cliente_rfc || '',
        nombre_receptor: (doc as any).nombre_receptor || (doc as any).cliente_nombre || '',
        regimen_fiscal_receptor: (doc as any).regimen_fiscal_receptor || '',
        uso_cfdi: (doc as any).uso_cfdi || '',
        forma_pago: (doc as any).forma_pago || '',
        metodo_pago: (doc as any).metodo_pago || '',
        codigo_postal_receptor: (doc as any).codigo_postal_receptor || '',
      });
      skipFiscalFetchRef.current = true;
      prevContactoRef.current = doc.contacto_principal_id;

      const mapped: PartidaForm[] = data.partidas.map((p: CotizacionPartida) => {
        const prod = productos.find((pr) => pr.id === p.producto_id) || null;
        return calcularPartida({
          id: p.id,
          producto_id: p.producto_id,
          descripcion_alterna: p.descripcion_alterna ?? '',
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
          subtotal_partida: p.subtotal_partida,
          iva_monto: p.iva_monto,
          total_partida: p.total_partida,
          observaciones: p.observaciones ?? '',
          producto: prod,
        });
      });
      const nextPartidas = mapped.length ? mapped : [emptyPartida()];
      setPartidas(nextPartidas);
      setExpandedObs(nextPartidas.map((p) => Boolean(p.observaciones?.trim())) || [false]);
      setEditingPrecio(nextPartidas.map(() => false));
      setPrecioInputs(nextPartidas.map((p) => (p.precio_unitario ?? '').toString()));
      recalcTotales(mapped);
      setError(null);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : `No se pudo cargar la ${TEXTOS[tipoDocumento].singular}`;
      setError(mensaje);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    loadDocumento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, tipoDocumento]);

  useEffect(() => {
    if (tipoDocumento !== 'factura') return;

    const contactoId = form.contacto_principal_id;

    if (!contactoId) {
      prevContactoRef.current = contactoId;
      return;
    }

    if (skipFiscalFetchRef.current) {
      skipFiscalFetchRef.current = false;
      prevContactoRef.current = contactoId;
      return;
    }

    if (prevContactoRef.current === contactoId) return;

    cargarDatosFiscalesContacto(contactoId);
    prevContactoRef.current = contactoId;
  }, [form.contacto_principal_id, tipoDocumento]);

  const handleSave = async () => {
    if (!form.contacto_principal_id) {
      setSnackbar({ open: true, message: 'Selecciona un cliente', severity: 'error' });
      return;
    }
    if (tipoDocumento === 'factura') {
      if (!form.rfc_receptor || !validarRFC(form.rfc_receptor)) {
        setSnackbar({ open: true, message: 'RFC receptor es obligatorio y debe ser válido', severity: 'error' });
        return;
      }
      if (!form.regimen_fiscal_receptor || !form.uso_cfdi || !form.forma_pago || !form.metodo_pago || !form.codigo_postal_receptor) {
        setSnackbar({ open: true, message: 'Completa los datos fiscales requeridos', severity: 'error' });
        return;
      }
    }
    try {
      setSaving(true);
      const payload: CotizacionCrearPayload = {
        ...form,
        tipo_documento: tipoDocumento,
        subtotal: form.subtotal || 0,
        iva: form.iva || 0,
        total: form.total || 0,
        empresa_id: getEmpresaActivaId(),
        rfc_receptor: form.rfc_receptor?.trim() || null,
        nombre_receptor: form.nombre_receptor?.trim() || null,
        regimen_fiscal_receptor: form.regimen_fiscal_receptor?.trim() || null,
        uso_cfdi: form.uso_cfdi?.trim() || null,
        forma_pago: form.forma_pago?.trim() || null,
        metodo_pago: form.metodo_pago?.trim() || null,
        codigo_postal_receptor: form.codigo_postal_receptor?.trim() || null,
      };

      let docId: number;
      if (isEdit && id) {
        const updated = await updateDocumento(Number(id), tipoDocumento, payload);
        docId = (updated as any).id ?? Number(id);
      } else {
        const created = await createDocumento(tipoDocumento, payload);
        docId = (created as any).id;
      }

      const partidasPayload: CotizacionPartidaPayload[] = partidas.map((p) => ({
        producto_id: p.producto_id,
        descripcion_alterna: p.descripcion_alterna ?? '',
        cantidad: p.cantidad ?? 0,
        precio_unitario: p.precio_unitario ?? 0,
        subtotal_partida: p.subtotal_partida ?? 0,
        iva_monto: p.iva_monto ?? 0,
        total_partida: p.total_partida ?? 0,
        observaciones: p.observaciones ?? '',
      }));
      await replacePartidas(docId, tipoDocumento, partidasPayload);

      setSnackbar({ open: true, message: TEXTOS[tipoDocumento].guardado, severity: 'success' });
      setTimeout(() => navigate(basePath), 400);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      if (message.toLowerCase().includes('serie') && message.toLowerCase().includes('número')) {
        setDuplicateDialog({ open: true, message });
      } else {
        setSnackbar({ open: true, message, severity: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleProductoChange = (index: number, producto: Producto | null) => {
    setPartidaAt(index, (prev) => ({
      ...prev,
      producto_id: producto?.id ?? null,
      descripcion_alterna: producto?.descripcion || prev.descripcion_alterna,
      precio_unitario: producto?.precio_publico ?? producto?.precio_menudeo ?? prev.precio_unitario ?? 0,
      producto: producto ?? null,
    }));
  };

  const handleCantidadPrecioChange = (index: number, field: 'cantidad' | 'precio_unitario', value: string) => {
    setPartidaAt(index, (prev) => ({ ...prev, [field]: Number(value) }));
  };

  const handleDescripcionChange = (index: number, value: string) => {
    setPartidaAt(index, (prev) => ({ ...prev, descripcion_alterna: value }));
  };

  const handleObservacionesChange = (index: number, value: string) => {
    setPartidaAt(index, (prev) => ({ ...prev, observaciones: value }));
  };

  const toggleObservaciones = (index: number) => {
    setExpandedObs((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const esDetalleContacto = (resp: ContactoDetalle | Contacto): resp is ContactoDetalle => 'contacto' in resp;

  const handleClienteSelect = (value: Contacto | null) => {
    setForm((prev) => ({ ...prev, contacto_principal_id: value?.id ?? null }));
  };

  const cargarDatosFiscalesContacto = async (contactoId: number) => {
    try {
      const detalle = await getContacto(contactoId);
      const datosFiscales = esDetalleContacto(detalle) ? detalle.datos_fiscales : null;
      const nombreContacto = esDetalleContacto(detalle) ? detalle.contacto?.nombre : (detalle as Contacto).nombre;

      setForm((prev) => ({
        ...prev,
        contacto_principal_id: contactoId,
        rfc_receptor: datosFiscales?.rfc || '',
        nombre_receptor: nombreContacto || '',
        regimen_fiscal_receptor: datosFiscales?.regimen_fiscal || '',
        uso_cfdi: datosFiscales?.uso_cfdi || '',
        forma_pago: datosFiscales?.forma_pago || '',
        metodo_pago: datosFiscales?.metodo_pago || '',
        codigo_postal_receptor: datosFiscales?.codigo_postal || '',
      }));
    } catch (err) {
      console.error('No se pudo cargar datos fiscales del contacto', err);
    }
  };

  const filterProductos = (options: Producto[], state: any) => {
    const term = (state.inputValue || '').toString().trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => {
      const clave = (opt.clave || '').toLowerCase();
      const descripcion = (opt.descripcion || '').toLowerCase();
      return clave.includes(term) || descripcion.includes(term);
    });
  };

  const fiscalValues = {
    rfc_receptor: form.rfc_receptor || '',
    nombre_receptor: form.nombre_receptor || '',
    regimen_fiscal_receptor: form.regimen_fiscal_receptor || '',
    uso_cfdi: form.uso_cfdi || '',
    forma_pago: form.forma_pago || '',
    metodo_pago: form.metodo_pago || '',
    codigo_postal_receptor: form.codigo_postal_receptor || '',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(basePath)}>
            Volver
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              {isEdit ? TEXTOS[tipoDocumento].editar : TEXTOS[tipoDocumento].nuevo}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              {TEXTOS[tipoDocumento].descripcion}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {isEdit && id && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={async () => {
                try {
                  setDownloadingPdf(true);
                  const blob = await downloadDocumentoPdf(Number(id), tipoDocumento);
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setTimeout(() => URL.revokeObjectURL(url), 10_000);
                } catch (err: any) {
                  setError(err?.message || 'No se pudo generar el PDF');
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              disabled={loading || downloadingPdf}
            >
              {downloadingPdf ? 'Generando...' : 'PDF'}
            </Button>
          )}
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </Stack>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {showFiscalTab && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="Pestañas documento">
            <Tab label="Documento" value={0} />
            <Tab label="Datos fiscales" value={1} />
          </Tabs>
        </Box>
      )}

      {(!showFiscalTab || activeTab === 0) && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={22} />
              <Typography color="text.secondary">{TEXTOS[tipoDocumento].cargando}</Typography>
            </Stack>
          ) : (
            <>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    fullWidth
                    options={contactos}
                    loading={contactos.length === 0}
                    getOptionLabel={(option) => option.nombre || ''}
                    value={contactos.find((c) => c.id === form.contacto_principal_id) || null}
                    onChange={(_, value) => handleClienteSelect(value)}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        fullWidth
                        label="Cliente"
                        required
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Fecha documento"
                    type="date"
                    value={form.fecha_documento}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_documento: e.target.value }))}
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ style: { fontSize: 13 } }}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Observaciones"
                    value={form.observaciones || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ style: { fontSize: 13 } }}
                  />
                </Grid>
              </Grid>

              <Divider />

              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="h6" color="#1d2f68" fontWeight={700}>
                  Partidas
                </Typography>
                <Button startIcon={<AddIcon />} onClick={addRow} variant="outlined" size="small">
                  Agregar partida
                </Button>
              </Stack>

              <Stack spacing={1}>
                <Box
                  sx={{
                    display: { xs: 'none', md: 'grid' },
                    gridTemplateColumns: '180px 1fr 80px 120px 120px 120px 120px 40px 48px',
                    gap: 1,
                    px: 1,
                    color: '#6b7280',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Box>Producto</Box>
                  <Box>Descripción</Box>
                  <Box textAlign="right">Cant.</Box>
                  <Box textAlign="right">Precio</Box>
                  <Box textAlign="right">Subtotal</Box>
                  <Box textAlign="right">IVA</Box>
                  <Box textAlign="right">Total</Box>
                  <Box textAlign="center">Obs.</Box>
                  <Box textAlign="center">&nbsp;</Box>
                </Box>

                {partidas.map((partida, index) => (
                  <React.Fragment key={index}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: 1.25,
                        borderColor: '#e5e7eb',
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: '180px 1fr 80px 120px 120px 120px 120px 40px 48px',
                        },
                        gap: { xs: 1, md: 1 },
                        alignItems: 'center',
                      }}
                    >
                      <Autocomplete
                        options={productos}
                        loading={productos.length === 0}
                        getOptionLabel={(option) => option.clave || ''}
                        value={productos.find((p) => p.id === partida.producto_id) || null}
                        onChange={(_, value) => handleProductoChange(index, value)}
                        filterOptions={filterProductos}
                        slotProps={{
                          popper: {
                            placement: 'bottom-start',
                            modifiers: [
                              {
                                name: 'offset',
                                options: {
                                  offset: [0, 4],
                                },
                              },
                            ],
                            sx: {
                              minWidth: 560,
                              maxWidth: 720,
                            },
                          },
                            }}
                        renderOption={(props, option) => (
                          <Box
                            component="li"
                            {...props}
                            sx={{
                              display: 'grid !important',
                              gridTemplateColumns: '140px 1fr',
                              columnGap: 2,
                              alignItems: 'center',
                              fontSize: 12,
                              px: 1,
                              width: '100%',
                            }}
                          >
                            <Typography
                              component="span"
                              fontWeight={700}
                              sx={{
                                fontSize: 12,
                                color: '#111827',
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {(option as Producto)?.clave || ''}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{
                                fontSize: 12,
                                color: '#374151',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {(option as Producto)?.descripcion || ''}
                            </Typography>
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...(params as any)}
                            label={undefined}
                            placeholder="Producto"
                            size="small"
                            InputLabelProps={{ sx: { fontSize: 13 } }}
                            inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                          />
                        )}
                        sx={{ minWidth: 0 }}
                      />

                      <TextField
                        label={undefined}
                        placeholder="Descripción"
                        value={partida.descripcion_alterna ?? ''}
                        onChange={(e) => handleDescripcionChange(index, e.target.value)}
                        size="small"
                        InputProps={{ sx: { fontSize: 13 } }}
                        inputProps={{ style: { fontSize: 13 } }}
                        sx={{ minWidth: 0 }}
                        disabled
                      />

                      <TextField
                        label={undefined}
                        placeholder="Cant."
                        type="number"
                        value={partida.cantidad ?? 0}
                        onChange={(e) => handleCantidadPrecioChange(index, 'cantidad', e.target.value)}
                        size="small"
                        inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right', fontSize: 13 } }}
                        onFocus={() => {
                          requestAnimationFrame(() => {
                            cantidadRefs.current[index]?.select();
                          });
                        }}
                        inputRef={(el) => {
                          cantidadRefs.current[index] = el;
                        }}
                      />

                      <TextField
                        label={undefined}
                        placeholder="Precio"
                        type="text"
                        value={editingPrecio[index]
                          ? precioInputs[index] ?? ''
                          : formatter.format(partida.precio_unitario ?? 0)}
                        onChange={(e) => {
                          const raw = e.target.value ?? '';
                          setPrecioInputs((prev) => {
                            const next = [...prev];
                            next[index] = raw;
                            return next;
                          });
                          const numeric = parseFloat(raw.replace(/[^0-9.,-]/g, '').replace(',', '.'));
                          handleCantidadPrecioChange(index, 'precio_unitario', Number.isFinite(numeric) ? String(numeric) : '0');
                        }}
                        onFocus={(e) => {
                          setEditingPrecio((prev) => {
                            const next = [...prev];
                            next[index] = true;
                            return next;
                          });
                          setPrecioInputs((prev) => {
                            const next = [...prev];
                            next[index] = (partida.precio_unitario ?? '').toString();
                            return next;
                          });
                          requestAnimationFrame(() => {
                            precioRefs.current[index]?.select();
                          });
                        }}
                        onBlur={() => {
                          setEditingPrecio((prev) => {
                            const next = [...prev];
                            next[index] = false;
                            return next;
                          });
                          setPrecioInputs((prev) => {
                            const next = [...prev];
                            next[index] = '';
                            return next;
                          });
                        }}
                        size="small"
                        inputProps={{ style: { textAlign: 'right', fontSize: 13 } }}
                        inputRef={(el) => {
                          precioRefs.current[index] = el;
                        }}
                      />

                      <TextField
                        label={undefined}
                        value={formatter.format(partida.subtotal_partida ?? 0)}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      <TextField
                        label={undefined}
                        value={formatter.format(partida.iva_monto ?? 0)}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      <TextField
                        label={undefined}
                        value={formatter.format(partida.total_partida ?? 0)}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      <IconButton
                        onClick={() => toggleObservaciones(index)}
                        aria-label="Observaciones"
                        size="small"
                        color={(partida.observaciones?.trim() || expandedObs[index]) ? 'primary' : 'default'}
                      >
                        <CommentIcon fontSize="small" />
                      </IconButton>

                      <IconButton color="error" onClick={() => removeRow(index)} aria-label="Eliminar partida" size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>

                    {(expandedObs[index] || Boolean(partida.observaciones?.trim())) && (
                      <Box sx={{ gridColumn: { xs: '1', md: '2 / 9' }, mt: { xs: 0.5, md: 0.25 } }}>
                        <TextField
                          label="Observaciones de la partida"
                          placeholder="Texto adicional para impresión"
                          value={partida.observaciones ?? ''}
                          onChange={(e) => handleObservacionesChange(index, e.target.value)}
                          fullWidth
                          multiline
                          minRows={2}
                          size="small"
                          InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                          inputProps={{ style: { fontSize: 13 } }}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                ))}
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1.5} alignItems="flex-end">
                <TextField
                  label="Subtotal"
                  value={formatter.format(form.subtotal || 0)}
                  InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 180 } }}
                />
                <TextField
                  label="IVA"
                  value={formatter.format(form.iva || 0)}
                  InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 160 } }}
                />
                <TextField
                  label="Total"
                  value={formatter.format(form.total || 0)}
                  InputProps={{ readOnly: true, sx: { fontSize: 13, fontWeight: 700 }, style: { textAlign: 'right' } }}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 180 } }}
                />
              </Stack>
            </>
          )}
        </Paper>
      )}

      {showFiscalTab && activeTab === 1 && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DocumentoDatosFiscalesTab
            values={fiscalValues}
            onChange={(changes) => setForm((prev) => ({ ...prev, ...changes }))}
            disabled={saving || loading}
          />
        </Paper>
      )}

      <Dialog open={duplicateDialog.open} onClose={() => setDuplicateDialog({ open: false, message: '' })}>
        <DialogTitle fontWeight={700}>Documento duplicado</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            Ya existe un documento con la misma serie y número. Por favor verifique el consecutivo antes de continuar.
            {duplicateDialog.message && (
              <>
                <br />
                <br />
                <strong>Detalle:</strong> {duplicateDialog.message}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setDuplicateDialog({ open: false, message: '' })}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
