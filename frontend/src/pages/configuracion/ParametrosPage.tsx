import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  InputAdornment,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import type { ParametroSistema, ParametrosModulo } from "../../types/parametros";
import { fetchParametrosSistema, guardarParametroSistema } from "../../services/parametrosService";
import { useSession } from "../../session/useSession";
import { ConfigPageFrame, ConfigPageHeader } from "../../components/configuracion/configVisual";
import { Tooltip } from "@mui/material";
import { catalogoSearchSx } from "../../components/catalogo/catalogoSurfaces";
import { Section, actionIconSx, fieldsOnIvorySx, formWellSx } from "../../components/transporte/transporteVisual";

function toBoolean(value: any): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "t", "yes", "si", "sí", "on"].includes(normalized);
}

function normalizeToSend(param: ParametroSistema, value: any): string | null {
  if (value === undefined) return null;
  if (param.tipo_control === "checkbox" || param.tipo_control === "switch") return toBoolean(value) ? "true" : "false";
  if (value === null) return null;
  return String(value);
}

function initialValue(param: ParametroSistema) {
  if (param.tipo_control === "checkbox" || param.tipo_control === "switch") return toBoolean(param.valor_resuelto);
  return param.valor_resuelto ?? "";
}

export default function ParametrosPage() {
  const { session } = useSession();
  const [modulos, setModulos] = useState<ParametrosModulo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<number, any>>({});
  const [paramIndex, setParamIndex] = useState<Record<number, ParametroSistema>>({});
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await fetchParametrosSistema();
      setModulos(data);
      const values: Record<number, any> = {};
      const index: Record<number, ParametroSistema> = {};
      data.forEach((mod) => {
        mod.parametros.forEach((p) => {
          index[p.parametro_id] = p;
          values[p.parametro_id] = initialValue(p);
        });
      });
      setFormValues(values);
      setParamIndex(index);
      setDirty(new Set());
    } catch (err: any) {
      const msg = err?.message || "No se pudieron cargar los parámetros";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [session.empresaActivaId]);

  const isVisible = (param: ParametroSistema) => {
    if (!param.parametro_padre_id) return true;
    const parentVal = formValues[param.parametro_padre_id];
    if (param.valor_activacion === null || param.valor_activacion === undefined) {
      return parentVal === null || parentVal === undefined || parentVal === "" || parentVal === false;
    }
    return String(parentVal ?? "") === String(param.valor_activacion);
  };

  const visibleModulos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return modulos
      .map((m) => {
        const parametrosVisibles = m.parametros
          .filter((p) => isVisible(p))
          .filter((p) => {
            if (!term) return true;
            const nombre = p.nombre.toLowerCase();
            const clave = (p.clave ?? "").toLowerCase();
            const moduloNombre = (m.modulo_nombre ?? "").toLowerCase();
            return nombre.includes(term) || clave.includes(term) || moduloNombre.includes(term);
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: "base" }));

        return {
          ...m,
          parametros: parametrosVisibles,
        };
      })
      .filter((m) => m.parametros.length > 0);
  }, [modulos, formValues, search]);

  const hasChanges = dirty.size > 0;

  const handleChange = (param: ParametroSistema, value: any) => {
    setFormValues((prev) => ({ ...prev, [param.parametro_id]: value }));
    setDirty((prev) => new Set(prev).add(param.parametro_id));
    setSuccess(null);
  };

  const handleReset = () => {
    const values: Record<number, any> = {};
    Object.values(paramIndex).forEach((p) => {
      values[p.parametro_id] = initialValue(p);
    });
    setFormValues(values);
    setDirty(new Set());
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const cambios = Array.from(dirty)
        .map((id) => paramIndex[id])
        .filter((p): p is ParametroSistema => Boolean(p))
        .filter((p) => isVisible(p));

      for (const param of cambios) {
        const valor = normalizeToSend(param, formValues[param.parametro_id]);
        await guardarParametroSistema(param.parametro_id, valor);
      }

      await loadData();
      setSuccess("Cambios guardados correctamente");
    } catch (err: any) {
      const msg = err?.message || "No se pudieron guardar los cambios";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const renderControl = (param: ParametroSistema) => {
    const value = formValues[param.parametro_id];
    if (param.tipo_control === "checkbox" || param.tipo_control === "switch") {
      return (
        <Switch
          checked={toBoolean(value)}
          onChange={(e) => handleChange(param, e.target.checked)}
          color="primary"
          size="small"
        />
      );
    }

    if (param.tipo_control === "dropdown") {
      return (
        <FormControl size="small" fullWidth>
          <InputLabel id={`param-${param.parametro_id}-label`}>Selecciona una opción</InputLabel>
          <Select
            labelId={`param-${param.parametro_id}-label`}
            value={value ?? ""}
            label="Selecciona una opción"
            onChange={(e) => handleChange(param, e.target.value)}
          >
            {param.opciones.map((opt) => (
              <MenuItem key={`${param.parametro_id}-${opt.valor}`} value={opt.valor}>
                {opt.etiqueta}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    return (
      <TextField
        size="small"
        fullWidth
        value={value ?? ""}
        onChange={(e) => handleChange(param, e.target.value)}
      />
    );
  };

  return (
    <ConfigPageFrame>
      <ConfigPageHeader title="Parámetros del sistema" description="Ajusta los valores configurables del ERP para la empresa activa." actions={<Stack direction="row" spacing={0.5}>
          <Tooltip title="Restablecer">
            <span>
              <IconButton size="small" sx={actionIconSx} onClick={handleReset} disabled={loading || saving}>
                <ReplayIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Guardar cambios">
            <span>
              <IconButton size="small" sx={actionIconSx} onClick={handleSave} disabled={!hasChanges || loading || saving}>
                {saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>} />

      <TextField
        sx={catalogoSearchSx}
        placeholder="Buscar por nombre o clave de parámetro"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton aria-label="Limpiar búsqueda" size="small" onClick={() => setSearch("")}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : visibleModulos.length === 0 ? (
        <Alert severity="info">No hay parámetros configurables para mostrar.</Alert>
      ) : (
        <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          {visibleModulos.map((modulo) => (
            <Section
              key={modulo.modulo_id ?? modulo.modulo_nombre ?? "modulo"}
              title={modulo.modulo_nombre ?? "General"}
              inset
            >
                <Stack spacing={0}>
                  {modulo.parametros.map((param) => (
                    <Box
                      key={param.parametro_id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1.1fr 1fr" },
                        alignItems: "center",
                        columnGap: 1.5,
                        rowGap: 0.5,
                        paddingY: 0.35,
                        paddingX: 0.75,
                        borderBottom: (theme) => `1px solid ${theme.emphasys.content.border}`,
                        '&:last-of-type': { borderBottom: "none" },
                        '&:hover': {
                          backgroundColor: (theme) => theme.emphasys.content.hover,
                          transition: "background-color 120ms ease-in-out",
                        },
                      }}
                    >
                      <Typography
                        fontWeight={700}
                        noWrap
                        sx={(theme) => ({ color: theme.emphasys.content.foreground, textAlign: { xs: "left", sm: "right" }, justifySelf: "end", pr: { sm: 1 } })}
                      >
                        {param.nombre}
                      </Typography>
                      <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>{renderControl(param)}</Box>
                    </Box>
                  ))}
                </Stack>
            </Section>
          ))}
        </Box>
      )}
    </ConfigPageFrame>
  );
}
