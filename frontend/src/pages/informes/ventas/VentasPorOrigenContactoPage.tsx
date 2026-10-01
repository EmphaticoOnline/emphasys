import { Fragment, useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Button, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../api/apiClient';
import { buildVentasPorOrigenExportUrl, fetchOrigenesContacto, fetchVentasPorOrigen, fetchDetalleVentasPorOrigen, type OrigenContacto, type VentasPorOrigenResult, type MovimientosPorPeriodoParams, type Agrupacion } from '../../../services/reportesService';

const money = (v: number) => v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (v: string) => {
  const d = v.slice(0, 10).split('-');
  return d.length === 3 ? d[2].concat('/', d[1], '/', d[0]) : v;
};
const ORIGIN_COLORS = ['#3d5f86', '#3f6b52', '#8a6232', '#5c5348', '#4e6f78', '#6a7354', '#7a5648', '#3c4149'];
const today = () => new Date().toISOString().slice(0, 10);

type Opt = { id: number; nombre?: string; clave?: string; descripcion?: string };
type Evolucion = { periodo_key: string; periodo_label: string; subtotal: number };
type Resultado = VentasPorOrigenResult & { evolucion: Evolucion[]; total_comparable?: number };

export default function VentasPorOrigenContactoPage() {
  const nav = useNavigate();
  const tokens = useTheme().emphasys;
  const [desde, setDesde] = useState(`${today().slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(today());
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('mes');
  const [cliente, setCliente] = useState<Opt | null>(null);
  const [producto, setProducto] = useState<Opt | null>(null);
  const [origen, setOrigen] = useState<OrigenContacto | null>(null);
  const [clientes, setClientes] = useState<Opt[]>([]);
  const [productos, setProductos] = useState<Opt[]>([]);
  const [origenes, setOrigenes] = useState<OrigenContacto[]>([]);
  const [data, setData] = useState<Resultado | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, any[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchOrigenesContacto().then(setOrigenes).catch(e => setError(e.message)); }, []);
  const params = useMemo<MovimientosPorPeriodoParams>(() => ({ fecha_inicio: desde, fecha_fin: hasta, agrupacion, ...(cliente ? { contacto_id: cliente.id } : {}), ...(producto ? { producto_id: producto.id } : {}), ...(origen ? { origen_contacto_id: origen.id } : {}) }), [desde, hasta, agrupacion, cliente, producto, origen]);
  useEffect(() => { setLoading(true); fetchVentasPorOrigen(params).then(d => setData(d as Resultado)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [params]);
  const search = async (kind: string, q: string) => { const u = kind === 'c' ? `/api/contactos?limit=40&tipos=cliente&search=${encodeURIComponent(q)}` : `/api/productos?page=1&limit=40&search=${encodeURIComponent(q)}`; const r = await apiFetch(u); if (r.ok) { const j = await r.json(); return Array.isArray(j) ? j : (j.data ?? []); } return []; };
  const exp = async (f: 'pdf' | 'excel') => { const r = await apiFetch(buildVentasPorOrigenExportUrl(params, f)); const u = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = u; a.download = `ventas-por-origen-contacto.${f === 'pdf' ? 'pdf' : 'xlsx'}`; a.click(); URL.revokeObjectURL(u); };
  const sel = !!origen;
  const toggle = async (id: number) => { if (expanded === id) { setExpanded(null); return; } setExpanded(id); if (!details[id]) { const d = await fetchDetalleVentasPorOrigen({ ...params, origen_contacto_id: id }); setDetails(x => ({ ...x, [id]: d })); } };

  const campoSx: SxProps<Theme> = {
    '& .MuiOutlinedInput-root': {
      bgcolor: tokens.content.well,
      borderRadius: 2,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.muted },
      '&.Mui-focused fieldset': { borderColor: tokens.action.info },
    },
    '& .MuiInputLabel-root': { color: tokens.content.muted },
    '& .MuiInputBase-input': { color: tokens.content.foreground },
  };
  const accionSx: SxProps<Theme> = {
    textTransform: 'none',
    fontWeight: 650,
    color: tokens.content.secondary,
    borderColor: tokens.content.border,
    borderRadius: 2,
    px: 1.5,
    minWidth: 0,
    boxShadow: 'none',
  };

  const kpis: Array<[string, string]> = data ? [
    ['Total vendido', `$${money(data.kpis.total)}`],
    ['Documentos', String(data.kpis.cantidad_documentos)],
    ['Clientes', String(data.kpis.cantidad_contactos)],
    ['Ticket promedio', `$${money(data.kpis.ticket_promedio)}`],
    ...(sel ? [['Participación en ventas', `${(data.total_comparable ? data.kpis.total * 100 / data.total_comparable : 0).toFixed(2)}%`] as [string, string]] : []),
  ] : [];

  return (
    <Stack spacing={1.75} sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <Box
          component="button"
          type="button"
          onClick={() => nav('/informes')}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted, flexShrink: 0 }}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          INFORMES
        </Box>
        <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.foreground, minWidth: 0 }}>
          VENTAS
        </Typography>
      </Stack>

      <Box>
        <Typography variant="figure" sx={{ fontSize: { xs: 26, sm: 30 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
          Ventas por Origen de Contacto
        </Typography>
        <Typography sx={{ mt: 0.6, fontSize: 13, lineHeight: 1.45, color: tokens.content.muted }}>
          Atribución por el origen actual del contacto principal.
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.elevated, overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: tokens.metric.track, '& .MuiLinearProgress-bar': { bgcolor: tokens.action.info } }} />}
        <TextField label="Fecha inicial" type="date" size="small" value={desde} onChange={e => setDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 158 }, ...campoSx }} />
        <TextField label="Fecha final" type="date" size="small" value={hasta} onChange={e => setHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 158 }, ...campoSx }} />
        <Autocomplete options={clientes} value={cliente} onChange={(_, v) => setCliente(v)} onInputChange={(_, v) => search('c', v).then(setClientes)} getOptionLabel={o => o.nombre ?? ''} isOptionEqualToValue={(a, b) => a.id === b.id} sx={{ width: { xs: '100%', sm: 210 }, ...campoSx }} renderInput={p => <TextField {...p} label="Cliente (todos)" size="small" />} />
        <Autocomplete options={productos} value={producto} onChange={(_, v) => setProducto(v)} onInputChange={(_, v) => search('p', v).then(setProductos)} getOptionLabel={o => `${o.clave ?? ''} — ${o.descripcion ?? ''}`} isOptionEqualToValue={(a, b) => a.id === b.id} sx={{ width: { xs: '100%', sm: 230 }, ...campoSx }} renderInput={p => <TextField {...p} label="Producto (todos)" size="small" />} />
        <Autocomplete options={origenes} value={origen} onChange={(_, v) => setOrigen(v)} getOptionLabel={o => o.descripcion} isOptionEqualToValue={(a, b) => a.id === b.id} sx={{ width: { xs: '100%', sm: 210 }, ...campoSx }} renderInput={p => <TextField {...p} label="Origen de contacto (todos)" size="small" />} />
        <TextField select label="Agrupación" size="small" value={agrupacion} onChange={e => setAgrupacion(e.target.value as Agrupacion)} sx={{ width: { xs: '100%', sm: 130 }, ...campoSx }}>
          <MenuItem value="dia">Día</MenuItem>
          <MenuItem value="semana">Semana</MenuItem>
          <MenuItem value="mes">Mes</MenuItem>
          <MenuItem value="anio">Año</MenuItem>
        </TextField>
        <Box sx={{ flex: '1 0 8px', display: { xs: 'none', md: 'block' } }} />
        <Button variant="outlined" onClick={() => exp('pdf')} sx={accionSx}>PDF</Button>
        <Button variant="outlined" onClick={() => exp('excel')} sx={accionSx}>Excel</Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {data && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(auto-fit, minmax(180px, 1fr))' }, gap: 0.8 }}>
            {kpis.map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0, bgcolor: tokens.metric.amount.background, borderRadius: 2, px: 1.5, py: 1.05 }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{label}</Typography>
                <Typography variant="figure" sx={{ mt: 0.2, fontSize: { xs: 20, sm: 24 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.muted }}>
              {sel ? 'Evolución' : 'Distribución'}
            </Typography>
            <Typography sx={{ mt: 0.25, mb: 1.25, fontSize: 13, color: tokens.content.secondary }}>
              {sel ? `Evolución — ${agrupacion}` : 'Distribución de ventas por origen de contacto'}
            </Typography>
            <Stack spacing={0.7}>
              {sel ? data.evolucion.map(p => (
                <Box key={p.periodo_key} sx={{ display: 'flex', gap: 2, alignItems: 'baseline', minWidth: 0 }}>
                  <Typography sx={{ width: { xs: 120, sm: 150 }, flexShrink: 0, fontSize: 13, color: tokens.content.foreground }}>{p.periodo_label}</Typography>
                  <Typography variant="figure" sx={{ fontSize: 15, color: tokens.content.foreground }}>${money(p.subtotal)}</Typography>
                </Box>
              )) : data.filas.map((r, i) => (
                <Box key={`${r.origen_id}-${r.origen}`} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 0.35, sm: 1.25 }, alignItems: { sm: 'center' }, minWidth: 0 }}>
                  <Typography sx={{ width: { sm: 190 }, minWidth: { sm: 190 }, fontSize: '0.8rem', color: tokens.content.foreground, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { sm: 'nowrap' } }}>{r.origen}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0, height: 10, borderRadius: 0.5, bgcolor: tokens.metric.track, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${Math.max(2, r.porcentaje_total)}%`, maxWidth: '100%', bgcolor: ORIGIN_COLORS[i % ORIGIN_COLORS.length], borderRadius: 0.5 }} />
                  </Box>
                  <Typography sx={{ flexShrink: 0, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: tokens.content.foreground }}>${money(r.subtotal)} ({r.porcentaje_total.toFixed(1)}%)</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box sx={{ borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well, overflow: 'auto' }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: tokens.table.headerBg, '& th': { color: tokens.table.headerFg, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${tokens.table.line}`, py: 1.1, whiteSpace: 'nowrap' } }}>
                  {['Origen', 'Documentos', 'Clientes', 'Subtotal', 'IVA', 'Total', '% del total'].map(x => (
                    <TableCell key={x} align={x === 'Origen' ? 'left' : 'right'}>{x}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.filas.map(r => (
                  <Fragment key={`${r.origen_id}-${r.origen}`}>
                    <TableRow sx={{ '& td': { borderBottom: `1px solid ${tokens.table.line}`, color: tokens.table.cell, fontSize: 13, fontVariantNumeric: 'tabular-nums', py: 0.85 }, '&:hover': { bgcolor: tokens.content.hover } }}>
                      {[
                        <Box onClick={() => toggle(r.origen_id ?? (r.origen === 'Sin origen' ? -1 : -2))} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: tokens.content.foreground, fontWeight: 600 }}>
                          {expanded === r.origen_id ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                          {r.origen}
                        </Box>,
                        r.documentos,
                        r.clientes,
                        money(r.subtotal),
                        money(r.iva),
                        money(r.total),
                        `${r.porcentaje_total.toFixed(2)}%`,
                      ].map((x, i) => <TableCell key={i} align={i ? 'right' : 'left'}>{x}</TableCell>)}
                    </TableRow>
                    {expanded === r.origen_id && (
                      <>
                        <TableRow sx={{ bgcolor: tokens.content.elevated }}>
                          <TableCell sx={{ pl: 5, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.content.muted, borderBottom: `1px solid ${tokens.table.line}` }}>Fecha</TableCell>
                          <TableCell sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.content.muted, borderBottom: `1px solid ${tokens.table.line}` }}>Factura/Folio</TableCell>
                          <TableCell sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.content.muted, borderBottom: `1px solid ${tokens.table.line}` }}>Cliente</TableCell>
                          <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.content.muted, borderBottom: `1px solid ${tokens.table.line}` }}>Subtotal</TableCell>
                          <TableCell colSpan={3} sx={{ borderBottom: `1px solid ${tokens.table.line}` }} />
                        </TableRow>
                        {(details[r.origen_id ?? (r.origen === 'Sin origen' ? -1 : -2)] || []).map(d => (
                          <TableRow key={d.id} sx={{ bgcolor: tokens.content.elevated }}>
                            <TableCell sx={{ pl: 5, fontSize: 12.5, color: tokens.content.secondary, borderBottom: `1px solid ${tokens.table.line}` }}>{formatDate(d.fecha)}</TableCell>
                            <TableCell sx={{ fontSize: 12.5, color: tokens.content.foreground, borderBottom: `1px solid ${tokens.table.line}` }}>{d.folio}</TableCell>
                            <TableCell sx={{ fontSize: 12.5, color: tokens.content.foreground, borderBottom: `1px solid ${tokens.table.line}` }}>{d.cliente}</TableCell>
                            <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: tokens.content.foreground, borderBottom: `1px solid ${tokens.table.line}` }}>{money(d.subtotal)}</TableCell>
                            <TableCell colSpan={3} sx={{ borderBottom: `1px solid ${tokens.table.line}` }} />
                          </TableRow>
                        ))}
                      </>
                    )}
                  </Fragment>
                ))}
                <TableRow sx={{ bgcolor: tokens.metric.amount.background, '& td': { borderBottom: 0, color: tokens.content.foreground, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', py: 1.05 } }}>
                  {['Total', data.totales.documentos, data.totales.clientes, money(data.totales.subtotal), money(data.totales.iva), money(data.totales.total), `${data.totales.porcentaje_total.toFixed(2)}%`].map((x, i) => (
                    <TableCell key={i} align={i ? 'right' : 'left'}>{x}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </>
      )}
    </Stack>
  );
}
