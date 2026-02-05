import * as React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';

const sidebarOptions: Record<string, string[]> = {
  Productos: [
    'Catálogo de productos',
    'Inventario',
    'Precios y listas',
    'Familias y líneas',
    'Unidades de medida',
    'Ajustes de stock',
    'Importar productos',
  ],
  Clientes: [
    'Listado de clientes',
    'Segmentos de clientes',
    'Contactos',
    'Direcciones',
    'Créditos y límites',
    'Historial de compras',
    'Importar clientes',
  ],
  Proveedores: [
    'Listado de proveedores',
    'Cuentas por pagar',
    'Contactos de proveedor',
    'Condiciones de pago',
    'Productos suministrados',
    'Historial de compras',
    'Importar proveedores',
  ],
  Finanzas: [
    'Cuentas bancarias',
    'Movimientos bancarios',
    'Conciliaciones',
    'Reportes financieros',
    'Facturación',
    'Cobros y pagos',
    'Presupuestos',
  ],
};

interface SidebarProps {
  section: string;
}

export const SIDEBAR_WIDTH = 260;
export const HEADER_HEIGHT = 146; // 90 + 56, ambas barras

export default function Sidebar({ section }: SidebarProps) {
  const options = section && sidebarOptions[section] ? sidebarOptions[section] : [];
  return (
    <Box
      sx={{
        position: 'fixed',
        top: HEADER_HEIGHT,
        left: 0,
        width: SIDEBAR_WIDTH,
        height: `calc(100vh - ${HEADER_HEIGHT}px)`,
        bgcolor: '#f5f5f5',
        borderRight: '1px solid #e0e0e0',
        zIndex: 1200,
        pt: 2,
      }}
      className="sidebar"
    >
      <List>
        {options.map((text) => (
          <ListItem key={text} disablePadding>
            <ListItemButton>
              <ListItemText primary={text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
