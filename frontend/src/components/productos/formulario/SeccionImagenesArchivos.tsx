import * as React from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import StarIcon from '@mui/icons-material/Star';
import { buildAssetUrl } from '../../../services/empresasAssetsService';
import type { ProductoArchivo } from '../../../services/productosService';
import SeccionCard from './SeccionCard';

type Props = {
  disponible: boolean;
  descripcionProducto: string;
  archivos: ProductoArchivo[];
  archivosLoading: boolean;
  archivosError: string | null;
  onCerrarError: () => void;
  uploadingImagenes: boolean;
  archivoActionId: number | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onAgregarClick: () => void;
  onArchivosChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEliminar: (archivo: ProductoArchivo) => void;
  onMarcarPrincipal: (archivo: ProductoArchivo) => void;
};

const badgeInstante = (
  <Box
    component="span"
    sx={{
      fontSize: 10.5,
      fontWeight: 700,
      color: '#006261',
      backgroundColor: 'rgba(0,98,97,0.1)',
      borderRadius: 1,
      px: 0.75,
      py: 0.125,
    }}
  >
    Se guarda al instante
  </Box>
);

export default function SeccionImagenesArchivos({
  disponible,
  descripcionProducto,
  archivos,
  archivosLoading,
  archivosError,
  onCerrarError,
  uploadingImagenes,
  archivoActionId,
  inputRef,
  onAgregarClick,
  onArchivosChange,
  onEliminar,
  onMarcarPrincipal,
}: Props) {
  const imagenPrincipal = archivos.find((archivo) => archivo.principal) ?? archivos[0] ?? null;

  if (!disponible) {
    return (
      <SeccionCard id="archivos" titulo="Imágenes y archivos" badge={badgeInstante}>
        <Typography variant="body2" color="#6b7280">
          Estas secciones se activan en cuanto el producto tenga clave interna: guarda una vez y sigues en esta misma pantalla.
        </Typography>
      </SeccionCard>
    );
  }

  return (
    <SeccionCard
      id="archivos"
      titulo="Imágenes y archivos"
      badge={badgeInstante}
      subtitulo="Solo imágenes (JPG, PNG, WEBP) — máximo 5MB por archivo"
      accion={
        <>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onArchivosChange} />
          <Button
            size="small"
            variant="contained"
            startIcon={<PhotoLibraryOutlinedIcon fontSize="small" />}
            onClick={onAgregarClick}
            disabled={uploadingImagenes}
          >
            {uploadingImagenes ? 'Subiendo...' : 'Subir'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        {archivosError ? (
          <Alert severity="error" onClose={onCerrarError}>
            {archivosError}
          </Alert>
        ) : null}

        {archivosLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="#6b7280">Cargando imágenes...</Typography>
          </Stack>
        ) : archivos.length === 0 ? (
          <Stack spacing={0.5} alignItems="center" sx={{ py: 2 }}>
            <ImageOutlinedIcon sx={{ fontSize: 28, color: '#cbd5e1' }} />
            <Typography variant="body2" color="#6b7280">Aún no hay imágenes cargadas para este producto.</Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {archivos.map((archivo) => {
              const isPrincipal = archivo.principal;
              const isProcessing = archivoActionId === archivo.id;

              return (
                <Paper
                  key={archivo.id}
                  variant="outlined"
                  sx={{
                    width: 132,
                    borderRadius: 1.25,
                    p: 1,
                    borderColor: isPrincipal ? '#93c5fd' : '#e5e7eb',
                  }}
                >
                  <Stack spacing={0.75}>
                    <Box
                      component="img"
                      src={buildAssetUrl(archivo.archivo)}
                      alt={archivo.descripcion || descripcionProducto || 'Imagen del producto'}
                      sx={{
                        width: '100%',
                        height: 96,
                        objectFit: 'cover',
                        borderRadius: 1,
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                      }}
                    />
                    {isPrincipal && (
                      <Typography variant="caption" color="#006261" fontWeight={700} fontSize={10.5}>
                        Principal
                      </Typography>
                    )}
                    <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                      <Tooltip title={isPrincipal ? 'Imagen principal' : 'Marcar como principal'}>
                        <span>
                          <IconButton
                            size="small"
                            color={isPrincipal ? 'warning' : 'default'}
                            onClick={() => onMarcarPrincipal(archivo)}
                            disabled={isPrincipal || isProcessing}
                          >
                            {isPrincipal ? <StarIcon fontSize="small" /> : <StarBorderOutlinedIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Eliminar imagen">
                        <span>
                          <IconButton size="small" color="error" onClick={() => onEliminar(archivo)} disabled={isProcessing}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </SeccionCard>
  );
}
