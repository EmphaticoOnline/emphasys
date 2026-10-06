import React from 'react';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Popover, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { standardDataGridSx } from '../../components/grids/standardDataGridSx';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { DataGrid, GridToolbarContainer, useGridApiRef } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridComparatorFn, GridRenderCellParams, GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import type { FinanzasCuenta, FinanzasOperacion } from '../../types/finanzas';
import { resolverFolioVisual } from '../../utils/documentos.utils';
import { useDeviceProfile } from '../../hooks/useDeviceProfile';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';
import { useGridPreferences } from '../../hooks/useGridPreferences';
import { abrirAdjuntoOperacion, eliminarAdjuntoOperacion, fetchAdjuntosOperacion, subirAdjuntoOperacion, type FinanzasAdjunto } from '../../services/finanzasService';
import {
  estadoMovimiento,
  siguienteEstadoCotejo,
  movimientoDuplicable,
  movimientoEliminable,
  movimientoMovible,
  netoSeleccion,
  todasCumplen,
} from './seleccionMovimientos';
import { origenMovimiento, referenciaCapturada } from './origenMovimiento';
import { etiquetaContraparteTransferencia } from './transferenciaLogica';
import {
  CampoConceptoCaptura,
  CampoContactoCaptura,
  CampoFechaCaptura,
  CampoMontoCaptura,
  CampoReferenciaCaptura,
  CAPTURA_FILA_ID,
  capturaPopupAbierto,
  movimientoEditableEnLinea,
  movimientoGeneralPendiente,
  movimientoOriginadoEnTesoreria,
  useCapturaMovimiento,
  type CapturaInline,
} from './FilaCapturaMovimiento';

export type FinanzasSearchToolbarProps = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
};

