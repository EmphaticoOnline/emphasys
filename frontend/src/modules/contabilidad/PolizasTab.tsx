import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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

// Verde institucional Emphasys (tomado del logo: el color del ícono/"sys").
const VERDE_EMPHASYS = '#006261';
const VERDE_EMPHASYS_OSCURO = '#004a49';

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

export default function PolizasTab() {
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
    columnVisibilityModel: polizasColumnVisibility,
    setColumnVisibilityModel: setPolizasColumnVisibility,
    columnOrder: polizasColumnOrder,
    setColumnOrder: setPolizasColumnOrder,
    applySavedWidthsToColumns: applyPolizasWidths,
    setColumnWidths: setPolizasColumnWidths,
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

  const columnasPolizasBase: GridColDef<PolizaEncabezado>[] = React.useMemo(() => [
    { field: 'numero', headerName: 'Póliza', width: 80, headerAlign: 'center', headerClassName: 'finanzas-header' },
    { field: 'tipo_poliza_identificador', headerName: 'Tipo', width: 110, headerAlign: 'center', headerClassName: 'finanzas-header' },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 110,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => formatFecha(value),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 130,
      align: 'right',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: (params) => {
        const aplicada = params.row.estatus === 'aplicada';
        const cambiando = cambiandoEstatusId === params.row.id;
        return (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" width="100%">
            <Tooltip title={aplicada ? 'Póliza aplicada. Clic para desaplicar.' : 'Póliza no aplicada. Clic para aplicar.'}>
              <span>
                <IconButton
                  size="small"
                  disabled={cambiando}
                  onClick={() => handleAplicarDesaplicar(params.row)}
                  sx={{ color: aplicada ? '#166534' : '#92400e', p: 0.25 }}
                >
                  {aplicada ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Editar póliza">
              <IconButton size="small" onClick={() => handleEditarPoliza(params.row.id)} sx={{ color: '#1d2f68', p: 0.25 }}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={aplicada ? 'No se puede eliminar una póliza aplicada' : 'Eliminar póliza'}>
              <span>
                <IconButton
                  size="small"
                  disabled={aplicada}
                  onClick={() => handlePedirEliminar(params.row)}
                  sx={{ color: '#b91c1c', p: 0.25 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        );
      },
    },
    {
      field: 'referencia',
      headerName: 'Referencia',
      flex: 1,
      minWidth: 90,
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
  ], [cambiandoEstatusId]);

  const columnasPolizasOrdenadas = React.useMemo(
    () => reordenarColumnas(columnasPolizasBase, polizasColumnOrder),
    [columnasPolizasBase, polizasColumnOrder]
  );
  const columnasPolizas = React.useMemo(
    () => applyPolizasWidths(columnasPolizasOrdenadas),
    [applyPolizasWidths, columnasPolizasOrdenadas]
  );

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, px: { xs: 1.5, md: 2 }, py: 1 }}>
      {/* Franja compacta de trabajo: filtros a la izquierda (alineados con la
          grilla de pólizas), acción principal a la derecha. */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <InputLabel id="ejercicio-polizas-label" sx={{ fontSize: 13 }}>Ejercicio</InputLabel>
          <Select
            labelId="ejercicio-polizas-label"
            label="Ejercicio"
            value={ejercicio ?? ''}
            onChange={(e) => setEjercicio(Number(e.target.value))}
            sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.5 } }}
          >
            {ejercicios.map((anio) => (
              <MenuItem key={anio} value={anio} sx={{ fontSize: 13 }}>
                {anio}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          placeholder="Buscar por número, tipo o referencia"
          size="small"
          value={buscarInput}
          onChange={(e) => setBuscarInput(e.target.value)}
          sx={{ minWidth: 220, maxWidth: 320, '& .MuiInputBase-input': { fontSize: 13, py: 0.65 } }}
        />

        <Tooltip title="Recargar">
          <IconButton size="small" onClick={() => void cargarPolizas()} sx={{ color: '#1d2f68' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleNuevaPoliza}
          sx={{ textTransform: 'none', fontSize: 12, py: 0.25, minHeight: 0, borderRadius: 1, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          Nueva póliza
        </Button>
      </Stack>

      {/* Navegación mensual como segmented control compacto, integrada a la
          franja de trabajo (reemplaza los Tabs grandes con indicador). */}
      <ToggleButtonGroup
        value={periodo}
        exclusive
        onChange={(_e, value) => value && setPeriodo(value)}
        size="small"
        sx={{
          alignSelf: 'flex-start',
          '& .MuiToggleButton-root': {
            height: 24,
            px: 0.9,
            py: 0,
            fontSize: 11,
            textTransform: 'none',
            border: '1px solid rgba(0, 98, 97, 0.18)',
            // No seleccionado: tono verdoso muy tenue (no blanco plano), con
            // hover ligeramente más marcado pero igual de sobrio.
            bgcolor: 'rgba(0, 98, 97, 0.06)',
            color: '#3f5c5b',
            '&:hover': { bgcolor: 'rgba(0, 98, 97, 0.14)' },
            '&.Mui-selected': {
              bgcolor: VERDE_EMPHASYS,
              color: '#ffffff',
              borderColor: VERDE_EMPHASYS,
              '&:hover': { bgcolor: VERDE_EMPHASYS_OSCURO },
            },
          },
        }}
      >
        {NOMBRES_MESES.map((nombre, index) => (
          <ToggleButton key={nombre} value={index + 1}>
            {nombre.slice(0, 3)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {errorPolizas && (
        <Alert severity="error" onClose={() => setErrorPolizas(null)} sx={{ py: 0 }}>
          {errorPolizas}
        </Alert>
      )}

      {/* Paneles operativos: pólizas + movimientos, misma altura, con scroll
          interno propio en vez de crecer con la página (sin aire muerto). */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1, height: 'calc(100vh - 250px)', minHeight: 360 }}>
        <Paper variant="outlined" sx={{ flex: '0 0 40%', minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 1, overflow: 'hidden' }}>
          <DataGrid
            rows={polizas}
            columns={columnasPolizas}
            getRowClassName={(params) => (params.id === polizaSeleccionadaId ? 'fila-seleccionada' : '')}
            onRowClick={(params) => setPolizaSeleccionadaId(Number(params.id))}
            onRowDoubleClick={(params) => handleEditarPoliza(Number(params.id))}
            rowHeight={30}
            density="compact"
            loading={loadingPolizas}
            checkboxSelection
            rowSelectionModel={seleccionMultiple}
            onRowSelectionModelChange={setSeleccionMultiple}
            disableRowSelectionOnClick
            localeText={esES.components.MuiDataGrid.defaultProps.localeText}
            sortModel={polizasSortModel as GridSortModel}
            onSortModelChange={setPolizasSortModel}
            columnVisibilityModel={polizasColumnVisibility}
            onColumnVisibilityModelChange={setPolizasColumnVisibility}
            onColumnWidthChange={(params: GridColumnResizeParams) => {
              setPolizasColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
            }}
            onColumnOrderChange={({ column, targetIndex }) => {
              setPolizasColumnOrder((prev) => {
                const seed = prev.length ? prev : columnasPolizasBase.map((c) => c.field);
                const next = seed.filter((field) => field !== column.field);
                next.splice(targetIndex, 0, column.field);
                return next;
              });
            }}
            sx={[
              standardDataGridSx,
              sinFocoDeCeldaSx,
              {
                height: '100%',
                border: 'none',
                fontSize: 12,
                '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
                '& .MuiDataGrid-row': { cursor: 'pointer' },
                // Especificidad reforzada (.MuiDataGrid-row + .fila-seleccionada)
                // más !important: la zebra de standardDataGridSx usa
                // ":nth-of-type(even)" con la misma especificidad que un simple
                // ".fila-seleccionada", así que en filas pares la zebra ganaba y
                // la selección se veía "perdida". Esto la hace ganar siempre.
                '& .MuiDataGrid-row.fila-seleccionada': { backgroundColor: '#dbeafe !important' },
                '& .MuiDataGrid-row.fila-seleccionada:hover': { backgroundColor: '#cfe0fb !important' },
              },
            ]}
            slots={{
              noRowsOverlay: () => (
                <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No hay pólizas para el periodo seleccionado.
                  </Typography>
                </Stack>
              ),
            }}
            hideFooterPagination
            hideFooterSelectedRowCount
          />
        </Paper>

        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 1, overflow: 'hidden' }}>
          {!polizaSeleccionada ? (
            <Stack height="100%" alignItems="center" justifyContent="center">
              <Typography variant="body2" color="text.secondary">
                Selecciona una póliza de la lista para ver sus movimientos.
              </Typography>
            </Stack>
          ) : (
            <>
              {errorMovimientos && (
                <Alert severity="error" onClose={() => setErrorMovimientos(null)} sx={{ py: 0 }}>
                  {errorMovimientos}
                </Alert>
              )}

              <Box sx={{ flex: 1, minHeight: 0 }}>
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
                  sx={[
                    standardDataGridSx,
                    sinFocoDeCeldaSx,
                    {
                      height: '100%',
                      border: 'none',
                      fontSize: 12,
                      '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
                    },
                  ]}
                  slots={{
                    noRowsOverlay: () => (
                      <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Esta póliza no tiene movimientos.
                        </Typography>
                      </Stack>
                    ),
                  }}
                  hideFooterPagination
                  hideFooterSelectedRowCount
                />
              </Box>

              {/* Totales alineados visualmente bajo Cargo/Abono: mismo ancho
                  de columna (120px) que las columnas homónimas de la grilla. */}
              <Stack
                direction="row"
                alignItems="center"
                sx={{ borderTop: '2px solid #e2e8f0', bgcolor: '#f8fafc', px: 1, py: 0.5 }}
              >
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right', pr: 1.5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Totales</Typography>
                </Box>
                <Typography sx={{ width: 120, fontSize: 12, fontWeight: 700, color: '#1e293b', textAlign: 'right', pr: 1.5 }}>
                  {formatMoneda(polizaSeleccionada.total_cargos)}
                </Typography>
                <Typography sx={{ width: 120, fontSize: 12, fontWeight: 700, color: '#1e293b', textAlign: 'right', pr: 1.5 }}>
                  {formatMoneda(polizaSeleccionada.total_abonos)}
                </Typography>
              </Stack>
            </>
          )}
        </Paper>
      </Box>

      {/* Barra flotante de acciones en lote (estilo YNAB): solo aparece con
          selección múltiple activa; independiente de polizaSeleccionadaId. */}
      {idsSeleccionMultiple.length > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: (theme) => theme.zIndex.snackbar,
            bgcolor: '#1d2f68',
            color: '#ffffff',
            borderRadius: 999,
            pl: 1,
            pr: 2,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Tooltip title="Limpiar selección">
            <span>
              <IconButton size="small" onClick={handleLimpiarSeleccion} disabled={procesandoLote} sx={{ color: '#ffffff' }}>
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
            sx={{ color: '#ffffff', textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Aplicar
          </Button>
          <Button
            size="small"
            onClick={handleDesaplicarSeleccionadas}
            disabled={procesandoLote}
            startIcon={<RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />}
            sx={{ color: '#ffffff', textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Desaplicar
          </Button>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 0.5 }} />

          <Button
            size="small"
            onClick={handleAbrirMenuMas}
            disabled={procesandoLote}
            endIcon={<MoreHorizIcon sx={{ fontSize: 16 }} />}
            sx={{ color: '#ffffff', textTransform: 'none', fontSize: 13, fontWeight: 600 }}
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
          <Button onClick={handleConfirmarLoteTodas} disabled={procesandoLote} variant="contained" sx={{ bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}>
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
          <Button onClick={() => setPolizaAplicadaBloqueada(false)} variant="contained" sx={{ bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}>
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
    </Box>
  );
}
