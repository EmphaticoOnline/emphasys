import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Box,
  Button,
  Checkbox,
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
  useMediaQuery,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import CategoryIcon from '@mui/icons-material/Category';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloseIcon from '@mui/icons-material/Close';
import ForumIcon from '@mui/icons-material/Forum';
import InventoryIcon from '@mui/icons-material/Inventory';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import PeopleIcon from '@mui/icons-material/People';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import SettingsIcon from '@mui/icons-material/Settings';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import type { SvgIconComponent } from '@mui/icons-material';
import logoEmphasys from '../../assets/emphasys-w.png';
import colibriEmphasys from '../../assets/emphasys-colibri-w.png';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import LinkIcon from '@mui/icons-material/Link';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
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

const INK = '#243044';
/** Voz editorial solo en el folio y las cifras protagonistas. El resto hereda Roboto. */
const EDITORIAL = '"Iowan Old Style", Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';
const NAVY = '#1d2f68';
const RAIL_MUTED = '#6c7382';
const SHEET = '#f7f4ee';
const LINE = '#e4ddd2';
const MUTED = '#7a7268';

type Seccion = 'relacion' | 'detalle' | 'fiscal';
type OrdenCampo = 'fecha' | 'folio' | 'total' | 'saldo';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

const ESTATUS_LABEL: Record<EstatusNota, string> = {
  borrador: 'Borrador',
  emitido: 'Emitido',
  timbrado: 'Timbrado',
  cancelado: 'Cancelado',
};

const ESTATUS_TINTA: Record<EstatusNota, string> = {
  borrador: '#8a8175',
  emitido: '#3d5f86',
  timbrado: '#3f6b52',
  cancelado: '#8a4d45',
};

const ESTATUS_TINTA_CLARA: Record<EstatusNota, string> = {
  borrador: '#c9c2b6',
  emitido: '#b7c7e2',
  timbrado: '#a9cbb8',
  cancelado: '#e4b4ae',
};

type SuperficieLab = { menu: string; panel: string; contenido: string };
type PresetSuperficie = SuperficieLab & { id: string; nombre: string };

const MUESTRAS_SUPERFICIE = [
  { nombre: 'Tinta', hex: '#2c3344' },
  { nombre: 'Grafito', hex: '#3c4149' },
  { nombre: 'Gris', hex: '#5e6672' },
  { nombre: 'Piedra', hex: '#e4e7ee' },
  { nombre: 'Arena', hex: '#e4d9c8' },
  { nombre: 'Salvia', hex: '#d5e2da' },
  { nombre: 'Beige', hex: '#f4f0e8' },
  { nombre: 'Papel', hex: '#f7f4ee' },
  { nombre: 'Marfil', hex: '#fbf7f1' },
];

const PRESETS_SUPERFICIE: PresetSuperficie[] = [
  { id: 'actual', nombre: 'Como está', menu: '#3c4149', panel: '#3c4149', contenido: '#f4f0e8' },
  { id: 'tinta-grafito-beige', nombre: 'Tinta, grafito y beige', menu: '#2c3344', panel: '#3c4149', contenido: '#f4f0e8' },
  { id: 'tinta-piedra-papel', nombre: 'Tinta, piedra y papel', menu: '#2c3344', panel: '#e4e7ee', contenido: '#f7f4ee' },
  { id: 'grafito-arena-marfil', nombre: 'Grafito, arena y marfil', menu: '#3c4149', panel: '#e4d9c8', contenido: '#fbf7f1' },
  { id: 'piedra-beige', nombre: 'Piedra y beige', menu: '#e4e7ee', panel: '#e4e7ee', contenido: '#f4f0e8' },
  { id: 'salvia-grafito-papel', nombre: 'Salvia, grafito y papel', menu: '#d5e2da', panel: '#3c4149', contenido: '#f7f4ee' },
];

const CLAVE_SUPERFICIE = 'emphasys-mock-nc2-superficies';

type TemaRail = {
  fondo: string;
  oscura: boolean;
  tinta: string;
  suave: string;
  apagado: string;
  busqueda: string;
  resumen: string;
  pista: string;
  barra: string;
  barraAgotada: string;
  seleccion: string;
  seleccionTinta: string;
  seleccionSuave: string;
  seleccionApagado: string;
  seleccionClara: boolean;
  hover: string;
  sombra: string;
  checkbox: string;
  agotada: string;
};

type TemaDocumento = {
  fondo: string;
  oscura: boolean;
  tinta: string;
  suave: string;
  apagado: string;
  nota: string;
  icono: string;
  iconoFondo: string;
  iconoBorde: string;
  iconoHover: string;
  pista: string;
};

function canalHex(hex: string) {
  const limpio = hex.replace('#', '').trim();
  const completo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio;
  return {
    r: Number.parseInt(completo.slice(0, 2), 16),
    g: Number.parseInt(completo.slice(2, 4), 16),
    b: Number.parseInt(completo.slice(4, 6), 16),
  };
}

function luminancia(hex: string) {
  const { r, g, b } = canalHex(hex);
  const lineal = [r, g, b].map((valor) => {
    const c = valor / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2];
}

function esOscura(hex: string) {
  return luminancia(hex) < 0.42;
}

function mezclar(base: string, destino: string, peso: number) {
  const a = canalHex(base);
  const b = canalHex(destino);
  const canal = (origen: number, meta: number) => Math.round(origen + (meta - origen) * peso).toString(16).padStart(2, '0');
  return `#${canal(a.r, b.r)}${canal(a.g, b.g)}${canal(a.b, b.b)}`;
}

function seleccionDesde(fondo: string) {
  return esOscura(fondo) ? mezclar(fondo, '#ffffff', 0.17) : mezclar(fondo, '#2c3138', 0.12);
}

function temaRail(fondo: string): TemaRail {
  const oscura = esOscura(fondo);
  const seleccion = seleccionDesde(fondo);
  const seleccionClara = !esOscura(seleccion);
  return {
    fondo,
    oscura,
    tinta: oscura ? '#f3f0ea' : INK,
    suave: oscura ? '#c8ccd4' : '#4e5563',
    apagado: oscura ? '#9aa1ad' : RAIL_MUTED,
    busqueda: oscura ? 'rgba(255,255,255,0.08)' : '#f7f8fb',
    resumen: oscura ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.62)',
    pista: oscura ? 'rgba(255,255,255,0.16)' : '#d4d8e2',
    barra: oscura ? '#a9c0d6' : '#8fa4bf',
    barraAgotada: oscura ? '#a9cbb8' : '#7d9b86',
    seleccion,
    seleccionTinta: seleccionClara ? INK : '#f3f0ea',
    seleccionSuave: seleccionClara ? '#5e584f' : '#c8ccd4',
    seleccionApagado: seleccionClara ? MUTED : '#9aa1ad',
    seleccionClara,
    hover: oscura ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
    sombra: oscura ? '1px 0 0 rgba(0,0,0,0.45)' : '1px 0 0 #d5dae3, 12px 0 32px rgba(36, 48, 68, 0.05)',
    checkbox: oscura ? '#8e96a6' : '#b7bdca',
    agotada: oscura ? '#a9cbb8' : '#3f6b52',
  };
}

