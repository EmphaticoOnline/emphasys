import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import type { ProductoCaptureMode, ProductoTipoPermitido } from '../../modules/documentos/documentoTypes';

export type ProductoCaptureDialogProps = {
  open: boolean;
  loading: boolean;
  clave: string;
  claveError?: string | null;
  descripcion: string;
  tipoProducto: ProductoTipoPermitido;
  tiposPermitidos?: ProductoTipoPermitido[];
  captureMode?: ProductoCaptureMode;
  title?: string;
  submitLabel?: string;
  onClaveChange: (value: string) => void;
  onDescripcionChange: (value: string) => void;
  onTipoProductoChange: (value: ProductoTipoPermitido) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ProductoCaptureDialog({
  open,
  loading,
  clave,
  claveError,
  descripcion,
  tipoProducto,
  tiposPermitidos = ['Inventariable', 'No inventariable', 'Kit'],
  captureMode = 'simple',
  title = 'Crear producto rapido',
  submitLabel = 'Crear y asignar',
  onClaveChange,
  onDescripcionChange,
  onTipoProductoChange,
  onClose,
  onSubmit,
}: ProductoCaptureDialogProps) {
  return (
    <Dialog open={open} onClose={() => { if (!loading) onClose(); }} fullWidth maxWidth="sm" data-product-capture-mode={captureMode}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          label="Clave"
          size="small"
          autoFocus
          value={clave}
          onChange={(event) => onClaveChange(event.target.value)}
          disabled={loading}
          error={Boolean(claveError)}
          helperText={claveError || 'Si la dejas vacia, se generara automaticamente.'}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Descripcion"
          size="small"
          value={descripcion}
          onChange={(event) => onDescripcionChange(event.target.value)}
          disabled={loading}
          multiline
          minRows={2}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          select
          label="Tipo de producto"
          size="small"
          value={tipoProducto}
          onChange={(event) => onTipoProductoChange(event.target.value as ProductoTipoPermitido)}
          disabled={loading}
        >
          {tiposPermitidos.map((tipoPermitido) => (
            <MenuItem key={tipoPermitido} value={tipoPermitido}>{tipoPermitido}</MenuItem>
          ))}
        </TextField>
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