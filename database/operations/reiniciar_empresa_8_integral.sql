-- EMPHASYS ERP - REINICIO INTEGRAL DE EMPRESA DE PRUEBAS 8
-- Empresa objetivo: ESCUELA KEMPER URGATE (empresa_id = 8)
--
-- EJECUTAR MANUALMENTE EN DBEAVER, DESPUÉS DE UN RESPALDO.
-- NO usa TRUNCATE, no desactiva restricciones y no toca otras empresas.
-- El preflight aborta ANTES DE CUALQUIER DELETE si existe información fiscal,
-- contable o una dependencia no compatible con un reinicio integral.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';
SET LOCAL client_min_messages = 'notice';

SELECT pg_advisory_xact_lock(hashtextextended('empresa-operaciones:8', 0));
SELECT pg_advisory_xact_lock(hashtextextended('inventario:8', 0));

DO $$
DECLARE
  e integer := 8;
  n bigint;
  empresa text;
  resumen text := '';
BEGIN
  SELECT nombre INTO empresa FROM core.empresas WHERE id=e AND activo=true;
  IF empresa IS NULL OR lower(empresa) NOT LIKE '%escuela%kemper%urgate%' THEN
    RAISE EXCEPTION 'Empresa de seguridad no confirmada: id=% nombre=%', e, empresa;
  END IF;
  RAISE NOTICE 'Empresa objetivo confirmada: % (%)', e, empresa;

  -- Empresa de pruebas: se permiten CFDI, intentos y evidencias únicamente
  -- si TODOS los comprobantes están cancelados y marcados como cancelados.
  -- Un registro no cancelado detiene toda la transacción antes de borrar.
  SELECT count(*) INTO n
    FROM public.documentos_cfdi dc JOIN public.documentos d ON d.id=dc.documento_id
   WHERE d.empresa_id=e
     AND (lower(coalesce(d.estatus_documento,'')) <> 'cancelado'
       OR lower(coalesce(dc.estado_sat,'')) <> 'cancelado'
       OR coalesce(d.observaciones,'') NOT ILIKE 'Cancelada.%');
  IF n>0 THEN RAISE EXCEPTION 'BLOQUEADO: % evidencias CFDI no verificadas como prueba cancelada.', n; END IF;
  SELECT count(*) INTO n FROM public.cfdi_intentos_timbrado x JOIN public.documentos d ON d.id=x.documento_id WHERE d.empresa_id=e;
  RAISE NOTICE 'CFDI de prueba autorizados para eliminar: % intentos.', n;
  SELECT count(*) INTO n FROM core.cfdi_sat_comprobantes x JOIN public.documentos d ON d.id=x.documento_id WHERE d.empresa_id=e;
  RAISE NOTICE 'Evidencias SAT de empresa 8 autorizadas para eliminar: %.', n;

  SELECT count(*) INTO n FROM contabilidad.documentos_polizas x JOIN public.documentos d ON d.id=x.documento_id WHERE d.empresa_id=e;
  RAISE NOTICE 'Relaciones contables documentales que serán eliminadas: %.', n;
  SELECT count(*) INTO n FROM contabilidad.contabilizaciones WHERE empresa_id=e;
  RAISE NOTICE 'Contabilizaciones operativas que serán eliminadas: %.', n;

  -- Referencias a documentos que no se eliminan automáticamente por CASCADE.
  SELECT count(*) INTO n FROM documentacion.adjuntos_entidades ae JOIN public.documentos d ON d.id=ae.documento_id WHERE d.empresa_id=e;
  IF n>0 THEN resumen := resumen || format('adjuntos_documento=%s ',n); END IF;
  SELECT count(*) INTO n FROM transporte.viaje_documentos vd JOIN public.documentos d ON d.id=vd.documento_id WHERE d.empresa_id=e;
  IF n>0 THEN resumen := resumen || format('viaje_documentos=%s ',n); END IF;
  SELECT count(*) INTO n FROM transporte.cartas_porte cp JOIN public.documentos d ON d.id=cp.documento_id WHERE d.empresa_id=e;
  IF n>0 THEN resumen := resumen || format('cartas_porte=%s ',n); END IF;
  SELECT count(*) INTO n FROM public.operaciones_entregas oe JOIN public.documentos d ON d.id=oe.full_documento_id WHERE d.empresa_id=e;
  IF n>0 THEN resumen := resumen || format('entregas=%s ',n); END IF;
  RAISE NOTICE 'Dependencias externas detectadas y autorizadas para eliminación: %', coalesce(nullif(resumen,''),'ninguna');
  SELECT count(*) INTO n FROM inventario.movimientos WHERE empresa_id=e AND documento_id IS NOT NULL;
  RAISE NOTICE 'Movimientos de inventario documentales que serán eliminados: %.', n;

  RAISE NOTICE 'Preflight aprobado: CFDI verificados como prueba cancelada; se eliminarán todas las operaciones de empresa 8.';
  RAISE NOTICE 'Se conservarán empresa, usuarios, contactos, productos, almacenes, catálogos, configuración, archivos y asignaciones de series.';
