import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, Drawer, FormControlLabel,
  IconButton, Stack, TextField, Typography, Autocomplete,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RouteIcon from '@mui/icons-material/Route';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BadgeIcon from '@mui/icons-material/Badge';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  actualizarViaje, crearViajeDesdeDocumento, obtenerOperadoresDisponibles, obtenerPartidasImportables,
  obtenerRemolques, obtenerUbicacionesDisponibles, obtenerVehiculos, obtenerViajeAggregate, obtenerViajePorDocumento,
  validarCartaPorte,
  type CartaPorteIssue, type CartaPorteIssueSection, type OperadorDisponible, type PartidaImportable,
  type RemolqueTransporte, type UbicacionDisponible, type VehiculoTransporte, type ViajeAggregate,
  type ViajeMercanciaInput, type ViajePutPayload,
} from '../../../services/transporte.api';
import { fetchProductos } from '../../../services/productosService';
import {
  buscarBienesTransportadosSat, buscarUnidadesSat, type SatClaveDescripcion,
} from '../../../services/satCatalogos.api';
import type { Producto } from '../../../types/producto';

type Props = { open: boolean; documentoId: number | null; folio: string; onClose: () => void };

const AZUL = '#1d2f68';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const numStr = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));

const domicilioLinea = (u: UbicacionDisponible): string => {
  const partes = [
    [u.calle, u.numero_exterior].filter(Boolean).join(' '),
    u.colonia, u.ciudad, u.estado, u.codigo_postal,
  ].filter((x) => x && String(x).trim());
  return partes.join(', ');
};
const ubicacionLabel = (u: UbicacionDisponible): string =>
  `${u.propietario_nombre} — ${u.identificador}${domicilioLinea(u) ? ` — ${domicilioLinea(u)}` : ''}`;

const vehiculoLabel = (v: VehiculoTransporte): string =>
  `${v.clave_interna} — ${v.placas}${v.configuracion_vehicular_sat ? ` — ${v.configuracion_vehicular_sat}` : ''}`;
const remolqueLabel = (r: RemolqueTransporte): string =>
  `${r.clave_interna} — ${r.placas}${r.subtipo_remolque_sat ? ` — ${r.subtipo_remolque_sat}${r.subtipo_descripcion ? ` (${r.subtipo_descripcion})` : ''}` : ''}`;
const operadorLabel = (o: OperadorDisponible): string =>
  `${o.nombre} — Lic. ${o.numero_licencia}${o.vigencia_licencia ? ` — Vig. ${String(o.vigencia_licencia).slice(0, 10)}` : ''}`;
const productoLabel = (p: Producto): string => `${p.clave} — ${p.descripcion}`;

const SECCION_LABEL: Record<CartaPorteIssueSection, string> = {
  ruta: 'Ruta',
  unidad: 'Unidad / Remolques',
  operador: 'Operador',
  mercancias: 'Mercancías',
  generales: 'Datos generales',
};
// A qué ancla del drawer lleva cada sección de error.
const SECCION_ANCLA: Partial<Record<CartaPorteIssueSection, string>> = {
  ruta: 'cp-sec-ruta',
  unidad: 'cp-sec-unidad',
  operador: 'cp-sec-operador',
  mercancias: 'cp-sec-mercancias',
};

// Fila editable de mercancía (todos los campos como texto para edición cómoda).
type MercanciaFila = {
  key: string;
  productoId: number | null;
  descripcion: string;
  cantidad: string;
  pesoKg: string;
  valorMercancia: string;
  unidadDescripcion: string;
  claveUnidadSat: string;
  claveBienesTransportadosSat: string;
  materialPeligroso: boolean;
  claveMaterialPeligroso: string;
  embalaje: string;
  descripcionEmbalaje: string;
  origenSecuencia: number | null;
  destinoSecuencia: number | null;
  fromPartidaId: number | null;
};

let filaSeq = 0;
const nuevaFila = (base: Partial<MercanciaFila> = {}): MercanciaFila => ({
  key: `f${++filaSeq}`,
  productoId: null, descripcion: '', cantidad: '', pesoKg: '', valorMercancia: '',
  unidadDescripcion: '', claveUnidadSat: '', claveBienesTransportadosSat: '',
  materialPeligroso: false, claveMaterialPeligroso: '', embalaje: '', descripcionEmbalaje: '',
  origenSecuencia: null, destinoSecuencia: null, fromPartidaId: null,
  ...base,
});

const filaDesdePartida = (p: PartidaImportable): MercanciaFila => nuevaFila({
  productoId: p.producto_id ?? null,
  descripcion: p.descripcion ?? '',
  cantidad: numStr(p.cantidad),
  pesoKg: numStr(p.peso_sugerido),
  valorMercancia: numStr(p.valor_mercancia),
  unidadDescripcion: p.unidad_descripcion ?? p.unidad_partida ?? '',
  claveUnidadSat: p.clave_unidad_sat ?? '',
  claveBienesTransportadosSat: p.clave_bienes_transportados_sat ?? '',
  materialPeligroso: !!p.material_peligroso,
  claveMaterialPeligroso: p.clave_material_peligroso ?? '',
  embalaje: p.embalaje ?? '',
  descripcionEmbalaje: p.descripcion_embalaje ?? '',
  fromPartidaId: p.partida_id,
});

