import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useSession } from '../../session/useSession';
import { fetchUsuarios } from '../../services/usuariosService';
import {
  fetchConfiguracionCorreoEmpresa,
  fetchConfiguracionCorreoUsuario,
  guardarConfiguracionCorreoEmpresa,
  guardarConfiguracionCorreoUsuario,
  probarConfiguracionCorreo,
} from '../../services/configuracionCorreoService';
import type { ConfiguracionCorreo } from '../../services/configuracionCorreoService';
import type { Usuario } from '../../types/usuario';

type FormState = ConfiguracionCorreo & {
  test_to: string;
};

type FormErrors = Partial<Record<'smtp_host' | 'smtp_port' | 'smtp_user', string>>;

const emptyForm = (): FormState => ({
  smtp_host: '',
  smtp_port: '',
  smtp_user: '',
  smtp_password: '',
  smtp_secure: false,
  email_remitente: '',
  nombre_remitente: '',
  activo: true,
  test_to: '',
});

function mapConfigToForm(config: Partial<ConfiguracionCorreo> | null | undefined): FormState {
  const base = emptyForm();
  if (!config) return base;
  return {
    ...base,
    ...config,
    smtp_port: config.smtp_port !== undefined && config.smtp_port !== null ? String(config.smtp_port) : '',
    smtp_password: '',
  };
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.smtp_host.trim()) errors.smtp_host = 'smtp_host es requerido';
  if (!form.smtp_port.trim()) errors.smtp_port = 'smtp_port es requerido';
  if (!form.smtp_user.trim()) errors.smtp_user = 'smtp_user es requerido';
  return errors;
}

function buildPayload(form: FormState, includePassword: boolean) {
  const payload: Partial<ConfiguracionCorreo> = {
    smtp_host: form.smtp_host.trim(),
    smtp_port: form.smtp_port.trim(),
    smtp_user: form.smtp_user.trim(),
    smtp_secure: form.smtp_secure,
    email_remitente: form.email_remitente.trim(),
    nombre_remitente: form.nombre_remitente.trim(),
    activo: form.activo,
  };

  if (includePassword) {
    payload.smtp_password = form.smtp_password;
  }

  return payload;
}

type SectionProps = {
  title: string;
  description: string;
  form: FormState;
  errors: FormErrors;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  fieldsDisabled?: boolean;
  actionsDisabled?: boolean;
  success: string | null;
  error: string | null;
  passwordHint?: string | null;
  passwordVisible: boolean;
  extraHeader?: React.ReactNode;
  onChange: (field: keyof FormState, value: string | boolean) => void;
  onTogglePasswordVisibility: () => void;
  onSave: () => void;
  onTest: () => void;
};

