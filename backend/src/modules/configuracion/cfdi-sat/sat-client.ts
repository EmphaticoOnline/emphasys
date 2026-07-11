export class SatClientError extends Error {
  /** Error original que provocó este SatClientError, para diagnóstico en logs (nunca se manda al cliente). */
  cause?: unknown;
  /** Código machine-readable opcional (ej. 'SAT_TIMEOUT') para que el frontend pueda dar un mensaje específico. */
  code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message);
    this.name = 'SatClientError';
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
    if (options?.code) {
      this.code = options.code;
    }
  }
}

/**
 * Corre `factory()` con un límite de tiempo total propio, independiente de
 * cualquier timeout interno de la librería del SAT. Existe porque una sola
 * llamada de alto nivel (query/verify/download) puede disparar más de una
 * petición HTTP interna (autenticación + la operación en sí), así que el
 * timeout de un solo HttpsWebClient no acota el tiempo total de la operación.
 * Sin este límite, el backend puede quedar esperando más tiempo del que el
 * proxy (nginx) está dispuesto a esperar, y el usuario recibe un 504 HTML en
 * vez de una respuesta JSON controlada.
 *
 * Importante: esto NO cancela la petición HTTP real en curso (la librería no
 * expone un AbortController); solo deja de esperarla. La petición de fondo
 * puede seguir corriendo y completarse después de que ya respondimos el
 * timeout al usuario — no hay riesgo de datos corruptos porque estas
 * operaciones son de solo lectura (verify) o ya son tolerantes a reintentos
 * (query/download), pero el resultado de esa llamada tardía se descarta.
 */
function withTimeout<T>(factory: () => Promise<T>, ms: number, code: string, mensaje: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SatClientError(mensaje, { code }));
    }, ms);

    factory().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const SAT_TIMEOUT_MENSAJE = 'No fue posible conectar con el servicio del SAT. Intenta nuevamente más tarde.';

/**
 * Mensaje específico para el timeout de verify() (VerificaSolicitudDescargaService.svc).
 * Diagnóstico técnico exhaustivo (DNS/TLS/FIEL/autenticación/creación de solicitud,
 * más una prueba manual/raw con 3 variantes de transporte) descartó causas de Emphasys,
 * de la librería o de la conexión: el servicio del SAT simplemente no responde. Distinto
 * del mensaje genérico porque aquí la autenticación SÍ se completó (ver docs/cfdi-sat-descarga.md,
 * sección "Diagnóstico: VerificaSolicitudDescargaService.svc no responde").
 */
const SAT_VERIFY_TIMEOUT_MENSAJE =
  'No fue posible verificar la solicitud ante el SAT. La autenticación fue exitosa, pero el servicio de verificación del SAT no respondió dentro del tiempo esperado. Intenta nuevamente más tarde.';

/**
 * Extrae un mensaje de texto seguro de CUALQUIER error que pueda salir de
 * @nodecfdi/sat-ws-descarga-masiva o de la red, sin asumir su forma.
 *
 * Nunca llama un método (`getMessage`, `getResponse`, `getBody`, ...) sin
 * comprobar antes que existe y es una función. Esto es necesario porque la
 * propia librería tiene un caso conocido: en
 * `HttpsWebClient.call()` (node_modules/@nodecfdi/sat-ws-descarga-masiva),
 * si el socket entra en timeout y no se configuró un `timeout` explícito en
 * el cliente, el handler `clientRequest.on('timeout', ...)` rechaza con un
 * `Error` plano (sin `getResponse()`). El propio código interno de la
 * librería (`ServiceConsumer.runRequest`) asume que todo error tiene
 * `getResponse()` y lo invoca sin comprobar — lo que revienta con
 * "webError.getResponse is not a function" y oculta el timeout real. Ese
 * TypeError se reconoce aquí (junto con otras señales de red conocidas) y se
 * traduce a un mensaje claro en vez de mostrarse tal cual al usuario.
 */
