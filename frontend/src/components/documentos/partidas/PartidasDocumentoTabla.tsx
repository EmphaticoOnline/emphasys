// Tabla de partidas compartida por las tarjetas del contacto y las pestañas
// "Partidas" de los workspaces (facturas, cotizaciones, vista clásica):
// descuentos por partida, resumen que cuadra hasta el total e imágenes
// capturadas en el documento, que se abren en un visor vertical.
import * as React from 'react';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import type { CotizacionPartida } from '../../../types/cotizacion';
import { fetchProductoArchivos } from '../../../services/productosService';
import { buildAssetUrl } from '../../../services/empresasAssetsService';

export const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
export const quantity = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
export const percent = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
export const redondear = (value: number) => Math.round(value * 100) / 100;
export const porcentajeValido = (value: unknown) => Math.min(100, Math.max(0, Number(value) || 0));

/** Misma regla que el formulario: descuento de partida por porcentaje o por monto. */
export function descuentoPartida(partida: CotizacionPartida) {
  const bruto = Number(partida.cantidad || 0) * Number(partida.precio_unitario || 0);
  const porMonto = partida.descuento_tipo === 'monto';
  const monto = porMonto
    ? Math.min(Math.max(Number(partida.descuento_monto) || 0, 0), Math.max(bruto, 0))
    : bruto * (porcentajeValido(partida.descuento) / 100);
  // Si se capturó por monto no hay porcentaje: la columna % queda en blanco.
  return { bruto, monto: redondear(monto), porcentaje: porMonto ? null : porcentajeValido(partida.descuento) };
}

/** Texto del descuento de una partida: "Desc. 10 % · −$1,695.00", o sólo el monto si fue por monto. */
export function textoDescuentoPartida(descuento: ReturnType<typeof descuentoPartida>): string | null {
  if (descuento.monto <= 0) return null;
  const pct = descuento.porcentaje !== null ? `${percent.format(descuento.porcentaje)} % · ` : '';
  return `Desc. ${pct}−${currency.format(descuento.monto)}`;
}

export type TotalesDocumento = {
  descuento_global?: number | null;
  subtotal?: number | null;
  total?: number | null;
};

/**
 * Importes de las partidas como se capturaron (cantidad × precio − descuento de
 * la partida, sin IVA) y el descuento global como la diferencia contra el
 * subtotal guardado, para que todo cuadre al centavo.
 */
export function calcularPartidas(partidas: CotizacionPartida[], totales?: TotalesDocumento | null) {
  const lineas = partidas.map((partida) => {
    const descuento = descuentoPartida(partida);
    return { partida, descuento, importe: redondear(descuento.bruto - descuento.monto) };
  });
  const sumaPartidas = redondear(lineas.reduce((acc, linea) => acc + linea.importe, 0));
  const descuentoGlobalPct = porcentajeValido(totales?.descuento_global);
  const subtotal = Number(totales?.subtotal ?? sumaPartidas);
  // El descuento global se prorratea sobre las partidas; la diferencia contra
  // el subtotal guardado es su monto exacto (evita descuadres por centavos).
  const descuentoGlobalMonto = descuentoGlobalPct > 0 ? redondear(sumaPartidas - subtotal) : 0;
  return { lineas, sumaPartidas, descuentoGlobalPct, descuentoGlobalMonto, subtotal };
}

export const encabezadoSx = (theme: Theme) => ({
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: theme.emphasys.content.muted,
});

export function FilaResumen({ label, value, fuerte = false }: { label: string; value: string; fuerte?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, py: 0.3 }}>
      <Typography sx={(theme) => ({ fontSize: 13, color: fuerte ? theme.emphasys.content.foreground : theme.emphasys.content.muted, fontWeight: fuerte ? 700 : 500 })}>
        {label}
      </Typography>
      <Typography sx={(theme) => ({ fontSize: 13.5, fontWeight: fuerte ? 800 : 600, fontVariantNumeric: 'tabular-nums', color: theme.emphasys.content.foreground })}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Imágenes capturadas en el documento: la imagen propia de la partida o, si no
 * tiene, la imagen del producto que se eligió para ella. No se agregan las demás
 * imágenes del catálogo del producto.
 */
