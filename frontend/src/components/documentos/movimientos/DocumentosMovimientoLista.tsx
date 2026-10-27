import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import DocumentoMovimientoCard from './DocumentoMovimientoCard';
import type { MovimientoContactoConfig } from './movimientosContacto.config';
import type { MovimientosTipoEstado } from './useMovimientosContacto';

type DocumentosMovimientoListaProps = {
  config: MovimientoContactoConfig;
  estado: MovimientosTipoEstado | undefined;
  onCargarMas: () => void;
};

export default function DocumentosMovimientoLista({ config, estado, onCargarMas }: DocumentosMovimientoListaProps) {
  const rows = estado?.rows ?? [];
  const total = estado?.total ?? 0;

  if (!estado || (estado.loading && rows.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.muted })}>
          {config.vacio}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography sx={(theme) => ({ fontSize: 12, color: theme.emphasys.content.muted, px: 0.25 })}>
        {rows.length} de {total} {config.etiqueta.toLocaleLowerCase()}
      </Typography>
      {rows.map((row) => (
        <DocumentoMovimientoCard key={row.id} row={row} config={config} />
      ))}
      {rows.length < total ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
          <Button size="small" onClick={onCargarMas} disabled={estado.loading} startIcon={estado.loading ? <CircularProgress size={14} /> : null}>
            Ver más
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
