import * as React from 'react';
import { Autocomplete, Box, CircularProgress, MenuItem, TextField, Typography } from '@mui/material';
import type { Unidad } from '../../../services/unidadesService';
import SeccionCard from './SeccionCard';

export type ProductoServicioSatOption = { id: string; texto: string };

type Props = {
  claveProductoSat: string | null;
  productosSatOptions: ProductoServicioSatOption[];
  productosSatLoading: boolean;
  onClaveProductoSatChange: (value: string | null) => void;
  onAbrirSat: () => void;
  onBuscarSat: (texto: string) => void;
  unidades: Unidad[];
  loadingUnidades: boolean;
  unidadVentaId: number | null;
  unidadInventarioId: number | null;
  onUnidadVentaChange: (value: number | null) => void;
  onUnidadInventarioChange: (value: number | null) => void;
  factorConversion: number | null;
  onFactorConversionChange: (value: number | null) => void;
  erroresActivos: Set<string>;
  camposObligatorios: Set<string>;
  /** Solo lectura. Se muestra únicamente cuando el producto ya existe (viene de fetchProducto). */
  existenciaActual?: number | null | undefined;
};

export default function SeccionFiscalUnidades({
  claveProductoSat,
  productosSatOptions,
  productosSatLoading,
  onClaveProductoSatChange,
  onAbrirSat,
  onBuscarSat,
  unidades,
  loadingUnidades,
  unidadVentaId,
  unidadInventarioId,
  onUnidadVentaChange,
  onUnidadInventarioChange,
  factorConversion,
  onFactorConversionChange,
  erroresActivos,
  camposObligatorios,
  existenciaActual,
}: Props) {
  const unidadVenta = unidades.find((u) => u.id === unidadVentaId) ?? null;
  const unidadInventario = unidades.find((u) => u.id === unidadInventarioId) ?? null;

  return (
    <SeccionCard id="fiscal" titulo="Fiscal y unidades">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(12, 1fr)' }, gap: 1.5 }}>
          <Box sx={{ gridColumn: { sm: 'span 4' } }}>
            <Autocomplete
              size="small"
              options={productosSatOptions}
              loading={productosSatLoading}
              filterOptions={(options) => options}
              value={
                productosSatOptions.find((option) => option.id === claveProductoSat) ||
                (claveProductoSat ? { id: claveProductoSat, texto: '' } : null)
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionLabel={(option) => (option.texto ? `${option.id} - ${option.texto}` : option.id)}
              onOpen={onAbrirSat}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') onBuscarSat(value);
              }}
              onChange={(_, value) => onClaveProductoSatChange(value?.id || null)}
              renderInput={(params) => (
                <TextField
                  {...(params as any)}
                  label="Clave de producto SAT"
                  required={camposObligatorios.has('clave_producto_sat')}
                  error={erroresActivos.has('clave_producto_sat')}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productosSatLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ) as React.ReactNode,
                  }}
                />
              )}
              noOptionsText={productosSatLoading ? 'Cargando...' : 'Sin resultados'}
            />
          </Box>

          <Box sx={{ gridColumn: { sm: 'span 2' } }}>
            <TextField
              select
              size="small"
              label="Unidad de venta"
              value={unidadVentaId ?? ''}
              onChange={(e) => onUnidadVentaChange(e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              disabled={loadingUnidades}
              required={camposObligatorios.has('unidad_venta_id')}
              error={erroresActivos.has('unidad_venta_id')}
            >
              {unidades.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.clave}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ gridColumn: { sm: 'span 2' } }}>
            <TextField
              select
              size="small"
              label="Unidad de inventario"
              value={unidadInventarioId ?? ''}
              onChange={(e) => onUnidadInventarioChange(e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              disabled={loadingUnidades}
              required={camposObligatorios.has('unidad_inventario_id')}
              error={erroresActivos.has('unidad_inventario_id')}
            >
              {unidades.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.clave}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ gridColumn: { sm: 'span 4' } }}>
            <TextField
              type="number"
              size="small"
              label="Factor de conversión"
              value={factorConversion ?? ''}
              onChange={(e) => onFactorConversionChange(e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
              helperText={
                unidadInventario && unidadVenta
                  ? `1 ${unidadInventario.clave} (inventario) = ${factorConversion ?? '?'} ${unidadVenta.clave} (venta)`
                  : 'Equivalencia entre unidad de inventario y unidad de venta'
              }
            />
          </Box>
        </Box>

        {existenciaActual !== undefined && existenciaActual !== null && (
          <Typography variant="caption" color="#6b7280" sx={{ display: 'block', mt: 1.25 }}>
            Existencia actual: <strong>{existenciaActual}</strong> (solo lectura)
          </Typography>
        )}
    </SeccionCard>
  );
}
