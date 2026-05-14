import { useEffect, useState } from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import type { ContactCaptureMode, ContactoTipoPermitido } from '../../modules/documentos/documentoTypes';
import { apiFetch } from '../../services/apiFetch';

export type ContactCaptureDetailedFields = {
  telefono: string;
  email: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  ciudad: string;
  estado: string;
  cp: string;
};

export type ContactCaptureDialogProps = {
  open: boolean;
  loading: boolean;
  nombre: string;
  tipoContacto: ContactoTipoPermitido;
  tiposPermitidos?: ContactoTipoPermitido[];
  captureMode?: ContactCaptureMode;
  detailedFields?: ContactCaptureDetailedFields;
  title?: string;
  infoMessage?: string;
  submitLabel?: string;
  onNombreChange: (value: string) => void;
  onTipoContactoChange: (value: ContactoTipoPermitido) => void;
  onDetailedFieldChange?: (field: keyof ContactCaptureDetailedFields, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

type CodigoPostalSatResponse = {
  estado?: { clave?: string; nombre?: string } | string;
  municipio?: { clave?: string; nombre?: string } | string;
  localidad?: { clave?: string; nombre?: string } | string;
};

type ColoniasSatResponse = {
  items?: { colonia: string; texto: string }[];
};

type ColoniaSatOption = {
  clave: string;
  nombre: string;
};

const normalizeNombre = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const candidate = value as { nombre?: string; texto?: string; clave?: string };
    return candidate.nombre || candidate.texto || candidate.clave || '';
  }
  return '';
};

