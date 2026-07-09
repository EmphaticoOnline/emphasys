import * as React from 'react';
import {
  Alert,
  Autocomplete,
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
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import type { GridColDef } from '@mui/x-data-grid';
import { EmphasysDataGrid } from '../../components/grids/EmphasysDataGrid';
import type { Cuenta } from '../../types/contabilidad';
import type { CodigoAgrupadorSat } from '../../types/codigosAgrupadores';
import type { NivelConfianza, SugerenciaCodigoAgrupador } from '../../types/sugerenciasCodigosAgrupadores';
import type { RangoCuenta } from '../../types/rangosCuentas';
import { NATURALEZA_SALDO_LABEL } from '../../types/rangosCuentas';
import {
  fetchCuentas,
  actualizarCodigoAgrupadorSatCuenta,
  actualizarCodigosAgrupadoresSatLote,
} from '../../services/contabilidadService';
import { fetchCodigosAgrupadores, fetchSugerenciasCodigosAgrupadores } from '../../services/eContabilidadService';
import { fetchRangosCuentas } from '../../services/rangosCuentasService';
import { CUENTAS_GRID_ROW_HEIGHT, cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx } from './cuentasGridEstilos';

const BRAND = '#1d2f68';

type Estado = 'sin_codigo' | 'invalido' | 'correcto' | 'no_requerido';
type Filtro = 'todas' | 'afectables' | 'sin-codigo' | 'invalido' | 'correctas' | 'inactivas' | 'con-sugerencia';

const FILTROS: Array<{ value: Filtro; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'afectables', label: 'Solo afectables' },
  { value: 'sin-codigo', label: 'Sin código' },
  { value: 'invalido', label: 'Código inválido' },
  { value: 'correctas', label: 'Correctas' },
  { value: 'con-sugerencia', label: 'Con sugerencia' },
  { value: 'inactivas', label: 'Inactivas' },
];

const ESTADO_CONFIG: Record<Estado, { label: string; color: 'warning' | 'error' | 'success' | 'default' }> = {
  sin_codigo: { label: 'Sin código', color: 'warning' },
  invalido: { label: 'Código inválido', color: 'error' },
  correcto: { label: 'Correcto', color: 'success' },
  no_requerido: { label: 'No requerido', color: 'default' },
};

const CONFIANZA_CONFIG: Record<NivelConfianza, { label: string; color: 'success' | 'info' | 'default' }> = {
  alta: { label: 'Alta', color: 'success' },
  media: { label: 'Media', color: 'info' },
  baja: { label: 'Baja', color: 'default' },
};

function calcularEstado(
  afectable: boolean,
  codigo: string | null,
  codigosPorCodigo: Map<string, CodigoAgrupadorSat>
): Estado {
  if (!afectable) return 'no_requerido';
  const valor = codigo?.trim();
  if (!valor) return 'sin_codigo';
  const encontrado = codigosPorCodigo.get(valor);
  if (!encontrado || !encontrado.activo) return 'invalido';
  return 'correcto';
}

const normalizeFilterLookup = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Mismo tratamiento que las celdas Autocomplete de PolizaFormView: el
// Autocomplete agrega su propio padding/adornos, hay que recortarlos para
// que quepa en el alto compacto de la grilla.
const celdaAutocompleteSx = {
  width: '100%',
  '& .MuiAutocomplete-input': { padding: '2px 2px !important', fontSize: 12 },
  '& .MuiAutocomplete-endAdornment': { right: 0, top: 'calc(50% - 9px)' },
  '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': { padding: 2 },
  '& .MuiAutocomplete-popupIndicator .MuiSvgIcon-root, & .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': {
    fontSize: 16,
  },
};

interface EdicionPendiente {
  codigo: string | null;
}

export interface CatalogoCuentasSatViewProps {
  onIrAValidaciones?: () => void;
}

