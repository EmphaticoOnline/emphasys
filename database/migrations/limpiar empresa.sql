BEGIN;

DO $$
DECLARE
  v_empresa_id integer := 1;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.empresas WHERE id = v_empresa_id) THEN
    RAISE EXCEPTION 'No existe la empresa id %', v_empresa_id;
  END IF;

  RAISE NOTICE 'Limpiando SOLO datos operativos de empresa %', v_empresa_id;

  ---------------------------------------------------------------------------
  -- PRODUCCIÓN
  ---------------------------------------------------------------------------
  DELETE FROM produccion.seguimientos
  WHERE empresa_id = v_empresa_id;

  ---------------------------------------------------------------------------
  -- INVENTARIO OPERATIVO
  ---------------------------------------------------------------------------
  DELETE FROM inventario.movimientos_partidas
  WHERE empresa_id = v_empresa_id;

  DELETE FROM inventario.movimientos
  WHERE empresa_id = v_empresa_id;

  DELETE FROM inventario.existencias
  WHERE empresa_id = v_empresa_id;

  ---------------------------------------------------------------------------
  -- FINANZAS OPERATIVAS
  ---------------------------------------------------------------------------
  DELETE FROM public.aplicaciones_saldo
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.finanzas_aplicaciones
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.finanzas_conciliaciones_operaciones fco
  USING public.finanzas_conciliaciones fc
  WHERE fco.conciliacion_id = fc.id
    AND fc.empresa_id = v_empresa_id;

  DELETE FROM public.finanzas_conciliaciones_operaciones fco
  USING public.finanzas_operaciones fo
  WHERE fco.operacion_id = fo.id
    AND fo.empresa_id = v_empresa_id;

  DELETE FROM public.finanzas_transferencias
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.finanzas_conciliaciones
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.finanzas_operaciones
  WHERE empresa_id = v_empresa_id;

  UPDATE public.finanzas_cuentas
  SET saldo = 0,
      saldo_inicial = 0,
      saldo_conciliado = 0,
      fecha_ultima_conciliacion = NULL
  WHERE empresa_id = v_empresa_id;

  ---------------------------------------------------------------------------
  -- CRÉDITO OPERATIVO
  ---------------------------------------------------------------------------
  DELETE FROM public.credito_operaciones_aplicaciones
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.credito_operaciones_items coi
  USING public.credito_operaciones co
  WHERE coi.operacion_credito_id = co.id
    AND co.empresa_id = v_empresa_id;

  DELETE FROM public.credito_operaciones
  WHERE empresa_id = v_empresa_id;

  ---------------------------------------------------------------------------
  -- CRM / WHATSAPP OPERATIVO
  ---------------------------------------------------------------------------
  DELETE FROM crm.conversacion_etiquetas
  WHERE empresa_id = v_empresa_id;

  DELETE FROM crm.mensajes
  WHERE empresa_id = v_empresa_id;

  DELETE FROM crm.actividades
  WHERE empresa_id = v_empresa_id;

  DELETE FROM crm.oportunidades_venta
  WHERE empresa_id = v_empresa_id;

  DELETE FROM crm.conversaciones
  WHERE empresa_id = v_empresa_id;

  DELETE FROM whatsapp.contacto_estado
  WHERE empresa_id = v_empresa_id;

  DELETE FROM whatsapp.intentos_contacto
  WHERE empresa_id = v_empresa_id;

  DELETE FROM whatsapp.estadisticas
  WHERE empresa_id = v_empresa_id;

  ---------------------------------------------------------------------------
  -- DOCUMENTOS Y PARTIDAS
  ---------------------------------------------------------------------------
  DELETE FROM public.documentos_cfdi dc
  USING public.documentos d
  WHERE dc.documento_id = d.id
    AND d.empresa_id = v_empresa_id;

  DELETE FROM public.documentos_partidas_impuestos dpi
  USING public.documentos_partidas dp
  JOIN public.documentos d ON d.id = dp.documento_id
  WHERE dpi.partida_id = dp.id
    AND d.empresa_id = v_empresa_id;

  DELETE FROM public.documentos_partidas_campos
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.documentos_campos
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.documentos_partidas_vinculos
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.documentos_partidas dp
  USING public.documentos d
  WHERE dp.documento_id = d.id
    AND d.empresa_id = v_empresa_id;

  DELETE FROM public.documentos
  WHERE empresa_id = v_empresa_id;

  ---------------------------------------------------------------------------
  -- AUDITORÍA
  ---------------------------------------------------------------------------
  DELETE FROM public.audit_log
  WHERE empresa_id = v_empresa_id;

  RAISE NOTICE 'Limpieza operativa segura terminada para empresa %', v_empresa_id;
END $$;

ROLLBACK;
-- COMMIT;