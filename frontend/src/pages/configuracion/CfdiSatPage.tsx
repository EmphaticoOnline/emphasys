import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useSession } from '../../session/useSession';
import { esRolAdmin } from '../../session/rolScope';
import {
  aceptarCfdiSatAutorizacion,
  crearCfdiSatSolicitud,
  deleteCfdiSatCredenciales,
  descargarCfdiSatSolicitud,
  fetchCfdiSatAutorizacion,
  fetchCfdiSatCredenciales,
  fetchCfdiSatResumen,
  fetchCfdiSatSolicitudes,
  uploadCfdiSatCredenciales,
  verificarCfdiSatSolicitud,
  type CfdiSatAutorizacion,
  type CfdiSatCredenciales,
  type CfdiSatEstatusComprobante,
  type CfdiSatResumenModulo,
  type CfdiSatSolicitud,
  type CfdiSatSolicitudEstatus,
  type CfdiSatTipoDescarga,
  type CfdiSatTipoSolicitud,
} from '../../services/cfdiSatService';
import ComprobantesSatSection from '../../components/cfdi-sat/ComprobantesSatSection';
import PaquetesSolicitudDialog from '../../components/cfdi-sat/PaquetesSolicitudDialog';
import ResumenSatCards from '../../components/cfdi-sat/ResumenSatCards';
import BitacoraSatSection from '../../components/cfdi-sat/BitacoraSatSection';
import AutomatizacionSatSection from '../../components/cfdi-sat/AutomatizacionSatSection';
import type { ApiFetchError } from '../../services/apiFetch';

function formatFecha(raw?: string | null): string {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-MX');
}

const GATEWAY_TIMEOUT_STATUS = new Set([502, 503, 504]);

/**
 * Si la respuesta nunca llegó a ser el JSON del backend (ej. un 502/503/504
 * de nginx u otro proxy delante del backend porque el SAT tardó demasiado),
 * apiFetch ya evita mostrar el cuerpo crudo (ver apiFetch.ts), pero aquí se
 * da un mensaje específico del contexto SAT en vez del genérico de apiFetch.
 */
function describirErrorAccionSat(error: unknown, accionTexto: string, fallback: string): string {
  const apiError = error as ApiFetchError;
  if (apiError?.status != null && GATEWAY_TIMEOUT_STATUS.has(apiError.status)) {
    return `El servidor tardó demasiado en responder al ${accionTexto} ante el SAT. Intenta nuevamente más tarde.`;
  }
  return error instanceof Error ? error.message : fallback;
}

const ESTATUS_SOLICITUD_COLOR: Record<CfdiSatSolicitudEstatus, 'default' | 'success' | 'error' | 'warning'> = {
  pendiente: 'default',
  solicitado: 'warning',
  en_proceso: 'warning',
  terminado: 'success',
  sin_resultados: 'default',
  error: 'error',
  expirado: 'error',
  rechazado: 'error',
};

type AccionSolicitud = 'verificar' | 'descargar';