function useImagenesPartidas(partidas: CotizacionPartida[]) {
  const [porProducto, setPorProducto] = React.useState<Record<number, string>>({});

  // Sólo hace falta consultar los productos cuya imagen elegida no es propia de la partida.
  const pendientes = React.useMemo(() => {
    const ids = partidas
      .filter((partida) => !partida.archivo_imagen_1?.trim() && partida.producto_archivo_id && partida.producto_id)
      .map((partida) => Number(partida.producto_id));
    return [...new Set(ids)];
  }, [partidas]);

  React.useEffect(() => {
    let vivo = true;
    if (pendientes.length === 0) {
      setPorProducto({});
      return () => { vivo = false; };
    }
    void Promise.all(pendientes.map((productoId) => fetchProductoArchivos(productoId).catch(() => [])))
      .then((grupos) => {
        if (!vivo) return;
        const urls: Record<number, string> = {};
        grupos.flat().forEach((archivo) => {
          if (archivo?.archivo) urls[archivo.id] = buildAssetUrl(archivo.archivo);
        });
        setPorProducto(urls);
      });
    return () => { vivo = false; };
  }, [pendientes]);

  return React.useMemo(() => {
    const mapa = new Map<number, string>();
    partidas.forEach((partida) => {
      const propia = partida.archivo_imagen_1?.trim();
      const url = propia ? buildAssetUrl(propia) : partida.producto_archivo_id ? porProducto[partida.producto_archivo_id] : null;
      if (url) mapa.set(partida.id, url);
    });
    return mapa;
  }, [partidas, porProducto]);
}

type ImagenVisor = { partidaId: number; url: string; titulo: string; subtitulo: string };

