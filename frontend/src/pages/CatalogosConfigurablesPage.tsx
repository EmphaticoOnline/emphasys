import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { fetchCatalogosConfigurables, type CatalogoConfigurableGrupo } from '../services/catalogosConfigurablesService';
import { ConfigNavRow, ConfigPageFrame, ConfigPageHeader } from '../components/configuracion/configVisual';
import { Section, formWellSx } from '../components/transporte/transporteVisual';

export default function CatalogosConfigurablesPage() {
  const [grupos, setGrupos] = useState<CatalogoConfigurableGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const tokens = useTheme().emphasys;

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
          <CircularProgress size={28} sx={{ color: tokens.content.foreground }} />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    if (!grupos.length) {
      return (
        <Box
          sx={{
            borderRadius: 3,
            border: `1px solid ${tokens.content.border}`,
            bgcolor: tokens.content.well,
            px: 2,
            py: 3,
          }}
        >
          <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: tokens.content.foreground }}>
            No hay catálogos configurables
          </Typography>
          <Typography sx={{ mt: 0.4, fontSize: 13, color: tokens.content.muted }}>
            Cuando existan catálogos por tipo de entidad, aparecerán aquí.
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={formWellSx}>
        {grupos.map((grupo) => (
          <Section key={grupo.entidad_tipo_id} title={grupo.entidad_nombre || 'Entidad'} inset>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: grupo.catalogos.length > 4 ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
                columnGap: 0.5,
              }}
            >
            {grupo.entidad_descripcion ? (
              <Typography sx={{ gridColumn: '1 / -1', px: 0.75, pb: 0.4, fontSize: 12, color: tokens.content.secondary }}>
                {grupo.entidad_descripcion}
              </Typography>
            ) : null}
            {grupo.catalogos.map((catalogo) => (
              <ConfigNavRow
                key={catalogo.id}
                title={catalogo.nombre || 'Catálogo'}
                description={catalogo.descripcion}
                onClick={() => navigate(`/configuracion/catalogos/${catalogo.id}`)}
              />
            ))}
            </Box>
          </Section>
        ))}
      </Box>
    );
  };

  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Catálogos configurables"
        description="Consulta los catálogos agrupados por tipo de entidad para su configuración."
      />
      {renderContenido()}
    </ConfigPageFrame>
  );
}
