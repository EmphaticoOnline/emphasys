import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { login } from "../services/authService";
import { useSession } from "../session/useSession";
import type { Empresa } from "../session/sessionTypes";
import { resolveRutaInicio } from "../utils/rutaInicio";
import { isCompassHostname } from "../routing/appHostname";
import compassColibriUrl from "../assets/emphasys-colibri-w.png";
import logo from "../assets/emphasys-w.png";
import { MAIN_NAV_TYPE } from "../theme/tokens";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/space-grotesk/500.css";
import "./login.css";

const humanist = MAIN_NAV_TYPE.fontFamily;

function EmphasysLogin({
  email,
  password,
  loading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const { frame, canvas, content, action } = useTheme().emphasys;

  const fieldSx = {
    "& .MuiInputLabel-root": {
      fontFamily: humanist,
      color: content.muted,
      "&.Mui-focused": { color: content.foreground },
    },
    "& .MuiOutlinedInput-root": {
      fontFamily: humanist,
      borderRadius: "8px",
      backgroundColor: content.elevated,
      "& fieldset": { borderColor: content.border },
      "&:hover fieldset": { borderColor: content.secondary },
      "&.Mui-focused fieldset": { borderColor: frame.background, borderWidth: 1 },
    },
    "& .MuiOutlinedInput-input": {
      fontFamily: humanist,
      fontSize: 15,
      color: content.foreground,
    },
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "grid",
        alignContent: { xs: "start", md: "stretch" },
        gridTemplateColumns: { xs: "1fr", md: "minmax(300px, 0.92fr) minmax(360px, 1.08fr)" },
        backgroundColor: canvas.page,
        color: content.foreground,
        fontFamily: humanist,
      }}
    >
      <Box
        sx={{
          backgroundColor: frame.background,
          color: frame.foreground,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: { xs: "flex-start", md: "flex-end" },
          alignItems: { xs: "center", md: "stretch" },
          px: { xs: 3, md: 6, lg: 8 },
          py: { xs: 4, md: 5, lg: 6 },
          minHeight: { md: "100dvh" },
        }}
      >
        <Box
          component="img"
          src={logo}
          alt="Emphasys"
          sx={{
            display: "block",
            width: { xs: "min(86%, 300px)", md: "87%" },
            height: "auto",
            alignSelf: { xs: "center", md: "auto" },
            position: { xs: "static", md: "absolute" },
            top: { md: "19%" },
            left: { md: "6.5%" },
          }}
        />
        <Box sx={{ display: { xs: "block", md: "none" }, width: 36, height: 2, mt: 2.5, backgroundColor: frame.accent, alignSelf: "center" }} />
        <Box sx={{ display: { xs: "none", md: "block" }, maxWidth: 440, pb: { md: 2, lg: 4 }, position: "relative" }}>
          <Box sx={{ width: 36, height: 2, mb: 3, backgroundColor: frame.accent }} />
          <Typography
            component="p"
            sx={{
              m: 0,
              fontFamily: humanist,
              fontWeight: 500,
              fontSize: { md: 36, lg: 42 },
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              color: frame.foreground,
            }}
          >
            La operación de tu empresa, reunida.
          </Typography>
          <Typography
            component="p"
            sx={{
              m: 0,
              mt: 2,
              maxWidth: 360,
              fontFamily: humanist,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              color: frame.muted,
            }}
          >
            Inicia sesión para continuar con tu espacio de trabajo.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 3, sm: 5, md: 6 },
          py: { xs: 5, md: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          <Typography
            component="p"
            sx={{
              m: 0,
              fontFamily: humanist,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: content.muted,
            }}
          >
            Acceso
          </Typography>
          <Typography
            component="h1"
            sx={{
              m: 0,
              mt: 1,
              fontFamily: humanist,
              fontWeight: 500,
              fontSize: { xs: 28, md: 32 },
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: content.foreground,
            }}
          >
            Iniciar sesión
          </Typography>
          <Typography
            component="p"
            sx={{
              m: 0,
              mt: 1,
              mb: 3.5,
              fontFamily: humanist,
              fontWeight: 400,
              fontSize: 15,
              lineHeight: 1.45,
              color: content.secondary,
            }}
          >
            Continúa con el correo de tu cuenta.
          </Typography>

          <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              autoComplete="email"
              fullWidth
              required
              sx={fieldSx}
            />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              autoComplete="current-password"
              fullWidth
              required
              sx={fieldSx}
            />
            {error && (
              <Typography role="alert" sx={{ fontFamily: humanist, fontSize: 13, lineHeight: 1.4, color: action.destructive }}>
                {error}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{
                mt: 0.5,
                minHeight: 44,
                borderRadius: "8px",
                boxShadow: "none",
                textTransform: "none",
                fontFamily: humanist,
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "0.01em",
                "&:hover": { boxShadow: "none" },
              }}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

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
    <EmphasysLogin
      email={email}
      password={password}
      loading={loading}
      error={error}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
