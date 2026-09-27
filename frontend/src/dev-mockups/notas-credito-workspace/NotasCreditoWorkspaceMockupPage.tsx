import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import LinkIcon from '@mui/icons-material/Link';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMediaQuery } from '@mui/material';
import { TRATAMIENTO_OPCIONES } from '../../components/documentos/TratamientoFiscalControl';
import { notaCreditoPuedeAplicarSaldo } from '../../modules/finanzas/aplicarSaldoNotaCredito.logic';
import { formatearFolioDocumento } from '../../utils/documentos.utils';
import {
  ESTATUS_OPCIONES,
  NOTAS,
  type EstatusNota,
  type FacturaOrigenMock,
  type MotivoNc,
  type NotaCreditoMock,
  type PartidaMock,
} from './datos';

const NAVY = '#1d2f68';
const LINE = '#e3e5ec';
const MUTED = '#64748b';

type Seccion = 'cuenta' | 'partidas' | 'fiscal';
type OrdenCampo = 'fecha' | 'folio' | 'total' | 'saldo';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

const ESTATUS_SX: Record<EstatusNota, { bg: string; color: string; label: string }> = {
  borrador: { bg: '#f3f4f6', color: '#374151', label: 'Borrador' },
  emitido: { bg: '#dbeafe', color: '#1d4ed8', label: 'Emitido' },
  timbrado: { bg: '#dcfce7', color: '#166534', label: 'Timbrado' },
  cancelado: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelado' },
};

const MOTIVO_LABEL: Record<MotivoNc, string> = {
  devolucion: 'Devolución',
  bonificacion: 'Bonificación',
  otro: 'Otro',
};

function folioDe(serie: string, numero: number) {
  return formatearFolioDocumento(serie, numero);
}

