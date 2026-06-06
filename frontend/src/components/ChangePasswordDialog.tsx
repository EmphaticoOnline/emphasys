import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { cambiarPassword } from '../services/authService';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordDialog({ open, onClose }: Props) {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetState = () => {
    setPasswordActual('');
    setPasswordNueva('');
    setPasswordConfirmar('');
    setShowActual(false);
    setShowNueva(false);
    setShowConfirmar(false);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordActual || !passwordNueva || !passwordConfirmar) {
      setError('Todos los campos son requeridos');
      return;
    }
    if (passwordNueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (passwordNueva !== passwordConfirmar) {
      setError('La nueva contraseña y su confirmación no coinciden');
      return;
    }
    if (passwordNueva === passwordActual) {
      setError('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setLoading(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      setSuccess(true);
      setTimeout(() => {
        resetState();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar contraseña</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          {success ? (
            <Alert severity="success">Contraseña actualizada correctamente</Alert>
          ) : (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Contraseña actual"
                type={showActual ? 'text' : 'password'}
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                fullWidth
                required
                disabled={loading}
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowActual((v) => !v)} edge="end" tabIndex={-1}>
                        {showActual ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Nueva contraseña"
                type={showNueva ? 'text' : 'password'}
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                fullWidth
                required
                disabled={loading}
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowNueva((v) => !v)} edge="end" tabIndex={-1}>
                        {showNueva ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirmar nueva contraseña"
                type={showConfirmar ? 'text' : 'password'}
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                fullWidth
                required
                disabled={loading}
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirmar((v) => !v)} edge="end" tabIndex={-1}>
                        {showConfirmar ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          )}
        </DialogContent>
        {!success && (
          <DialogActions>
            <Button onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </Button>
          </DialogActions>
        )}
      </Box>
    </Dialog>
  );
}