export function FinanzasSearchToolbar({ value, onChange, onClear }: FinanzasSearchToolbarProps) {
  return (
    <GridToolbarContainer sx={{ px: 2, py: 1, gap: 1, justifyContent: 'flex-end' }}>
      <TextField
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder="Buscar contacto, concepto, referencia o monto"
        size="small"
        onKeyDown={(event) => event.stopPropagation()}
        sx={{ minWidth: 320 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={onClear} aria-label="Limpiar búsqueda" disabled={!value}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </GridToolbarContainer>
  );
}

interface MovimientosTableProps {
  operaciones: FinanzasOperacion[];
  loading?: boolean;
  moneda?: string;
  onEdit?: (op: FinanzasOperacion) => void;
  onDelete?: (op: FinanzasOperacion) => void;
  onView?: (op: FinanzasOperacion) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  showToolbar?: boolean;
  omitirBusquedaInterna?: boolean;
  onEditTransferencia?: (op: FinanzasOperacion) => void;
  onDeleteTransferencia?: (op: FinanzasOperacion) => void;
  onEdicionAvanzada?: (op: FinanzasOperacion) => void;
  onAdjuntosActualizados?: () => void;
  cuentaId?: number | null;
  cuentas?: FinanzasCuenta[];
  captura?: CapturaInline | null;
  onCapturaGuardada?: () => Promise<void> | void;
  onCapturaCancelada?: () => void;
  onCapturaError?: (mensaje: string) => void;
  onSeleccionChange?: (filas: FinanzasOperacion[]) => void;
  onEliminarSeleccion?: (filas: FinanzasOperacion[]) => void;
  onDuplicarSeleccion?: (filas: FinanzasOperacion[]) => void;
  onMoverSeleccion?: (filas: FinanzasOperacion[]) => void;
  onMarcarSeleccion?: (filas: FinanzasOperacion[], estado: 'pendiente' | 'cotejado') => void;
  hayOtraCuenta?: boolean;
  mostrarCuenta?: boolean;
}

function fijarFilaCaptura<V>(base: (v1: V, v2: V) => number): GridComparatorFn<V> {
  return (v1, v2, celdaA, celdaB) => {
    const a = celdaA.id === CAPTURA_FILA_ID;
    const b = celdaB.id === CAPTURA_FILA_ID;
    if (a !== b) {
      const direccion = celdaA.api?.getSortModel?.()?.find((item: { field: string }) => item.field === celdaA.field)?.sort;
      const descendente = direccion === 'desc';
      if (a) return descendente ? 1 : -1;
      return descendente ? -1 : 1;
    }
    return base(v1, v2);
  };
}

const compararTexto = (a: unknown, b: unknown) =>
  String(a ?? '').localeCompare(String(b ?? ''), 'es', { sensitivity: 'base', numeric: true });

const compararNumero = (a: unknown, b: unknown) => (Number(a) || 0) - (Number(b) || 0);

const CAJA_ICONO = {
  boxSizing: 'border-box',
  width: 18,
  height: 18,
  minWidth: 18,
  minHeight: 18,
  p: 0,
  m: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  fontSize: 16,
  flex: '0 0 18px',
} as const;

const GLIFO_ICONO = {
  display: 'block',
  width: 16,
  height: 16,
  fontSize: 16,
  lineHeight: 1,
} as const;

const estadoPendiente = (row: { estado_conciliacion?: string | null }) =>
  String(row.estado_conciliacion || 'pendiente').toLowerCase() === 'pendiente';

type AnclaAdjuntos = HTMLElement | { top: number; left: number };

function formatDate(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, day] = value.slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function MovimientosTable({
  operaciones,
  loading,
  moneda = 'MXN',
  onEdit,
  onDelete,
  onEditTransferencia,
  onDeleteTransferencia,
  onEdicionAvanzada,
  onAdjuntosActualizados,
  onView,
  searchTerm,
  onSearchChange,
  showToolbar = true,
  omitirBusquedaInterna = false,
  cuentaId = null,
  cuentas = [],
  captura = null,
  onCapturaGuardada,
  onCapturaCancelada,
  onCapturaError,
  onSeleccionChange,
  onEliminarSeleccion,
  onDuplicarSeleccion,
  onMoverSeleccion,
  onMarcarSeleccion,
  hayOtraCuenta = false,
  mostrarCuenta = false,
}: MovimientosTableProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const apiRef = useGridApiRef();
  const focoCampoRef = React.useRef<string | null>(null);
  const anclaSeleccionRef = React.useRef<number | null>(null);
  const capturaStore = useCapturaMovimiento({
    captura,
    cuentaId,
    cuentas,
    tokens,
    focoCampoRef,
    onGuardada: onCapturaGuardada ?? (() => undefined),
    onCancelada: onCapturaCancelada ?? (() => undefined),
    onError: onCapturaError ?? (() => undefined),
  });
  const perfilDispositivo = useDeviceProfile();
  const navigate = useNavigate();

  type Row = FinanzasOperacion & {
    runningSaldo: number;
    fecha_fmt: string;
    concepto_display: string;
    contacto_display: string;
    referencia_display: string;
  };
  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 2,
      }),
    [moneda]
  );

  const [search, setSearch] = React.useState('');
  const [adjuntosAnchor, setAdjuntosAnchor] = React.useState<AnclaAdjuntos | null>(null);
  const [adjuntosOperacion, setAdjuntosOperacion] = React.useState<FinanzasOperacion | null>(null);
  const [adjuntosPopover, setAdjuntosPopover] = React.useState<FinanzasAdjunto[]>([]);
  const [adjuntosLoading, setAdjuntosLoading] = React.useState(false);
  const [adjuntosSubiendo, setAdjuntosSubiendo] = React.useState(false);
  const [adjuntosEliminandoId, setAdjuntosEliminandoId] = React.useState<number | null>(null);
  const [adjuntoPorConfirmar, setAdjuntoPorConfirmar] = React.useState<FinanzasAdjunto | null>(null);
  const [adjuntosError, setAdjuntosError] = React.useState<string | null>(null);
  const effectiveSearch = searchTerm ?? search;
  const handleSearchChange = onSearchChange ?? setSearch;

  const abrirAdjuntosEn = async (ancla: AnclaAdjuntos, row: Row) => {
    setAdjuntosAnchor(ancla);
    setAdjuntosOperacion(row);
    setAdjuntosPopover([]);
    setAdjuntosError(null);
    setAdjuntosEliminandoId(null);
    setAdjuntosLoading(true);
    try {
      setAdjuntosPopover(await fetchAdjuntosOperacion(row.id));
    } finally {
      setAdjuntosLoading(false);
    }
  };

  const abrirAdjuntos = async (event: React.MouseEvent<HTMLElement>, row: Row) => {
    event.stopPropagation();
    await abrirAdjuntosEn(event.currentTarget, row);
  };

  const agregarAdjuntos = async (lista: FileList | null) => {
    if (!adjuntosOperacion || !lista?.length) return;
    setAdjuntosSubiendo(true);
    setAdjuntosError(null);
    try {
      for (const archivo of Array.from(lista)) {
        await subirAdjuntoOperacion(adjuntosOperacion.id, archivo);
      }
      setAdjuntosPopover(await fetchAdjuntosOperacion(adjuntosOperacion.id));
      onAdjuntosActualizados?.();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo adjuntar el archivo';
      setAdjuntosError(mensaje);
    } finally {
      setAdjuntosSubiendo(false);
    }
  };

  const abrirArchivoDesdePopover = async (event: React.MouseEvent, adjunto: FinanzasAdjunto) => {
    event.stopPropagation();
    if (!adjuntosOperacion) return;
    try {
      await abrirAdjuntoOperacion(adjuntosOperacion.id, adjunto.id);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo abrir el adjunto';
      setAdjuntosError(mensaje);
    }
  };

  const quitarAdjunto = async (adjunto: FinanzasAdjunto) => {
    if (!adjuntosOperacion || adjuntosEliminandoId) return;
    setAdjuntoPorConfirmar(null);
    setAdjuntosEliminandoId(adjunto.id);
    setAdjuntosError(null);
    try {
      await eliminarAdjuntoOperacion(adjuntosOperacion.id, adjunto.id);
      setAdjuntosPopover(await fetchAdjuntosOperacion(adjuntosOperacion.id));
      onAdjuntosActualizados?.();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo quitar el adjunto';
      setAdjuntosError(mensaje);
    } finally {
      setAdjuntosEliminandoId(null);
    }
  };

  const defaultSort: GridSortModel = [{ field: 'fecha', sort: 'desc' }];
  const {
    loadingPreferences,
    sortModel,
    setSortModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    columnWidths,
    setColumnWidths,
    persistExternalFilters,
  } = useGridPreferences<{ searchTerm: string }>({
    pantalla: 'finanzas.movimientos',
    perfilDispositivo,
    defaultSortModel: defaultSort,
    defaultColumnVisibilityModel: {},
    defaultExternalFilters: { searchTerm: '' },
    onLoadExternalFilters: (value) => {
      if (onSearchChange) return;
      setSearch(String(value.searchTerm ?? ''));
    },
  });

  React.useEffect(() => {
    if (omitirBusquedaInterna) return;
    persistExternalFilters({ searchTerm: effectiveSearch });
  }, [persistExternalFilters, effectiveSearch, omitirBusquedaInterna]);

  const rows = React.useMemo(() => {
    const term = omitirBusquedaInterna ? '' : effectiveSearch.trim().toLowerCase();
    const base: Row[] = operaciones.map((op) => {
      const folioDocumentoOrigen = op.documento_origen_id && op.documento_origen_tipo_documento
        ? resolverFolioVisual(
            {
              serie: op.documento_origen_serie ?? null,
              numero: op.documento_origen_numero ?? null,
              serie_externa: op.documento_origen_serie_externa ?? null,
              numero_externo: op.documento_origen_numero_externo ?? null,
            },
            op.documento_origen_tipo_documento
          )
        : null;
      return {
        ...op,
        // saldo acumulado real de la cuenta, calculado en el backend en orden
        // cronológico (fecha, id) — no depende del orden de despliegue de la grilla.
        runningSaldo: op.saldo_acumulado ?? op.saldo ?? 0,
        fecha_fmt: formatDate(op.fecha),
        concepto_display: op.es_transferencia ? 'Transferencia' : op.concepto_nombre || '—',
        contacto_display: op.es_transferencia || op.transferencia_id
          ? etiquetaContraparteTransferencia(op)
          : op.contacto_nombre || '—',
        referencia_display: folioDocumentoOrigen || referenciaCapturada(op) || '—',
      };
    });
    if (!term) return base;
    return base.filter((op) =>
      [
        op.contacto_display,
        op.concepto_display,
        op.referencia_display,
        typeof op.monto === 'number' ? String(op.monto) : op.monto,
      ].some((field) => (field || '').toLowerCase().includes(term))
    );
  }, [operaciones, effectiveSearch, omitirBusquedaInterna]);

  const [seleccionIds, setSeleccionIds] = React.useState<GridRowSelectionModel>([]);
  React.useEffect(() => {
    const ids = new Set(rows.map((fila) => fila.id));
    setSeleccionIds((prev) => {
      const siguiente = prev.filter((id) => ids.has(Number(id)));
      return siguiente.length === prev.length ? prev : siguiente;
    });
  }, [rows]);
  const filasSeleccionadas = React.useMemo(() => {
    const ids = new Set(seleccionIds.map(Number));
    return rows.filter((fila) => ids.has(fila.id));
  }, [rows, seleccionIds]);
  React.useEffect(() => {
    onSeleccionChange?.(filasSeleccionadas);
  }, [filasSeleccionadas, onSeleccionChange]);

  const filasGrid = React.useMemo(() => {
    if (captura?.tipo !== 'nueva') return rows;
    const fila: Row = {
      id: CAPTURA_FILA_ID,
      fecha: '',
      tipo_movimiento: 'Deposito',
      monto: 0,
      cuenta_id: cuentaId ?? 0,
      runningSaldo: 0,
      fecha_fmt: '',
      concepto_display: '',
      contacto_display: '',
      referencia_display: '',
      estado_conciliacion: 'pendiente',
    };
    return [fila, ...rows];
  }, [captura, cuentaId, rows]);

  React.useEffect(() => {
    if (!captura) return;
    const salir = () => {
      capturaStore.getSnapshot()?.cancelar();
    };
    const alTecla = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.shiftKey || event.isComposing) return;
      if (capturaPopupAbierto()) return;
      event.preventDefault();
      event.stopPropagation();
      salir();
    };
    const alClickFuera = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const objetivo = event.target;
      if (!(objetivo instanceof Element)) return;
      if (objetivo.closest('.fila-captura, .captura-popup, .MuiAutocomplete-popper, .MuiPickersPopper-root, .MuiPickersLayout-root')) return;
      salir();
    };
    document.addEventListener('keydown', alTecla, true);
    document.addEventListener('mousedown', alClickFuera, true);
    return () => {
      document.removeEventListener('keydown', alTecla, true);
      document.removeEventListener('mousedown', alClickFuera, true);
    };
  }, [captura, capturaStore]);

  const idEdicionInline = captura?.tipo === 'edicion' ? captura.operacion.id : null;
  const esCapturaVisual = React.useCallback(
    (id: number) => id === CAPTURA_FILA_ID || id === idEdicionInline,
    [idEdicionInline],
  );

  const puedeEditarFila = React.useCallback((row: Row) => {
    if (row.id === CAPTURA_FILA_ID || !estadoPendiente(row)) return false;
    return Boolean(onEdit) && movimientoEditableEnLinea(row);
  }, [onEdit]);

  const puedeEliminarFila = React.useCallback((row: Row) => {
    if (row.id === CAPTURA_FILA_ID || !estadoPendiente(row)) return false;
    if (row.es_transferencia) return Boolean(onDeleteTransferencia ?? onDelete);
    return Boolean(onDelete);
  }, [onDelete, onDeleteTransferencia]);

  const handleEditRow = React.useCallback(
    (row: Row, campo?: string) => {
      if (!onEdit) return;
      focoCampoRef.current = campo === 'referencia' ? 'referencia' : null;
      onEdit(row);
    },
    [onEdit]
  );

  const handleDeleteRow = React.useCallback(
    (row: Row) => {
      if (!onDelete) return;

      if (row.es_transferencia && onDeleteTransferencia) {
        onDeleteTransferencia(row);
        return;
      }

      onDelete(row);
    },
    [onDelete, onDeleteTransferencia]
  );

  const canViewRowDetail = React.useCallback(
    (row: Row) => Boolean(onView) && row.naturaleza_operacion === 'cobro_cliente',
    [onView]
  );

  const handleViewRow = React.useCallback(
    (row: Row) => {
      if (!canViewRowDetail(row) || !onView) return;
      onView(row);
    },
    [canViewRowDetail, onView]
  );

  const abrirDetalle = React.useCallback((row: Row) => {
    if (row.id === CAPTURA_FILA_ID) return;
    if (!movimientoOriginadoEnTesoreria(row)) {
      onView?.(row);
      return;
    }
    if (canViewRowDetail(row)) {
      handleViewRow(row);
      return;
    }
    if (onEdicionAvanzada) {
      onEdicionAvanzada(row);
      return;
    }
    onEdit?.(row);
  }, [canViewRowDetail, handleViewRow, onEdit, onEdicionAvanzada, onView]);

  const tituloDetalle = (row: Row) => {
    if (!movimientoOriginadoEnTesoreria(row) || row.naturaleza_operacion === 'cobro_cliente') return 'Ver detalle';
    return 'Edición avanzada';
  };

  const renderEstado = (row: Row, enCaptura = false) => {
    const value = row.estado_conciliacion || 'pendiente';
    const cerrado = value === 'conciliado';
    const cotejado = value === 'cotejado';
    const siguiente = enCaptura ? null : siguienteEstadoCotejo(value);
    const titulo = cerrado
      ? 'Conciliado'
      : cotejado
        ? 'Encontrado en banco. Clic para volver a pendiente'
        : 'Pendiente. Clic para marcar encontrado en banco';
    const colorIcono = enCaptura
      ? tokens.action.primaryForeground
      : cerrado
        ? tokens.content.secondary
        : cotejado
          ? tokens.metric.exhausted.foreground
          : tokens.content.muted;
    const icono = cerrado
      ? <LockIcon sx={{ ...GLIFO_ICONO, color: colorIcono }} />
      : cotejado
        ? <CheckCircleIcon sx={{ ...GLIFO_ICONO, color: colorIcono }} />
        : <RadioButtonUncheckedIcon sx={{ ...GLIFO_ICONO, color: colorIcono }} />;
    return (
      <Tooltip title={titulo} placement="top" arrow>
        <Box
          component="button"
          type="button"
          aria-label={titulo}
          disabled={!siguiente}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (!siguiente) return;
            onMarcarSeleccion?.([row], siguiente);
          }}
          sx={{
            ...CAJA_ICONO,
            border: 0,
            bgcolor: 'transparent',
            cursor: siguiente ? 'pointer' : 'default',
            '&:disabled': { cursor: 'default' },
          }}
        >
          {icono}
        </Box>
      </Tooltip>
    );
  };

  const columns = React.useMemo<GridColDef<Row>[]>(
    () => {
      const columnas: GridColDef<Row>[] = [
      ...(mostrarCuenta ? [{
        field: 'cuenta_display',
        headerName: 'Cuenta',
        width: 160,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        valueGetter: (_value: unknown, row: Row) => cuentas.find((cuenta) => cuenta.id === row.cuenta_id)?.identificador || `Cuenta ${row.cuenta_id}`,
        renderCell: (params: GridRenderCellParams<Row>) => <Typography noWrap sx={{ fontSize: 12.5 }}>{params.value || '—'}</Typography>,
      }] : []),
      {
        field: 'fecha',
        headerName: 'Fecha',
        width: columnWidths.fecha ?? 118,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        sortComparator: fijarFilaCaptura(compararTexto),
        renderCell: (params: GridRenderCellParams<Row>) => {
          if (esCapturaVisual(params.row.id)) return <CampoFechaCaptura store={capturaStore} />;
          return <Typography sx={{ fontSize: 12.5 }}>{formatDate(params.row.fecha)}</Typography>;
        },
      },
      {
        field: 'contacto_display',
        headerName: 'Contacto',
        width: columnWidths.contacto_display ?? 180,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        sortComparator: fijarFilaCaptura(compararTexto),
        renderCell: (params: GridRenderCellParams<Row>) => {
          if (esCapturaVisual(params.row.id)) return <CampoContactoCaptura store={capturaStore} />;
          return (
            <Typography noWrap sx={{ fontSize: 12.5, color: tokens.content.foreground }}>
              {params.value || '—'}
            </Typography>
          );
        },
      },
      {
        field: 'concepto_display',
        headerName: 'Concepto',
  flex: 1,
  minWidth: 140,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        sortComparator: fijarFilaCaptura(compararTexto),
        renderCell: (params: GridRenderCellParams<Row>) => {
          if (esCapturaVisual(params.row.id)) return <CampoConceptoCaptura store={capturaStore} />;
          return (
            <Tooltip title={params.row.observaciones || ''} placement="top" arrow disableHoverListener={!params.row.observaciones}>
              <Typography noWrap sx={{ fontSize: 12.5, color: tokens.content.foreground }}>
                {params.value || '—'}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: 'referencia',
        headerName: 'Referencia',
        width: columnWidths.referencia_display ?? 120,
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        sortComparator: fijarFilaCaptura(compararTexto),
        renderCell: (params: GridRenderCellParams<Row>) => {
          if (esCapturaVisual(params.row.id)) return <CampoReferenciaCaptura store={capturaStore} />;
          return (
            <Typography noWrap sx={{ fontSize: 12.5, color: tokens.content.secondary }}>
              {params.row.referencia_display || '—'}
            </Typography>
          );
        },
      },
      {
        field: 'salida',
        headerName: 'Retiro',
        width: columnWidths.salida ?? 112,
        align: 'right',
        headerAlign: 'right',
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        valueGetter: (_value, row) => (
          row.id === CAPTURA_FILA_ID || row.tipo_movimiento !== 'Retiro' ? 0 : Math.abs(Number(row.monto) || 0)
        ),
        sortComparator: fijarFilaCaptura(compararNumero),
        renderCell: (params: GridRenderCellParams<Row>) => {
          if (esCapturaVisual(params.row.id)) return <CampoMontoCaptura store={capturaStore} lado="salida" />;
          const monto = Math.abs(Number(params.row.monto) || 0);
          if (params.row.tipo_movimiento !== 'Retiro' || monto <= 0) return null;
          return (
            <Typography noWrap sx={{ width: '100%', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: tokens.action.destructive }}>
              {formatter.format(monto)}
            </Typography>
          );
        },
      },
      {
        field: 'ingreso',
        headerName: 'Depósito',
        width: columnWidths.ingreso ?? 112,
        align: 'right',
        headerAlign: 'right',
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        valueGetter: (_value, row) => (
          row.id === CAPTURA_FILA_ID || row.tipo_movimiento !== 'Deposito' ? 0 : Math.abs(Number(row.monto) || 0)
        ),
        sortComparator: fijarFilaCaptura(compararNumero),
        renderCell: (params: GridRenderCellParams<Row>) => {
          if (esCapturaVisual(params.row.id)) return <CampoMontoCaptura store={capturaStore} lado="ingreso" />;
          const monto = Math.abs(Number(params.row.monto) || 0);
          if (params.row.tipo_movimiento !== 'Deposito' || monto <= 0) return null;
          return (
            <Typography noWrap sx={{ width: '100%', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: tokens.metric.applied.foreground }}>
              {formatter.format(monto)}
            </Typography>
          );
        },
      },
      {
        field: 'acciones_fila',
        headerName: '',
        width: 88,
        minWidth: 88,
        maxWidth: 88,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        disableReorder: true,
        align: 'center',
        headerAlign: 'center',
        cellClassName: 'acciones-fila',
        headerClassName: 'finanzas-header',
        renderCell: (params: GridRenderCellParams<Row>) => {
          const enCaptura = esCapturaVisual(params.row.id);
          const cantidad = Number(params.row.adjuntos_count) || 0;
          const conAdjuntos = cantidad > 0;
          const tituloAdjuntos = conAdjuntos
            ? `Ver adjuntos (${cantidad})`
            : 'Agregar adjunto';
          const origen = enCaptura ? null : origenMovimiento(params.row);
          return (
            <Box
              data-accion-fila=""
              onDoubleClick={(event) => event.stopPropagation()}
              sx={{ display: 'flex', alignItems: 'center', gap: '4px', width: 84, flex: '0 0 84px' }}
            >
              {enCaptura ? null : renderEstado(params.row, false)}
              {enCaptura ? <Box sx={CAJA_ICONO} /> : (
                <Tooltip title={tituloDetalle(params.row)} placement="top" arrow>
                  <IconButton
                    size="small"
                    aria-label={tituloDetalle(params.row)}
                    onClick={(event) => {
                      event.stopPropagation();
                      abrirDetalle(params.row);
                    }}
                    sx={{ ...CAJA_ICONO, color: tokens.content.secondary }}
                  >
                    <VisibilityOutlinedIcon sx={GLIFO_ICONO} />
                  </IconButton>
                </Tooltip>
              )}
              {enCaptura ? <Box sx={CAJA_ICONO} /> : (
                <Tooltip title={tituloAdjuntos} placement="top" arrow>
                  <IconButton
                    size="small"
                    aria-label={tituloAdjuntos}
                    onClick={(event) => void abrirAdjuntos(event, params.row)}
                    sx={{ ...CAJA_ICONO, position: 'relative', color: conAdjuntos ? tokens.action.primary : tokens.content.muted }}
                  >
                    {conAdjuntos
                      ? <AttachFileIcon sx={GLIFO_ICONO} />
                      : <AttachFileOutlinedIcon sx={GLIFO_ICONO} />}
                    {conAdjuntos && (
                      <Box
                        component="span"
                        sx={{
                          position: 'absolute',
                          top: -5,
                          right: -6,
                          pointerEvents: 'none',
                          fontSize: 9,
                          fontWeight: 700,
                          lineHeight: 1,
                          height: 14,
                          minWidth: 14,
                          px: '3px',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: tokens.action.primary,
                          color: tokens.action.primaryForeground,
                        }}
                      >
                        {cantidad}
                      </Box>
                    )}
                  </IconButton>
                </Tooltip>
              )}
              {!origen ? <Box sx={CAJA_ICONO} /> : (
                <Tooltip title={origen.titulo} placement="top" arrow>
                  {origen.ruta ? (
                    <IconButton
                      size="small"
                      aria-label={origen.titulo}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(origen.ruta!);
                      }}
                      sx={{ ...CAJA_ICONO, color: tokens.action.primary }}
                    >
                      <SourceOutlinedIcon sx={GLIFO_ICONO} />
                    </IconButton>
                  ) : (
                    <Box component="span" aria-label={origen.titulo} sx={{ ...CAJA_ICONO, color: tokens.action.primary }}>
                      <SourceOutlinedIcon sx={GLIFO_ICONO} />
                    </Box>
                  )}
                </Tooltip>
              )}
            </Box>
          );
        },
      },
      {
        field: 'runningSaldo',
        headerName: 'Saldo',
        width: columnWidths.runningSaldo ?? 130,
        align: 'right',
        headerAlign: 'right',
        sortable: true,
        filterable: true,
        headerClassName: 'finanzas-header',
        sortComparator: fijarFilaCaptura(compararNumero),
        renderCell: (params: GridRenderCellParams<Row, number>) => {
          if (params.row.id === CAPTURA_FILA_ID) return null;
          const saldo = Number(params.value ?? 0);
          const colorSaldo = esCapturaVisual(params.row.id)
            ? tokens.action.primaryForeground
            : saldo > 0
              ? tokens.metric.applied.foreground
              : saldo < 0
                ? tokens.action.destructive
                : tokens.action.primary;
          return (
            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, color: colorSaldo }}>
              {formatter.format(saldo)}
            </Typography>
          );
        },
      },
      ];
      return columnas;
    },
    [abrirDetalle, capturaStore, columnWidths, cuentas, esCapturaVisual, formatter, mostrarCuenta, navigate, renderEstado, tokens.action.destructive, tokens.action.primary, tokens.action.primaryForeground, tokens.content.foreground, tokens.content.muted, tokens.content.secondary, tokens.metric.applied.foreground]
  );

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    rowSlotProps,
  } = useGridContextMenu(filasGrid);

  const detalleDuplicaEditar = React.useCallback((row: Row) => {
    if (!puedeEditarFila(row)) return false;
    if (row.naturaleza_operacion === 'cobro_cliente') return false;
    if (row.es_transferencia || row.transferencia_id) return false;
    return !movimientoGeneralPendiente(row);
  }, [puedeEditarFila]);

  const contextMenuActions = React.useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow || contextMenuRow.id === CAPTURA_FILA_ID) return [];
    const enBloque = filasSeleccionadas.length > 1 && filasSeleccionadas.some((fila) => fila.id === contextMenuRow.id);
    const filas = enBloque ? filasSeleccionadas : [contextMenuRow];
    const una = filas.length === 1 ? filas[0] : null;
    const cantidad = Number(una?.adjuntos_count) || 0;
    const posicion = contextMenuPosition;
    const puedeEliminar = todasCumplen(filas, movimientoEliminable);
    const puedeDuplicar = todasCumplen(filas, movimientoDuplicable);
    const puedeMover = hayOtraCuenta && todasCumplen(filas, movimientoMovible);
    const puedeCotejar = todasCumplen(filas, (fila) => siguienteEstadoCotejo(fila.estado_conciliacion) === 'cotejado');
    const puedePendiente = todasCumplen(filas, (fila) => siguienteEstadoCotejo(fila.estado_conciliacion) === 'pendiente');
    return [
      {
        id: 'editar',
        label: 'Editar',
        icon: <EditOutlinedIcon sx={{ fontSize: 16 }} />,
        hidden: !una || !puedeEditarFila(una),
        onClick: () => una && handleEditRow(una),
      },
      {
        id: 'detalle',
        label: 'Ver detalle',
        icon: <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />,
        hidden: !una || detalleDuplicaEditar(una),
        onClick: () => una && abrirDetalle(una),
      },
      {
        id: 'adjuntos',
        label: cantidad > 0 ? `Ver / agregar adjuntos (${cantidad})` : 'Ver / agregar adjuntos',
        icon: <AttachFileOutlinedIcon sx={{ fontSize: 16 }} />,
        hidden: !una,
        onClick: () => {
          if (!una || !posicion) return;
          void abrirAdjuntosEn(posicion, una);
        },
      },
      {
        id: 'eliminar',
        label: filas.length > 1 ? `Eliminar (${filas.length})` : 'Eliminar',
        icon: <DeleteOutlineIcon sx={{ fontSize: 16 }} />,
        hidden: !puedeEliminar,
        destructive: true,
        onClick: () => (filas.length > 1 ? onEliminarSeleccion?.(filas) : handleDeleteRow(filas[0])),
      },
      {
        id: 'duplicar',
        label: filas.length > 1 ? `Duplicar (${filas.length})` : 'Duplicar',
        icon: <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />,
        hidden: !puedeDuplicar,
        onClick: () => onDuplicarSeleccion?.(filas),
      },
      {
        id: 'mover',
        label: 'Mover a otra cuenta',
        icon: <DriveFileMoveOutlinedIcon sx={{ fontSize: 16 }} />,
        hidden: !puedeMover,
        onClick: () => onMoverSeleccion?.(filas),
      },
      {
        id: 'cotejar',
        label: 'Marcar encontrado en banco',
        icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
        hidden: !puedeCotejar,
        onClick: () => onMarcarSeleccion?.(filas, 'cotejado'),
      },
      {
        id: 'pendiente',
        label: 'Marcar pendiente',
        icon: <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />,
        hidden: !puedePendiente,
        onClick: () => onMarcarSeleccion?.(filas, 'pendiente'),
      },
    ];
  }, [abrirDetalle, contextMenuPosition, contextMenuRow, detalleDuplicaEditar, filasSeleccionadas, handleDeleteRow, handleEditRow, hayOtraCuenta, onDuplicarSeleccion, onEliminarSeleccion, onMarcarSeleccion, onMoverSeleccion, puedeEditarFila]);

  const netoBarra = netoSeleccion(filasSeleccionadas);
  const puedeEliminarBarra = todasCumplen(filasSeleccionadas, movimientoEliminable);
  const puedeDuplicarBarra = todasCumplen(filasSeleccionadas, movimientoDuplicable);
  const puedeMoverBarra = hayOtraCuenta && todasCumplen(filasSeleccionadas, movimientoMovible);
  const puedeCotejarBarra = todasCumplen(filasSeleccionadas, (fila) => siguienteEstadoCotejo(fila.estado_conciliacion) === 'cotejado');
  const puedePendienteBarra = todasCumplen(filasSeleccionadas, (fila) => siguienteEstadoCotejo(fila.estado_conciliacion) === 'pendiente');
  const textoSeleccion = filasSeleccionadas.length === 1
    ? '1 movimiento seleccionado'
    : `${filasSeleccionadas.length} movimientos seleccionados`;

  const idsEnOrdenVisual = React.useCallback(() => {
    const crudos = apiRef.current?.getSortedRowIds?.() ?? rows.map((fila) => fila.id);
    return crudos.map(Number).filter((id) => id !== CAPTURA_FILA_ID && Number.isFinite(id));
  }, [apiRef, rows]);

  const seleccionarFila = React.useCallback((id: number, rango: boolean) => {
    if (id === CAPTURA_FILA_ID) return;
    const ancla = anclaSeleccionRef.current;
    if (rango && ancla != null) {
      const orden = idsEnOrdenVisual();
      const desde = orden.indexOf(ancla);
      const hasta = orden.indexOf(id);
      if (desde >= 0 && hasta >= 0) {
        const [inicio, fin] = desde < hasta ? [desde, hasta] : [hasta, desde];
        setSeleccionIds(orden.slice(inicio, fin + 1));
        return;
      }
    }
    anclaSeleccionRef.current = id;
    setSeleccionIds([id]);
  }, [idsEnOrdenVisual]);

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', bgcolor: tokens.content.well }}>
      <DataGrid<Row>
    apiRef={apiRef}
    rows={filasGrid}
    columns={columns}
  density="compact"
  getRowHeight={(params) => (esCapturaVisual(params.id as number) ? 42 : 32)}
  getRowClassName={(params) => (esCapturaVisual(params.id as number) ? 'fila-captura' : '')}
  columnHeaderHeight={32}
  columnBufferPx={2}
        loading={!!loading || loadingPreferences}
        sortModel={sortModel}
        onSortModelChange={(model) => setSortModel(model.length ? model : defaultSort)}
        localeText={esES.components.MuiDataGrid.defaultProps.localeText}
        hideFooterPagination
        checkboxSelection
        disableRowSelectionOnClick
        isRowSelectable={(params) => params.id !== CAPTURA_FILA_ID}
        rowSelectionModel={seleccionIds}
        onRowSelectionModelChange={(modelo) => {
          setSeleccionIds(modelo.filter((id) => Number(id) !== CAPTURA_FILA_ID));
        }}
        columnVisibilityModel={{ ...columnVisibilityModel, menu: false, adjuntos: false, acciones: false, estado_conciliacion: false, acciones_fila: true }}
        onColumnVisibilityModelChange={(model) => {
          setColumnVisibilityModel({ ...model, menu: false, adjuntos: false, acciones: false, estado_conciliacion: false, acciones_fila: true });
        }}
        onCellClick={(params, event) => {
          if (esCapturaVisual(params.row.id) || params.field === '__check__') return;
          const objetivo = event.target instanceof Element ? event.target : null;
          if (objetivo?.closest('[data-accion-fila], button, a, input, textarea, select, [role="checkbox"], .MuiCheckbox-root')) return;
          seleccionarFila(params.row.id, event.shiftKey);
        }}
        onCellDoubleClick={(params, event) => {
          const objetivo = event.target as HTMLElement | null;
          if (objetivo?.closest('[data-accion-fila]')) return;
          if (esCapturaVisual(params.row.id)) return;
          if (!movimientoEditableEnLinea(params.row)) return;
          handleEditRow(params.row, params.field);
        }}
        onCellKeyDown={(params, event) => {
          if (esCapturaVisual(params.row.id)) return;
          if (event.key !== 'Delete' && event.key !== 'Backspace') return;
          const objetivo = event.target as HTMLElement | null;
          if (objetivo?.closest('input, textarea, [contenteditable="true"]')) return;
          const enSeleccion = filasSeleccionadas.some((fila) => fila.id === params.row.id);
          const filasObjetivo = enSeleccion && filasSeleccionadas.length > 1 ? filasSeleccionadas : [params.row];
          if (!todasCumplen(filasObjetivo, (fila) => puedeEliminarFila(fila))) return;
          event.preventDefault();
          event.defaultMuiPrevented = true;
          if (filasObjetivo.length > 1) onEliminarSeleccion?.(filasObjetivo);
          else handleDeleteRow(filasObjetivo[0]);
        }}
        slotProps={{
          row: {
            onContextMenuCapture: (event) => {
              const rowId = event.currentTarget.getAttribute('data-id');
              if (!rowId || rowId === String(CAPTURA_FILA_ID)) {
                event.preventDefault();
                return;
              }
              rowSlotProps?.onContextMenuCapture(event);
            },
          },
        }}
        onColumnWidthChange={(params) => {
          if (!params.colDef?.field || typeof params.width !== 'number') return;
          setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
        }}
        slots={
          showToolbar
            ? {
                toolbar: ((props) => (
                  <FinanzasSearchToolbar
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    {...props}
                    value={effectiveSearch}
                    onChange={(v: string) => handleSearchChange(v)}
                    onClear={() => handleSearchChange('')}
                  />
                )) as React.ComponentType,
              }
            : {}
        }
        sx={[
          standardDataGridSx(theme),
          {
            height: '100%',
            border: 'none',
            fontSize: 12.5,
            '--DataGrid-overlayHeight': '200px',
            bgcolor: tokens.content.well,
            '& .MuiDataGrid-cell': { fontSize: 12.5, py: 0 },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
              outline: 'none !important',
            },
            '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeadersInner': {
              minHeight: '32px !important',
              maxHeight: '32px !important',
            },
            '& .MuiDataGrid-columnHeader': {
              height: '32px !important',
              minHeight: '32px !important',
              maxHeight: '32px !important',
            },
            '& .MuiDataGrid-columnHeaderTitle': { fontSize: 11 },
            '& .MuiDataGrid-row.fila-captura, & .MuiDataGrid-row.fila-captura:hover, & .MuiDataGrid-row.fila-captura.Mui-selected, & .MuiDataGrid-row.fila-captura.Mui-selected:hover': {
              backgroundColor: `${tokens.action.primary} !important`,
              background: `${tokens.action.primary} !important`,
            },
            '& .MuiDataGrid-cell.acciones-fila': { px: '2px', overflow: 'visible' },
            '& .fila-captura .MuiDataGrid-cell, & .fila-captura:hover .MuiDataGrid-cell, & .fila-captura.Mui-selected .MuiDataGrid-cell': {
              backgroundColor: `${tokens.action.primary} !important`,
              background: `${tokens.action.primary} !important`,
              alignItems: 'center',
              py: 0,
              lineHeight: 'normal',
              overflow: 'visible',
            },
            '& .MuiDataGrid-row.Mui-selected, & .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: `${tokens.grid.selected} !important`,
              boxShadow: `inset 3px 0 0 ${tokens.action.primary}`,
            },
            '& .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: `${tokens.grid.selectedHover} !important`,
            },
            '& .fila-captura .MuiDataGrid-cellCheckbox': { visibility: 'hidden', pointerEvents: 'none' },
            '& .MuiDataGrid-cellCheckbox .MuiCheckbox-root, & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root': {
              color: tokens.content.muted,
              p: 0.25,
            },
            '& .MuiDataGrid-cellCheckbox .Mui-checked, & .MuiDataGrid-columnHeaderCheckbox .Mui-checked, & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-indeterminate': {
              color: tokens.action.primary,
            },
            '& .MuiDataGrid-virtualScroller': { pb: filasSeleccionadas.length ? '56px' : 0 },
            '& .MuiDataGrid-columnSeparator': {
              height: '100%',
              color: 'rgba(244, 240, 232, 0.55)',
              '& svg': { height: 22 },
            },
          },
        ]}
        getRowId={(row) => row.id}
      />

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuRow && contextMenuPosition)}
        onClose={closeContextMenu}
      />

      <Popover
        open={Boolean(adjuntosAnchor)}
        {...(adjuntosAnchor instanceof HTMLElement
          ? { anchorEl: adjuntosAnchor, anchorOrigin: { vertical: 'bottom' as const, horizontal: 'left' as const } }
          : { anchorReference: 'anchorPosition' as const, anchorPosition: adjuntosAnchor ?? undefined })}
        onClose={() => { setAdjuntosAnchor(null); setAdjuntosOperacion(null); }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 0.5,
              minWidth: 280,
              maxWidth: 360,
              p: 1.25,
              borderRadius: 2,
              bgcolor: tokens.content.elevated,
              border: `1px solid ${tokens.content.border}`,
              boxShadow: `0 12px 28px color-mix(in srgb, ${tokens.action.primary} 16%, transparent)`,
            },
          },
        }}
      >
        <Stack spacing={0.75}>
          <Typography sx={{ px: 0.5, fontSize: 12, fontWeight: 700, letterSpacing: 0.2, color: tokens.content.foreground }}>
            Adjuntos
          </Typography>
          {adjuntosLoading ? <CircularProgress size={16} sx={{ m: 1, color: tokens.action.primary }} /> : (
            adjuntosPopover.length ? (
              <Stack spacing={0.5}>
                {adjuntosPopover.map((adjunto) => (
                  <Stack
                    key={adjunto.id}
                    direction="row"
                    alignItems="center"
                    spacing={0.25}
                    sx={{
                      pl: 1,
                      pr: 0.25,
                      py: 0.25,
                      borderRadius: 1.5,
                      bgcolor: tokens.action.primary,
                      border: `1px solid color-mix(in srgb, ${tokens.action.primaryForeground} 28%, transparent)`,
                      boxShadow: `0 8px 18px color-mix(in srgb, ${tokens.action.primary} 18%, transparent)`,
                    }}
                  >
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: tokens.action.primaryForeground }}>
                      {adjunto.nombre_original}
                    </Typography>
                    <Tooltip title="Abrir" placement="top" arrow>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Abrir ${adjunto.nombre_original}`}
                          onClick={(event) => void abrirArchivoDesdePopover(event, adjunto)}
                          sx={{
                            p: 0.5,
                            color: tokens.action.primaryForeground,
                            '&:hover': { bgcolor: `color-mix(in srgb, ${tokens.action.primaryForeground} 14%, transparent)` },
                          }}
                        >
                          <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Quitar adjunto" placement="top" arrow>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Quitar ${adjunto.nombre_original}`}
                          disabled={adjuntosEliminandoId === adjunto.id}
                          onClick={() => setAdjuntoPorConfirmar(adjunto)}
                          sx={{
                            p: 0.5,
                            color: tokens.action.primaryForeground,
                            '&:hover': { bgcolor: `color-mix(in srgb, ${tokens.action.primaryForeground} 14%, transparent)` },
                          }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ px: 0.5, py: 0.5, fontSize: 12.5, color: tokens.content.secondary }}>
                Sin adjuntos
              </Typography>
            )
          )}
          {adjuntosError && (
            <Typography sx={{ px: 0.5, fontSize: 12, color: tokens.action.destructive }}>{adjuntosError}</Typography>
          )}
          <Button
            component="label"
            size="small"
            startIcon={<AttachFileOutlinedIcon sx={{ fontSize: 16 }} />}
            disabled={adjuntosSubiendo || !adjuntosOperacion}
            sx={{
              alignSelf: 'stretch',
              textTransform: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              color: tokens.action.primaryForeground,
              borderColor: `color-mix(in srgb, ${tokens.action.primaryForeground} 28%, transparent)`,
              bgcolor: tokens.action.primary,
              boxShadow: `0 8px 18px color-mix(in srgb, ${tokens.action.primary} 18%, transparent)`,
              '&:hover': {
                bgcolor: tokens.action.primaryHover,
                borderColor: `color-mix(in srgb, ${tokens.action.primaryForeground} 40%, transparent)`,
              },
              '&.Mui-disabled': { color: tokens.action.primaryForeground, opacity: 0.55 },
            }}
            variant="outlined"
          >
            {adjuntosSubiendo ? 'Adjuntando...' : 'Agregar adjunto'}
            <input
              hidden
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => {
                void agregarAdjuntos(event.target.files);
                event.target.value = '';
              }}
            />
          </Button>
        </Stack>
      </Popover>
      {filasSeleccionadas.length > 0 && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            zIndex: 4,
            maxWidth: 'calc(100% - 24px)',
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: tokens.action.primary,
            color: tokens.action.primaryForeground,
            boxShadow: `0 12px 28px color-mix(in srgb, ${tokens.action.primary} 28%, transparent)`,
            overflow: 'auto',
          }}
        >
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 650, px: 0.5 }}>
            {textoSeleccion}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, opacity: 0.9, px: 0.5 }}>
            {formatter.format(netoBarra)}
          </Typography>
          {puedeEliminarBarra && (
            <Tooltip title="Eliminar" placement="top" arrow>
              <IconButton size="small" aria-label="Eliminar" onClick={() => onEliminarSeleccion?.(filasSeleccionadas)} sx={{ color: 'inherit' }}>
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {puedeDuplicarBarra && (
            <Tooltip title="Duplicar" placement="top" arrow>
              <IconButton size="small" aria-label="Duplicar" onClick={() => onDuplicarSeleccion?.(filasSeleccionadas)} sx={{ color: 'inherit' }}>
                <ContentCopyOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {puedeMoverBarra && (
            <Tooltip title="Mover a otra cuenta" placement="top" arrow>
              <IconButton size="small" aria-label="Mover a otra cuenta" onClick={() => onMoverSeleccion?.(filasSeleccionadas)} sx={{ color: 'inherit' }}>
                <DriveFileMoveOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {puedeCotejarBarra && (
            <Tooltip title="Marcar encontrado en banco" placement="top" arrow>
              <IconButton size="small" aria-label="Marcar encontrado en banco" onClick={() => onMarcarSeleccion?.(filasSeleccionadas, 'cotejado')} sx={{ color: 'inherit' }}>
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {puedePendienteBarra && (
            <Tooltip title="Marcar pendiente" placement="top" arrow>
              <IconButton size="small" aria-label="Marcar pendiente" onClick={() => onMarcarSeleccion?.(filasSeleccionadas, 'pendiente')} sx={{ color: 'inherit' }}>
                <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
      <Dialog
        open={Boolean(adjuntoPorConfirmar)}
        onClose={() => {
          if (!adjuntosEliminandoId) setAdjuntoPorConfirmar(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, color: tokens.content.foreground }}>Eliminar adjunto</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Typography sx={{ fontSize: 14, color: tokens.content.secondary }}>
            {adjuntoPorConfirmar ? `Se quitará «${adjuntoPorConfirmar.nombre_original}».` : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1.5 }}>
          <Button
            onClick={() => setAdjuntoPorConfirmar(null)}
            disabled={Boolean(adjuntosEliminandoId)}
            sx={{ textTransform: 'none', color: tokens.content.foreground }}
          >
            No eliminar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (adjuntoPorConfirmar) void quitarAdjunto(adjuntoPorConfirmar);
            }}
            disabled={!adjuntoPorConfirmar || Boolean(adjuntosEliminandoId)}
            sx={{
              textTransform: 'none',
              borderRadius: 999,
              bgcolor: tokens.action.destructive,
              color: tokens.action.primaryForeground,
              '&:hover': { bgcolor: tokens.action.destructive },
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MovimientosTable;