export function normalizarErrorSat(error: unknown): string {
  if (error == null) return 'Error desconocido al comunicarse con el SAT';
  if (typeof error === 'string') return error.trim() || 'Error desconocido al comunicarse con el SAT';
  if (typeof error !== 'object') return String(error);

  const err = error as Record<string, unknown>;
  let extraido: string | null = null;

  if (typeof err.getMessage === 'function') {
    try {
      const resultado = (err.getMessage as () => unknown)();
      if (typeof resultado === 'string' && resultado.trim()) extraido = resultado.trim();
    } catch {
      /* getMessage() de un objeto incompleto puede fallar; seguimos con otras vías */
    }
  }

  if (!extraido && typeof err.getResponse === 'function') {
    try {
      const response = (err.getResponse as () => unknown)();
      if (response && typeof response === 'object') {
        const resp = response as Record<string, unknown>;
        if (typeof resp.getBody === 'function') {
          const body = (resp.getBody as () => unknown)();
          if (typeof body === 'string' && body.trim()) extraido = body.trim();
        }
      }
    } catch {
      /* getResponse() puede fallar si la respuesta interna nunca se llegó a construir */
    }
  }

  if (!extraido && typeof err.message === 'string' && err.message.trim()) {
    extraido = err.message.trim();
  }

  if (!extraido && err.response && typeof err.response === 'object') {
    const resp = err.response as Record<string, unknown>;
    if (typeof resp.data === 'string' && resp.data.trim()) extraido = resp.data.trim();
    else if (typeof resp.statusText === 'string' && resp.statusText.trim()) extraido = resp.statusText.trim();
  }

  if (!extraido) {
    if (typeof err.code === 'string' || typeof err.code === 'number') {
      extraido = `Error de comunicación con el SAT (código ${String(err.code)})`;
    } else if (typeof err.status === 'number' || typeof err.statusCode === 'number') {
      extraido = `El SAT respondió con un error HTTP ${String(err.status ?? err.statusCode)}`;
    }
  }

  if (!extraido) {
    try {
      const serializado = JSON.stringify(err);
      extraido = serializado && serializado !== '{}' ? serializado : null;
    } catch {
      extraido = null;
    }
  }

  const mensaje = extraido ?? 'Error desconocido al comunicarse con el SAT';

  if (ERROR_RED_REGEX.test(mensaje) || (typeof err.code === 'string' && ERROR_RED_CODES.has(err.code))) {
    return 'No fue posible conectar con el servicio del SAT. Intenta nuevamente más tarde.';
  }

  return mensaje;
}

const ERROR_RED_REGEX =
  /getresponse is not a function|time.?out|econnreset|econnrefused|enotfound|eai_again|socket hang up|network error/i;
const ERROR_RED_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN']);

export interface DetalleErrorSat {
  nombre: string | null;
  mensajeCrudo: string | null;
  mensajeNormalizado: string;
  stack: string | null;
  codigo: string | number | null;
  statusCode: number | null;
  respuestaSat: string | null;
}

/**
 * Detalle técnico completo de un error para loguear en el servidor (nunca
 * para mandar al cliente). Si `error` es un SatClientError creado con
 * `{ cause }` (ver los catch de este archivo), extrae el detalle del error
 * original (`cause`), no del mensaje ya normalizado — así el log conserva la
 * causa real (ej. el TypeError de la librería) aunque el usuario final solo
 * vea el mensaje limpio.
 */
export function extraerDetalleErrorSat(error: unknown): DetalleErrorSat {
  const causa = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const origen = causa ?? error;
  const mensajeNormalizado = error instanceof SatClientError ? error.message : normalizarErrorSat(error);

  if (origen && typeof origen === 'object') {
    const err = origen as Record<string, unknown>;
    const nombre = typeof err.name === 'string' ? err.name : null;
    const mensajeCrudo = typeof err.message === 'string' ? err.message : null;
    const stack = typeof err.stack === 'string' ? err.stack : null;
    const codigo = typeof err.code === 'string' || typeof err.code === 'number' ? (err.code as string | number) : null;
    const statusCode =
      typeof err.statusCode === 'number' ? err.statusCode : typeof err.status === 'number' ? (err.status as number) : null;

    let respuestaSat: string | null = null;
    if (typeof err.getResponse === 'function') {
      try {
        const response = (err.getResponse as () => unknown)();
        if (response && typeof response === 'object') {
          const resp = response as Record<string, unknown>;
          if (typeof resp.getBody === 'function') {
            const body = (resp.getBody as () => unknown)();
            if (typeof body === 'string') respuestaSat = body.slice(0, 1000);
          }
        }
      } catch {
        /* no se pudo extraer la respuesta del SAT del error original; se omite */
      }
    }

    return { nombre, mensajeCrudo, mensajeNormalizado, stack, codigo, statusCode, respuestaSat };
  }

  return {
    nombre: null,
    mensajeCrudo: typeof origen === 'string' ? origen : null,
    mensajeNormalizado,
    stack: null,
    codigo: null,
    statusCode: null,
    respuestaSat: null,
  };
}

export type SatTipoDescarga = 'emitidos' | 'recibidos';
export type SatTipoSolicitud = 'xml' | 'metadata';
export type SatEstatusComprobante = 'activos' | 'cancelados' | 'todos';

/**
 * Timeout de CADA petición HTTP individual al SAT (autenticación, y luego la
 * operación en sí — una llamada de alto nivel puede disparar ambas).
 */
const SAT_HTTP_TIMEOUT_MS = 20_000;

