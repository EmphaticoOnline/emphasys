import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { fetchParametrosSistema } from "../../services/parametrosService";
import { actualizarOpcion, crearOpcion, eliminarOpcion, fetchOpciones } from "../../services/parametrosOpcionesService";
import type { ParametroOpcion, ParametrosModulo, ParametroSistema } from "../../types/parametros";

type FormState = {
  opcion_id: number | null;
  valor: string;
  etiqueta: string;
  orden: string;
};

const emptyForm: FormState = { opcion_id: null, valor: "", etiqueta: "", orden: "" };

export default function OpcionesParametrosPage() {
  const [modulos, setModulos] = useState<ParametrosModulo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedParam, setSelectedParam] = useState<ParametroSistema | null>(null);
  const [opciones, setOpciones] = useState<ParametroOpcion[]>([]);
  const [opcionesLoading, setOpcionesLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dropdownParams = useMemo(() => {
    return modulos
      .flatMap((m) => m.parametros)
      .filter((p) => p.tipo_control === "dropdown")
      .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: "base" }));
  }, [modulos]);

  const loadParametros = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchParametrosSistema();
      setModulos(data);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los parámetros");
    } finally {
      setLoading(false);
    }
  };

  const loadOpciones = async (param: ParametroSistema) => {
    setOpcionesLoading(true);
    setError(null);
    try {
      const data = await fetchOpciones(param.parametro_id);
      setOpciones(data);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar las opciones");
    } finally {
      setOpcionesLoading(false);
    }
  };

  useEffect(() => {
    void loadParametros();
  }, []);

  const openEditor = async (param: ParametroSistema) => {
    setSelectedParam(param);
    setDialogOpen(true);
    setForm(emptyForm);
    setFormError(null);
    await loadOpciones(param);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedParam(null);
    setOpciones([]);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleEdit = (op: ParametroOpcion) => {
  setForm({ opcion_id: op.opcion_id ?? null, valor: op.valor, etiqueta: op.etiqueta, orden: op.orden?.toString() ?? "" });
    setFormError(null);
  };

  const handleDelete = async (op: ParametroOpcion) => {
    const ok = window.confirm(`¿Eliminar la opción "${op.etiqueta}"?`);
    if (!ok || !selectedParam) return;
    try {
      await eliminarOpcion(op.opcion_id!);
      await loadOpciones(selectedParam);
    } catch (err: any) {
      setFormError(err?.message || "No se pudo eliminar la opción");
    }
  };

  const handleSave = async () => {
    if (!selectedParam) return;
    if (!form.valor.trim() || !form.etiqueta.trim()) {
      setFormError("Valor y etiqueta son requeridos");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const ordenNumber = form.orden.trim() === "" ? null : Number(form.orden);
      if (form.opcion_id) {
        await actualizarOpcion(form.opcion_id, {
          valor: form.valor.trim(),
          etiqueta: form.etiqueta.trim(),
          orden: Number.isFinite(ordenNumber) ? ordenNumber : null,
        });
      } else {
        await crearOpcion(selectedParam.parametro_id, {
          valor: form.valor.trim(),
          etiqueta: form.etiqueta.trim(),
          orden: Number.isFinite(ordenNumber) ? ordenNumber : null,
        });
      }
  setForm(emptyForm);
      await loadOpciones(selectedParam);
    } catch (err: any) {
      setFormError(err?.message || "No se pudo guardar la opción");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 3 }}>
      <Toolbar disableGutters sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Opciones de parámetros
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra las opciones de los parámetros tipo dropdown.
          </Typography>
        </Box>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Alert severity="info">Cargando parámetros...</Alert>
      ) : dropdownParams.length === 0 ? (
        <Alert severity="info">No hay parámetros tipo dropdown configurados.</Alert>
      ) : (
        <TableContainer sx={{ border: "1px solid #e5e7eb", borderRadius: 1, backgroundColor: "#fff" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Parámetro</TableCell>
                <TableCell sx={{ width: 120 }} align="right">
                  Opciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dropdownParams.map((param) => (
                <TableRow key={param.parametro_id} hover>
                  <TableCell>{param.nombre}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => void openEditor(param)}
                      aria-label="Editar opciones"
                      title="Editar opciones"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight={700}>
            Opciones: {selectedParam?.nombre}
          </Typography>
          <IconButton onClick={closeDialog} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {formError && (
            <Alert severity="error" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <TextField
              size="small"
              label="Etiqueta (texto mostrado al usuario)"
              value={form.etiqueta}
              onChange={(e) => setForm((prev) => ({ ...prev, etiqueta: e.target.value }))}
              fullWidth
              InputProps={{ sx: { fontSize: 12, py: 0.55 } }}
              FormHelperTextProps={{ sx: { m: 0 } }}
            />
            <TextField
              size="small"
              label="Valor (lo que se guarda)"
              value={form.valor}
              onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
              fullWidth
              InputProps={{ sx: { fontSize: 12, py: 0.55 } }}
            />
            <TextField
              size="small"
              label="Orden (número para ordenar)"
              type="number"
              value={form.orden}
              onChange={(e) => setForm((prev) => ({ ...prev, orden: e.target.value }))}
              sx={{ width: { xs: "100%", sm: 190 } }}
              InputProps={{ sx: { fontSize: 12, py: 0.55 } }}
            />
            <IconButton
              color="primary"
              onClick={handleSave}
              disabled={saving}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "#1d2f68",
                color: "#fff",
                '&:hover': { backgroundColor: "#1a2b5c" },
              }}
              title={form.opcion_id ? "Guardar cambios" : "Agregar nueva opción"}
            >
              {form.opcion_id ? <SaveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
            </IconButton>
          </Stack>

          <TableContainer sx={{ border: "1px solid #e5e7eb", borderRadius: 1, backgroundColor: "#fff" }}>
            <Table size="small" sx={{ "& td, & th": { fontSize: 12 } }}>
              <TableHead>
                <TableRow>
                  <TableCell width={70}>Orden</TableCell>
                  <TableCell>Etiqueta</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell align="right" width={140}>
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {opcionesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>Cargando...</TableCell>
                  </TableRow>
                ) : opciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>Sin opciones.</TableCell>
                  </TableRow>
                ) : (
                  opciones.map((op) => (
                    <TableRow key={op.opcion_id} hover>
                      <TableCell>{op.orden ?? ""}</TableCell>
                      <TableCell>{op.etiqueta}</TableCell>
                      <TableCell>{op.valor}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEdit(op)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => void handleDelete(op)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}