const mergeByClave = (a: SatClaveDescripcion[], b: SatClaveDescripcion[]): SatClaveDescripcion[] => {
  const map = new Map<string, SatClaveDescripcion>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.clave);
    // conserva la descripción no vacía si ya la teníamos
    map.set(x.clave, x.descripcion || !prev ? x : prev);
  }
  return [...map.values()];
};

/**
 * Selector de clave SAT contra un catálogo del servidor (bienes transportados /
 * unidades). Muestra `clave — descripción`, persiste únicamente la clave y
 * resuelve la descripción de un valor precargado (producto/partida).
 */
function SatClaveField({ label, catalogo, value, onChange, disabled }: {
  label: string;
  catalogo: 'bienes' | 'unidades';
  value: string;
  onChange: (clave: string) => void;
  disabled?: boolean;
}) {
  const buscar = catalogo === 'unidades' ? buscarUnidadesSat : buscarBienesTransportadosSat;
  const [options, setOptions] = useState<SatClaveDescripcion[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Resuelve la descripción del valor precargado que aún no está en opciones.
  useEffect(() => {
    if (!value || options.some((o) => o.clave === value)) return;
    let cancel = false;
    buscar(value)
      .then((items) => { if (!cancel) setOptions((prev) => mergeByClave(prev, [{ clave: value, descripcion: '' }, ...items])); })
      .catch(() => { if (!cancel) setOptions((prev) => mergeByClave(prev, [{ clave: value, descripcion: '' }])); });
    return () => { cancel = true; };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) return;
    let cancel = false;
    setLoading(true);
    const t = setTimeout(() => {
      buscar(q)
        .then((items) => { if (!cancel) setOptions((prev) => mergeByClave(prev, items)); })
        .catch(() => {})
        .finally(() => { if (!cancel) setLoading(false); });
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((o) => o.clave === value) ?? (value ? { clave: value, descripcion: '' } : null);

  return (
    <Autocomplete
      sx={{ flex: '1 1 100%', minWidth: 160 }}
      size="small"
      disabled={disabled}
      options={options}
      loading={loading}
      value={selected}
      filterOptions={(o) => o}
      onInputChange={(_, v, reason) => { if (reason === 'input') setInput(v); }}
      onChange={(_, v) => onChange(v?.clave ?? '')}
      getOptionLabel={(o) => (o.descripcion ? `${o.clave} — ${o.descripcion}` : o.clave)}
      isOptionEqualToValue={(o, v) => o.clave === v.clave}
      renderInput={(p) => <TextField {...p} label={label} placeholder="Buscar por clave o descripción" />}
      noOptionsText={loading ? 'Buscando…' : input.trim().length < 2 ? 'Escribe para buscar' : 'Sin resultados'}
    />
  );
}

export default function CartaPorteViajeDrawer({ open, documentoId, folio, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [viajeId, setViajeId] = useState<number | null>(null);
  const [aggregate, setAggregate] = useState<ViajeAggregate | null>(null);

  const [ubicaciones, setUbicaciones] = useState<UbicacionDisponible[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoTransporte[]>([]);
  const [remolques, setRemolques] = useState<RemolqueTransporte[]>([]);
  const [operadores, setOperadores] = useState<OperadorDisponible[]>([]);

  // Estado editable
  const [origenId, setOrigenId] = useState<number | null>(null);
  const [origenFecha, setOrigenFecha] = useState('');
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [destinoFecha, setDestinoFecha] = useState('');
  const [destinoDistancia, setDestinoDistancia] = useState(''); // km recorridos (requerido por Carta Porte en el destino)
  const [vehiculoId, setVehiculoId] = useState<number | null>(null);
  const [remolqueIds, setRemolqueIds] = useState<number[]>([]);
  const [operadorId, setOperadorId] = useState<number | null>(null);
  const [mercancias, setMercancias] = useState<MercanciaFila[]>([]);

  // Mercancías: catálogo de productos e importación desde factura
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [partidas, setPartidas] = useState<PartidaImportable[] | null>(null);
  const [partidasSel, setPartidasSel] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);

  // Validación de Carta Porte
  const [validando, setValidando] = useState(false);
  const [validationResult, setValidationResult] = useState<{ ok: boolean; issues: CartaPorteIssue[] } | null>(null);
  const [touchedSinceValidation, setTouchedSinceValidation] = useState(false);
  const touch = useCallback(() => setTouchedSinceValidation(true), []);

  const handledVehRef = useRef<Set<number>>(new Set());
  const dismissedRemolqueRef = useRef<Set<number>>(new Set());

  const readOnly = useMemo(() => {
    const est = aggregate?.viaje?.estatus;
    const cp = aggregate?.cartaPorte?.estatus;
    return est === 'timbrado' || est === 'cancelado' || cp === 'timbrado' || cp === 'cancelado';
  }, [aggregate]);

  const reconstruirDesdeAggregate = useCallback((agg: ViajeAggregate) => {
    handledVehRef.current = new Set();
    dismissedRemolqueRef.current = new Set();
    const origen = agg.ubicaciones.find((u) => u.tipo === 'origen');
    const destino = agg.ubicaciones.find((u) => u.tipo === 'destino');
    setOrigenId(origen?.domicilio_id ?? null);
    setOrigenFecha(toLocalInput(origen?.fecha_hora_programada));
    setDestinoId(destino?.domicilio_id ?? null);
    setDestinoFecha(toLocalInput(destino?.fecha_hora_programada));
    setDestinoDistancia(numStr(destino?.distancia_recorrida));
    setVehiculoId(agg.viaje.vehiculo_id ?? null);
    setRemolqueIds([...agg.remolques].sort((a, b) => a.orden - b.orden).map((r) => r.remolque_id));
    const operador = agg.figuras.find((f) => f.tipo_figura === 'operador' && f.operador_id);
    setOperadorId(operador?.operador_id ?? null);
    setMercancias(agg.mercancias.map((m) => nuevaFila({
      key: `m${m.id}`,
      productoId: m.producto_id ?? null,
      descripcion: m.descripcion_snapshot ?? '',
      cantidad: numStr(m.cantidad),
      pesoKg: numStr(m.peso_kg),
      valorMercancia: numStr(m.valor_mercancia),
      unidadDescripcion: m.unidad_descripcion ?? '',
      claveUnidadSat: m.clave_unidad_sat ?? '',
      claveBienesTransportadosSat: m.clave_bienes_transportados_sat ?? '',
      materialPeligroso: !!m.material_peligroso,
      claveMaterialPeligroso: m.clave_material_peligroso ?? '',
      embalaje: m.embalaje ?? '',
      descripcionEmbalaje: m.descripcion_embalaje ?? '',
      origenSecuencia: m.origen_secuencia ?? null,
      destinoSecuencia: m.destino_secuencia ?? null,
    })));
    setImportOpen(false);
    setPartidasSel(new Set());
    setAviso(null);
    setValidationResult(null);
    setTouchedSinceValidation(false);
  }, []);

  const cargarViaje = useCallback(async (id: number) => {
    const agg = await obtenerViajeAggregate(id);
    setAggregate(agg);
    reconstruirDesdeAggregate(agg);
  }, [reconstruirDesdeAggregate]);

  const cargarTodo = useCallback(async () => {
    if (!documentoId) return;
    setLoading(true);
    setError(null);
    setAviso(null);
    setAggregate(null);
    setViajeId(null);
    try {
      const [ubi, veh, rem, ope] = await Promise.all([
        obtenerUbicacionesDisponibles(),
        obtenerVehiculos(),
        obtenerRemolques(),
        obtenerOperadoresDisponibles(),
      ]);
      setUbicaciones(ubi);
      setVehiculos(veh);
      setRemolques(rem);
      setOperadores(ope);
      const viaje = await obtenerViajePorDocumento(documentoId);
      if (viaje?.viaje_id) {
        setViajeId(viaje.viaje_id);
        await cargarViaje(viaje.viaje_id);
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el Viaje.');
    } finally {
      setLoading(false);
    }
  }, [documentoId, cargarViaje]);

  useEffect(() => {
    if (open && documentoId) void cargarTodo();
    if (!open) {
      setAggregate(null);
      setViajeId(null);
      setError(null);
      setImportOpen(false);
      setPartidas(null);
      setPartidasSel(new Set());
    }
  }, [open, documentoId, cargarTodo]);

  const crearViaje = useCallback(async () => {
    if (!documentoId) return;
    setLoading(true);
    setError(null);
    try {
      const viaje = await crearViajeDesdeDocumento(documentoId);
      setViajeId(viaje.viaje_id);
      await cargarViaje(viaje.viaje_id);
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el Viaje.');
    } finally {
      setLoading(false);
    }
  }, [documentoId, cargarViaje]);

  const onVehiculoChange = useCallback((v: VehiculoTransporte | null) => {
    touch();
    setVehiculoId(v?.id ?? null);
    if (
      v?.remolque_predeterminado_id
      && remolqueIds.length === 0
      && !handledVehRef.current.has(v.id)
      && !dismissedRemolqueRef.current.has(v.remolque_predeterminado_id)
    ) {
      handledVehRef.current.add(v.id);
      setRemolqueIds([v.remolque_predeterminado_id]);
      setAviso(`Se propuso el remolque predeterminado del vehículo (${v.remolque_predeterminado_clave ?? v.remolque_predeterminado_id}). Puedes quitarlo si no aplica.`);
    }
  }, [remolqueIds.length]);

  const setRemolquesSeleccionados = useCallback((ids: number[]) => {
    touch();
    for (const prev of remolqueIds) {
      if (!ids.includes(prev)) dismissedRemolqueRef.current.add(prev);
    }
    setRemolqueIds(ids);
  }, [remolqueIds, touch]);

  const remolqueOptions = useMemo<RemolqueTransporte[]>(() => {
    const map = new Map<number, RemolqueTransporte>();
    for (const r of remolques) map.set(r.id, r);
    const veh = vehiculos.find((v) => v.id === vehiculoId);
    if (veh?.remolque_predeterminado_id && !map.has(veh.remolque_predeterminado_id)) {
      map.set(veh.remolque_predeterminado_id, {
        id: veh.remolque_predeterminado_id,
        clave_interna: veh.remolque_predeterminado_clave ?? `#${veh.remolque_predeterminado_id}`,
        placas: veh.remolque_predeterminado_placas ?? '',
        subtipo_remolque_sat: veh.remolque_predeterminado_subtipo ?? null,
        subtipo_descripcion: null,
        activo: true,
      });
    }
    for (const id of remolqueIds) {
      if (!map.has(id)) map.set(id, { id, clave_interna: `#${id}`, placas: '', subtipo_remolque_sat: null, subtipo_descripcion: null, activo: true });
    }
    return [...map.values()];
  }, [remolques, remolqueIds, vehiculos, vehiculoId]);

  const operadorSel = operadores.find((o) => o.operador_id === operadorId) ?? null;

  // ---- Mercancías: helpers ----
  const asegurarProductos = useCallback(async () => {
    if (productos !== null) return;
    try { setProductos(await fetchProductos()); } catch { setProductos([]); }
  }, [productos]);

  const patchFila = useCallback((key: string, patch: Partial<MercanciaFila>) => {
    touch();
    setMercancias((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, [touch]);

  const quitarFila = useCallback((key: string) => {
    touch();
    setMercancias((prev) => prev.filter((f) => f.key !== key));
  }, [touch]);

  const seleccionarProducto = useCallback((key: string, p: Producto | null) => {
    if (!p) { patchFila(key, { productoId: null }); return; }
    patchFila(key, {
      productoId: p.id,
      descripcion: p.descripcion ?? '',
      claveBienesTransportadosSat: p.clave_bienes_transportados_sat ?? '',
      claveUnidadSat: (p as { clave_unidad_sat?: string | null }).clave_unidad_sat ?? p.unidad_sat ?? '',
      unidadDescripcion: p.unidad_venta_descripcion ?? p.unidad_inventario_descripcion ?? '',
      materialPeligroso: !!p.es_material_peligroso,
      claveMaterialPeligroso: p.clave_material_peligroso_sat ?? '',
      embalaje: p.clave_embalaje_sat ?? '',
      descripcionEmbalaje: p.descripcion_embalaje ?? '',
    });
  }, [patchFila]);

  const abrirImportar = useCallback(async () => {
    setImportOpen((v) => !v);
    if (partidas === null && documentoId) {
      setImportLoading(true);
      try { setPartidas(await obtenerPartidasImportables(documentoId)); }
      catch (e: any) { setError(e?.message || 'No se pudieron cargar las partidas de la factura.'); }
      finally { setImportLoading(false); }
    }
  }, [partidas, documentoId]);

  const partidaYaImportada = useCallback((p: PartidaImportable): boolean =>
    mercancias.some((m) =>
      (m.fromPartidaId != null && m.fromPartidaId === p.partida_id)
      || (p.producto_id != null && m.productoId === p.producto_id)
    ), [mercancias]);

  const importarSeleccionadas = useCallback(() => {
    if (!partidas) return;
    const nuevas = partidas
      .filter((p) => partidasSel.has(p.partida_id) && !partidaYaImportada(p))
      .map(filaDesdePartida);
    if (nuevas.length === 0) return;
    touch();
    setMercancias((prev) => [...prev, ...nuevas]);
    setPartidasSel(new Set());
    setImportOpen(false);
  }, [partidas, partidasSel, partidaYaImportada, touch]);

  // El drawer modela exactamente un origen (secuencia 1) y un destino
  // (secuencia 2). Cuando ambos están definidos se asignan automáticamente a
  // cada mercancía y no se pide selección.
  const rutaAsignable = !!(origenId && destinoId);
  const origenResumen = useMemo(() => {
    const u = ubicaciones.find((x) => x.domicilio_id === origenId);
    return u ? `${u.propietario_nombre} — ${u.identificador}` : null;
  }, [ubicaciones, origenId]);
  const destinoResumen = useMemo(() => {
    const u = ubicaciones.find((x) => x.domicilio_id === destinoId);
    return u ? `${u.propietario_nombre} — ${u.identificador}` : null;
  }, [ubicaciones, destinoId]);

  const guardar = useCallback(async (): Promise<boolean> => {
    if (!viajeId || !aggregate) return false;
    if (origenId && !origenFecha) { setError('Indica la fecha/hora programada de origen.'); return false; }
    if (destinoId && !destinoFecha) { setError('Indica la fecha/hora programada de destino.'); return false; }

    const distanciaDestino = destinoDistancia.trim() === '' ? null : Number(destinoDistancia);
    if (distanciaDestino !== null && (!Number.isFinite(distanciaDestino) || distanciaDestino <= 0)) {
      setError('La distancia recorrida del destino debe ser un número mayor a cero.');
      return false;
    }

    const ubicacionesPayload: ViajePutPayload['ubicaciones'] = [];
    if (origenId && origenFecha) ubicacionesPayload.push({ domicilioId: origenId, tipo: 'origen', secuencia: 1, fechaHoraProgramada: origenFecha });
    if (destinoId && destinoFecha) ubicacionesPayload.push({ domicilioId: destinoId, tipo: 'destino', secuencia: 2, fechaHoraProgramada: destinoFecha, distanciaRecorrida: distanciaDestino });

    // Un origen + un destino => se asignan a todas las mercancías sin pedir selección.
    const origenSecuencia = rutaAsignable ? 1 : null;
    const destinoSecuencia = rutaAsignable ? 2 : null;

    const mercPayload: ViajeMercanciaInput[] = [];
    for (let i = 0; i < mercancias.length; i++) {
      const f = mercancias[i]!;
      const cantidad = Number(f.cantidad);
      const pesoKg = Number(f.pesoKg);
      const etiqueta = f.descripcion.trim() || `#${i + 1}`;
      if (!f.productoId && !f.descripcion.trim()) { setError(`Mercancía ${etiqueta}: indica un producto o una descripción.`); return false; }
      if (!Number.isFinite(cantidad) || cantidad <= 0) { setError(`Mercancía ${etiqueta}: la cantidad debe ser mayor a cero.`); return false; }
      if (!Number.isFinite(pesoKg) || pesoKg <= 0) { setError(`Mercancía ${etiqueta}: el peso (kg) debe ser mayor a cero.`); return false; }
      const valor = f.valorMercancia.trim() === '' ? null : Number(f.valorMercancia);
      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) { setError(`Mercancía ${etiqueta}: el valor no es válido.`); return false; }
      mercPayload.push({
        productoId: f.productoId,
        descripcion: f.descripcion.trim() || null,
        cantidad,
        pesoKg,
        valorMercancia: valor,
        claveBienesTransportadosSat: f.claveBienesTransportadosSat.trim() || null,
        claveUnidadSat: f.claveUnidadSat.trim() || null,
        unidadDescripcion: f.unidadDescripcion.trim() || null,
        materialPeligroso: f.materialPeligroso,
        claveMaterialPeligroso: f.materialPeligroso ? (f.claveMaterialPeligroso.trim() || null) : null,
        embalaje: f.materialPeligroso ? (f.embalaje.trim() || null) : null,
        descripcionEmbalaje: f.materialPeligroso ? (f.descripcionEmbalaje.trim() || null) : null,
        origenSecuencia,
        destinoSecuencia,
      });
    }

    const payload: ViajePutPayload = {
      folioInterno: aggregate.viaje.folio_interno,
      clienteContactoId: aggregate.viaje.cliente_contacto_id,
      estatus: 'borrador',
      vehiculoId,
      ubicaciones: ubicacionesPayload,
      mercancias: mercPayload,
      figuras: operadorId ? [{ tipoFigura: 'operador', operadorId, secuencia: 1 }] : [],
      remolques: remolqueIds.map((remolqueId, i) => ({ remolqueId, orden: i + 1 })),
    };
    setSaving(true);
    setError(null);
    try {
      await actualizarViaje(viajeId, payload);
      await cargarViaje(viajeId); // recarga desde backend, drawer permanece abierto
      return true;
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el Viaje.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [viajeId, aggregate, origenId, origenFecha, destinoId, destinoFecha, destinoDistancia, vehiculoId, remolqueIds, operadorId, mercancias, cargarViaje]);

  const irASeccion = useCallback((section: CartaPorteIssueSection) => {
    const id = SECCION_ANCLA[section];
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const validar = useCallback(async () => {
    if (!viajeId) return;
    // 1. Guardar siempre para que el backend valide exactamente lo que se ve.
    const saved = await guardar();
    if (!saved) return; // el error de validación de captura ya se mostró
    setValidando(true);
    setError(null);
    try {
      await validarCartaPorte(viajeId);
      await cargarViaje(viajeId); // refleja estatus 'validado' y la Carta Porte materializada
      setValidationResult({ ok: true, issues: [] });
      setTouchedSinceValidation(false);
    } catch (e: any) {
      const issues: CartaPorteIssue[] = Array.isArray(e?.payload?.issues) ? e.payload.issues : [];
      setValidationResult({
        ok: false,
        issues: issues.length
          ? issues
          : [{ section: 'generales', message: e?.message || 'No se pudo validar la Carta Porte.' }],
      });
      setTouchedSinceValidation(false);
    } finally {
      setValidando(false);
    }
  }, [viajeId, guardar, cargarViaje]);

  const issuesPorSeccion = useMemo(() => {
    const map = new Map<CartaPorteIssueSection, CartaPorteIssue[]>();
    for (const it of validationResult?.ok === false ? validationResult.issues : []) {
      const arr = map.get(it.section) ?? [];
      arr.push(it);
      map.set(it.section, arr);
    }
    return map;
  }, [validationResult]);

  const cartaPorteLista = (validationResult?.ok || aggregate?.cartaPorte?.estatus === 'validado') && !touchedSinceValidation;

  const seccion = (
    icon: React.ReactNode, titulo: string, children: React.ReactNode,
    opts: { extra?: React.ReactNode; anchorId?: string; section?: CartaPorteIssueSection } = {},
  ) => {
    const conErrores = opts.section ? (issuesPorSeccion.get(opts.section)?.length ?? 0) > 0 : false;
    return (
      <Box
        id={opts.anchorId}
        sx={{
          border: '1px solid',
          borderColor: conErrores ? 'error.main' : 'divider',
          borderRadius: 2, p: 1.5,
          ...(conErrores ? { boxShadow: (t: any) => `0 0 0 1px ${t.palette.error.main} inset` } : {}),
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {icon}
          <Typography variant="subtitle2" fontWeight={700} color={conErrores ? 'error.main' : AZUL}>{titulo}</Typography>
          <Box sx={{ flex: 1 }} />
          {opts.extra}
        </Stack>
        <Stack spacing={1.25}>{children}</Stack>
      </Box>
    );
  };

  const dtField = (label: string, value: string, onChange: (v: string) => void) => (
    <TextField
      type="datetime-local" label={label} value={value} size="small" fullWidth
      onChange={(e) => { touch(); onChange(e.target.value); }}
      InputLabelProps={{ shrink: true }}
      disabled={readOnly}
    />
  );

  const mini = (label: string, value: string, onChange: (v: string) => void, opts: { type?: string } = {}) => (
    <TextField
      label={label} value={value} size="small" type={opts.type}
      onChange={(e) => onChange(e.target.value)} disabled={readOnly}
      sx={{ flex: '1 1 45%', minWidth: 120 }}
    />
  );

  const renderMercancia = (f: MercanciaFila, idx: number) => {
    const productoSel = productos?.find((p) => p.id === f.productoId) ?? null;
    return (
      <Box key={f.key} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1, bgcolor: '#fbfcfe' }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">Mercancía {idx + 1}</Typography>
          {f.fromPartidaId != null && <Chip size="small" label="de factura" sx={{ height: 18, fontSize: 10 }} />}
          <Box sx={{ flex: 1 }} />
          {!readOnly && (
            <IconButton size="small" onClick={() => quitarFila(f.key)} aria-label="Eliminar mercancía">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        <Stack spacing={1}>
          <Autocomplete
            options={productos ?? []}
            size="small"
            disabled={readOnly}
            loading={productos === null}
            value={productoSel}
            onOpen={() => void asegurarProductos()}
            onChange={(_, p) => seleccionarProducto(f.key, p)}
            getOptionLabel={productoLabel}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(p) => <TextField {...p} label="Producto (opcional)" placeholder="Clave o descripción" />}
          />
          <TextField
            label="Descripción" value={f.descripcion} size="small" fullWidth disabled={readOnly}
            onChange={(e) => patchFila(f.key, { descripcion: e.target.value })}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {mini('Cantidad', f.cantidad, (v) => patchFila(f.key, { cantidad: v }), { type: 'number' })}
            {mini('Unidad', f.unidadDescripcion, (v) => patchFila(f.key, { unidadDescripcion: v }))}
            {mini('Peso (kg)', f.pesoKg, (v) => patchFila(f.key, { pesoKg: v }), { type: 'number' })}
            {mini('Valor', f.valorMercancia, (v) => patchFila(f.key, { valorMercancia: v }), { type: 'number' })}
          </Stack>
          <SatClaveField
            label="Bienes/servicios transportados (SAT)"
            catalogo="bienes"
            value={f.claveBienesTransportadosSat}
            disabled={readOnly}
            onChange={(clave) => patchFila(f.key, { claveBienesTransportadosSat: clave })}
          />
          <SatClaveField
            label="Unidad SAT"
            catalogo="unidades"
            value={f.claveUnidadSat}
            disabled={readOnly}
            onChange={(clave) => patchFila(f.key, { claveUnidadSat: clave })}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={f.materialPeligroso} disabled={readOnly}
              onChange={(e) => patchFila(f.key, { materialPeligroso: e.target.checked })} />}
            label={<Typography variant="body2">Material peligroso</Typography>}
          />
          {f.materialPeligroso && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {mini('Clave mat. peligroso', f.claveMaterialPeligroso, (v) => patchFila(f.key, { claveMaterialPeligroso: v }))}
              {mini('Embalaje', f.embalaje, (v) => patchFila(f.key, { embalaje: v }))}
              {mini('Descripción embalaje', f.descripcionEmbalaje, (v) => patchFila(f.key, { descripcionEmbalaje: v }))}
            </Stack>
          )}
          {rutaAsignable ? (
            <Typography variant="caption" color="text.secondary">
              Origen → Destino: {origenResumen} → {destinoResumen} (asignado automáticamente)
            </Typography>
          ) : (
            <Typography variant="caption" color="warning.main">
              Define el origen y el destino en la sección Ruta para asignarlos a esta mercancía.
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, maxWidth: '100%' } }}>
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75, height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color={AZUL}>Carta Porte / Viaje</Typography>
            <Typography variant="caption" color="text.secondary">
              Factura {folio}{viajeId ? ` · Viaje #${viajeId}` : ''}{aggregate?.viaje?.estatus ? ` · ${aggregate.viaje.estatus}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Stack>
        <Divider />

        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
        ) : error && !aggregate && !viajeId ? (
          <Alert severity="error">{error}</Alert>
        ) : !viajeId ? (
          <Stack spacing={1.5} sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">Esta factura aún no tiene Viaje relacionado.</Typography>
            <Button variant="contained" size="small" onClick={() => void crearViaje()}>Crear viaje</Button>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ overflowY: 'auto', pr: 0.5 }}>
            {readOnly && <Alert severity="info" sx={{ py: 0 }}>Viaje en sólo lectura ({aggregate?.viaje?.estatus}).</Alert>}
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {aviso && <Alert severity="warning" onClose={() => setAviso(null)}>{aviso}</Alert>}

            {seccion(<RouteIcon fontSize="small" htmlColor={AZUL} />, 'Ruta', (
              <>
                <Autocomplete
                  options={ubicaciones}
                  size="small"
                  disabled={readOnly}
                  value={ubicaciones.find((u) => u.domicilio_id === origenId) ?? null}
                  onChange={(_, v) => { touch(); setOrigenId(v?.domicilio_id ?? null); }}
                  getOptionLabel={ubicacionLabel}
                  isOptionEqualToValue={(o, v) => o.domicilio_id === v.domicilio_id}
                  renderInput={(p) => <TextField {...p} label="Origen" placeholder="Buscar ubicación" />}
                />
                {dtField('Fecha/hora programada origen', origenFecha, setOrigenFecha)}
                <Autocomplete
                  options={ubicaciones}
                  size="small"
                  disabled={readOnly}
                  value={ubicaciones.find((u) => u.domicilio_id === destinoId) ?? null}
                  onChange={(_, v) => { touch(); setDestinoId(v?.domicilio_id ?? null); }}
                  getOptionLabel={ubicacionLabel}
                  isOptionEqualToValue={(o, v) => o.domicilio_id === v.domicilio_id}
                  renderInput={(p) => <TextField {...p} label="Destino" placeholder="Buscar ubicación" />}
                />
                {dtField('Fecha/hora programada destino', destinoFecha, setDestinoFecha)}
                {destinoId && (
                  <TextField
                    label="Distancia recorrida (km)"
                    type="number"
                    size="small"
                    fullWidth
                    disabled={readOnly}
                    value={destinoDistancia}
                    onChange={(e) => { touch(); setDestinoDistancia(e.target.value); }}
                    helperText="Requerida por la Carta Porte para el destino."
                    inputProps={{ min: 0, step: 'any' }}
                  />
                )}
              </>
            ), { anchorId: 'cp-sec-ruta', section: 'ruta' })}

            {seccion(<LocalShippingIcon fontSize="small" htmlColor={AZUL} />, 'Unidad', (
              <>
                <Autocomplete
                  options={vehiculos}
                  size="small"
                  disabled={readOnly}
                  value={vehiculos.find((v) => v.id === vehiculoId) ?? null}
                  onChange={(_, v) => onVehiculoChange(v)}
                  getOptionLabel={vehiculoLabel}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderInput={(p) => <TextField {...p} label="Vehículo" placeholder="Clave o placas" />}
                />
                <Autocomplete
                  multiple
                  options={remolqueOptions}
                  size="small"
                  disabled={readOnly}
                  value={remolqueOptions.filter((r) => remolqueIds.includes(r.id))}
                  onChange={(_, v) => setRemolquesSeleccionados(v.map((r) => r.id))}
                  getOptionLabel={remolqueLabel}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderTags={(value, getTagProps) =>
                    value.map((r, index) => (
                      <Chip size="small" label={`${r.clave_interna}${r.placas ? ` · ${r.placas}` : ''}`} {...getTagProps({ index })} key={r.id} />
                    ))}
                  renderInput={(p) => <TextField {...p} label="Remolques" placeholder="Agregar remolque" />}
                />
              </>
            ), { anchorId: 'cp-sec-unidad', section: 'unidad' })}

            {seccion(<BadgeIcon fontSize="small" htmlColor={AZUL} />, 'Operador', (
              <>
                <Autocomplete
                  options={operadores}
                  size="small"
                  disabled={readOnly}
                  value={operadorSel}
                  onChange={(_, v) => { touch(); setOperadorId(v?.operador_id ?? null); }}
                  getOptionLabel={operadorLabel}
                  isOptionEqualToValue={(o, v) => o.operador_id === v.operador_id}
                  renderInput={(p) => <TextField {...p} label="Operador" placeholder="Nombre o licencia" />}
                />
                {operadorSel && (
                  <Box sx={{ bgcolor: '#f8fafc', borderRadius: 1.5, p: 1 }}>
                    <Typography variant="caption" display="block" color="text.secondary">
                      RFC: {operadorSel.rfc ?? '—'} · CURP: {operadorSel.curp ?? '—'}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Licencia: {operadorSel.numero_licencia} · Tipo: {operadorSel.tipo_licencia ?? '—'} · Vigencia: {operadorSel.vigencia_licencia ? String(operadorSel.vigencia_licencia).slice(0, 10) : '—'}
                    </Typography>
                  </Box>
                )}
              </>
            ), { anchorId: 'cp-sec-operador', section: 'operador' })}

            {seccion(
              <Inventory2OutlinedIcon fontSize="small" htmlColor={AZUL} />, 'Mercancías',
              (
                <>
                  {!readOnly && importOpen && (
                    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">Partidas de la factura</Typography>
                      {importLoading ? (
                        <Stack alignItems="center" sx={{ py: 1 }}><CircularProgress size={18} /></Stack>
                      ) : !partidas || partidas.length === 0 ? (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          La factura no tiene partidas importables.
                        </Typography>
                      ) : (
                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                          {partidas.map((p) => {
                            const yaImp = partidaYaImportada(p);
                            return (
                              <FormControlLabel
                                key={p.partida_id}
                                sx={{ m: 0 }}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={partidasSel.has(p.partida_id)}
                                    disabled={yaImp}
                                    onChange={(e) => setPartidasSel((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(p.partida_id); else next.delete(p.partida_id);
                                      return next;
                                    })}
                                  />
                                }
                                label={
                                  <Typography variant="caption" color={yaImp ? 'text.disabled' : 'text.primary'}>
                                    {p.numero_partida}. {p.descripcion ?? '(sin descripción)'} · {numStr(p.cantidad) || '—'}{p.unidad_partida ? ` ${p.unidad_partida}` : ''}
                                    {yaImp ? ' · ya importada' : ''}
                                  </Typography>
                                }
                              />
                            );
                          })}
                          <Button size="small" variant="contained" sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                            disabled={partidasSel.size === 0}
                            onClick={importarSeleccionadas}>
                            Importar {partidasSel.size > 0 ? `(${partidasSel.size})` : ''}
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  )}

                  {mercancias.length === 0 && (
                    <Typography variant="caption" color="text.secondary">Sin mercancías. Importa desde la factura o agrega una.</Typography>
                  )}
                  {mercancias.map((f, i) => renderMercancia(f, i))}

                  {!readOnly && (
                    <Button size="small" startIcon={<AddIcon />} onClick={() => { touch(); setMercancias((prev) => [...prev, nuevaFila()]); }} sx={{ alignSelf: 'flex-start' }}>
                      Agregar mercancía
                    </Button>
                  )}
                </>
              ),
              {
                anchorId: 'cp-sec-mercancias',
                section: 'mercancias',
                extra: !readOnly ? (
                  <Button size="small" onClick={() => void abrirImportar()}>
                    {importOpen ? 'Ocultar' : 'Importar desde factura'}
                  </Button>
                ) : undefined,
              },
            )}

            {/* ---- Validación de Carta Porte ---- */}
            {!readOnly && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CheckCircleOutlineIcon fontSize="small" htmlColor={AZUL} />
                  <Typography variant="subtitle2" fontWeight={700} color={AZUL}>Validación</Typography>
                </Stack>

                {cartaPorteLista && (
                  <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{ mb: 1 }}>
                    Carta Porte lista para timbrar
                  </Alert>
                )}
                {validationResult?.ok && touchedSinceValidation && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Cambiaste datos después de validar. Vuelve a validar la Carta Porte.
                  </Alert>
                )}

                {validationResult && !validationResult.ok && (
                  <Stack spacing={1} sx={{ mb: 1 }}>
                    <Alert severity="error" sx={{ py: 0 }}>
                      La Carta Porte no puede timbrarse todavía. {validationResult.issues.length} punto(s) por resolver
                      {touchedSinceValidation ? ' (revisa; los datos cambiaron desde la última validación)' : ''}.
                    </Alert>
                    {[...issuesPorSeccion.entries()].map(([section, list]) => (
                      <Box key={section} sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 1.5, p: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="caption" fontWeight={700} color="error.main">
                            {SECCION_LABEL[section]} ({list.length})
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          {SECCION_ANCLA[section] && (
                            <Button size="small" sx={{ minWidth: 0, py: 0 }} onClick={() => irASeccion(section)}>Ir</Button>
                          )}
                        </Stack>
                        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                          {list.map((it, i) => (
                            <li key={i}>
                              <Typography variant="caption" color="text.primary">{it.message}</Typography>
                            </li>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}

                <Button
                  fullWidth variant="outlined" color="primary"
                  disabled={saving || validando}
                  onClick={() => void validar()}
                >
                  {validando ? 'Validando…' : 'Validar Carta Porte'}
                </Button>
              </Box>
            )}

            {!readOnly && (
              <Button variant="contained" onClick={() => void guardar()} disabled={saving || validando}>
                {saving ? 'Guardando…' : 'Guardar viaje'}
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
