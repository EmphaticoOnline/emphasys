import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditNoteIcon from '@mui/icons-material/EditNote';
import type { GridColDef } from '@mui/x-data-grid';
import { EmphasysDataGrid } from '../../components/grids/EmphasysDataGrid';
import type { SaldoInicialCuenta } from '../../types/saldosIniciales';
import { fetchSaldosIniciales, actualizarSaldosInicialesLote } from '../../services/saldosInicialesService';
import { CUENTAS_GRID_ROW_HEIGHT, cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx } from './cuentasGridEstilos';

const BRAND = '#1d2f68';

type Filtro = 'todas' | 'sin-saldo' | 'con-saldo';

const FILTROS: Array<{ value: Filtro; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'sin-saldo', label: 'Sin saldo' },
  { value: 'con-saldo', label: 'Con saldo' },
];

const normalizeFilterLookup = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Representación mientras el campo tiene foco: número simple, sin
// separador de miles, para no pelearse con el cursor mientras se escribe.
function formatearEdicion(valor: number | null): string {
  if (valor === null) return '';
  return valor.toFixed(2);
}

// Representación fuera de foco (después de guardar o al perder foco):
// formato de miles + dos decimales, conservando el signo negativo.
function formatearDisplay(valor: number | null): string {
  if (valor === null) return '';
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Convención: campo vacío -> null (se interpretará como "limpiar el saldo
// capturado" al guardar, ver actualizarSaldoInicialCuenta en el backend).
// Cualquier otro texto se interpreta como número; si no es un número válido
// se descarta el cambio (se mantiene el valor anterior en pantalla).
function parseNumeroEdicion(texto: string): number | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  const normalizado = limpio.replace(/,/g, '');
  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

interface EdicionPendiente {
  saldo: number | null;
  observaciones: string | null;
}

interface CeldaSaldoInicialProps {
  valor: number | null;
  onCommit: (valor: number | null) => void;
  onEnterGuardar: (valor: number | null) => void;
}

// Estado local propio por celda (solo confirma al estado del padre en
// onBlur, no en cada tecla): evita que la grilla completa se re-renderice
// en cada carácter escrito. Mientras tiene foco muestra el número "pelón"
// (fácil de editar); al perder foco lo reformatea con separador de miles.
function CeldaSaldoInicial({ valor, onCommit, onEnterGuardar }: CeldaSaldoInicialProps) {
  const [enfocado, setEnfocado] = React.useState(false);
  const [texto, setTexto] = React.useState(() => formatearDisplay(valor));

  React.useEffect(() => {
    if (!enfocado) setTexto(formatearDisplay(valor));
  }, [valor, enfocado]);

  const negativo = texto.trim() !== '' && (parseNumeroEdicion(texto) ?? 0) < 0;

  return (
    <TextField
      variant="standard"
      size="small"
      value={texto}
      onFocus={() => {
        setEnfocado(true);
        setTexto(formatearEdicion(valor));
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const parsed = texto.trim() === '' ? null : parseNumeroEdicion(texto);
        onCommit(parsed);
        setEnfocado(false);
        setTexto(formatearDisplay(parsed));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const parsed = texto.trim() === '' ? null : parseNumeroEdicion(texto);
          onCommit(parsed);
          onEnterGuardar(parsed);
          setEnfocado(false);
          setTexto(formatearDisplay(parsed));
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setEnfocado(false);
          setTexto(formatearDisplay(valor));
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Sin capturar"
      inputProps={{ style: { textAlign: 'right', fontSize: 12 }, inputMode: 'decimal' }}
      InputProps={{ disableUnderline: true }}
      sx={{
        width: '100%',
        '& .MuiInputBase-input': { color: negativo ? 'error.main' : 'inherit' },
      }}
    />
  );
}

interface CeldaObservacionesProps {
  valor: string | null;
  onCommit: (valor: string | null) => void;
  onEnterGuardar: (valor: string | null) => void;
}

function CeldaObservaciones({ valor, onCommit, onEnterGuardar }: CeldaObservacionesProps) {
  const [texto, setTexto] = React.useState(valor ?? '');

  React.useEffect(() => {
    setTexto(valor ?? '');
  }, [valor]);

  return (
    <TextField
      variant="standard"
      size="small"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => onCommit(texto.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const comprometido = texto.trim() || null;
          onCommit(comprometido);
          onEnterGuardar(comprometido);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setTexto(valor ?? '');
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Observaciones"
      inputProps={{ style: { fontSize: 12 }, maxLength: 500 }}
      InputProps={{ disableUnderline: true }}
      sx={{ width: '100%' }}
    />
  );
}

export default function SaldosInicialesView() {
  const [ejercicio, setEjercicio] = React.useState<number>(new Date().getFullYear());
  const [saldos, setSaldos] = React.useState<SaldoInicialCuenta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [filtro, setFiltro] = React.useState<Filtro>('todas');
  const [buscarCuenta, setBuscarCuenta] = React.useState('');
  const [buscarDescripcion, setBuscarDescripcion] = React.useState('');

  const [ediciones, setEdiciones] = React.useState<Map<number, EdicionPendiente>>(new Map());
  const [guardandoId, setGuardandoId] = React.useState<number | null>(null);
  const [guardandoLote, setGuardandoLote] = React.useState(false);
  const [erroresLote, setErroresLote] = React.useState<Array<{ cuenta_id: number; motivo: string }>>([]);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSaldosIniciales(ejercicio);
      setSaldos(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los saldos iniciales');
      setSaldos([]);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  // Cambiar de ejercicio descarta ediciones pendientes del ejercicio
  // anterior: son conceptos distintos (saldo inicial es por ejercicio), no
  // tendría sentido reaplicarlas a otro año.
  React.useEffect(() => {
    setEdiciones(new Map());
    setErroresLote([]);
  }, [ejercicio]);

  const filasFiltradas = React.useMemo(() => {
    let filas = saldos;
    if (filtro === 'sin-saldo') filas = filas.filter((s) => s.estado === 'sin_capturar');
    else if (filtro === 'con-saldo') filas = filas.filter((s) => s.estado === 'capturado');

    if (buscarCuenta.trim()) {
      const termino = normalizeFilterLookup(buscarCuenta);
      filas = filas.filter((s) => normalizeFilterLookup(s.cuenta).includes(termino));
    }
    if (buscarDescripcion.trim()) {
      const termino = normalizeFilterLookup(buscarDescripcion);
      filas = filas.filter((s) => normalizeFilterLookup(s.descripcion).includes(termino));
    }
    return filas;
  }, [saldos, filtro, buscarCuenta, buscarDescripcion]);

  const handleCambiarSaldo = React.useCallback((cuentaId: number, saldo: number | null) => {
    setEdiciones((prev) => {
      const next = new Map(prev);
      const actual = next.get(cuentaId) ?? { saldo: null, observaciones: null };
      next.set(cuentaId, { ...actual, saldo });
      return next;
    });
  }, []);

  const handleCambiarObservaciones = React.useCallback((cuentaId: number, observaciones: string | null) => {
    setEdiciones((prev) => {
      const next = new Map(prev);
      const actual = next.get(cuentaId) ?? { saldo: null, observaciones: null };
      next.set(cuentaId, { ...actual, observaciones });
      return next;
    });
  }, []);

  const handleLimpiarCambio = React.useCallback((cuentaId: number) => {
    setEdiciones((prev) => {
      const next = new Map(prev);
      next.delete(cuentaId);
      return next;
    });
  }, []);

  const guardarItems = React.useCallback(
    async (items: Array<{ cuenta_id: number; saldo_inicial: number | null; observaciones: string | null }>) => {
      const resultado = await actualizarSaldosInicialesLote(ejercicio, items);
      await cargar();

      const idsConError = new Set(resultado.errores.map((e) => e.cuenta_id));
      setEdiciones((prev) => {
        const next = new Map<number, EdicionPendiente>();
        prev.forEach((v, k) => {
          if (idsConError.has(k)) next.set(k, v);
        });
        return next;
      });
      setErroresLote(resultado.errores);
      return resultado;
    },
    [ejercicio, cargar]
  );

  // `overrides` permite guardar con un valor recién tecleado sin depender de
  // que `ediciones` ya se haya actualizado (setState es asíncrono): al
  // presionar Enter en una celda, el valor comprometido se pasa aquí
  // directamente en vez de leerlo de vuelta del estado del padre, para que
  // no haya una carrera entre "confirmar el cambio" y "guardar".
  const handleGuardarRenglon = React.useCallback(
    async (cuenta: SaldoInicialCuenta, overrides?: Partial<EdicionPendiente>) => {
      const base = ediciones.get(cuenta.cuenta_id) ?? { saldo: cuenta.saldo_inicial, observaciones: cuenta.observaciones };
      const edicion: EdicionPendiente = { ...base, ...overrides };
      setGuardandoId(cuenta.cuenta_id);
      try {
        const resultado = await guardarItems([
          { cuenta_id: cuenta.cuenta_id, saldo_inicial: edicion.saldo, observaciones: edicion.observaciones },
        ]);
        if (resultado.errores.length > 0) {
          setSnackbar({ open: true, message: resultado.errores[0]?.motivo ?? 'No se pudo actualizar la cuenta', severity: 'error' });
        } else {
          setSnackbar({ open: true, message: `Cuenta ${cuenta.cuenta} actualizada`, severity: 'success' });
        }
      } catch (err: any) {
        setSnackbar({ open: true, message: err?.message || 'No se pudo actualizar la cuenta', severity: 'error' });
      } finally {
        setGuardandoId(null);
      }
    },
    [ediciones, guardarItems]
  );

  const handleGuardarTodo = React.useCallback(async () => {
    const items = Array.from(ediciones.entries()).map(([cuenta_id, e]) => ({
      cuenta_id,
      saldo_inicial: e.saldo,
      observaciones: e.observaciones,
    }));
    if (items.length === 0) return;

    setGuardandoLote(true);
    try {
      const resultado = await guardarItems(items);
      setSnackbar({
        open: true,
        message:
          resultado.errores.length > 0
            ? `${resultado.actualizadas} cuenta(s) actualizada(s), ${resultado.errores.length} con error`
            : `${resultado.actualizadas} cuenta(s) actualizada(s)`,
        severity: resultado.errores.length > 0 ? 'error' : 'success',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo guardar el lote', severity: 'error' });
    } finally {
      setGuardandoLote(false);
    }
  }, [ediciones, guardarItems]);

  const columns: GridColDef<SaldoInicialCuenta>[] = React.useMemo(
    () => [
      {
        field: 'cuenta',
        headerName: 'Cuenta',
        width: 140,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params) => <Box sx={{ color: BRAND, fontWeight: 600 }}>{params.value}</Box>,
      },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        flex: 1,
        minWidth: 180,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params) => (
          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={params.value}>
            {params.value}
          </Box>
        ),
      },
      {
        field: 'naturaleza_descripcion',
        headerName: 'Naturaleza',
        width: 110,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params) => (
          <Typography variant="caption" color={params.value ? 'text.primary' : 'error.main'}>
            {params.value ?? 'No determinada'}
          </Typography>
        ),
      },
      {
        field: 'saldo_inicial',
        headerName: 'Saldo inicial',
        width: 170,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const edicion = ediciones.get(cuenta.cuenta_id);
          const valorEfectivo = edicion ? edicion.saldo : cuenta.saldo_inicial;
          return (
            <CeldaSaldoInicial
              valor={valorEfectivo}
              onCommit={(v) => handleCambiarSaldo(cuenta.cuenta_id, v)}
              onEnterGuardar={(v) => void handleGuardarRenglon(cuenta, { saldo: v })}
            />
          );
        },
      },
      {
        field: 'observaciones',
        headerName: 'Observaciones',
        flex: 0.9,
        minWidth: 180,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const edicion = ediciones.get(cuenta.cuenta_id);
          const valorEfectivo = edicion ? edicion.observaciones : cuenta.observaciones;
          return (
            <CeldaObservaciones
              valor={valorEfectivo}
              onCommit={(v) => handleCambiarObservaciones(cuenta.cuenta_id, v)}
              onEnterGuardar={(v) => void handleGuardarRenglon(cuenta, { observaciones: v })}
            />
          );
        },
      },
      {
        // Renombrada de "Estado" a "Captura": lo único que este chip base
        // indica es si YA existe un saldo inicial guardado para esta cuenta
        // en el ejercicio (contabilidad.cuentas_saldos_iniciales tiene o no
        // tiene una fila), no un "estado del renglón" genérico. Las otras
        // dos señales (pólizas aplicadas / cambio sin guardar) son datos
        // aparte que viajaban en la misma celda sin explicación — ahora
        // cada una tiene ícono + tooltip explícito en vez de un chip
        // "!" / "•" sin contexto.
        field: 'estado',
        headerName: 'Captura',
        width: 170,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const modificado = ediciones.has(cuenta.cuenta_id);
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={cuenta.estado === 'capturado' ? 'Capturado' : 'Sin capturar'}
                size="small"
                color={cuenta.estado === 'capturado' ? 'success' : 'default'}
                variant={cuenta.estado === 'capturado' ? 'filled' : 'outlined'}
                sx={{ height: 20, fontSize: 11 }}
              />
              {cuenta.tiene_polizas_aplicadas_ejercicio && (
                <Tooltip title="Ya existen pólizas aplicadas en este ejercicio. Cambiar este saldo inicial afectará reportes.">
                  <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                </Tooltip>
              )}
              {modificado && (
                <Tooltip title="Cambio pendiente de guardar">
                  <EditNoteIcon sx={{ fontSize: 16, color: 'info.main' }} />
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
      {
        field: 'acciones',
        headerName: 'Acciones',
        width: 90,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const tieneEdicion = ediciones.has(cuenta.cuenta_id);
          const guardandoEsteRenglon = guardandoId === cuenta.cuenta_id;
          return (
            <Stack direction="row" spacing={0.25}>
              <Tooltip title="Guardar renglón">
                <span>
                  <IconButton
                    size="small"
                    disabled={!tieneEdicion || guardandoEsteRenglon}
                    onClick={() => void handleGuardarRenglon(cuenta)}
                  >
                    {guardandoEsteRenglon ? <CircularProgress size={14} /> : <SaveIcon fontSize="inherit" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Descartar cambios">
                <span>
                  <IconButton size="small" disabled={!tieneEdicion} onClick={() => handleLimpiarCambio(cuenta.cuenta_id)}>
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [ediciones, guardandoId, handleCambiarSaldo, handleCambiarObservaciones, handleGuardarRenglon, handleLimpiarCambio]
  );

  const totalPendientes = ediciones.size;
  const hayPolizasAplicadas = saldos.some((s) => s.tiene_polizas_aplicadas_ejercicio);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Alert severity="info">
        Los saldos iniciales representan el saldo contable de arranque del ejercicio. No son movimientos ni pólizas.
        Captura siempre el saldo normal de la cuenta (positivo); el sistema ajusta el signo internamente según la
        naturaleza (deudora/acreedora). Solo se ve negativo cuando el saldo real está al revés de lo esperado.
      </Alert>

      {hayPolizasAplicadas && (
        <Alert severity="warning">
          Ya existen pólizas aplicadas en este ejercicio. Cambiar saldos iniciales afectará reportes y futura balanza
          electrónica.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <TextField
          label="Ejercicio"
          size="small"
          type="number"
          value={ejercicio}
          onChange={(e) => setEjercicio(Number(e.target.value) || new Date().getFullYear())}
          inputProps={{ min: 2000, max: 2100, style: { fontSize: 13 } }}
          sx={{ width: 120, '& .MuiInputBase-input': { py: 0.65 }, '& .MuiInputLabel-root': { fontSize: 13 } }}
        />
        <TextField
          label="Buscar cuenta"
          size="small"
          value={buscarCuenta}
          onChange={(e) => setBuscarCuenta(e.target.value)}
          sx={{ minWidth: 180, '& .MuiInputBase-input': { fontSize: 13, py: 0.65 }, '& .MuiInputLabel-root': { fontSize: 13 } }}
        />
        <TextField
          label="Buscar descripción"
          size="small"
          value={buscarDescripcion}
          onChange={(e) => setBuscarDescripcion(e.target.value)}
          sx={{ minWidth: 180, '& .MuiInputBase-input': { fontSize: 13, py: 0.65 }, '& .MuiInputLabel-root': { fontSize: 13 } }}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Button
          size="small"
          variant="contained"
          disabled={totalPendientes === 0 || guardandoLote}
          onClick={() => void handleGuardarTodo()}
          sx={{ bgcolor: BRAND, '&:hover': { bgcolor: '#16224d' }, textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {guardandoLote ? (
            <CircularProgress size={16} sx={{ color: '#fff' }} />
          ) : (
            `Guardar cambios pendientes${totalPendientes > 0 ? ` (${totalPendientes})` : ''}`
          )}
        </Button>
      </Stack>

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {FILTROS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            size="small"
            onClick={() => setFiltro(f.value)}
            color={filtro === f.value ? 'primary' : 'default'}
            variant={filtro === f.value ? 'filled' : 'outlined'}
            sx={{ fontSize: 12 }}
          />
        ))}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {erroresLote.length > 0 && (
        <Alert severity="error" onClose={() => setErroresLote([])}>
          No se pudieron actualizar {erroresLote.length} cuenta(s):
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {erroresLote.map((e) => {
              const cuenta = saldos.find((s) => s.cuenta_id === e.cuenta_id);
              return (
                <li key={e.cuenta_id}>
                  {cuenta ? `${cuenta.cuenta} — ${cuenta.descripcion}` : `Cuenta #${e.cuenta_id}`}: {e.motivo}
                </li>
              );
            })}
          </Box>
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <EmphasysDataGrid
          rows={filasFiltradas}
          columns={columns}
          getRowId={(row) => row.cuenta_id}
          rowHeight={Math.max(CUENTAS_GRID_ROW_HEIGHT, 34)}
          density="compact"
          autoHeight
          loading={loading}
          disableRowSelectionOnClick
          hideFooterPagination
          hideFooterSelectedRowCount
          initialState={{ sorting: { sortModel: [{ field: 'cuenta', sort: 'asc' }] } }}
          sx={[cuentasSinFocoDeCeldaSx, cuentasGridDensidadSx, { '--DataGrid-overlayHeight': '200px' }]}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay cuentas que coincidan con el filtro.
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
