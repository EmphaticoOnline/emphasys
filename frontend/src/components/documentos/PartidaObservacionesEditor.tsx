import { useRef } from 'react';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import RichTextEditor, { type RichTextEditorHandle } from '../RichTextEditor';
import { isRichTextEmpty } from '../../utils/richText';
import type { Producto } from '../../types/producto';

interface PartidaObservacionesEditorProps {
  value: string;
  onChange: (html: string) => void;
  producto?: Producto | null;
  disabled?: boolean;
}

export default function PartidaObservacionesEditor({ value, onChange, producto, disabled }: PartidaObservacionesEditorProps) {
  const editorRef = useRef<RichTextEditorHandle>(null);

  const especificaciones = producto?.especificaciones ?? null;
  const tieneEspecificaciones = !isRichTextEmpty(especificaciones);

  const handleUsarEspecificaciones = () => {
    if (!especificaciones || !tieneEspecificaciones) return;

    if (!isRichTextEmpty(value)) {
      const confirmado = window.confirm(
        'Esta partida ya tiene observaciones. ¿Quieres reemplazarlas con las especificaciones del producto?'
      );
      if (!confirmado) return;
    }

    editorRef.current?.setContent(especificaciones);
  };

  return (
    <Stack spacing={1}>
      {producto && (
        <Box>
          <Tooltip title={tieneEspecificaciones ? '' : 'El producto no tiene especificaciones capturadas.'}>
            <span>
              <Button
                size="small"
                variant="text"
                startIcon={<PostAddOutlinedIcon fontSize="small" />}
                onClick={handleUsarEspecificaciones}
                disabled={Boolean(disabled) || !tieneEspecificaciones}
                sx={{ textTransform: 'none', fontSize: 12.5 }}
              >
                Usar especificaciones del producto
              </Button>
            </span>
          </Tooltip>
        </Box>
      )}
      <RichTextEditor
        ref={editorRef}
        content={value}
        onChange={onChange}
        placeholder="Texto adicional para impresión"
        minHeight={140}
      />
    </Stack>
  );
}
