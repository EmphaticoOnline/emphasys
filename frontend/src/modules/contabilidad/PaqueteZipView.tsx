import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
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
import { SelectorMesesCompacto } from './SelectorMesesCompacto';
import { fetchEjerciciosDisponibles } from '../../services/saldosCuentasService';
import { fetchPaqueteZipPreview, descargarPaqueteZip } from '../../services/eContabilidadService';
import type { ParametrosPaqueteZip } from '../../services/eContabilidadService';
import type { ArchivoPaqueteZip, ClaveArchivoPaquete, PaqueteZipPreviewResultado } from '../../types/paqueteZip';
import type { TipoEnvioBalanza } from '../../types/balanzaXml';
import type { TipoSolicitudPolizas } from '../../types/polizasXml';

const BRAND = '#1d2f68';

type EstadoFila = 'listo' | 'con_advertencias' | 'con_errores' | 'no_seleccionado';

const ESTADO_CONFIG: Record<EstadoFila, { label: string; color: string; bg: string }> = {
  listo: { label: 'Listo', color: '#166534', bg: '#f0fdf4' },
  con_advertencias: { label: 'Con advertencias', color: '#92400e', bg: '#fffbeb' },
  con_errores: { label: 'Con errores', color: '#b91c1c', bg: '#fef2f2' },
  no_seleccionado: { label: 'No seleccionado', color: '#6b7280', bg: '#f3f4f6' },
};

function CeldaEstado({ value }: { value: EstadoFila }) {
  const config = ESTADO_CONFIG[value];
  return <Chip label={config.label} size="small" sx={{ bgcolor: config.bg, color: config.color, fontWeight: 600, fontSize: 11 }} />;
}

interface FilaArchivo {
  clave: ClaveArchivoPaquete;
  titulo: string;
  seleccionado: boolean;
  datos: ArchivoPaqueteZip | null;
}

const TITULOS: Record<ClaveArchivoPaquete, string> = {
  catalogo: 'Catálogo XML',
  balanza: 'Balanza XML',
  polizas: 'Pólizas XML',
  aux_folios: 'Auxiliar de folios fiscales',
  aux_cuentas: 'Auxiliar de cuentas',
};

