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
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import type { GridColDef } from '@mui/x-data-grid';
import { EmphasysDataGrid } from '../../components/grids/EmphasysDataGrid';
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import { CUENTAS_GRID_ROW_HEIGHT, cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx } from './cuentasGridEstilos';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { fetchBalanzaXmlPreview, descargarBalanzaXml } from '../../services/eContabilidadService';
import type { BalanzaComprobacionXmlResultado, CuentaBalanzaXml, TipoEnvioBalanza } from '../../types/balanzaXml';

const BRAND = '#1d2f68';

interface FilaProblema {
  tipo: string;
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
            <TableCell sx={{ fontWeight: 700 }}>Cuenta</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Descripción</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Motivo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filas.map((f, i) => (
            <TableRow key={`${f.tipo}-${i}`} hover>
              <TableCell sx={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.tipo}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.cuenta ?? '—'}</TableCell>
              <TableCell>{f.descripcion ?? '—'}</TableCell>
              <TableCell>{f.motivo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function formatearImporte(valor: number): string {
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CeldaImporte({ value }: { value: number }) {
  return <span style={{ color: value < 0 ? '#b91c1c' : 'inherit' }}>{formatearImporte(value)}</span>;
}

export default function BalanzaXmlView({
  onIrACatalogoSat,
  onIrAValidaciones,
  onIrASaldosIniciales,
}: {
  onIrACatalogoSat: () => void;
  onIrAValidaciones: () => void;
  onIrASaldosIniciales: () => void;
}) {
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [tipoEnvio, setTipoEnvio] = React.useState<TipoEnvioBalanza>('N');
  const [fechaModificacion, setFechaModificacion] = React.useState<string>('');
  const [resultado, setResultado] = React.useState<BalanzaComprobacionXmlResultado | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [descargando, setDescargando] = React.useState(false);
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

  const fechaRequeridaYFaltante = tipoEnvio === 'C' && !fechaModificacion;

  const handlePrevisualizar = React.useCallback(async () => {
    if (!ejercicio || fechaRequeridaYFaltante) return;
    setCargando(true);
    setError(null);
    try {
      const data = await fetchBalanzaXmlPreview(ejercicio, periodo, tipoEnvio, tipoEnvio === 'C' ? fechaModificacion : null);
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo previsualizar la balanza de comprobación');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [ejercicio, periodo, tipoEnvio, fechaModificacion, fechaRequeridaYFaltante]);

  const handleDescargar = async () => {
    if (!ejercicio || !resultado?.ok) return;
    setDescargando(true);
    setError(null);
    try {
      await descargarBalanzaXml(ejercicio, periodo, tipoEnvio, tipoEnvio === 'C' ? fechaModificacion : null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el XML de la balanza de comprobación');
    } finally {
      setDescargando(false);
    }
  };

  const columnas: GridColDef<CuentaBalanzaXml & { id: number }>[] = React.useMemo(
    () => [
      { field: 'num_cta', headerName: 'Cuenta', width: 150, headerAlign: 'center', headerClassName: 'finanzas-header' },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        flex: 1,
        minWidth: 180,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
      },
      {
        field: 'saldo_ini',
        headerName: 'Saldo inicial',
        width: 130,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <CeldaImporte value={value} />,
      },
      {
        field: 'debe',
        headerName: 'Debe',
        width: 120,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <CeldaImporte value={value} />,
      },
      {
        field: 'haber',
        headerName: 'Haber',
        width: 120,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <CeldaImporte value={value} />,
      },
      {
        field: 'saldo_fin',
        headerName: 'Saldo final',
        width: 130,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <CeldaImporte value={value} />,
      },
      {
        field: 'naturaleza_descripcion',
        headerName: 'Naturaleza',
        width: 110,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
    ],
    []
  );

  const filas = React.useMemo(
    () => (resultado?.cuentas ?? []).map((c) => ({ ...c, id: c.cuenta_id })),
    [resultado]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="balanza-xml-ejercicio-label">Ejercicio</InputLabel>
            <Select
              labelId="balanza-xml-ejercicio-label"
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

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="balanza-xml-tipo-envio-label">Tipo de envío</InputLabel>
            <Select
              labelId="balanza-xml-tipo-envio-label"
              label="Tipo de envío"
              value={tipoEnvio}
              onChange={(e) => setTipoEnvio(e.target.value as TipoEnvioBalanza)}
            >
              <MenuItem value="N">Normal</MenuItem>
              <MenuItem value="C">Complementaria</MenuItem>
            </Select>
          </FormControl>

          {tipoEnvio === 'C' && (
            <TextField
              size="small"
              type="date"
              label="Fecha de modificación"
              InputLabelProps={{ shrink: true }}
              value={fechaModificacion}
              onChange={(e) => setFechaModificacion(e.target.value)}
              error={fechaRequeridaYFaltante}
              helperText={fechaRequeridaYFaltante ? 'Requerida en Complementaria' : ' '}
              sx={{ minWidth: 170 }}
            />
          )}

          <Button
            variant="contained"
            startIcon={<PreviewIcon fontSize="small" />}
            onClick={handlePrevisualizar}
            disabled={!ejercicio || cargando || fechaRequeridaYFaltante}
            sx={{ textTransform: 'none', bgcolor: BRAND, '&:hover': { bgcolor: '#162551' } }}
          >
            {cargando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Previsualizar / Validar balanza'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={handleDescargar}
            disabled={!resultado?.ok || descargando}
            sx={{ textTransform: 'none', color: BRAND, borderColor: BRAND }}
          >
            {descargando ? 'Generando...' : 'Descargar XML'}
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
              <Typography sx={{ fontSize: 13 }}>
                <strong>RFC:</strong> {resultado.empresa.rfc || '—'}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                <strong>Ejercicio:</strong> {resultado.ejercicio}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                <strong>Periodo:</strong> {String(resultado.periodo).padStart(2, '0')}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                <strong>Tipo de envío:</strong> {resultado.tipo_envio === 'C' ? 'Complementaria' : 'Normal'}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                <strong>Cuentas:</strong> {resultado.resumen.cuentas}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                <strong>Debe:</strong> {formatearImporte(resultado.resumen.total_debe)}
              </Typography>
              <Typography sx={{ fontSize: 13 }}>
                <strong>Haber:</strong> {formatearImporte(resultado.resumen.total_haber)}
              </Typography>
              <Typography sx={{ fontSize: 13, color: resultado.resumen.diferencia !== 0 ? '#b91c1c' : 'inherit' }}>
                <strong>Diferencia:</strong> {formatearImporte(resultado.resumen.diferencia)}
              </Typography>
              <Typography sx={{ fontSize: 13, color: resultado.resumen.errores > 0 ? '#b91c1c' : 'inherit' }}>
                <strong>Errores:</strong> {resultado.resumen.errores}
              </Typography>
              <Typography sx={{ fontSize: 13, color: resultado.resumen.advertencias > 0 ? '#92400e' : 'inherit' }}>
                <strong>Advertencias:</strong> {resultado.resumen.advertencias}
              </Typography>
              {resultado.ok ? (
                <Chip label="Sin errores — listo para descargar" color="success" size="small" />
              ) : (
                <Chip label="Con errores — descarga bloqueada" color="error" size="small" />
              )}
            </Stack>
          </Paper>

          {resultado.errores.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: '#fecaca', bgcolor: '#fef2f2' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
                  Errores ({resultado.errores.length})
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={onIrASaldosIniciales} sx={{ textTransform: 'none', fontSize: 12 }}>
                    Ir a Saldos iniciales
                  </Button>
                  <Button size="small" onClick={onIrACatalogoSat} sx={{ textTransform: 'none', fontSize: 12 }}>
                    Ir a Catálogo de cuentas SAT
                  </Button>
                  <Button size="small" onClick={onIrAValidaciones} sx={{ textTransform: 'none', fontSize: 12 }}>
                    Ir a Validaciones
                  </Button>
                </Stack>
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
