import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { MainMenuItems, MainMenuLogo } from './Menu.js';
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
import BuildIcon from '@mui/icons-material/Build';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import VersionUpdateDrawer from './VersionUpdateDrawer';
import { useVersionUpdateNotice } from '../hooks/useVersionUpdateNotice';
import { compareDocumentoVisualOrder } from '../modules/documentos/documentoVisualOrder';
import { fetchTiposDocumentoHabilitados } from '../services/tiposDocumentoService';
import { fetchParametrosSistema } from '../services/parametrosService';
import { apiFetch } from '../services/apiFetch';
import { useResponsiveMainMenuMode } from '../hooks/useResponsiveMainMenuMode.js';

interface LayoutProps {
  children: React.ReactNode;
}

type DocumentoTabDef = { label: string; value: string; icon?: string | null };

const NAVIGATION_DOCUMENT_OVERRIDES: Record<'ventas' | 'compras', DocumentoTabDef[]> = {
  ventas: [{ value: 'pago_cliente', label: 'Pagos', icon: 'AccountBalanceWallet' }],
  compras: [{ value: 'pago_proveedor', label: 'Pagos Proveedor', icon: 'AccountBalanceWallet' }],
};

type ActividadRecordatorio = {
  id: number;
  tipo_actividad: string;
  notas: string | null;
  fecha_programada: string;
  oportunidad_id: number | null;
};

async function fetchRecordatoriosActividades() {
  return apiFetch<ActividadRecordatorio[]>('/api/crm/actividades/recordatorios');
}

async function marcarRecordatorioDisparado(actividadId: number) {
  return apiFetch(`/api/crm/actividades/${actividadId}/recordatorio-disparado`, {
    method: 'PATCH',
  });
}

