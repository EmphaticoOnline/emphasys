-- AUDITORÍA FORENSE READ-ONLY. Sólo crea una tabla TEMPORAL de resultados de esta sesión.
-- No crea objetos permanentes, no modifica datos productivos y no requiere transacción.

DROP TABLE IF EXISTS pg_temp.audit_migration_results;
CREATE TEMP TABLE audit_migration_results (
  migration text, section text, object_type text, schema_name text,
  object_name text, status text, expected text, actual text, detail text
);

WITH e(migration,object_type,schema_name,object_name,expected,detail) AS (VALUES
('20260826_conciliacion_bancaria','table','public','finanzas_importaciones_bancarias','PRESENT','tabla + checks/FKs/unique/indexes'),
('20260826_conciliacion_bancaria','table','public','finanzas_movimientos_bancarios','PRESENT','tabla + checks/FKs/unique/indexes'),
('20260826_conciliacion_bancaria','table','public','finanzas_movimientos_bancarios_relaciones','PRESENT','tabla + checks/FKs/unique/indexes'),
('20260826_finanzas_credito_aplicaciones','column','public','aplicaciones_saldo','PRESENT','credito_operacion_id integer nullable; FK; check; index'),
('20260826_migracion_documentos_trazabilidad','column','migrate','entidades_correspondencias','PRESENT','6 columnas; check; index'),
('20260826_operaciones_entregas','table','public','operaciones_entregas','PRESENT','tabla + checks/FKs/index'),
('20260826_operaciones_entregas','table','public','operaciones_entregas_partidas','PRESENT','tabla + checks/FKs/unique/index'),
('20260826_operaciones_full','table','public','operaciones_full','PRESENT','tabla + checks/FKs/index'),
('20260826_operaciones_full','table','public','operaciones_full_cierres','PRESENT','tabla + checks/FKs/index'),
('20260826_precio_base_comercial','table','public','documentos_partidas_condiciones_comerciales','PRESENT','tabla + check/FKs/unique/index'),
('20260826_precio_base_comercial','table','public','documentos_partidas_condiciones_comerciales_historial','PRESENT','tabla + checks/FKs/index'),
('20260826_precio_base_comercial_remove_final','column','public','documentos_partidas_condiciones_comerciales','ABSENT','precio_comercial_final debe no existir'),
('20260827_campos_dicor_documentos_partidas','data','core','campos_configuracion','4 FILAS','configuraciones empresa 9'),
('20260827_contactos_domicilios_texto_libre','column','public','contactos_domicilios','PRESENT','4 columnas de texto libre'),
('20260827_create_documentacion_documentos_empresa','schema','documentacion','','PRESENT','schema + tablas + índices'),
('20260827_eliminar_borradores_conciliacion','table','public','finanzas_conciliaciones_borradores','ABSENT','tabla eliminada'),
('20260827_eliminar_borradores_conciliacion','table','public','finanzas_conciliaciones_borradores_operaciones','ABSENT','tabla eliminada'),
('20260827_entidades_alias','table','migrate','entidades_alias','PRESENT','tabla + PK/FK/index'),
('20260827_importaciones_hash_no_unique','constraint','public','finanzas_importaciones_bancarias','ABSENT','unique global eliminado'),
('20260827_importaciones_historicas','column','public','finanzas_importaciones_bancarias','PRESENT','es_historica + backfill + unique parcial'),
('20260827_movimientos_historicos','column','public','finanzas_movimientos_bancarios','PRESENT','es_historico + backfill + unique parcial'),
('20260827_usuarios_historicos_conciliacion','column','public','finanzas_conciliaciones','PRESENT','metadatos jsonb NOT NULL default'),
('20260901_catalogos_carta_porte31','table','sat','bienes_transportados','PRESENT','catálogo + seed'),
('20260901_catalogos_carta_porte31','table','sat','materiales_peligrosos','PRESENT','catálogo + seed'),
('20260901_catalogos_carta_porte31','table','sat','tipos_embalaje','PRESENT','catálogo + seed'),
('20260901_catalogos_vehiculos_carta_porte31','table','sat','configuraciones_autotransporte','PRESENT','catálogo + seed'),
('20260901_catalogos_vehiculos_carta_porte31','table','sat','tipos_permiso','PRESENT','catálogo + seed'),
('20260901_consolidar_viaje_ubicaciones_domicilios','column','transporte','viaje_ubicaciones','PRESENT','domicilio_id; legacy ubicacion_id ausente; FK/index'),
('20260901_contactos_domicilios_general','column','public','contactos_domicilios','PRESENT','empresa/owner/geocoordenadas/activo/timestamps/checks/indexes'),
('20260901_eliminar_mercancias_legacy','column','transporte','viaje_mercancias','PRESENT','producto_id; mercancia_id y maestro legacy ausentes'),
('20260901_figuras_transporte','table','sat','figuras_transporte','PRESENT','tabla + seed + constraints'),
('20260901_fix_uq_viaje_figuras_scope','constraint','transporte','viaje_figuras','PRESENT','unique por viaje/contacto'),
('20260901_operadores_extension_contactos','constraint','transporte','operadores','PRESENT','FK compuesta tenant'),
('20260901_productos_carta_porte','column','public','productos','PRESENT','5 columnas + check'),
('20260901_subtipos_remolque_y_default_vehiculo','table','sat','subtipos_remolque','PRESENT','tabla + seed + FK vehículo'),
('20260901_viaje_mercancias_productos','column','transporte','viaje_mercancias','PRESENT','producto_id FK/index'),
('20260901_whatsapp_lecturas_conversaciones','table','crm','conversaciones_lecturas','PRESENT','tabla + PK/FK/index'),
('20260901_whatsapp_lecturas_conversaciones','table','crm','conversaciones_lecturas_config','PRESENT','singleton + seed'),
('20260901_whatsapp_lecturas_conversaciones','index','crm','mensajes','PRESENT','índice unread lookup')
)
INSERT INTO audit_migration_results
SELECT migration,'existence',object_type,schema_name,object_name,
 CASE object_type
  WHEN 'schema' THEN CASE WHEN EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname=e.schema_name) THEN 'PRESENT' ELSE 'SCHEMA_MISSING' END
  WHEN 'table' THEN CASE WHEN to_regclass(format('%I.%I',schema_name,object_name)) IS NULL THEN 'TABLE_MISSING' ELSE 'PRESENT' END
  WHEN 'column' THEN CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema=e.schema_name AND c.table_name=e.object_name) THEN 'PRESENT' ELSE 'COLUMN_MISSING' END
  WHEN 'constraint' THEN CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=e.schema_name AND r.relname=e.object_name) THEN 'PRESENT' ELSE 'CONSTRAINT_MISSING' END
  WHEN 'index' THEN CASE WHEN EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname=e.schema_name AND i.indexname=e.object_name) THEN 'PRESENT' ELSE 'INDEX_MISSING' END
  ELSE 'NOT_APPLICABLE' END,
 expected,NULL,detail FROM e;