export default function CfdiSatPage() {
  const { session } = useSession();
  const puedeAdministrar = Boolean(session.user?.es_superadmin) || esRolAdmin(session.roles);

  const [credenciales, setCredenciales] = React.useState<CfdiSatCredenciales | null>(null);
  const [autorizacion, setAutorizacion] = React.useState<CfdiSatAutorizacion | null>(null);
  const [resumen, setResumen] = React.useState<CfdiSatResumenModulo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [cerFile, setCerFile] = React.useState<File | null>(null);
  const [keyFile, setKeyFile] = React.useState<File | null>(null);
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [aceptoTexto, setAceptoTexto] = React.useState(false);
  const [autorizacionSubmitting, setAutorizacionSubmitting] = React.useState(false);
  const [autorizacionError, setAutorizacionError] = React.useState<string | null>(null);

  const [solicitudes, setSolicitudes] = React.useState<CfdiSatSolicitud[]>([]);
  const [tipoDescarga, setTipoDescarga] = React.useState<CfdiSatTipoDescarga>('emitidos');
  const [fechaInicio, setFechaInicio] = React.useState('');
  const [fechaFin, setFechaFin] = React.useState('');
  const [tipoSolicitud, setTipoSolicitud] = React.useState<CfdiSatTipoSolicitud>('metadata');
  const [estatusComprobante, setEstatusComprobante] = React.useState<CfdiSatEstatusComprobante | ''>('todos');
  const [fielPassword, setFielPassword] = React.useState('');
  const [showFielPassword, setShowFielPassword] = React.useState(false);
  const [solicitudSubmitting, setSolicitudSubmitting] = React.useState(false);
  const [solicitudError, setSolicitudError] = React.useState<string | null>(null);
  const [solicitudSuccess, setSolicitudSuccess] = React.useState<string | null>(null);

  const [accionDialog, setAccionDialog] = React.useState<{ solicitudId: number; accion: AccionSolicitud } | null>(
    null
  );
  const [accionPassword, setAccionPassword] = React.useState('');
  const [showAccionPassword, setShowAccionPassword] = React.useState(false);
  const [accionSubmitting, setAccionSubmitting] = React.useState(false);
  const [accionError, setAccionError] = React.useState<string | null>(null);
  const [accionResultado, setAccionResultado] = React.useState<string | null>(null);

  const [paquetesDialogSolicitudId, setPaquetesDialogSolicitudId] = React.useState<number | null>(null);
  const [comprobantesRefreshKey, setComprobantesRefreshKey] = React.useState(0);
  const [automatizacionRefreshKey, setAutomatizacionRefreshKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [credencialesData, autorizacionData, solicitudesData, resumenData] = await Promise.all([
        fetchCfdiSatCredenciales(),
        fetchCfdiSatAutorizacion(),
        fetchCfdiSatSolicitudes(),
        fetchCfdiSatResumen(),
      ]);
      setCredenciales(credencialesData);
      setAutorizacion(autorizacionData);
      setSolicitudes(solicitudesData);
      setResumen(resumenData);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo cargar la configuración SAT');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * Punto único de refresco para cualquier acción que pueda cambiar varias
   * secciones a la vez: la ejecución asistida de automatización (verifica/
   * descarga varias solicitudes de un jalón) y también importar/vincular un
   * comprobante desde la bandeja (cambia comprobantes pendientes, y por lo
   * tanto el resumen y las alertas de la página). Refresca solicitudes,
   * resumen (alertas), cards de resumen, comprobantes y bitácora — no solo
   * el estado interno de la sección que disparó el cambio.
   */
  const handleDatosCambiaron = React.useCallback(async () => {
    try {
      const [solicitudesData, resumenData] = await Promise.all([fetchCfdiSatSolicitudes(), fetchCfdiSatResumen()]);
      setSolicitudes(solicitudesData);
      setResumen(resumenData);
    } catch {
      /* si falla este refresco puntual, load() lo corregirá en la próxima visita; no es crítico aquí */
    }
    setComprobantesRefreshKey((key) => key + 1);
    setAutomatizacionRefreshKey((key) => key + 1);
  }, []);

  const handleOpenUpload = () => {
    setCerFile(null);
    setKeyFile(null);
    setUploadError(null);
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!cerFile) {
      setUploadError('Selecciona el archivo .cer');
      return;
    }
    if (!keyFile) {
      setUploadError('Selecciona el archivo .key');
      return;
    }

    setUploadSubmitting(true);
    setUploadError(null);
    try {
      const updated = await uploadCfdiSatCredenciales(cerFile, keyFile);
      setCredenciales(updated);
      setUploadOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudieron guardar las credenciales');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteCfdiSatCredenciales();
      setCredenciales({ existe: false });
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudieron eliminar las credenciales');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleAceptarAutorizacion = async () => {
    setAutorizacionSubmitting(true);
    setAutorizacionError(null);
    try {
      const updated = await aceptarCfdiSatAutorizacion();
      setAutorizacion(updated);
      setAceptoTexto(false);
    } catch (error) {
      setAutorizacionError(error instanceof Error ? error.message : 'No se pudo registrar la aceptación');
    } finally {
      setAutorizacionSubmitting(false);
    }
  };

  const credencialesVigentes = credenciales?.existe === true && credenciales.vigente;
  const puedeCrearSolicitud = puedeAdministrar && credencialesVigentes && Boolean(autorizacion?.aceptada);

  const alertasOperativas = React.useMemo(() => {
    const lista: Array<{ severity: 'error' | 'warning'; mensaje: string }> = [];

    if (!credenciales?.existe) {
      lista.push({ severity: 'warning', mensaje: 'No hay una e.firma (FIEL) cargada para esta empresa.' });
    } else if (!credenciales.vigente) {
      lista.push({ severity: 'error', mensaje: 'La e.firma (FIEL) cargada está vencida.' });
    } else if (credenciales.vigencia_hasta) {
      const diasRestantes = Math.floor(
        (new Date(credenciales.vigencia_hasta).getTime() - Date.now()) / 86_400_000
      );
      if (diasRestantes >= 0 && diasRestantes < 30) {
        lista.push({
          severity: 'warning',
          mensaje: `La e.firma (FIEL) vence en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}.`,
        });
      }
    }

    if (!autorizacion?.aceptada) {
      lista.push({ severity: 'warning', mensaje: 'Falta aceptar la autorización de uso de la e.firma.' });
    }

    if (resumen) {
      if (resumen.solicitudes.con_error > 0) {
        lista.push({
          severity: 'error',
          mensaje: `Hay ${resumen.solicitudes.con_error} solicitud${resumen.solicitudes.con_error === 1 ? '' : 'es'} con error ante el SAT.`,
        });
      }
      if (resumen.paquetes_con_error > 0) {
        lista.push({
          severity: 'error',
          mensaje: `Hay ${resumen.paquetes_con_error} paquete${resumen.paquetes_con_error === 1 ? '' : 's'} con error al descargar.`,
        });
      }
      if (resumen.comprobantes.pendientes_importar > 0) {
        lista.push({
          severity: 'warning',
          mensaje: `Hay ${resumen.comprobantes.pendientes_importar} comprobante${resumen.comprobantes.pendientes_importar === 1 ? '' : 's'} recibido${resumen.comprobantes.pendientes_importar === 1 ? '' : 's'} elegible${resumen.comprobantes.pendientes_importar === 1 ? '' : 's'} pendiente${resumen.comprobantes.pendientes_importar === 1 ? '' : 's'} de importar a Compras.`,
        });
      }
    }

    return lista;
  }, [credenciales, autorizacion, resumen]);

  const handleCrearSolicitud = async () => {
    setSolicitudError(null);
    setSolicitudSuccess(null);

    if (!fechaInicio || !fechaFin) {
      setSolicitudError('Captura el rango de fechas');
      return;
    }
    if (fechaFin < fechaInicio) {
      setSolicitudError('La fecha fin no puede ser anterior a la fecha inicio');
      return;
    }
    if (!fielPassword) {
      setSolicitudError('Captura la contraseña de la e.firma');
      return;
    }

    setSolicitudSubmitting(true);
    try {
      const solicitud = await crearCfdiSatSolicitud({
        tipo_descarga: tipoDescarga,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo_solicitud: tipoSolicitud,
        estatus_comprobante: estatusComprobante || null,
        fielPassword,
      });
      setSolicitudSuccess(`Solicitud creada ante el SAT. RequestId: ${solicitud.sat_request_id ?? '—'}`);
      setFielPassword('');
    } catch (error) {
      setSolicitudError(describirErrorAccionSat(error, 'crear la solicitud', 'No se pudo crear la solicitud'));
    } finally {
      setSolicitudSubmitting(false);
      // Crear una solicitud también cambia el resumen ("solicitudes totales") y la bitácora.
      void handleDatosCambiaron();
    }
  };

  const handleAbrirAccionDialog = (solicitudId: number, accion: AccionSolicitud) => {
    setAccionDialog({ solicitudId, accion });
    setAccionPassword('');
    setShowAccionPassword(false);
    setAccionError(null);
    setAccionResultado(null);
  };

  const handleCerrarAccionDialog = () => {
    if (accionSubmitting) return;
    setAccionDialog(null);
    setAccionPassword('');
    setAccionError(null);
    setAccionResultado(null);
  };

  const handleConfirmarAccion = async () => {
    if (!accionDialog) return;
    if (!accionPassword) {
      setAccionError('Captura la contraseña de la e.firma');
      return;
    }

    setAccionSubmitting(true);
    setAccionError(null);
    setAccionResultado(null);

    try {
      if (accionDialog.accion === 'verificar') {
        const actualizada = await verificarCfdiSatSolicitud(accionDialog.solicitudId, accionPassword);
        setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)));
        setAccionResultado(
          `Estatus SAT: ${actualizada.estatus.toUpperCase()}. CFDIs encontrados: ${actualizada.cfdis_encontrados ?? 0}. Paquetes: ${actualizada.total_paquetes}.`
        );
      } else {
        const resultado = await descargarCfdiSatSolicitud(accionDialog.solicitudId, accionPassword);
        setSolicitudes((prev) => prev.map((s) => (s.id === resultado.solicitud.id ? resultado.solicitud : s)));
        setAccionResultado(
          `Comprobantes nuevos: ${resultado.nuevos}. Duplicados: ${resultado.duplicados}. Paquetes con error: ${resultado.paquetes_con_error}.`
        );
      }
    } catch (error) {
      const accionTexto = accionDialog.accion === 'verificar' ? 'verificar la solicitud' : 'descargar los paquetes';
      setAccionError(describirErrorAccionSat(error, accionTexto, 'No se pudo completar la acción'));
    } finally {
      setAccionSubmitting(false);
      setAccionPassword('');
      // Verificar/descargar puede cambiar solicitudes, comprobantes pendientes, resumen/alertas y bitácora:
      // se refresca todo igual que tras la ejecución asistida de automatización, no solo el resumen.
      void handleDatosCambiaron();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Descarga de CFDIs desde el SAT
        </Typography>
        <Typography variant="body2" color="#4b5563">
          Configura la e.firma (FIEL) y la autorización de uso, crea solicitudes de descarga, verifícalas y
          descarga los comprobantes del Servicio de Descarga Masiva del SAT. La importación a compras se agrega
          en una fase posterior.
        </Typography>
      </Stack>

      {pageError && <Alert severity="error">{pageError}</Alert>}

      {alertasOperativas.length > 0 && (
        <Stack spacing={1}>
          {alertasOperativas.map((alerta, index) => (
            <Alert key={index} severity={alerta.severity}>
              {alerta.mensaje}
            </Alert>
          ))}
        </Stack>
      )}

      <ResumenSatCards key={automatizacionRefreshKey} />

      <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography variant="h6" fontWeight={700} color="#1d2f68">
                Credenciales e.firma (FIEL)
              </Typography>
              <Typography variant="body2" color="#4b5563">
                Certificado (.cer) y llave privada (.key) usados para autenticar ante el Servicio de Descarga
                Masiva del SAT. La contraseña de la FIEL no se solicita ni se guarda en esta fase.
              </Typography>
            </Stack>
            {credenciales?.existe && (
              <Chip
                label={credenciales.vigente ? 'VIGENTE' : 'VENCIDA'}
                size="small"
                color={credenciales.vigente ? 'success' : 'error'}
                sx={{ fontWeight: 700, mt: 0.25 }}
              />
            )}
          </Stack>

          {credenciales?.existe ? (
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                RFC del certificado: <strong>{credenciales.rfc_certificado}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vigencia: <strong>{formatFecha(credenciales.vigencia_desde)}</strong> a{' '}
                <strong>{formatFecha(credenciales.vigencia_hasta)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fecha de carga: <strong>{formatFecha(credenciales.cargado_en)}</strong>
              </Typography>
            </Stack>
          ) : (
            <Alert severity="info">No hay credenciales SAT cargadas para esta empresa.</Alert>
          )}

          {puedeAdministrar ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={handleOpenUpload} sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}>
                {credenciales?.existe ? 'Reemplazar credenciales' : 'Subir credenciales'}
              </Button>
              {credenciales?.existe && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Eliminar
                </Button>
              )}
            </Stack>
          ) : (
            <Typography variant="caption" color="#6b7280">
              Solo un administrador de la empresa puede subir, reemplazar o eliminar las credenciales.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">
              Autorización de uso
            </Typography>
            {autorizacion?.aceptada && (
              <Chip label="ACEPTADA" size="small" color="success" sx={{ fontWeight: 700, mt: 0.25 }} />
            )}
          </Stack>

          <Box
            sx={{
              border: '1px solid #dbe3f0',
              borderRadius: 1,
              p: 2,
              backgroundColor: '#f8fbff',
              maxHeight: 220,
              overflowY: 'auto',
              whiteSpace: 'pre-line',
            }}
          >
            <Typography variant="body2" color="#374151">
              {autorizacion?.texto}
            </Typography>
          </Box>

          {autorizacionError && <Alert severity="error">{autorizacionError}</Alert>}

          {autorizacion?.aceptada ? (
            <Typography variant="body2" color="text.secondary">
              Aceptada por <strong>{autorizacion.aceptado_por}</strong> el{' '}
              <strong>{formatFecha(autorizacion.aceptado_en)}</strong>.
            </Typography>
          ) : puedeAdministrar ? (
            <Stack spacing={1.5}>
              <FormControlLabel
                control={<Checkbox checked={aceptoTexto} onChange={(e) => setAceptoTexto(e.target.checked)} />}
                label="He leído y acepto el uso de la e.firma bajo los términos anteriores"
              />
              <Box>
                <Button
                  variant="contained"
                  disabled={!aceptoTexto || autorizacionSubmitting}
                  onClick={() => void handleAceptarAutorizacion()}
                  sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
                >
                  {autorizacionSubmitting ? 'Guardando...' : 'Aceptar autorización'}
                </Button>
              </Box>
            </Stack>
          ) : (
            <Alert severity="warning">
              Esta empresa aún no ha aceptado la autorización. Solo un administrador puede aceptarla.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">
              Nueva solicitud de descarga
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Presenta una solicitud real al Servicio de Descarga Masiva del SAT. Esta fase solo llega hasta
              que el SAT acepta la solicitud; la verificación y descarga de paquetes se agregan más adelante.
            </Typography>
          </Stack>

          {!puedeAdministrar && (
            <Alert severity="warning">Solo un administrador de la empresa puede crear solicitudes.</Alert>
          )}
          {puedeAdministrar && !credencialesVigentes && (
            <Alert severity="warning">Se requiere una e.firma vigente cargada arriba para poder solicitar.</Alert>
          )}
          {puedeAdministrar && credencialesVigentes && !autorizacion?.aceptada && (
            <Alert severity="warning">Se requiere aceptar la autorización de uso para poder solicitar.</Alert>
          )}

          {solicitudSuccess && <Alert severity="success">{solicitudSuccess}</Alert>}
          {solicitudError && <Alert severity="error">{solicitudError}</Alert>}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Tipo"
              size="small"
              value={tipoDescarga}
              onChange={(e) => setTipoDescarga(e.target.value as CfdiSatTipoDescarga)}
              disabled={!puedeCrearSolicitud}
            >
              <MenuItem value="emitidos">Emitidos</MenuItem>
              <MenuItem value="recibidos">Recibidos</MenuItem>
            </TextField>

            <TextField
              select
              label="Tipo de solicitud"
              size="small"
              value={tipoSolicitud}
              onChange={(e) => setTipoSolicitud(e.target.value as CfdiSatTipoSolicitud)}
              disabled={!puedeCrearSolicitud}
            >
              <MenuItem value="metadata">Metadata</MenuItem>
              <MenuItem value="xml">XML</MenuItem>
            </TextField>

            <TextField
              select
              label="Estatus del comprobante"
              size="small"
              value={estatusComprobante}
              onChange={(e) => setEstatusComprobante(e.target.value as CfdiSatEstatusComprobante)}
              disabled={!puedeCrearSolicitud}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="activos">Activos</MenuItem>
              <MenuItem value="cancelados">Cancelados</MenuItem>
            </TextField>

            <TextField
              label="Fecha inicio"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={!puedeCrearSolicitud}
            />

            <TextField
              label="Fecha fin"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={!puedeCrearSolicitud}
            />

            <TextField
              label="Contraseña e.firma"
              type={showFielPassword ? 'text' : 'password'}
              size="small"
              value={fielPassword}
              onChange={(e) => setFielPassword(e.target.value)}
              disabled={!puedeCrearSolicitud}
              autoComplete="off"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={showFielPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowFielPassword((prev) => !prev)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {showFielPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Typography variant="caption" color="#6b7280">
            La contraseña de la e.firma no se guarda: solo se usa en memoria durante esta solicitud.
          </Typography>

          <Box>
            <Button
              variant="contained"
              onClick={() => void handleCrearSolicitud()}
              disabled={!puedeCrearSolicitud || solicitudSubmitting}
              sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
            >
              {solicitudSubmitting ? 'Enviando al SAT...' : 'Crear solicitud'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" fontWeight={700} color="#1d2f68">
            Solicitudes recientes
          </Typography>

          {solicitudes.length === 0 ? (
            <Alert severity="info">Aún no se han creado solicitudes de descarga.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Rango</TableCell>
                    <TableCell>Solicitud</TableCell>
                    <TableCell>Estatus</TableCell>
                    <TableCell>Request ID (SAT)</TableCell>
                    <TableCell align="right">CFDIs SAT</TableCell>
                    <TableCell align="right">Paquetes</TableCell>
                    <TableCell align="right">Guardados</TableCell>
                    <TableCell>Creada</TableCell>
                    {puedeAdministrar && <TableCell align="right">Acciones</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {solicitudes.map((solicitud) => (
                    <TableRow key={solicitud.id}>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{solicitud.tipo_descarga}</TableCell>
                      <TableCell>
                        {solicitud.fecha_inicio} a {solicitud.fecha_fin}
                      </TableCell>
                      <TableCell sx={{ textTransform: 'uppercase' }}>{solicitud.tipo_solicitud}</TableCell>
                      <TableCell>
                        <Tooltip title={solicitud.mensaje_error ?? ''} disableHoverListener={!solicitud.mensaje_error}>
                          <Chip
                            label={solicitud.estatus.toUpperCase().replace('_', ' ')}
                            size="small"
                            color={ESTATUS_SOLICITUD_COLOR[solicitud.estatus]}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>{solicitud.sat_request_id ?? '—'}</TableCell>
                      <TableCell align="right">{solicitud.cfdis_encontrados ?? '—'}</TableCell>
                      <TableCell align="right">{solicitud.total_paquetes}</TableCell>
                      <TableCell align="right">{solicitud.total_comprobantes}</TableCell>
                      <TableCell>{formatFecha(solicitud.creado_en)}</TableCell>
                      {puedeAdministrar && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!solicitud.sat_request_id}
                              onClick={() => handleAbrirAccionDialog(solicitud.id, 'verificar')}
                              sx={{ textTransform: 'none' }}
                            >
                              Verificar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleAbrirAccionDialog(solicitud.id, 'descargar')}
                              sx={{ textTransform: 'none' }}
                            >
                              Descargar
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              disabled={solicitud.total_paquetes === 0}
                              onClick={() => setPaquetesDialogSolicitudId(solicitud.id)}
                              sx={{ textTransform: 'none' }}
                            >
                              Paquetes
                            </Button>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <AutomatizacionSatSection puedeAdministrar={puedeAdministrar} onEjecutado={handleDatosCambiaron} />

      <ComprobantesSatSection
        key={comprobantesRefreshKey}
        puedeAdministrar={puedeAdministrar}
        onCambio={handleDatosCambiaron}
      />

      <BitacoraSatSection key={automatizacionRefreshKey} />

      <Dialog open={uploadOpen} onClose={() => (!uploadSubmitting ? setUploadOpen(false) : undefined)} fullWidth maxWidth="sm">
        <DialogTitle>{credenciales?.existe ? 'Reemplazar credenciales SAT' : 'Subir credenciales SAT'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {uploadError && <Alert severity="error">{uploadError}</Alert>}
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
              Archivo .cer
              <input
                type="file"
                accept=".cer"
                hidden
                onChange={(event) => setCerFile(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="body2" sx={{ minWidth: 0, flex: 1 }} noWrap>
              {cerFile ? cerFile.name : 'Sin archivo .cer'}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
              Archivo .key
              <input
                type="file"
                accept=".key"
                hidden
                onChange={(event) => setKeyFile(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="body2" sx={{ minWidth: 0, flex: 1 }} noWrap>
              {keyFile ? keyFile.name : 'Sin archivo .key'}
            </Typography>
          </Stack>
          <Typography variant="caption" color="#6b7280">
            La contraseña de la e.firma no se solicita aquí; se pedirá más adelante, únicamente al momento de
            consultar o descargar CFDIs del SAT.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadOpen(false)} disabled={uploadSubmitting} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleUpload()}
            disabled={uploadSubmitting}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
          >
            {uploadSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => (!deleteSubmitting ? setDeleteOpen(false) : undefined)}>
        <DialogTitle>Eliminar credenciales SAT</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {deleteError && <Alert severity="error">{deleteError}</Alert>}
          <Typography variant="body2">
            ¿Confirmas eliminar las credenciales de e.firma cargadas para esta empresa? Tendrás que volver a
            subirlas para poder consultar CFDIs del SAT.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteSubmitting} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={deleteSubmitting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {deleteSubmitting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(accionDialog)} onClose={handleCerrarAccionDialog} fullWidth maxWidth="xs">
        <DialogTitle>
          {accionDialog?.accion === 'verificar' ? 'Verificar solicitud ante el SAT' : 'Descargar paquetes del SAT'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {accionError && <Alert severity="error">{accionError}</Alert>}
          {accionResultado && <Alert severity="success">{accionResultado}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Captura la contraseña de la e.firma para continuar. No se guarda: solo se usa en memoria durante esta
            acción.
          </Typography>
          <TextField
            label="Contraseña e.firma"
            type={showAccionPassword ? 'text' : 'password'}
            size="small"
            autoFocus
            value={accionPassword}
            onChange={(e) => setAccionPassword(e.target.value)}
            autoComplete="off"
            disabled={accionSubmitting}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={showAccionPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowAccionPassword((prev) => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showAccionPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCerrarAccionDialog} disabled={accionSubmitting} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmarAccion()}
            disabled={accionSubmitting}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
          >
            {accionSubmitting
              ? 'Procesando...'
              : accionDialog?.accion === 'verificar'
                ? 'Verificar'
                : 'Descargar'}
          </Button>
        </DialogActions>
      </Dialog>

      <PaquetesSolicitudDialog
        solicitudId={paquetesDialogSolicitudId}
        onClose={() => setPaquetesDialogSolicitudId(null)}
      />
    </Box>
  );
}
