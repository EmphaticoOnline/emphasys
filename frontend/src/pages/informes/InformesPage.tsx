import { useNavigate } from 'react-router-dom';
import {
  Box,
  ButtonBase,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CalculateIcon from '@mui/icons-material/Calculate';
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
  reportes: Reporte[];
};

const CATEGORIAS: Categoria[] = [
  {
    label: 'Ventas',
    icon: PointOfSaleIcon,
    reportes: [
      {
        label: 'Ventas por Cliente',
        descripcion: 'Volumen y participación de ventas por cliente en un período.',
        path: '/informes/ventas/ventas-por-cliente',
      },
      {
        label: 'Ventas por Vendedor',
        descripcion: 'Volumen y participación de ventas por vendedor en un período.',
        path: '/informes/ventas/ventas-por-vendedor',
      },
      {
        label: 'Ventas por Producto',
        descripcion: 'Volumen, cantidad y precio por artículo vendido en un período.',
        path: '/informes/ventas/ventas-por-producto',
      },
      {
        label: 'Estado de Cuenta de Cliente',
        descripcion: 'Saldo y movimientos por cliente en un período.',
        path: '/informes/ventas/estado-cuenta-cliente',
      },
      {
        label: 'Historial de Precios de Venta',
        descripcion: 'Evolución de precios unitarios por producto y cliente en un período.',
        path: '/informes/ventas/historial-precios',
      },
      {
        label: 'Ventas por Período',
        descripcion: 'Evolución temporal de ventas. Identifica tendencias, estacionalidad y períodos clave.',
        path: '/informes/ventas/ventas-por-periodo',
      },
      {
        label: 'Ventas por Origen de Contacto',
        descripcion: 'Distribución y participación de ventas por origen del contacto.',
        path: '/informes/ventas/ventas-por-origen-contacto',
      },
      {
        label: 'Conversión de Cotizaciones a Ventas',
        descripcion: 'Mide cuántas cotizaciones se convierten en factura por vendedor y período.',
        path: '/informes/ventas/conversion-cotizaciones',
      },
      {
        label: 'Pedidos Pendientes de Facturar',
        descripcion: 'Pedidos con importe aún no cubierto mediante facturas de venta.',
        path: '/informes/ventas/pedidos-pendientes-facturar',
      },
      {
        label: 'Remisiones Pendientes de Facturar',
        descripcion: 'Remisiones con importe aún no cubierto mediante facturas de venta.',
        path: '/informes/ventas/remisiones-pendientes-facturar',
      },
    ],
  },
  {
    label: 'Compras',
    icon: ShoppingCartIcon,
    reportes: [
      {
        label: 'Compras por Proveedor',
        descripcion: 'Volumen y participación de compras por proveedor en un período.',
        path: '/informes/compras/compras-por-proveedor',
      },
      {
        label: 'Compras por Producto',
        descripcion: 'Volumen, cantidad y costo por artículo comprado en un período.',
        path: '/informes/compras/compras-por-producto',
      },
      {
        label: 'OC Pendientes de Recibir',
        descripcion: 'Órdenes de compra con cantidades pendientes de materializar en inventario.',
        path: '/informes/compras/oc-pendientes-recibir',
      },
      {
        label: 'Estado de Cuenta de Proveedor',
        descripcion: 'Saldo y movimientos por proveedor en un período.',
        path: '/informes/compras/estado-cuenta-proveedor',
      },
      {
        label: 'Historial de Precios de Compra',
        descripcion: 'Evolución de costos unitarios por producto y proveedor en un período.',
        path: '/informes/compras/historial-precios',
      },
      {
        label: 'Compras por Período',
        descripcion: 'Evolución temporal de compras. Identifica tendencias, estacionalidad y períodos clave.',
        path: '/informes/compras/compras-por-periodo',
      },
    ],
  },
  {
    label: 'Inventario',
    icon: InventoryIcon,
    reportes: [
      {
        label: 'Existencias por Almacén',
        descripcion: 'Inventario actual por producto y almacén con existencia, mínimos y valor económico.',
        path: '/informes/inventario/existencias-por-almacen',
      },
      {
        label: 'Kardex de Producto',
        descripcion: 'Historial cronológico de movimientos de un producto con saldo acumulado.',
        path: '/informes/inventario/kardex',
      },
      {
        label: 'Movimientos de Inventario',
        descripcion: 'Auditoría de entradas y salidas de inventario en un período de tiempo.',
        path: '/informes/inventario/movimientos',
      },
      {
        label: 'Productos Bajo Mínimo',
        descripcion: 'Productos cuya existencia actual está por debajo del mínimo configurado.',
        path: '/informes/inventario/bajo-minimo',
      },
      {
        label: 'Inventario Valorizado',
        descripcion: 'Valor económico del inventario actual usando costo promedio, último o estándar.',
        path: '/informes/inventario/valorizado',
      },
    ],
  },
  {
    label: 'Finanzas',
    icon: AccountBalanceIcon,
    reportes: [
      {
        label: 'Vencimientos de Proveedores',
        descripcion: 'Facturas de compra pendientes de pago ordenadas por fecha de vencimiento.',
        path: '/informes/finanzas/vencimientos-proveedores',
      },
      {
        label: 'Vencimientos de Clientes',
        descripcion: 'Facturas de venta pendientes de cobro ordenadas por fecha de vencimiento.',
        path: '/informes/finanzas/vencimientos-clientes',
      },
      {
        label: 'Pagos Recibidos (Clientes)',
        descripcion: 'Cobros registrados a clientes en un período, con filtro por cuenta.',
        path: '/informes/finanzas/pagos-clientes',
      },
      {
        label: 'Pagos a Proveedores',
        descripcion: 'Pagos realizados a proveedores en un período, con filtro por cuenta.',
        path: '/informes/finanzas/pagos-proveedores',
      },
      {
        label: 'Posición de Tesorería',
        descripcion: 'Saldos actuales de todas las cuentas bancarias y de efectivo.',
        path: '/informes/finanzas/posicion-tesoreria',
      },
      {
        label: 'Cartera Vencida',
        descripcion: 'Antigüedad de saldos por cobrar (aging) con fecha base configurable.',
        path: '/informes/finanzas/cartera-vencida',
      },
      {
        label: 'Movimientos No Conciliados',
        descripcion: 'Operaciones bancarias pendientes o cotejadas sin conciliar, con días de antigüedad.',
        path: '/informes/finanzas/movimientos-no-conciliados',
      },
    ],
  },
  {
    label: 'Contabilidad',
    icon: CalculateIcon,
    reportes: [
      {
        label: 'Balanza Analítica',
        descripcion: 'Saldo inicial, cargos, abonos y saldo final por cuenta en un periodo o rango.',
        path: '/informes/contabilidad/balanza-analitica',
      },
      {
        label: 'Estado de Resultados',
        descripcion: 'Ingresos, egresos y utilidad o pérdida del periodo.',
        path: '/informes/contabilidad/estado-resultados',
      },
      {
        label: 'Balance General',
        descripcion: 'Situación financiera acumulada al cierre de un periodo: activo, pasivo y capital.',
        path: '/informes/contabilidad/balance-general',
      },
    ],
  },
  {
    label: 'CRM',
    icon: ForumIcon,
    reportes: [
      {
        label: 'Evaluación de vendedores',
        descripcion: 'Conversaciones, respuestas evaluables, tiempos de respuesta y pendientes por vendedor.',
        path: '/informes/crm/evaluacion-vendedores',
      },
    ],
  },
];

