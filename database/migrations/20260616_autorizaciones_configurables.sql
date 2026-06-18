-- Sprint 2: Políticas de Autorización
-- Tres modos: ninguna (libre), directa (permiso por rol/usuario), flujo (solicitud formal)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Estado de autorización en el documento origen
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS estado_autorizacion VARCHAR(20)
    DEFAULT 'no_requerida'
    CHECK (estado_autorizacion IN ('no_requerida', 'pendiente', 'aprobada', 'rechazada'));

COMMENT ON COLUMN public.documentos.estado_autorizacion IS
  'Ciclo de vida de autorización del documento. Valores: no_requerida (sin política activa o modo ninguna/directa), pendiente (solicitud de flujo creada y en espera), aprobada (autorizador aprobó; habilita re-ejecución de la transición), rechazada (autorizador rechazó). Solo modo=flujo transiciona entre pendiente/aprobada/rechazada; los otros modos permanecen en no_requerida.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Políticas de autorización por transición y rango de monto
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.autorizaciones_reglas (
  id                        SERIAL PRIMARY KEY,
  empresa_id                INTEGER NOT NULL REFERENCES core.empresas(id),
  transicion_id             INTEGER NOT NULL
                              REFERENCES core.empresas_tipos_documento_transiciones(id),
  monto_minimo              NUMERIC(18, 4),
  monto_maximo              NUMERIC(18, 4),
  modo                      VARCHAR(20) NOT NULL DEFAULT 'flujo'
                              CHECK (modo IN ('ninguna', 'directa', 'flujo')),
  rol_autorizador_id        INTEGER REFERENCES core.roles(id),
  usuario_autorizador_id    INTEGER REFERENCES core.usuarios(id),
  nivel                     SMALLINT NOT NULL DEFAULT 1,
  activa                    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_autorizador_segun_modo
    CHECK (
      modo = 'ninguna'
      OR (rol_autorizador_id IS NOT NULL AND usuario_autorizador_id IS NULL)
      OR (rol_autorizador_id IS NULL AND usuario_autorizador_id IS NOT NULL)
    )
);

COMMENT ON TABLE public.autorizaciones_reglas IS
  'Políticas de autorización por transición documental y rango de monto. Define si una transición (ej. cotización → factura) requiere autorización y bajo qué modo. Invariante: no pueden existir dos filas activas con la misma transicion_id cuyos rangos [monto_minimo, monto_maximo] se solapen; esta regla se valida en la capa de negocio al insertar o actualizar.';

COMMENT ON COLUMN public.autorizaciones_reglas.id IS
  'Identificador interno de la política.';

COMMENT ON COLUMN public.autorizaciones_reglas.empresa_id IS
  'Empresa a la que pertenece esta política. Referencia core.empresas.';

COMMENT ON COLUMN public.autorizaciones_reglas.transicion_id IS
  'Transición documental a la que aplica la política. Referencia core.empresas_tipos_documento_transiciones; contiene el par (tipo_documento_origen, tipo_documento_destino) habilitado para la empresa.';

COMMENT ON COLUMN public.autorizaciones_reglas.monto_minimo IS
  'Límite inferior del rango de monto (inclusive). NULL significa sin límite inferior (aplica desde cero).';

COMMENT ON COLUMN public.autorizaciones_reglas.monto_maximo IS
  'Límite superior del rango de monto (inclusive). NULL significa sin límite superior (aplica hasta cualquier monto).';

COMMENT ON COLUMN public.autorizaciones_reglas.modo IS
  'Modo de autorización: ninguna = libre, sin restricción; directa = solo usuarios con el rol/usuario asignado pueden ejecutar la transición; flujo = se crea una solicitud formal y el documento queda bloqueado hasta que el autorizador responda.';

COMMENT ON COLUMN public.autorizaciones_reglas.rol_autorizador_id IS
  'Rol que puede autorizar la transición en modos directa y flujo. Mutuamente excluyente con usuario_autorizador_id. NULL cuando modo=ninguna.';

COMMENT ON COLUMN public.autorizaciones_reglas.usuario_autorizador_id IS
  'Usuario específico que puede autorizar la transición en modos directa y flujo. Mutuamente excluyente con rol_autorizador_id. NULL cuando modo=ninguna.';

COMMENT ON COLUMN public.autorizaciones_reglas.nivel IS
  'Nivel de autorización en cadena. Reservado para uso futuro (cadenas de aprobación multinivel). Sprint 2 usa siempre nivel = 1.';

COMMENT ON COLUMN public.autorizaciones_reglas.activa IS
  'Soft-delete: false oculta la política sin eliminarla. Las políticas inactivas no se evalúan en tiempo de ejecución ni participan en la validación de traslape.';

COMMENT ON COLUMN public.autorizaciones_reglas.created_at IS
  'Marca de tiempo de creación del registro (UTC).';

COMMENT ON COLUMN public.autorizaciones_reglas.updated_at IS
  'Marca de tiempo de la última modificación del registro (UTC).';

COMMENT ON CONSTRAINT ck_autorizador_segun_modo ON public.autorizaciones_reglas IS
  'Garantiza coherencia entre modo y autorizador: modo ninguna no requiere autorizador; modos directa y flujo requieren exactamente uno (rol XOR usuario).';

CREATE INDEX idx_aut_reglas_empresa    ON public.autorizaciones_reglas(empresa_id);
CREATE INDEX idx_aut_reglas_transicion ON public.autorizaciones_reglas(transicion_id);

COMMENT ON INDEX idx_aut_reglas_empresa IS
  'Acelera la consulta de políticas activas al filtrar por empresa_id.';

