# Descarga masiva de CFDIs desde el SAT

**Estado: V1 funcional** (cerrado en Fase 12). Cubre configuración de FIEL,
solicitudes reales al SAT, descarga de paquetes, bandeja de comprobantes con
evaluación operativa, importación individual/por lote a Compras, vinculación
manual a facturas ya capturadas, automatización asistida, bitácora, resumen/
alertas y esta documentación. Ver "Backlog futuro recomendado" al final para
lo que queda deliberadamente fuera de esta V1.

Módulo que permite a cada empresa configurar su e.firma (FIEL), presentar
solicitudes reales al Servicio Web de Descarga Masiva del SAT, verificarlas,
descargar los paquetes de CFDIs recibidos y, opcionalmente, importar los
comprobantes de tipo Ingreso (`I`) recibidos de un proveedor como facturas de
compra en borrador dentro de Emphasys.

Backend: `backend/src/modules/configuracion/cfdi-sat/`.
Frontend: `frontend/src/pages/configuracion/CfdiSatPage.tsx` y
`frontend/src/components/cfdi-sat/`.

## Flujo completo

1. **Configuración de la FIEL** (Fase 1). Un administrador de la empresa sube
   el certificado (`.cer`) y la llave privada (`.key`) de la e.firma.
2. **Autorización de uso**. El administrador acepta un texto de autorización
   expresa para que Emphasys use la e.firma únicamente contra el Servicio de
   Descarga Masiva del SAT.
3. **Creación de solicitudes** (Fase 2). Con FIEL vigente y autorización
   aceptada, se crea una solicitud real ante el SAT (emitidos/recibidos,
   metadata/XML, rango de fechas, estatus del comprobante). La contraseña de
   la FIEL se pide en cada acción y nunca se guarda.
4. **Verificación y descarga** (Fase 3). Se consulta el estatus de la
   solicitud ante el SAT y, cuando está lista, se descargan los paquetes ZIP,
   se extraen los XML y se registra un renglón por comprobante en
   `cfdi_sat_comprobantes`.
5. **Bandeja de comprobantes** (Fase 4). Listado con filtros/paginación,
   detalle de un comprobante, descarga de su XML y detalle de los paquetes de
   una solicitud.
6. **Importación individual a Compras** (Fases 5-6). Un comprobante `I`
   recibido, con RFC receptor igual al RFC de la empresa, se puede importar
   como `factura_compra` en borrador: se busca el proveedor por RFC, se copian
   los conceptos y se insertan los impuestos reales del CFDI (sin recalcular
   con el motor automático de impuestos de Emphasys).
7. **Importación por lote y proveedor faltante** (Fase 7). Varios comprobantes
   elegibles se procesan de forma independiente (uno no aborta a los demás);
   si no se encuentra el proveedor por RFC, el resultado indica el código
   `PROVEEDOR_NO_ENCONTRADO` para que el usuario cree o vincule el contacto y
   reintente. La factura de compra resultante queda enlazada al CFDI de origen
   vía `documentos.uuid_cfdi_origen`, visible en Compras.
8. **Estabilización operativa** (Fase 8). Bitácora consultable con filtros,
   alertas visuales en la página principal, resumen ejecutivo de conteos y
   endpoints de consulta de uso de almacenamiento.
9. **Automatización asistida** (Fase 9). Cada empresa puede activar
   verificación y/o descarga "automáticas". No es un cron desatendido — ver
   la sección **Automatización** más abajo — sino una ejecución en lote que
   un administrador dispara capturando la contraseña de la FIEL una sola vez,
   y que procesa de un jalón todas las solicitudes elegibles de la empresa.
10. **Conciliación operativa antes de importar** (Fase 10). Cada comprobante
    recibido tipo Ingreso (`I`) se clasifica en un **estado operativo de
    importación** (listo para importar, bloqueado por proveedor faltante, por
    impuestos sin mapear, ya importado, posible duplicado, etc.), calculado al
    vuelo sin escribir nada en base de datos, para que el usuario entienda de
    un vistazo qué le falta a cada CFDI antes de importarlo. Ver la sección
    **Estado operativo de importación** más abajo.
11. **Vinculación manual a una factura existente** (Fase 11). Cuando un CFDI
    descargado coincide (por proveedor + total, y opcionalmente fecha/serie/
    folio) con una factura de compra que alguien ya capturó manualmente en
    Emphasys, se puede **vincular** el CFDI a esa factura en vez de
    importarlo — sin crear ningún documento nuevo. Evita duplicar la compra
    cuando la captura manual llegó primero. Ver la sección **Vinculación a
    factura existente** más abajo.
12. **Cierre y estabilización V1** (Fase 12, actual). Revisión integral de
    todo lo anterior: se confirmaron los permisos de cada acción, se corrigió
    una fuga de ruta física en mensajes de error de storage, se corrigieron
    dos casos donde el resumen/alertas/bitácora no se refrescaban tras una
    acción (verificar/descargar una solicitud, crear una solicitud), se
    ocultaron acciones de importar/vincular para usuarios sin permiso de
    administrador (antes eran visibles pero fallaban con 403 al hacer clic),
    y se eliminó una duplicación de código entre la bandeja y el diálogo de
    detalle. Sin funcionalidad nueva. Ver "Backlog futuro recomendado".

## Variables de entorno

| Variable | Uso | Default |
|---|---|---|
| `CFDI_SAT_STORAGE_DIR` | Carpeta privada donde se guardan los ZIP y XML descargados del SAT. **No** debe estar dentro de `uploads/` ni servirse por `express.static`. | `<cwd>/private-storage/cfdi-sat` |
| `SMTP_PASSWORD_ENCRYPTION_KEY` (o `JWT_SECRET` / `JWT_SECRET_KEY` como fallback) | Clave usada por `utils/secret-crypto.ts` (AES-256-GCM) para cifrar el `.cer`/`.key` de la FIEL en BD. Se reutiliza la misma utilidad que ya cifra contraseñas SMTP. | — (obligatoria en producción) |

