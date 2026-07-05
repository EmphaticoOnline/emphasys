import * as React from 'react';
import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import {
  fetchCfdiSatAlmacenamiento,
  fetchCfdiSatResumen,
  type CfdiSatAlmacenamiento,
  type CfdiSatResumenModulo,
} from '../../services/cfdiSatService';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const exponente = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  const valor = bytes / 1024 ** exponente;
  return `${valor.toFixed(exponente === 0 ? 0 : 1)} ${unidades[exponente]}`;
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'error' | 'success';
}) {
  const color = tone === 'error' ? 'error.main' : tone === 'success' ? 'success.main' : 'text.primary';
  return (
    <Box
      sx={{
        border: '1px solid #dbe3f0',
        borderRadius: 2,
        p: 2,
        backgroundColor: '#fff',
        minWidth: 0,
      }}
    >
      <Typography variant="caption" color="#6b7280" component="div" noWrap>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={600} sx={{ color }}>
        {value.toLocaleString('es-MX')}
      </Typography>
    </Box>
  );
}

export default function ResumenSatCards() {
  const [resumen, setResumen] = React.useState<CfdiSatResumenModulo | null>(null);
  const [almacenamiento, setAlmacenamiento] = React.useState<CfdiSatAlmacenamiento | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchCfdiSatResumen(), fetchCfdiSatAlmacenamiento()])
      .then(([resumenData, almacenamientoData]) => {
        if (!cancelado) {
          setResumen(resumenData);
          setAlmacenamiento(almacenamientoData);
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen del módulo');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6" fontWeight={700} color="#1d2f68">
          Resumen del módulo
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={26} />
          </Stack>
        ) : resumen ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <StatTile label="Solicitudes totales" value={resumen.solicitudes.total} />
              <StatTile label="Solicitudes en proceso" value={resumen.solicitudes.en_proceso} />
              <StatTile label="Solicitudes terminadas" value={resumen.solicitudes.terminadas} tone="success" />
              <StatTile label="Solicitudes con error" value={resumen.solicitudes.con_error} tone="error" />
              <StatTile label="Paquetes con error" value={resumen.paquetes_con_error} tone="error" />
              <StatTile label="Comprobantes descargados" value={resumen.comprobantes.total} />
              <StatTile label="Comprobantes recibidos" value={resumen.comprobantes.recibidos} />
              <StatTile label="Importados a compras" value={resumen.comprobantes.importados} tone="success" />
              <StatTile label="Pendientes de importar" value={resumen.comprobantes.pendientes_importar} />
            </Box>

            {almacenamiento && (
              <Typography variant="caption" color="#6b7280">
                Storage de esta empresa: {almacenamiento.total_archivos} archivo
                {almacenamiento.total_archivos === 1 ? '' : 's'} ({formatBytes(almacenamiento.total_bytes)}) —{' '}
                {almacenamiento.zips.archivos} ZIP{!almacenamiento.zips.disponible ? ' (no se pudo medir)' : ''},{' '}
                {almacenamiento.xml.archivos} XML{!almacenamiento.xml.disponible ? ' (no se pudo medir)' : ''}
              </Typography>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
