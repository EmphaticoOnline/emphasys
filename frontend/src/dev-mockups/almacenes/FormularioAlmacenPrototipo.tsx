import { useState, type ReactNode } from 'react';
import { Autocomplete, Box, Checkbox, TextField, Typography } from '@mui/material';
import { TIPOS_ALMACEN, type FormularioAlmacen } from './datos';
import { HojaPrototipo } from './HojaPrototipo';

const campoSx = {
  '& .MuiInputBase-root': { fontSize: 14 },
  '& .MuiInputBase-input': { fontSize: 14, py: '4px', px: 0 },
  '& .MuiInput-underline:before': { borderBottomColor: 'currentColor' },
  '& .MuiInput-underline:after': { borderBottomWidth: 1 },
};

export function FormularioAlmacenPrototipo({
  almacen,
  noEncontrado,
  clavesOcupadas,
  inicial,
  onCancelar,
  onGuardar,
}: {
  almacen: { clave: string; nombre: string } | null;
  noEncontrado: boolean;
  clavesOcupadas: string[];
  inicial: FormularioAlmacen;
  onCancelar: () => void;
  onGuardar: (form: FormularioAlmacen) => void;
}) {
  const [form, setForm] = useState<FormularioAlmacen>(inicial);
  const [intentado, setIntentado] = useState(false);

  const clave = form.clave.trim();
  const nombre = form.nombre.trim();
  const faltaClave = !clave;
  const faltaNombre = !nombre;
  const claveRepetida = !faltaClave && clavesOcupadas.includes(clave.toLowerCase());

  const guardar = () => {
    setIntentado(true);
    if (faltaClave || faltaNombre || claveRepetida || noEncontrado) return;
    onGuardar({ ...form, clave, nombre, tipo: form.tipo.trim() || 'normal' });
  };

  const set = <K extends keyof FormularioAlmacen>(key: K, value: FormularioAlmacen[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <HojaPrototipo>
      <Box
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancelar();
            return;
          }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            guardar();
          }
        }}
        sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <Box
          sx={(theme) => ({
            bgcolor: theme.emphasys.action.wash,
            borderBottom: `1px solid ${theme.emphasys.content.border}`,
            px: { xs: 2, md: 2.75 },
            pt: 1.75,
            pb: 1.6,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 3,
            flexWrap: 'wrap',
          })}
        >
          {noEncontrado ? (
            <Typography sx={(theme) => ({ fontSize: 13, color: theme.emphasys.content.secondary, py: 1 })}>
              No se encontró el almacén solicitado.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 2.5, md: 3.5 }, flexWrap: 'wrap' }}>
              <Campo etiqueta="Clave" ancho={148} error={intentado && (faltaClave || claveRepetida) ? (faltaClave ? 'La clave es obligatoria' : 'Esta clave ya existe') : ''}>
                <TextField
                  variant="standard"
                  autoFocus={!almacen}
                  value={form.clave}
                  onChange={(event) => set('clave', event.target.value.slice(0, 30))}
                  placeholder=""
                  sx={(theme) => ({
                    ...campoMeta(theme.emphasys.content.foreground, theme.emphasys.content.border, theme.emphasys.content.muted),
                    '& .MuiInputBase-input': { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' },
                  })}
                />
              </Campo>
              <Campo etiqueta="Nombre" ancho={320} error={intentado && faltaNombre ? 'El nombre es obligatorio' : ''}>
                <TextField
                  variant="standard"
                  fullWidth
                  value={form.nombre}
                  onChange={(event) => set('nombre', event.target.value.slice(0, 120))}
                  placeholder=""
                  sx={(theme) => campoMeta(theme.emphasys.content.foreground, theme.emphasys.content.border, theme.emphasys.content.muted)}
                />
              </Campo>
              <Campo etiqueta="Tipo" ancho={180}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={[...TIPOS_ALMACEN]}
                  value={form.tipo}
                  inputValue={form.tipo}
                  onInputChange={(_event, value) => set('tipo', value.slice(0, 30))}
                  onChange={(_event, value) => set('tipo', value ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...(params as object)}
                      variant="standard"
                      placeholder=""
                      sx={(theme) => campoMeta(theme.emphasys.content.foreground, theme.emphasys.content.border, theme.emphasys.content.muted)}
                    />
                  )}
                />
              </Campo>
              <Box
                component="label"
                sx={(theme) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.4,
                  height: 32,
                  mb: '1px',
                  cursor: 'pointer',
                  color: theme.emphasys.content.foreground,
                })}
              >
                <Checkbox
                  size="small"
                  checked={form.activo}
                  onChange={(event) => set('activo', event.target.checked)}
                  sx={(theme) => ({ p: 0.4, color: theme.emphasys.content.muted, '&.Mui-checked': { color: theme.emphasys.content.foreground } })}
                />
                <Typography sx={{ fontSize: 13 }}>Activo</Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, pb: 0.15 }}>
            <Boton onClick={onCancelar}>Cancelar</Boton>
            <Boton primario disabled={noEncontrado} onClick={guardar}>Guardar</Boton>
          </Box>
        </Box>

        <Box
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 2.25,
            height: 40,
            mt: 'auto',
            px: 2.75,
            borderTop: `1px solid ${theme.emphasys.content.border}`,
            bgcolor: theme.emphasys.action.wash,
            color: theme.emphasys.content.muted,
            fontSize: 11.5,
          })}
        >
          <Atajo teclas={['Esc']} texto="cancela" />
          <Atajo teclas={['⌘/Ctrl', 'Enter']} texto="guarda" />
          {almacen ? (
            <Box component="span" sx={(theme) => ({ ml: 'auto', color: theme.emphasys.content.secondary })}>
              {almacen.clave} · {almacen.nombre}
            </Box>
          ) : null}
        </Box>
      </Box>
    </HojaPrototipo>
  );
}