const IA_ITEM: Categoria = {
  label: 'Consultas con IA',
  icon: PsychologyIcon,
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
  const tokens = useTheme().emphasys;

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: { xs: 1.5, md: 2.75 }, py: 1.6, display: 'flex', flexDirection: 'column', gap: 2.25, bgcolor: tokens.content.background }}>
      <Box>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
          INFORMES
        </Typography>
        <Typography variant="figure" sx={{ mt: 0.35, fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
          Informes
        </Typography>
        <Typography sx={{ mt: 0.7, fontSize: 13, color: tokens.content.secondary }}>
          Selecciona una categoría para acceder a los reportes disponibles.
        </Typography>
      </Box>

      <ResumenEjecutivoDestacado onNavigate={navigate} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 1.25,
          alignItems: 'start',
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

function ResumenEjecutivoDestacado({ onNavigate }: { onNavigate: (path: string) => void }) {
  const tokens = useTheme().emphasys;

  return (
    <ButtonBase
      onClick={() => onNavigate('/informes/resumen-ejecutivo')}
      focusRipple
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        textAlign: 'left',
        px: { xs: 1.6, sm: 1.8 },
        py: 1.5,
        borderRadius: 3,
        border: 'none',
        bgcolor: tokens.metric.amount.background,
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: tokens.action.hoverTint },
        '&.Mui-focusVisible': {
          outline: `2px solid ${tokens.content.foreground}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          bgcolor: tokens.content.card,
          color: tokens.content.foreground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <InsightsOutlinedIcon sx={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>
          Destacado
        </Typography>
        <Typography variant="figure" sx={{ mt: 0.15, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.1, color: tokens.content.foreground }}>
          Resumen ejecutivo
        </Typography>
        <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.content.secondary }}>
          Una lectura inteligente de ventas, cartera y tesorería.
        </Typography>
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.25}
        sx={{ color: tokens.content.foreground, flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
          Ver resumen
        </Typography>
        <ChevronRightIcon fontSize="small" />
      </Stack>
      <ChevronRightIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: tokens.content.foreground, flexShrink: 0 }} />
    </ButtonBase>
  );
}

function CategoriaCard({
  categoria,
  onNavigate,
}: {
  categoria: Categoria;
  onNavigate: (path: string) => void;
}) {
  const tokens = useTheme().emphasys;
  const Icon = categoria.icon;
  const tieneReportes = categoria.reportes.length > 0;

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${tokens.content.border}`,
        bgcolor: tokens.content.card,
        px: 1.6,
        py: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={tieneReportes ? 1.25 : 0.75}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            bgcolor: tokens.action.tint,
            color: tokens.content.foreground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Typography variant="figure" sx={{ fontSize: 18, lineHeight: 1.15, color: tokens.content.foreground }}>
          {categoria.label}
        </Typography>
        {!tieneReportes && (
          <Box
            component="span"
            sx={{
              ml: 'auto !important',
              display: 'inline-flex',
              alignItems: 'center',
              height: 22,
              px: 0.9,
              borderRadius: 99,
              bgcolor: tokens.metric.blocked.background,
              color: tokens.metric.blocked.foreground,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Próximamente
          </Box>
        )}
      </Stack>

      {tieneReportes && (
        <Stack spacing={0.35} sx={{ borderTop: `1px solid ${tokens.content.border}`, pt: 1 }}>
          {categoria.reportes.map((r) => (
            <Box
              key={r.path}
              component="button"
              type="button"
              onClick={() => onNavigate(r.path)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 0,
                borderRadius: 2,
                px: 1,
                py: 0.75,
                bgcolor: 'transparent',
                cursor: 'pointer',
                font: 'inherit',
                color: tokens.content.foreground,
                '&:hover': { bgcolor: tokens.content.hover },
                '&:focus-visible': {
                  outline: `2px solid ${tokens.content.foreground}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.content.foreground }}>
                {r.label}
              </Typography>
              <Typography sx={{ mt: 0.2, fontSize: 12, color: tokens.content.muted }}>
                {r.descripcion}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {!tieneReportes && (
        <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>
          No hay reportes disponibles aún en esta categoría.
        </Typography>
      )}
    </Box>
  );
}
