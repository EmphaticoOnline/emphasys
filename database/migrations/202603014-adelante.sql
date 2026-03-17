BEGIN;

DROP TABLE IF EXISTS public.aplicaciones;

-- =========================================================
-- TABLA aplicaciones
-- =========================================================

CREATE TABLE IF NOT EXISTS public.aplicaciones (
    id serial4 NOT NULL,
    empresa_id int4 NOT NULL,

    -- origen del saldo
    finanzas_operacion_id int4 NULL,
    documento_origen_id int4 NULL,

    -- destino del saldo
    documento_destino_id int4 NOT NULL,

    monto numeric(15,2) NOT NULL,
    monto_moneda_documento numeric(15,2) NOT NULL,

    fecha_aplicacion timestamptz DEFAULT now() NOT NULL,
    fecha_creacion timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT aplicaciones_pkey PRIMARY KEY (id)
);

-- =========================================================
-- COMMENTS TABLA
-- =========================================================

COMMENT ON TABLE public.aplicaciones IS
'Registra aplicaciones de saldo desde pagos o notas de crédito hacia documentos destino (por ejemplo facturas). Soporta multimoneda.';

COMMENT ON COLUMN public.aplicaciones.id IS
'Identificador único de la aplicación.';

COMMENT ON COLUMN public.aplicaciones.empresa_id IS
'Empresa a la que pertenece la aplicación (soporte multiempresa).';

COMMENT ON COLUMN public.aplicaciones.finanzas_operacion_id IS
'Origen de la aplicación cuando proviene de una operación financiera (pago de banco o caja).';

COMMENT ON COLUMN public.aplicaciones.documento_origen_id IS
'Origen de la aplicación cuando proviene de un documento (por ejemplo una nota de crédito).';

COMMENT ON COLUMN public.aplicaciones.documento_destino_id IS
'Documento que recibe la aplicación de saldo (normalmente una factura).';

COMMENT ON COLUMN public.aplicaciones.monto IS
'Monto aplicado en moneda base del sistema (por ejemplo MXN). Se descuenta del saldo del origen.';

COMMENT ON COLUMN public.aplicaciones.monto_moneda_documento IS
'Monto aplicado expresado en la moneda del documento destino. Se utiliza para calcular el saldo del documento destino.';

COMMENT ON COLUMN public.aplicaciones.fecha_aplicacion IS
'Fecha efectiva en la que se realiza la aplicación del saldo.';

COMMENT ON COLUMN public.aplicaciones.fecha_creacion IS
'Fecha en que se creó el registro de la aplicación en el sistema.';

