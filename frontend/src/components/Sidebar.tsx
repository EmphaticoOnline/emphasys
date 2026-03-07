import * as React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import { SIDEBAR_WIDTH } from './layoutConstants.js';

const sidebarOptions: Record<string, string[]> = {
  'Catálogos': [
    'Contactos',
    'Productos',
    'Importar catálogos',
    'Listas maestras',
  ],
  Ventas: [
    'Cotizaciones',
    'Pedidos',
    'Órdenes de entrega',
    'Facturación',
    'Reportes de ventas',
  ],
  Compras: [
    'Órdenes de compra',
    'Solicitudes',
    'Proveedores',
    'Recepciones',
    'Reportes de compras',
  ],
  Finanzas: [
    'Cuentas bancarias',
    'Movimientos bancarios',
    'Conciliaciones',
    'Cobros y pagos',
    'Presupuestos',
  ],
  Inventarios: [
    'Inventario',
    'Ajustes de stock',
    'Kardex',
    'Ubicaciones',
    'Reportes de inventario',
  ],
};

interface SidebarProps { section: string; }


export default function Sidebar({ section }: SidebarProps) {
  const options = section && sidebarOptions[section] ? sidebarOptions[section] : [];
  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        minHeight: '100%',
        flexShrink: 0,
        bgcolor: '#f4f6f8',
        borderRight: '1px solid #e5e7eb',
        pt: 3,
        pb: 3,
      }}
      className="sidebar"
    >
      <List sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {options.map((text, idx) => {
          const isActive = idx === 0; // placeholder active item for styling
          return (
            <ListItem key={text} disablePadding sx={{ px: 1.5 }}>
              <ListItemButton
                selected={isActive}
                sx={{
                  borderLeft: isActive ? `3px solid #006261` : '3px solid transparent',
                  borderRadius: 1,
                  color: isActive ? '#1d2f68' : '#111827',
                  '&:hover': {
                    backgroundColor: '#e8eef3',
                    color: '#1d2f68',
                    borderLeft: `3px solid #006261`,
                  },
                  py: 1.25,
                  pl: 1.5,
                  pr: 1,
                  alignItems: 'center',
                }}
              >
                <ListItemText
                  primary={text}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
