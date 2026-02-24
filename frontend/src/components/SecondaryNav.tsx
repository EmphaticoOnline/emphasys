import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

const azul = '#1d2f68';
const verde = '#006261';

interface SecondaryNavProps {
  tabs: string[];
  selectedTab: string;
  onSelect: (tab: string) => void;
}

export default function SecondaryNav({ tabs, selectedTab, onSelect }: SecondaryNavProps) {
  if (!tabs || tabs.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        height: 48,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      {tabs.map((tab) => {
        const active = tab === selectedTab;
        return (
          <Button
            key={tab}
            onClick={() => onSelect(tab)}
            sx={{
              height: '100%',
              alignItems: 'center',
              color: active ? azul : '#4b5563',
              fontWeight: active ? 700 : 500,
              textTransform: 'none',
              fontSize: 14,
              borderRadius: 0,
              borderBottom: active ? `3px solid ${verde}` : '3px solid transparent',
              '&:hover': {
                backgroundColor: 'transparent',
                color: azul,
                borderBottom: `3px solid ${verde}`,
              },
              px: 1,
              minWidth: 0,
            }}
          >
            {tab}
          </Button>
        );
      })}
    </Box>
  );
}