-- =========================================================
-- FOREIGN KEYS
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_empresa'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_operacion'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_operacion
        FOREIGN KEY (finanzas_operacion_id)
        REFERENCES public.finanzas_operaciones(id)
        ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_doc_origen'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_doc_origen
        FOREIGN KEY (documento_origen_id)
        REFERENCES public.documentos(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_doc_destino'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_doc_destino
        FOREIGN KEY (documento_destino_id)
        REFERENCES public.documentos(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- =========================================================
-- CHECK CONSTRAINT
-- Solo uno de los dos orígenes puede existir
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_aplicacion_origen'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT chk_aplicacion_origen
        CHECK (
            (finanzas_operacion_id IS NOT NULL AND documento_origen_id IS NULL)
            OR
            (finanzas_operacion_id IS NULL AND documento_origen_id IS NOT NULL)
        );
    END IF;
END $$;

-- =========================================================
-- ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_aplicaciones_empresa
ON public.aplicaciones(empresa_id);

COMMENT ON INDEX idx_aplicaciones_empresa IS
'Permite filtrar rápidamente aplicaciones por empresa.';

CREATE INDEX IF NOT EXISTS idx_aplicaciones_operacion
ON public.aplicaciones(finanzas_operacion_id);

COMMENT ON INDEX idx_aplicaciones_operacion IS
'Optimiza consultas para calcular saldo de operaciones financieras (pagos).';

CREATE INDEX IF NOT EXISTS idx_aplicaciones_doc_origen
ON public.aplicaciones(documento_origen_id);

COMMENT ON INDEX idx_aplicaciones_doc_origen IS
'Optimiza consultas para calcular saldo disponible de notas de crédito.';

CREATE INDEX IF NOT EXISTS idx_aplicaciones_doc_destino
ON public.aplicaciones(documento_destino_id);

COMMENT ON INDEX idx_aplicaciones_doc_destino IS
'Optimiza consultas para calcular saldo pendiente de documentos destino (facturas).';

ALTER TABLE finanzas_operaciones
ADD COLUMN naturaleza_operacion VARCHAR(30) NOT NULL DEFAULT 'movimiento_general';

CREATE INDEX idx_finanzas_operaciones_empresa_naturaleza
ON finanzas_operaciones (empresa_id, naturaleza_operacion);

CREATE INDEX idx_aplicaciones_operacion_empresa
ON aplicaciones (empresa_id, finanzas_operacion_id);


-- Crea la vista documentos_saldo para compatibilidad con consultas de finanzas
-- Calcula el saldo como total del documento menos las aplicaciones al documento destino
CREATE OR REPLACE VIEW public.documentos_saldo AS
SELECT
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total,
    d.total - COALESCE(SUM(a.monto), 0) AS saldo
FROM public.documentos d
LEFT JOIN public.aplicaciones a
  ON a.documento_destino_id = d.id
 AND a.empresa_id = d.empresa_id
GROUP BY
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total;

COMMENT ON VIEW public.documentos_saldo IS 'Vista de compatibilidad: id, empresa_id, datos básicos y saldo = total - aplicaciones (COALESCE).';


ALTER TABLE documentos_partidas
DROP COLUMN iva_porcentaje;

ALTER TABLE documentos_partidas
DROP COLUMN iva_monto;



CREATE OR REPLACE PROCEDURE core.bootstrap_empresa(p_empresa_id integer, p_usuario_id integer)
LANGUAGE plpgsql
AS $$
BEGIN
  ---------------------------------------------------------------------------
  -- Validaciones
  ---------------------------------------------------------------------------
  PERFORM 1 FROM core.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La empresa % no existe', p_empresa_id;
  END IF;

  PERFORM 1 FROM core.usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario % no existe', p_usuario_id;
  END IF;

  ---------------------------------------------------------------------------
  -- Roles base
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando roles base...';
  INSERT INTO core.roles (empresa_id, nombre, descripcion, activo)
  VALUES
    (p_empresa_id, 'Administrador', 'Rol base administrador', true),
    (p_empresa_id, 'Supervisor',    'Rol base supervisor',    true),
    (p_empresa_id, 'Operador',      'Rol base operador',      true),
    (p_empresa_id, 'Consulta',      'Rol base consulta',      true)
  ON CONFLICT (empresa_id, nombre) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Asociación usuario-empresa
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Registrando usuario en la empresa...';
  INSERT INTO core.usuarios_empresas (usuario_id, empresa_id)
  VALUES (p_usuario_id, p_empresa_id)
  ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Asignar rol Administrador al usuario
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Asignando rol Administrador al usuario...';
  INSERT INTO core.usuarios_roles (usuario_id, empresa_id, rol_id)
  SELECT
    p_usuario_id,
    p_empresa_id,
    r.id
  FROM core.roles r
  WHERE r.empresa_id = p_empresa_id
    AND r.nombre = 'Administrador'
  ON CONFLICT (usuario_id, empresa_id, rol_id) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Parámetros por empresa (copiando core.parametros)
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Inicializando parametros_empresa...';
  INSERT INTO core.parametros_empresa (empresa_id, parametro_id, valor)
  SELECT p_empresa_id, p.parametro_id, COALESCE(p.valor_default, NULL)
  FROM core.parametros p
  WHERE NOT EXISTS (
    SELECT 1
    FROM core.parametros_empresa pe
    WHERE pe.empresa_id = p_empresa_id
      AND pe.parametro_id = p.parametro_id
  );

---------------------------------------------------------------------------
-- Valores críticos de parámetros (hardcoded)
---------------------------------------------------------------------------
RAISE NOTICE 'Aplicando valores críticos de configuración...';

UPDATE core.parametros_empresa pe
SET valor = v.valor
FROM (
  VALUES
    ('decimales_costos','2'),
    ('decimales_cantidades','2'),
    ('decimales_precios','2'),
    ('variacion_maxima_costos','0.20'),
    ('porcentaje_iva_predeterminado','0.16'),

    ('usar_series','true'),
    ('permitir_afectacion_ajustes','true'),
    ('usar_ultimo_costo_precios','true'),

    ('serie_facturas','F'),
    ('serie_notas','N'),
    ('serie_notas_credito','NC'),
    ('serie_pedidos','P'),
    ('serie_ordenes_entrega','OE'),

    ('serie_ordenes_compra','OC'),
    ('serie_pagos_proveedores','PGP'),

    ('serie_transacciones_inventario','INV'),
    ('serie_ajustes','AJ'),
    ('serie_entradas','EN'),

    ('serie_nota_venta','N'),

    ('oc_requiere_autorizacion','true'),
    ('aprobacion_automatica_pagos','false'),
    ('utilizar_limite_credito','true'),
    ('restringir_segun_vencimiento','false'),
    ('tipo_cliente_obligatorio','true')
) AS v(clave,valor)
JOIN core.parametros p
  ON p.clave = v.clave
WHERE pe.parametro_id = p.parametro_id
AND pe.empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Impuestos por default
  ---------------------------------------------------------------------------

RAISE NOTICE 'Creando impuestos por defecto...';

INSERT INTO core.empresas_impuestos_default
(empresa_id, impuesto_id, orden)
VALUES
(p_empresa_id, 'iva_16', 1)
ON CONFLICT DO NOTHING;

  ---------------------------------------------------------------------------
  -- Tipos de documento por empresa (copiando core.tipos_documento)
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Inicializando empresas_tipos_documento...';
  INSERT INTO core.empresas_tipos_documento
    (empresa_id, tipo_documento_id, activo, orden, usuario_creacion_id)
  SELECT
    p_empresa_id,
    td.id,
    td.activo,
    td.orden,
    p_usuario_id
  FROM core.tipos_documento td
  WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento etd
    WHERE etd.empresa_id = p_empresa_id
      AND etd.tipo_documento_id = td.id
  );

  ---------------------------------------------------------------------------
  -- Transiciones base de tipos de documento
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Inicializando transiciones de documentos...';
  WITH t(cod_origen, cod_destino) AS (
    VALUES
      ('cotizacion',    'pedido'),
      ('pedido',        'orden_entrega'),
      ('orden_entrega', 'remision'),
      ('remision',      'factura'),
      ('requisicion',   'orden_compra'),
      ('orden_compra',  'recepcion'),
      ('recepcion',     'factura_compra')
  )
  INSERT INTO core.empresas_tipos_documento_transiciones
    (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id, activo, orden, usuario_creacion_id)
  SELECT
    p_empresa_id,
    etd_origen.tipo_documento_id,
    etd_destino.tipo_documento_id,
    true,
    ROW_NUMBER() OVER (ORDER BY t.cod_origen, t.cod_destino) - 1,
    p_usuario_id
  FROM t
  JOIN core.tipos_documento td_origen   ON td_origen.codigo  = t.cod_origen
  JOIN core.tipos_documento td_destino  ON td_destino.codigo = t.cod_destino
  JOIN core.empresas_tipos_documento etd_origen
       ON etd_origen.empresa_id = p_empresa_id
      AND etd_origen.tipo_documento_id = td_origen.id
  JOIN core.empresas_tipos_documento etd_destino
       ON etd_destino.empresa_id = p_empresa_id
      AND etd_destino.tipo_documento_id = td_destino.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento_transiciones x
    WHERE x.empresa_id = p_empresa_id
      AND x.tipo_documento_origen_id  = etd_origen.tipo_documento_id
      AND x.tipo_documento_destino_id = etd_destino.tipo_documento_id
  );

  ---------------------------------------------------------------------------
  -- Cuenta financiera inicial
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando cuenta financiera inicial...';
  INSERT INTO public.finanzas_cuentas
    (empresa_id, identificador, numero_cuenta, tipo_cuenta, moneda,
     saldo, saldo_inicial, saldo_conciliado, es_cuenta_efectivo, afecta_total_disponible)
  SELECT p_empresa_id, 'Caja', NULL, 'Disponibilidad', 'MXN',
         0, 0, 0, true, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.finanzas_cuentas fc
    WHERE fc.empresa_id = p_empresa_id
      AND fc.identificador = 'Caja'
  );

  ---------------------------------------------------------------------------
  -- Conceptos base
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando conceptos base...';
  INSERT INTO public.conceptos
    (empresa_id, nombre_concepto, es_gasto, activo, orden, color)
  VALUES
    (p_empresa_id, 'Ingreso', false, true, 0, '#2E7D32'),
    (p_empresa_id, 'Venta',   false, true, 1, '#1565C0'),
    (p_empresa_id, 'Gasto',   true,  true, 2, '#C62828'),
    (p_empresa_id, 'Compra',  true,  true, 3, '#6A1B9A'),
    (p_empresa_id, 'Ajuste',  true,  true, 4, '#F9A825')
  ON CONFLICT (empresa_id, nombre_concepto) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Aviso final
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Bootstrap completado para la empresa %.', p_empresa_id;

