import * as React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import {
  AddRounded,
  CloseRounded,
  DeleteOutlineRounded,
  EditRounded,
  PlaceOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { apiFetch, type ApiFetchError } from "../services/apiFetch";
import { ConfigPageFrame, ConfigPageHeader } from "../components/configuracion/configVisual";
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx, catalogoSearchSx } from "../components/catalogo/catalogoSurfaces";
import { ColHead, Pill, Section, actionIconSx, formWellSx, panelBarSx, rowIconSx, wellSx } from "../components/transporte/transporteVisual";

type Domicilio = {
  id: number;
  identificador: string;
  tipo_referencia: string | null;
  es_principal: boolean;
  activo: boolean;
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia: string | null;
  colonia_sat: string | null;
  ciudad: string | null;
  estado: string | null;
  cp: string | null;
  cp_sat: string | null;
  pais: string | null;
  cruces: string | null;
};
type Form = Omit<Domicilio, "id">;
type Colonia = { clave: string; nombre: string };
const empty = (): Form => ({
  identificador: "",
  tipo_referencia: "",
  es_principal: false,
  activo: true,
  calle: "",
  numero_exterior: "",
  numero_interior: "",
  colonia: "",
  colonia_sat: "",
  ciudad: "",
  estado: "",
  cp: "",
  cp_sat: "",
  pais: "MEX",
  cruces: "",
});
const address = (d: Domicilio) =>
  [
    d.calle,
    d.numero_exterior,
    d.numero_interior,
    d.colonia_sat || d.colonia,
    d.ciudad,
    d.estado,
    d.cp_sat || d.cp,
    d.pais,
  ]
    .filter(Boolean)
    .join(", ") || "Sin datos de ubicación";

/* Filtros con los mismos estilos de botón de catálogo/Contactos y el radio de las acciones. */
const filterShape = { borderRadius: "10px", minHeight: 34 };
const filterOnSx = (theme: Theme) => ({ ...(catalogoPrimaryButtonSx as (t: Theme) => object)(theme), ...filterShape });
const filterOffSx = (theme: Theme) => ({ ...(catalogoOutlinedButtonSx as (t: Theme) => object)(theme), ...filterShape });
const gridCols = { xs: "1fr", md: "minmax(0,1.1fr) minmax(0,.9fr) minmax(0,2.2fr) 100px 124px" };