export default function CatalogoCuentasSatView({ onIrAValidaciones }: CatalogoCuentasSatViewProps) {
  const [cuentas, setCuentas] = React.useState<Cuenta[]>([]);
  const [codigosAgrupadores, setCodigosAgrupadores] = React.useState<CodigoAgrupadorSat[]>([]);
  const [rangosCuentas, setRangosCuentas] = React.useState<RangoCuenta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [filtro, setFiltro] = React.useState<Filtro>('todas');
  const [buscarCuenta, setBuscarCuenta] = React.useState('');
  const [buscarDescripcion, setBuscarDescripcion] = React.useState('');
  const [buscarCodigoSat, setBuscarCodigoSat] = React.useState('');

  const [ediciones, setEdiciones] = React.useState<Map<number, EdicionPendiente>>(new Map());
  const [guardandoId, setGuardandoId] = React.useState<number | null>(null);
  const [guardandoLote, setGuardandoLote] = React.useState(false);
  const [erroresLote, setErroresLote] = React.useState<Array<{ cuenta_id: number; motivo: string }>>([]);

  const [sugerencias, setSugerencias] = React.useState<Map<number, SugerenciaCodigoAgrupador>>(new Map());
  const [cargandoSugerencias, setCargandoSugerencias] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cuentasData, codigosData, rangosData] = await Promise.all([
        fetchCuentas(true),
        fetchCodigosAgrupadores(),
        fetchRangosCuentas(),
      ]);
      // contabilidad.cuentas.id es bigserial: node-pg lo regresa como string
      // (fetchCuentas -> GET /api/contabilidad/cuentas no lo castea), mientras
      // que GET .../sugerencias-codigos-agrupadores sí regresa cuenta_id como
      // number. Sin normalizar aquí, todos los Map.get(cuenta.id) de esta
      // pantalla (ediciones, sugerencias) fallan en silencio por el mismatch
      // de tipo, aunque las claves "se vean iguales" en consola.
      setCuentas(cuentasData.map((c) => ({ ...c, id: Number(c.id) })));
      setCodigosAgrupadores(codigosData);
      setRangosCuentas(rangosData);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las cuentas o el catálogo SAT');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const codigosPorCodigo = React.useMemo(
    () => new Map(codigosAgrupadores.map((c) => [c.codigo, c])),
    [codigosAgrupadores]
  );

  const rangosPorId = React.useMemo(() => new Map(rangosCuentas.map((r) => [r.id, r])), [rangosCuentas]);

  const naturalezaDeCuenta = React.useCallback(
    (cuenta: Cuenta): string => {
      const naturaleza = cuenta.rango_cuenta_id != null ? rangosPorId.get(cuenta.rango_cuenta_id)?.naturaleza_saldo : null;
      return naturaleza ? NATURALEZA_SALDO_LABEL[naturaleza] : 'no determinada';
    },
    [rangosPorId]
  );

  // El filtro de estado y las búsquedas siempre evalúan el valor YA
  // GUARDADO (contabilidad.cuentas.codigo_agrupador_sat), no los cambios
  // pendientes en `ediciones`: la grilla no debe reordenarse/desaparecer
  // filas mientras el usuario edita, solo al recargar tras guardar.
  const filasFiltradas = React.useMemo(() => {
    let filas = cuentas;
    if (filtro === 'inactivas') {
      filas = filas.filter((c) => !c.activa);
    } else {
      filas = filas.filter((c) => c.activa);
      if (filtro === 'afectables') filas = filas.filter((c) => c.afectable);
      else if (filtro === 'sin-codigo') {
        filas = filas.filter((c) => calcularEstado(c.afectable, c.codigo_agrupador_sat, codigosPorCodigo) === 'sin_codigo');
      } else if (filtro === 'invalido') {
        filas = filas.filter((c) => calcularEstado(c.afectable, c.codigo_agrupador_sat, codigosPorCodigo) === 'invalido');
      } else if (filtro === 'correctas') {
        filas = filas.filter((c) => calcularEstado(c.afectable, c.codigo_agrupador_sat, codigosPorCodigo) === 'correcto');
      } else if (filtro === 'con-sugerencia') {
        filas = filas.filter((c) => sugerencias.has(c.id));
      }
    }

    if (buscarCuenta.trim()) {
      const termino = normalizeFilterLookup(buscarCuenta);
      filas = filas.filter((c) => normalizeFilterLookup(c.cuenta).includes(termino));
    }
    if (buscarDescripcion.trim()) {
      const termino = normalizeFilterLookup(buscarDescripcion);
      filas = filas.filter((c) => normalizeFilterLookup(c.descripcion).includes(termino));
    }
    if (buscarCodigoSat.trim()) {
      const termino = normalizeFilterLookup(buscarCodigoSat);
      filas = filas.filter((c) => normalizeFilterLookup(c.codigo_agrupador_sat ?? '').includes(termino));
    }
    return filas;
  }, [cuentas, filtro, codigosPorCodigo, sugerencias, buscarCuenta, buscarDescripcion, buscarCodigoSat]);

  const handleCambiarCodigo = React.useCallback((cuenta: Cuenta, nuevoCodigo: string | null) => {
    setEdiciones((prev) => {
      const next = new Map(prev);
      if (nuevoCodigo === (cuenta.codigo_agrupador_sat ?? null)) {
        // Volvió al valor original: ya no hay nada pendiente que guardar.
        next.delete(cuenta.id);
      } else {
        next.set(cuenta.id, { codigo: nuevoCodigo });
      }
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

  // Genera sugerencias en el backend (regla del catálogo + descripción +
  // grupo/subgrupo del rango) y solo las guarda en memoria: no toca
  // `ediciones` ni guarda nada. El usuario decide qué aplicar.
  const handleSugerirCodigos = React.useCallback(async () => {
    setCargandoSugerencias(true);
    try {
      const data = await fetchSugerenciasCodigosAgrupadores();
      setSugerencias(new Map(data.map((s) => [s.cuenta_id, s])));
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudieron generar las sugerencias', severity: 'error' });
    } finally {
      setCargandoSugerencias(false);
    }
  }, []);

  const handleLimpiarSugerencias = React.useCallback(() => {
    setSugerencias(new Map());
  }, []);

  // Copiar la sugerencia al campo editable: sigue sin guardar nada, el
  // renglón queda "modificado" igual que si el usuario hubiera elegido el
  // código a mano en el Autocomplete.
  const handleAplicarSugerencia = React.useCallback(
    (cuenta: Cuenta) => {
      const sugerencia = sugerencias.get(cuenta.id);
      if (!sugerencia) return;
      handleCambiarCodigo(cuenta, sugerencia.codigo_sugerido);
    },
    [sugerencias, handleCambiarCodigo]
  );

  // Aplica solo entre las filas visibles (respeta el filtro/búsqueda actual)
  // y solo confianza alta/media: las de confianza baja nunca se aplican en
  // lote, quedan disponibles para aplicarse una por una si el usuario decide
  // hacerlo tras revisarlas.
  const handleAplicarSugerenciasVisibles = React.useCallback(() => {
    let aplicadas = 0;
    filasFiltradas.forEach((cuenta) => {
      const sugerencia = sugerencias.get(cuenta.id);
      if (!sugerencia || sugerencia.confianza === 'baja') return;
      handleCambiarCodigo(cuenta, sugerencia.codigo_sugerido);
      aplicadas += 1;
    });
    setSnackbar({
      open: true,
      message:
        aplicadas > 0
          ? `${aplicadas} sugerencia(s) aplicada(s) localmente. Revisa y guarda para confirmar.`
          : 'No hay sugerencias de confianza alta/media visibles para aplicar.',
      severity: 'success',
    });
  }, [filasFiltradas, sugerencias, handleCambiarCodigo]);

  const handleGuardarRenglon = React.useCallback(
    async (cuenta: Cuenta) => {
      const edicion = ediciones.get(cuenta.id);
      if (!edicion) return;
      setGuardandoId(cuenta.id);
      try {
        const actualizada = await actualizarCodigoAgrupadorSatCuenta(cuenta.id, edicion.codigo);
        // Misma normalización que en cargar(): la respuesta del PATCH trae
        // id como string por el mismo motivo (bigserial sin castear en el
        // backend), y debe seguir siendo number aquí para no reintroducir
        // el mismatch en las próximas comparaciones/Map.get de este renglón.
        setCuentas((prev) => prev.map((c) => (c.id === cuenta.id ? { ...actualizada, id: Number(actualizada.id) } : c)));
        setEdiciones((prev) => {
          const next = new Map(prev);
          next.delete(cuenta.id);
          return next;
        });
        setSugerencias((prev) => {
          const next = new Map(prev);
          next.delete(cuenta.id);
          return next;
        });
        setSnackbar({ open: true, message: `Cuenta ${cuenta.cuenta} actualizada`, severity: 'success' });
      } catch (err: any) {
        setSnackbar({ open: true, message: err?.message || 'No se pudo actualizar la cuenta', severity: 'error' });
      } finally {
        setGuardandoId(null);
      }
    },
    [ediciones]
  );

  const handleGuardarTodo = React.useCallback(async () => {
    const items = Array.from(ediciones.entries()).map(([cuenta_id, e]) => ({
      cuenta_id,
      codigo_agrupador_sat: e.codigo,
    }));
    if (items.length === 0) return;

    setGuardandoLote(true);
    setErroresLote([]);
    try {
      const resultado = await actualizarCodigosAgrupadoresSatLote(items);
      await cargar();

      const idsConError = new Set(resultado.errores.map((e) => e.cuenta_id));
      setEdiciones((prev) => {
        const next = new Map<number, EdicionPendiente>();
        prev.forEach((v, k) => {
          if (idsConError.has(k)) next.set(k, v);
        });
        return next;
      });
      setSugerencias((prev) => {
        const next = new Map<number, SugerenciaCodigoAgrupador>();
        prev.forEach((v, k) => {
          if (idsConError.has(k)) next.set(k, v);
        });
        return next;
      });
      setErroresLote(resultado.errores);
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
  }, [ediciones, cargar]);

  const columns: GridColDef<Cuenta>[] = React.useMemo(
    () => [
      {
        field: 'cuenta',
        headerName: 'Cuenta',
        width: 130,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params) => (
          <Box sx={{ color: params.row.afectable ? BRAND : 'text.secondary', fontWeight: params.row.afectable ? 600 : 400 }}>
            {params.value}
          </Box>
        ),
      },
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
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              color: params.row.afectable ? BRAND : 'text.secondary',
              fontWeight: params.row.afectable ? 600 : 400,
            }}
            title={`${params.value} · Naturaleza: ${naturalezaDeCuenta(params.row)}`}
          >
            {params.value}
          </Box>
        ),
      },
      {
        field: 'nivel',
        headerName: 'Nivel',
        width: 70,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
      },
      {
        field: 'afectable',
        headerName: 'Afectable',
        width: 90,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params) => (
          <Chip
            label={params.value ? 'Sí' : 'No'}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
        ),
      },
      {
        field: 'activa',
        headerName: 'Activa',
        width: 90,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: (params) => (
          <Chip
            label={params.value ? 'Activa' : 'Inactiva'}
            size="small"
            color={params.value ? 'default' : 'warning'}
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
        ),
      },
      {
        field: 'codigo_agrupador_sat',
        headerName: 'Código agrupador SAT',
        width: 260,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const edicion = ediciones.get(cuenta.id);
          const valorActual = edicion ? edicion.codigo : cuenta.codigo_agrupador_sat;
          const seleccionado = valorActual ? codigosPorCodigo.get(valorActual) ?? null : null;
          return (
            <Autocomplete
              size="small"
              options={codigosAgrupadores}
              value={seleccionado}
              getOptionLabel={(o) => `${o.codigo} — ${o.descripcion}`}
              isOptionEqualToValue={(o, v) => o.codigo === v.codigo}
              onChange={(_e, value) => handleCambiarCodigo(cuenta, value?.codigo ?? null)}
              sx={celdaAutocompleteSx}
              renderInput={(p) => (
                <TextField
                  {...(p as any)}
                  variant="standard"
                  placeholder={valorActual && !seleccionado ? `${valorActual} (inválido)` : 'Sin código'}
                  InputProps={{ ...p.InputProps, disableUnderline: true }}
                />
              )}
            />
          );
        },
      },
      {
        field: 'descripcion_sat',
        headerName: 'Descripción SAT',
        flex: 0.8,
        minWidth: 160,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const edicion = ediciones.get(cuenta.id);
          const valorActual = edicion ? edicion.codigo : cuenta.codigo_agrupador_sat;
          const encontrado = valorActual ? codigosPorCodigo.get(valorActual) : null;
          return (
            <Typography variant="caption" color="text.secondary" noWrap title={encontrado?.descripcion ?? ''}>
              {encontrado?.descripcion ?? '—'}
            </Typography>
          );
        },
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 130,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const estado = calcularEstado(cuenta.afectable, cuenta.codigo_agrupador_sat, codigosPorCodigo);
          const config = ESTADO_CONFIG[estado];
          const modificado = ediciones.has(cuenta.id);
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip label={config.label} size="small" color={config.color} sx={{ height: 20, fontSize: 11 }} />
              {modificado && (
                <Tooltip title="Cambio sin guardar">
                  <Chip label="•" size="small" color="info" sx={{ height: 20, fontSize: 11, minWidth: 20 }} />
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
      {
        field: 'codigo_sugerido',
        headerName: 'Código sugerido',
        width: 220,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const sugerencia = sugerencias.get(params.row.id);
          if (!sugerencia) return <Typography variant="caption" color="text.disabled">—</Typography>;
          const config = CONFIANZA_CONFIG[sugerencia.confianza];
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%', overflow: 'hidden' }}>
              <Chip label={config.label} size="small" color={config.color} sx={{ height: 18, fontSize: 10 }} />
              <Typography
                variant="caption"
                noWrap
                title={`${sugerencia.codigo_sugerido} — ${sugerencia.descripcion_sugerida}`}
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {sugerencia.codigo_sugerido} — {sugerencia.descripcion_sugerida}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: 'motivo_sugerencia',
        headerName: 'Motivo sugerencia',
        flex: 0.9,
        minWidth: 200,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        renderCell: (params) => {
          const sugerencia = sugerencias.get(params.row.id);
          if (!sugerencia) return null;
          return (
            <Typography variant="caption" color="text.secondary" noWrap title={sugerencia.motivo}>
              {sugerencia.motivo}
            </Typography>
          );
        },
      },
      {
        field: 'acciones',
        headerName: 'Acciones',
        width: 130,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const cuenta = params.row;
          const tieneEdicion = ediciones.has(cuenta.id);
          const guardandoEsteRenglon = guardandoId === cuenta.id;
          const sugerencia = sugerencias.get(cuenta.id);
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
              <Tooltip title="Limpiar cambio">
                <span>
                  <IconButton size="small" disabled={!tieneEdicion} onClick={() => handleLimpiarCambio(cuenta.id)}>
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={sugerencia ? `Aplicar sugerencia (${CONFIANZA_CONFIG[sugerencia.confianza].label})` : 'Sin sugerencia'}>
                <span>
                  <IconButton size="small" disabled={!sugerencia} onClick={() => handleAplicarSugerencia(cuenta)}>
                    <AutoFixHighIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [
      codigosAgrupadores,
      codigosPorCodigo,
      ediciones,
      guardandoId,
      sugerencias,
      naturalezaDeCuenta,
      handleCambiarCodigo,
      handleGuardarRenglon,
      handleLimpiarCambio,
      handleAplicarSugerencia,
    ]
  );

  const totalPendientes = ediciones.size;
  const totalSugerencias = sugerencias.size;
  const sugerenciasVisiblesTotal = React.useMemo(
    () => filasFiltradas.filter((c) => sugerencias.has(c.id)).length,
    [filasFiltradas, sugerencias]
  );
  const sugerenciasVisiblesAplicables = React.useMemo(
    () =>
      filasFiltradas.filter((c) => {
        const s = sugerencias.get(c.id);
        return s && s.confianza !== 'baja';
      }).length,
    [filasFiltradas, sugerencias]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Revisa y asigna el código agrupador SAT de las cuentas contables sin abrir el formulario de cada una.
        </Typography>
        {onIrAValidaciones && (
          <Button size="small" onClick={onIrAValidaciones} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
            Ir a validaciones →
          </Button>
        )}
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
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
        <TextField
          label="Buscar código SAT"
          size="small"
          value={buscarCodigoSat}
          onChange={(e) => setBuscarCodigoSat(e.target.value)}
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          disabled={cargandoSugerencias}
          onClick={() => void handleSugerirCodigos()}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {cargandoSugerencias ? <CircularProgress size={16} /> : 'Sugerir códigos'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={sugerenciasVisiblesAplicables === 0}
          onClick={handleAplicarSugerenciasVisibles}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          Aplicar sugerencias visibles{sugerenciasVisiblesAplicables > 0 ? ` (${sugerenciasVisiblesAplicables})` : ''}
        </Button>
        <Button
          size="small"
          disabled={totalSugerencias === 0}
          onClick={handleLimpiarSugerencias}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          Limpiar sugerencias
        </Button>
        {totalSugerencias > 0 && (
          <Typography variant="caption" color="text.secondary">
            {totalSugerencias} sugerencia(s) generada(s) ({sugerenciasVisiblesTotal} visible
            {sugerenciasVisiblesTotal === 1 ? '' : 's'} con los filtros actuales). Las de confianza baja no se
            aplican en lote.
          </Typography>
        )}
      </Stack>

      {totalSugerencias > 0 && sugerenciasVisiblesTotal === 0 && (
        <Alert severity="info">
          Hay {totalSugerencias} sugerencia{totalSugerencias === 1 ? '' : 's'} generada{totalSugerencias === 1 ? '' : 's'}, pero
          ninguna está visible con los filtros actuales. Usa el filtro "Con sugerencia" o ajusta la búsqueda para
          revisarlas.
        </Alert>
      )}

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
              const cuenta = cuentas.find((c) => c.id === e.cuenta_id);
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
