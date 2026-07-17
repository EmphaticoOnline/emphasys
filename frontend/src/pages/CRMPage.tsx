import * as React from 'react';
import { Alert, Box, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import ActividadesPage from './ActividadesPage';
import LeadsPage from './LeadsPage';
import OportunidadesPage from './OportunidadesPage';
import { CRM_TABS } from '../components/crmNavigation';

type CrmTabKey = (typeof CRM_TABS)[number]['key'];

const CRM_TAB_STYLE = {
  minHeight: 0,
  textTransform: 'none',
  fontWeight: 600,
  color: '#4b5563',
  borderTop: '3px solid transparent',
  borderRadius: '6px 6px 0 0',
  padding: '8px 10px',
  mr: 1,
  alignItems: 'flex-end',
};

function getActiveTab(pathname: string): CrmTabKey {
  if (pathname === '/crm' || pathname === '/crm/actividades') return 'actividades';
  if (pathname.startsWith('/crm/oportunidades')) return 'oportunidades';
  if (pathname.startsWith('/crm/conversaciones')) return 'conversaciones';
  return 'actividades';
}

export default function CRMPage() {
  const location = useLocation();
  const navigate = useNavigate();
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
    const targetTab = CRM_TABS.find((tab) => tab.key === nextTab);
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!hideChromeForMobileChat && (
        <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2.5, pb: 0.5 }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              CRM
            </Typography>
            <Typography variant="body2" color="#4b5563" sx={{ mt: 0.5 }}>
              Gestiona actividades, oportunidades y conversaciones desde un solo módulo.
            </Typography>
          </Box>

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
              '& .MuiTab-root': CRM_TAB_STYLE,
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
            {CRM_TABS.map((tab) => (
              <Tab key={tab.key} value={tab.key} label={tab.label} />
            ))}
          </Tabs>
        </Box>
      )}

      <Box sx={{ minHeight: 0, ...(hideChromeForMobileChat ? { overflow: 'hidden' } : {}) }}>{renderContent()}</Box>
    </Box>
  );
}