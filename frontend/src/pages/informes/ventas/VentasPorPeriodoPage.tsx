import MovimientosPorPeriodoPage from '../MovimientosPorPeriodoPage';
import {
  fetchVentasPorPeriodo,
  buildVentasPorPeriodoExportUrl,
} from '../../../services/reportesService';
import type { MovimientosPorPeriodoPageConfig } from '../MovimientosPorPeriodoPage';

const CONFIG: MovimientosPorPeriodoPageConfig = {
  titulo:         'Ventas por Período',
  descripcion:    'Evolución de ventas a lo largo del tiempo. Identifica tendencias, estacionalidad y períodos clave.',
  categoriaLabel: 'Ventas',
  contactoLabel:  'Cliente',
  montoLabel:     'Total vendido',
  cantidadLabel:  'Cantidad vendida',
  tiposContacto:  ['cliente'],
  fetchFn:        fetchVentasPorPeriodo,
  buildExportUrl: buildVentasPorPeriodoExportUrl,
};

export default function VentasPorPeriodoPage() {
  return <MovimientosPorPeriodoPage config={CONFIG} />;
}