function temaDocumento(fondo: string): TemaDocumento {
  const oscura = esOscura(fondo);
  return {
    fondo,
    oscura,
    tinta: oscura ? '#f6f3ec' : INK,
    suave: oscura ? '#ddd6cb' : '#3d3832',
    apagado: oscura ? '#b7b0a4' : MUTED,
    nota: oscura ? '#ddd6cb' : '#5e584f',
    icono: oscura ? '#f6f3ec' : INK,
    iconoFondo: oscura ? 'rgba(255,255,255,0.08)' : 'rgba(255,252,247,0.7)',
    iconoBorde: oscura ? 'rgba(255,255,255,0.18)' : LINE,
    iconoHover: oscura ? 'rgba(255,255,255,0.14)' : '#fff',
    pista: oscura ? 'rgba(255,255,255,0.18)' : '#e3dbd0',
  };
}

type TemaMenu = {
  fondo: string;
  oscura: boolean;
  tinta: string;
  suave: string;
  apagado: string;
  linea: string;
  borde: string;
  seleccion: string;
  seleccionTinta: string;
  hover: string;
  hoverActivo: string;
  control: string;
  controlBorde: string;
  logoFiltro: string;
  scrollbar: string;
};

function temaMenu(fondo: string): TemaMenu {
  const oscura = esOscura(fondo);
  const seleccion = seleccionDesde(fondo);
  return {
    fondo,
    oscura,
    tinta: oscura ? '#f3f0ea' : '#2c3138',
    suave: oscura ? 'rgba(243,240,234,0.62)' : '#5c564c',
    apagado: oscura ? 'rgba(243,240,234,0.45)' : '#7a7268',
    linea: oscura ? 'rgba(255,255,255,0.08)' : 'rgba(44,49,56,0.08)',
    borde: oscura ? 'rgba(0,0,0,0.28)' : 'rgba(44,49,56,0.1)',
    seleccion,
    seleccionTinta: esOscura(seleccion) ? '#f3f0ea' : '#2c3138',
    hover: oscura ? 'rgba(255,255,255,0.06)' : 'rgba(44,49,56,0.06)',
    hoverActivo: esOscura(fondo) ? mezclar(seleccion, '#ffffff', 0.12) : mezclar(seleccion, '#2c3138', 0.08),
    control: oscura ? 'rgba(255,255,255,0.08)' : 'rgba(44,49,56,0.05)',
    controlBorde: oscura ? 'rgba(255,255,255,0.16)' : 'rgba(44,49,56,0.12)',
    logoFiltro: oscura ? 'none' : 'invert(1)',
    scrollbar: oscura ? 'rgba(255,255,255,0.28) transparent' : 'rgba(44,49,56,0.28) transparent',
  };
}

function leerSuperficie(): SuperficieLab {
  const base: SuperficieLab = {
    menu: PRESETS_SUPERFICIE[0].menu,
    panel: PRESETS_SUPERFICIE[0].panel,
    contenido: PRESETS_SUPERFICIE[0].contenido,
  };
  try {
    const raw = sessionStorage.getItem(CLAVE_SUPERFICIE);
    if (!raw) return base;
    const data = JSON.parse(raw) as { menu?: string; panel?: string; contenido?: string; izquierda?: string; derecha?: string };
    const hex = (valor?: string) => (valor?.startsWith('#') ? valor : null);
    const panel = hex(data.panel) ?? hex(data.izquierda);
    const contenido = hex(data.contenido) ?? hex(data.derecha);
    if (panel && contenido) {
      return { menu: hex(data.menu) ?? base.menu, panel, contenido };
    }
  } catch {
    return base;
  }
  return base;
}

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

