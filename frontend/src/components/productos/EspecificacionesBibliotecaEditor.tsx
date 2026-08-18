import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, Chip, FormControlLabel, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import StarIcon from '@mui/icons-material/Star';
import { actualizarEspecificacionBiblioteca, cambiarBajaEspecificacionBiblioteca, crearEspecificacionBiblioteca, fetchEspecificacionesBiblioteca, reordenarEspecificacionesBiblioteca, type EspecificacionBiblioteca, type TipoEspecificacionBiblioteca } from '../../services/productosService';

const TIPOS: TipoEspecificacionBiblioteca[] = ['medida', 'material', 'accesorio', 'garantia', 'entrega', 'condicion', 'otro'];
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
  if (!canLoad) return <Typography color="text.secondary">Guarda primero el producto para administrar su biblioteca reutilizable.</Typography>;
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
      <TextField size="small" fullWidth label="Buscar especificaciones" value={search} onChange={(e) => setSearch(e.target.value)} />
      <FormControlLabel control={<Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label="Mostrar bajas" />
    </Stack>
    <Paper ref={formRef} variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1}>
      {editing && <Typography variant="subtitle2">Editando especificación</Typography>}
      <TextField size="small" multiline minRows={2} maxRows={6} label={editing ? 'Editar especificación' : 'Nueva especificación'} value={contenido} onChange={(e) => setContenido(e.target.value)} inputProps={{ maxLength: 1000 }} />
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField select size="small" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEspecificacionBiblioteca)} sx={{ minWidth: 150 }}>{TIPOS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
        <FormControlLabel control={<Checkbox checked={preferida} onChange={(e) => setPreferida(e.target.checked)} />} label="Preferida" />
        <Button variant="contained" startIcon={<AddIcon />} disabled={saving || !contenido.trim()} onClick={() => void save()} sx={{ ml: 'auto !important' }}>{editing ? 'Guardar' : 'Agregar'}</Button>
        {editing && <Button onClick={reset}>Cancelar</Button>}
      </Stack>
    </Stack></Paper>
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: 'divider' }}>
      {filtered.map((row, index) => <Box key={row.id} onDragOver={(e) => e.preventDefault()} onDrop={() => void drop(row.id)} sx={{ display: 'flex', alignItems: 'center', gap: .25, minHeight: 40, px: .75, py: .375, opacity: row.fecha_baja ? .55 : 1, borderBottom: index < filtered.length - 1 ? 1 : 0, borderColor: 'divider', transition: 'background-color 120ms ease', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box draggable={!search && !row.fecha_baja} onDragStart={() => setDragId(row.id)} sx={{ display: 'flex', flexShrink: 0, p: .25, cursor: search || row.fecha_baja ? 'default' : 'grab', color: 'text.disabled', opacity: .6, '&:hover': { opacity: .85 } }}><DragIndicatorIcon fontSize="small" /></Box>
        {row.tipo !== 'otro' && <Chip size="small" label={row.tipo} sx={{ flexShrink: 0, height: 20, fontSize: '0.6875rem', '& .MuiChip-label': { px: .75 } }} />}
        {row.es_preferida && <Tooltip title="Preferida"><StarIcon sx={{ flexShrink: 0, fontSize: 18 }} color="warning" /></Tooltip>}
        <Tooltip title={row.contenido} placement="top" arrow>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, lineHeight: 1.25, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' }}>{row.contenido}</Typography>
        </Tooltip>
        {!row.fecha_baja && <Tooltip title="Editar"><IconButton size="small" aria-label="Editar especificación" onClick={(event) => { event.stopPropagation(); startEditing(row); }} sx={{ flexShrink: 0, p: .625 }}><EditIcon fontSize="small" /></IconButton></Tooltip>}
        <Tooltip title={row.fecha_baja ? 'Reactivar' : 'Dar de baja'}><IconButton size="small" aria-label={row.fecha_baja ? 'Reactivar especificación' : 'Dar de baja especificación'} color={row.fecha_baja ? 'primary' : 'error'} onClick={async () => { await cambiarBajaEspecificacionBiblioteca(row.id, !row.fecha_baja); await load(); }} sx={{ flexShrink: 0, p: .625 }}>{row.fecha_baja ? <UnarchiveOutlinedIcon fontSize="small" /> : <ArchiveOutlinedIcon fontSize="small" />}</IconButton></Tooltip>
      </Box>)}
    </Paper>
  </Stack>;
}
