import { Box } from '@mui/material';

type Modo = 'lista' | 'formulario';

/** Barra de revisión del prototipo. No forma parte de la pantalla de Almacenes. */
export function TiraPrototipo({ modo, onLista, onFormulario }: { modo: Modo; onLista: () => void; onFormulario: () => void }) {
  return (
    <Box
      sx={(theme) => ({
        height: 32,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 1.75,
        bgcolor: theme.emphasys.frame.background,
        color: theme.emphasys.frame.muted,
        fontSize: 12,
      })}
    >
      <Box component="span" sx={(theme) => ({ color: theme.emphasys.frame.foreground, fontWeight: 650, letterSpacing: '0.04em' })}>
        Prototipo
      </Box>
      <Box component="span" sx={{ opacity: 0.7 }}>Sin conexión · datos simulados</Box>
      <Box sx={{ flex: 1 }} />
      <Enlace activo={modo === 'lista'} onClick={onLista}>Listado</Enlace>
      <Enlace activo={modo === 'formulario'} onClick={onFormulario}>Formulario</Enlace>
    </Box>
  );
}

function Enlace({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: string }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={(theme) => ({
        border: 0,
        background: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        fontWeight: activo ? 700 : 500,
        color: activo ? theme.emphasys.frame.foreground : theme.emphasys.frame.muted,
        borderBottom: `1px solid ${activo ? theme.emphasys.frame.accent : 'transparent'}`,
        pb: '1px',
        '&:hover': { color: theme.emphasys.frame.foreground },
      })}
    >
      {children}
    </Box>
  );
}
