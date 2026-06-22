import VolumenProductoPage from '../VolumenProductoPage';
import {
  fetchComprasPorProducto,
  buildComprasPorProductoExportUrl,
} from '../../../services/reportesService';
import type { VolumenProductoPageConfig } from '../VolumenProductoPage';

const CONFIG: VolumenProductoPageConfig = {
  titulo: 'Compras por Producto',
  descripcion: 'Volumen de compras por artículo durante un período determinado.',
  categoriaLabel: 'Compras',
  contactoLabel: 'Proveedor',
  ultimoPrecioLabel: 'Último costo',
  totalLabel: 'Total comprado',
  tiposContacto: ['proveedor', 'varios'],
  fetchFn: fetchComprasPorProducto,
  buildExportUrl: buildComprasPorProductoExportUrl,
};

export default function ComprasPorProductoPage() {
  return <VolumenProductoPage config={CONFIG} />;
}
