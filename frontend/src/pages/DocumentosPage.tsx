import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type {
  GridColDef,
  GridRowParams,
  GridRenderCellParams,
  GridColumnVisibilityModel,
  GridColumnOrderChangeParams,
  GridColumnResizeParams,
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EmailIcon from '@mui/icons-material/Email';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Tooltip } from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import AlertSnackbar from '@mui/material/Alert';
import type { CotizacionListado } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import type { TipoDocumentoEmpresa } from '../services/tiposDocumentoService';
import { fetchTiposDocumentoHabilitados } from '../services/tiposDocumentoService';
import { deleteDocumento, downloadDocumentoPdf, getDocumentos } from '../services/documentosService';
import { timbrarFactura, enviarFactura } from '../services/facturasService';
import { formatearFolioDocumento } from '../utils/documentos.utils';
import { esES } from '@mui/x-data-grid/locales';
import { useSession } from '../session/useSession';
import {
  getOpcionesGeneracion,
  prepararGeneracion,
  generarDocumentoDesdeOrigen,
  type OpcionGeneracionResponse,
  type PrepararGeneracionResponse,
  type GenerarDocumentoPayload,
} from '../services/documentGenerationService';

type DocumentosPageProps = {
  tipoDocumento?: TipoDocumento;
};

export default function DocumentosPage({ tipoDocumento: propTipo }: DocumentosPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { session } = useSession();
  const tipoDocumento = (propTipo ?? (params.codigo as TipoDocumento)) || 'cotizacion';
  const token = session.token;
  const empresaId = session.empresaActivaId;
  const modulo = location.pathname.startsWith('/compras') ? 'compras' : 'ventas';
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoEmpresa[]>([]);

  useEffect(() => {
    const loadTipos = async () => {
      try {
        const data = await fetchTiposDocumentoHabilitados(modulo);
        setTiposDocumento(data);
      } catch (err) {
        console.error('No se pudieron cargar los tipos de documento', err);
      }
    };
    void loadTipos();
  }, [modulo]);

  const textos = useMemo(() => {
    const match = tiposDocumento.find((t) => t.codigo === tipoDocumento);
    if (match) {
      const titulo = match.nombre_plural || match.nombre || match.codigo;
      const singular = match.nombre || match.nombre_plural || match.codigo;
      return {
        titulo,
        descripcion: `Consulta y gestiona ${match.nombre_plural?.toLowerCase() || match.nombre?.toLowerCase() || 'los documentos'}.`,
        singular,
      };
    }

    const fallbackTitulo = tipoDocumento.charAt(0).toUpperCase() + tipoDocumento.slice(1);
    return {
      titulo: fallbackTitulo,
      descripcion: 'Consulta y gestiona los documentos.',
      singular: fallbackTitulo,
    };
  }, [tiposDocumento, tipoDocumento]);
  const [rows, setRows] = useState<CotizacionListado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [timbrandoId, setTimbrandoId] = useState<number | null>(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({});
  const [orderedFields, setOrderedFields] = useState<string[] | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  type SnackbarSeverity = 'success' | 'error' | 'info' | 'warning';
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: SnackbarSeverity }>(
    { open: false, message: '', severity: 'success' }
  );
  const [enviarDialog, setEnviarDialog] = useState<{
    open: boolean;
    id: number | null;
    email: string;
    enviando: boolean;
    error?: string | null;
  }>({ open: false, id: null, email: '', enviando: false, error: null });
  const [opcionesGeneracion, setOpcionesGeneracion] = useState<Record<number, OpcionGeneracionResponse[]>>({});
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDocumentoId, setMenuDocumentoId] = useState<number | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [generacionDialog, setGeneracionDialog] = useState<{
    open: boolean;
    loading: boolean;
    documentoId: number | null;
    tipoDestino: string | null;
    data: PrepararGeneracionResponse | null;
    cantidades: Record<number, number>;
    enviando: boolean;
  }>({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false });

  const STORAGE_KEY = `documentos-${tipoDocumento}-grid-preferencias`;
  const basePath = `/ventas/${tipoDocumento}`;

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.columnVisibilityModel) setColumnVisibilityModel(parsed.columnVisibilityModel);
      if (parsed?.orderedFields) setOrderedFields(parsed.orderedFields);
      if (parsed?.columnWidths) setColumnWidths(parsed.columnWidths);
    } catch (err) {
      console.warn('No se pudo leer preferencias de columnas', err);
    }
  }, []);

  const requireAuthData = () => {
    if (!token || !empresaId) {
      setError('Token o empresa activa no disponibles. Inicia sesión de nuevo.');
      return false;
    }
    return true;
  };

  const handleOpenMenuGenerar = async (event: React.MouseEvent<HTMLElement>, documentoId: number) => {
    event.stopPropagation();
    if (!requireAuthData()) return;

    const cached = opcionesGeneracion[documentoId];
    setMenuDocumentoId(documentoId);
    setMenuAnchor(event.currentTarget);

    if (cached) {
      if (cached.length === 0) {
        setMenuAnchor(null);
        setMenuDocumentoId(null);
        setSnackbar({ open: true, message: 'No hay opciones de generación para este documento', severity: 'info' });
      }
      return;
    }

    try {
      setMenuLoading(true);
      const opciones = await getOpcionesGeneracion(documentoId, token!, empresaId!);
      setOpcionesGeneracion((prev) => ({ ...prev, [documentoId]: opciones }));
      if (!opciones || opciones.length === 0) {
        setMenuAnchor(null);
        setMenuDocumentoId(null);
        setSnackbar({ open: true, message: 'No hay opciones de generación para este documento', severity: 'info' });
      }
    } catch (err: any) {
      setMenuAnchor(null);
      setMenuDocumentoId(null);
      setSnackbar({ open: true, message: err?.message || 'No se pudieron cargar las opciones de generación', severity: 'error' });
    } finally {
      setMenuLoading(false);
    }
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuDocumentoId(null);
  };

  const handleSeleccionarOpcion = async (tipoDestino: string) => {
    if (!menuDocumentoId) return;
    if (!requireAuthData()) return;
    closeMenu();
    setGeneracionDialog({
      open: true,
      loading: true,
      documentoId: menuDocumentoId,
      tipoDestino,
      data: null,
      cantidades: {},
      enviando: false,
    });

    try {
      const data = await prepararGeneracion(menuDocumentoId, tipoDestino as any, token!, empresaId!);
      const cantidades = data.partidas.reduce<Record<number, number>>((acc, p) => {
        acc[p.partida_id] = p.cantidad_default ?? p.cantidad_pendiente_sugerida ?? 0;
        return acc;
      }, {});
      setGeneracionDialog({
        open: true,
        loading: false,
        documentoId: menuDocumentoId,
        tipoDestino,
        data,
        cantidades,
        enviando: false,
      });
    } catch (err: any) {
      setGeneracionDialog({
        open: false,
        loading: false,
        documentoId: null,
        tipoDestino: null,
        data: null,
        cantidades: {},
        enviando: false,
      });
      setSnackbar({ open: true, message: err?.message || 'No se pudo preparar la generación', severity: 'error' });
    }
  };

  const handleCantidadChange = (partidaId: number, value: string) => {
    const num = Number(value);
    setGeneracionDialog((prev) => ({
      ...prev,
      cantidades: { ...prev.cantidades, [partidaId]: Number.isNaN(num) ? 0 : num },
    }));
  };

  const handleGenerar = async () => {
    if (!generacionDialog.data || !generacionDialog.documentoId || !generacionDialog.tipoDestino) return;
    if (!requireAuthData()) return;

    const partidas = generacionDialog.data.partidas
      .map((p) => ({ partida_origen_id: p.partida_id, cantidad: generacionDialog.cantidades[p.partida_id] ?? 0 }))
      .filter((p) => p.cantidad > 0);

    if (partidas.length === 0) {
      setSnackbar({ open: true, message: 'Captura al menos una cantidad mayor a cero', severity: 'warning' });
      return;
    }

    const payload: GenerarDocumentoPayload = {
      documento_origen_id: generacionDialog.documentoId,
      tipo_documento_destino: generacionDialog.tipoDestino as any,
      partidas,
    };

    try {
      setGeneracionDialog((prev) => ({ ...prev, enviando: true }));
      const result = await generarDocumentoDesdeOrigen(payload, token!, empresaId!);
      setGeneracionDialog({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false });
      setSnackbar({ open: true, message: 'Documento generado correctamente', severity: 'success' });
      navigate(`/documentos/${result.documento_destino_id}`);
    } catch (err: any) {
      setGeneracionDialog((prev) => ({ ...prev, enviando: false }));
      setSnackbar({ open: true, message: err?.message || 'No se pudo generar el documento', severity: 'error' });
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await getDocumentos(tipoDocumento);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = d.toLocaleString('es-MX', { day: '2-digit' });
    const month = d.toLocaleString('es-MX', { month: 'short' }).replace('.', '').toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    load();
  }, [tipoDocumento]);

  const obtenerEmailFactura = (row: any) =>
    row?.contacto_email ?? row?.email_contacto ?? row?.cliente_email ?? row?.email_cliente ?? row?.email ?? '';

  const baseColumns: GridColDef[] = useMemo(() => {
    const columns: GridColDef[] = [
      {
        field: 'folio',
        headerName: 'Folio',
        width: 160,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) =>
          formatearFolioDocumento(params?.row?.serie ?? '', Number(params?.row?.numero ?? 0)),
      },
      {
        field: 'fecha_documento',
        headerName: 'Fecha',
        width: 120,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => {
          const value = params?.row?.fecha_documento;
          return formatFecha(value);
        },
      },
      { field: 'nombre_cliente', headerName: 'Cliente', flex: 1, minWidth: 220, headerClassName: 'finanzas-header' },
      {
        field: 'subtotal',
        headerName: 'Subtotal',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => currency.format(Number(params.row.subtotal ?? 0)),
      },
      {
        field: 'iva',
        headerName: 'IVA',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => currency.format(Number(params.row.iva ?? 0)),
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => currency.format(Number(params.row.total ?? 0)),
      },
      {
        field: 'estatus_documento',
        headerName: 'Estatus',
        width: 140,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => {
          const estatus = params.row?.estatus_documento || 'Borrador';
          const color = estatus === 'Borrador' ? 'default' : estatus === 'Enviado' ? 'info' : 'success';
          return (
            <Chip
              label={estatus}
              size="small"
              color={color as any}
              sx={{ height: 22, fontSize: '0.72rem', px: 0.75, borderRadius: 1.5 }}
            />
          );
        },
      },
    ];

    columns.push({
      field: 'actions',
      headerName: 'Acciones',
  width: 230,
      sortable: false,
      filterable: false,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton size="small" color="primary" onClick={() => navigate(`${basePath}/${params.id}`)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            disabled={deletingId === params.row.id || loading}
            onClick={async (e) => {
              e.stopPropagation();
              setPendingDeleteId(params.row.id as number);
              setConfirmOpen(true);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
          <Tooltip title="Generar">
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={loading || menuLoading}
                onClick={(e) => handleOpenMenuGenerar(e, Number(params.row.id))}
              >
                <AutoAwesomeIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Descargar PDF">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                downloadDocumentoPdf(Number(params.row.id), tipoDocumento)
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 10_000);
                  })
                  .catch((err) => {
                    setError(err?.message || 'No se pudo generar el PDF');
                  });
              }}
            >
              <PictureAsPdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {tipoDocumento === 'factura' && (
            <Tooltip title="Timbrar CFDI">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || timbrandoId === params.row.id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      setTimbrandoId(params.row.id as number);
                      await timbrarFactura(Number(params.row.id));
                      await load();
                      const emailInicial = obtenerEmailFactura(params.row);
                      setEnviarDialog({ open: true, id: Number(params.row.id), email: emailInicial, enviando: false, error: null });
                    } catch (err: any) {
                      setError(err?.message || 'No se pudo timbrar la factura');
                    } finally {
                      setTimbrandoId(null);
                    }
                  }}
                >
                  <ReceiptLongIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {tipoDocumento === 'factura' && (
            <Tooltip title="Enviar factura por correo">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    const emailInicial = obtenerEmailFactura(params.row);
                    setEnviarDialog({ open: true, id: Number(params.row.id), email: emailInicial, enviando: false, error: null });
                  }}
                >
                  <EmailIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      ),
    });

    return columns;
  }, [
    currency,
    formatFecha,
    tipoDocumento,
    loading,
    timbrandoId,
    navigate,
    basePath,
    obtenerEmailFactura,
    deletingId,
    load,
    setError,
    setPendingDeleteId,
    setConfirmOpen,
    opcionesGeneracion,
    menuLoading,
    handleOpenMenuGenerar,
  ]);

  useEffect(() => {
    if (!orderedFields) {
      setOrderedFields(baseColumns.map((c) => c.field));
    }
  }, [baseColumns, orderedFields]);

  const columns: GridColDef[] = useMemo(() => {
    const withWidths = baseColumns.map((col) =>
      columnWidths[col.field] != null ? { ...col, width: Number(columnWidths[col.field]) } : col
    ) as GridColDef[];

    if (!orderedFields || orderedFields.length === 0) return withWidths;

    const columnMap = new Map(withWidths.map((c) => [c.field, c]));
    const ordered = orderedFields
      .map((field) => columnMap.get(field))
      .filter(Boolean) as GridColDef[];
    const remaining = withWidths.filter((c) => !orderedFields.includes(c.field));
    return [...ordered, ...remaining];
  }, [baseColumns, columnWidths, orderedFields]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            {textos.titulo}
          </Typography>
          <Typography variant="body2" color="#4b5563">
            {textos.descripcion}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`${basePath}/nuevo`)}
            sx={{ textTransform: 'uppercase', fontWeight: 700, backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
          >
            Nuevo
          </Button>
        </Stack>
      </Toolbar>

      <Dialog open={Boolean(error)} onClose={() => setError(null)} fullWidth maxWidth="xs">
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <DialogContentText>{error}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setError(null)}>
            ENTENDIDO
          </Button>
        </DialogActions>
      </Dialog>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          autoHeight
          density="standard"
          rowHeight={42}
          columnHeaderHeight={52}
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(params: GridRowParams) => navigate(`${basePath}/${params.id}`)}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={(model) => {
            setColumnVisibilityModel(model);
            const current = {
              columnVisibilityModel: model,
              orderedFields: orderedFields ?? baseColumns.map((c) => c.field),
              columnWidths,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          }}
          onColumnOrderChange={(params: GridColumnOrderChangeParams) => {
            setOrderedFields((prev) => {
              const base = prev ?? baseColumns.map((c) => c.field);
              const fromIndex = base.indexOf(params.column.field);
              if (fromIndex === -1) return base;
              const updated = [...base];
              updated.splice(fromIndex, 1);
              updated.splice(params.targetIndex, 0, params.column.field);
              localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                  columnVisibilityModel,
                  orderedFields: updated,
                  columnWidths,
                })
              );
              return updated;
            });
          }}
          onColumnWidthChange={(params: GridColumnResizeParams) => {
            setColumnWidths((prev) => {
              const next = { ...prev, [params.colDef.field]: params.width };
              localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                  columnVisibilityModel,
                  orderedFields: orderedFields ?? baseColumns.map((c) => c.field),
                  columnWidths: next,
                })
              );
              return next;
            });
          }}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          sx={{
            '--DataGrid-overlayHeight': '200px',
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:nth-of-type(even)': {
              backgroundColor: 'rgba(0, 120, 70, 0.05)',
            },
            '& .finanzas-header': {
              backgroundColor: '#1d2f68 !important',
              color: '#ffffff !important',
              fontWeight: 600,
            },
            '& .finanzas-header .MuiDataGrid-columnHeaderTitle': {
              color: '#ffffff !important',
              fontWeight: 600,
            },
            '& .finanzas-header .MuiDataGrid-sortIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header .MuiDataGrid-menuIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header:hover .MuiDataGrid-menuIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header .MuiIconButton-root': {
              color: '#ffffff !important',
            },
            '& .MuiDataGrid-columnSeparator': {
              color: 'rgba(255,255,255,0.25) !important',
            },
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {loading ? 'Cargando documentos...' : 'No hay documentos registrados.'}
                </Typography>
              </Stack>
            ),
            loadingOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Cargando documentos...
                </Typography>
              </Stack>
            ),
          }}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {menuLoading && (
          <MenuItem disabled>
            <ListItemIcon>
              <CircularProgress size={16} />
            </ListItemIcon>
            <ListItemText primary="Cargando opciones..." />
          </MenuItem>
        )}
        {!menuLoading && menuDocumentoId != null && (opcionesGeneracion[menuDocumentoId] || []).map((op) => (
          <MenuItem key={op.tipo_documento_destino} onClick={() => handleSeleccionarOpcion(op.tipo_documento_destino)}>
            <ListItemText primary={op.nombre || op.tipo_documento_destino} />
          </MenuItem>
        ))}
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <AlertSnackbar
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </AlertSnackbar>
      </Snackbar>

      <Dialog
        open={generacionDialog.open}
        onClose={() => !generacionDialog.enviando && setGeneracionDialog({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false })}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Generar documento</DialogTitle>
        <DialogContent>
          {generacionDialog.loading || !generacionDialog.data ? (
            <Stack alignItems="center" justifyContent="center" py={3} spacing={1}>
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                Preparando información...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Origen: {generacionDialog.data.documento_origen.folio || generacionDialog.data.documento_origen.documento_id} · Destino: {generacionDialog.tipoDestino}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Cant. origen</TableCell>
                    <TableCell align="right">Pendiente</TableCell>
                    <TableCell align="right">Cantidad a generar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {generacionDialog.data.partidas.map((p) => (
                    <TableRow key={p.partida_id} hover>
                      <TableCell>{p.descripcion || `Producto ${p.producto_id ?? ''}`}</TableCell>
                      <TableCell align="right">{p.cantidad_origen}</TableCell>
                      <TableCell align="right">{p.cantidad_pendiente_sugerida}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          value={generacionDialog.cantidades[p.partida_id] ?? ''}
                          onChange={(e) => handleCantidadChange(p.partida_id, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setGeneracionDialog({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false })}
            disabled={generacionDialog.enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerar}
            disabled={generacionDialog.enviando || generacionDialog.loading}
            startIcon={generacionDialog.enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {generacionDialog.enviando ? 'Generando...' : 'Generar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={enviarDialog.open}
        onClose={() => !enviarDialog.enviando && setEnviarDialog({ open: false, id: null, email: '', enviando: false, error: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Enviar factura por correo</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ mb: 2 }}>Ingresa o ajusta el correo del cliente antes de enviar.</DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Correo electrónico"
            type="email"
            value={enviarDialog.email}
            onChange={(e) => setEnviarDialog((prev) => ({ ...prev, email: e.target.value, error: null }))}
            error={Boolean(enviarDialog.error)}
            helperText={enviarDialog.error || ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setEnviarDialog({ open: false, id: null, email: '', enviando: false, error: null })}
            disabled={enviarDialog.enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const email = enviarDialog.email.trim();
              if (!email) {
                setEnviarDialog((prev) => ({ ...prev, error: 'El correo es obligatorio' }));
                return;
              }
              try {
                setEnviarDialog((prev) => ({ ...prev, enviando: true, error: null }));
                await enviarFactura(Number(enviarDialog.id), email);
                setSnackbar({ open: true, message: 'Factura enviada correctamente', severity: 'success' });
                setEnviarDialog({ open: false, id: null, email: '', enviando: false, error: null });
              } catch (err: any) {
                const msg = err?.message || 'No se pudo enviar la factura';
                setEnviarDialog((prev) => ({ ...prev, enviando: false, error: msg }));
                setSnackbar({ open: true, message: msg, severity: 'error' });
              }
            }}
            disabled={enviarDialog.enviando}
            startIcon={enviarDialog.enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {enviarDialog.enviando ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      >
  <DialogTitle fontWeight={700}>Eliminar {textos.singular}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            ¿Eliminar {textos.singular.toLowerCase()}? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setConfirmOpen(false);
              setPendingDeleteId(null);
            }}
            variant="outlined"
          >
            No eliminar
          </Button>
          <Button
            onClick={async () => {
              if (!pendingDeleteId) return;
              try {
                setDeletingId(pendingDeleteId);
                await deleteDocumento(pendingDeleteId, tipoDocumento);
                setRows((prev) => prev.filter((r) => r.id !== pendingDeleteId));
                setConfirmOpen(false);
                setPendingDeleteId(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo eliminar el documento');
              } finally {
                setDeletingId(null);
              }
            }}
            color="error"
            variant="contained"
            disabled={deletingId !== null}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
