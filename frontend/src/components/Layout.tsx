import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MainMenu, { MainMenuItems, MainMenuLogo } from './Menu.js';
import EmpresaSelector from './EmpresaSelector.js';
import { MODULE_TABS, MODULE_DESCRIPTIONS } from './navigationData.js';
import { useSession } from '../session/useSession';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import DescriptionIcon from '@mui/icons-material/Description';
import { fetchTiposDocumentoHabilitados } from '../services/tiposDocumentoService';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, session } = useSession();
  const userName = session.user?.nombre || 'Usuario';
  const empresaId = session.empresaActivaId;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [ventasTabs, setVentasTabs] = React.useState<{ label: string; value: string; icon?: string | null }[]>([]);
  const [comprasTabs, setComprasTabs] = React.useState<{ label: string; value: string; icon?: string | null }[]>([]);
  const iconMap: Record<string, React.ComponentType<any>> = React.useMemo(
    () => ({
      RequestQuote: RequestQuoteIcon,
      ShoppingCart: ShoppingCartIcon,
      LocalShipping: LocalShippingIcon,
      AssignmentReturn: AssignmentReturnIcon,
      ReceiptLong: ReceiptLongIcon,
      PlaylistAddCheck: PlaylistAddCheckIcon,
      Inventory: InventoryIcon,
      Warehouse: WarehouseIcon,
      Description: DescriptionIcon,
    }),
    []
  );

  React.useEffect(() => {
    const loadTabs = async () => {
      if (!empresaId) {
        setVentasTabs([]);
        return;
      }
      try {
        const [ventas, compras] = await Promise.all([
          fetchTiposDocumentoHabilitados('ventas'),
          fetchTiposDocumentoHabilitados('compras'),
        ]);

        const sortDocs = (docs: typeof ventas) =>
          [...docs].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));

        const ventasOrdenadas = sortDocs(ventas).map((d) => ({ label: d.nombre_plural || d.nombre || d.codigo, value: d.codigo, icon: d.icono }));
        const mostrarVistaExcelCotizaciones = false;
        const extras = mostrarVistaExcelCotizaciones
          ? [{ label: 'Vista Excel cotizaciones', value: 'cotizaciones-grid', icon: 'Description' as string | null }]
          : [];
        const combinadas = [...ventasOrdenadas];
        extras.forEach((extra) => {
          if (!combinadas.find((t) => t.value === extra.value)) combinadas.push(extra);
        });
        setVentasTabs(combinadas);
        setComprasTabs(
          sortDocs(compras).map((d) => ({ label: d.nombre_plural || d.nombre || d.codigo, value: d.codigo, icon: d.icono }))
        );
      } catch (err) {
        console.error('No se pudieron cargar los tabs de ventas', err);
        setVentasTabs([]);
        setComprasTabs([]);
      }
    };
    void loadTabs();
  }, [empresaId]);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const sectionPathMap: Record<string, string> = {
    Configuración: '/configuracion',
    CRM: '/crm',
    Informes: '/informes/ia',
  };

  const tabPathMap: Record<string, string> = {
    Contactos: '/contactos',
    Productos: '/productos',
    Finanzas: '/finanzas',
    Movimientos: '/inventario/movimientos',
    "Pregúntale a tu negocio": '/informes/ia',
  };

  const getTabFromPath = (pathname: string): string => {
    if (pathname.startsWith('/configuracion')) return '';
    if (pathname.startsWith('/ventas/')) return pathname.split('/')[2] || '';
    if (pathname.startsWith('/compras/')) return pathname.split('/')[2] || '';
    if (pathname.startsWith('/informes/')) return "Pregúntale a tu negocio";
    if (pathname.startsWith('/crm') || pathname.startsWith('/leads') || pathname.startsWith('/oportunidades')) return '';
    if (pathname.startsWith('/finanzas')) return 'Finanzas';
    if (pathname.startsWith('/inventario/')) return 'Movimientos';
    if (pathname.startsWith('/productos')) return 'Productos';
    if (pathname.startsWith('/contactos')) return 'Contactos';
    return MODULE_TABS['Catálogos']?.[0] || '';
  };

  const getSectionFromPath = (pathname: string): string => {
    if (pathname.startsWith('/configuracion')) return 'Configuración';
    if (pathname.startsWith('/ventas/')) return 'Ventas';
    if (pathname.startsWith('/compras/')) return 'Compras';
  if (pathname.startsWith('/finanzas')) return 'Finanzas';
  if (pathname.startsWith('/inventario/')) return 'Inventarios';
  if (pathname.startsWith('/informes/')) return 'Informes';
  if (pathname.startsWith('/crm') || pathname.startsWith('/leads') || pathname.startsWith('/oportunidades')) return 'CRM';
    const tab = getTabFromPath(pathname);
    return getSectionForTab(tab);
  };

  const getSectionForTab = (tab: string): string => {
    const entry = Object.entries(MODULE_TABS).find(([, tabs]) => tabs.includes(tab));
    return entry ? entry[0] : 'Catálogos';
  };

  const [selectedTab, setSelectedTab] = React.useState<string>(getTabFromPath(location.pathname));
  const [selectedSection, setSelectedSection] = React.useState<string>(getSectionFromPath(location.pathname));

  const tabsForSection =
    selectedSection === 'Ventas'
      ? ventasTabs.map((t) => t.value)
      : selectedSection === 'Compras'
      ? comprasTabs.map((t) => t.value)
      : selectedSection === 'CRM'
      ? []
      : MODULE_TABS[selectedSection] || [];

  React.useEffect(() => {
    const tabFromPath = getTabFromPath(location.pathname);
    setSelectedTab(tabFromPath);
    setSelectedSection(getSectionFromPath(location.pathname));
  }, [location.pathname]);

  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    const availableTabs =
      section === 'Ventas'
        ? ventasTabs.map((t) => t.value)
        : section === 'Compras'
        ? comprasTabs.map((t) => t.value)
        : MODULE_TABS[section] || [];
    const tabWithPath = availableTabs.find((t) => tabPathMap[t]);
    const nextTab = tabWithPath || availableTabs[0];

    if (nextTab) {
      setSelectedTab(nextTab);
      const path = tabPathMap[nextTab];
      if (section === 'Ventas') {
        navigate(`/ventas/${nextTab}`);
      } else if (section === 'Compras') {
        navigate(`/compras/${nextTab}`);
      } else if (section === 'Finanzas') {
        navigate(path || '/finanzas');
      } else if (path) {
        navigate(path);
      }
    } else {
      setSelectedTab('');
      const sectionPath = sectionPathMap[section];
      if (section === 'Informes') {
        navigate('/informes/ia');
        return;
      }
      if (sectionPath) navigate(sectionPath);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, value: string) => {
    setSelectedTab(value);

    if (selectedSection === 'Ventas') {
      navigate(`/ventas/${value}`);
      return;
    }

    if (selectedSection === 'Compras') {
      navigate(`/compras/${value}`);
      return;
    }
    if (selectedSection === 'Finanzas') {
      navigate('/finanzas');
      return;
    }
    if (selectedSection === 'Informes') {
      navigate('/informes/ia');
      return;
    }
    if (selectedSection === 'CRM') {
      navigate('/crm');
      return;
    }

    // Tabs estáticos (Contactos, Productos)
    const path = tabPathMap[value];
    if (path) navigate(path);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleDrawerSelect = (section: string) => {
    handleSectionChange(section);
    handleDrawerClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#eef1f4' }}>
      <Box
        sx={{
          width: '100%',
          background: '#1d2f68',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.25, md: 3 },
          height: 72,
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, flex: 1, minWidth: 0 }}>
          {isMobile ? (
            <>
              <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
                <MenuIcon />
              </IconButton>
              <Box sx={{ minWidth: 0, '& img': { height: 34 } }}>
                <MainMenuLogo />
              </Box>
            </>
          ) : (
            <MainMenu selectedSection={selectedSection} onSelect={handleSectionChange} />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {!isMobile ? <EmpresaSelector /> : null}
          <Tooltip title={userName}>
            <IconButton
              onClick={handleUserMenuOpen}
              size="small"
              color="inherit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.22)' },
              }}
              aria-label="Menú de usuario"
            >
              <PersonIcon sx={{ color: '#fff', fontSize: 22 }} />
              <Typography component="span" sx={{ fontWeight: 600, color: '#fff', display: { xs: 'none', sm: 'inline' } }}>
                {userName}
              </Typography>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleUserMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 200,
              },
            }}
          >
            <MenuItem onClick={handleUserMenuClose}>Perfil</MenuItem>
            <MenuItem onClick={handleUserMenuClose}>Cambiar contraseña</MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                handleUserMenuClose();
                handleLogout();
              }}
              sx={{ color: 'error.main' }}
            >
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Drawer anchor="left" open={drawerOpen} onClose={handleDrawerClose}>
        <Box sx={{ width: 280, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MainMenuLogo />
          {isMobile ? (
            <>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 0.3 }}>
                  EMPRESA ACTIVA
                </Typography>
                <EmpresaSelector variant="panel" fullWidth />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#0f172a' }}>
                  <PersonIcon sx={{ fontSize: 20, color: '#1d2f68' }} />
                  <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                    {userName}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Button variant="text" sx={{ justifyContent: 'flex-start', textTransform: 'none' }} onClick={handleDrawerClose}>
                    Perfil
                  </Button>
                  <Button variant="text" sx={{ justifyContent: 'flex-start', textTransform: 'none' }} onClick={handleDrawerClose}>
                    Cambiar contraseña
                  </Button>
                  <Button
                    variant="text"
                    color="error"
                    startIcon={<LogoutIcon />}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    onClick={() => {
                      handleDrawerClose();
                      handleLogout();
                    }}
                  >
                    Cerrar sesión
                  </Button>
                </Box>
              </Box>
              <Divider />
            </>
          ) : null}
          <MainMenuItems selectedSection={selectedSection} onSelect={handleDrawerSelect} variant="vertical" />
        </Box>
      </Drawer>

  <Box sx={{ flex: 1, minHeight: 0, background: '#eef1f4', py: 3, px: { xs: 1.5, md: 2 } }}>
        <Box
          component="main"
          sx={{
            width: '100%',
            minHeight: '70vh',
            background: '#fff',
            boxShadow: '0px 12px 30px rgba(0,0,0,0.05)',
            borderRadius: 2,
            overflow: 'visible',
            position: 'relative',
            border: '1px solid #e5e7eb',
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {tabsForSection.length > 0 && (
            <Box
              sx={{
                background: '#f6f8fa',
                borderBottom: '1px solid #e5e7eb',
                px: 2.5,
                pt: 1.5,
                pb: 0.5,
              }}
            >
              <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                variant="scrollable"
                allowScrollButtonsMobile
                textColor="inherit"
                TabIndicatorProps={{ style: { display: 'none' } }}
                sx={{
                  minHeight: 0,
                  '& .MuiTabs-flexContainer': {
                    alignItems: 'flex-end',
                  },
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
                    borderTop: '3px solid #006261',
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
                {selectedSection === 'Ventas'
                  ? ventasTabs.map((tab) => {
                      const IconComponent = tab.icon ? iconMap[tab.icon] : null;
                      if (IconComponent) {
                        return (
                          <Tab
                            key={tab.value}
                            label={tab.label}
                            value={tab.value}
                            icon={<IconComponent fontSize="small" />}
                            iconPosition="start"
                            disableRipple
                          />
                        );
                      }
                      return <Tab key={tab.value} label={tab.label} value={tab.value} disableRipple />;
                    })
                  : selectedSection === 'Compras'
                  ? comprasTabs.map((tab) => {
                      const IconComponent = tab.icon ? iconMap[tab.icon] : null;
                      if (IconComponent) {
                        return (
                          <Tab
                            key={tab.value}
                            label={tab.label}
                            value={tab.value}
                            icon={<IconComponent fontSize="small" />}
                            iconPosition="start"
                            disableRipple
                          />
                        );
                      }
                      return <Tab key={tab.value} label={tab.label} value={tab.value} disableRipple />;
                    })
                  : tabsForSection.map((tab) => <Tab key={tab} label={tab} value={tab} disableRipple />)}
              </Tabs>
            </Box>
          )}

          <Box sx={{ flex: 1, minHeight: 0, p: 0 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}