No hay variables nuevas exclusivas de Facturama/CSD: este módulo no los toca.

## Migraciones (en orden)

1. `20260703_create_cfdi_sat_fase1.sql` — tabla de credenciales FIEL cifradas y
   autorización de uso por empresa.
2. `20260704_create_cfdi_sat_solicitudes.sql` — tabla `cfdi_sat_solicitudes`.
3. `20260704_create_cfdi_sat_paquetes_comprobantes.sql` — tablas
   `cfdi_sat_paquetes` y `cfdi_sat_comprobantes`.
4. `20260705_cfdi_sat_bitacora_importado_compras.sql` — tabla de bitácora del
   módulo y columna `importado_compras` en comprobantes.
5. `20260706_documentos_uuid_cfdi_origen.sql` — columna
   `documentos.uuid_cfdi_origen` + índice único parcial
   `ux_documentos_empresa_uuid_cfdi_origen (empresa_id, uuid_cfdi_origen) WHERE uuid_cfdi_origen IS NOT NULL`,
   usada para trazabilidad y para bloquear reimportaciones duplicadas.
6. `20260707_create_cfdi_sat_automatizacion.sql` — tabla
   `cfdi_sat_automatizacion` (configuración por empresa) y ampliación del
   `CHECK` de acciones de bitácora con `verificacion_automatica`,
   `descarga_automatica` y `automatizacion_error`.
7. `20260708_cfdi_sat_bitacora_vinculacion.sql` — amplía el `CHECK` de
   acciones de bitácora con `vinculacion_documento` (Fase 11). No requirió
   columnas nuevas: la vinculación reutiliza `documentos.uuid_cfdi_origen` y
   `cfdi_sat_comprobantes.importado_compras`/`documento_id`, ya existentes
   desde las Fases 3 y 6.

La Fase 8 no agregó migraciones: bitácora, resumen y almacenamiento se
resuelven con queries nuevas sobre tablas existentes.

## Seguridad de la FIEL

- El `.cer` y el `.key` se guardan cifrados en BD (AES-256-GCM) con
  `utils/secret-crypto.ts`; nunca se persisten en claro ni en disco.
- La **contraseña** de la FIEL nunca se guarda: se recibe por request (body),
  se usa solo en memoria durante esa operación (crear/verificar/descargar
  solicitud) y no se registra en bitácora ni en logs.
- Solo un administrador de la empresa (o superadmin) puede subir, reemplazar
  o eliminar credenciales, y aceptar la autorización de uso
  (`assertEsAdministrador` en `cfdi-sat.shared.ts`, mismo patrón de
  `resolverContextoScopeComercial` usado en cancelación de documentos).
- Toda operación que usa la FIEL valida primero que esté vigente
  (`vigencia_hasta > ahora`) y que exista una autorización aceptada vigente
  (`obtenerCredencialesFielListas`); si falta cualquiera, se rechaza antes de
  llamar al SAT.

## Qué se guarda y qué no

**Se guarda:**
- Certificado y llave de la FIEL, cifrados, con su vigencia y RFC.
- Registro de la autorización aceptada (usuario, fecha, versión del texto).
- Solicitudes creadas ante el SAT (rango, tipo, `RequestId`, estatus,
  mensajes del SAT).
- Paquetes descargados (ZIP) y XML de cada comprobante en
  `CFDI_SAT_STORAGE_DIR`, fuera de `uploads/`.
- Metadata de cada comprobante (UUID, RFC emisor/receptor, tipo, montos,
  fechas, estatus) en `cfdi_sat_comprobantes`.
- Bitácora de cada acción relevante del módulo (quién, cuándo, qué acción,
  resultado, un detalle textual).
- Al importar a Compras: la factura de compra en borrador y el
  `uuid_cfdi_origen` que la enlaza al comprobante SAT.

**No se guarda / no se expone:**
- La contraseña de la FIEL (nunca, en ningún punto del flujo).
- `xml_path` / `zip_path` crudos en ninguna respuesta JSON: los endpoints de
  listado y detalle solo exponen booleanos (`tiene_xml`, `tiene_zip`); el
  archivo se sirve por un endpoint dedicado que resuelve la ruta del lado del
  servidor.
- CFDIs importados a Compras no se registran en `documentos_cfdi` (esa tabla
  es exclusiva de CFDIs que Emphasys mismo timbra vía Facturama; usarla aquí
  arriesgaría que la cancelación intente timbrar/cancelar un CFDI ajeno).
- La ruta física absoluta de `CFDI_SAT_STORAGE_DIR` nunca aparece en un
  mensaje de error visible para el usuario (`mensaje_error` de solicitudes/
  paquetes, respuestas de API, bitácora): `traducirErrorStorage()` en
  `cfdi-sat-storage.ts` solo la registra en el log del servidor (corregido en
  Fase 12; antes de esa corrección sí se incluía en el mensaje visible).

## Endpoints

Todos bajo `/api/configuracion/cfdi-sat`, protegidos por `requireAuth` +
`requireEmpresaActiva`.

