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
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import type { GridColDef } from '@mui/x-data-grid';
import { EmphasysDataGrid } from '../../components/grids/EmphasysDataGrid';
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import { CUENTAS_GRID_ROW_HEIGHT, cuentasGridDensidadSx, cuentasSinFocoDeCeldaSx } from './cuentasGridEstilos';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { fetchCatalogoXmlPreview, descargarCatalogoXml } from '../../services/eContabilidadService';
import type { CatalogoCuentasXmlResultado, CuentaCatalogoXml } from '../../types/catalogoXml';

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

export default function CatalogoXmlView({
  onIrACatalogoSat,
  onIrAValidaciones,
}: {
  onIrACatalogoSat: () => void;
  onIrAValidaciones: () => void;
}) {
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);
  const [resultado, setResultado] = React.useState<CatalogoCuentasXmlResultado | null>(null);
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

  const handlePrevisualizar = React.useCallback(async () => {
    if (!ejercicio) return;
    setCargando(true);
    setError(null);
    try {
      const data = await fetchCatalogoXmlPreview(ejercicio, periodo);
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo previsualizar el catálogo de cuentas');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [ejercicio, periodo]);

  const handleDescargar = async () => {
    if (!ejercicio || !resultado?.ok) return;
    setDescargando(true);
    setError(null);
    try {
      await descargarCatalogoXml(ejercicio, periodo);
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el XML del catálogo de cuentas');
    } finally {
      setDescargando(false);
    }
  };

  const columnas: GridColDef<CuentaCatalogoXml & { id: number }>[] = React.useMemo(
    () => [
      { field: 'num_cta', headerName: 'Cuenta', width: 150, headerAlign: 'center', headerClassName: 'finanzas-header' },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        flex: 1,
        minWidth: 200,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
      },
      {
        field: 'cod_agrup',
        headerName: 'Código agrupador SAT',
        width: 170,
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => value ?? '',
      },
      {
        field: 'nivel',
        headerName: 'Nivel',
        width: 70,
        align: 'center',
        headerAlign: 'center',
        headerClassName: 'finanzas-header',
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
        field: 'sub_cta_de',
        headerName: 'Subcuenta de',
        width: 150,
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
            <InputLabel id="catalogo-xml-ejercicio-label">Ejercicio</InputLabel>
            <Select
              labelId="catalogo-xml-ejercicio-label"
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
            startIcon={<PreviewIcon fontSize="small" />}
            onClick={handlePrevisualizar}
            disabled={!ejercicio || cargando}
            sx={{ textTransform: 'none', bgcolor: BRAND, '&:hover': { bgcolor: '#162551' } }}
          >
            {cargando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Previsualizar / Validar catálogo'}
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
                <strong>Cuentas:</strong> {resultado.resumen.cuentas}
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