END;
$$;




CREATE OR REPLACE PROCEDURE core.reset_empresa(p_empresa_id integer)
LANGUAGE plpgsql
AS $$
BEGIN

  ---------------------------------------------------------------------------
  -- WhatsApp
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Eliminando WhatsApp...';
  DELETE FROM whatsapp.whatsapp_mensajes
  WHERE empresa_id = p_empresa_id;

  DELETE FROM whatsapp.whatsapp_estadisticas
  WHERE empresa_id = p_empresa_id;

  DELETE FROM whatsapp.whatsapp_conversaciones
  WHERE empresa_id = p_empresa_id;

  DELETE FROM whatsapp.whatsapp_contacto_estado
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Finanzas / aplicaciones
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Eliminando conciliaciones_operaciones...';

  DELETE FROM public.finanzas_conciliaciones_operaciones fco
  USING public.finanzas_conciliaciones fc
  WHERE fco.conciliacion_id = fc.id
  AND fc.empresa_id = p_empresa_id;

  DELETE FROM public.aplicaciones
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.finanzas_operaciones
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.finanzas_transferencias
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.finanzas_conciliaciones
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Crédito
  ---------------------------------------------------------------------------
  DELETE FROM public.credito_operaciones_aplicaciones
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.credito_operaciones_items coi
  USING public.credito_operaciones co
  WHERE coi.operacion_credito_id = co.id
  AND co.empresa_id = p_empresa_id;

  DELETE FROM public.credito_operaciones
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Documentos
  ---------------------------------------------------------------------------
  DELETE FROM public.documentos_partidas_impuestos dpi
  USING public.documentos_partidas dp
  WHERE dpi.partida_id = dp.id
  AND dp.documento_id IN (
      SELECT id FROM public.documentos WHERE empresa_id = p_empresa_id
  );

  DELETE FROM public.documentos_partidas_campos
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.documentos_partidas_vinculos
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.documentos_partidas dp
  USING public.documentos d
  WHERE dp.documento_id = d.id
  AND d.empresa_id = p_empresa_id;

  DELETE FROM public.documentos_campos
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.documentos_cfdi dc
  USING public.documentos d
  WHERE dc.documento_id = d.id
  AND d.empresa_id = p_empresa_id;

  DELETE FROM public.documentos
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Contactos
  ---------------------------------------------------------------------------
  DELETE FROM public.contactos_datos_fiscales cdf
  USING public.contactos c
  WHERE cdf.contacto_id = c.id
  AND c.empresa_id = p_empresa_id;

  DELETE FROM public.contactos_domicilios cd
  USING public.contactos c
  WHERE cd.contacto_id = c.id
  AND c.empresa_id = p_empresa_id;

  DELETE FROM public.contactos
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Productos
  ---------------------------------------------------------------------------
  DELETE FROM public.productos_impuestos pi
  USING public.productos p
  WHERE pi.producto_id = p.id
  AND p.empresa_id = p_empresa_id;

  DELETE FROM public.productos
  WHERE empresa_id = p_empresa_id;

  DELETE FROM public.unidades
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Otros operativos
  ---------------------------------------------------------------------------
  DELETE FROM public.crm_ruteo_leads
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- CONFIGURACIÓN EMPRESA
  ---------------------------------------------------------------------------

  RAISE NOTICE 'Eliminando transiciones documentos...';
  DELETE FROM core.empresas_tipos_documento_transiciones
  WHERE empresa_id = p_empresa_id;

  RAISE NOTICE 'Eliminando tipos documento empresa...';
  DELETE FROM core.empresas_tipos_documento
  WHERE empresa_id = p_empresa_id;

  RAISE NOTICE 'Eliminando parametros_empresa...';
  DELETE FROM core.parametros_empresa
  WHERE empresa_id = p_empresa_id;

  RAISE NOTICE 'Eliminando impuestos default...';
  DELETE FROM core.empresas_impuestos_default
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Operativo
  ---------------------------------------------------------------------------

  RAISE NOTICE 'Eliminando conceptos...';
  DELETE FROM public.conceptos
  WHERE empresa_id = p_empresa_id;

  RAISE NOTICE 'Eliminando finanzas_cuentas...';
  DELETE FROM public.finanzas_cuentas
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Seguridad
  ---------------------------------------------------------------------------

  RAISE NOTICE 'Eliminando usuarios_roles...';
  DELETE FROM core.usuarios_roles
  WHERE empresa_id = p_empresa_id;

  RAISE NOTICE 'Eliminando usuarios_empresas...';
  DELETE FROM core.usuarios_empresas
  WHERE empresa_id = p_empresa_id;

  RAISE NOTICE 'Eliminando roles...';
  DELETE FROM core.roles
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Assets
  ---------------------------------------------------------------------------

  DELETE FROM core.empresas_assets
  WHERE empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Fin
  ---------------------------------------------------------------------------

  RAISE NOTICE 'Reset completado para empresa %', p_empresa_id;