COMMENT ON INDEX idx_aut_reglas_transicion IS
  'Acelera la búsqueda de políticas para una transición concreta durante la validación en tiempo de ejecución y la detección de traslape de rangos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Solicitudes formales de autorización (solo para modo='flujo')
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.autorizaciones_solicitudes (
  id                        SERIAL PRIMARY KEY,
  empresa_id                INTEGER NOT NULL REFERENCES core.empresas(id),
  regla_id                  INTEGER NOT NULL REFERENCES public.autorizaciones_reglas(id),
  documento_origen_id       INTEGER NOT NULL REFERENCES public.documentos(id),
  tipo_documento_origen     VARCHAR(60) NOT NULL,
  tipo_documento_destino    VARCHAR(60) NOT NULL,
  folio_documento_origen    VARCHAR(60),
  monto                     NUMERIC(18, 4) NOT NULL,
  usuario_solicitante_id    INTEGER NOT NULL REFERENCES core.usuarios(id),
  usuario_autorizador_id    INTEGER,
  estado                    VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  comentario_solicitante    TEXT,
  comentario_autorizador    TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_at             TIMESTAMPTZ
);

COMMENT ON TABLE public.autorizaciones_solicitudes IS
  'Registro de solicitudes formales de autorización generadas por el modo=flujo. Se crea una fila cuando un usuario intenta ejecutar una transición sujeta a flujo y el documento aún no está aprobado. El documento origen queda en estado_autorizacion=pendiente hasta que el autorizador responde o el solicitante cancela. Los campos tipo_documento_* y folio_documento_origen se copian del documento en el momento de la solicitud para preservar el historial aunque el documento sea modificado o cancelado posteriormente.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.id IS
  'Identificador interno de la solicitud.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.empresa_id IS
  'Empresa a la que pertenece la solicitud. Referencia core.empresas.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.regla_id IS
  'Política de autorización que disparó la creación de esta solicitud. Referencia autorizaciones_reglas.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.documento_origen_id IS
  'Documento cuya transición está pendiente de aprobación. Referencia public.documentos.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.tipo_documento_origen IS
  'Código del tipo de documento origen en el momento de crear la solicitud (ej. cotizacion). Desnormalizado para preservar historial.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.tipo_documento_destino IS
  'Código del tipo de documento que se intentó generar (ej. factura). Desnormalizado para preservar historial.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.folio_documento_origen IS
  'Folio (serie + número) del documento origen en el momento de crear la solicitud. Desnormalizado para mostrar en la bandeja sin join adicional.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.monto IS
  'Total del documento origen en el momento de crear la solicitud. Determina qué política aplica; se congela aquí para que un cambio posterior en el documento no altere la solicitud en curso.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.usuario_solicitante_id IS
  'Usuario que intentó ejecutar la transición y desencadenó la solicitud. Referencia core.usuarios.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.usuario_autorizador_id IS
  'Usuario que efectivamente respondió la solicitud (aprobó o rechazó). Puede diferir del autorizador asignado por la regla si el rol permite a varios usuarios responder. NULL mientras la solicitud esté pendiente.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.estado IS
  'Estado del ciclo de vida de la solicitud: pendiente (en espera de respuesta), aprobada (autorizador aprobó; el documento pasa a estado_autorizacion=aprobada), rechazada (autorizador rechazó), cancelada (el solicitante retiró la solicitud; el documento vuelve a estado_autorizacion=no_requerida).';

COMMENT ON COLUMN public.autorizaciones_solicitudes.comentario_solicitante IS
  'Comentario opcional que el solicitante puede incluir al crear la solicitud.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.comentario_autorizador IS
  'Comentario opcional que el autorizador incluye al aprobar o rechazar.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.created_at IS
  'Marca de tiempo de creación de la solicitud (UTC).';

COMMENT ON COLUMN public.autorizaciones_solicitudes.updated_at IS
  'Marca de tiempo de la última modificación (UTC). Se actualiza al responder o cancelar.';

COMMENT ON COLUMN public.autorizaciones_solicitudes.respondido_at IS
  'Marca de tiempo en que el autorizador respondió (aprobó o rechazó). NULL mientras la solicitud esté pendiente o cancelada.';

CREATE INDEX idx_aut_sol_empresa_estado   ON public.autorizaciones_solicitudes(empresa_id, estado);
CREATE INDEX idx_aut_sol_doc_origen       ON public.autorizaciones_solicitudes(documento_origen_id);
CREATE INDEX idx_aut_sol_solicitante      ON public.autorizaciones_solicitudes(usuario_solicitante_id);
CREATE INDEX idx_aut_sol_autorizador_resp ON public.autorizaciones_solicitudes(usuario_autorizador_id);

COMMENT ON INDEX idx_aut_sol_empresa_estado IS
  'Acelera la consulta de solicitudes por empresa y estado; cubre el filtro principal de la bandeja (empresa_id + estado=pendiente) y de Mis Solicitudes.';

COMMENT ON INDEX idx_aut_sol_doc_origen IS
  'Acelera la búsqueda de solicitudes existentes para un documento origen concreto; usado al verificar si ya existe una solicitud pendiente antes de crear una nueva.';

COMMENT ON INDEX idx_aut_sol_solicitante IS
  'Acelera la vista "Mis Solicitudes", que filtra por usuario_solicitante_id.';

COMMENT ON INDEX idx_aut_sol_autorizador_resp IS
  'Acelera la búsqueda de solicitudes respondidas por un autorizador específico.';
