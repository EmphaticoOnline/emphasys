import * as React from 'react';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { apiFetch } from '../../services/apiFetch';
import { actualizarUnidad, crearUnidad, eliminarUnidad, fetchUnidades, type Unidad } from '../../services/unidadesService';
import { ConfigPageFrame, ConfigPageHeader, ConfigSurface } from '../../components/configuracion/configVisual';

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
      <ConfigPageHeader title="Unidades" description="Catálogo operativo de la empresa activa." actions={<Button variant="contained" startIcon={<Add />} onClick={() => start()}>Nueva unidad</Button>} />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <ConfigSurface sx={{ overflowX: 'auto' }}>
        <Table size="small"><TableHead><TableRow><TableCell>Clave</TableCell><TableCell>Nombre</TableCell><TableCell>Unidad SAT</TableCell><TableCell>Activa</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No hay unidades registradas.</TableCell></TableRow> : rows.map((r) => <TableRow key={r.id} hover><TableCell>{r.clave}</TableCell><TableCell>{r.descripcion}</TableCell><TableCell>{r.unidad_sat_clave} — {r.unidad_sat_descripcion}</TableCell><TableCell><Switch size="small" checked={r.activo} onChange={() => void actualizarUnidad(r.id, { clave: r.clave, descripcion: r.descripcion, unidad_sat_id: r.unidad_sat_id, activo: !r.activo }).then(load)} /></TableCell><TableCell align="right"><IconButton size="small" onClick={() => start(r)}><Edit fontSize="small" /></IconButton><IconButton size="small" onClick={() => void remove(r)}><Delete fontSize="small" /></IconButton></TableCell></TableRow>)}</TableBody></Table>
      </ConfigSurface>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{editing ? 'Editar unidad' : 'Nueva unidad'}</DialogTitle><DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}><TextField size="small" label="Nombre" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required /><TextField size="small" label="Clave operativa / abreviatura" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} required /><Autocomplete options={sat} value={selected} isOptionEqualToValue={(option, value) => option.id === value.id} filterOptions={(x) => x} getOptionLabel={(x) => `${x.clave} — ${x.descripcion}`} onOpen={() => void searchSat('')} onInputChange={(_, v, reason) => { if (reason === 'input') void searchSat(v); }} onChange={(_, v) => setForm({ ...form, unidad_sat_id: v?.id ?? 0 })} renderInput={(params) => <TextField {...params} size="small" label="Unidad SAT" required />} /></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Cancelar</Button><Button variant="contained" onClick={() => void save()}>Guardar</Button></DialogActions></Dialog>
    </ConfigPageFrame>
  );
}
