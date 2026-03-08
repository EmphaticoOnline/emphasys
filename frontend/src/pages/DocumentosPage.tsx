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
import VerifiedIcon from '@mui/icons-material/Verified';
import { Tooltip } from '@mui/material';
import type { CotizacionListado } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import { deleteDocumento, downloadDocumentoPdf, getDocumentos } from '../services/documentosService';
import { timbrarFactura } from '../services/facturasService';
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
      width: 150,
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
                    } catch (err: any) {
                      setError(err?.message || 'No se pudo timbrar la factura');
                    } finally {
                      setTimbrandoId(null);
                    }
                  }}
                >
                  <VerifiedIcon fontSize="small" />
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

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
