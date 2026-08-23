import * as React from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useSession } from '../../session/useSession';
import {
  createCfdiPacConfig,
  fetchEmpresaCfdiPacAssignment,
  fetchCfdiPacConfigs,
  updateEmpresaCfdiPacAssignment,
  updateCfdiPacConfig,
  type CfdiPacConfig,
  type EmpresaCfdiPacAssignment,
} from '../../services/cfdiPacConfigService';

type CfdiPacCardMode = 'sandbox' | 'produccion';
type FormState = Record<CfdiPacCardMode, CfdiPacConfig>;
type MessageState = Record<CfdiPacCardMode, { error: string | null; success: string | null; saving: boolean; showPassword: boolean }>;

const CARD_MODES: CfdiPacCardMode[] = ['sandbox', 'produccion'];

function buildEmptyConfig(modo: CfdiPacCardMode, source?: Partial<CfdiPacConfig>): CfdiPacConfig {
  return {
    id: 0,
    pac: String(source?.pac ?? 'facturama'),
    modo,
    base_url: String(source?.base_url ?? ''),
    username: String(source?.username ?? ''),
    password: '',
    stamp_path: String(source?.stamp_path ?? ''),
    activo: Boolean(source?.activo ?? false),
    created_at: String(source?.created_at ?? ''),
    updated_at: String(source?.updated_at ?? ''),
    tiene_password: Boolean(source?.tiene_password),
  };
}

function validateConfig(config: CfdiPacConfig): string | null {
  if (!config.pac.trim()) return 'PAC es obligatorio';
  if (config.modo !== 'sandbox' && config.modo !== 'produccion') return 'Modo inválido';
  if (!config.base_url.trim()) return 'Base URL es obligatoria';
  if (!config.username.trim()) return 'Username es obligatorio';
  if (!config.stamp_path.trim()) return 'Stamp path es obligatorio';
  return null;
}

