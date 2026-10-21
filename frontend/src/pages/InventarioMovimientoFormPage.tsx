import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Alert,
  IconButton,
  Tooltip,
  InputBase,
  MenuItem,
  Autocomplete,
  createFilterOptions,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import SearchIcon from '@mui/icons-material/Search';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchProductos } from '../services/productosService';
import { fetchContactos } from '../services/contactosService';
import { fetchParametrosSistema } from '../services/parametrosService';
import { actualizarMovimiento, fetchAlmacenes, crearMovimientoManual, obtenerMovimientoDetalle, obtenerUltimoCosto } from '../services/inventarioService';
import type { Producto } from '../types/producto';
import type { Contacto } from '../types/contactos.types';
import type { Almacen, CrearMovimientoManualPayload, MovimientoPartidaPayload } from '../types/inventario';
import InventarioMovimientoErrorDialog, { type InventarioMovimientoError } from '../components/inventario/InventarioMovimientoErrorDialog';
import type { ApiFetchError } from '../services/apiFetch';
import { amountSignColor, inflowColor, outflowColor } from '../theme/sign';
import { FechaInput } from '../shared/dates/DateFields';

type TipoMovimiento = 'entrada' | 'salida' | 'transferencia';

type Partida = {
  id: string;
  sentido: TipoMovimiento;
  productoId: string;
  almacenOrigenId: string;
  almacenDestinoId: string;
  cantidad: string;
  costoUnitario: string;
  // Solo presentación: marca los almacenes que vinieron de la partida anterior (no se envía al backend).
  heredadoOrigen?: boolean;
  heredadoDestino?: boolean;
};

function normalizarPartidasEdicion(partidas: any[]): Partida[] {
  const consumidas = new Set<number>();
  const filas: Partida[] = [];

  partidas.forEach((p, index) => {
    if (consumidas.has(index) || p.tipo_partida === 'entrada_transferencia') return;

    const esSalidaTransferencia = p.tipo_partida === 'salida_transferencia';
    const cantidad = Math.abs(Number(p.cantidad));
    const pareja = partidas.find((c, candidateIndex) => {
      if (candidateIndex === index || consumidas.has(candidateIndex)) return false;
      if (Number(c.producto_id) !== Number(p.producto_id)) return false;
      if (Math.abs(Number(c.cantidad)) !== cantidad || Number(c.signo) !== 1) return false;
      if (c.tipo_partida === 'entrada_transferencia') return true;
      return partidas.length === 2
        && c.tipo_partida === 'normal'
        && Number(p.signo) === -1
        && Number(c.almacen_id) !== Number(p.almacen_id);
    });
    const parejaIndex = pareja ? partidas.indexOf(pareja) : -1;
    const transferencia = esSalidaTransferencia || Boolean(pareja);
    const salida = transferencia || Number(p.cantidad) < 0;

    if (transferencia && Number(p.signo) !== -1) return;
    if (transferencia) {
      consumidas.add(index);
      if (parejaIndex >= 0) consumidas.add(parejaIndex);
    }

    filas.push({
        id: String(p.id),
        sentido: transferencia ? 'transferencia' : salida ? 'salida' : 'entrada',
        productoId: String(p.producto_id),
        almacenOrigenId: salida ? String(p.almacen_origen_id ?? '') : '',
        almacenDestinoId: transferencia ? String(p.almacen_destino_id ?? pareja?.almacen_id ?? '') : !salida ? String(p.almacen_origen_id ?? '') : '',
        cantidad: String(cantidad),
        costoUnitario: transferencia ? '' : p.costo_unitario == null ? '' : String(p.costo_unitario),
    });
  });

  return filas;
}

const ZONA_OPERATIVA = 'America/Mexico_City';
const ALTO_CONTROL = 28;

const tipoMovimientoOptions: TipoMovimiento[] = ['entrada', 'salida', 'transferencia'];

const etiquetaTipo: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  transferencia: 'Transferencia',
};

const sentidoCorto: Record<TipoMovimiento, string> = {
  entrada: 'ENT',
  salida: 'SAL',
  transferencia: 'TRANS',
};

// Ayuda contextual de la partida activa (panel Resumen y título de los botones de sentido).
const ayudaSentido: Record<TipoMovimiento, string> = {
  entrada: 'El producto entra a un almacén. Indica el almacén destino y el costo unitario.',
  salida: 'El producto sale de un almacén. El costo promedio se calcula automáticamente a la fecha operativa.',
  transferencia: 'El producto se mueve entre dos almacenes conservando su valoración. Indica origen y destino.',
};

const ayudaCosteo: Record<TipoMovimiento, string> = {
  entrada: 'Costo unitario capturado.',
  salida: 'Costo promedio calculado por el sistema al guardar, a la fecha operativa.',
  transferencia: 'Conserva la valoración del almacén origen; no se recalcula en el destino.',
};

