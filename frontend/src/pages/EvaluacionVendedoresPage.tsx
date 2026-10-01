import * as React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Drawer, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/es';
import dayjs from 'dayjs';
import { obtenerBloques, obtenerMetricas, type BloquePendiente, type BloqueRespondido, type VendedorMetrica } from '../services/evaluacionVendedoresService';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../components/grids/standardDataGridSx';
import { esRolAdmin } from '../session/rolScope';
import { useSession } from '../session/useSession';

const formatoTiempo = (s: number | null | undefined) => {
  if (s == null) return 'Sin datos'; if (s === 0) return '0 s';
  const n = Math.floor(s), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), sec = n % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s` : m ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`;
};
const fechaHora = (v: string) => dayjs(v).isValid() ? dayjs(v).format('DD/MM/YYYY HH:mm') : 'Sin fecha';
const periodo = (a: string, b: string) => `${dayjs(a).locale('es').format('D MMM YYYY')} – ${dayjs(b).locale('es').format('D MMM YYYY')}`;
const origen = (v: string) => v === 'manual' ? 'Manual' : v === 'plantilla_manual' ? 'Plantilla manual' : v;

function BloqueCard({ bloque, vendedor }: { bloque: BloqueRespondido | BloquePendiente; vendedor: VendedorMetrica }) {
  const respondido = 'fecha_respuesta' in bloque;
  const contacto = bloque as BloqueRespondido & { contacto_nombre?: string | null; contacto_nombre_contacto?: string | null; contacto_telefono?: string | null; contacto_telefono_secundario?: string | null };
  const nombre = contacto.contacto_nombre_contacto?.trim() || contacto.contacto_nombre?.trim();
  const telefono = contacto.contacto_telefono?.trim() || contacto.contacto_telefono_secundario?.trim();
  const nombreEsTelefono = nombre && telefono && nombre === telefono;
  const identificador = nombre && !nombreEsTelefono ? `${nombre}${telefono ? ` · ${telefono}` : ''}` : telefono || nombre || `Contacto #${bloque.contacto_id}`;
  const responsable = !respondido ? bloque.responsable_vigente_contacto_id : null;
  const responsableTexto = responsable == null ? 'Sin responsable' : responsable === vendedor.vendedor_contacto_id ? (vendedor.nombre ?? `Vendedor ID ${responsable}`) : `Vendedor ID ${responsable}`;
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
    <Typography fontWeight={700}>Conversación con {identificador}</Typography>
    <Typography variant="caption" color="text.secondary">#{bloque.conversacion_id}</Typography>
    <Typography variant="body2" color="text.secondary">Contacto: {identificador}</Typography>
    <Typography variant="body2">Inicio: {fechaHora(bloque.fecha_inicio_bloque)}</Typography>
    {respondido ? <><Typography variant="body2">Respuesta: {fechaHora(bloque.fecha_respuesta)}</Typography><Typography variant="body2">Tiempo transcurrido: {formatoTiempo(bloque.tiempo_total_segundos)}</Typography><Typography variant="body2">Tiempo laboral: {formatoTiempo(bloque.tiempo_laboral_segundos)}</Typography><Typography variant="body2">Origen: {origen(bloque.origen_respuesta)}</Typography><Stack direction="row" gap={.75} flexWrap="wrap">{bloque.reasignado_durante_espera && <Chip size="small" label="Reasignado" variant="outlined" />}{bloque.respuesta_por_tercero && <Chip size="small" label="Respuesta por tercero" variant="outlined" />}{bloque.primera_respuesta_elegible_para_kpi && <Chip size="small" label="Primera respuesta elegible" variant="outlined" />}</Stack></> : <><Typography variant="body2">Responsable actual: {responsableTexto}</Typography><Typography variant="body2">Tiempo transcurrido: {formatoTiempo(bloque.tiempo_total_actual)}</Typography><Typography variant="body2">Tiempo laboral transcurrido: {formatoTiempo(bloque.tiempo_laboral_actual)}</Typography>{bloque.reasignado_desde_inicio && <Chip size="small" label="Reasignado desde el inicio" variant="outlined" />}</>}
  </Stack></Paper>;
}

