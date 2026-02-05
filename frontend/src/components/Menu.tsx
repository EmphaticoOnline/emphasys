import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import AccountCircle from '@mui/icons-material/AccountCircle';
import logo from '../assets/logo-transparente.png';
import Sidebar from './Sidebar.js';

const mainMenus = [
  { label: 'Productos', submenu: ['Catálogo', 'Inventario'] },
  { label: 'Clientes', submenu: ['Listado', 'Segmentos'] },
  { label: 'Proveedores', submenu: ['Listado', 'Cuentas'] },
  { label: 'Finanzas', submenu: ['Cuentas', 'Movimientos'] },
];

const azul = '#1d2f68';
const verde = '#006261';

export default function MainMenu() {
  const [selectedSection, setSelectedSection] = React.useState('Productos');
  const [anchorEls, setAnchorEls] = React.useState<(null | HTMLElement)[]>(Array(mainMenus.length).fill(null));

  const handleMenuClick = (index: number, event: React.MouseEvent<HTMLElement>) => {
    setSelectedSection(mainMenus[index].label);
    // Opcional: abrir submenú si lo deseas
    // const newAnchors = [...anchorEls];
    // newAnchors[index] = event.currentTarget;
    // setAnchorEls(newAnchors);
  };

  const handleMenuClose = (index: number) => {
    const newAnchors = [...anchorEls];
    newAnchors[index] = null;
    setAnchorEls(newAnchors);
  };

  return (
    <>
      {/* Barra blanca superior para el logo */}
      <AppBar position="static" sx={{ background: '#fff', color: azul, boxShadow: 0, height: 90, justifyContent: 'center' }}>
        <Toolbar sx={{ minHeight: 90 }}>
          <Box sx={{ width: 260, display: 'flex', alignItems: 'center', mr: 2 }}>
            <img src={logo} alt="Logo Emphasys" style={{ height: 72, marginRight: 8 }} />
          </Box>
        </Toolbar>
      </AppBar>
      {/* Barra azul para el menú principal */}
      <AppBar position="static" sx={{ background: azul, color: '#fff', boxShadow: 1 }}>
        <Toolbar>
          {/* Espacio para que el menú no se traslape con el logo */}
          <Box sx={{ width: 260, mr: 2 }} />
          {/* Menú principal */}
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {mainMenus.map((menu, idx) => (
              <Box key={menu.label}>
                <Button
                  color="inherit"
                  onClick={e => handleMenuClick(idx, e)}
                  sx={{
                    mx: 1,
                    fontWeight: 500,
                    color: selectedSection === menu.label ? verde : '#fff',
                    borderBottom: selectedSection === menu.label ? `3px solid ${verde}` : 'none',
                    '&:hover': { background: verde, color: '#fff' },
                    textTransform: 'none',
                    fontSize: 16
                  }}
                >
                  {menu.label}
                </Button>
                {/* Submenú opcional, si quieres mantenerlo */}
                {/*
                <Menu
                  anchorEl={anchorEls[idx]}
                  open={Boolean(anchorEls[idx])}
                  onClose={() => handleMenuClose(idx)}
                  MenuListProps={{ onMouseLeave: () => handleMenuClose(idx) }}
                  PaperProps={{
                    sx: {
                      background: verde,
                      color: '#fff',
                      minWidth: 160
                    }
                  }}
                >
                  {menu.submenu.map(sub => (
                    <MenuItem
                      key={sub}
                      onClick={() => handleMenuClose(idx)}
                      sx={{
                        '&:hover': { background: azul, color: '#fff' },
                        color: '#fff',
                        fontSize: 15
                      }}
                    >
                      {sub}
                    </MenuItem>
                  ))}
                </Menu>
                */}
              </Box>
            ))}
          </Box>
          {/* Área de usuario a la derecha */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton color="inherit">
              <AccountCircle />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      {/* Sidebar lateral fijo siempre visible */}
      <Sidebar section={selectedSection} />
    </>
  );
}
