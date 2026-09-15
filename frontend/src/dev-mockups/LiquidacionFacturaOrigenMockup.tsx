import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';

const NAVY = '#1d2f68';
const BORDER = '#d7dde7';
const LABEL = '#8b93a7';
const SUCCESS = '#2e7d32';
const AMBER = '#b45309';

export type LiquidacionFacturaOrigenMockupProps = {
  folio?: string;
  fecha?: string;
  saldoPendiente?: string;
  aplicar?: string;
  restanteLabel?: string;
  cubierta?: boolean;
};

function FieldCaption({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: LABEL,
        lineHeight: 1,
        mb: 0.6,
      }}
    >
      {children}
    </Typography>
  );
}

export default function LiquidacionFacturaOrigenMockup({
  folio = 'N-001',
  fecha = '04/09/2026',
  saldoPendiente = '$7,500.00',
  aplicar = '$7,500.00',
  restanteLabel = 'Cubierta',
  cubierta = true,
}: LiquidacionFacturaOrigenMockupProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '158px minmax(0, 1fr)' },
        border: `1px solid ${BORDER}`,
        borderRadius: '8px',
        overflow: 'hidden',
        bgcolor: '#fff',
        minHeight: { xs: 0, sm: 78 },
      }}
    >
      <Box
        sx={{
          bgcolor: NAVY,
          color: '#fff',
          px: 1.5,
          py: { xs: 1, sm: 1.15 },
          display: 'flex',
          flexDirection: { xs: 'row', sm: 'column' },
          justifyContent: { xs: 'space-between', sm: 'center' },
          alignItems: { xs: 'center', sm: 'flex-start' },
          gap: { xs: 1, sm: 0.7 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {folio}
          </Typography>
          <Typography
            sx={{
              mt: 0.45,
              display: 'inline-block',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              bgcolor: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.28)',
              px: 0.7,
              py: 0.2,
              borderRadius: '3px',
            }}
          >
            Esta factura
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, fontWeight: 500, opacity: 0.78, whiteSpace: 'nowrap' }}>
          {fecha}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(108px, 0.9fr) minmax(220px, 1.35fr) minmax(108px, 0.95fr)',
          },
          columnGap: 1.5,
          rowGap: 1.1,
          alignItems: 'center',
          px: { xs: 1.25, md: 1.75 },
          py: { xs: 1.15, md: 0 },
        }}
      >
        <Box>
          <FieldCaption>Saldo pendiente</FieldCaption>
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 800,
              color: NAVY,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
            }}
          >
            {saldoPendiente}
          </Typography>
        </Box>

        <Box>
          <FieldCaption>Aplicar</FieldCaption>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <TextField
              hiddenLabel
              size="small"
              value={aplicar}
              InputProps={{ readOnly: true }}
              sx={{
                width: { xs: '100%', sm: 148 },
                '& .MuiOutlinedInput-root': {
                  height: 40,
                  bgcolor: '#fff',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  '& fieldset': { borderColor: '#cbd5e1' },
                  '&:hover fieldset': { borderColor: NAVY },
                },
                '& .MuiOutlinedInput-input': {
                  py: 0,
                  height: 40,
                  boxSizing: 'border-box',
                  textAlign: 'right',
                  fontWeight: 700,
                  fontSize: 14,
                  color: NAVY,
                  fontVariantNumeric: 'tabular-nums',
                  backgroundColor: '#fff',
                },
              }}
            />
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
              sx={{
                height: 40,
                px: 1.35,
                bgcolor: NAVY,
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                borderRadius: '6px',
                '&:hover': { bgcolor: '#162551' },
              }}
            >
              Cubrir
            </Button>
          </Stack>
        </Box>

        <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
          <FieldCaption>Saldo restante</FieldCaption>
          <Typography
            sx={{
              display: 'inline-block',
              fontSize: cubierta ? 11 : 14,
              fontWeight: 800,
              letterSpacing: cubierta ? '0.06em' : 0,
              textTransform: cubierta ? 'uppercase' : 'none',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
              color: cubierta ? SUCCESS : AMBER,
              bgcolor: cubierta ? 'rgba(46,125,50,0.08)' : 'transparent',
              border: cubierta ? '1px solid rgba(46,125,50,0.22)' : 'none',
              px: cubierta ? 0.85 : 0,
              py: cubierta ? 0.45 : 0,
              borderRadius: '4px',
            }}
          >
            {restanteLabel}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