export default function EvaluacionVendedoresPage() {
  const navigate = useNavigate();
  const tokens = useTheme().emphasys;
  const { session } = useSession(); const puedeAcceder = esRolAdmin(session.roles);
  const [desde, setDesde] = React.useState(dayjs().startOf('month').format('YYYY-MM-DD')); const [hasta, setHasta] = React.useState(dayjs().format('YYYY-MM-DD')); const [vendedores, setVendedores] = React.useState<VendedorMetrica[]>([]); const [loading, setLoading] = React.useState(false); const [error, setError] = React.useState<string | null>(null); const [seleccionado, setSeleccionado] = React.useState<VendedorMetrica | null>(null); const [tab, setTab] = React.useState<'respondido'|'pendiente'>('respondido'); const [bloques, setBloques] = React.useState<{respondidos: BloqueRespondido[]; pendientes: BloquePendiente[]}>({ respondidos: [], pendientes: [] }); const [loadingBloques, setLoadingBloques] = React.useState(false); const [errorBloques, setErrorBloques] = React.useState<string | null>(null); const [cargados, setCargados] = React.useState<Partial<Record<'respondido'|'pendiente', boolean>>>({});
  const cargar = React.useCallback(async () => { setLoading(true); setError(null); try { setVendedores((await obtenerMetricas(desde, hasta)).vendedores); } catch { setError('No se pudieron cargar las métricas. Intenta nuevamente.'); setVendedores([]); } finally { setLoading(false); } }, [desde, hasta]);
  React.useEffect(() => { if (puedeAcceder) void cargar(); }, [cargar, puedeAcceder]);
  const cargarBloques = React.useCallback(async (estado: 'respondido'|'pendiente') => { if (!seleccionado || cargados[estado]) return; setLoadingBloques(true); setErrorBloques(null); try { const r = await obtenerBloques(desde, hasta, seleccionado.vendedor_contacto_id, estado); setBloques(p => ({ respondidos: estado === 'respondido' ? r.bloques_respondidos : p.respondidos, pendientes: estado === 'pendiente' ? r.bloques_pendientes : p.pendientes })); setCargados(p => ({ ...p, [estado]: true })); } catch { setErrorBloques('No se pudieron cargar los bloques. Intenta nuevamente.'); } finally { setLoadingBloques(false); } }, [cargados, desde, hasta, seleccionado]);
  React.useEffect(() => { if (seleccionado) void cargarBloques(tab); }, [tab, seleccionado, cargarBloques]);
  const abrir = (v: VendedorMetrica) => { setSeleccionado(v); setTab('respondido'); setBloques({ respondidos: [], pendientes: [] }); setCargados({}); setErrorBloques(null); };
  const columnas = React.useMemo<GridColDef<VendedorMetrica>[]>(() => [
    { field: 'nombre', headerName: 'Vendedor', flex: 1.6, minWidth: 220, valueGetter: (_v, r) => r.nombre ?? `Vendedor ${r.vendedor_contacto_id}` },
    { field: 'conversaciones_atendidas', headerName: 'Conversaciones', width: 140, align: 'right', headerAlign: 'right' },
    { field: 'respuestas_validas_para_kpi', headerName: 'Respuestas evaluables', width: 180, align: 'right', headerAlign: 'right' },
    { field: 'tiempo_promedio_respuesta_laboral', headerName: 'Tiempo prom. respuesta', minWidth: 190, flex: 0.8, align: 'right', headerAlign: 'right', valueFormatter: v => formatoTiempo(v) },
    { field: 'conversaciones_pendientes_respuesta', headerName: 'Pendientes', width: 120, align: 'right', headerAlign: 'right' },
    { field: 'detalle', headerName: 'Detalle', sortable: false, filterable: false, width: 108, align: 'right', headerAlign: 'right', renderCell: p => <Button size="small" variant="text" startIcon={<VisibilityOutlined sx={{ fontSize: 16 }} />} onClick={(event) => { event.stopPropagation(); abrir(p.row); }} sx={{ textTransform: 'none', fontWeight: 650, minWidth: 0, color: tokens.content.secondary }}>Ver</Button> },
  ], [tokens.content.secondary]);
  const campoSx: SxProps<Theme> = {
    width: { xs: '100%', sm: 168 },
    '& .MuiOutlinedInput-root': {
      bgcolor: tokens.content.well,
      borderRadius: 2,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.muted },
      '&.Mui-focused fieldset': { borderColor: tokens.action.info },
    },
  };
  const kpis = [
    ['Vendedores', vendedores.length],
    ['Conversaciones', vendedores.reduce((s, v) => s + v.conversaciones_atendidas, 0)],
    ['Respuestas evaluables', vendedores.reduce((s, v) => s + v.respuestas_validas_para_kpi, 0)],
    ['Pendientes', vendedores.reduce((s, v) => s + v.conversaciones_pendientes_respuesta, 0)],
  ];
  if (!puedeAcceder) return <Alert severity="warning" sx={{ m: 2 }}>No tienes permisos para consultar la evaluación de vendedores.</Alert>;
  return <Stack spacing={1.5} sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
      <Box component="button" type="button" onClick={() => navigate('/crm')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', font: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.content.muted, flexShrink: 0 }}>
        <ArrowBackIcon sx={{ fontSize: 14 }} />
        CRM
      </Box>
      <Typography sx={{ color: tokens.content.muted, fontSize: 11, lineHeight: 1 }}>/</Typography>
      <Typography noWrap sx={{ fontSize: 11, letterSpacing: '0.14em', color: tokens.content.foreground, minWidth: 0 }}>EVALUACIÓN DE VENDEDORES</Typography>
    </Stack>
    <Box>
      <Typography variant="figure" sx={{ fontSize: { xs: 26, sm: 30 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>Evaluación de vendedores</Typography>
      <Typography sx={{ mt: 0.6, fontSize: 13, lineHeight: 1.45, color: tokens.content.muted, maxWidth: 640 }}>Consulta métricas de atención y revisa el detalle de las conversaciones.</Typography>
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.elevated }}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <DatePicker label="Fecha inicial" format="DD/MM/YYYY" value={dayjs(desde)} onChange={v => v?.isValid() && setDesde(v.format('YYYY-MM-DD'))} slotProps={{ textField: { size: 'small', sx: campoSx } }} />
        <DatePicker label="Fecha final" format="DD/MM/YYYY" value={dayjs(hasta)} onChange={v => v?.isValid() && setHasta(v.format('YYYY-MM-DD'))} slotProps={{ textField: { size: 'small', sx: campoSx } }} />
      </LocalizationProvider>
      <Button variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 650, borderRadius: 2, boxShadow: 'none', minHeight: 40, width: { xs: '100%', sm: 'auto' } }} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshRounded />} disabled={loading} onClick={() => void cargar()}>Actualizar</Button>
    </Box>
    {error ? <Alert severity="error">{error}</Alert> : loading ? <Box sx={{ minHeight: 120, display: 'grid', placeItems: 'center', borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well }}><CircularProgress size={22} /></Box> : !vendedores.length ? <Alert severity="info">No hay métricas disponibles para el periodo seleccionado.</Alert> : <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 0.8 }}>
        {kpis.map(([label, value]) => (
          <Box key={String(label)} sx={{ minWidth: 0, bgcolor: tokens.metric.amount.background, borderRadius: 2, px: 1.5, py: 1 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{label}</Typography>
            <Typography variant="figure" sx={{ mt: 0.15, fontSize: { xs: 20, sm: 24 }, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>{Number(value).toLocaleString('es-MX')}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ borderRadius: 3, border: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well, overflow: 'auto' }}>
        <DataGrid rows={vendedores} getRowId={r => r.vendedor_contacto_id} columns={columnas} autoHeight disableRowSelectionOnClick onRowClick={p => abrir(p.row)} localeText={esES.components.MuiDataGrid.defaultProps.localeText} rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT} columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT} sx={[standardDataGridSx, { border: 'none', bgcolor: tokens.content.well, minWidth: 860, '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: tokens.table.headerBg, color: tokens.table.headerFg }, '& .MuiDataGrid-columnHeaderTitle, & .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIcon': { color: tokens.table.headerFg }, '& .MuiDataGrid-columnHeaderTitle': { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }, '& .MuiDataGrid-columnSeparator': { color: tokens.table.line }, '& .MuiDataGrid-cell': { borderColor: tokens.table.line, fontSize: 13, fontVariantNumeric: 'tabular-nums' }, '& .MuiDataGrid-row:hover': { backgroundColor: tokens.content.hover }, '& .MuiDataGrid-footerContainer': { borderColor: tokens.table.line } }]} />
      </Box>
    </>}
    <Drawer anchor="right" open={Boolean(seleccionado)} onClose={() => setSeleccionado(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 680, md: 740 } } }}>{seleccionado && <Box sx={{ p: 2.5, height: '100%', overflow: 'auto' }}><Typography variant="h6" fontWeight={700} color="#1d2f68">{seleccionado.nombre ?? `Vendedor ${seleccionado.vendedor_contacto_id}`}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Periodo: {periodo(desde, hasta)}</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}><Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}><Typography variant="overline">Atención</Typography><Typography variant="body2">Conversaciones: {seleccionado.conversaciones_atendidas}</Typography><Typography variant="body2">Respuestas evaluables: {seleccionado.respuestas_validas_para_kpi}</Typography><Typography variant="body2">Pendientes: {seleccionado.conversaciones_pendientes_respuesta}</Typography><Typography variant="body2">Tiempo prom. respuesta: {formatoTiempo(seleccionado.tiempo_promedio_respuesta_laboral)}</Typography></Paper><Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}><Typography variant="overline">Actividad</Typography><Typography variant="body2">Mensajes manuales: {seleccionado.mensajes_manual}</Typography><Typography variant="body2">Plantillas manuales: {seleccionado.mensajes_plantilla_manual}</Typography><Typography variant="body2">Respuestas por tercero: {seleccionado.respuestas_por_tercero}</Typography><Typography variant="body2">Primeras respuestas elegibles: {seleccionado.primeras_respuestas_elegibles}</Typography><Typography variant="body2">Tiempo prom. primera respuesta: {formatoTiempo(seleccionado.tiempo_promedio_primera_respuesta_laboral)}</Typography></Paper></Stack><Tabs value={tab} onChange={(_, v) => setTab(v)}><Tab value="respondido" label="Respondidos" /><Tab value="pendiente" label="Pendientes" /></Tabs>{errorBloques && <Alert severity="error" sx={{ my: 2 }}>{errorBloques}</Alert>}{loadingBloques ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : <Stack spacing={1.5} sx={{ mt: 2 }}>{(tab === 'respondido' ? bloques.respondidos : bloques.pendientes).map(b => <BloqueCard key={`${b.conversacion_id}-${b.fecha_inicio_bloque}`} bloque={b} vendedor={seleccionado} />)}</Stack>}</Box>}</Drawer>
  </Stack>;
}
