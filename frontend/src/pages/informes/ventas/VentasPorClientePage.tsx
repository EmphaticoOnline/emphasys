import VolumenComprasPage from '../VolumenComprasPage';
import {
  fetchVentasPorCliente,
  buildVentasPorClienteExportUrl,
} from '../../../services/reportesService';
import type { VolumenComprasPageConfig } from '../VolumenComprasPage';

const CONFIG: VolumenComprasPageConfig = {
  titulo: 'Ventas por Cliente',
  descripcion: 'Volumen de ventas realizado a cada cliente durante un período determinado.',
  categoriaLabel: 'Ventas',
  contactoLabel: 'Cliente',
  tiposContacto: ['cliente', 'varios'],
  fetchFn: fetchVentasPorCliente,
  buildExportUrl: buildVentasPorClienteExportUrl,
};

export default function VentasPorClientePage() {
  return <VolumenComprasPage config={CONFIG} />;
}
