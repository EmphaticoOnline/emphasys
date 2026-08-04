import { useMemo, useState } from 'react';
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import { fetchEspecificacionesBiblioteca, type EspecificacionBiblioteca } from '../../services/productosService';
import type { EspecificacionPartida, TipoEspecificacion } from '../../types/cotizacion';

const TIPOS: TipoEspecificacion[] = ['medida', 'material', 'accesorio', 'garantia', 'entrega', 'condicion', 'otro'];
const keyFor = () => `spec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
type Props = { productoId?: number | null; value: EspecificacionPartida[]; onChange: (value: EspecificacionPartida[]) => void; disabled?: boolean };

export default function PartidaEspecificacionesEditor({ productoId, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false); const [library, setLibrary] = useState<EspecificacionBiblioteca[]>([]); const [draft, setDraft] = useState<EspecificacionPartida[]>([]);
  const [search, setSearch] = useState(''); const [manual, setManual] = useState(''); const [manualType, setManualType] = useState<TipoEspecificacion>('otro'); const [dragIndex, setDragIndex] = useState<number | null>(null);
  const openSelector = async () => {
    const [globals, products] = await Promise.all([fetchEspecificacionesBiblioteca('global'), productoId ? fetchEspecificacionesBiblioteca(productoId) : Promise.resolve([])]);
    const combined = [...products, ...globals]; setLibrary(combined);
    if (value.length) setDraft(value.map((v) => ({ ...v })));
    else setDraft(combined.filter((e) => e.alcance === 'producto' || (e.alcance === 'global' && e.es_preferida)).map((e, i) => ({ clave_temporal: keyFor(), especificacion_biblioteca_id: e.id, orden: i, tipo: e.tipo, origen: e.alcance, contenido: e.contenido })));
    setOpen(true);
  };
  const selectedIds = new Set(draft.map((d) => d.especificacion_biblioteca_id).filter(Boolean));
  const filtered = useMemo(() => library.filter((e) => normalize(`${e.contenido} ${e.tipo} ${e.alcance}`).includes(normalize(search))), [library, search]);
  const toggle = (e: EspecificacionBiblioteca) => {
    if (selectedIds.has(e.id)) setDraft((p) => p.filter((d) => d.especificacion_biblioteca_id !== e.id));
    else setDraft((p) => [...p, { clave_temporal: keyFor(), especificacion_biblioteca_id: e.id, orden: p.length, tipo: e.tipo, origen: e.alcance, contenido: e.contenido }]);
  };
  const selectAllVisible = () => setDraft((current) => {
    const currentIds = new Set(current.map((item) => item.especificacion_biblioteca_id).filter(Boolean));
    const additions = filtered.filter((item) => !currentIds.has(item.id)).map((item, index) => ({ clave_temporal: keyFor(), especificacion_biblioteca_id: item.id, orden: current.length + index, tipo: item.tipo, origen: item.alcance, contenido: item.contenido }));
    return [...current, ...additions];
  });
  const clearAllVisible = () => {
    const visibleIds = new Set(filtered.map((item) => item.id));
    setDraft((current) => current.filter((item) => !item.especificacion_biblioteca_id || !visibleIds.has(item.especificacion_biblioteca_id)));
  };
  const ordered = (items: EspecificacionPartida[]) => items.map((e, i) => ({ ...e, orden: i }));
  const drop = (target: number) => { if (dragIndex === null || dragIndex === target) return; const next = [...value]; const [m] = next.splice(dragIndex, 1); next.splice(target, 0, m); onChange(ordered(next)); setDragIndex(null); };
  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center"><Button size="small" variant="outlined" startIcon={<TuneIcon />} disabled={disabled} onClick={() => void openSelector()}>Especificaciones</Button>{value.length > 0 && <Chip size="small" label={`${value.length} seleccionada(s)`} />}</Stack>
    {value.length > 0 && <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: 'divider' }}>
      {value.map((item, index) => <Box key={item.id ?? item.clave_temporal ?? index} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(index)} sx={{ display: 'flex', alignItems: 'center', gap: .375, minHeight: 34, px: .5, py: .125, borderBottom: index < value.length - 1 ? 1 : 0, borderColor: 'divider', transition: 'background-color 120ms ease', '&:hover': { bgcolor: 'action.hover' } }}>
        <Box draggable={!disabled} onDragStart={() => setDragIndex(index)} sx={{ display: 'flex', flexShrink: 0, p: .25, color: 'text.disabled', opacity: .6, cursor: disabled ? 'default' : 'grab', '&:hover': { opacity: .85 } }}><DragIndicatorIcon sx={{ fontSize: 18 }} /></Box>
        {item.tipo !== 'otro' && <Chip size="small" label={item.tipo} sx={{ flexShrink: 0, height: 18, fontSize: '0.625rem', '& .MuiChip-label': { px: .625 } }} />}
        <TextField fullWidth size="small" multiline minRows={1} maxRows={3} value={item.contenido} disabled={disabled} onChange={(e) => onChange(value.map((x, i) => i === index ? { ...x, contenido: e.target.value } : x))} sx={{ minWidth: 0, '& .MuiInputBase-root': { minHeight: 30, py: 0, fontSize: '0.78125rem', lineHeight: 1.25 }, '& .MuiInputBase-inputMultiline': { py: .5, px: .75 } }} />
        <IconButton size="small" aria-label="Quitar especificación" color="error" disabled={disabled} onClick={() => onChange(ordered(value.filter((_, i) => i !== index)))} sx={{ flexShrink: 0, p: .5 }}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>)}
    </Paper>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"><DialogTitle>Seleccionar especificaciones</DialogTitle><DialogContent dividers><Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField fullWidth size="small" label="Buscar por texto, tipo u origen" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Stack direction="row" spacing={.5} sx={{ flexShrink: 0 }}>
          <Button variant="text" size="small" onClick={selectAllVisible} disabled={filtered.length === 0} sx={{ minHeight: 30, px: 1.25, fontWeight: 600, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>Seleccionar todas</Button>
          <Button variant="text" size="small" onClick={clearAllVisible} disabled={filtered.length === 0} sx={{ minHeight: 30, px: 1.25, fontWeight: 600, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>Quitar todas</Button>
        </Stack>
      </Stack>
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: 'divider' }}>{filtered.map((e, index) => <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: .375, minHeight: 32, px: .375, py: 0, borderBottom: index < filtered.length - 1 ? 1 : 0, borderColor: 'divider', transition: 'background-color 120ms ease', '&:hover': { bgcolor: 'action.hover' } }}>
        <Checkbox size="small" checked={selectedIds.has(e.id)} onChange={() => toggle(e)} sx={{ p: .375, flexShrink: 0, '& .MuiSvgIcon-root': { fontSize: 19 } }} />
        <Typography variant="body2" title={e.contenido} sx={{ flex: 1, minWidth: 0, fontSize: '0.78125rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.contenido}</Typography>
        <Stack direction="row" spacing={.375} sx={{ flexShrink: 0 }}>
          <Chip size="small" label={e.tipo} sx={{ height: 17, fontSize: '0.59375rem', '& .MuiChip-label': { px: .5 } }} />
          <Chip size="small" variant="outlined" label={e.alcance === 'global' ? 'Global' : 'Producto'} sx={{ height: 17, fontSize: '0.59375rem', '& .MuiChip-label': { px: .5 } }} />
          {e.es_preferida && <Chip size="small" color="warning" label="Preferida" sx={{ height: 17, fontSize: '0.59375rem', '& .MuiChip-label': { px: .5 } }} />}
        </Stack>
      </Box>)}</Paper>
      <Typography fontWeight={600}>Agregar exclusiva para esta partida</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}><TextField fullWidth size="small" multiline label="Contenido" value={manual} onChange={(e) => setManual(e.target.value)} inputProps={{ maxLength: 1000 }} /><TextField select size="small" label="Tipo" value={manualType} onChange={(e) => setManualType(e.target.value as TipoEspecificacion)} sx={{ minWidth: 150 }}>{TIPOS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField><Button startIcon={<AddIcon />} disabled={!manual.trim()} onClick={() => { setDraft((p) => [...p, { clave_temporal: keyFor(), especificacion_biblioteca_id: null, orden: p.length, tipo: manualType, origen: 'manual', contenido: manual.trim() }]); setManual(''); }}>Agregar</Button></Stack>
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Cancelar</Button><Button variant="contained" onClick={() => { onChange(ordered(draft.filter((d) => d.contenido.trim()))); setOpen(false); }}>Aplicar selección</Button></DialogActions></Dialog>
  </Stack>;
}
