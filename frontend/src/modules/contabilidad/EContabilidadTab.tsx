import * as React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import CatalogoCuentasSatView from './CatalogoCuentasSatView';
import SaldosInicialesView from './SaldosInicialesView';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { fetchValidacionesEContabilidad } from '../../services/eContabilidadService';
import type {
  NivelValidacionEContabilidad,
  SeccionValidacionEContabilidad,
  ValidacionEContabilidadResultado,
} from '../../types/eContabilidad';

const BRAND = '#1d2f68';

const COLUMNA_ETIQUETAS: Record<string, string> = {
  cuenta: 'Cuenta',
  descripcion: 'Descripción',
  codigo_agrupador_sat: 'Código agrupador SAT',
  rango_descripcion: 'Rango asignado',
  naturaleza_saldo: 'Naturaleza',
  saldo_inicial: 'Saldo inicial',
  tipo: 'Tipo póliza',
  numero: 'Número',
  fecha: 'Fecha',
  renglon: 'Renglón',
  uuid_cfdi: 'UUID CFDI',
  rfc: 'RFC',
  cuentas_con_codigo_capturado: 'Cuentas con código capturado',
  motivo: 'Motivo',
};

const ORDEN_COLUMNAS = [
  'cuenta',
  'descripcion',
  'codigo_agrupador_sat',
  'rango_descripcion',
  'naturaleza_saldo',
  'saldo_inicial',
  'tipo',
  'numero',
  'fecha',
  'renglon',
  'uuid_cfdi',
  'rfc',
  'cuentas_con_codigo_capturado',
  'motivo',
];

function columnasDeItems(items: Record<string, unknown>[]): string[] {
  if (items.length === 0) return [];
  const claves = new Set<string>();
  items.forEach((item) => Object.keys(item).forEach((k) => claves.add(k)));
  claves.delete('cuenta_id');
  claves.delete('poliza_id');
  claves.delete('rango_cuenta_id');
  const ordenadas = ORDEN_COLUMNAS.filter((c) => claves.has(c));
  const restantes = [...claves].filter((c) => !ordenadas.includes(c));
  return [...ordenadas, ...restantes];
}

const NATURALEZA_SALDO_LABEL: Record<string, string> = { D: 'Deudora', A: 'Acreedora' };

