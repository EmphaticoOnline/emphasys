import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ForumIcon from '@mui/icons-material/Forum';
import type { SvgIconComponent } from '@mui/icons-material';

type Reporte = {
  label: string;
  descripcion: string;
  path: string;
};

type Categoria = {
  label: string;
  icon: SvgIconComponent;
  color: string;
  reportes: Reporte[];
};

const CATEGORIAS: Categoria[] = [
  {
    label: 'Compras',
    icon: ShoppingCartIcon,
    color: '#1d2f68',
    reportes: [
      {
        label: 'Compras por Proveedor',
        descripcion: 'Volumen y participación de compras por proveedor en un período.',
        path: '/informes/compras/compras-por-proveedor',
      },
      {
        label: 'Estado de Cuenta de Proveedor',
        descripcion: 'Saldo y movimientos por proveedor en un período.',
        path: '/informes/compras/estado-cuenta-proveedor',
      },
    ],
  },
  {
    label: 'Ventas',
    icon: PointOfSaleIcon,
    color: '#006261',
    reportes: [
      {
        label: 'Estado de Cuenta de Cliente',
        descripcion: 'Saldo y movimientos por cliente en un período.',
        path: '/informes/ventas/estado-cuenta-cliente',
      },
    ],
  },
  {
    label: 'Inventario',
    icon: InventoryIcon,
    color: '#7c3aed',
    reportes: [],
  },
  {
    label: 'Finanzas',
    icon: AccountBalanceIcon,
    color: '#b45309',
    reportes: [],
  },
  {
    label: 'CRM',
    icon: ForumIcon,
    color: '#0369a1',
    reportes: [],
  },
];

const IA_ITEM: Categoria = {
  label: 'Consultas con IA',
  icon: PsychologyIcon,
  color: '#6d28d9',
  reportes: [
    {
      label: 'Pregúntale a tu negocio',
      descripcion: 'Genera reportes en lenguaje natural con inteligencia artificial.',
      path: '/informes/ia',
    },
  ],
};

export default function InformesPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={0.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon sx={{ color: '#1d2f68', fontSize: 28 }} />
          <Typography variant="h4" fontWeight={700} color="text.primary">
            Informes
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Selecciona una categoría para acceder a los reportes disponibles.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {CATEGORIAS.map((cat) => (
          <CategoriaCard key={cat.label} categoria={cat} onNavigate={navigate} />
        ))}
        <CategoriaCard key={IA_ITEM.label} categoria={IA_ITEM} onNavigate={navigate} />
      </Box>
    </Box>
  );
}

function CategoriaCard({
  categoria,
  onNavigate,
}: {
  categoria: Categoria;
  onNavigate: (path: string) => void;
}) {
  const Icon = categoria.icon;
  const tieneReportes = categoria.reportes.length > 0;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: 'divider',
        '&:hover': tieneReportes ? { borderColor: categoria.color, boxShadow: 1 } : {},
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.5,
              bgcolor: `${categoria.color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ color: categoria.color, fontSize: 18 }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            {categoria.label}
          </Typography>
          {!tieneReportes && (
            <Chip label="Próximamente" size="small" sx={{ fontSize: 10, height: 18, ml: 'auto' }} />
          )}
        </Stack>

        {tieneReportes && (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Stack spacing={0.5}>
              {categoria.reportes.map((r) => (
                <CardActionArea
                  key={r.path}
                  onClick={() => onNavigate(r.path)}
                  sx={{ borderRadius: 1, px: 1, py: 0.75 }}
                >
                  <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={600} color={categoria.color}>
                      {r.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.descripcion}
                    </Typography>
                  </Stack>
                </CardActionArea>
              ))}
            </Stack>
          </>
        )}

        {!tieneReportes && (
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            No hay reportes disponibles aún en esta categoría.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
