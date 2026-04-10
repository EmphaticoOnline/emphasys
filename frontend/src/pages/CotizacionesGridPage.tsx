import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  type GridCellParams,
  type GridRenderEditCellParams,
} from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CloseIcon from '@mui/icons-material/Close';
import type { CotizacionCrearPayload, CotizacionListado, EstadoSeguimiento } from '../types/cotizacion';
import { createCotizacion, deleteCotizacion, getCotizaciones, updateCotizacion } from '../services/cotizacionesService';
import { fetchContactos } from '../services/contactosService';
import { crearContacto } from '../services/contactos.api';
import { fetchProductos } from '../services/productosService';
import type { Producto } from '../types/producto';
import type { Contacto } from '../types/contactos.types';
import { useSession } from '../session/useSession';
import {
  generarDocumentoDesdeOrigen,
  getOpcionesGeneracion,
  prepararGeneracion,
  type GenerarDocumentoPartidaInput,
} from '../services/documentGenerationService';

const ESTADOS: { value: EstadoSeguimiento; label: string; color: string; textColor: string }[] = [
  { value: 'cotizado', label: 'Cotizado', color: '#fff4ce', textColor: '#8a6d1d' },
  { value: 'seguimiento', label: 'Seguimiento', color: '#e6f0ff', textColor: '#1d4ed8' },
  { value: 'cerrado', label: 'Cerrado', color: '#e7f8ed', textColor: '#166534' },
  { value: 'perdido', label: 'Perdido', color: '#ffe5e5', textColor: '#b91c1c' },
];

const defaultFecha = () => new Date().toISOString().slice(0, 10);

type QuickFilter = 'todos' | 'pendientes' | 'cerrados' | 'perdidos';

type CotizacionGridRow = CotizacionListado & {
  estado_seguimiento: EstadoSeguimiento | null;
  comentario_seguimiento: string | null;
  producto_resumen: string | null;
};

type NuevaCotizacionForm = {
  contacto: Contacto | null;
  fecha: string;
  producto_resumen: string;
  total: number | '';
  comentario_seguimiento: string;
  estado_seguimiento: EstadoSeguimiento;
};

const nuevaCotizacionInicial = (): NuevaCotizacionForm => ({
  contacto: null,
  fecha: defaultFecha(),
  producto_resumen: '',
  total: '',
  comentario_seguimiento: '',
  estado_seguimiento: 'cotizado',
});

