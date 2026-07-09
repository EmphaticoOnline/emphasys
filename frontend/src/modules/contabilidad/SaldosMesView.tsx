import * as React from 'react';
import { Alert, Box, Paper, Snackbar, Stack, Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { AuxiliarCuentaResultado, CuentaSaldoMes } from '../../types/saldosCuentas';
import type { Cuenta } from '../../types/contabilidad';
import { fetchAuxiliarCuenta, fetchEjerciciosDisponibles, fetchSaldosMes } from '../../services/saldosCuentasService';
import { standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useLocalizadorCuenta } from './useLocalizadorCuenta';
import { AccionesCuentaCell, type AccionesCuentaHandlers } from './cuentaAcciones';
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import AuxiliarCuentaDrawer from './AuxiliarCuentaDrawer';
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
    .replace(/[\u0300-\u036f]/g, '');

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

// Mismo formato de siempre (signo, separador de miles, dos decimales); solo
// se le agrega color rojo cuando el importe es negativo, para que destaque
// visualmente en las columnas monetarias de la grilla.
function celdaMoneda(valor: number) {
  return (
    <Box component="span" sx={{ color: valor < 0 ? 'error.main' : 'inherit' }}>
      {formatMoneda(valor)}
    </Box>
  );
}

interface SaldosMesViewProps extends AccionesCuentaHandlers {
  cuentasCompletas: Cuenta[];
  onNueva: () => void;
  subVista: SubVista;
  onSubVistaChange: (valor: SubVista) => void;
}

export default function SaldosMesView({
  cuentasCompletas,
  onNueva,
  onEditar,
  onPedirEliminar,
  subVista,
  onSubVistaChange,
}: SaldosMesViewProps) {
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [saldos, setSaldos] = React.useState<CuentaSaldoMes[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [buscarDescripcion, setBuscarDescripcion] = React.useState('');
  const [filaSeleccionadaId, setFilaSeleccionadaId] = React.useState<number | null>(null);

  const [auxiliarAbierto, setAuxiliarAbierto] = React.useState(false);
  const [auxiliarCargando, setAuxiliarCargando] = React.useState(false);
  const [auxiliarError, setAuxiliarError] = React.useState<string | null>(null);
  const [auxiliarData, setAuxiliarData] = React.useState<AuxiliarCuentaResultado | null>(null);
  const [mensajeNoAfectable, setMensajeNoAfectable] = React.useState<string | null>(null);

  // Saldos por mes no trae todos los campos de Cuenta (ej. "activa"); las
  // acciones (Editar/Activar-Desactivar/Eliminar) necesitan el registro
  // completo, que CuentasTab ya carga y pasa aquí como cuentasCompletas.
  const cuentasPorId = React.useMemo(
    () => new Map(cuentasCompletas.map((c) => [c.id, c])),
    [cuentasCompletas]
  );

  React.useEffect(() => {
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

  const cargarSaldos = React.useCallback(async () => {
    if (!ejercicio) return;
    setLoading(true);
    try {
      const data = await fetchSaldosMes(ejercicio, periodo);
      setSaldos(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los saldos del mes');
      setSaldos([]);
    } finally {
      setLoading(false);
    }
  }, [ejercicio, periodo]);

  React.useEffect(() => {
    void cargarSaldos();
  }, [cargarSaldos]);

  // Auxiliar contable: solo abre para cuentas afectables (doble clic en el
  // renglón o ícono de la columna Acciones). Para agrupadoras se muestra un
  // mensaje discreto en vez de abrir el drawer.
  const handleVerAuxiliar = React.useCallback(
    async (cuenta: { id: number; afectable: boolean }) => {
      if (!cuenta.afectable) {
        setMensajeNoAfectable('Solo se pueden consultar auxiliares de cuentas afectables.');
        return;
      }
      if (!ejercicio) return;

      setAuxiliarAbierto(true);
      setAuxiliarCargando(true);
      setAuxiliarError(null);
      try {
        const data = await fetchAuxiliarCuenta(cuenta.id, ejercicio, periodo);
        setAuxiliarData(data);
      } catch (err: any) {
        setAuxiliarError(err?.message || 'No se pudo obtener el auxiliar de la cuenta');
        setAuxiliarData(null);
      } finally {
        setAuxiliarCargando(false);
      }
    },
    [ejercicio, periodo]
  );

  const handleCerrarAuxiliar = () => {
    setAuxiliarAbierto(false);
    setAuxiliarData(null);
    setAuxiliarError(null);
  };

  // Búsqueda por descripción: sí filtra la grilla. El localizador por cuenta
  // (dentro del hook) nunca filtra, solo resalta y hace scroll.
  const filasFiltradas = React.useMemo(() => {
    if (!buscarDescripcion.trim()) return saldos;
    const termino = normalizeFilterLookup(buscarDescripcion);
    return saldos.filter((c) => normalizeFilterLookup(c.descripcion).includes(termino));
  }, [saldos, buscarDescripcion]);

  const { localizarCuenta, setLocalizarCuenta, filaLocalizadaId, apiRef } = useLocalizadorCuenta(filasFiltradas);

  const columns: GridColDef<CuentaSaldoMes>[] = React.useMemo(() => [
    {
      field: 'cuenta',
      headerName: 'Cuenta',
      width: 140,
      headerAlign: 'center',
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
      flex: 1.2,
      minWidth: 220,
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
      field: 'saldo_inicial',
      headerName: 'Saldo inicial',
      width: 140,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => celdaMoneda(Number(value)),
    },
    {
      field: 'cargos',
      headerName: 'Cargos',
      width: 130,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => celdaMoneda(Number(value)),
    },
    {
      field: 'abonos',
      headerName: 'Abonos',
      width: 130,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => celdaMoneda(Number(value)),
    },
    {
      field: 'saldo_final',
      headerName: 'Saldo final',
      width: 140,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => celdaMoneda(Number(value)),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 130,
      align: 'center',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <AccionesCuentaCell
          cuenta={cuentasPorId.get(params.row.id)}
          onEditar={onEditar}
          onPedirEliminar={onPedirEliminar}
          onVerAuxiliar={handleVerAuxiliar}
        />
      ),
    },
  ], [cuentasPorId, onEditar, onPedirEliminar, handleVerAuxiliar]);

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

      <SelectorMesesCompacto periodo={periodo} onChange={setPeriodo} />

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
          getRowClassName={(params) =>
            params.id === filaSeleccionadaId
              ? 'fila-seleccionada'
              : params.id === filaLocalizadaId
                ? 'fila-localizada'
                : ''
          }
          onRowClick={(params) => setFilaSeleccionadaId(Number(params.id))}
          onRowDoubleClick={(params) => void handleVerAuxiliar(params.row)}
          rowHeight={CUENTAS_GRID_ROW_HEIGHT}
          density="compact"
          autoHeight
          loading={loading}
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

      <AuxiliarCuentaDrawer
        open={auxiliarAbierto}
        onClose={handleCerrarAuxiliar}
        loading={auxiliarCargando}
        error={auxiliarError}
        data={auxiliarData}
      />

      <Snackbar
        open={Boolean(mensajeNoAfectable)}
        autoHideDuration={3500}
        onClose={() => setMensajeNoAfectable(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setMensajeNoAfectable(null)} sx={{ width: '100%' }}>
          {mensajeNoAfectable}
        </Alert>
      </Snackbar>
    </Box>
  );
}
