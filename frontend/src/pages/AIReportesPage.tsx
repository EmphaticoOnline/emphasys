import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { apiFetch } from '../api/apiClient';
import { useSession } from '../session/useSession';

type ResultadoFila = Record<string, unknown>;

interface AiReporteResponse {
  sql_generado: string;
  resultados: ResultadoFila[];
  resumen: string;
  metricas?: {
    total_general?: number;
    promedio?: number;
    cantidad_registros: number;
    top_cliente?: {
      nombre: string;
      total: number;
      porcentaje: number;
    };
  };
  hallazgos?: string[];
  recomendaciones?: string[];
}

const formatHeader = (key: string) => {
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

const stringifyValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return String(value);
    }
  }
  return String(value);
};

export default function AIReportesPage() {
  const { session } = useSession();
  const empresaId = session.empresaActivaId;

  const [pregunta, setPregunta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string>('');
  const [metricas, setMetricas] = useState<AiReporteResponse['metricas']>();
  const [hallazgos, setHallazgos] = useState<string[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [sql, setSql] = useState<string>('');
  const [resultados, setResultados] = useState<ResultadoFila[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const canSubmit = pregunta.trim().length > 0 && !loading && Boolean(empresaId);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!empresaId) {
      setError('Selecciona una empresa para generar el reporte.');
      setSnackbarOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/ai/reportes', {
        method: 'POST',
        body: JSON.stringify({
          pregunta: pregunta.trim(),
          empresa_id: empresaId,
        }),
      });

      const data = (await response.json()) as Partial<AiReporteResponse> & { message?: string };

      if (!response.ok) {
        const message = data?.message || 'No se pudo generar el reporte';
        throw new Error(message);
      }

      setSql(data.sql_generado || '');
      setResumen(data.resumen || '');
  setMetricas(data.metricas);
      setHallazgos(Array.isArray(data.hallazgos) ? data.hallazgos : []);
      setRecomendaciones(Array.isArray(data.recomendaciones) ? data.recomendaciones : []);
      setResultados(Array.isArray(data.resultados) ? data.resultados : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al generar el reporte';
      setError(message);
      setSql('');
      setResumen('');
  setMetricas(undefined);
      setHallazgos([]);
      setRecomendaciones([]);
      setResultados([]);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const columns: GridColDef[] = useMemo(() => {
    if (!resultados.length) return [];
    const firstRow = resultados[0];
    if (!firstRow) return [];
    const keys = Object.keys(firstRow);
    return keys.map((key) => ({
      field: key,
      headerName: formatHeader(key),
      flex: 1,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams) => stringifyValue(params.value),
    }));
  }, [resultados]);

  const rows = useMemo(() => {
    return resultados.map((row, idx) => ({
      id: (row as { id?: unknown }).id ?? (row as { documento_id?: unknown }).documento_id ?? `row-${idx}`,
      ...row,
    }));
  }, [resultados]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const handleCloseSnackbar = () => setSnackbarOpen(false);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack spacing={0.5}>
        <Typography variant="h4" fontWeight={700} color="text.primary">
          Pregúntale a tu negocio
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Asistente de reportes con IA
        </Typography>
      </Stack>

      <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Pregunta"
          multiline
          minRows={3}
          placeholder="Ej: Clientes que más compraron este mes"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={handleKeyDown}
          fullWidth
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Generar reporte
          </Button>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Paper>

      {(metricas?.total_general !== undefined || metricas?.cantidad_registros !== undefined || metricas?.promedio !== undefined || metricas?.top_cliente) && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Métricas clave
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {metricas?.total_general !== undefined && (
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">Total</Typography>
                <Typography variant="h6" fontWeight={700}>{metricas.total_general.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
              </Box>
            )}
            {metricas?.cantidad_registros !== undefined && (
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">Registros</Typography>
                <Typography variant="h6" fontWeight={700}>{metricas.cantidad_registros}</Typography>
              </Box>
            )}
            {metricas?.promedio !== undefined && metricas?.total_general !== undefined && metricas.cantidad_registros > 0 && (
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">Promedio</Typography>
                <Typography variant="h6" fontWeight={700}>{metricas.promedio.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
              </Box>
            )}
            {metricas?.top_cliente && (
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">Cliente principal</Typography>
                <Typography variant="h6" fontWeight={700}>{metricas.top_cliente.nombre}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {metricas.top_cliente.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({metricas.top_cliente.porcentaje.toFixed(1)}%)
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {resumen && (
        <Paper
          sx={{
            p: 2,
            borderLeft: '4px solid #1d2f68',
            backgroundColor: 'rgba(29,47,104,0.05)',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Resumen
          </Typography>
          <Typography variant="body1" color="text.primary">
            {resumen}
          </Typography>
        </Paper>
      )}

      {hallazgos.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Hallazgos
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0, display: 'grid', gap: 1 }}>
            {hallazgos.map((h, idx) => (
              <Typography key={idx} component="li" variant="body2">
                {h}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      {recomendaciones.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Recomendaciones
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0, display: 'grid', gap: 1 }}>
            {recomendaciones.map((rec, idx) => (
              <Typography key={idx} component="li" variant="body2">
                {rec}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      <Paper sx={{ p: 1.5 }}>
        {resultados.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Generando reporte…' : 'No hay resultados aún. Haz una pregunta para ver el reporte.'}
          </Typography>
        ) : (
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="compact"
              rows={rows}
              columns={columns}
              disableRowSelectionOnClick
              sx={{ border: 'none' }}
              getRowHeight={() => 'auto'}
            />
          </Box>
        )}
      </Paper>

      {sql && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Ver cómo se construyó el reporte</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{sql}</pre>
            </Paper>
          </AccordionDetails>
        </Accordion>
      )}

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={handleCloseSnackbar}>
        <Alert severity="error" onClose={handleCloseSnackbar} sx={{ width: '100%' }}>
          {error || 'Ocurrió un error'}
        </Alert>
      </Snackbar>
    </Box>
  );
}