export default function InventarioMovimientoFormPage() {
  const navigate = useNavigate();
  const { movimientoId } = useParams<{ movimientoId?: string }>();
  const editando = Boolean(movimientoId);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const [fecha, setFecha] = useState<string>(() => (movimientoId ? '' : ahoraGuadalajara()));
  const partidasRef = useRef<Partida[]>([crearPartidaVacia()]);
  const focoProductoId = useRef<string | null>(null);
  const [focoTick, setFocoTick] = useState(0);
  const [observaciones, setObservaciones] = useState<string>('');
  const [contactoId, setContactoId] = useState<number | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [decimalesCantidad, setDecimalesCantidad] = useState(2);
  const [decimalesCosto, setDecimalesCosto] = useState(2);
  const [partidas, setPartidas] = useState<Partida[]>([crearPartidaVacia()]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);
  const [errorAlmacenes, setErrorAlmacenes] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [blockingError, setBlockingError] = useState<InventarioMovimientoError | null>(null);
  const [saving, setSaving] = useState(false);
  // Resumen adaptable: se mide el ancho real de la hoja del formulario (no de la ventana).
  // Abrirlo o cerrarlo a mano fija la elección durante la sesión del formulario.
  const [anchoHoja, setAnchoHoja] = useState(0);
  const [railManual, setRailManual] = useState<boolean | null>(null);
  const [filaActiva, setFilaActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSentido, setFiltroSentido] = useState<TipoMovimiento | 'todas'>('todas');
  const [folio, setFolio] = useState<string | null>(null);

  useEffect(() => {
    partidas.forEach((p) => {
      if (p.sentido === 'entrada' && p.productoId && !p.costoUnitario) {
        void obtenerUltimoCosto(Number(p.productoId)).then((c) => {
          if (c != null) setPartidas((prev) => prev.map((x) => x.id === p.id && !x.costoUnitario ? { ...x, costoUnitario: String(c) } : x));
        }).catch(() => undefined);
      }
    });
  }, [partidas.map((p) => `${p.id}:${p.productoId}:${p.sentido}`).join('|')]);

  const productosInventariables = useMemo(
    () => productos.filter((p) => (p.tipo_producto || '').toLowerCase() === 'inventariable'),
    [productos]
  );

  const filterProductos = useMemo(
    () =>
      createFilterOptions<Producto>({
        stringify: (option) => `${option.clave} ${option.descripcion}`.toLowerCase(),
      }),
    []
  );

  useEffect(() => {
    void cargarCatalogos();
  }, []);

  useEffect(() => {
    if (!movimientoId) return;
    obtenerMovimientoDetalle(Number(movimientoId)).then((detalle) => {
      const m = detalle.movimiento;
      if (m.estatus_afectacion !== 0 || m.documento_id != null || m.es_reversion) {
        setBlockingError({ title: 'Edición no permitida', message: 'Solo se pueden editar movimientos manuales desafectados.' });
        return;
      }
      setFecha(fechaRegistrada(m.fecha));
      setObservaciones(m.observaciones ?? '');
      setContactoId(m.contacto_id ?? null);
      if (m.serie && m.numero != null) setFolio(`${m.serie}-${Number(m.numero) < 1000 ? String(m.numero).padStart(3, '0') : String(m.numero).padStart(6, '0')}`);
      setPartidas(normalizarPartidasEdicion(detalle.partidas));
    }).catch(() => setBlockingError({ title: 'No se pudo cargar el movimiento', message: 'Intenta nuevamente.' }));
  }, [movimientoId]);

  useEffect(() => {
    void fetchParametrosSistema().then((modulos) => {
      const parametros = modulos.flatMap((modulo) => modulo.parametros);
      const cantidad = Number(parametros.find((parametro) => parametro.clave === 'decimales_cantidades')?.valor_resuelto);
      const costo = Number(parametros.find((parametro) => parametro.clave === 'decimales_costos')?.valor_resuelto);
      if (Number.isInteger(cantidad) && cantidad >= 0 && cantidad <= 6) setDecimalesCantidad(cantidad);
      if (Number.isInteger(costo) && costo >= 0 && costo <= 6) setDecimalesCosto(costo);
    }).catch(() => undefined);
  }, []);

  const cargarCatalogos = async () => {
    setLoadingProductos(true);
    setLoadingAlmacenes(true);
    setErrorProductos(null);
    setErrorAlmacenes(null);

    try {
      const [data, contactosData] = await Promise.all([fetchProductos(), fetchContactos()]);
      setProductos(data);
      setContactos(contactosData);
    } catch (err) {
      setErrorProductos(err instanceof Error ? err.message : 'No se pudieron cargar los productos');
      setProductos([]);
    } finally {
      setLoadingProductos(false);
    }

    try {
      const data = await fetchAlmacenes();
      setAlmacenes(deduplicarAlmacenesPorId(Array.isArray(data) ? data : []));
    } catch (err) {
      setErrorAlmacenes(err instanceof Error ? err.message : 'No se pudieron cargar los almacenes');
      setAlmacenes([]);
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  useLayoutEffect(() => {
    const hoja = sheetRef.current;
    if (!hoja) return;
    setAnchoHoja(Math.round(hoja.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAnchoHoja(Math.round(entrada.contentRect.width));
    });
    observador.observe(hoja);
    return () => observador.disconnect();
  }, [isMobile]);

  const railAbierto = railManual ?? (anchoHoja === 0 || anchoHoja - RIEL_ANCHO - 2 >= TABLA_COMODA);
  const encabezadoCompacto = anchoHoja > 0 && anchoHoja < ENCABEZADO_COMPACTO;

  partidasRef.current = partidas;

  // La fila "Agregar partida" hereda sentido y almacenes de la última partida (nunca producto, cantidad ni costo).
  const handleAgregarPartida = () => {
    const prev = partidasRef.current;
    const ultima = prev[prev.length - 1];
    const nueva = ultima ? heredarPartida(ultima) : crearPartidaVacia();
    const next = [...prev, nueva];
    partidasRef.current = next;
    setPartidas(next);
    setFilaActiva(nueva.id);
    focoProductoId.current = nueva.id;
    setFocoTick((tick) => tick + 1);
  };

  const handleContinuarCaptura = (id: string) => {
    const prev = partidasRef.current;
    const idx = prev.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const origen = prev[idx];
    if (!origen || !partidaListaParaContinuar(origen, decimalesCantidad)) return;

    const siguiente = prev[idx + 1];
    const destino = siguiente && filaHeredadaVacia(siguiente, origen) ? siguiente : heredarPartida(origen);
    if (destino.id !== siguiente?.id) {
      const next = prev.slice();
      next.splice(idx + 1, 0, destino);
      partidasRef.current = next;
      setPartidas(next);
    }
    setFilaActiva(destino.id);
    focoProductoId.current = destino.id;
    setFocoTick((tick) => tick + 1);
  };

  useEffect(() => {
    const id = focoProductoId.current;
    if (!id) return;
    const enfocar = () => {
      const inicio = document.querySelector<HTMLElement>(`[data-partida-inicio="${CSS.escape(id)}"]`);
      if (!inicio) return false;
      inicio.focus();
      inicio.scrollIntoView({ block: 'nearest' });
      return true;
    };
    const frame = window.requestAnimationFrame(() => {
      if (enfocar()) focoProductoId.current = null;
    });
    const timer = window.setTimeout(() => {
      if (enfocar()) focoProductoId.current = null;
    }, 40);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focoTick, partidas]);

  const handleEliminarPartida = (id: string) => {
    setPartidas((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  const handlePartidaChange = (id: string, field: keyof Partida, value: string) => {
    setPartidas((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const next: Partida = { ...p, [field]: value };
      if (field === 'almacenOrigenId') next.heredadoOrigen = false;
      if (field === 'almacenDestinoId') next.heredadoDestino = false;
      return next;
    }));
  };

  const handleSentidoChange = (id: string, sentido: TipoMovimiento) => {
    setPartidas((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.sentido === sentido) return p;
        const next: Partida = { ...p, sentido };
        if (sentido === 'entrada') next.almacenOrigenId = '';
        if (sentido === 'salida') next.almacenDestinoId = '';
        return next;
      })
    );
  };

  const rowsConsecutivas = useMemo(
    () => partidas.map((p, idx) => ({ ...p, numero: idx + 1 })),
    [partidas]
  );

  const sentidosPresentes = useMemo(() => Array.from(new Set(partidas.map((p) => p.sentido))), [partidas]);
  const esMixta = sentidosPresentes.length > 1;
  const sentidoUnico = sentidosPresentes.length === 1 ? sentidosPresentes[0] : null;

  const conteoPorSentido = useMemo(() => {
    const c: Record<TipoMovimiento, number> = { entrada: 0, salida: 0, transferencia: 0 };
    partidas.forEach((p) => { c[p.sentido] += 1; });
    return c;
  }, [partidas]);

  const avisoAlmacenesDuplicados = useMemo(() => avisoAlmacenesMismoNombre(almacenes), [almacenes]);

  // Efecto en unidades por almacén (solo cantidades; no se estiman importes).
  const efectoPorAlmacen = useMemo(() => {
    const mapa = new Map<string, { unidades: number; partidas: number }>();
    const sumar = (id: string, unidades: number) => {
      if (!id) return;
      const actual = mapa.get(id) ?? { unidades: 0, partidas: 0 };
      actual.unidades += unidades;
      actual.partidas += 1;
      mapa.set(id, actual);
    };
    partidas.forEach((p) => {
      const cantidad = numeroCantidad(p.cantidad, decimalesCantidad) ?? 0;
      if (p.sentido === 'entrada') sumar(p.almacenDestinoId, cantidad);
      else if (p.sentido === 'salida') sumar(p.almacenOrigenId, -cantidad);
      else {
        sumar(p.almacenOrigenId, -cantidad);
        sumar(p.almacenDestinoId, cantidad);
      }
    });
    return [...mapa.entries()].map(([id, v]) => ({
      id,
      nombre: almacenes.find((a) => String(a.id) === id)?.nombre ?? `Almacén ${id}`,
      ...v,
    }));
  }, [partidas, almacenes, decimalesCantidad]);

  const partidaCoincide = (p: Partida) => {
    const matchSentido = filtroSentido === 'todas' || p.sentido === filtroSentido;
    if (!matchSentido) return false;
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return true;
    const prod = productosInventariables.find((x) => String(x.id) === p.productoId);
    const texto = `${prod?.clave ?? ''} ${prod?.descripcion ?? ''}`.toLowerCase();
    return texto.includes(termino);
  };

  const totalCoincidentes = useMemo(() => partidas.filter(partidaCoincide).length, [partidas, busqueda, filtroSentido, productosInventariables]);
  const filtroActivo = busqueda.trim().length > 0 || filtroSentido !== 'todas';

  const handleGuardar = () => {
    setFormError(null);

    const capturadas = partidas.filter((p) => !partidaSinCaptura(p));
    if (!capturadas.length) {
      setFormError('Agrega al menos una partida.');
      return;
    }

    const sentidosCapturados = Array.from(new Set(capturadas.map((p) => p.sentido)));
    const tipoMovimiento = sentidosCapturados.length > 1 ? 'mixto' : sentidosCapturados[0] as TipoMovimiento;

    for (const p of capturadas) {
      const showOrigen = p.sentido !== 'entrada';
      const showDestino = p.sentido !== 'salida';

      if (!p.productoId) {
        setFormError('Todas las partidas deben tener un producto.');
        return;
      }

      const cantidad = numeroCantidad(p.cantidad, decimalesCantidad);
      if (cantidad == null || cantidad <= 0) {
        setFormError('Cada partida debe tener una cantidad mayor a cero.');
        return;
      }

      if (showOrigen && !p.almacenOrigenId) {
        setFormError('El almacén de origen es obligatorio para esta partida.');
        return;
      }

      if (showDestino && !p.almacenDestinoId) {
        setFormError('El almacén de destino es obligatorio para esta partida.');
        return;
      }
      if (p.sentido === 'entrada' && (p.costoUnitario === '' || Number(p.costoUnitario) < 0 || !Number.isFinite(Number(p.costoUnitario)))) {
        setFormError('Las entradas requieren un costo unitario numérico no negativo.');
        return;
      }
    }

    const toNumberOrNull = (value: string) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const payload: CrearMovimientoManualPayload = {
      tipo_movimiento: tipoMovimiento,
      fecha: fechaCivilGuadalajara(fecha),
      observaciones: observaciones || null,
      contacto_id: contactoId,
      partidas: capturadas.map<MovimientoPartidaPayload>((p) => {
        const origen = toNumberOrNull(p.almacenOrigenId);
        const destino = toNumberOrNull(p.almacenDestinoId);

        let almacen_id: number | null = null;
        let almacen_destino_id: number | null = null;

        if (p.sentido === 'entrada') {
          almacen_id = destino;
          almacen_destino_id = null;
        } else if (p.sentido === 'salida') {
          almacen_id = origen;
          almacen_destino_id = null;
        } else {
          almacen_id = origen;
          almacen_destino_id = destino;
        }

        return {
          producto_id: Number(p.productoId),
          almacen_id: almacen_id as number,
          almacen_destino_id: p.sentido === 'transferencia' ? almacen_destino_id : null,
          cantidad: canonCantidad(p.cantidad, false, decimalesCantidad),
          costo_unitario: p.sentido === 'entrada' ? Number(p.costoUnitario) : null,
          sentido: p.sentido,
        };
      }),
    };

    setSaving(true);
    (editando ? actualizarMovimiento(Number(movimientoId), payload).then(() => Number(movimientoId)) : crearMovimientoManual(payload).then((resultado) => Number((resultado as { movimientoId?: number }).movimientoId)))
      .then((id) => {
        navigate('/inventario/movimientos', {
          state: {
            snackbar: { message: editando ? 'Movimiento editado y afectado correctamente' : 'Movimiento guardado correctamente', severity: 'success' as const },
            ...(Number.isInteger(id) && id > 0 ? { movimientoId: id } : {}),
          },
        });
      })
      .catch((err) => {
        const apiError = err as ApiFetchError;
        const detalle = (apiError.payload as any)?.detalle;
        const code = (apiError.payload as any)?.code;
        if (apiError.status === 409 && code === 'EXISTENCIA_INSUFICIENTE' && detalle) {
          setBlockingError({
            title: 'Existencia insuficiente',
            message: `No hay suficientes unidades de ${detalle.producto} en ${detalle.almacen}.`,
            details: [
              { label: 'Existencia disponible', value: formatearCantidad(detalle.disponible) },
              { label: 'Cantidad solicitada', value: formatearCantidad(detalle.solicitado) },
            ],
          });
        } else {
          const message = code === 'COSTO_ENTRADA_REQUERIDO'
            ? 'El historial de costos del producto no está completo. No se inventó una valoración y la operación fue revertida.'
            : code === 'COSTO_NO_DISPONIBLE'
              ? 'No existe un costo válido para valorar esta salida. La operación fue revertida.'
              : code === 'COSTO_TRANSFERENCIA_NO_DISPONIBLE'
                ? 'No existe una valoración válida en el almacén origen para completar la transferencia.'
                : 'No fue posible registrar la operación. El sistema no realizó ningún cambio. Inténtalo nuevamente.';
          setBlockingError({ title: code === 'COSTO_ENTRADA_REQUERIDO' ? 'Historial de costos incompleto' : 'Movimiento no registrado', message });
        }
      })
      .finally(() => setSaving(false));
  };

  const handleCancelar = () => {
    navigate('/inventario/movimientos');
  };

  const partidaActiva = partidas.find((p) => p.id === filaActiva) ?? null;
  const numeroActiva = partidaActiva ? partidas.indexOf(partidaActiva) + 1 : 0;
  const tipoActual: TipoMovimiento | 'mixto' | null = esMixta ? 'mixto' : sentidoUnico ?? null;
  const totalUnidades = partidas.reduce((suma, p) => suma + (numeroCantidad(p.cantidad, decimalesCantidad) ?? 0), 0);
  const deshabilitarGuardar = saving || (editando && !fecha);

  const resumen = (
    <ResumenOperativo
      totalPartidas={partidas.length}
      conteo={conteoPorSentido}
      efecto={efectoPorAlmacen}
      decimalesCantidad={decimalesCantidad}
      partidaActiva={partidaActiva}
      numeroActiva={numeroActiva}
      onColapsar={isMobile ? undefined : () => setRailManual(false)}
    />
  );

  const acciones = (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
      <Tooltip title="Regresar">
        <span>
          <IconButton
            onClick={handleCancelar}
            disabled={saving}
            aria-label="Regresar"
            tabIndex={-1}
            sx={{ border: '1px solid', borderColor: 'primary.main', color: 'primary.main', borderRadius: 1 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={saving ? 'Guardando...' : 'Guardar (⌘/Ctrl + Enter)'}>
        <span>
          <IconButton
            onClick={handleGuardar}
            disabled={deshabilitarGuardar}
            aria-label="Guardar"
            tabIndex={-1}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: 1,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: (theme) => theme.emphasys.action.disabled, color: 'primary.contrastText' },
            }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : <CheckIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  return (
    <Box
      onKeyDownCapture={(event) => {
        // Guardado explícito con ⌘/Ctrl + Enter; se intercepta antes de la captura continua de las filas.
        if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
        event.preventDefault();
        event.stopPropagation();
        if (!deshabilitarGuardar) handleGuardar();
      }}
      sx={(theme) => ({
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        px: { xs: 1, md: 2 },
        pt: { xs: 1, md: 1.75 },
        pb: { xs: 1, md: 0 },
        overflow: { xs: 'auto', md: 'hidden' },
        bgcolor: theme.emphasys.canvas.page,
      })}
    >
      {formError && <Alert severity="error" onClose={() => setFormError(null)} sx={{ py: 0 }}>{formError}</Alert>}
      {errorProductos && <Alert severity="warning" sx={{ py: 0 }}>{errorProductos}</Alert>}
      {errorAlmacenes && <Alert severity="warning" sx={{ py: 0 }}>{errorAlmacenes}</Alert>}
      {avisoAlmacenesDuplicados && <Alert severity="info" sx={{ py: 0 }}>{avisoAlmacenesDuplicados}</Alert>}
      <InventarioMovimientoErrorDialog error={blockingError} onClose={() => setBlockingError(null)} />

      {/* Hoja: encabezado beige a todo el ancho · partidas · riel de resumen integrado · barra inferior */}
      <Box
        ref={sheetRef}
        sx={(theme) => ({
          flex: isMobile ? 'none' : 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : `minmax(0,1fr) ${railAbierto ? RIEL_ANCHO : RIEL_MINIMO}px`,
          gridTemplateRows: isMobile ? 'auto auto auto' : 'auto minmax(0,1fr) auto',
          bgcolor: theme.emphasys.content.background,
          border: `1px solid ${theme.emphasys.content.border}`,
          borderBottom: isMobile ? undefined : 0,
          borderRadius: isMobile ? '10px' : '10px 10px 0 0',
          overflow: 'hidden',
        })}
      >
        {/* Encabezado */}
        <Box
          sx={(theme) => ({
            gridColumn: '1 / -1',
            bgcolor: theme.emphasys.action.wash,
            borderBottom: `1px solid ${theme.emphasys.content.border}`,
            px: { xs: 2, md: 2.75 },
            pt: { xs: 1.75, md: 2.25 },
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : encabezadoCompacto ? 'minmax(0,1fr) auto' : 'auto minmax(0,1fr) auto',
            columnGap: 3.5,
            rowGap: 1,
          })}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.emphasys.content.muted })}>
              Movimiento de inventario
              {tipoActual && <ChipTipo tipo={tipoActual} />}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mt: 0.5 }}>
              <Typography variant="figure" sx={(theme) => ({ fontSize: { xs: 24, md: 30 }, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.01em', color: theme.emphasys.content.foreground, fontVariantNumeric: 'tabular-nums' })}>
                {editando ? folio ?? 'Movimiento' : 'Nuevo movimiento'}
              </Typography>
              <Typography sx={(theme) => ({ fontSize: 12, fontWeight: 500, color: theme.emphasys.content.muted, whiteSpace: 'nowrap' })}>
                {editando ? 'Editando' : 'El folio se asigna al guardar'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              gridColumn: isMobile || encabezadoCompacto ? '1 / -1' : 'auto',
              gridRow: !isMobile && encabezadoCompacto ? 2 : 'auto',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : '150px minmax(180px,1fr) minmax(200px,1.4fr)',
              columnGap: 2.75,
              rowGap: 1.5,
              alignSelf: 'end',
              pb: encabezadoCompacto || isMobile ? 1.5 : 1.75,
            }}
          >
            <CampoMeta etiqueta="Fecha operativa">
              <CampoFechaOperativa value={fecha} onChange={setFecha} enfocarAlMontar={!editando} />
            </CampoMeta>
            <CampoMeta etiqueta="Contacto">
              <Autocomplete<Contacto>
                size="small"
                options={contactos}
                value={contactos.find((c) => c.id === contactoId) ?? null}
                onChange={(_, value) => setContactoId(value?.id ?? null)}
                getOptionLabel={(option) => option.nombre || option.nombre_contacto || `Contacto #${option.id}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...(params as object)} placeholder="Opcional" variant="standard" sx={campoMetaSx} />}
              />
            </CampoMeta>
            <Box sx={{ gridColumn: isMobile ? '1 / -1' : 'auto', minWidth: 0 }}>
              <CampoMeta etiqueta="Observaciones">
                <TextField
                  size="small"
                  fullWidth
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Nota de la operación"
                  variant="standard"
                  sx={campoMetaSx}
                />
              </CampoMeta>
            </Box>
          </Box>

          <Box sx={{ gridColumn: isMobile ? 'auto' : encabezadoCompacto ? 2 : 3, gridRow: isMobile ? 'auto' : 1, pb: isMobile ? 1 : 0 }}>
            {acciones}
          </Box>

          {/* Filtros por sentido (atenúan, no ocultan) + búsqueda */}
          <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 2.25, rowGap: 0.5, mt: 0.5 }}>
            <Box role="tablist" sx={{ display: 'flex', gap: { xs: 1.75, md: 2.75 } }}>
              <PestanaFiltro label="Todas" count={partidas.length} activo={filtroSentido === 'todas'} onClick={() => setFiltroSentido('todas')} tabIndex={-1} />
              <PestanaFiltro label="Entradas" count={conteoPorSentido.entrada} activo={filtroSentido === 'entrada'} onClick={() => setFiltroSentido('entrada')} tabIndex={-1} />
              <PestanaFiltro label="Salidas" count={conteoPorSentido.salida} activo={filtroSentido === 'salida'} onClick={() => setFiltroSentido('salida')} tabIndex={-1} />
              <PestanaFiltro label="Transferencias" count={conteoPorSentido.transferencia} activo={filtroSentido === 'transferencia'} onClick={() => setFiltroSentido('transferencia')} tabIndex={-1} />
            </Box>
            <Box sx={{ flex: 1 }} />
            {filtroActivo && (
              <Typography sx={(theme) => ({ fontSize: 11, color: theme.emphasys.content.muted, pb: 1.1 })}>
                Mostrando {totalCoincidentes} de {partidas.length}; el resto sigue capturado
              </Typography>
            )}
            <Box
              sx={(theme) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                pb: 0.9,
                color: theme.emphasys.content.muted,
                borderBottom: '1px solid transparent',
                '&:focus-within': { borderBottomColor: theme.emphasys.content.foreground },
              })}
            >
              <SearchIcon sx={{ fontSize: 15 }} />
              <InputBase
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar clave o producto"
                inputProps={{ 'aria-label': 'Buscar clave o producto', tabIndex: -1 }}
                sx={(theme) => ({ width: { xs: 150, md: 190 }, fontSize: 13, color: theme.emphasys.content.foreground, '& input': { p: 0 } })}
              />
            </Box>
          </Box>
        </Box>

        {/* Partidas */}
        {isMobile ? (
          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {rowsConsecutivas.map((partida) => (
              <PartidaMovil
                key={partida.id}
                partida={partida}
                productos={productosInventariables}
                almacenes={almacenes}
                loadingProductos={loadingProductos}
                loadingAlmacenes={loadingAlmacenes}
                errorProductos={errorProductos}
                filterProductos={filterProductos}
                puedeEliminar={partidas.length > 1}
                atenuada={!partidaCoincide(partida)}
                onFocusFila={() => setFilaActiva(partida.id)}
                onChange={handlePartidaChange}
                onSentidoChange={handleSentidoChange}
                onEliminar={handleEliminarPartida}
                onContinuar={handleContinuarCaptura}
                decimalesCantidad={decimalesCantidad}
                decimalesCosto={decimalesCosto}
              />
            ))}
            <FilaAgregar onClick={handleAgregarPartida} movil />
          </Box>
        ) : (
          <Box sx={(theme) => ({ gridColumn: 1, gridRow: 2, minWidth: 0, minHeight: 0, overflow: 'auto', bgcolor: theme.emphasys.content.background })}>
            <Box sx={{ minWidth: TABLA_MINIMA }}>
              <Box
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: COLUMNAS,
                  alignItems: 'center',
                  height: 34,
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  bgcolor: theme.emphasys.grid.header,
                  color: theme.emphasys.grid.headerForeground,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  '& > span': { overflow: 'hidden' },
                })}
              >
                <Box component="span" sx={{ pl: '16px' }}>#</Box>
                <Box component="span" sx={{ pl: `${CELDA_PX}px` }}>Sentido</Box>
                <Box component="span" sx={{ pl: `${TEXTO_PX}px` }}>Producto</Box>
                <Box component="span" sx={{ pl: `${TEXTO_PX}px` }}>Almacén</Box>
                <Box component="span" sx={{ pr: `${TEXTO_PX}px`, textAlign: 'right' }}>Cantidad</Box>
                <Box component="span" sx={{ pr: `${TEXTO_PX}px`, textAlign: 'right' }}>Costo</Box>
                <span />
              </Box>
              {rowsConsecutivas.map((partida, index) => (
                <FilaPartida
                  key={partida.id}
                  partida={partida}
                  index={index}
                  activa={filaActiva === partida.id}
                  atenuada={!partidaCoincide(partida)}
                  productos={productosInventariables}
                  almacenes={almacenes}
                  loadingProductos={loadingProductos}
                  loadingAlmacenes={loadingAlmacenes}
                  errorProductos={errorProductos}
                  filterProductos={filterProductos}
                  puedeEliminar={partidas.length > 1}
                  onFocusFila={() => setFilaActiva(partida.id)}
                  onChange={handlePartidaChange}
                  onSentidoChange={handleSentidoChange}
                  onEliminar={handleEliminarPartida}
                  onContinuar={handleContinuarCaptura}
                  decimalesCantidad={decimalesCantidad}
                  decimalesCosto={decimalesCosto}
                />
              ))}
              <FilaAgregar onClick={handleAgregarPartida} />
            </Box>
          </Box>
        )}

        {/* Resumen: riel integrado (nunca encima de la tabla); en móvil va debajo de las partidas */}
        {isMobile ? (
          <Box sx={(theme) => ({ borderTop: `1px solid ${theme.emphasys.content.border}`, bgcolor: theme.emphasys.action.wash })}>{resumen}</Box>
        ) : (
          <Box
            component="aside"
            aria-label="Resumen"
            sx={(theme) => ({
              gridColumn: 2,
              gridRow: '2 / 4',
              borderLeft: `1px solid ${theme.emphasys.content.border}`,
              bgcolor: theme.emphasys.action.wash,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            })}
          >
            {railAbierto ? resumen : <RielMinimo conteo={conteoPorSentido} onExpandir={() => setRailManual(true)} />}
          </Box>
        )}

        {/* Barra inferior */}
        {!isMobile && (
          <Box
            sx={(theme) => ({
              gridColumn: 1,
              gridRow: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2.25,
              px: 2,
              height: 40,
              borderTop: `1px solid ${theme.emphasys.content.border}`,
              bgcolor: theme.emphasys.action.wash,
              color: theme.emphasys.content.muted,
              fontSize: 11.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            })}
          >
            <Atajo teclas={['Tab']} texto="siguiente campo" />
            <Atajo teclas={['Enter']} texto="nueva partida" />
            <Atajo teclas={['Alt', 'E', 'S', 'T']} texto="cambia sentido" />
            <Box sx={{ flex: 1 }} />
            <Typography component="span" sx={(theme) => ({ fontSize: 11.5, color: theme.emphasys.content.secondary, fontVariantNumeric: 'tabular-nums', '& b': { color: theme.emphasys.content.foreground, fontWeight: 600 } })}>
              <b>{partidas.length}</b> {partidas.length === 1 ? 'partida' : 'partidas'} · <b>{presentarCantidad(totalUnidades.toFixed(decimalesCantidad), decimalesCantidad) || '0'}</b> unidades capturadas
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ---------- Retícula de partidas ----------
   Anchos fijos por columna; Almacén toma 24% y Producto el resto. Cada celda tiene 6px de padding y cada control
   1px de borde + 8px de padding interior, así el texto de los encabezados queda a 6 + 1 + 8 = 15px, igual que los datos.
   El foco cambia color y sombra del control, nunca sus dimensiones. */
const CELDA_PX = 6;
const TEXTO_PX = 15;
const COLUMNAS = '42px 120px minmax(0,1fr) 24% 96px 112px 30px';
const TABLA_MINIMA = 820;
const ALTO_FILA = 44;
const ALTO_FILA_TRANSFERENCIA = 52;
const ALTO_PAR = 44;
const RIEL_ANCHO = 300;
const RIEL_MINIMO = 44;
// Ancho cómodo de la tabla: si al restar el riel abierto la tabla queda por debajo, el resumen inicia colapsado.
const TABLA_COMODA = 1000;
const ENCABEZADO_COMPACTO = 1240;

function colorSentido(theme: Theme, tipo: TipoMovimiento) {
  const m = theme.emphasys.metric;
  if (tipo === 'entrada') return { bg: m.applied.background, fg: inflowColor(theme.emphasys) };
  if (tipo === 'salida') return { bg: m.blocked.background, fg: outflowColor(theme.emphasys) };
  return { bg: m.available.background, fg: m.available.foreground };
}

function colorCantidad(theme: Theme, tipo: TipoMovimiento) {
  if (tipo === 'entrada') return inflowColor(theme.emphasys);
  if (tipo === 'salida') return outflowColor(theme.emphasys);
  return theme.emphasys.grid.header;
}

const campoMetaSx = (theme: Theme) => ({
  '& .MuiInputBase-root': { fontSize: 14, color: theme.emphasys.content.foreground },
  '& .MuiInputBase-input': { fontSize: 14, py: '4px', px: 0 },
  '& .MuiInput-underline:before': { borderBottomColor: theme.emphasys.content.border },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: theme.emphasys.content.muted },
  '& .MuiInput-underline:after': { borderBottomColor: theme.emphasys.content.foreground, borderBottomWidth: 1 },
});

function campoFilaSx(theme: Theme, align: 'left' | 'right' = 'left', color?: string) {
  return {
    width: '100%',
    minWidth: 0,
    m: 0,
    '& .MuiInputBase-root, & .MuiAutocomplete-inputRoot': {
      height: ALTO_CONTROL,
      minHeight: ALTO_CONTROL,
      p: '0 !important',
      borderRadius: '4px',
      bgcolor: theme.emphasys.documentNav.selectedBackground,
      fontSize: 12.5,
      color: color ?? theme.emphasys.content.foreground,
      fontWeight: color ? 600 : 400,
      alignItems: 'center',
      boxSizing: 'border-box',
    },
    '& .MuiOutlinedInput-notchedOutline': { top: 0, borderColor: theme.emphasys.content.border, borderWidth: '1px !important', '& legend': { display: 'none' } },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.emphasys.table.muted },
    '& .MuiInputBase-root.Mui-focused': { boxShadow: `0 0 0 2px ${alpha(theme.emphasys.action.info, 0.18)}` },
    '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.emphasys.content.secondary },
    '& .MuiInputBase-input, & .MuiAutocomplete-input': {
      height: `${ALTO_CONTROL}px !important`,
      p: `0 ${TEXTO_PX - CELDA_PX}px !important`,
      boxSizing: 'border-box',
      textAlign: align,
      textOverflow: 'ellipsis',
      fontSize: '12.5px !important',
      fontVariantNumeric: 'tabular-nums',
    },
    '& .MuiInputBase-adornedStart .MuiInputBase-input, & .MuiInputBase-adornedStart .MuiAutocomplete-input': { pl: '0 !important' },
    '& .MuiSelect-select': {
      height: `${ALTO_CONTROL}px !important`,
      minHeight: '0 !important',
      lineHeight: `${ALTO_CONTROL - 2}px`,
      p: `0 26px 0 ${TEXTO_PX - CELDA_PX}px !important`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& .MuiSelect-icon': { right: 4, fontSize: 16, color: theme.emphasys.table.muted },
    '& .MuiAutocomplete-endAdornment': { right: '4px !important' },
    '& .MuiInputLabel-root': { display: 'none' },
  } as const;
}

function ChipTipo({ tipo }: { tipo: TipoMovimiento | 'mixto' }) {
  return (
    <Box
      component="span"
      sx={(theme) => {
        const c = tipo === 'mixto' ? { bg: theme.emphasys.action.tint, fg: theme.emphasys.content.foreground } : colorSentido(theme, tipo);
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          borderRadius: '999px',
          px: '9px',
          py: '2px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'none',
          bgcolor: c.bg,
          color: c.fg,
          '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' },
        };
      }}
    >
      {tipo === 'mixto' ? 'Mixto' : etiquetaTipo[tipo]}
    </Box>
  );
}

function CampoMeta({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={(theme) => ({ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.emphasys.content.muted, mb: 0.5 })}>
        {etiqueta}
      </Typography>
      {children}
    </Box>
  );
}

function PestanaFiltro({ label, count, activo, onClick, tabIndex = 0 }: { label: string; count: number; activo: boolean; onClick: () => void; tabIndex?: number }) {
  return (
    <Box
      component="button"
      type="button"
      role="tab"
      aria-selected={activo}
      tabIndex={tabIndex}
      onClick={onClick}
      sx={(theme) => ({
        border: 0,
        borderBottom: `2px solid ${activo ? theme.emphasys.content.foreground : 'transparent'}`,
        mb: '-1px',
        background: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        fontWeight: activo ? 700 : 500,
        color: activo ? theme.emphasys.content.foreground : theme.emphasys.content.muted,
        p: '8px 0 10px',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.75,
        '&:focus-visible': { outline: `2px solid ${theme.emphasys.action.info}`, outlineOffset: 2 },
      })}
    >
      {label}
      <Box component="span" sx={(theme) => ({ fontSize: 11, fontWeight: 500, color: activo ? theme.emphasys.content.secondary : theme.emphasys.table.muted, fontVariantNumeric: 'tabular-nums' })}>
        {count}
      </Box>
    </Box>
  );
}

function SelectorSentido({ partidaId, valor, onChange }: { partidaId: string; valor: TipoMovimiento; onChange: (v: TipoMovimiento) => void }) {
  const mover = (direccion: 1 | -1) => {
    const indice = tipoMovimientoOptions.indexOf(valor);
    const siguiente = tipoMovimientoOptions[(indice + direccion + tipoMovimientoOptions.length) % tipoMovimientoOptions.length];
    if (!siguiente) return;
    onChange(siguiente);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-sentido-opcion="${CSS.escape(`${partidaId}:${siguiente}`)}"]`)?.focus();
    });
  };
  return (
    <Box
      role="radiogroup"
      aria-label="Sentido"
      sx={(theme) => ({
        display: 'inline-grid',
        gridAutoFlow: 'column',
        gridAutoColumns: 'max-content',
        height: ALTO_CONTROL,
        border: `1px solid ${theme.emphasys.content.border}`,
        borderRadius: '4px',
        overflow: 'hidden',
        bgcolor: theme.emphasys.documentNav.selectedBackground,
        flex: 'none',
      })}
    >
      {tipoMovimientoOptions.map((opt) => {
        const activo = opt === valor;
        return (
          <Box
            key={opt}
            component="button"
            type="button"
            role="radio"
            aria-label={etiquetaTipo[opt]}
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            data-sentido-opcion={`${partidaId}:${opt}`}
            {...(activo ? { 'data-partida-inicio': partidaId } : {})}
            title={`${etiquetaTipo[opt]}: ${ayudaSentido[opt]}`}
            onClick={() => onChange(opt)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              event.stopPropagation();
              mover(event.key === 'ArrowRight' ? 1 : -1);
            }}
            sx={(theme) => ({
              height: '100%',
              p: '0 5px',
              border: 0,
              '& + &': { borderLeft: `1px solid ${theme.emphasys.content.border}` },
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: activo ? colorSentido(theme, opt).fg : theme.emphasys.table.muted,
              bgcolor: activo ? colorSentido(theme, opt).bg : 'transparent',
              '&:hover': { color: activo ? colorSentido(theme, opt).fg : theme.emphasys.content.foreground },
              '&:focus-visible': { outline: 'none', boxShadow: `inset 0 0 0 2px ${alpha(theme.emphasys.action.info, 0.35)}` },
            })}
          >
            {sentidoCorto[opt]}
          </Box>
        );
      })}
    </Box>
  );
}

