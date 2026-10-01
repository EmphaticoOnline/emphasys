import * as React from 'react';
import { Alert, Box, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import ActividadesPage from './ActividadesPage';
import LeadsPage from './LeadsPage';
import OportunidadesPage from './OportunidadesPage';
import { CRM_TABS } from '../components/crmNavigation';
import { esRolAdmin } from '../session/rolScope';
import { useSession } from '../session/useSession';

type CrmTabKey = (typeof CRM_TABS)[number]['key'];


function getActiveTab(pathname: string): CrmTabKey {
  if (pathname === '/crm') return 'conversaciones';
  if (pathname === '/crm/actividades') return 'actividades';
  if (pathname.startsWith('/crm/oportunidades')) return 'oportunidades';
  if (pathname.startsWith('/crm/conversaciones')) return 'conversaciones';
  return 'conversaciones';
}

export default function CRMPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const tabsVisibles = CRM_TABS.filter((tab) => tab.key !== 'evaluacion-vendedores' || esRolAdmin(session.roles));
  const activeTab = getActiveTab(location.pathname);
  // Mismo patrón de detección responsiva usado en el resto del proyecto.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // Lo actualiza LeadsPage (vía onMobileConversationOpenChange) cuando el
  // chat móvil de Conversaciones se abre/cierra. Con eso, mientras el chat
  // ocupa la pantalla completa, este encabezado general de CRM (título,
  // descripción y pestañas) deja de renderizarse para no restarle altura ni
  // reaparecer al hacer scroll dentro del chat. No afecta Actividades ni
  // Oportunidades, ni la bandeja móvil de Conversaciones, ni escritorio.
  const [mobileConversationOpen, setMobileConversationOpen] = React.useState(false);
  const hideChromeForMobileChat = isMobile && activeTab === 'conversaciones' && mobileConversationOpen;

  const handleTabChange = (_event: React.SyntheticEvent, nextTab: CrmTabKey) => {
    const targetTab = tabsVisibles.find((tab) => tab.key === nextTab);
    if (targetTab && targetTab.path !== location.pathname) {
      navigate(targetTab.path);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'oportunidades':
        return <OportunidadesPage />;
      case 'conversaciones':
        return <LeadsPage onMobileConversationOpenChange={setMobileConversationOpen} />;
      case 'actividades':
        return <ActividadesPage />;
      default:
        return <Alert severity="warning">No se encontró la vista solicitada del CRM.</Alert>;
    }
  };

  // Conversaciones y Actividades ya traen su propio contexto operativo.
  // El título "CRM" se conserva en Oportunidades, que aún no se homologa.
  const compactCrmChrome = activeTab === 'conversaciones' || activeTab === 'actividades';
  const documentNav = theme.emphasys.documentNav;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      ...(activeTab === 'actividades' ? { flex: 1, height: '100%', overflow: 'hidden' } : {}),
    }}>
      {!hideChromeForMobileChat && (
        <Box sx={{ px: { xs: 2, md: 2.5 }, pt: compactCrmChrome ? 1.25 : 2.5, pb: 0.5, flexShrink: 0 }}>
          {!compactCrmChrome && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="h5" fontWeight={700} color="#1d2f68">
                CRM
              </Typography>
              <Typography variant="body2" color="#4b5563" sx={{ mt: 0.5 }}>
                Gestiona actividades, oportunidades y conversaciones desde un solo módulo.
              </Typography>
            </Box>
          )}

          <Tabs
            value={activeTab}
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
                fontWeight: 650,
                color: documentNav.foreground,
                borderTop: '3px solid transparent',
                borderRadius: '8px 8px 0 0',
                padding: '8px 12px',
                mr: 0.5,
                alignItems: 'flex-end',
              },
              '& .Mui-selected': {
                color: documentNav.selectedForeground,
                backgroundColor: documentNav.selectedBackground,
                borderTop: `3px solid ${documentNav.indicator}`,
                borderLeft: `1px solid ${documentNav.border}`,
                borderRight: `1px solid ${documentNav.border}`,
                borderBottom: `1px solid ${documentNav.selectedBackground}`,
              },
              '& .MuiTab-root:hover': {
                color: documentNav.hoverForeground,
                backgroundColor: documentNav.hoverBackground,
              },
            }}
          >
            {tabsVisibles.map((tab) => (
              <Tab key={tab.key} value={tab.key} label={tab.label} />
            ))}
          </Tabs>
        </Box>
      )}

      <Box sx={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(activeTab === 'actividades' ? { flex: 1, overflow: 'hidden' } : {}),
        ...(hideChromeForMobileChat ? { overflow: 'hidden' } : {}),
      }}>{renderContent()}</Box>
    </Box>
  );
}