export default function ContactCaptureDialog({
  open,
  loading,
  nombre,
  tipoContacto,
  tiposPermitidos = ['Lead', 'Cliente'],
  captureMode = 'simple',
  detailedFields,
  title = 'Crear cliente',
  submitLabel = 'Crear y asignar',
  onNombreChange,
  onTipoContactoChange,
  onDetailedFieldChange,
  onClose,
  onSubmit,
}: ContactCaptureDialogProps) {
  const isDetailedMode = captureMode === 'detailed';
  const shouldShowTipoContactoSelector = tiposPermitidos.length > 1;
  const [cpLookupLoading, setCpLookupLoading] = useState(false);
  const [cpLookupError, setCpLookupError] = useState<string | null>(null);
  const [coloniaOptions, setColoniaOptions] = useState<ColoniaSatOption[]>([]);

  useEffect(() => {
    if (!open || !isDetailedMode || !detailedFields || !onDetailedFieldChange) {
      setCpLookupLoading(false);
      setCpLookupError(null);
      setColoniaOptions([]);
      return;
    }

    const cp = detailedFields.cp.trim();
    if (cp.length !== 5) {
      setCpLookupLoading(false);
      setCpLookupError(null);
      setColoniaOptions([]);
      return;
    }

    let active = true;

    const loadCpData = async () => {
      setCpLookupLoading(true);
      setCpLookupError(null);

      try {
        const data = await apiFetch<CodigoPostalSatResponse>(`/api/sat/codigos-postales/${cp}`);
        if (!active) return;

        const estadoNombre = normalizeNombre(data.estado);
        const ciudadNombre = normalizeNombre(data.localidad || data.municipio);

        if (estadoNombre && detailedFields.estado !== estadoNombre) {
          onDetailedFieldChange('estado', estadoNombre);
        }
        if (ciudadNombre && detailedFields.ciudad !== ciudadNombre) {
          onDetailedFieldChange('ciudad', ciudadNombre);
        }

        try {
          const coloniasData = await apiFetch<ColoniasSatResponse>(`/api/sat/colonias/${cp}`);
          if (!active) return;

          const options = (coloniasData.items || []).map((item) => ({
            clave: item.colonia,
            nombre: item.texto,
          }));

          setColoniaOptions(options);

          if (options.length === 1) {
            const coloniaSugerida = options[0]?.nombre?.trim() || '';
            if (coloniaSugerida && detailedFields.colonia !== coloniaSugerida) {
              onDetailedFieldChange('colonia', coloniaSugerida);
            }
          } else if (options.length > 1) {
            const coloniaActualEsValida = options.some((option) => option.nombre === detailedFields.colonia.trim());
            if (!coloniaActualEsValida && detailedFields.colonia.trim()) {
              onDetailedFieldChange('colonia', '');
            }
          } else if (detailedFields.colonia.trim()) {
            setColoniaOptions([]);
          }
        } catch {
          if (active) {
            setColoniaOptions([]);
          }
          // Si no hay colonia SAT, el usuario puede seguir capturando manualmente.
        }
      } catch {
        if (!active) return;
        setCpLookupError('No se encontro informacion para ese codigo postal');
        setColoniaOptions([]);
      } finally {
        if (active) {
          setCpLookupLoading(false);
        }
      }
    };

    void loadCpData();

    return () => {
      active = false;
    };
  }, [open, isDetailedMode, detailedFields?.cp, onDetailedFieldChange]);

  return (
    <Dialog open={open} onClose={() => { if (!loading) onClose(); }} fullWidth maxWidth="xs" data-contact-capture-mode={captureMode}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5, overflow: 'visible' }}>
        <TextField
          label="Nombre"
          size="small"
          autoFocus
          autoComplete="new-password"
          name="contacto_inline_nombre"
          value={nombre}
          onChange={(event) => onNombreChange(event.target.value)}
          disabled={loading}
          sx={{ mt: 0.5 }}
          InputLabelProps={{ sx: { overflow: 'visible' } }}
          inputProps={{
            autoComplete: 'new-password',
            'data-lpignore': 'true',
            'data-1p-ignore': 'true',
          }}
        />
        {shouldShowTipoContactoSelector ? (
          <TextField
            select
            label="Tipo de contacto"
            size="small"
            value={tipoContacto}
            onChange={(event) => onTipoContactoChange(event.target.value as ContactoTipoPermitido)}
            disabled={loading}
          >
            {tiposPermitidos.map((tipoPermitido) => (
              <MenuItem key={tipoPermitido} value={tipoPermitido}>{tipoPermitido}</MenuItem>
            ))}
          </TextField>
        ) : null}
        {isDetailedMode && detailedFields && onDetailedFieldChange ? (
          <>
            <TextField
              label="Teléfono"
              size="small"
              value={detailedFields.telefono}
              onChange={(event) => onDetailedFieldChange('telefono', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Correo"
              size="small"
              type="email"
              value={detailedFields.email}
              onChange={(event) => onDetailedFieldChange('email', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Calle"
              size="small"
              value={detailedFields.calle}
              onChange={(event) => onDetailedFieldChange('calle', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Número exterior"
              size="small"
              value={detailedFields.numeroExterior}
              onChange={(event) => onDetailedFieldChange('numeroExterior', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Número interior"
              size="small"
              value={detailedFields.numeroInterior}
              onChange={(event) => onDetailedFieldChange('numeroInterior', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Código postal"
              size="small"
              value={detailedFields.cp}
              onChange={(event) => onDetailedFieldChange('cp', event.target.value)}
              disabled={loading}
              error={Boolean(cpLookupError)}
              helperText={cpLookupError || 'Al capturar 5 digitos se intentara autocompletar colonia, ciudad y estado'}
              InputProps={{
                endAdornment: cpLookupLoading ? <CircularProgress size={18} /> : undefined,
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select={coloniaOptions.length > 1}
              label="Colonia"
              size="small"
              value={detailedFields.colonia}
              onChange={(event) => onDetailedFieldChange('colonia', event.target.value)}
              disabled={loading}
              helperText={coloniaOptions.length > 1 ? 'Selecciona una colonia' : undefined}
              InputLabelProps={{ shrink: true }}
            >
              {coloniaOptions.length > 1
                ? coloniaOptions.map((option) => (
                    <MenuItem key={option.clave} value={option.nombre}>
                      {option.nombre}
                    </MenuItem>
                  ))
                : null}
            </TextField>
            <TextField
              label="Ciudad"
              size="small"
              value={detailedFields.ciudad}
              onChange={(event) => onDetailedFieldChange('ciudad', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Estado"
              size="small"
              value={detailedFields.estado}
              onChange={(event) => onDetailedFieldChange('estado', event.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
          </>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading}>
          {loading ? 'Creando...' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}