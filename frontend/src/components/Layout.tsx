import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Menu from './Menu.js';
import { MODULE_TABS, MODULE_DESCRIPTIONS } from './navigationData.js';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const tabPathMap: Record<string, string> = {
    Contactos: '/contactos',
    Productos: '/productos',
  };

  const getTabFromPath = (pathname: string): string => {
    if (pathname.startsWith('/productos')) return 'Productos';
    if (pathname.startsWith('/contactos')) return 'Contactos';
    return MODULE_TABS['Catálogos']?.[0] || '';
  };

  const getSectionForTab = (tab: string): string => {
    const entry = Object.entries(MODULE_TABS).find(([, tabs]) => tabs.includes(tab));
    return entry ? entry[0] : 'Catálogos';
  };

  const [selectedTab, setSelectedTab] = React.useState<string>(getTabFromPath(location.pathname));
  const [selectedSection, setSelectedSection] = React.useState<string>(getSectionForTab(selectedTab));

  const tabsForSection = MODULE_TABS[selectedSection] || [];

  React.useEffect(() => {
    const tabFromPath = getTabFromPath(location.pathname);
    setSelectedTab(tabFromPath);
    setSelectedSection(getSectionForTab(tabFromPath));
  }, [location.pathname]);

  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    const nextTab = MODULE_TABS[section]?.[0];
    if (nextTab) {
      setSelectedTab(nextTab);
      const path = tabPathMap[nextTab];
      if (path) navigate(path);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, value: string) => {
    setSelectedTab(value);
    const path = tabPathMap[value];
    if (path) navigate(path);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#eef1f4' }}>
  <Menu selectedSection={selectedSection} onSelect={handleSectionChange} />

      <Box sx={{ flex: 1, minHeight: 0, background: '#eef1f4', py: 3, px: 3 }}>
        <Box
          component="main"
          sx={{
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            minHeight: '70vh',
            background: '#fff',
            boxShadow: '0px 12px 30px rgba(0,0,0,0.05)',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <Box
            sx={{
              background: '#f6f8fa',
              borderBottom: '1px solid #e5e7eb',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              {selectedSection}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              {MODULE_DESCRIPTIONS[selectedSection] || ''}
            </Typography>

            {tabsForSection.length > 0 && (
              <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                variant="scrollable"
                allowScrollButtonsMobile
                textColor="inherit"
                TabIndicatorProps={{ style: { display: 'none' } }}
                sx={{
                  pt: 1,
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
                    padding: '10px 12px',
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
                {tabsForSection.map((tab) => (
                  <Tab key={tab} label={tab} value={tab} disableRipple />
                ))}
              </Tabs>
            )}
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, p: 3 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}