function formatFecha(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatFechaHora(value: string) {
  const fecha = formatFecha(value);
  const hora = value.slice(11, 16);
  return hora ? `${fecha} ${hora}` : fecha;
}

function aplicadoDe(nota: NotaCreditoMock) {
  return nota.aplicaciones.reduce((sum, item) => sum + item.monto, 0);
}

function filaSaldo(nota: NotaCreditoMock) {
  return {
    saldo: nota.saldo,
    estatus_documento: nota.estatus,
    tratamiento_impuestos: nota.tratamiento,
    cfdi_uuid: nota.uuid,
    cfdi_estado_sat: nota.estadoSat,
    cfdi_cancelacion_estado: nota.cancelacionEstado,
  };
}

function razonAplicarSaldo(nota: NotaCreditoMock): string | null {
  if (nota.contactoId <= 0) return 'Documento sin contacto principal.';
  if (notaCreditoPuedeAplicarSaldo('nota_credito', filaSaldo(nota))) return null;
  if (nota.estatus === 'borrador') return 'El saldo se puede aplicar cuando la nota salga de borrador.';
  if (nota.estatus === 'cancelado') return 'La nota está cancelada.';
  if (!(nota.saldo > 0)) return 'La nota no tiene saldo disponible.';
  if (nota.tratamiento === 'sin_iva') return 'El saldo se puede aplicar cuando la nota de venta esté emitida.';
  return 'El saldo se puede aplicar cuando el CFDI esté timbrado.';
}

function muestraTimbrar(nota: NotaCreditoMock) {
  return nota.tratamiento !== 'sin_iva';
}

function timbrarBloqueado(nota: NotaCreditoMock) {
  return nota.estatus === 'cancelado' || nota.estatus === 'timbrado' || Boolean(nota.uuid);
}

function razonCancelar(nota: NotaCreditoMock): string | null {
  if (nota.estatus === 'cancelado') return 'La nota ya está cancelada.';
  if (nota.estatus === 'borrador') return 'En borrador la nota se elimina.';
  const timbrada = nota.estatus === 'timbrado' || Boolean(nota.uuid);
  if (!timbrada) return null;
  if (nota.aplicaciones.length > 0) return 'No puede cancelarse porque tiene aplicaciones de saldo activas.';
  if (!nota.cfdiPacId) return 'No puede cancelarse porque falta el identificador del PAC.';
  if (nota.cfdiPacModalidad !== 'web' && nota.cfdiPacModalidad !== 'lite') {
    return 'No puede cancelarse porque la modalidad del CFDI es desconocida.';
  }
  if (nota.cancelacionEstado === 'solicitada' || nota.cancelacionEstado === 'pendiente') {
    return 'La cancelación ya fue solicitada y está pendiente de confirmación.';
  }
  if (nota.cancelacionEstado === 'requiere_reconciliacion') return 'El CFDI requiere reconciliación antes de continuar.';
  return null;
}

function situacionFiscal(nota: NotaCreditoMock) {
  if (nota.tratamiento === 'sin_iva') return { label: 'Nota de venta', bg: '#f3f4f6', color: '#374151' };
  if (nota.cancelacionEstado === 'cancelada' || nota.estadoSat === 'Cancelado') {
    return { label: 'CFDI cancelado', bg: '#fee2e2', color: '#991b1b' };
  }
  if (nota.uuid) return { label: 'CFDI timbrado', bg: '#dcfce7', color: '#166534' };
  return { label: 'Sin timbrar', bg: '#fef3c7', color: '#92400e' };
}

function tratamientoLabel(nota: NotaCreditoMock) {
  return TRATAMIENTO_OPCIONES.find((item) => item.value === nota.tratamiento)?.label ?? nota.tratamiento;
}

export default function NotasCreditoWorkspaceMockupPage() {
  const compacto = useMediaQuery('(max-width:1199px)');
  const [seleccionId, setSeleccionId] = useState(1004);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>('cuenta');
  const [busqueda, setBusqueda] = useState('');
  const [estatus, setEstatus] = useState<'todos' | EstatusNota>('todos');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<'' | MotivoNc>('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState<{ campo: OrdenCampo; dir: 'asc' | 'desc' }>({ campo: 'fecha', dir: 'desc' });
  const [menuEstatus, setMenuEstatus] = useState<HTMLElement | null>(null);
  const [menuOrden, setMenuOrden] = useState<HTMLElement | null>(null);
  const [menuEstadoNota, setMenuEstadoNota] = useState<HTMLElement | null>(null);
  const [menuMas, setMenuMas] = useState<HTMLElement | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const previo = document.title;
    document.title = 'Notas de crédito · propuesta';
    return () => {
      document.title = previo;
    };
  }, []);

  const clientes = useMemo(() => [...new Set(NOTAS.map((nota) => nota.cliente))].sort(), []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = NOTAS.filter((nota) => {
      if (estatus !== 'todos' && nota.estatus !== estatus) return false;
      if (soloPendientes && !(nota.saldo > 0)) return false;
      if (clienteFiltro && nota.cliente !== clienteFiltro) return false;
      if (motivoFiltro && nota.motivo !== motivoFiltro) return false;
      if (!q) return true;
      const folio = folioDe(nota.serie, nota.numero).toLowerCase();
      return [folio, nota.cliente, nota.rfc, MOTIVO_LABEL[nota.motivo], nota.concepto ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    const factor = orden.dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (orden.campo === 'fecha') return a.fecha.localeCompare(b.fecha) * factor;
      if (orden.campo === 'total') return (a.total - b.total) * factor;
      if (orden.campo === 'saldo') return (a.saldo - b.saldo) * factor;
      return folioDe(a.serie, a.numero).localeCompare(folioDe(b.serie, b.numero)) * factor;
    });
  }, [busqueda, clienteFiltro, estatus, motivoFiltro, orden, soloPendientes]);

  const seleccion = visibles.find((nota) => nota.id === seleccionId) ?? visibles[0] ?? null;
  const disponibleVisible = visibles.reduce((sum, nota) => sum + nota.saldo, 0);
  const filtrosExtra = Number(Boolean(clienteFiltro)) + Number(Boolean(motivoFiltro));

  const elegir = (nota: NotaCreditoMock) => {
    setSeleccionId(nota.id);
    setSeccion('cuenta');
    if (compacto) setMostrarDetalle(true);
  };

  const avisar = (mensaje: string) => setAviso(mensaje);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#eef1f4', overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ px: 2, height: 36, flexShrink: 0, bgcolor: '#fff8eb', borderBottom: '1px solid #f3e2c0' }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#92400e', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Propuesta
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: '#7c5b2a' }}>
          Workspace de notas de crédito con datos de ejemplo. La vista de producción no cambia.
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', m: { xs: 0, md: 1.5 }, border: { md: `1px solid ${LINE}` }, borderRadius: { md: 2 }, overflow: 'hidden', bgcolor: '#fff' }}>
        {(!compacto || !mostrarDetalle) && (
          <ListaNotas
            notas={visibles}
            totalDisponible={disponibleVisible}
            seleccionId={seleccion?.id ?? null}
            busqueda={busqueda}
            estatus={estatus}
            soloPendientes={soloPendientes}
            filtrosExtra={filtrosExtra}
            onBusqueda={setBusqueda}
            onSoloPendientes={setSoloPendientes}
            onElegir={elegir}
            onAbrirEstatus={(el) => setMenuEstatus(el)}
            onAbrirOrden={(el) => setMenuOrden(el)}
            onAbrirFiltros={() => setFiltrosAbiertos(true)}
            onVistaClasica={() => avisar('La vista clásica sigue siendo la de producción. Esta propuesta no la sustituye.')}
            onNueva={() => avisar('Abriría Nueva nota de crédito, el mismo formulario de hoy.')}
          />
        )}

        {seleccion && (!compacto || mostrarDetalle) ? (
          <DetalleNota
            nota={seleccion}
            seccion={seccion}
            compacto={compacto}
            onSeccion={setSeccion}
            onVolver={() => setMostrarDetalle(false)}
            onAviso={avisar}
            onAbrirEstatus={(el) => setMenuEstadoNota(el)}
            onAbrirMas={(el) => setMenuMas(el)}
          />
        ) : (!compacto || mostrarDetalle) ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
            <Typography sx={{ color: MUTED, fontSize: 14 }}>Ninguna nota coincide con esta vista.</Typography>
          </Stack>
        ) : null}
      </Box>

      <Menu anchorEl={menuEstatus} open={Boolean(menuEstatus)} onClose={() => setMenuEstatus(null)}>
        <MenuItem selected={estatus === 'todos'} onClick={() => { setEstatus('todos'); setMenuEstatus(null); }}>
          Todos
        </MenuItem>
        {ESTATUS_OPCIONES.map((opcion) => (
          <MenuItem key={opcion.value} selected={estatus === opcion.value} onClick={() => { setEstatus(opcion.value); setMenuEstatus(null); }}>
            {opcion.label}
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={menuOrden} open={Boolean(menuOrden)} onClose={() => setMenuOrden(null)}>
        {([
          ['fecha', 'Fecha'],
          ['folio', 'Folio'],
          ['total', 'Total'],
          ['saldo', 'Disponible'],
        ] as const).map(([campo, label]) => (
          <MenuItem
            key={campo}
            onClick={() => {
              setOrden((prev) => ({ campo, dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc' }));
              setMenuOrden(null);
            }}
          >
            {label} {orden.campo === campo ? (orden.dir === 'asc' ? '↑' : '↓') : ''}
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={menuEstadoNota} open={Boolean(menuEstadoNota)} onClose={() => setMenuEstadoNota(null)}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: 11, color: MUTED }}>
          En producción este menú actualiza el estatus.
        </Typography>
        {ESTATUS_OPCIONES.map((opcion) => (
          <MenuItem
            key={opcion.value}
            selected={seleccion?.estatus === opcion.value}
            onClick={() => {
              setMenuEstadoNota(null);
              avisar(`En producción actualizaría el estatus a ${opcion.label}.`);
            }}
          >
            {opcion.label}
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={menuMas} open={Boolean(menuMas)} onClose={() => setMenuMas(null)}>
        <MenuItem
          disabled={Boolean(seleccion && razonCancelar(seleccion))}
          onClick={() => {
            setMenuMas(null);
            avisar('Abriría la cancelación del documento, con el mismo preflight de aplicaciones y CFDI.');
          }}
        >
          <Tooltip title={seleccion ? (razonCancelar(seleccion) ?? '') : ''} placement="left">
            <span>Cancelar documento</span>
          </Tooltip>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuMas(null);
            avisar('Abriría la confirmación de eliminar. Si la nota está timbrada o tiene aplicaciones, el servidor la rechaza.');
          }}
          sx={{ color: '#991b1b' }}
        >
          Eliminar
        </MenuItem>
      </Menu>

      <Drawer anchor="left" open={filtrosAbiertos} onClose={() => setFiltrosAbiertos(false)}>
        <Box sx={{ width: 320, p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Filtros</Typography>
            <IconButton size="small" onClick={() => setFiltrosAbiertos(false)}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
          <TextField
            select
            fullWidth
            size="small"
            label="Cliente"
            value={clienteFiltro}
            onChange={(event) => setClienteFiltro(event.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {clientes.map((cliente) => <MenuItem key={cliente} value={cliente}>{cliente}</MenuItem>)}
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Motivo"
            value={motivoFiltro}
            onChange={(event) => setMotivoFiltro(event.target.value as '' | MotivoNc)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="devolucion">Devolución</MenuItem>
            <MenuItem value="bonificacion">Bonificación</MenuItem>
            <MenuItem value="otro">Otro</MenuItem>
          </TextField>
          <Button
            sx={{ mt: 2, textTransform: 'none' }}
            onClick={() => {
              setClienteFiltro('');
              setMotivoFiltro('');
            }}
          >
            Limpiar
          </Button>
        </Box>
      </Drawer>

      <Snackbar
        open={Boolean(aviso)}
        autoHideDuration={4200}
        onClose={() => setAviso(null)}
        message={aviso ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function ListaNotas({
  notas,
  totalDisponible,
  seleccionId,
  busqueda,
  estatus,
  soloPendientes,
  filtrosExtra,
  onBusqueda,
  onSoloPendientes,
  onElegir,
  onAbrirEstatus,
  onAbrirOrden,
  onAbrirFiltros,
  onVistaClasica,
  onNueva,
}: {
  notas: NotaCreditoMock[];
  totalDisponible: number;
  seleccionId: number | null;
  busqueda: string;
  estatus: 'todos' | EstatusNota;
  soloPendientes: boolean;
  filtrosExtra: number;
  onBusqueda: (value: string) => void;
  onSoloPendientes: (value: boolean) => void;
  onElegir: (nota: NotaCreditoMock) => void;
  onAbrirEstatus: (el: HTMLElement) => void;
  onAbrirOrden: (el: HTMLElement) => void;
  onAbrirFiltros: () => void;
  onVistaClasica: () => void;
  onNueva: () => void;
}) {
  const etiquetaEstatus = estatus === 'todos' ? 'Todos' : ESTATUS_SX[estatus].label;
  return (
    <Box sx={{ width: { xs: '100%', lg: 372 }, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${LINE}`, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, height: 52, gap: 1 }}>
        <Typography variant="body2" color="text.secondary" noWrap>
          <b>{notas.length}</b> notas · <b>{currency.format(totalDisponible)}</b> disponibles
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button size="small" variant="outlined" onClick={onVistaClasica} sx={{ textTransform: 'none', fontSize: 11, whiteSpace: 'nowrap' }}>
            Vista clásica
          </Button>
          <Tooltip title="Nueva nota de crédito">
            <IconButton size="small" onClick={onNueva} sx={{ bgcolor: NAVY, color: '#fff', '&:hover': { bgcolor: '#162551' } }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.75, pb: 1 }}>
        <TextField
          size="small"
          placeholder="Buscar folio, cliente, RFC…"
          value={busqueda}
          onChange={(event) => onBusqueda(event.target.value)}
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.disabled' }} />,
            endAdornment: busqueda ? (
              <IconButton size="small" onClick={() => onBusqueda('')}><CloseIcon fontSize="small" /></IconButton>
            ) : null,
          }}
          sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: 13 } }}
        />
        <Button size="small" variant="outlined" endIcon={<ExpandMoreIcon />} onClick={(event) => onAbrirEstatus(event.currentTarget)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
          {etiquetaEstatus}
        </Button>
        <Tooltip title="Ordenar">
          <IconButton size="small" onClick={(event) => onAbrirOrden(event.currentTarget)}><SwapVertIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Filtros">
          <IconButton size="small" onClick={onAbrirFiltros} sx={{ position: 'relative' }}>
            <FilterAltOutlinedIcon fontSize="small" />
            {filtrosExtra > 0 ? (
              <Box sx={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', bgcolor: NAVY }} />
            ) : null}
          </IconButton>
        </Tooltip>
      </Stack>
      <FormControlLabel
        sx={{ mx: 1.5, mb: 0.5, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
        control={<Checkbox size="small" checked={soloPendientes} onChange={(event) => onSoloPendientes(event.target.checked)} />}
        label="Solo pendientes"
      />
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {notas.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: MUTED, fontSize: 13 }}>Sin resultados.</Typography>
        ) : notas.map((nota) => {
          const activa = nota.id === seleccionId;
          const aplicado = aplicadoDe(nota);
          const pct = nota.total > 0 ? Math.min(100, Math.round((aplicado / nota.total) * 100)) : 0;
          const est = ESTATUS_SX[nota.estatus];
          const agotada = nota.saldo <= 0 && nota.estatus !== 'cancelado';
          return (
            <Box
              key={nota.id}
              component="button"
              type="button"
              onClick={() => onElegir(nota)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                px: 1.75,
                py: 1.05,
                cursor: 'pointer',
                border: 0,
                borderBottom: '1px solid #eef0f3',
                bgcolor: activa ? '#eef1fb' : 'transparent',
                borderLeft: '3px solid',
                borderLeftColor: activa ? NAVY : 'transparent',
                '&:hover': { bgcolor: activa ? '#eef1fb' : '#f8f9fc' },
              }}
            >
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800 }} noWrap>{folioDe(nota.serie, nota.numero)}</Typography>
                <Typography sx={{ fontSize: 12, color: MUTED, flex: 1 }} noWrap>{MOTIVO_LABEL[nota.motivo]}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: agotada ? '#166534' : nota.estatus === 'cancelado' ? MUTED : NAVY, fontVariantNumeric: 'tabular-nums' }}>
                  <Box component="span" sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', mr: 0.45 }}>disp.</Box>
                  {currency.format(nota.saldo)}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: '#334155', mt: 0.15 }} noWrap>{nota.cliente}</Typography>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.45 }}>
                <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>{formatFecha(nota.fecha)}</Typography>
                <Chip label={est.label} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: est.bg, color: est.color }} />
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>
                  {nota.origenes.length === 0 ? 'Directa' : nota.origenes.length === 1 ? '1 origen' : `${nota.origenes.length} orígenes`}
                </Typography>
              </Stack>
              <Tooltip title={`${pct}% del importe ya está aplicado`}>
                <Box sx={{ mt: 0.7, height: 3, borderRadius: 99, bgcolor: '#e7ebf2', overflow: 'hidden' }}>
                  <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: agotada ? '#16a34a' : NAVY }} />
                </Box>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function DetalleNota({
  nota,
  seccion,
  compacto,
  onSeccion,
  onVolver,
  onAviso,
  onAbrirEstatus,
  onAbrirMas,
}: {
  nota: NotaCreditoMock;
  seccion: Seccion;
  compacto: boolean;
  onSeccion: (seccion: Seccion) => void;
  onVolver: () => void;
  onAviso: (mensaje: string) => void;
  onAbrirEstatus: (el: HTMLElement) => void;
  onAbrirMas: (el: HTMLElement) => void;
}) {
  const aplicado = aplicadoDe(nota);
  const pct = nota.total > 0 ? Math.min(100, (aplicado / nota.total) * 100) : 0;
  const bloqueoSaldo = razonAplicarSaldo(nota);
  const est = ESTATUS_SX[nota.estatus];
  const fiscal = situacionFiscal(nota);
  const agotada = nota.saldo <= 0 && nota.estatus !== 'cancelado';

  const iconoSx = {
    width: 32,
    height: 32,
    border: '1px solid #d7dde7',
    borderRadius: 1,
    color: NAVY,
  } as const;

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: { xs: 1.5, md: 2.5 }, pt: 1.5, pb: 1.25, borderBottom: `1px solid ${LINE}` }}>
        {compacto ? (
          <Button startIcon={<ArrowBackIcon />} onClick={onVolver} sx={{ textTransform: 'none', mb: 0.5, ml: -1, color: NAVY }}>
            Notas
          </Button>
        ) : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                {folioDe(nota.serie, nota.numero)}
              </Typography>
              <Typography sx={{ fontSize: 13, color: MUTED }}>{formatFecha(nota.fecha)}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1e293b', mt: 0.15 }} noWrap>
              {nota.cliente}
            </Typography>
            <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
              <Chip label={MOTIVO_LABEL[nota.motivo]} size="small" sx={{ height: 22, fontWeight: 700, fontSize: 11.5, bgcolor: '#eef1fb', color: NAVY }} />
              {nota.concepto ? (
                <Typography sx={{ fontSize: 12.5, color: '#334155' }}>{nota.concepto}</Typography>
              ) : null}
              <Chip
                label={est.label}
                size="small"
                onClick={(event) => onAbrirEstatus(event.currentTarget)}
                onDelete={(event) => onAbrirEstatus(event.currentTarget)}
                deleteIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: `${est.color} !important` }} />}
                sx={{ height: 22, fontWeight: 700, fontSize: 11.5, bgcolor: est.bg, color: est.color, cursor: 'pointer' }}
              />
              <Chip label={fiscal.label} size="small" sx={{ height: 22, fontWeight: 700, fontSize: 11.5, bgcolor: fiscal.bg, color: fiscal.color }} />
            </Stack>
            {nota.observaciones ? (
              <Typography sx={{ mt: 0.9, fontSize: 13, color: '#475569' }}>{nota.observaciones}</Typography>
            ) : null}
          </Box>

          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexShrink: 0, pt: 0.25 }}>
            <Tooltip title={bloqueoSaldo ?? 'Aplicar saldo a facturas del mismo cliente, moneda y tratamiento'}>
              <span>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<LinkIcon />}
                  disabled={Boolean(bloqueoSaldo)}
                  onClick={() => onAviso('Abriría Aplicar saldo, el diálogo que ya reparte el disponible entre facturas del cliente.')}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: NAVY, boxShadow: 'none', '&:hover': { bgcolor: '#162551', boxShadow: 'none' } }}
                >
                  Aplicar saldo
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Ver / Imprimir PDF">
              <IconButton size="small" sx={iconoSx} onClick={() => onAviso('Abriría el PDF de la nota.')}><PrintOutlinedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Descargar PDF">
              <IconButton size="small" sx={iconoSx} onClick={() => onAviso('Descargaría el PDF. La nota no ofrece descarga de CFDI en la vista actual.')}><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
            </Tooltip>
            {muestraTimbrar(nota) ? (
              <Tooltip title={timbrarBloqueado(nota) ? (nota.estatus === 'cancelado' ? 'La nota está cancelada.' : 'CFDI ya timbrado') : 'Timbrar CFDI'}>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Timbrar CFDI"
                    sx={iconoSx}
                    disabled={timbrarBloqueado(nota)}
                    onClick={() => onAviso('Llamaría al timbrado CFDI que ya usa la nota de crédito.')}
                  >
                    <NotificationsActiveOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip title="Editar">
              <IconButton size="small" sx={iconoSx} onClick={() => onAviso('Abriría el formulario de la nota.')}><EditOutlinedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Más acciones">
              <IconButton size="small" sx={iconoSx} onClick={(event) => onAbrirMas(event.currentTarget)}><MoreHorizIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Box sx={{ mt: 1.6, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr 1.15fr' }, border: `1px solid ${LINE}`, borderRadius: 1.5, overflow: 'hidden' }}>
          <Cifra label="Importe" valor={currency.format(nota.total)} detalle={nota.tratamiento === 'sin_iva' ? 'Sin IVA' : `IVA ${currency.format(nota.iva)}`} />
          <Cifra label="Aplicado" valor={currency.format(aplicado)} detalle={nota.aplicaciones.length === 0 ? 'Sin aplicaciones' : `${nota.aplicaciones.length} factura${nota.aplicaciones.length === 1 ? '' : 's'}`} />
          <Cifra
            label="Disponible"
            valor={currency.format(nota.saldo)}
            detalle={agotada ? 'Saldo aplicado por completo' : nota.estatus === 'cancelado' ? 'Nota cancelada' : bloqueoSaldo ? 'Saldo de la nota' : 'Puede aplicarse'}
            destacado
            tono={agotada ? 'agotado' : nota.estatus === 'cancelado' ? 'cancelado' : 'disponible'}
          />
        </Box>
        <Box sx={{ mt: 1, height: 6, borderRadius: 99, bgcolor: '#e7ebf2', overflow: 'hidden' }}>
          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: agotada ? '#16a34a' : NAVY }} />
        </Box>
        {bloqueoSaldo ? (
          <Typography sx={{ mt: 0.8, fontSize: 12.5, color: '#475569' }}>{bloqueoSaldo}</Typography>
        ) : null}
      </Box>

      <Tabs
        value={seccion}
        onChange={(_event, value: Seccion) => onSeccion(value)}
        sx={{ px: { xs: 1, md: 2 }, minHeight: 40, borderBottom: `1px solid ${LINE}`, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 700, fontSize: 13.5 } }}
      >
        <Tab value="cuenta" label="Cuenta" />
        <Tab value="partidas" label={`Partidas · ${nota.partidas.length}`} />
        <Tab value="fiscal" label="Fiscal" />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 2.5 }, bgcolor: '#f8f9fb' }}>
        {seccion === 'cuenta' ? <SeccionCuenta nota={nota} bloqueoSaldo={bloqueoSaldo} onAviso={onAviso} /> : null}
        {seccion === 'partidas' ? <SeccionPartidas nota={nota} /> : null}
        {seccion === 'fiscal' ? <SeccionFiscal nota={nota} onAviso={onAviso} /> : null}
      </Box>
    </Box>
  );
}

function Cifra({
  label,
  valor,
  detalle,
  destacado,
  tono,
}: {
  label: string;
  valor: string;
  detalle: string;
  destacado?: boolean;
  tono?: 'disponible' | 'agotado' | 'cancelado';
}) {
  const color = tono === 'agotado' ? '#166534' : tono === 'cancelado' ? MUTED : NAVY;
  return (
    <Box sx={{ px: 1.6, py: 1.15, bgcolor: destacado ? '#f4f6fb' : '#fff', borderRight: { sm: `1px solid ${LINE}` }, '&:last-child': { borderRight: 'none' } }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8b93a7' }}>{label}</Typography>
      <Typography sx={{ mt: 0.35, fontSize: destacado ? 22 : 16, fontWeight: 800, color: destacado ? color : '#1e293b', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {valor}
      </Typography>
      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.15 }}>{detalle}</Typography>
    </Box>
  );
}

function SeccionCuenta({
  nota,
  bloqueoSaldo,
  onAviso,
}: {
  nota: NotaCreditoMock;
  bloqueoSaldo: string | null;
  onAviso: (mensaje: string) => void;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, alignItems: 'start' }}>
      <Columna titulo={nota.origenes.length > 1 ? `Proviene de · ${nota.origenes.length} facturas` : 'Proviene de'}>
        {nota.origenes.length === 0 ? (
          <TarjetaQuietud
            titulo="Captura directa"
            texto={nota.concepto ? `Concepto: ${nota.concepto}. No está ligada a una factura.` : 'No está ligada a una factura.'}
          />
        ) : nota.origenes.map((origen) => (
          <TarjetaDocumento
            key={origen.id}
            folio={folioDe(origen.serie, origen.numero)}
            meta={`${formatFecha(origen.fecha)} · ${origen.estatus}`}
            monto={currency.format(origen.total)}
            detalle={detalleOrigen(nota, origen)}
            onClick={() => onAviso(`En producción abriría la factura ${folioDe(origen.serie, origen.numero)}.`)}
          />
        ))}
      </Columna>
      <Columna titulo="Aplicado en">
        {nota.aplicaciones.length === 0 ? (
          <TarjetaQuietud
            titulo="Sin aplicaciones"
            texto={bloqueoSaldo
              ? 'Las facturas destino aparecen aquí cuando el saldo se aplica.'
              : 'El saldo puede aplicarse a facturas del mismo cliente, con la misma moneda y el mismo tratamiento de impuestos.'}
          />
        ) : (
          <>
            {nota.aplicaciones.map((aplicacion) => (
              <TarjetaDocumento
                key={aplicacion.id}
                folio={folioDe(aplicacion.serie, aplicacion.numero)}
                meta={formatFecha(aplicacion.fecha)}
                monto={currency.format(aplicacion.monto)}
                detalle="Aplicación de saldo"
                onClick={() => onAviso(`En producción abriría la factura ${folioDe(aplicacion.serie, aplicacion.numero)}.`)}
              />
            ))}
          </>
        )}
      </Columna>
    </Box>
  );
}

function detalleOrigen(nota: NotaCreditoMock, origen: FacturaOrigenMock) {
  const partidas = nota.partidas.filter((partida) => partida.origenId === origen.id).length;
  if (partidas === 0) return 'Factura origen';
  return partidas === 1 ? '1 partida de esta factura' : `${partidas} partidas de esta factura`;
}

function Columna({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b93a7', px: 0.4 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  );
}

function TarjetaDocumento({
  folio,
  meta,
  monto,
  detalle,
  onClick,
}: {
  folio: string;
  meta: string;
  monto: string;
  detalle: string;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        textAlign: 'left',
        width: '100%',
        border: `1px solid ${LINE}`,
        borderRadius: 1.25,
        bgcolor: '#fff',
        px: 1.25,
        py: 1,
        cursor: 'pointer',
        font: 'inherit',
        '&:hover': { borderColor: '#c5cde0', bgcolor: '#f8faff' },
      }}
    >
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{folio}</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1e293b' }}>{monto}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.2 }}>{meta}</Typography>
      <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.35 }}>{detalle}</Typography>
    </Box>
  );
}

function TarjetaQuietud({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Box sx={{ border: '1px dashed #d7dde7', borderRadius: 1.25, px: 1.25, py: 1.15, bgcolor: '#fafbfc' }}>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>{titulo}</Typography>
      <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.35 }}>{texto}</Typography>
    </Box>
  );
}

function SeccionPartidas({ nota }: { nota: NotaCreditoMock }) {
  const grupos = nota.origenes.length > 1
    ? nota.origenes.map((origen) => ({
      clave: String(origen.id),
      titulo: `Desde ${folioDe(origen.serie, origen.numero)}`,
      partidas: nota.partidas.filter((partida) => partida.origenId === origen.id),
    }))
    : [{
      clave: 'unica',
      titulo: nota.origenes[0] ? `Tomadas de ${folioDe(nota.origenes[0].serie, nota.origenes[0].numero)}` : 'Captura directa',
      partidas: nota.partidas,
    }];

  return (
    <Stack spacing={1.5}>
      {grupos.map((grupo) => (
        <Box key={grupo.clave} sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, overflow: 'hidden' }}>
          <Typography sx={{ px: 1.5, py: 1, fontSize: 12, fontWeight: 800, color: NAVY, bgcolor: '#f8f9fc', borderBottom: `1px solid ${LINE}` }}>
            {grupo.titulo}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <TablaPartidas partidas={grupo.partidas} />
          </Box>
        </Box>
      ))}
      <Box sx={{ alignSelf: 'flex-end', minWidth: 240, bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, px: 1.5, py: 1.1 }}>
        <LineaTotal label="Subtotal" valor={currency.format(nota.subtotal)} />
        {nota.descuento > 0 ? <LineaTotal label="Descuento" valor={currency.format(nota.descuento)} /> : null}
        <LineaTotal label="IVA trasladado" valor={currency.format(nota.iva)} />
        <LineaTotal label="Total" valor={currency.format(nota.total)} fuerte />
      </Box>
    </Stack>
  );
}

function TablaPartidas({ partidas }: { partidas: PartidaMock[] }) {
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 1.5, py: 0.85, fontSize: 13, textAlign: 'left' }, '& th': { fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8b93a7', fontWeight: 700 } }}>
      <thead>
        <tr>
          <th>Clave</th>
          <th>Descripción</th>
          <th style={{ textAlign: 'right' }}>Cant.</th>
          <th style={{ textAlign: 'right' }}>Precio</th>
          <th style={{ textAlign: 'right' }}>Importe</th>
        </tr>
      </thead>
      <tbody>
        {partidas.map((partida) => (
          <tr key={partida.id}>
            <td style={{ color: MUTED }}>{partida.clave}</td>
            <td style={{ fontWeight: 600 }}>{partida.descripcion}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{partida.cantidad}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{currency.format(partida.precio)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{currency.format(partida.importe)}</td>
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

function LineaTotal({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: fuerte ? 14 : 13, fontWeight: fuerte ? 800 : 500, color: fuerte ? '#0f172a' : MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: fuerte ? 14 : 13, fontWeight: fuerte ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
    </Stack>
  );
}

function SeccionFiscal({ nota, onAviso }: { nota: NotaCreditoMock; onAviso: (mensaje: string) => void }) {
  const esNotaVenta = nota.tratamiento === 'sin_iva';
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
      <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, p: 1.75 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b93a7' }}>Tratamiento</Typography>
        <Typography sx={{ mt: 0.4, fontSize: 16, fontWeight: 800 }}>{tratamientoLabel(nota)}</Typography>
        <Typography sx={{ mt: 0.6, fontSize: 13.5, color: '#334155', maxWidth: 560 }}>
          {esNotaVenta
            ? 'Esta nota es una nota de venta. No genera CFDI. El saldo se puede aplicar cuando está emitida.'
            : nota.estatus === 'cancelado'
              ? 'La nota está cancelada. El CFDI quedó cancelado y el saldo queda cerrado.'
              : nota.uuid
                ? 'El CFDI está timbrado. Con el comprobante vigente, el saldo se puede aplicar.'
                : 'Esta nota es fiscal. El saldo se puede aplicar cuando el CFDI quede timbrado.'}
        </Typography>
      </Box>

      {esNotaVenta ? null : (
        <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, p: 1.75 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b93a7', mb: 1.2 }}>Receptor</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
            <Dato label="RFC" valor={nota.rfc} />
            <Dato label="Nombre" valor={nota.cliente} />
            <Dato label="Régimen fiscal" valor={nota.regimen} />
            <Dato label="Uso de CFDI" valor={nota.usoCfdi} />
            <Dato label="Forma de pago" valor={nota.formaPago} />
            <Dato label="Método de pago" valor={nota.metodoPago} />
            <Dato label="Código postal" valor={nota.codigoPostal} />
          </Box>
        </Box>
      )}

      {esNotaVenta ? null : nota.uuid ? (
        <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, p: 1.75 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b93a7' }}>Timbrado</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.8 }}>
            <Typography sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, fontWeight: 700 }}>{nota.uuid}</Typography>
            <Tooltip title="Copiar UUID">
              <IconButton
                size="small"
                onClick={() => {
                  void navigator.clipboard?.writeText(nota.uuid ?? '');
                  onAviso('UUID copiado.');
                }}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mt: 1.2 }}>
            <Dato label="Fecha de timbrado" valor={nota.fechaTimbrado ? formatFechaHora(nota.fechaTimbrado) : null} />
            <Dato label="Estado SAT" valor={nota.estadoSat} />
            <Dato label="PAC" valor={nota.cfdiPacModalidad} />
            <Dato label="Cancelación" valor={nota.cancelacionEstado ? nota.cancelacionEstado.replaceAll('_', ' ') : 'No solicitada'} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #f3e2c0', borderRadius: 1.5, p: 1.75 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>Pendiente de timbrar</Typography>
          <Typography sx={{ mt: 0.45, fontSize: 13, color: '#7c5b2a' }}>
            {nota.estatus === 'borrador'
              ? 'La nota sigue en borrador. Timbrar CFDI está disponible para este tratamiento.'
              : 'La nota ya está emitida. Timbrar CFDI deja el estatus en Timbrado y habilita aplicar el saldo.'}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

function Dato({ label, valor }: { label: string; valor: string | null }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{valor || '—'}</Typography>
    </Box>
  );
}
