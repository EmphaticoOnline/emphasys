import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useTheme } from "@mui/material/styles";
import {
  fetchCamposObligatorios,
  crearCampoObligatorio,
  eliminarCampoObligatorio,
} from "../../services/camposObligatoriosService";
import { CONTACTOS_CAMPOS } from "../../definitions/contactos.fields";
import type { DefinicionCampo } from "../../definitions/contactos.fields";
import { PRODUCTOS_CAMPOS } from "../../definitions/productos.fields";
import { ConfigPageFrame, ConfigPageHeader } from "../../components/configuracion/configVisual";
import { ColHead, Section, fieldsOnIvorySx, formWellSx, wellSx } from "../../components/transporte/transporteVisual";

type DefinicionContexto = {
  valor: string;
  etiqueta: string;
};

type DefinicionEntidad = {
  entidad: string;
  etiqueta: string;
  contextos: DefinicionContexto[];
  campos: DefinicionCampo[];
};

const ENTIDADES: DefinicionEntidad[] = [
  {
    entidad: "contactos",
    etiqueta: "Contactos",
    contextos: [
      { valor: "Cliente",   etiqueta: "Cliente" },
      { valor: "Lead",      etiqueta: "Lead" },
      { valor: "Proveedor", etiqueta: "Proveedor" },
      { valor: "Vendedor",  etiqueta: "Vendedor" },
    ],
    campos: CONTACTOS_CAMPOS,
  },
  {
    entidad: "productos",
    etiqueta: "Productos",
    contextos: [
      { valor: "Inventariable",     etiqueta: "Inventariable" },
      { valor: "No inventariable",  etiqueta: "No inventariable" },
      { valor: "Kit",               etiqueta: "Kit" },
    ],
    campos: PRODUCTOS_CAMPOS,
  },
];

export default function CamposObligatoriosPage() {
  const tokens = useTheme().emphasys;
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<string>(
    ENTIDADES[0]!.entidad
  );
  const [contextoSeleccionado, setContextoSeleccionado] = useState<string>(
    ENTIDADES[0]!.contextos[0]!.valor
  );

  const [camposObligatorios, setCamposObligatorios] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const defEntidad = (ENTIDADES.find((e) => e.entidad === entidadSeleccionada) ?? ENTIDADES[0]) as DefinicionEntidad;

  const cargarCampos = async () => {
    setLoading(true);
    setError(null);
    try {
      const campos = await fetchCamposObligatorios(
        defEntidad.entidad,
        contextoSeleccionado
      );
      setCamposObligatorios(new Set(campos));
    } catch {
      setError("No se pudieron cargar los campos obligatorios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarCampos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadSeleccionada, contextoSeleccionado]);

  const handleEntidadChange = (e: SelectChangeEvent<string>) => {
    const nuevaEntidad = e.target.value;
    const def = (ENTIDADES.find((en) => en.entidad === nuevaEntidad) ?? ENTIDADES[0]) as DefinicionEntidad;
    setEntidadSeleccionada(nuevaEntidad);
    setContextoSeleccionado(def.contextos[0]?.valor ?? "");
  };

  const handleContextoChange = (e: SelectChangeEvent<string>) => {
    setContextoSeleccionado(e.target.value);
  };

  const handleToggle = async (campo: string, activar: boolean) => {
    if (toggling.has(campo)) return;

    setToggling((prev) => new Set(prev).add(campo));
    try {
      if (activar) {
        await crearCampoObligatorio(
          defEntidad.entidad,
          contextoSeleccionado,
          campo
        );
        setCamposObligatorios((prev) => new Set(prev).add(campo));
      } else {
        await eliminarCampoObligatorio(
          defEntidad.entidad,
          contextoSeleccionado,
          campo
        );
        setCamposObligatorios((prev) => {
          const next = new Set(prev);
          next.delete(campo);
          return next;
        });
      }
    } catch {
      setError(`No se pudo ${activar ? "activar" : "desactivar"} el campo "${campo}".`);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(campo);
        return next;
      });
    }
  };

  return (
    <ConfigPageFrame>
      <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ConfigPageHeader
        title="Campos obligatorios"
        description="Configura qué campos son obligatorios por entidad y contexto. Los campos no marcados se consideran opcionales."
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
      <Section title="Entidad y contexto" inset>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="entidad-label">Entidad</InputLabel>
          <Select
            labelId="entidad-label"
            label="Entidad"
            value={entidadSeleccionada}
            onChange={handleEntidadChange}
          >
            {ENTIDADES.map((e) => (
              <MenuItem key={e.entidad} value={e.entidad}>
                {e.etiqueta}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="contexto-label">Contexto</InputLabel>
          <Select
            labelId="contexto-label"
            label="Contexto"
            value={contextoSeleccionado}
            onChange={handleContextoChange}
          >
            {defEntidad.contextos.map((c) => (
              <MenuItem key={c.valor} value={c.valor}>
                {c.etiqueta}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      </Section>
      </Box>

      <Box sx={wellSx}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.25,
            py: 1,
            backgroundColor: tokens.metric.amount.background,
            borderBottom: `1px solid ${tokens.content.border}`,
          }}
        >
          <ColHead>Campo</ColHead>
          <ColHead align="right">Obligatorio</ColHead>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          defEntidad.campos.map((def, idx) => (
            <React.Fragment key={def.campo}>
              {idx > 0 && <Divider />}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 2.25,
                  py: 1,
                  "&:hover": { bgcolor: tokens.content.hover },
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={700} color={tokens.content.foreground}>
                    {def.etiqueta}
                  </Typography>
                  <Typography variant="caption" color={tokens.content.muted}>
                    {def.campo}
                  </Typography>
                </Box>
                <Switch
                  checked={camposObligatorios.has(def.campo)}
                  onChange={(_, checked) => handleToggle(def.campo, checked)}
                  disabled={toggling.has(def.campo)}
                  size="small"
                />
              </Box>
            </React.Fragment>
          ))
        )}
      </Box>
      </Box>
    </ConfigPageFrame>
  );
}
