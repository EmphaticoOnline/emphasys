-- Consolida transporte.mercancias en public.productos y conserva snapshots.
BEGIN;
DO $$
DECLARE r record; v_producto_id integer;
BEGIN
  IF to_regclass('transporte.viaje_mercancias') IS NULL OR to_regclass('transporte.mercancias') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT vm.id,vm.empresa_id,vm.mercancia_id,m.clave_interna,m.descripcion,m.clave_bienes_transportados_sat,m.clave_unidad_sat,m.material_peligroso,m.clave_material_peligroso,m.embalaje,m.descripcion_embalaje FROM transporte.viaje_mercancias vm JOIN transporte.mercancias m ON m.id=vm.mercancia_id AND m.empresa_id=vm.empresa_id WHERE vm.mercancia_id IS NOT NULL LOOP
    SELECT p.id INTO v_producto_id FROM public.productos p WHERE p.empresa_id=r.empresa_id AND p.clave=r.clave_interna LIMIT 1;
    IF v_producto_id IS NULL THEN
      INSERT INTO public.productos (empresa_id,clave,descripcion,tipo_producto,activo,clave_bienes_transportados_sat,es_material_peligroso,clave_material_peligroso_sat,clave_embalaje_sat,descripcion_embalaje)
      VALUES (r.empresa_id,r.clave_interna,r.descripcion,'Inventariable',true,r.clave_bienes_transportados_sat,r.material_peligroso,r.clave_material_peligroso,r.embalaje,r.descripcion_embalaje) RETURNING id INTO v_producto_id;
    END IF;
    UPDATE transporte.viaje_mercancias SET producto_id=v_producto_id WHERE id=r.id;
  END LOOP;
END $$;
DO $$ DECLARE pendientes boolean; BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='transporte' AND table_name='viaje_mercancias' AND column_name='mercancia_id') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM transporte.viaje_mercancias WHERE mercancia_id IS NOT NULL AND producto_id IS NULL)' INTO pendientes;
    IF pendientes THEN RAISE EXCEPTION 'No se pudieron migrar todas las referencias legacy de mercancia_id.'; END IF;
  END IF;
END $$;
ALTER TABLE transporte.viaje_mercancias DROP CONSTRAINT IF EXISTS fk_transporte_viaje_mercancias_mercancia;
ALTER TABLE transporte.viaje_mercancias DROP COLUMN IF EXISTS mercancia_id;
DROP TABLE IF EXISTS transporte.mercancias_referencias;
DROP TABLE IF EXISTS transporte.mercancias;
COMMIT;
