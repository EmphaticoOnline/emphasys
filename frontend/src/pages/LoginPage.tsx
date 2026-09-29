import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography, Stack } from "@mui/material";
import { login } from "../services/authService";
import { useSession } from "../session/useSession";
import type { Empresa } from "../session/sessionTypes";
import { resolveRutaInicio } from "../utils/rutaInicio";
import { isCompassHostname } from "../routing/appHostname";
import compassColibriUrl from "../assets/emphasys-colibri-w.png";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/space-grotesk/500.css";
import "./login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token, user, empresas } = await login(email, password);
      const empresasList: Empresa[] = empresas ?? [];
      const empresaActivaId = empresasList.length === 1 ? empresasList[0]?.id ?? null : null;

      setSession({
        token,
        user,
        empresas: empresasList,
        empresaActivaId,
        roles: [],
      });

      if (empresaActivaId) {
        navigate(await resolveRutaInicio({ token, user, empresas: empresasList, empresaActivaId, roles: [] }), { replace: true });
      } else {
        navigate("/seleccionar-empresa");
      }
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  if (isCompassHostname(window.location.hostname)) {
    return (
      <Box className="compass-login" component="main">
        <Box className="compass-login__card">
          <Box className="compass-login__brand">
            <Box
              aria-hidden="true"
              className="compass-login__mark"
              sx={{ maskImage: `url(${compassColibriUrl})`, WebkitMaskImage: `url(${compassColibriUrl})` }}
            />
            <Typography className="compass-login__wordmark">Compass</Typography>
          </Box>
          <Typography className="compass-login__title">Iniciar sesión</Typography>
          <Typography className="compass-login__intro">Continúa con tu espacio de trabajo.</Typography>
          <Box component="form" onSubmit={handleSubmit} noValidate className="compass-login__form">
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
            <TextField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required />
            {error && <Typography className="compass-login__error" role="alert">{error}</Typography>}
            <Button type="submit" variant="contained" fullWidth disabled={loading} className="compass-login__submit">
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 3, borderRadius: 2, boxShadow: 1 }}>
      <Typography variant="h5" mb={2} textAlign="center">
        Iniciar sesión
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