INSERT INTO audit_migration_results
SELECT 'catalog','columns','column',table_schema,table_name||'.'||column_name,'PRESENT',NULL,
 format('type=%s; nullable=%s; default=%s',data_type,is_nullable,coalesce(column_default,'NULL')),
 format('ordinal=%s; udt=%s.%s; length=%s; precision=%s',ordinal_position,udt_schema,udt_name,coalesce(character_maximum_length::text,'NULL'),coalesce(numeric_precision::text,'NULL'))
FROM information_schema.columns
WHERE (table_schema,table_name) IN (('public','aplicaciones_saldo'),('migrate','entidades_correspondencias'),('public','contactos_domicilios'),('public','finanzas_importaciones_bancarias'),('public','finanzas_movimientos_bancarios'),('public','finanzas_conciliaciones'),('public','productos'),('transporte','viaje_ubicaciones'),('transporte','viaje_mercancias'),('transporte','vehiculos'));

INSERT INTO audit_migration_results
SELECT 'catalog','constraints','constraint',n.nspname,r.relname||'.'||c.conname,'PRESENT',c.contype,pg_get_constraintdef(c.oid,true),
 format('on_delete=%s; on_update=%s',CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE 'N/A' END,CASE c.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE 'N/A' END)
FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
WHERE n.nspname IN ('public','core','migrate','transporte','sat','crm','documentacion') AND (r.relname IN ('aplicaciones_saldo','entidades_correspondencias','contactos_domicilios','viaje_ubicaciones','viaje_mercancias','viaje_figuras','operadores','vehiculos','productos','finanzas_importaciones_bancarias','finanzas_movimientos_bancarios') OR r.relname LIKE 'operaciones_%' OR r.relname LIKE 'documentos_partidas_condiciones%');
INSERT INTO audit_migration_results SELECT 'catalog','indexes','index',schemaname,tablename||'.'||indexname,'PRESENT',NULL,indexdef,NULL FROM pg_indexes;
INSERT INTO audit_migration_results SELECT 'catalog','triggers','trigger',n.nspname,c.relname||'.'||t.tgname,'PRESENT',NULL,pg_get_triggerdef(t.oid,true),NULL FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal;
INSERT INTO audit_migration_results SELECT 'catalog','functions','function',n.nspname,p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','PRESENT',NULL,pg_get_functiondef(p.oid),NULL FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','core','migrate','transporte','sat','crm','documentacion');
INSERT INTO audit_migration_results SELECT 'catalog','views','view',schemaname,viewname,'PRESENT',NULL,definition,NULL FROM pg_views WHERE schemaname IN ('public','transporte','crm','documentacion');
INSERT INTO audit_migration_results SELECT 'catalog','migration_history','table',table_schema,table_name,'PRESENT',NULL,NULL,'column='||column_name FROM information_schema.columns WHERE lower(table_name) LIKE '%migration%' OR lower(table_name) LIKE '%migracion%' OR lower(table_name) LIKE '%schema%';

