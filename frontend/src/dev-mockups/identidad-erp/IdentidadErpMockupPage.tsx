import { useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import CategoryIcon from '@mui/icons-material/Category';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ForumIcon from '@mui/icons-material/Forum';
import InventoryIcon from '@mui/icons-material/Inventory';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import PeopleIcon from '@mui/icons-material/People';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import type { SvgIconComponent } from '@mui/icons-material';
import logo from '../../assets/emphasys-w.png';
import colibri from '../../assets/emphasys-colibri-w.png';

const EDITORIAL = '"Iowan Old Style", Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';

const GRAFITO = '#3c4149';
const SELECCION = '#5e6672';
const PAPEL = '#f4f0e8';
const HOJA = '#fbf7f1';
const ARENA = '#efe4d4';
const LINEA = '#e4ddd2';
const TINTA = '#3e3428';
const SUAVE = '#5c5348';
const APAGADO = '#7a7268';
const SALVIA = '#3f6b52';
const CIELO = '#3d5f86';
const ROSA = '#8a4d45';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

type Estatus = 'borrador' | 'emitido' | 'timbrado' | 'cancelado';

type Fila = {
  id: number;
  folio: string;
  fecha: string;
  cliente: string;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estatus: Estatus;
  uuid: boolean;
  aplicaciones: boolean;
};

const ESTATUS_LABEL: Record<Estatus, string> = {
  borrador: 'Borrador',
  emitido: 'Emitido',
  timbrado: 'Timbrado',
  cancelado: 'Cancelado',
};

const NAV: { id: string; label: string; icon: SvgIconComponent }[] = [
  { id: 'contactos', label: 'Contactos', icon: PeopleIcon },
  { id: 'productos', label: 'Productos', icon: CategoryIcon },
  { id: 'crm', label: 'CRM', icon: ForumIcon },
  { id: 'ventas', label: 'Ventas', icon: PointOfSaleIcon },
  { id: 'compras', label: 'Compras', icon: ShoppingCartIcon },
  { id: 'finanzas', label: 'Finanzas', icon: AccountBalanceIcon },
  { id: 'contabilidad', label: 'Contabilidad', icon: CalculateIcon },
  { id: 'inventarios', label: 'Inventarios', icon: InventoryIcon },
  { id: 'almacenes', label: 'Almacenes', icon: WarehouseIcon },
  { id: 'informes', label: 'Informes', icon: BarChartIcon },
  { id: 'autorizaciones', label: 'Autorizaciones', icon: VerifiedUserIcon },
  { id: 'configuracion', label: 'Configuración', icon: SettingsIcon },
];

const TABS = [
  { id: 'cotizacion', label: 'Cotizaciones' },
  { id: 'pedido', label: 'Pedidos' },
  { id: 'remision', label: 'Remisiones' },
  { id: 'factura', label: 'Facturas' },
  { id: 'nota_credito', label: 'Notas de crédito' },
  { id: 'pago_cliente', label: 'Pagos' },
];

const FACTURAS: Fila[] = [
  { id: 1, folio: 'A-010', fecha: '26/09/2026', cliente: 'ESCUELA KEMPER URGATE', subtotal: 2800, iva: 448, total: 3248, saldo: 3248, estatus: 'borrador', uuid: false, aplicaciones: false },
  { id: 2, folio: 'A-007', fecha: '25/09/2026', cliente: 'ESCUELA KEMPER URGATE', subtotal: 10000, iva: 1600, total: 11600, saldo: 11600, estatus: 'emitido', uuid: false, aplicaciones: false },
  { id: 3, folio: 'A-005', fecha: '22/08/2026', cliente: 'ESCUELA KEMPER URGATE', subtotal: 30695.52, iva: 4911.28, total: 35606.8, saldo: 18400, estatus: 'timbrado', uuid: true, aplicaciones: true },
  { id: 4, folio: 'A-003', fecha: '20/08/2026', cliente: 'ESCUELA KEMPER URGATE', subtotal: 9655.17, iva: 1544.83, total: 11200, saldo: 4200, estatus: 'timbrado', uuid: true, aplicaciones: true },
  { id: 5, folio: 'A-002', fecha: '24/09/2026', cliente: 'Benigno Moya', subtotal: 862.07, iva: 137.93, total: 1000, saldo: 0, estatus: 'timbrado', uuid: true, aplicaciones: true },
  { id: 6, folio: 'N-003', fecha: '26/09/2026', cliente: 'Benigno Moya', subtotal: 689.66, iva: 110.34, total: 800, saldo: 800, estatus: 'emitido', uuid: false, aplicaciones: false },
  { id: 7, folio: 'A-001', fecha: '15/09/2026', cliente: 'Agencia de Viajes Internaco', subtotal: 4300, iva: 688, total: 4988, saldo: 0, estatus: 'cancelado', uuid: true, aplicaciones: false },
  { id: 8, folio: 'A-012', fecha: '18/09/2026', cliente: 'Agencia de Viajes Internaco', subtotal: 2000, iva: 320, total: 2320, saldo: 0, estatus: 'timbrado', uuid: true, aplicaciones: true },
];

function pillEstatus(estatus: Estatus) {
  if (estatus === 'timbrado') return { bg: '#e3ebe3', fg: SALVIA };
  if (estatus === 'emitido') return { bg: '#e3eaf2', fg: CIELO };
  if (estatus === 'cancelado') return { bg: '#f0e4e0', fg: ROSA };
  return { bg: ARENA, fg: TINTA };
}

const iconoFila = {
  width: 28,
  height: 28,
  color: SUAVE,
  borderRadius: 1.5,
  '&:hover': { bgcolor: 'rgba(62,54,44,0.06)' },
  '&.Mui-disabled': { color: '#c4bdb4' },
} as const;

export default function IdentidadErpMockupPage() {
  const [colapsado, setColapsado] = useState(false);
  const [modulo, setModulo] = useState('ventas');
  const [tab, setTab] = useState('factura');
  const [busqueda, setBusqueda] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [filtros, setFiltros] = useState(false);
  const [seleccion, setSeleccion] = useState<number | null>(3);
  const [aviso, setAviso] = useState<string | null>(null);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return FACTURAS.filter((fila) => {
      if (soloPendientes && (fila.saldo <= 0 || fila.estatus === 'cancelado')) return false;
      if (!q) return true;
      return fila.folio.toLowerCase().includes(q) || fila.cliente.toLowerCase().includes(q);
    });
  }, [busqueda, soloPendientes]);

  const resumen = useMemo(() => {
    const suma = (estatus?: Estatus) =>
      FACTURAS.filter((fila) => (estatus ? fila.estatus === estatus : true)).reduce((acc, fila) => acc + fila.total, 0);
    return [
      { label: 'Total general', valor: suma(), fondo: ARENA, tinta: TINTA },
      { label: 'Borrador', valor: suma('borrador'), fondo: '#f7f1e6', tinta: SUAVE },
      { label: 'Emitido', valor: suma('emitido'), fondo: '#e3eaf2', tinta: CIELO },
      { label: 'Timbrado', valor: suma('timbrado'), fondo: '#e3ebe3', tinta: SALVIA },
      { label: 'Cancelado', valor: suma('cancelado'), fondo: '#f0e4e0', tinta: ROSA },
    ];
  }, []);

  const moduloActivo = NAV.find((item) => item.id === modulo) ?? NAV[3]!;
  const enFacturas = modulo === 'ventas' && tab === 'factura';

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: PAPEL, color: TINTA, fontFamily: 'Roboto, system-ui, sans-serif' }}>
      <Box
        sx={{
          width: colapsado ? 100 : 220,
          flexShrink: 0,
          bgcolor: GRAFITO,
          color: '#f3f0ea',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}
      >
        <Box
          sx={{
            minHeight: 56,
            px: colapsado ? 0 : 1.5,
            py: colapsado ? 1.5 : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: colapsado ? 'center' : 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {colapsado ? (
            <Box component="img" src={colibri} alt="Emphasys" sx={{ height: 64, width: 'auto' }} />
          ) : (
            <>
              <Box component="img" src={logo} alt="Emphasys" sx={{ height: 36, width: 'auto' }} />
              <IconButton size="small" onClick={() => setColapsado(true)} sx={{ color: 'rgba(243,240,234,0.55)' }} aria-label="Contraer menú">
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          )}
        </Box>
        {colapsado ? (
          <IconButton size="small" onClick={() => setColapsado(false)} sx={{ color: 'rgba(243,240,234,0.7)', mx: 'auto', mt: 0.5 }} aria-label="Expandir menú">
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        ) : null}

        <Box sx={{ flex: 1, overflowY: 'auto', py: 1, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.28) transparent' }}>
          {NAV.map((item) => {
            const activo = item.id === modulo;
            const Icon = item.icon;
            return (
              <Tooltip key={item.id} title={colapsado ? item.label : ''} placement="right">
                <Box
                  onClick={() => {
                    setModulo(item.id);
                    if (item.id !== 'ventas') setAviso('Esta exploración recorre Facturas, dentro del mismo cromado.');
                  }}
                  sx={{
                    mx: 0.75,
                    mb: 0.25,
                    px: colapsado ? 0 : 1.25,
                    py: 0.85,
                    borderRadius: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: colapsado ? 'center' : 'flex-start',
                    gap: 1.25,
                    cursor: 'pointer',
                    color: activo ? '#f7f4ee' : 'rgba(243,240,234,0.62)',
                    bgcolor: activo ? SELECCION : 'transparent',
                    fontWeight: activo ? 600 : 400,
                    '&:hover': { bgcolor: activo ? '#6a7280' : 'rgba(255,255,255,0.06)', color: '#f7f4ee' },
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                  {colapsado ? null : <Typography sx={{ fontSize: 13, fontWeight: 'inherit', color: 'inherit', lineHeight: 1 }}>{item.label}</Typography>}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: colapsado ? 0.5 : 1.25, py: 1, display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: colapsado ? 'center' : 'flex-start' }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            AD
          </Box>
          {colapsado ? null : (
            <Typography sx={{ flex: 1, fontSize: 12, color: 'rgba(243,240,234,0.82)' }} noWrap>
              Antonio Díaz
            </Typography>
          )}
          {colapsado ? null : (
            <>
              <IconButton size="small" sx={{ color: 'rgba(243,240,234,0.45)' }} onClick={() => setAviso('Abriría notificaciones.')}><NotificationsNoneIcon sx={{ fontSize: 16 }} /></IconButton>
              <IconButton size="small" sx={{ color: 'rgba(243,240,234,0.45)' }} onClick={() => setAviso('Abriría cambiar contraseña.')}><LockResetIcon sx={{ fontSize: 16 }} /></IconButton>
              <IconButton size="small" sx={{ color: 'rgba(243,240,234,0.45)' }} onClick={() => setAviso('Cerraría la sesión.')}><LogoutIcon sx={{ fontSize: 16 }} /></IconButton>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ height: 56, bgcolor: GRAFITO, display: 'flex', alignItems: 'center', px: 3, gap: 2, flexShrink: 0 }}>
          <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#f7f4ee' }}>{moduloActivo.label}</Typography>
          <Box sx={{ px: 1, py: 0.25, borderRadius: 1, border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(243,240,234,0.72)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
            LOCAL · BD LOCAL
          </Box>
          <Typography sx={{ fontSize: 13, color: 'rgba(243,240,234,0.55)' }}>Empresa</Typography>
          <Box sx={{ minWidth: 210, height: 34, px: 1.25, display: 'flex', alignItems: 'center', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#f7f4ee', fontSize: 13 }}>
            Escuela Kemper Urgate
          </Box>
        </Box>

        {modulo === 'ventas' ? (
          <Box sx={{ px: 2.5, pt: 1.25, display: 'flex', gap: 0.5, alignItems: 'flex-end', borderBottom: `1px solid ${LINEA}`, bgcolor: PAPEL }}>
            {TABS.map((item) => {
              const activo = item.id === tab;
              return (
                <Box
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  sx={{
                    px: 1.35,
                    py: 0.9,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: activo ? TINTA : APAGADO,
                    bgcolor: activo ? HOJA : 'transparent',
                    borderRadius: '8px 8px 0 0',
                    border: activo ? `1px solid ${LINEA}` : '1px solid transparent',
                    borderBottom: activo ? `1px solid ${HOJA}` : '1px solid transparent',
                    mb: '-1px',
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Box>
        ) : null}

        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
          <Box sx={{ minHeight: '100%', bgcolor: HOJA, border: `1px solid ${LINEA}`, borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            {enFacturas ? (
              <FacturasSuperficie
                filas={filas}
                resumen={resumen}
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                soloPendientes={soloPendientes}
                onSoloPendientes={setSoloPendientes}
                filtros={filtros}
                onFiltros={() => setFiltros((value) => !value)}
                seleccion={seleccion}
                onSeleccion={setSeleccion}
                onAviso={setAviso}
              />
            ) : (
              <Box sx={{ px: 3, py: 3 }}>
                <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: APAGADO }}>
                  {modulo === 'ventas' ? 'VENTAS' : moduloActivo.label.toUpperCase()}
                </Typography>
                <Typography sx={{ fontFamily: EDITORIAL, fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1, mt: 0.4 }}>
                  {modulo === 'ventas' ? TABS.find((item) => item.id === tab)?.label : moduloActivo.label}
                </Typography>
                <Typography sx={{ mt: 1.2, maxWidth: 520, fontSize: 14, color: SUAVE, lineHeight: 1.5 }}>
                  El cromado ya es el de esta exploración. La grilla densa, con estados, filtros y acciones, está en Facturas.
                </Typography>
                <Box
                  component="button"
                  onClick={() => { setModulo('ventas'); setTab('factura'); }}
                  sx={{ mt: 2, border: 'none', cursor: 'pointer', height: 34, px: 1.5, borderRadius: 1, bgcolor: GRAFITO, color: '#f4f0e8', fontWeight: 650, fontSize: 13 }}
                >
                  Ver Facturas
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Snackbar open={Boolean(aviso)} message={aviso ?? ''} autoHideDuration={2400} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function FacturasSuperficie({
  filas,
  resumen,
  busqueda,
  onBusqueda,
  soloPendientes,
  onSoloPendientes,
  filtros,
  onFiltros,
  seleccion,
  onSeleccion,
  onAviso,
}: {
  filas: Fila[];
  resumen: { label: string; valor: number; fondo: string; tinta: string }[];
  busqueda: string;
  onBusqueda: (value: string) => void;
  soloPendientes: boolean;
  onSoloPendientes: (value: boolean) => void;
  filtros: boolean;
  onFiltros: () => void;
  seleccion: number | null;
  onSeleccion: (id: number) => void;
  onAviso: (mensaje: string) => void;
}) {
  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar folio, cliente, RFC, teléfono, correo, concepto, producto..."
          value={busqueda}
          onChange={(event) => onBusqueda(event.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: APAGADO }} /></InputAdornment> }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: PAPEL,
              borderRadius: 1.5,
              fontSize: 13.5,
              '& fieldset': { borderColor: LINEA },
              '&:hover fieldset': { borderColor: '#cfc6b8' },
              '&.Mui-focused fieldset': { borderColor: GRAFITO, borderWidth: 1 },
            },
          }}
        />
        <Stack direction="row" alignItems="center" spacing={0.4} sx={{ flexShrink: 0 }}>
          <Checkbox size="small" checked={soloPendientes} onChange={(event) => onSoloPendientes(event.target.checked)} sx={{ color: APAGADO, '&.Mui-checked': { color: GRAFITO } }} />
          <Typography sx={{ fontSize: 13, color: SUAVE, whiteSpace: 'nowrap' }}>Solo pendientes</Typography>
        </Stack>
        <Ghost onClick={() => onAviso('Abriría la vista workspace de facturas.')}>Vista workspace</Ghost>
        <Ghost onClick={() => onAviso('Abriría Factura global.')}>Factura global</Ghost>
        <Ghost onClick={() => onAviso('Abriría contabilizar ventas.')}>Contabilizar</Ghost>
        <Ghost onClick={() => onAviso('Exportaría el listado.')}>Exportar</Ghost>
        <Box
          component="button"
          onClick={() => onAviso('Abriría Nueva factura, el formulario de hoy.')}
          sx={{
            flexShrink: 0,
            height: 34,
            px: 1.5,
            border: 'none',
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: GRAFITO,
            color: '#f4f0e8',
            fontWeight: 650,
            fontSize: 13,
            letterSpacing: '0.01em',
            '&:hover': { bgcolor: '#2f343b' },
          }}
        >
          + Nuevo
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <Ghost onClick={onFiltros}>{filtros ? 'Ocultar filtros' : 'Filtros avanzados'}</Ghost>
        {filtros ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
            <CampoFiltro label="Desde" />
            <CampoFiltro label="Hasta" />
            <CampoFiltro label="Cliente" ancho={180} />
            <CampoFiltro label="Monto" />
            <Box component="button" onClick={() => onAviso('Aplicaría los filtros sobre el listado.')} sx={{ height: 32, px: 1.25, border: 'none', borderRadius: 1, bgcolor: GRAFITO, color: '#f4f0e8', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }}>
              Aplicar
            </Box>
          </Stack>
        ) : null}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0.8 }}>
        {resumen.map((item) => (
          <Box key={item.label} sx={{ bgcolor: item.fondo, borderRadius: 1.5, px: 1.15, py: 0.85 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: APAGADO }}>{item.label}</Typography>
            <Typography sx={{ fontFamily: EDITORIAL, fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 500, color: item.tinta, lineHeight: 1.15, mt: 0.2 }}>
              {currency.format(item.valor)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ border: `1px solid ${LINEA}`, borderRadius: 1.5, overflow: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <Box component="thead">
            <Box component="tr" sx={{ '& th': { textAlign: 'left', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: APAGADO, px: 1.1, py: 1, borderBottom: `1px solid ${LINEA}`, bgcolor: '#f7f4ee', whiteSpace: 'nowrap' } }}>
              <Box component="th" sx={{ width: 36 }} />
              <Box component="th">Folio</Box>
              <Box component="th">Fecha</Box>
              <Box component="th">Cliente</Box>
              <Box component="th" sx={{ textAlign: 'right !important' }}>Subtotal</Box>
              <Box component="th" sx={{ textAlign: 'right !important' }}>IVA</Box>
              <Box component="th" sx={{ textAlign: 'right !important' }}>Total</Box>
              <Box component="th" sx={{ textAlign: 'right !important' }}>Saldo</Box>
              <Box component="th">Estatus</Box>
              <Box component="th" sx={{ textAlign: 'right !important' }}>Acciones</Box>
            </Box>
          </Box>
          <Box component="tbody">
            {filas.map((fila) => {
              const activa = fila.id === seleccion;
              const tono = pillEstatus(fila.estatus);
              const deuda = fila.saldo > 0 && fila.estatus !== 'cancelado';
              const puedeBorrar = fila.estatus === 'borrador';
              const puedeTimbrar = fila.estatus === 'emitido' && !fila.uuid;
              const puedeCfdi = fila.uuid && fila.estatus !== 'borrador';
              const puedeAplicar = fila.estatus !== 'borrador' && fila.estatus !== 'cancelado' && (fila.saldo > 0 || fila.aplicaciones);
              return (
                <Box
                  component="tr"
                  key={fila.id}
                  onClick={() => onSeleccion(fila.id)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: activa ? '#ebe4d6' : 'transparent',
                    boxShadow: activa ? `inset 2px 0 0 ${GRAFITO}` : 'none',
                    '& td': { px: 1.1, py: 0.7, borderBottom: `1px solid ${LINEA}`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
                    '&:hover': { bgcolor: activa ? '#ebe4d6' : 'rgba(62,54,44,0.03)' },
                  }}
                >
                  <Box component="td"><Checkbox size="small" sx={{ p: 0.3, color: APAGADO, '&.Mui-checked': { color: GRAFITO } }} onClick={(event) => event.stopPropagation()} /></Box>
                  <Box component="td" sx={{ fontWeight: 650 }}>{fila.folio}</Box>
                  <Box component="td" sx={{ color: SUAVE }}>{fila.fecha}</Box>
                  <Box component="td">{fila.cliente}</Box>
                  <Box component="td" sx={{ textAlign: 'right' }}>{currency.format(fila.subtotal)}</Box>
                  <Box component="td" sx={{ textAlign: 'right', color: SUAVE }}>{currency.format(fila.iva)}</Box>
                  <Box component="td" sx={{ textAlign: 'right', fontWeight: 650 }}>{currency.format(fila.total)}</Box>
                  <Box component="td" sx={{ textAlign: 'right', fontWeight: 650, color: fila.estatus === 'cancelado' ? APAGADO : deuda ? ROSA : SALVIA }}>
                    {currency.format(fila.saldo)}
                  </Box>
                  <Box component="td">
                    <Box sx={{ display: 'inline-flex', px: 0.8, py: 0.2, borderRadius: 1, bgcolor: tono.bg, color: tono.fg, fontSize: 12, fontWeight: 650 }}>
                      {ESTATUS_LABEL[fila.estatus]}
                    </Box>
                  </Box>
                  <Box component="td">
                    <Stack direction="row" spacing={0.15} justifyContent="flex-end" onClick={(event) => event.stopPropagation()}>
                      <Tooltip title="Editar"><IconButton sx={iconoFila} onClick={() => onAviso('Abriría el formulario de la factura.')}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      <Tooltip title={puedeBorrar ? 'Eliminar' : 'Solo se elimina un borrador. Una factura emitida se cancela.'}>
                        <span><IconButton sx={{ ...iconoFila, color: puedeBorrar ? ROSA : undefined }} disabled={!puedeBorrar} onClick={() => onAviso('Abriría la confirmación de eliminar.')}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></span>
                      </Tooltip>
                      <Tooltip title="Ver / Imprimir PDF"><IconButton sx={iconoFila} onClick={() => onAviso('Abriría el PDF.')}><PrintOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      <Tooltip title={puedeCfdi ? 'Descargar CFDI' : 'El CFDI se descarga cuando la factura está timbrada.'}>
                        <span><IconButton sx={iconoFila} disabled={!puedeCfdi} onClick={() => onAviso('Descargaría el CFDI.')}><DownloadOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></span>
                      </Tooltip>
                      <Tooltip title="Enviar por correo"><IconButton sx={iconoFila} onClick={() => onAviso('Abriría el envío por correo.')}><EmailOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      <Tooltip title={puedeAplicar ? 'Aplicar saldo existente' : 'Documento sin saldo pendiente ni pagos aplicados'}>
                        <span><IconButton sx={iconoFila} disabled={!puedeAplicar} onClick={() => onAviso('Abriría aplicar saldo existente.')}><AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></span>
                      </Tooltip>
                      <Tooltip title={puedeTimbrar ? 'Timbrar CFDI' : fila.uuid ? 'CFDI ya timbrado' : 'Disponible al emitir la factura.'}>
                        <span><IconButton sx={{ ...iconoFila, color: puedeTimbrar ? CIELO : undefined }} disabled={!puedeTimbrar} onClick={() => onAviso('Llamaría al timbrado CFDI.')}><NotificationsActiveOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></span>
                      </Tooltip>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ px: 1.5, py: 0.8, display: 'flex', justifyContent: 'flex-end', color: APAGADO, fontSize: 12 }}>
          {filas.length} de {FACTURAS.length}
        </Box>
      </Box>
    </Box>
  );
}

function Ghost({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        flexShrink: 0,
        height: 34,
        px: 1.15,
        borderRadius: 1,
        cursor: 'pointer',
        bgcolor: 'transparent',
        color: SUAVE,
        border: `1px solid ${LINEA}`,
        fontSize: 13,
        fontWeight: 600,
        '&:hover': { bgcolor: 'rgba(62,54,44,0.04)' },
      }}
    >
      {children}
    </Box>
  );
}

function CampoFiltro({ label, ancho = 120 }: { label: string; ancho?: number }) {
  return (
    <TextField
      size="small"
      placeholder={label}
      sx={{
        width: ancho,
        '& .MuiOutlinedInput-root': {
          height: 32,
          fontSize: 12.5,
          bgcolor: PAPEL,
          '& fieldset': { borderColor: LINEA },
        },
      }}
    />
  );
}
