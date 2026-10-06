import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useTheme } from '@mui/material/styles';
import { EDITORIAL_FIGURE_FAMILY } from '../../theme/tokens';
import type { FinanzasCuenta } from '../../types/finanzas';
import {
  actualizarCandidatoEstadoCuenta,
  aceptarCoincidenciasClaras,
  fetchCandidatosEstadoCuenta,
  fetchImportacionesEstadosCuenta,
  fetchMovimientosEstadoCuenta,
  generarCandidatosEstadoCuenta,
  importarEstadoCuenta,
  previsualizarEstadoCuenta,
  type CandidatoEstadoCuenta,
  type EstadoCuentaPreview,
} from '../../services/finanzasService';

type Props = {
  open: boolean;
  cuentas: FinanzasCuenta[];
  cuentaId: number | '';
  onClose: () => void;
  onCancelar?: () => void;
  onImported: () => void;
};

type Fase = 'inicio' | 'proceso' | 'decision' | 'aviso' | 'historial' | 'revision';
type Paso = 'leyendo' | 'validando' | 'importando' | 'buscando';
type EstadoFila = 'encontrado' | 'revisar' | 'sin';
type Filtro = 'todos' | 'revisar' | 'encontrados' | 'sin' | 'claras';

type MovimientoBanco = {
  id: number;
  fecha: string;
  tipo: string;
  importe: number;
  referencia: string | null;
  concepto: string | null;
  numeroFila: number;
};

type ImportMeta = {
  id: number;
  nombre: string;
  desde: string | null;
  hasta: string | null;
  omitidos: number;
  desdeHistorial: boolean;
};

type FilaRevision = {
  movimiento: MovimientoBanco;
  estado: EstadoFila;
  clara: boolean;
  visible: CandidatoEstadoCuenta | null;
  alternativas: CandidatoEstadoCuenta[];
};

const PASOS: Array<{ id: Paso; label: string }> = [
  { id: 'leyendo', label: 'Leyendo archivo' },
  { id: 'validando', label: 'Validando movimientos' },
  { id: 'importando', label: 'Importando' },
  { id: 'buscando', label: 'Buscando coincidencias' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RANK: Record<string, number> = { alta: 0, media: 1, baja: 2 };
const ORDEN_ESTADO: Record<EstadoFila, number> = { revisar: 0, sin: 1, encontrado: 2 };

const money = (n: number, moneda: string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(Number.isFinite(n) ? n : 0);

function fechaClave(value: unknown): string {
  const texto = value instanceof Date && !Number.isNaN(value.getTime())
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value ?? '');
  const match = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match?.[1] || !match[2] || !match[3]) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function fechaCorta(value: unknown): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaClave(value));
  if (!match?.[1] || !match[2] || !match[3]) return '—';
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const nombre = MESES[mes - 1];
  if (!nombre || !Number.isInteger(dia) || dia < 1 || dia > 31) return '—';
  return `${dia} ${nombre} ${match[1]}`;
}

function mensajeFuncional(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : '';
  const conocidos: Record<string, string> = {
    'El archivo está vacío o excede 10 MB': 'El archivo está vacío o pesa más de 10 MB.',
    'El archivo no contiene filas': 'El archivo no contiene movimientos.',
    'No se reconocieron columnas de fecha e importe/cargo/abono': 'No reconocimos las columnas de fecha e importe. El archivo necesita fecha y cargo, abono o importe.',
    'El archivo ya fue importado para esta empresa': 'Este archivo ya fue importado. No se duplicó.',
    'Cuenta no encontrada, cerrada o fuera de la empresa activa': 'No se pudo usar la cuenta seleccionada.',
  };
  if (conocidos[raw]) return conocidos[raw];
  if (/sql|postgres|duplicate key|syntax error|relation |column |ECONN/i.test(raw)) return fallback;
  if (raw && raw.length < 180 && !/select |insert |update /i.test(raw)) return raw;
  return fallback;
}

function asMovimiento(row: Record<string, unknown>): MovimientoBanco {
  return {
    id: Number(row.id),
    fecha: fechaClave(row.fecha),
    tipo: String(row.tipo ?? ''),
    importe: Number(row.importe ?? 0),
    referencia: row.referencia_bancaria ? String(row.referencia_bancaria) : null,
    concepto: row.concepto_bancario ? String(row.concepto_bancario) : null,
    numeroFila: Number(row.numero_fila ?? 0),
  };
}

function ordenarOpciones(opciones: CandidatoEstadoCuenta[]) {
  return [...opciones].sort((a, b) => {
    const rank = (RANK[a.nivel_confianza] ?? 9) - (RANK[b.nivel_confianza] ?? 9);
    if (rank !== 0) return rank;
    return Number(b.puntuacion) - Number(a.puntuacion);
  });
}