export default function PaqueteZipView({
  onIrACatalogoXml,
  onIrABalanzaXml,
  onIrAPolizasXml,
  onIrAAuxiliaresSat,
  onIrAValidaciones,
  onIrABitacora,
}: {
  onIrACatalogoXml: () => void;
  onIrABalanzaXml: () => void;
  onIrAPolizasXml: () => void;
  onIrAAuxiliaresSat: () => void;
  onIrAValidaciones: () => void;
  onIrABitacora: () => void;
}) {
  const [ejercicios, setEjercicios] = React.useState<number[]>([]);
  const [ejercicio, setEjercicio] = React.useState<number | null>(null);
  const [periodo, setPeriodo] = React.useState<number>(new Date().getMonth() + 1);

  const [incluirCatalogo, setIncluirCatalogo] = React.useState(true);
  const [incluirBalanza, setIncluirBalanza] = React.useState(true);
  const [tipoEnvioBalanza, setTipoEnvioBalanza] = React.useState<TipoEnvioBalanza>('N');
  const [fechaModBalanza, setFechaModBalanza] = React.useState('');

  const [incluirPolizas, setIncluirPolizas] = React.useState(true);
  const [incluirAuxFolios, setIncluirAuxFolios] = React.useState(true);
  const [incluirAuxCuentas, setIncluirAuxCuentas] = React.useState(true);
  const [tipoSolicitud, setTipoSolicitud] = React.useState<TipoSolicitudPolizas>('AF');
  const [numOrden, setNumOrden] = React.useState('');
  const [numTramite, setNumTramite] = React.useState('');

  const [resultado, setResultado] = React.useState<PaqueteZipPreviewResultado | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [descargando, setDescargando] = React.useState(false);
  const [descargaExitosa, setDescargaExitosa] = React.useState(false);
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

  const requiereTipoSolicitud = incluirPolizas || incluirAuxFolios || incluirAuxCuentas;
  const requiereNumOrden = requiereTipoSolicitud && (tipoSolicitud === 'AF' || tipoSolicitud === 'FC');
  const requiereNumTramite = requiereTipoSolicitud && (tipoSolicitud === 'DE' || tipoSolicitud === 'CO');
  const requiereFechaModBalanza = incluirBalanza && tipoEnvioBalanza === 'C';

  const ningunoSeleccionado = !incluirCatalogo && !incluirBalanza && !incluirPolizas && !incluirAuxFolios && !incluirAuxCuentas;
  const faltaDato =
    ningunoSeleccionado ||
    (requiereFechaModBalanza && !fechaModBalanza.trim()) ||
    (requiereNumOrden && !numOrden.trim()) ||
    (requiereNumTramite && !numTramite.trim());

  const construirParametros = (): ParametrosPaqueteZip | null => {
    if (!ejercicio) return null;
    return {
      ejercicio,
      periodo,
      incluirCatalogo,
      incluirBalanza,
      incluirPolizas,
      incluirAuxFolios,
      incluirAuxCuentas,
      tipoEnvioBalanza,
      fechaModificacionBalanza: requiereFechaModBalanza ? fechaModBalanza.trim() : null,
      tipoSolicitud: requiereTipoSolicitud ? tipoSolicitud : null,
      numOrden: requiereNumOrden ? numOrden.trim() : null,
      numTramite: requiereNumTramite ? numTramite.trim() : null,
    };
  };

  const handlePrevalidar = async () => {
    const params = construirParametros();
    if (!params || faltaDato) return;
    setCargando(true);
    setError(null);
    setDescargaExitosa(false);
    try {
      const data = await fetchPaqueteZipPreview(params);
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo prevalidar el paquete');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  };

  const handleDescargar = async () => {
    const params = construirParametros();
    if (!params || !resultado?.ok) return;
    setDescargando(true);
    setError(null);
    setDescargaExitosa(false);
    try {
      await descargarPaqueteZip(params);
      setDescargaExitosa(true);
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el paquete ZIP');
    } finally {
      setDescargando(false);
    }
  };

  const filas: FilaArchivo[] = React.useMemo(() => {
    const seleccion: Record<ClaveArchivoPaquete, boolean> = {
      catalogo: incluirCatalogo,
      balanza: incluirBalanza,
      polizas: incluirPolizas,
      aux_folios: incluirAuxFolios,
      aux_cuentas: incluirAuxCuentas,
    };
    const claves: ClaveArchivoPaquete[] = ['catalogo', 'balanza', 'polizas', 'aux_folios', 'aux_cuentas'];
    return claves.map((clave) => ({
      clave,
      titulo: TITULOS[clave],
      seleccionado: seleccion[clave],
      datos: resultado?.archivos.find((a) => a.clave === clave) ?? null,
    }));
  }, [incluirCatalogo, incluirBalanza, incluirPolizas, incluirAuxFolios, incluirAuxCuentas, resultado]);

  const estadoDeFila = (fila: FilaArchivo): EstadoFila => {
    if (!fila.seleccionado || !fila.datos) return 'no_seleccionado';
    if (!fila.datos.ok) return 'con_errores';
    if (fila.datos.advertencias > 0) return 'con_advertencias';
    return 'listo';
  };

  const irASubtab = (clave: ClaveArchivoPaquete) => {
    if (clave === 'catalogo') onIrACatalogoXml();
    else if (clave === 'balanza') onIrABalanzaXml();
    else if (clave === 'polizas') onIrAPolizasXml();
    else onIrAAuxiliaresSat();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="paquete-zip-ejercicio-label">Ejercicio</InputLabel>
              <Select
                labelId="paquete-zip-ejercicio-label"
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
          </Stack>

          <Divider />

          <Stack direction="row" spacing={3} flexWrap="wrap">
            <FormControlLabel
              control={<Checkbox checked={incluirCatalogo} onChange={(e) => setIncluirCatalogo(e.target.checked)} />}
              label="Incluir Catálogo XML"
            />

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControlLabel
                control={<Checkbox checked={incluirBalanza} onChange={(e) => setIncluirBalanza(e.target.checked)} />}
                label="Incluir Balanza XML"
              />
              {incluirBalanza && (
                <>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="paquete-zip-tipo-envio-label">Tipo de envío</InputLabel>
                    <Select
                      labelId="paquete-zip-tipo-envio-label"
                      label="Tipo de envío"
                      value={tipoEnvioBalanza}
                      onChange={(e) => setTipoEnvioBalanza(e.target.value as TipoEnvioBalanza)}
                    >
                      <MenuItem value="N">Normal</MenuItem>
                      <MenuItem value="C">Complementaria</MenuItem>
                    </Select>
                  </FormControl>
                  {tipoEnvioBalanza === 'C' && (
                    <TextField
                      size="small"
                      type="date"
                      label="Fecha de modificación"
                      InputLabelProps={{ shrink: true }}
                      value={fechaModBalanza}
                      onChange={(e) => setFechaModBalanza(e.target.value)}
                      error={!fechaModBalanza.trim()}
                      helperText={!fechaModBalanza.trim() ? 'Requerida' : ' '}
                      sx={{ minWidth: 170 }}
                    />
                  )}
                </>
              )}
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <FormControlLabel
                control={<Checkbox checked={incluirPolizas} onChange={(e) => setIncluirPolizas(e.target.checked)} />}
                label="Incluir Pólizas XML"
              />
              <FormControlLabel
                control={<Checkbox checked={incluirAuxFolios} onChange={(e) => setIncluirAuxFolios(e.target.checked)} />}
                label="Incluir Auxiliar de folios fiscales"
              />
              <FormControlLabel
                control={<Checkbox checked={incluirAuxCuentas} onChange={(e) => setIncluirAuxCuentas(e.target.checked)} />}
                label="Incluir Auxiliar de cuentas"
              />
            </Stack>

            {requiereTipoSolicitud && (
              <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="paquete-zip-tipo-solicitud-label">Tipo de solicitud</InputLabel>
                  <Select
                    labelId="paquete-zip-tipo-solicitud-label"
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
              </Stack>
            )}
          </Stack>

          <Divider />

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<PreviewIcon fontSize="small" />}
              onClick={handlePrevalidar}
              disabled={!ejercicio || cargando || faltaDato}
              sx={{ textTransform: 'none', bgcolor: BRAND, '&:hover': { bgcolor: '#162551' } }}
            >
              {cargando ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Prevalidar paquete'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={handleDescargar}
              disabled={!resultado?.ok || descargando}
              sx={{ textTransform: 'none', color: BRAND, borderColor: BRAND }}
            >
              {descargando ? 'Generando...' : 'Descargar ZIP'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {descargaExitosa && (
        <Alert severity="success" onClose={() => setDescargaExitosa(false)}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <span>Paquete generado y registrado en bitácora.</span>
            <Button size="small" onClick={onIrABitacora} sx={{ textTransform: 'none' }}>
              Ver bitácora
            </Button>
          </Stack>
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {resultado && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack direction="row" spacing={3} flexWrap="wrap" alignItems="center">
            <Typography sx={{ fontSize: 13 }}>
              <strong>RFC:</strong> {resultado.empresa.rfc || '—'}
            </Typography>
            <Typography sx={{ fontSize: 13 }}>
              <strong>Archivos seleccionados:</strong> {resultado.resumen.archivos_seleccionados}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#166534' }}>
              <strong>Correctos:</strong> {resultado.resumen.archivos_ok}
            </Typography>
            <Typography sx={{ fontSize: 13, color: resultado.resumen.archivos_con_error > 0 ? '#b91c1c' : 'inherit' }}>
              <strong>Con error:</strong> {resultado.resumen.archivos_con_error}
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
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: 12.5, py: 0.75 } }}>
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: BRAND, color: '#fff', fontWeight: 700 } }}>
                <TableCell>Archivo</TableCell>
                <TableCell>Nombre XML</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="center">Errores</TableCell>
                <TableCell align="center">Advertencias</TableCell>
                <TableCell align="center">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map((fila) => {
                const estado = estadoDeFila(fila);
                return (
                  <TableRow key={fila.clave} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{fila.titulo}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>{fila.datos?.nombre ?? '—'}</TableCell>
                    <TableCell align="center">
                      <CeldaEstado value={estado} />
                    </TableCell>
                    <TableCell align="center" sx={{ color: (fila.datos?.errores ?? 0) > 0 ? '#b91c1c' : 'inherit' }}>
                      {fila.datos?.errores ?? '—'}
                    </TableCell>
                    <TableCell align="center" sx={{ color: (fila.datos?.advertencias ?? 0) > 0 ? '#92400e' : 'inherit' }}>
                      {fila.datos?.advertencias ?? '—'}
                    </TableCell>
                    <TableCell align="center">
                      {(estado === 'con_errores' || estado === 'con_advertencias') && (
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Button size="small" onClick={() => irASubtab(fila.clave)} sx={{ textTransform: 'none', fontSize: 11 }}>
                            Ir a {fila.titulo}
                          </Button>
                          <Button size="small" onClick={onIrAValidaciones} sx={{ textTransform: 'none', fontSize: 11 }}>
                            Validaciones
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
