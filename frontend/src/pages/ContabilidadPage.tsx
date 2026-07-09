import * as React from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONTABILIDAD_TABS } from '../components/contabilidadNavigation';
import CuentasTab from '../modules/contabilidad/CuentasTab';
import ConfiguracionTab from '../modules/contabilidad/ConfiguracionTab';
import RangosTab from '../modules/contabilidad/RangosTab';
import TiposPolizaTab from '../modules/contabilidad/TiposPolizaTab';
import PolizasTab from '../modules/contabilidad/PolizasTab';
import EContabilidadTab from '../modules/contabilidad/EContabilidadTab';

type ContabilidadTabKey = (typeof CONTABILIDAD_TABS)[number]['key'];

const CONTABILIDAD_TAB_STYLE = {
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

function getActiveTab(pathname: string): ContabilidadTabKey {
  const match = CONTABILIDAD_TABS.find((tab) => tab.path === pathname);
  return match ? match.key : 'polizas';
}

function TabPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </Box>
  );
}

export default function ContabilidadPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);
  const activeTabDef = CONTABILIDAD_TABS.find((tab) => tab.key === activeTab) ?? CONTABILIDAD_TABS[0];

  const handleTabChange = (_event: React.SyntheticEvent, nextTab: ContabilidadTabKey) => {
    const targetTab = CONTABILIDAD_TABS.find((tab) => tab.key === nextTab);
    if (targetTab && targetTab.path !== location.pathname) {
      navigate(targetTab.path);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 1, pb: 0.5 }}>
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
            '& .MuiTab-root': CONTABILIDAD_TAB_STYLE,
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
          {CONTABILIDAD_TABS.map((tab) => (
            <Tab key={tab.key} value={tab.key} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ minHeight: 0 }}>
        {activeTab === 'cuentas' && <CuentasTab />}
        {activeTab === 'polizas' && <PolizasTab />}
        {activeTab === 'rangos' && <RangosTab />}
        {activeTab === 'tipos-poliza' && <TiposPolizaTab />}
        {activeTab === 'configuracion' && <ConfiguracionTab />}
        {activeTab === 'e-contabilidad' && <EContabilidadTab />}
        {activeTab !== 'cuentas' &&
          activeTab !== 'polizas' &&
          activeTab !== 'rangos' &&
          activeTab !== 'tipos-poliza' &&
          activeTab !== 'configuracion' &&
          activeTab !== 'e-contabilidad' && (
            <TabPlaceholder title={activeTabDef.title} description={activeTabDef.description} />
          )}
      </Box>
    </Box>
  );
}
