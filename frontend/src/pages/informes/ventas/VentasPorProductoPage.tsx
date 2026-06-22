import VolumenProductoPage from '../VolumenProductoPage';
import {
  fetchVentasPorProducto,
  buildVentasPorProductoExportUrl,
} from '../../../services/reportesService';
import type { VolumenProductoPageConfig } from '../VolumenProductoPage';

const CONFIG: VolumenProductoPageConfig = {
  titulo: 'Ventas por Producto',
  descripcion: 'Volumen de ventas por artículo durante un período determinado.',
  categoriaLabel: 'Ventas',
  contactoLabel: 'Cliente',
  ultimoPrecioLabel: 'Último precio',
  totalLabel: 'Total vendido',
  tiposContacto: ['cliente', 'varios'],
  fetchFn: fetchVentasPorProducto,
  buildExportUrl: buildVentasPorProductoExportUrl,
};

export default function VentasPorProductoPage() {
  return <VolumenProductoPage config={CONFIG} />;
}
