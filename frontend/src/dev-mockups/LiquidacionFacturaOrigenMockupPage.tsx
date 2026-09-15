import { Box, Stack, Typography } from '@mui/material';
import LiquidacionFacturaOrigenMockup from './LiquidacionFacturaOrigenMockup';

const NAVY = '#1d2f68';

function FakeField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <Box sx={{ minWidth: 0, gridColumn: wide ? '1 / -1' : 'auto' }}>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#8b93a7',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          height: 40,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: wide ? 'flex-start' : 'flex-end',
          bgcolor: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          color: '#94a3b8',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

export default function LiquidacionFacturaOrigenMockupPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#cfd6e0', py: { xs: 2, md: 4 }, px: 2 }}>
      <Box
        sx={{
          width: { xs: '100%', md: '80vw', lg: '74vw', xl: '70vw' },
          maxWidth: 1120,
          mx: 'auto',
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NAVY, mb: 1 }}>
          Dev mockup · no productivo
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#475569', mb: 2, maxWidth: 640 }}>
          Propuesta visual de FACTURA ORIGEN, montada en un cascarón del modal actual. Los campos de arriba son estáticos y no interactúan.
        </Typography>

        <Box
          sx={{
            bgcolor: '#f4f6f9',
            borderRadius: { xs: 0, md: 2 },
            overflow: 'hidden',
            border: '1px solid #d7dde7',
          }}
        >
          <Box sx={{ bgcolor: '#fff', px: 2.25, py: 1.25, borderBottom: '1px solid #e5e7eb' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>
              Cobro a N-001
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Cliente · Acme Industrial</Typography>
          </Box>

          <Box sx={{ p: { xs: 1.5, md: 2 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.25,
                mb: 1.75,
                opacity: 0.55,
                pointerEvents: 'none',
              }}
            >
              <FakeField label="Cobro recibido" value="$7,500.00" />
              <FakeField label="Fecha" value="14/09/2026" />
              <FakeField label="Cuenta / caja / banco" value="Banorte · Operativa" />
              <FakeField label="Forma de pago" value="03 Transferencia" />
              <FakeField label="Observaciones" value="Opcional" wide />
            </Box>

            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8b93a7',
                mb: 0.75,
              }}
            >
              Factura origen
            </Typography>
            <LiquidacionFacturaOrigenMockup />
          </Box>
        </Box>

        <Stack spacing={1.25} sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NAVY }}>
            Variante · con saldo restante
          </Typography>
          <Box sx={{ bgcolor: '#f4f6f9', border: '1px solid #d7dde7', borderRadius: 2, p: 1.5 }}>
            <LiquidacionFacturaOrigenMockup
              aplicar="$5,500.00"
              restanteLabel="Resta $2,000.00"
              cubierta={false}
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
