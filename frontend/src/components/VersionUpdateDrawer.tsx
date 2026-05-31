import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import UpdateIcon from '@mui/icons-material/SystemUpdateAlt';
type VersionUpdateDrawerProps = {
  open: boolean;
  version: string | null;
  onClose: () => void;
  onUpdateNow: () => void;
};

export default function VersionUpdateDrawer({ open, version, onClose, onUpdateNow }: VersionUpdateDrawerProps) {

  return (
    <Drawer
      anchor="bottom"
      open={open}
      hideBackdrop
      ModalProps={{
        keepMounted: true,
        disableAutoFocus: true,
        disableEnforceFocus: true,
        disableScrollLock: true,
      }}
      sx={{
        pointerEvents: 'none',
        zIndex: (theme) => theme.zIndex.modal + 1,
        '& .MuiDrawer-paper': {
          pointerEvents: 'auto',
          background: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
        },
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 }, pt: 0, display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 760,
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(29, 47, 104, 0.16)',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <IconButton
            aria-label="Cerrar aviso de actualización"
            onClick={onClose}
            size="small"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1,
              color: 'text.secondary',
              backgroundColor: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,1)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Box sx={{ height: 4, background: 'linear-gradient(90deg, #1d2f68 0%, #3b82f6 100%)' }} />
          <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.25} alignItems={{ sm: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  backgroundColor: 'rgba(29, 47, 104, 0.08)',
                  color: '#1d2f68',
                }}
              >
                <UpdateIcon sx={{ fontSize: 26 }} />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Actualización disponible
                </Typography>
                <Typography sx={{ mt: 0.5, color: 'text.secondary' }}>
                  Se han realizado mejoras en Emphasys.
                </Typography>
                <Typography sx={{ mt: 0.25, color: 'text.secondary' }}>
                  Para utilizar la versión más reciente, actualiza la página.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0, mr: { sm: 1.5 } }}>
                <Button
                  variant="contained"
                  onClick={onUpdateNow}
                  sx={{ textTransform: 'none', minWidth: 156, boxShadow: 'none' }}
                >
                  Actualizar ahora
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}