/**
 * Techo de tiempo total para una operación completa (query/verify/download),
 * sin importar cuántas peticiones HTTP internas haga. Debe quedar cómodamente
 * por debajo del timeout del proxy que esté delante del backend (nginx u
 * otro) para que el usuario siempre reciba un JSON controlado y nunca la
 * página de error del proxy. nginx sin configurar usa 60s por defecto para
 * proxy_read_timeout; 45s deja ~15s de margen para el resto del
 * procesamiento y la respuesta. Ver docs/cfdi-sat-descarga.md.
 */
const SAT_OPERATION_TIMEOUT_MS = 45_000;

export interface CrearSolicitudSatParams {
  cerBuffer: Buffer;
  keyBuffer: Buffer;
  fielPassword: string;
  tipoDescarga: SatTipoDescarga;
  /** Formato 'YYYY-MM-DD' */
  fechaInicio: string;
  /** Formato 'YYYY-MM-DD' */
  fechaFin: string;
  tipoSolicitud: SatTipoSolicitud;
  estatusComprobante?: SatEstatusComprobante | null;
}

export interface CrearSolicitudSatResultado {
  requestId: string;
}

export type SatWsModule = typeof import('@nodecfdi/sat-ws-descarga-masiva');
export type SatService = InstanceType<SatWsModule['Service']>;

/**
 * @nodecfdi/sat-ws-descarga-masiva es ESM puro ("type": "module"). Con
 * module:"commonjs" (el usado por este backend), TypeScript reescribe
 * `await import(...)` estático como `Promise.resolve().then(() => require(...))`,
 * y ese `require` real falla en Node con ERR_REQUIRE_ESM al cargar un paquete ESM.
 * El constructor Function evita que TS transforme la expresión y preserva un
 * import() dinámico nativo en tiempo de ejecución.
 */
const importSatWsModule = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<SatWsModule>;

let cachedModule: Promise<SatWsModule> | null = null;

export function loadSatWsModule(): Promise<SatWsModule> {
  if (!cachedModule) {
    cachedModule = importSatWsModule('@nodecfdi/sat-ws-descarga-masiva');
  }
  return cachedModule;
}

/**
 * Arma el Fiel y el Service del SAT a partir de los certificados descifrados y la
 * contraseña capturada por el usuario. La contraseña solo vive en memoria dentro
 * de esta función y de quien la invoque; nunca se persiste ni se loggea.
 *
 * Exportada para que los controllers puedan validar la FIEL (contraseña
 * correcta, vigencia) de forma síncrona y local — sin red — antes de
 * responder al cliente, y solo diferir a segundo plano la llamada de red real
 * al SAT (ver verificarSolicitudController). `Fiel.create()`/`isValid()` no
 * hacen ninguna petición HTTP: son cómputo local (node-forge), así que esta
 * validación es rápida.
 */
export async function construirServicioSat(
  cerBuffer: Buffer,
  keyBuffer: Buffer,
  fielPassword: string
): Promise<{ sat: SatWsModule; service: SatService }> {
  const sat = await loadSatWsModule();

  let fiel;
  try {
    fiel = sat.Fiel.create(cerBuffer.toString('binary'), keyBuffer.toString('binary'), fielPassword);
  } catch {
    throw new SatClientError('No se pudo leer la FIEL: verifica el certificado, la llave y la contraseña');
  }

  if (!fiel.isValid()) {
    throw new SatClientError('La FIEL no es válida: verifica que no sea un CSD y que esté vigente');
  }

  // Timeout explícito: si se deja undefined, la propia librería rechaza un
  // timeout de socket con un Error plano sin getResponse() y su código
  // interno revienta al intentar leer esa respuesta (ver normalizarErrorSat
  // más abajo para el detalle completo de este caso conocido).
  const webClient = new sat.HttpsWebClient(undefined, undefined, SAT_HTTP_TIMEOUT_MS);
  const requestBuilder = new sat.FielRequestBuilder(fiel);
  const service = new sat.Service(requestBuilder, webClient);

  return { sat, service };
}

/**
 * Presenta una solicitud (`query`) real al Servicio de Descarga Masiva del SAT.
 * La contraseña de la FIEL solo se usa en memoria dentro de esta función; nunca
 * se persiste ni se incluye en errores.
 */
