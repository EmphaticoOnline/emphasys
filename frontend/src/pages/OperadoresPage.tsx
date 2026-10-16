import * as React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
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
import { AddRounded, BadgeOutlined, CloseRounded, EditRounded, SaveOutlined } from "@mui/icons-material";
import { apiFetch } from "../services/apiFetch";
import { ConfigPageFrame, ConfigPageHeader } from "../components/configuracion/configVisual";
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx, catalogoSearchSx } from "../components/catalogo/catalogoSurfaces";
import { ColHead, Section, actionIconSx, panelBarSx, rowIconSx, wellSx } from "../components/transporte/transporteVisual";
import {
  actualizarOperador,
  cambiarEstadoOperador,
  crearOperador,
  obtenerOperadores,
  type OperadorTransporte,
} from "../services/transporte.api";

type Form = {
  nombre: string;
  rfc: string;
  telefono: string;
  email: string;
  calle: string;
  numero_exterior: string;
  colonia: string;
  colonia_sat: string;
  ciudad: string;
  estado: string;
  cp: string;
  cp_sat: string;
  pais: string;
  numero_licencia: string;
  tipo_licencia: string;
  vigencia_licencia: string;
  activo: boolean;
};
const empty = (): Form => ({
  nombre: "",
  rfc: "",
  telefono: "",
  email: "",
  calle: "",
  numero_exterior: "",
  colonia: "",
  colonia_sat: "",
  ciudad: "",
  estado: "",
  cp: "",
  cp_sat: "",
  pais: "MEX",
  numero_licencia: "",
  tipo_licencia: "",
  vigencia_licencia: "",
  activo: true,
});
type Colonia = { clave: string; nombre: string };

/* Filtros con los mismos estilos de botón de catálogo/Contactos y el radio de las acciones. */
const filterShape = { borderRadius: "10px", minHeight: 34 };
const filterOnSx = (theme: Theme) => ({ ...(catalogoPrimaryButtonSx as (t: Theme) => object)(theme), ...filterShape });
const filterOffSx = (theme: Theme) => ({ ...(catalogoOutlinedButtonSx as (t: Theme) => object)(theme), ...filterShape });
const gridCols = { xs: "1fr", md: "minmax(0,1.5fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) 96px" };