/** Todas las imágenes del documento apiladas; abre posicionado en la elegida. */
function VisorImagenes({ imagenes, inicialId, onClose }: { imagenes: ImagenVisor[]; inicialId: number | null; onClose: () => void }) {
  const refs = React.useRef<Record<number, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (inicialId === null) return undefined;
    // Espera a que el diálogo monte su contenido antes de desplazar.
    const timer = window.setTimeout(() => refs.current[inicialId]?.scrollIntoView({ block: 'start' }), 0);
    return () => window.clearTimeout(timer);
  }, [inicialId]);

  return (
    <Dialog open={inicialId !== null} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.25 }}>
        <Typography component="span" sx={{ fontSize: 15, fontWeight: 700 }}>
          Imágenes de las partidas{imagenes.length > 1 ? ` (${imagenes.length})` : ''}
        </Typography>
        <IconButton size="small" aria-label="Cerrar" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {imagenes.map((imagen) => (
          <Box
            key={imagen.partidaId}
            ref={(node: HTMLDivElement | null) => { refs.current[imagen.partidaId] = node; }}
            sx={{ scrollMarginTop: 8 }}
          >
            <Typography sx={(theme) => ({ fontSize: 13.5, fontWeight: 700, color: theme.emphasys.content.foreground })}>
              {imagen.titulo}
            </Typography>
            {imagen.subtitulo ? (
              <Typography sx={(theme) => ({ fontSize: 12, color: theme.emphasys.content.muted, mb: 1 })}>{imagen.subtitulo}</Typography>
            ) : null}
            <Box
              sx={(theme) => ({
                display: 'flex',
                justifyContent: 'center',
                bgcolor: theme.emphasys.content.well,
                border: `1px solid ${theme.emphasys.content.border}`,
                borderRadius: 1.5,
                p: 1,
              })}
            >
              <Box component="img" src={imagen.url} alt={imagen.titulo} loading="lazy" sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
            </Box>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
}

function MarcaVinculada() {
  return (
    <Typography
      component="span"
      sx={(theme) => ({ display: 'block', mt: 0.2, fontSize: 11.5, fontWeight: 700, color: theme.emphasys.action.primary })}
    >
      Vinculada con este documento
    </Typography>
  );
}

function BotonImagen({ titulo, onClick }: { titulo: string; onClick: () => void }) {
  return (
    <Tooltip title="Ver imagen">
      <IconButton
        size="small"
        aria-label={`Ver imagen de ${titulo}`}
        onClick={onClick}
        sx={(theme) => ({ p: 0.25, color: theme.emphasys.content.muted, '&:hover': { color: theme.emphasys.content.foreground } })}
      >
        <ImageOutlinedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}

/** Partidas de cualquier documento con descuentos, imágenes y resumen hasta el total. */
export default function PartidasDocumentoTabla({
  partidas,
  totales,
  vinculadas,
}: {
  partidas: CotizacionPartida[];
  totales?: TotalesDocumento | null;
  /** En Relacionados: partidas vinculadas con el documento consultado. Sólo se marcan si no son todas. */
  vinculadas?: ReadonlySet<number> | null;
}) {
  const imagenesPorPartida = useImagenesPartidas(partidas);
  const [visorId, setVisorId] = React.useState<number | null>(null);

  if (partidas.length === 0) {
    return (
      <Typography variant="body2" sx={(theme) => ({ py: 1.5, color: theme.emphasys.content.muted })}>
        Este documento no tiene partidas.
      </Typography>
    );
  }

  const { lineas, sumaPartidas, descuentoGlobalPct, descuentoGlobalMonto, subtotal } = calcularPartidas(partidas, totales);
  const conDescuento = lineas.some((linea) => linea.descuento.monto > 0);
  const conImagenes = imagenesPorPartida.size > 0;
  const marcarVinculadas = Boolean(vinculadas && vinculadas.size > 0 && partidas.some((partida) => !vinculadas.has(partida.id)));
  const total = Number(totales?.total ?? subtotal);
  const impuestos = redondear(total - subtotal);

  // Una sola cuadrícula para encabezado y filas: las columnas numéricas toman
  // el ancho de su contenido más largo y el producto usa el resto, así sólo
  // baja a otra línea cuando de verdad no cabe.
  const numericas = conDescuento ? 5 : 3;
  const columnas = `${conImagenes ? 'max-content ' : ''}minmax(0, 1fr) repeat(${numericas}, max-content)`;
  const titulos = [
    ...(conImagenes ? [''] : []),
    'Producto',
    'Cantidad',
    'Precio',
    ...(conDescuento ? ['Desc. %', 'Descuento'] : []),
    'Importe',
  ];
  const filas = lineas.map(({ partida, descuento, importe }) => {
    const tieneDescuento = descuento.monto > 0;
    const especificaciones = (partida as CotizacionPartida & { especificaciones?: Array<{ id?: number; contenido?: string | null }> }).especificaciones;
    return {
      id: partida.id,
      clave: partida.producto_clave,
      descripcion: partida.producto_descripcion || partida.descripcion_alterna || 'Sin descripción',
      notas: [
        ...(Array.isArray(especificaciones) ? especificaciones.map((spec) => spec.contenido ?? '') : []),
        partida.observaciones ?? '',
      ].map((nota) => nota.trim()).filter(Boolean),
      imagen: imagenesPorPartida.get(partida.id) ?? null,
      vinculada: marcarVinculadas && Boolean(vinculadas?.has(partida.id)),
      cantidad: quantity.format(Number(partida.cantidad || 0)),
      precio: currency.format(Number(partida.precio_unitario || 0)),
      tieneDescuento,
      descuentoPct: !tieneDescuento ? '—' : descuento.porcentaje !== null ? `${percent.format(descuento.porcentaje)}%` : '',
      descuentoMonto: tieneDescuento ? `−${currency.format(descuento.monto)}` : '—',
      importe: currency.format(importe),
    };
  });
  const imagenesVisor: ImagenVisor[] = filas
    .filter((fila) => fila.imagen)
    .map((fila) => ({ partidaId: fila.id, url: fila.imagen as string, titulo: fila.descripcion, subtitulo: fila.clave ?? '' }));

  const celdaSx = (theme: Theme) => ({
    py: 0.9,
    borderBottom: `1px solid ${theme.emphasys.content.border}`,
    fontSize: 13.5,
    color: theme.emphasys.content.foreground,
    fontVariantNumeric: 'tabular-nums',
  });
  const numeroSx = (theme: Theme) => ({ ...celdaSx(theme), pl: 3, textAlign: 'right' as const, whiteSpace: 'nowrap' as const });
  const notasSx = (theme: Theme) => ({ display: 'block', fontSize: 12, color: theme.emphasys.content.muted, whiteSpace: 'pre-wrap' as const, mt: 0.2 });

  return (
    <Box>
      {/* Escritorio: tabla */}
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: columnas, alignItems: 'stretch' }}>
        {titulos.map((titulo, index) => {
          const esProducto = titulo === 'Producto';
          return (
            <Typography
              key={titulo || 'imagen'}
              sx={(theme) => ({ ...encabezadoSx(theme), pb: 0.75, pl: index === 0 || esProducto ? 0 : 3, borderBottom: `1px solid ${theme.emphasys.content.border}`, textAlign: esProducto || index === 0 ? 'left' : 'right', whiteSpace: 'nowrap' })}
            >
              {titulo}
            </Typography>
          );
        })}
        {filas.map((fila) => (
          <React.Fragment key={fila.id}>
            {conImagenes ? (
              <Box sx={(theme) => ({ ...celdaSx(theme), pr: 1, py: 0.6 })}>
                {fila.imagen ? <BotonImagen titulo={fila.descripcion} onClick={() => setVisorId(fila.id)} /> : null}
              </Box>
            ) : null}
            <Box sx={(theme) => ({ ...celdaSx(theme), minWidth: 0 })}>
              {fila.clave ? (
                <Typography component="span" sx={(theme) => ({ fontSize: 12, fontWeight: 700, color: theme.emphasys.content.muted, mr: 1 })}>
                  {fila.clave}
                </Typography>
              ) : null}
              <Typography component="span" sx={{ fontSize: 13.5 }}>{fila.descripcion}</Typography>
              {fila.vinculada ? <MarcaVinculada /> : null}
              {fila.notas.map((nota, index) => <Typography key={index} component="span" sx={notasSx}>{nota}</Typography>)}
            </Box>
            <Box sx={numeroSx}>{fila.cantidad}</Box>
            <Box sx={numeroSx}>{fila.precio}</Box>
            {conDescuento ? (
              <>
                <Box sx={(theme) => ({ ...numeroSx(theme), color: fila.tieneDescuento ? theme.emphasys.content.foreground : theme.emphasys.content.muted })}>{fila.descuentoPct}</Box>
                <Box sx={(theme) => ({ ...numeroSx(theme), color: fila.tieneDescuento ? theme.emphasys.content.foreground : theme.emphasys.content.muted })}>{fila.descuentoMonto}</Box>
              </>
            ) : null}
            <Box sx={(theme) => ({ ...numeroSx(theme), fontWeight: 700 })}>{fila.importe}</Box>
          </React.Fragment>
        ))}
      </Box>

      {/* Móvil: partidas apiladas */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {filas.map((fila) => (
          <Box key={fila.id} sx={celdaSx}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{fila.descripcion}</Typography>
              {fila.imagen ? <BotonImagen titulo={fila.descripcion} onClick={() => setVisorId(fila.id)} /> : null}
            </Box>
            {fila.vinculada ? <MarcaVinculada /> : null}
            {fila.notas.map((nota, index) => <Typography key={index} sx={notasSx}>{nota}</Typography>)}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.3, gap: 1 }}>
              <Typography sx={(theme) => ({ fontSize: 12.5, color: theme.emphasys.content.muted })}>
                {fila.clave ? `${fila.clave} · ` : ''}{fila.cantidad} × {fila.precio}
              </Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{fila.importe}</Typography>
            </Box>
            {fila.tieneDescuento ? (
              <Typography sx={(theme) => ({ fontSize: 12.5, mt: 0.2, color: theme.emphasys.content.muted })}>
                Descuento {fila.descuentoPct ? `${fila.descuentoPct} · ` : ''}{fila.descuentoMonto}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>

      {/* Resumen: cuadra importes de partidas → descuento global → subtotal → impuestos → total */}
      <Box sx={{ ml: { xs: 0, md: 'auto' }, width: { xs: '100%', md: 340 }, pt: 1 }}>
        {descuentoGlobalMonto > 0 ? (
          <>
            <FilaResumen label="Suma de partidas" value={currency.format(sumaPartidas)} />
            <FilaResumen label={`Descuento global (${percent.format(descuentoGlobalPct)}%)`} value={`−${currency.format(descuentoGlobalMonto)}`} />
          </>
        ) : null}
        <FilaResumen label="Subtotal" value={currency.format(subtotal)} />
        {Math.abs(impuestos) >= 0.01 ? <FilaResumen label="Impuestos" value={currency.format(impuestos)} /> : null}
        <FilaResumen label="Total" value={currency.format(total)} fuerte />
      </Box>

      <VisorImagenes imagenes={imagenesVisor} inicialId={visorId} onClose={() => setVisorId(null)} />
    </Box>
  );
}
