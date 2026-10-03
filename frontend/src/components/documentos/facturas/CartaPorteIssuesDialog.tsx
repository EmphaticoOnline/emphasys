import { Box, Button, Dialog, Stack, Typography, useTheme } from '@mui/material';
import type { CartaPorteIssue, CartaPorteIssueSection } from '../../../services/transporte.api';

const ETIQUETA_CARTA_PORTE: Record<CartaPorteIssueSection, string> = {
  ruta: 'Ruta',
  unidad: 'Unidad / Remolques',
  operador: 'Operador',
  mercancias: 'Mercancías',
  generales: 'Datos generales',
};

type Props = {
  issues: CartaPorteIssue[] | null;
  onClose: () => void;
};

/** Diálogo de issues agrupados cuando la Carta Porte impide timbrar. */
export default function CartaPorteIssuesDialog({ issues, onClose }: Props) {
  const tokens = useTheme().emphasys;
  const grupos = (issues ?? []).reduce<Record<string, CartaPorteIssue[]>>((acc, issue) => {
    const clave = issue.section || 'generales';
    acc[clave] = [...(acc[clave] ?? []), issue];
    return acc;
  }, {});

  return (
    <Dialog
      open={issues != null}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: tokens.content.elevated,
          backgroundImage: 'none',
          color: tokens.content.foreground,
          border: `1px solid ${tokens.content.border}`,
          borderRadius: 2,
          boxShadow: '0 18px 48px rgba(62, 52, 40, 0.16)',
        },
      }}
    >
      <Box sx={{ px: 3, pt: 2.75, pb: 2.5 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: tokens.content.foreground }}>
          No se timbró el CFDI
        </Typography>
        <Typography sx={{ mt: 1.25, fontSize: 14, lineHeight: 1.45, color: tokens.content.secondary }}>
          La Carta Porte todavía tiene datos pendientes. Corrígelos en el Viaje y vuelve a timbrar.
        </Typography>
        <Stack spacing={1} sx={{ mt: 2, maxHeight: 320, overflowY: 'auto' }}>
          {Object.entries(grupos).map(([section, list]) => (
            <Box key={section} sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, p: 1.25, bgcolor: tokens.content.well }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.action.destructive }}>
                {ETIQUETA_CARTA_PORTE[section as CartaPorteIssueSection] ?? section} ({list.length})
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                {list.map((issue, index) => (
                  <li key={`${section}-${index}`}>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: tokens.content.foreground }}>{issue.message}</Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2.5 }}>
          <Button
            onClick={onClose}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              px: 2,
              bgcolor: tokens.action.primary,
              color: tokens.action.primaryForeground,
              '&:hover': { bgcolor: tokens.action.primaryHover },
            }}
          >
            Cerrar
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
