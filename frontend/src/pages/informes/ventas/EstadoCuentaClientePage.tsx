import EstadoCuentaPage from '../EstadoCuentaPage';
import {
  fetchEstadoCuentaCliente,
  buildEstadoCuentaClienteExportUrl,
} from '../../../services/reportesService';
import type { EstadoCuentaPageConfig } from '../EstadoCuentaPage';

const CONFIG: EstadoCuentaPageConfig = {
  titulo: 'Estado de Cuenta de Cliente',
  descripcion: 'Movimientos y saldo acumulado del cliente hasta la fecha de corte.',
  contactoLabel: 'Cliente',
  tiposContacto: ['cliente', 'varios'],
  categoriaLabel: 'Ventas',
  fetchFn: fetchEstadoCuentaCliente,
  buildExportUrl: buildEstadoCuentaClienteExportUrl,
};

export default function EstadoCuentaClientePage() {
  return <EstadoCuentaPage config={CONFIG} />;
}
