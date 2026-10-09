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
import { resolverFolioVisual } from '../../utils/documentos.utils';

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
};

const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const qtyFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

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

function formatQty(value: number) {
  return qtyFormatter.format(Number(value) || 0);
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ display: 'block', mb: 0.15, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: (theme) => theme.emphasys.content.foreground, wordBreak: 'break-word' }}>
        {value || value === 0 ? value : '—'}
      </Typography>
    </Box>
  );
}

function SectionCard({
  title,
  action,
  children,
  llenar = false,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  llenar?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        border: `1px solid ${theme.emphasys.content.border}`,
        borderRadius: 2,
        backgroundColor: theme.emphasys.action.wash,
        overflow: 'hidden',
        ...(llenar ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null),
      })}
    >
      <Box
        sx={{
          px: 1.25,
          py: 0.85,
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
      <Box sx={{ p: 1.25, ...(llenar ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : null) }}>{children}</Box>
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
  almacenSeleccionadoId = null,
  onSeleccionarAlmacen,
}: {
  existencias: ExistenciaProducto[];
  tipo: string | null;
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
                Mín. {formatQty(fila.minimo_inventario)} · {formatDate(fila.ultima_fecha) ?? 'sin movimiento'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (theme) => (bajoMinimo ? theme.emphasys.metric.blocked.foreground : theme.emphasys.content.foreground) }}>
              {formatQty(fila.existencia)}
            </Typography>
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (theme) => theme.emphasys.content.secondary }}>
              {formatQty(fila.minimo_inventario)}
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
          {formatQty(total)}
        </Typography>
      </Box>
    </Box>
  );
}

const KARDEX_COLUMNAS = '108px 84px minmax(132px, 1.15fr) 80px 80px 96px 124px minmax(148px, 1.3fr)';
const KARDEX_ANCHO_MINIMO = 980;
const KARDEX_ALTO_ENCABEZADO = 32;
const KARDEX_ALTO_FILA = 28;

function formatCantidadKardex(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const negativo = value < 0;
  let texto = Math.abs(value).toString();
  if (/e/i.test(texto)) texto = Math.abs(value).toFixed(12);
  const [enteraParte, fraccion = ''] = texto.split('.');
  const entera = enteraParte || '0';
  const fraccionVisible = fraccion.slice(0, 6).replace(/0+$/, '');
  const enteraMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cuerpo = fraccionVisible ? `${enteraMiles}.${fraccionVisible}` : enteraMiles;
  return negativo ? `-${cuerpo}` : cuerpo;
}

