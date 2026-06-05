import * as React from 'react';
import {
  Autocomplete,
  Badge,
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import type { Contacto } from '../../types/contactos.types';
import type {
  ContactoActivoFilter,
  ContactoOrigenOption,
  ContactosAdvancedFiltersState,
} from './ContactosView.types';

const compactFilterFieldSx = {
  '& .MuiInputLabel-root': { fontSize: 13 },
  '& .MuiInputBase-input': { fontSize: { xs: 16, md: 13 }, py: 1.15 },
  '& .MuiAutocomplete-input': { fontSize: { xs: 16, md: 13 } },
  '& .MuiSelect-select': { fontSize: { xs: 16, md: 13 } },
} as const;

type Props = {
  rowCount: number;
  vendedores: Contacto[];
  origenOptions: ContactoOrigenOption[];
  tiposOpciones: string[];
  filters: ContactosAdvancedFiltersState;
  activeFiltersCount: number;
  onToggleFilters: () => void;
  onSelectedTiposChange: (tipos: string[]) => void;
  onOrigenContactoIdChange: (value: number | null) => void;
  onVendedorIdChange: (value: number | null) => void;
  onActivoChange: (value: ContactoActivoFilter) => void;
  onFechaAltaDesdeChange: (value: string) => void;
  onFechaAltaHastaChange: (value: string) => void;
  onInteresInicialChange: (value: string) => void;
  onObservacionesChange: (value: string) => void;
  onClearAdvancedFilters: () => void;
};

export default function ContactosAdvancedFilters({
  rowCount,
  vendedores,
  origenOptions,
  tiposOpciones,
  filters,
  activeFiltersCount,
  onToggleFilters,
  onSelectedTiposChange,
  onOrigenContactoIdChange,
  onVendedorIdChange,
  onActivoChange,
  onFechaAltaDesdeChange,
  onFechaAltaHastaChange,
  onInteresInicialChange,
  onObservacionesChange,
  onClearAdvancedFilters,
}: Props) {
  const hayFiltrosActivos = activeFiltersCount > 0;
  const vendedorSeleccionado = vendedores.find((item) => item.id === filters.vendedorId) ?? null;
  const origenSeleccionado = origenOptions.find((item) => item.id === filters.origenContactoId) ?? null;

  return (
    <Stack spacing={1.25}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', lg: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="body2" color="#4b5563" sx={{ fontWeight: 600 }}>
            {rowCount.toLocaleString('es-MX')} registros encontrados
          </Typography>
        </Box>

        <Badge color="primary" badgeContent={hayFiltrosActivos ? activeFiltersCount : 0} invisible={!hayFiltrosActivos}>
          <Button
            variant={filters.filtersOpen || hayFiltrosActivos ? 'contained' : 'outlined'}
            startIcon={<FilterAltOutlinedIcon />}
            endIcon={filters.filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={onToggleFilters}
            sx={{
              alignSelf: { xs: 'flex-start', lg: 'center' },
              fontWeight: 700,
              textTransform: 'none',
              backgroundColor: filters.filtersOpen || hayFiltrosActivos ? '#1d2f68' : undefined,
              '&:hover': {
                backgroundColor: filters.filtersOpen || hayFiltrosActivos ? '#162551' : undefined,
              },
            }}
          >
            Filtros avanzados
          </Button>
        </Badge>
      </Stack>

      <Collapse in={filters.filtersOpen} timeout="auto" unmountOnExit={false}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            borderRadius: 2,
            borderColor: '#dbe3f4',
            backgroundColor: '#f8fafc',
          }}
        >
          <Stack spacing={1.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1f2937' }}>
                  Filtros y Resumen
                </Typography>
                <Typography variant="caption" color="#6b7280">
                  Refina la búsqueda por CRM sin filtrar localmente en el grid.
                </Typography>
              </Box>
              <Button variant="text" onClick={onClearAdvancedFilters} disabled={!hayFiltrosActivos} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Limpiar filtros
              </Button>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1.25,
              }}
            >
              <Autocomplete
                multiple
                size="small"
                options={tiposOpciones}
                value={filters.selectedTipos}
                onChange={(_, value) => onSelectedTiposChange(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tipo de contacto"
                    placeholder={filters.selectedTipos.length ? '' : 'Todos'}
                    InputLabelProps={{ ...(params.InputLabelProps as any), shrink: true }}
                    sx={compactFilterFieldSx}
                  />
                )}
                sx={compactFilterFieldSx}
              />

              <Autocomplete
                size="small"
                options={origenOptions}
                value={origenSeleccionado}
                onChange={(_, value) => onOrigenContactoIdChange(value?.id ?? null)}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Origen de contacto"
                    placeholder="Todos"
                    InputLabelProps={{ ...(params.InputLabelProps as any), shrink: true }}
                    sx={compactFilterFieldSx}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {filters.origenContactoId ? (
                            <IconButton size="small" onClick={() => onOrigenContactoIdChange(null)}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={compactFilterFieldSx}
              />

              <Autocomplete
                size="small"
                options={vendedores}
                value={vendedorSeleccionado}
                onChange={(_, value) => onVendedorIdChange(value?.id ?? null)}
                getOptionLabel={(option) => option?.nombre || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Vendedor"
                    placeholder="Todos"
                    InputLabelProps={{ ...(params.InputLabelProps as any), shrink: true }}
                    sx={compactFilterFieldSx}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {filters.vendedorId ? (
                            <IconButton size="small" onClick={() => onVendedorIdChange(null)}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={compactFilterFieldSx}
              />

              <TextField
                select
                size="small"
                label="Activo"
                value={filters.activo}
                onChange={(event) => onActivoChange(event.target.value as ContactoActivoFilter)}
                sx={compactFilterFieldSx}
              >
                <MenuItem value="todos">Todos</MenuItem>
                <MenuItem value="activos">Activos</MenuItem>
                <MenuItem value="inactivos">Inactivos</MenuItem>
              </TextField>

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Fecha de alta desde"
                  value={filters.fechaAltaDesde ? dayjs(filters.fechaAltaDesde) : null}
                  onChange={(value) => onFechaAltaDesdeChange(value ? value.format('YYYY-MM-DD') : '')}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: compactFilterFieldSx,
                      InputLabelProps: { shrink: true },
                      InputProps: filters.fechaAltaDesde
                        ? {
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton size="small" onClick={() => onFechaAltaDesdeChange('')}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }
                        : {},
                    },
                  }}
                />
              </LocalizationProvider>

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Fecha de alta hasta"
                  value={filters.fechaAltaHasta ? dayjs(filters.fechaAltaHasta) : null}
                  onChange={(value) => onFechaAltaHastaChange(value ? value.format('YYYY-MM-DD') : '')}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: compactFilterFieldSx,
                      InputLabelProps: { shrink: true },
                      InputProps: filters.fechaAltaHasta
                        ? {
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton size="small" onClick={() => onFechaAltaHastaChange('')}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }
                        : {},
                    },
                  }}
                />
              </LocalizationProvider>

              <TextField
                size="small"
                label="Texto en interés inicial"
                value={filters.interesInicial}
                onChange={(event) => onInteresInicialChange(event.target.value)}
                placeholder="Buscar solo en interés inicial"
                sx={compactFilterFieldSx}
              />

              <TextField
                size="small"
                label="Texto en observaciones"
                value={filters.observaciones}
                onChange={(event) => onObservacionesChange(event.target.value)}
                placeholder="Buscar solo en observaciones"
                sx={compactFilterFieldSx}
              />
            </Box>
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  );
}