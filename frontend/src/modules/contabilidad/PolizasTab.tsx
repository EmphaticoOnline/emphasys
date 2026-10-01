import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
  DataGrid,
  type GridColDef,
  type GridColumnResizeParams,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridValidRowModel,
} from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { PolizaEncabezado, PolizaMovimiento, PolizaValidacionDetalle } from '../../types/polizas';
import { NOMBRES_MESES } from '../../types/saldosCuentas';
import {
  fetchPolizas,
  fetchMovimientosPoliza,
  eliminarPoliza,
  cambiarEstatusPoliza,
  cambiarEstatusPolizasLote,
} from '../../services/polizasService';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useDeviceProfile } from '../../hooks/useDeviceProfile';
import { useGridPreferences } from '../../hooks/useGridPreferences';
import PolizaFormView from './PolizaFormView';
import {
  barraLoteSx,
  barraTotalesSx,
  botonPrimarioSx,
  grillaCompactaSx,
  importeSx,
} from './contabilidadVisual';

type Vista = 'lista' | 'formulario';

function formatMoneda(valor: number): string {
  return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

function formatFecha(valor: string | null): string {
  if (!valor) return '—';
  // Fechas civiles 'YYYY-MM-DD' (columna date): parsear por split, nunca por
  // new Date(...), para no arriesgar un desfase de día por zona horaria.
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${anio}`;
  }
  // Timestamps reales (creado_en/actualizado_en) sí llevan zona horaria y es
  // correcto convertirlos con Date para mostrarlos en hora local.
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-MX');
}

// El comportamiento de header (azul institucional, divisores visibles, menú
// de columna solo al hover) ya lo da standardDataGridSx tal cual lo usa el
// resto del ERP (ej. Documentos vía EmphasysDataGrid); un override local que
// ocultaba columnSeparator y forzaba el ícono de menú siempre visible fue lo
// que rompía el resize de columnas y el hover-only del menú. Se removió por
// completo: aquí solo queda el ajuste de foco de celda (ver más abajo).
//
// Quitar el recuadro de foco por celda (outline azul de MUI DataGrid al dar
// clic/tab sobre una celda individual): la selección visual debe ser por
// fila completa (".fila-seleccionada"), no por celda.
const sinFocoDeCeldaSx = {
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
  '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': { outline: 'none' },
};

// Aplica un orden de columnas guardado (persistencia por pantalla, mismo
// patrón que Documentos vía useGridPreferences): columnas conocidas primero
// en el orden guardado, cualquier columna nueva que no estuviera guardada se
// agrega al final en su posición original.
function reordenarColumnas<TRow extends GridValidRowModel>(
  base: GridColDef<TRow>[],
  orden: string[]
): GridColDef<TRow>[] {
  if (!orden.length) return base;
  const porCampo = new Map(base.map((col) => [col.field, col]));
  const ordenadas = orden.map((field) => porCampo.get(field)).filter((col): col is GridColDef<TRow> => Boolean(col));
  const faltantes = base.filter((col) => !orden.includes(col.field));
  return [...ordenadas, ...faltantes];
}

function ordenarPolizas(filas: PolizaEncabezado[], modelo: GridSortModel): PolizaEncabezado[] {
  if (!modelo.length) return filas;
  const copia = [...filas];
  copia.sort((a, b) => {
    for (const criterio of modelo) {
      const campo = criterio.field as keyof PolizaEncabezado;
      const dir = criterio.sort === 'desc' ? -1 : 1;
      const va = a[campo];
      const vb = b[campo];
      if (va == null && vb == null) continue;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { numeric: true });
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });
  return copia;
}

const ORDEN_POLIZAS: Array<{ field: keyof PolizaEncabezado; label: string }> = [
  { field: 'numero', label: 'Número' },
  { field: 'fecha', label: 'Fecha' },
  { field: 'tipo_poliza_identificador', label: 'Tipo' },
  { field: 'referencia', label: 'Referencia' },
  { field: 'estatus', label: 'Estatus' },
];

export default function PolizasTab() {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const nav = tokens.navigation;
  const [vista, setVista] = React.useState<Vista>('lista');
  const [polizaIdEnEdicion, setPolizaIdEnEdicion] = React.useState<number | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [buscarInput, setBuscarInput] = React.useState('');
  const [buscar, setBuscar] = React.useState('');

  const [polizas, setPolizas] = React.useState<PolizaEncabezado[]>([]);
  const [loadingPolizas, setLoadingPolizas] = React.useState(false);
  const [errorPolizas, setErrorPolizas] = React.useState<string | null>(null);

  const [polizaAEliminar, setPolizaAEliminar] = React.useState<PolizaEncabezado | null>(null);
  const [polizaAplicadaBloqueada, setPolizaAplicadaBloqueada] = React.useState(false);
  const [eliminando, setEliminando] = React.useState(false);
  const [cambiandoEstatusId, setCambiandoEstatusId] = React.useState<number | null>(null);

  // Selección múltiple (checkboxes) para acciones en lote: independiente de
  // polizaSeleccionadaId (que sigue controlando qué movimientos se muestran
  // a la derecha vía clic normal en la fila).
  const [seleccionMultiple, setSeleccionMultiple] = React.useState<GridRowSelectionModel>([]);
  const [procesandoLote, setProcesandoLote] = React.useState(false);
  const [confirmacionLote, setConfirmacionLote] = React.useState<'aplicar-todas' | 'desaplicar-todas' | null>(null);
  const [menuMasAnchor, setMenuMasAnchor] = React.useState<HTMLElement | null>(null);
  const [menuOrdenAnchor, setMenuOrdenAnchor] = React.useState<HTMLElement | null>(null);

  const [polizaSeleccionadaId, setPolizaSeleccionadaId] = React.useState<number | null>(null);
  const [movimientos, setMovimientos] = React.useState<PolizaMovimiento[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = React.useState(false);
  const [errorMovimientos, setErrorMovimientos] = React.useState<string | null>(null);

  // Persistencia de configuración de columnas (ancho/orden/visibilidad),
  // mismo hook y patrón que usa Documentos: por pantalla + perfil de
  // dispositivo, guardado en la tabla grid_preferences vía el backend.
  const perfilDispositivo = useDeviceProfile();

  const {
    sortModel: polizasSortModel,
    setSortModel: setPolizasSortModel,
  } = useGridPreferences({
    pantalla: 'contabilidad.polizas.list',
    perfilDispositivo,
    defaultSortModel: [{ field: 'numero', sort: 'asc' }],
  });

  const {
    columnVisibilityModel: movimientosColumnVisibility,
    setColumnVisibilityModel: setMovimientosColumnVisibility,
    columnOrder: movimientosColumnOrder,
    setColumnOrder: setMovimientosColumnOrder,
    applySavedWidthsToColumns: applyMovimientosWidths,
    setColumnWidths: setMovimientosColumnWidths,
  } = useGridPreferences({
    pantalla: 'contabilidad.polizas.movimientos',
    perfilDispositivo,
  });

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

  // Debounce del buscador para no disparar una consulta por cada tecla.
  React.useEffect(() => {
    const timeout = setTimeout(() => setBuscar(buscarInput), 400);
    return () => clearTimeout(timeout);
  }, [buscarInput]);

  const cargarPolizas = React.useCallback(async () => {
    if (!ejercicio) return;
    setLoadingPolizas(true);
    try {
      const data = await fetchPolizas(ejercicio, periodo, buscar);
      setPolizas(data);
      setErrorPolizas(null);
      setPolizaSeleccionadaId(data[0]?.id ?? null);
    } catch (err: any) {
      setErrorPolizas(err?.message || 'No se pudieron cargar las pólizas');
      setPolizas([]);
      setPolizaSeleccionadaId(null);
    } finally {
      setLoadingPolizas(false);
    }
  }, [ejercicio, periodo, buscar]);

  // Cambiar de mes/ejercicio/búsqueda invalida cualquier selección múltiple
  // previa: evita que "aplicar/desaplicar todas las visibles" opere sobre
  // ids que ya no corresponden al filtro actual.
  React.useEffect(() => {
    setSeleccionMultiple([]);
  }, [ejercicio, periodo, buscar]);

  React.useEffect(() => {
    void cargarPolizas();
  }, [cargarPolizas]);

  const handleNuevaPoliza = () => {
    setPolizaIdEnEdicion(null);
    setVista('formulario');
  };

  const handleEditarPoliza = (id: number) => {
    setPolizaIdEnEdicion(id);
    setVista('formulario');
  };

  // Regla absoluta: una póliza aplicada nunca se puede eliminar (backend la
  // rechaza sin importar el origen). El botón ya queda deshabilitado más
  // abajo, pero esta validación es el respaldo real: si de algún modo se
  // dispara la eliminación sobre una póliza aplicada, se avisa con un
  // diálogo dedicado en vez de abrir la confirmación de borrado.
  const handlePedirEliminar = (row: PolizaEncabezado) => {
    if (row.estatus === 'aplicada') {
      setPolizaAplicadaBloqueada(true);
      return;
    }
    setPolizaAEliminar(row);
  };

  const handleCerrarEliminar = () => {
    setPolizaAEliminar(null);
  };

  // Eliminación física: el backend borra contabilidad.polizas y la base
  // arrastra por cascade los movimientos (polizas_detalle) y relaciones con
  // documentos (documentos_polizas). Al recargar, cargarPolizas ya selecciona
  // automáticamente la primera póliza disponible o limpia la selección si ya
  // no queda ninguna.
  const handleConfirmarEliminar = async () => {
    if (!polizaAEliminar) return;
    setEliminando(true);
    try {
      await eliminarPoliza(polizaAEliminar.id);
      setSnackbar({ open: true, message: 'Póliza eliminada', severity: 'success' });
      await cargarPolizas();
      setPolizaAEliminar(null);
    } catch (err: any) {
      // Respaldo por si la póliza pasó a "aplicada" entre que se abrió esta
      // confirmación y se presionó Eliminar (ej. otra pestaña la aplicó):
      // el backend igual la rechaza, y aquí se muestra el mismo diálogo
      // dedicado en vez de un snackbar genérico.
      if (String(err?.message ?? '').includes('No se puede eliminar una póliza aplicada')) {
        setPolizaAEliminar(null);
        setPolizaAplicadaBloqueada(true);
      } else {
        setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar la póliza', severity: 'error' });
        setPolizaAEliminar(null);
      }
    } finally {
      setEliminando(false);
    }
  };

  // Aplicar/desaplicar desde la grilla, sin pasar por el formulario. Ahora sí
  // afecta contabilidad.cuentas_saldos_mensuales de verdad (ver
  // cambiarEstatusPoliza en el backend): aplicar suma cargos/abonos (cuenta
  // del movimiento + sus cuentas padre), desaplicar los revierte.
  const handleAplicarDesaplicar = async (row: PolizaEncabezado) => {
    const destino: 'aplicada' | 'borrador' = row.estatus === 'aplicada' ? 'borrador' : 'aplicada';
    setCambiandoEstatusId(row.id);
    try {
      const resultado = await cambiarEstatusPoliza(row.id, destino);
      setSnackbar({ open: true, message: resultado.message, severity: 'success' });
      // Actualización local inmediata: el PATCH ya regresa la póliza con su
      // estatus y totales recalculados, así que se reemplaza esa fila en el
      // array `polizas` en vez de esperar un round-trip de cargarPolizas().
      // Esto evita cualquier desfase entre "la acción ya se aplicó" y "el
      // icono se ve actualizado", y de paso conserva la selección intacta
      // (polizaSeleccionada se recalcula solo porque depende de `polizas`).
      setPolizas((prev) => prev.map((p) => (p.id === row.id ? resultado.poliza : p)));
      await cargarMovimientos(row.id);
    } catch (err: any) {
      const detalles: PolizaValidacionDetalle[] | undefined = err?.payload?.detalles;
      const mensaje = detalles?.length
        ? `${err.message} ` +
          detalles.map((d) => `Renglón ${d.renglon} (cuenta ${d.cuenta ?? d.cuenta_id}): ${d.motivo}.`).join(' ')
        : err?.message || 'No se pudo cambiar el estatus de la póliza';
      setSnackbar({ open: true, message: mensaje, severity: 'error' });
    } finally {
      setCambiandoEstatusId(null);
    }
  };

  const idsSeleccionMultiple = React.useMemo(() => seleccionMultiple.map(Number), [seleccionMultiple]);

  // Motor único de lote: recibe la lista de ids a procesar (ya sea la
  // selección por checkbox o "todas las visibles") y el estatus destino.
  // Cada póliza se procesa de forma independiente en el backend
  // (cambiarEstatusPolizasLote reutiliza cambiarEstatusPoliza uno por uno,
  // sin transacción global), así que un resultado parcial es normal y
  // esperado, no un error.
  const ejecutarLoteEstatus = React.useCallback(
    async (ids: number[], estatusDestino: 'aplicada' | 'borrador') => {
      if (!ids.length) return;
      setProcesandoLote(true);
      const idPreviaSeleccion = polizaSeleccionadaId;
      try {
        const resultado = await cambiarEstatusPolizasLote(ids, estatusDestino);
        const { exitosas, omitidas, fallidas } = resultado.resumen;
        const verbo = estatusDestino === 'aplicada' ? 'aplicada' : 'desaplicada';
        const partes: string[] = [];
        if (exitosas > 0) partes.push(`${exitosas} póliza${exitosas === 1 ? '' : 's'} ${verbo}${exitosas === 1 ? '' : 's'}`);
        if (omitidas > 0) partes.push(`${omitidas} omitida${omitidas === 1 ? '' : 's'}`);
        if (fallidas > 0) partes.push(`${fallidas} con error`);
        setSnackbar({
          open: true,
          message: partes.length ? partes.join(', ') : 'Sin cambios',
          severity: fallidas > 0 ? 'error' : 'success',
        });
        // Preferencia del usuario: limpiar selección múltiple al terminar el
        // lote (haya sido éxito total o parcial).
        setSeleccionMultiple([]);
        await cargarPolizas();
        if (idPreviaSeleccion != null) {
          setPolizaSeleccionadaId(idPreviaSeleccion);
          await cargarMovimientos(idPreviaSeleccion);
        }
      } catch (err: any) {
        setSnackbar({ open: true, message: err?.message || 'No se pudo procesar el lote de pólizas', severity: 'error' });
      } finally {
        setProcesandoLote(false);
      }
    },
    [cargarPolizas, polizaSeleccionadaId]
  );

  const handleAplicarSeleccionadas = () => void ejecutarLoteEstatus(idsSeleccionMultiple, 'aplicada');
  const handleDesaplicarSeleccionadas = () => void ejecutarLoteEstatus(idsSeleccionMultiple, 'borrador');
  const handleLimpiarSeleccion = () => setSeleccionMultiple([]);

  const handleAbrirMenuMas = (event: React.MouseEvent<HTMLElement>) => setMenuMasAnchor(event.currentTarget);
  const handleCerrarMenuMas = () => setMenuMasAnchor(null);

  const handlePedirAplicarTodas = () => {
    setMenuMasAnchor(null);
    setConfirmacionLote('aplicar-todas');
  };
  const handlePedirDesaplicarTodas = () => {
    setMenuMasAnchor(null);
    setConfirmacionLote('desaplicar-todas');
  };
  const handleCerrarConfirmacionLote = () => {
    if (procesandoLote) return;
    setConfirmacionLote(null);
  };
  const handleConfirmarLoteTodas = async () => {
    const estatusDestino: 'aplicada' | 'borrador' = confirmacionLote === 'aplicar-todas' ? 'aplicada' : 'borrador';
    setConfirmacionLote(null);
    await ejecutarLoteEstatus(polizas.map((p) => p.id), estatusDestino);
  };

  const handleCancelarFormulario = () => {
    setVista('lista');
    setPolizaIdEnEdicion(null);
  };

  const handlePolizaGuardada = async () => {
    setSnackbar({
      open: true,
      message: polizaIdEnEdicion ? 'Póliza actualizada' : 'Póliza creada',
      severity: 'success',
    });
    setVista('lista');
    setPolizaIdEnEdicion(null);
    await cargarPolizas();
  };

  const cargarMovimientos = React.useCallback(async (id: number) => {
    setLoadingMovimientos(true);
    try {
      const data = await fetchMovimientosPoliza(id);
      setMovimientos(data);
      setErrorMovimientos(null);
    } catch (err: any) {
      setErrorMovimientos(err?.message || 'No se pudieron cargar los movimientos de la póliza');
      setMovimientos([]);
    } finally {
      setLoadingMovimientos(false);
    }
  }, []);

  React.useEffect(() => {
    if (!polizaSeleccionadaId) {
      setMovimientos([]);
      return;
    }
    void cargarMovimientos(polizaSeleccionadaId);
  }, [polizaSeleccionadaId, cargarMovimientos]);

  const polizaSeleccionada = React.useMemo(
    () => polizas.find((p) => p.id === polizaSeleccionadaId) ?? null,
    [polizas, polizaSeleccionadaId]
  );

  const polizasOrdenadas = React.useMemo(
    () => ordenarPolizas(polizas, polizasSortModel as GridSortModel),
    [polizas, polizasSortModel]
  );
  const idsVisibles = polizasOrdenadas.map((p) => p.id);
  const todasVisiblesSeleccionadas = idsVisibles.length > 0 && idsVisibles.every((id) => idsSeleccionMultiple.includes(id));

  const alternarSeleccion = (id: number) => {
    setSeleccionMultiple((prev) => {
      const ids = prev.map(Number);
      return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
    });
  };


  const columnasMovimientosBase: GridColDef<PolizaMovimiento>[] = React.useMemo(() => [
    {
      field: 'cuenta',
      headerName: 'Cuenta',
      width: 160,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      // La cuenta completa (todos los segmentos, incluyendo ceros finales) es
      // el valor tal cual está en contabilidad.cuentas.cuenta; el ancho fijo
      // anterior (120px, sin wrap ni tooltip) la recortaba visualmente en
      // cuentas largas. Se ensancha y se agrega tooltip+nowrap, igual que la
      // columna "Estatus" de la grilla de pólizas.
      renderCell: ({ value }) => (
        <Tooltip title={value || ''}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
            {value ?? ''}
          </span>
        </Tooltip>
      ),
    },
    { field: 'cuenta_descripcion', headerName: 'Descripción', flex: 1.2, minWidth: 160, headerAlign: 'center', headerClassName: 'finanzas-header' },
    {
      field: 'concepto_descripcion',
      headerName: 'Concepto',
      flex: 1.4,
      minWidth: 200,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      // concepto_texto (generado por procesos de contabilización automática,
      // ej. facturas de venta) tiene prioridad sobre concepto_descripcion
      // (nombre del catálogo genérico de conceptos), que solo aplica a
      // pólizas capturadas manualmente con un concepto_id.
      renderCell: (params) => params.row.concepto_texto || params.row.concepto_descripcion || '',
    },
    {
      field: 'cargo',
      headerName: 'Cargo',
      width: 120,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => (Number(value) ? formatMoneda(Number(value)) : ''),
    },
    {
      field: 'abono',
      headerName: 'Abono',
      width: 120,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => (Number(value) ? formatMoneda(Number(value)) : ''),
    },
  ], []);

  const columnasMovimientosOrdenadas = React.useMemo(
    () => reordenarColumnas(columnasMovimientosBase, movimientosColumnOrder),
    [columnasMovimientosBase, movimientosColumnOrder]
  );
  const columnasMovimientos = React.useMemo(
    () => applyMovimientosWidths(columnasMovimientosOrdenadas),
    [applyMovimientosWidths, columnasMovimientosOrdenadas]
  );

  if (vista === 'formulario') {
    return (
      <PolizaFormView
        polizaId={polizaIdEnEdicion}
        onCancel={handleCancelarFormulario}
        onSaved={handlePolizaGuardada}
      />
    );
  }

  const iconoDetalle = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    backgroundColor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { backgroundColor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { backgroundColor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });
  const diferenciaSeleccion = polizaSeleccionada
    ? Number(polizaSeleccionada.total_cargos) - Number(polizaSeleccionada.total_abonos)
    : 0;
  const aplicadaSeleccion = polizaSeleccionada?.estatus === 'aplicada';

  return (
    <>
    <Box sx={{ display: 'flex', flexDirection: compacto ? 'column' : 'row', height: compacto ? 'auto' : 'calc(100dvh - 128px)', minHeight: compacto ? 0 : 480, overflow: 'hidden' }}>
      <Box sx={{
        width: compacto ? '100%' : 360,
        flexShrink: 0,
        maxHeight: compacto ? '46vh' : 'none',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: nav.background,
        color: nav.foreground,
        borderRight: compacto ? 'none' : `1px solid ${nav.border}`,
      }}>
        <Box sx={{ px: 1.75, pt: 1.5, pb: 1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: nav.muted }}>
                PÓLIZAS
              </Typography>
              <Typography sx={{ mt: 0.3, fontSize: 13, color: nav.subtle }} noWrap>
                {NOMBRES_MESES[periodo - 1]} {ejercicio ?? ''} · {polizasOrdenadas.length} en vista
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.6}>
              <Tooltip title="Recargar">
                <IconButton size="small" aria-label="Recargar" onClick={() => void cargarPolizas()} sx={{ color: nav.foreground, border: `1px solid ${nav.border}`, width: 34, height: 34 }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Nueva póliza">
                <IconButton size="small" aria-label="Nueva póliza" onClick={handleNuevaPoliza} sx={{ width: 34, height: 34, bgcolor: nav.control, color: nav.controlForeground, '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground } }}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.2 }}>
            <Select
              size="small"
              value={ejercicio ?? ''}
              displayEmpty
              onChange={(e) => setEjercicio(Number(e.target.value))}
              aria-label="Ejercicio"
              sx={{
                minWidth: 84,
                color: nav.foreground,
                bgcolor: nav.summary,
                fontSize: 13,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: nav.border },
                '& .MuiSvgIcon-root': { color: nav.foreground },
              }}
            >
              {ejercicios.map((anio) => (
                <MenuItem key={anio} value={anio}>{anio}</MenuItem>
              ))}
            </Select>
            <TextField
              size="small"
              placeholder="Número, tipo o referencia"
              value={buscarInput}
              onChange={(e) => setBuscarInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: nav.muted }} />
                  </InputAdornment>
                ),
                endAdornment: buscarInput ? (
                  <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setBuscarInput('')} sx={{ color: nav.muted }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null,
              }}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: nav.foreground,
                  bgcolor: nav.summary,
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                },
                '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.85 },
                '& .MuiOutlinedInput-input::placeholder': { color: nav.muted, opacity: 1 },
              }}
            />
            <Tooltip title="Ordenar">
              <IconButton size="small" aria-label="Ordenar" onClick={(e) => setMenuOrdenAnchor(e.currentTarget)} sx={{ color: nav.foreground }}>
                <SwapVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={menuOrdenAnchor} open={Boolean(menuOrdenAnchor)} onClose={() => setMenuOrdenAnchor(null)}>
              {ORDEN_POLIZAS.map((opcion) => {
                const actual = (polizasSortModel as GridSortModel).find((item) => item.field === opcion.field);
                return (
                  <MenuItem
                    key={opcion.field}
                    onClick={() => {
                      const nextDir: 'asc' | 'desc' = actual?.sort === 'asc' ? 'desc' : 'asc';
                      setPolizasSortModel([{ field: opcion.field, sort: nextDir }]);
                      setMenuOrdenAnchor(null);
                    }}
                  >
                    {opcion.label} {actual ? (actual.sort === 'asc' ? '▲' : '▼') : ''}
                  </MenuItem>
                );
              })}
            </Menu>
          </Stack>

          <ToggleButtonGroup
            value={periodo}
            exclusive
            onChange={(_e, value) => value && setPeriodo(value)}
            size="small"
            sx={{
              mt: 1,
              display: 'flex',
              flexWrap: 'wrap',
              '& .MuiToggleButton-root': {
                height: 22,
                minWidth: 0,
                px: 0.55,
                py: 0,
                fontSize: 11,
                fontWeight: 650,
                textTransform: 'none',
                color: nav.muted,
                borderColor: nav.border,
                '&:hover': { bgcolor: nav.hover, color: nav.foreground },
                '&.Mui-selected': {
                  bgcolor: nav.control,
                  color: nav.controlForeground,
                  borderColor: nav.control,
                  '&:hover': { bgcolor: nav.control },
                },
              },
            }}
          >
            {NOMBRES_MESES.map((nombre, index) => (
              <ToggleButton key={nombre} value={index + 1}>{nombre.slice(0, 3)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.25, pb: 0.5, flexShrink: 0 }}>
          <Checkbox
            size="small"
            checked={todasVisiblesSeleccionadas}
            indeterminate={!todasVisiblesSeleccionadas && idsSeleccionMultiple.length > 0}
            disabled={polizasOrdenadas.length === 0}
            onChange={() => setSeleccionMultiple(todasVisiblesSeleccionadas ? [] : idsVisibles)}
            inputProps={{ 'aria-label': 'Seleccionar todas las pólizas visibles' }}
            sx={{ p: 0.4, color: nav.muted, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: nav.foreground } }}
          />
          <Typography sx={{ fontSize: 12, color: nav.muted }}>Selección para aplicar o desaplicar</Typography>
        </Stack>

        {errorPolizas && (
          <Alert severity="error" onClose={() => setErrorPolizas(null)} sx={{ mx: 1, mb: 0.5, py: 0 }}>
            {errorPolizas}
          </Alert>
        )}

        <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1.2, scrollbarWidth: 'thin', scrollbarColor: `${nav.progress} ${nav.background}` }}>
          {loadingPolizas && polizasOrdenadas.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: nav.muted, textAlign: 'center' }}>Cargando pólizas…</Typography>
          ) : polizasOrdenadas.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: nav.muted, textAlign: 'center' }}>
              No hay pólizas para el periodo seleccionado.
            </Typography>
          ) : (
            polizasOrdenadas.map((poliza) => {
              const selected = poliza.id === polizaSeleccionadaId;
              const marcada = idsSeleccionMultiple.includes(poliza.id);
              const aplicada = poliza.estatus === 'aplicada';
              return (
                <Box
                  key={poliza.id}
                  onClick={() => setPolizaSeleccionadaId(poliza.id)}
                  onDoubleClick={() => handleEditarPoliza(poliza.id)}
                  sx={{
                    px: 1,
                    py: 0.85,
                    mb: 0.35,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: selected ? nav.selection : 'transparent',
                    color: selected ? nav.selectionForeground : nav.foreground,
                    '&:hover': { bgcolor: selected ? nav.selection : nav.hover },
                  }}
                >
                  <Stack direction="row" spacing={0.4} alignItems="flex-start">
                    <Checkbox
                      size="small"
                      checked={marcada}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => alternarSeleccion(poliza.id)}
                      inputProps={{ 'aria-label': `Seleccionar póliza ${poliza.numero}` }}
                      sx={{ p: 0.25, color: nav.muted, '&.Mui-checked': { color: selected ? nav.selectionForeground : nav.foreground } }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: 'inherit' }}>
                          {poliza.tipo_poliza_identificador} {poliza.numero}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: selected ? nav.selectionForeground : nav.subtle, fontVariantNumeric: 'tabular-nums' }}>
                          {formatFecha(poliza.fecha)}
                        </Typography>
                      </Box>
                      <Typography sx={{ mt: 0.2, fontSize: 12.5, color: selected ? nav.selectionForeground : nav.foreground, lineHeight: 1.25 }} noWrap>
                        {poliza.referencia || poliza.observaciones || 'Sin referencia'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.35, alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: selected ? nav.selectionForeground : nav.muted }}>
                          {aplicada ? 'APLICADA' : 'BORRADOR'}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: selected ? nav.selectionForeground : nav.subtle, fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoneda(Number(poliza.total_cargos))}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: compacto ? 480 : 0, display: 'flex', flexDirection: 'column', bgcolor: tokens.content.background, color: tokens.content.foreground }}>
        {!polizaSeleccionada ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
              {polizasOrdenadas.length > 0 ? 'Selecciona una póliza' : 'Sin pólizas en este periodo'}
            </Typography>
            <Typography sx={{ mt: 0.6, fontSize: 13, color: tokens.content.muted, maxWidth: 380 }}>
              {polizasOrdenadas.length > 0
                ? 'El encabezado, los totales y los movimientos aparecen aquí.'
                : 'Cambia el mes o el ejercicio, o captura una póliza nueva.'}
            </Typography>
          </Stack>
        ) : (
          <>
            <Box sx={{ px: { xs: 1.5, md: 2.5 }, pt: 1.4, pb: 1, flexShrink: 0 }}>
              <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
                PÓLIZA SELECCIONADA
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.3 }}>
                <Typography sx={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {polizaSeleccionada.tipo_poliza_identificador} {polizaSeleccionada.numero}
                </Typography>
                <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatFecha(polizaSeleccionada.fecha)}</Typography>
              </Box>
              <Typography sx={{ mt: 0.55, fontSize: 14, lineHeight: 1.3 }}>
                {polizaSeleccionada.referencia || 'Sin referencia'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.7, mt: 0.9, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 24, px: 1, borderRadius: 99, bgcolor: aplicadaSeleccion ? tokens.metric.applied.background : tokens.metric.amount.background, color: aplicadaSeleccion ? tokens.metric.applied.foreground : tokens.metric.amount.foreground, fontSize: 12, fontWeight: 700 }}>
                  {aplicadaSeleccion ? 'Aplicada' : 'Borrador'}
                </Box>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 24, px: 1, borderRadius: 99, bgcolor: tokens.content.elevated, border: `1px solid ${tokens.content.border}`, fontSize: 12, fontWeight: 650 }}>
                  {polizaSeleccionada.tipo_poliza_identificador}
                </Box>
                <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>
                  Ejercicio {polizaSeleccionada.ejercicio} · {NOMBRES_MESES[polizaSeleccionada.periodo - 1]}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 1, md: 2 }, minHeight: 40, flexShrink: 0, gap: 0.5 }}>
              <Tooltip title={aplicadaSeleccion ? 'Póliza aplicada. Clic para desaplicar.' : 'Póliza no aplicada. Clic para aplicar.'}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={aplicadaSeleccion ? 'Desaplicar póliza' : 'Aplicar póliza'}
                    disabled={cambiandoEstatusId === polizaSeleccionada.id}
                    onClick={() => handleAplicarDesaplicar(polizaSeleccionada)}
                    sx={iconoDetalle(cambiandoEstatusId === polizaSeleccionada.id)}
                  >
                    {aplicadaSeleccion ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Editar póliza">
                <IconButton size="small" aria-label="Editar póliza" onClick={() => handleEditarPoliza(polizaSeleccionada.id)} sx={iconoDetalle(false)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={aplicadaSeleccion ? 'No se puede eliminar una póliza aplicada' : 'Eliminar póliza'}>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Eliminar póliza"
                    disabled={aplicadaSeleccion}
                    onClick={() => handlePedirEliminar(polizaSeleccionada)}
                    sx={iconoDetalle(aplicadaSeleccion)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="contained" startIcon={<AddIcon fontSize="small" />} onClick={handleNuevaPoliza} sx={(themeBtn) => ({ textTransform: 'none', fontWeight: 650, fontSize: 13, backgroundColor: themeBtn.emphasys.action.primary, color: themeBtn.emphasys.action.primaryForeground, boxShadow: 'none', '&:hover': { backgroundColor: themeBtn.emphasys.action.primaryHover, boxShadow: 'none' } })}>
                Nueva póliza
              </Button>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2.5 }, pb: 1.2, flexShrink: 0 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: compacto ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 0.8 }}>
                <Box sx={{ px: 1.3, py: 0.9, borderRadius: 2, bgcolor: tokens.metric.amount.background }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>CARGOS</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 650, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{formatMoneda(Number(polizaSeleccionada.total_cargos))}</Typography>
                </Box>
                <Box sx={{ px: 1.3, py: 0.9, borderRadius: 2, bgcolor: tokens.metric.applied.background }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>ABONOS</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 650, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: tokens.metric.applied.foreground }}>{formatMoneda(Number(polizaSeleccionada.total_abonos))}</Typography>
                </Box>
                <Box sx={{ px: 1.3, py: 0.9, borderRadius: 2, bgcolor: diferenciaSeleccion === 0 ? tokens.metric.available.background : tokens.metric.blocked.background }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>DIFERENCIA</Typography>
                  <Typography sx={(themeDif) => ({ fontSize: 18, fontWeight: 650, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', ...importeSx(themeDif, diferenciaSeleccion < 0) })}>{formatMoneda(diferenciaSeleccion)}</Typography>
                </Box>
                <Box sx={{ px: 1.3, py: 0.9, borderRadius: 2, bgcolor: tokens.content.elevated, border: `1px solid ${tokens.content.border}` }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>MOVIMIENTOS</Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 650, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{loadingMovimientos ? '…' : movimientos.length}</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mx: { xs: 1, md: 1.75 }, mb: { xs: 1, md: 1.5 }, bgcolor: tokens.content.well, borderRadius: 2, border: `1px solid ${tokens.content.border}`, overflow: 'hidden' }}>
              {errorMovimientos && (
                <Alert severity="error" onClose={() => setErrorMovimientos(null)} sx={{ py: 0, borderRadius: 0 }}>
                  {errorMovimientos}
                </Alert>
              )}
              <Box sx={{ flex: 1, minHeight: 160 }}>
                <DataGrid
                  rows={movimientos}
                  columns={columnasMovimientos}
                  rowHeight={30}
                  density="compact"
                  loading={loadingMovimientos}
                  disableRowSelectionOnClick
                  localeText={esES.components.MuiDataGrid.defaultProps.localeText}
                  columnVisibilityModel={movimientosColumnVisibility}
                  onColumnVisibilityModelChange={setMovimientosColumnVisibility}
                  onColumnWidthChange={(params: GridColumnResizeParams) => {
                    setMovimientosColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
                  }}
                  onColumnOrderChange={({ column, targetIndex }) => {
                    setMovimientosColumnOrder((prev) => {
                      const seed = prev.length ? prev : columnasMovimientosBase.map((c) => c.field);
                      const next = seed.filter((field) => field !== column.field);
                      next.splice(targetIndex, 0, column.field);
                      return next;
                    });
                  }}
                  sx={[standardDataGridSx, sinFocoDeCeldaSx, grillaCompactaSx, { height: '100%', border: 'none', '& .MuiDataGrid-row': { cursor: 'default' } }]}
                  slots={{
                    noRowsOverlay: () => (
                      <Stack height="100%" alignItems="center" justifyContent="center">
                        <Typography variant="body2" color="text.secondary">Esta póliza no tiene movimientos.</Typography>
                      </Stack>
                    ),
                  }}
                  hideFooterPagination
                  hideFooterSelectedRowCount
                />
              </Box>
              <Stack direction="row" alignItems="center" sx={barraTotalesSx}>
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right', pr: 1.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Totales</Typography>
                </Box>
                <Typography sx={{ width: 120, fontSize: 13, fontWeight: 700, textAlign: 'right', pr: 1.5, fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoneda(polizaSeleccionada.total_cargos)}
                </Typography>
                <Typography sx={{ width: 120, fontSize: 13, fontWeight: 700, textAlign: 'right', pr: 1.5, fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoneda(polizaSeleccionada.total_abonos)}
                </Typography>
              </Stack>
            </Box>
          </>
        )}
      </Box>
    </Box>
      {/* Barra flotante de acciones en lote (estilo YNAB): solo aparece con
          selección múltiple activa; independiente de polizaSeleccionadaId. */}
      {idsSeleccionMultiple.length > 0 && (
        <Paper elevation={8} sx={barraLoteSx}>
          <Tooltip title="Limpiar selección">
            <span>
              <IconButton size="small" onClick={handleLimpiarSeleccion} disabled={procesandoLote} sx={{ color: 'inherit' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Typography sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {idsSeleccionMultiple.length} póliza{idsSeleccionMultiple.length === 1 ? '' : 's'} seleccionada
            {idsSeleccionMultiple.length === 1 ? '' : 's'}
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 0.5 }} />

          <Button
            size="small"
            onClick={handleAplicarSeleccionadas}
            disabled={procesandoLote}
            startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            sx={{ color: 'inherit', textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Aplicar
          </Button>
          <Button
            size="small"
            onClick={handleDesaplicarSeleccionadas}
            disabled={procesandoLote}
            startIcon={<RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />}
            sx={{ color: 'inherit', textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Desaplicar
          </Button>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 0.5 }} />

          <Button
            size="small"
            onClick={handleAbrirMenuMas}
            disabled={procesandoLote}
            endIcon={<MoreHorizIcon sx={{ fontSize: 16 }} />}
            sx={{ color: 'inherit', textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Más
          </Button>
          <Menu
            anchorEl={menuMasAnchor}
            open={Boolean(menuMasAnchor)}
            onClose={handleCerrarMenuMas}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <MenuItem onClick={handlePedirAplicarTodas}>Aplicar todas las visibles</MenuItem>
            <MenuItem onClick={handlePedirDesaplicarTodas}>Desaplicar todas las visibles</MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleCerrarMenuMas(); handleLimpiarSeleccion(); }}>Limpiar selección</MenuItem>
          </Menu>
        </Paper>
      )}

      <Dialog open={Boolean(confirmacionLote)} onClose={handleCerrarConfirmacionLote} maxWidth="xs" fullWidth>
        <DialogTitle>
          {confirmacionLote === 'aplicar-todas' ? 'Aplicar todas las pólizas visibles' : 'Desaplicar todas las pólizas visibles'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmacionLote === 'aplicar-todas'
              ? '¿Aplicar todas las pólizas visibles? Solo se aplicarán las pólizas en borrador que cumplan las validaciones.'
              : '¿Desaplicar todas las pólizas visibles? Solo se desaplicarán las pólizas actualmente aplicadas.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCerrarConfirmacionLote} disabled={procesandoLote}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmarLoteTodas} disabled={procesandoLote} variant="contained" sx={botonPrimarioSx}>
            {procesandoLote ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(polizaAEliminar)} onClose={handleCerrarEliminar} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar póliza</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar esta póliza? También se eliminarán sus movimientos contables.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCerrarEliminar} disabled={eliminando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmarEliminar} disabled={eliminando} color="error" variant="contained">
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={polizaAplicadaBloqueada} onClose={() => setPolizaAplicadaBloqueada(false)} maxWidth="xs" fullWidth>
        <DialogTitle>No se puede eliminar</DialogTitle>
        <DialogContent>
          <DialogContentText>No se puede eliminar una póliza aplicada.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPolizaAplicadaBloqueada(false)} variant="contained" sx={botonPrimarioSx}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

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
    </>
  );
}
