import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Tooltip } from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import AlertSnackbar from '@mui/material/Alert';
import type { CotizacionListado } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import { deleteDocumento, downloadDocumentoPdf, getDocumentos } from '../services/documentosService';
import { timbrarFactura, enviarFactura } from '../services/facturasService';
import { formatearFolioDocumento } from '../utils/documentos.utils';
import { esES } from '@mui/x-data-grid/locales';

type DocumentosPageProps = {
  tipoDocumento?: TipoDocumento;
};

const TITULOS: Record<TipoDocumento, { titulo: string; descripcion: string; singular: string }> = {
  cotizacion: { titulo: 'Cotizaciones', descripcion: 'Consulta y gestiona las cotizaciones.', singular: 'Cotización' },
  factura: { titulo: 'Facturas', descripcion: 'Consulta y gestiona las facturas.', singular: 'Factura' },
  pedido: { titulo: 'Pedidos', descripcion: 'Consulta y gestiona los pedidos.', singular: 'Pedido' },
  remision: { titulo: 'Remisiones', descripcion: 'Consulta y gestiona las remisiones.', singular: 'Remisión' },
};

export default function DocumentosPage({ tipoDocumento = 'cotizacion' }: DocumentosPageProps) {
  const navigate = useNavigate();
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
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [enviarDialog, setEnviarDialog] = useState<{
    open: boolean;
    id: number | null;
    email: string;
    enviando: boolean;
    error?: string | null;
  }>({ open: false, id: null, email: '', enviando: false, error: null });

  const STORAGE_KEY = `documentos-${tipoDocumento}-grid-preferencias`;
  const basePath = tipoDocumento === 'factura' ? '/facturas' : '/documentos';

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
        renderCell: (params: any) =>
          formatearFolioDocumento(params?.row?.serie ?? '', Number(params?.row?.numero ?? 0)),
      },
      {
        field: 'fecha_documento',
        headerName: 'Fecha',
        width: 120,
        renderCell: (params: any) => {
          const value = params?.row?.fecha_documento;
          return formatFecha(value);
        },
      },
      { field: 'nombre_cliente', headerName: 'Cliente', flex: 1, minWidth: 220 },
      {
        field: 'subtotal',
        headerName: 'Subtotal',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: any) => currency.format(Number(params.row.subtotal ?? 0)),
      },
      {
        field: 'iva',
        headerName: 'IVA',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: any) => currency.format(Number(params.row.iva ?? 0)),
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: any) => currency.format(Number(params.row.total ?? 0)),
      },
      {
        field: 'estatus_documento',
        headerName: 'Estatus',
        width: 140,
        renderCell: (params: any) => {
          const estatus = params.row?.estatus_documento || 'Borrador';
          const color = estatus === 'Borrador' ? 'default' : estatus === 'Enviado' ? 'info' : 'success';
          return <Chip label={estatus} size="small" color={color as any} />;
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
            {TITULOS[tipoDocumento].titulo}
          </Typography>
          <Typography variant="body2" color="#4b5563">
            {TITULOS[tipoDocumento].descripcion}
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
          density="compact"
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
            '& .MuiDataGrid-columnHeaders': { backgroundColor: '#f6f8fa' },
            '& .MuiDataGrid-columnHeader': { userSelect: 'none', color: '#1d2f68', fontWeight: 700 },
            '& .MuiDataGrid-columnHeaderTitle': { color: '#1d2f68', fontWeight: 700 },
            '& .MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: '#f7fbfa' },
            '& .MuiDataGrid-row.Mui-hovered': { backgroundColor: '#eef7f4' },
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
  <DialogTitle fontWeight={700}>Eliminar {TITULOS[tipoDocumento].singular}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            ¿Eliminar {TITULOS[tipoDocumento].singular.toLowerCase()}? Esta acción no se puede deshacer.
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
