import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import {
  actualizarCfdiSatAutomatizacion,
  ejecutarCfdiSatAutomatizacion,
  fetchCfdiSatAutomatizacion,
  type CfdiSatAutomatizacion,
  type CfdiSatEjecucionAutomatizacion,
} from '../../services/cfdiSatService';

function formatFecha(raw?: string | null): string {
  if (!raw) return 'Nunca';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-MX');
}

export default function AutomatizacionSatSection({
  puedeAdministrar,
  onEjecutado,
}: {
  puedeAdministrar: boolean;
  /** Se llama tras una ejecución exitosa para que la página refresque solicitudes/resumen/comprobantes/bitácora. */
  onEjecutado?: () => void;
}) {
  const [config, setConfig] = React.useState<CfdiSatAutomatizacion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [autoVerificar, setAutoVerificar] = React.useState(false);
  const [autoDescargar, setAutoDescargar] = React.useState(false);
  const [frecuenciaMinutos, setFrecuenciaMinutos] = React.useState(60);
  const [guardando, setGuardando] = React.useState(false);
  const [guardadoOk, setGuardadoOk] = React.useState(false);

  const [ejecutarOpen, setEjecutarOpen] = React.useState(false);
  const [ejecutarPassword, setEjecutarPassword] = React.useState('');
  const [showEjecutarPassword, setShowEjecutarPassword] = React.useState(false);
  const [ejecutando, setEjecutando] = React.useState(false);
  const [ejecutarError, setEjecutarError] = React.useState<string | null>(null);
  const [ejecutarResultado, setEjecutarResultado] = React.useState<CfdiSatEjecucionAutomatizacion | null>(null);

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCfdiSatAutomatizacion();
      setConfig(data);
      setAutoVerificar(data.auto_verificar);
      setAutoDescargar(data.auto_descargar);
      setFrecuenciaMinutos(data.frecuencia_minutos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración de automatización');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const hayCambios =
    config != null &&
    (autoVerificar !== config.auto_verificar ||
      autoDescargar !== config.auto_descargar ||
      frecuenciaMinutos !== config.frecuencia_minutos);

  const handleGuardar = async () => {
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    try {
      const actualizado = await actualizarCfdiSatAutomatizacion({
        auto_verificar: autoVerificar,
        auto_descargar: autoDescargar,
        frecuencia_minutos: frecuenciaMinutos,
      });
      setConfig(actualizado);
      setGuardadoOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración');
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirEjecutar = () => {
    setEjecutarPassword('');
    setShowEjecutarPassword(false);
    setEjecutarError(null);
    setEjecutarResultado(null);
    setEjecutarOpen(true);
  };

  const handleCerrarEjecutar = () => {
    if (ejecutando) return;
    setEjecutarOpen(false);
  };

  const handleEjecutar = async () => {
    if (!ejecutarPassword) {
      setEjecutarError('Captura la contraseña de la e.firma');
      return;
    }

    setEjecutando(true);
    setEjecutarError(null);
    setEjecutarResultado(null);
    try {
      const resultado = await ejecutarCfdiSatAutomatizacion(ejecutarPassword);
      setEjecutarResultado(resultado);
      const actualizado = await fetchCfdiSatAutomatizacion();
      setConfig(actualizado);
      onEjecutado?.();
    } catch (err) {
      setEjecutarError(err instanceof Error ? err.message : 'No se pudo ejecutar la automatización');
    } finally {
      setEjecutando(false);
      setEjecutarPassword('');
    }
  };

  const automatizacionActiva = Boolean(config?.auto_verificar || config?.auto_descargar);
  const minutosDesdeUltimoRun = config?.ultimo_run_en
    ? Math.floor((Date.now() - new Date(config.ultimo_run_en).getTime()) / 60_000)
    : null;
  const pendienteDeCorrer =
    automatizacionActiva &&
    config != null &&
    (minutosDesdeUltimoRun === null || minutosDesdeUltimoRun >= config.frecuencia_minutos);

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={700} color="#1d2f68">
            Automatización
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Reduce el trabajo manual de verificar y descargar solicitudes del SAT.
          </Typography>
        </Stack>

        <Alert severity="info">
          Por seguridad, Emphasys no guarda la contraseña de la FIEL. El Servicio de Descarga Masiva del SAT
          exige firmar cada verificación y cada descarga con la e.firma, así que no es posible dejar esto
          corriendo solo, sin nadie presente. En su lugar, cuando actives las opciones de abajo, un
          administrador puede ejecutar la automatización cuando quiera capturando la contraseña una sola vez:
          esa ejecución verificará y/o descargará <strong>todas</strong> las solicitudes elegibles de la
          empresa de un solo paso, en vez de tener que hacerlo solicitud por solicitud.
        </Alert>

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={26} />
          </Stack>
        ) : (
          <>
            {pendienteDeCorrer && (
              <Alert severity="warning">
                Han pasado {minutosDesdeUltimoRun === null ? 'más de' : minutosDesdeUltimoRun} minutos desde la
                última ejecución (frecuencia configurada: {config?.frecuencia_minutos} min). Considera ejecutar
                la automatización ahora.
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoVerificar}
                    onChange={(e) => setAutoVerificar(e.target.checked)}
                    disabled={!puedeAdministrar}
                  />
                }
                label="Verificación asistida"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={autoDescargar}
                    onChange={(e) => setAutoDescargar(e.target.checked)}
                    disabled={!puedeAdministrar}
                  />
                }
                label="Descarga asistida"
              />
            </Stack>

            <TextField
              label="Frecuencia sugerida (minutos)"
              type="number"
              size="small"
              value={frecuenciaMinutos}
              onChange={(e) => setFrecuenciaMinutos(Number(e.target.value))}
              disabled={!puedeAdministrar}
              inputProps={{ min: 15, max: 1440 }}
              helperText="Solo es un recordatorio visual (15 a 1440 minutos); no dispara nada por sí sola."
              sx={{ maxWidth: 320 }}
            />

            <Typography variant="body2" color="text.secondary">
              Última ejecución: <strong>{formatFecha(config?.ultimo_run_en)}</strong>
            </Typography>

            {!puedeAdministrar && (
              <Typography variant="caption" color="#6b7280">
                Solo un administrador de la empresa puede cambiar esta configuración o ejecutar la automatización.
              </Typography>
            )}

            {guardadoOk && !hayCambios && <Alert severity="success">Configuración guardada.</Alert>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={() => void handleGuardar()}
                disabled={!puedeAdministrar || guardando || !hayCambios}
                sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
              >
                {guardando ? 'Guardando...' : 'Guardar configuración'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleAbrirEjecutar}
                disabled={!puedeAdministrar || !automatizacionActiva}
                sx={{ textTransform: 'none' }}
              >
                Ejecutar automatización ahora
              </Button>
            </Stack>
          </>
        )}
      </CardContent>

      <Dialog open={ejecutarOpen} onClose={handleCerrarEjecutar} fullWidth maxWidth="sm">
        <DialogTitle>Ejecutar automatización ahora</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {ejecutarError && <Alert severity="error">{ejecutarError}</Alert>}

          {ejecutarResultado ? (
            <Alert severity="success">
              Solicitudes verificadas: {ejecutarResultado.solicitudesVerificadas} (con error:{' '}
              {ejecutarResultado.solicitudesConErrorVerificacion}). Solicitudes descargadas:{' '}
              {ejecutarResultado.solicitudesDescargadas}. Comprobantes nuevos:{' '}
              {ejecutarResultado.comprobantesNuevos}. Paquetes con error: {ejecutarResultado.paquetesConError}.
              {ejecutarResultado.mensajes.length > 0 && (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {ejecutarResultado.mensajes.map((mensaje, index) => (
                    <li key={index}>
                      <Typography variant="caption">{mensaje}</Typography>
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Captura la contraseña de la e.firma para procesar de una vez todas las solicitudes elegibles de
              esta empresa según lo activado arriba. La contraseña no se guarda: solo se usa en memoria durante
              esta ejecución.
            </Typography>
          )}

          <TextField
            label="Contraseña e.firma"
            type={showEjecutarPassword ? 'text' : 'password'}
            size="small"
            autoFocus
            value={ejecutarPassword}
            onChange={(e) => setEjecutarPassword(e.target.value)}
            autoComplete="off"
            disabled={ejecutando}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={showEjecutarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowEjecutarPassword((prev) => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showEjecutarPassword ? (
                      <VisibilityOffRoundedIcon fontSize="small" />
                    ) : (
                      <VisibilityRoundedIcon fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCerrarEjecutar} disabled={ejecutando} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleEjecutar()}
            disabled={ejecutando}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
          >
            {ejecutando ? 'Ejecutando...' : 'Ejecutar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
