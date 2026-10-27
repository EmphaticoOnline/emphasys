// Piezas comunes del panel derecho de los workspaces de documentos (mismo
// aspecto que Facturas): fila de cifras con barra de avance y pestañas.
// Cada tipo de documento declara sus cifras y sus pestañas; el esqueleto
// pone el estilo y el comportamiento.
import * as React from 'react';
import { Box, Tab, Tabs, Typography, useTheme } from '@mui/material';
import { DocumentoHojaViewport } from '../DocumentoHojaFrame';

export type TonoMetrica = 'amount' | 'applied' | 'available' | 'exhausted' | 'blocked';

export type MetricaWorkspace = {
  label: string;
  value: string;
  tono: TonoMetrica;
};

/** Cifras del encabezado; `progreso` (0–100) dibuja la barra de avance debajo. */
export function DocumentoWorkspaceMetricas({
  metricas,
  progreso,
  compacto = false,
}: {
  metricas: MetricaWorkspace[];
  progreso?: number | null;
  compacto?: boolean;
}) {
  const tokens = useTheme().emphasys;
  const columnas = compacto ? '1fr' : `repeat(${metricas.length}, minmax(0, 1fr))`;
  const pct = progreso == null ? null : Math.min(100, Math.max(0, progreso));

  return (
    <Box sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1.6, flexShrink: 0 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: columnas, gap: 0.8 }}>
        {metricas.map((metrica) => (
          <Box key={metrica.label} sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.metric[metrica.tono].background, color: tokens.content.foreground }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption, textTransform: 'uppercase' }}>
              {metrica.label}
            </Typography>
            <Typography variant="figure" sx={{ fontSize: 22, lineHeight: 1.15, color: 'inherit' }}>{metrica.value}</Typography>
          </Box>
        ))}
      </Box>
      {pct != null ? (
        <Box sx={{ mt: 1.1, height: 4, borderRadius: 99, bgcolor: tokens.metric.track, overflow: 'hidden' }}>
          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: pct >= 100 ? tokens.metric.progressDone : tokens.metric.progress }} />
        </Box>
      ) : null}
    </Box>
  );
}

export type PestanaWorkspace = {
  id: string;
  label: string;
  render: () => React.ReactNode;
};

/**
 * Pestañas del documento seleccionado. Vuelve a la primera cuando cambia
 * `documentoKey` (otro documento) o si la pestaña activa deja de existir.
 */
export function DocumentoWorkspacePestanas({ pestanas, documentoKey }: { pestanas: PestanaWorkspace[]; documentoKey: React.Key | null }) {
  const tokens = useTheme().emphasys;
  const [activa, setActiva] = React.useState<string>(pestanas[0]?.id ?? '');

  React.useEffect(() => {
    setActiva(pestanas[0]?.id ?? '');
    // Sólo al cambiar de documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentoKey]);

  const actual = pestanas.find((pestana) => pestana.id === activa) ?? pestanas[0] ?? null;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        mx: { xs: 1, md: 1.75 },
        mb: { xs: 1, md: 1.75 },
        bgcolor: tokens.content.well,
        borderRadius: 3,
        border: `1px solid ${tokens.content.border}`,
        overflow: 'hidden',
      }}
    >
      <Tabs
        value={actual?.id ?? false}
        onChange={(_event, value: string) => setActiva(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 1.5,
          minHeight: 46,
          borderBottom: `1px solid ${tokens.content.border}`,
          '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 650, fontSize: 14, color: tokens.content.muted },
          '& .Mui-selected': { color: tokens.content.foreground },
          '& .MuiTabs-indicator': { height: 2, borderRadius: 2, backgroundColor: tokens.content.foreground },
        }}
      >
        {pestanas.map((pestana) => <Tab key={pestana.id} value={pestana.id} label={pestana.label} />)}
      </Tabs>
      <DocumentoHojaViewport>{actual?.render()}</DocumentoHojaViewport>
    </Box>
  );
}