function CeldaAlmacen({
  sentido,
  partida,
  almacenes,
  loading,
  onChange,
}: {
  sentido: TipoMovimiento;
  partida: Partida;
  almacenes: Almacen[];
  loading: boolean;
  onChange: (id: string, field: keyof Partida, value: string) => void;
}) {
  if (sentido === 'transferencia') {
    // Una sola caja con dos líneas: origen arriba, destino abajo; franja interior azul de 2px que no mueve el texto.
    return (
      <Box
        role="group"
        aria-label="Origen y destino"
        sx={(theme) => ({
          width: '100%',
          minWidth: 0,
          height: ALTO_PAR,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.emphasys.content.border}`,
          borderRadius: '4px',
          bgcolor: theme.emphasys.documentNav.selectedBackground,
          boxShadow: `inset 2px 0 0 ${colorSentido(theme, 'transferencia').fg}`,
          overflow: 'hidden',
          boxSizing: 'border-box',
          '&:hover': { borderColor: theme.emphasys.table.muted },
          '&:focus-within': {
            borderColor: theme.emphasys.content.secondary,
            boxShadow: `inset 2px 0 0 ${colorSentido(theme, 'transferencia').fg}, 0 0 0 2px ${alpha(theme.emphasys.action.info, 0.18)}`,
          },
        })}
      >
        <SelectorAlmacen
          linea
          label="Almacén origen"
          value={partida.almacenOrigenId}
          heredado={partida.heredadoOrigen}
          almacenes={almacenes}
          loading={loading}
          onChange={(value) => onChange(partida.id, 'almacenOrigenId', value)}
        />
        <SelectorAlmacen
          linea
          destino
          label="Almacén destino"
          value={partida.almacenDestinoId}
          heredado={partida.heredadoDestino}
          almacenes={almacenes}
          loading={loading}
          onChange={(value) => onChange(partida.id, 'almacenDestinoId', value)}
        />
      </Box>
    );
  }
  if (sentido === 'entrada') {
    return (
      <SelectorAlmacen
        label="Almacén destino"
        value={partida.almacenDestinoId}
        heredado={partida.heredadoDestino}
        almacenes={almacenes}
        loading={loading}
        onChange={(value) => onChange(partida.id, 'almacenDestinoId', value)}
      />
    );
  }
  return (
    <SelectorAlmacen
      label="Almacén origen"
      value={partida.almacenOrigenId}
      heredado={partida.heredadoOrigen}
      almacenes={almacenes}
      loading={loading}
      onChange={(value) => onChange(partida.id, 'almacenOrigenId', value)}
    />
  );
}

function CeldaCosteo({ sentido, partida, onChange, decimalesCosto = 2 }: { sentido: TipoMovimiento; partida?: Partida; onChange?: (id: string, field: keyof Partida, value: string) => void; decimalesCosto?: number }) {
  if (sentido === 'entrada' && partida && onChange) {
    return <CostoCampo value={partida.costoUnitario} decimales={decimalesCosto} onChange={(value) => onChange(partida.id, 'costoUnitario', value)} />;
  }
  return (
    <Box
      title={ayudaCosteo[sentido]}
      sx={(theme) => ({
        width: '100%',
        height: ALTO_CONTROL,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pr: `${TEXTO_PX - CELDA_PX}px`,
        fontSize: 12,
        color: theme.emphasys.table.muted,
        whiteSpace: 'nowrap',
        cursor: 'default',
      })}
    >
      Automático
    </Box>
  );
}

function manejarTeclasFila(
  event: React.KeyboardEvent,
  partida: Partida,
  decimalesCantidad: number,
  onSentidoChange: (id: string, sentido: TipoMovimiento) => void,
  onContinuar: (id: string) => void,
) {
  // Alt + E/S/T cambia el sentido de la partida (se usa event.code porque en macOS Alt produce caracteres especiales).
  if (event.altKey && !event.metaKey && !event.ctrlKey) {
    const atajo: Record<string, TipoMovimiento> = { KeyE: 'entrada', KeyS: 'salida', KeyT: 'transferencia' };
    const sentido = atajo[event.code];
    if (sentido) {
      event.preventDefault();
      event.stopPropagation();
      onSentidoChange(partida.id, sentido);
      return;
    }
  }
  if (!enterDebeContinuarCaptura(event)) return;
  if (!partidaListaParaContinuar(partida, decimalesCantidad)) return;
  event.preventDefault();
  event.stopPropagation();
  onContinuar(partida.id);
}

function FilaPartida({
  partida,
  index,
  activa,
  atenuada,
  productos,
  almacenes,
  loadingProductos,
  loadingAlmacenes,
  errorProductos,
  filterProductos,
  puedeEliminar,
  onFocusFila,
  onChange,
  onSentidoChange,
  onEliminar,
  onContinuar,
  decimalesCantidad,
  decimalesCosto,
}: {
  partida: Partida & { numero: number };
  index: number;
  activa: boolean;
  atenuada: boolean;
  productos: Producto[];
  almacenes: Almacen[];
  loadingProductos: boolean;
  loadingAlmacenes: boolean;
  errorProductos: string | null;
  filterProductos: ReturnType<typeof createFilterOptions<Producto>>;
  puedeEliminar: boolean;
  onFocusFila: () => void;
  onChange: (id: string, field: keyof Partida, value: string) => void;
  onSentidoChange: (id: string, sentido: TipoMovimiento) => void;
  onEliminar: (id: string) => void;
  onContinuar: (id: string) => void;
  decimalesCantidad: number;
  decimalesCosto: number;
}) {
  const celda = { px: `${CELDA_PX}px`, height: '100%', display: 'flex', alignItems: 'center', minWidth: 0 } as const;
  return (
    <Box
      onKeyDownCapture={(event) => manejarTeclasFila(event, partida, decimalesCantidad, onSentidoChange, onContinuar)}
      onFocus={onFocusFila}
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: COLUMNAS,
        height: partida.sentido === 'transferencia' ? ALTO_FILA_TRANSFERENCIA : ALTO_FILA,
        borderBottom: `1px solid ${theme.emphasys.content.border}`,
        // Cebreado: impares marfil claro, pares con grid.stripe encima (beige suave). La fila activa no cambia de fondo.
        bgcolor: theme.emphasys.documentNav.selectedBackground,
        backgroundImage: index % 2 === 1 ? `linear-gradient(${theme.emphasys.grid.stripe}, ${theme.emphasys.grid.stripe})` : 'none',
        opacity: atenuada ? 0.32 : 1,
        transition: 'opacity .15s',
        '&:hover .accion-eliminar, &:focus-within .accion-eliminar': { opacity: 1 },
      })}
    >
      <Box
        sx={(theme) => ({
          ...celda,
          px: 0,
          pl: '16px',
          boxShadow: activa ? `inset 3px 0 0 ${theme.emphasys.grid.header}` : 'none',
        })}
      >
        <Typography variant="figure" sx={(theme) => ({ fontSize: 13, fontWeight: activa ? 700 : 400, color: activa ? theme.emphasys.content.foreground : theme.emphasys.table.muted, fontVariantNumeric: 'tabular-nums' })}>
          {String(partida.numero).padStart(2, '0')}
        </Typography>
      </Box>
      <Box sx={celda}>
        <SelectorSentido partidaId={partida.id} valor={partida.sentido} onChange={(v) => onSentidoChange(partida.id, v)} />
      </Box>
      <Box sx={celda}>
        <SelectorProducto
          partida={partida}
          productos={productos}
          loading={loadingProductos}
          error={errorProductos}
          filterProductos={filterProductos}
          onChange={onChange}
        />
      </Box>
      <Box sx={celda}>
        <CeldaAlmacen sentido={partida.sentido} partida={partida} almacenes={almacenes} loading={loadingAlmacenes} onChange={onChange} />
      </Box>
      <Box sx={celda}>
        <CantidadCampo sentido={partida.sentido} value={partida.cantidad} decimales={decimalesCantidad} onChange={(value) => onChange(partida.id, 'cantidad', value)} />
      </Box>
      <Box sx={celda}>
        <CeldaCosteo sentido={partida.sentido} partida={partida} decimalesCosto={decimalesCosto} onChange={onChange} />
      </Box>
      <Box sx={{ ...celda, px: 0, justifyContent: 'center' }}>
        <BotonEliminar disabled={!puedeEliminar} onClick={() => onEliminar(partida.id)} visible={activa} />
      </Box>
    </Box>
  );
}

function BotonEliminar({ disabled, onClick, visible }: { disabled: boolean; onClick: () => void; visible: boolean }) {
  return (
    <Box
      component="button"
      type="button"
      className="accion-eliminar"
      aria-label="Eliminar partida"
      title="Eliminar partida"
      disabled={disabled}
      tabIndex={-1}
      onClick={onClick}
      sx={(theme) => ({
        width: 26,
        height: 26,
        border: 0,
        borderRadius: '4px',
        background: 'none',
        font: 'inherit',
        fontSize: 13,
        lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
        color: theme.emphasys.table.muted,
        opacity: visible ? 1 : 0,
        '&:hover:not(:disabled)': { bgcolor: theme.emphasys.metric.blocked.background, color: theme.emphasys.action.destructive },
        '&:focus-visible': { opacity: 1, outline: `2px solid ${alpha(theme.emphasys.action.info, 0.35)}` },
        '&:disabled': { color: theme.emphasys.action.disabled },
      })}
    >
      ✕
    </Box>
  );
}

function FilaAgregar({ onClick, movil = false }: { onClick: () => void; movil?: boolean }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        width: '100%',
        height: ALTO_FILA,
        pl: movil ? 1 : `${42 + CELDA_PX}px`,
        border: 0,
        background: 'none',
        font: 'inherit',
        fontSize: 13,
        textAlign: 'left',
        cursor: 'pointer',
        color: theme.emphasys.content.muted,
        '& .mas': { width: 22, height: 22, borderRadius: '50%', border: `1px dashed ${theme.emphasys.table.muted}`, display: 'grid', placeItems: 'center', fontSize: 14, lineHeight: 1 },
        '&:hover, &:focus-visible': { color: theme.emphasys.content.foreground, outline: 'none' },
        '&:hover .mas, &:focus-visible .mas': { borderStyle: 'solid', borderColor: theme.emphasys.content.foreground },
      })}
    >
      <span className="mas">+</span>
      Agregar partida
      <Box component="span" sx={(theme) => ({ color: theme.emphasys.table.muted, fontSize: 11.5, display: { xs: 'none', sm: 'inline' } })}>
        · hereda sentido y almacenes de la partida anterior
      </Box>
    </Box>
  );
}

function Atajo({ teclas, texto }: { teclas: string[]; texto: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      {teclas.map((tecla, i) => (
        <React.Fragment key={tecla}>
          {i === 1 && teclas[0] === 'Alt' ? '+' : null}
          <Box
            component="kbd"
            sx={(theme) => ({
              fontFamily: 'inherit',
              fontSize: 10.5,
              border: `1px solid ${theme.emphasys.content.border}`,
              borderBottomWidth: 2,
              borderRadius: '3px',
              px: '5px',
              color: theme.emphasys.content.secondary,
              bgcolor: theme.emphasys.documentNav.selectedBackground,
            })}
          >
            {tecla}
          </Box>
        </React.Fragment>
      ))}
      {texto}
    </Box>
  );
}

function BarraSentidos({ conteo }: { conteo: Record<TipoMovimiento, number> }) {
  const total = conteo.entrada + conteo.salida + conteo.transferencia;
  return (
    <Box sx={(theme) => ({ height: 6, borderRadius: '3px', overflow: 'hidden', display: 'flex', gap: '2px', bgcolor: theme.emphasys.content.border })}>
      {total > 0 && (['entrada', 'salida', 'transferencia'] as TipoMovimiento[]).map((t) =>
        conteo[t] > 0 ? <Box key={t} sx={(theme) => ({ flex: conteo[t], bgcolor: colorSentido(theme, t).fg })} /> : null
      )}
    </Box>
  );
}

type EfectoAlmacen = { id: string; nombre: string; unidades: number; partidas: number };

function SeccionResumen({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <Box sx={(theme) => ({ px: 2.25, pt: 1.5, pb: 2, borderBottom: `1px solid ${theme.emphasys.content.border}` })}>
      {titulo && (
        <Typography sx={(theme) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.emphasys.content.muted, mb: 1 })}>
          {titulo}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function ResumenOperativo({
  totalPartidas,
  conteo,
  efecto,
  decimalesCantidad,
  partidaActiva,
  numeroActiva,
  onColapsar,
}: {
  totalPartidas: number;
  conteo: Record<TipoMovimiento, number>;
  efecto: EfectoAlmacen[];
  decimalesCantidad: number;
  partidaActiva: Partida | null;
  numeroActiva: number;
  onColapsar?: (() => void) | undefined;
}) {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.25, pt: 1.75 }}>
        <Typography component="h2" sx={(theme) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.emphasys.content.muted })}>
          Resumen
        </Typography>
        {onColapsar && (
          <IconButton size="small" aria-label="Colapsar resumen" title="Colapsar resumen" onClick={onColapsar} sx={(theme) => ({ width: 26, height: 26, borderRadius: '4px', fontSize: 14, color: theme.emphasys.content.muted })}>
            ⇥
          </IconButton>
        )}
      </Box>
      <SeccionResumen>
        <Typography variant="figure" sx={(theme) => ({ fontSize: 40, lineHeight: 1, color: theme.emphasys.content.foreground, fontVariantNumeric: 'tabular-nums' })}>
          {totalPartidas}
        </Typography>
        <Typography sx={(theme) => ({ fontSize: 13, color: theme.emphasys.content.secondary, mt: 0.5, mb: 1.5 })}>
          {totalPartidas === 1 ? 'partida en esta operación' : 'partidas en esta operación'}
        </Typography>
        <BarraSentidos conteo={conteo} />
        <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1.25, p: 0, display: 'grid', gap: 0.75 }}>
          {(['entrada', 'salida', 'transferencia'] as TipoMovimiento[]).map((t) => (
            <Box component="li" key={t} sx={(theme) => ({ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 1, alignItems: 'center', fontSize: 13, color: theme.emphasys.content.secondary })}>
              <Box component="i" sx={(theme) => ({ width: 8, height: 8, borderRadius: '2px', bgcolor: colorSentido(theme, t).fg })} />
              {t === 'entrada' ? 'Entradas' : t === 'salida' ? 'Salidas' : 'Transferencias'}
              <Box component="b" sx={(theme) => ({ fontWeight: 600, color: theme.emphasys.content.foreground, fontVariantNumeric: 'tabular-nums' })}>{conteo[t]}</Box>
            </Box>
          ))}
        </Box>
      </SeccionResumen>
      <SeccionResumen titulo="Efecto por almacén">
        {efecto.length === 0 ? (
          <Typography sx={(theme) => ({ fontSize: 12, color: theme.emphasys.content.muted })}>Selecciona almacenes en las partidas.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 1 }}>
            {efecto.map((a) => (
              <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 1.25, rowGap: '2px' }}>
                <Typography sx={(theme) => ({ fontSize: 13, color: theme.emphasys.content.secondary, minWidth: 0, overflowWrap: 'anywhere' })}>{a.nombre}</Typography>
                <Typography sx={(theme) => ({ fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.unidades >= 0 ? amountSignColor(theme.emphasys, 'positive') : amountSignColor(theme.emphasys, 'negative') })}>
                  {formatearUnidades(a.unidades, decimalesCantidad)} u
                </Typography>
                <Typography sx={(theme) => ({ gridColumn: '1 / -1', fontSize: 11, color: theme.emphasys.table.muted })}>
                  {a.partidas} {a.partidas === 1 ? 'partida' : 'partidas'}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </SeccionResumen>
      <Box sx={(theme) => ({ mt: 'auto', px: 2.25, py: 1.75, bgcolor: theme.emphasys.action.tint, borderTop: `1px solid ${theme.emphasys.content.border}`, color: theme.emphasys.content.secondary, fontSize: 12, lineHeight: 1.45 })}>
        <Typography sx={(theme) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.emphasys.content.muted, mb: 0.5 })}>
          {partidaActiva ? `Partida ${String(numeroActiva).padStart(2, '0')} · ${etiquetaTipo[partidaActiva.sentido].toLowerCase()}` : 'Partida activa'}
        </Typography>
        {partidaActiva ? ayudaSentido[partidaActiva.sentido] : 'Selecciona una partida para ver su ayuda.'}
      </Box>
    </>
  );
}

function RielMinimo({ conteo, onExpandir }: { conteo: Record<TipoMovimiento, number>; onExpandir: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.75, pt: 1.5 }}>
      <IconButton size="small" aria-label="Expandir resumen" title="Expandir resumen" onClick={onExpandir} sx={(theme) => ({ width: 26, height: 26, borderRadius: '4px', fontSize: 14, color: theme.emphasys.content.muted })}>
        ⇤
      </IconButton>
      <Typography sx={(theme) => ({ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.emphasys.content.muted })}>
        Resumen
      </Typography>
      {(['entrada', 'salida', 'transferencia'] as TipoMovimiento[]).map((t) => (
        <Box
          key={t}
          title={`${etiquetaTipo[t]}: ${conteo[t]}`}
          sx={(theme) => ({ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, bgcolor: colorSentido(theme, t).bg, color: colorSentido(theme, t).fg })}
        >
          {conteo[t]}
        </Box>
      ))}
    </Box>
  );
}

function SelectorProducto({
  partida,
  productos,
  loading,
  error,
  filterProductos,
  onChange,
}: {
  partida: Partida;
  productos: Producto[];
  loading: boolean;
  error: string | null;
  filterProductos: ReturnType<typeof createFilterOptions<Producto>>;
  onChange: (id: string, field: keyof Partida, value: string) => void;
}) {
  const seleccionado = productos.find((opt) => String(opt.id) === partida.productoId) ?? null;
  const [texto, setTexto] = useState('');
  // La clave se muestra como prefijo visible mientras el texto sea la descripción del producto elegido;
  // al escribir otra búsqueda desaparece para no mezclar la clave anterior con el nuevo término.
  const mostrarClave = Boolean(seleccionado) && texto === (seleccionado?.descripcion ?? '');
  return (
    <Autocomplete
      size="small"
      fullWidth
      options={productos}
      value={seleccionado}
      inputValue={texto}
      onInputChange={(_e, value) => setTexto(value)}
      onChange={(_e, option) => onChange(partida.id, 'productoId', option ? String(option.id) : '')}
      getOptionLabel={(option) => option.descripcion}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      filterOptions={filterProductos}
      loading={loading}
      forcePopupIcon={false}
      noOptionsText={error ?? 'Sin resultados'}
      loadingText="Cargando productos…"
      renderOption={(props, option) => {
        const { key, ...resto } = props;
        return (
          <Box component="li" key={key} {...resto} sx={{ display: 'grid !important', gridTemplateColumns: '92px 1fr', columnGap: 1.25, fontSize: 12.5 }}>
            <Typography component="span" noWrap sx={{ fontWeight: 700, fontSize: 12.5 }}>{option.clave}</Typography>
            <Typography component="span" noWrap sx={{ fontSize: 12.5 }}>{option.descripcion}</Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...(params as object)}
          placeholder="Clave o descripción"
          aria-label="Producto"
          title={seleccionado ? `${seleccionado.clave} · ${seleccionado.descripcion}` : undefined}
          InputProps={{
            ...params.InputProps,
            startAdornment: mostrarClave ? (
              <Box component="span" sx={(theme) => ({ flex: 'none', pl: `${TEXTO_PX - CELDA_PX}px`, pr: 0.75, fontSize: 11.5, letterSpacing: '0.02em', color: theme.emphasys.content.muted, whiteSpace: 'nowrap' })}>
                {seleccionado?.clave}
              </Box>
            ) : undefined,
          }}
          inputProps={{
            ...(params.inputProps as object),
            'data-producto-partida': partida.id,
          }}
          sx={(theme: Theme) => campoFilaSx(theme)}
        />
      )}
    />
  );
}

function SelectorAlmacen({
  label,
  value,
  almacenes,
  loading,
  heredado = false,
  linea = false,
  destino = false,
  onChange,
}: {
  label: string;
  value: string;
  almacenes: Almacen[];
  loading: boolean;
  heredado?: boolean | undefined;
  linea?: boolean;
  destino?: boolean;
  onChange: (value: string) => void;
}) {
  const repetidos = useMemo(() => nombresAlmacenRepetidos(almacenes), [almacenes]);
  const nombre = (id: string) => {
    const alm = almacenes.find((a) => String(a.id) === id);
    return alm ? etiquetaAlmacen(alm, repetidos.has(alm.nombre.trim().toLocaleLowerCase('es-MX'))) : '';
  };
  const titulo = value ? `${label.replace('Almacén ', '').replace(/^./, (c) => c.toUpperCase())}: ${nombre(value)}${heredado ? ' · heredado de la partida anterior' : ''}` : label;
  return (
    <TextField
      select
      fullWidth
      size="small"
      variant={linea ? 'standard' : 'outlined'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      title={titulo}
      disabled={loading}
      {...(linea ? { InputProps: { disableUnderline: true } } : {})}
      sx={(theme: Theme) =>
        linea
          ? {
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              '& + &': { borderTop: `1px solid ${theme.emphasys.content.border}` },
              '& .MuiInputBase-root': { height: '100%', fontSize: 12.5, color: heredado ? theme.emphasys.content.muted : theme.emphasys.content.foreground },
              '& .MuiInputBase-root.Mui-focused': { bgcolor: theme.emphasys.action.tint },
              '& .MuiSelect-select': {
                height: '100% !important',
                minHeight: '0 !important',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                p: `0 24px 0 ${TEXTO_PX - CELDA_PX - 1}px !important`,
                boxSizing: 'border-box',
                bgcolor: 'transparent !important',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              },
              '& .MuiSelect-icon': { right: 4, fontSize: 16, color: theme.emphasys.table.muted },
            }
          : {
              ...campoFilaSx(theme),
              '& .MuiInputBase-root': { ...campoFilaSx(theme)['& .MuiInputBase-root, & .MuiAutocomplete-inputRoot'], color: heredado ? theme.emphasys.content.muted : theme.emphasys.content.foreground },
            }
      }
      SelectProps={{
        displayEmpty: true,
        MenuProps: { disableAutoFocusItem: false },
        renderValue: (seleccion) => (
          <>
            {destino && <Box component="span" sx={(theme) => ({ flex: 'none', fontSize: 11, color: colorSentido(theme, 'transferencia').fg })}>→</Box>}
            <Box component="span" sx={(theme) => ({ overflow: 'hidden', textOverflow: 'ellipsis', color: seleccion ? undefined : theme.emphasys.table.muted })}>
              {seleccion ? nombre(String(seleccion)) : loading ? 'Cargando…' : 'Elegir almacén'}
            </Box>
          </>
        ),
      }}
    >
      {loading && <MenuItem disabled value="">Cargando…</MenuItem>}
      {!loading && almacenes.length === 0 && <MenuItem disabled value="">Sin almacenes</MenuItem>}
      {almacenes.map((alm) => (
        <MenuItem key={alm.id} value={String(alm.id)}>
          {etiquetaAlmacen(alm, repetidos.has(alm.nombre.trim().toLocaleLowerCase('es-MX')))}
        </MenuItem>
      ))}
    </TextField>
  );
}

function CostoCampo({ value, onChange, decimales = 2 }: { value: string; onChange: (value: string) => void; decimales?: number }) {
  const [enfocado, setEnfocado] = useState(false);
  const visible = enfocado ? value : presentarCantidad(value, decimales);
  return (
    <TextField
      size="small"
      value={visible}
      onFocus={() => setEnfocado(true)}
      onBlur={() => {
        setEnfocado(false);
        onChange(canonCantidad(value, false, decimales));
      }}
      onChange={(e) => onChange(canonCantidad(e.target.value, true, decimales))}
      inputProps={{ 'aria-label': 'Costo unitario', inputMode: 'decimal', maxLength: 30 }}
      sx={(theme: Theme) => campoFilaSx(theme, 'right')}
    />
  );
}

// El signo − de las salidas y el color por sentido son solo presentación: el valor capturado
// (y el que se envía al backend) es siempre la cantidad positiva.
function CantidadCampo({ sentido, value, onChange, decimales = 2 }: { sentido: TipoMovimiento; value: string; onChange: (value: string) => void; decimales?: number }) {
  const [enfocado, setEnfocado] = useState(false);
  const presentado = presentarCantidad(value, decimales);
  const visible = enfocado ? value : presentado && sentido === 'salida' ? `−${presentado}` : presentado;
  return (
    <TextField
      size="small"
      value={visible}
      placeholder="0"
      onFocus={() => setEnfocado(true)}
      onBlur={() => {
        setEnfocado(false);
        onChange(canonCantidad(value, false, decimales));
      }}
      onChange={(e) => onChange(canonCantidad(e.target.value, true, decimales))}
      inputProps={{ 'aria-label': 'Cantidad', inputMode: 'decimal', maxLength: 30 }}
      sx={(theme: Theme) => campoFilaSx(theme, 'right', colorCantidad(theme, sentido))}
    />
  );
}

function PartidaMovil({
  partida,
  productos,
  almacenes,
  loadingProductos,
  loadingAlmacenes,
  errorProductos,
  filterProductos,
  puedeEliminar,
  atenuada,
  onFocusFila,
  onChange,
  onSentidoChange,
  onEliminar,
  onContinuar,
  decimalesCantidad,
  decimalesCosto,
}: {
  partida: Partida & { numero: number };
  productos: Producto[];
  almacenes: Almacen[];
  loadingProductos: boolean;
  loadingAlmacenes: boolean;
  errorProductos: string | null;
  filterProductos: ReturnType<typeof createFilterOptions<Producto>>;
  puedeEliminar: boolean;
  atenuada: boolean;
  onFocusFila: () => void;
  onChange: (id: string, field: keyof Partida, value: string) => void;
  onSentidoChange: (id: string, sentido: TipoMovimiento) => void;
  onEliminar: (id: string) => void;
  onContinuar: (id: string) => void;
  decimalesCantidad: number;
  decimalesCosto: number;
}) {
  return (
    <Box
      onKeyDownCapture={(event) => manejarTeclasFila(event, partida, decimalesCantidad, onSentidoChange, onContinuar)}
      onFocus={onFocusFila}
      sx={(theme) => ({
        border: `1px solid ${theme.emphasys.content.border}`,
        borderRadius: '6px',
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        bgcolor: theme.emphasys.documentNav.selectedBackground,
        opacity: atenuada ? 0.4 : 1,
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="figure" sx={(theme) => ({ fontSize: 14, color: theme.emphasys.table.muted })}>
          {String(partida.numero).padStart(2, '0')}
        </Typography>
        <SelectorSentido partidaId={partida.id} valor={partida.sentido} onChange={(v) => onSentidoChange(partida.id, v)} />
        <Box sx={{ flex: 1 }} />
        <BotonEliminar disabled={!puedeEliminar} onClick={() => onEliminar(partida.id)} visible />
      </Box>
      <SelectorProducto partida={partida} productos={productos} loading={loadingProductos} error={errorProductos} filterProductos={filterProductos} onChange={onChange} />
      <CeldaAlmacen sentido={partida.sentido} partida={partida} almacenes={almacenes} loading={loadingAlmacenes} onChange={onChange} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, alignItems: 'center' }}>
        <CantidadCampo sentido={partida.sentido} value={partida.cantidad} decimales={decimalesCantidad} onChange={(value) => onChange(partida.id, 'cantidad', value)} />
        <CeldaCosteo sentido={partida.sentido} partida={partida} decimalesCosto={decimalesCosto} onChange={onChange} />
      </Box>
    </Box>
  );
}

function formatearUnidades(valor: number, decimales: number) {
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return `${signo}${presentarCantidad(Math.abs(valor).toFixed(decimales), decimales) || '0'}`;
}

function deduplicarAlmacenesPorId(lista: Almacen[]) {
  const vistos = new Set<string>();
  const unicos: Almacen[] = [];
  lista.forEach((almacen) => {
    const id = String(almacen?.id ?? '');
    if (!id || vistos.has(id)) return;
    vistos.add(id);
    unicos.push(almacen);
  });
  return unicos;
}

function nombresAlmacenRepetidos(almacenes: Almacen[]) {
  const conteo = new Map<string, number>();
  almacenes.forEach((almacen) => {
    const nombre = almacen.nombre.trim().toLocaleLowerCase('es-MX');
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
  });
  const repetidos = new Set<string>();
  conteo.forEach((total, nombre) => {
    if (total > 1) repetidos.add(nombre);
  });
  return repetidos;
}

function etiquetaAlmacen(almacen: Almacen, repetido: boolean) {
  const nombre = almacen.nombre.trim() || `Almacén ${almacen.id}`;
  if (!repetido) return nombre;
  const clave = almacen.clave?.trim();
  return clave ? `${nombre} · ${clave}` : `${nombre} · #${almacen.id}`;
}

function avisoAlmacenesMismoNombre(almacenes: Almacen[]) {
  const grupos = new Map<string, Almacen[]>();
  almacenes.forEach((almacen) => {
    const nombre = almacen.nombre.trim().toLocaleLowerCase('es-MX');
    const lista = grupos.get(nombre) ?? [];
    lista.push(almacen);
    grupos.set(nombre, lista);
  });
  const repetidos = [...grupos.values()].filter((grupo) => new Set(grupo.map((almacen) => almacen.id)).size > 1);
  if (!repetidos.length) return null;
  const detalle = repetidos.map((grupo) => {
    const nombre = grupo[0]?.nombre.trim() || 'Sin nombre';
    const claves = grupo.map((almacen) => almacen.clave?.trim() || `#${almacen.id}`).join(', ');
    return `«${nombre}» (${claves})`;
  }).join('; ');
  return `Hay almacenes distintos con el mismo nombre: ${detalle}. Se muestran todos, identificados por su clave.`;
}

function partidaListaParaContinuar(partida: Partida, decimalesCantidad: number) {
  if (!partida.productoId) return false;
  const cantidad = numeroCantidad(partida.cantidad, decimalesCantidad);
  if (cantidad == null || cantidad <= 0) return false;
  if (partida.sentido !== 'entrada' && !partida.almacenOrigenId) return false;
  if (partida.sentido !== 'salida' && !partida.almacenDestinoId) return false;
  if (partida.sentido === 'entrada') {
    const costo = Number(partida.costoUnitario);
    if (partida.costoUnitario === '' || !Number.isFinite(costo) || costo < 0) return false;
  }
  return true;
}

function partidaSinCaptura(partida: Partida) {
  const almacenOrigenCapturado = Boolean(partida.almacenOrigenId) && !partida.heredadoOrigen;
  const almacenDestinoCapturado = Boolean(partida.almacenDestinoId) && !partida.heredadoDestino;
  return !partida.productoId
    && partida.cantidad.trim() === ''
    && partida.costoUnitario.trim() === ''
    && !almacenOrigenCapturado
    && !almacenDestinoCapturado;
}

function filaHeredadaVacia(candidata: Partida, origen: Partida) {
  return candidata.sentido === origen.sentido
    && candidata.productoId === ''
    && candidata.cantidad === ''
    && candidata.costoUnitario === ''
    && candidata.almacenOrigenId === (origen.sentido === 'entrada' ? '' : origen.almacenOrigenId)
    && candidata.almacenDestinoId === (origen.sentido === 'salida' ? '' : origen.almacenDestinoId);
}

function heredarPartida(origen: Partida): Partida {
  return {
    id: crypto.randomUUID(),
    sentido: origen.sentido,
    productoId: '',
    almacenOrigenId: origen.sentido === 'entrada' ? '' : origen.almacenOrigenId,
    almacenDestinoId: origen.sentido === 'salida' ? '' : origen.almacenDestinoId,
    cantidad: '',
    costoUnitario: '',
    heredadoOrigen: origen.sentido !== 'entrada' && Boolean(origen.almacenOrigenId),
    heredadoDestino: origen.sentido !== 'salida' && Boolean(origen.almacenDestinoId),
  };
}

function enterDebeContinuarCaptura(event: React.KeyboardEvent) {
  if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing) return false;
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.closest('button, a, [role="button"]')) return false;
  if ((target as HTMLInputElement).type === 'date' || target.hasAttribute('data-fecha-operativa')) return false;
  if (target.getAttribute('aria-expanded') === 'true' || target.closest('[aria-expanded="true"]')) return false;
  if (document.querySelector('[role="listbox"]')) return false;
  if (target.getAttribute('role') === 'combobox' && target.tagName !== 'INPUT') return false;
  return true;
}

function CampoFechaOperativa({ value, onChange, enfocarAlMontar = false }: { value: string; onChange: (valor: string) => void; enfocarAlMontar?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const yaEnfoco = useRef(false);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!enfocarAlMontar || yaEnfoco.current) return;
    const input = ref.current;
    if (!input) return;
    yaEnfoco.current = true;
    input.focus({ preventScroll: true });
    setAbierto(true);
  }, [enfocarAlMontar]);
  return (
    <FechaInput
      value={value}
      // Una fecha parcial o inválida (null) no se propaga: el estado conserva la última fecha civil válida.
      onChange={(valor) => { if (valor) onChange(fechaCivilGuadalajara(valor)); }}
      inputRef={ref}
      open={abierto}
      onOpen={() => setAbierto(true)}
      onClose={() => setAbierto(false)}
      slotProps={{
        textField: {
          variant: 'standard',
          inputProps: { 'aria-label': 'Fecha operativa', 'data-fecha-operativa': 'true' },
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === 'Enter') event.stopPropagation();
          },
          sx: (theme: Theme) => ({
            width: '100%',
            maxWidth: 150,
            '& .MuiInputBase-root': { height: 29, fontSize: 14, color: theme.emphasys.content.foreground },
            '& .MuiInput-underline:before': { borderBottomColor: theme.emphasys.content.border },
            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: theme.emphasys.content.foreground },
            '& .MuiInput-underline:after': { borderBottomColor: theme.emphasys.content.foreground },
          }),
        },
      }}
    />
  );
}

