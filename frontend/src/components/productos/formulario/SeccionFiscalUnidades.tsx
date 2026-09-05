import * as React from 'react';
import { Autocomplete, Box, CircularProgress, FormControlLabel, MenuItem, Switch, TextField, Typography } from '@mui/material';
import type { Unidad } from '../../../services/unidadesService';
import SeccionCard from './SeccionCard';
import { apiFetch } from '../../../services/apiFetch';

export type ProductoServicioSatOption = { id: string; texto: string };
type CartaPorteOption = { clave: string; descripcion: string; id?: number; material_peligroso?: string | null; clase_division?: string | null; nombre_tecnico?: string | null };

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
  claveBienesTransportadosSat: string | null;
  esMaterialPeligroso: boolean;
  claveMaterialPeligrosoSat: string | null;
  claveEmbalajeSat: string | null;
  descripcionEmbalaje: string | null;
  onCartaPorteChange: (field: string, value: string | boolean | null) => void;
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
  claveBienesTransportadosSat, esMaterialPeligroso, claveMaterialPeligrosoSat, claveEmbalajeSat, descripcionEmbalaje, onCartaPorteChange,
}: Props) {
  const unidadVenta = unidades.find((u) => u.id === unidadVentaId) ?? null;
  const unidadInventario = unidades.find((u) => u.id === unidadInventarioId) ?? null;
  const [bienesOptions, setBienesOptions] = React.useState<CartaPorteOption[]>([]);
  const [materialesOptions, setMaterialesOptions] = React.useState<CartaPorteOption[]>([]);
  const [embalajesOptions, setEmbalajesOptions] = React.useState<CartaPorteOption[]>([]);
  const [satLoading, setSatLoading] = React.useState(false);
  const [bienesSearch, setBienesSearch] = React.useState(claveBienesTransportadosSat ?? '');
  const [materialSearch, setMaterialSearch] = React.useState(claveMaterialPeligrosoSat ?? '');
  const [embalajeSearch, setEmbalajeSearch] = React.useState(claveEmbalajeSat ?? '');
  const searchSat = React.useCallback(async (path: string, q: string, setter: (items: CartaPorteOption[]) => void) => {
    setSatLoading(true);
    try { const data = await apiFetch<{ items: CartaPorteOption[] }>(`/api/catalogos/sat/${path}?q=${encodeURIComponent(q)}&limit=50`); setter(data.items ?? []); }
    catch { setter([]); }
    finally { setSatLoading(false); }
  }, []);
  React.useEffect(() => { const t = setTimeout(() => void searchSat('bienes-transportados', bienesSearch, setBienesOptions), 250); return () => clearTimeout(t); }, [bienesSearch, searchSat]);
  React.useEffect(() => { if (!esMaterialPeligroso) return; const t = setTimeout(() => void searchSat('materiales-peligrosos', materialSearch, setMaterialesOptions), 250); return () => clearTimeout(t); }, [materialSearch, esMaterialPeligroso, searchSat]);
  React.useEffect(() => { if (!esMaterialPeligroso) return; const t = setTimeout(() => void searchSat('tipos-embalaje', embalajeSearch, setEmbalajesOptions), 250); return () => clearTimeout(t); }, [embalajeSearch, esMaterialPeligroso, searchSat]);
  const bienSeleccionado = bienesOptions.find((o) => o.clave === claveBienesTransportadosSat) ?? null;
  const materialSeleccionado = materialesOptions.find((o) => o.clave === claveMaterialPeligrosoSat) ?? null;
  const embalajeSeleccionado = embalajesOptions.find((o) => o.clave === claveEmbalajeSat) ?? null;
  const reglaPeligro = bienSeleccionado?.material_peligroso ?? null;
  const peligroForzado = reglaPeligro === '1' || reglaPeligro === '0';

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

          <Box sx={{ gridColumn: { sm: 'span 4' } }}>
            <Autocomplete options={bienesOptions} loading={satLoading} filterOptions={(o) => o} value={bienSeleccionado || (claveBienesTransportadosSat ? { clave: claveBienesTransportadosSat, descripcion: '' } : null)} isOptionEqualToValue={(o,v) => o.clave === v.clave} getOptionLabel={(o) => o.descripcion ? `${o.clave} — ${o.descripcion}` : o.clave} onInputChange={(_, v, reason) => { if (reason === 'input') setBienesSearch(v); }} onChange={(_, v) => { const regla = v?.material_peligroso ?? null; onCartaPorteChange('clave_bienes_transportados_sat', v?.clave ?? null); if (regla === '0') onCartaPorteChange('es_material_peligroso', false); if (regla === '1') onCartaPorteChange('es_material_peligroso', true); }} renderInput={(params) => <TextField {...params} size="small" fullWidth label="Bienes transportados SAT" helperText="Clave Carta Porte; distinta de ClaveProdServ" />} noOptionsText="Sin resultados" />
          </Box>
          <Box sx={{ gridColumn: { sm: 'span 4' } }}>
            <FormControlLabel control={<Switch checked={esMaterialPeligroso} disabled={peligroForzado} onChange={(e) => onCartaPorteChange('es_material_peligroso', e.target.checked)} />} label="Es material peligroso" />
          </Box>
          {esMaterialPeligroso && <>
            <Box sx={{ gridColumn: { sm: 'span 4' } }}><Autocomplete options={materialesOptions} loading={satLoading} filterOptions={(o) => o} value={materialSeleccionado || (claveMaterialPeligrosoSat ? { clave: claveMaterialPeligrosoSat, descripcion: '' } : null)} isOptionEqualToValue={(o,v) => o.id === v.id} getOptionLabel={(o) => o.descripcion ? `${o.clave} — ${o.descripcion}${o.clase_division ? ` — Clase ${o.clase_division}` : ''}` : o.clave} onInputChange={(_,v,reason) => { if (reason === 'input') setMaterialSearch(v); }} onChange={(_,v) => onCartaPorteChange('clave_material_peligroso_sat', v?.clave ?? null)} renderInput={(params) => <TextField {...params} size="small" fullWidth label="Clave material peligroso SAT" />} noOptionsText="Sin resultados" /></Box>
            <Box sx={{ gridColumn: { sm: 'span 4' } }}><Autocomplete options={embalajesOptions} loading={satLoading} filterOptions={(o) => o} value={embalajeSeleccionado || (claveEmbalajeSat ? { clave: claveEmbalajeSat, descripcion: '' } : null)} isOptionEqualToValue={(o,v) => o.clave === v.clave} getOptionLabel={(o) => o.descripcion ? `${o.clave} — ${o.descripcion}` : o.clave} onInputChange={(_,v,reason) => { if (reason === 'input') setEmbalajeSearch(v); }} onChange={(_,v) => onCartaPorteChange('clave_embalaje_sat', v?.clave ?? null)} renderInput={(params) => <TextField {...params} size="small" fullWidth label="Clave embalaje SAT" />} noOptionsText="Sin resultados" /></Box>
            <Box sx={{ gridColumn: { sm: 'span 4' } }}><TextField size="small" fullWidth label="Descripción embalaje" value={descripcionEmbalaje ?? ''} onChange={(e) => onCartaPorteChange('descripcion_embalaje', e.target.value || null)} /></Box>
          </>}

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
