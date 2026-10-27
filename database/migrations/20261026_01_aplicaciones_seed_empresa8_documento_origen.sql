-- Repara los pagos generados por backend/scripts/seed-demo-empresa-8.ts.
--
-- Modelo que usa la aplicación (crearAplicacionTx) para un pago:
--   * aplicaciones_saldo.documento_origen_id = pago, finanzas_operacion_id NULL
--     (chk_aplicacion_origen exige exactamente uno de los dos);
--   * documentos.finanzas_operacion_id del pago = su operación financiera.
--
-- El seed hizo lo contrario: ligó cada aplicación sólo a la operación y dejó el
-- pago sin operación. La vista documentos_saldo calcula el saldo disponible del
-- pago con las aplicaciones cuyo origen es el pago, así que la factura quedaba
-- saldada pero el pago seguía "sin aplicaciones" y con todo su monto por aplicar.
--
-- Idempotente: sólo toca filas que aún tienen el formato del seed.

BEGIN;

-- 1. Cada pago del seed apunta a la operación que lo originó.
UPDATE public.documentos pago
   SET finanzas_operacion_id = fo.id
  FROM public.finanzas_operaciones fo
 WHERE pago.empresa_id = 8
   AND pago.tipo_documento IN ('pago_cliente', 'pago_proveedor')
   AND pago.finanzas_operacion_id IS NULL
   AND fo.empresa_id = pago.empresa_id
   AND fo.documento_origen_id = pago.id;

-- 2. Las aplicaciones pasan de "origen = operación" a "origen = pago".
UPDATE public.aplicaciones_saldo a
   SET documento_origen_id = fo.documento_origen_id,
       finanzas_operacion_id = NULL
  FROM public.finanzas_operaciones fo
  JOIN public.documentos pago
    ON pago.id = fo.documento_origen_id
   AND pago.empresa_id = fo.empresa_id
 WHERE a.empresa_id = 8
   AND a.documento_origen_id IS NULL
   AND a.finanzas_operacion_id = fo.id
   AND fo.empresa_id = a.empresa_id
   AND pago.tipo_documento IN ('pago_cliente', 'pago_proveedor');

COMMIT;
