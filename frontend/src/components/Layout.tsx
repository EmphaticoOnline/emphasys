import React from 'react';
import Box from '@mui/material/Box';
import Menu from './Menu.js';
import { MODULE_TABS, MODULE_DESCRIPTIONS } from './navigationData.js';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [selectedSection, setSelectedSection] = React.useState('Catálogos');
  const [selectedTab, setSelectedTab] = React.useState<string>(MODULE_TABS['Catálogos']?.[0] || '');

  const tabsForSection = MODULE_TABS[selectedSection] || [];

  React.useEffect(() => {
    const nextTab = tabsForSection[0] || '';
    setSelectedTab(nextTab);
  }, [selectedSection]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#eef1f4' }}>
      <Menu selectedSection={selectedSection} onSelect={setSelectedSection} />

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
            <Box sx={{ color: '#1d2f68', fontSize: 24, fontWeight: 700 }}>{selectedSection}</Box>
            <Box sx={{ color: '#4b5563', fontSize: 14 }}>
              {MODULE_DESCRIPTIONS[selectedSection] || ''}
            </Box>

            {tabsForSection.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', pt: 1 }}>
                {tabsForSection.map((tab) => {
                  const active = tab === selectedTab;
                  return (
                    <Box
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      sx={{
                        cursor: 'pointer',
                        px: 1.5,
                        py: 1,
                        fontSize: 14,
                        fontWeight: active ? 700 : 500,
                        color: active ? '#1d2f68' : '#4b5563',
                        backgroundColor: active ? '#fff' : 'transparent',
                        borderTop: active ? `3px solid #006261` : '3px solid transparent',
                        borderLeft: active ? '1px solid #e5e7eb' : '1px solid transparent',
                        borderRight: active ? '1px solid #e5e7eb' : '1px solid transparent',
                        borderBottom: active ? '1px solid #fff' : '1px solid transparent',
                        borderTopLeftRadius: 6,
                        borderTopRightRadius: 6,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          color: '#1d2f68',
                          backgroundColor: active ? '#fff' : '#f1f3f6',
                        },
                      }}
                    >
                      {tab}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, p: 3 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}