function getRecordatorioTexto(actividad: ActividadRecordatorio) {
  const notas = actividad.notas?.trim();
  if (notas) {
    return notas;
  }

  return `Actividad de ${actividad.tipo_actividad}`;
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'si', 'sí', 'on'].includes(normalized);
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, session } = useSession();
  const userName = session.user?.nombre || 'Usuario';
  const empresaId = session.empresaActivaId;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const { version: systemVersion, open: versionDrawerOpen, dismiss: dismissVersionDrawer, updateNow: updateNowVersion } = useVersionUpdateNotice();

  const moduleNavSlotRef = React.useRef<HTMLDivElement | null>(null);
  const moduleNavProbeRef = React.useRef<HTMLDivElement | null>(null);
  const useCompactNavigationByWidth = useResponsiveMainMenuMode({
    availableRef: moduleNavSlotRef,
    contentRef: moduleNavProbeRef,
    enterCompactPx: 24,
    exitCompactPx: 48,
  });
  const useCompactNavigation = isMobile || useCompactNavigationByWidth;
  const reserveEmpresaSlotForTabletCompact = isTablet && useCompactNavigation;

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [recordatoriosQueue, setRecordatoriosQueue] = React.useState<ActividadRecordatorio[]>([]);
  const [recordatorioActual, setRecordatorioActual] = React.useState<ActividadRecordatorio | null>(null);
  const recordatoriosProcesadosRef = React.useRef<Set<number>>(new Set());

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
      Build: BuildIcon,
      AccountBalanceWallet: AccountBalanceWalletIcon,
    }),
    []
  );

  React.useEffect(() => {
    const loadTabs = async () => {
      if (!empresaId) {
        setVentasTabs([]);
        setComprasTabs([]);
        return;
      }
      try {
        const [ventas, compras, modulos] = await Promise.all([
          fetchTiposDocumentoHabilitados('ventas'),
          fetchTiposDocumentoHabilitados('compras'),
          fetchParametrosSistema(),
        ]);

        const sortDocs = (docs: typeof ventas) => [...docs].sort(compareDocumentoVisualOrder);
        const mergeNavigationDocs = (docs: typeof ventas, modulo: 'ventas' | 'compras'): DocumentoTabDef[] => {
          const base = sortDocs(docs).map((d) => ({ label: d.nombre_plural || d.nombre || d.codigo, value: d.codigo, icon: d.icono }));
          NAVIGATION_DOCUMENT_OVERRIDES[modulo].forEach((extra) => {
            const index = base.findIndex((tab) => tab.value === extra.value);
            if (index >= 0) {
              base[index] = { ...base[index], ...extra };
            } else {
              base.push(extra);
            }
          });
          return base.sort((a, b) => compareDocumentoVisualOrder(
            { codigo: a.value, nombre: a.label },
            { codigo: b.value, nombre: b.label }
          ));
        };

        const ventasOrdenadas = mergeNavigationDocs(ventas, 'ventas');
        const mostrarModuloProduccion = modulos
          .flatMap((modulo) => modulo.parametros)
          .some((parametro) => parametro.clave === 'mostrar_modulo_produccion' && toBoolean(parametro.valor_resuelto));
        const mostrarVistaExcelCotizaciones = false;
        const extras = [
          ...(mostrarModuloProduccion
            ? [{ label: 'Producción', value: 'produccion', icon: 'PlaylistAddCheck' as string | null }]
            : []),
          ...(mostrarVistaExcelCotizaciones
            ? [{ label: 'Vista Excel cotizaciones', value: 'cotizaciones-grid', icon: 'Description' as string | null }]
            : []),
        ];
        const combinadas = [...ventasOrdenadas];
        extras.forEach((extra) => {
          if (!combinadas.find((t) => t.value === extra.value)) combinadas.push(extra);
        });
        setVentasTabs(combinadas);
        setComprasTabs(mergeNavigationDocs(compras, 'compras'));
      } catch (err) {
        console.error('No se pudieron cargar los tabs de ventas', err);
        setVentasTabs([]);
        setComprasTabs([]);
      }
    };
    void loadTabs();
  }, [empresaId]);

  React.useEffect(() => {
    if (!session.user || !empresaId) {
      return;
    }

    let active = true;

    const pollRecordatorios = async () => {
      try {
        const actividades = await fetchRecordatoriosActividades();

        if (!active || !actividades.length) {
          return;
        }

        const nuevas = actividades.filter((actividad) => !recordatoriosProcesadosRef.current.has(actividad.id));

        if (!nuevas.length) {
          return;
        }

        setRecordatoriosQueue((prev) => [...prev, ...nuevas]);

        await Promise.allSettled(
          nuevas.map(async (actividad) => {
            try {
              await marcarRecordatorioDisparado(actividad.id);
              recordatoriosProcesadosRef.current.add(actividad.id);
            } catch (error) {
              console.error('No se pudo marcar el recordatorio como disparado:', error);
            }
          })
        );
      } catch (error) {
        console.error('No se pudieron consultar recordatorios de actividades:', error);
      }
    };

    void pollRecordatorios();
    const intervalId = window.setInterval(() => {
      void pollRecordatorios();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [empresaId, session.user]);

  React.useEffect(() => {
    if (recordatorioActual || recordatoriosQueue.length === 0) {
      return;
    }

    const [siguiente, ...resto] = recordatoriosQueue;
    setRecordatorioActual(siguiente);
    setRecordatoriosQueue(resto);
  }, [recordatorioActual, recordatoriosQueue]);

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

  const handleCloseRecordatorio = () => {
    setRecordatorioActual(null);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#eef1f4' }}>
      <Box
        sx={{
          width: '100%',
          background: '#1d2f68',
          color: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.appBar,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.25, md: 3 },
          height: 72,
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, flex: '0 0 auto', minWidth: 0 }}>
          {useCompactNavigation ? (
            <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú principal">
              <MenuIcon />
            </IconButton>
          ) : null}
          <Box sx={{ minWidth: 0, '& img': { height: { xs: useCompactNavigation ? 34 : 44, md: 44 } } }}>
            <MainMenuLogo />
          </Box>
        </Box>

        <Box
          ref={moduleNavSlotRef}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {useCompactNavigation ? null : (
            <MainMenuItems selectedSection={selectedSection} onSelect={handleSectionChange} />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '0 0 auto' }}>
          <Box
            sx={{
              minWidth: 220,
              flex: '0 0 auto',
              display: useCompactNavigation && !reserveEmpresaSlotForTabletCompact ? 'none' : 'block',
              visibility: reserveEmpresaSlotForTabletCompact ? 'hidden' : 'visible',
              pointerEvents: reserveEmpresaSlotForTabletCompact ? 'none' : 'auto',
            }}
          >
            <EmpresaSelector />
          </Box>
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
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, letterSpacing: 0.3 }}>
                Versión:
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {systemVersion || 'Cargando...'}
              </Typography>
            </Box>
            <Divider />
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
          {useCompactNavigation ? (
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

      <VersionUpdateDrawer open={versionDrawerOpen} version={systemVersion} onClose={dismissVersionDrawer} onUpdateNow={updateNowVersion} />

      <Box
        ref={moduleNavProbeRef}
        aria-hidden="true"
        sx={{
          position: 'absolute',
          left: -10000,
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          width: 'max-content',
          height: 'auto',
          overflow: 'hidden',
        }}
      >
        <MainMenuItems selectedSection={selectedSection} onSelect={handleSectionChange} />
      </Box>

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

      <Snackbar
        open={Boolean(recordatorioActual)}
        autoHideDuration={8000}
        onClose={handleCloseRecordatorio}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseRecordatorio}
          severity="info"
          variant="filled"
          sx={{ width: '100%' }}
          action={recordatorioActual ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                navigate(`/crm/actividades/${recordatorioActual.id}`);
                handleCloseRecordatorio();
              }}
            >
              Ver actividad
            </Button>
          ) : null}
        >
          <Typography sx={{ fontWeight: 700 }}>Recordatorio</Typography>
          <Typography variant="body2">{recordatorioActual ? getRecordatorioTexto(recordatorioActual) : ''}</Typography>
        </Alert>
      </Snackbar>
    </Box>
  );
}