function esMismaFecha(candidato: CandidatoEstadoCuenta): boolean {
  const motivos = candidato.motivos && typeof candidato.motivos === 'object' ? candidato.motivos : {};
  if (motivos.fecha === 'misma_fecha') return true;
  if (motivos.diferencia_dias !== undefined && motivos.diferencia_dias !== null && motivos.diferencia_dias !== '') return Number(motivos.diferencia_dias) === 0;
  const banco = fechaClave(candidato.fecha);
  const operacion = fechaClave(candidato.operacion_fecha);
  return banco !== '' && banco === operacion;
}

function movimientosClaros(candidatos: CandidatoEstadoCuenta[]): Set<number> {
  const sugeridas = candidatos.filter((c) => c.estado === 'sugerida');
  const porMovimiento = new Map<number, CandidatoEstadoCuenta[]>();
  const porOperacion = new Map<number, CandidatoEstadoCuenta[]>();
  for (const candidato of sugeridas) {
    const movimientoId = Number(candidato.movimiento_bancario_id);
    const operacionId = Number(candidato.operacion_id);
    porMovimiento.set(movimientoId, [...(porMovimiento.get(movimientoId) ?? []), candidato]);
    porOperacion.set(operacionId, [...(porOperacion.get(operacionId) ?? []), candidato]);
  }
  const confirmadas = new Set(candidatos.filter((c) => c.estado === 'confirmada').map((c) => Number(c.operacion_id)));
  const claras = new Set<number>();
  for (const [movimientoId, opciones] of porMovimiento) {
    if (opciones.length !== 1) continue;
    const candidata = opciones[0];
    if (!candidata) continue;
    const operacionId = Number(candidata.operacion_id);
    if ((porOperacion.get(operacionId) ?? []).length !== 1) continue;
    if (confirmadas.has(operacionId)) continue;
    if (candidata.operacion_estado_conciliacion === 'conciliado') continue;
    if (!candidata.movimiento_tipo || candidata.movimiento_tipo !== candidata.tipo_movimiento) continue;
    if (candidata.movimiento_importe == null || candidata.monto == null) continue;
    if (Math.abs(Number(candidata.movimiento_importe) - Number(candidata.monto)) > 0.000001) continue;
    if (!esMismaFecha(candidata)) continue;
    claras.add(movimientoId);
  }
  return claras;
}

function armarFilas(movimientos: MovimientoBanco[], candidatos: CandidatoEstadoCuenta[]): FilaRevision[] {
  const claras = movimientosClaros(candidatos);
  const porMovimiento = new Map<number, CandidatoEstadoCuenta[]>();
  for (const candidato of candidatos) {
    if (candidato.estado === 'anulada') continue;
    const movimientoId = Number(candidato.movimiento_bancario_id);
    porMovimiento.set(movimientoId, [...(porMovimiento.get(movimientoId) ?? []), candidato]);
  }
  return movimientos
    .map((movimiento) => {
      const relaciones = porMovimiento.get(Number(movimiento.id)) ?? [];
      const confirmada = relaciones.find((c) => c.estado === 'confirmada') ?? null;
      const sugeridas = ordenarOpciones(relaciones.filter((c) => c.estado === 'sugerida'));
      if (confirmada && confirmada.operacion_estado_conciliacion === 'cotejado') {
        return { movimiento, estado: 'encontrado' as const, clara: false, visible: confirmada, alternativas: [] };
      }
      const mejor = sugeridas[0] ?? null;
      if (!mejor) {
        return { movimiento, estado: 'sin' as const, clara: false, visible: null, alternativas: [] };
      }
      return {
        movimiento,
        estado: 'revisar' as const,
        clara: claras.has(Number(movimiento.id)),
        visible: mejor,
        alternativas: sugeridas.slice(1),
      };
    })
    .sort((a, b) => {
      const grupo = ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
      if (grupo !== 0) return grupo;
      if (a.estado === 'revisar' && a.clara !== b.clara) return a.clara ? -1 : 1;
      return a.movimiento.fecha.localeCompare(b.movimiento.fecha) || a.movimiento.numeroFila - b.movimiento.numeroFila;
    });
}

function razones(candidato: CandidatoEstadoCuenta): string[] {
  const motivos = candidato.motivos && typeof candidato.motivos === 'object' ? candidato.motivos : {};
  const salida: string[] = [];
  if (motivos.importe_exactamente_igual) salida.push('Mismo importe');
  const dias = Number(motivos.diferencia_dias);
  const fecha = String(motivos.fecha ?? '');
  if (fecha === 'misma_fecha' || dias === 0) salida.push('Misma fecha');
  else if ((dias > 0 && dias <= 3) || fecha.startsWith('±')) salida.push('Fecha cercana');
  if (motivos.referencia) salida.push('Referencia compatible');
  if (salida.length > 0) return salida;
  const texto = (candidato.explicacion || '').toLowerCase();
  if (texto.includes('importe')) salida.push('Mismo importe');
  if (texto.includes('misma fecha')) salida.push('Misma fecha');
  else if (texto.includes('día') || texto.includes('dia')) salida.push('Fecha cercana');
  if (texto.includes('referencia')) salida.push('Referencia compatible');
  return salida;
}

