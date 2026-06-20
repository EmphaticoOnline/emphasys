import VolumenComprasPage from '../VolumenComprasPage';
import {
  fetchComprasPorProveedor,
  buildComprasPorProveedorExportUrl,
} from '../../../services/reportesService';
import type { VolumenComprasPageConfig } from '../VolumenComprasPage';

const CONFIG: VolumenComprasPageConfig = {
  titulo: 'Compras por Proveedor',
  descripcion: 'Volumen de compras realizado a cada proveedor durante un período determinado.',
  categoriaLabel: 'Compras',
  contactoLabel: 'Proveedor',
  tiposContacto: ['proveedor', 'varios'],
  fetchFn: fetchComprasPorProveedor,
  buildExportUrl: buildComprasPorProveedorExportUrl,
};

export default function ComprasPorProveedorPage() {
  return <VolumenComprasPage config={CONFIG} />;
}