function numeroKardex(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function etiquetaMovimiento(tipo: string): string {
  const limpio = tipo.trim().replace(/_/g, ' ');
  if (!limpio) return '—';
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
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
}: {
  lineas: KardexLinea[];
  cargando: boolean;
  error: string | null;
}) {
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
      })}
    >
      <Box
        sx={(theme) => ({
          display: 'grid',
          gridTemplateColumns: KARDEX_COLUMNAS,
          columnGap: 1.25,
          alignItems: 'center',
          height: KARDEX_ALTO_ENCABEZADO,
          minWidth: KARDEX_ANCHO_MINIMO,
          px: 1.5,
          position: 'sticky',
          top: 0,
          zIndex: 2,
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
        <span>Tipo</span>
        <span>Documento</span>
        <span style={{ textAlign: 'right', fontWeight: 700 }}>Entrada</span>
        <span style={{ textAlign: 'right', fontWeight: 700 }}>Salida</span>
        <Box component="span" sx={(theme) => ({ textAlign: 'right', fontWeight: 700, letterSpacing: '0.09em', borderLeft: `1px solid ${theme.emphasys.navigation.track}`, pl: 1.15 })}>
          Existencia
        </Box>
        <span style={{ textAlign: 'right' }}>Costo unitario</span>
        <span>Observaciones</span>
      </Box>

      {lineas.map((linea, index) => {
        const entrada = numeroKardex(linea.entrada);
        const salida = numeroKardex(linea.salida);
        const existencia = numeroKardex(linea.existencia_despues);
        const costo = numeroKardex(linea.costo_unitario);
        const observaciones = (linea.observaciones ?? '').trim();
        const folio = folioKardex(linea);
        const documento = etiquetaDocumento(linea.doc_tipo);
        const tipo = etiquetaMovimiento(linea.tipo_movimiento);
        const esEntrada = (entrada ?? 0) > 0;
        const esSalida = (salida ?? 0) > 0;

        return (
          <Box
            key={`${linea.fecha}-${linea.tipo_movimiento}-${folio}-${index}`}
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: KARDEX_COLUMNAS,
              columnGap: 1.25,
              alignItems: 'center',
              height: KARDEX_ALTO_FILA,
              minWidth: KARDEX_ANCHO_MINIMO,
              px: 1.5,
              boxSizing: 'border-box',
              backgroundColor: index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash,
              borderBottom: `1px solid ${theme.emphasys.content.border}`,
              '&:hover': { backgroundImage: `linear-gradient(${theme.emphasys.grid.hover}, ${theme.emphasys.grid.hover})` },
            })}
          >
            <Typography noWrap sx={{ fontSize: 12, lineHeight: 1, color: (theme) => theme.emphasys.content.secondary, fontVariantNumeric: 'tabular-nums' }}>
              {formatDate(linea.fecha) ?? linea.fecha}
            </Typography>
            <Typography
              noWrap
              sx={(theme) => ({
                fontSize: 12,
                lineHeight: 1,
                fontWeight: 700,
                color: esSalida ? theme.emphasys.action.destructive : esEntrada ? theme.emphasys.metric.applied.foreground : theme.emphasys.content.foreground,
              })}
            >
              {tipo}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.7, minWidth: 0 }}>
              <Typography noWrap sx={(theme) => ({ fontFamily: theme.typography.figure?.fontFamily, fontSize: 13, lineHeight: 1, color: theme.emphasys.content.foreground })}>
                {folio}
              </Typography>
              {documento ? (
                <Typography noWrap sx={{ fontSize: 11, lineHeight: 1, color: (theme) => theme.emphasys.content.muted }}>
                  {documento}
                </Typography>
              ) : null}
            </Box>
            <Typography sx={(theme) => ({ textAlign: 'right', fontFamily: theme.typography.figure?.fontFamily, fontWeight: esEntrada ? 700 : 400, fontSize: esEntrada ? 14 : 13, lineHeight: 1, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', color: esEntrada ? theme.emphasys.metric.applied.foreground : theme.emphasys.table.muted })}>
              {esEntrada && entrada != null ? formatCantidadKardex(entrada) : '—'}
            </Typography>
            <Typography sx={(theme) => ({ textAlign: 'right', fontFamily: theme.typography.figure?.fontFamily, fontWeight: esSalida ? 700 : 400, fontSize: esSalida ? 14 : 13, lineHeight: 1, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums', color: esSalida ? theme.emphasys.action.destructive : theme.emphasys.table.muted })}>
              {esSalida && salida != null ? formatCantidadKardex(salida) : '—'}
            </Typography>
            <Typography
              sx={(theme) => ({
                textAlign: 'right',
                fontFamily: theme.typography.figure?.fontFamily,
                fontWeight: 700,
                fontSize: 15,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                color: theme.emphasys.action.primary,
                borderLeft: `1px solid ${theme.emphasys.content.border}`,
                pl: 1.15,
              })}
            >
              {existencia == null ? '—' : formatCantidadKardex(existencia)}
            </Typography>
            <Typography sx={(theme) => ({ textAlign: 'right', fontFamily: theme.typography.figure?.fontFamily, fontSize: 12.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: costo == null ? theme.emphasys.table.muted : theme.emphasys.content.foreground })}>
              {costo == null ? '—' : formatCurrency(costo)}
            </Typography>
            {observaciones ? (
              <Tooltip title={observaciones} placement="top-start">
                <Typography noWrap sx={{ fontSize: 12, lineHeight: 1, color: (theme) => theme.emphasys.content.secondary }}>
                  {observaciones}
                </Typography>
              </Tooltip>
            ) : (
              <Typography sx={{ fontSize: 12, lineHeight: 1, color: (theme) => theme.emphasys.table.muted }}>—</Typography>
            )}
          </Box>
        );
      })}

      {Array.from({ length: vacios }, (_, indice) => {
        const index = lineas.length + indice;
        return (
          <Box
            key={`vacio-${indice}`}
            aria-hidden
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: KARDEX_COLUMNAS,
              columnGap: 1.25,
              height: KARDEX_ALTO_FILA,
              minWidth: KARDEX_ANCHO_MINIMO,
              px: 1.5,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              userSelect: 'none',
              backgroundColor: index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash,
              borderBottom: `1px solid ${theme.emphasys.content.border}`,
            })}
          >
            <Box sx={(theme) => ({ gridColumn: '6', borderLeft: `1px solid ${theme.emphasys.content.border}`, height: '100%' })} />
          </Box>
        );
      })}

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

function DocumentosRelacionados({ documentos }: { documentos: DocumentoRelacionadoProducto[] }) {
  const navigate = useNavigate();
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
  const [tipoActivo, setTipoActivo] = React.useState(grupos[0]?.tipo ?? '');

  React.useEffect(() => {
    if (!grupos.some((grupo) => grupo.tipo === tipoActivo)) {
      setTipoActivo(grupos[0]?.tipo ?? '');
    }
  }, [grupos, tipoActivo]);

  if (grupos.length === 0) {
    return <Typography sx={{ fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>Sin documentos relacionados.</Typography>;
  }

  const activo = grupos.find((grupo) => grupo.tipo === tipoActivo) ?? grupos[0];

  return (
    <Box>
      <Tabs
        value={activo.tipo}
        onChange={(_, value) => setTipoActivo(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={(theme) => ({
          minHeight: 34,
          mb: 1,
          '& .MuiTab-root': { minHeight: 34, minWidth: 0, px: 1.1, py: 0.5, textTransform: 'none', fontWeight: 650, fontSize: 13, color: theme.emphasys.content.muted },
          '& .Mui-selected': { color: theme.emphasys.content.foreground },
          '& .MuiTabs-indicator': { height: 2, borderRadius: 2, backgroundColor: theme.emphasys.content.foreground },
        })}
      >
        {grupos.map((grupo) => (
          <Tab key={grupo.tipo} value={grupo.tipo} label={`${getDocumentoTypeConfig(grupo.tipo)?.label ?? grupo.tipo} (${grupo.filas.length})`} />
        ))}
      </Tabs>
      <Stack spacing={0.45}>
        {activo.filas.map((documento) => {
          const ruta = rutaDocumento(documento);
          return (
            <Box
              key={documento.id}
              component="button"
              type="button"
              disabled={!ruta}
              onClick={() => {
                if (ruta) navigate(ruta);
              }}
              sx={(theme) => ({
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 28px',
                gap: 0.75,
                alignItems: 'center',
                textAlign: 'left',
                border: `1px solid ${theme.emphasys.content.border}`,
                borderRadius: '10px',
                px: 1,
                py: 0.7,
                font: 'inherit',
                cursor: ruta ? 'pointer' : 'default',
                color: theme.emphasys.content.foreground,
                backgroundColor: theme.emphasys.content.elevated,
                '&:hover': { backgroundColor: ruta ? theme.emphasys.content.hover : theme.emphasys.content.elevated },
                '&:disabled': { opacity: 0.7 },
              })}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                  <Typography sx={{ fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>{formatDate(documento.fecha) ?? '—'}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{documento.folio || 'Sin folio'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline', mt: 0.2 }}>
                  <Typography noWrap sx={{ fontSize: 13, minWidth: 0 }}>{documento.contacto || '—'}</Typography>
                  <Typography sx={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: (theme) => theme.emphasys.content.secondary }}>{etiquetaEstado(documento.estado)}</Typography>
                </Box>
              </Box>
              <OpenInNewOutlinedIcon sx={{ fontSize: 16, color: (theme) => (ruta ? theme.emphasys.content.foreground : theme.emphasys.content.muted) }} />
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

const TABS = ['resumen', 'comercial', 'inventario', 'archivos', 'especificaciones', 'relacionados'] as const;
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
  const [almacenKardexId, setAlmacenKardexId] = React.useState<number | null>(null);
  const [kardexConsulta, setKardexConsulta] = React.useState(0);
  const productoSeleccionRef = React.useRef<number | null>(null);
  const [tab, setTab] = React.useState<TabId>('resumen');
  const [toggling, setToggling] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
    setTab('resumen');
    setAlmacenKardexId(null);
    setKardex([]);
    setKardexError(null);
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

  const clasificacionCatalogo = valorCatalogoPorNombre(catalogos, 'clasificacion');
  const familiaCatalogo = valorCatalogoPorNombre(catalogos, 'familia');
  const lineaCatalogo = valorCatalogoPorNombre(catalogos, 'linea');

  const costoBase = producto.costo_estandar ?? producto.costo_promedio ?? producto.ultimo_costo ?? null;
  const nivelesPrecio: { nivel: string; valor: number | null }[] = [
    { nivel: 'Público', valor: producto.precio_publico },
    { nivel: 'Mayoreo', valor: producto.precio_mayoreo },
    { nivel: 'Menudeo', valor: producto.precio_menudeo },
    { nivel: 'Distribuidor', valor: producto.precio_distribuidor },
  ];
  const existenciaTotal = existencias.reduce((suma, fila) => suma + Number(fila.existencia || 0), 0);
  const servicio = esServicio(producto.tipo_producto);

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
          <Tab value="inventario" label="Inventario" />
          <Tab value="archivos" label={`Imágenes${archivos.length ? ` (${archivos.length})` : ''}`} />
          <Tab value="especificaciones" label="Especificaciones" />
          <Tab value="relacionados" label={`Relacionados${documentosRelacionados.length ? ` (${documentosRelacionados.length})` : ''}`} />
        </Tabs>
        <Box
          sx={{
            p: { xs: 1, md: 1.25 },
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: tab === 'inventario' ? 'flex' : 'block',
            flexDirection: 'column',
          }}
        >
          {tab === 'resumen' && (
            <Stack spacing={1}>
              <SectionCard title="Datos generales">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.25 }}>
                  <InfoRow label="Clave" value={producto.clave} />
                  <InfoRow label="Descripción" value={producto.descripcion} />
                  <InfoRow label="Tipo de producto" value={producto.tipo_producto} />
                  {clasificacionCatalogo ? <InfoRow label="Clasificación" value={clasificacionCatalogo} /> : null}
                  {familiaCatalogo ? <InfoRow label="Familia" value={familiaCatalogo} /> : null}
                  {lineaCatalogo ? <InfoRow label="Línea" value={lineaCatalogo} /> : null}
                  <InfoRow label="Estado" value={producto.activo ? 'Activo' : 'Inactivo'} />
                  <InfoRow label="Creado" value={formatDate(producto.fecha_creacion)} />
                </Box>
              </SectionCard>

              <SectionCard title="SAT y unidades">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.25 }}>
                  <InfoRow label="Clave SAT producto" value={producto.clave_producto_sat} />
                  <InfoRow label="Unidad de venta" value={producto.unidad_venta_clave ? `${producto.unidad_venta_clave}${producto.unidad_venta_descripcion ? ` · ${producto.unidad_venta_descripcion}` : ''}` : null} />
                  <InfoRow label="Unidad de inventario" value={producto.unidad_inventario_clave ? `${producto.unidad_inventario_clave}${producto.unidad_inventario_descripcion ? ` · ${producto.unidad_inventario_descripcion}` : ''}` : null} />
                  <InfoRow label="IVA" value={producto.iva_porcentaje !== null && producto.iva_porcentaje !== undefined ? `${producto.iva_porcentaje}%` : null} />
                  <InfoRow label="IEPS" value={producto.ieps_porcentaje !== null && producto.ieps_porcentaje !== undefined ? `${producto.ieps_porcentaje}%` : null} />
                  <InfoRow label="Fracción arancelaria" value={producto.fraccion_arancelaria} />
                </Box>
              </SectionCard>

              {catalogosSeleccionados.length > 0 && (
                <SectionCard title="Información comercial y catálogos">
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.25 }}>
                    {catalogosSeleccionados.map((row) => (
                      <InfoRow key={row.id} label={row.k} value={row.v} />
                    ))}
                  </Box>
                </SectionCard>
              )}

              {esAdmin && (
                <SectionCard
                  title="Costos y precios propios"
                  action={
                    <Chip label="Restringido" size="small" sx={{ height: 18, fontSize: 10.5, fontWeight: 600, backgroundColor: tokens.metric.amount.background, color: tokens.metric.amount.foreground }} />
                  }
                >
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 0.75 }}>
                    <Box sx={{ borderRadius: '10px', p: 1, bgcolor: tokens.content.elevated }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.content.muted }}>Costo</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: (theme) => theme.typography.figure.fontFamily }}>{formatCurrency(costoBase) ?? '—'}</Typography>
                    </Box>
                    {nivelesPrecio.filter((n) => n.valor !== null && n.valor !== undefined).map((n) => (
                      <Box key={n.nivel} sx={{ borderRadius: '10px', p: 1, bgcolor: tokens.content.elevated }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.content.muted }}>Precio {n.nivel}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: (theme) => theme.typography.figure.fontFamily, color: tokens.content.foreground }}>{formatCurrency(n.valor)}</Typography>
                        {costoBase && n.valor ? (
                          <Typography sx={{ fontSize: 11, color: tokens.content.muted }}>
                            margen {(((Number(n.valor) - Number(costoBase)) / Number(n.valor)) * 100).toFixed(1)}%
                          </Typography>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                </SectionCard>
              )}

              <SectionCard title="Existencia por almacén">
                <ExistenciasAlmacen existencias={existencias} tipo={producto.tipo_producto} />
              </SectionCard>
            </Stack>
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

          {tab === 'inventario' && (
            <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
              <SectionCard title="Parámetros de inventario">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.25 }}>
                  <InfoRow label="Tipo de producto" value={producto.tipo_producto} />
                  <InfoRow label="Unidad de inventario" value={producto.unidad_inventario_clave} />
                  <InfoRow label="Mínimo de inventario" value={producto.minimo_inventario} />
                  <InfoRow label="Ubicación en almacén" value={producto.ubicacion_almacen} />
                </Box>
              </SectionCard>
              <SectionCard title="Existencia real por almacén">
                <ExistenciasAlmacen
                  existencias={existencias}
                  tipo={producto.tipo_producto}
                  almacenSeleccionadoId={almacenKardexId}
                  onSeleccionarAlmacen={seleccionarAlmacenKardex}
                />
              </SectionCard>
              <Box sx={{ flex: '1 1 auto', minHeight: 240, display: 'flex', flexDirection: 'column' }}>
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
                <KardexProducto lineas={kardex} cargando={kardexCargando} error={kardexError} />
              </SectionCard>
              </Box>
            </Stack>
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
            <Stack spacing={1}>
              <SectionCard title="Biblioteca del producto">
                <EspecificacionesBibliotecaEditor productoId={producto.id} alcance="producto" onError={(message) => setError(message)} />
              </SectionCard>
              {producto.especificaciones ? (
                <SectionCard title="Notas y descripción extendida">
                  <Box
                    sx={{ fontSize: 13, lineHeight: 1.5, color: tokens.content.foreground, overflowWrap: 'anywhere', '& img': { maxWidth: '100%', height: 'auto' }, '& p': { my: 0.5 } }}
                    dangerouslySetInnerHTML={{ __html: producto.especificaciones }}
                  />
                </SectionCard>
              ) : null}
            </Stack>
          )}

          {tab === 'relacionados' && (
            <SectionCard title="Documentos relacionados">
              <DocumentosRelacionados documentos={documentosRelacionados} />
            </SectionCard>
          )}
        </Box>
      </Box>
    </Box>
  );
}
