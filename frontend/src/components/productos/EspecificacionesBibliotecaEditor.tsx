import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, Button, ButtonBase, IconButton, InputBase, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { actualizarEspecificacionBiblioteca, cambiarBajaEspecificacionBiblioteca, crearEspecificacionBiblioteca, fetchEspecificacionesBiblioteca, reordenarEspecificacionesBiblioteca, type EspecificacionBiblioteca, type TipoEspecificacionBiblioteca } from '../../services/productosService';

const TIPOS: TipoEspecificacionBiblioteca[] = ['medida', 'material', 'accesorio', 'garantia', 'entrega', 'condicion', 'otro'];
const ETIQUETA_TIPO: Record<TipoEspecificacionBiblioteca, string> = {
  medida: 'Medida',
  material: 'Material',
  accesorio: 'Accesorio',
  garantia: 'Garantía',
  entrega: 'Entrega',
  condicion: 'Condición',
  otro: 'Otro',
};
const MAX_CONTENIDO = 1000;
/** El backend rechaza la consulta con este texto cuando la empresa no tiene la biblioteca habilitada; se presenta como aviso, no como error. */
const NO_HABILITADA = /no est[aá] habilitada/i;

type Props = {
  productoId?: number | undefined;
  alcance: 'global' | 'producto';
  onError?: (message: string) => void;
  /** Opcional: notifica al padre cuántas filas hay tras cada carga (para badges/contadores externos). No cambia el comportamiento interno del editor. */
  onCountChange?: (count: number) => void;
  /** Título del encabezado; `null` lo oculta cuando el contenedor ya muestra uno. */
  titulo?: string | null;
  descripcion?: string;
};

const mutedLabelSx = (theme: Theme) => ({ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: theme.emphasys.content.muted });
const primaryButtonSx = (theme: Theme) => ({
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 13,
  borderRadius: '10px',
  boxShadow: 'none',
  px: 1.5,
  whiteSpace: 'nowrap',
  bgcolor: theme.emphasys.action.primary,
  color: theme.emphasys.action.primaryForeground,
  '&:hover': { bgcolor: theme.emphasys.action.primaryHover, boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: theme.emphasys.action.disabled, color: theme.emphasys.action.primaryForeground },
});
const pillSx = (activo: boolean) => (theme: Theme) => ({
  height: 28,
  px: 1.25,
  gap: 0.5,
  flexShrink: 0,
  borderRadius: 999,
  fontSize: 12,
  fontWeight: activo ? 700 : 500,
  border: `1px solid ${activo ? theme.emphasys.action.primary : theme.emphasys.content.border}`,
  bgcolor: activo ? theme.emphasys.action.primary : theme.emphasys.content.card,
  color: activo ? theme.emphasys.action.primaryForeground : theme.emphasys.content.secondary,
  '&:hover': { bgcolor: activo ? theme.emphasys.action.primaryHover : theme.emphasys.content.hover },
});
const togglePillSx = (activo: boolean) => (theme: Theme) => ({
  height: 30,
  px: 1.25,
  gap: 0.5,
  flexShrink: 0,
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  border: `1px solid ${theme.emphasys.content.border}`,
  bgcolor: activo ? theme.emphasys.action.wash : 'transparent',
  color: activo ? theme.emphasys.content.foreground : theme.emphasys.content.muted,
  '&:hover': { bgcolor: theme.emphasys.content.hover, color: theme.emphasys.content.foreground },
});
const accionSx = (color: (theme: Theme) => string) => (theme: Theme) => ({ flexShrink: 0, width: 28, height: 28, borderRadius: '10px', color: color(theme), '&:hover': { bgcolor: theme.emphasys.content.hover } });

