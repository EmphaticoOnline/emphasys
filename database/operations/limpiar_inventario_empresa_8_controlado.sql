-- EMPHASYS ERP - LIMPIEZA CONTROLADA DE INVENTARIO
-- Empresa exclusiva: ESCUELA KEMPER URGATE (empresa_id = 8)
--
-- EJECUCIÓN MANUAL EN DBEAVER.
-- NO usa TRUNCATE, no elimina catálogos ni documentos comerciales.
-- El bloque aborta antes de borrar si encuentra dependencias que harían
-- inválida la trazabilidad o permitirían reaplicar inventario accidentalmente.
-- Requiere respaldo y revisión de los NOTICE antes de confirmar.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL client_min_messages = 'notice';

-- Impide competir con altas, afectaciones, desafectaciones o recálculos.
SELECT pg_advisory_xact_lock(hashtextextended('inventario:8', 0));

DO $$
DECLARE
  v_empresa_id integer := 8;
  v_empresa_nombre text;
  v_movimientos bigint;
  v_partidas bigint;
  v_existencias bigint;
  v_mov_documentales bigint;
  v_contabilizaciones bigint;
  v_documentos_reaplicables bigint;
  v_movimientos_post bigint;
  v_partidas_post bigint;
  v_existencias_no_cero bigint;
  v_productos_reiniciados bigint;