/* ============================================================
   MÓDULO INVENTARIO
   Script idempotente de creación base
   ============================================================ */

CREATE SCHEMA IF NOT EXISTS inventario;

COMMENT ON SCHEMA inventario IS
'Módulo de inventario del ERP. Contiene movimientos, partidas y existencias por producto y almacén.';


/* ============================================================
   TABLA: inventario.movimientos
   ============================================================ */

CREATE TABLE IF NOT EXISTS inventario.movimientos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    documento_id INTEGER NULL,
    usuario_id INTEGER NULL,
    tipo_movimiento VARCHAR(30) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL,
    observaciones TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_inv_mov_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_inv_mov_documento
        FOREIGN KEY (documento_id)
        REFERENCES public.documentos(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_inv_mov_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES core.usuarios(id)
        ON DELETE SET NULL
);

COMMENT ON TABLE inventario.movimientos IS
'Encabezado de movimientos de inventario. Representa una transacción que afecta existencias, ya sea originada por documento o por captura independiente.';

COMMENT ON COLUMN inventario.movimientos.id IS
'Identificador único del movimiento de inventario.';

COMMENT ON COLUMN inventario.movimientos.empresa_id IS
'Empresa propietaria del movimiento.';

COMMENT ON COLUMN inventario.movimientos.documento_id IS
'Documento origen que generó el movimiento. Puede ser NULL para ajustes, transferencias, conteos u otros movimientos independientes.';

