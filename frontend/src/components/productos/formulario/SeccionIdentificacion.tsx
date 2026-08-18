import * as React from 'react';
import { Box, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import SeccionCard from './SeccionCard';

const TIPO_PRODUCTO_OPCIONES = ['Inventariable', 'No inventariable', 'Kit'] as const;

type Props = {
  clave: string;
  descripcion: string;
  clasificacion: string;
  tipoProducto: string;
  activo: boolean;
  onClaveChange: (value: string) => void;
  onDescripcionChange: (value: string) => void;
  onClasificacionChange: (value: string) => void;
  onTipoProductoChange: (value: string) => void;
  onActivoChange: (value: boolean) => void;
  erroresActivos: Set<string>;
  camposObligatorios: Set<string>;
  claveDuplicadaError: string | null;
  explicacionObligatoriedad: string;
};

export default function SeccionIdentificacion({
  clave,
  descripcion,
  clasificacion,
  tipoProducto,
  activo,
  onClaveChange,
  onDescripcionChange,
  onClasificacionChange,
  onTipoProductoChange,
  onActivoChange,
  erroresActivos,
  camposObligatorios,
  claveDuplicadaError,
  explicacionObligatoriedad,
}: Props) {
  return (
    <SeccionCard id="identificacion" titulo="Identificación">
      <Stack spacing={1.75}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(12, 1fr)' },
            gap: 1.5,
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ gridColumn: { sm: 'span 3' } }}>
            <TextField
              label="Tipo de producto"
              select
              size="small"
              value={tipoProducto || 'Inventariable'}
              onChange={(e) => onTipoProductoChange(e.target.value)}
              required
              fullWidth
            >
              {TIPO_PRODUCTO_OPCIONES.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ gridColumn: { sm: 'span 2' } }}>
            <TextField
              label="Clave"
              size="small"
              value={clave}
              onChange={(e) => onClaveChange(e.target.value)}
              required
              error={erroresActivos.has('clave') || Boolean(claveDuplicadaError)}
              helperText={claveDuplicadaError || undefined}
              fullWidth
              inputProps={{ style: { fontFamily: '"Roboto Mono", monospace' } }}
            />
          </Box>

          <Box sx={{ gridColumn: { sm: 'span 6' } }}>
            <TextField
              label="Descripción"
              size="small"
              value={descripcion}
              onChange={(e) => onDescripcionChange(e.target.value)}
              required
              error={erroresActivos.has('descripcion')}
              fullWidth
            />
          </Box>

          <Box sx={{ gridColumn: { sm: 'span 1' }, display: 'flex', justifyContent: 'center', pt: 0.5 }}>
            <FormControlLabel
              labelPlacement="top"
              sx={{ m: 0 }}
              control={<Switch size="small" checked={activo} onChange={(e) => onActivoChange(e.target.checked)} color="primary" />}
              label={<Typography variant="caption" color="#6b7280">Activo</Typography>}
            />
          </Box>
        </Box>

        <TextField
          label="Clasificación"
          size="small"
          value={clasificacion}
          onChange={(e) => onClasificacionChange(e.target.value)}
          required={camposObligatorios.has('clasificacion')}
          error={erroresActivos.has('clasificacion')}
          fullWidth
        />

        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ pt: 0.25 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#1d2f68',
              mt: 0.6,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="#6b7280" fontSize={12}>
            {explicacionObligatoriedad}
          </Typography>
        </Stack>
      </Stack>
    </SeccionCard>
  );
}