function razonAplicarSaldo(nota: NotaCreditoMock): string | null {
  if (nota.contactoId <= 0) return 'Documento sin contacto principal.';
  if (notaCreditoPuedeAplicarSaldo('nota_credito', {
    saldo: nota.saldo,
    estatus_documento: nota.estatus,
    tratamiento_impuestos: nota.tratamiento,
    cfdi_uuid: nota.uuid,
    cfdi_estado_sat: nota.estadoSat,
    cfdi_cancelacion_estado: nota.cancelacionEstado,
  })) return null;
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

function razonEditar(nota: NotaCreditoMock): string | null {
  if (nota.estatus !== 'borrador') return 'Solo se puede editar una nota de crédito en borrador.';
  return null;
}

function razonEliminar(nota: NotaCreditoMock): string | null {
  if (nota.estatus === 'timbrado' || Boolean(nota.uuid)) {
    return 'No se puede eliminar una nota de crédito timbrada. Utilice la cancelación fiscal (CFDI) en su lugar.';
  }
  if (nota.estatus !== 'borrador') {
    return 'Solo se puede eliminar una nota de crédito en borrador. Para conservar la trazabilidad, utilice la cancelación.';
  }
  return null;
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
  if (nota.tratamiento === 'sin_iva') return 'Nota de venta';
  if (nota.cancelacionEstado === 'cancelada' || nota.estadoSat === 'Cancelado') return 'CFDI cancelado';
  if (nota.uuid) return 'CFDI timbrado';
  return 'Sin timbrar';
}

function tratamientoLabel(nota: NotaCreditoMock) {
  return TRATAMIENTO_OPCIONES.find((item) => item.value === nota.tratamiento)?.label ?? nota.tratamiento;
}

function esNotaVenta(nota: NotaCreditoMock) {
  return nota.tratamiento === 'sin_iva';
}

function etiquetaDetalle(nota: NotaCreditoMock): string | null {
  const cantidad = nota.partidas.length;
  if (cantidad === 0) return null;
  if (nota.motivo === 'devolucion') return cantidad === 1 ? 'Devolución' : 'Devoluciones';
  if (nota.motivo === 'bonificacion') return cantidad === 1 ? 'Bonificación' : 'Bonificaciones';
  return cantidad === 1 ? 'Concepto' : 'Conceptos';
}

const MENU_GENERAL: { label: string; icon: SvgIconComponent; activo?: boolean }[] = [
  { label: 'Contactos', icon: PeopleIcon },
  { label: 'Productos', icon: CategoryIcon },
  { label: 'CRM', icon: ForumIcon },
  { label: 'Ventas', icon: PointOfSaleIcon, activo: true },
  { label: 'Compras', icon: ShoppingCartIcon },
  { label: 'Finanzas', icon: AccountBalanceIcon },
  { label: 'Contabilidad', icon: CalculateIcon },
  { label: 'Inventarios', icon: InventoryIcon },
  { label: 'Almacenes', icon: WarehouseIcon },
  { label: 'Informes', icon: BarChartIcon },
  { label: 'Autorizaciones', icon: VerifiedUserIcon },
  { label: 'Configuración', icon: SettingsIcon },
];

const TABS_VENTAS = ['Cotizaciones', 'Pedidos', 'Remisiones', 'Facturas', 'Notas de crédito', 'Pagos'];

function MenuGeneralEmphasys({
  colapsado,
  tema,
  onColapsar,
  onExpandir,
  onAviso,
}: {
  colapsado: boolean;
  tema: TemaMenu;
  onColapsar: () => void;
  onExpandir: () => void;
  onAviso: (mensaje: string) => void;
}) {
  return (
    <Box
      sx={{
        width: colapsado ? 100 : 220,
        flexShrink: 0,
        bgcolor: tema.fondo,
        color: tema.tinta,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${tema.borde}`,
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
          borderBottom: `1px solid ${tema.linea}`,
        }}
      >
        {colapsado ? (
          <Box component="button" onClick={onExpandir} aria-label="Expandir menú" sx={{ border: 'none', bgcolor: 'transparent', p: 0, cursor: 'pointer' }}>
            <Box component="img" src={colibriEmphasys} alt="Emphasys" sx={{ height: 64, width: 'auto', display: 'block', filter: tema.logoFiltro }} />
          </Box>
        ) : (
          <>
            <Box component="img" src={logoEmphasys} alt="Emphasys" sx={{ height: 34, width: 'auto', filter: tema.logoFiltro }} />
            <IconButton size="small" onClick={onColapsar} aria-label="Contraer menú" sx={{ color: tema.apagado }}>
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </>
        )}
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1, scrollbarWidth: 'thin', scrollbarColor: tema.scrollbar }}>
        {MENU_GENERAL.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.label} title={colapsado ? item.label : ''} placement="right">
              <Box
                onClick={() => {
                  if (!item.activo) onAviso('Esta exploración muestra el workspace de Notas de crédito, dentro de Ventas.');
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
                  color: item.activo ? tema.seleccionTinta : tema.suave,
                  bgcolor: item.activo ? tema.seleccion : 'transparent',
                  '&:hover': { bgcolor: item.activo ? tema.hoverActivo : tema.hover, color: item.activo ? tema.seleccionTinta : tema.tinta },
                }}
              >
                <Icon sx={{ fontSize: 18 }} />
                {colapsado ? null : (
                  <Typography sx={{ fontSize: 13, fontWeight: item.activo ? 600 : 400, color: 'inherit', lineHeight: 1 }}>{item.label}</Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ borderTop: `1px solid ${tema.linea}`, px: colapsado ? 0.5 : 1.25, py: 1, display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: colapsado ? 'center' : 'flex-start' }}>
        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: tema.control, border: `1px solid ${tema.controlBorde}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          AD
        </Box>
        {colapsado ? null : <Typography sx={{ flex: 1, fontSize: 12, color: tema.suave }} noWrap>Antonio Díaz</Typography>}
        {colapsado ? null : (
          <>
            <IconButton size="small" sx={{ color: tema.apagado }} onClick={() => onAviso('Abriría notificaciones.')}><NotificationsNoneIcon sx={{ fontSize: 16 }} /></IconButton>
            <IconButton size="small" sx={{ color: tema.apagado }} onClick={() => onAviso('Abriría cambiar contraseña.')}><LockResetIcon sx={{ fontSize: 16 }} /></IconButton>
            <IconButton size="small" sx={{ color: tema.apagado }} onClick={() => onAviso('Cerraría la sesión.')}><LogoutIcon sx={{ fontSize: 16 }} /></IconButton>
          </>
        )}
      </Box>
    </Box>
  );
}

function BarraSuperiorEmphasys({ tema, onAviso }: { tema: TemaMenu; onAviso: (mensaje: string) => void }) {
  return (
    <Box sx={{ height: 56, flexShrink: 0, bgcolor: tema.fondo, display: 'flex', alignItems: 'center', px: 3, gap: 2, borderBottom: `1px solid ${tema.linea}` }}>
      <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, color: tema.tinta }}>Ventas</Typography>
      <Box sx={{ px: 1, py: 0.25, borderRadius: 1, border: `1px solid ${tema.controlBorde}`, color: tema.suave, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
        LOCAL · BD LOCAL
      </Box>
      <Typography sx={{ fontSize: 13, color: tema.apagado }}>Empresa</Typography>
      <Box
        onClick={() => onAviso('Abriría el selector de empresa.')}
        sx={{ minWidth: 210, height: 34, px: 1.25, display: 'flex', alignItems: 'center', borderRadius: 1, bgcolor: tema.control, border: `1px solid ${tema.controlBorde}`, color: tema.tinta, fontSize: 13, cursor: 'pointer' }}
      >
        Escuela Kemper Urgate
      </Box>
    </Box>
  );
}

function NavVentasEmphasys({ tema, onAviso }: { tema: TemaDocumento; onAviso: (mensaje: string) => void }) {
  return (
    <Box sx={{ px: 2.5, pt: 1.15, display: 'flex', gap: 0.25, alignItems: 'flex-end', bgcolor: tema.fondo, borderBottom: `1px solid ${tema.pista}`, flexShrink: 0 }}>
      {TABS_VENTAS.map((tab) => {
        const activa = tab === 'Notas de crédito';
        return (
          <Box
            key={tab}
            onClick={() => {
              if (!activa) onAviso('Esta exploración muestra el workspace de Notas de crédito.');
            }}
            sx={{
              px: 1.35,
              pt: 0.85,
              pb: 0.95,
              mb: '-1px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 650,
              color: activa ? tema.tinta : tema.apagado,
              borderBottom: activa ? `2px solid ${tema.tinta}` : '2px solid transparent',
              '&:hover': { color: tema.tinta },
            }}
          >
            {tab}
          </Box>
        );
      })}
    </Box>
  );
}

export default function NotasCreditoWorkspacePropuesta2() {
  const compacto = useMediaQuery('(max-width:1199px)');
  const [seleccionId, setSeleccionId] = useState(1004);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>('relacion');
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
  const [superficie, setSuperficie] = useState(leerSuperficie);
  const [menuColapsado, setMenuColapsado] = useState(false);
  const menu = useMemo(() => temaMenu(superficie.menu), [superficie.menu]);
  const rail = useMemo(() => temaRail(superficie.panel), [superficie.panel]);
  const documento = useMemo(() => temaDocumento(superficie.contenido), [superficie.contenido]);

  const cambiarSuperficie = (siguiente: SuperficieLab) => {
    setSuperficie(siguiente);
    sessionStorage.setItem(CLAVE_SUPERFICIE, JSON.stringify(siguiente));
  };

  useEffect(() => {
    const previo = document.title;
    document.title = 'Notas de crédito · propuesta 2';
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
      return [folio, nota.cliente, nota.rfc, MOTIVO_LABEL[nota.motivo], nota.concepto ?? ''].join(' ').toLowerCase().includes(q);
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
  const totalVisible = visibles.reduce((sum, nota) => sum + nota.total, 0);

  useEffect(() => {
    if (!seleccion) return;
    if (seccion === 'fiscal' && esNotaVenta(seleccion)) setSeccion('relacion');
    if (seccion === 'detalle' && !etiquetaDetalle(seleccion)) setSeccion('relacion');
  }, [seleccion, seccion]);
  const filtrosExtra = Number(Boolean(clienteFiltro)) + Number(Boolean(motivoFiltro));
  const avisar = (mensaje: string) => setAviso(mensaje);

  const elegir = (nota: NotaCreditoMock) => {
    setSeleccionId(nota.id);
    setSeccion('relacion');
    if (compacto) setMostrarDetalle(true);
  };

  return (
    <>
    <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden', bgcolor: documento.fondo }}>
      <MenuGeneralEmphasys
        colapsado={menuColapsado}
        tema={menu}
        onColapsar={() => setMenuColapsado(true)}
        onExpandir={() => setMenuColapsado(false)}
        onAviso={avisar}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <BarraSuperiorEmphasys tema={menu} onAviso={avisar} />
        <NavVentasEmphasys tema={documento} onAviso={avisar} />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: documento.fondo, overflow: 'hidden' }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {(!compacto || !mostrarDetalle) && (
          <ListaNotas
            notas={visibles}
            totalDocumentos={totalVisible}
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
            tema={rail}
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
            documento={documento}
          />
        ) : (!compacto || mostrarDetalle) ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
            <Typography sx={{ color: documento.apagado }}>Ninguna nota coincide con esta vista.</Typography>
          </Stack>
        ) : null}
      </Box>

      <Menu anchorEl={menuEstatus} open={Boolean(menuEstatus)} onClose={() => setMenuEstatus(null)}>
        <MenuItem selected={estatus === 'todos'} onClick={() => { setEstatus('todos'); setMenuEstatus(null); }}>Todos</MenuItem>
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
            avisar('Abriría la confirmación de eliminar.');
          }}
          disabled={Boolean(seleccion && razonEliminar(seleccion))}
          sx={{ color: '#8a4d45' }}
        >
          <Tooltip title={seleccion ? (razonEliminar(seleccion) ?? '') : ''} placement="left">
            <span>Eliminar</span>
          </Tooltip>
        </MenuItem>
      </Menu>

      <Drawer anchor="left" open={filtrosAbiertos} onClose={() => setFiltrosAbiertos(false)} PaperProps={{ sx: { bgcolor: rail.fondo, color: rail.tinta } }}>
        <Box sx={{ width: 320, p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: rail.tinta }}>Filtros</Typography>
            <IconButton size="small" onClick={() => setFiltrosAbiertos(false)} sx={{ color: rail.tinta }}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
          <TextField select fullWidth size="small" label="Cliente" value={clienteFiltro} onChange={(event) => setClienteFiltro(event.target.value)} sx={{ mb: 2 }}>
            <MenuItem value="">Todos</MenuItem>
            {clientes.map((cliente) => <MenuItem key={cliente} value={cliente}>{cliente}</MenuItem>)}
          </TextField>
          <TextField select fullWidth size="small" label="Motivo" value={motivoFiltro} onChange={(event) => setMotivoFiltro(event.target.value as '' | MotivoNc)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="devolucion">Devolución</MenuItem>
            <MenuItem value="bonificacion">Bonificación</MenuItem>
            <MenuItem value="otro">Otro</MenuItem>
          </TextField>
          <Button sx={{ mt: 2, textTransform: 'none', color: NAVY }} onClick={() => { setClienteFiltro(''); setMotivoFiltro(''); }}>
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
      </Box>
    </Box>
    <LaboratorioSuperficies
      menu={superficie.menu}
      panel={superficie.panel}
      contenido={superficie.contenido}
      onChange={cambiarSuperficie}
    />
    </>
  );
}

function ListaNotas({
  notas,
  totalDocumentos,
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
  tema,
}: {
  notas: NotaCreditoMock[];
  totalDocumentos: number;
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
  tema: TemaRail;
}) {
  return (
    <Box sx={{ width: { xs: '100%', lg: 348 }, flexShrink: 0, display: 'flex', flexDirection: 'column', bgcolor: tema.fondo, color: tema.tinta, minWidth: 0, boxShadow: tema.sombra, position: 'relative', zIndex: 1 }}>
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tema.apagado }}>
              NOTAS DE CRÉDITO
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: 13, color: tema.suave }}>
              {notas.length} en vista
            </Typography>
          </Box>
          <Tooltip title="Nueva nota de crédito">
            <IconButton
              onClick={onNueva}
              aria-label="Nueva nota de crédito"
              sx={{
                width: 34,
                height: 34,
                color: tema.oscura ? '#2c3138' : '#f4f0e8',
                bgcolor: tema.oscura ? '#f4f0e8' : '#3c4149',
                boxShadow: tema.oscura ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
                '&:hover': { bgcolor: tema.oscura ? '#fffdf8' : '#2c3138' },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={0.8} sx={{ mt: 1.4 }}>
          <ResumenRail label="Total" valor={currency.format(totalDocumentos)} tema={tema} />
          <ResumenRail label="Saldo" valor={currency.format(totalDisponible)} tema={tema} />
        </Stack>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar folio, cliente, RFC…"
          value={busqueda}
          onChange={(event) => onBusqueda(event.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 0.6, fontSize: 18, color: tema.apagado }} />,
            endAdornment: busqueda ? (
              <IconButton size="small" onClick={() => onBusqueda('')} sx={{ color: tema.apagado }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            ) : null,
          }}
          sx={{
            mt: 1.3,
            '& .MuiOutlinedInput-root': {
              color: tema.tinta,
              bgcolor: tema.busqueda,
              borderRadius: 2,
              fontSize: 13,
              '& fieldset': { borderColor: 'transparent' },
            },
            '& .MuiOutlinedInput-input::placeholder': { color: tema.apagado, opacity: 1 },
          }}
        />
        <Stack direction="row" alignItems="center" spacing={0.4} sx={{ mt: 0.8 }}>
          <Button
            size="small"
            onClick={(event) => onAbrirEstatus(event.currentTarget)}
            endIcon={<ExpandMoreIcon />}
            sx={{ color: tema.tinta, textTransform: 'none', fontWeight: 700, fontSize: 12.5, px: 0.8 }}
          >
            {estatus === 'todos' ? 'Todos' : ESTATUS_LABEL[estatus]}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Ordenar">
            <IconButton size="small" onClick={(event) => onAbrirOrden(event.currentTarget)} sx={{ color: tema.apagado }}><SwapVertIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Filtros">
            <IconButton size="small" onClick={onAbrirFiltros} sx={{ color: tema.apagado }}>
              <FilterAltOutlinedIcon fontSize="small" />
              {filtrosExtra > 0 ? <Box sx={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', bgcolor: NAVY }} /> : null}
            </IconButton>
          </Tooltip>
          <Button onClick={onVistaClasica} sx={{ color: tema.apagado, textTransform: 'none', fontSize: 11.5, minWidth: 0, px: 0.6 }}>
            Clásica
          </Button>
        </Stack>
        <FormControlLabel
          sx={{ mt: 0.1, ml: 0, '& .MuiFormControlLabel-label': { fontSize: 12.5, color: tema.suave } }}
          control={<Checkbox size="small" checked={soloPendientes} onChange={(event) => onSoloPendientes(event.target.checked)} sx={{ color: tema.checkbox, p: 0.6, '&.Mui-checked': { color: tema.oscura ? '#c5d4f2' : NAVY } }} />}
          label="Solo pendientes"
        />
      </Box>
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        px: 1,
        pb: 1.2,
        scrollbarWidth: 'thin',
        scrollbarColor: `${tema.oscura ? 'rgba(255,255,255,0.38)' : 'rgba(36,48,68,0.32)'} ${tema.fondo}`,
        '&::-webkit-scrollbar': { width: 10, background: tema.fondo },
        '&::-webkit-scrollbar-track': { background: tema.fondo },
        '&::-webkit-scrollbar-thumb': {
          background: tema.oscura ? 'rgba(255,255,255,0.38)' : 'rgba(36,48,68,0.32)',
          borderRadius: 99,
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
        },
      }}>
        {notas.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: tema.apagado, fontSize: 13 }}>Sin resultados.</Typography>
        ) : notas.map((nota) => {
          const activa = nota.id === seleccionId;
          const aplicado = aplicadoDe(nota);
          const pct = nota.total > 0 ? Math.min(100, Math.round((aplicado / nota.total) * 100)) : 0;
          const agotada = nota.saldo <= 0 && nota.estatus !== 'cancelado';
          const clara = activa ? tema.seleccionClara : !tema.oscura;
          const tinta = activa ? tema.seleccionTinta : tema.tinta;
          const suave = activa ? tema.seleccionSuave : tema.suave;
          const apagado = activa ? tema.seleccionApagado : tema.apagado;
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
                color: tinta,
                px: 1.25,
                py: 1.05,
                mb: 0.45,
                cursor: 'pointer',
                border: 0,
                outline: 'none',
                borderRadius: 2,
                bgcolor: activa ? tema.seleccion : 'transparent',
                boxShadow: activa ? '0 1px 2px rgba(36,48,68,0.18)' : 'none',
                '&:hover': { bgcolor: activa ? tema.seleccion : tema.hover },
              }}
            >
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 750, flex: 1, color: tinta }} noWrap>{folioDe(nota.serie, nota.numero)}</Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: tinta }}>
                  {currency.format(nota.total)}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: suave, mt: 0.15 }} noWrap>{nota.cliente}</Typography>
              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 0.3 }}>
                <Typography sx={{ fontSize: 11.5, color: apagado }}>{MOTIVO_LABEL[nota.motivo]}</Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: (clara ? ESTATUS_TINTA : ESTATUS_TINTA_CLARA)[nota.estatus] }}>{ESTATUS_LABEL[nota.estatus]}</Typography>
                <Typography sx={{ fontSize: 11.5, color: apagado }}>
                  {nota.origenes.length === 0 ? 'Directa' : nota.origenes.length === 1 ? '1 origen' : `${nota.origenes.length} orígenes`}
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mt: 0.55 }}>
                <Typography sx={{ fontSize: 12, color: suave }}>
                  Saldo:{' '}
                  <Box component="span" sx={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: agotada ? (clara ? '#3f6b52' : tema.agotada) : nota.estatus === 'cancelado' ? apagado : tinta }}>
                    {currency.format(nota.saldo)}
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: 11, color: apagado }}>{formatFecha(nota.fecha)}</Typography>
              </Stack>
              <Tooltip title={`${pct}% del importe ya está aplicado`}>
                <Box sx={{ mt: 0.55, height: 3, borderRadius: 99, bgcolor: tema.pista, overflow: 'hidden' }}>
                  <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: agotada ? tema.barraAgotada : tema.barra }} />
                </Box>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function ResumenRail({ label, valor, tema }: { label: string; valor: string; tema: TemaRail }) {
  return (
    <Box sx={{ flex: 1, bgcolor: tema.resumen, borderRadius: 1.75, px: 1.1, py: 0.85 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tema.apagado }}>{label}</Typography>
      <Typography sx={{ mt: 0.2, fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: tema.tinta }} noWrap>{valor}</Typography>
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
  documento,
}: {
  nota: NotaCreditoMock;
  seccion: Seccion;
  compacto: boolean;
  onSeccion: (seccion: Seccion) => void;
  onVolver: () => void;
  onAviso: (mensaje: string) => void;
  onAbrirEstatus: (el: HTMLElement) => void;
  onAbrirMas: (el: HTMLElement) => void;
  documento: TemaDocumento;
}) {
  const aplicado = aplicadoDe(nota);
  const pct = nota.total > 0 ? Math.min(100, (aplicado / nota.total) * 100) : 0;
  const bloqueoSaldo = razonAplicarSaldo(nota);
  const bloqueoEditar = razonEditar(nota);
  const bloqueoEliminar = razonEliminar(nota);
  const agotada = nota.saldo <= 0 && nota.estatus !== 'cancelado';
  const fiscal = esNotaVenta(nota) ? null : situacionFiscal(nota);
  const detalleTab = etiquetaDetalle(nota);
  const iconoSx = {
    width: 34,
    height: 34,
    color: documento.oscura ? documento.icono : '#4a453e',
    border: `1px solid ${documento.oscura ? documento.iconoBorde : 'rgba(62,54,44,0.12)'}`,
    borderRadius: 2,
    bgcolor: 'transparent',
    '&:hover': { bgcolor: documento.oscura ? documento.iconoHover : 'rgba(62,54,44,0.06)' },
    '&.Mui-disabled': { color: '#b3aa9e', borderColor: 'transparent' },
  } as const;

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: documento.fondo }}>
      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 2.6 }}>
        {compacto ? (
          <Button startIcon={<ArrowBackIcon />} onClick={onVolver} sx={{ textTransform: 'none', color: documento.tinta, mb: 0.5, ml: -1 }}>
            Notas
          </Button>
        ) : null}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: documento.apagado }}>
              NOTA SELECCIONADA
            </Typography>
            <Stack direction="row" spacing={1.2} alignItems="baseline" flexWrap="wrap" useFlexGap sx={{ mt: 0.35 }}>
              <Typography sx={{ fontFamily: EDITORIAL, fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, color: documento.tinta }}>{folioDe(nota.serie, nota.numero)}</Typography>
              <Typography sx={{ fontSize: 13, color: documento.apagado }}>{formatFecha(nota.fecha)}</Typography>
            </Stack>
            <Typography sx={{ mt: 0.45, fontSize: 15, fontWeight: 600, color: documento.suave }} noWrap>{nota.cliente}</Typography>
            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 1 }}>
              <Pill tono="arena">{MOTIVO_LABEL[nota.motivo]}</Pill>
              {nota.concepto ? <Typography sx={{ fontSize: 13, color: documento.suave }}>{nota.concepto}</Typography> : null}
              <Pill tono="papel" onClick={(event) => onAbrirEstatus(event.currentTarget)}>
                {ESTATUS_LABEL[nota.estatus]}
                <ExpandMoreIcon sx={{ fontSize: 16, ml: 0.2 }} />
              </Pill>
              {esNotaVenta(nota) ? <Pill tono="salvia">Nota de venta</Pill> : fiscal ? <Pill tono="cielo">{fiscal}</Pill> : null}
            </Stack>
            {nota.observaciones ? (
              <Typography sx={{ mt: 1, fontSize: 13, color: documento.nota, maxWidth: 640 }}>{nota.observaciones}</Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Tooltip title={bloqueoSaldo ? `Aplicar saldo. ${bloqueoSaldo}` : 'Aplicar saldo'}>
              <span>
                <IconButton
                  aria-label="Aplicar saldo"
                  disabled={Boolean(bloqueoSaldo)}
                  onClick={() => onAviso('Abriría Aplicar saldo, el diálogo que ya reparte el disponible entre facturas del cliente.')}
                  sx={iconoSx}
                >
                  <LinkIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Ver / Imprimir PDF">
              <IconButton aria-label="Ver / Imprimir PDF" sx={iconoSx} onClick={() => onAviso('Abriría el PDF de la nota.')}><PrintOutlinedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Descargar PDF">
              <IconButton aria-label="Descargar PDF" sx={iconoSx} onClick={() => onAviso('Descargaría el PDF. La nota no ofrece descarga de CFDI en la vista actual.')}><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
            </Tooltip>
            {muestraTimbrar(nota) ? (
              <Tooltip title={timbrarBloqueado(nota) ? (nota.estatus === 'cancelado' ? 'La nota está cancelada.' : 'CFDI ya timbrado') : 'Timbrar CFDI'}>
                <span>
                  <IconButton
                    aria-label="Timbrar CFDI"
                    sx={{ ...iconoSx, color: timbrarBloqueado(nota) ? undefined : '#3d5f86', '&.Mui-disabled': iconoSx['&.Mui-disabled'] }}
                    disabled={timbrarBloqueado(nota)}
                    onClick={() => onAviso('Llamaría al timbrado CFDI que ya usa la nota de crédito.')}
                  >
                    <NotificationsActiveOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip title={bloqueoEditar ?? 'Editar'}>
              <span>
                <IconButton aria-label="Editar" sx={iconoSx} disabled={Boolean(bloqueoEditar)} onClick={() => onAviso('Abriría el formulario de la nota.')}><EditOutlinedIcon fontSize="small" /></IconButton>
              </span>
            </Tooltip>
            <Box sx={{ width: '1px', height: 18, bgcolor: documento.oscura ? 'rgba(255,255,255,0.16)' : 'rgba(62,54,44,0.16)', mx: 0.25 }} />
            <Tooltip title={bloqueoEliminar ?? 'Eliminar'}>
              <span>
                <IconButton
                  aria-label="Eliminar"
                  sx={{ ...iconoSx, color: bloqueoEliminar ? undefined : '#8a4d45', '&.Mui-disabled': iconoSx['&.Mui-disabled'] }}
                  disabled={Boolean(bloqueoEliminar)}
                  onClick={() => onAviso('Abriría la confirmación de eliminar.')}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Cancelar documento">
              <IconButton aria-label="Más acciones" sx={iconoSx} onClick={(event) => onAbrirMas(event.currentTarget)}><MoreHorizIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Box sx={{ mt: 1.7, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1.15fr' }, gap: 0.8 }}>
          <Cifra label="Importe" valor={currency.format(nota.total)} detalle={nota.tratamiento === 'sin_iva' ? 'Sin IVA' : `IVA ${currency.format(nota.iva)}`} fondo="#efe4d4" />
          <Cifra label="Aplicado" valor={currency.format(aplicado)} detalle={nota.aplicaciones.length === 0 ? 'Sin aplicaciones' : `${nota.aplicaciones.length} factura${nota.aplicaciones.length === 1 ? '' : 's'}`} fondo="#e3ebe3" />
          <Cifra
            label="Disponible"
            valor={currency.format(nota.saldo)}
            detalle={agotada ? 'Saldo aplicado por completo' : nota.estatus === 'cancelado' ? 'Nota cancelada' : bloqueoSaldo ? 'Saldo de la nota' : 'Puede aplicarse'}
            fondo={agotada ? '#dce8df' : nota.estatus === 'cancelado' ? '#f0e4e0' : '#e3eaf2'}
            destacado
          />
        </Box>
        <Box sx={{ mt: 1.1, height: 4, borderRadius: 99, bgcolor: documento.pista, overflow: 'hidden' }}>
          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: agotada ? '#7d9b86' : '#8fa4bf' }} />
        </Box>
        {bloqueoSaldo ? (
          <Typography sx={{ mt: 0.85, fontSize: 12.5, color: documento.nota }}>{bloqueoSaldo}</Typography>
        ) : null}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mx: { xs: 1, md: 1.75 }, mb: { xs: 1, md: 1.75 }, bgcolor: '#fffcf8', borderRadius: 3, border: `1px solid ${LINE}`, overflow: 'hidden' }}>
        <Tabs
          value={seccion}
          onChange={(_event, value: Seccion) => onSeccion(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1.5, minHeight: 46, borderBottom: `1px solid ${LINE}`, '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 650, fontSize: 14, color: MUTED }, '& .Mui-selected': { color: INK }, '& .MuiTabs-indicator': { height: 2, borderRadius: 2, bgcolor: INK } }}
        >
          <Tab value="relacion" label="Origen y aplicación" />
          {detalleTab ? <Tab value="detalle" label={detalleTab} /> : null}
          {esNotaVenta(nota) ? null : <Tab value="fiscal" label="Fiscal" />}
        </Tabs>
        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 2.25 }, bgcolor: SHEET }}>
          {seccion === 'relacion' ? <SeccionCuenta nota={nota} bloqueoSaldo={bloqueoSaldo} onAviso={onAviso} /> : null}
          {seccion === 'detalle' && detalleTab ? <SeccionPartidas nota={nota} /> : null}
          {seccion === 'fiscal' && !esNotaVenta(nota) ? <SeccionFiscal nota={nota} onAviso={onAviso} /> : null}
        </Box>
      </Box>
    </Box>
  );
}