| Método y ruta | Descripción |
|---|---|
| `GET /credenciales` | Estado de la FIEL de la empresa (sin exponer el contenido cifrado). |
| `POST /credenciales` | Sube o reemplaza `.cer`/`.key` (solo administrador). |
| `DELETE /credenciales` | Elimina las credenciales (solo administrador). |
| `GET /autorizacion` | Estado de la autorización de uso vigente. |
| `POST /autorizacion` | Acepta la autorización de uso (solo administrador). |
| `GET /solicitudes` | Lista las solicitudes de la empresa. |
| `POST /solicitudes` | Crea una solicitud real ante el SAT. |
| `POST /solicitudes/:id/verificar` | Verifica el estatus de una solicitud ante el SAT. |
| `POST /solicitudes/:id/descargar` | Descarga los paquetes disponibles de una solicitud. |
| `GET /solicitudes/:id/paquetes` | Detalle de los paquetes de una solicitud. |
| `GET /comprobantes` | Bandeja de comprobantes descargados, con filtros y paginación. Con `incluir_evaluacion=true` agrega el estado operativo de importación de cada fila de la página actual (Fase 10). |
| `GET /comprobantes/:id` | Detalle de un comprobante, siempre incluye su estado operativo de importación (Fase 10). |
| `GET /comprobantes/:id/xml` | Descarga el XML de un comprobante. |
| `GET /comprobantes/:id/importar-compras` | Previsualiza la importación a Compras (sin escribir nada). |
| `POST /comprobantes/:id/importar-compras` | Importa un comprobante como factura de compra en borrador. |
| `POST /comprobantes/importar-compras-lote` | Importa varios comprobantes elegibles, uno por uno, sin transacción global. |
| `GET /comprobantes/:id/candidatos-vinculacion` | Lista facturas de compra ya capturadas que podrían corresponder a este CFDI, cada una con su confianza y motivo (Fase 11). |
| `POST /comprobantes/:id/vincular-documento` | Vincula el comprobante a una factura de compra existente (`documento_id` en el body), sin crear ningún documento nuevo (Fase 11, solo administrador). |
| `GET /bitacora` | Bitácora del módulo con filtros (fecha, acción, usuario, resultado, solicitud/comprobante/UUID). |
| `GET /resumen` | Conteos ejecutivos de solicitudes, comprobantes y paquetes con error. |
| `GET /almacenamiento` | Uso aproximado de almacenamiento (archivos y bytes de ZIP/XML) sin exponer rutas. |
| `GET /automatizacion` | Configuración de automatización asistida de la empresa (o los defaults si nunca se configuró). |
| `PUT /automatizacion` | Actualiza `auto_verificar`/`auto_descargar`/`frecuencia_minutos` (solo administrador). |
| `POST /automatizacion/ejecutar` | Ejecuta la automatización asistida: verifica y/o descarga todas las solicitudes elegibles de la empresa con una sola contraseña de FIEL (solo administrador). |

## Alertas operativas (Fase 8)

`CfdiSatPage.tsx` muestra alertas visuales (sin envío de correos) cuando:
- No hay FIEL cargada, o la FIEL está vencida, o vence en menos de 30 días.
- Falta aceptar la autorización de uso vigente.
- Hay solicitudes en estatus de error ante el SAT.
- Hay paquetes descargados con error.
- Hay comprobantes recibidos elegibles pendientes de importar a Compras.

Se calculan combinando el estado de credenciales/autorización ya cargado en
la página con los conteos de `GET /resumen`.

## Automatización (Fase 9)

### Qué se automatiza

- **Verificación asistida** (`auto_verificar`): al ejecutarla, revisa todas
  las solicitudes de la empresa en estatus `solicitado` o `en_proceso` y las
  vuelve a consultar ante el SAT (`verify`), actualizando su estatus y
  registrando los paquetes nuevos que reporte.
- **Descarga asistida** (`auto_descargar`): al ejecutarla, revisa todas las
  solicitudes en estatus `terminado` que aún tengan paquetes pendientes o con
  error, y descarga (`download`) esos paquetes, extrae los comprobantes y los
  registra — exactamente la misma lógica que el botón manual "Descargar" de
  una solicitud individual (`cfdi-sat-solicitudes.service.ts`, compartida
  entre ambos flujos).
- Ambas se disparan desde el botón **"Ejecutar automatización ahora"** en la
  sección Automatización, o desde `POST /automatizacion/ejecutar`. Un solo
  clic (con una sola captura de contraseña) procesa **todas** las solicitudes
  elegibles de la empresa, no una por una.

### Qué NO se automatiza

- **No hay un cron ni un proceso desatendido.** Nada corre "solo" en segundo
  plano sin que un administrador lo dispare explícitamente. Ver el
  diagnóstico técnico abajo para el porqué.
- **No se automatiza la importación a Compras.** Verificar/descargar nunca
  crea ni modifica documentos de compra; eso sigue siendo una acción
  explícita del usuario en la bandeja de comprobantes.
- La creación de una solicitud nueva (`POST /solicitudes`) tampoco se
  automatiza: sigue siendo una decisión manual de qué rango de fechas pedir.

### Diagnóstico técnico: por qué no se guarda la contraseña de la FIEL

Se investigó el código fuente de `@nodecfdi/sat-ws-descarga-masiva` y de
`@nodecfdi/credentials` (su dependencia para manejar la FIEL) para determinar
si `verify()`/`download()` pueden ejecutarse sin volver a capturar la
contraseña:

- El Servicio de Descarga Masiva del SAT exige que **cada** operación SOAP
  (`Autentica`, `SolicitaDescarga`, `VerificaSolicitudDescarga`, `Descarga`)
  vaya firmada con la e.firma. La librería obtiene un token de autenticación
  (`Service.authenticate()`) y lo reutiliza mientras sea válido
  (`obtainCurrentToken()`), pero ese token expira en pocos minutos (vigencia
  corta del lado del SAT); pasado ese lapso, la librería vuelve a firmar una
  petición de autenticación con la FIEL para obtener uno nuevo.
- Firmar requiere la llave privada **descifrada**. En
  `@nodecfdi/credentials/.../base/private_key.js`, el método `sign()` llama a
  `callOnPrivateKey()`, que ejecuta `forge.pki.decryptRsaPrivateKey(pem,
  passPhrase)` — es decir, la llave se descifra usando la contraseña en cada
  operación de firma, no solo una vez al inicio.
