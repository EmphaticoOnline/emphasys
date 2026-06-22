import OCPendientesPage from '../OCPendientesPage';
import {
  fetchOCPendientesRecibir,
  buildOCPendientesExportUrl,
} from '../../../services/reportesService';
import type { OCPendientesPageConfig } from '../OCPendientesPage';

const CONFIG: OCPendientesPageConfig = {
  titulo: 'Órdenes de Compra Pendientes de Recibir',
  descripcion: 'Órdenes de compra con cantidades aún no materializadas mediante documentos que generan entrada de inventario.',
  categoriaLabel: 'Compras',
  tiposContacto: ['proveedor', 'varios'],
  contactoLabel: 'Proveedor',
  fetchFn: fetchOCPendientesRecibir,
  buildExportUrl: buildOCPendientesExportUrl,
};

export default function OCPendientesRecibirPage() {
  return <OCPendientesPage config={CONFIG} />;
}