END $$;

-- Conteos previos.
SELECT
  (SELECT count(*) FROM public.documentos WHERE empresa_id=8) documentos,
  (SELECT count(*) FROM public.documentos_partidas dp JOIN public.documentos d ON d.id=dp.documento_id WHERE d.empresa_id=8) partidas_documentos,
  (SELECT count(*) FROM inventario.movimientos WHERE empresa_id=8) movimientos_inventario,
  (SELECT count(*) FROM inventario.movimientos_partidas WHERE empresa_id=8) partidas_inventario,
  (SELECT count(*) FROM inventario.existencias WHERE empresa_id=8) existencias,
  (SELECT count(*) FROM finanzas_operaciones WHERE empresa_id=8) operaciones_financieras,
  (SELECT count(*) FROM aplicaciones_saldo WHERE empresa_id=8) aplicaciones_saldo,
  (SELECT count(*) FROM public.documentos_cfdi dc JOIN public.documentos d ON d.id=dc.documento_id WHERE d.empresa_id=8) documentos_cfdi,
  (SELECT count(*) FROM public.cfdi_intentos_timbrado x JOIN public.documentos d ON d.id=x.documento_id WHERE d.empresa_id=8) intentos_timbrado,
  (SELECT count(*) FROM core.cfdi_sat_comprobantes x JOIN public.documentos d ON d.id=x.documento_id WHERE d.empresa_id=8) comprobantes_sat,
  (SELECT count(*) FROM contabilidad.polizas WHERE empresa_id=8) polizas,
  (SELECT count(*) FROM public.series_documento WHERE empresa_id=8) series;

-- 1) Dependencias de tesorería, crédito y operaciones auxiliares.
DELETE FROM public.finanzas_estados_cuenta_importados_relaciones r
 USING public.finanzas_operaciones fo
 WHERE r.operacion_id=fo.id AND fo.empresa_id=8;
DELETE FROM public.finanzas_conciliaciones_operaciones r
 USING public.finanzas_operaciones fo
 WHERE r.operacion_id=fo.id AND fo.empresa_id=8;
DELETE FROM public.finanzas_conciliaciones_operaciones r
 USING public.finanzas_conciliaciones fc
 WHERE r.conciliacion_id=fc.id AND fc.empresa_id=8;
DELETE FROM public.finanzas_aplicaciones WHERE empresa_id=8;
DELETE FROM public.aplicaciones_saldo WHERE empresa_id=8;
DELETE FROM public.finanzas_programacion_pagos_detalle WHERE empresa_id=8;
DELETE FROM public.finanzas_programacion_pagos WHERE empresa_id=8;
DELETE FROM public.finanzas_transferencias WHERE empresa_id=8;
DELETE FROM public.finanzas_conciliaciones WHERE empresa_id=8;
DELETE FROM public.finanzas_estados_cuenta_importados_movimientos WHERE empresa_id=8;
DELETE FROM public.finanzas_estados_cuenta_importados WHERE empresa_id=8;
UPDATE public.documentos SET finanzas_operacion_id=NULL WHERE empresa_id=8;
DELETE FROM public.finanzas_operaciones WHERE empresa_id=8;
DELETE FROM public.credito_operaciones_aplicaciones WHERE empresa_id=8;
DELETE FROM public.credito_operaciones_items coi USING public.credito_operaciones co WHERE coi.operacion_credito_id=co.id AND co.empresa_id=8;
DELETE FROM public.credito_operaciones WHERE empresa_id=8;

-- 2) Relaciones y auxiliares de documentos.
DELETE FROM public.autorizaciones_solicitudes WHERE empresa_id=8;
DELETE FROM public.documentos_partidas_vinculos WHERE empresa_id=8;
DELETE FROM public.documentos_relaciones WHERE empresa_id=8;
DELETE FROM public.documentos_partidas_campos WHERE empresa_id=8;
DELETE FROM public.documentos_campos WHERE empresa_id=8;
DELETE FROM public.documentos_partidas_especificaciones
 WHERE partida_id IN (SELECT dp.id FROM public.documentos_partidas dp JOIN public.documentos d ON d.id=dp.documento_id WHERE d.empresa_id=8);
DELETE FROM public.documentos_cancelacion_intentos WHERE empresa_id=8;
DELETE FROM documentacion.adjuntos_entidades ae USING public.documentos d WHERE ae.documento_id=d.id AND d.empresa_id=8;
DELETE FROM public.operaciones_entregas_partidas oep USING public.documentos d WHERE oep.documento_id=d.id AND d.empresa_id=8;
DELETE FROM public.operaciones_entregas oe USING public.documentos d WHERE oe.full_documento_id=d.id AND d.empresa_id=8;
DELETE FROM transporte.viaje_documentos vd USING public.documentos d WHERE vd.documento_id=d.id AND d.empresa_id=8;
DELETE FROM transporte.cartas_porte cp USING public.documentos d WHERE cp.documento_id=d.id AND d.empresa_id=8;