- Por lo tanto, para que un proceso pueda seguir firmando peticiones al SAT
  más adelante (minutos, horas o días después, que es lo que tarda el SAT en
  dejar una solicitud en `terminado`), necesita tener la contraseña (o la
  llave ya descifrada) disponible en ese momento futuro.
- Guardar la contraseña en BD está descartado desde la Fase 1 y se reafirma
  en esta fase. Guardarla temporalmente, aunque sea cifrada, en una tabla, es
  igualmente una forma de persistirla. Mantenerla solo en memoria del proceso
  Node tampoco resuelve el problema de fondo para un cron real: no sobrevive
  a un reinicio/despliegue del servidor, no funciona si hay varias
  instancias del backend, y mantener la contraseña de una credencial de
  firma legal en texto plano en memoria del servidor durante horas o días
  (lo que puede tardar el SAT) es una superficie de riesgo real (volcados de
  memoria, swap), muy distinta de una "sesión corta" de unos minutos.

**Decisión: Opción A.** No es posible automatizar de forma realmente
desatendida sin guardar la contraseña de la FIEL en algún lado, así que **no
se implementó un cron real**. En su lugar se implementó la "cola asistida"
descrita arriba: la configuración (`auto_verificar`/`auto_descargar`/
`frecuencia_minutos`) documenta la intención del administrador y sirve para
mostrarle un recordatorio visual ("han pasado más minutos que tu frecuencia
configurada desde la última ejecución"), pero quien efectivamente dispara el
trabajo — y captura la contraseña una sola vez para procesar todo lo
elegible de un jalón — sigue siendo una persona.

### Configuración

Tabla `core.cfdi_sat_automatizacion` (una fila por empresa, creada la primera
vez que se guarda configuración):

| Campo | Descripción |
|---|---|
| `auto_verificar` | Si está activo, "Ejecutar automatización ahora" incluye la verificación de solicitudes pendientes. |
| `auto_descargar` | Si está activo, "Ejecutar automatización ahora" incluye la descarga de paquetes de solicitudes terminadas. |
| `frecuencia_minutos` | Entre 15 y 1440. Solo se usa para calcular el recordatorio visual; no dispara nada por sí sola. |
| `ultimo_run_en` | Fecha/hora de la última ejecución asistida completada (con o sin errores parciales). |
| `actualizado_por` / `actualizado_en` | Auditoría de quién cambió la configuración por última vez. |

Solo un administrador de la empresa (o superadmin) puede leer y cambiar esta
configuración y disparar la ejecución (`assertEsAdministrador`, igual que el
resto del módulo).

### Robustez de la ejecución asistida

- **No corre dos veces en paralelo por empresa**: usa un advisory lock de
  Postgres (`pg_try_advisory_lock`) tomado y liberado en la misma conexión;
  si ya hay una ejecución en curso para esa empresa, la segunda petición
  recibe un 409 explícito en vez de correr en paralelo.
- **Scope por empresa**: todas las consultas de solicitudes/paquetes
  elegibles filtran por `empresa_id` del contexto activo (`X-Empresa-Id`),
  igual que el resto del módulo; nunca toca solicitudes de otra empresa.
- **No reintenta estatus terminales**: `listarSolicitudesParaVerificar` solo
  trae `solicitado`/`en_proceso`; `rechazado`, `expirado`, `error` y
  `sin_resultados` nunca se vuelven a intentar automáticamente (si el usuario
  quiere reintentarlos, debe hacerlo manualmente, lo que además implica
  revisar por qué fallaron).
- **No agresivo con el SAT**: procesa las solicitudes de una empresa de forma
  secuencial (no en paralelo) con una pequeña pausa entre cada una.
- **Errores por solicitud no abortan el resto**: si verificar o descargar una
  solicitud falla, se registra en bitácora (`automatizacion_error`) y se
  sigue con la siguiente; el resumen final (`mensajes`) lista qué falló.
- **Mensajes claros**: la respuesta de `POST /automatizacion/ejecutar`
  regresa conteos (`solicitudesVerificadas`, `solicitudesDescargadas`,
  `comprobantesNuevos`, `paquetesConError`) y una lista de mensajes de error
  por solicitud, mostrados en el diálogo de la UI.

## Estado operativo de importación (Fase 10)

Antes de importar un CFDI recibido a Compras, la bandeja de comprobantes
clasifica cada uno en un **estado operativo**, calculado en el momento (nunca
se guarda en base de datos) reutilizando exactamente la misma validación que
usa la importación real (`prepararImportacionCompras`,
`cfdi-sat-compras-import.service.ts`) — así la evaluación nunca se desalinea
de lo que realmente pasaría si el usuario le da "Importar".

### Estados posibles

| Estado | Significado | Acción sugerida |
|---|---|---|
| `listo_para_importar` | Pasó todas las validaciones: RFC receptor coincide, hay exactamente un proveedor con ese RFC y es de tipo Proveedor/Varios, y todos los impuestos del XML están mapeados al catálogo interno. | Importar |
| `importado` | El comprobante ya está marcado como importado (`cfdi_sat_comprobantes.importado_compras`). | Ver factura |
| `uuid_ya_existe_en_documentos` | Existe una factura de compra con este UUID en `documentos.uuid_cfdi_origen`, aunque el comprobante no esté marcado como importado (red de seguridad ante un estado inconsistente). | Ver factura |
| `cancelado` | El CFDI está cancelado ante el SAT (`estatus_sat = 'cancelado'`, solo confiable en solicitudes de tipo metadata). | Ninguna |
| `sin_xml` | La solicitud fue de tipo metadata: no hay XML para validar impuestos/RFC receptor ni para importar. | Ninguna (se necesitaría una solicitud tipo XML) |
| `proveedor_no_encontrado` | No existe ningún contacto con el RFC emisor del CFDI. | Crear proveedor (prellena RFC/nombre en `/contactos/nuevo`) |
| `proveedor_duplicado` | Hay más de un contacto con ese RFC (no hay unicidad de RFC en el sistema). | Ir a contactos a resolver el duplicado |
| `proveedor_tipo_invalido` | El contacto con ese RFC existe pero no es de tipo Proveedor/Varios. | Ir a contactos a corregir su tipo |
| `impuestos_no_mapeados` | Algún traslado/retención del XML no tiene equivalente en el catálogo interno de impuestos (o usa `TipoFactor="Cuota"`, no soportado). | Agregar el impuesto al catálogo |
| `rfc_receptor_no_coincide` | El RFC receptor del XML no es el RFC de la empresa activa. | Ninguna (el CFDI no es de esta empresa) |
| `no_aplica` | El comprobante no es recibido tipo Ingreso (`I`), o hubo un error interno inesperado al evaluar. | Ninguna |

### Posible duplicado (independiente del estado)

Además del estado principal, cualquier comprobante puede traer
`posible_documento_existente` si se encontró una factura de compra **ya
capturada manualmente** (sin `uuid_cfdi_origen`) que podría corresponder al
mismo CFDI: mismo proveedor (por RFC) y total casi exacto, con una
`confianza`:

- **alta**: además coincide la serie y folio externos.
- **media**: además la fecha está dentro de ±3 días.
- **baja**: solo coincide proveedor + total.

Nunca bloquea la importación por sí solo (`elegible_importacion` no cambia
por esto) — es una señal para que el usuario decida, no una detección
definitiva. La UI lo muestra como un chip "Posible duplicado" adicional, y la
pestaña "Posibles duplicados" de la bandeja lo usa como filtro transversal.

### Dónde se calcula y su costo

- `backend/src/modules/configuracion/cfdi-sat/cfdi-sat-evaluacion-importacion.service.ts`
  — `evaluarEstadoImportacion()` (un comprobante) y
  `evaluarEstadoImportacionLote()` (varios, en paralelo).
- `backend/src/modules/configuracion/cfdi-sat/cfdi-sat-conciliacion.repository.ts`
  — consultas de solo lectura sobre `documentos`/`contactos` para detectar
  documento existente (exacto por UUID, o débil por proveedor+total+fecha).
- **Solo se evalúa la página actual** devuelta por `GET /comprobantes`
  (`incluir_evaluacion=true`), nunca el total del filtro: evaluar un
  comprobante con XML implica leerlo y parsearlo, así que hacerlo para miles
  de filas de golpe sería costoso. Por eso las pestañas de estado operativo
  de la bandeja (Todos / Listos para importar / Pendientes por proveedor /
  Pendientes por impuestos / Cancelados / Ya importados / Posibles
  duplicados) son un filtro **sobre la página ya cargada**, no una consulta
  nueva al servidor — los conteos que muestran reflejan solo esa página, no
  el total real de comprobantes en cada estado. Esto se documenta como
  limitación conocida más abajo.
- El detalle de un comprobante (`GET /comprobantes/:id`) sí evalúa siempre,
  porque ahí solo hay un comprobante.

### Seguridad

- No escribe nada en base de datos, no crea proveedores, no modifica
  documentos ni marca nada como importado.
- Nunca expone `xml_path`/`zip_path`: la evaluación se calcula del lado del
  servidor y solo regresa el estado, mensaje, y IDs de documento/proveedor.

## Vinculación a factura existente (Fase 11)

Cuando un CFDI descargado del SAT corresponde a una compra que **alguien ya
capturó manualmente** en Emphasys (antes de tener este módulo, o porque
prefirió capturarla a mano), importar el CFDI crearía una factura de compra
duplicada. La vinculación resuelve esto: enlaza el CFDI con la factura ya
existente, sin crear ningún documento nuevo.

### Cuándo aparece la acción "Vincular"

En la bandeja de comprobantes, independientemente de su estado operativo de
importación (Fase 10) — incluso uno bloqueado por `proveedor_no_encontrado` o
`impuestos_no_mapeados` puede vincularse, porque la vinculación no depende de
esas validaciones — cuando:

- `tipo_descarga = recibidos` y `tipo_comprobante = I`;
- `importado_compras = false`;
- no está cancelado ante el SAT;
- tiene un `posible_documento_existente` (la señal de Fase 10, calculada por
  `evaluarEstadoImportacion`).

### Buscar candidatos: `GET /comprobantes/:id/candidatos-vinculacion`

Devuelve **todas** las facturas de compra sin `uuid_cfdi_origen` que
coincidan en proveedor (RFC) y total (±0.01) con el CFDI — hasta 10,
ordenadas por cercanía de total y fecha más reciente —, cada una con su
propia `confianza` (alta/media/baja) y `motivo`, calculados con
`listarCandidatosVinculacion()` en `cfdi-sat-conciliacion.repository.ts`. Si
el CFDI tiene XML, se parsea para obtener serie/folio y afinar la confianza;
si no, se usa la metadata ya guardada (RFC emisor, total, fecha). Esta misma
función es la base de `buscarPosibleDocumentoExistente()` (Fase 10): ahí solo
se necesitaba el mejor candidato, aquí se necesita la lista completa.

### Vincular: `POST /comprobantes/:id/vincular-documento`

Body: `{ "documento_id": number }`. Solo administrador. Corre en una
transacción con lock de fila sobre el comprobante y el documento (evita que
dos vinculaciones concurrentes choquen), y valida en orden:

1. El comprobante pertenece a la empresa activa, es recibido tipo `I`, no
   está ya importado/vinculado, y no está cancelado.
2. El documento pertenece a la misma empresa y es de tipo `factura_compra`.
3. El documento no está cancelado.
4. El documento no tiene ya un `uuid_cfdi_origen` distinto (si ya tiene
   exactamente este mismo UUID, también se rechaza: no hay nada que hacer).
   Si dos vinculaciones concurrentes lograran pasar esta validación en
   memoria, el índice único parcial `ux_documentos_empresa_uuid_cfdi_origen`
   (Fase 6) es la red de seguridad final a nivel de base de datos — su
   violación se traduce a un mensaje claro, nunca a un error 500 crudo.
5. Si se puede determinar el RFC del proveedor del documento, debe coincidir
   con el RFC emisor del CFDI.
6. El total del CFDI debe coincidir con el total del documento (tolerancia
   ±0.01, por redondeo).
7. Si el XML trae serie/folio Y el documento tiene serie_externa/numero_externo
   capturados, deben coincidir; si cualquiera de los dos lados no tiene esos
   datos, esta validación se omite (no bloquea por falta de dato).

Si todo pasa: `documentos.uuid_cfdi_origen = uuid`,
`cfdi_sat_comprobantes.importado_compras = true` y
`cfdi_sat_comprobantes.documento_id = documento_id` se actualizan en la misma
transacción, y se registra bitácora con acción `vinculacion_documento`. Nunca
crea un documento, nunca toca partidas ni impuestos del documento existente.

### UI

- Bandeja de comprobantes: botón "Vincular" (junto a la acción principal del
  estado operativo) cuando aplica. Abre `VincularDocumentoDialog`, que
  muestra los datos del CFDI (UUID, emisor, fecha, total) arriba y la tabla
  de candidatos abajo (folio interno, proveedor, fecha, total, serie/folio
  externo, estatus, confianza, motivo). Seleccionar un candidato pasa a una
  pantalla de confirmación explícita antes de llamar al endpoint.
- Tras vincular exitosamente, se refresca la bandeja completa (`cargar()`),
  lo que recalcula evaluación/estado operativo de todos los comprobantes de
  la página; el comprobante vinculado pasa a mostrarse como `importado` con
  botón "Ver factura".
- En la factura de compra (`DocumentosFormPage.tsx`), el chip que antes decía
  "Importada desde CFDI SAT" ahora dice **"Vinculada con CFDI SAT"** — cubre
  con precisión tanto una importación real como una vinculación manual, sin
  necesidad de una columna nueva para distinguir el origen. Sigue mostrando
  el UUID en el tooltip y navega de regreso a la bandeja filtrada por ese
  UUID (`/configuracion/cfdi-sat?uuid=...`).

### Seguridad

- No crea documentos nuevos, no toca partidas/impuestos de la factura
  existente, no toca pagos/bancos/contabilidad.
- No usa `documentos_cfdi`.
- No expone `xml_path`/`zip_path` en ninguna respuesta; la validación de
  serie/folio lee el XML del lado del servidor únicamente para comparar
  valores, nunca lo regresa al cliente.

## Política de retención propuesta (no implementada)

Esta fase **no borra** archivos ni registros; se documenta una propuesta para
decidirla más adelante:

- **ZIPs originales del SAT**: son el respaldo legal más pesado. Proponer
  conservarlos un mínimo de 5 años (plazo de conservación fiscal en México) y
  solo entonces evaluar purga, o mover a almacenamiento frío en vez de
  borrarlos.
- **XML extraídos**: mientras el CFDI no se haya importado a Compras,
  conservarlos indefinidamente; una vez importado, siguen siendo el respaldo
  del que se leyeron montos/impuestos, por lo que aplica el mismo criterio de
  5 años.
- **Metadata en BD** (`cfdi_sat_solicitudes`, `cfdi_sat_paquetes`,
  `cfdi_sat_comprobantes`): no ocupa espacio relevante; se propone no purgarla
  nunca, ya que sostiene la trazabilidad de qué se importó y de dónde vino.
- **Bitácora**: igual que la metadata, es auditoría de bajo volumen; se
  propone retenerla sin límite de tiempo o, si el volumen crece demasiado,
  archivarla (mover a una tabla histórica) después de 2-3 años en vez de
  borrarla.
- Los endpoints `GET /resumen` y `GET /almacenamiento` ya existen para poder
  monitorear cuánto espacio ocupa cada empresa antes de decidir cualquier
  política de borrado real.

## Cómo probar manualmente

1. Configurar `CFDI_SAT_STORAGE_DIR` apuntando a una carpeta de prueba fuera
   del repo y `SMTP_PASSWORD_ENCRYPTION_KEY` (o dejar el fallback a
   `JWT_SECRET`).
2. Entrar a **Configuración → Descarga de CFDIs del SAT** como administrador
   de una empresa con RFC y FIEL de pruebas (o de un contribuyente real en el
   ambiente de pruebas del SAT).
3. Subir `.cer`/`.key`, verificar que aparezca como VIGENTE con el RFC
   correcto.
4. Aceptar la autorización de uso.
5. Crear una solicitud (recibidos, XML, un rango de fechas corto) capturando
   la contraseña de la FIEL; confirmar que aparece con `RequestId` del SAT.
6. Verificar la solicitud hasta que su estatus sea `terminado`, luego
   descargar los paquetes; confirmar que la bandeja de comprobantes se llena.
7. Abrir el detalle de un comprobante `I` recibido y usar "Importar a
   Compras"; confirmar que se crea la factura de compra en borrador con las
   partidas e impuestos correctos y que el intento de reimportar el mismo
   UUID es rechazado.
8. Revisar la sección **Bitácora** filtrando por acción/resultado/UUID y
   confirmar que ninguna fila expone contraseñas ni rutas de archivo.
9. Revisar el **Resumen del módulo** y confirmar que los conteos coinciden
   con lo hecho en los pasos anteriores, y que las alertas desaparecen cuando
   ya no aplican (por ejemplo, tras importar los comprobantes pendientes).
10. En la sección **Automatización**, activar "Verificación asistida" y/o
    "Descarga asistida", guardar, y confirmar que aparece el mensaje
    explicando por qué no hay un cron real.
11. Crear una o más solicitudes nuevas (dejarlas sin verificar/descargar
    manualmente) y presionar "Ejecutar automatización ahora" capturando la
    contraseña de la FIEL; confirmar que el resultado reporta cuántas
    solicitudes se verificaron/descargaron y que "Última ejecución" se
    actualiza.
12. Intentar disparar dos ejecuciones casi al mismo tiempo (dos pestañas) y
    confirmar que la segunda recibe un mensaje de "ya hay una ejecución en
    curso" en vez de correr en paralelo.
13. Revisar la **Bitácora** filtrando por acción `verificacion_automatica`,
    `descarga_automatica` y `automatizacion_error`, y confirmar que se
    distinguen claramente de las acciones manuales (`verificacion`,
    `descarga_paquete`) y que ninguna expone la contraseña.
14. **Estado operativo — CFDI listo para importar**: descargar un comprobante
    `I` recibido cuyo RFC emisor tenga exactamente un contacto tipo Proveedor
    con todos sus impuestos mapeados; confirmar que en la bandeja aparece el
    chip "Listo para importar" (pestaña "Listos para importar") y que el
    botón "Importar" está habilitado.
15. **CFDI sin proveedor**: descargar un comprobante `I` cuyo RFC emisor no
    tenga ningún contacto; confirmar el chip "Proveedor no encontrado"
    (pestaña "Pendientes por proveedor") y que el botón "Crear proveedor"
    navega a `/contactos/nuevo` con el RFC y nombre prellenados.
16. **CFDI ya importado**: importar un comprobante y confirmar que pasa a la
    pestaña "Ya importados" con el chip "Importado" y el botón "Ver factura".
17. **CFDI cancelado**: con una solicitud de tipo metadata que incluya un CFDI
    cancelado, confirmar el chip "Cancelado" (pestaña "Cancelados") y que no
    hay acción de importación disponible.
18. **CFDI con impuesto no mapeado**: usar un CFDI cuyo XML incluya una tasa
    de IVA/IEPS que no exista en el catálogo interno (`public.impuestos`);
    confirmar el chip "Impuesto no mapeado" (pestaña "Pendientes por
    impuestos") con el mensaje indicando qué impuesto falta.
19. **Posible duplicado**: capturar manualmente una factura de compra con el
    mismo proveedor, total y fecha (sin usar la importación de CFDI SAT), y
    luego descargar/evaluar el CFDI correspondiente; confirmar que aparece el
    chip adicional "Posible duplicado" (pestaña "Posibles duplicados") con la
    confianza y motivo correctos, y que el comprobante sigue siendo
    importable (el duplicado débil no bloquea).
20. Confirmar en el diálogo de detalle (botón "Ver" de cualquier fila) que se
    muestra la misma información de estado operativo, proveedor detectado,
    documento relacionado y posible duplicado que en la tabla.
21. **Vincular — CFDI con posible duplicado**: repetir el escenario del paso
    19 (factura capturada manualmente con mismo proveedor/total) y confirmar
    que en la bandeja aparece el botón "Vincular" junto a la acción principal.
22. **Listar candidatos**: hacer clic en "Vincular" y confirmar que el diálogo
    muestra los datos del CFDI arriba (UUID, emisor, fecha, total) y, abajo,
    la factura capturada manualmente como candidato con su confianza y
    motivo.
23. **Vincular a factura existente**: seleccionar el candidato, confirmar en
    la pantalla de confirmación, y verificar la respuesta exitosa con el
    botón "Ver factura".
24. **Confirmar que aparece como importado/vinculado**: tras vincular,
    recargar la bandeja y confirmar que el comprobante ahora aparece en la
    pestaña "Ya importados" con el chip "Importado" y botón "Ver factura"; y
    que en la factura de compra (`/compras/factura_compra/:id`) aparece el
    chip "Vinculada con CFDI SAT" con el UUID correcto, navegando de regreso
    a la bandeja filtrada por ese UUID.
25. **Bloqueo de UUID duplicado**: intentar vincular el mismo comprobante (o
    cualquier otro con el mismo UUID, si existiera) a un segundo documento;
    confirmar que el backend rechaza con un mensaje claro ("ya fue
    importado/vinculado" o "ya está vinculado a otro CFDI", código
    `DOCUMENTO_YA_VINCULADO` cuando aplica) y que ningún documento queda en
    un estado intermedio o inconsistente.

## Troubleshooting básico

Problemas frecuentes y dónde revisarlos primero:

| Síntoma | Causa probable | Dónde revisar |
|---|---|---|
| "No hay una e.firma (FIEL) cargada" pero ya se subió | El certificado se subió para otra empresa (revisa `X-Empresa-Id`/empresa activa en el selector de empresa). | `GET /credenciales` con la empresa activa correcta. |
| "El RFC del certificado no coincide con el RFC de la empresa" al subir | El `.cer` es de otro RFC, o el RFC de la empresa en Emphasys está mal capturado. | Campo RFC de la empresa en Configuración de empresa. |
| Crear/verificar/descargar solicitud falla con error de conexión | El SAT puede estar temporalmente caído, o el ambiente no tiene salida a internet hacia los endpoints `*.clouda.sat.gob.mx`. | Reintentar en unos minutos; revisar conectividad saliente del servidor. |
| "No hay permisos de escritura en la carpeta configurada..." al descargar paquetes | `CFDI_SAT_STORAGE_DIR` no existe, o el usuario del proceso backend no tiene permisos de escritura ahí. | Log del servidor (busca `[CFDI SAT] Error de storage`, ahí sí aparece la ruta física completa) — nunca en la respuesta al usuario, ver "Seguridad de la FIEL". |
| Comprobante queda en `sin_xml` y no se puede importar | La solicitud que lo trajo fue de tipo `metadata`, no `xml`. | Crear una nueva solicitud de tipo XML para ese rango/RFC. |
| `proveedor_no_encontrado` aunque el proveedor "existe" | El RFC capturado en el contacto no coincide exactamente (mayúsculas/espacios) con el del CFDI, o está en un campo distinto al esperado (`contactos_datos_fiscales.rfc` tiene prioridad sobre `contactos.rfc`). | Revisar el RFC exacto del contacto en Contactos. |
| `impuestos_no_mapeados` para una tasa que "sí existe" | La tasa del catálogo interno no coincide en valor exacto (ej. 0.16 vs 16), o el concepto usa `TipoFactor="Cuota"` (no soportado). | Catálogo de impuestos (`public.impuestos`); ver limitación de `TipoFactor="Cuota"` abajo. |
| La automatización asistida dice "ya hay una ejecución en curso" | Advisory lock de Postgres todavía tomado por una ejecución anterior colgada o muy reciente. | Esperar unos minutos; si persiste, revisar que no haya un proceso backend colgado. |
| Un candidato de vinculación esperado no aparece | El RFC del proveedor en la factura manual no coincide exactamente con el RFC emisor del CFDI, o esa factura ya tiene `uuid_cfdi_origen`. | Verificar el RFC capturado en el contacto de esa factura. |

## Limitaciones conocidas

- No se soporta `TipoFactor="Cuota"` en el mapeo de impuestos al importar a
  Compras (Fase 6): si un concepto usa ese factor, la importación de ese
  comprobante se bloquea en vez de generar un impuesto inconsistente.
- No hay automatización por cron desatendido: la "automatización" de Fase 9
  es una ejecución en lote que un administrador dispara a demanda capturando
  la contraseña de la FIEL una vez; ver la sección Automatización para el
  diagnóstico completo de por qué. Crear una solicitud nueva siempre es
  manual.
- No hay importación automática a Compras: cada comprobante (o lote) se
  importa explícitamente desde la bandeja, incluso con la automatización
  activada.
- No se usa `documentos_cfdi` para los CFDIs recibidos del SAT — ver
  "Qué se guarda y qué no".
- No se envían correos ni notificaciones externas; las alertas son solo
  visuales dentro de la página.
- No se tocan pagos, bancos, contabilidad, CSD/Facturama ni `uploads/` desde
  este módulo.
- No hay borrado de archivos ni de bitácora todavía; ver la política de
  retención propuesta arriba.
- El estado operativo de importación (Fase 10) y sus conteos por pestaña se
  calculan **solo sobre la página actual** de la bandeja, no sobre el total
  de comprobantes que cumplen los filtros — ver "Estado operativo de
  importación" arriba. Para ver el estado de un comprobante en otra página
  hay que navegar a esa página (o filtrar más específico, ej. por UUID).
- La detección de "posible duplicado" es heurística (proveedor + total ±
  centavos + fecha/serie/folio si están disponibles) y nunca definitiva; no
  reemplaza una revisión humana antes de importar.
- No se soporta `TipoFactor="Cuota"` al evaluar impuestos (igual que al
  importar): un CFDI con ese factor queda clasificado como
  `impuestos_no_mapeados` aunque el impuesto exista en el catálogo con otra
  representación.
- La vinculación (Fase 11) no importa por lote ni se automatiza: cada CFDI se
  vincula uno por uno, con confirmación explícita del usuario.
- `GET /comprobantes/:id/candidatos-vinculacion` busca solo por proveedor
  (RFC) + total; no considera coincidencias entre proveedores distintos ni
  candidatos ya vinculados a otro CFDI (esos ya no son candidatos válidos).
  Si el proveedor real de la factura manual está mal capturado (RFC
  incorrecto), esa factura no aparecerá como candidato.

## Backlog futuro recomendado

Deliberadamente fuera de esta V1 (ver reglas de alcance de cada fase); quedan
como trabajo futuro si el negocio lo pide:

- **Desvincular**: hoy no hay forma de deshacer una vinculación (Fase 11)
  desde la UI si el usuario se equivoca de candidato; requeriría decidir qué
  pasa con `documentos.uuid_cfdi_origen` y `cfdi_sat_comprobantes.importado_compras`
  al revertir.
- **Vinculación por lote**: hoy es uno por uno con confirmación explícita.
- **Cron real / importación automática**: solo es posible si se acepta el
  riesgo de mantener la contraseña de la FIEL disponible sin un humano
  presente — ver el diagnóstico completo en "Automatización (Fase 9)". No
  automatizar la importación a Compras en ningún escenario sin una decisión
  de negocio explícita (afecta el registro contable/fiscal).
- **Soporte a `TipoFactor="Cuota"`**: impuestos por cuota fija (no
  porcentual) no se mapean hoy; bloquean tanto la importación como la
  evaluación operativa.
- **Tolerancia a RFC mal capturado** en la detección de candidatos/posibles
  duplicados: hoy requiere coincidencia exacta de RFC.
- **Borrado/archivado real de ZIP/XML/bitácora** según la política de
  retención propuesta en Fase 8 (hoy solo hay endpoints de consulta de uso de
  storage, nada se borra).
- **Conteos de estado operativo a nivel de todo el filtro** (no solo la
  página cargada), si el volumen de comprobantes crece lo suficiente para
  que valga la pena el costo de evaluarlos todos (posiblemente con un job
  asíncrono o una vista materializada).
- **Extracción de componentes grandes**: `ComprobantesSatSection.tsx` (~710
  líneas) y `CfdiSatPage.tsx` (~900 líneas) concentran bastante lógica;
  partirlos en piezas más pequeñas (ej. separar la lógica de filtros/tabs de
  la tabla) es una limpieza razonable a futuro, pero no se hizo en Fase 12
  para no arriesgar regresiones en un cierre de V1 sin agregar valor
  funcional.
- **Notificaciones por correo** para alertas operativas (hoy son solo
  visuales dentro de la página).
