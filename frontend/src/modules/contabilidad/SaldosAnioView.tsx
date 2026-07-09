import * as React from 'react';
import {
  Alert,
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { Cuenta } from '../../types/contabilidad';
import type { SaldoAnioResultado } from '../../types/saldosCuentas';
import { fetchCuentas } from '../../services/contabilidadService';
import { fetchEjerciciosDisponibles, fetchSaldosAnio } from '../../services/saldosCuentasService';
import { standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useLocalizadorCuenta } from './useLocalizadorCuenta';
import { AccionesCuentaCell, type AccionesCuentaHandlers } from './cuentaAcciones';
import CuentasFiltrosBar from './CuentasFiltrosBar';
import type { SubVista } from './CuentasTab';
import {
  CUENTAS_GRID_ROW_HEIGHT,
  cuentasFilaLocalizadaSx,
  cuentasFilaSeleccionadaSx,
  cuentasGridDensidadSx,
  cuentasSinFocoDeCeldaSx,
} from './cuentasGridEstilos';

const normalizeFilterLookup = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

// Mismo formato de siempre (signo, separador de miles, dos decimales); solo
// se le agrega color rojo cuando el importe es negativo, para que destaque
// visualmente en las columnas monetarias de la tabla.
function celdaMoneda(valor: number) {
  return (
    <Box component="span" sx={{ color: valor < 0 ? 'error.main' : 'inherit' }}>
      {formatMoneda(valor)}
    </Box>
  );
}

interface SaldosAnioViewProps extends AccionesCuentaHandlers {
  onNueva: () => void;
  subVista: SubVista;
  onSubVistaChange: (valor: SubVista) => void;
}

export default function SaldosAnioView({
  onNueva,
  onEditar,
  onPedirEliminar,
  subVista,
  onSubVistaChange,
}: SaldosAnioViewProps) {
  const [cuentas, setCuentas] = React.useState<Cuenta[]>([]);
  const [loadingCuentas, setLoadingCuentas] = React.useState(false);
  const [errorCuentas, setErrorCuentas] = React.useState<string | null>(null);
  const [buscarDescripcion, setBuscarDescripcion] = React.useState('');

  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);

  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = React.useState<number | null>(null);
  const [resultado, setResultado] = React.useState<SaldoAnioResultado | null>(null);
  const [loadingResultado, setLoadingResultado] = React.useState(false);
  const [errorResultado, setErrorResultado] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoadingCuentas(true);
    fetchCuentas(true)
      .then((data) => {
        setCuentas(data);
        setErrorCuentas(null);
      })
      .catch((err: any) => {
        setErrorCuentas(err?.message || 'No se pudieron cargar las cuentas contables');
        setCuentas([]);
      })
      .finally(() => setLoadingCuentas(false));

    fetchEjerciciosDisponibles()
      .then((lista) => {
        setEjercicios(lista);
        setEjercicio((prev) => prev ?? lista[0] ?? new Date().getFullYear());
      })
      .catch(() => {
        setEjercicios([new Date().getFullYear()]);
        setEjercicio((prev) => prev ?? new Date().getFullYear());
      });
  }, []);

  // Al abrir la vista, seleccionar automáticamente la primera cuenta (el
  // backend ya regresa listarCuentas ordenado por `cuenta`) para que el panel
  // derecho muestre saldos de inmediato, sin depender de que el usuario haga
  // clic primero. Guardado por `cuentaSeleccionadaId == null` para que no se
  // vuelva a disparar una vez que ya hay una selección (propia o del usuario).
  React.useEffect(() => {
    const primera = cuentas[0];
    if (cuentaSeleccionadaId == null && primera) {
      setCuentaSeleccionadaId(primera.id);
    }
  }, [cuentas, cuentaSeleccionadaId]);

  const cargarSaldosAnio = React.useCallback(async () => {
    if (!ejercicio || !cuentaSeleccionadaId) {
      setResultado(null);
      return;
    }
    setLoadingResultado(true);
    try {
      const data = await fetchSaldosAnio(cuentaSeleccionadaId, ejercicio);
      setResultado(data);
      setErrorResultado(null);
    } catch (err: any) {
      setErrorResultado(err?.message || 'No se pudieron cargar los saldos del año');
      setResultado(null);
    } finally {
      setLoadingResultado(false);
    }
  }, [ejercicio, cuentaSeleccionadaId]);

  React.useEffect(() => {
    void cargarSaldosAnio();
  }, [cargarSaldosAnio]);

  const filasFiltradas = React.useMemo(() => {
    if (!buscarDescripcion.trim()) return cuentas;
    const termino = normalizeFilterLookup(buscarDescripcion);
    return cuentas.filter((c) => normalizeFilterLookup(c.descripcion).includes(termino));
  }, [cuentas, buscarDescripcion]);

  const { localizarCuenta, setLocalizarCuenta, filaLocalizadaId, apiRef } = useLocalizadorCuenta(filasFiltradas);

  const columns: GridColDef<Cuenta>[] = React.useMemo(() => [
    { field: 'cuenta', headerName: 'Cuenta', width: 130, headerAlign: 'center', headerClassName: 'finanzas-header' },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 180,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Box
          sx={{
            pl: `${Math.max(0, params.row.nivel - 1) * 24}px`,
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
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 100,
      align: 'center',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <AccionesCuentaCell cuenta={params.row} onEditar={onEditar} onPedirEliminar={onPedirEliminar} />
      ),
    },
  ], [onEditar, onPedirEliminar]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <CuentasFiltrosBar
        ejercicio={ejercicio}
        ejercicios={ejercicios}
        onEjercicioChange={setEjercicio}
        localizarCuenta={localizarCuenta}
        onLocalizarCuentaChange={setLocalizarCuenta}
        buscarDescripcion={buscarDescripcion}
        onBuscarDescripcionChange={setBuscarDescripcion}
        subVista={subVista}
        onSubVistaChange={onSubVistaChange}
        onNueva={onNueva}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box sx={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          {errorCuentas && (
            <Alert severity="error" onClose={() => setErrorCuentas(null)}>
              {errorCuentas}
            </Alert>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <DataGrid
              apiRef={apiRef}
              rows={filasFiltradas}
              columns={columns}
              getRowClassName={(params) =>
                params.id === cuentaSeleccionadaId
                  ? 'fila-seleccionada'
                  : params.id === filaLocalizadaId
                    ? 'fila-localizada'
                    : ''
              }
              onRowClick={(params) => setCuentaSeleccionadaId(Number(params.id))}
              rowHeight={CUENTAS_GRID_ROW_HEIGHT}
              density="compact"
              autoHeight
              loading={loadingCuentas}
              disableRowSelectionOnClick
              localeText={esES.components.MuiDataGrid.defaultProps.localeText}
              initialState={{ sorting: { sortModel: [{ field: 'cuenta', sort: 'asc' }] } }}
              sx={[
                standardDataGridSx,
                cuentasSinFocoDeCeldaSx,
                cuentasGridDensidadSx,
                cuentasFilaLocalizadaSx,
                cuentasFilaSeleccionadaSx,
                { '--DataGrid-overlayHeight': '200px' },
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
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {errorResultado && (
            <Alert severity="error" onClose={() => setErrorResultado(null)}>
              {errorResultado}
            </Alert>
          )}

          {!loadingCuentas && !cuentaSeleccionadaId && (
            <Alert severity="info">
              {cuentas.length === 0
                ? 'No hay cuentas contables registradas.'
                : 'Selecciona una cuenta de la lista para ver sus saldos por mes.'}
            </Alert>
          )}

          {cuentaSeleccionadaId && resultado && (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, pb: 0 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {resultado.cuenta} — {resultado.descripcion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ejercicio {resultado.ejercicio}
                </Typography>
              </Box>
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f1f3f6' } }}>
                      <TableCell>Mes</TableCell>
                      <TableCell align="right">Cargos</TableCell>
                      <TableCell align="right">Abonos</TableCell>
                      <TableCell align="right">Saldo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resultado.meses.map((mes) => (
                      <TableRow key={mes.periodo}>
                        <TableCell>{mes.nombre_mes}</TableCell>
                        <TableCell align="right">{celdaMoneda(mes.cargos)}</TableCell>
                        <TableCell align="right">{celdaMoneda(mes.abonos)}</TableCell>
                        <TableCell align="right">{celdaMoneda(mes.saldo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid #d1d5db' } }}>
                      <TableCell>Totales</TableCell>
                      <TableCell align="right">{celdaMoneda(resultado.totales.cargos)}</TableCell>
                      <TableCell align="right">{celdaMoneda(resultado.totales.abonos)}</TableCell>
                      <TableCell align="right">{celdaMoneda(resultado.totales.saldo_final)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {cuentaSeleccionadaId && loadingResultado && !resultado && (
            <Typography variant="body2" color="text.secondary">
              Cargando saldos...
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
