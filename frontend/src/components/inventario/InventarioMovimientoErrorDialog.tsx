import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, useTheme } from '@mui/material';
import { useBrand } from '../../theme/brand/useBrand';

export type InventarioMovimientoError = {
  title: string;
  message: string;
  details?: Array<{ label: string; value: string }>;
};

export default function InventarioMovimientoErrorDialog({ error, onClose }: { error: InventarioMovimientoError | null; onClose: () => void }) {
  const { brandElevation } = useBrand();
  const tokens = useTheme().emphasys;
  return (
    <Dialog open={error != null} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: tokens.content.elevated, backgroundImage: 'none', color: tokens.content.foreground, border: `1px solid ${tokens.content.border}`, borderRadius: 2, boxShadow: brandElevation.dialog } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 19, fontWeight: 700 }}>
        <WarningAmberRoundedIcon sx={{ color: tokens.action.destructive }} />
        {error?.title}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: tokens.content.secondary, lineHeight: 1.5 }}>{error?.message}</Typography>
        {error?.details?.length ? (
          <Stack spacing={0.5} sx={{ mt: 2, p: 1.25, borderRadius: 1.5, bgcolor: tokens.content.well, border: `1px solid ${tokens.content.border}` }}>
            {error.details.map((detail) => <Box key={detail.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography sx={{ color: tokens.content.secondary, fontSize: 13 }}>{detail.label}</Typography><Typography sx={{ color: tokens.content.foreground, fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{detail.value}</Typography></Box>)}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, bgcolor: tokens.action.primary, color: tokens.action.primaryForeground, '&:hover': { bgcolor: tokens.action.primaryHover } }}>Entendido</Button>
      </DialogActions>
    </Dialog>
  );
}
