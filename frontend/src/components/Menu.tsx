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

type MainMenuItemsProps = {
  selectedSection: string;
  onSelect: (section: string) => void;
  variant?: 'horizontal' | 'vertical';
};

export function MainMenuLogo() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <img src={logo} alt="Logo Emphasys" style={{ height: 44, width: 'auto' }} />
    </Box>
  );
}

export function MainMenuItems({ selectedSection, onSelect, variant = 'horizontal' }: MainMenuItemsProps) {
  const handleMenuClick = (index: number, _event: React.MouseEvent<HTMLElement>) => {
    const item = MAIN_MENUS[index];
    if (!item) return;
    onSelect(item.label);
  };

  const isVertical = variant === 'vertical';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: isVertical ? 'stretch' : 'center',
        gap: isVertical ? 0.75 : 1.1,
        height: '100%',
        minWidth: 0,
        flexDirection: isVertical ? 'column' : 'row',
      }}
    >
      {MAIN_MENUS.map((menu, idx) => {
        const active = selectedSection === menu.label;
        return (
          <Button
            key={menu.label}
            onClick={(e) => handleMenuClick(idx, e)}
            sx={{
              height: isVertical ? 'auto' : '100%',
              alignItems: 'center',
              justifyContent: isVertical ? 'flex-start' : 'center',
              color: isVertical ? (active ? azul : '#334155') : active ? '#fff' : grisInactivo,
              fontWeight: active ? 700 : 600,
              textTransform: 'none',
              fontSize: 15,
              borderRadius: isVertical ? 1 : 0,
              borderBottom: !isVertical && active ? `3px solid ${verde}` : '3px solid transparent',
              backgroundColor: isVertical && active ? 'rgba(29,47,104,0.12)' : 'transparent',
              '&:hover': {
                backgroundColor: isVertical ? 'rgba(29,47,104,0.16)' : 'transparent',
                color: isVertical ? azul : '#fff',
                borderBottom: !isVertical ? `3px solid ${verde}` : '3px solid transparent',
              },
              px: isVertical ? 1.5 : 1.25,
              py: isVertical ? 1 : 0,
              minWidth: 0,
              width: isVertical ? '100%' : 'auto',
              textAlign: isVertical ? 'left' : 'center',
            }}
          >
            {menu.label}
          </Button>
        );
      })}
    </Box>
  );
}

export default function MainMenu({ selectedSection, onSelect }: MainMenuProps) {
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
      <MainMenuLogo />
      <MainMenuItems selectedSection={selectedSection} onSelect={onSelect} />
    </Box>
  );
}