function ConfiguracionCorreoSection({
  title,
  description,
  form,
  errors,
  loading,
  saving,
  testing,
  fieldsDisabled = false,
  actionsDisabled = false,
  success,
  error,
  passwordHint,
  passwordVisible,
  extraHeader,
  onChange,
  onTogglePasswordVisibility,
  onSave,
  onTest,
}: SectionProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#dbe3f0' }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Stack spacing={0.75}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Box>
              <Typography variant="h6" fontWeight={700} color="#1d2f68">
                {title}
              </Typography>
              <Typography variant="body2" color="#4b5563">
                {description}
              </Typography>
            </Box>
            {extraHeader}
          </Stack>

          {success && <Alert severity="success">{success}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2.25}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                label="SMTP Host"
                value={form.smtp_host}
                onChange={(e) => onChange('smtp_host', e.target.value)}
                required
                fullWidth
                disabled={fieldsDisabled}
                error={Boolean(errors.smtp_host)}
                helperText={errors.smtp_host}
                size="small"
              />
              <TextField
                label="SMTP Port"
                value={form.smtp_port}
                onChange={(e) => onChange('smtp_port', e.target.value)}
                required
                fullWidth
                disabled={fieldsDisabled}
                error={Boolean(errors.smtp_port)}
                helperText={errors.smtp_port}
                size="small"
              />
              <TextField
                label="SMTP User"
                value={form.smtp_user}
                onChange={(e) => onChange('smtp_user', e.target.value)}
                required
                fullWidth
                disabled={fieldsDisabled}
                error={Boolean(errors.smtp_user)}
                helperText={errors.smtp_user}
                size="small"
              />
              <Box>
                <TextField
                  label="SMTP Password"
                  type={passwordVisible ? 'text' : 'password'}
                  value={form.smtp_password}
                  onChange={(e) => onChange('smtp_password', e.target.value)}
                  fullWidth
                  disabled={fieldsDisabled}
                  size="small"
                  autoComplete="new-password"
                  placeholder={passwordHint ? 'Escribe un nuevo password solo si deseas cambiarlo' : ''}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={passwordVisible ? 'Ocultar password SMTP' : 'Mostrar password SMTP'}
                          onClick={onTogglePasswordVisibility}
                          onMouseDown={(e) => e.preventDefault()}
                          disabled={fieldsDisabled}
                        >
                          {passwordVisible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <FormHelperText>
                  {form.smtp_password
                    ? 'Password capturado. Se conservará visible hasta guardar.'
                    : passwordHint || 'Password configurado (no visible por seguridad)'}
                </FormHelperText>
              </Box>
              <TextField
                label="Email remitente"
                value={form.email_remitente}
                onChange={(e) => onChange('email_remitente', e.target.value)}
                fullWidth
                disabled={fieldsDisabled}
                size="small"
              />
              <TextField
                label="Nombre remitente"
                value={form.nombre_remitente}
                onChange={(e) => onChange('nombre_remitente', e.target.value)}
                fullWidth
                disabled={fieldsDisabled}
                size="small"
              />
              <TextField
                label="Correo de prueba"
                value={form.test_to}
                onChange={(e) => onChange('test_to', e.target.value)}
                fullWidth
                disabled={actionsDisabled}
                size="small"
              />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent={{ xs: 'flex-start', md: 'space-between' }}
                spacing={2}
                sx={{ minHeight: 40 }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.smtp_secure}
                      onChange={(e) => onChange('smtp_secure', e.target.checked)}
                      disabled={fieldsDisabled}
                    />
                  }
                  label="Conexión segura"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.activo}
                      onChange={(e) => onChange('activo', e.target.checked)}
                      disabled={fieldsDisabled}
                    />
                  }
                  label="Activo"
                />
              </Stack>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                variant="contained"
                startIcon={<SaveRoundedIcon />}
                onClick={onSave}
                disabled={actionsDisabled || saving || loading}
                sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
              >
                Guardar
              </Button>
              <Button
                variant="outlined"
                startIcon={<MarkEmailReadRoundedIcon />}
                onClick={onTest}
                disabled={actionsDisabled || testing || loading}
                sx={{ textTransform: 'none' }}
              >
                Probar conexión
              </Button>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConfiguracionCorreoPage() {
  const { session } = useSession();
  const [loading, setLoading] = React.useState(true);
  const [empresaForm, setEmpresaForm] = React.useState<FormState>(emptyForm);
  const [usuarioForm, setUsuarioForm] = React.useState<FormState>(emptyForm);
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
  const [selectedUsuarioId, setSelectedUsuarioId] = React.useState<number | ''>('');
  const [usaConfiguracionPersonalizada, setUsaConfiguracionPersonalizada] = React.useState(false);
  const [empresaHasPassword, setEmpresaHasPassword] = React.useState(false);
  const [usuarioHasPassword, setUsuarioHasPassword] = React.useState(false);
  const [empresaSaving, setEmpresaSaving] = React.useState(false);
  const [usuarioSaving, setUsuarioSaving] = React.useState(false);
  const [empresaTesting, setEmpresaTesting] = React.useState(false);
  const [usuarioTesting, setUsuarioTesting] = React.useState(false);
  const [empresaPasswordVisible, setEmpresaPasswordVisible] = React.useState(false);
  const [usuarioPasswordVisible, setUsuarioPasswordVisible] = React.useState(false);
  const [empresaSuccess, setEmpresaSuccess] = React.useState<string | null>(null);
  const [usuarioSuccess, setUsuarioSuccess] = React.useState<string | null>(null);
  const [empresaError, setEmpresaError] = React.useState<string | null>(null);
  const [usuarioError, setUsuarioError] = React.useState<string | null>(null);
  const [empresaErrors, setEmpresaErrors] = React.useState<FormErrors>({});
  const [usuarioErrors, setUsuarioErrors] = React.useState<FormErrors>({});

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setEmpresaError(null);
    setUsuarioError(null);
    try {
      const [empresaResp, usuariosResp] = await Promise.all([
        fetchConfiguracionCorreoEmpresa(),
        fetchUsuarios(),
      ]);

      setEmpresaForm(mapConfigToForm(empresaResp.configuracion));
      setEmpresaHasPassword(Boolean(empresaResp.configuracion?.tiene_password));
      setEmpresaPasswordVisible(false);
      setUsuarios(
        usuariosResp
          .filter((usuario) => usuario.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }))
      );
      setUsuarioForm(emptyForm());
      setUsuarioHasPassword(false);
      setUsuarioPasswordVisible(false);
      setUsaConfiguracionPersonalizada(false);
      setEmpresaErrors({});
      setUsuarioErrors({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la configuración de correo';
      setEmpresaError(message);
      setUsuarioError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData, session.empresaActivaId]);

  React.useEffect(() => {
    const loadUsuarioConfig = async () => {
      setUsuarioError(null);
      setUsuarioSuccess(null);
      setUsuarioErrors({});

      if (!selectedUsuarioId) {
        setUsuarioForm(emptyForm());
        setUsuarioHasPassword(false);
        setUsuarioPasswordVisible(false);
        setUsaConfiguracionPersonalizada(false);
        return;
      }

      setLoading(true);
      try {
        const usuarioResp = await fetchConfiguracionCorreoUsuario(Number(selectedUsuarioId));
        setUsuarioForm(mapConfigToForm(usuarioResp.configuracion));
        setUsuarioHasPassword(Boolean(usuarioResp.configuracion?.tiene_password));
        setUsuarioPasswordVisible(false);
        setUsaConfiguracionPersonalizada(Boolean(usuarioResp.configuracion?.activo));
      } catch (error) {
        setUsuarioError(error instanceof Error ? error.message : 'No se pudo cargar la configuración del usuario');
        setUsuarioForm(emptyForm());
        setUsuarioHasPassword(false);
        setUsuarioPasswordVisible(false);
        setUsaConfiguracionPersonalizada(false);
      } finally {
        setLoading(false);
      }
    };

    void loadUsuarioConfig();
  }, [selectedUsuarioId]);

  const updateEmpresaField = React.useCallback((field: keyof FormState, value: string | boolean) => {
    setEmpresaForm((prev) => ({ ...prev, [field]: value }));
    setEmpresaSuccess(null);
    setEmpresaError(null);
    if (field === 'smtp_host' || field === 'smtp_port' || field === 'smtp_user') {
      setEmpresaErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, []);

  const updateUsuarioField = React.useCallback((field: keyof FormState, value: string | boolean) => {
    setUsuarioForm((prev) => ({ ...prev, [field]: value }));
    setUsuarioSuccess(null);
    setUsuarioError(null);
    if (field === 'smtp_host' || field === 'smtp_port' || field === 'smtp_user') {
      setUsuarioErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, []);

  const handleSaveEmpresa = React.useCallback(async () => {
    const errors = validateForm(empresaForm);
    setEmpresaErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEmpresaSaving(true);
    setEmpresaError(null);
    setEmpresaSuccess(null);
    try {
      const payload = buildPayload(empresaForm, true);
      console.log('[SMTP SAVE][frontend][empresa] payload', {
        smtp_password_present: Boolean(payload.smtp_password),
        smtp_password_length: payload.smtp_password?.length ?? 0,
        smtp_user: payload.smtp_user,
      });
      await guardarConfiguracionCorreoEmpresa(payload);
      setEmpresaSuccess('Configuración de empresa guardada correctamente');
      await loadData();
    } catch (error) {
      setEmpresaError(error instanceof Error ? error.message : 'No se pudo guardar la configuración de empresa');
    } finally {
      setEmpresaSaving(false);
    }
  }, [empresaForm, loadData]);

  const handleSaveUsuario = React.useCallback(async () => {
    if (!selectedUsuarioId) {
      setUsuarioError('Selecciona un usuario para configurar SMTP');
      return;
    }

    if (!usaConfiguracionPersonalizada) {
      if (!usuarioForm.smtp_host && !usuarioForm.smtp_port && !usuarioForm.smtp_user) {
        setUsuarioSuccess('La cuenta usará la configuración SMTP de empresa');
        setUsuarioError(null);
        return;
      }
    }

    const nextForm = { ...usuarioForm, activo: usaConfiguracionPersonalizada };
    const errors = validateForm(nextForm);
    setUsuarioErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setUsuarioSaving(true);
    setUsuarioError(null);
    setUsuarioSuccess(null);
    try {
      const payload = {
        ...buildPayload(nextForm, true),
        usuario_id: Number(selectedUsuarioId),
      };
      console.log('[SMTP SAVE][frontend][usuario] payload', {
        usuario_id: payload.usuario_id,
        smtp_password_present: Boolean(payload.smtp_password),
        smtp_password_length: payload.smtp_password?.length ?? 0,
        smtp_user: payload.smtp_user,
      });
      await guardarConfiguracionCorreoUsuario(payload);
      setUsuarioSuccess(
        usaConfiguracionPersonalizada
          ? 'Configuración de usuario guardada correctamente'
          : 'Configuración personalizada desactivada; se usará la de empresa'
      );
      const usuarioResp = await fetchConfiguracionCorreoUsuario(Number(selectedUsuarioId));
      setUsuarioForm(mapConfigToForm(usuarioResp.configuracion));
      setUsuarioHasPassword(Boolean(usuarioResp.configuracion?.tiene_password));
      setUsuarioPasswordVisible(false);
      setUsaConfiguracionPersonalizada(Boolean(usuarioResp.configuracion?.activo));
    } catch (error) {
      setUsuarioError(error instanceof Error ? error.message : 'No se pudo guardar la configuración de usuario');
    } finally {
      setUsuarioSaving(false);
    }
  }, [selectedUsuarioId, usaConfiguracionPersonalizada, usuarioForm]);

  const handleTestEmpresa = React.useCallback(async () => {
    const errors = validateForm(empresaForm);
    setEmpresaErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEmpresaTesting(true);
    setEmpresaError(null);
    setEmpresaSuccess(null);
    try {
      const result = await probarConfiguracionCorreo({
        ...buildPayload(empresaForm, true),
        scope: 'empresa',
        to: empresaForm.test_to.trim() || undefined,
      });
      setEmpresaSuccess(result.message);
    } catch (error) {
      setEmpresaError(error instanceof Error ? error.message : 'No se pudo probar la conexión SMTP de empresa');
    } finally {
      setEmpresaTesting(false);
    }
  }, [empresaForm]);

  const handleTestUsuario = React.useCallback(async () => {
    if (!selectedUsuarioId) {
      setUsuarioError('Selecciona un usuario para probar la configuración SMTP');
      return;
    }

    if (!usaConfiguracionPersonalizada) {
      setUsuarioTesting(true);
      setUsuarioError(null);
      setUsuarioSuccess(null);
      try {
        const result = await probarConfiguracionCorreo({
          scope: 'empresa',
          to: usuarioForm.test_to.trim() || undefined,
        });
        setUsuarioSuccess(`Usando configuración de empresa: ${result.message}`);
      } catch (error) {
        setUsuarioError(error instanceof Error ? error.message : 'No se pudo probar la conexión SMTP');
      } finally {
        setUsuarioTesting(false);
      }
      return;
    }

    const nextForm = { ...usuarioForm, activo: true };
    const errors = validateForm(nextForm);
    setUsuarioErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setUsuarioTesting(true);
    setUsuarioError(null);
    setUsuarioSuccess(null);
    try {
      const result = await probarConfiguracionCorreo({
        ...buildPayload(nextForm, true),
        scope: 'usuario',
        usuario_id: Number(selectedUsuarioId),
        to: usuarioForm.test_to.trim() || undefined,
      });
      setUsuarioSuccess(result.message);
    } catch (error) {
      setUsuarioError(error instanceof Error ? error.message : 'No se pudo probar la conexión SMTP de usuario');
    } finally {
      setUsuarioTesting(false);
    }
  }, [selectedUsuarioId, usaConfiguracionPersonalizada, usuarioForm]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      <Stack spacing={0.75}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Configuración de correo SMTP
        </Typography>
        <Typography variant="body2" color="#4b5563">
          Configura el envío de correos por empresa y, si aplica, define una configuración personalizada para tu usuario.
        </Typography>
      </Stack>

      <ConfiguracionCorreoSection
        title="Configuración Empresa"
        description="Esta configuración funciona como base para la empresa activa."
        form={empresaForm}
        errors={empresaErrors}
        loading={loading}
        saving={empresaSaving}
        testing={empresaTesting}
        fieldsDisabled={false}
        actionsDisabled={false}
        success={empresaSuccess}
        error={empresaError}
        passwordHint={empresaHasPassword ? 'Password configurado (no visible por seguridad)' : null}
        passwordVisible={empresaPasswordVisible}
        onChange={updateEmpresaField}
        onTogglePasswordVisibility={() => setEmpresaPasswordVisible((prev) => !prev)}
        onSave={handleSaveEmpresa}
        onTest={handleTestEmpresa}
      />

      <ConfiguracionCorreoSection
        title="Configuración Usuario"
        description="Selecciona un usuario. Si activas la personalización, su configuración tendrá prioridad sobre la de empresa."
        form={usuarioForm}
        errors={usuarioErrors}
        loading={loading}
        saving={usuarioSaving}
        testing={usuarioTesting}
        fieldsDisabled={!selectedUsuarioId || !usaConfiguracionPersonalizada}
        actionsDisabled={!selectedUsuarioId}
        success={usuarioSuccess}
        error={usuarioError}
        passwordHint={usuarioHasPassword ? 'Password configurado (no visible por seguridad)' : null}
        passwordVisible={usuarioPasswordVisible}
        extraHeader={
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 280 } }}>
              <InputLabel id="smtp-usuario-select-label">Usuario</InputLabel>
              <Select
                labelId="smtp-usuario-select-label"
                label="Usuario"
                value={selectedUsuarioId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedUsuarioId(value === '' ? '' : Number(value));
                }}
              >
                <MenuItem value="">
                  <em>Selecciona un usuario</em>
                </MenuItem>
                {usuarios.map((usuario) => (
                  <MenuItem key={usuario.id} value={usuario.id}>
                    {usuario.nombre} ({usuario.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={usaConfiguracionPersonalizada}
                  disabled={!selectedUsuarioId}
                  onChange={(e) => {
                    setUsaConfiguracionPersonalizada(e.target.checked);
                    setUsuarioForm((prev) => ({ ...prev, activo: e.target.checked }));
                    setUsuarioSuccess(null);
                    setUsuarioError(null);
                  }}
                />
              }
              label="Usar configuración personalizada"
            />
          </Stack>
        }
        onChange={updateUsuarioField}
        onTogglePasswordVisibility={() => setUsuarioPasswordVisible((prev) => !prev)}
        onSave={handleSaveUsuario}
        onTest={handleTestUsuario}
      />

      <Alert severity="info" icon={<AlternateEmailRoundedIcon fontSize="inherit" />}>
        Si no activas la configuración personalizada, el envío de correos usará la configuración SMTP de empresa.
      </Alert>
    </Box>
  );
}