function crearPartidaVacia(sentido: TipoMovimiento = 'entrada'): Partida {
  return {
    id: crypto.randomUUID(),
    sentido,
    productoId: '',
    almacenOrigenId: '',
    almacenDestinoId: '',
    cantidad: '',
    costoUnitario: '',
  };
}

// El sistema persiste una fecha de negocio (fechaCivilGuadalajara), no una
// hora operativa: el campo de captura es de solo fecha, calculada en la
// zona horaria de Guadalajara sin desplazamientos UTC.
function ahoraGuadalajara() {
  const v = partesZona(new Date());
  return `${v.year}-${v.month}-${v.day}`;
}

function fechaCivilGuadalajara(valor: string) {
  const directo = /^(\d{4}-\d{2}-\d{2})$/.exec(valor.trim());
  if (directo?.[1]) return directo[1];
  return ahoraGuadalajara();
}

function fechaRegistrada(valor: unknown) {
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
    if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(texto)) return texto.slice(0, 10);
    const parsed = new Date(texto);
    if (!Number.isNaN(parsed.getTime())) {
      const v = partesZona(parsed);
      return `${v.year}-${v.month}-${v.day}`;
    }
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const iso = valor.toISOString();
    if (iso.endsWith('T00:00:00.000Z')) return iso.slice(0, 10);
    const v = partesZona(valor);
    return `${v.year}-${v.month}-${v.day}`;
  }
  return '';
}

