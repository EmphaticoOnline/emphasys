import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  Popover,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import type { Producto, ProductoBasico } from '../../types/producto';
import {
  fetchProducto,
  fetchProductoArchivos,
  obtenerCatalogosConfigurablesProducto,
  updateProducto,
  uploadProductoImagen,
  deleteProductoArchivo,
  marcarProductoArchivoPrincipal,
  type ProductoArchivo,
  type CatalogoConfigurablesProductoRespuesta,
  fetchExistenciasProducto,
  fetchDocumentosRelacionadosProducto,
  type ExistenciaProducto,
  type DocumentoRelacionadoProducto,
} from '../../services/productosService';
import { buildAssetUrl } from '../../services/empresasAssetsService';
import EspecificacionesBibliotecaEditor from './EspecificacionesBibliotecaEditor';
import { getDocumentoTypeConfig } from '../../modules/documentos/documentoTypeConfig';
import { resolveDocumentoFormPath, type DocumentoModulo } from '../../modules/documentos/documentoNavigation';
import { fetchKardexProducto, type KardexLinea } from '../../services/reportesService';
import { fetchParametrosSistema } from '../../services/parametrosService';
import { useGridPreferences } from '../../hooks/useGridPreferences';
import ProductoHistorialComercial from './ProductoHistorialComercial';
import { folioVisualDesdeSerieYFolio, resolverFolioVisual } from '../../utils/documentos.utils';
import type { RestauracionProductoRelacionado } from '../../modules/productos/productosOrigenNavegacion';
import { amountSignColor } from '../../theme/sign';

export async function alternarActivoDeProducto(producto: Producto): Promise<Producto> {
  const payload: ProductoBasico = {
    clave: producto.clave,
    descripcion: producto.descripcion,
    clasificacion: producto.clasificacion,
    tipo_producto: producto.tipo_producto,
    activo: !producto.activo,
    clave_producto_sat: producto.clave_producto_sat,
    unidad_venta_id: producto.unidad_venta_id,
    unidad_inventario_id: producto.unidad_inventario_id,
    especificaciones: producto.especificaciones,
  };
  return updateProducto(producto.id, payload);
}

type ProductoWorkspaceProps = {
  productoId: number | null;
  esAdmin: boolean;
  onEditar: (productoId: number) => void;
  onEliminar: (producto: Producto) => void;
  onChanged?: () => void;
  onAlternarActivo?: (producto: Producto) => Promise<Producto | void>;
  alternando?: boolean;
  compacto?: boolean;
  onVolver?: () => void;
  restauracion?: RestauracionProductoRelacionado | null;
  onScrollDetalle?: (scrollTop: number) => void;
  onAbrirDocumentoRelacionado?: (ruta: string, tipo: string) => void;
};

const COLUMNAS_RELACIONADOS = '88px 128px minmax(140px, 200px) 112px 28px';

const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

const TIPOS_COMPRA = new Set([
  'requisicion',
  'orden_compra',
  'recepcion',
  'factura_compra',
  'nota_credito_compra',
  'pago_proveedor',
  'ajuste_proveedor',
]);

const ESTATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  emitido: 'Emitido',
  cancelado: 'Cancelado',
  cerrado: 'Cerrado',
  timbrado: 'Timbrado',
  pagado: 'Pagado',
  enviado: 'Enviado',
  'en negociacion': 'En negociación',
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return currencyFormatter.format(numeric);
}

function formatQty(value: number, decimales = 2) {
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(Number(value) || 0);
}

function normalizarTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function esServicio(tipo: string | null | undefined) {
  return normalizarTexto(String(tipo ?? '').trim()) === 'servicio';
}

function esNoInventariable(tipo: string | null | undefined) {
  return normalizarTexto(String(tipo ?? '').trim()) === 'no inventariable';
}

function etiquetaEstado(estado: string | null) {
  if (!estado) return '—';
  const clave = normalizarTexto(estado.trim());
  return ESTATUS_LABEL[clave] ?? estado;
}

function moduloDocumento(tipo: string): DocumentoModulo {
  const config = getDocumentoTypeConfig(tipo);
  if (config?.modulo === 'compras' || TIPOS_COMPRA.has(tipo)) return 'compras';
  return 'ventas';
}

function rutaDocumento(documento: DocumentoRelacionadoProducto): string | null {
  if (!documento.tipo || !getDocumentoTypeConfig(documento.tipo)) return null;
  return resolveDocumentoFormPath(documento.tipo, documento.id, moduloDocumento(documento.tipo));
}

// Deriva un valor de Resumen (Clasificación/Familia/Línea) a partir de los
// catálogos comerciales configurables asociados al producto, NUNCA de las
// columnas legacy producto.clasificacion/familia/linea. El framework de
// catálogos no expone un identificador estable por concepto (solo `nombre`
// libre por empresa), así que se ubica el tipo de catálogo por coincidencia
// de texto contra el nombre configurado (p. ej. "Clasificaciones de
// Productos" contiene "clasificacion"). Si la empresa no tiene un catálogo
// con ese nombre, o no hay valores seleccionados, se devuelve null para que
// el llamador omita la etiqueta en vez de mostrar un "—".
function valorCatalogoPorNombre(catalogos: CatalogoConfigurablesProductoRespuesta | null, patron: string): string | null {
  if (!catalogos) return null;
  const tipo = catalogos.tipos.find((t) => t.nombre && normalizarTexto(t.nombre).includes(patron));
  if (!tipo) return null;
  const seleccionados = tipo.valores
    .filter((v) => catalogos.seleccionados.includes(v.id))
    .map((v) => v.descripcion);
  return seleccionados.length ? seleccionados.join(', ') : null;
}

function InfoRow({ label, value, denso = false }: { label: string; value: React.ReactNode; denso?: boolean }) {
  const visible = value || value === 0 ? value : '—';
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ display: 'block', mb: denso ? 0 : 0.15, fontSize: denso ? 10 : 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography
        title={typeof visible === 'string' ? visible : undefined}
        sx={{
          fontSize: denso ? 12.5 : 13,
          fontWeight: 600,
          lineHeight: denso ? 1.25 : 1.35,
          color: (theme) => theme.emphasys.content.foreground,
          wordBreak: 'break-word',
          ...(denso ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null),
        }}
      >
        {visible}
      </Typography>
    </Box>
  );
}

