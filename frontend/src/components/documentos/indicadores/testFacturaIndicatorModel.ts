import {
  buildCfdiIndicatorModel,
  buildFacturaIndicatorModel,
} from './buildFacturaIndicatorModel';
import type { FacturaIndicatorSource } from './documentosIndicators.types';

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${String(expected)}, recibido ${String(actual)}`);
  }
}

const stamped: FacturaIndicatorSource = {
  id: 155,
  tipo_documento: 'factura',
  tratamiento_impuestos: 'normal',
  estatus_documento: 'Timbrado',
  total: 10440,
  saldo: 10440,
  cfdi_uuid: 'd3cad662-2669-47c2-83fc-d1bd97518f17',
  cfdi_fecha_timbrado: '2026-06-01T10:52:15.000Z',
  cfdi_estado_sat: 'vigente',
};

assertEqual(buildCfdiIndicatorModel(stamped).status, 'stamped', 'timbrado');
assertEqual(buildCfdiIndicatorModel({ ...stamped, cfdi_cancelacion_estado: 'solicitada' }).status, 'cancellation_requested', 'solicitada');
assertEqual(buildCfdiIndicatorModel({ ...stamped, cfdi_cancelacion_estado: 'pendiente' }).status, 'cancellation_pending', 'pendiente');
assertEqual(buildCfdiIndicatorModel({ ...stamped, cfdi_cancelacion_estado: 'requiere_reconciliacion' }).status, 'cancellation_reconciliation', 'conciliación');
assertEqual(buildCfdiIndicatorModel({ ...stamped, cfdi_cancelacion_estado: 'cancelada' }).status, 'cancelled', 'cancelada');
assertEqual(buildCfdiIndicatorModel({ ...stamped, cfdi_cancelacion_estado: 'rechazada' }).status, 'cancellation_rejected', 'rechazada');
assertEqual(buildCfdiIndicatorModel({ ...stamped, cfdi_cancelacion_estado: 'error' }).status, 'cancellation_error', 'error');
assertEqual(buildCfdiIndicatorModel({ id: 1, tipo_documento: 'factura' }).status, 'not_stamped', 'sin CFDI');

const full = buildFacturaIndicatorModel(
  { ...stamped, cfdi_cancelacion_estado: 'pendiente' },
  { estado: 'pendiente', motivo: null, polizas_relacionadas: [] }
);
assertEqual(full.financial?.status, 'pending', 'financiero');
assertEqual(full.accounting?.status, 'pending', 'contabilidad');
assertEqual(full.cfdi?.status, 'cancellation_pending', 'CFDI');

const suspended = buildFacturaIndicatorModel(
  {
    ...stamped,
    saldo: 0,
    saldo_registrado: 10440,
    saldo_suspendido_cancelacion: 10440,
    cobro_bloqueado: true,
    cfdi_cancelacion_estado: 'pendiente',
  },
  { estado: 'pendiente', motivo: null, polizas_relacionadas: [] }
);
assertEqual(suspended.financial?.status, 'suspended', 'saldo suspendido');
assertEqual(suspended.financial?.registeredBalance, 10440, 'saldo real conservado');

console.log(JSON.stringify({
  cfdi_states: 8,
  unrelated_indicators: 'unchanged',
  suspended_not_paid: true,
}));
