import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import StarIcon from '@mui/icons-material/Star';
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
type Props = {
  productoId?: number | undefined;
  alcance: 'global' | 'producto';
  onError?: (message: string) => void;
  /** Opcional: notifica al padre cuántas filas hay tras cada carga (para badges/contadores externos). No cambia el comportamiento interno del editor. */
  onCountChange?: (count: number) => void;
};

export default function EspecificacionesBibliotecaEditor({ productoId, alcance, onError, onCountChange }: Props) {
  const [rows, setRows] = useState<EspecificacionBiblioteca[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<EspecificacionBiblioteca | null>(null);
  const [contenido, setContenido] = useState('');
  const [tipo, setTipo] = useState<TipoEspecificacionBiblioteca>('otro');
  const [preferida, setPreferida] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const canLoad = alcance === 'global' || Boolean(productoId);
  const load = async () => {
    if (!canLoad) return;
    try {
      const data = await fetchEspecificacionesBiblioteca(alcance === 'global' ? 'global' : productoId!, showInactive);
      setRows(data);
      onCountChange?.(data.filter((r) => !r.fecha_baja).length);
    }
    catch (e) { onError?.(e instanceof Error ? e.message : 'No se pudieron cargar las especificaciones'); }
  };
  useEffect(() => { void load(); }, [productoId, alcance, showInactive]);
  const filtered = useMemo(() => {
    const q = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return rows.filter((r) => `${r.contenido} ${r.tipo} ${r.alcance}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q));
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
  const reset = () => { setEditing(null); setContenido(''); setTipo('otro'); setPreferida(false); };
  const startEditing = (row: EspecificacionBiblioteca) => {
    setEditing(row);
    setContenido(row.contenido);
    setTipo(row.tipo);
    setPreferida(row.es_preferida);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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
  if (!canLoad) return <Typography sx={{ fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>Guarda primero el producto para administrar su biblioteca reutilizable.</Typography>;
  const campoSx = (theme: Theme) => ({
    '& .MuiInputLabel-root': { fontSize: 13, color: theme.emphasys.content.muted },
    '& .MuiInputLabel-root.Mui-focused': { color: theme.emphasys.content.foreground },
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      fontSize: 13,
      color: theme.emphasys.content.foreground,
      backgroundColor: theme.emphasys.content.elevated,
      '& fieldset': { borderColor: theme.emphasys.content.border },
    },
  });
  return <Stack spacing={1.25}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
      <TextField size="small" fullWidth placeholder="Buscar especificaciones" value={search} onChange={(e) => setSearch(e.target.value)} sx={campoSx} />
      <FormControlLabel sx={{ m: 0, flexShrink: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } }} control={<Checkbox size="small" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label="Mostrar bajas" />
    </Stack>
    <Box ref={formRef} sx={(theme) => ({ p: 1.25, borderRadius: 2, border: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.action.wash })}><Stack spacing={1}>
      {editing ? <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>Editando especificación</Typography> : null}
      <TextField size="small" multiline minRows={2} maxRows={5} placeholder={editing ? 'Editar especificación' : 'Nueva especificación'} value={contenido} onChange={(e) => setContenido(e.target.value)} inputProps={{ maxLength: 1000 }} sx={campoSx} />
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField select size="small" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEspecificacionBiblioteca)} sx={(theme) => ({ minWidth: 140, ...campoSx(theme) })}>{TIPOS.map((t) => <MenuItem key={t} value={t}>{ETIQUETA_TIPO[t]}</MenuItem>)}</TextField>
        <FormControlLabel sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 13 } }} control={<Checkbox size="small" checked={preferida} onChange={(e) => setPreferida(e.target.checked)} />} label="Preferida" />
        <Button variant="contained" startIcon={<AddIcon />} disabled={saving || !contenido.trim()} onClick={() => void save()} sx={(theme) => ({ ml: 'auto !important', textTransform: 'none', fontWeight: 700, fontSize: 13, borderRadius: '10px', boxShadow: 'none', bgcolor: theme.emphasys.action.primary, color: theme.emphasys.action.primaryForeground, '&:hover': { bgcolor: theme.emphasys.action.primaryHover, boxShadow: 'none' } })}>{editing ? 'Guardar' : 'Agregar'}</Button>
        {editing ? <Button onClick={reset} sx={(theme) => ({ textTransform: 'none', fontWeight: 700, fontSize: 13, borderRadius: '10px', color: theme.emphasys.content.foreground })}>Cancelar</Button> : null}
      </Stack>
    </Stack></Box>
    {grupos.length === 0 ? (
      <Typography sx={{ fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>No hay especificaciones para mostrar.</Typography>
    ) : grupos.map((grupo) => (
      <Box key={grupo.tipo} sx={(theme) => ({ overflow: 'hidden', borderRadius: 2, border: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.content.card })}>
        <Box sx={(theme) => ({ px: 1.25, py: 0.75, borderBottom: `1px solid ${theme.emphasys.content.border}`, backgroundColor: theme.emphasys.action.wash })}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>{ETIQUETA_TIPO[grupo.tipo]}</Typography>
        </Box>
        {grupo.rows.map((row, index) => <Box key={row.id} onDragOver={(e) => e.preventDefault()} onDrop={() => void drop(row.id)} sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 36, px: 0.75, py: 0.4, opacity: row.fecha_baja ? 0.55 : 1, borderBottom: index < grupo.rows.length - 1 ? `1px solid ${theme.emphasys.content.border}` : 0, '&:hover': { bgcolor: theme.emphasys.content.hover } })}>
          <Box draggable={!search && !row.fecha_baja} onDragStart={() => setDragId(row.id)} sx={{ display: 'flex', flexShrink: 0, p: 0.25, cursor: search || row.fecha_baja ? 'default' : 'grab', color: (theme) => theme.emphasys.content.muted }}><DragIndicatorIcon sx={{ fontSize: 18 }} /></Box>
          {row.es_preferida ? <Tooltip title="Preferida" arrow><StarIcon sx={{ flexShrink: 0, fontSize: 16, color: (theme) => theme.emphasys.content.foreground }} /></Tooltip> : null}
          <Tooltip title={row.contenido} placement="top" arrow>
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.3, color: (theme) => theme.emphasys.content.foreground, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' }}>{row.contenido}</Typography>
          </Tooltip>
          {!row.fecha_baja ? <Tooltip title="Editar" arrow><IconButton size="small" aria-label="Editar especificación" onClick={(event) => { event.stopPropagation(); startEditing(row); }} sx={(theme) => ({ flexShrink: 0, width: 28, height: 28, borderRadius: '10px', color: theme.emphasys.content.foreground })}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip> : null}
          <Tooltip title={row.fecha_baja ? 'Reactivar' : 'Dar de baja'} arrow><IconButton size="small" aria-label={row.fecha_baja ? 'Reactivar especificación' : 'Dar de baja especificación'} onClick={async () => { await cambiarBajaEspecificacionBiblioteca(row.id, !row.fecha_baja); await load(); }} sx={(theme) => ({ flexShrink: 0, width: 28, height: 28, borderRadius: '10px', color: row.fecha_baja ? theme.emphasys.action.info : theme.emphasys.action.destructive })}>{row.fecha_baja ? <UnarchiveOutlinedIcon sx={{ fontSize: 16 }} /> : <ArchiveOutlinedIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
        </Box>)}
      </Box>
    ))}
  </Stack>;
}