export async function crearSolicitudSat(params: CrearSolicitudSatParams): Promise<CrearSolicitudSatResultado> {
  const { sat, service } = await construirServicioSat(params.cerBuffer, params.keyBuffer, params.fielPassword);

  let query = sat.QueryParameters.create(
    sat.DateTimePeriod.createFromValues(`${params.fechaInicio} 00:00:00`, `${params.fechaFin} 23:59:59`),
    new sat.DownloadType(params.tipoDescarga === 'emitidos' ? 'issued' : 'received'),
    new sat.RequestType(params.tipoSolicitud)
  );

  if (params.estatusComprobante === 'activos') {
    query = query.withDocumentStatus(new sat.DocumentStatus('active'));
  } else if (params.estatusComprobante === 'cancelados') {
    query = query.withDocumentStatus(new sat.DocumentStatus('cancelled'));
  }

  const validationErrors = query.validate();
  if (validationErrors.length > 0) {
    throw new SatClientError(`Parámetros de consulta inválidos: ${validationErrors.join('; ')}`);
  }

  let result;
  try {
    result = await withTimeout(() => service.query(query), SAT_OPERATION_TIMEOUT_MS, 'SAT_TIMEOUT', SAT_TIMEOUT_MENSAJE);
  } catch (error: unknown) {
    if (error instanceof SatClientError) throw error;
    throw new SatClientError(normalizarErrorSat(error), { cause: error });
  }

  if (!result.getStatus().isAccepted()) {
    throw new SatClientError(result.getStatus().getMessage() || 'El SAT rechazó la solicitud');
  }

  return { requestId: result.getRequestId() };
}

export type SatEstatusVerificacion =
  | 'en_proceso'
  | 'terminado'
  | 'sin_resultados'
  | 'expirado'
  | 'rechazado'
  | 'error';

export interface VerificarSolicitudSatParams {
  cerBuffer: Buffer;
  keyBuffer: Buffer;
  fielPassword: string;
  satRequestId: string;
}

export interface VerificarSolicitudSatResultado {
  estatus: SatEstatusVerificacion;
  numeroCfdis: number;
  packageIds: string[];
  mensaje: string | null;
}

/**
 * Consulta el estatus de una solicitud ya aceptada por el SAT (`verify`). No
 * descarga paquetes: solo informa cuáles quedaron listos para descargar.
 */
export async function verificarSolicitudSat(
  params: VerificarSolicitudSatParams
): Promise<VerificarSolicitudSatResultado> {
  const { service } = await construirServicioSat(params.cerBuffer, params.keyBuffer, params.fielPassword);

  let verify;
  try {
    verify = await withTimeout(
      () => service.verify(params.satRequestId),
      SAT_OPERATION_TIMEOUT_MS,
      'SAT_TIMEOUT',
      SAT_VERIFY_TIMEOUT_MENSAJE
    );
  } catch (error: unknown) {
    if (error instanceof SatClientError) throw error;
    throw new SatClientError(normalizarErrorSat(error), { cause: error });
  }

  if (!verify.getStatus().isAccepted()) {
    throw new SatClientError(verify.getStatus().getMessage() || 'El SAT rechazó la verificación');
  }

  const statusRequest = verify.getStatusRequest();
  const packageIds = verify.getPackageIds();
  const numeroCfdis = verify.getNumberCfdis();
  const codeMessage = verify.getCodeRequest()?.getMessage?.() ?? null;

  let estatus: SatEstatusVerificacion;
  if (statusRequest.isTypeOf('Expired')) {
    estatus = 'expirado';
  } else if (statusRequest.isTypeOf('Rejected')) {
    estatus = 'rechazado';
  } else if (statusRequest.isTypeOf('Failure')) {
    estatus = 'error';
  } else if (statusRequest.isTypeOf('Accepted') || statusRequest.isTypeOf('InProgress')) {
    estatus = 'en_proceso';
  } else if (statusRequest.isTypeOf('Finished')) {
    estatus = packageIds.length > 0 ? 'terminado' : 'sin_resultados';
  } else {
    estatus = 'error';
  }

  return { estatus, numeroCfdis, packageIds, mensaje: codeMessage };
}

export interface DescargarPaqueteSatParams {
  cerBuffer: Buffer;
  keyBuffer: Buffer;
  fielPassword: string;
  packageId: string;
}

export interface DescargarPaqueteSatResultado {
  zipBuffer: Buffer;
}

/**
 * Descarga un paquete (ZIP) ya identificado por una verificación previa.
 */
export async function descargarPaqueteSat(
  params: DescargarPaqueteSatParams
): Promise<DescargarPaqueteSatResultado> {
  const { service } = await construirServicioSat(params.cerBuffer, params.keyBuffer, params.fielPassword);

  let download;
  try {
    download = await withTimeout(
      () => service.download(params.packageId),
      SAT_OPERATION_TIMEOUT_MS,
      'SAT_TIMEOUT',
      SAT_TIMEOUT_MENSAJE
    );
  } catch (error: unknown) {
    if (error instanceof SatClientError) throw error;
    throw new SatClientError(normalizarErrorSat(error), { cause: error });
  }

  if (!download.getStatus().isAccepted()) {
    throw new SatClientError(download.getStatus().getMessage() || 'El SAT rechazó la descarga del paquete');
  }

  return { zipBuffer: Buffer.from(download.getPackageContent(), 'base64') };
}
