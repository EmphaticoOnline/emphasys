import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import BarChartIcon from '@mui/icons-material/BarChart';
import BuildIcon from '@mui/icons-material/Build';
import CalculateIcon from '@mui/icons-material/Calculate';
import CategoryIcon from '@mui/icons-material/Category';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import ForumIcon from '@mui/icons-material/Forum';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import SettingsIcon from '@mui/icons-material/Settings';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import logo from '../../assets/emphasys-w.png';
import colibri from '../../assets/emphasys-colibri-w.png';
import EmpresaSelector from '../EmpresaSelector';
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH, TOPBAR_HEIGHT } from '../layoutConstants';
import { useSession } from '../../session/useSession';
import ChangePasswordDialog from '../ChangePasswordDialog';
import { compareDocumentoVisualOrder } from '../../modules/documentos/documentoVisualOrder';
import { fetchTiposDocumentoHabilitados } from '../../services/tiposDocumentoService';
import { fetchParametrosSistema } from '../../services/parametrosService';
import { apiFetch } from '../../api/apiClient';
import type { RolResumen } from '../../session/sessionTypes';
import { esRolAdmin, esRolVendedor } from '../../session/rolScope';

const BRAND = '#1d2f68';
// Brand teal used as left-rail accent on active nav items
const ACCENT = '#006261';

type DocumentoTabDef = { label: string; value: string; icon: string | null };

const NAVIGATION_DOCUMENT_OVERRIDES: Record<'ventas' | 'compras', DocumentoTabDef[]> = {
  ventas: [{ value: 'pago_cliente', label: 'Pagos', icon: 'AccountBalanceWallet' }],
  compras: [{ value: 'pago_proveedor', label: 'Pagos Proveedor', icon: 'AccountBalanceWallet' }],
};

const DOC_ICON_MAP: Record<string, SvgIconComponent> = {
  RequestQuote: RequestQuoteIcon,
  ShoppingCart: ShoppingCartIcon,
  LocalShipping: LocalShippingIcon,
  AssignmentReturn: AssignmentReturnIcon,
  ReceiptLong: ReceiptLongIcon,
  PlaylistAddCheck: PlaylistAddCheckIcon,
  Inventory: InventoryIcon,
  Warehouse: WarehouseIcon,
  Description: DescriptionIcon,
  Build: BuildIcon,
  AccountBalanceWallet: AccountBalanceWalletIcon,
};

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'si', 'sí', 'on'].includes(normalized);
}

// emphasys-w.png: WebP 765×205 (ratio 3.73) — logo completo horizontal
// emphasys-colibri-w.png: PNG 1536×1024 (ratio 1.5) — isotipo solo centrado
const LOGO_HEIGHT = 40;    // expanded: logo completo con presencia visual clara
const COLIBRI_HEIGHT = 80; // collapsed: colibrí — 158×159px recortado ajustado, cabe en sidebar 100px

type NavItem = { label: string; path: string; icon: SvgIconComponent };

const NAV_ITEMS: NavItem[] = [
  { label: 'Contactos',     path: '/contactos',              icon: PeopleIcon },
  { label: 'Productos',     path: '/productos',              icon: CategoryIcon },
  { label: 'CRM',           path: '/crm',                   icon: ForumIcon },
  { label: 'Ventas',        path: '/ventas/cotizacion',      icon: PointOfSaleIcon },
  { label: 'Compras',       path: '/compras/orden_compra',   icon: ShoppingCartIcon },
  { label: 'Finanzas',      path: '/finanzas',              icon: AccountBalanceIcon },
  { label: 'Contabilidad',  path: '/contabilidad',          icon: CalculateIcon },
  { label: 'Inventarios',   path: '/inventario/movimientos', icon: InventoryIcon },
  { label: 'Almacenes',     path: '/almacenes',             icon: WarehouseIcon },
  { label: 'Informes',      path: '/informes',              icon: BarChartIcon },
  { label: 'Autorizaciones', path: '/autorizaciones',        icon: VerifiedUserIcon },
  { label: 'Configuración', path: '/configuracion',         icon: SettingsIcon },
];