COMMENT ON COLUMN inventario.movimientos.usuario_id IS
'Usuario que registró o confirmó el movimiento.';

COMMENT ON COLUMN inventario.movimientos.tipo_movimiento IS
'Tipo general del movimiento: compra, venta, ajuste, transferencia, conteo, merma, devolución, etc.';

COMMENT ON COLUMN inventario.movimientos.fecha IS
'Fecha efectiva del movimiento de inventario.';

COMMENT ON COLUMN inventario.movimientos.observaciones IS
'Notas u observaciones generales relacionadas con el movimiento.';

COMMENT ON COLUMN inventario.movimientos.created_at IS
'Fecha y hora de creación del registro.';

COMMENT ON COLUMN inventario.movimientos.updated_at IS
'Fecha y hora de última actualización del registro.';


/* ============================================================
   TABLA: inventario.movimientos_partidas
   ============================================================ */

CREATE TABLE IF NOT EXISTS inventario.movimientos_partidas (
    id BIGSERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    movimiento_id BIGINT NOT NULL,
    documento_partida_id INTEGER NULL,
    producto_id INTEGER NOT NULL,
    almacen_id INTEGER NOT NULL,
    almacen_destino_id INTEGER NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL,
    cantidad NUMERIC(18,6) NOT NULL,
    signo SMALLINT NOT NULL,
    tipo_partida VARCHAR(25) NOT NULL DEFAULT 'normal',
    costo_unitario NUMERIC(18,6) NULL,
    existencia_resultante NUMERIC(18,6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_inv_part_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_inv_part_movimiento
        FOREIGN KEY (movimiento_id)
        REFERENCES inventario.movimientos(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_inv_part_doc_partida
        FOREIGN KEY (documento_partida_id)
        REFERENCES public.documentos_partidas(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_inv_part_producto
        FOREIGN KEY (producto_id)
        REFERENCES public.productos(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT chk_inv_part_signo
        CHECK (signo IN (-1, 1)),
    CONSTRAINT chk_inv_part_cantidad
        CHECK (cantidad > 0),
    CONSTRAINT chk_inv_part_tipo
        CHECK (
            tipo_partida IN (
                'normal',
                'salida_transferencia',
                'entrada_transferencia'
            )
        )
);

COMMENT ON TABLE inventario.movimientos_partidas IS
'Detalle de movimientos de inventario. Cada fila representa una afectación física en el kardex de un producto y un almacén.';

COMMENT ON COLUMN inventario.movimientos_partidas.id IS
'Identificador único de la partida del movimiento.';

COMMENT ON COLUMN inventario.movimientos_partidas.empresa_id IS
'Empresa propietaria de la partida.';

COMMENT ON COLUMN inventario.movimientos_partidas.movimiento_id IS
'Referencia al encabezado del movimiento de inventario.';

COMMENT ON COLUMN inventario.movimientos_partidas.documento_partida_id IS
'Referencia opcional a la partida del documento que originó la afectación.';

COMMENT ON COLUMN inventario.movimientos_partidas.producto_id IS
'Producto afectado por la partida.';

COMMENT ON COLUMN inventario.movimientos_partidas.almacen_id IS
'Almacén afectado por esta partida. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';

COMMENT ON COLUMN inventario.movimientos_partidas.almacen_destino_id IS
'Almacén destino relacionado. Se usa principalmente en transferencias. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';

COMMENT ON COLUMN inventario.movimientos_partidas.fecha_movimiento IS
'Fecha efectiva usada para ordenar el kardex y recalcular existencias históricas.';

COMMENT ON COLUMN inventario.movimientos_partidas.cantidad IS
'Cantidad del producto afectada por la partida.';

COMMENT ON COLUMN inventario.movimientos_partidas.signo IS
'Naturaleza del movimiento: +1 entrada, -1 salida.';

COMMENT ON COLUMN inventario.movimientos_partidas.tipo_partida IS
'Tipo de partida: normal, salida_transferencia o entrada_transferencia.';

COMMENT ON COLUMN inventario.movimientos_partidas.costo_unitario IS
'Costo unitario del producto al momento del movimiento.';

COMMENT ON COLUMN inventario.movimientos_partidas.existencia_resultante IS
'Existencia del producto en el almacén inmediatamente después de aplicar esta partida.';

COMMENT ON COLUMN inventario.movimientos_partidas.created_at IS
'Fecha y hora de creación del registro.';


/* ============================================================
   TABLA: inventario.existencias
   ============================================================ */

CREATE TABLE IF NOT EXISTS inventario.existencias (
    id BIGSERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    almacen_id INTEGER NOT NULL,
    existencia NUMERIC(18,6) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_inv_exist_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_inv_exist_producto
        FOREIGN KEY (producto_id)
        REFERENCES public.productos(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT uq_inv_existencias_empresa_producto_almacen
        UNIQUE (empresa_id, producto_id, almacen_id)
);

COMMENT ON TABLE inventario.existencias IS
'Existencias actuales por producto y almacén. Permite consultas rápidas sin recorrer todo el kardex.';

COMMENT ON COLUMN inventario.existencias.id IS
'Identificador único del registro de existencias.';

COMMENT ON COLUMN inventario.existencias.empresa_id IS
'Empresa propietaria del registro de existencias.';

COMMENT ON COLUMN inventario.existencias.producto_id IS
'Producto al que corresponde la existencia.';

COMMENT ON COLUMN inventario.existencias.almacen_id IS
'Almacén donde se controla la existencia. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';

COMMENT ON COLUMN inventario.existencias.existencia IS
'Cantidad actual disponible del producto en el almacén.';

COMMENT ON COLUMN inventario.existencias.updated_at IS
'Fecha y hora de última actualización del registro de existencias.';


/* ============================================================
   ÍNDICES
   ============================================================ */

CREATE INDEX IF NOT EXISTS idx_inv_mov_empresa
ON inventario.movimientos (empresa_id);

COMMENT ON INDEX inventario.idx_inv_mov_empresa IS
'Índice para consultas de movimientos por empresa.';


CREATE INDEX IF NOT EXISTS idx_inv_mov_documento
ON inventario.movimientos (documento_id);

COMMENT ON INDEX inventario.idx_inv_mov_documento IS
'Índice para localizar movimientos originados por documentos.';


CREATE INDEX IF NOT EXISTS idx_inv_mov_tipo
ON inventario.movimientos (empresa_id, tipo_movimiento);

COMMENT ON INDEX inventario.idx_inv_mov_tipo IS
'Índice para consultas de movimientos por empresa y tipo de movimiento.';


CREATE INDEX IF NOT EXISTS idx_inv_part_movimiento
ON inventario.movimientos_partidas (movimiento_id);

COMMENT ON INDEX inventario.idx_inv_part_movimiento IS
'Índice para recuperar rápidamente las partidas de un movimiento.';


CREATE INDEX IF NOT EXISTS idx_inv_part_kardex
ON inventario.movimientos_partidas
(empresa_id, producto_id, almacen_id, fecha_movimiento, id);

COMMENT ON INDEX inventario.idx_inv_part_kardex IS
'Índice principal para recorridos de kardex y recalculo histórico por empresa, producto y almacén.';


CREATE INDEX IF NOT EXISTS idx_inv_part_transferencia_destino
ON inventario.movimientos_partidas
(empresa_id, producto_id, almacen_destino_id, fecha_movimiento, id);

COMMENT ON INDEX inventario.idx_inv_part_transferencia_destino IS
'Índice auxiliar para rastrear transferencias hacia un almacén destino.';


CREATE INDEX IF NOT EXISTS idx_inv_existencias_lookup
ON inventario.existencias
(empresa_id, producto_id, almacen_id);

COMMENT ON INDEX inventario.idx_inv_existencias_lookup IS
'Índice para consultas rápidas de existencias por empresa, producto y almacén.';




CREATE INDEX IF NOT EXISTS idx_inv_part_recalculo
ON inventario.movimientos_partidas
(empresa_id, producto_id, almacen_id, id); 



INSERT INTO core.parametros (
    clave,
    nombre,
    tipo_dato,
    tipo_control,
    valor_default
)
VALUES (
    'inventario.permite_negativos',
    'Permitir inventario negativo',
    'boolean',
    'switch',
    'true'
);

END;
$$;



-- =========================================================
-- inventario.almacenes
-- Script idempotente de creación
-- =========================================================

CREATE SCHEMA IF NOT EXISTS inventario;

CREATE TABLE IF NOT EXISTS inventario.almacenes (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY,
    empresa_id      INTEGER NOT NULL,
    clave           VARCHAR(30) NOT NULL,
    nombre          VARCHAR(120) NOT NULL,
    tipo            VARCHAR(30) NOT NULL DEFAULT 'normal',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,

    CONSTRAINT pk_inventario_almacenes
        PRIMARY KEY (id),

    CONSTRAINT fk_inventario_almacenes_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id),

    CONSTRAINT chk_inventario_almacenes_clave_no_vacia
        CHECK (btrim(clave) <> ''),

    CONSTRAINT chk_inventario_almacenes_nombre_no_vacio
        CHECK (btrim(nombre) <> ''),

    CONSTRAINT chk_inventario_almacenes_tipo_no_vacio
        CHECK (btrim(tipo) <> '')
);

-- =========================================================
-- Índices
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_inventario_almacenes_empresa_id
    ON inventario.almacenes (empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_almacenes_empresa_clave
    ON inventario.almacenes (empresa_id, clave);

CREATE INDEX IF NOT EXISTS idx_inventario_almacenes_empresa_activo
    ON inventario.almacenes (empresa_id, activo);

CREATE INDEX IF NOT EXISTS idx_inventario_almacenes_empresa_nombre
    ON inventario.almacenes (empresa_id, nombre);

-- =========================================================
-- Comments de tabla
-- =========================================================

COMMENT ON TABLE inventario.almacenes IS
'Catálogo de almacenes por empresa para el módulo de inventario.';

-- =========================================================
-- Comments de columnas
-- =========================================================

COMMENT ON COLUMN inventario.almacenes.id IS
'Identificador único interno del almacén.';

COMMENT ON COLUMN inventario.almacenes.empresa_id IS
'Empresa a la que pertenece el almacén.';

COMMENT ON COLUMN inventario.almacenes.clave IS
'Clave corta obligatoria del almacén, usada como identificador visible para los usuarios.';

COMMENT ON COLUMN inventario.almacenes.nombre IS
'Nombre descriptivo del almacén.';

COMMENT ON COLUMN inventario.almacenes.tipo IS
'Tipo de almacén: normal, transito, virtual, produccion, consignacion, etc.';

COMMENT ON COLUMN inventario.almacenes.activo IS
'Indica si el almacén está activo para operación.';

COMMENT ON COLUMN inventario.almacenes.created_at IS
'Fecha y hora de creación del registro.';

COMMENT ON COLUMN inventario.almacenes.updated_at IS
'Fecha y hora de la última actualización del registro.';

-- =========================================================
-- Comments de índices
-- =========================================================

COMMENT ON INDEX inventario.idx_inventario_almacenes_empresa_id IS
'Índice para búsquedas de almacenes por empresa.';

COMMENT ON INDEX inventario.uq_inventario_almacenes_empresa_clave IS
'Garantiza que la clave del almacén no se repita dentro de una misma empresa.';

COMMENT ON INDEX inventario.idx_inventario_almacenes_empresa_activo IS
'Índice para filtrar almacenes activos por empresa.';

COMMENT ON INDEX inventario.idx_inventario_almacenes_empresa_nombre IS
'Índice para búsquedas y ordenamientos por nombre dentro de la empresa.';

/* Crear almacén principal
INSERT INTO inventario.almacenes (
    empresa_id,
    clave,
    nombre,
    tipo
)
SELECT
    1,
    'PRINCIPAL',
    'Almacén principal',
    'normal'
WHERE NOT EXISTS (
    SELECT 1
    FROM inventario.almacenes
    WHERE empresa_id = 1
      AND clave = 'MATRIZ'
);
*/


ALTER TABLE core.empresas_tipos_documento
ADD COLUMN afecta_inventario VARCHAR(20) NOT NULL DEFAULT 'none',
ADD COLUMN afecta_reservado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN core.empresas_tipos_documento.afecta_inventario IS 
'Define cómo afecta inventario: none, entrada, salida, transferencia.';

COMMENT ON COLUMN core.empresas_tipos_documento.afecta_reservado IS 
'Indica si el documento afecta cantidades reservadas (apartados o compromisos).';





/*========================================================
Agregar los campos de almacen y a documentos y partidas 
========================================================*/

-- =========================================
-- 1. documentos.almacen_id
-- =========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documentos'
          AND column_name = 'almacen_id'
    ) THEN
        ALTER TABLE public.documentos
        ADD COLUMN almacen_id INT4 NULL;
    END IF;
END$$;

COMMENT ON COLUMN public.documentos.almacen_id IS
'Almacén predeterminado del documento. Se usa cuando la partida no especifica uno.';

-- FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_documentos_almacen'
    ) THEN
        ALTER TABLE public.documentos
        ADD CONSTRAINT fk_documentos_almacen
        FOREIGN KEY (almacen_id)
        REFERENCES inventario.almacenes(id)
        ON DELETE RESTRICT;
    END IF;
END$$;

-- Índice
CREATE INDEX IF NOT EXISTS idx_documentos_almacen_id
ON public.documentos (almacen_id);

-- =========================================
-- 2. documentos_partidas.almacen_id
-- =========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documentos_partidas'
          AND column_name = 'almacen_id'
    ) THEN
        ALTER TABLE public.documentos_partidas
        ADD COLUMN almacen_id INT4 NULL;
    END IF;
END$$;

COMMENT ON COLUMN public.documentos_partidas.almacen_id IS
'Almacén específico de la partida. Si es NULL, se usa el almacén del documento.';

-- FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_documentos_partidas_almacen'
    ) THEN
        ALTER TABLE public.documentos_partidas
        ADD CONSTRAINT fk_documentos_partidas_almacen
        FOREIGN KEY (almacen_id)
        REFERENCES inventario.almacenes(id)
        ON DELETE RESTRICT;
    END IF;
END$$;

-- Índice
CREATE INDEX IF NOT EXISTS idx_documentos_partidas_almacen_id
ON public.documentos_partidas (almacen_id);

/*========================================================
Fin de Agregar los campos de almacen y a documentos y partidas 
========================================================*/


/*=========================================
 * AGREGAR EL PARAMETRO PARA EL ALMACEN PREDETERMINADO EN DOCUMENTOS QUE AFECTEN EL INVENTARIO
 * ========================================
 */
-- =========================================
-- 1. Crear parámetro
-- =========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM core.parametros
        WHERE clave = 'inventario.almacen_default'
    ) THEN
        INSERT INTO core.parametros (
            clave,
            nombre,
            tipo_dato,
            tipo_control,
            valor_default
        )
        VALUES (
            'inventario.almacen_default',
            'Almacén predeterminado de inventario',
            'int',
            'dropdown',
            NULL
        );
    END IF;
