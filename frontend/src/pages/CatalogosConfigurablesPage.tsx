import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Card, CardActionArea, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { fetchCatalogosConfigurables, type CatalogoConfigurableGrupo } from '../services/catalogosConfigurablesService';

export default function CatalogosConfigurablesPage() {
  const [grupos, setGrupos] = useState<CatalogoConfigurableGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCatalogosConfigurables();
        setGrupos(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar catálogos configurables');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const renderContenido = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    if (!grupos.length) {
      return <Alert severity="info">No hay catálogos configurables disponibles.</Alert>;
    }

    return (
      <Stack spacing={3}>
        {grupos.map((grupo) => (
          <Box key={grupo.entidad_tipo_id} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} color="#1d2f68">
                {grupo.entidad_nombre || 'Entidad'}
              </Typography>
              {grupo.entidad_descripcion ? (
                <Typography variant="body2" color="#4b5563">
                  {grupo.entidad_descripcion}
                </Typography>
              ) : null}
            </Box>

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
              {grupo.catalogos.map((catalogo) => (
                <Card
                  key={catalogo.id}
                  elevation={0}
                  sx={{ border: '1px solid #e5e7eb', borderRadius: 2, height: '100%' }}
                >
                  <CardActionArea sx={{ height: '100%' }} onClick={() => navigate(`/configuracion/catalogos/${catalogo.id}`)}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                        {catalogo.nombre || 'Catálogo'}
                      </Typography>
                      {catalogo.descripcion ? (
                        <Typography variant="body2" color="#4b5563">
                          {catalogo.descripcion}
                        </Typography>
                      ) : null}
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Box>
        ))}
      </Stack>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Catálogos configurables
        </Typography>
        <Typography variant="body2" color="#4b5563">
          Consulta los catálogos agrupados por tipo de entidad para su configuración.
        </Typography>
      </Stack>

      {renderContenido()}
    </Box>
  );
}