function SectionCard({
  title,
  action,
  children,
  llenar = false,
  densa = false,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  llenar?: boolean;
  densa?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        border: `1px solid ${theme.emphasys.content.border}`,
        borderRadius: 2,
        backgroundColor: theme.emphasys.action.wash,
        overflow: 'hidden',
        height: densa ? '100%' : undefined,
        ...(llenar ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null),
      })}
    >
      <Box
        sx={{
          px: densa ? 1 : 1.25,
          py: densa ? 0.45 : 0.85,
          flexShrink: 0,
          borderBottom: (theme) => `1px solid ${theme.emphasys.content.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
          {title}
        </Typography>
        {action ? <Box sx={{ ml: 'auto' }}>{action}</Box> : null}
      </Box>
      <Box sx={{ p: densa ? 0.85 : 1.25, ...(llenar ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null) }}>{children}</Box>
    </Box>
  );
}

function PendingCard({ title, message }: { title: string; message: string }) {
  return (
    <SectionCard
      title={title}
      action={
        <Chip
          label="Requiere integración"
          size="small"
          sx={(theme) => ({ height: 20, fontSize: 11, fontWeight: 700, backgroundColor: theme.emphasys.metric.amount.background, color: theme.emphasys.content.foreground })}
        />
      }
    >
      <Typography sx={{ fontSize: 13, lineHeight: 1.45, color: (theme) => theme.emphasys.content.muted }}>
        {message}
      </Typography>
    </SectionCard>
  );
}

function ExistenciasAlmacen({
  existencias,
  tipo,
  decimalesCantidad = 2,
  almacenSeleccionadoId = null,
  onSeleccionarAlmacen,
}: {
  existencias: ExistenciaProducto[];
  tipo: string | null;
  decimalesCantidad?: number;
  almacenSeleccionadoId?: number | null;
  onSeleccionarAlmacen?: (almacenId: number) => void;
}) {
  if (esServicio(tipo)) {
    return (
      <Typography sx={{ fontSize: 13, lineHeight: 1.45, color: (theme) => theme.emphasys.content.secondary }}>
        Los servicios no registran existencias por almacén.
      </Typography>
    );
  }

  if (esNoInventariable(tipo) && existencias.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, lineHeight: 1.45, color: (theme) => theme.emphasys.content.secondary }}>
        Este producto no controla inventario por almacén.
      </Typography>
    );
  }

  if (existencias.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>
        Sin existencias registradas.
      </Typography>
    );
  }

  const filas = [...existencias].sort((a, b) => a.almacen.localeCompare(b.almacen, 'es'));
  const total = filas.reduce((suma, fila) => suma + Number(fila.existencia || 0), 0);

  return (
    <Box>
      {esNoInventariable(tipo) ? (
        <Typography sx={{ mb: 1, fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>
          Producto no inventariable con movimientos registrados.
        </Typography>
      ) : null}
      <Box sx={(theme) => ({ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: 'minmax(0, 1.4fr) 72px 64px 92px', gap: 0.75, px: 0.75, py: 0.55, borderRadius: 1.5, bgcolor: theme.emphasys.grid.header, color: theme.emphasys.grid.headerForeground, fontSize: 11, fontWeight: 700 })}>
        <span>Almacén</span>
        <span style={{ textAlign: 'right' }}>Existencia</span>
        <span style={{ textAlign: 'right' }}>Mínimo</span>
        <span style={{ textAlign: 'right' }}>Actualización</span>
      </Box>
      {filas.map((fila) => {
        const bajoMinimo = Number(fila.minimo_inventario) > 0 && Number(fila.existencia) < Number(fila.minimo_inventario);
        const seleccionado = almacenSeleccionadoId === fila.almacen_id;
        const seleccionable = Boolean(onSeleccionarAlmacen);
        return (
          <Box
            key={fila.almacen_id}
            component={seleccionable ? 'button' : 'div'}
            type={seleccionable ? 'button' : undefined}
            aria-pressed={seleccionable ? seleccionado : undefined}
            onClick={seleccionable ? () => onSeleccionarAlmacen?.(fila.almacen_id) : undefined}
            sx={(theme) => ({
              display: 'grid',
              width: '100%',
              gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1.4fr) 72px 64px 92px' },
              gap: 0.75,
              px: 0.75,
              py: 0.7,
              font: 'inherit',
              textAlign: 'inherit',
              fontSize: 13,
              border: 0,
              borderBottom: `1px solid ${theme.emphasys.content.border}`,
              color: theme.emphasys.content.foreground,
              backgroundColor: seleccionado ? theme.emphasys.metric.amount.background : 'transparent',
              boxShadow: seleccionado ? `inset 2px 0 0 ${theme.emphasys.content.foreground}` : 'none',
              cursor: seleccionable ? 'pointer' : 'default',
              '&:hover': seleccionable ? { backgroundColor: seleccionado ? theme.emphasys.metric.amount.background : theme.emphasys.content.hover } : undefined,
              '&:focus-visible': seleccionable ? { outline: `2px solid ${theme.emphasys.content.foreground}`, outlineOffset: -2 } : undefined,
            })}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13 }}>{fila.almacen}</Typography>
              <Typography sx={{ display: { sm: 'none' }, fontSize: 11, color: (theme) => theme.emphasys.content.muted }}>
                Mín. {formatQty(fila.minimo_inventario, decimalesCantidad)} · {formatDate(fila.ultima_fecha) ?? 'sin movimiento'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (theme) => (bajoMinimo ? theme.emphasys.metric.blocked.foreground : theme.emphasys.content.foreground) }}>
              {formatQty(fila.existencia, decimalesCantidad)}
            </Typography>
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (theme) => theme.emphasys.content.secondary }}>
              {formatQty(fila.minimo_inventario, decimalesCantidad)}
            </Typography>
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12, textAlign: 'right', color: (theme) => theme.emphasys.content.muted }}>
              {formatDate(fila.ultima_fecha) ?? '—'}
            </Typography>
          </Box>
        );
      })}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, px: 0.75, pt: 0.85 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
          Total
        </Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (theme) => theme.emphasys.content.foreground }}>
          {formatQty(total, decimalesCantidad)}
        </Typography>
      </Box>
    </Box>
  );
}

const KARDEX_DEFAULT_ORDER = ['fecha', 'cantidad', 'existencia', 'costo', 'costo_promedio', 'contacto', 'documento', 'observaciones'] as const;
type KardexColumnaId = (typeof KARDEX_DEFAULT_ORDER)[number];
const KARDEX_DEFINICIONES: { id: KardexColumnaId; label: string; ancho: number; numerica: boolean; flexible: boolean }[] = [
  { id: 'fecha', label: 'Fecha', ancho: 92, numerica: false, flexible: false },
  { id: 'cantidad', label: 'Cantidad', ancho: 96, numerica: true, flexible: false },
  { id: 'existencia', label: 'Existencia', ancho: 104, numerica: true, flexible: false },
  { id: 'costo', label: 'Costo', ancho: 80, numerica: true, flexible: false },
  { id: 'costo_promedio', label: 'Costo promedio', ancho: 88, numerica: true, flexible: false },
  { id: 'contacto', label: 'Contacto', ancho: 148, numerica: false, flexible: true },
  { id: 'documento', label: 'Documento', ancho: 112, numerica: false, flexible: false },
  { id: 'observaciones', label: 'Observaciones', ancho: 156, numerica: false, flexible: true },
];
const KARDEX_POR_ID = new Map(KARDEX_DEFINICIONES.map((columna) => [columna.id, columna]));
const KARDEX_FIJAS = new Set<KardexColumnaId>(['fecha', 'cantidad']);
const KARDEX_ORDEN_INICIAL: string[] = [...KARDEX_DEFAULT_ORDER];
const KARDEX_VISIBILIDAD_INICIAL = Object.fromEntries(KARDEX_DEFAULT_ORDER.map((id) => [id, true]));
const KARDEX_ANCHO_MIN = 72;
const KARDEX_ANCHO_MAX = 420;
const KARDEX_ALTO_ENCABEZADO = 40;
const KARDEX_ALTO_FILA = 28;

function esColumnaKardex(id: string): id is KardexColumnaId {
  return KARDEX_POR_ID.has(id as KardexColumnaId);
}

function normalizarOrdenKardex(order: readonly string[]): KardexColumnaId[] {
  const vistos = new Set<KardexColumnaId>();
  const orden: KardexColumnaId[] = [];
  for (const id of order) {
    if (!esColumnaKardex(id) || vistos.has(id)) continue;
    vistos.add(id);
    orden.push(id);
  }
  for (const id of KARDEX_DEFAULT_ORDER) {
    if (!vistos.has(id)) orden.push(id);
  }
  return orden;
}

function normalizarVisibilidadKardex(model: Record<string, boolean | undefined>): Record<KardexColumnaId, boolean> {
  return Object.fromEntries(KARDEX_DEFAULT_ORDER.map((id) => [id, KARDEX_FIJAS.has(id) || model[id] !== false])) as Record<KardexColumnaId, boolean>;
}

function normalizarAnchosKardex(widths: Record<string, number>): Partial<Record<KardexColumnaId, number>> {
  const anchos: Partial<Record<KardexColumnaId, number>> = {};
  for (const columna of KARDEX_DEFINICIONES) {
    const valor = Number(widths[columna.id]);
    if (!Number.isFinite(valor)) continue;
    anchos[columna.id] = Math.min(KARDEX_ANCHO_MAX, Math.max(KARDEX_ANCHO_MIN, Math.round(valor)));
  }
  return anchos;
}

function formatNumeroKardex(value: number, opciones?: { signo?: boolean; decimales?: number }): string {
  if (!Number.isFinite(value)) return '—';
  let texto = Math.abs(value).toString();
  if (/e/i.test(texto)) texto = Math.abs(value).toFixed(12);
  const [enteraParte, fraccion = ''] = texto.split('.');
  const entera = enteraParte || '0';
  const decimales = Math.max(0, Math.min(6, opciones?.decimales ?? 6));
  const fraccionVisible = fraccion.slice(0, decimales).padEnd(decimales, '0');
  const enteraMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cuerpo = fraccionVisible ? `${enteraMiles}.${fraccionVisible}` : enteraMiles;
  if (value < 0) return `−${cuerpo}`;
  if (opciones?.signo && value > 0) return `+${cuerpo}`;
  return cuerpo;
}

function cantidadKardex(entrada: number | null, salida: number | null): number | null {
  if (entrada == null && salida == null) return null;
  const entradas = entrada ?? 0;
  const salidas = salida ?? 0;
  if (entradas === 0 && salidas === 0) return 0;
  if (salidas === 0) return entradas;
  if (entradas === 0) return -salidas;
  return entradas - salidas;
}

function numeroKardex(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function folioKardex(linea: KardexLinea): string {
  const tieneDocumento = Boolean(
    linea.doc_tipo || linea.doc_serie || linea.doc_numero != null || linea.doc_serie_externa || linea.doc_numero_externo != null,
  );
  if (!tieneDocumento) return '—';
  const folio = resolverFolioVisual(
    {
      serie: linea.doc_serie,
      numero: linea.doc_numero,
      serie_externa: linea.doc_serie_externa,
      numero_externo: linea.doc_numero_externo,
    },
    linea.doc_tipo ?? '',
  ).trim();
  return folio || '—';
}

function etiquetaDocumento(tipo: string | null): string | null {
  if (!tipo) return null;
  return getDocumentoTypeConfig(tipo)?.label ?? null;
}

function KardexProducto({
  lineas,
  cargando,
  error,
  decimalesCantidad,
  decimalesCosto,
}: {
  lineas: KardexLinea[];
  cargando: boolean;
  error: string | null;
  decimalesCantidad: number;
  decimalesCosto: number;
}) {
  const {
    loadingPreferences,
    columnOrder,
    columnVisibilityModel,
    columnWidths,
    setColumnOrder,
    setColumnVisibilityModel,
    setColumnWidths,
  } = useGridPreferences({
    pantalla: 'productos.inventario.kardex',
    perfilDispositivo: 'desktop',
    defaultColumnOrder: KARDEX_ORDEN_INICIAL,
    defaultColumnVisibilityModel: KARDEX_VISIBILIDAD_INICIAL,
  });
  const [columnasAnchor, setColumnasAnchor] = React.useState<HTMLElement | null>(null);
  const redimensionando = React.useRef(false);
  const orden = React.useMemo(() => normalizarOrdenKardex(columnOrder), [columnOrder]);
  const visibilidad = React.useMemo(() => normalizarVisibilidadKardex(columnVisibilityModel), [columnVisibilityModel]);
  const anchos = React.useMemo(() => normalizarAnchosKardex(columnWidths), [columnWidths]);
  const columnas = React.useMemo(
    () => orden.filter((id) => visibilidad[id]).map((id) => {
      const definicion = KARDEX_POR_ID.get(id)!;
      const anchoGuardado = anchos[id];
      return { ...definicion, ancho: anchoGuardado ?? definicion.ancho, flexible: definicion.flexible && anchoGuardado == null };
    }),
    [anchos, orden, visibilidad],
  );

  React.useEffect(() => {
    if (loadingPreferences) return;
    const ordenActual = columnOrder.join('|');
    const ordenNormal = orden.join('|');
    if (ordenActual !== ordenNormal) setColumnOrder(() => orden);
    const visibilidadNormal = JSON.stringify(visibilidad);
    const visibilidadActual = JSON.stringify(normalizarVisibilidadKardex(columnVisibilityModel));
    if (visibilidadActual !== visibilidadNormal || JSON.stringify(columnVisibilityModel) !== visibilidadNormal) {
      setColumnVisibilityModel(visibilidad);
    }
    if (JSON.stringify(columnWidths) !== JSON.stringify(anchos)) setColumnWidths(() => anchos);
  }, [anchos, columnOrder, columnVisibilityModel, columnWidths, loadingPreferences, orden, setColumnOrder, setColumnVisibilityModel, setColumnWidths, visibilidad]);

  const reordenar = (origen: string, destino: KardexColumnaId) => {
    if (!esColumnaKardex(origen) || origen === destino) return;
    setColumnOrder((actual) => {
      const base = normalizarOrdenKardex(actual);
      const desde = base.indexOf(origen);
      const hacia = base.indexOf(destino);
      if (desde < 0 || hacia < 0 || desde === hacia) return base;
      base.splice(desde, 1);
      base.splice(hacia, 0, origen);
      return base;
    });
  };

  const iniciarRedimension = (id: KardexColumnaId, event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    redimensionando.current = true;
    const encabezado = event.currentTarget.parentElement;
    const inicioX = event.clientX;
    const inicioAncho = encabezado?.getBoundingClientRect().width ?? KARDEX_POR_ID.get(id)?.ancho ?? KARDEX_ANCHO_MIN;
    const mover = (movement: PointerEvent) => {
      const siguiente = Math.min(KARDEX_ANCHO_MAX, Math.max(KARDEX_ANCHO_MIN, Math.round(inicioAncho + movement.clientX - inicioX)));
      setColumnWidths((prev) => ({ ...prev, [id]: siguiente }));
    };
    const terminar = () => {
      window.removeEventListener('pointermove', mover);
      redimensionando.current = false;
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', terminar, { once: true });
  };
  const libroRef = React.useRef<HTMLDivElement | null>(null);
  const [altoLibro, setAltoLibro] = React.useState(0);

  React.useLayoutEffect(() => {
    const nodo = libroRef.current;
    if (!nodo) return undefined;
    const medir = () => setAltoLibro(nodo.clientHeight);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  const capacidad = Math.floor(Math.max(0, altoLibro - KARDEX_ALTO_ENCABEZADO) / KARDEX_ALTO_FILA);
  const desborda = capacidad > 0 && lineas.length > capacidad;
  const vacios = desborda ? 0 : Math.max(0, capacidad - lineas.length);
  const aviso = error ?? (cargando && lineas.length === 0 ? 'Consultando movimientos…' : !lineas.length ? 'Sin movimientos de inventario registrados.' : null);

  const anchoMinimo = columnas.reduce((suma, columna) => suma + (columna.flexible ? 96 : columna.ancho), 0);
  const hayFlexible = columnas.some((columna) => columna.flexible);

  return (
    <Box
      ref={libroRef}
      sx={(theme) => ({
        position: 'relative',
        flex: 1,
        minHeight: 0,
        mx: -1.25,
        mb: -1.25,
        mt: -1.25,
        overflowX: 'auto',
        overflowY: desborda ? 'auto' : 'hidden',
        backgroundColor: theme.emphasys.content.elevated,
        fontFamily: theme.typography.fontFamily,
      })}
    >
      <Box
        component="table"
        sx={(theme) => ({
          width: hayFlexible ? '100%' : anchoMinimo,
          minWidth: anchoMinimo,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          borderSpacing: 0,
          fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums',
          '& th, & td': {
            boxSizing: 'border-box',
            padding: '0 8px',
            overflow: 'hidden',
          },
          '& th:first-of-type, & td:first-of-type': { paddingLeft: '10px' },
          '& td:last-of-type': { paddingRight: '10px' },
          '& th:last-of-type': { paddingRight: '28px' },
          '& thead th': {
            position: 'sticky',
            top: 0,
            zIndex: 2,
            height: KARDEX_ALTO_ENCABEZADO,
            backgroundColor: theme.emphasys.grid.header,
            color: theme.emphasys.grid.headerForeground,
            fontSize: 10.5,
            fontWeight: 650,
            letterSpacing: '0.07em',
            lineHeight: 1.15,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            cursor: 'grab',
            userSelect: 'none',
          },
          '& tbody td': {
            height: KARDEX_ALTO_FILA,
            borderBottom: `1px solid ${theme.emphasys.content.border}`,
            fontSize: 12,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          },
        })}
      >
        <colgroup>
          {columnas.map((columna) => (
            <col key={columna.id} style={columna.flexible ? undefined : { width: columna.ancho }} />
          ))}
        </colgroup>
        <Box component="thead">
          <Box component="tr">
            {columnas.map((columna) => (
              <Box
                component="th"
                key={columna.id}
                scope="col"
                draggable
                onDragStart={(event) => {
                  if (redimensionando.current) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', columna.id);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  reordenar(event.dataTransfer.getData('text/plain'), columna.id);
                }}
                sx={{
                  position: 'relative',
                  textAlign: columna.numerica ? 'right' : 'left',
                  ...(columna.id === 'existencia' ? { borderLeft: (theme) => `1px solid ${theme.emphasys.navigation.track}` } : null),
                }}
              >
                {columna.id === 'costo_promedio' ? (
                  <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
                    <span>Costo</span>
                    <span>promedio</span>
                  </Box>
                ) : columna.label}
                <Box
                  component="span"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Redimensionar ${columna.label}`}
                  onPointerDown={(event) => iniciarRedimension(columna.id, event)}
                  onClick={(event) => event.stopPropagation()}
                  sx={{ position: 'absolute', top: 0, right: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                />
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {lineas.map((linea, index) => {
            const cantidad = cantidadKardex(numeroKardex(linea.entrada), numeroKardex(linea.salida));
            const existencia = numeroKardex(linea.existencia_despues);
            const costo = numeroKardex(linea.costo_unitario);
            const costoPromedio = numeroKardex(linea.costo_promedio_resultante);
            const precisionCantidad = linea.precision_cantidad ?? decimalesCantidad;
            const precisionCosto = linea.precision_costo ?? decimalesCosto;
            const observaciones = (linea.observaciones ?? '').trim();
            const contacto = (linea.contacto_nombre ?? '').trim();
            const folio = folioKardex(linea);
            const documento = etiquetaDocumento(linea.doc_tipo);
            const documentoCompleto = [folio !== '—' ? folio : '', documento].filter(Boolean).join(' ');
            const fondo = (theme: { emphasys: { content: { elevated: string }; action: { wash: string } } }) => (
              index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash
            );
            const contenido: Record<KardexColumnaId, React.ReactNode> = {
              fecha: formatDate(linea.fecha) ?? linea.fecha,
              cantidad: cantidad == null ? '—' : formatNumeroKardex(cantidad, { signo: true, decimales: precisionCantidad }),
              existencia: existencia == null ? '—' : formatNumeroKardex(existencia, { decimales: precisionCantidad }),
              costo: costo == null ? '—' : formatNumeroKardex(costo, { decimales: precisionCosto }),
              costo_promedio: costoPromedio == null ? '—' : formatNumeroKardex(costoPromedio, { decimales: precisionCosto }),
              contacto: contacto || '—',
              documento: (
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.7, minWidth: 0 }}>
                  <Typography noWrap sx={{ flex: '0 1 auto', minWidth: 0, fontFamily: 'inherit', fontSize: 12, lineHeight: 1, color: 'inherit' }}>
                    {folio}
                  </Typography>
                  {documento ? (
                    <Typography noWrap sx={(theme) => ({ flex: '1 1 auto', minWidth: 0, fontFamily: 'inherit', fontSize: 11, lineHeight: 1, color: theme.emphasys.content.muted })}>
                      {documento}
                    </Typography>
                  ) : null}
                </Box>
              ),
              observaciones: observaciones || '—',
            };

            return (
              <Box
                component="tr"
                key={`${linea.fecha}-${linea.tipo_movimiento}-${folio}-${index}`}
                sx={(theme) => ({
                  '&:hover td': { backgroundImage: `linear-gradient(${theme.emphasys.grid.hover}, ${theme.emphasys.grid.hover})` },
                })}
              >
                {columnas.map((columna) => {
                  const texto = columna.id === 'contacto' ? contacto : columna.id === 'observaciones' ? observaciones : columna.id === 'documento' ? documentoCompleto : '';
                  const nodo = texto ? (
                    <Tooltip title={texto} placement="top-start">
                      <Box component="span" sx={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contenido[columna.id]}
                      </Box>
                    </Tooltip>
                  ) : contenido[columna.id];
                  return (
                    <Box
                      component="td"
                      key={columna.id}
                      sx={(theme) => ({
                        backgroundColor: fondo(theme),
                        textAlign: columna.numerica ? 'right' : 'left',
                        fontVariantNumeric: 'tabular-nums',
                        color: columna.id === 'cantidad'
                          ? (cantidad == null || cantidad === 0 ? theme.emphasys.table.muted : cantidad > 0 ? amountSignColor(theme.emphasys, 'positive') : amountSignColor(theme.emphasys, 'negative'))
                          : columna.id === 'existencia'
                            ? theme.emphasys.action.primary
                            : columna.id === 'costo' || columna.id === 'costo_promedio'
                              ? ((columna.id === 'costo' ? costo : costoPromedio) == null ? theme.emphasys.table.muted : theme.emphasys.content.foreground)
                              : columna.id === 'fecha'
                                ? theme.emphasys.content.secondary
                                : columna.id === 'contacto' || columna.id === 'observaciones'
                                  ? (texto ? theme.emphasys.content.secondary : theme.emphasys.table.muted)
                                  : theme.emphasys.content.foreground,
                        fontWeight: columna.id === 'existencia' || (columna.id === 'cantidad' && cantidad != null && cantidad !== 0) ? 700 : 400,
                        fontSize: columna.numerica ? 12.5 : 12,
                        ...(columna.id === 'existencia' ? { borderLeft: `1px solid ${theme.emphasys.content.border}` } : null),
                      })}
                    >
                      {nodo}
                    </Box>
                  );
                })}
              </Box>
            );
          })}
          {Array.from({ length: vacios }, (_, indice) => {
            const index = lineas.length + indice;
            return (
              <Box component="tr" key={`vacio-${indice}`} aria-hidden>
                {columnas.map((columna) => (
                  <Box
                    component="td"
                    key={columna.id}
                    sx={(theme) => ({
                      pointerEvents: 'none',
                      userSelect: 'none',
                      backgroundColor: index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash,
                      ...(columna.id === 'existencia' ? { borderLeft: `1px solid ${theme.emphasys.content.border}` } : null),
                    })}
                  />
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box
        component="button"
        type="button"
        aria-label="Columnas del Kardex"
        onClick={(event) => setColumnasAnchor(event.currentTarget)}
        sx={(theme) => ({
          position: 'absolute',
          top: 6,
          right: 6,
          zIndex: 3,
          width: 22,
          height: 22,
          border: 0,
          borderRadius: '4px',
          backgroundColor: theme.emphasys.grid.header,
          color: theme.emphasys.grid.headerForeground,
          cursor: 'pointer',
          lineHeight: 1,
        })}
      >
        ⋮
      </Box>
      <Popover open={Boolean(columnasAnchor)} anchorEl={columnasAnchor} onClose={() => setColumnasAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Box sx={{ p: 1.25, minWidth: 190 }}>
          {KARDEX_DEFINICIONES.map((columna) => (
            <Box component="label" key={columna.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.4, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={visibilidad[columna.id]}
                disabled={KARDEX_FIJAS.has(columna.id)}
                onChange={(event) => setColumnVisibilityModel({ ...visibilidad, [columna.id]: event.target.checked || KARDEX_FIJAS.has(columna.id) })}
              />
              {columna.label}
            </Box>
          ))}
          <Box
            component="button"
            type="button"
            onClick={() => {
              setColumnOrder(() => [...KARDEX_DEFAULT_ORDER]);
              setColumnWidths(() => ({}));
              setColumnVisibilityModel(Object.fromEntries(KARDEX_DEFAULT_ORDER.map((id) => [id, true])));
            }}
            sx={{ mt: 1, border: 0, background: 'transparent', cursor: 'pointer', color: 'primary.main', fontSize: 12, p: 0 }}
          >
            Restablecer columnas
          </Box>
        </Box>
      </Popover>

      {aviso ? (
        <Typography
          sx={(theme) => ({
            position: 'absolute',
            top: KARDEX_ALTO_ENCABEZADO + 18,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 13,
            color: error ? theme.emphasys.action.destructive : theme.emphasys.content.muted,
            pointerEvents: 'none',
          })}
        >
          {aviso}
        </Typography>
      ) : null}
    </Box>
  );
}

function tonoEstado(estado: string | null): 'borrador' | 'vigente' | 'cancelado' | 'neutro' {
  const clave = normalizarTexto(String(estado ?? '').trim());
  if (clave === 'borrador' || clave === 'en negociacion') return 'borrador';
  if (clave === 'cancelado') return 'cancelado';
  if (clave === 'emitido' || clave === 'timbrado' || clave === 'pagado' || clave === 'cerrado' || clave === 'enviado') return 'vigente';
  return 'neutro';
}

function textoFolioRelacionado(documento: DocumentoRelacionadoProducto) {
  const visual = folioVisualDesdeSerieYFolio(documento.serie, documento.folio, documento.tipo);
  return visual || 'Sin folio';
}

function DocumentosRelacionados({
  documentos,
  tipoInicial,
  scrollInicial,
  onScroll,
  onConsumirScroll,
  onTipo,
  onAbrir,
}: {
  documentos: DocumentoRelacionadoProducto[];
  tipoInicial?: string;
  scrollInicial?: number;
  onScroll?: (scrollTop: number) => void;
  onConsumirScroll?: () => void;
  onTipo?: (tipo: string) => void;
  onAbrir: (ruta: string, tipo: string) => void;
}) {
  const compacto = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const listaRef = React.useRef<HTMLDivElement | null>(null);
  const scrollPendienteRef = React.useRef<number | null>(scrollInicial ?? null);
  const grupos = React.useMemo(() => {
    const ordenados = [...documentos].sort((a, b) => {
      const porFecha = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return porFecha || b.id - a.id;
    });
    const mapa = new Map<string, DocumentoRelacionadoProducto[]>();
    ordenados.forEach((documento) => {
      const lista = mapa.get(documento.tipo) ?? [];
      lista.push(documento);
      mapa.set(documento.tipo, lista);
    });
    return [...mapa.entries()]
      .map(([tipo, filas]) => ({ tipo, filas }))
      .sort((a, b) => String(b.filas[0]?.fecha || '').localeCompare(String(a.filas[0]?.fecha || '')));
  }, [documentos]);
  const [tipoActivo, setTipoActivo] = React.useState(tipoInicial || grupos[0]?.tipo || '');

  React.useEffect(() => {
    if (grupos.some((grupo) => grupo.tipo === tipoActivo)) return;
    if (tipoInicial && grupos.some((grupo) => grupo.tipo === tipoInicial)) {
      setTipoActivo(tipoInicial);
      return;
    }
    setTipoActivo(grupos[0]?.tipo ?? '');
  }, [grupos, tipoActivo, tipoInicial]);

  React.useLayoutEffect(() => {
    const nodo = listaRef.current;
    if (!nodo || scrollPendienteRef.current == null || documentos.length === 0) return;
    nodo.scrollTop = scrollPendienteRef.current;
    scrollPendienteRef.current = null;
    onConsumirScroll?.();
  }, [documentos, onConsumirScroll, tipoActivo]);

  if (grupos.length === 0) {
    return (
      <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>
        Sin documentos relacionados.
      </Typography>
    );
  }

  const activo = grupos.find((grupo) => grupo.tipo === tipoActivo) ?? grupos[0];
  if (!activo) {
    return (
      <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>
        Sin documentos relacionados.
      </Typography>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        role="tablist"
        aria-label="Categorías de documentos"
        sx={(theme) => ({
          display: 'flex',
          gap: 0.5,
          overflowX: 'auto',
          flexShrink: 0,
          px: 1.15,
          py: 0.85,
          borderBottom: `1px solid ${theme.emphasys.content.border}`,
          backgroundColor: theme.emphasys.content.well,
        })}
      >
        {grupos.map((grupo) => {
          const seleccionado = grupo.tipo === activo.tipo;
          const etiqueta = getDocumentoTypeConfig(grupo.tipo)?.label ?? grupo.tipo;
          return (
            <Box
              key={grupo.tipo}
              component="button"
              type="button"
              role="tab"
              aria-selected={seleccionado}
              onClick={() => {
                setTipoActivo(grupo.tipo);
                onTipo?.(grupo.tipo);
              }}
              sx={(theme) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.7,
                flexShrink: 0,
                height: 28,
                px: 1.05,
                border: 0,
                borderRadius: '8px',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: seleccionado ? 700 : 550,
                color: seleccionado ? theme.emphasys.navigation.foreground : theme.emphasys.content.secondary,
                backgroundColor: seleccionado ? theme.emphasys.grid.header : 'transparent',
                '&:hover': { backgroundColor: seleccionado ? theme.emphasys.grid.header : theme.emphasys.content.hover },
              })}
            >
              {etiqueta}
              <Box
                component="span"
                sx={(theme) => ({
                  fontFamily: theme.typography.figure?.fontFamily,
                  fontSize: 12,
                  fontWeight: 650,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: seleccionado ? theme.emphasys.navigation.foreground : theme.emphasys.content.muted,
                })}
              >
                {grupo.filas.length}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box
        ref={listaRef}
        onScroll={(event) => onScroll?.(event.currentTarget.scrollTop)}
        sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {compacto ? (
          activo.filas.map((documento, index) => (
            <DocumentoRelacionadoCompacto key={documento.id} documento={documento} index={index} onAbrir={onAbrir} />
          ))
        ) : (
          <>
            <Box
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: COLUMNAS_RELACIONADOS,
                columnGap: 1.25,
                alignItems: 'center',
                height: 32,
                width: '100%',
                minWidth: 540,
                px: 1.5,
                position: 'sticky',
                top: 0,
                zIndex: 1,
                boxSizing: 'border-box',
                backgroundColor: theme.emphasys.grid.header,
                color: theme.emphasys.grid.headerForeground,
                fontSize: 10.5,
                fontWeight: 650,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              })}
            >
              <span>Fecha</span>
              <span>Folio</span>
              <span>Contacto</span>
              <span>Estado</span>
              <span />
            </Box>
            {activo.filas.map((documento, index) => (
              <DocumentoRelacionadoFila key={documento.id} documento={documento} index={index} onAbrir={onAbrir} />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}

function MarcaEstado({ estado }: { estado: string | null }) {
  const tono = tonoEstado(estado);
  return (
    <Box
      component="span"
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        height: 18,
        px: 0.7,
        borderRadius: '999px',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        backgroundColor:
          tono === 'vigente'
            ? theme.emphasys.metric.applied.background
            : tono === 'cancelado'
              ? theme.emphasys.metric.blocked.background
              : tono === 'borrador'
                ? theme.emphasys.metric.amount.background
                : theme.emphasys.content.hover,
        color:
          tono === 'vigente'
            ? theme.emphasys.metric.applied.foreground
            : tono === 'cancelado'
              ? theme.emphasys.metric.blocked.foreground
              : theme.emphasys.content.foreground,
      })}
    >
      {etiquetaEstado(estado)}
    </Box>
  );
}

function DocumentoRelacionadoFila({
  documento,
  index,
  onAbrir,
}: {
  documento: DocumentoRelacionadoProducto;
  index: number;
  onAbrir: (ruta: string, tipo: string) => void;
}) {
  const ruta = rutaDocumento(documento);
  return (
    <Box
      component="button"
      type="button"
      disabled={!ruta}
      onClick={() => {
        if (ruta) onAbrir(ruta, documento.tipo);
      }}
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: COLUMNAS_RELACIONADOS,
        columnGap: 1.25,
        alignItems: 'center',
        width: '100%',
        minWidth: 540,
        minHeight: 34,
        px: 1.5,
        boxSizing: 'border-box',
        border: 0,
        borderBottom: `1px solid ${theme.emphasys.content.border}`,
        font: 'inherit',
        textAlign: 'left',
        cursor: ruta ? 'pointer' : 'default',
        color: theme.emphasys.content.foreground,
        backgroundColor: index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash,
        '&:hover': { backgroundColor: ruta ? theme.emphasys.content.hover : undefined },
        '&:disabled': { opacity: 0.72 },
      })}
    >
      <Typography noWrap sx={{ fontSize: 12, lineHeight: 1.2, color: (theme) => theme.emphasys.content.secondary, fontVariantNumeric: 'tabular-nums' }}>
        {formatDate(documento.fecha) ?? '—'}
      </Typography>
      <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: (theme) => theme.emphasys.content.foreground }}>
        {textoFolioRelacionado(documento)}
      </Typography>
      <Typography noWrap sx={{ fontSize: 13, lineHeight: 1.2, color: (theme) => theme.emphasys.content.foreground }}>
        {documento.contacto || '—'}
      </Typography>
      <Box><MarcaEstado estado={documento.estado} /></Box>
      <OpenInNewOutlinedIcon sx={{ justifySelf: 'end', fontSize: 15, color: (theme) => (ruta ? theme.emphasys.content.secondary : theme.emphasys.table.muted) }} />
    </Box>
  );
}

function DocumentoRelacionadoCompacto({
  documento,
  index,
  onAbrir,
}: {
  documento: DocumentoRelacionadoProducto;
  index: number;
  onAbrir: (ruta: string, tipo: string) => void;
}) {
  const ruta = rutaDocumento(documento);
  return (
    <Box
      component="button"
      type="button"
      disabled={!ruta}
      onClick={() => {
        if (ruta) onAbrir(ruta, documento.tipo);
      }}
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        px: 1.35,
        py: 0.75,
        border: 0,
        borderBottom: `1px solid ${theme.emphasys.content.border}`,
        font: 'inherit',
        textAlign: 'left',
        cursor: ruta ? 'pointer' : 'default',
        backgroundColor: index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash,
        '&:disabled': { opacity: 0.72 },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: (theme) => theme.emphasys.content.foreground }}>
          {textoFolioRelacionado(documento)}
        </Typography>
        <MarcaEstado estado={documento.estado} />
      </Box>
      <Typography noWrap sx={{ mt: 0.25, fontSize: 12, color: (theme) => theme.emphasys.content.secondary }}>
        {formatDate(documento.fecha) ?? '—'}
        {' · '}
        {documento.contacto || '—'}
      </Typography>
    </Box>
  );
}

const TABS = ['resumen', 'comercial', 'relacionados', 'compras', 'ventas', 'archivos', 'especificaciones'] as const;
type TabId = (typeof TABS)[number];

export default function ProductoWorkspace({
  productoId,
  esAdmin,
  onEditar,
  onEliminar,
  onChanged,
  onAlternarActivo,
  alternando = false,
  compacto = false,
  onVolver,
  restauracion = null,
  onScrollDetalle,
  onAbrirDocumentoRelacionado,
}: ProductoWorkspaceProps) {
  const tokens = useTheme().emphasys;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [producto, setProducto] = React.useState<Producto | null>(null);
  const [archivos, setArchivos] = React.useState<ProductoArchivo[]>([]);
  const [catalogos, setCatalogos] = React.useState<CatalogoConfigurablesProductoRespuesta | null>(null);
  const [existencias, setExistencias] = React.useState<ExistenciaProducto[]>([]);
  const [documentosRelacionados, setDocumentosRelacionados] = React.useState<DocumentoRelacionadoProducto[]>([]);
  const [kardex, setKardex] = React.useState<KardexLinea[]>([]);
  const [kardexCargando, setKardexCargando] = React.useState(false);
  const [kardexError, setKardexError] = React.useState<string | null>(null);
  const [decimalesCantidad, setDecimalesCantidad] = React.useState(2);
  const [decimalesCosto, setDecimalesCosto] = React.useState(2);
  const [almacenKardexId, setAlmacenKardexId] = React.useState<number | null>(null);
  const [kardexConsulta, setKardexConsulta] = React.useState(0);
  const [historialDesde, setHistorialDesde] = React.useState('');
  const [historialHasta, setHistorialHasta] = React.useState('');
  const [offsetCompras, setOffsetCompras] = React.useState(0);
  const [offsetVentas, setOffsetVentas] = React.useState(0);
  const navigate = useNavigate();
  const productoSeleccionRef = React.useRef<number | null>(null);
  const restauracionInicialRef = React.useRef(restauracion);
  const [tab, setTab] = React.useState<TabId>('resumen');
  const [tipoRelacionado, setTipoRelacionado] = React.useState(restauracion?.tipoDocumento ?? '');
  const [scrollDetalleInicial, setScrollDetalleInicial] = React.useState<number | undefined>(restauracion?.scrollDetalle);
  const [toggling, setToggling] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    void fetchParametrosSistema().then((modulos) => {
      const parametros = modulos.flatMap((modulo) => modulo.parametros);
      const cantidad = Number(parametros.find((parametro) => parametro.clave === 'decimales_cantidades')?.valor_resuelto);
      const costo = Number(parametros.find((parametro) => parametro.clave === 'decimales_costos')?.valor_resuelto);
      if (Number.isInteger(cantidad) && cantidad >= 0 && cantidad <= 6) setDecimalesCantidad(cantidad);
      if (Number.isInteger(costo) && costo >= 0 && costo <= 6) setDecimalesCosto(costo);
    }).catch(() => undefined);
  }, []);

  const cargar = React.useCallback(() => {
    if (!productoId) {
      setProducto(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchProducto(productoId),
      fetchProductoArchivos(productoId).catch(() => []),
      obtenerCatalogosConfigurablesProducto(productoId).catch(() => null),
      fetchExistenciasProducto(productoId).catch(() => []),
      fetchDocumentosRelacionadosProducto(productoId).catch(() => []),
    ])
      .then(([productoData, archivosData, catalogosData, existenciasData, documentosData]) => {
        if (!active) return;
        setProducto(productoData);
        setArchivos(archivosData);
        setCatalogos(catalogosData);
        setExistencias(existenciasData);
        setDocumentosRelacionados(documentosData);
        const ordenadas = [...existenciasData].sort((a, b) => a.almacen.localeCompare(b.almacen, 'es'));
        const primero = ordenadas[0];
        setAlmacenKardexId((actual) => {
          const conserva = productoSeleccionRef.current === productoId
            && actual != null
            && existenciasData.some((fila) => fila.almacen_id === actual);
          if (conserva) return actual;
          productoSeleccionRef.current = productoId;
          return primero?.almacen_id ?? null;
        });
        setKardexConsulta((valor) => valor + 1);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el producto');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productoId]);

  React.useEffect(() => {
    const pendiente = restauracionInicialRef.current;
    if (pendiente && productoId === pendiente.productoId) {
      setTab('relacionados');
    } else if (!pendiente || productoId != null) {
      setTab('resumen');
      if (productoId != null) restauracionInicialRef.current = null;
    }
    setAlmacenKardexId(null);
    setKardex([]);
    setKardexError(null);
    setHistorialDesde('');
    setHistorialHasta('');
    setOffsetCompras(0);
    setOffsetVentas(0);
    productoSeleccionRef.current = null;
    return cargar();
  }, [cargar]);

  React.useEffect(() => {
    if (!productoId || almacenKardexId == null || kardexConsulta === 0) {
      if (almacenKardexId == null) {
        setKardex([]);
        setKardexCargando(false);
      }
      return undefined;
    }
    let active = true;
    setKardexCargando(true);
    setKardexError(null);
    setKardex([]);
    fetchKardexProducto({
      producto_id: productoId,
      almacen_id: almacenKardexId,
      fecha_inicio: '1900-01-01',
      fecha_fin: '2999-12-31',
      orden: 'desc',
    })
      .then((data) => {
        if (!active) return;
        setKardex(data.lineas);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setKardex([]);
        setKardexError(err instanceof Error ? err.message : 'No se pudo consultar el kardex');
      })
      .finally(() => {
        if (active) setKardexCargando(false);
      });
    return () => {
      active = false;
    };
  }, [productoId, almacenKardexId, kardexConsulta]);

  const seleccionarAlmacenKardex = (almacenId: number) => {
    productoSeleccionRef.current = productoId;
    setAlmacenKardexId(almacenId);
  };

  const productoIdRef = React.useRef<number | null>(productoId);
  React.useEffect(() => {
    productoIdRef.current = productoId;
  }, [productoId]);

  const handleToggleActivo = async () => {
    if (!producto || toggling || alternando) return;
    if (onAlternarActivo) {
      try {
        const actualizado = await onAlternarActivo(producto);
        if (actualizado && productoIdRef.current === producto.id) setProducto(actualizado);
      } catch (err) {
        if (productoIdRef.current === producto.id) {
          setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del producto');
        }
      }
      return;
    }
    const startedForId = producto.id;
    setToggling(true);
    try {
      const payload: ProductoBasico = {
        clave: producto.clave,
        descripcion: producto.descripcion,
        clasificacion: producto.clasificacion,
        tipo_producto: producto.tipo_producto,
        activo: !producto.activo,
        clave_producto_sat: producto.clave_producto_sat,
        unidad_venta_id: producto.unidad_venta_id,
        unidad_inventario_id: producto.unidad_inventario_id,
        especificaciones: producto.especificaciones,
      };
      const actualizado = await updateProducto(producto.id, payload);
      if (productoIdRef.current === startedForId) {
        setProducto(actualizado);
      }
      onChanged?.();
    } catch (err) {
      if (productoIdRef.current === startedForId) {
        setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del producto');
      }
    } finally {
      if (productoIdRef.current === startedForId) {
        setToggling(false);
      }
    }
  };

  const handleUploadImagen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !producto) return;
    const startedForId = producto.id;
    try {
      const nuevo = await uploadProductoImagen(producto.id, file);
      if (productoIdRef.current === startedForId) {
        setArchivos((prev) => [...prev, nuevo].sort((a, b) => Number(b.principal) - Number(a.principal) || a.orden_visual - b.orden_visual));
      }
    } catch (err) {
      if (productoIdRef.current === startedForId) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
      }
    }
  };

  const handleEliminarArchivo = async (archivoId: number) => {
    if (!producto) return;
    const confirmed = window.confirm('¿Eliminar esta imagen?');
    if (!confirmed) return;
    const startedForId = producto.id;
    try {
      await deleteProductoArchivo(archivoId);
      if (productoIdRef.current === startedForId) {
        setArchivos((prev) => prev.filter((a) => a.id !== archivoId));
      }
    } catch (err) {
      if (productoIdRef.current === startedForId) {
        setError(err instanceof Error ? err.message : 'No se pudo eliminar la imagen');
      }
    }
  };

  const handleMarcarPrincipal = async (archivoId: number) => {
    if (!producto) return;
    const startedForId = producto.id;
    try {
      await marcarProductoArchivoPrincipal(archivoId);
      if (productoIdRef.current === startedForId) {
        setArchivos((prev) => prev.map((a) => ({ ...a, principal: a.id === archivoId })));
      }
    } catch (err) {
      if (productoIdRef.current === startedForId) {
        setError(err instanceof Error ? err.message : 'No se pudo marcar la imagen como principal');
      }
    }
  };

  const iconoSx = (disabled = false) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });

  if (!productoId) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.content.background }}>
        <Box sx={{ textAlign: 'center', px: 3 }}>
          <Inventory2OutlinedIcon sx={{ fontSize: 32, color: tokens.content.muted, mb: 0.75 }} />
          <Typography sx={{ fontSize: 15, fontWeight: 650, color: tokens.content.foreground }}>Selecciona un producto</Typography>
          <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>Elige un producto de la lista para ver su información.</Typography>
        </Box>
      </Box>
    );
  }

  if (loading || !producto) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.content.background }}>
        {error ? (
          <Typography sx={{ fontSize: 13, color: tokens.action.destructive }}>{error}</Typography>
        ) : (
          <CircularProgress size={26} />
        )}
      </Box>
    );
  }

  const principal = archivos.find((a) => a.principal) ?? archivos[0] ?? null;
  const catalogosSeleccionados = (catalogos?.tipos ?? [])
    .map((t) => ({
      id: t.id,
      k: t.nombre ?? 'Catálogo',
      v: t.valores
        .filter((v) => catalogos?.seleccionados.includes(v.id))
        .map((v) => v.descripcion)
        .join(', '),
    }))
    .filter((row) => row.v);

  const familiaCatalogo = valorCatalogoPorNombre(catalogos, 'familia');

  const costoBase = producto.costo_estandar ?? producto.costo_promedio ?? producto.ultimo_costo ?? null;
  const nivelesPrecio: { nivel: string; valor: number | null }[] = [
    { nivel: 'Público', valor: producto.precio_publico },
    { nivel: 'Mayoreo', valor: producto.precio_mayoreo },
    { nivel: 'Menudeo', valor: producto.precio_menudeo },
    { nivel: 'Distribuidor', valor: producto.precio_distribuidor },
  ];
  const existenciaTotal = existencias.reduce((suma, fila) => suma + Number(fila.existencia || 0), 0);
  const servicio = esServicio(producto.tipo_producto);
  const controlaInventario = !servicio && !esNoInventariable(producto.tipo_producto);
  const unidadInventario = producto.unidad_inventario_clave
    ? `${producto.unidad_inventario_clave}${producto.unidad_inventario_descripcion ? ` · ${producto.unidad_inventario_descripcion}` : ''}`
    : null;
  const unidadVenta = producto.unidad_venta_clave
    ? `${producto.unidad_venta_clave}${producto.unidad_venta_descripcion ? ` · ${producto.unidad_venta_descripcion}` : ''}`
    : null;

  return (
    <Box sx={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: tokens.content.background, overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 1.25, md: 2 }, pt: compacto ? 0.85 : 1.15, pb: 1, flexShrink: 0 }}>
        {compacto && onVolver ? (
          <Box
            component="button"
            type="button"
            onClick={onVolver}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', fontSize: 13, fontWeight: 650, cursor: 'pointer', mb: 0.6, p: 0 }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Productos
          </Box>
        ) : null}
        <Stack direction="row" spacing={1.25} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={1.15} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: '10px',
                border: `1px solid ${tokens.content.border}`,
                backgroundColor: tokens.content.elevated,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {principal ? (
                <img src={buildAssetUrl(principal.archivo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <ImageOutlinedIcon sx={{ fontSize: 18, color: tokens.content.muted }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted }}>
                PRODUCTO SELECCIONADO
              </Typography>
              <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: tokens.content.muted }}>
                  {producto.clave}
                </Typography>
                <Chip
                  size="small"
                  label={producto.activo ? 'Activo' : 'Inactivo'}
                  sx={{
                    height: 18,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: producto.activo ? tokens.metric.applied.background : tokens.content.elevated,
                    color: producto.activo ? tokens.metric.applied.foreground : tokens.content.muted,
                  }}
                />
                {producto.tipo_producto ? (
                  <Chip size="small" label={producto.tipo_producto} sx={{ height: 18, fontSize: 11, fontWeight: 700, backgroundColor: tokens.metric.amount.background, color: tokens.content.foreground }} />
                ) : null}
              </Stack>
              <Typography
                sx={{
                  color: tokens.content.foreground,
                  fontSize: compacto ? 16 : 18,
                  fontWeight: 650,
                  fontFamily: (theme) => theme.typography.figure.fontFamily,
                  lineHeight: 1.25,
                  mt: 0.25,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {producto.descripcion}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Tooltip title="Editar producto" arrow>
              <IconButton size="small" aria-label="Editar producto" sx={iconoSx()} onClick={() => onEditar(producto.id)}>
                <EditIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={producto.activo ? 'Desactivar' : 'Activar'} arrow>
              <span>
                <IconButton
                  size="small"
                  aria-label={producto.activo ? 'Desactivar' : 'Activar'}
                  disabled={toggling || alternando}
                  sx={iconoSx(toggling || alternando)}
                  onClick={() => void handleToggleActivo()}
                >
                  <PowerSettingsNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Eliminar" arrow>
              <IconButton size="small" aria-label="Eliminar" sx={iconoSx()} onClick={() => onEliminar(producto)}>
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        {error ? <Typography sx={{ mt: 0.75, fontSize: 12, color: tokens.action.destructive }}>{error}</Typography> : null}
      </Box>

      <Box sx={{ px: { xs: 1.25, md: 2 }, pb: 1.1, flexShrink: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 0.7 }}>
          <Box sx={{ px: 1.1, py: 0.8, borderRadius: '10px', bgcolor: tokens.metric.amount.background, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>FAMILIA</Typography>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 650, color: tokens.content.foreground }}>{familiaCatalogo || '—'}</Typography>
          </Box>
          <Box sx={{ px: 1.1, py: 0.8, borderRadius: '10px', bgcolor: tokens.metric.available.background, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>EXISTENCIA</Typography>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 650, color: tokens.content.foreground }}>{servicio ? 'No aplica' : formatQty(existenciaTotal)}</Typography>
          </Box>
          <Box sx={{ px: 1.1, py: 0.8, borderRadius: '10px', bgcolor: tokens.metric.applied.background, minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>UNIDAD</Typography>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 650, color: tokens.content.foreground }}>{producto.unidad_venta_clave || '—'}</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mx: { xs: 0.75, md: 1.25 }, mb: { xs: 0.75, md: 1.25 }, bgcolor: tokens.content.well, borderRadius: 2.5, border: `1px solid ${tokens.content.border}`, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            minHeight: 40,
            borderBottom: `1px solid ${tokens.content.border}`,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 650, fontSize: 13, color: tokens.content.muted },
            '& .Mui-selected': { color: tokens.content.foreground },
            '& .MuiTabs-indicator': { height: 2, borderRadius: 2, backgroundColor: tokens.content.foreground },
          }}
        >
          <Tab value="resumen" label="Resumen" />
          <Tab value="comercial" label={esAdmin ? 'Comercial y precios' : 'Comercial'} />
          <Tab value="relacionados" label={`Relacionados${documentosRelacionados.length ? ` (${documentosRelacionados.length})` : ''}`} />
          <Tab value="compras" label="Últimas compras" />
          <Tab value="ventas" label="Últimas ventas" />
          <Tab value="archivos" label={`Imágenes${archivos.length ? ` (${archivos.length})` : ''}`} />
          <Tab value="especificaciones" label="Especificaciones" />
        </Tabs>
        <Box
          sx={{
            p: tab === 'compras' || tab === 'ventas' || tab === 'relacionados' ? 0 : { xs: 1, md: 1.25 },
            overflowY: tab === 'resumen' && controlaInventario ? { xs: 'auto', md: 'hidden' } : 'auto',
            flex: 1,
            minHeight: 0,
            display: (tab === 'resumen' && controlaInventario) || tab === 'compras' || tab === 'ventas' || tab === 'relacionados' ? 'flex' : 'block',
            flexDirection: 'column',
          }}
        >
          {tab === 'resumen' && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                minHeight: controlaInventario ? 0 : undefined,
                flex: controlaInventario ? 1 : undefined,
                height: controlaInventario ? '100%' : undefined,
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                  gap: 0.75,
                  alignItems: 'stretch',
                }}
              >
                <SectionCard densa title="Datos generales">
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.7 }}>
                    <InfoRow denso label="Clave" value={producto.clave} />
                    <InfoRow denso label="Estado" value={producto.activo ? 'Activo' : 'Inactivo'} />
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <InfoRow denso label="Descripción" value={producto.descripcion} />
                    </Box>
                    <InfoRow denso label="Fecha de creación" value={formatDate(producto.fecha_creacion)} />
                  </Box>
                </SectionCard>

                <SectionCard densa title="SAT y unidades">
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.7 }}>
                    <InfoRow denso label="Clave SAT" value={producto.clave_producto_sat} />
                    <InfoRow denso label="Unidad de venta" value={unidadVenta} />
                    <InfoRow denso label="Unidad de inventario" value={unidadInventario} />
                    <InfoRow denso label="IVA" value={producto.iva_porcentaje !== null && producto.iva_porcentaje !== undefined ? `${producto.iva_porcentaje}%` : null} />
                    <InfoRow denso label="IEPS" value={producto.ieps_porcentaje !== null && producto.ieps_porcentaje !== undefined ? `${producto.ieps_porcentaje}%` : null} />
                    <InfoRow denso label="Fracción arancelaria" value={producto.fraccion_arancelaria} />
                  </Box>
                </SectionCard>

                <SectionCard densa title="Parámetros de inventario">
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.7 }}>
                    <InfoRow denso label="Tipo de producto" value={producto.tipo_producto} />
                    <InfoRow denso label="Unidad de inventario" value={producto.unidad_inventario_clave} />
                    <InfoRow denso label="Mínimo de inventario" value={producto.minimo_inventario == null ? null : formatQty(Number(producto.minimo_inventario), decimalesCantidad)} />
                    <InfoRow denso label="Ubicación en almacén" value={producto.ubicacion_almacen} />
                  </Box>
                </SectionCard>
              </Box>

              {controlaInventario ? (
                <>
                  <Box sx={{ flexShrink: 0, maxHeight: { xs: 220, md: 176 }, overflowY: 'auto' }}>
                    <SectionCard densa title="Existencias por almacén">
                      <ExistenciasAlmacen
                        existencias={existencias}
                        tipo={producto.tipo_producto}
                        decimalesCantidad={decimalesCantidad}
                        almacenSeleccionadoId={almacenKardexId}
                        onSeleccionarAlmacen={seleccionarAlmacenKardex}
                      />
                    </SectionCard>
                  </Box>
                  <Box sx={{ flex: '1 1 0', minHeight: { xs: 320, md: 220 }, display: 'flex', flexDirection: 'column' }}>
                    <SectionCard
                      llenar
                      title="Kardex"
                      action={
                        almacenKardexId != null
                          ? (
                            <Typography sx={{ fontSize: 12, fontWeight: 650, color: tokens.content.secondary }}>
                              {existencias.find((fila) => fila.almacen_id === almacenKardexId)?.almacen ?? ''}
                            </Typography>
                          )
                          : null
                      }
                    >
                      <KardexProducto lineas={kardex} cargando={kardexCargando} error={kardexError} decimalesCantidad={decimalesCantidad} decimalesCosto={decimalesCosto} />
                    </SectionCard>
                  </Box>
                </>
              ) : null}
            </Box>
          )}

          {tab === 'comercial' && (
            <Stack spacing={1}>
              <SectionCard title="Información comercial y catálogos">
                {catalogosSeleccionados.length > 0 ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.25 }}>
                    {catalogosSeleccionados.map((row) => (
                      <InfoRow key={row.id} label={row.k} value={row.v} />
                    ))}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>Este producto no tiene catálogos comerciales asignados.</Typography>
                )}
              </SectionCard>

              <SectionCard title="Condiciones de venta">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                  <InfoRow label="Unidad de venta" value={producto.unidad_venta_clave} />
                  <InfoRow label="IVA" value={producto.iva_porcentaje !== null && producto.iva_porcentaje !== undefined ? `${producto.iva_porcentaje}%` : null} />
                  <InfoRow label="Retiene IVA" value={producto.retiene_iva ? 'Sí' : 'No'} />
                  <InfoRow label="Retiene ISR" value={producto.retiene_isr ? 'Sí' : 'No'} />
                </Box>
              </SectionCard>

              {esAdmin && (
                <>
                  <SectionCard title="Precios propios del producto">
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', backgroundColor: tokens.grid.header, color: tokens.grid.headerForeground, fontSize: 11, fontWeight: 700, px: 1.1, py: 0.7, borderRadius: 1 }}>
                        <span>Nivel de precio</span><span style={{ textAlign: 'right' }}>Margen</span><span style={{ textAlign: 'right' }}>Precio</span>
                      </Box>
                      {nivelesPrecio.filter((n) => n.valor !== null && n.valor !== undefined).map((n) => (
                        <Box key={n.nivel} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', px: 1.1, py: 0.7, fontSize: 13, borderBottom: `1px solid ${tokens.content.border}` }}>
                          <span>{n.nivel}</span>
                          <span style={{ textAlign: 'right' }}>
                            {costoBase && n.valor ? `${(((Number(n.valor) - Number(costoBase)) / Number(n.valor)) * 100).toFixed(1)}%` : '—'}
                          </span>
                          <span style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(n.valor)}</span>
                        </Box>
                      ))}
                      {nivelesPrecio.every((n) => n.valor === null || n.valor === undefined) && (
                        <Typography sx={{ fontSize: 13, color: tokens.content.muted, py: 1.25 }}>Este producto no tiene precios propios capturados.</Typography>
                      )}
                    </Box>
                  </SectionCard>

                  <SectionCard title="Costos">
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                      <InfoRow label="Costo estándar" value={formatCurrency(producto.costo_estandar)} />
                      <InfoRow label="Costo promedio" value={formatCurrency(producto.costo_promedio)} />
                      <InfoRow label="Último costo" value={formatCurrency(producto.ultimo_costo)} />
                    </Box>
                  </SectionCard>

                  <PendingCard
                    title="Listas de precios"
                    message="Aquí se listarán las listas de precios donde participa el producto cuando este workspace se conecte al módulo de Listas de precios."
                  />
                </>
              )}
            </Stack>
          )}

          {(tab === 'compras' || tab === 'ventas') && (
            <ProductoHistorialComercial
              productoId={producto.id}
              modo={tab}
              desde={historialDesde}
              hasta={historialHasta}
              offset={tab === 'compras' ? offsetCompras : offsetVentas}
              onDesde={(valor) => {
                setHistorialDesde(valor);
                setOffsetCompras(0);
                setOffsetVentas(0);
              }}
              onHasta={(valor) => {
                setHistorialHasta(valor);
                setOffsetCompras(0);
                setOffsetVentas(0);
              }}
              onOffset={tab === 'compras' ? setOffsetCompras : setOffsetVentas}
            />
          )}

          {tab === 'archivos' && (
            <SectionCard
              title="Imágenes"
              action={
                <>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void handleUploadImagen(e)} />
                  <Tooltip title="Subir imagen" arrow>
                    <IconButton size="small" aria-label="Subir imagen" onClick={() => fileInputRef.current?.click()} sx={iconoSx()}>
                      <UploadFileIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              }
            >
              {archivos.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>Este producto no tiene imágenes cargadas.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 148px))', gap: 1, justifyContent: 'start', maxWidth: '100%' }}>
                  {archivos.map((archivo) => (
                    <Box key={archivo.id} sx={{ width: '100%', maxWidth: 148, minWidth: 0, border: `1px solid ${tokens.content.border}`, borderRadius: '10px', overflow: 'hidden', backgroundColor: tokens.content.elevated }}>
                      <Box sx={{ width: '100%', aspectRatio: '1', maxHeight: 148, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.content.background }}>
                        <Box component="img" src={buildAssetUrl(archivo.archivo)} alt={archivo.descripcion ?? ''} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ px: 0.25 }}>
                        <Tooltip title={archivo.principal ? 'Imagen principal' : 'Marcar como principal'} arrow>
                          <IconButton size="small" aria-label={archivo.principal ? 'Imagen principal' : 'Marcar como principal'} onClick={() => void handleMarcarPrincipal(archivo.id)} sx={{ width: 28, height: 28, borderRadius: '10px' }}>
                            {archivo.principal ? <StarIcon sx={{ fontSize: 16, color: tokens.content.foreground }} /> : <StarBorderIcon sx={{ fontSize: 16, color: tokens.content.muted }} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar imagen" arrow>
                          <IconButton size="small" aria-label="Eliminar imagen" onClick={() => void handleEliminarArchivo(archivo.id)} sx={{ width: 28, height: 28, borderRadius: '10px' }}>
                            <DeleteOutlineIcon sx={{ fontSize: 16, color: tokens.action.destructive }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              )}
            </SectionCard>
          )}

          {tab === 'especificaciones' && (
            <Stack spacing={2.5}>
              <EspecificacionesBibliotecaEditor productoId={producto.id} alcance="producto" onError={(message) => setError(message)} />
              {producto.especificaciones ? (
                <Box>
                  <Typography sx={(theme) => ({ fontSize: 18, fontWeight: 650, lineHeight: 1.25, fontFamily: theme.typography.figure.fontFamily, color: tokens.content.foreground })}>
                    Notas y descripción extendida
                  </Typography>
                  <Typography sx={{ mt: 0.25, fontSize: 12, color: tokens.content.muted }}>Texto libre del producto, independiente de la biblioteca.</Typography>
                  <Box
                    sx={{ mt: 1.25, p: 1.5, borderRadius: '10px', border: `1px solid ${tokens.content.border}`, backgroundColor: tokens.content.card, fontSize: 13, lineHeight: 1.5, color: tokens.content.foreground, overflowWrap: 'anywhere', '& img': { maxWidth: '100%', height: 'auto' }, '& p': { my: 0.5 } }}
                    dangerouslySetInnerHTML={{ __html: producto.especificaciones }}
                  />
                </Box>
              ) : null}
            </Stack>
          )}

          {tab === 'relacionados' && (
            <DocumentosRelacionados
              documentos={documentosRelacionados}
              {...(tipoRelacionado ? { tipoInicial: tipoRelacionado } : {})}
              {...(scrollDetalleInicial != null ? { scrollInicial: scrollDetalleInicial } : {})}
              {...(onScrollDetalle ? { onScroll: onScrollDetalle } : {})}
              onConsumirScroll={() => setScrollDetalleInicial(undefined)}
              onTipo={setTipoRelacionado}
              onAbrir={(ruta, tipo) => {
                if (onAbrirDocumentoRelacionado) {
                  onAbrirDocumentoRelacionado(ruta, tipo);
                  return;
                }
                navigate(ruta);
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
