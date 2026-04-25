import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  Chip,
  Snackbar,
} from '@mui/material';
import { PictureAsPdfRounded, SaveRounded } from '@mui/icons-material';
import DynamicFieldControl from '../../components/DynamicFieldControl';
import type { LayoutConfig, LayoutSerie } from '../../types/formatosImpresion';
import { fetchLayoutConfiguracion, guardarLayoutConfiguracion } from '../../services/formatosImpresionService';

const TIPOS_DOCUMENTO = [
  { value: 'factura', label: 'Factura' },
  { value: 'cotizacion', label: 'Cotización' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'remision', label: 'Remisión' },
];

type TipoCampoLayout = 'boolean' | 'text' | 'number' | 'color';

type CampoLayout = {
  key: keyof LayoutConfig;
  label: string;
  type: TipoCampoLayout;
  section: string;
};

const CAMPOS_LAYOUT: CampoLayout[] = [
  {
    key: 'mostrarLogo',
    label: 'Mostrar logo',
    type: 'boolean',
    section: 'Encabezado',
  },
  {
    key: 'mostrarHeader',
    label: 'Mostrar encabezado',
    type: 'boolean',
    section: 'Encabezado',
  },
  {
    key: 'titulo',
    label: 'Título',
    type: 'text',
    section: 'Encabezado',
  },
  {
    key: 'colorPrimario',
    label: 'Color primario',
    type: 'color',
    section: 'Colores',
  },
  {
    key: 'colorTablaHeader',
    label: 'Color encabezado tabla',
    type: 'color',
    section: 'Colores',
  },
  {
    key: 'mostrarPartidas',
    label: 'Mostrar partidas',
    type: 'boolean',
    section: 'Partidas',
  },
  {
    key: 'mostrarImagenPartida',
    label: 'Mostrar imagen de partida',
    type: 'boolean',
    section: 'Partidas',
  },
  {
    key: 'altoImagenPartida',
    label: 'Alto de imagen de partida',
    type: 'number',
    section: 'Partidas',
  },
  {
    key: 'maxAnchoImagenPartida',
    label: 'Ancho máximo de imagen de partida',
    type: 'number',
    section: 'Partidas',
  },
];

const agruparCamposLayoutPorSeccion = (campos: CampoLayout[]) =>
  campos.reduce<Record<string, CampoLayout[]>>((acc, campo) => {
    if (!acc[campo.section]) {
      acc[campo.section] = [];
    }
    acc[campo.section].push(campo);
    return acc;
  }, {});

const esCampoLayoutDeshabilitado = (campo: CampoLayout, config: LayoutConfig) => {
  if (campo.key === 'altoImagenPartida' || campo.key === 'maxAnchoImagenPartida') {
    return !config.mostrarImagenPartida;
  }

  return false;
};

const emptyLayout = (): LayoutConfig => ({
  mostrarHeader: true,
  mostrarCliente: true,
  mostrarPartidas: true,
  mostrarTotales: true,
  mostrarLogo: true,
  mostrarObservacionesPartida: false,
  colorPrimario: '#1d2f68',
  colorTablaHeader: '#1d2f68',
  titulo: '',
});

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const normalizeHexColor = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();

  if (trimmed.startsWith('rgba(') || trimmed.startsWith('rgb(')) {
    const matches = trimmed.match(/rgba?\(([^)]+)\)/);
    if (!matches?.[1]) return null;
    const parts = matches[1].split(',').map((part) => part.trim());
    if (parts.length < 3) return null;
    const r = clampColorChannel(Number(parts[0]));
    const g = clampColorChannel(Number(parts[1]));
    const b = clampColorChannel(Number(parts[2]));
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return `#${[r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-f]{3,8}$/.test(hex)) return null;
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((c) => `${c}${c}`)
      .join('')}`;
  }
  if (hex.length === 4) {
    const expanded = hex
      .split('')
      .map((c) => `${c}${c}`)
      .join('');
    return `#${expanded.slice(0, 6)}`;
  }
  if (hex.length === 6) return `#${hex}`;
  if (hex.length === 8) return `#${hex.slice(0, 6)}`;
  return null;
};

