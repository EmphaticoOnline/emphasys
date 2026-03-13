import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import {
  BusinessRounded,
  CategoryRounded,
  ReceiptLongRounded,
  GroupRounded,
  SchemaRounded,
  SettingsRounded,
  ShieldRounded,
  TuneRounded,
  PercentRounded,
} from '@mui/icons-material';

const opciones = [
  {
    titulo: 'Empresas',
    descripcion: 'Configura empresas y sus parámetros generales.',
    icono: BusinessRounded,
    path: '/configuracion/empresas',
  },
  {
    titulo: 'Usuarios',
    descripcion: 'Gestiona cuentas de acceso y credenciales.',
    icono: GroupRounded,
    path: '/configuracion/usuarios',
  },
  {
    titulo: 'Roles',
    descripcion: 'Define roles y permisos para los usuarios.',
    icono: ShieldRounded,
    path: '/configuracion/roles',
  },
  {
    titulo: 'Catálogos configurables',
    descripcion: 'Administra catálogos basados en core.catalogos_tipos y core.catalogos.',
    icono: CategoryRounded,
    path: '/configuracion/catalogos',
  },
  {
    titulo: 'Campos dinámicos',
    descripcion: 'Configura campos dinámicos y sus dependencias.',
    icono: TuneRounded,
    path: '/configuracion/campos',
  },
  {
    titulo: 'Documentos y flujo',
    descripcion: 'Activa tipos de documento y define las transiciones entre ellos.',
    icono: SchemaRounded,
    path: '/configuracion/documentos',
  },
  {
    titulo: 'Parámetros del sistema',
    descripcion: 'Ajusta preferencias y configuraciones globales.',
    icono: SettingsRounded,
    path: '/configuracion/parametros',
  },
  {
    titulo: 'Opciones de parámetros',
    descripcion: 'Gestiona opciones para parámetros tipo dropdown.',
    icono: SettingsRounded,
    path: '/configuracion/parametros-opciones',
  },
  {
    titulo: 'Conceptos',
    descripcion: 'Administra el catálogo de conceptos financieros.',
    icono: ReceiptLongRounded,
    path: '/configuracion/conceptos',
  },
  {
    titulo: 'Impuestos por default',
    descripcion: 'Define los impuestos predeterminados por empresa.',
    icono: PercentRounded,
    path: '/configuracion/empresa/impuestos-default',
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
        {opciones.map((opcion) => {
          const Icono = opcion.icono ?? SchemaRounded;

          return (
            <Card
              key={opcion.titulo}
              elevation={0}
              sx={{ border: '1px solid #e5e7eb', borderRadius: 2, height: '100%' }}
            >
              <CardActionArea
                sx={{ height: '100%' }}
                onClick={opcion.path ? () => navigate(opcion.path!) : undefined}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: '#eef2ff',
                        color: '#1d2f68',
                      }}
                    >
                      <Icono fontSize="small" />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                      {opcion.titulo}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="#4b5563">
                    {opcion.descripcion}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
