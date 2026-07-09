import * as React from 'react';
import {
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { GridColDef } from '@mui/x-data-grid';
import { EmphasysDataGrid } from '../../components/grids/EmphasysDataGrid';
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import { CUENTAS_GRID_ROW_HEIGHT, cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx } from './cuentasGridEstilos';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { fetchPolizasSatPreview } from '../../services/eContabilidadService';
import type { EstadoMovimientoPolizaSat, MovimientoPolizaSat, PolizasSatResultado } from '../../types/polizasSat';

const BRAND = '#1d2f68';

interface FilaProblema {
  tipo: string;
  poliza?: string;
  cuenta?: string;
  descripcion?: string;
  motivo: string;
}

function TablaProblemas({ filas, color }: { filas: FilaProblema[]; color: string }) {
  return (
    <TableContainer>
      <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: 12, py: 0.5 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Póliza</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Cuenta</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Motivo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filas.map((f, i) => (
            <TableRow key={`${f.tipo}-${i}`} hover>
              <TableCell sx={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.tipo}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.poliza ?? '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.cuenta ?? '—'}</TableCell>
              <TableCell>{f.motivo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const ESTADO_CONFIG: Record<EstadoMovimientoPolizaSat, { label: string; color: string; bg: string }> = {
  correcto: { label: 'Correcto', color: '#166534', bg: '#f0fdf4' },
  uuid_no_encontrado: { label: 'UUID no encontrado', color: '#92400e', bg: '#fffbeb' },
  cfdi_cancelado: { label: 'CFDI cancelado', color: '#92400e', bg: '#fffbeb' },
  rfc_no_coincide: { label: 'RFC no coincide', color: '#92400e', bg: '#fffbeb' },
  uuid_sin_rfc: { label: 'UUID sin RFC', color: '#92400e', bg: '#fffbeb' },
  sin_uuid: { label: 'Sin UUID', color: '#92400e', bg: '#fffbeb' },
  error: { label: 'Error', color: '#b91c1c', bg: '#fef2f2' },
};

function CeldaEstado({ value }: { value: EstadoMovimientoPolizaSat }) {
  const config = ESTADO_CONFIG[value];
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{ bgcolor: config.bg, color: config.color, fontWeight: 600, fontSize: 11 }}
    />
  );
}

function formatearImporte(valor: number): string {
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ResumenValor({ etiqueta, valor, color }: { etiqueta: string; valor: number; color?: string | undefined }) {
  return (
    <Typography sx={{ fontSize: 13, color: color ?? 'inherit' }}>
      <strong>{etiqueta}:</strong> {valor}
    </Typography>
  );
}

export default function PolizasSatView({ onIrAValidaciones }: { onIrAValidaciones: () => void }) {
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [resultado, setResultado] = React.useState<PolizasSatResultado | null>(null);
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

  const handleRevisar = React.useCallback(async () => {
    if (!ejercicio) return;
    setCargando(true);
    setError(null);
    try {
      const data = await fetchPolizasSatPreview(ejercicio, periodo);
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron revisar las pólizas SAT del periodo');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [ejercicio, periodo]);

  const columnas: GridColDef<MovimientoPolizaSat & { id: string }>[] = React.useMemo(
    () => [
      {
        field: 'poliza',
        headerName: 'Póliza',
        width: 110,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        valueGetter: (_v, row) => `${row.tipo_poliza} ${row.numero}`,
      },
      { field: 'fecha', headerName: 'Fecha', width: 100, headerAlign: 'center', headerClassName: 'finanzas-header' },
      { field: 'renglon', headerName: 'Renglón', width: 80, align: 'center', headerAlign: 'center', headerClassName: 'finanzas-header' },
      { field: 'cuenta', headerName: 'Cuenta', width: 140, headerAlign: 'center', headerClassName: 'finanzas-header' },
      {
        field: 'concepto',
        headerName: 'Concepto',
        flex: 1,
        minWidth: 160,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
      {
        field: 'cargo',
        headerName: 'Cargo',
        width: 110,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => (value ? formatearImporte(value) : ''),
      },
      {
        field: 'abono',
        headerName: 'Abono',
        width: 110,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => (value ? formatearImporte(value) : ''),
      },
      {
        field: 'uuid_cfdi',
        headerName: 'UUID',
        width: 160,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => (
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{value ? String(value).slice(0, 8) + '…' : '—'}</span>
        ),
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        width: 110,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <span style={{ fontSize: 11 }}>{value ?? '—'}</span>,
      },
      {
        field: 'cfdi_encontrado',
        headerName: 'CFDI SAT',
        width: 90,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => (value ? 'Sí' : 'No'),
      },
      {
        field: 'estatus_sat',
        headerName: 'Estatus SAT',
        width: 100,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '—',
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 150,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <CeldaEstado value={value} />,
      },
      {
        field: 'motivo',
        headerName: 'Motivo',
        flex: 1,
        minWidth: 220,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
    ],
    []
  );

  const filas = React.useMemo(
    () => (resultado?.movimientos ?? []).map((m) => ({ ...m, id: `${m.poliza_id}-${m.renglon}` })),
    [resultado]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="polizas-sat-ejercicio-label">Ejercicio</InputLabel>
            <Select
              labelId="polizas-sat-ejercicio-label"
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
            startIcon={<SearchIcon fontSize="small" />}
            onClick={handleRevisar}
            disabled={!ejercicio || cargando}
            sx={{ textTransform: 'none', bgcolor: BRAND, '&:hover': { bgcolor: '#162551' } }}
          >
            {cargando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Revisar pólizas SAT'}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {resultado && (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={3} flexWrap="wrap" alignItems="center">
              <ResumenValor etiqueta="Pólizas" valor={resultado.resumen.polizas} />
              <ResumenValor etiqueta="Movimientos" valor={resultado.resumen.movimientos} />
              <ResumenValor etiqueta="Con UUID" valor={resultado.resumen.movimientos_con_uuid} />
              <ResumenValor etiqueta="UUID encontrados" valor={resultado.resumen.uuid_encontrados} />
              <ResumenValor
                etiqueta="UUID no encontrados"
                valor={resultado.resumen.uuid_no_encontrados}
                color={resultado.resumen.uuid_no_encontrados > 0 ? '#92400e' : undefined}
              />
              <ResumenValor
                etiqueta="CFDI cancelados"
                valor={resultado.resumen.cfdi_cancelados}
                color={resultado.resumen.cfdi_cancelados > 0 ? '#92400e' : undefined}
              />
              <ResumenValor
                etiqueta="RFC no coincide"
                valor={resultado.resumen.rfc_no_coincide}
                color={resultado.resumen.rfc_no_coincide > 0 ? '#92400e' : undefined}
              />
              <ResumenValor
                etiqueta="Errores"
                valor={resultado.resumen.errores}
                color={resultado.resumen.errores > 0 ? '#b91c1c' : undefined}
              />
              <ResumenValor
                etiqueta="Advertencias"
                valor={resultado.resumen.advertencias}
                color={resultado.resumen.advertencias > 0 ? '#92400e' : undefined}
              />
              {resultado.ok ? (
                <Chip label="Sin errores" color="success" size="small" />
              ) : (
                <Chip label="Con errores" color="error" size="small" />
              )}
            </Stack>
          </Paper>

          {resultado.errores.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: '#fecaca', bgcolor: '#fef2f2' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
                  Errores ({resultado.errores.length})
                </Typography>
                <Button size="small" onClick={onIrAValidaciones} sx={{ textTransform: 'none', fontSize: 12 }}>
                  Ir a Validaciones
                </Button>
              </Stack>
              <TablaProblemas filas={resultado.errores} color="#b91c1c" />
            </Paper>
          )}

          {resultado.advertencias.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: '#fde68a', bgcolor: '#fffbeb' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400e', mb: 1 }}>
                Advertencias ({resultado.advertencias.length})
              </Typography>
              <TablaProblemas filas={resultado.advertencias} color="#92400e" />
            </Paper>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <EmphasysDataGrid
              rows={filas}
              columns={columnas}
              rowHeight={CUENTAS_GRID_ROW_HEIGHT}
              density="compact"
              disableRowSelectionOnClick
              hideFooterPagination
              hideFooterSelectedRowCount
              autoHeight={filas.length === 0}
              sx={[
                cuentasGridDensidadSx,
                cuentasSinFocoDeCeldaSx,
                filas.length > 0 ? { height: 420 } : {},
              ]}
            />
          </Paper>
        </>
      )}
    </Box>
  );
}
