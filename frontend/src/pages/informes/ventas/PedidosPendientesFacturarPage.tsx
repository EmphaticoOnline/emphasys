import PendientesFacturarPage from '../PendientesFacturarPage';
import {
  fetchPedidosPendientesFacturar,
  buildPedidosPendientesExportUrl,
} from '../../../services/reportesService';
import type { PendientesFacturarPageConfig } from '../PendientesFacturarPage';

const CONFIG: PendientesFacturarPageConfig = {
  titulo:         'Pedidos Pendientes de Facturar',
  descripcion:    'Pedidos con importe aún no cubierto mediante facturas de venta. Permite identificar documentos que requieren facturación.',
  categoriaLabel: 'Ventas',
  docLabel:       'Pedido',
  conAvance:      true,
  tiposContacto:  ['cliente'],
  contactoLabel:  'Cliente',
  fetchFn:        fetchPedidosPendientesFacturar,
  buildExportUrl: buildPedidosPendientesExportUrl,
};

export default function PedidosPendientesFacturarPage() {
  return <PendientesFacturarPage config={CONFIG} />;
}