export default function CotizacionesGridPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [rows, setRows] = useState<CotizacionGridRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NuevaCotizacionForm>(nuevaCotizacionInicial());
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [convirtiendoId, setConvirtiendoId] = useState<number | null>(null);
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [crearClienteNombre, setCrearClienteNombre] = useState('');
  const [crearClienteLoading, setCrearClienteLoading] = useState(false);
  const [crearClienteRowId, setCrearClienteRowId] = useState<number | null>(null);
  const [crearClienteParaNuevo, setCrearClienteParaNuevo] = useState(false);
  const [crearClienteTipo, setCrearClienteTipo] = useState<'Lead' | 'Cliente'>('Lead');
  const [filtros, setFiltros] = useState<{
    fechaDesde: string;
    fechaHasta: string;
    clienteId: number | null;
    montoMin: string;
    montoMax: string;
    estado: EstadoSeguimiento | '';
  }>({ fechaDesde: '', fechaHasta: '', clienteId: null, montoMin: '', montoMax: '', estado: '' });
  const [productos, setProductos] = useState<Producto[]>([]);
  const editableFields = useMemo(
    () => new Set(['estado_seguimiento', 'comentario_seguimiento', 'nombre_cliente', 'fecha_documento', 'producto_resumen']),
    []
  );

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  const normalizarRow = useCallback((row: CotizacionListado): CotizacionGridRow => ({
    ...row,
    estado_seguimiento: row.estado_seguimiento ?? 'cotizado',
    comentario_seguimiento: row.comentario_seguimiento ?? null,
    producto_resumen: row.producto_resumen ?? null,
  }), []);

  const cargarContactos = useCallback(async () => {
    try {
      const data = await fetchContactos();
      console.log('contactos recibidos (raw):', data);
      console.log('tipos_contacto:', Array.from(new Set(data.map((c) => c.tipo_contacto))));
      // Filtramos solo Lead / Cliente
      const filtrados = data.filter((c) => ['Lead', 'Cliente'].includes((c.tipo_contacto || '').trim()));
      setContactos(filtrados);
    } catch (err) {
      console.error('No se pudieron cargar contactos', err);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCotizaciones();
      setRows(data.map(normalizarRow));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  }, [normalizarRow]);

  useEffect(() => {
    void load();
    void cargarContactos();
    void fetchProductos()
      .then((data) => setProductos(data))
      .catch((err) => console.error('No se pudieron cargar productos', err));
  }, [load, cargarContactos]);

  const persistSeguimiento = async (
    id: number,
    payload: Pick<CotizacionCrearPayload, 'estado_seguimiento' | 'comentario_seguimiento'>,
    previousRow?: CotizacionGridRow
  ): Promise<CotizacionGridRow> => {
    setSavingRowId(id);
    try {
      const updated = await updateCotizacion(id, payload);
      const merged: CotizacionGridRow = {
        ...(previousRow ?? rows.find((r) => r.id === id) ?? ({} as CotizacionGridRow)),
        ...payload,
        ...(updated as Partial<CotizacionGridRow>),
      };
      setRows((prev) => prev.map((row) => (row.id === id ? merged : row)));
      return merged;
    } finally {
      setSavingRowId(null);
    }
  };

  const contactosMap = useMemo(() => {
    const map = new Map<number, Contacto>();
    contactos.forEach((c) => { if (c.id) map.set(c.id, c); });
    return map;
  }, [contactos]);

  const processRowUpdate = async (newRow: CotizacionGridRow, oldRow: CotizacionGridRow) => {
    const payload: Partial<CotizacionCrearPayload> = {};

    if (newRow.contacto_principal_id !== oldRow.contacto_principal_id) {
      payload.contacto_principal_id = newRow.contacto_principal_id ?? null;
    }
    if ((newRow.fecha_documento || '') !== (oldRow.fecha_documento || '')) {
      payload.fecha_documento = newRow.fecha_documento;
    }
    if ((newRow.producto_resumen || '') !== (oldRow.producto_resumen || '')) {
      payload.producto_resumen = newRow.producto_resumen || null;
    }
    if ((newRow.estado_seguimiento ?? 'cotizado') !== (oldRow.estado_seguimiento ?? 'cotizado')) {
      payload.estado_seguimiento = newRow.estado_seguimiento ?? 'cotizado';
    }
    if ((newRow.comentario_seguimiento || '') !== (oldRow.comentario_seguimiento || '')) {
      payload.comentario_seguimiento = newRow.comentario_seguimiento || '';
    }

    if (Object.keys(payload).length === 0) {
      return oldRow;
    }

    setSavingRowId(newRow.id);
    try {
      const updated = await updateCotizacion(newRow.id, payload);
      const contactoNombre = payload.contacto_principal_id
        ? contactosMap.get(payload.contacto_principal_id)?.nombre ?? newRow.nombre_cliente
        : newRow.nombre_cliente;

      const merged: CotizacionGridRow = {
        ...oldRow,
        ...newRow,
        ...payload,
        ...(updated as Partial<CotizacionGridRow>),
        nombre_cliente: payload.contacto_principal_id !== undefined ? contactoNombre : newRow.nombre_cliente,
      };
      setRows((prev) => prev.map((row) => (row.id === newRow.id ? merged : row)));
      setSnackbar({ open: true, message: 'Cambios guardados', severity: 'success' });
      return merged;
    } catch (err: any) {
      const message = err?.message || 'No se pudo guardar el cambio';
      setSnackbar({ open: true, message, severity: 'error' });
      throw err;
    } finally {
      setSavingRowId(null);
    }
  };

  const handleProcessRowUpdateError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'No se pudo guardar el cambio';
    setSnackbar({ open: true, message, severity: 'error' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCotizacion(deleteTarget);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget));
      setSnackbar({ open: true, message: 'Cotización eliminada', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleCrearCotizacion = async () => {
    if (!form.contacto || form.total === '' || Number.isNaN(Number(form.total))) {
      setSnackbar({ open: true, message: 'Completa cliente y total', severity: 'warning' });
      return;
    }

    const payload: CotizacionCrearPayload = {
      contacto_principal_id: form.contacto.id,
      fecha_documento: form.fecha,
      moneda: 'MXN',
      observaciones: form.producto_resumen || null,
      producto_resumen: form.producto_resumen || null,
      subtotal: Number(form.total),
      iva: 0,
      total: Number(form.total),
      estado_seguimiento: form.estado_seguimiento,
      comentario_seguimiento: form.comentario_seguimiento || null,
      ...(session.user?.id ? { usuario_creacion_id: session.user.id } : {}),
    };

    try {
      setCreating(true);
      const created = await createCotizacion(payload);
      const createdRow = normalizarRow(created as CotizacionListado);
      // Si el backend no devuelve nombre_cliente en la respuesta del create, asignamos el seleccionado
      const patchedRow: CotizacionGridRow = {
        ...createdRow,
        contacto_principal_id: form.contacto.id,
        nombre_cliente: createdRow.nombre_cliente || form.contacto.nombre || 'Sin cliente',
      };
      setRows((prev) => [patchedRow, ...prev]);
      setForm(nuevaCotizacionInicial());
      setNuevoOpen(false);
      setSnackbar({ open: true, message: 'Cotización creada', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo crear la cotización', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleConvertirAFactura = async (row: CotizacionGridRow) => {
    if (!session.token || !session.empresaActivaId) {
      setSnackbar({ open: true, message: 'Falta sesión o empresa activa', severity: 'error' });
      return;
    }

    try {
      setConvirtiendoId(row.id);
      const opciones = await getOpcionesGeneracion(row.id, session.token, session.empresaActivaId);
      const puedeFactura = opciones.some((o) => o.tipo_documento_destino === 'factura');
      if (!puedeFactura) {
        setSnackbar({ open: true, message: 'La empresa no tiene habilitado el flujo a factura', severity: 'info' });
        return;
      }

      const preparacion = await prepararGeneracion(row.id, 'factura', session.token, session.empresaActivaId);
      const partidas: GenerarDocumentoPartidaInput[] =
        preparacion.partidas
          .map((p) => ({
            partida_origen_id: p.partida_id,
            cantidad: p.cantidad_default ?? p.cantidad_pendiente_sugerida ?? p.cantidad_origen,
          }))
          .filter((p) => p.cantidad > 0);

      if (partidas.length === 0) {
        setSnackbar({ open: true, message: 'No hay partidas pendientes para facturar', severity: 'warning' });
        return;
      }

      const resultado = await generarDocumentoDesdeOrigen(
        {
          documento_origen_id: row.id,
          tipo_documento_destino: 'factura',
          partidas,
        },
        session.token,
        session.empresaActivaId
      );

      setSnackbar({ open: true, message: 'Factura generada', severity: 'success' });
      navigate(`/ventas/factura/${resultado.documento_destino_id}`);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo convertir a factura', severity: 'error' });
    } finally {
      setConvirtiendoId(null);
    }
  };

  const filteredRows = useMemo(() => {
    let result = rows;

    // Tabs rápidas
    switch (quickFilter) {
      case 'pendientes':
        result = result.filter((r) => r.estado_seguimiento === 'cotizado' || r.estado_seguimiento === 'seguimiento');
        break;
      case 'cerrados':
        result = result.filter((r) => r.estado_seguimiento === 'cerrado');
        break;
      case 'perdidos':
        result = result.filter((r) => r.estado_seguimiento === 'perdido');
        break;
      default:
        break;
    }

    // Filtro extra por estado
    if (filtros.estado) {
      result = result.filter((r) => (r.estado_seguimiento ?? 'cotizado') === filtros.estado);
    }

    // Filtro cliente
    if (filtros.clienteId) {
      result = result.filter((r) => r.contacto_principal_id === filtros.clienteId);
    }

    // Filtro fechas
    if (filtros.fechaDesde) {
      const desde = dayjs(filtros.fechaDesde).startOf('day');
      result = result.filter((r) => dayjs(r.fecha_documento).startOf('day').isAfter(desde.subtract(1, 'millisecond')));
    }
    if (filtros.fechaHasta) {
      const hasta = dayjs(filtros.fechaHasta).endOf('day');
      result = result.filter((r) => dayjs(r.fecha_documento).endOf('day').isBefore(hasta.add(1, 'millisecond')));
    }

    // Filtro monto
    const min = filtros.montoMin === '' ? null : Number(filtros.montoMin);
    const max = filtros.montoMax === '' ? null : Number(filtros.montoMax);
    if (min !== null && !Number.isNaN(min)) {
      result = result.filter((r) => Number(r.total ?? 0) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      result = result.filter((r) => Number(r.total ?? 0) <= max);
    }

    return result;
  }, [rows, quickFilter, filtros]);

  const resumenTotales = useMemo(() => {
    const sum = (arr: typeof filteredRows) => arr.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
    const porEstado = (estado: EstadoSeguimiento) => sum(filteredRows.filter((r) => (r.estado_seguimiento ?? 'cotizado') === estado));
    return {
      general: sum(filteredRows),
      cotizado: porEstado('cotizado'),
      seguimiento: porEstado('seguimiento'),
      cerrado: porEstado('cerrado'),
      perdido: porEstado('perdido'),
    };
  }, [filteredRows]);

  const columns: GridColDef<CotizacionGridRow>[] = useMemo(() => [
    {
      field: 'nombre_cliente',
      headerName: 'Cliente',
      flex: 1.1,
      minWidth: 200,
      sortable: true,
      editable: true,
      renderCell: (params: GridRenderCellParams<CotizacionGridRow, string | null>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap title={params.value || ''} sx={{ fontSize: 12.5 }}>
            {params.value || 'Sin cliente'}
          </Typography>
        </Box>
      ),
      renderEditCell: (params: GridRenderEditCellParams<CotizacionGridRow, string | null>) => {
        const value = params.row.contacto_principal_id ?? null;
        const options = [...contactos, { id: -1, nombre: 'Crear cliente…' } as Contacto];
        return (
          <Autocomplete
            fullWidth
            size="small"
            options={options}
            getOptionLabel={(option) => option?.nombre || ''}
            isOptionEqualToValue={(option, val) => option?.id === val?.id}
            value={options.find((o) => o.id === value) ?? null}
            onChange={(event, option) => {
              if (option?.id === -1) {
                setCrearClienteRowId(Number(params.id));
                setCrearClienteNombre(params.row.nombre_cliente || '');
                setCrearClienteParaNuevo(false);
                setCrearClienteTipo('Lead');
                setCrearClienteOpen(true);
                return;
              }
              void params.api.setEditCellValue({ id: params.id, field: 'contacto_principal_id', value: option?.id ?? null }, event ?? undefined);
              void params.api.setEditCellValue({ id: params.id, field: 'nombre_cliente', value: option?.nombre ?? 'Sin cliente' }, event ?? undefined);
            }}
            renderInput={(p) => (
              <TextField
                {...p}
                size="small"
                autoFocus
                placeholder="Buscar cliente"
                InputLabelProps={p.InputLabelProps as any}
              />
            )}
          />
        );
      },
    },
    {
      field: 'fecha_documento',
      headerName: 'Fecha',
      width: 130,
      sortable: true,
      editable: true,
      renderCell: (params: GridRenderCellParams<CotizacionGridRow, string>) => {
        const value = params.value ? new Date(params.value) : null;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 1 }}>
            <Typography variant="body2" sx={{ fontSize: 12.5 }}>
              {value ? value.toLocaleDateString('es-MX') : ''}
            </Typography>
          </Box>
        );
      },
      renderEditCell: (params: GridRenderEditCellParams<CotizacionGridRow, string>) => (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            value={params.value ? dayjs(params.value) : null}
            onChange={(val) => {
              const formatted = val ? val.format('YYYY-MM-DD') : '';
              void params.api.setEditCellValue({ id: params.id, field: 'fecha_documento', value: formatted });
            }}
            slotProps={{ textField: { size: 'small', autoFocus: true } }}
          />
        </LocalizationProvider>
      ),
    },
    {
      field: 'producto_resumen',
      headerName: 'Producto / resumen',
      flex: 1.3,
      minWidth: 220,
      editable: true,
      renderCell: (params: GridRenderCellParams<CotizacionGridRow, string | null>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 1 }}>
          <Typography variant="body2" sx={{ fontSize: 12.5 }} noWrap title={params.value || ''}>
            {params.value || '—'}
          </Typography>
        </Box>
      ),
      renderEditCell: (params: GridRenderEditCellParams<CotizacionGridRow, string | null>) => {
        const value = params.value || '';
        const opciones = productos.map((p) => ({ ...p, label: `${p.clave} — ${p.descripcion}` }));
        return (
          <Autocomplete
            fullWidth
            size="small"
            autoHighlight
            freeSolo
            options={opciones}
            value={value}
            onChange={(event, newValue) => {
              let nuevoTexto = '';
              if (typeof newValue === 'string') {
                nuevoTexto = newValue;
              } else if (newValue && typeof newValue === 'object') {
                nuevoTexto = newValue.descripcion || '';
              }
              void params.api.setEditCellValue({ id: params.id, field: 'producto_resumen', value: nuevoTexto }, event ?? undefined);
            }}
            onInputChange={(event, inputValue, reason) => {
              if (reason === 'input') {
                void params.api.setEditCellValue({ id: params.id, field: 'producto_resumen', value: inputValue }, event ?? undefined);
              }
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option?.label || option?.descripcion || '';
            }}
            renderInput={(p) => (
              <TextField
                {...p}
                size="small"
                autoFocus
                placeholder="Escribe o selecciona"
                InputLabelProps={p.InputLabelProps as any}
              />
            )}
          />
        );
      },
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      sortable: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<CotizacionGridRow, number>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', minHeight: 1 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12.5 }}>
            {currency.format(Number(params.value ?? 0))}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'estado_seguimiento',
      headerName: 'Seguimiento',
      width: 150,
      editable: true,
      type: 'singleSelect',
      valueOptions: ESTADOS.map((e) => ({ value: e.value, label: e.label })),
      renderCell: (params: GridRenderCellParams<CotizacionGridRow, EstadoSeguimiento>) => {
        const config = ESTADOS.find((e) => e.value === params.value) ?? ESTADOS[0];
        if (!config) return null;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 1 }}>
            <Chip
              label={config.label}
              size="small"
              sx={{
                bgcolor: config.color,
                color: config.textColor,
                borderRadius: 1,
                fontWeight: 700,
                fontSize: 11,
                height: 22,
                px: 0.5,
              }}
            />
          </Box>
        );
      },
    },
    {
      field: 'comentario_seguimiento',
      headerName: 'Comentario',
      flex: 1.4,
      minWidth: 240,
      editable: true,
      renderCell: (params: GridRenderCellParams<CotizacionGridRow, string | null>) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%', overflow: 'hidden', minHeight: 1 }}>
          <CommentIcon sx={{ fontSize: 16, color: '#6b7280' }} />
          <Typography variant="body2" sx={{ fontSize: 12.5 }} noWrap title={params.value || ''}>
            {params.value || '—'}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<CotizacionGridRow>) => (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ width: '100%', minHeight: 1 }}>
          <Tooltip title="Editar completo">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/ventas/cotizacion/${params.row.id}`); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(params.row.id); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Convertir a factura">
            <span>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); handleConvertirAFactura(params.row as CotizacionGridRow); }}
                disabled={convirtiendoId === params.row.id}
              >
                <ReceiptLongIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="WhatsApp (placeholder)">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSnackbar({ open: true, message: 'Acción de WhatsApp próximamente', severity: 'info' }); }}>
              <WhatsAppIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [contactos, currency, navigate, convirtiendoId]);

  const handleCrearClienteSubmit = async () => {
    const nombre = crearClienteNombre.trim();
    if (!nombre) {
      setSnackbar({ open: true, message: 'Ingresa el nombre del cliente', severity: 'warning' });
      return;
    }

    try {
      setCrearClienteLoading(true);
      const nuevo = await crearContacto({ nombre, tipo_contacto: crearClienteTipo });
      setContactos((prev) => [nuevo, ...prev.filter((c) => c.id !== nuevo.id)]);

      if (crearClienteRowId !== null) {
        setRows((prev) => prev.map((row) => (
          row.id === crearClienteRowId
            ? { ...row, contacto_principal_id: nuevo.id, nombre_cliente: nuevo.nombre }
            : row
        )));

        await updateCotizacion(crearClienteRowId, { contacto_principal_id: nuevo.id });
        setSnackbar({ open: true, message: 'Cliente creado y asignado', severity: 'success' });
      } else if (crearClienteParaNuevo) {
        setForm((prev) => ({ ...prev, contacto: nuevo }));
        setSnackbar({ open: true, message: 'Cliente creado', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Cliente creado', severity: 'success' });
      }

      setCrearClienteOpen(false);
      setCrearClienteNombre('');
      setCrearClienteTipo('Lead');
      setCrearClienteRowId(null);
      setCrearClienteParaNuevo(false);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo crear el cliente', severity: 'error' });
    } finally {
      setCrearClienteLoading(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
          <Stack spacing={0.3}>
            <Typography variant="h5" fontWeight={800} color="#1d2f68">
              Seguimiento de cotizaciones (vista tipo Excel)
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Edición rápida de estado y comentarios, con acceso a acciones comerciales.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
              Recargar
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setForm(nuevaCotizacionInicial()); setNuevoOpen(true); }}
              sx={{ textTransform: 'uppercase', fontWeight: 700, backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
            >
              Nueva cotización
            </Button>
          </Stack>
        </Stack>

        <PaperCard>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ xs: 'stretch', lg: 'center' }}>
              <ToggleButtonGroup
                color="primary"
                size="small"
                exclusive
                value={quickFilter}
                onChange={(_, val) => { if (val) setQuickFilter(val); }}
              >
                <ToggleButton value="todos">Todos</ToggleButton>
                <ToggleButton value="pendientes">Pendientes</ToggleButton>
                <ToggleButton value="cerrados">Cerradas</ToggleButton>
                <ToggleButton value="perdidos">Perdidas</ToggleButton>
              </ToggleButtonGroup>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flex={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Desde"
                    value={filtros.fechaDesde ? dayjs(filtros.fechaDesde) : null}
                    onChange={(val) => setFiltros((prev) => ({ ...prev, fechaDesde: val ? val.format('YYYY-MM-DD') : '' }))}
                    slotProps={{
                      textField: {
                        size: 'small',
                        InputProps: filtros.fechaDesde
                          ? {
                              endAdornment: (
                                <IconButton size="small" onClick={() => setFiltros((prev) => ({ ...prev, fechaDesde: '' }))}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              ),
                            }
                          : {},
                      },
                    }}
                  />
                  <DatePicker
                    label="Hasta"
                    value={filtros.fechaHasta ? dayjs(filtros.fechaHasta) : null}
                    onChange={(val) => setFiltros((prev) => ({ ...prev, fechaHasta: val ? val.format('YYYY-MM-DD') : '' }))}
                    slotProps={{
                      textField: {
                        size: 'small',
                        InputProps: filtros.fechaHasta
                          ? {
                              endAdornment: (
                                <IconButton size="small" onClick={() => setFiltros((prev) => ({ ...prev, fechaHasta: '' }))}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              ),
                            }
                          : {},
                      },
                    }}
                  />
                </LocalizationProvider>

                <Autocomplete
                  size="small"
                  options={contactos}
                  value={contactos.find((c) => c.id === filtros.clienteId) ?? null}
                  onChange={(_, val) => setFiltros((prev) => ({ ...prev, clienteId: val?.id ?? null }))}
                  getOptionLabel={(option) => option?.nombre || ''}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Cliente"
                      placeholder="Todos"
                      InputLabelProps={params.InputLabelProps as any}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {filtros.clienteId ? (
                              <IconButton size="small" onClick={() => setFiltros((prev) => ({ ...prev, clienteId: null }))}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ minWidth: 200 }}
                />

                <TextField
                  size="small"
                  label="Monto mín"
                  type="number"
                  value={filtros.montoMin}
                  onChange={(e) => setFiltros((prev) => ({ ...prev, montoMin: e.target.value }))}
                  sx={{ width: 130 }}
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={filtros.montoMin ? {
                    endAdornment: (
                      <IconButton size="small" onClick={() => setFiltros((prev) => ({ ...prev, montoMin: '' }))}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  } : {}}
                />
                <TextField
                  size="small"
                  label="Monto máx"
                  type="number"
                  value={filtros.montoMax}
                  onChange={(e) => setFiltros((prev) => ({ ...prev, montoMax: e.target.value }))}
                  sx={{ width: 130 }}
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={filtros.montoMax ? {
                    endAdornment: (
                      <IconButton size="small" onClick={() => setFiltros((prev) => ({ ...prev, montoMax: '' }))}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  } : {}}
                />

                <TextField
                  select
                  size="small"
                  label="Estado"
                  value={filtros.estado}
                  onChange={(e) => setFiltros((prev) => ({ ...prev, estado: e.target.value as EstadoSeguimiento | '' }))}
                  sx={{ width: 150 }}
                  InputProps={filtros.estado ? {
                    endAdornment: (
                      <IconButton size="small" onClick={() => setFiltros((prev) => ({ ...prev, estado: '' }))}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  } : {}}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {ESTADOS.map((estado) => (
                    <MenuItem key={estado.value} value={estado.value}>{estado.label}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              {[{
                label: 'Total general',
                value: resumenTotales.general,
                color: '#0b5ed7',
              }, {
                label: 'Cotizado',
                value: resumenTotales.cotizado,
                color: '#8a6d1d',
              }, {
                label: 'Seguimiento',
                value: resumenTotales.seguimiento,
                color: '#1d4ed8',
              }, {
                label: 'Cerrado',
                value: resumenTotales.cerrado,
                color: '#166534',
              }, {
                label: 'Perdido',
                value: resumenTotales.perdido,
                color: '#b91c1c',
              }].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    flex: 1,
                    minWidth: 160,
                    border: '1px solid #e5e7eb',
                    borderRadius: 1.5,
                    p: 1,
                    background: 'linear-gradient(135deg, #f8fafc, #fff)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h6" sx={{ color: item.color, fontWeight: 800, lineHeight: 1.2 }}>
                    {currency.format(item.value)}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <DataGrid
              rows={filteredRows}
              columns={columns}
              getRowId={(row) => row.id}
              columnHeaderHeight={34}
              rowHeight={34}
              density="compact"
              loading={loading || savingRowId !== null}
              disableRowSelectionOnClick
              editMode="cell"
              getRowClassName={(params) => `row-estado-${params.row.estado_seguimiento ?? 'cotizado'}`}
              processRowUpdate={processRowUpdate}
              onProcessRowUpdateError={handleProcessRowUpdateError}
              onCellClick={(params: GridCellParams, event: React.MouseEvent) => {
                // En modo Excel, ningún clic simple navega; sólo doble clic edita
                event.preventDefault();
                event.stopPropagation();
                if (!editableFields.has(params.field)) {
                  // Evita navegación por clic accidental en celdas no editables
                  return;
                }
              }}
              hideFooterPagination
              initialState={{
                sorting: {
                  sortModel: [{ field: 'fecha_documento', sort: 'desc' }],
                },
              }}
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay registros',
              }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                '& .MuiDataGrid-columnHeaders': {
                  fontSize: 12.5,
                  minHeight: 34,
                  color: '#ffffff',
                },
                '& .MuiDataGrid-columnHeader': {
                  backgroundColor: '#1e2a5a',
                  color: '#ffffff',
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 600,
                  color: '#ffffff',
                },
                '& .MuiDataGrid-sortIcon': {
                  color: '#ffffff',
                },
                '& .MuiDataGrid-menuIcon': {
                  color: '#ffffff',
                },
                '& .MuiDataGrid-columnSeparator': {
                  color: 'rgba(255,255,255,0.25)',
                },
                '& .MuiDataGrid-cell': {
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  py: 0,
                  px: 1,
                },
                '& .MuiDataGrid-row': {
                  minHeight: 34,
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'rgba(0,0,0,0.03)',
                },
                '& .row-estado-cotizado': { backgroundColor: 'rgba(255, 244, 206, 0.35)' },
                '& .row-estado-seguimiento': { backgroundColor: 'rgba(215, 230, 255, 0.35)' },
                '& .row-estado-cerrado': { backgroundColor: 'rgba(217, 239, 225, 0.35)' },
                '& .row-estado-perdido': { backgroundColor: 'rgba(238, 238, 238, 0.5)' },
              }}
            />
          </Stack>
        </PaperCard>
      </Stack>

      <Dialog open={nuevoOpen} onClose={() => { setNuevoOpen(false); setForm(nuevaCotizacionInicial()); }} fullWidth maxWidth="sm">
        <DialogTitle>Nueva cotización rápida</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Autocomplete
            options={[...contactos, { id: -1, nombre: 'Crear cliente…' } as Contacto]}
            value={form.contacto ?? null}
            onChange={(_, value) => {
              if (value?.id === -1) {
                setCrearClienteParaNuevo(true);
                setCrearClienteRowId(null);
                setCrearClienteNombre('');
                setCrearClienteTipo('Lead');
                setCrearClienteOpen(true);
                return;
              }
              setCrearClienteParaNuevo(false);
              setForm((prev) => ({ ...prev, contacto: value ?? null }));
            }}
            getOptionLabel={(option) => option?.nombre || ''}
            isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Cliente"
                required
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            )}
          />
          <TextField
            label="Fecha"
            type="date"
            size="small"
            value={form.fecha}
            onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            freeSolo
            size="small"
            options={productos.map((p) => ({ ...p, label: `${p.clave} — ${p.descripcion}` }))}
            value={form.producto_resumen}
            onChange={(_, newValue) => {
              let texto = '';
              if (typeof newValue === 'string') texto = newValue;
              else if (newValue && typeof newValue === 'object') texto = newValue.descripcion || '';
              setForm((prev) => ({ ...prev, producto_resumen: texto }));
            }}
            onInputChange={(_, input) => setForm((prev) => ({ ...prev, producto_resumen: input }))}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.label || option.descripcion || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Resumen / producto"
                placeholder="Escribe o selecciona"
                size="small"
                InputLabelProps={params.InputLabelProps as any}
              />
            )}
          />
          <TextField
            label="Total"
            size="small"
            type="number"
            value={form.total}
            onChange={(e) => setForm((prev) => ({ ...prev, total: e.target.value === '' ? '' : Number(e.target.value) }))}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            label="Comentario de seguimiento"
            size="small"
            multiline
            minRows={2}
            value={form.comentario_seguimiento}
            onChange={(e) => setForm((prev) => ({ ...prev, comentario_seguimiento: e.target.value }))}
          />
          <TextField
            select
            label="Estado de seguimiento"
            size="small"
            value={form.estado_seguimiento}
            onChange={(e) => setForm((prev) => ({ ...prev, estado_seguimiento: e.target.value as EstadoSeguimiento }))}
          >
            {ESTADOS.map((estado) => (
              <MenuItem key={estado.value} value={estado.value}>
                {estado.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setNuevoOpen(false); setForm(nuevaCotizacionInicial()); }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleCrearCotizacion()} disabled={creating}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Eliminar cotización</DialogTitle>
        <DialogContent>¿Seguro que quieres eliminar esta cotización?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

  <Dialog open={crearClienteOpen} onClose={() => { if (!crearClienteLoading) { setCrearClienteOpen(false); setCrearClienteNombre(''); setCrearClienteRowId(null); setCrearClienteTipo('Lead'); setCrearClienteParaNuevo(false); } }} fullWidth maxWidth="xs">
        <DialogTitle>Crear cliente rápido</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Nombre"
            size="small"
            autoFocus
            value={crearClienteNombre}
            onChange={(e) => setCrearClienteNombre(e.target.value)}
            disabled={crearClienteLoading}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Tipo de contacto"
            size="small"
            value={crearClienteTipo}
            onChange={(e) => setCrearClienteTipo(e.target.value as 'Lead' | 'Cliente')}
            disabled={crearClienteLoading}
          >
            <MenuItem value="Lead">Lead</MenuItem>
            <MenuItem value="Cliente">Cliente</MenuItem>
          </TextField>
          <Alert severity="info" sx={{ fontSize: 13 }}>
            Se asignará a la cotización con el tipo seleccionado.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { if (!crearClienteLoading) { setCrearClienteOpen(false); setCrearClienteNombre(''); setCrearClienteRowId(null); setCrearClienteTipo('Lead'); setCrearClienteParaNuevo(false); } }} disabled={crearClienteLoading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleCrearClienteSubmit()} disabled={crearClienteLoading}>
            {crearClienteLoading ? 'Creando…' : 'Crear y asignar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}

function PaperCard({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        border: '1px solid #e5e7eb',
        borderRadius: 2,
        p: 1.5,
        backgroundColor: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </Box>
  );
}