END$$;

-- =========================================
-- 2. Poblar opciones desde inventario.almacenes
-- =========================================
DO $$
DECLARE
    v_parametro_id INT;
BEGIN
    SELECT parametro_id
    INTO v_parametro_id
    FROM core.parametros
    WHERE clave = 'inventario.almacen_default';

    -- Insertar opciones (id del almacén como valor)
    INSERT INTO core.parametros_opciones (parametro_id, valor, etiqueta, orden)
    SELECT
        v_parametro_id,
        a.id::text,
        a.nombre,
        ROW_NUMBER() OVER (ORDER BY a.nombre)
    FROM inventario.almacenes a
    WHERE NOT EXISTS (
        SELECT 1
        FROM core.parametros_opciones po
        WHERE po.parametro_id = v_parametro_id
          AND po.valor = a.id::text
    );
END$$;

/*=========================================
 * FIN DE AGREGAR EL PARAMETRO PARA EL ALMACEN PREDETERMINADO EN DOCUMENTOS QUE AFECTEN EL INVENTARIO
 * ======================================== */


/*=========================================
 * AGREGAR CAMPO ES_REVERSION A INVENTARIO.MOVIMIENTOS PARA IDENTIFICAR MOVIMIENTOS GENERADOS POR REVERSIÓN DE DOCUMENTO
 * ======================================== */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'inventario'
          AND table_name = 'movimientos'
          AND column_name = 'es_reversion'
    ) THEN
        ALTER TABLE inventario.movimientos
        ADD COLUMN es_reversion BOOLEAN NOT NULL DEFAULT false;
    END IF;
END$$;

COMMENT ON COLUMN inventario.movimientos.es_reversion IS
'Indica si el movimiento fue generado como reverso por cancelación de documento.';

/*=========================================
 * FIN DE AGREGAR CAMPO ES_REVERSION A INVENTARIO.MOVIMIENTOS PARA IDENTIFICAR MOVIMIENTOS GENERADOS POR REVERSIÓN DE DOCUMENTO
 * ======================================== */


COMMIT;