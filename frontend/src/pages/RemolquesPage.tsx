import * as React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddRounded, CloseRounded, EditRounded, RvHookupOutlined, SaveOutlined } from "@mui/icons-material";
import { apiFetch } from "../services/apiFetch";
import { ConfigPageFrame, ConfigPageHeader } from "../components/configuracion/configVisual";
import { catalogoSearchSx } from "../components/catalogo/catalogoSurfaces";
import { ColHead, Section, actionIconSx, panelBarSx, rowIconSx, wellSx } from "../components/transporte/transporteVisual";
type R = Record<string, any>;
type C = { id: number; nombre: string };
const empty = () => ({
  clave_interna: "",
  placas: "",
  subtipo_remolque_sat: null,
  propietario_contacto_id: null,
  activo: true,
});
const gridCols = { xs: "1fr", md: "minmax(140px,1fr) minmax(110px,.8fr) minmax(0,1.6fr) minmax(0,1.2fr) 96px" };
export default function RemolquesPage() {
  const [rows, setRows] = React.useState<R[]>([]),
    [form, setForm] = React.useState<R>(empty()),
    [edit, setEdit] = React.useState<number | null>(null),
    [show, setShow] = React.useState(false),
    [subs, setSubs] = React.useState<R[]>([]),
    [contacts, setContacts] = React.useState<C[]>([]),
    [error, setError] = React.useState("");
  const load = React.useCallback(
    async () => setRows(await apiFetch<R[]>("/api/transporte/remolques")),
    [],
  );
  React.useEffect(() => {
    void Promise.all([
      load(),
      apiFetch<{ items: R[] }>(
        "/api/catalogos/sat/subtipos-remolque?limit=100",
      ).then((x) => setSubs(x.items)),
      apiFetch<any>("/api/contactos?limit=100").then((x) =>
        setContacts(Array.isArray(x) ? x : (x.items ?? x.data ?? [])),
      ),
    ]).catch((e: any) => setError(e.message));
  }, [load]);
  const set = (k: string, v: any) => setForm((x) => ({ ...x, [k]: v }));
  const reset = () => {
    setForm(empty());
    setEdit(null);
    setShow(false);
  };
  const save = async () => {
    try {
      await apiFetch(
        edit
          ? "/api/transporte/remolques/" + edit
          : "/api/transporte/remolques",
        { method: edit ? "PUT" : "POST", body: form },
      );
      await load();
      reset();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const third = form.propietario_contacto_id != null;
  const selected =
    contacts.find((c) => c.id === form.propietario_contacto_id) ?? null;
  return (
    <ConfigPageFrame>
      {!show && (
        <ConfigPageHeader
          eyebrow="Transporte"
          title="Remolques"
          description="Administra el equipo arrastrado para Transporte y Carta Porte."
          actions={
            <Tooltip title="Nuevo remolque">
              <IconButton size="small" sx={actionIconSx} onClick={() => setShow(true)}>
                <AddRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        />
      )}
      {show && (
        <ConfigPageHeader
          eyebrow="Remolques"
          title={edit ? "Editar remolque" : "Nuevo remolque"}
          description={
            edit && form.clave_interna
              ? [form.clave_interna, form.placas].filter(Boolean).join(" · ")
              : "Información permanente del remolque y su propietario."
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
              <Tooltip title="Guardar">
                <IconButton size="small" sx={actionIconSx} onClick={() => void save()}>
                  <SaveOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          }
        />
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {!show && (
        <Box sx={wellSx}>
          <Box sx={panelBarSx}>
            <Typography sx={(theme) => ({ fontSize: 14, fontWeight: 700, color: theme.emphasys.content.foreground })}>
              Remolques registrados
            </Typography>
            <Typography sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>
              {rows.length} {rows.length === 1 ? "remolque" : "remolques"}
            </Typography>
          </Box>
          {!rows.length ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <RvHookupOutlined sx={(theme) => ({ fontSize: 40, color: theme.emphasys.content.muted, mb: 1 })} />
              <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.muted })}>
                No hay remolques registrados.
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
                <ColHead>Clave interna</ColHead>
                <ColHead>Placas</ColHead>
                <ColHead>Subtipo SAT</ColHead>
                <ColHead>Propietario</ColHead>
                <ColHead align="right">Acciones</ColHead>
              </Box>
              {rows.map((r) => (
                <Box
                  key={r.id}
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
                    {r.clave_interna}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, fontWeight: 600, color: theme.emphasys.content.foreground })}>
                    {r.placas || "—"}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, color: r.subtipo_remolque_sat ? theme.emphasys.content.secondary : theme.emphasys.content.muted, minWidth: 0 })}>
                    {r.subtipo_remolque_sat || "Sin subtipo SAT"}
                  </Typography>
                  <Typography noWrap sx={(theme) => ({ fontSize: 13, color: theme.emphasys.content.secondary, minWidth: 0 })}>
                    {r.propietario_nombre || "Propio"}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                    <Tooltip title="Editar remolque">
                      <IconButton
                        size="small"
                        sx={rowIconSx}
                        onClick={() => {
                          setForm(r);
                          setEdit(r.id);
                          setShow(true);
                        }}
                      >
                        <EditRounded sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={r.activo ? "Desactivar" : "Activar"}>
                      <Switch
                        size="small"
                        checked={!!r.activo}
                        onChange={async () => {
                          try {
                            if (r.activo)
                              await apiFetch(
                                "/api/transporte/remolques/" + r.id + "/desactivar",
                                { method: "PATCH" },
                              );
                            else
                              await apiFetch("/api/transporte/remolques/" + r.id, {
                                method: "PUT",
                                body: { ...r, activo: true },
                              });
                            await load();
                          } catch (e: any) {
                            setError(e.message);
                          }
                        }}
                      />
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
          <Section title="Identificación" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                label="Clave interna"
                value={form.clave_interna}
                onChange={(e) => set("clave_interna", e.target.value)}
                sx={catalogoSearchSx}
              />
              <TextField
                size="small"
                label="Placas"
                value={form.placas}
                onChange={(e) => set("placas", e.target.value)}
                sx={catalogoSearchSx}
              />
            </Box>
          </Section>
          <Section title="Carta Porte" inset>
            <Autocomplete
              options={subs}
              value={
                subs.find((x) => x.clave === form.subtipo_remolque_sat) ??
                null
              }
              getOptionLabel={(x) => x.clave + " — " + x.descripcion}
              onChange={(_, v) =>
                set("subtipo_remolque_sat", v?.clave ?? null)
              }
              renderInput={(p) => (
                <TextField
                  {...p}
                  size="small"
                  label="Subtipo de remolque SAT"
                  sx={catalogoSearchSx}
                />
              )}
            />
          </Section>
          <Section title="Propietario" inset>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(220px,.7fr) 1fr" },
                gap: 1.5,
              }}
            >
              <FormControl>
                <FormLabel
                  sx={(theme) => ({
                    fontSize: 12,
                    fontWeight: 600,
                    color: theme.emphasys.content.muted,
                    "&.Mui-focused": { color: theme.emphasys.content.muted },
                  })}
                >
                  Tipo de propietario
                </FormLabel>
                <RadioGroup
                  row
                  value={third ? "tercero" : "propio"}
                  onChange={(e) => {
                    if (e.target.value === "propio")
                      set("propietario_contacto_id", null);
                  }}
                >
                  <FormControlLabel
                    value="propio"
                    control={<Radio size="small" />}
                    label="Propio"
                  />
                  <FormControlLabel
                    value="tercero"
                    control={<Radio size="small" />}
                    label="Tercero"
                  />
                </RadioGroup>
              </FormControl>
              {third ? (
                <Autocomplete
                  options={contacts}
                  value={selected}
                  getOptionLabel={(x) => x.nombre}
                  onChange={(_, v) =>
                    set("propietario_contacto_id", v?.id ?? null)
                  }
                  renderInput={(p) => (
                    <TextField
                      {...p}
                      size="small"
                      label="Contacto propietario"
                      sx={catalogoSearchSx}
                    />
                  )}
                />
              ) : (
                <Typography variant="body2" sx={(theme) => ({ alignSelf: "center", color: theme.emphasys.content.muted })}>
                  Empresa activa como propietaria
                </Typography>
              )}
            </Box>
          </Section>
        </Box>
      )}
    </ConfigPageFrame>
  );
}