const PILL_FONDO = {
  arena: { bg: '#efe4d4', color: '#5c4d38' },
  papel: { bg: '#f3eee6', color: INK },
  salvia: { bg: '#e3ebe3', color: '#2f5340' },
  cielo: { bg: '#e3eaf2', color: '#2c4664' },
} as const;

function Pill({ children, onClick, tono = 'papel' }: { children: ReactNode; onClick?: (event: MouseEvent<HTMLButtonElement>) => void; tono?: keyof typeof PILL_FONDO }) {
  const tinta = PILL_FONDO[tono];
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        px: 1.05,
        borderRadius: 99,
        border: 0,
        bgcolor: tinta.bg,
        color: tinta.color,
        font: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </Box>
  );
}

function Cifra({
  label,
  valor,
  detalle,
  fondo,
  destacado,
}: {
  label: string;
  valor: string;
  detalle: string;
  fondo: string;
  destacado?: boolean;
}) {
  return (
    <Box sx={{ bgcolor: fondo, borderRadius: 2, px: 1.4, py: 1.05 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>{label}</Typography>
      <Typography sx={{ mt: 0.25, fontFamily: EDITORIAL, fontSize: destacado ? 26 : 20, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: INK, lineHeight: 1.05 }}>
        {valor}
      </Typography>
      <Typography sx={{ mt: 0.3, fontSize: 12, color: '#5e584f' }}>{detalle}</Typography>
    </Box>
  );
}

function SeccionCuenta({ nota, bloqueoSaldo, onAviso }: { nota: NotaCreditoMock; bloqueoSaldo: string | null; onAviso: (mensaje: string) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, alignItems: 'start' }}>
      <Columna titulo={nota.origenes.length > 1 ? `Proviene de · ${nota.origenes.length} facturas` : 'Proviene de'}>
        {nota.origenes.length === 0 ? (
          <TarjetaQuietud titulo="Captura directa" texto={nota.concepto ? `Concepto: ${nota.concepto}. No está ligada a una factura.` : 'No está ligada a una factura.'} />
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
        ) : nota.aplicaciones.map((aplicacion) => (
          <TarjetaDocumento
            key={aplicacion.id}
            folio={folioDe(aplicacion.serie, aplicacion.numero)}
            meta={formatFecha(aplicacion.fecha)}
            monto={currency.format(aplicacion.monto)}
            detalle="Aplicación de saldo"
            onClick={() => onAviso(`En producción abriría la factura ${folioDe(aplicacion.serie, aplicacion.numero)}.`)}
          />
        ))}
      </Columna>
    </Box>
  );
}