function formatearValor(columna: string, valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (columna === 'naturaleza_saldo' && typeof valor === 'string') {
    return NATURALEZA_SALDO_LABEL[valor] ?? valor;
  }
  if (columna === 'saldo_inicial' && typeof valor === 'number') {
    return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(valor);
}

const NIVEL_CONFIG: Record<NivelValidacionEContabilidad, { color: 'error' | 'warning'; etiqueta: string }> = {
  error: { color: 'error', etiqueta: 'Error' },
  advertencia: { color: 'warning', etiqueta: 'Advertencia' },
};

function SeccionValidacionAccordion({ seccion }: { seccion: SeccionValidacionEContabilidad }) {
  const config = NIVEL_CONFIG[seccion.nivel];
  const columnas = columnasDeItems(seccion.items);

  return (
    <Accordion
      disableGutters
      sx={{
        border: '1px solid',
        borderColor: seccion.nivel === 'error' ? 'error.light' : 'warning.light',
        borderRadius: 1.5,
        mb: 1,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
          <Chip label={config.etiqueta} color={config.color} size="small" sx={{ fontWeight: 600 }} />
          <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
            {seccion.titulo}
          </Typography>
          <Chip label={seccion.total} size="small" variant="outlined" />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {columnas.map((col) => (
                  <TableCell key={col} sx={{ fontWeight: 600, fontSize: 12 }}>
                    {COLUMNA_ETIQUETAS[col] ?? col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {seccion.items.map((item, index) => (
                <TableRow key={index} hover>
                  {columnas.map((col) => (
                    <TableCell key={col} sx={{ fontSize: 12.5 }}>
                      {formatearValor(col, item[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
}

function ResumenTarjeta({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ px: 2.5, py: 1.5, minWidth: 140, borderRadius: 2, borderColor: 'divider' }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {etiqueta}
      </Typography>
      <Typography variant="h5" fontWeight={700} sx={{ color }}>
        {valor}
      </Typography>
    </Paper>
  );
}

const ACCIONES_FUTURAS = [
  'Generar catálogo XML',
  'Generar balanza XML',
  'Generar pólizas XML',
  'Auxiliares SAT',
];

type SubVistaEContabilidad = 'validaciones' | 'catalogo-sat' | 'saldos-iniciales';

export default function EContabilidadTab() {
  const [subVista, setSubVista] = React.useState<SubVistaEContabilidad>('validaciones');
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [resultado, setResultado] = React.useState<ValidacionEContabilidadResultado | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchEjerciciosDisponibles()
      .then((lista) => {
        setEjercicios(lista);
        setEjercicio((actual) => actual ?? lista[0] ?? new Date().getFullYear());
      })
      .catch(() => {
        setEjercicios([new Date().getFullYear()]);
        setEjercicio(new Date().getFullYear());
      });
  }, []);

  const handleValidar = React.useCallback(async () => {
    if (!ejercicio) return;
    setCargando(true);
    setError(null);
    try {
      const data = await fetchValidacionesEContabilidad(ejercicio, periodo);
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo validar el periodo');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [ejercicio, periodo]);

  const secciones = resultado?.secciones ?? [];
  const seccionesError = secciones.filter((s) => s.nivel === 'error');
  const seccionesAdvertencia = secciones.filter((s) => s.nivel === 'advertencia');
  const listoParaEContabilidad = resultado != null && resultado.resumen.errores === 0 && resultado.resumen.advertencias === 0;

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h6" fontWeight={700} sx={{ color: BRAND }}>
          Contabilidad electrónica
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Valida si el periodo está listo para generar catálogo de cuentas, balanza, pólizas y auxiliares en formato
          SAT. Esta fase solo diagnostica; no genera archivos XML.
        </Typography>
      </Box>

      <Tabs
        value={subVista}
        onChange={(_e, value) => setSubVista(value)}
        sx={{
          minHeight: 32,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 32, textTransform: 'none', fontWeight: 600, fontSize: 13, py: 0.5 },
          '& .Mui-selected': { color: BRAND },
          '& .MuiTabs-indicator': { backgroundColor: BRAND },
        }}
      >
        <Tab value="validaciones" label="Validaciones" />
        <Tab value="catalogo-sat" label="Catálogo de cuentas SAT" />
        <Tab value="saldos-iniciales" label="Saldos iniciales" />
      </Tabs>

      {subVista === 'catalogo-sat' && (
        <CatalogoCuentasSatView onIrAValidaciones={() => setSubVista('validaciones')} />
      )}

      {subVista === 'saldos-iniciales' && <SaldosInicialesView />}

      {subVista === 'validaciones' && (
        <>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="e-contabilidad-ejercicio-label">Ejercicio</InputLabel>
            <Select
              labelId="e-contabilidad-ejercicio-label"
              label="Ejercicio"
              value={ejercicio ?? ''}
              onChange={(e) => setEjercicio(Number(e.target.value))}
            >
              {ejercicios.map((anio) => (
                <MenuItem key={anio} value={anio}>
                  {anio}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Periodo
            </Typography>
            <SelectorMesesCompacto periodo={periodo} onChange={setPeriodo} />
          </Box>

          <Button
            variant="contained"
            onClick={handleValidar}
            disabled={!ejercicio || cargando}
            sx={{ bgcolor: BRAND, '&:hover': { bgcolor: '#16224d' } }}
          >
            {cargando ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Validar periodo'}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {resultado && (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <ResumenTarjeta etiqueta="Errores" valor={resultado.resumen.errores} color="#b91c1c" />
            <ResumenTarjeta etiqueta="Advertencias" valor={resultado.resumen.advertencias} color="#b45309" />
            <ResumenTarjeta etiqueta="Cuentas revisadas" valor={resultado.resumen.cuentas_revisadas} color={BRAND} />
            <ResumenTarjeta etiqueta="Pólizas revisadas" valor={resultado.resumen.polizas_revisadas} color={BRAND} />
          </Box>

          {listoParaEContabilidad ? (
            <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success">
              El periodo está listo para generación de e-contabilidad.
            </Alert>
          ) : (
            <Box>
              {seccionesError.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#b91c1c' }}>
                    Errores ({seccionesError.reduce((acc, s) => acc + s.total, 0)})
                  </Typography>
                  {seccionesError.map((s) => (
                    <SeccionValidacionAccordion key={s.clave} seccion={s} />
                  ))}
                </>
              )}
              {seccionesAdvertencia.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2, mb: 1, color: '#b45309' }}>
                    Advertencias ({seccionesAdvertencia.reduce((acc, s) => acc + s.total, 0)})
                  </Typography>
                  {seccionesAdvertencia.map((s) => (
                    <SeccionValidacionAccordion key={s.clave} seccion={s} />
                  ))}
                </>
              )}
            </Box>
          )}
        </>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
          Acciones de generación
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {ACCIONES_FUTURAS.map((accion) => (
            <Tooltip key={accion} title="Disponible en una fase posterior.">
              <span>
                <Button variant="outlined" disabled>
                  {accion}
                </Button>
              </span>
            </Tooltip>
          ))}
        </Box>
      </Paper>
        </>
      )}
    </Box>
  );
}
