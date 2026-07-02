import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  type SxProps,
  type Theme,
} from '@mui/material';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';

interface ObservacionesEncabezadoCampoProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

export default function ObservacionesEncabezadoCampo({
  label,
  value,
  onChange,
  disabled,
  sx = {},
}: ObservacionesEncabezadoCampoProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleOpen = () => {
    if (disabled) return;
    setDraft(value || '');
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSave = () => {
    onChange(draft);
    setOpen(false);
  };

  const resumen = (value || '').replace(/\s+/g, ' ').trim();

  return (
    <>
      <TextField
        label={label}
        value={resumen}
        placeholder="Sin observaciones"
        onClick={handleOpen}
        disabled={Boolean(disabled)}
        fullWidth
        size="small"
        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
        InputProps={{
          readOnly: true,
          sx: {
            fontSize: 13,
            cursor: disabled ? 'default' : 'pointer',
            '& .MuiInputBase-input': { cursor: disabled ? 'default' : 'pointer' },
          },
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                disabled={Boolean(disabled)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpen();
                }}
                aria-label="Editar observaciones"
                color={value?.trim() ? 'primary' : 'default'}
              >
                <CommentIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={sx}
      />
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{label}</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            multiline
            minRows={8}
            maxRows={16}
            fullWidth
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Texto adicional para impresión"
            variant="outlined"
            InputProps={{ sx: { fontSize: 13 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