function detalleOrigen(nota: NotaCreditoMock, origen: FacturaOrigenMock) {
  const partidas = nota.partidas.filter((partida) => partida.origenId === origen.id).length;
  if (partidas === 0) return 'Factura origen';
  return partidas === 1 ? '1 línea de esta factura' : `${partidas} líneas de esta factura`;
}

function Columna({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b879c', px: 0.3 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  );
}

function TarjetaDocumento({ folio, meta, monto, detalle, onClick }: { folio: string; meta: string; monto: string; detalle: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        textAlign: 'left',
        width: '100%',
        border: `1px solid ${LINE}`,
        borderRadius: 1.5,
        bgcolor: '#fff',
        px: 1.4,
        py: 1.1,
        cursor: 'pointer',
        font: 'inherit',
        boxShadow: '0 1px 0 rgba(20,28,46,0.03)',
        '&:hover': { borderColor: '#c5d0e4' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: NAVY }}>{folio}</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{monto}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{meta}</Typography>
      <Typography sx={{ fontSize: 12.5, color: '#334155', mt: 0.35 }}>{detalle}</Typography>
    </Box>
  );
}

function TarjetaQuietud({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Box sx={{ border: '1px dashed #cfd6e3', borderRadius: 1.5, px: 1.4, py: 1.25, bgcolor: 'rgba(255,255,255,0.7)' }}>
      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#334155' }}>{titulo}</Typography>
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
          <Typography sx={{ px: 1.5, py: 1, fontSize: 12, fontWeight: 700, color: '#5c4d38', bgcolor: '#f6f0e6' }}>{grupo.titulo}</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <TablaPartidas partidas={grupo.partidas} />
          </Box>
        </Box>
      ))}
      <Box sx={{ alignSelf: 'flex-end', minWidth: 240, bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 1.5, px: 1.5, py: 1.15 }}>
        <LineaTotal label="Subtotal" valor={currency.format(nota.subtotal)} />
        {nota.descuento > 0 ? <LineaTotal label="Descuento" valor={currency.format(nota.descuento)} /> : null}
        {esNotaVenta(nota) ? null : <LineaTotal label="IVA trasladado" valor={currency.format(nota.iva)} />}
        <LineaTotal label="Total" valor={currency.format(nota.total)} fuerte />
      </Box>
    </Stack>
  );
}