export default function EspecificacionesBibliotecaEditor({ productoId, alcance, onError, onCountChange, titulo = 'Especificaciones', descripcion }: Props) {
  const [rows, setRows] = useState<EspecificacionBiblioteca[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<EspecificacionBiblioteca | null>(null);
  const [creando, setCreando] = useState(false);
  const [contenido, setContenido] = useState('');
  const [tipo, setTipo] = useState<TipoEspecificacionBiblioteca>('otro');
  const [preferida, setPreferida] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [avisoNoHabilitada, setAvisoNoHabilitada] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const canLoad = alcance === 'global' || Boolean(productoId);
  const load = async () => {
    if (!canLoad) return;
    try {
      const data = await fetchEspecificacionesBiblioteca(alcance === 'global' ? 'global' : productoId!, showInactive);
      setRows(data);
      setAvisoNoHabilitada(null);
      onCountChange?.(data.filter((r) => !r.fecha_baja).length);
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudieron cargar las especificaciones';
      if (NO_HABILITADA.test(message)) setAvisoNoHabilitada(message.replace(/^VALIDATION_ERROR:\s*/, ''));
      else onError?.(message);
    }
    finally { setCargado(true); }
  };
  useEffect(() => { void load(); }, [productoId, alcance, showInactive]);
  const filtered = useMemo(() => {
    const q = search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return rows.filter((r) => `${r.contenido} ${r.tipo} ${r.alcance}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
  }, [rows, search]);
  const grupos = useMemo(() => {
    const porTipo = new Map<TipoEspecificacionBiblioteca, EspecificacionBiblioteca[]>();
    filtered.forEach((row) => {
      const lista = porTipo.get(row.tipo) ?? [];
      lista.push(row);
      porTipo.set(row.tipo, lista);
    });
    return TIPOS.filter((tipoItem) => porTipo.has(tipoItem)).map((tipoItem) => ({
      tipo: tipoItem,
      rows: porTipo.get(tipoItem) ?? [],
    }));
  }, [filtered]);
  const resumen = useMemo(() => {
    const activas = rows.filter((r) => !r.fecha_baja);
    const bajas = rows.length - activas.length;
    return [`${activas.length} ${activas.length === 1 ? 'activa' : 'activas'}`, `${activas.filter((r) => r.es_preferida).length} preferidas`, ...(showInactive && bajas ? [`${bajas} de baja`] : [])].join(' · ');
  }, [rows, showInactive]);
  const reset = () => { setEditing(null); setCreando(false); setContenido(''); setTipo('otro'); setPreferida(false); };
  const focusForm = () => requestAnimationFrame(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    inputRef.current?.focus();
  });
  const startCreating = () => {
    reset();
    setCreando(true);
    focusForm();
  };
  const startEditing = (row: EspecificacionBiblioteca) => {
    setCreando(false);
    setEditing(row);
    setContenido(row.contenido);
    setTipo(row.tipo);
    setPreferida(row.es_preferida);
    focusForm();
  };
  const save = async () => {
    try {
      setSaving(true);
      const payload = { alcance, producto_id: alcance === 'producto' ? productoId : null, contenido, tipo, es_preferida: preferida, orden: editing?.orden ?? rows.length };
      if (editing) await actualizarEspecificacionBiblioteca(editing.id, payload); else await crearEspecificacionBiblioteca(payload);
      reset(); await load();
    } catch (e) { onError?.(e instanceof Error ? e.message : 'No se pudo guardar'); } finally { setSaving(false); }
  };
  const drop = async (targetId: number) => {
    if (!dragId || dragId === targetId || search) return;
    const next = [...rows]; const from = next.findIndex((r) => r.id === dragId); const to = next.findIndex((r) => r.id === targetId);
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setRows(next); setDragId(null);
    try { await reordenarEspecificacionesBiblioteca(next.map((r) => r.id)); } catch (e) { onError?.(e instanceof Error ? e.message : 'No se pudo reordenar'); await load(); }
  };
  const onFormKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); reset(); }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && contenido.trim() && !saving) { event.preventDefault(); void save(); }
  };

  if (!canLoad) return <Typography sx={{ fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>Guarda primero el producto para administrar su biblioteca reutilizable.</Typography>;

  const textoDescripcion = descripcion ?? (alcance === 'global'
    ? 'Especificaciones reutilizables para todos los productos de la empresa.'
    : 'Administra la biblioteca de especificaciones asociadas a este producto.');
  const sinRegistros = cargado && rows.length === 0 && !showInactive;
  const mostrarControles = !avisoNoHabilitada && !sinRegistros;

  const formulario = (
    <Box
      ref={formRef}
      onKeyDown={onFormKeyDown}
      sx={(theme) => ({ p: 1.25, borderRadius: '10px', border: `1px solid ${theme.emphasys.action.tint}`, backgroundColor: theme.emphasys.content.card })}
    >
      <Typography sx={(theme) => ({ ...mutedLabelSx(theme), letterSpacing: '0.06em', mb: 0.75 })}>{editing ? 'Editando especificación' : 'Nueva especificación'}</Typography>
      <TextField
        size="small"
        fullWidth
        multiline
        minRows={2}
        maxRows={5}
        inputRef={inputRef}
        placeholder="Ej. Estructura de acero calibre 16 con pintura electrostática"
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        inputProps={{ maxLength: MAX_CONTENIDO }}
        sx={(theme) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            fontSize: 13,
            color: theme.emphasys.content.foreground,
            backgroundColor: theme.emphasys.content.elevated,
            '& fieldset': { borderColor: theme.emphasys.content.border },
            '&.Mui-focused fieldset': { borderColor: theme.emphasys.content.secondary, borderWidth: 1 },
          },
        })}
      />
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        <Typography sx={{ fontSize: 12, color: (theme) => theme.emphasys.content.muted, mr: 0.25 }}>Tipo</Typography>
        {TIPOS.map((t) => (
          <ButtonBase key={t} onClick={() => setTipo(t)} aria-pressed={tipo === t} sx={pillSx(tipo === t)}>{ETIQUETA_TIPO[t]}</ButtonBase>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
        <ButtonBase onClick={() => setPreferida((v) => !v)} aria-pressed={preferida} sx={togglePillSx(preferida)}>
          {preferida ? <StarIcon sx={{ fontSize: 15 }} /> : <StarBorderIcon sx={{ fontSize: 15 }} />}
          {preferida ? 'Preferida' : 'Marcar como preferida'}
        </ButtonBase>
        <Typography sx={{ flex: 1, minWidth: 120, textAlign: 'right', fontSize: 11, color: (theme) => theme.emphasys.content.muted }}>
          {contenido.length}/{MAX_CONTENIDO} · Ctrl+Enter guarda · Esc cancela
        </Typography>
        <Button onClick={reset} sx={(theme) => ({ textTransform: 'none', fontWeight: 700, fontSize: 13, borderRadius: '10px', color: theme.emphasys.content.foreground })}>Cancelar</Button>
        <Button variant="contained" disabled={saving || !contenido.trim()} onClick={() => void save()} sx={primaryButtonSx}>{editing ? 'Guardar' : 'Agregar'}</Button>
      </Stack>
    </Box>
  );

  return <Stack spacing={1.25}>
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
          {titulo ? <Typography sx={(theme) => ({ fontSize: 18, fontWeight: 650, lineHeight: 1.25, fontFamily: theme.typography.figure.fontFamily, color: theme.emphasys.content.foreground })}>{titulo}</Typography> : null}
          {mostrarControles && cargado ? <Typography sx={{ fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>{resumen}</Typography> : null}
        </Stack>
        <Typography sx={{ mt: 0.25, fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>{textoDescripcion}</Typography>
      </Box>
      {mostrarControles ? <Button variant="contained" startIcon={<AddIcon />} onClick={startCreating} sx={primaryButtonSx}>Nueva especificación</Button> : null}
    </Stack>

    {avisoNoHabilitada ? (
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={(theme) => ({ p: 1.25, borderRadius: '10px', border: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.content.elevated })}>
        <InfoOutlinedIcon sx={{ fontSize: 18, mt: 0.1, color: (theme) => theme.emphasys.content.muted }} />
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: (theme) => theme.emphasys.content.foreground }}>{avisoNoHabilitada}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>Cuando se habilite en la configuración de la empresa podrás administrar aquí las especificaciones reutilizables.</Typography>
        </Box>
      </Stack>
    ) : null}

    {mostrarControles ? (
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={(theme) => ({ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, height: 32, px: 1.25, borderRadius: '10px', border: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.content.card, '&:focus-within': { borderColor: theme.emphasys.content.secondary } })}>
          <SearchIcon sx={{ fontSize: 17, color: (theme) => theme.emphasys.content.muted }} />
          <InputBase placeholder="Buscar por texto o tipo" value={search} onChange={(e) => setSearch(e.target.value)} sx={(theme) => ({ flex: 1, fontSize: 13, color: theme.emphasys.content.foreground })} inputProps={{ 'aria-label': 'Buscar especificaciones' }} />
          {search ? <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setSearch('')} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton> : null}
        </Box>
        <ButtonBase onClick={() => setShowInactive((v) => !v)} aria-pressed={showInactive} sx={togglePillSx(showInactive)}>
          <ArchiveOutlinedIcon sx={{ fontSize: 15 }} />
          Mostrar bajas
        </ButtonBase>
      </Stack>
    ) : null}

    {creando ? formulario : null}

    {avisoNoHabilitada || !cargado ? null : sinRegistros ? (
      creando ? null : (
        <Box sx={(theme) => ({ px: 2, py: 3.5, textAlign: 'center', borderRadius: '10px', border: `1px dashed ${theme.emphasys.action.tint}`, backgroundColor: theme.emphasys.content.elevated })}>
          <ListAltOutlinedIcon sx={{ fontSize: 26, color: (theme) => theme.emphasys.content.muted }} />
          <Typography sx={(theme) => ({ mt: 0.5, fontSize: 16, fontWeight: 650, fontFamily: theme.typography.figure.fontFamily, color: theme.emphasys.content.foreground })}>Agrega la primera especificación</Typography>
          <Typography sx={{ mt: 0.5, mx: 'auto', maxWidth: 380, fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>
            Medidas, materiales, garantía o condiciones que podrás reutilizar al cotizar{alcance === 'global' ? ' cualquier producto' : ' este producto'}.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={startCreating} sx={primaryButtonSx}>Nueva especificación</Button>
            <Button onClick={() => setShowInactive(true)} sx={(theme) => ({ textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: '10px', color: theme.emphasys.content.muted })}>Ver bajas</Button>
          </Stack>
        </Box>
      )
    ) : grupos.length === 0 ? (
      <Box sx={(theme) => ({ p: 2, textAlign: 'center', borderRadius: '10px', border: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.content.card })}>
        <Typography sx={{ fontSize: 12, color: (theme) => theme.emphasys.content.muted }}>
          {search ? <>Sin coincidencias para “{search}”. <ButtonBase onClick={() => setSearch('')} sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.action.info, verticalAlign: 'baseline' })}>Limpiar búsqueda</ButtonBase></> : 'No hay especificaciones para mostrar.'}
        </Typography>
      </Box>
    ) : (
      <>
        {search ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: (theme) => theme.emphasys.content.muted }}>
            <InfoOutlinedIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 11 }}>El orden manual se desactiva mientras hay una búsqueda.</Typography>
          </Stack>
        ) : null}
        <Box sx={(theme) => ({ overflow: 'hidden', borderRadius: '10px', border: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.content.card })}>
          {grupos.map((grupo, grupoIndex) => (
            <Box key={grupo.tipo}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={(theme) => ({ px: 1.25, py: 0.6, backgroundColor: theme.emphasys.content.background, borderTop: grupoIndex > 0 ? `1px solid ${theme.emphasys.content.border}` : 0, borderBottom: `1px solid ${theme.emphasys.content.border}` })}>
                <Typography sx={mutedLabelSx}>{ETIQUETA_TIPO[grupo.tipo]}</Typography>
                <Typography sx={{ fontSize: 11, color: (theme) => theme.emphasys.content.muted }}>· {grupo.rows.filter((r) => !r.fecha_baja).length}</Typography>
              </Stack>
              {grupo.rows.map((row, index) => {
                const separador = (theme: Theme) => (index < grupo.rows.length - 1 ? `1px solid ${theme.emphasys.content.border}` : 0);
                if (editing?.id === row.id) {
                  return <Box key={row.id} sx={(theme) => ({ p: 0.75, borderBottom: separador(theme), backgroundColor: theme.emphasys.content.elevated })}>{formulario}</Box>;
                }
                const arrastrable = !search && !row.fecha_baja;
                return <Box
                  key={row.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void drop(row.id)}
                  sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    minHeight: 36,
                    pl: 0.5,
                    pr: 0.75,
                    py: 0.4,
                    borderBottom: separador(theme),
                    '& .esp-hover': { opacity: 0, transition: 'opacity 120ms ease' },
                    '&:hover, &:focus-within': { bgcolor: theme.emphasys.content.elevated, '& .esp-hover': { opacity: 1 } },
                    '@media (hover: none)': { '& .esp-hover': { opacity: 1 } },
                  })}
                >
                  <Box className={arrastrable ? 'esp-hover' : undefined} draggable={arrastrable} onDragStart={() => setDragId(row.id)} sx={{ display: 'flex', flexShrink: 0, width: 18, justifyContent: 'center', cursor: arrastrable ? 'grab' : 'default', color: (theme) => theme.emphasys.content.muted }}>
                    {arrastrable ? <DragIndicatorIcon sx={{ fontSize: 18 }} /> : null}
                  </Box>
                  <Box sx={{ display: 'flex', flexShrink: 0, width: 16, justifyContent: 'center' }}>
                    {row.es_preferida ? <Tooltip title="Preferida" arrow><StarIcon sx={{ fontSize: 16, color: (theme) => (row.fecha_baja ? theme.emphasys.content.muted : theme.emphasys.content.foreground) }} /></Tooltip> : null}
                  </Box>
                  <Tooltip title={row.contenido} placement="top" arrow>
                    <Typography sx={(theme) => ({
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      lineHeight: 1.35,
                      color: row.fecha_baja ? theme.emphasys.content.muted : theme.emphasys.content.foreground,
                      textDecoration: row.fecha_baja ? 'line-through' : 'none',
                      textDecorationColor: theme.emphasys.action.disabled,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                    })}>{row.contenido}</Typography>
                  </Tooltip>
                  {row.es_preferida && !row.fecha_baja ? (
                    <Box component="span" sx={(theme) => ({ flexShrink: 0, fontSize: 11, px: 0.875, py: 0.125, borderRadius: 999, border: `1px solid ${theme.emphasys.content.border}`, color: theme.emphasys.content.muted, backgroundColor: theme.emphasys.content.elevated })}>Preferida</Box>
                  ) : null}
                  {row.fecha_baja ? (
                    <Box component="span" sx={(theme) => ({ flexShrink: 0, fontSize: 11, px: 0.875, py: 0.125, borderRadius: 999, border: `1px solid ${theme.emphasys.content.border}`, color: theme.emphasys.action.destructive, backgroundColor: theme.emphasys.content.elevated })}>Baja</Box>
                  ) : null}
                  <Stack direction="row" spacing={0.25} className="esp-hover" sx={{ flexShrink: 0 }}>
                    {!row.fecha_baja ? <Tooltip title="Editar" arrow><IconButton size="small" aria-label="Editar especificación" onClick={(event) => { event.stopPropagation(); startEditing(row); }} sx={accionSx((theme) => theme.emphasys.content.foreground)}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip> : null}
                    <Tooltip title={row.fecha_baja ? 'Reactivar' : 'Dar de baja'} arrow><IconButton size="small" aria-label={row.fecha_baja ? 'Reactivar especificación' : 'Dar de baja especificación'} onClick={async () => { await cambiarBajaEspecificacionBiblioteca(row.id, !row.fecha_baja); await load(); }} sx={accionSx((theme) => (row.fecha_baja ? theme.emphasys.action.info : theme.emphasys.action.destructive))}>{row.fecha_baja ? <UnarchiveOutlinedIcon sx={{ fontSize: 16 }} /> : <ArchiveOutlinedIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
                  </Stack>
                </Box>;
              })}
            </Box>
          ))}
        </Box>
      </>
    )}
  </Stack>;
}