BEGIN
  SELECT nombre INTO v_empresa_nombre
    FROM core.empresas
   WHERE id = v_empresa_id AND activo = true;
  IF v_empresa_nombre IS NULL THEN
    RAISE EXCEPTION 'La empresa activa % no existe', v_empresa_id;
  END IF;

  RAISE NOTICE 'Empresa objetivo: % (%)', v_empresa_id, v_empresa_nombre;

  SELECT count(*) INTO v_movimientos
    FROM inventario.movimientos WHERE empresa_id = v_empresa_id;
  SELECT count(*) INTO v_partidas
    FROM inventario.movimientos_partidas WHERE empresa_id = v_empresa_id;
  SELECT count(*) INTO v_existencias
    FROM inventario.existencias WHERE empresa_id = v_empresa_id;

  RAISE NOTICE 'ANTES: movimientos=%, partidas=%, existencias=%',
    v_movimientos, v_partidas, v_existencias;

  -- No borrar movimientos vinculados a documentos: al conservar los documentos,
  -- su siguiente emisión/edición podría volver a crear la afectación.
  SELECT count(*) INTO v_mov_documentales
    FROM inventario.movimientos
   WHERE empresa_id = v_empresa_id AND documento_id IS NOT NULL;
  IF v_mov_documentales > 0 THEN
    RAISE EXCEPTION
      'LIMPIEZA_BLOQUEADA: existen % movimientos ligados a documentos comerciales. Deben tratarse mediante reversión/desafectación o un procedimiento de tombstone aprobado.',
      v_mov_documentales;
  END IF;

  -- La FK contabilidad.contabilizaciones -> inventario.movimientos impide
  -- borrar movimientos contabilizados. No se eliminan pólizas ni referencias.
  SELECT count(*) INTO v_contabilizaciones
    FROM contabilidad.contabilizaciones c
   WHERE c.empresa_id = v_empresa_id
     AND c.movimiento_inventario_id IS NOT NULL;
  IF v_contabilizaciones > 0 THEN
    RAISE EXCEPTION
      'LIMPIEZA_BLOQUEADA: existen % contabilizaciones ligadas a movimientos de inventario. Deben revertirse/cancelarse contablemente primero.',
      v_contabilizaciones;
  END IF;

  -- Incluso sin movimiento actual, un documento emitido que afecta inventario
  -- podría reaplicarlo después de la limpieza. Se bloquea para no dejar una
  -- condición silenciosa de duplicación futura.
  SELECT count(DISTINCT d.id) INTO v_documentos_reaplicables
    FROM public.documentos d
    JOIN public.documentos_partidas dp ON dp.documento_id = d.id
    JOIN public.productos p ON p.id = dp.producto_id AND p.empresa_id = d.empresa_id
    JOIN core.tipos_documento td ON lower(td.codigo) = lower(d.tipo_documento)
    LEFT JOIN core.empresas_tipos_documento etd
      ON etd.tipo_documento_id = td.id AND etd.empresa_id = d.empresa_id
   WHERE d.empresa_id = v_empresa_id
     AND lower(coalesce(d.estatus_documento, '')) IN ('emitido', 'enviado')
     AND lower(coalesce(etd.afecta_inventario, td.afecta_inventario, 'none')) <> 'none'
     AND lower(coalesce(p.tipo_producto, '')) = 'inventariable'
     AND NOT EXISTS (
       SELECT 1 FROM inventario.movimientos m
        WHERE m.empresa_id = d.empresa_id AND m.documento_id = d.id
     );
  IF v_documentos_reaplicables > 0 THEN
    RAISE EXCEPTION
      'LIMPIEZA_BLOQUEADA: existen % documentos emitidos/enviados que podrían volver a aplicar inventario después del borrado.',
      v_documentos_reaplicables;
  END IF;

  -- No se toca audit_log: conserva la historia de la operación y de los datos
  -- eliminados. Se agregará un registro de esta limpieza al final.
  DELETE FROM inventario.movimientos_partidas
   WHERE empresa_id = v_empresa_id;
  DELETE FROM inventario.movimientos
   WHERE empresa_id = v_empresa_id;

  -- Reinicio de saldos derivados, conservando las filas por producto/almacén.
  UPDATE inventario.existencias
     SET existencia = 0, updated_at = now()
   WHERE empresa_id = v_empresa_id;

  -- Estos campos son derivados históricos del inventario. Se conservan el
  -- producto, catálogo, costos estándar, precios y configuración empresarial.
  UPDATE public.productos
     SET existencia_actual = 0,
         costo_promedio = NULL,
         ultimo_costo = NULL
   WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_productos_reiniciados = ROW_COUNT;

  INSERT INTO public.audit_log
    (empresa_id, usuario_id, modulo, entidad, accion, descripcion, datos_nuevos, origen)
  VALUES
    (v_empresa_id, NULL, 'inventario', 'empresa', 'limpieza_inventario',
     'Limpieza controlada del historial operativo de inventario de empresa 8',
     jsonb_build_object(
       'empresa_id', v_empresa_id,
       'movimientos_eliminados', v_movimientos,
       'partidas_eliminadas', v_partidas,
       'existencias_reiniciadas', v_existencias,
       'productos_reiniciados', v_productos_reiniciados,
       'series_conservadas', true,
       'documentos_conservados', true
     ), 'dba_manual');

  SELECT count(*) INTO v_movimientos_post
    FROM inventario.movimientos WHERE empresa_id = v_empresa_id;
  SELECT count(*) INTO v_partidas_post
    FROM inventario.movimientos_partidas WHERE empresa_id = v_empresa_id;
  SELECT count(*) INTO v_existencias_no_cero
    FROM inventario.existencias
   WHERE empresa_id = v_empresa_id AND existencia <> 0;

  IF v_movimientos_post <> 0 OR v_partidas_post <> 0 OR v_existencias_no_cero <> 0 THEN
    RAISE EXCEPTION
      'VERIFICACION_FALLIDA: movimientos restantes %, partidas restantes %, existencias no cero %',
      v_movimientos_post, v_partidas_post, v_existencias_no_cero;
  END IF;

  RAISE NOTICE 'DESPUÉS: movimientos=%, partidas=%, existencias no cero=%',
    v_movimientos_post, v_partidas_post, v_existencias_no_cero;
  RAISE NOTICE 'Productos reiniciados: %', v_productos_reiniciados;
  RAISE NOTICE 'Catálogos, documentos, parámetros, series y auditoría histórica conservados.';
END $$;

-- La serie INV NO se reinicia por defecto.
-- Verificación informativa únicamente; no modifica folios.
SELECT empresa_id, tipo_documento, serie, ultimo_numero
  FROM public.series_documento
 WHERE empresa_id = 8
   AND tipo_documento = 'movimiento_inventario'
   AND serie = 'INV';

-- Verificación de conservación de documentos y catálogos.
SELECT
  (SELECT count(*) FROM public.documentos WHERE empresa_id = 8) AS documentos_conservados,
  (SELECT count(*) FROM productos WHERE empresa_id = 8) AS productos_conservados,
  (SELECT count(*) FROM inventario.almacenes WHERE empresa_id = 8) AS almacenes_conservados,
  (SELECT count(*) FROM core.parametros_empresa WHERE empresa_id = 8) AS parametros_empresa_conservados,
  (SELECT count(*) FROM public.series_documento WHERE empresa_id = 8) AS series_conservadas;

COMMIT;

-- En caso de detectar cualquier resultado inesperado durante la revisión,
-- cancelar antes de COMMIT o ejecutar ROLLBACK dentro de la misma sesión.
