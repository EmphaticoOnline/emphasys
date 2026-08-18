import * as React from 'react';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import ErrorIcon from '@mui/icons-material/ErrorOutline';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

export type SeccionIndiceEstado = 'disponible' | 'pendiente' | 'error';

export type SeccionIndiceItem = {
  id: string;
  etiqueta: string;
  estado: SeccionIndiceEstado;
  contador?: number | undefined;
};

type Props = {
  secciones: SeccionIndiceItem[];
  activaId: string;
  onSeleccionar: (id: string) => void;
};

/**
 * Índice lateral persistente de secciones del formulario continuo de
 * Producto. Es puramente de presentación: recibe el estado ya calculado
 * por la página (disponible / pendiente-por-id / con-error) y solo hace
 * scroll a la sección correspondiente al hacer click.
 */
export default function SeccionesIndice({ secciones, activaId, onSeleccionar }: Props) {
  let grupoAlGuardarImpreso = false;

  return (
    <Stack
      component="nav"
      spacing={0.25}
      sx={{
        width: { xs: '100%', md: 208 },
        flexShrink: 0,
        position: { md: 'sticky' },
        top: { md: 12 },
        alignSelf: 'flex-start',
      }}
    >
      <Typography
        variant="caption"
        fontWeight={700}
        color="#6b7280"
        sx={{ px: 1, pb: 0.5, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11 }}
      >
        Secciones
      </Typography>

      {secciones.map((seccion) => {
        const mostrarEncabezadoGrupo = seccion.estado === 'pendiente' && !grupoAlGuardarImpreso;
        if (mostrarEncabezadoGrupo) grupoAlGuardarImpreso = true;

        return (
          <React.Fragment key={seccion.id}>
            {mostrarEncabezadoGrupo && (
              <Typography
                variant="caption"
                color="#9ca3af"
                sx={{ px: 1, pt: 1, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                Al guardar
              </Typography>
            )}
            <ButtonBase
              onClick={() => onSeleccionar(seccion.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                width: '100%',
                px: 1,
                py: 0.75,
                borderRadius: 1,
                textAlign: 'left',
                fontSize: 13,
                color: seccion.estado === 'pendiente' ? '#9ca3af' : '#111827',
                backgroundColor: activaId === seccion.id ? 'rgba(29,47,104,0.08)' : 'transparent',
                fontWeight: activaId === seccion.id ? 700 : 500,
                '&:hover': { backgroundColor: 'rgba(29,47,104,0.06)' },
              }}
            >
              {seccion.estado === 'error' && <ErrorIcon sx={{ fontSize: 15, color: '#b91c1c', flexShrink: 0 }} />}
              {seccion.estado === 'pendiente' && (
                <CheckBoxOutlineBlankIcon sx={{ fontSize: 14, color: '#cbd5e1', flexShrink: 0 }} />
              )}
              <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {seccion.etiqueta}
              </Box>
              {seccion.estado !== 'pendiente' && typeof seccion.contador === 'number' && (
                <Box
                  component="span"
                  sx={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6b7280',
                    backgroundColor: '#f1f3f5',
                    borderRadius: 1,
                    px: 0.75,
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {seccion.contador}
                </Box>
              )}
            </ButtonBase>
          </React.Fragment>
        );
      })}
    </Stack>
  );
}
