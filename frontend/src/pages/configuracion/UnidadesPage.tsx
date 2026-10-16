import * as React from 'react';
import { Alert, Autocomplete, Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { AddRounded, CloseRounded, DeleteOutlineRounded, EditRounded, SaveOutlined } from '@mui/icons-material';
import { apiFetch } from '../../services/apiFetch';
import { actualizarUnidad, crearUnidad, eliminarUnidad, fetchUnidades, type Unidad } from '../../services/unidadesService';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { catalogoSearchSx } from '../../components/catalogo/catalogoSurfaces';
import { Section, actionIconSx, dialogPaperSx, editorialTableSx, formWellSx, panelBarSx, rowIconSx, wellSx } from '../../components/transporte/transporteVisual';

type Sat = { id: number; clave: string; descripcion: string };
const empty = { clave: '', descripcion: '', unidad_sat_id: 0, activo: true };

export default function UnidadesPage() {
  const [rows, setRows] = React.useState<Unidad[]>([]); const [editing, setEditing] = React.useState<Unidad | null>(null); const [form, setForm] = React.useState(empty); const [sat, setSat] = React.useState<Sat[]>([]); const [open, setOpen] = React.useState(false); const [error, setError] = React.useState('');
  const load = React.useCallback(async () => setRows(await fetchUnidades(true)), []); React.useEffect(() => { void load(); }, [load]);
  const searchSat = async (q: string) => { try { const r = await apiFetch<{ items: Sat[] }>(`/api/catalogos/sat/unidades?q=${encodeURIComponent(q)}&limit=50`); setSat(r.items ?? []); } catch { setSat([]); } };
  const start = (row?: Unidad) => { setError(''); setEditing(row ?? null); setForm(row ? { clave: row.clave, descripcion: row.descripcion, unidad_sat_id: row.unidad_sat_id, activo: row.activo } : empty); setOpen(true); };
  const save = async () => { try { setError(''); if (editing) await actualizarUnidad(editing.id, form); else await crearUnidad(form); setOpen(false); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); } };
  const remove = async (row: Unidad) => { if (!window.confirm(`¿Eliminar ${row.descripcion}?`)) return; try { await eliminarUnidad(row.id); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar'); } };
  const selected = sat.find((x) => x.id === form.unidad_sat_id) ?? null;
  return (
    <ConfigPageFrame>
      <ConfigPageHeader title="Unidades" description="Catálogo operativo de la empresa activa." actions={<Tooltip title="Nueva unidad"><IconButton size="small" sx={actionIconSx} onClick={() => start()}><AddRounded fontSize="small" /></IconButton></Tooltip>} />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Box sx={wellSx}>
        <Box sx={panelBarSx}><Typography sx={(theme) => ({ fontSize: 14, fontWeight: 700, color: theme.emphasys.content.foreground })}>Unidades registradas</Typography><Typography sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>{rows.length} {rows.length === 1 ? 'unidad' : 'unidades'}</Typography></Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={editorialTableSx}><TableHead><TableRow><TableCell>Clave</TableCell><TableCell>Nombre</TableCell><TableCell>Unidad SAT</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={4} align="center" sx={(theme) => ({ py: '48px !important', color: `${theme.emphasys.content.muted} !important` })}>No hay unidades registradas.</TableCell></TableRow> : rows.map((r) => <TableRow key={r.id} hover><TableCell sx={(theme) => ({ fontSize: '14px !important', fontWeight: 700, color: `${theme.emphasys.content.foreground} !important` })}>{r.clave}</TableCell><TableCell sx={(theme) => ({ fontWeight: 600, color: `${theme.emphasys.content.foreground} !important` })}>{r.descripcion}</TableCell><TableCell>{r.unidad_sat_clave} — {r.unidad_sat_descripcion}</TableCell><TableCell align="right"><Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center"><Tooltip title={r.activo ? 'Desactivar' : 'Activar'}><Switch size="small" checked={r.activo} onChange={() => void actualizarUnidad(r.id, { clave: r.clave, descripcion: r.descripcion, unidad_sat_id: r.unidad_sat_id, activo: !r.activo }).then(load)} /></Tooltip><Tooltip title="Editar unidad"><IconButton size="small" sx={rowIconSx} onClick={() => start(r)}><EditRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip><Tooltip title="Eliminar unidad"><IconButton size="small" sx={rowIconSx} onClick={() => void remove(r)}><DeleteOutlineRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip></Stack></TableCell></TableRow>)}</TableBody></Table>
        </Box>
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={{ px: { xs: 1.5, md: 2.25 }, pt: 2, pb: 1.5 }}><ConfigPageHeader eyebrow="Unidades" title={editing ? 'Editar unidad' : 'Nueva unidad'} actions={<Stack direction="row" spacing={0.5}><Tooltip title="Cancelar"><IconButton size="small" sx={actionIconSx} onClick={() => setOpen(false)}><CloseRounded fontSize="small" /></IconButton></Tooltip><Tooltip title="Guardar"><IconButton size="small" sx={actionIconSx} onClick={() => void save()}><SaveOutlined fontSize="small" /></IconButton></Tooltip></Stack>} /></DialogTitle>
        <DialogContent sx={{ px: { xs: 1.5, md: 2.25 }, pb: { xs: 1.5, md: 2.25 } }}><Box sx={formWellSx}><Section title="Unidad" inset><Stack spacing={2} sx={{ pt: 0.5 }}><TextField size="small" label="Nombre" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required sx={catalogoSearchSx} /><TextField size="small" label="Clave operativa / abreviatura" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} required sx={catalogoSearchSx} /><Autocomplete options={sat} value={selected} isOptionEqualToValue={(option, value) => option.id === value.id} filterOptions={(x) => x} getOptionLabel={(x) => `${x.clave} — ${x.descripcion}`} onOpen={() => void searchSat('')} onInputChange={(_, v, reason) => { if (reason === 'input') void searchSat(v); }} onChange={(_, v) => setForm({ ...form, unidad_sat_id: v?.id ?? 0 })} renderInput={(params) => <TextField {...params} size="small" label="Unidad SAT" required sx={catalogoSearchSx} />} /></Stack></Section></Box></DialogContent>
      </Dialog>
    </ConfigPageFrame>
  );
}
