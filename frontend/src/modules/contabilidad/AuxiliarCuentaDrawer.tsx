import * as React from 'react';
import { Alert, Box, Button, Divider, Drawer, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GridOnIcon from '@mui/icons-material/GridOn';
import {
  DataGrid,
  type GridColDef,
  type GridColumnResizeParams,
  type GridSortModel,
} from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { AuxiliarCuentaResultado, AuxiliarMovimiento } from '../../types/saldosCuentas';
import { descargarAuxiliarCuenta } from '../../services/saldosCuentasService';
import { standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { reordenarColumnas } from '../../components/grids/gridColumnOrder';
import { useDeviceProfile } from '../../hooks/useDeviceProfile';
import { useGridPreferences } from '../../hooks/useGridPreferences';

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

// Fecha civil 'YYYY-MM-DD': parsear por split, nunca por new Date(...), para
// no arriesgar un desfase de día por zona horaria.
function formatFecha(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const [anio, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${anio}`;
}

// La raya horizontal "fantasma" en el header viene de bordes por defecto que
// MUI aplica a NIVEL DE CELDA (.MuiDataGrid-columnHeader), no solo al
// contenedor (.MuiDataGrid-columnHeaders); solo cubrir el contenedor no
// bastaba. Aquí se cubren ambos niveles y se iguala la altura del header al
// valor forzado por standardDataGridSx (evita el hueco que produce la línea).
// Además: el ícono de orden solo debe verse al hacer hover, incluso en la
// columna activa (por defecto standardDataGridSx lo deja siempre visible en
// la columna ordenada; aquí se sobreescribe para esta grilla en particular).
const HEADER_H = 32;
const auxiliarHeaderSx = {
  '& .MuiDataGrid-columnHeaders': {
    borderBottom: 'none',
    minHeight: `${HEADER_H}px !important`,
    maxHeight: `${HEADER_H}px !important`,
  },
  '& .MuiDataGrid-columnHeadersInner': { backgroundColor: '#1d2f68' },
  '& .MuiDataGrid-columnHeader': {
    borderBottom: 'none',
    height: `${HEADER_H}px !important`,
  },
  '& .MuiDataGrid-columnHeader--sorted .MuiDataGrid-iconButtonContainer': { visibility: 'hidden', width: 0 },
  '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-iconButtonContainer': { visibility: 'visible', width: 'auto' },
};

// Sin flex y sin minWidth altos "protectores": el usuario debe poder
// comprimir cualquier columna arrastrando el borde, según su propio
// criterio. width es solo el ancho inicial sugerido; minWidth es apenas un
// piso bajo para que la columna no desaparezca del todo al arrastrar.
const columnasBase: GridColDef<AuxiliarMovimiento & { id: string }>[] = [
  { field: 'poliza_numero', headerName: 'Póliza', width: 80, minWidth: 50, resizable: true, headerAlign: 'center', headerClassName: 'finanzas-header' },
  { field: 'tipo_poliza', headerName: 'Tipo', width: 90, minWidth: 50, resizable: true, headerAlign: 'center', headerClassName: 'finanzas-header' },
  { field: 'renglon', headerName: 'No.', width: 50, minWidth: 40, resizable: true, align: 'center', headerAlign: 'center', headerClassName: 'finanzas-header' },
  {
    field: 'fecha',
    headerName: 'Fecha',
    width: 90,
    minWidth: 60,
    resizable: true,
    headerAlign: 'center',
    headerClassName: 'finanzas-header',
    renderCell: ({ value }) => formatFecha(value),
  },
  {
    field: 'concepto',
    headerName: 'Concepto',
    width: 200,
    minWidth: 80,
    resizable: true,
    headerAlign: 'center',
    headerClassName: 'finanzas-header',
    renderCell: ({ value }) => value ?? '',
  },
  {
    field: 'cargo',
    headerName: 'Cargo',
    width: 115,
    minWidth: 70,
    resizable: true,
    align: 'right',
    headerAlign: 'center',
    headerClassName: 'finanzas-header',
    renderCell: ({ value }) => (Number(value) ? formatMoneda(Number(value)) : ''),
  },
  {
    field: 'abono',
    headerName: 'Abono',
    width: 115,
    minWidth: 70,
    resizable: true,
    align: 'right',
    headerAlign: 'center',
    headerClassName: 'finanzas-header',
    renderCell: ({ value }) => (Number(value) ? formatMoneda(Number(value)) : ''),
  },
  {
    field: 'referencia',
    headerName: 'Referencia',
    width: 140,
    minWidth: 60,
    resizable: true,
    headerAlign: 'center',
    headerClassName: 'finanzas-header',
    renderCell: ({ value }) => (
      <Tooltip title={value || ''}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {value ?? ''}
        </span>
      </Tooltip>
    ),
  },
];

function EstadisticaResumen({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ flex: 1, px: 2, py: 1, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color }}>{value}</Typography>
    </Box>
  );
}

export default function AuxiliarCuentaDrawer({
  open,
  onClose,
  loading,
  error,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: AuxiliarCuentaResultado | null;
}) {
  const [descargando, setDescargando] = React.useState<'pdf' | 'excel' | null>(null);
  const [errorDescarga, setErrorDescarga] = React.useState<string | null>(null);

  const perfilDispositivo = useDeviceProfile();
  const {
    sortModel,
    setSortModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    columnOrder,
    setColumnOrder,
    applySavedWidthsToColumns,
    setColumnWidths,
  } = useGridPreferences({
    pantalla: 'contabilidad.auxiliarCuenta.grid',
    perfilDispositivo,
    defaultSortModel: [{ field: 'fecha', sort: 'asc' }],
  });

  const columnasOrdenadas = React.useMemo(() => reordenarColumnas(columnasBase, columnOrder), [columnOrder]);
  const columnas = React.useMemo(
    () => applySavedWidthsToColumns(columnasOrdenadas),
    [applySavedWidthsToColumns, columnasOrdenadas]
  );

  const filas = React.useMemo(
    () => (data?.movimientos ?? []).map((m, index) => ({ ...m, id: `${m.poliza_id}-${m.renglon}-${index}` })),
    [data]
  );

  const handleDescargar = async (formato: 'pdf' | 'excel') => {
    if (!data) return;
    setDescargando(formato);
    setErrorDescarga(null);
    try {
      await descargarAuxiliarCuenta(data.cuenta.id, data.ejercicio, data.periodo, formato);
    } catch (err: any) {
      setErrorDescarga(err?.message || 'No se pudo generar el archivo');
    } finally {
      setDescargando(null);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: '85%', md: 760 } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e5e7eb' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1d2f68' }}>
            Auxiliar de cuenta
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Tooltip title="Imprimir / PDF">
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleDescargar('pdf')}
                  disabled={!data || descargando !== null}
                  sx={{ color: '#1d2f68' }}
                >
                  <PictureAsPdfIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Exportar a Excel">
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleDescargar('excel')}
                  disabled={!data || descargando !== null}
                  sx={{ color: '#166534' }}
                >
                  <GridOnIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Button
              size="small"
              startIcon={<CloseIcon fontSize="small" />}
              onClick={onClose}
              sx={{ textTransform: 'none', color: '#1d2f68' }}
            >
              Cerrar
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {errorDescarga && (
            <Alert severity="error" onClose={() => setErrorDescarga(null)}>
              {errorDescarga}
            </Alert>
          )}

          {loading && (
            <Typography variant="body2" color="text.secondary">
              Cargando auxiliar...
            </Typography>
          )}

          {!loading && data && (
            <>
              {/* Encabezado tipo "hero": cuenta/descripción en banda azul
                  institucional, seguida de tarjetas de resumen (cargos,
                  abonos, movimientos) con acento de color por dato. */}
              <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <Box sx={{ bgcolor: '#1d2f68', color: '#ffffff', px: 2, py: 1.25 }}>
                  <Typography sx={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.75 }}>
                    Cuenta contable
                  </Typography>
                  <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap">
                    <Typography sx={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
                      {data.cuenta.cuenta}
                    </Typography>
                    <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{data.cuenta.descripcion}</Typography>
                  </Stack>
                </Box>
                <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} sx={{ bgcolor: '#f8fafc' }}>
                  <EstadisticaResumen label="Cargos" value={formatMoneda(data.resumen.cargos)} color="#1d2f68" />
                  <EstadisticaResumen label="Abonos" value={formatMoneda(data.resumen.abonos)} color="#166534" />
                  <EstadisticaResumen label="Movimientos" value={String(data.resumen.numero_movimientos)} color="#334155" />
                </Stack>
              </Box>

              {filas.length === 0 ? (
                <Alert severity="info">
                  No hay movimientos aplicados para esta cuenta en el periodo seleccionado.
                </Alert>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0, border: '1px solid #e2e8f0', borderRadius: 1, overflow: 'hidden' }}>
                  <DataGrid
                    rows={filas}
                    columns={columnas}
                    rowHeight={30}
                    columnHeaderHeight={HEADER_H}
                    density="compact"
                    disableRowSelectionOnClick
                    localeText={esES.components.MuiDataGrid.defaultProps.localeText}
                    sortModel={sortModel as GridSortModel}
                    onSortModelChange={setSortModel}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={setColumnVisibilityModel}
                    onColumnWidthChange={(params: GridColumnResizeParams) => {
                      setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
                    }}
                    onColumnOrderChange={({ column, targetIndex }) => {
                      setColumnOrder((prev) => {
                        const seed = prev.length ? prev : columnasBase.map((c) => c.field);
                        const next = seed.filter((field) => field !== column.field);
                        next.splice(targetIndex, 0, column.field);
                        return next;
                      });
                    }}
                    sx={[
                      standardDataGridSx,
                      auxiliarHeaderSx,
                      {
                        height: '100%',
                        border: 'none',
                        fontSize: 12,
                        '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
                      },
                    ]}
                    hideFooterPagination
                    hideFooterSelectedRowCount
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