function campoMeta(foreground: string, border: string, muted: string) {
  return {
    ...campoSx,
    '& .MuiInputBase-root': { fontSize: 14, color: foreground },
    '& .MuiInput-underline:before': { borderBottomColor: border },
    '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: muted },
    '& .MuiInput-underline:after': { borderBottomColor: foreground, borderBottomWidth: 1 },
  };
}

function Campo({ etiqueta, ancho, error, children }: { etiqueta: string; ancho: number; error?: string; children: ReactNode }) {
  return (
    <Box sx={{ width: ancho, maxWidth: '100%', minWidth: 0 }}>
      <Typography
        sx={(theme) => ({
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: error ? theme.emphasys.action.destructive : theme.emphasys.content.muted,
          mb: 0.5,
        })}
      >
        {etiqueta}
      </Typography>
      {children}
      <Typography sx={(theme) => ({ minHeight: 16, mt: 0.35, fontSize: 11, lineHeight: 1.2, color: theme.emphasys.action.destructive })}>
        {error || ''}
      </Typography>
    </Box>
  );
}

function Boton({ primario, disabled, onClick, children }: { primario?: boolean; disabled?: boolean; onClick: () => void; children: string }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      sx={(theme) => ({
        height: 34,
        px: 1.75,
        borderRadius: '6px',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        border: `1px solid ${primario ? theme.emphasys.action.primary : theme.emphasys.content.border}`,
        bgcolor: primario ? theme.emphasys.action.primary : theme.emphasys.documentNav.selectedBackground,
        color: primario ? theme.emphasys.action.primaryForeground : theme.emphasys.content.foreground,
        '&:hover': { bgcolor: disabled ? undefined : primario ? theme.emphasys.action.primaryHover : theme.emphasys.content.hover },
        '&:disabled': {
          bgcolor: theme.emphasys.action.disabled,
          borderColor: theme.emphasys.action.disabled,
          color: theme.emphasys.action.primaryForeground,
        },
      })}
    >
      {children}
    </Box>
  );
}

function Atajo({ teclas, texto }: { teclas: string[]; texto: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
      {teclas.map((tecla) => (
        <Box
          key={tecla}
          component="span"
          sx={(theme) => ({
            px: 0.6,
            py: '1px',
            borderRadius: '4px',
            border: `1px solid ${theme.emphasys.content.border}`,
            bgcolor: theme.emphasys.documentNav.selectedBackground,
            color: theme.emphasys.content.secondary,
            fontSize: 10.5,
          })}
        >
          {tecla}
        </Box>
      ))}
      {texto}
    </Box>
  );
}
