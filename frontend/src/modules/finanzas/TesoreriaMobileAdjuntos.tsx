import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { MAIN_NAV_TYPE } from '../../theme/tokens';
import {
  abrirAdjuntoOperacion,
  descargarAdjuntoOperacion,
  eliminarAdjuntoOperacion,
  fetchAdjuntosOperacion,
  subirAdjuntoOperacion,
  type FinanzasAdjunto,
} from '../../services/finanzasService';

const ACEPTADOS = 'application/pdf,image/png,image/jpeg,image/webp';

type Props = {
  operacionId: number | null;
  pendientes: File[];
  onPendientes: (archivos: File[]) => void;
  onConteo: (cantidad: number) => void;
  onMutacion: () => void;
  onBack: () => void;
};

export function TesoreriaMobileAdjuntos({
  operacionId,
  pendientes,
  onPendientes,
  onConteo,
  onMutacion,
  onBack,
}: Props) {
  const tokens = useTheme().emphasys;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onConteoRef = useRef(onConteo);
  onConteoRef.current = onConteo;
  const [adjuntos, setAdjuntos] = useState<FinanzasAdjunto[]>([]);
  const [cargando, setCargando] = useState(Boolean(operacionId));
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [adjuntoPorConfirmar, setAdjuntoPorConfirmar] = useState<FinanzasAdjunto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!operacionId) {
      setAdjuntos([]);
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    fetchAdjuntosOperacion(operacionId)
      .then((lista) => {
        if (!vivo) return;
        setAdjuntos(lista);
        onConteoRef.current(lista.length);
      })
      .catch((err: unknown) => {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudieron cargar los adjuntos');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [operacionId]);

  const agregar = async (lista: FileList | null) => {
    const archivos = Array.from(lista || []);
    if (!archivos.length) return;
    if (!operacionId) {
      onPendientes([...pendientes, ...archivos]);
      return;
    }
    setSubiendo(true);
    setError(null);
    try {
      for (const archivo of archivos) await subirAdjuntoOperacion(operacionId, archivo);
      const actualizados = await fetchAdjuntosOperacion(operacionId);
      setAdjuntos(actualizados);
      onConteoRef.current(actualizados.length);
      onMutacion();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el archivo');
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = async (adjunto: FinanzasAdjunto) => {
    if (!operacionId || eliminandoId) return;
    setAdjuntoPorConfirmar(null);
    setEliminandoId(adjunto.id);
    setError(null);
    try {
      await eliminarAdjuntoOperacion(operacionId, adjunto.id);
      const actualizados = await fetchAdjuntosOperacion(operacionId);
      setAdjuntos(actualizados);
      onConteoRef.current(actualizados.length);
      onMutacion();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el adjunto');
    } finally {
      setEliminandoId(null);
    }
  };

  const abrirLocal = (archivo: File) => {
    const url = URL.createObjectURL(archivo);
    const tab = window.open(url, '_blank');
    if (!tab) {
      URL.revokeObjectURL(url);
      setError('El navegador bloqueó la pestaña nueva');
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const descargarLocal = (archivo: File) => {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = archivo.name;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: MAIN_NAV_TYPE.fontFamily, bgcolor: tokens.content.background }}>
      <Box sx={{ px: 0.5, minHeight: 52, display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        <IconButton aria-label="Volver" onClick={onBack} sx={{ width: 40, height: 40, color: tokens.content.foreground }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ flex: 1, fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em', color: tokens.content.foreground }}>
          Adjuntos
        </Typography>
      </Box>

      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        accept={ACEPTADOS}
        onChange={(event) => {
          void agregar(event.target.files);
          event.target.value = '';
        }}
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Box
          component="button"
          type="button"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
          sx={filaSx(tokens)}
        >
          <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 650, color: tokens.content.foreground }}>
              {subiendo ? 'Agregando…' : 'Agregar archivo'}
            </Typography>
            <Typography sx={{ mt: 0.15, fontSize: 12.5, color: tokens.content.muted }}>
              PDF o imagen
            </Typography>
          </Box>
          {subiendo ? <CircularProgress size={18} sx={{ color: tokens.content.secondary }} /> : null}
        </Box>

        {error ? (
          <Typography role="alert" sx={{ px: 2, py: 1, fontSize: 13, color: tokens.action.destructive }}>
            {error}
          </Typography>
        ) : null}

        {cargando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={22} sx={{ color: tokens.content.secondary }} />
          </Box>
        ) : (
          <>
            {adjuntos.map((adjunto) => (
              <FilaArchivo
                key={adjunto.id}
                nombre={adjunto.nombre_original}
                ocupado={eliminandoId === adjunto.id}
                onAbrir={() => {
                  if (!operacionId) return;
                  void abrirAdjuntoOperacion(operacionId, adjunto.id).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo');
                  });
                }}
                onDescargar={() => {
                  if (!operacionId) return;
                  void descargarAdjuntoOperacion(operacionId, adjunto.id).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'No se pudo descargar el archivo');
                  });
                }}
                onQuitar={() => setAdjuntoPorConfirmar(adjunto)}
              />
            ))}
            {pendientes.map((archivo, indice) => (
              <FilaArchivo
                key={`${archivo.name}-${archivo.size}-${indice}`}
                nombre={archivo.name}
                ocupado={false}
                onAbrir={() => abrirLocal(archivo)}
                onDescargar={() => descargarLocal(archivo)}
                onQuitar={() => onPendientes(pendientes.filter((_, actual) => actual !== indice))}
              />
            ))}
            {!adjuntos.length && !pendientes.length ? (
              <Typography sx={{ px: 2, py: 3, fontSize: 14, color: tokens.content.muted }}>
                Todavía no hay archivos.
              </Typography>
            ) : null}
          </>
        )}
      </Box>
      <Dialog
        open={Boolean(adjuntoPorConfirmar)}
        onClose={() => {
          if (!eliminandoId) setAdjuntoPorConfirmar(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, color: tokens.content.foreground }}>Eliminar adjunto</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Typography sx={{ fontSize: 14, color: tokens.content.secondary }}>
            {adjuntoPorConfirmar ? `Se quitará «${adjuntoPorConfirmar.nombre_original}».` : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1.5 }}>
          <Button
            onClick={() => setAdjuntoPorConfirmar(null)}
            disabled={Boolean(eliminandoId)}
            sx={{ textTransform: 'none', color: tokens.content.foreground }}
          >
            No eliminar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (adjuntoPorConfirmar) void quitar(adjuntoPorConfirmar);
            }}
            disabled={!adjuntoPorConfirmar || Boolean(eliminandoId)}
            sx={{
              textTransform: 'none',
              borderRadius: 999,
              bgcolor: tokens.action.destructive,
              color: tokens.action.primaryForeground,
              '&:hover': { bgcolor: tokens.action.destructive },
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function FilaArchivo({
  nombre,
  ocupado,
  onAbrir,
  onDescargar,
  onQuitar,
}: {
  nombre: string;
  ocupado: boolean;
  onAbrir: () => void;
  onDescargar: () => void;
  onQuitar: () => void;
}) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 2, py: 0.85, borderBottom: `1px solid ${tokens.content.border}` }}>
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: tokens.content.foreground }}>
        {nombre}
      </Typography>
      <IconButton aria-label={`Abrir ${nombre}`} onClick={onAbrir} sx={iconoSx(tokens)}>
        <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton aria-label={`Descargar ${nombre}`} onClick={onDescargar} sx={iconoSx(tokens)}>
        <DownloadOutlinedIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton aria-label={`Quitar ${nombre}`} disabled={ocupado} onClick={onQuitar} sx={{ ...iconoSx(tokens), color: tokens.action.destructive }}>
        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
}

function filaSx(tokens: { content: { border: string; hover: string } }) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 2,
    py: 1.2,
    border: 0,
    borderBottom: `1px solid ${tokens.content.border}`,
    bgcolor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    '&:active': { bgcolor: tokens.content.hover },
    '&:disabled': { opacity: 0.6 },
  };
}

function iconoSx(tokens: { content: { secondary: string; hover: string } }) {
  return {
    width: 36,
    height: 36,
    color: tokens.content.secondary,
    '&:hover': { bgcolor: tokens.content.hover },
  };
}