export default function DomiciliosPropiosPage() {
  const [rows, setRows] = React.useState<Domicilio[]>([]),
    [form, setForm] = React.useState<Form>(empty()),
    [editing, setEditing] = React.useState<number | null>(null),
    [show, setShow] = React.useState(false),
    [query, setQuery] = React.useState(""),
    [active, setActive] = React.useState("todos"),
    [error, setError] = React.useState(""),
    [saving, setSaving] = React.useState(false),
    [cpLoading, setCpLoading] = React.useState(false),
    [cpError, setCpError] = React.useState(""),
    [colonias, setColonias] = React.useState<Colonia[]>([]);
  const load = React.useCallback(
    async () => setRows(await apiFetch<Domicilio[]>("/api/empresa/domicilios")),
    [],
  );
  React.useEffect(() => {
    void load().catch((e: any) => setError(e.message));
  }, [load]);
  React.useEffect(() => {
    const cp = String(form.cp_sat || "").trim();
    if (cp.length !== 5) {
      setColonias([]);
      return;
    }
    let alive = true;
    setCpLoading(true);
    setCpError("");
    void apiFetch<{
      codigo_postal?: string;
      estado?: { nombre?: string };
      municipio?: { nombre?: string };
      localidad?: { nombre?: string };
      pais?: { id?: string; nombre?: string };
      colonias?: Colonia[];
    }>(`/api/sat/codigos-postales/${cp}`)
      .then((d) => {
        if (!alive) return;
        const items = d.colonias ?? [];
        setColonias(items);
        setForm((x) => ({
          ...x,
          cp: d.codigo_postal || cp,
          cp_sat: d.codigo_postal || cp,
          estado: d.estado?.nombre || x.estado,
          ciudad: d.localidad?.nombre || d.municipio?.nombre || x.ciudad,
          pais: d.pais?.id === "MEX" ? "MEX" : d.pais?.nombre || x.pais,
          colonia_sat: items.some((c) => c.clave === x.colonia_sat)
            ? x.colonia_sat
            : "",
        }));
      })
      .catch(() => {
        if (alive) {
          setColonias([]);
          setCpError("El código postal SAT no se encontró");
        }
      })
      .finally(() => {
        if (alive) setCpLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [form.cp_sat]);
  const set = (k: keyof Form, v: any) => setForm((x) => ({ ...x, [k]: v }));
  const reset = () => {
    setForm(empty());
    setEditing(null);
    setShow(false);
    setColonias([]);
    setCpError("");
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(
        editing
          ? `/api/empresa/domicilios/${editing}`
          : "/api/empresa/domicilios",
        { method: editing ? "PUT" : "POST", body: form },
      );
      await load();
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (d: Domicilio) => {
    try {
      await apiFetch(`/api/empresa/domicilios/${d.id}/activo`, {
        method: "PATCH",
        body: { activo: !d.activo },
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const remove = async (d: Domicilio) => {
    const warning = d.es_principal
      ? "Este domicilio es el principal. Si lo eliminas, la empresa puede quedar sin domicilio principal. ¿Deseas continuar?"
      : "¿Deseas eliminar físicamente este domicilio?";
    if (!window.confirm(warning)) return;
    setError("");
    try {
      await apiFetch(`/api/empresa/domicilios/${d.id}`, { method: "DELETE" });
      setRows((x) => x.filter((r) => r.id !== d.id));
    } catch (e) {
      const err = e as ApiFetchError;
      setError(
        err.status === 409
          ? err.message
          : err.message || "No se pudo eliminar el domicilio.",
      );
    }
  };
  const filtered = rows.filter(
    (d) =>
      (active === "todos" || (active === "activos" ? d.activo : !d.activo)) &&
      `${d.identificador} ${d.tipo_referencia || ""} ${address(d)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const field = (k: keyof Form, l: string) => (
    <TextField
      size="small"
      fullWidth
      label={l}
      placeholder={
        k === "identificador"
          ? "Matriz, Bodega Guadalajara, Planta Norte"
          : undefined
      }
      value={form[k] ?? ""}
      onChange={(e) => set(k, e.target.value)}
      sx={catalogoSearchSx}
    />
  );
  return (
    <ConfigPageFrame>
      {!show && (
        <ConfigPageHeader
          title="Domicilios propios"
          description="Administra los domicilios de la empresa disponibles para Carta Porte."
          actions={
            <Tooltip title="Nuevo domicilio">
              <IconButton size="small" sx={actionIconSx} onClick={() => setShow(true)}>
                <AddRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        />
      )}
      {show && (
        <ConfigPageHeader
          eyebrow="Domicilios propios"
          title={editing ? "Editar domicilio" : "Nuevo domicilio propio"}
          description={
            editing && form.identificador
              ? [form.identificador, form.tipo_referencia].filter(Boolean).join(" · ")
              : "Ubicación de la empresa disponible para Carta Porte."
          }
          actions={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <FormControlLabel
                sx={{ mr: 1 }}
                control={
                  <Switch
                    size="small"
                    checked={form.activo !== false}
                    onChange={(e) => set("activo", e.target.checked)}
                  />
                }
                label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Activo</Typography>}
              />
              <Tooltip title="Cancelar">
                <IconButton size="small" sx={actionIconSx} onClick={reset}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={saving ? "Guardando…" : "Guardar"}>
                <span>
                  <IconButton
                    size="small"
                    sx={actionIconSx}
                    disabled={saving || !form.identificador.trim()}
                    onClick={() => void save()}
                  >
                    {saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          }
        />
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {!show && (
        <Box sx={wellSx}>
          <Box sx={panelBarSx}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ minWidth: 0, py: 1 }}>
              <Box sx={{ minWidth: { sm: 280 } }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Buscar ubicación o dirección"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  sx={catalogoSearchSx}
                />
              </Box>
              <Stack direction="row" spacing={0.5}>
                {["todos", "activos", "inactivos"].map((x) => (
                  <Button
                    key={x}
                    size="small"
                    variant={active === x ? "contained" : "outlined"}
                    disableElevation
                    sx={active === x ? filterOnSx : filterOffSx}
                    onClick={() => setActive(x)}
                  >
                    {x[0].toUpperCase() + x.slice(1)}
                  </Button>
                ))}
              </Stack>
            </Stack>
            <Typography sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>
              {filtered.length} {filtered.length === 1 ? "domicilio" : "domicilios"}
            </Typography>
          </Box>
          {!filtered.length ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <PlaceOutlined sx={(theme) => ({ fontSize: 40, color: theme.emphasys.content.muted, mb: 1 })} />
              <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.muted })}>
                No hay domicilios propios registrados.
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={(theme) => ({
                  display: { xs: "none", md: "grid" },
                  gridTemplateColumns: gridCols,
                  gap: 2,
                  px: 2.25,
                  py: 1,
                  bgcolor: theme.emphasys.metric.amount.background,
                  borderBottom: `1px solid ${theme.emphasys.content.border}`,
                })}
              >
                <ColHead>Identificador</ColHead>
                <ColHead>Tipo / referencia</ColHead>
                <ColHead>Dirección</ColHead>
                <ColHead>Principal</ColHead>
                <ColHead align="right">Acciones</ColHead>
              </Box>
              {filtered.map((d) => (
                <Box
                  key={d.id}
                  sx={(theme) => ({
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    alignItems: "center",
                    gap: { xs: 0.75, md: 2 },
                    px: { xs: 1.5, md: 2.25 },
                    py: 1.25,
                    borderBottom: `1px solid ${theme.emphasys.content.border}`,
                    "&:last-of-type": { borderBottom: 0 },
                    "&:hover": { bgcolor: theme.emphasys.content.hover },
                  })}
                >
                  <Typography noWrap sx={(theme) => ({ fontSize: 14, fontWeight: 700, color: theme.emphasys.content.foreground, minWidth: 0 })}>
                    {d.identificador}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, fontWeight: 600, color: d.tipo_referencia ? theme.emphasys.content.foreground : theme.emphasys.content.muted, minWidth: 0 })}>
                    {d.tipo_referencia || "—"}
                  </Typography>
                  <Typography noWrap title={address(d)} sx={(theme) => ({ fontSize: 13, color: theme.emphasys.content.secondary, minWidth: 0 })}>
                    {address(d)}
                  </Typography>
                  <Box>
                    {d.es_principal && <Pill active label="Principal" />}
                  </Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                    <Tooltip title={d.activo ? "Desactivar" : "Activar"}>
                      <Switch
                        size="small"
                        checked={d.activo}
                        onChange={() => void toggle(d)}
                      />
                    </Tooltip>
                    <Tooltip title="Editar domicilio">
                      <IconButton
                        size="small"
                        sx={rowIconSx}
                        onClick={() => {
                          setEditing(d.id);
                          setForm({ ...d });
                          setShow(true);
                        }}
                      >
                        <EditRounded sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" sx={rowIconSx} onClick={() => void remove(d)}>
                        <DeleteOutlineRounded sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              ))}
            </>
          )}
        </Box>
      )}
      {show && (
        <Box sx={formWellSx}>
          <Section title="Identificación" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr auto" },
                gap: 1.5,
              }}
            >
              {field("identificador", "Identificador")}
              {field("tipo_referencia", "Tipo / referencia")}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.es_principal}
                    onChange={(e) => set("es_principal", e.target.checked)}
                  />
                }
                label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Principal</Typography>}
              />
            </Box>
          </Section>
          <Section title="Domicilio" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                fullWidth
                label="Código postal"
                value={form.cp_sat || ""}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    cp_sat: e.target.value.replace(/\D/g, "").slice(0, 5),
                    cp: e.target.value.replace(/\D/g, "").slice(0, 5),
                  }))
                }
                error={Boolean(cpError)}
                helperText={
                  cpError ||
                  (cpLoading
                    ? "Consultando catálogo SAT…"
                    : "Captura 5 dígitos")
                }
                InputProps={{
                  endAdornment: cpLoading ? (
                    <CircularProgress size={18} />
                  ) : undefined,
                }}
                sx={catalogoSearchSx}
              />
              {field("estado", "Estado")}
              {field("ciudad", "Municipio / Ciudad")}
              <Autocomplete
                options={colonias}
                value={
                  colonias.find((c) => c.clave === form.colonia_sat) || null
                }
                getOptionLabel={(x) => x.nombre}
                onChange={(_, v) =>
                  setForm((x) => ({
                    ...x,
                    colonia: v?.nombre || "",
                    colonia_sat: v?.clave || "",
                  }))
                }
                renderInput={(p) => (
                  <TextField {...p} size="small" label="Colonia SAT" sx={catalogoSearchSx} />
                )}
              />
              {field("calle", "Calle")}
              {field("numero_exterior", "Número exterior")}
              {field("numero_interior", "Número interior")}
              {field("pais", "País")}
              {field("cruces", "Cruces / referencia")}
            </Box>
          </Section>
        </Box>
      )}
    </ConfigPageFrame>
  );
}
