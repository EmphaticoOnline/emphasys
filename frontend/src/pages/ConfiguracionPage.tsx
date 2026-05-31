import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import {
  BusinessRounded,
  CategoryRounded,
  CloudRounded,
  ReceiptLongRounded,
  GroupRounded,
  SchemaRounded,
  SettingsRounded,
  ShieldRounded,
  TuneRounded,
  PercentRounded,
  PictureAsPdfRounded,
  LabelRounded,
  AlternateEmailRounded,
  ViewListRounded,
  GridViewRounded,
  TagRounded,
} from '@mui/icons-material';
import { CONFIGURACION_OPTIONS } from './configuracion/configuracionNavigation';

const ICONOS_POR_TITULO: Record<string, React.ComponentType<any>> = {
  Empresas: BusinessRounded,
  Usuarios: GroupRounded,
  Roles: ShieldRounded,
  'Catálogos configurables': CategoryRounded,
  'Campos dinámicos': TuneRounded,
  'Listas de precios': ViewListRounded,
  'Administración de precios': GridViewRounded,
  'Documentos y flujo': SchemaRounded,
  'Parámetros del sistema': SettingsRounded,
  'Opciones de parámetros': SettingsRounded,
  Conceptos: ReceiptLongRounded,
  'Impuestos por default': PercentRounded,
  'Formatos de impresión': PictureAsPdfRounded,
  'Series de documentos': TagRounded,
  'Correo SMTP': AlternateEmailRounded,
  'PAC CFDI': CloudRounded,
  'Etiquetas de WhatsApp': LabelRounded,
  'Etapas de producción': SchemaRounded,
};

export default function ConfiguracionPage() {
  const navigate = useNavigate();
  const isSuperadmin = Boolean((window.localStorage.getItem('emphasys.session') && JSON.parse(window.localStorage.getItem('emphasys.session') || '{}')?.user?.es_superadmin));

  const opcionesVisibles = CONFIGURACION_OPTIONS.filter((opcion) => !opcion.soloSuperadmin || isSuperadmin);

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
        {opcionesVisibles.map((opcion) => {
          const Icono = ICONOS_POR_TITULO[opcion.titulo] ?? SchemaRounded;

          return (
            <Card
              key={opcion.titulo}
              elevation={0}
              sx={{ border: '1px solid #e5e7eb', borderRadius: 2, height: '100%' }}
            >
              <CardActionArea sx={{ height: '100%' }} onClick={opcion.path ? () => navigate(opcion.path) : undefined}>
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
