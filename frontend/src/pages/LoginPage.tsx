import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography, Stack } from "@mui/material";
import { login } from "../services/authService";
import { useSession } from "../session/useSession";
import type { Empresa } from "../session/sessionTypes";

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
      });

      if (empresaActivaId) {
        navigate("/");
      } else {
        navigate("/seleccionar-empresa");
      }
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

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
