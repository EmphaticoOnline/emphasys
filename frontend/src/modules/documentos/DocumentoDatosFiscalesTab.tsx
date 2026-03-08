import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../services/apiFetch';

export type DatosFiscalesValues = {
  rfc_receptor: string;
  nombre_receptor: string;
  regimen_fiscal_receptor: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
  codigo_postal_receptor: string;
};

type CatalogItem = { clave: string; nombre: string };
type FormaCatalogItem = { id: string; texto: string };

type Props = {
  values: DatosFiscalesValues;
  onChange: (changes: Partial<DatosFiscalesValues>) => void;
  disabled?: boolean;
};

const validarRFC = (rfc: string) => /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i.test(rfc);

const endpoints = {
  regimen: '/api/catalogos/sat/regimenes-fiscales',
  uso: '/api/catalogos/sat/usos-cfdi',
  forma: '/api/catalogos/sat/formas-pago',
  metodo: '/api/catalogos/sat/metodos-pago',
};

export function DocumentoDatosFiscalesTab({ values, onChange, disabled }: Props) {
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isDisabled = Boolean(disabled);

  const [rfcError, setRfcError] = useState<string | null>(null);

  const [regimenOptions, setRegimenOptions] = useState<CatalogItem[]>([]);
  const [usoOptions, setUsoOptions] = useState<CatalogItem[]>([]);
  const [formaOptions, setFormaOptions] = useState<FormaCatalogItem[]>([]);
  const [metodoOptions, setMetodoOptions] = useState<CatalogItem[]>([]);

  const [regimenLoading, setRegimenLoading] = useState(false);
  const [usoLoading, setUsoLoading] = useState(false);
  const [formaLoading, setFormaLoading] = useState(false);
  const [metodoLoading, setMetodoLoading] = useState(false);

  const loadCatalog = (
    endpoint: string,
    search: string,
    setter: React.Dispatch<React.SetStateAction<CatalogItem[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    debounceKey: string
  ) => {
    if (debounceRefs.current[debounceKey]) {
      clearTimeout(debounceRefs.current[debounceKey] as number);
    }
    debounceRefs.current[debounceKey] = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL(endpoint, window.location.origin);
        if (search) url.searchParams.set('q', search);
        url.searchParams.set('limit', '20');
        const data = await apiFetch<{ items: CatalogItem[] }>(url.pathname + url.search);
        setter(data.items || []);
      } catch (err) {
        console.error('Error cargando catálogo', endpoint, err);
        setter([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };
  
  const normalizeFormasPago = (data: any): FormaCatalogItem[] => {
    const list = (data?.items as any[]) ?? data?.formas_pago ?? data?.formasPago ?? data?.formaPago ?? [];
    return (list || [])
      .map((o) => ({ id: o?.id ?? o?.clave ?? '', texto: o?.texto ?? o?.nombre ?? o?.descripcion ?? '' }))
      .filter((o) => o.id && o.texto);
  };

  const loadCatalogForma = (search: string) => {
    if (debounceRefs.current['forma']) {
      clearTimeout(debounceRefs.current['forma'] as number);
    }
    debounceRefs.current['forma'] = setTimeout(async () => {
      setFormaLoading(true);
      try {
        const url = new URL(endpoints.forma, window.location.origin);
        if (search) url.searchParams.set('q', search);
        url.searchParams.set('limit', '200');
        const data = await apiFetch(url.pathname + url.search);
        setFormaOptions(normalizeFormasPago(data));
      } catch (err) {
        console.error('Error cargando catálogo', endpoints.forma, err);
        setFormaOptions([]);
      } finally {
        setFormaLoading(false);
      }
    }, 250);
  };

  const handleRfcChange = (value: string) => {
    const upper = value.toUpperCase();
    onChange({ rfc_receptor: upper });
    if (upper.length >= 12) {
      setRfcError(validarRFC(upper) ? null : 'RFC inválido');
    } else {
      setRfcError(null);
    }
  };

  const buildAutocomplete = (
    label: string,
    value: string,
    options: CatalogItem[],
    loading: boolean,
    onSearch: (value: string) => void,
    onSelect: (value: string) => void
  ) => (
    <Autocomplete
      options={options}
      loading={loading}
      value={options.find((o) => o.clave === value) || (value ? { clave: value, nombre: value } : null)}
      getOptionLabel={(option) => option?.nombre || option?.clave || ''}
      isOptionEqualToValue={(option, val) => option?.clave === val?.clave}
      onInputChange={(_, newValue) => onSearch(newValue)}
      onChange={(_, newValue) => onSelect(newValue?.clave || '')}
      renderInput={(params) => (
        <TextField
          {...(params as any)}
          label={label}
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={18} />} {params.InputProps.endAdornment}
              </>
            ) as React.ReactNode,
          }}
          placeholder="Buscar"
          disabled={isDisabled}
        />
      )}
      noOptionsText="Sin resultados"
      onOpen={() => {
        if (!options.length) onSearch('');
      }}
      disabled={isDisabled}
    />
  );

  useEffect(() => {
    loadCatalog(endpoints.regimen, '', setRegimenOptions, setRegimenLoading, 'regimen');
    loadCatalog(endpoints.uso, '', setUsoOptions, setUsoLoading, 'uso');
  loadCatalogForma('');
    loadCatalog(endpoints.metodo, '', setMetodoOptions, setMetodoLoading, 'metodo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        <TextField
          label="RFC receptor"
          value={values.rfc_receptor}
          onChange={(e) => handleRfcChange(e.target.value)}
          error={Boolean(rfcError)}
          helperText={rfcError || ''}
          fullWidth
          disabled={isDisabled}
        />
        <TextField
          label="Nombre receptor"
          value={values.nombre_receptor}
          onChange={(e) => onChange({ nombre_receptor: e.target.value })}
          fullWidth
          disabled={isDisabled}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        {buildAutocomplete(
          'Régimen fiscal',
          values.regimen_fiscal_receptor,
          regimenOptions,
          regimenLoading,
          (search) => loadCatalog(endpoints.regimen, search, setRegimenOptions, setRegimenLoading, 'regimen'),
          (clave) => onChange({ regimen_fiscal_receptor: clave })
        )}
        {buildAutocomplete(
          'Uso CFDI',
          values.uso_cfdi,
          usoOptions,
          usoLoading,
          (search) => loadCatalog(endpoints.uso, search, setUsoOptions, setUsoLoading, 'uso'),
          (clave) => onChange({ uso_cfdi: clave })
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        <Autocomplete
          options={formaOptions}
          loading={formaLoading}
          value={
            formaOptions.find((o) => o.id === values.forma_pago) ||
            (values.forma_pago ? { id: values.forma_pago, texto: values.forma_pago } : null)
          }
          getOptionLabel={(option) => option?.texto || ''}
          isOptionEqualToValue={(option, val) => option?.id === val?.id}
          filterOptions={(options) => options}
          onInputChange={(_, newValue) => loadCatalogForma(newValue || '')}
          onChange={(_, newValue) => onChange({ forma_pago: newValue?.id || '' })}
          renderInput={(params) => (
            <TextField
              {...(params as any)}
              label="Forma de pago"
              fullWidth
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {formaLoading && <CircularProgress size={18} />} {params.InputProps.endAdornment}
                  </>
                ) as React.ReactNode,
              }}
              placeholder="Buscar"
              disabled={isDisabled}
            />
          )}
          noOptionsText="Sin resultados"
          onOpen={() => {
            loadCatalogForma('');
          }}
          disabled={isDisabled}
        />
        {buildAutocomplete(
          'Método de pago',
          values.metodo_pago,
          metodoOptions,
          metodoLoading,
          (search) => loadCatalog(endpoints.metodo, search, setMetodoOptions, setMetodoLoading, 'metodo'),
          (clave) => onChange({ metodo_pago: clave })
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr' },
          gap: 2,
        }}
      >
        <TextField
          label="Código postal receptor"
          value={values.codigo_postal_receptor}
          onChange={(e) => onChange({ codigo_postal_receptor: e.target.value })}
          fullWidth
          disabled={isDisabled}
        />
      </Box>

      <Typography variant="body2" color="text.secondary">
        Catálogos cargados desde SAT (SAT: régimen, uso CFDI, forma y método de pago). Valores = clave, etiquetas = texto.
      </Typography>
    </Stack>
  );
}
