import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, List, ListItemButton, ListItemText, Card, CardActionArea } from "@mui/material";
import { useSession } from "../session/useSession";
import type { Empresa } from "../session/sessionTypes";
import { resolveRutaInicio } from "../utils/rutaInicio";

export default function SeleccionEmpresaPage() {
  const navigate = useNavigate();
  const { session, setSession } = useSession();

  const empresas: Empresa[] = session.empresas ?? [];

  useEffect(() => {
    if (!session.token) {
      navigate("/login", { replace: true });
      return;
    }

    if (empresas.length === 1) {
      const unica = empresas[0];
      if (unica) {
        const nextSession = { ...session, empresaActivaId: unica.id };
        setSession(nextSession);
        void (async () => {
          navigate(await resolveRutaInicio(nextSession), { replace: true });
        })();
      }
    }
  }, [session, empresas, navigate, setSession]);

  const handleSelect = (empresa: Empresa) => {
    const nextSession = { ...session, empresaActivaId: empresa.id };
    setSession(nextSession);
    void (async () => {
      navigate(await resolveRutaInicio(nextSession), { replace: true });
    })();
  };

  if (!session.token) return null;

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", mt: 8, p: 3 }}>
      <Typography variant="h5" mb={2} textAlign="center">
        Selecciona la empresa con la que deseas trabajar
      </Typography>

      {empresas.length === 0 && (
        <Typography color="text.secondary" textAlign="center">
          No hay empresas disponibles.
        </Typography>
      )}

      {empresas.length > 0 && (
        <Card variant="outlined">
          <List disablePadding>
            {empresas.map((empresa, idx) => (
              <ListItemButton
                key={empresa.id}
                divider={idx < empresas.length - 1}
                onClick={() => handleSelect(empresa)}
              >
                <ListItemText primary={empresa.nombre} />
              </ListItemButton>
            ))}
          </List>
        </Card>
      )}
    </Box>
  );
}
