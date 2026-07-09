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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import type { GridColDef } from '@mui/x-data-grid';
import { EmphasysDataGrid } from '../../components/grids/EmphasysDataGrid';
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import { CUENTAS_GRID_ROW_HEIGHT, cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx } from './cuentasGridEstilos';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import {
  fetchAuxiliarFoliosPreview,
  descargarAuxiliarFolios,
  fetchAuxiliarCuentasPreview,
  descargarAuxiliarCuentas,
} from '../../services/eContabilidadService';
import type {
  AuxiliarCuentasResultado,
  AuxiliarFoliosResultado,
  EstadoFolioXml,
  TipoSolicitudPolizas,
} from '../../types/auxiliaresSat';

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
            <TableCell sx={{ fontWeight: 700 }}>Póliza / Cuenta</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Motivo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filas.map((f, i) => (
            <TableRow key={`${f.tipo}-${i}`} hover>
              <TableCell sx={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.tipo}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.poliza ?? f.cuenta ?? '—'}</TableCell>
              <TableCell>{f.motivo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const ESTADO_CONFIG: Record<EstadoFolioXml, { label: string; color: string; bg: string }> = {
  correcto: { label: 'Correcto', color: '#166534', bg: '#f0fdf4' },
  uuid_no_encontrado: { label: 'UUID no encontrado', color: '#92400e', bg: '#fffbeb' },
  cfdi_cancelado: { label: 'CFDI cancelado', color: '#92400e', bg: '#fffbeb' },
  rfc_no_coincide: { label: 'RFC no coincide', color: '#92400e', bg: '#fffbeb' },
  uuid_sin_rfc: { label: 'UUID sin RFC', color: '#92400e', bg: '#fffbeb' },
  error: { label: 'Error', color: '#b91c1c', bg: '#fef2f2' },
};

function CeldaEstadoFolio({ value }: { value: EstadoFolioXml }) {
  const config = ESTADO_CONFIG[value];
  return <Chip label={config.label} size="small" sx={{ bgcolor: config.bg, color: config.color, fontWeight: 600, fontSize: 11 }} />;
}

function formatearImporte(valor: number): string {
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TipoAuxiliar = 'folios' | 'cuentas';

export default function AuxiliaresSatView({
  onIrAPolizasSat,
  onIrAValidaciones,
}: {
  onIrAPolizasSat: () => void;
  onIrAValidaciones: () => void;
}) {
  const [auxiliar, setAuxiliar] = React.useState<TipoAuxiliar>('folios');
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [tipoSolicitud, setTipoSolicitud] = React.useState<TipoSolicitudPolizas>('AF');
  const [numOrden, setNumOrden] = React.useState('');
  const [numTramite, setNumTramite] = React.useState('');
  const [resultadoFolios, setResultadoFolios] = React.useState<AuxiliarFoliosResultado | null>(null);
  const [resultadoCuentas, setResultadoCuentas] = React.useState<AuxiliarCuentasResultado | null>(null);
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

  const requiereNumOrden = tipoSolicitud === 'AF' || tipoSolicitud === 'FC';
  const requiereNumTramite = tipoSolicitud === 'DE' || tipoSolicitud === 'CO';
  const faltaDato = (requiereNumOrden && !numOrden.trim()) || (requiereNumTramite && !numTramite.trim());

  const resultado = auxiliar === 'folios' ? resultadoFolios : resultadoCuentas;

  const handlePrevisualizar = React.useCallback(async () => {
    if (!ejercicio || faltaDato) return;
    setCargando(true);
    setError(null);
    try {
      const numOrdenVal = requiereNumOrden ? numOrden.trim() : null;
      const numTramiteVal = requiereNumTramite ? numTramite.trim() : null;
      if (auxiliar === 'folios') {
        const data = await fetchAuxiliarFoliosPreview(ejercicio, periodo, tipoSolicitud, numOrdenVal, numTramiteVal);
        setResultadoFolios(data);
      } else {
        const data = await fetchAuxiliarCuentasPreview(ejercicio, periodo, tipoSolicitud, numOrdenVal, numTramiteVal);
        setResultadoCuentas(data);
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo previsualizar el auxiliar');
      if (auxiliar === 'folios') setResultadoFolios(null);
      else setResultadoCuentas(null);
    } finally {
      setCargando(false);
    }
  }, [ejercicio, periodo, tipoSolicitud, numOrden, numTramite, requiereNumOrden, requiereNumTramite, faltaDato, auxiliar]);

  const handleDescargar = async () => {
    if (!ejercicio || !resultado?.ok) return;
    setDescargando(true);
    setError(null);
    try {
      const numOrdenVal = requiereNumOrden ? numOrden.trim() : null;
      const numTramiteVal = requiereNumTramite ? numTramite.trim() : null;
      if (auxiliar === 'folios') {
        await descargarAuxiliarFolios(ejercicio, periodo, tipoSolicitud, numOrdenVal, numTramiteVal);
      } else {
        await descargarAuxiliarCuentas(ejercicio, periodo, tipoSolicitud, numOrdenVal, numTramiteVal);
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el XML del auxiliar');
    } finally {
      setDescargando(false);
    }
  };

  const columnasFolios: GridColDef<AuxiliarFoliosResultado['folios'][number] & { id: string }>[] = React.useMemo(
    () => [
      {
        field: 'uuid_cfdi',
        headerName: 'UUID',
        width: 150,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{value ? String(value).slice(0, 8) + '…' : '—'}</span>,
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        width: 110,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <span style={{ fontSize: 11 }}>{value ?? '—'}</span>,
      },
      { field: 'poliza', headerName: 'Póliza', width: 110, headerAlign: 'center', headerClassName: 'finanzas-header' },
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
        field: 'cfdi_encontrado',
        headerName: 'CFDI SAT',
        width: 90,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        valueGetter: (_v, row) => (row.estado !== 'uuid_no_encontrado' && row.estado !== 'error' ? 'Sí' : row.estado === 'uuid_no_encontrado' ? 'No' : '—'),
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
        width: 160,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <CeldaEstadoFolio value={value} />,
      },
      {
        field: 'motivo',
        headerName: 'Motivo',
        flex: 1,
        minWidth: 200,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
    ],
    []
  );

  const columnasCuentas: GridColDef<AuxiliarCuentasResultado['cuentas'][number] & { id: number }>[] = React.useMemo(
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
        renderCell: ({ value }) => <span style={{ color: value < 0 ? '#b91c1c' : 'inherit' }}>{formatearImporte(value)}</span>,
      },
      {
        field: 'saldo_fin',
        headerName: 'Saldo final',
        width: 130,
        align: 'right',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <span style={{ color: value < 0 ? '#b91c1c' : 'inherit' }}>{formatearImporte(value)}</span>,
      },
      {
        field: 'naturaleza_descripcion',
        headerName: 'Naturaleza',
        width: 110,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
      {
        field: 'detalle',
        headerName: 'Movimientos',
        width: 110,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        valueGetter: (_v, row) => row.detalle.length,
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 110,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => (
          <Chip
            label={value === 'correcto' ? 'Correcto' : 'Error'}
            size="small"
            sx={value === 'correcto' ? { bgcolor: '#f0fdf4', color: '#166534', fontWeight: 600, fontSize: 11 } : { bgcolor: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 11 }}
          />
        ),
      },
      {
        field: 'motivo',
        headerName: 'Motivo',
        flex: 1,
        minWidth: 200,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
    ],
    []
  );

  const filasFolios = React.useMemo(
    () => (resultadoFolios?.folios ?? []).map((f, i) => ({ ...f, id: `${f.uuid_cfdi}-${f.poliza}-${f.renglon}-${i}` })),
    [resultadoFolios]
  );
  const filasCuentas = React.useMemo(
    () => (resultadoCuentas?.cuentas ?? []).map((c) => ({ ...c, id: c.cuenta_id })),
    [resultadoCuentas]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            value={auxiliar}
            exclusive
            size="small"
            onChange={(_e, value) => {
              if (value) setAuxiliar(value);
            }}
          >
            <ToggleButton value="folios" sx={{ textTransform: 'none' }}>
              Folios fiscales
            </ToggleButton>
            <ToggleButton value="cuentas" sx={{ textTransform: 'none' }}>
              Cuentas
            </ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="auxiliares-sat-ejercicio-label">Ejercicio</InputLabel>
              <Select
                labelId="auxiliares-sat-ejercicio-label"
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

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="auxiliares-sat-tipo-solicitud-label">Tipo de solicitud</InputLabel>
              <Select
                labelId="auxiliares-sat-tipo-solicitud-label"
                label="Tipo de solicitud"
                value={tipoSolicitud}
                onChange={(e) => setTipoSolicitud(e.target.value as TipoSolicitudPolizas)}
              >
                <MenuItem value="AF">Acto de Fiscalización (AF)</MenuItem>
                <MenuItem value="FC">Fiscalización por Compulsa (FC)</MenuItem>
                <MenuItem value="DE">Devolución (DE)</MenuItem>
                <MenuItem value="CO">Compensación (CO)</MenuItem>
              </Select>
            </FormControl>

            {requiereNumOrden && (
              <TextField
                size="small"
                label="Número de orden"
                placeholder="ABC1234567/26"
                value={numOrden}
                onChange={(e) => setNumOrden(e.target.value.toUpperCase())}
                error={!numOrden.trim()}
                helperText={!numOrden.trim() ? 'Requerido' : ' '}
                sx={{ minWidth: 170 }}
              />
            )}

            {requiereNumTramite && (
              <TextField
                size="small"
                label="Número de trámite"
                placeholder="AB123456789012"
                value={numTramite}
                onChange={(e) => setNumTramite(e.target.value.toUpperCase())}
                error={!numTramite.trim()}
                helperText={!numTramite.trim() ? 'Requerido' : ' '}
                sx={{ minWidth: 170 }}
              />
            )}

            <Button
              variant="contained"
              startIcon={<PreviewIcon fontSize="small" />}
              onClick={handlePrevisualizar}
              disabled={!ejercicio || cargando || faltaDato}
              sx={{ textTransform: 'none', bgcolor: BRAND, '&:hover': { bgcolor: '#162551' } }}
            >
              {cargando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Previsualizar / Validar auxiliar'}
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
                <strong>Tipo de solicitud:</strong> {resultado.tipo_solicitud}
              </Typography>
              {auxiliar === 'folios' && resultadoFolios && (
                <>
                  <Typography sx={{ fontSize: 13 }}>
                    <strong>Folios:</strong> {resultadoFolios.resumen.folios}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    <strong>Pólizas:</strong> {resultadoFolios.resumen.polizas}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    <strong>UUID encontrados:</strong> {resultadoFolios.resumen.uuid_encontrados}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: resultadoFolios.resumen.uuid_no_encontrados > 0 ? '#92400e' : 'inherit' }}>
                    <strong>UUID no encontrados:</strong> {resultadoFolios.resumen.uuid_no_encontrados}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: resultadoFolios.resumen.cfdi_cancelados > 0 ? '#92400e' : 'inherit' }}>
                    <strong>CFDI cancelados:</strong> {resultadoFolios.resumen.cfdi_cancelados}
                  </Typography>
                </>
              )}
              {auxiliar === 'cuentas' && resultadoCuentas && (
                <>
                  <Typography sx={{ fontSize: 13 }}>
                    <strong>Cuentas:</strong> {resultadoCuentas.resumen.cuentas}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    <strong>Movimientos:</strong> {resultadoCuentas.resumen.movimientos}
                  </Typography>
                </>
              )}
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
                  <Button size="small" onClick={onIrAPolizasSat} sx={{ textTransform: 'none', fontSize: 12 }}>
                    Ir a Pólizas SAT
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  Advertencias ({resultado.advertencias.length})
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={onIrAPolizasSat} sx={{ textTransform: 'none', fontSize: 12 }}>
                    Ir a Pólizas SAT
                  </Button>
                  <Button size="small" onClick={onIrAValidaciones} sx={{ textTransform: 'none', fontSize: 12 }}>
                    Ir a Validaciones
                  </Button>
                </Stack>
              </Stack>
              <TablaProblemas filas={resultado.advertencias} color="#92400e" />
            </Paper>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {auxiliar === 'folios' ? (
              <EmphasysDataGrid
                rows={filasFolios}
                columns={columnasFolios}
                rowHeight={CUENTAS_GRID_ROW_HEIGHT}
                density="compact"
                disableRowSelectionOnClick
                hideFooterPagination
                hideFooterSelectedRowCount
                autoHeight={filasFolios.length === 0}
                sx={[cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx, filasFolios.length > 0 ? { height: 420 } : {}]}
              />
            ) : (
              <EmphasysDataGrid
                rows={filasCuentas}
                columns={columnasCuentas}
                rowHeight={CUENTAS_GRID_ROW_HEIGHT}
                density="compact"
                disableRowSelectionOnClick
                hideFooterPagination
                hideFooterSelectedRowCount
                autoHeight={filasCuentas.length === 0}
                sx={[cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx, filasCuentas.length > 0 ? { height: 420 } : {}]}
              />
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