export default function CfdiPacConfigPage() {
  const { session } = useSession();
  const isSuperadmin = Boolean(session.user?.es_superadmin);
  const empresaActivaId = Number(session.empresaActivaId ?? 0);
  const empresaActivaNombre = session.empresas.find((empresa) => Number(empresa.id) === empresaActivaId)?.nombre ?? 'Empresa activa';

  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [configs, setConfigs] = React.useState<CfdiPacConfig[]>([]);
  const [assignment, setAssignment] = React.useState<EmpresaCfdiPacAssignment | null>(null);
  const [selectedConfigId, setSelectedConfigId] = React.useState<number | ''>('');
  const [assignmentSaving, setAssignmentSaving] = React.useState(false);
  const [assignmentError, setAssignmentError] = React.useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>({
    sandbox: buildEmptyConfig('sandbox'),
    produccion: buildEmptyConfig('produccion'),
  });
  const [messages, setMessages] = React.useState<MessageState>({
    sandbox: { error: null, success: null, saving: false, showPassword: false },
    produccion: { error: null, success: null, saving: false, showPassword: false },
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      if (!empresaActivaId) throw new Error('Selecciona una empresa activa para administrar su PAC CFDI.');
      const [data, currentAssignment] = await Promise.all([
        fetchCfdiPacConfigs(),
        fetchEmpresaCfdiPacAssignment(),
      ]);
      setConfigs(data);
      setAssignment(currentAssignment);
      setSelectedConfigId(currentAssignment?.cfdi_pac_config_id ?? '');
      const sandbox = data.find((item) => item.modo === 'sandbox');
      const produccion = data.find((item) => item.modo === 'produccion');
      const seed = sandbox ?? produccion;

      setForm({
        sandbox: sandbox ? { ...sandbox, password: '' } : buildEmptyConfig('sandbox', seed),
        produccion: produccion ? { ...produccion, password: '' } : buildEmptyConfig('produccion', seed),
      });
      setMessages({
        sandbox: { error: null, success: null, saving: false, showPassword: false },
        produccion: { error: null, success: null, saving: false, showPassword: false },
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'No se pudo cargar la configuración PAC CFDI');
    } finally {
      setLoading(false);
    }
  }, [empresaActivaId]);

  React.useEffect(() => {
    if (!isSuperadmin) return;
    void load();
  }, [isSuperadmin, load]);

  if (!isSuperadmin) {
    return <Navigate to="/configuracion" replace />;
  }

  const handleFieldChange = (modo: CfdiPacCardMode, field: keyof CfdiPacConfig, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [modo]: {
        ...prev[modo],
        [field]: value,
      },
    }));
    setMessages((prev) => ({
      ...prev,
      [modo]: { ...prev[modo], error: null, success: null },
    }));
  };

  const handleTogglePassword = (modo: CfdiPacCardMode) => {
    setMessages((prev) => ({
      ...prev,
      [modo]: { ...prev[modo], showPassword: !prev[modo]?.showPassword },
    }));
  };

  const handleSave = async (modo: CfdiPacCardMode) => {
    const current = form[modo];
    const validationError = validateConfig(current);
    if (validationError) {
      setMessages((prev) => ({
        ...prev,
        [modo]: { ...prev[modo], error: validationError, success: null },
      }));
      return;
    }

    if (!current.id && !current.password.trim()) {
      setMessages((prev) => ({
        ...prev,
        [modo]: { ...prev[modo], error: 'Password es obligatorio para crear la configuración', success: null },
      }));
      return;
    }

    setMessages((prev) => ({
      ...prev,
      [modo]: { ...prev[modo], saving: true, error: null, success: null },
    }));

    try {
      const payload = {
        pac: current.pac,
        modo: current.modo,
        base_url: current.base_url,
        username: current.username,
        password: current.password,
        stamp_path: current.stamp_path,
        activo: current.activo,
      };
      if (current.id) {
        await updateCfdiPacConfig(current.id, payload);
      } else {
        await createCfdiPacConfig(payload);
      }

      await load();
      setMessages((prev) => ({
        ...prev,
        [modo]: { ...prev[modo], saving: false, error: null, success: current.id ? 'Configuración guardada' : 'Configuración creada', showPassword: false },
      }));
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        [modo]: {
          ...prev[modo],
          saving: false,
          success: null,
          error: error instanceof Error ? error.message : 'No se pudo guardar la configuración',
        },
      }));
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedConfigId) {
      setAssignmentError('Selecciona una configuración PAC activa.');
      return;
    }
    setAssignmentSaving(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);
    try {
      const saved = await updateEmpresaCfdiPacAssignment(Number(selectedConfigId));
      setAssignment(saved);
      setSelectedConfigId(saved.cfdi_pac_config_id);
      setAssignmentSuccess('Configuración PAC asignada a la empresa activa.');
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'No se pudo guardar la asignación PAC.');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Configuración PAC CFDI
        </Typography>
        <Typography variant="body2" color="#4b5563">
          Administra los perfiles PAC reutilizables y asigna el ambiente CFDI correspondiente a cada empresa.
        </Typography>
      </Stack>

      {pageError && <Alert severity="error">{pageError}</Alert>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress size={30} />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#cbd5e1' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2.25}>
                <Stack spacing={0.4}>
                  <Typography variant="h6" fontWeight={700} color="#1d2f68">
                    PAC asignado a esta empresa
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {assignment?.empresa_nombre || empresaActivaNombre}
                  </Typography>
                </Stack>

                {assignmentError && <Alert severity="error">{assignmentError}</Alert>}
                {assignmentSuccess && <Alert severity="success">{assignmentSuccess}</Alert>}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
                  {[
                    ['Proveedor', assignment?.pac || '—'],
                    ['Ambiente', assignment?.modo === 'produccion' ? 'Producción' : assignment?.modo === 'sandbox' ? 'Sandbox' : '—'],
                    ['CSD registrado', assignment?.csd_registrado ? 'Sí' : 'No'],
                    ['Última actualización', formatDate(assignment?.csd_fecha_actualizacion)],
                  ].map(([label, value]) => (
                    <Box key={label}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="body1" fontWeight={700}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                  <TextField
                    select
                    label="Configuración PAC"
                    value={selectedConfigId}
                    onChange={(event) => {
                      setSelectedConfigId(Number(event.target.value));
                      setAssignmentError(null);
                      setAssignmentSuccess(null);
                    }}
                    size="small"
                    sx={{ minWidth: { md: 320 } }}
                  >
                    {configs.filter((config) => config.activo).map((config) => (
                      <MenuItem key={config.id} value={config.id}>
                        {config.pac} — {config.modo === 'produccion' ? 'Producción' : 'Sandbox'}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<SaveRoundedIcon />}
                    onClick={() => void handleSaveAssignment()}
                    disabled={assignmentSaving || !selectedConfigId || Number(selectedConfigId) === assignment?.cfdi_pac_config_id}
                    sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
                  >
                    {assignmentSaving ? 'Guardando...' : 'Guardar asignación'}
                  </Button>
                </Stack>

                <Alert severity="warning">
                  Cambiar la configuración PAC afectará futuros timbrados, registros de CSD y operaciones fiscales de esta empresa. Los CFDI ya emitidos conservan la configuración con la que fueron procesados.
                </Alert>
                {assignment && (
                  <Alert severity="info">
                    El CSD se registrará en: <strong>{assignment.pac} — {assignment.modo === 'produccion' ? 'Producción' : 'Sandbox'}</strong>. Cambiar el ambiente no registra el CSD automáticamente.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={0.4}>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">Perfiles PAC disponibles</Typography>
            <Typography variant="body2" color="text.secondary">Activo significa que el perfil está disponible para asignarse a una empresa.</Typography>
          </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {CARD_MODES.map((modo) => {
            const current = form[modo];
            const state = messages[modo];
            const exists = Boolean(current?.id);
            const isActive = Boolean(current?.activo);

            return (
              <Card
                key={modo}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderColor: isActive ? '#1d4ed8' : '#dbe3f0',
                  backgroundColor: isActive ? '#f8fbff' : '#ffffff',
                  boxShadow: isActive ? '0 0 0 1px rgba(29, 78, 216, 0.08)' : 'none',
                  opacity: isActive ? 1 : 0.92,
                }}
              >
                <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                    <Stack spacing={0.5}>
                      <Typography variant="h6" fontWeight={700} color="#1d2f68">
                        {modo === 'sandbox' ? 'Sandbox' : 'Producción'}
                      </Typography>
                      <Typography variant="body2" color="#4b5563">
                        {exists ? `Configuración actual para el modo ${modo}.` : `Aún no existe configuración para el modo ${modo}.`}
                      </Typography>
                    </Stack>
                    <Chip
                      label={isActive ? 'ACTIVO' : 'INACTIVO'}
                      size="small"
                      color={isActive ? 'success' : 'default'}
                      variant={isActive ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700, mt: 0.25 }}
                    />
                  </Stack>

                  {state?.success && <Alert severity="success">{state.success}</Alert>}
                  {state?.error && <Alert severity="error">{state.error}</Alert>}

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2,
                    }}
                  >
                    <TextField
                      label="Base URL"
                      value={current?.base_url ?? ''}
                      onChange={(e) => handleFieldChange(modo, 'base_url', e.target.value)}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Username"
                      value={current?.username ?? ''}
                      onChange={(e) => handleFieldChange(modo, 'username', e.target.value)}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Password"
                      type={state?.showPassword ? 'text' : 'password'}
                      value={current?.password ?? ''}
                      onChange={(e) => handleFieldChange(modo, 'password', e.target.value)}
                      size="small"
                      fullWidth
                      placeholder={current?.tiene_password ? 'Dejar vacío para conservar' : 'Captura el password'}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              aria-label={state?.showPassword ? 'Ocultar password' : 'Mostrar password'}
                              onClick={() => handleTogglePassword(modo)}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {state?.showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      helperText={current?.tiene_password ? 'Existe un password guardado. Solo escribe uno nuevo si deseas cambiarlo.' : 'Sin password registrado.'}
                    />
                    <TextField
                      label="Stamp path"
                      value={current?.stamp_path ?? ''}
                      onChange={(e) => handleFieldChange(modo, 'stamp_path', e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <FormControlLabel
                        control={<Switch checked={Boolean(current?.activo)} onChange={(e) => handleFieldChange(modo, 'activo', e.target.checked)} />}
                        label="Activo"
                      />
                      <Typography variant="caption" color="#6b7280" sx={{ pl: { xs: 0, sm: 1 } }}>
                        Activo indica que este perfil está disponible. Sandbox y Producción pueden permanecer activos simultáneamente.
                      </Typography>
                    </Stack>
                    <Button
                      variant="contained"
                      startIcon={<SaveRoundedIcon />}
                      onClick={() => void handleSave(modo)}
                      disabled={Boolean(state?.saving)}
                      sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
                    >
                      {state?.saving ? 'Guardando...' : exists ? 'Guardar cambios' : 'Crear configuración'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
        </Stack>
      )}
    </Box>
  );
}
