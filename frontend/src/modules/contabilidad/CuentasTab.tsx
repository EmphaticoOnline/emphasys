import * as React from 'react';
import { Alert, Box, Button, Chip, IconButton, Paper, Snackbar, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import { DataGrid, useGridApiRef, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { Cuenta } from '../../types/contabilidad';
import { fetchCuentas, cambiarEstadoCuenta, fetchConfiguracionContable } from '../../services/contabilidadService';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import CuentaFormView from './CuentaFormView';
import { limpiarCuentaInput, aplicarMascaraCuenta, parseEstructuraCuentas } from '../../utils/cuentaContableMask';

type Vista = 'lista' | 'formulario';

const normalizeFilterLookup = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function CuentasTab() {
  const [cuentas, setCuentas] = React.useState<Cuenta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [vista, setVista] = React.useState<Vista>('lista');
  const [cuentaEditando, setCuentaEditando] = React.useState<Cuenta | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const [localizarCuenta, setLocalizarCuenta] = React.useState('');
  const [buscarDescripcion, setBuscarDescripcion] = React.useState('');
  const [filaLocalizadaId, setFilaLocalizadaId] = React.useState<number | null>(null);
  const [segmentLengths, setSegmentLengths] = React.useState<number[]>([]);
  const [caracterSeparador, setCaracterSeparador] = React.useState('-');
  const apiRef = useGridApiRef();

  const loadCuentas = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCuentas(true);
      setCuentas(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las cuentas contables');
      setCuentas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCuentas();
  }, [loadCuentas]);

  React.useEffect(() => {
    fetchConfiguracionContable()
      .then((configuracion) => {
        setSegmentLengths(parseEstructuraCuentas(configuracion.estructura_cuentas));
        setCaracterSeparador(configuracion.caracter_separador);
      })
      .catch(() => {
        // Si falla, el localizador cae a comparar el texto tal cual.
      });
  }, []);

  const handleNueva = () => {
    setCuentaEditando(null);
    setVista('formulario');
  };

  const handleEditar = (cuenta: Cuenta) => {
    setCuentaEditando(cuenta);
    setVista('formulario');
  };

  const handleCancelarFormulario = () => {
    setVista('lista');
    setCuentaEditando(null);
  };

  const handleGuardado = async () => {
    setSnackbar({
      open: true,
      message: cuentaEditando ? 'Cuenta actualizada' : 'Cuenta creada',
      severity: 'success',
    });
    setVista('lista');
    setCuentaEditando(null);
    await loadCuentas();
  };

  const handleToggleEstado = async (cuenta: Cuenta) => {
    try {
      await cambiarEstadoCuenta(cuenta.id, !cuenta.activa);
      setSnackbar({
        open: true,
        message: cuenta.activa ? 'Cuenta desactivada' : 'Cuenta activada',
        severity: 'success',
      });
      await loadCuentas();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo cambiar el estado de la cuenta', severity: 'error' });
    }
  };

  // Búsqueda por descripción: sí filtra la grilla (no distingue mayúsculas/acentos).
  const filasFiltradas = React.useMemo(() => {
    if (!buscarDescripcion.trim()) return cuentas;
    const termino = normalizeFilterLookup(buscarDescripcion);
    return cuentas.filter((c) => normalizeFilterLookup(c.descripcion).includes(termino));
  }, [cuentas, buscarDescripcion]);

  // Localizador por cuenta: NO filtra, solo detecta y resalta la primera
  // coincidencia dentro de lo que ya se está mostrando (filasFiltradas).
  React.useEffect(() => {
    if (!localizarCuenta.trim()) {
      setFilaLocalizadaId(null);
      return;
    }

    const digitos = limpiarCuentaInput(localizarCuenta);
    const prefijo = digitos && segmentLengths.length
      ? aplicarMascaraCuenta(digitos, segmentLengths, caracterSeparador)
      : localizarCuenta.trim();

    const encontrada = filasFiltradas.find((c) => c.cuenta.startsWith(prefijo));
    setFilaLocalizadaId(encontrada?.id ?? null);

    if (encontrada) {
      const rowEl = apiRef.current?.getRowElement?.(encontrada.id);
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [localizarCuenta, filasFiltradas, segmentLengths, caracterSeparador, apiRef]);

  const columns: GridColDef<Cuenta>[] = React.useMemo(() => [
    {
      field: 'cuenta',
      headerName: 'Cuenta',
      width: 140,
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Box sx={{ color: params.row.afectable ? '#1d2f68' : 'text.secondary', fontWeight: params.row.afectable ? 600 : 400 }}>
          {params.value}
        </Box>
      ),
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      flex: 1.4,
      minWidth: 220,
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Box
          sx={{
            pl: `${Math.max(0, (params.row.nivel - 1)) * 24}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            color: params.row.afectable ? '#1d2f68' : 'text.secondary',
            fontWeight: params.row.afectable ? 600 : 400,
          }}
          title={params.value}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: 'afectable',
      headerName: 'Afectable',
      width: 110,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => <Chip label={value ? 'Sí' : 'No'} color={value ? 'primary' : 'default'} size="small" />,
    },
    {
      field: 'activa',
      headerName: 'Activa',
      width: 100,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => <Chip label={value ? 'Sí' : 'No'} color={value ? 'success' : 'default'} size="small" />,
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 120,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" width="100%">
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => handleEditar(params.row)} sx={{ color: '#1d2f68' }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.activa ? 'Desactivar' : 'Activar'}>
            <IconButton
              size="small"
              onClick={() => handleToggleEstado(params.row)}
              sx={{ color: params.row.activa ? '#166534' : '#9ca3af' }}
            >
              {params.row.activa ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], []);

  if (vista === 'formulario') {
    return <CuentaFormView cuenta={cuentaEditando} onCancel={handleCancelarFormulario} onSaved={handleGuardado} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Localizar cuenta"
            placeholder="Ej. 101 0001"
            size="small"
            value={localizarCuenta}
            onChange={(e) => setLocalizarCuenta(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Buscar descripción"
            placeholder="Ej. Bancos"
            size="small"
            value={buscarDescripcion}
            onChange={(e) => setBuscarDescripcion(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNueva}
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          Nueva cuenta
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          apiRef={apiRef}
          rows={filasFiltradas}
          columns={columns}
          getRowClassName={(params) => (params.id === filaLocalizadaId ? 'fila-localizada' : '')}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{ sorting: { sortModel: [{ field: 'cuenta', sort: 'asc' }] } }}
          sx={[
            standardDataGridSx,
            {
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
              '& .fila-localizada': {
                backgroundColor: '#fef3c7',
                transition: 'background-color 0.3s ease',
              },
              '& .fila-localizada:hover': {
                backgroundColor: '#fde68a',
              },
            },
          ]}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay cuentas contables registradas.
                </Typography>
              </Stack>
            ),
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
        />
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