function TablaPartidas({ partidas }: { partidas: PartidaMock[] }) {
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 1.5, py: 0.9, fontSize: 13, textAlign: 'left', borderTop: `1px solid ${LINE}` }, '& th': { fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8b93a7', fontWeight: 700, borderTop: 0 } }}>
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
            <td style={{ fontWeight: 650 }}>{partida.descripcion}</td>
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
  if (esNotaVenta(nota)) return null;
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
      <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 2, p: 1.75 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>Tratamiento</Typography>
        <Typography sx={{ mt: 0.4, fontSize: 18, fontWeight: 700, color: INK }}>{tratamientoLabel(nota)}</Typography>
        <Typography sx={{ mt: 0.6, fontSize: 13.5, color: '#3d3832', maxWidth: 560 }}>
          {nota.estatus === 'cancelado'
            ? 'La nota está cancelada. El CFDI quedó cancelado y el saldo queda cerrado.'
            : nota.uuid
              ? 'El CFDI está timbrado. Con el comprobante vigente, el saldo se puede aplicar.'
              : 'El saldo se puede aplicar cuando el CFDI quede timbrado.'}
        </Typography>
      </Box>
      <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 2, p: 1.75 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b879c', mb: 1.2 }}>Receptor</Typography>
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
      {nota.uuid ? (
        <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: 2, p: 1.75 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b879c' }}>Timbrado</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.8 }}>
            <Typography sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, fontWeight: 700 }}>{nota.uuid}</Typography>
            <Tooltip title="Copiar UUID">
              <IconButton size="small" onClick={() => { void navigator.clipboard?.writeText(nota.uuid ?? ''); onAviso('UUID copiado.'); }}>
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
        <Box sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderLeft: `4px solid ${NAVY}`, borderRadius: 1.5, p: 1.75 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Pendiente de timbrar</Typography>
          <Typography sx={{ mt: 0.45, fontSize: 13, color: '#334155' }}>
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

function LaboratorioSuperficies({
  menu,
  panel,
  contenido,
  onChange,
}: {
  menu: string;
  panel: string;
  contenido: string;
  onChange: (siguiente: SuperficieLab) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const mismo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const activo = PRESETS_SUPERFICIE.find((preset) => mismo(preset.menu, menu) && mismo(preset.panel, panel) && mismo(preset.contenido, contenido));
  const actual: SuperficieLab = { menu, panel, contenido };

  return (
    <Box sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 40 }}>
      {abierto ? (
        <Box sx={{ width: 320, maxHeight: 'min(78vh, 640px)', overflowY: 'auto', p: 1.5, borderRadius: 2.5, bgcolor: 'rgba(255,252,247,0.96)', border: `1px solid ${LINE}`, boxShadow: '0 12px 32px rgba(36,48,68,0.16)' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Superficies</Typography>
            <IconButton size="small" aria-label="Cerrar superficies" onClick={() => setAbierto(false)}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          </Stack>
          <Stack spacing={0.4}>
            {PRESETS_SUPERFICIE.map((preset) => {
              const elegido = activo?.id === preset.id;
              return (
                <Button
                  key={preset.id}
                  onClick={() => onChange({ menu: preset.menu, panel: preset.panel, contenido: preset.contenido })}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    color: INK,
                    fontWeight: elegido ? 750 : 500,
                    fontSize: 13,
                    px: 0.8,
                    bgcolor: elegido ? 'rgba(36,48,68,0.06)' : 'transparent',
                  }}
                >
                  <Muestra menu={preset.menu} panel={preset.panel} contenido={preset.contenido} />
                  {preset.nombre}
                </Button>
              );
            })}
          </Stack>
          <Stack spacing={1.35} sx={{ mt: 1.5 }}>
            <CampoColor etiqueta="Menú principal" valor={menu} onChange={(valor) => onChange({ ...actual, menu: valor })} />
            <CampoColor etiqueta="Panel de navegación" valor={panel} onChange={(valor) => onChange({ ...actual, panel: valor })} />
            <CampoColor etiqueta="Contenido" valor={contenido} onChange={(valor) => onChange({ ...actual, contenido: valor })} />
          </Stack>
          <Typography sx={{ mt: 1.2, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
            Texto, iconos y selección se ajustan solos. Solo en este mockup.
          </Typography>
        </Box>
      ) : (
        <Button
          onClick={() => setAbierto(true)}
          aria-label={activo?.nombre ?? 'Abrir laboratorio de superficies'}
          sx={{
            textTransform: 'none',
            color: INK,
            fontWeight: 650,
            fontSize: 12.5,
            bgcolor: 'rgba(255,252,247,0.94)',
            border: `1px solid ${LINE}`,
            borderRadius: 99,
            boxShadow: '0 8px 24px rgba(36,48,68,0.12)',
            px: 1.3,
            '&:hover': { bgcolor: '#fff' },
          }}
        >
          <Muestra menu={menu} panel={panel} contenido={contenido} />
          {activo?.nombre ?? 'Superficies'}
        </Button>
      )}
    </Box>
  );
}

function Muestra({ menu, panel, contenido }: SuperficieLab) {
  return (
    <Box sx={{ width: 30, height: 14, mr: 1, borderRadius: 0.6, overflow: 'hidden', display: 'flex', flexShrink: 0, border: '1px solid rgba(36,48,68,0.12)' }}>
      <Box sx={{ flex: 1, bgcolor: menu }} />
      <Box sx={{ flex: 1, bgcolor: panel }} />
      <Box sx={{ flex: 1, bgcolor: contenido }} />
    </Box>
  );
}

function CampoColor({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (valor: string) => void }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.8}>
        <Box
          component="input"
          type="color"
          aria-label={etiqueta}
          value={valor}
          onChange={(event: { target: { value: string } }) => onChange(event.target.value)}
          sx={{ width: 28, height: 28, p: 0, border: `1px solid ${LINE}`, borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer' }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, color: MUTED }}>{etiqueta}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{valor.toUpperCase()}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.45} sx={{ mt: 0.7 }}>
        {MUESTRAS_SUPERFICIE.map((muestra) => {
          const activa = muestra.hex.toLowerCase() === valor.toLowerCase();
          return (
            <Tooltip key={muestra.nombre} title={muestra.nombre}>
              <Box
                component="button"
                aria-label={`${etiqueta}: ${muestra.nombre}`}
                onClick={() => onChange(muestra.hex)}
                sx={{
                  width: 18,
                  height: 18,
                  p: 0,
                  borderRadius: 0.6,
                  cursor: 'pointer',
                  bgcolor: muestra.hex,
                  border: activa ? '2px solid #2c3138' : '1px solid rgba(44,49,56,0.18)',
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
