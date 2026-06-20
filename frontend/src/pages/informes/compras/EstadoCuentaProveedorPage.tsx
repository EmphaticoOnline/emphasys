import EstadoCuentaPage from '../EstadoCuentaPage';
import {
  fetchEstadoCuentaProveedor,
  buildEstadoCuentaProveedorExportUrl,
} from '../../../services/reportesService';
import type { EstadoCuentaPageConfig } from '../EstadoCuentaPage';

const CONFIG: EstadoCuentaPageConfig = {
  titulo: 'Estado de Cuenta de Proveedor',
  descripcion: 'Movimientos y saldo acumulado del proveedor hasta la fecha de corte.',
  contactoLabel: 'Proveedor',
  tiposContacto: ['proveedor', 'varios'],
  categoriaLabel: 'Compras',
  fetchFn: fetchEstadoCuentaProveedor,
  buildExportUrl: buildEstadoCuentaProveedorExportUrl,
};

export default function EstadoCuentaProveedorPage() {
  return <EstadoCuentaPage config={CONFIG} />;
}
