import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import AccountCircle from '@mui/icons-material/AccountCircle';
import logo from '../assets/emphasys-w.png';
import { MAIN_MENUS } from './navigationData.js';

const azul = '#1d2f68';
const verde = '#006261';
const grisInactivo = '#c7d0e0';

type MainMenuProps = {
  selectedSection: string;
  onSelect: (section: string) => void;
};

export default function MainMenu({ selectedSection, onSelect }: MainMenuProps) {
  const handleMenuClick = (index: number, _event: React.MouseEvent<HTMLElement>) => {
    const item = MAIN_MENUS[index];
    if (!item) return;
    onSelect(item.label);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        color: '#fff',
        flex: 1,
        minWidth: 0,
        height: '100%',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 999 },
        '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <img src={logo} alt="Logo Emphasys" style={{ height: 44, width: 'auto' }} />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.1,
          height: '100%',
          minWidth: 0,
        }}
      >
        {MAIN_MENUS.map((menu, idx) => {
          const active = selectedSection === menu.label;
          return (
            <Button
              key={menu.label}
              onClick={(e) => handleMenuClick(idx, e)}
              sx={{
                height: '100%',
                alignItems: 'center',
                color: active ? '#fff' : grisInactivo,
                fontWeight: active ? 700 : 600,
                textTransform: 'none',
                fontSize: 15,
                borderRadius: 0,
                borderBottom: active ? `3px solid ${verde}` : '3px solid transparent',
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: '#fff',
                  borderBottom: `3px solid ${verde}`,
                },
                px: 1.25,
                minWidth: 0,
              }}
            >
              {menu.label}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