function partesZona(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_OPERATIVA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return {
    year: valores.year || '0000',
    month: valores.month || '01',
    day: valores.day || '01',
    hour: valores.hour || '00',
    minute: valores.minute || '00',
  };
}

function canonCantidad(raw: string, conservandoPunto = false, decimales = 6) {
  const limpio = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const punto = limpio.indexOf('.');
  if (punto < 0) return limpio.replace(/^0+(?=\d)/, '');
  const entera = (limpio.slice(0, punto).replace(/^0+(?=\d)/, '') || '0');
  const fraccion = limpio.slice(punto + 1).replace(/\./g, '').slice(0, decimales);
  if (conservandoPunto && limpio.endsWith('.') && fraccion.length === 0) return `${entera}.`;
  return fraccion.length ? `${entera}.${fraccion}` : (conservandoPunto && limpio.endsWith('.') ? `${entera}.` : entera);
}

function presentarCantidad(canon: string, decimales = 2) {
  const normal = canonCantidad(canon, false, decimales);
  if (!normal || normal === '.') return '';
  const [entera, fraccion = ''] = normal.split('.');
  const visible = fraccion.padEnd(decimales, '0');
  const miles = (entera || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return visible ? `${miles}.${visible}` : miles;
}

function numeroCantidad(canon: string, decimales = 6) {
  const normal = canonCantidad(canon, false, decimales);
  if (!normal || normal === '.') return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function formatearCantidad(value: string | number) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (!raw) return '0';
  const [enteraRaw, fraccionRaw = ''] = raw.split('.');
  const entera = (enteraRaw || '0').replace(/^(-?)0+(?=\d)/, '$1');
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraccion = fraccionRaw.replace(/0+$/, '');
  return fraccion ? `${miles}.${fraccion}` : miles;
}