// Módulos comerciales visibles/accesibles para el rol "vendedor". Solo UX — la
// restricción real de datos vive en backend (ver scope-comercial.ts).
const ALLOWED_PREFIXES_VENDEDOR = ['/contactos', '/productos', '/crm', '/ventas'];
const RUTA_DEFAULT_VENDEDOR = '/crm';

function getBreadcrumbs(pathname: string): string[] {
  if (pathname.startsWith('/contactos'))     return ['Catálogos', 'Contactos'];
  if (pathname.startsWith('/productos'))     return ['Catálogos', 'Productos'];
  if (pathname.startsWith('/crm'))           return ['CRM'];
  if (pathname.startsWith('/ventas'))        return ['Ventas'];
  if (pathname.startsWith('/compras'))       return ['Compras'];
  if (pathname.startsWith('/finanzas'))      return ['Finanzas'];
  if (pathname.startsWith('/inventario'))    return ['Inventarios'];
  if (pathname.startsWith('/almacenes'))     return ['Almacenes'];
  if (pathname.startsWith('/informes'))      return ['Informes'];
  if (pathname.startsWith('/autorizaciones')) return ['Autorizaciones'];
  if (pathname.startsWith('/configuracion')) return ['Configuración'];
  return [];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

function isNavActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/contactos')             return pathname.startsWith('/contactos');
  if (itemPath === '/crm')                   return pathname.startsWith('/crm');
  if (itemPath.startsWith('/ventas'))        return pathname.startsWith('/ventas');
  if (itemPath.startsWith('/compras'))       return pathname.startsWith('/compras');
  return pathname === itemPath || pathname.startsWith(itemPath + '/');
}

interface SidebarNavProps {
  collapsed: boolean;
  isMobile: boolean;
  pathname: string;
  userName: string;
  navItems: NavItem[];
  onToggleCollapse: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onChangePassword: () => void;
}

