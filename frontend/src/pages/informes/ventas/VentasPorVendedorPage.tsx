import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, FormControlLabel,
  LinearProgress, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../api/apiClient';
import { fetchVendedores } from '../../../services/contactosService';
import type { Contacto } from '../../../types/contactos.types';
import {
  buildVentasPorVendedorExportUrl,
  fetchVentasPorVendedor,
  type VentaVendedorFactura,
  type VentaVendedorRow,
  type VentasPorVendedorResult,
} from '../../../services/reportesService';

const COLORES = ['#3d5f86', '#3f6b52', '#8a6232', '#5c5348', '#4e6f78', '#6a7354', '#7a5648', '#3c4149'];
const money = (v: number) => v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const formatFecha = (iso: string) => {
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return yr && mo && da ? `${da}-${mo}-${yr}` : iso;
};
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const primerDiaMes = () => `${hoy().slice(0, 8)}01`;
const clave = (id: number | null) => (id == null ? 'sin' : String(id));

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

function DonutParticipacion({ filas, total }: { filas: VentaVendedorRow[]; total: number }) {
  const tokens = useTheme().emphasys;
  const size = 168;
  const cx = 84;
  const cy = 84;
  const r = 58;
  const stroke = 22;
  let angulo = -Math.PI / 2;
  const segmentos = filas.map((fila, index) => {
    const fraccion = total > 0 ? fila.ventas / total : 0;
    const inicio = angulo;
    angulo += fraccion * Math.PI * 2;
    return { fila, index, inicio, fin: angulo, color: COLORES[index % COLORES.length] };
  });

  const arco = (inicio: number, fin: number) => {
    const x1 = cx + r * Math.cos(inicio);
    const y1 = cy + r * Math.sin(inicio);
    const x2 = cx + r * Math.cos(fin - 0.0001);
    const y2 = cy + r * Math.sin(fin - 0.0001);
    const grande = fin - inicio > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${grande} 1 ${x2} ${y2}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1.25, sm: 2.5 }, alignItems: { sm: 'center' }, minWidth: 0 }}>
      <Box sx={{ width: size, height: size, flexShrink: 0, mx: { xs: 'auto', sm: 0 } }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={tokens.metric.track} strokeWidth={stroke} />
          {segmentos.map((seg) => (
            seg.fin - seg.inicio >= Math.PI * 2 - 0.001 ? (
              <circle key={clave(seg.fila.vendedor_id)} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke}>
                <title>{`${seg.fila.vendedor}: $${money(seg.fila.ventas)} (${pct(seg.fila.pct_participacion)})`}</title>
              </circle>
            ) : seg.fin > seg.inicio ? (
              <path key={clave(seg.fila.vendedor_id)} d={arco(seg.inicio, seg.fin)} fill="none" stroke={seg.color} strokeWidth={stroke}>
                <title>{`${seg.fila.vendedor}: $${money(seg.fila.ventas)} (${pct(seg.fila.pct_participacion)})`}</title>
              </path>
            ) : null
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fill={tokens.content.muted}>Ventas totales</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="12" fontWeight="700" fill={tokens.content.foreground}>{`$${money(total)}`}</text>
        </svg>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, maxHeight: 188, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.55 }}>
        {filas.map((fila, index) => (
          <Box key={clave(fila.vendedor_id)} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto auto', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORES[index % COLORES.length] }} />
            <Typography noWrap sx={{ fontSize: 13, color: tokens.content.foreground }}>{fila.vendedor}</Typography>
            <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: tokens.content.foreground }}>${money(fila.ventas)}</Typography>
            <Typography sx={{ width: 58, textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: tokens.content.secondary }}>{pct(fila.pct_participacion)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function VentasPorVendedorPage() {
  const navigate = useNavigate();
  const tokens = useTheme().emphasys;
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [vendedoresCat, setVendedoresCat] = useState<Contacto[]>([]);
  const [vendedor, setVendedor] = useState<Contacto | null>(null);
  const [cliente, setCliente] = useState<ContactoOpcion | null>(null);
  const [clientes, setClientes] = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [resultado, setResultado] = useState<VentasPorVendedorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchVendedores().then(setVendedoresCat).catch(() => setVendedoresCat([])); }, []);

  const buscarClientes = useCallback((input: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const qs = new URLSearchParams({ limit: '40', tipos: 'cliente,varios' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/contactos?${qs.toString()}`);
        if (res.ok) {
          const raw = await res.json() as ContactoOpcion[] | { data?: ContactoOpcion[] };
          setClientes(Array.isArray(raw) ? raw : raw.data ?? []);
        }
      } finally {
        setBuscando(false);
      }
    }, 250);
  }, []);

  useEffect(() => {
    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) return;
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResultado(await fetchVentasPorVendedor({
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          vendedor_id: vendedor?.id ?? null,
          contacto_id: cliente?.id ?? null,
          detalle: mostrarDetalle,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo consultar el reporte');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [fechaInicio, fechaFin, vendedor, cliente, mostrarDetalle]);

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

  const exportar = async (formato: 'pdf' | 'excel') => {
    setExportando(formato);
    try {
      const res = await apiFetch(buildVentasPorVendedorExportUrl({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        vendedor_id: vendedor?.id ?? null,
        contacto_id: cliente?.id ?? null,
      }, formato));
      if (!res.ok) throw new Error('Error al exportar');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `ventas-por-vendedor.${formato === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExportando(null);
    }
  };

  const filas = resultado?.vendedores ?? [];
  const detalle = useMemo(() => {
    const map = new Map<string, VentaVendedorFactura[]>();
    for (const factura of resultado?.facturas_detalle ?? []) {
      const key = clave(factura.vendedor_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(factura);
    }
    return map;
  }, [resultado]);

  const celda = { borderBottom: `1px solid ${tokens.table.line}`, color: tokens.table.cell, fontSize: 13, fontVariantNumeric: 'tabular-nums', py: 0.75 };

  return (
    <Stack spacing={1.5} sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <Box component="button" type="button" onClick={() => navigate('/informes')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted, flexShrink: 0 }}>
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          INFORMES
        </Box>
        <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted }}>VENTAS</Typography>
        <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 11, letterSpacing: '0.14em', color: tokens.content.foreground, minWidth: 0 }}>VENTAS POR VENDEDOR</Typography>
      </Stack>

      <Box>
        <Typography variant="figure" sx={{ fontSize: { xs: 26, sm: 30 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>Ventas por Vendedor</Typography>
        <Typography sx={{ mt: 0.6, fontSize: 13, lineHeight: 1.45, color: tokens.content.muted, maxWidth: 640 }}>Volumen y participación de ventas por vendedor en un período.</Typography>
      </Box>

      <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.elevated, overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: tokens.metric.track, '& .MuiLinearProgress-bar': { bgcolor: tokens.action.info } }} />}
        <TextField label="Fecha inicial" type="date" size="small" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 155 }, ...campoSx }} />
        <TextField label="Fecha final" type="date" size="small" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 155 }, ...campoSx }} />
        <Autocomplete options={vendedoresCat} value={vendedor} onChange={(_, value) => setVendedor(value)} getOptionLabel={(o) => o.nombre} isOptionEqualToValue={(a, b) => a.id === b.id} sx={{ width: { xs: '100%', sm: 220 }, ...campoSx }} renderInput={(params) => <TextField {...params} label="Vendedor (todos)" size="small" />} />
        <Autocomplete options={clientes} loading={buscando} value={cliente} onChange={(_, value) => setCliente(value)} onInputChange={(_, input) => buscarClientes(input)} onOpen={() => { if (!clientes.length) buscarClientes(''); }} getOptionLabel={(o) => o.nombre} isOptionEqualToValue={(a, b) => a.id === b.id} sx={{ width: { xs: '100%', sm: 220 }, ...campoSx }} renderInput={(params) => <TextField {...params} label="Cliente (todos)" size="small" />} />
        <FormControlLabel sx={{ mr: 0 }} control={<Checkbox size="small" checked={mostrarDetalle} onChange={(e) => setMostrarDetalle(e.target.checked)} />} label={<Typography sx={{ fontSize: 13, color: tokens.content.secondary }}>Mostrar detalle</Typography>} />
        <Box sx={{ ml: { md: 'auto' }, display: 'flex', gap: 0.5, width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
          <Button size="small" variant="outlined" disabled={!resultado || !!exportando} onClick={() => void exportar('pdf')} sx={{ textTransform: 'none', fontWeight: 650, color: tokens.content.secondary, borderColor: tokens.content.border, borderRadius: 2, boxShadow: 'none' }}>{exportando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : 'PDF'}</Button>
          <Button size="small" variant="outlined" disabled={!resultado || !!exportando} onClick={() => void exportar('excel')} sx={{ textTransform: 'none', fontWeight: 650, color: tokens.content.secondary, borderColor: tokens.content.border, borderRadius: 2, boxShadow: 'none' }}>{exportando === 'excel' ? <CircularProgress size={14} color="inherit" /> : 'Excel'}</Button>
        </Box>
      </Box>

      {resultado && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 0.8 }}>
            {[
              ['Vendedores activos', String(resultado.vendedores_activos)],
              ['Ventas totales', `$${money(resultado.ventas_totales)}`],
              ['Facturas', resultado.facturas.toLocaleString('es-MX')],
              ['Vendedor principal', resultado.vendedor_principal ?? '—'],
            ].map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0, bgcolor: tokens.metric.amount.background, borderRadius: 2, px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{label}</Typography>
                <Typography variant="figure" sx={{ mt: 0.15, fontSize: { xs: 20, sm: 24 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>
            ))}
          </Box>

          {filas.length > 0 && (
            <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.muted }}>Participación</Typography>
              <Typography sx={{ mt: 0.2, mb: 1, fontSize: 13, color: tokens.content.secondary }}>Participación de ventas por vendedor</Typography>
              <DonutParticipacion filas={filas} total={resultado.ventas_totales} />
            </Box>
          )}

          <Box sx={{ borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well, overflow: 'auto' }}>
            {!mostrarDetalle ? (
              <Table size="small" sx={{ minWidth: 680 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: tokens.table.headerBg, '& th': { color: tokens.table.headerFg, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${tokens.table.line}`, py: 1, whiteSpace: 'nowrap' } }}>
                    <TableCell>Vendedor</TableCell>
                    <TableCell align="right">Clientes</TableCell>
                    <TableCell align="right">Facturas</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">% Participación</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filas.map((fila) => (
                    <TableRow key={clave(fila.vendedor_id)} sx={{ '& td': celda, '&:hover': { bgcolor: tokens.content.hover } }}>
                      <TableCell sx={{ color: tokens.content.foreground, fontWeight: 600 }}>{fila.vendedor}</TableCell>
                      <TableCell align="right">{fila.clientes.toLocaleString('es-MX')}</TableCell>
                      <TableCell align="right">{fila.facturas.toLocaleString('es-MX')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>${money(fila.ventas)}</TableCell>
                      <TableCell align="right">{pct(fila.pct_participacion)}</TableCell>
                    </TableRow>
                  ))}
                  {filas.length > 0 && (
                    <TableRow sx={{ bgcolor: tokens.metric.amount.background, '& td': { borderBottom: 0, color: tokens.content.foreground, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', py: 1 } }}>
                      <TableCell>TOTAL</TableCell>
                      <TableCell align="right">{resultado.clientes.toLocaleString('es-MX')}</TableCell>
                      <TableCell align="right">{resultado.facturas.toLocaleString('es-MX')}</TableCell>
                      <TableCell align="right">${money(resultado.ventas_totales)}</TableCell>
                      <TableCell align="right">{resultado.ventas_totales > 0 ? '100.00%' : '0.00%'}</TableCell>
                    </TableRow>
                  )}
                  {filas.length === 0 && (
                    <TableRow><TableCell colSpan={5} sx={{ color: tokens.content.muted, py: 2 }}>Sin ventas en el período indicado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {filas.length === 0 && <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>Sin ventas en el período indicado.</Typography>}
                {filas.map((fila) => (
                  <Box key={clave(fila.vendedor_id)}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, px: 1.5, py: 0.75, bgcolor: tokens.metric.amount.background, border: `1px solid ${tokens.content.border}`, borderRadius: '6px 6px 0 0' }}>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.content.foreground }}>{fila.vendedor}</Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.content.secondary }}>{fila.clientes} cliente{fila.clientes === 1 ? '' : 's'} · {fila.facturas} factura{fila.facturas === 1 ? '' : 's'}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.content.foreground }}>${money(fila.ventas)}</Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.content.secondary }}>{pct(fila.pct_participacion)}</Typography>
                      </Box>
                    </Box>
                    <Table size="small" sx={{ border: `1px solid ${tokens.content.border}`, borderTop: 0 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: tokens.table.headerBg }}>
                          <TableCell>Fecha</TableCell>
                          <TableCell>Documento</TableCell>
                          <TableCell>Cliente</TableCell>
                          <TableCell align="right">Ventas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(detalle.get(clave(fila.vendedor_id)) ?? []).map((factura) => (
                          <TableRow key={factura.id} sx={{ '& td': { ...celda, fontSize: 12.5, py: 0.45 } }}>
                            <TableCell>{formatFecha(factura.fecha)}</TableCell>
                            <TableCell>{factura.folio}</TableCell>
                            <TableCell>{factura.cliente}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>${money(factura.ventas)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ))}
                {filas.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 3, justifyContent: 'flex-end', flexWrap: 'wrap', px: 1.5, py: 1, bgcolor: tokens.metric.amount.background }}>
                    <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="text.secondary">Clientes</Typography><Typography variant="body2" fontWeight={700}>{resultado.clientes.toLocaleString('es-MX')}</Typography></Box>
                    <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="text.secondary">Facturas</Typography><Typography variant="body2" fontWeight={700}>{resultado.facturas.toLocaleString('es-MX')}</Typography></Box>
                    <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="text.secondary">Ventas totales</Typography><Typography variant="body2" fontWeight={700}>${money(resultado.ventas_totales)}</Typography></Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </>
      )}

      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
    </Stack>
  );
}