function etiquetaNivel(nivel: string): string {
  if (nivel === 'alta') return 'Coincidencia alta';
  if (nivel === 'media') return 'Coincidencia media';
  return 'Coincidencia baja';
}

function etiquetaTipo(tipo: string): string {
  return tipo === 'Deposito' ? 'Depósito' : 'Retiro';
}

function etiquetaEstado(estado: EstadoFila): string {
  if (estado === 'encontrado') return 'Encontrado en banco';
  if (estado === 'revisar') return 'Por revisar';
  return 'Sin coincidencia';
}

export function ImportarEstadoCuentaDialog({ open, cuentas, cuentaId, onClose, onCancelar, onImported }: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const pantallaCompleta = useMediaQuery(theme.breakpoints.down('sm'));
  const cuenta = cuentas.find((item) => item.id === Number(cuentaId));
  const moneda = cuenta?.moneda || 'MXN';
  const runId = useRef(0);
  const archivoRef = useRef<HTMLInputElement | null>(null);

  const [fase, setFase] = useState<Fase>('inicio');
  const [paso, setPaso] = useState<Paso>('leyendo');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<EstadoCuentaPreview | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [imports, setImports] = useState<Array<Record<string, unknown>>>([]);
  const [movimientos, setMovimientos] = useState<MovimientoBanco[]>([]);
  const [candidatos, setCandidatos] = useState<CandidatoEstadoCuenta[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [menu, setMenu] = useState<{ id: number; el: HTMLElement } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const reiniciar = () => {
    setFase('inicio');
    setPaso('leyendo');
    setArchivo(null);
    setPreview(null);
    setAviso('');
    setError('');
    setMeta(null);
    setImports([]);
    setMovimientos([]);
    setCandidatos([]);
    setFiltro('todos');
    setMenu(null);
    setOcupado(false);
    if (archivoRef.current) archivoRef.current.value = '';
  };

  useEffect(() => {
    if (!open) return;
    runId.current += 1;
    reiniciar();
  }, [open, cuentaId]);

  const filas = useMemo(() => armarFilas(movimientos, candidatos), [movimientos, candidatos]);
  const totalClaras = filas.filter((fila) => fila.clara).length;
  const totalRevision = filas.filter((fila) => fila.estado === 'revisar' && !fila.clara).length;
  const totalSin = filas.filter((fila) => fila.estado === 'sin').length;
  const visibles = filas.filter((fila) => {
    if (filtro === 'revisar') return fila.estado === 'revisar';
    if (filtro === 'encontrados') return fila.estado === 'encontrado';
    if (filtro === 'sin') return fila.estado === 'sin';
    if (filtro === 'claras') return fila.clara && fila.estado === 'revisar';
    return true;
  });
  const filaMenu = filas.find((fila) => fila.movimiento.id === menu?.id) ?? null;

  const cerrar = () => {
    runId.current += 1;
    onClose();
  };

  const cancelarRevision = () => {
    runId.current += 1;
    (onCancelar ?? onClose)();
  };

  const publicarRevision = async (importacionId: number, token: number) => {
    const [filasBanco, relaciones] = await Promise.all([
      fetchMovimientosEstadoCuenta(importacionId),
      fetchCandidatosEstadoCuenta(importacionId),
    ]);
    if (token !== runId.current) return false;
    setMovimientos(filasBanco.map((row) => asMovimiento(row)));
    setCandidatos(relaciones);
    setMenu(null);
    return true;
  };

  const importarYRevisar = async (seleccionado: File, token: number, omitidos: number) => {
    setPaso('importando');
    let resultado: Awaited<ReturnType<typeof importarEstadoCuenta>>;
    try {
      resultado = await importarEstadoCuenta(Number(cuentaId), seleccionado);
    } catch (e: unknown) {
      if (token !== runId.current) return;
      const estado = (e as { status?: number }).status;
      const texto = mensajeFuncional(e, 'No se pudo importar el archivo.');
      setAviso(estado === 409 ? 'Este archivo ya fue importado. No se duplicó.' : texto);
      setFase('aviso');
      setOcupado(false);
      return;
    }
    if (token !== runId.current) return;
    onImported();
    setMeta({
      id: resultado.id,
      nombre: resultado.nombreOriginal || seleccionado.name,
      desde: resultado.fechaInicial,
      hasta: resultado.fechaFinal,
      omitidos: resultado.duplicados ?? omitidos,
      desdeHistorial: false,
    });
    setPaso('buscando');
    try {
      await generarCandidatosEstadoCuenta(resultado.id);
      const lista = await publicarRevision(resultado.id, token);
      if (!lista) return;
      setFiltro('todos');
      setFase('revision');
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setAviso(mensajeFuncional(e, 'El archivo ya quedó importado, pero no pudimos buscar coincidencias.'));
      setFase('aviso');
    } finally {
      if (token === runId.current) setOcupado(false);
    }
  };

  const procesarArchivo = async (seleccionado: File) => {
    const nombre = seleccionado.name.toLowerCase();
    if (!nombre.endsWith('.csv') && !nombre.endsWith('.xlsx')) {
      setAviso('Selecciona un archivo CSV o Excel (.xlsx).');
      setFase('aviso');
      return;
    }
    if (!cuentaId) return;
    const token = ++runId.current;
    setArchivo(seleccionado);
    setError('');
    setAviso('');
    setPreview(null);
    setOcupado(true);
    setFase('proceso');
    setPaso('leyendo');
    let vista: EstadoCuentaPreview;
    try {
      vista = await previsualizarEstadoCuenta(Number(cuentaId), seleccionado);
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setAviso(mensajeFuncional(e, 'No se pudo leer el archivo.'));
      setFase('aviso');
      setOcupado(false);
      return;
    }
    if (token !== runId.current) return;
    setPaso('validando');
    setPreview(vista);
    if (vista.importacionExistente) {
      const previa = vista.importacionExistente;
      setMeta({
        id: previa.id,
        nombre: previa.nombreOriginal || seleccionado.name,
        desde: previa.fechaInicial,
        hasta: previa.fechaFinal,
        omitidos: previa.filasDuplicadas,
        desdeHistorial: true,
      });
      setAviso('Este archivo ya fue importado para esta cuenta. Puedes retomar la revisión donde se quedó.');
      setFase('aviso');
      setOcupado(false);
      return;
    }
    const nuevas = vista.filasValidas - vista.duplicados;
    if (vista.filasInvalidas.length > 0 && nuevas > 0) {
      setFase('decision');
      setOcupado(false);
      return;
    }
    if (nuevas <= 0) {
      if (vista.filasInvalidas.length > 0) setFase('decision');
      else {
        setAviso(vista.filasValidas === 0
          ? 'El archivo no contiene movimientos.'
          : 'Todas las filas de este archivo ya estaban importadas. No se creó una importación nueva.');
        setFase('aviso');
      }
      setOcupado(false);
      return;
    }
    await importarYRevisar(seleccionado, token, vista.duplicados);
  };

  const abrirImportacion = async (item: Record<string, unknown>) => {
    const token = ++runId.current;
    const id = Number(item.id);
    setError('');
    setAviso('');
    setOcupado(true);
    setFase('proceso');
    setPaso('buscando');
    setMeta({
      id,
      nombre: String(item.nombre_original ?? 'Estado de cuenta'),
      desde: item.fecha_inicial ? String(item.fecha_inicial) : null,
      hasta: item.fecha_final ? String(item.fecha_final) : null,
      omitidos: Number(item.filas_duplicadas ?? 0),
      desdeHistorial: true,
    });
    try {
      const filasBanco = await fetchMovimientosEstadoCuenta(id);
      let relaciones = await fetchCandidatosEstadoCuenta(id);
      if (token !== runId.current) return;
      if (relaciones.length === 0 && filasBanco.length > 0) {
        await generarCandidatosEstadoCuenta(id);
        relaciones = await fetchCandidatosEstadoCuenta(id);
      }
      if (token !== runId.current) return;
      setMovimientos(filasBanco.map((row) => asMovimiento(row)));
      setCandidatos(relaciones);
      setFiltro('todos');
      setMenu(null);
      setFase('revision');
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setAviso(mensajeFuncional(e, 'No se pudo abrir la importación.'));
      setFase('aviso');
    } finally {
      if (token === runId.current) setOcupado(false);
    }
  };

  const cargarHistorial = async () => {
    if (!cuentaId) return;
    setOcupado(true);
    setError('');
    try {
      setImports(await fetchImportacionesEstadosCuenta(Number(cuentaId)));
      setFase('historial');
    } catch (e: unknown) {
      setAviso(mensajeFuncional(e, 'No se pudieron cargar las importaciones anteriores.'));
      setFase('aviso');
    } finally {
      setOcupado(false);
    }
  };

  const buscarDeNuevo = async () => {
    if (!meta) return;
    const token = ++runId.current;
    setOcupado(true);
    setError('');
    setPaso('buscando');
    try {
      await generarCandidatosEstadoCuenta(meta.id);
      if (token !== runId.current) return;
      await publicarRevision(meta.id, token);
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setError(mensajeFuncional(e, 'No pudimos buscar coincidencias.'));
    } finally {
      if (token === runId.current) setOcupado(false);
    }
  };

  const resolver = async (relacionId: number, estado: 'confirmada' | 'anulada') => {
    if (!meta) return;
    const token = ++runId.current;
    setOcupado(true);
    setError('');
    setMenu(null);
    try {
      await actualizarCandidatoEstadoCuenta(relacionId, estado);
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setError(mensajeFuncional(e, 'No se pudo guardar la coincidencia.'));
    }
    try {
      if (token !== runId.current) return;
      await publicarRevision(meta.id, token);
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setError(mensajeFuncional(e, 'No se pudo actualizar la revisión.'));
    } finally {
      if (token === runId.current) setOcupado(false);
    }
  };

  const aceptarClaras = async () => {
    if (!meta) return;
    const token = ++runId.current;
    setOcupado(true);
    setError('');
    setMenu(null);
    try {
      await aceptarCoincidenciasClaras(meta.id);
      if (token !== runId.current) return;
      await publicarRevision(meta.id, token);
    } catch (e: unknown) {
      if (token !== runId.current) return;
      setError(mensajeFuncional(e, 'No se pudieron aceptar las coincidencias claras.'));
    } finally {
      if (token === runId.current) setOcupado(false);
    }
  };

  const elegirOtro = () => {
    setArchivo(null);
    setPreview(null);
    setAviso('');
    setError('');
    setFase('inicio');
    if (archivoRef.current) archivoRef.current.value = '';
  };

  const colorEstado = (estado: EstadoFila) => {
    if (estado === 'encontrado') return tokens.metric.exhausted.foreground;
    if (estado === 'revisar') return tokens.metric.amount.foreground;
    return tokens.metric.blocked.foreground;
  };

  const iconoEstado = (estado: EstadoFila) => {
    if (estado === 'encontrado') return <CheckCircleIcon sx={{ fontSize: 14 }} />;
    if (estado === 'revisar') return <HourglassEmptyIcon sx={{ fontSize: 14 }} />;
    return <HighlightOffIcon sx={{ fontSize: 14 }} />;
  };

  const iconoFilaSx = (disabled: boolean) => ({
    width: 22,
    height: 22,
    borderRadius: '7px',
    border: '1px solid',
    borderColor: disabled ? tokens.action.disabled : tokens.action.primary,
    bgcolor: 'transparent',
    color: disabled ? tokens.action.disabled : tokens.action.primary,
    '&:hover': { bgcolor: tokens.action.hoverTint },
    '&.Mui-disabled': { bgcolor: 'transparent', color: tokens.action.disabled, borderColor: tokens.action.disabled },
    p: 0,
  });

  const metricaSx = (fondo: string, color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    px: 0.9,
    borderRadius: 99,
    bgcolor: fondo,
    color,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
  });

  const titulo = fase === 'revision' ? 'Revisar coincidencias' : fase === 'historial' ? 'Importaciones anteriores' : 'Importar estado de cuenta';
  const subtitulo = fase === 'revision' && meta
    ? [cuenta?.identificador, meta.desde || meta.hasta ? `${fechaCorta(meta.desde)} a ${fechaCorta(meta.hasta)}` : null, meta.omitidos > 0 ? `Se omitieron ${meta.omitidos} duplicados` : null].filter(Boolean).join(' · ')
    : cuenta?.identificador;

  const nuevas = preview ? preview.filasValidas - preview.duplicados : 0;
  const enRevision = fase === 'revision';

  return (
    <Dialog
      open={open}
      onClose={ocupado ? undefined : cerrar}
      fullScreen={pantallaCompleta}
      fullWidth
      maxWidth={enRevision ? 'xl' : 'md'}
      PaperProps={{
        sx: {
          bgcolor: tokens.content.elevated,
          color: tokens.content.foreground,
          backgroundImage: 'none',
          ...(enRevision && !pantallaCompleta ? { height: '92vh', maxHeight: '92vh' } : {}),
        },
      }}
    >
      <DialogTitle sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>CONCILIACIÓN</Typography>
        <Typography sx={{ mt: 0.25, fontSize: fase === 'revision' ? 22 : 18, fontWeight: fase === 'revision' ? 500 : 700, letterSpacing: '-0.01em', lineHeight: 1.15, fontFamily: fase === 'revision' ? EDITORIAL_FIGURE_FAMILY : undefined }}>{titulo}</Typography>
        {subtitulo && <Typography sx={{ mt: 0.25, fontSize: 12, color: tokens.content.secondary }}>{subtitulo}</Typography>}
      </DialogTitle>

      <DialogContent sx={{ px: 2, pt: 0.5, pb: 1, display: 'flex', flexDirection: 'column', minHeight: 0, ...(enRevision ? { flex: 1, overflow: 'hidden' } : {}) }}>
        {error && <Alert severity="error" sx={{ mb: 1, py: 0.25, fontSize: 13, flexShrink: 0 }}>{error}</Alert>}

        {fase === 'inicio' && (
          <Stack spacing={1.25}>
            <Button variant="outlined" component="label" disabled={ocupado || !cuentaId} sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: tokens.content.border, color: tokens.content.foreground }}>
              Seleccionar CSV o Excel
              <input ref={archivoRef} hidden type="file" accept=".csv,.xlsx" onChange={(e) => { const file = e.target.files?.[0]; if (file) void procesarArchivo(file); }} />
            </Button>
            <Button onClick={() => void cargarHistorial()} disabled={ocupado || !cuentaId} sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: 12, color: tokens.content.secondary, px: 0.5 }}>
              Importaciones anteriores
            </Button>
          </Stack>
        )}

        {fase === 'proceso' && (meta?.desdeHistorial ? (
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Buscando coincidencias</Typography>
        ) : (
          <Stack spacing={0.5} sx={{ py: 0.5 }}>
            {PASOS.map((item, index) => {
              const actualPaso = PASOS.findIndex((pasoItem) => pasoItem.id === paso);
              const activo = index === actualPaso;
              const hecho = index < actualPaso;
              return (
                <Typography key={item.id} sx={{ fontSize: 13, fontWeight: activo ? 700 : 500, color: activo ? tokens.content.foreground : hecho ? tokens.content.secondary : tokens.content.muted }}>
                  {item.label}
                </Typography>
              );
            })}
            {archivo && <Typography sx={{ pt: 0.75, fontSize: 12, color: tokens.content.secondary }}>{archivo.name}</Typography>}
          </Stack>
        ))}

        {fase === 'decision' && preview && (
          <Stack spacing={1}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              {preview.filasInvalidas.length === 1 ? '1 fila no se puede leer' : `${preview.filasInvalidas.length} filas no se pueden leer`}
            </Typography>
            <Typography sx={{ fontSize: 12, color: tokens.content.secondary }}>
              {nuevas > 0 ? 'Puedes importar el resto.' : 'No quedó ningún movimiento nuevo para importar.'}
            </Typography>
            <Stack spacing={0.35} sx={{ maxHeight: 180, overflow: 'auto' }}>
              {preview.filasInvalidas.map((fila) => (
                <Typography key={fila.numeroFila} sx={{ fontSize: 12, color: tokens.content.foreground }}>
                  Fila {fila.numeroFila} · {fila.errores.join(', ')}
                </Typography>
              ))}
            </Stack>
          </Stack>
        )}

        {fase === 'aviso' && (
          <Alert severity="warning" sx={{ py: 0.5, fontSize: 13 }}>{aviso}</Alert>
        )}

        {fase === 'historial' && (
          <Stack spacing={0.75}>
            {imports.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: tokens.content.secondary }}>No hay importaciones para esta cuenta.</Typography>
            ) : imports.map((item) => (
              <Button key={String(item.id)} variant="outlined" disabled={ocupado} onClick={() => void abrirImportacion(item)} sx={{ justifyContent: 'flex-start', textTransform: 'none', textAlign: 'left', borderColor: tokens.content.border, color: tokens.content.foreground, py: 0.75 }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{String(item.nombre_original ?? 'Estado de cuenta')}</Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.content.secondary }}>
                    {fechaCorta(item.fecha_inicial)} a {fechaCorta(item.fecha_final)} · {Number(item.filas_nuevas ?? item.total_filas ?? 0)} movimientos · Retomar revisión
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        )}

        {enRevision && (
          <Stack spacing={0.75} sx={{ minHeight: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
              <Box sx={metricaSx(tokens.metric.available.background, tokens.metric.available.foreground)}>{totalClaras} coincidencias claras</Box>
              <Box sx={metricaSx(tokens.metric.amount.background, tokens.metric.amount.foreground)}>{totalRevision} requieren revisión</Box>
              <Box sx={metricaSx(tokens.metric.blocked.background, tokens.metric.blocked.foreground)}>{totalSin} sin coincidencia</Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={filtro}
                onChange={(_event, value: Filtro | null) => { if (value) setFiltro(value); }}
                sx={{
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontSize: 12,
                    px: 1.1,
                    py: 0.25,
                    color: tokens.content.secondary,
                    borderColor: tokens.content.border,
                    '&.Mui-selected': { color: tokens.content.foreground, bgcolor: tokens.content.hover },
                  },
                }}
              >
                <ToggleButton value="todos">Todos</ToggleButton>
                <ToggleButton value="revisar">Por revisar</ToggleButton>
                <ToggleButton value="encontrados">Encontrados</ToggleButton>
                <ToggleButton value="sin">Sin coincidencia</ToggleButton>
                <ToggleButton value="claras">Coincidencias claras</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" spacing={1} alignItems="center">
                {filtro === 'claras' && totalClaras > 0 && (
                  <Button variant="contained" disabled={ocupado} onClick={() => void aceptarClaras()} sx={{ textTransform: 'none', borderRadius: 999, fontSize: 12, py: 0.4 }}>
                    Aceptar todas las coincidencias claras
                  </Button>
                )}
                {meta?.desdeHistorial && (
                  <Button size="small" onClick={() => void buscarDeNuevo()} disabled={ocupado} sx={{ textTransform: 'none', fontSize: 12, color: tokens.content.secondary }}>
                    {ocupado && paso === 'buscando' ? 'Buscando coincidencias…' : 'Buscar de nuevo'}
                  </Button>
                )}
              </Stack>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${tokens.table.line}`, borderRadius: 1 }}>
              {movimientos.length === 0 ? (
                <Typography sx={{ p: 1.5, fontSize: 13, color: tokens.content.secondary }}>Esta importación no tiene movimientos.</Typography>
              ) : visibles.length === 0 ? (
                <Typography sx={{ p: 1.5, fontSize: 13, color: tokens.content.secondary }}>No hay movimientos en este filtro.</Typography>
              ) : (
                <Box component="table" sx={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: 28 }} />
                    <col />
                    <col style={{ width: 100 }} />
                  </colgroup>
                  <Box component="thead">
                    <Box component="tr">
                      {(['Banco', 'Estado', 'Coincidencia Emphasys', 'Acciones'] as const).map((columna) => (
                        <Box
                          component="th"
                          key={columna}
                          sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            px: columna === 'Estado' ? 0 : columna === 'Acciones' ? 0.25 : 0.75,
                            py: 0.45,
                            textAlign: columna === 'Acciones' ? 'center' : 'left',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: tokens.grid.headerForeground,
                            bgcolor: tokens.grid.header,
                            borderBottom: `1px solid ${tokens.grid.header}`,
                          }}
                          aria-label={columna}
                        >
                          {columna === 'Estado' ? (
                            <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>Estado</Box>
                          ) : columna}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {visibles.map((fila, indice) => {
                      const candidata = fila.visible;
                      const motivos = candidata ? razones(candidata) : [];
                      const acento = candidata?.nivel_confianza === 'alta'
                        ? tokens.metric.progressDone
                        : candidata?.nivel_confianza === 'media'
                          ? tokens.metric.progress
                          : candidata?.nivel_confianza === 'baja'
                            ? tokens.frame.accent
                            : 'transparent';
                      const mostrarAceptar = fila.estado === 'revisar' && Boolean(candidata);
                      const mostrarCambiar = Boolean(mostrarAceptar && !fila.clara && fila.alternativas.length > 0 && candidata);
                      const mostrarDescartar = Boolean(mostrarAceptar && !fila.clara && candidata);
                      const hueco = () => <Box sx={{ width: 22, height: 22, flexShrink: 0 }} />;
                      return (
                        <Box
                          component="tr"
                          key={fila.movimiento.id}
                          sx={{
                            borderBottom: `1px solid ${tokens.table.line}`,
                            verticalAlign: 'middle',
                            bgcolor: indice % 2 === 0 ? tokens.content.elevated : tokens.canvas.page,
                          }}
                        >
                          <Box component="td" sx={{ px: 0.75, py: 0.35, overflowWrap: 'anywhere', boxShadow: `inset 3px 0 0 ${acento}` }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
                              {fechaCorta(fila.movimiento.fecha)} · {etiquetaTipo(fila.movimiento.tipo)} · {money(fila.movimiento.importe, moneda)}
                            </Typography>
                            <Typography sx={{ fontSize: 11, lineHeight: 1.2, color: tokens.content.secondary }} noWrap>
                              {fila.movimiento.concepto || 'Sin concepto'} · {fila.movimiento.referencia || 'Sin referencia'}
                            </Typography>
                          </Box>
                          <Box component="td" sx={{ p: 0, textAlign: 'center', verticalAlign: 'middle', lineHeight: 0 }}>
                            <Tooltip title={etiquetaEstado(fila.estado)} arrow>
                              <Box component="span" aria-label={etiquetaEstado(fila.estado)} sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: colorEstado(fila.estado), lineHeight: 0, verticalAlign: 'middle' }}>
                                {iconoEstado(fila.estado)}
                              </Box>
                            </Tooltip>
                          </Box>
                          <Box component="td" sx={{ px: 0.75, py: 0.35, overflowWrap: 'anywhere' }}>
                            {candidata ? (
                              <>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }} noWrap>
                              {fechaCorta(candidata.operacion_fecha || candidata.fecha)} · {etiquetaTipo(candidata.tipo_movimiento)} · {money(Number(candidata.monto), moneda)}
                            </Typography>
                            <Typography sx={{ fontSize: 11, lineHeight: 1.2, color: tokens.content.secondary }} noWrap>
                              {candidata.observaciones || 'Sin concepto'} · {candidata.referencia || 'Sin referencia'} · {etiquetaNivel(candidata.nivel_confianza)}{motivos.length > 0 ? ` · ${motivos.join(' · ')}` : ''}
                            </Typography>
                              </>
                            ) : (
                              <Typography sx={{ fontSize: 12, lineHeight: 1.2, color: tokens.content.secondary }}>Sin propuesta</Typography>
                            )}
                          </Box>
                          <Box component="td" sx={{ px: 0.5, py: 0.15, verticalAlign: 'middle' }}>
                            <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-start">
                              {mostrarAceptar && candidata ? (
                                <Tooltip title="Aceptar coincidencia" arrow>
                                  <span>
                                    <IconButton size="small" aria-label="Aceptar coincidencia" disabled={ocupado} onClick={() => void resolver(candidata.id, 'confirmada')} sx={iconoFilaSx(ocupado)}>
                                      <CheckCircleIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : hueco()}
                              {mostrarCambiar && candidata ? (
                                <Tooltip title="Cambiar candidato" arrow>
                                  <span>
                                    <IconButton size="small" aria-label="Cambiar candidato" disabled={ocupado} onClick={(event) => setMenu({ id: fila.movimiento.id, el: event.currentTarget })} sx={iconoFilaSx(ocupado)}>
                                      <CompareArrowsIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : hueco()}
                              {mostrarDescartar && candidata ? (
                                <Tooltip title="No es esta" arrow>
                                  <span>
                                    <IconButton size="small" aria-label="No es esta" disabled={ocupado} onClick={() => void resolver(candidata.id, 'anulada')} sx={iconoFilaSx(ocupado)}>
                                      <CancelIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : hueco()}
                            </Stack>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <Popover
        open={Boolean(menu && filaMenu)}
        anchorEl={menu?.el}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: '92vw', p: 1, bgcolor: tokens.content.elevated, backgroundImage: 'none' } } }}
      >
        <Typography sx={{ px: 0.5, pb: 0.75, fontSize: 12, fontWeight: 700 }}>Otras opciones de este movimiento</Typography>
        <Stack spacing={0.75}>
          {(filaMenu?.alternativas ?? []).map((opcion) => (
            <Box key={opcion.id} sx={{ px: 1, py: 0.75, border: `1px solid ${tokens.content.border}`, borderRadius: 1, bgcolor: tokens.content.card }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{fechaCorta(opcion.operacion_fecha || opcion.fecha)} · {etiquetaTipo(opcion.tipo_movimiento)} · {money(Number(opcion.monto), moneda)}</Typography>
              <Typography sx={{ fontSize: 12 }}>{opcion.observaciones || 'Sin concepto'}</Typography>
              <Typography sx={{ fontSize: 11, color: tokens.content.secondary }}>{opcion.referencia || 'Sin referencia'}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{etiquetaNivel(opcion.nivel_confianza)}</Typography>
              <Typography sx={{ fontSize: 11, color: tokens.content.secondary }}>{razones(opcion).join(' · ') || 'Importe y fecha compatibles'}</Typography>
              <Button size="small" variant="contained" disabled={ocupado} onClick={() => void resolver(opcion.id, 'confirmada')} sx={{ mt: 0.6, textTransform: 'none', borderRadius: 999, fontSize: 11 }}>
                Aceptar esta
              </Button>
            </Box>
          ))}
        </Stack>
      </Popover>

      <DialogActions sx={{ px: 2, py: 1.1, borderTop: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.elevated, justifyContent: 'flex-end', gap: 1 }}>
        {fase === 'decision' && (
          <>
            <Button onClick={elegirOtro} sx={{ textTransform: 'none' }}>Cancelar</Button>
            {nuevas > 0 && archivo && (
              <Button variant="contained" disabled={ocupado} onClick={() => { const token = ++runId.current; setOcupado(true); setFase('proceso'); void importarYRevisar(archivo, token, preview?.duplicados ?? 0); }} sx={{ textTransform: 'none', borderRadius: 999 }}>
                Importar las demás
              </Button>
            )}
          </>
        )}

        {fase === 'aviso' && (
          <>
            <Button onClick={cerrar} sx={{ textTransform: 'none' }}>Cerrar</Button>
            {meta && (
              <Button variant="contained" onClick={() => void abrirImportacion({ id: meta.id, nombre_original: meta.nombre, fecha_inicial: meta.desde, fecha_final: meta.hasta, filas_duplicadas: meta.omitidos })} sx={{ textTransform: 'none', borderRadius: 1 }}>
                Retomar revisión
              </Button>
            )}
            <Button variant="contained" onClick={elegirOtro} sx={{ textTransform: 'none', borderRadius: 999 }}>Elegir otro archivo</Button>
          </>
        )}

        {fase === 'historial' && (
          <Button onClick={() => setFase('inicio')} sx={{ textTransform: 'none' }}>Volver</Button>
        )}

        {fase === 'inicio' && (
          <Button onClick={cerrar} sx={{ textTransform: 'none' }}>Cerrar</Button>
        )}

        {enRevision && (
          <>
            <Button
              variant="outlined"
              onClick={cancelarRevision}
              sx={{ textTransform: 'none', borderRadius: 1, borderColor: tokens.action.primary, color: tokens.action.primary, bgcolor: 'transparent', '&:hover': { bgcolor: tokens.action.hoverTint, borderColor: tokens.action.primary } }}
            >
              Cancelar
            </Button>
            <Button variant="contained" onClick={cerrar} sx={{ textTransform: 'none', borderRadius: 1 }}>Volver a conciliación</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
