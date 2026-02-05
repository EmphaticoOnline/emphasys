import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Grid, Tab, Tabs, Typography, Divider, Chip, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// Mock de datos de producto
const mockProducto = {
  nombre: 'Laptop Dell XPS 13',
  sku: 'XPS13-2024',
  categoria: 'Computadoras',
  estado: 'Activo',
  descripcion: 'Ultrabook premium de 13 pulgadas, Intel i7, 16GB RAM, 512GB SSD.',
  stock: 25,
  ubicacion: 'Almacén Central',
  precio: 1899.99,
  moneda: 'USD',
  movimientos: [
    { fecha: '2026-02-01', tipo: 'Entrada', cantidad: 10, referencia: 'Compra #1234' },
    { fecha: '2026-01-28', tipo: 'Salida', cantidad: 2, referencia: 'Venta #5678' },
    { fecha: '2026-01-20', tipo: 'Ajuste', cantidad: 1, referencia: 'Inventario anual' },
  ],
};

function TabPanel(props: { children?: React.ReactNode; value: number; index: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`producto-tabpanel-${index}`}
      aria-labelledby={`producto-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ProductosPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 0 }}>
      {/* Header del módulo */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          px: 2,
          pt: 1,
        }}
      >
        <Typography variant="h5" fontWeight={700}>
          Productos
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="primary" startIcon={<AddIcon />}>
            Nuevo
          </Button>
          <Button variant="outlined" color="primary" startIcon={<CloudUploadIcon />}>
            Importar
          </Button>
        </Stack>
      </Box>

      {/* Panel superior: Datos generales */}
      <Card sx={{ mb: 2, mx: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Typography variant="h6" fontWeight={600}>
                {mockProducto.nombre}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mockProducto.descripcion}
              </Typography>
              <Chip
                label={mockProducto.estado}
                color={mockProducto.estado === 'Activo' ? 'success' : 'default'}
                size="small"
                sx={{ mt: 1 }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="text.secondary">
                SKU
              </Typography>
              <Typography>{mockProducto.sku}</Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Categoría
              </Typography>
              <Typography>{mockProducto.categoria}</Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Stock
              </Typography>
              <Typography>{mockProducto.stock}</Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Precio
              </Typography>
              <Typography>
                {mockProducto.moneda} {mockProducto.precio.toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs de información */}
      <Box sx={{ mx: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label="Información" />
          <Tab label="Inventario" />
          <Tab label="Precios" />
          <Tab label="Movimientos" />
        </Tabs>
        <Divider />
        <TabPanel value={tab} index={0}>
          {/* Información */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Descripción
              </Typography>
              <Typography>{mockProducto.descripcion}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Estado
              </Typography>
              <Typography>{mockProducto.estado}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Ubicación
              </Typography>
              <Typography>{mockProducto.ubicacion}</Typography>
            </Grid>
          </Grid>
        </TabPanel>
        <TabPanel value={tab} index={1}>
          {/* Inventario */}
          <Typography variant="subtitle2" color="text.secondary">
            Stock actual:
          </Typography>
          <Typography variant="h6">{mockProducto.stock}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Ubicación: {mockProducto.ubicacion}
          </Typography>
        </TabPanel>
        <TabPanel value={tab} index={2}>
          {/* Precios */}
          <Typography variant="subtitle2" color="text.secondary">
            Precio de lista:
          </Typography>
          <Typography variant="h6">
            {mockProducto.moneda} {mockProducto.precio.toLocaleString()}
          </Typography>
        </TabPanel>
        <TabPanel value={tab} index={3}>
          {/* Movimientos */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Últimos movimientos:
          </Typography>
          {mockProducto.movimientos.map((mov, idx) => (
            <Box key={idx} sx={{ mb: 1, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={3}>
                  <Typography variant="body2">{mov.fecha}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2">{mov.tipo}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2">{mov.cantidad}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2">{mov.referencia}</Typography>
                </Grid>
              </Grid>
            </Box>
          ))}
        </TabPanel>
      </Box>
    </Box>
  );
}
