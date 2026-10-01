import * as React from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
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
} from '../../services/productosService';
import { buildAssetUrl } from '../../services/empresasAssetsService';
import EspecificacionesBibliotecaEditor from './EspecificacionesBibliotecaEditor';

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
};

const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return currencyFormatter.format(numeric);
}

function normalizarTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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

function InfoRow({ label, value, compact }: { label: string; value: React.ReactNode; compact?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: (theme) => theme.emphasys.content.muted }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={compact ? 500 : 600}
        sx={{ color: (theme) => theme.emphasys.content.foreground, wordBreak: 'break-word', ...(compact ? { fontSize: 13 } : {}) }}
      >
        {value || value === 0 ? value : '—'}
      </Typography>
    </Box>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={(theme) => ({ border: `1px solid ${theme.emphasys.content.border}`, borderRadius: 2, backgroundColor: theme.emphasys.content.card })}>
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          borderBottom: (theme) => `1px solid ${theme.emphasys.content.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}
        >
          {title}
        </Typography>
        {action ? <Box sx={{ ml: 'auto' }}>{action}</Box> : null}
      </Box>
      <Box sx={{ p: 1.75 }}>{children}</Box>
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
          sx={(theme) => ({ height: 22, fontSize: 11, fontWeight: 700, backgroundColor: theme.emphasys.metric.amount.background, color: theme.emphasys.content.foreground })}
        />
      }
    >
      <Box sx={{ textAlign: 'center', py: 1.5 }}>
        <Typography variant="body2" sx={(theme) => ({ maxWidth: 420, mx: 'auto', lineHeight: 1.5, color: theme.emphasys.content.muted })}>
          {message}
        </Typography>
      </Box>
    </SectionCard>
  );
}

const TABS = ['resumen', 'comercial', 'inventario', 'archivos', 'especificaciones', 'relacionados'] as const;
type TabId = (typeof TABS)[number];

export default function ProductoWorkspace({ productoId, esAdmin, onEditar, onEliminar, onChanged, onAlternarActivo, alternando = false }: ProductoWorkspaceProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [producto, setProducto] = React.useState<Producto | null>(null);
  const [archivos, setArchivos] = React.useState<ProductoArchivo[]>([]);
  const [catalogos, setCatalogos] = React.useState<CatalogoConfigurablesProductoRespuesta | null>(null);
  const [tab, setTab] = React.useState<TabId>('resumen');
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
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
    ])
      .then(([productoData, archivosData, catalogosData]) => {
        if (!active) return;
        setProducto(productoData);
        setArchivos(archivosData);
        setCatalogos(catalogosData);
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
    return cargar();
  }, [cargar]);

  // Mantiene el productoId "vigente" accesible para las operaciones async de abajo,
  // de forma que si el usuario cambia de producto antes de que resuelvan, el resultado
  // tardío se descarte en vez de sobrescribir el estado del producto ahora seleccionado.
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

  if (!productoId) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (theme) => theme.emphasys.content.background,
        }}
      >
        <Box sx={{ textAlign: 'center', px: 3 }}>
          <Inventory2OutlinedIcon sx={{ fontSize: 40, color: (theme) => theme.emphasys.content.muted, mb: 1 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: (theme) => theme.emphasys.content.foreground }}>
            Selecciona un producto
          </Typography>
          <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>
            Elige un producto de la lista para ver su información.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loading || !producto) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (theme) => theme.emphasys.content.background,
        }}
      >
        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : (
          <CircularProgress size={28} />
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

  // Clasificación/Familia/Línea de Resumen: SIEMPRE derivadas de los catálogos
  // comerciales configurables (nunca de producto.clasificacion/familia/linea,
  // columnas legacy). Si la empresa no tiene el catálogo correspondiente
  // configurado, o no hay valor seleccionado, quedan en null y no se muestran.
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

  return (
    <Box sx={(theme) => ({ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: theme.emphasys.content.background, overflow: 'hidden' })}>
      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: 1.6, pb: 1.4 }}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: 1.5,
                border: (theme) => `1px solid ${theme.emphasys.content.border}`,
                backgroundColor: (theme) => theme.emphasys.content.elevated,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {principal ? (
                <img
                  src={buildAssetUrl(principal.archivo)}
                  alt={producto.descripcion}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <ImageOutlinedIcon sx={{ color: (theme) => theme.emphasys.content.muted }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={(theme) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: theme.emphasys.content.muted })}>
                PRODUCTO SELECCIONADO
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.35 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={(theme) => ({ fontSize: 11, letterSpacing: '0.14em', color: theme.emphasys.content.muted })}
                >
                  {producto.clave}
                </Typography>
                <Chip
                  size="small"
                  label={producto.activo ? 'Activo' : 'Inactivo'}
                  sx={(theme) => ({
                    height: 19,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: producto.activo ? theme.emphasys.metric.applied.background : theme.emphasys.content.elevated,
                    color: producto.activo ? theme.emphasys.metric.applied.foreground : theme.emphasys.content.muted,
                  })}
                />
                {producto.tipo_producto ? (
                  <Chip
                    size="small"
                    label={producto.tipo_producto}
                    sx={(theme) => ({ height: 26, px: 0.4, fontSize: 12, fontWeight: 700, borderRadius: 99, backgroundColor: theme.emphasys.metric.amount.background, color: theme.emphasys.content.foreground })}
                  />
                ) : null}
              </Stack>
              <Typography
                fontWeight={600}
                sx={{
                  color: (theme) => theme.emphasys.content.foreground,
                  fontSize: 28,
                  fontFamily: (theme) => theme.typography.figure.fontFamily,
                  lineHeight: 1.35,
                  mt: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {producto.descripcion}
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {familiaCatalogo ? (
                  <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.secondary })}>
                    Familia: <Typography component="span" variant="body2" sx={{ color: 'inherit' }} fontWeight={500}>{familiaCatalogo}</Typography>
                  </Typography>
                ) : null}
                {producto.unidad_venta_clave ? (
                  <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.secondary })}>
                    Unidad: <Typography component="span" variant="body2" sx={{ color: 'inherit' }} fontWeight={500}>{producto.unidad_venta_clave}</Typography>
                  </Typography>
                ) : null}
                {producto.clave_producto_sat ? (
                  <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.secondary })}>
                    SAT: <Typography component="span" variant="body2" sx={{ color: 'inherit' }} fontWeight={500}>{producto.clave_producto_sat}</Typography>
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Tooltip title="Editar producto">
              <IconButton size="small" sx={(theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover } })} onClick={() => onEditar(producto.id)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={producto.activo ? 'Desactivar' : 'Activar'}>
              <span>
                <IconButton
                  size="small"
                  disabled={toggling || alternando}
                  sx={(theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover }, '&.Mui-disabled': { bgcolor: theme.emphasys.action.disabled, color: theme.emphasys.action.primaryForeground } })}
                  onClick={() => void handleToggleActivo()}
                >
                  <PowerSettingsNewIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" sx={(theme) => ({ width: 34, height: 34, borderRadius: '10px', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover } })} onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreHorizIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onEliminar(producto);
                }}
                sx={{ color: (theme) => theme.emphasys.action.destructive }}
              >
                <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Eliminar
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>

      </Box>
      <Box sx={(theme) => ({ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mx: { xs: 1, md: 1.75 }, mb: { xs: 1, md: 1.75 }, bgcolor: theme.emphasys.content.well, borderRadius: 3, border: `1px solid ${theme.emphasys.content.border}`, overflow: 'hidden' })}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={(theme) => ({
            px: 1.5,
            minHeight: 46,
            borderBottom: `1px solid ${theme.emphasys.content.border}`,
            '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 650, fontSize: 14, color: theme.emphasys.content.muted },
            '& .Mui-selected': { color: theme.emphasys.content.foreground },
            '& .MuiTabs-indicator': { height: 2, borderRadius: 2, backgroundColor: theme.emphasys.content.foreground },
          })}
        >
          <Tab value="resumen" label="Resumen" />
          <Tab value="comercial" label={esAdmin ? 'Comercial y precios' : 'Comercial'} />
          <Tab value="inventario" label="Inventario" />
          <Tab value="archivos" label={`Imágenes${archivos.length ? ` (${archivos.length})` : ''}`} />
          <Tab value="especificaciones" label="Especificaciones" />
          <Tab value="relacionados" label="Relacionados" />
        </Tabs>
      <Box sx={{ p: { xs: 1.5, md: 2.25 }, overflowY: 'auto', flex: 1 }}>
        {tab === 'resumen' && (
          <Stack spacing={1.5}>
            <SectionCard title="Datos generales">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                <InfoRow label="Clave" value={producto.clave} />
                <InfoRow label="Descripción" value={producto.descripcion} compact />
                <InfoRow label="Tipo de producto" value={producto.tipo_producto} />
                {clasificacionCatalogo ? <InfoRow label="Clasificación" value={clasificacionCatalogo} /> : null}
                {familiaCatalogo ? <InfoRow label="Familia" value={familiaCatalogo} /> : null}
                {lineaCatalogo ? <InfoRow label="Línea" value={lineaCatalogo} /> : null}
                <InfoRow label="Estado" value={producto.activo ? 'Activo' : 'Inactivo'} />
                <InfoRow label="Creado" value={formatDate(producto.fecha_creacion)} />
              </Box>
            </SectionCard>

            <SectionCard title="SAT y unidades">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                <InfoRow label="Clave SAT producto" value={producto.clave_producto_sat} />
                <InfoRow label="Unidad de venta" value={producto.unidad_venta_clave ? `${producto.unidad_venta_clave} · ${producto.unidad_venta_descripcion ?? ''}` : null} />
                <InfoRow label="Unidad de inventario" value={producto.unidad_inventario_clave ? `${producto.unidad_inventario_clave} · ${producto.unidad_inventario_descripcion ?? ''}` : null} />
                <InfoRow label="IVA" value={producto.iva_porcentaje !== null && producto.iva_porcentaje !== undefined ? `${producto.iva_porcentaje}%` : null} />
                <InfoRow label="IEPS" value={producto.ieps_porcentaje !== null && producto.ieps_porcentaje !== undefined ? `${producto.ieps_porcentaje}%` : null} />
                <InfoRow label="Fracción arancelaria" value={producto.fraccion_arancelaria} />
              </Box>
            </SectionCard>

            {catalogosSeleccionados.length > 0 && (
              <SectionCard title="Información comercial y catálogos">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
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
                  <Chip
                    label="Restringido"
                    size="small"
                    sx={(theme) => ({ height: 18, fontSize: 10.5, fontWeight: 600, backgroundColor: theme.emphasys.metric.amount.background, color: theme.emphasys.metric.amount.foreground })}
                  />
                }
              >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                  <Box sx={{ border: (theme) => `1px solid ${theme.emphasys.content.border}`, borderRadius: 1.5, p: 1.25 }}>
                    <Typography variant="caption" sx={{ color: (theme) => theme.emphasys.content.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Costo</Typography>
                    <Typography variant="h6" fontWeight={700}>{formatCurrency(costoBase) ?? '—'}</Typography>
                  </Box>
                  {nivelesPrecio.filter((n) => n.valor !== null && n.valor !== undefined).map((n) => (
                    <Box key={n.nivel} sx={{ border: (theme) => `1px solid ${theme.emphasys.content.border}`, borderRadius: 1.5, p: 1.25 }}>
                      <Typography variant="caption" sx={{ color: (theme) => theme.emphasys.content.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Precio {n.nivel}</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color: (theme) => theme.emphasys.content.foreground }}>{formatCurrency(n.valor)}</Typography>
                      {costoBase && n.valor ? (
                        <Typography variant="caption" sx={{ color: (theme) => theme.emphasys.content.muted }}>
                          margen {(((Number(n.valor) - Number(costoBase)) / Number(n.valor)) * 100).toFixed(1)}%
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              </SectionCard>
            )}

            <PendingCard
              title="Existencia por almacén"
              message="Se mostrará existencia real por almacén cuando el módulo de Inventario esté conectado a este workspace."
            />
          </Stack>
        )}

        {tab === 'comercial' && (
          <Stack spacing={1.5}>
            <SectionCard title="Información comercial y catálogos">
              {catalogosSeleccionados.length > 0 ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                  {catalogosSeleccionados.map((row) => (
                    <InfoRow key={row.id} label={row.k} value={row.v} />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>Este producto no tiene catálogos comerciales asignados.</Typography>
              )}
            </SectionCard>

            <SectionCard title="Condiciones de venta">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
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
                    <Box sx={(theme) => ({ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', backgroundColor: theme.emphasys.grid.header, color: theme.emphasys.grid.headerForeground, fontSize: 11, fontWeight: 600, px: 1.75, py: 1, borderRadius: 1 })}>
                      <span>Nivel de precio</span><span style={{ textAlign: 'right' }}>Margen</span><span style={{ textAlign: 'right' }}>Precio</span>
                    </Box>
                    {nivelesPrecio.filter((n) => n.valor !== null && n.valor !== undefined).map((n) => (
                      <Box key={n.nivel} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', px: 1.75, py: 1, fontSize: 13, borderBottom: (theme) => `1px solid ${theme.emphasys.content.border}` }}>
                        <span>{n.nivel}</span>
                        <span style={{ textAlign: 'right' }}>
                          {costoBase && n.valor ? `${(((Number(n.valor) - Number(costoBase)) / Number(n.valor)) * 100).toFixed(1)}%` : '—'}
                        </span>
                        <span style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(n.valor)}</span>
                      </Box>
                    ))}
                    {nivelesPrecio.every((n) => n.valor === null || n.valor === undefined) && (
                      <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted, py: 2 }}>Este producto no tiene precios propios capturados.</Typography>
                    )}
                  </Box>
                </SectionCard>

                <SectionCard title="Costos">
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
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
          <Stack spacing={1.5}>
            <SectionCard title="Parámetros de inventario">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                <InfoRow label="Tipo de producto" value={producto.tipo_producto} />
                <InfoRow label="Unidad de inventario" value={producto.unidad_inventario_clave} />
                <InfoRow label="Mínimo de inventario" value={producto.minimo_inventario} />
                <InfoRow label="Ubicación en almacén" value={producto.ubicacion_almacen} />
              </Box>
            </SectionCard>
            <PendingCard
              title="Existencia real por almacén"
              message="Estructura lista para poblar: los almacenes ya existen en el catálogo, las cantidades dependen de conectar el módulo de Inventario a este workspace."
            />
            <PendingCard
              title="Movimientos / Kardex"
              message="El historial de entradas, salidas y traspasos aparecerá aquí cuando se conecte el módulo de Inventario."
            />
          </Stack>
        )}

        {tab === 'archivos' && (
          <SectionCard
            title="Imágenes"
            action={
              <>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void handleUploadImagen(e)} />
                <Chip
                  icon={<UploadFileIcon sx={{ fontSize: 15 }} />}
                  label="Subir imagen"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={(theme) => ({ cursor: 'pointer', height: 24, fontWeight: 600, color: theme.emphasys.content.foreground, border: `1px solid ${theme.emphasys.content.border}`, bgcolor: theme.emphasys.content.card })}
                  variant="outlined"
                />
              </>
            }
          >
            {archivos.length === 0 ? (
              <Typography variant="body2" sx={{ color: (theme) => theme.emphasys.content.muted }}>Este producto no tiene imágenes cargadas.</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1.5 }}>
                {archivos.map((archivo) => (
                  <Box key={archivo.id} sx={{ border: (theme) => `1px solid ${theme.emphasys.content.border}`, borderRadius: 1.5, overflow: 'hidden', position: 'relative' }}>
                    <Box component="img" src={buildAssetUrl(archivo.archivo)} alt={archivo.descripcion ?? ''} sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    <Stack direction="row" spacing={0.25} sx={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1 }}>
                      <Tooltip title={archivo.principal ? 'Imagen principal' : 'Marcar como principal'}>
                        <IconButton size="small" onClick={() => void handleMarcarPrincipal(archivo.id)}>
                          {archivo.principal ? <StarIcon fontSize="small" sx={{ color: (theme) => theme.emphasys.content.foreground }} /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" onClick={() => void handleEliminarArchivo(archivo.id)}>
                          <DeleteOutlineIcon fontSize="small" sx={{ color: (theme) => theme.emphasys.action.destructive }} />
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
          <Stack spacing={1.5}>
            <EspecificacionesBibliotecaEditor productoId={producto.id} alcance="producto" onError={(message) => setError(message)} />
            {producto.especificaciones ? (
              <SectionCard title="Notas y descripción extendida">
                <Box
                  sx={{ fontSize: 13, lineHeight: 1.6, color: (theme) => theme.emphasys.content.foreground }}
                  dangerouslySetInnerHTML={{ __html: producto.especificaciones }}
                />
              </SectionCard>
            ) : null}
          </Stack>
        )}

        {tab === 'relacionados' && (
          <PendingCard
            title="Documentos relacionados"
            message="Cotizaciones, pedidos, facturas y órdenes de compra donde participa este producto aparecerán aquí cuando este workspace se conecte al módulo de Documentos."
          />
        )}
      </Box>
      </Box>
    </Box>
  );
}