-- 3) Evidencia fiscal de prueba. El preflight ya comprobó empresa, estado
-- cancelado y marca de prueba antes de permitir estos DELETE.
DELETE FROM core.cfdi_sat_comprobantes x
 WHERE x.empresa_id=8;
DELETE FROM public.documentos_cfdi x
 USING public.documentos d
 WHERE x.documento_id=d.id AND d.empresa_id=8;
DELETE FROM public.cfdi_intentos_timbrado x
 WHERE x.empresa_id=8;
DELETE FROM public.documentos_cancelacion_intentos x
 WHERE x.empresa_id=8;

-- 4) Inventario operativo y contabilidad operativa no fiscal.
DELETE FROM inventario.movimientos_partidas WHERE empresa_id=8;
DELETE FROM inventario.movimientos WHERE empresa_id=8;
DELETE FROM inventario.existencias WHERE empresa_id=8;
DELETE FROM contabilidad.contabilizaciones WHERE empresa_id=8;
DELETE FROM contabilidad.documentos_polizas WHERE documento_id IN (SELECT id FROM public.documentos WHERE empresa_id=8);
DELETE FROM contabilidad.polizas_detalle WHERE poliza_id IN (SELECT id FROM contabilidad.polizas WHERE empresa_id=8);
DELETE FROM contabilidad.polizas WHERE empresa_id=8;

-- 5) Documentos y sus partidas. El preflight y el bloque fiscal anterior
-- garantizan que no queden referencias fiscales protegidas.
UPDATE public.documentos SET factura_global_id=NULL, documento_origen_id=NULL WHERE empresa_id=8;
DELETE FROM public.documentos_partidas_impuestos WHERE partida_id IN (SELECT dp.id FROM public.documentos_partidas dp JOIN public.documentos d ON d.id=dp.documento_id WHERE d.empresa_id=8);
DELETE FROM public.documentos_partidas WHERE documento_id IN (SELECT id FROM public.documentos WHERE empresa_id=8);
DELETE FROM public.documentos WHERE empresa_id=8;

-- 6) Saldos operativos derivados en cuentas y productos; no se tocan
-- saldos iniciales maestros de configuración ni precios/listas.
UPDATE public.finanzas_cuentas
   SET saldo=0, saldo_conciliado=0, fecha_ultima_conciliacion=NULL
 WHERE empresa_id=8;
UPDATE public.productos
   SET existencia_actual=0, costo_promedio=NULL, ultimo_costo=NULL
 WHERE empresa_id=8;

-- 7) Reinicio explícito de todos los folios operativos de la empresa.
-- Conserva id, clave, descripción, activo, es_fiscal y asignaciones.
UPDATE public.series_documento
   SET ultimo_numero=0, updated_at=now()
 WHERE empresa_id=8;

-- Verificaciones estrictas antes de confirmar.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.documentos WHERE empresa_id=8;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % documentos',n; END IF;
  SELECT count(*) INTO n FROM inventario.movimientos WHERE empresa_id=8;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % movimientos',n; END IF;
  SELECT count(*) INTO n FROM inventario.movimientos_partidas WHERE empresa_id=8;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % partidas de inventario',n; END IF;
  SELECT count(*) INTO n FROM inventario.existencias WHERE empresa_id=8 AND existencia<>0;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % existencias distintas de cero',n; END IF;
  SELECT count(*) INTO n FROM public.series_documento WHERE empresa_id=8 AND ultimo_numero<>0;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % series con folio distinto de cero',n; END IF;
  SELECT count(*) INTO n FROM public.documentos_cfdi dc JOIN public.documentos d ON d.id=dc.documento_id WHERE d.empresa_id=8;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % CFDI',n; END IF;
  SELECT count(*) INTO n FROM public.cfdi_intentos_timbrado x WHERE x.empresa_id=8;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % intentos CFDI',n; END IF;
  SELECT count(*) INTO n FROM core.cfdi_sat_comprobantes x WHERE x.empresa_id=8;
  IF n<>0 THEN RAISE EXCEPTION 'Verificación fallida: quedan % comprobantes SAT',n; END IF;
END $$;

-- Consultas finales: deben devolver cero en operaciones y uno como siguiente
-- número lógico de cada serie (ultimo_numero queda en cero).
SELECT empresa_id,tipo_documento,serie,ultimo_numero
  FROM public.series_documento WHERE empresa_id=8 ORDER BY tipo_documento,serie;
SELECT
  (SELECT count(*) FROM public.documentos WHERE empresa_id=8) documentos_restantes,
  (SELECT count(*) FROM inventario.movimientos WHERE empresa_id=8) movimientos_restantes,
  (SELECT count(*) FROM inventario.existencias WHERE empresa_id=8 AND existencia<>0) existencias_no_cero,
  (SELECT count(*) FROM finanzas_operaciones WHERE empresa_id=8) finanzas_restantes,
  (SELECT count(*) FROM contabilidad.polizas WHERE empresa_id=8) polizas_restantes;

COMMIT;

-- Si cualquier validación o dependencia falla, PostgreSQL aborta la transacción.
-- En DBeaver también puede cancelarse antes de COMMIT con:
-- ROLLBACK;
