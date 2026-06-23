import PendientesFacturarPage from '../PendientesFacturarPage';
import {
  fetchRemisionesPendientesFacturar,
  buildRemisionesPendientesExportUrl,
} from '../../../services/reportesService';
import type { PendientesFacturarPageConfig } from '../PendientesFacturarPage';

const CONFIG: PendientesFacturarPageConfig = {
  titulo:         'Remisiones Pendientes de Facturar',
  descripcion:    'Remisiones con importe aún no cubierto mediante facturas de venta. Controla qué remisiones requieren facturación.',
  categoriaLabel: 'Ventas',
  docLabel:       'Remisión',
  conAvance:      false,
  tiposContacto:  ['cliente'],
  contactoLabel:  'Cliente',
  fetchFn:        fetchRemisionesPendientesFacturar,
  buildExportUrl: buildRemisionesPendientesExportUrl,
};

export default function RemisionesPendientesFacturarPage() {
  return <PendientesFacturarPage config={CONFIG} />;
}
