import { useEffect, useMemo, useState } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, Typography } from '@mui/material';
import { EmptyState } from '../DocumentoDetalleContent';
import type { DocumentoDetalleResponse } from '../../../types/documentoDetalle';
import { fetchProductoArchivos, type ProductoArchivo } from '../../../services/productosService';
import { buildAssetUrl } from '../../../services/empresasAssetsService';

type Partida = DocumentoDetalleResponse['partidas'][number];

function urlImagenPersonalizada(partida: Partida): string | null {
  const ruta = partida.archivo_imagen_1?.trim();
  if (!ruta) return null;
  return buildAssetUrl(ruta);
}

function urlsDeProducto(archivos: ProductoArchivo[], archivoId: number | null | undefined): string[] {
  const ordenados = [...archivos].sort((a, b) => a.orden_visual - b.orden_visual || a.id - b.id);
  const vinculada = archivoId ? ordenados.find((archivo) => archivo.id === archivoId) : null;
  const resto = ordenados.filter((archivo) => archivo.id !== vinculada?.id);
  return [vinculada, ...resto]
    .filter((archivo): archivo is ProductoArchivo => Boolean(archivo?.archivo))
    .map((archivo) => buildAssetUrl(archivo.archivo))
    .filter(Boolean);
}

function useGaleriasPartida(partidas: Partida[]) {
  const [galerias, setGalerias] = useState<Record<number, string[]>>({});

  useEffect(() => {
    let vivo = true;
    const personalizadas = new Map<number, string>();
    partidas.forEach((partida) => {
      const url = urlImagenPersonalizada(partida);
      if (url) personalizadas.set(partida.id, url);
    });

    const inicial: Record<number, string[]> = {};
    personalizadas.forEach((url, partidaId) => { inicial[partidaId] = [url]; });
    setGalerias(inicial);

    const productoIds = [...new Set(partidas.map((partida) => partida.producto_id).filter((id): id is number => Boolean(id)))];
    if (productoIds.length === 0) return () => { vivo = false; };

    void Promise.all(productoIds.map(async (productoId) => {
      const archivos = await fetchProductoArchivos(productoId).catch(() => [] as ProductoArchivo[]);
      return [productoId, archivos] as const;
    })).then((grupos) => {
      if (!vivo) return;
      const porProducto = new Map(grupos);
      const siguiente: Record<number, string[]> = {};
      partidas.forEach((partida) => {
        const personalizada = personalizadas.get(partida.id) ?? null;
        const delProducto = partida.producto_id
          ? urlsDeProducto(porProducto.get(partida.producto_id) ?? [], personalizada ? null : partida.producto_archivo_id)
          : [];
        const preferida = personalizada
          ?? (partida.producto_archivo_id ? delProducto[0] ?? null : null);
        const extras = personalizada || partida.producto_archivo_id ? delProducto.filter((url) => url !== preferida) : [];
        const lista = [...new Set([preferida, ...extras].filter((url): url is string => Boolean(url)))];
        if (lista.length) siguiente[partida.id] = lista;
      });
      setGalerias(siguiente);
    });

    return () => { vivo = false; };
  }, [partidas]);

  return galerias;
}

function tituloPartida(partida: Partida): string {
  return partida.producto_descripcion || partida.descripcion_alterna || 'Partida';
}

export default function CotizacionPartidasTab({
  partidas,
}: {
  partidas: DocumentoDetalleResponse['partidas'];
  formatter: Intl.NumberFormat;
}) {
  const filas = useMemo(() => partidas ?? [], [partidas]);
  const galerias = useGaleriasPartida(filas);
  const [seleccionId, setSeleccionId] = useState<number | null>(filas[0]?.id ?? null);
  const [indiceImagen, setIndiceImagen] = useState(0);

  useEffect(() => {
    const primera = filas[0];
    if (!primera) {
      setSeleccionId(null);
      return;
    }
    setSeleccionId((actual) => (filas.some((partida) => partida.id === actual) ? actual : primera.id));
  }, [filas]);

  useEffect(() => {
    setIndiceImagen(0);
  }, [seleccionId]);

  const seleccion = filas.find((partida) => partida.id === seleccionId) ?? filas[0];
  if (!seleccion) return <EmptyState mensaje="Este documento no tiene partidas." />;
  const imagenes = galerias[seleccion.id] ?? [];
  const indice = imagenes.length ? Math.min(indiceImagen, imagenes.length - 1) : 0;
  const imagenActual = imagenes[indice] ?? null;
  const titulo = tituloPartida(seleccion);

  return (
    <Box
      sx={{
        height: { xs: 'auto', md: '100%' },
        minHeight: { md: 420 },
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Box
        role="listbox"
        aria-label="Partidas"
        sx={{
          flex: { xs: '0 0 auto', md: '0 0 40%' },
          width: { xs: '100%', md: '40%' },
          maxHeight: { xs: 280, md: '100%' },
          minHeight: 0,
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          bgcolor: '#fff',
        }}
      >
        {filas.map((partida) => {
          const activa = partida.id === seleccion.id;
          const nombre = tituloPartida(partida);
          const unidad = (partida as Partida & { unidad?: string | null }).unidad;
          return (
            <Box
              key={partida.id}
              component="button"
              type="button"
              role="option"
              aria-selected={activa}
              onClick={() => setSeleccionId(partida.id)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                px: 1.5,
                py: 1.25,
                border: 0,
                borderBottom: '1px solid #eef0f3',
                borderLeft: '3px solid',
                borderLeftColor: activa ? 'primary.main' : 'transparent',
                bgcolor: activa ? 'rgba(29, 47, 104, 0.06)' : 'transparent',
                cursor: 'pointer',
                color: 'inherit',
                '&:hover': { bgcolor: activa ? 'rgba(29, 47, 104, 0.08)' : '#f8fafc' },
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: 'text.secondary' }} noWrap>
                {partida.producto_clave || 'Sin clave'}
              </Typography>
              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: 14,
                  fontWeight: 650,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {nombre}
              </Typography>
              <Typography sx={{ mt: 0.4, fontSize: 12.5, color: 'text.secondary' }}>
                Cantidad {Number(partida.cantidad || 0)}{unidad ? ` ${unidad}` : ''}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          flex: { xs: '1 1 auto', md: '1 1 60%' },
          width: { xs: '100%', md: '60%' },
          minWidth: 0,
          minHeight: { xs: 360, md: 0 },
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          bgcolor: '#f7f8fa',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, position: 'relative' }}>
          {imagenActual ? (
            <Box
              component="img"
              src={imagenActual}
              alt={titulo}
              sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>Esta partida no tiene imagen.</Typography>
          )}
        </Box>
        {imagenes.length > 1 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.75, borderTop: '1px solid #e5e7eb', bgcolor: '#fff' }}>
            <IconButton
              size="small"
              aria-label="Imagen anterior"
              disabled={indice <= 0}
              onClick={() => setIndiceImagen((actual) => Math.max(0, actual - 1))}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', minWidth: 48, textAlign: 'center' }}>
              {indice + 1} / {imagenes.length}
            </Typography>
            <IconButton
              size="small"
              aria-label="Imagen siguiente"
              disabled={indice >= imagenes.length - 1}
              onClick={() => setIndiceImagen((actual) => Math.min(imagenes.length - 1, actual + 1))}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