export default function FormatosImpresionPage() {
  const [tipoDocumento, setTipoDocumento] = React.useState<string>('factura');
  const [serie, setSerie] = React.useState<string>('');
  const [series, setSeries] = React.useState<LayoutSerie[]>([]);
  const [layout, setLayout] = React.useState<LayoutConfig>(emptyLayout());
  const [source, setSource] = React.useState<'serie' | 'empresa' | 'default'>('default');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const config = layout;
  const setConfig = setLayout;
  const camposLayoutPorSeccion = React.useMemo(() => agruparCamposLayoutPorSeccion(CAMPOS_LAYOUT), []);

  const scopeLabel = serie ? 'Serie' : 'General';

  const loadLayout = React.useCallback(
    async (options?: { includeSeries?: boolean; serieOverride?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const serieParam = (options?.serieOverride ?? serie) || null;
        const response = await fetchLayoutConfiguracion({
          tipo_documento: tipoDocumento,
          serie: serieParam,
          includeSeries: options?.includeSeries ?? false,
        });
        setLayout(response.layout ?? emptyLayout());
        setSource(response.source ?? 'default');
        if (response.series) {
          setSeries(response.series);
        }
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar la configuración');
      } finally {
        setLoading(false);
      }
    },
    [tipoDocumento, serie]
  );

  React.useEffect(() => {
    setSerie('');
    void loadLayout({ includeSeries: true, serieOverride: '' });
  }, [tipoDocumento]);

  React.useEffect(() => {
    if (serie) {
      void loadLayout({ serieOverride: serie });
    } else {
      void loadLayout({ serieOverride: '' });
    }
  }, [serie]);

  const handleGuardar = async () => {
    try {
      setSaving(true);
      const normalizadoPrimario = normalizeHexColor(layout.colorPrimario ?? '') ?? '#1d2f68';
      const normalizadoTabla = normalizeHexColor(layout.colorTablaHeader ?? '') ?? '#1d2f68';
      const payloadLayout: LayoutConfig = {
        ...layout,
        colorPrimario: normalizadoPrimario,
        colorTablaHeader: normalizadoTabla,
      };
      await guardarLayoutConfiguracion({
        tipo_documento: tipoDocumento,
        serie: serie || null,
        configuracion: payloadLayout,
      });
      setSnackbar({ open: true, message: 'Formato guardado correctamente', severity: 'success' });
      setLayout(payloadLayout);
      await loadLayout({ serieOverride: serie, includeSeries: true });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo guardar el formato', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Stack spacing={0.5} flex={1}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Formatos de impresión
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Configura los layouts de PDF por empresa o por serie sin afectar la operación actual.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<SaveRounded />}
          onClick={handleGuardar}
          disabled={saving || loading}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Tipo de documento</InputLabel>
              <Select
                label="Tipo de documento"
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
              >
                {TIPOS_DOCUMENTO.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Serie (opcional)</InputLabel>
              <Select
                label="Serie (opcional)"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
              >
                <MenuItem value="">General (sin serie)</MenuItem>
                {series.map((item) => (
                  <MenuItem key={item.id} value={item.serie}>
                    {item.serie}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<PictureAsPdfRounded fontSize="small" />}
                label={`Ámbito: ${scopeLabel}`}
                color={serie ? 'primary' : 'default'}
                variant={serie ? 'filled' : 'outlined'}
              />
              <Typography variant="caption" color="#6b7280">
                Fuente: {source === 'default' ? 'Default' : source === 'empresa' ? 'Empresa' : 'Serie'}
              </Typography>
            </Stack>
          </Stack>

          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={22} />
              <Typography color="text.secondary">Cargando configuración...</Typography>
            </Stack>
          ) : (
            <Stack sx={{ pt: 1 }}>
              {Object.entries(camposLayoutPorSeccion).map(([section, campos], index) => (
                <Box key={section} sx={{ mt: index === 0 ? 0 : 4 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ mb: 1.5 }}>
                    {section}
                  </Typography>
                  <Grid container columnSpacing={2} rowSpacing={2.5}>
                    {campos.map((campo) => (
                      <Grid key={campo.key} size={{ xs: 12, md: 6 }}>
                        <DynamicFieldControl
                          label={campo.label}
                          type={campo.type}
                          value={config[campo.key] ?? null}
                          disabled={esCampoLayoutDeshabilitado(campo, config)}
                          onChange={(nuevoValor) =>
                            setConfig((prev) => ({
                              ...prev,
                              [campo.key]: nuevoValor,
                            }))
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
