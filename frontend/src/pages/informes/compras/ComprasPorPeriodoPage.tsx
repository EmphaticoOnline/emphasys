import MovimientosPorPeriodoPage from '../MovimientosPorPeriodoPage';
import {
  fetchComprasPorPeriodo,
  buildComprasPorPeriodoExportUrl,
} from '../../../services/reportesService';
import type { MovimientosPorPeriodoPageConfig } from '../MovimientosPorPeriodoPage';

const CONFIG: MovimientosPorPeriodoPageConfig = {
  titulo:         'Compras por Período',
  descripcion:    'Evolución de compras a lo largo del tiempo. Identifica tendencias, estacionalidad y períodos clave.',
  categoriaLabel: 'Compras',
  contactoLabel:  'Proveedor',
  tiposContacto:  ['proveedor', 'varios'],
  fetchFn:        fetchComprasPorPeriodo,
  buildExportUrl: buildComprasPorPeriodoExportUrl,
};

export default function ComprasPorPeriodoPage() {
  return <MovimientosPorPeriodoPage config={CONFIG} />;
}
