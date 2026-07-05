export class SatClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SatClientError';
  }
}

export type SatTipoDescarga = 'emitidos' | 'recibidos';
export type SatTipoSolicitud = 'xml' | 'metadata';
export type SatEstatusComprobante = 'activos' | 'cancelados' | 'todos';

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
 */
async function construirServicioSat(
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

  const webClient = new sat.HttpsWebClient();
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
    result = await service.query(query);
  } catch (error: any) {
    throw new SatClientError(
      error?.message ? `Error al conectar con el SAT: ${error.message}` : 'Error al conectar con el SAT'
    );
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
    verify = await service.verify(params.satRequestId);
  } catch (error: any) {
    throw new SatClientError(
      error?.message ? `Error al conectar con el SAT: ${error.message}` : 'Error al conectar con el SAT'
    );
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
    download = await service.download(params.packageId);
  } catch (error: any) {
    throw new SatClientError(
      error?.message ? `Error al conectar con el SAT: ${error.message}` : 'Error al conectar con el SAT'
    );
  }

  if (!download.getStatus().isAccepted()) {
    throw new SatClientError(download.getStatus().getMessage() || 'El SAT rechazó la descarga del paquete');
  }

  return { zipBuffer: Buffer.from(download.getPackageContent(), 'base64') };
}