DO $$
DECLARE t boolean; c boolean; n bigint; total bigint; hist bigint; normales bigint;
BEGIN
 t:=to_regclass('core.campos_configuracion') IS NOT NULL;
 IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260827_campos_dicor_documentos_partidas','dml','table','core','campos_configuracion','TABLE_MISSING','4 filas',NULL,'tabla ausente'); ELSE EXECUTE 'SELECT count(*) FROM core.campos_configuracion WHERE empresa_id=9 AND clave IN (''folio_externo'',''precio_dani'')' INTO n; INSERT INTO audit_migration_results VALUES ('20260827_campos_dicor_documentos_partidas','dml','data','core','campos_configuracion',CASE WHEN n=4 THEN 'OK' ELSE 'ANOMALIES_FOUND' END,'4',n::text,'configuraciones DICOR'); END IF;
 t:=to_regclass('public.finanzas_importaciones_bancarias') IS NOT NULL; c:=t AND (SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name='finanzas_importaciones_bancarias' AND column_name IN ('es_historica','empresa_id'));
 IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260827_importaciones_historicas','dml','table','public','finanzas_importaciones_bancarias','TABLE_MISSING',NULL,NULL,'tabla ausente'); ELSIF NOT c THEN INSERT INTO audit_migration_results VALUES ('20260827_importaciones_historicas','dml','column','public','finanzas_importaciones_bancarias','COLUMN_MISSING','es_historica, empresa_id',NULL,'faltan columnas'); ELSE EXECUTE 'SELECT count(*),count(*) FILTER (WHERE es_historica),count(*) FILTER (WHERE NOT es_historica) FROM public.finanzas_importaciones_bancarias' INTO total,hist,normales; INSERT INTO audit_migration_results VALUES ('20260827_importaciones_historicas','dml','data','public','finanzas_importaciones_bancarias','PRESENT',NULL,total::text,format('historicas=%s; normales=%s',hist,normales)); END IF;
 t:=to_regclass('public.finanzas_movimientos_bancarios') IS NOT NULL; c:=t AND (SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name='finanzas_movimientos_bancarios' AND column_name IN ('es_historico','empresa_id'));
 IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260827_movimientos_historicos','dml','table','public','finanzas_movimientos_bancarios','TABLE_MISSING',NULL,NULL,'tabla ausente'); ELSIF NOT c THEN INSERT INTO audit_migration_results VALUES ('20260827_movimientos_historicos','dml','column','public','finanzas_movimientos_bancarios','COLUMN_MISSING','es_historico, empresa_id',NULL,'faltan columnas'); ELSE EXECUTE 'SELECT count(*),count(*) FILTER (WHERE es_historico) FROM public.finanzas_movimientos_bancarios' INTO total,hist; INSERT INTO audit_migration_results VALUES ('20260827_movimientos_historicos','dml','data','public','finanzas_movimientos_bancarios','PRESENT',NULL,total::text,'historicos='||hist); END IF;
 t:=to_regclass('transporte.viaje_ubicaciones') IS NOT NULL; c:=t AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='transporte' AND table_name='viaje_ubicaciones' AND column_name='domicilio_id');
 IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260901_consolidar_viaje_ubicaciones_domicilios','dml','table','transporte','viaje_ubicaciones','TABLE_MISSING',NULL,NULL,'tabla ausente'); ELSIF NOT c THEN INSERT INTO audit_migration_results VALUES ('20260901_consolidar_viaje_ubicaciones_domicilios','dml','column','transporte','viaje_ubicaciones','COLUMN_MISSING','domicilio_id',NULL,'columna ausente'); ELSE EXECUTE 'SELECT count(*) FROM transporte.viaje_ubicaciones WHERE domicilio_id IS NULL' INTO n; INSERT INTO audit_migration_results VALUES ('20260901_consolidar_viaje_ubicaciones_domicilios','dml','data','transporte','viaje_ubicaciones',CASE WHEN n=0 THEN 'OK' ELSE 'ANOMALIES_FOUND' END,'0',n::text,'filas sin domicilio_id'); END IF;
 t:=to_regclass('transporte.viaje_mercancias') IS NOT NULL; c:=t AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='transporte' AND table_name='viaje_mercancias' AND column_name='producto_id');
 IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260901_viaje_mercancias_productos','dml','table','transporte','viaje_mercancias','TABLE_MISSING',NULL,NULL,'tabla ausente'); ELSIF NOT c THEN INSERT INTO audit_migration_results VALUES ('20260901_viaje_mercancias_productos','dml','column','transporte','viaje_mercancias','COLUMN_MISSING','producto_id',NULL,'columna ausente'); ELSE EXECUTE 'SELECT count(*) FROM transporte.viaje_mercancias WHERE producto_id IS NULL' INTO n; INSERT INTO audit_migration_results VALUES ('20260901_viaje_mercancias_productos','dml','data','transporte','viaje_mercancias',CASE WHEN n=0 THEN 'OK' ELSE 'ANOMALIES_FOUND' END,'0',n::text,'filas sin producto_id'); END IF;
 t:=to_regclass('public.contactos_domicilios') IS NOT NULL; c:=t AND (SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name='contactos_domicilios' AND column_name IN ('contacto_id','empresa_id'));
 IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260901_contactos_domicilios_general','dml','table','public','contactos_domicilios','TABLE_MISSING',NULL,NULL,'tabla ausente'); ELSIF NOT c THEN INSERT INTO audit_migration_results VALUES ('20260901_contactos_domicilios_general','dml','column','public','contactos_domicilios','COLUMN_MISSING','contacto_id, empresa_id',NULL,'faltan columnas'); ELSE EXECUTE 'SELECT count(*) FROM public.contactos_domicilios WHERE (contacto_id IS NULL) = (empresa_id IS NULL)' INTO n; INSERT INTO audit_migration_results VALUES ('20260901_contactos_domicilios_general','dml','data','public','contactos_domicilios',CASE WHEN n=0 THEN 'OK' ELSE 'ANOMALIES_FOUND' END,'0',n::text,'filas que violan owner XOR'); END IF;
 t:=to_regclass('sat.figuras_transporte') IS NOT NULL; IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260901_figuras_transporte','dml','table','sat','figuras_transporte','TABLE_MISSING','5 claves',NULL,'catálogo ausente'); ELSE EXECUTE 'SELECT count(*) FROM sat.figuras_transporte WHERE clave_figura_transporte_sat IN (''01'',''02'',''03'',''04'',''05'')' INTO n; INSERT INTO audit_migration_results VALUES ('20260901_figuras_transporte','dml','data','sat','figuras_transporte',CASE WHEN n=5 THEN 'OK' ELSE 'ANOMALIES_FOUND' END,'5',n::text,'claves SAT'); END IF;
 t:=to_regclass('sat.subtipos_remolque') IS NOT NULL; IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260901_subtipos_remolque_y_default_vehiculo','dml','table','sat','subtipos_remolque','TABLE_MISSING',NULL,NULL,'catálogo ausente'); ELSE EXECUTE 'SELECT count(*) FROM sat.subtipos_remolque' INTO n; INSERT INTO audit_migration_results VALUES ('20260901_subtipos_remolque_y_default_vehiculo','dml','data','sat','subtipos_remolque','PRESENT',NULL,n::text,'filas catálogo'); END IF;
 t:=to_regclass('crm.conversaciones_lecturas_config') IS NOT NULL; IF NOT t THEN INSERT INTO audit_migration_results VALUES ('20260901_whatsapp_lecturas_conversaciones','dml','table','crm','conversaciones_lecturas_config','TABLE_MISSING','1 fila',NULL,'tabla ausente'); ELSE EXECUTE 'SELECT count(*) FROM crm.conversaciones_lecturas_config' INTO n; INSERT INTO audit_migration_results VALUES ('20260901_whatsapp_lecturas_conversaciones','dml','data','crm','conversaciones_lecturas_config',CASE WHEN n=1 THEN 'OK' ELSE 'ANOMALIES_FOUND' END,'1',n::text,'configuración singleton'); END IF;
END $$;

-- ÚNICO result set.
SELECT migration,section,object_type,schema_name,object_name,status,expected,actual,detail
FROM audit_migration_results ORDER BY migration,section,schema_name,object_type,object_name;

DROP TABLE pg_temp.audit_migration_results;