function SidebarNav({
  collapsed,
  isMobile,
  pathname,
  userName,
  navItems,
  onToggleCollapse,
  onNavigate,
  onLogout,
  onChangePassword,
}: SidebarNavProps) {
  const initials = getInitials(userName);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Logo / header — clicking the collapsed isotipo expands the sidebar */}
      <Box
        onClick={!isMobile && collapsed ? onToggleCollapse : undefined}
        sx={{
          // Cuando está colapsado, la altura se adapta al colibrí; expandido, alineado con el topbar
          height: collapsed ? 'auto' : TOPBAR_HEIGHT,
          minHeight: TOPBAR_HEIGHT,
          py: collapsed ? 1.5 : 0,
          display: 'flex',
          alignItems: 'center',
          px: collapsed ? 0 : 1.5,
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
          cursor: !isMobile && collapsed ? 'pointer' : 'default',
          transition: 'background 0.15s',
          '&:hover': !isMobile && collapsed ? { background: 'rgba(255,255,255,0.06)' } : {},
        }}
      >
        {collapsed ? (
          // Isotipo dedicado — sin recortes, sin overflow hidden
          <img
            src={colibri}
            alt="Emphasys"
            style={{ height: COLIBRI_HEIGHT, width: 'auto' }}
          />
        ) : (
          <>
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', pl: 0.5 }}>
              <img
                src={logo}
                alt="Emphasys"
                style={{ height: LOGO_HEIGHT, width: 'auto', maxWidth: '100%' }}
              />
            </Box>
            {!isMobile && (
              <IconButton
                onClick={onToggleCollapse}
                size="small"
                sx={{
                  color: 'rgba(255,255,255,0.45)',
                  flexShrink: 0,
                  ml: 0.5,
                  '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </>
        )}
      </Box>

      {/* Nav items */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 2 },
      }}>
        {navItems.map((item) => {
          const active = isNavActive(item.path, pathname);
          const Icon = item.icon;
          return (
            <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right" arrow>
              <Box
                onClick={() => onNavigate(item.path)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: collapsed ? 0 : 1.25,
                  py: 0.85,
                  mx: 0.75,
                  mb: 0.25,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  // Left accent rail — renders as inset shadow so it doesn't affect layout
                  boxShadow: active && !collapsed ? `inset 3px 0 0 ${ACCENT}` : 'none',
                  transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
                  '&:hover': {
                    background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                    color: '#fff',
                  },
                }}
              >
                <Icon sx={{ fontSize: 18, flexShrink: 0 }} />
                {!collapsed && (
                  <Typography sx={{
                    fontSize: 13, fontWeight: 'inherit', color: 'inherit',
                    lineHeight: 1, whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Footer: user avatar + logout */}
      <Box sx={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        px: collapsed ? 0.75 : 1.25,
        py: 1,
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </Box>
          {!collapsed && (
            <Typography sx={{
              flex: 1, fontSize: 12, fontWeight: 500,
              color: 'rgba(255,255,255,0.82)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {userName}
            </Typography>
          )}
          <Tooltip title="Cambiar contraseña">
            <IconButton
              size="small"
              onClick={onChangePassword}
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' } }}
            >
              <LockResetIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cerrar sesión">
            <IconButton
              size="small"
              onClick={onLogout}
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.1)' } }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

// Rutas bajo /ventas/ que no son pestañas de tipo de documento y no deben redirigirse
const SPECIAL_VENTAS_PATHS = new Set(['cotizaciones-grid', 'produccion']);

export default function SidebarLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { session, setSession, logout } = useSession();

  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try { return localStorage.getItem('em_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const userName = session.user?.nombre || 'Usuario';
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const empresaId = session.empresaActivaId;

  const [ventasTabs, setVentasTabs] = React.useState<DocumentoTabDef[]>([]);
  const [comprasTabs, setComprasTabs] = React.useState<DocumentoTabDef[]>([]);

  // Roles del usuario en la empresa activa: solo determinan qué se muestra en el
  // menú (UX). La restricción real de datos vive en backend (scope-comercial.ts).
  const sessionRef = React.useRef(session);
  sessionRef.current = session;

  React.useEffect(() => {
    if (!empresaId) return undefined;
    let active = true;
    (async () => {
      try {
        const response = await apiFetch('/auth/me');
        if (!response.ok || !active) return;
        const data = await response.json();
        if (!active) return;
        const roles: RolResumen[] = Array.isArray(data?.roles) ? data.roles : [];
        setSession({ ...sessionRef.current, roles });
      } catch (error) {
        console.error('[SidebarLayout] Error cargando roles del usuario:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [empresaId]);

  const esVendedorSinAdmin = esRolVendedor(session.roles) && !esRolAdmin(session.roles);
  const visibleNavItems = esVendedorSinAdmin
    ? NAV_ITEMS.filter((item) => ALLOWED_PREFIXES_VENDEDOR.some((prefix) => item.path.startsWith(prefix)))
    : NAV_ITEMS;

  // UX: si un vendedor navega directo por URL a un módulo no permitido, se redirige.
  // La seguridad real de los datos la aplica siempre el backend, no esta redirección.
  React.useEffect(() => {
    if (!esVendedorSinAdmin) return;
    const permitido = ALLOWED_PREFIXES_VENDEDOR.some((prefix) => location.pathname.startsWith(prefix));
    if (!permitido) {
      navigate(RUTA_DEFAULT_VENDEDOR, { replace: true });
    }
  }, [esVendedorSinAdmin, location.pathname, navigate]);

  React.useEffect(() => {
    const loadDocTabs = async () => {
      if (!empresaId) { setVentasTabs([]); setComprasTabs([]); return; }
      try {
        const [ventas, compras, modulos] = await Promise.all([
          fetchTiposDocumentoHabilitados('ventas'),
          fetchTiposDocumentoHabilitados('compras'),
          fetchParametrosSistema(),
        ]);
        const sortDocs = (docs: typeof ventas) => [...docs].sort(compareDocumentoVisualOrder);
        const mergeDocs = (docs: typeof ventas, modulo: 'ventas' | 'compras'): DocumentoTabDef[] => {
          const base = sortDocs(docs).map((d) => ({
            label: (d as { nombre_plural?: string; nombre?: string; codigo: string }).nombre_plural
              || (d as { nombre?: string; codigo: string }).nombre
              || d.codigo,
            value: d.codigo,
            icon: (d as { icono?: string | null }).icono ?? null,
          }));
          NAVIGATION_DOCUMENT_OVERRIDES[modulo].forEach((extra) => {
            const index = base.findIndex((t) => t.value === extra.value);
            if (index >= 0) base[index] = { ...base[index], ...extra };
            else base.push(extra);
          });
          return base.sort((a, b) =>
            compareDocumentoVisualOrder({ codigo: a.value, nombre: a.label }, { codigo: b.value, nombre: b.label })
          );
        };
        const ventasOrdenadas = mergeDocs(ventas, 'ventas');
        const mostrarProduccion = modulos
          .flatMap((m) => m.parametros)
          .some((p) => p.clave === 'mostrar_modulo_produccion' && toBoolean(p.valor_resuelto));
        if (mostrarProduccion && !ventasOrdenadas.find((t) => t.value === 'produccion')) {
          ventasOrdenadas.push({ label: 'Producción', value: 'produccion', icon: 'PlaylistAddCheck' });
        }
        setVentasTabs(ventasOrdenadas);
        setComprasTabs(mergeDocs(compras, 'compras'));
      } catch {
        setVentasTabs([]);
        setComprasTabs([]);
      }
    };
    void loadDocTabs();
  }, [empresaId]);

  const docModulo = location.pathname.startsWith('/ventas/')
    ? ('ventas' as const)
    : location.pathname.startsWith('/compras/')
    ? ('compras' as const)
    : null;
  const docTab = docModulo ? (location.pathname.split('/')[2] || '') : '';
  const documentTabs = docModulo === 'ventas' ? ventasTabs : docModulo === 'compras' ? comprasTabs : [];

  const handleDocumentTabChange = (_: React.SyntheticEvent, value: string) => {
    if (docModulo === 'ventas') navigate(`/ventas/${value}`);
    else if (docModulo === 'compras') navigate(`/compras/${value}`);
  };

  // Si el segmento de la URL no coincide con ninguna pestaña disponible, redirige a la primera habilitada
  React.useEffect(() => {
    if (!docModulo || documentTabs.length === 0) return;
    if (docModulo === 'ventas' && SPECIAL_VENTAS_PATHS.has(docTab)) return;
    const tabExists = documentTabs.some((t) => t.value === docTab);
    if (!tabExists && documentTabs[0]) {
      navigate(`/${docModulo}/${documentTabs[0].value}`, { replace: true });
    }
  }, [docModulo, docTab, documentTabs, navigate]);

  const documentTabBar = documentTabs.length > 0 ? (
    <Box sx={{ background: '#f6f8fa', borderBottom: '1px solid #e5e7eb', px: 2.5, pt: 1.5, pb: 0, flexShrink: 0 }}>
      <Tabs
        value={docTab}
        onChange={handleDocumentTabChange}
        variant="scrollable"
        allowScrollButtonsMobile
        textColor="inherit"
        TabIndicatorProps={{ style: { display: 'none' } }}
        sx={{
          minHeight: 0,
          '& .MuiTabs-flexContainer': { alignItems: 'flex-end' },
          '& .MuiTab-root': {
            minHeight: 0,
            textTransform: 'none',
            fontWeight: 600,
            color: '#4b5563',
            borderTop: '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            padding: '8px 10px',
            mr: 1,
            alignItems: 'flex-end',
          },
          '& .Mui-selected': {
            color: '#1d2f68',
            backgroundColor: '#fff',
            borderTop: `3px solid ${ACCENT}`,
            borderLeft: '1px solid #e5e7eb',
            borderRight: '1px solid #e5e7eb',
            borderBottom: '1px solid #fff',
          },
          '& .MuiTab-root:hover': {
            color: '#1d2f68',
            backgroundColor: '#f1f3f6',
          },
        }}
      >
        {documentTabs.map((tab) => {
          const Icon = tab.icon ? DOC_ICON_MAP[tab.icon] : null;
          const iconProps = Icon
            ? { icon: <Icon fontSize="small" /> as React.ReactElement, iconPosition: 'start' as const }
            : {};
          return (
            <Tab
              key={tab.value}
              label={tab.label}
              value={tab.value}
              {...iconProps}
              disableRipple
            />
          );
        })}
      </Tabs>
    </Box>
  ) : null;

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('em_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    let effectivePath = path;
    if (path.startsWith('/ventas/') && ventasTabs.length > 0 && ventasTabs[0]) {
      effectivePath = `/ventas/${ventasTabs[0].value}`;
    } else if (path.startsWith('/compras/') && comprasTabs.length > 0 && comprasTabs[0]) {
      effectivePath = `/compras/${comprasTabs[0].value}`;
    }
    navigate(effectivePath);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navProps: SidebarNavProps = {
    collapsed,
    isMobile,
    pathname: location.pathname,
    userName,
    navItems: visibleNavItems,
    onToggleCollapse: handleToggleCollapse,
    onNavigate: handleNavigate,
    onLogout: handleLogout,
    onChangePassword: () => setChangePasswordOpen(true),
  };

  // ── MOBILE (sin cambios) ──
  if (isMobile) {
    return (
      <>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ background: BRAND, borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Toolbar sx={{ minHeight: '56px !important', px: 2, gap: 1 }}>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <img src={logo} alt="Emphasys" style={{ height: 24, width: 'auto' }} />
            </Box>
            <Box sx={{ flex: 1 }} />
            <EmpresaSelector />
          </Toolbar>
        </AppBar>

        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          PaperProps={{ sx: { width: SIDEBAR_WIDTH, background: BRAND, border: 'none' } }}
        >
          <SidebarNav {...navProps} collapsed={false} />
        </Drawer>

        <Box sx={{ mt: '56px' }}>
          {documentTabBar}
          <Outlet />
        </Box>
        <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      </>
    );
  }

  // ── DESKTOP ──
  return (
    <>
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar */}
      <Box sx={{
        width: sidebarWidth,
        flexShrink: 0,
        background: BRAND,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        <SidebarNav {...navProps} />
      </Box>

      {/* Main area — minWidth:0 prevents flex children from overflowing */}
      <Box sx={{
        flex: 1,
        ml: `${sidebarWidth}px`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        transition: 'margin-left 0.2s ease',
        minWidth: 0,
      }}>

        {/* TopBar */}
        <Box sx={{
          height: TOPBAR_HEIGHT,
          background: BRAND,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          px: 3,
          gap: 2,
          flexShrink: 0,
        }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb}>
                {index > 0 && (
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1, mx: 0.25 }}>
                    ›
                  </Typography>
                )}
                <Typography sx={{
                  fontSize: 13,
                  fontWeight: index === breadcrumbs.length - 1 ? 600 : 400,
                  color: index === breadcrumbs.length - 1 ? '#fff' : 'rgba(255,255,255,0.65)',
                  lineHeight: 1,
                }}>
                  {crumb}
                </Typography>
              </React.Fragment>
            ))}
          </Box>
          <EmpresaSelector />
        </Box>

        {documentTabBar}

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', background: '#eef1f4', py: 2, px: 2, minHeight: 0 }}>
          <Box
            component="main"
            sx={{
              width: '100%',
              minHeight: '70vh',
              background: '#fff',
              borderRadius: 2,
              border: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Outlet />
          </Box>
        </Box>

      </Box>
    </Box>
    <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </>
  );
}