export default function OperadoresPage() {
  const [rows, setRows] = React.useState<OperadorTransporte[]>([]),
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
    async () => setRows(await obtenerOperadores()),
    [],
  );
  React.useEffect(() => {
    void load().catch((e: any) => setError(e.message));
  }, [load]);
  React.useEffect(() => {
    const cp = form.cp.trim();
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
  }, [form.cp]);
  const set = (k: keyof Form, v: any) => setForm((x) => ({ ...x, [k]: v }));
  const reset = () => {
    setForm(empty());
    setEditing(null);
    setShow(false);
    setColonias([]);
    setCpError("");
  };
  const start = (v: OperadorTransporte) => {
    const d: any = v.domicilio_principal || {};
    setEditing(v.id);
    setForm({
      nombre: v.nombre || "",
      rfc: v.rfc || "",
      telefono: v.telefono || "",
      email: v.email || "",
      calle: d.calle || "",
      numero_exterior: d.numeroExterior || "",
      colonia: d.colonia || "",
      colonia_sat: d.colonia_sat || "",
      ciudad: d.localidad || "",
      estado: d.estado || "",
      cp: d.codigoPostal || "",
      cp_sat: d.cp_sat || d.codigoPostal || "",
      pais: d.pais || "MEX",
      numero_licencia: v.numero_licencia || "",
      tipo_licencia: v.tipo_licencia || "",
      vigencia_licencia: String(v.vigencia_licencia || "").slice(0, 10),
      activo: v.activo,
    });
    setShow(true);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const contacto = {
        nombre: form.nombre.trim(),
        rfc: form.rfc.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        calle: form.calle.trim() || null,
        numero_exterior: form.numero_exterior.trim() || null,
        colonia: form.colonia.trim() || null,
        colonia_sat: form.colonia_sat.trim() || null,
        ciudad: form.ciudad.trim() || null,
        estado: form.estado.trim() || null,
        cp: form.cp.trim() || null,
        cp_sat: form.cp_sat.trim() || null,
        pais: form.pais.trim() || null,
      };
      const operador = {
        numero_licencia: form.numero_licencia.trim(),
        tipo_licencia: form.tipo_licencia.trim() || null,
        vigencia_licencia: form.vigencia_licencia || null,
        activo: form.activo,
      };
      if (editing) await actualizarOperador(editing, { contacto, operador });
      else await crearOperador({ contacto, operador });
      await load();
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (v: OperadorTransporte) => {
    try {
      await cambiarEstadoOperador(v.id, !v.activo);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const filtered = rows.filter(
    (v) =>
      (active === "todos" || (active === "activos" ? v.activo : !v.activo)) &&
      `${v.nombre} ${v.rfc || ""} ${v.numero_licencia}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const warning = [
    !form.rfc && "RFC",
    !form.cp && "código postal",
    !form.estado && "estado",
    !form.pais && "país",
  ]
    .filter(Boolean)
    .join(", ");
  const field = (k: keyof Form, label: string) => (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={form[k] as string}
      onChange={(e) => set(k, e.target.value)}
      sx={catalogoSearchSx}
    />
  );
  return (
    <ConfigPageFrame>
      {!show && (
        <ConfigPageHeader
          eyebrow="Transporte"
          title="Operadores"
          description="Administra los operadores disponibles para Transporte y Carta Porte."
          actions={
            <Tooltip title="Nuevo operador">
              <IconButton size="small" sx={actionIconSx} onClick={() => setShow(true)}>
                <AddRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        />
      )}
      {show && (
        <ConfigPageHeader
          eyebrow="Operadores"
          title={editing ? "Editar operador" : "Nuevo operador"}
          description={
            editing && form.nombre
              ? [form.nombre, form.numero_licencia].filter(Boolean).join(" · ")
              : "Datos de contacto, domicilio y licencia del operador."
          }
          actions={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <FormControlLabel
                sx={{ mr: 1 }}
                control={
                  <Switch
                    size="small"
                    checked={form.activo}
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
                    disabled={
                      saving || !form.nombre.trim() || !form.numero_licencia.trim()
                    }
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
                  placeholder="Buscar nombre, RFC o licencia"
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
              {filtered.length} {filtered.length === 1 ? "operador" : "operadores"}
            </Typography>
          </Box>
          {!filtered.length ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <BadgeOutlined sx={(theme) => ({ fontSize: 40, color: theme.emphasys.content.muted, mb: 1 })} />
              <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.muted })}>
                No hay operadores registrados.
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
                <ColHead>Nombre</ColHead>
                <ColHead>RFC</ColHead>
                <ColHead>Licencia</ColHead>
                <ColHead>Tipo</ColHead>
                <ColHead>Vigencia</ColHead>
                <ColHead align="right">Acciones</ColHead>
              </Box>
              {filtered.map((v) => (
                <Box
                  key={v.id}
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
                    {v.nombre}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, fontWeight: 600, color: theme.emphasys.content.foreground, minWidth: 0 })}>
                    {v.rfc || "—"}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, color: theme.emphasys.content.secondary, minWidth: 0 })}>
                    {v.numero_licencia}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, color: v.tipo_licencia ? theme.emphasys.content.secondary : theme.emphasys.content.muted, minWidth: 0 })}>
                    {v.tipo_licencia || "—"}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, color: v.vigencia_licencia ? theme.emphasys.content.secondary : theme.emphasys.content.muted, minWidth: 0 })}>
                    {v.vigencia_licencia?.slice(0, 10) || "—"}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                    <Tooltip title="Editar operador">
                      <IconButton size="small" sx={rowIconSx} onClick={() => start(v)}>
                        <EditRounded sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={v.activo ? "Desactivar" : "Activar"}>
                      <Switch size="small" checked={!!v.activo} onChange={() => void toggle(v)} />
                    </Tooltip>
                  </Stack>
                </Box>
              ))}
            </>
          )}
        </Box>
      )}
      {show && (
        <Box sx={[wellSx, { p: { xs: 1, md: 1.75 }, display: "flex", flexDirection: "column", gap: { xs: 1, md: 1.5 } }]}>
          <Section title="Datos de contacto" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1.5fr 1fr 1fr" },
                gap: 1.5,
              }}
            >
              {field("nombre", "Nombre / razón social")}
              {field("rfc", "RFC")}
              {field("telefono", "Teléfono")}
              {field("email", "Email")}
            </Box>
          </Section>
          <Section title="Domicilio principal" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                label="Código postal"
                value={form.cp}
                onChange={(e) =>
                  set("cp", e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                error={Boolean(cpError)}
                helperText={
                  cpError || (cpLoading ? "Consultando catálogo SAT…" : "")
                }
                InputProps={{
                  endAdornment: cpLoading ? (
                    <CircularProgress size={18} />
                  ) : undefined,
                }}
                sx={catalogoSearchSx}
              />
              {field("estado", "Estado")}
              {field("ciudad", "Ciudad / Municipio")}
              <Autocomplete
                options={colonias}
                value={colonias.find((c) => c.nombre === form.colonia) || null}
                getOptionLabel={(x) => x.nombre}
                onChange={(_, v) =>
                  setForm((x) => ({
                    ...x,
                    colonia: v?.nombre || "",
                    colonia_sat: v?.clave || "",
                  }))
                }
                renderInput={(p) => (
                  <TextField {...p} size="small" label="Colonia" sx={catalogoSearchSx} />
                )}
              />
              {field("calle", "Calle")}
              {field("numero_exterior", "Número exterior")}
              {field("pais", "País")}
            </Box>
          </Section>
          <Section title="Datos de operador" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" },
                gap: 1.5,
              }}
            >
              {field("numero_licencia", "Número de licencia")}
              {field("tipo_licencia", "Tipo de licencia")}
              <TextField
                size="small"
                type="date"
                label="Vigencia de licencia"
                InputLabelProps={{ shrink: true }}
                value={form.vigencia_licencia}
                onChange={(e) => set("vigencia_licencia", e.target.value)}
                sx={catalogoSearchSx}
              />
            </Box>
          </Section>
          {warning && (
            <Alert severity="warning">
              Información importante para Carta Porte incompleta: faltan{" "}
              {warning}.
            </Alert>
          )}
        </Box>
      )}
    </ConfigPageFrame>
  );
}
