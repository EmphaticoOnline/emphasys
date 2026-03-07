import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';

const opciones = [
  {
    titulo: 'Empresas',
    descripcion: 'Configura empresas y sus parámetros generales.',
  },
  {
    titulo: 'Usuarios',
    descripcion: 'Gestiona cuentas de acceso y credenciales.',
  },
  {
    titulo: 'Roles',
    descripcion: 'Define roles y permisos para los usuarios.',
  },
  {
    titulo: 'Catálogos configurables',
    descripcion: 'Administra catálogos basados en core.catalogos_tipos y core.catalogos.',
    path: '/configuracion/catalogos',
  },
  {
    titulo: 'Parámetros del sistema',
    descripcion: 'Ajusta preferencias y configuraciones globales.',
  },
];

export default function ConfiguracionPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Configuración del sistema
        </Typography>
        <Typography variant="body2" color="#4b5563">
          Administra los elementos clave del ERP. Selecciona una opción para continuar.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        {opciones.map((opcion) => (
          <Card
            key={opcion.titulo}
            elevation={0}
            sx={{ border: '1px solid #e5e7eb', borderRadius: 2, height: '100%' }}
          >
            <CardActionArea
              sx={{ height: '100%' }}
              onClick={opcion.path ? () => navigate(opcion.path!) : undefined}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                  {opcion.titulo}
                </Typography>
                <Typography variant="body2" color="#4b5563">
                  {opcion.descripcion}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
