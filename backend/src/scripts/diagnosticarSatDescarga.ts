/**
 * Diagnóstico de conectividad al Servicio de Descarga Masiva del SAT, fuera
 * del flujo normal de la app. NO modifica solicitudes existentes ni escribe
 * nada en base de datos (solo hace SELECT para leer credenciales guardadas).
 * Pensado para correr manualmente en el servidor (o en local) cuando
 * "Verificar"/"Crear solicitud"/"Descargar" truenan con timeout, para aislar
 * si el problema es de red/DNS/TLS del servidor o algo más adelante en el
 * flujo (autenticación, la propia librería, la e.firma).
 *
 * Uso — modalidad principal, por empresa (usa el mismo mecanismo real que el
 * módulo CFDI SAT para leer la FIEL guardada: core.cfdi_sat_credenciales,
 * descifrada con utils/secret-crypto.ts — NUNCA archivos .cer/.key sueltos):
 *   SAT_DIAG_EMPRESA_ID=8 SAT_DIAG_PASSWORD='...' npm run diagnosticar-sat
 *   # opcional, para probar también verify() contra una solicitud real:
 *   SAT_DIAG_EMPRESA_ID=8 SAT_DIAG_PASSWORD='...' SAT_DIAG_REQUEST_ID=<id-del-sat> npm run diagnosticar-sat
 *   # opcional, con más tiempo que la app normal (útil para distinguir "el SAT
 *   # tarda más de 20/45s" de "el SAT realmente no responde"):
 *   SAT_DIAG_EMPRESA_ID=8 SAT_DIAG_PASSWORD='...' SAT_DIAG_REQUEST_ID=<id-del-sat> \
 *     SAT_DIAG_HTTP_TIMEOUT_MS=60000 SAT_DIAG_OPERATION_TIMEOUT_MS=90000 npm run diagnosticar-sat
 *
 * SAT_DIAG_HTTP_TIMEOUT_MS: timeout del socket HTTP por cada request individual al
 * SAT (equivalente a SAT_HTTP_TIMEOUT_MS de sat-client.ts, ahí fijo en 20s; aquí
 * configurable). SAT_DIAG_OPERATION_TIMEOUT_MS: techo total del diagnóstico para
 * autenticar+verificar (equivalente a SAT_OPERATION_TIMEOUT_MS, ahí fijo en 45s).
 * Ambos son SOLO de este script — no cambian los timeouts reales de la app.
 *
 * Uso — prueba controlada: crear una solicitud NUEVA mínima y verificarla de
 * inmediato, para aislar si el problema es de un request_id específico o de
 * verify() en general. ADVERTENCIA: esto SÍ crea una solicitud real ante el
 * SAT (no se puede evitar, es lo que se está probando); NUNCA importa a
 * Compras, NUNCA descarga paquetes, y NUNCA escribe nada en la base de datos
 * de Emphasys (la solicitud de prueba no queda registrada aquí):
 *   SAT_DIAG_EMPRESA_ID=4 SAT_DIAG_PASSWORD='...' SAT_DIAG_CREAR_SOLICITUD=1 \
 *     SAT_DIAG_TIPO=recibidos SAT_DIAG_TIPO_SOLICITUD=metadata \
 *     SAT_DIAG_FECHA_INICIO=2026-07-01 SAT_DIAG_FECHA_FIN=2026-07-02 \
 *     SAT_DIAG_HTTP_TIMEOUT_MS=60000 SAT_DIAG_OPERATION_TIMEOUT_MS=90000 \
 *     npm run diagnosticar-sat
 * SAT_DIAG_TIPO: recibidos|emitidos. SAT_DIAG_TIPO_SOLICITUD: metadata|cfdi (alias
 * de "xml", que es como lo llama la librería). Si además defines
 * SAT_DIAG_REQUEST_ID, el script prueba AMBAS cosas en la misma corrida: verificar
 * la solicitud vieja Y crear+verificar una nueva, para comparar.
 *
 * Uso — modalidad legacy por archivos (solo si no tienes la credencial
 * cargada en Emphasys y quieres probar un .cer/.key sueltos; NO es la ruta
 * principal para diagnosticar esta app):
 *   SAT_DIAG_CER_PATH=/ruta/al/certificado.cer SAT_DIAG_KEY_PATH=/ruta/a/la/llave.key SAT_DIAG_PASSWORD='...' npm run diagnosticar-sat
 *
 * Uso — prueba manual/raw de verify() (SAT_DIAG_VERIFY_RAW=1): reconstruye a mano
 * (sin pasar por HttpsWebClient de la librería) el mismo POST firmado que haría
 * verify(), probando 3 variantes de transporte (SOAPAction sin/con comillas,
 * Content-Length explícito + Connection: close vs. chunked como la librería), para
 * aislar si el timeout depende de cómo arma el request la librería o si el SAT
 * cuelga igual con un request "correcto" hecho a mano. Requiere SAT_DIAG_REQUEST_ID
 * (usa el mismo Request ID, mismo token de authenticate(), mismo RFC y mismo
 * envelope firmado real con la FIEL de la empresa; la firma/certificado solo se
 * redactan al imprimir en consola, nunca al enviar):
 *   SAT_DIAG_EMPRESA_ID=4 SAT_DIAG_PASSWORD='...' SAT_DIAG_REQUEST_ID='<uuid>' \
 *     SAT_DIAG_VERIFY_RAW=1 SAT_DIAG_HTTP_TIMEOUT_MS=60000 SAT_DIAG_OPERATION_TIMEOUT_MS=90000 \
 *     npm run diagnosticar-sat
 *
 * Si no se define SAT_DIAG_EMPRESA_ID ni SAT_DIAG_CER_PATH/SAT_DIAG_KEY_PATH,
 * el script solo corre las pruebas de red genéricas (DNS/HTTPS/TLS/endpoints).
 *
 * Seguridad: este script nunca imprime contraseña, contenido de .cer/.key,
 * buffers, ni el token de autenticación obtenido (solo su fecha de
 * expiración, que no es secreta). Solo imprime dominio, URL, RFC, fechas de
 * vigencia, status HTTP, tiempos, y códigos/mensajes de error técnicos.
 */
import dotenv from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '..', '.env') });

import dns from 'node:dns/promises';
import https from 'node:https';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import {
  loadSatWsModule,
  construirServicioSat,
  extraerDetalleErrorSat,
  type SatWsModule,
  type SatService,
  type SatTipoDescarga,
  type SatTipoSolicitud,
} from '../modules/configuracion/cfdi-sat/sat-client';
import { obtenerCredencialesPorEmpresa } from '../modules/configuracion/cfdi-sat/cfdi-sat-credenciales.repository';
import { obtenerAutorizacionVigente } from '../modules/configuracion/cfdi-sat/cfdi-sat-autorizacion.repository';
import { CFDI_SAT_AUTORIZACION_VERSION } from '../modules/configuracion/cfdi-sat/cfdi-sat-autorizacion-texto';
import { decryptSecret } from '../utils/secret-crypto';

interface EndpointTarget {
  nombre: string;
  url: string;
}

// Igual que ServiceEndpoints.cfdi() en @nodecfdi/sat-ws-descarga-masiva (ver Paso E,
// que además lee esto directo de la librería para confirmar que coincide).
const ENDPOINTS: EndpointTarget[] = [
  { nombre: 'Autenticación', url: 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc' },
  { nombre: 'Solicitud (crear)', url: 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc' },
  { nombre: 'Verificación', url: 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc' },
  { nombre: 'Descarga', url: 'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc' },
];

const HTTPS_TIMEOUT_MS = 20_000;

// Valores por defecto para la modalidad por empresa (etapas 5-6): coinciden con
// SAT_HTTP_TIMEOUT_MS / SAT_OPERATION_TIMEOUT_MS de sat-client.ts, pero aquí son
// configurables vía env para poder probar "¿solo necesita más tiempo?" sin tocar
// los timeouts reales de la app.
const DEFAULT_HTTP_TIMEOUT_MS = 20_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 45_000;

function parseTimeoutEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ms(inicio: number): number {
  return Math.round(performance.now() - inicio);
}

type ResultadoOperacionDiag<T> =
  | { ok: true; valor: T; ms: number }
  | { ok: false; motivo: 'operation_timeout'; ms: number }
  | { ok: false; motivo: 'error'; error: unknown; ms: number };

/**
 * Igual que withTimeout() en sat-client.ts, pero para diagnóstico: en vez de
 * lanzar un solo tipo de error, regresa un resultado con motivo explícito
 * (timeout total de la operación vs. cualquier otro error) para poder
 * reportarlo con detalle en vez de esconderlo bajo un mensaje genérico.
 */
function conTimeoutDiag<T>(factory: () => Promise<T>, timeoutMs: number): Promise<ResultadoOperacionDiag<T>> {
  const inicio = performance.now();
  return new Promise((resolve) => {
    let resuelto = false;
    const timer = setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      resolve({ ok: false, motivo: 'operation_timeout', ms: ms(inicio) });
    }, timeoutMs);

    factory().then(
      (valor) => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(timer);
        resolve({ ok: true, valor, ms: ms(inicio) });
      },
      (error) => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(timer);
        resolve({ ok: false, motivo: 'error', error, ms: ms(inicio) });
      }
    );
  });
}

interface ResultadoDns {
  ok: boolean;
  ms: number;
  direcciones?: string[];
  error?: string;
}

async function diagnosticarDns(host: string): Promise<ResultadoDns> {
  const inicio = performance.now();
  try {
    const resultado = await dns.lookup(host, { all: true });
    return {
      ok: true,
      ms: ms(inicio),
      direcciones: resultado.map((r) => `${r.address} (${r.family === 6 ? 'IPv6' : 'IPv4'})`),
    };
  } catch (error: any) {
    return { ok: false, ms: ms(inicio), error: error?.code ?? error?.message ?? String(error) };
  }
}

interface ResultadoHttps {
  ok: boolean;
  ms: number;
  statusCode?: number;
  tlsProtocol?: string | null;
  tlsCipher?: string | null;
  error?: string;
}

/**
 * POST vacío al endpoint SOAP. No importa qué status regrese (típicamente 411
 * o 400 por un POST sin envelope SOAP válido): lo que importa es que HAYA
 * respuesta HTTP, confirmando DNS + TCP + TLS + que el servidor está vivo.
 */
function diagnosticarHttps(url: string): Promise<ResultadoHttps> {
  return new Promise((resolve) => {
    const inicio = performance.now();
    let target: URL;
    try {
      target = new URL(url);
    } catch (error: any) {
      resolve({ ok: false, ms: ms(inicio), error: `URL inválida: ${error?.message ?? error}` });
      return;
    }

    const req = https.request(
      {
        hostname: target.hostname,
        path: target.pathname,
        method: 'POST',
        timeout: HTTPS_TIMEOUT_MS,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': '0' },
      },
      (res) => {
        const socket = res.socket as unknown as { getProtocol?: () => string; getCipher?: () => { name: string } };
        resolve({
          ok: true,
          ms: ms(inicio),
          statusCode: res.statusCode,
          tlsProtocol: socket.getProtocol?.() ?? null,
          tlsCipher: socket.getCipher?.()?.name ?? null,
        });
        res.resume();
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, ms: ms(inicio), error: 'TIMEOUT (sin respuesta del servidor)' });
    });
    req.on('error', (error: any) => {
      resolve({ ok: false, ms: ms(inicio), error: error?.code ?? error?.message ?? String(error) });
    });
    req.end();
  });
}

function linea(char = '-', longitud = 70): string {
  return char.repeat(longitud);
}

/**
 * El SOAP que arma la librería para query/verify/download incluye un bloque
 * <Signature> (XML-DSig) con el certificado (BinarySecurityToken/KeyInfo) y el
 * SignatureValue calculados a partir de la FIEL. Ninguno de los dos es la
 * contraseña ni la llave privada cruda, pero igual se redactan por precaución
 * — aquí solo interesa confirmar la ESTRUCTURA del envelope (endpoint,
 * elementos, IdSolicitud/RFC), no su contenido criptográfico.
 */
function redactarSoapEnvelope(xml: string): string {
  return xml.replace(/<Signature[\s\S]*?<\/Signature>/gi, '<Signature>[FIRMA Y CERTIFICADO REDACTADOS]</Signature>');
}

type EtapaDiagnostico =
  | 'omitido'
  | 'lectura_credenciales'
  | 'vigencia_local'
  | 'descifrado'
  | 'construccion_fiel'
  | 'validacion_fiel'
  | 'autenticacion_sat'
  | 'verificacion_solicitud'
  | 'crear_solicitud_prueba'
  | 'ok';

type SatEndpoints = ReturnType<SatWsModule['ServiceEndpoints']['cfdi']>;
type SatRequestBuilder = InstanceType<SatWsModule['FielRequestBuilder']>;

/**
 * Verifica una solicitud (por su request_id) directamente contra `service`
 * (ya autenticado, con el timeout HTTP configurable de este diagnóstico) en
 * vez de reutilizar verificarSolicitudSat(), porque esa función usa los
 * timeouts FIJOS de la app (sat-client.ts) y aquí necesitamos poder
 * ampliarlos para distinguir "el SAT tarda más de lo normal" de "el SAT no
 * responde en absoluto". Compartida entre la verificación de una solicitud
 * existente (SAT_DIAG_REQUEST_ID) y la prueba de crear+verificar.
 */
async function ejecutarVerifyDiagnostico(
  service: SatService,
  requestBuilder: SatRequestBuilder,
  requestId: string,
  httpTimeoutMs: number,
  operationTimeoutMs: number,
  endpoints: SatEndpoints
): Promise<EtapaDiagnostico> {
  try {
    const rawXml = requestBuilder.verify(requestId);
    console.log(`     SOAPAction: http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga`);
    console.log(`     Envelope (estructura, firma/certificado redactados): ${redactarSoapEnvelope(rawXml).slice(0, 500)}...`);
  } catch {
    /* solo informativo; si falla no bloquea el diagnóstico */
  }

  const verifyResultado = await conTimeoutDiag(() => service.verify(requestId), operationTimeoutMs);

  if (verifyResultado.ok) {
    const verify = verifyResultado.valor;
    const aceptado = verify.getStatus().isAccepted();
    console.log(`${aceptado ? 'OK  ' : 'FAIL'} [Verificación de solicitud ${requestId}]  (${verifyResultado.ms} ms)`);
    console.log(`     Endpoint: ${endpoints.getVerify()}`);
    console.log(`     Aceptado por el SAT: ${aceptado}`);
    console.log(`     Mensaje SAT: "${verify.getStatus().getMessage() || '(sin mensaje)'}"`);
    if (aceptado) {
      const statusRequest = verify.getStatusRequest();
      const TIPOS_STATUS = ['Accepted', 'InProgress', 'Finished', 'Failure', 'Rejected', 'Expired'] as const;
      const estatusSat = TIPOS_STATUS.find((tipo) => statusRequest.isTypeOf(tipo)) ?? 'desconocido';
      console.log(`     Estatus de la solicitud ante el SAT: ${estatusSat}`);
      console.log(`     cfdis_encontrados=${verify.getNumberCfdis()}  paquetes=${verify.getPackageIds().length}`);
      return 'ok';
    }
    return 'verificacion_solicitud';
  }

  if (verifyResultado.motivo === 'operation_timeout') {
    console.log(`FAIL [Verificación de solicitud ${requestId}] TIMEOUT TOTAL DE OPERACIÓN (SAT_DIAG_OPERATION_TIMEOUT_MS=${operationTimeoutMs} ms)  (${verifyResultado.ms} ms)`);
    console.log(`     Endpoint: ${endpoints.getVerify()}`);
    console.log('     El SAT no respondió ni siquiera con este margen ampliado — no parece ser solo cuestión de subir el timeout.');
    return 'verificacion_solicitud';
  }

  const detalle = extraerDetalleErrorSat(verifyResultado.error);
  const pareceHttpTimeout =
    (detalle.mensajeCrudo != null && /time.?out/i.test(detalle.mensajeCrudo)) ||
    (verifyResultado.ms >= httpTimeoutMs - 500 && verifyResultado.ms <= httpTimeoutMs + 3000);

  console.log(`FAIL [Verificación de solicitud ${requestId}] ${detalle.mensajeNormalizado}  (${verifyResultado.ms} ms)`);
  console.log(`     Endpoint: ${endpoints.getVerify()}`);
  console.log(
    `     Motivo probable: ${
      pareceHttpTimeout
        ? `TIMEOUT HTTP del socket por request (SAT_DIAG_HTTP_TIMEOUT_MS=${httpTimeoutMs} ms) — el SAT no contestó ese request individual`
        : 'error SOAP/red distinto de timeout (ver mensaje crudo abajo)'
    }`
  );
  console.log(`     Mensaje crudo: ${detalle.mensajeCrudo ?? '(no disponible)'}`);
  console.log(`     Nombre del error: ${detalle.nombre ?? '(desconocido)'}${detalle.codigo != null ? `  código=${detalle.codigo}` : ''}${detalle.statusCode != null ? `  http_status=${detalle.statusCode}` : ''}`);
  if (detalle.respuestaSat) {
    console.log(`     Respuesta cruda del SAT (truncada): ${detalle.respuestaSat.slice(0, 300)}`);
  }
  return 'verificacion_solicitud';
}

interface VarianteVerifyRaw {
  nombre: string;
  soapActionConComillas: boolean;
  contentLengthExplicito: boolean;
  connectionClose: boolean;
}

/**
 * Variantes mínimas de transporte para SAT_DIAG_VERIFY_RAW=1: prueban si el
 * timeout de verify() depende de detalles HTTP que la librería no controla
 * (comillas en SOAPAction, Content-Length explícito vs chunked) o si el SAT
 * cuelga igual sin importar esos detalles — en cuyo caso el problema es del
 * lado del SAT y no de cómo la librería arma el request.
 */
const VARIANTES_VERIFY_RAW: VarianteVerifyRaw[] = [
  { nombre: 'A — equivalente a la librería (SOAPAction sin comillas, sin Content-Length, chunked)', soapActionConComillas: false, contentLengthExplicito: false, connectionClose: false },
  { nombre: 'B — SOAPAction con comillas', soapActionConComillas: true, contentLengthExplicito: false, connectionClose: false },
  { nombre: 'C — Content-Length explícito + Connection: close (sin chunked)', soapActionConComillas: true, contentLengthExplicito: true, connectionClose: true },
];

interface ResultadoVerifyRaw {
  ok: boolean;
  ms: number;
  statusCode?: number;
  error?: string;
  fragmentoRespuesta?: string;
}

/**
 * POST manual (sin pasar por HttpsWebClient de la librería) usando el mismo
 * envelope firmado real que produce requestBuilder.verify(). Permite variar
 * SOAPAction/Content-Length/Connection de forma controlada para aislar si el
 * timeout depende de esos detalles de transporte.
 */
function ejecutarVerifyRawVariante(
  variante: VarianteVerifyRaw,
  endpointUrl: string,
  soapActionBase: string,
  bodyXml: string,
  tokenValue: string,
  httpTimeoutMs: number
): Promise<ResultadoVerifyRaw> {
  return new Promise((resolve) => {
    const inicio = performance.now();
    let target: URL;
    try {
      target = new URL(endpointUrl);
    } catch (error: any) {
      resolve({ ok: false, ms: ms(inicio), error: `URL inválida: ${error?.message ?? error}` });
      return;
    }

    const soapActionValue = variante.soapActionConComillas ? `"${soapActionBase}"` : soapActionBase;
    const bodyBuffer = Buffer.from(bodyXml, 'utf8');

    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: soapActionValue,
      Authorization: `WRAP access_token="${tokenValue}"`,
    };
    if (variante.contentLengthExplicito) {
      headers['Content-Length'] = String(bodyBuffer.length);
    }
    if (variante.connectionClose) {
      headers.Connection = 'close';
    }

    console.log(`\n     --- Variante ${variante.nombre} ---`);
    console.log(`     Endpoint: ${target.toString()}`);
    console.log(`     SOAPAction usado: ${soapActionValue}`);
    console.log(`     Content-Type: ${headers['Content-Type']}`);
    console.log(
      `     Content-Length: ${variante.contentLengthExplicito ? headers['Content-Length'] : '(no enviado — Transfer-Encoding: chunked, igual que la librería)'}`
    );
    console.log('     Authorization: presente (WRAP access_token=<redactado>)');
    console.log(`     Connection: ${variante.connectionClose ? 'close' : '(default, sin forzar)'}`);

    const req = https.request(
      {
        hostname: target.hostname,
        path: target.pathname,
        method: 'POST',
        timeout: httpTimeoutMs,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const bodyRespuesta = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: true,
            ms: ms(inicio),
            statusCode: res.statusCode,
            fragmentoRespuesta: redactarSoapEnvelope(bodyRespuesta).slice(0, 300),
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, ms: ms(inicio), error: `TIMEOUT (sin respuesta en ${httpTimeoutMs} ms)` });
    });
    req.on('error', (error: any) => {
      resolve({ ok: false, ms: ms(inicio), error: error?.code ?? error?.message ?? String(error) });
    });

    if (variante.contentLengthExplicito) {
      req.end(bodyBuffer);
    } else {
      req.write(bodyBuffer);
      req.end();
    }
  });
}

/**
 * Prueba controlada (SAT_DIAG_VERIFY_RAW=1): reconstruye el mismo POST que
 * haría la librería para verify(), pero a mano y con variantes de transporte,
 * para aislar si el timeout depende de cómo arma el request la librería
 * (SOAPAction sin comillas, sin Content-Length -> chunked) o si el SAT cuelga
 * igual con un request manual "correcto". Usa el envelope REAL firmado con la
 * FIEL de la empresa (mismo que produce requestBuilder.verify()); solo se
 * redacta la firma/certificado al imprimir en consola, nunca al enviar.
 */
async function probarVerifyRaw(
  service: SatService,
  requestBuilder: SatRequestBuilder,
  requestId: string,
  endpoints: SatEndpoints,
  httpTimeoutMs: number
): Promise<void> {
  console.log('\n[H] Prueba manual/raw de verify() — variantes de transporte (SAT_DIAG_VERIFY_RAW=1)\n' + linea());

  let token;
  try {
    token = await service.obtainCurrentToken();
  } catch (error: any) {
    console.log(`FAIL [Prueba raw] No se pudo obtener token para la prueba manual: ${error?.message ?? error}`);
    return;
  }
  if (!token.isValid()) {
    console.log('FAIL [Prueba raw] El token obtenido no es válido; se omite la prueba manual.');
    return;
  }

  let rawXml: string;
  try {
    rawXml = requestBuilder.verify(requestId);
  } catch (error: any) {
    console.log(`FAIL [Prueba raw] No se pudo construir el envelope firmado: ${error?.message ?? error}`);
    return;
  }

  const soapActionBase = 'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga';
  const endpointUrl = endpoints.getVerify();

  console.log(`     Request ID: ${requestId}`);
  console.log(`     Endpoint: ${endpointUrl}`);
  console.log(`     Envelope firmado real a enviar (log redactado, firma/certificado ocultos solo para impresión, NO para el envío): ${redactarSoapEnvelope(rawXml).slice(0, 300)}...`);
  console.log(`     Tamaño real del body a enviar: ${Buffer.byteLength(rawXml, 'utf8')} bytes`);

  for (const variante of VARIANTES_VERIFY_RAW) {
    const resultado = await ejecutarVerifyRawVariante(variante, endpointUrl, soapActionBase, rawXml, token.getValue(), httpTimeoutMs);
    if (resultado.ok) {
      console.log(`     RESULTADO: OK   status=${resultado.statusCode}  tiempo=${resultado.ms} ms`);
      console.log(`     Fragmento de respuesta (redactado, primeros 300 caracteres): ${resultado.fragmentoRespuesta || '(vacío)'}`);
    } else {
      console.log(`     RESULTADO: FAIL ${resultado.error}  tiempo=${resultado.ms} ms`);
    }
  }
}

export interface OpcionesSolicitudPrueba {
  tipoDescarga: SatTipoDescarga;
  tipoSolicitud: SatTipoSolicitud;
  fechaInicio: string;
  fechaFin: string;
}

/**
 * Prueba controlada (SAT_DIAG_CREAR_SOLICITUD=1): crea una solicitud NUEVA y
 * mínima ante el SAT y la verifica de inmediato, para aislar si el problema
 * es de un request_id específico o de verify() en general. Crea una
 * solicitud REAL del lado del SAT (inevitable, es justo lo que se prueba),
 * pero nunca escribe nada en la BD de Emphasys ni descarga paquetes.
 */
async function probarCrearYVerificar(
  sat: SatWsModule,
  service: SatService,
  requestBuilder: SatRequestBuilder,
  opciones: OpcionesSolicitudPrueba,
  httpTimeoutMs: number,
  operationTimeoutMs: number,
  endpoints: SatEndpoints
): Promise<EtapaDiagnostico> {
  console.log('\n[G] Prueba controlada: crear solicitud nueva + verificar de inmediato\n' + linea());
  console.log(
    `     Tipo: ${opciones.tipoDescarga}  |  Tipo de solicitud: ${opciones.tipoSolicitud}  |  Rango: ${opciones.fechaInicio} a ${opciones.fechaFin}`
  );
  console.log('     ADVERTENCIA: esto crea una solicitud real ante el SAT. No se guarda en la BD de Emphasys, no importa ni descarga nada.');

  let query = sat.QueryParameters.create(
    sat.DateTimePeriod.createFromValues(`${opciones.fechaInicio} 00:00:00`, `${opciones.fechaFin} 23:59:59`),
    new sat.DownloadType(opciones.tipoDescarga === 'emitidos' ? 'issued' : 'received'),
    new sat.RequestType(opciones.tipoSolicitud)
  );

  const validationErrors = query.validate();
  if (validationErrors.length > 0) {
    console.log(`FAIL [Crear solicitud de prueba] Parámetros inválidos: ${validationErrors.join('; ')}`);
    return 'crear_solicitud_prueba';
  }

  try {
    const rawXml = requestBuilder.query(query);
    console.log(`     SOAPAction: http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescarga`);
    console.log(`     Envelope (estructura, firma/certificado redactados): ${redactarSoapEnvelope(rawXml).slice(0, 500)}...`);
  } catch {
    /* solo informativo */
  }

  const queryResultado = await conTimeoutDiag(() => service.query(query), operationTimeoutMs);

  if (!queryResultado.ok) {
    if (queryResultado.motivo === 'operation_timeout') {
      console.log(`FAIL [Crear solicitud de prueba] TIMEOUT TOTAL DE OPERACIÓN (${operationTimeoutMs} ms)  (${queryResultado.ms} ms)`);
    } else {
      const detalle = extraerDetalleErrorSat(queryResultado.error);
      console.log(`FAIL [Crear solicitud de prueba] ${detalle.mensajeNormalizado}  (${queryResultado.ms} ms)`);
      console.log(`     Mensaje crudo: ${detalle.mensajeCrudo ?? '(no disponible)'}`);
    }
    console.log(`     Endpoint: ${endpoints.getQuery()}`);
    return 'crear_solicitud_prueba';
  }

  const result = queryResultado.valor;
  if (!result.getStatus().isAccepted()) {
    console.log(`FAIL [Crear solicitud de prueba] El SAT rechazó la solicitud: "${result.getStatus().getMessage() || '(sin mensaje)'}"  (${queryResultado.ms} ms)`);
    return 'crear_solicitud_prueba';
  }

  const nuevoRequestId = result.getRequestId();
  console.log(`OK   [Crear solicitud de prueba] Request ID nuevo: ${nuevoRequestId}  (${queryResultado.ms} ms)`);
  console.log('     (Esta solicitud queda creada del lado del SAT — es real, no simulada.)');

  console.log('\n     Verificando de inmediato la solicitud recién creada...');
  return ejecutarVerifyDiagnostico(service, requestBuilder, nuevoRequestId, httpTimeoutMs, operationTimeoutMs, endpoints);
}

/**
 * Modalidad principal: usa exactamente el mismo mecanismo que
 * cfdi-sat.shared.ts#obtenerCredencialesFielListas() para leer la FIEL
 * guardada de la empresa (core.cfdi_sat_credenciales, descifrada con
 * utils/secret-crypto.ts) — nunca archivos .cer/.key sueltos. La contraseña
 * solo vive en memoria dentro de esta función.
 *
 * httpTimeoutMs/operationTimeoutMs son configurables desde afuera (variables
 * de entorno SAT_DIAG_HTTP_TIMEOUT_MS / SAT_DIAG_OPERATION_TIMEOUT_MS) para
 * poder probar verify() con más margen que la app normal, sin tocar los
 * timeouts reales de sat-client.ts.
 */
async function diagnosticarPorEmpresa(
  empresaId: number,
  password: string,
  requestIdOpcional: string | undefined,
  opcionesCrear: OpcionesSolicitudPrueba | null,
  httpTimeoutMs: number,
  operationTimeoutMs: number,
  verifyRawHabilitado: boolean
): Promise<EtapaDiagnostico> {
  console.log(`Modalidad: credenciales guardadas de la empresa #${empresaId} (mismo mecanismo que el módulo real).`);

  // Etapa 1: lectura de credenciales guardadas — mismo repository que usa el flujo real.
  const t1 = performance.now();
  const credencial = await obtenerCredencialesPorEmpresa(empresaId);
  if (!credencial) {
    console.log(`FAIL [Lectura de credenciales guardadas] No hay credenciales SAT cargadas para la empresa #${empresaId}.  (${ms(t1)} ms)`);
    return 'lectura_credenciales';
  }
  const vigente = new Date(credencial.vigencia_hasta).getTime() > Date.now();
  console.log(`OK   [Lectura de credenciales guardadas] existe=sí  (${ms(t1)} ms)`);
  console.log(`     RFC certificado: ${credencial.rfc_certificado}`);
  console.log(`     Vigencia: ${credencial.vigencia_desde} a ${credencial.vigencia_hasta}  (${vigente ? 'VIGENTE' : 'VENCIDA'})`);
  console.log(`     Cargado en: ${credencial.cargado_en}`);

  try {
    const autorizacion = await obtenerAutorizacionVigente(empresaId, CFDI_SAT_AUTORIZACION_VERSION);
    console.log(
      `     Autorización de uso: ${autorizacion ? 'aceptada' : 'NO aceptada (no bloquea este diagnóstico de conectividad, pero sí bloquea el flujo real)'}`
    );
  } catch {
    console.log('     Autorización de uso: no se pudo consultar (no bloquea este diagnóstico).');
  }

  if (!vigente) {
    console.log('FAIL [Vigencia local] La FIEL guardada está vencida; no se intentará autenticar.');
    return 'vigencia_local';
  }

  // Etapa 2: descifrado — mismo utils/secret-crypto.ts que usa obtenerCredencialesFielListas().
  const t2 = performance.now();
  let cerBuffer: Buffer;
  let keyBuffer: Buffer;
  try {
    cerBuffer = Buffer.from(decryptSecret(credencial.cer_content_encrypted), 'base64');
    keyBuffer = Buffer.from(decryptSecret(credencial.key_content_encrypted), 'base64');
    console.log(`OK   [Descifrado de certificado/llave] cer=${cerBuffer.length} bytes, key=${keyBuffer.length} bytes  (${ms(t2)} ms)`);
  } catch (error: any) {
    console.log(`FAIL [Descifrado de certificado/llave] ${error?.message ?? error}  (${ms(t2)} ms)`);
    console.log('     Posible causa: la clave de cifrado (SMTP_PASSWORD_ENCRYPTION_KEY / JWT_SECRET) cambió desde que se guardó la credencial.');
    return 'descifrado';
  }

  // Etapas 3 y 4: construcción y validación de la FIEL — exactamente los mismos pasos que
  // construirServicioSat() en sat-client.ts (Fiel.create + isValid), separados aquí solo
  // para poder reportar en cuál de los dos falla.
  const sat = await loadSatWsModule();
  const t3 = performance.now();
  let fiel;
  try {
    fiel = sat.Fiel.create(cerBuffer.toString('binary'), keyBuffer.toString('binary'), password);
    console.log(`OK   [Construcción de FIEL] Fiel.create() correcto  (${ms(t3)} ms)`);
  } catch (error: any) {
    console.log(`FAIL [Construcción de FIEL] certificado/llave/contraseña inválidos: ${error?.message ?? error}  (${ms(t3)} ms)`);
    return 'construccion_fiel';
  }

  const t4 = performance.now();
  if (!fiel.isValid()) {
    console.log(`FAIL [Validación de FIEL] isValid() = false (¿es un CSD? ¿está vencida?)  (${ms(t4)} ms)`);
    return 'validacion_fiel';
  }
  console.log(`OK   [Validación de FIEL] isValid() = true  (${ms(t4)} ms)`);

  // Etapa 5: autenticación real ante el SAT + obtención de token. Misma construcción de
  // HttpsWebClient/FielRequestBuilder/Service que construirServicioSat(), pero con el
  // timeout HTTP configurable de este diagnóstico (httpTimeoutMs) en vez del fijo de la app.
  console.log(`     Timeout HTTP por request (diagnóstico): ${httpTimeoutMs} ms | Timeout total por operación (diagnóstico): ${operationTimeoutMs} ms`);
  const webClient = new sat.HttpsWebClient(undefined, undefined, httpTimeoutMs);
  const requestBuilder = new sat.FielRequestBuilder(fiel);
  const service = new sat.Service(requestBuilder, webClient);
  const endpoints = sat.ServiceEndpoints.cfdi();

  const authResultado = await conTimeoutDiag(() => service.authenticate(), operationTimeoutMs);
  if (authResultado.ok) {
    console.log(
      `OK   [Autenticación SAT / obtención de token] token obtenido, expira: ${authResultado.valor.getExpires().formatSat()}  (${authResultado.ms} ms)`
    );
  } else if (authResultado.motivo === 'operation_timeout') {
    console.log(`FAIL [Autenticación SAT] TIMEOUT TOTAL DE OPERACIÓN (SAT_DIAG_OPERATION_TIMEOUT_MS=${operationTimeoutMs} ms)  (${authResultado.ms} ms)`);
    console.log(`     Endpoint: ${endpoints.getAuthenticate()}`);
    return 'autenticacion_sat';
  } else {
    const detalle = extraerDetalleErrorSat(authResultado.error);
    console.log(`FAIL [Autenticación SAT] ${detalle.mensajeNormalizado}  (${authResultado.ms} ms)`);
    console.log(`     Endpoint: ${endpoints.getAuthenticate()}`);
    console.log(`     Mensaje crudo: ${detalle.mensajeCrudo ?? '(no disponible)'}`);
    console.log(`     Nombre del error: ${detalle.nombre ?? '(desconocido)'}${detalle.codigo != null ? `  código=${detalle.codigo}` : ''}${detalle.statusCode != null ? `  http_status=${detalle.statusCode}` : ''}`);
    return 'autenticacion_sat';
  }

  // Etapa 6 (opcional): verificación real de una solicitud EXISTENTE (SAT_DIAG_REQUEST_ID).
  let etapaVerifyExistente: EtapaDiagnostico = 'ok';
  if (requestIdOpcional) {
    console.log('\n[Verificación de solicitud existente]');
    etapaVerifyExistente = await ejecutarVerifyDiagnostico(service, requestBuilder, requestIdOpcional, httpTimeoutMs, operationTimeoutMs, endpoints);
  } else {
    console.log('[Verificación de solicitud existente] omitido (define SAT_DIAG_REQUEST_ID para probarlo).');
  }

  // Etapa 6b (opcional): prueba manual/raw de verify() con variantes de transporte
  // (SAT_DIAG_VERIFY_RAW=1). Requiere SAT_DIAG_REQUEST_ID. No cambia etapaVerifyExistente:
  // es puramente informativa, para comparar contra lo que ya reportó la etapa 6.
  if (verifyRawHabilitado) {
    if (requestIdOpcional) {
      await probarVerifyRaw(service, requestBuilder, requestIdOpcional, endpoints, httpTimeoutMs);
    } else {
      console.log('\n[H] Prueba manual/raw de verify(): omitida (SAT_DIAG_VERIFY_RAW=1 requiere también SAT_DIAG_REQUEST_ID).');
    }
  }

  // Etapa 7 (opcional): crear una solicitud de prueba NUEVA y verificarla de inmediato
  // (SAT_DIAG_CREAR_SOLICITUD=1). Sirve para distinguir "esta solicitud puntual" de
  // "cualquier verificación". Puede correr en la misma corrida que la etapa 6.
  let etapaCrear: EtapaDiagnostico = 'ok';
  if (opcionesCrear) {
    etapaCrear = await probarCrearYVerificar(sat, service, requestBuilder, opcionesCrear, httpTimeoutMs, operationTimeoutMs, endpoints);
  } else {
    console.log('\n[G] Crear solicitud de prueba: omitido (define SAT_DIAG_CREAR_SOLICITUD=1 + tipo/fechas para probarlo).');
  }

  if (etapaVerifyExistente !== 'ok') return etapaVerifyExistente;
  if (etapaCrear !== 'ok') return etapaCrear;
  return 'ok';
}

async function main() {
  console.log(linea('='));
  console.log('Diagnóstico de conectividad SAT — Descarga Masiva CFDI');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(linea('='));

  // --- A) DNS ---
  console.log('\n[A] DNS\n' + linea());
  const hosts = Array.from(new Set(ENDPOINTS.map((e) => new URL(e.url).hostname)));
  const dnsResultados = new Map<string, ResultadoDns>();
  for (const host of hosts) {
    const r = await diagnosticarDns(host);
    dnsResultados.set(host, r);
    if (r.ok) {
      console.log(`OK   ${host}`);
      console.log(`     -> ${r.direcciones!.join(', ')}  (${r.ms} ms)`);
    } else {
      console.log(`FAIL ${host}`);
      console.log(`     -> ${r.error}  (${r.ms} ms)`);
    }
  }

  // --- B/C/D) HTTPS + TLS + tiempo ---
  console.log('\n[B/C/D] HTTPS, TLS y tiempo de respuesta por endpoint\n' + linea());
  const httpsResultados = new Map<string, ResultadoHttps>();
  for (const endpoint of ENDPOINTS) {
    const r = await diagnosticarHttps(endpoint.url);
    httpsResultados.set(endpoint.nombre, r);
    if (r.ok) {
      console.log(`OK   [${endpoint.nombre}] ${endpoint.url}`);
      console.log(`     status=${r.statusCode}  tls=${r.tlsProtocol ?? '?'}/${r.tlsCipher ?? '?'}  tiempo=${r.ms} ms`);
    } else {
      console.log(`FAIL [${endpoint.nombre}] ${endpoint.url}`);
      console.log(`     error=${r.error}  tiempo=${r.ms} ms`);
    }
  }

  // --- E) Endpoints reales que usa la librería ---
  console.log('\n[E] Endpoints que usa @nodecfdi/sat-ws-descarga-masiva en este momento\n' + linea());
  try {
    const sat = await loadSatWsModule();
    const endpoints = sat.ServiceEndpoints.cfdi();
    console.log(`Autenticación: ${endpoints.getAuthenticate()}`);
    console.log(`Solicitud:     ${endpoints.getQuery()}`);
    console.log(`Verificación:  ${endpoints.getVerify()}`);
    console.log(`Descarga:      ${endpoints.getDownload()}`);
    const coincide = ENDPOINTS.every((e) =>
      [endpoints.getAuthenticate(), endpoints.getQuery(), endpoints.getVerify(), endpoints.getDownload()].includes(e.url)
    );
    console.log(coincide ? '(coincide con lo probado arriba)' : '(⚠ NO coincide con lo probado arriba — revisar)');
  } catch (error: any) {
    console.log(`FAIL al cargar la librería: ${error?.message ?? error}`);
  }

  // --- F) Autenticación real ante el SAT (opcional) ---
  console.log('\n[F] Autenticación real ante el SAT (opcional)\n' + linea());

  const empresaIdRaw = process.env.SAT_DIAG_EMPRESA_ID;
  const password = process.env.SAT_DIAG_PASSWORD;
  const requestIdOpcional = process.env.SAT_DIAG_REQUEST_ID;
  const cerPath = process.env.SAT_DIAG_CER_PATH;
  const keyPath = process.env.SAT_DIAG_KEY_PATH;
  const httpTimeoutMs = parseTimeoutEnv(process.env.SAT_DIAG_HTTP_TIMEOUT_MS, DEFAULT_HTTP_TIMEOUT_MS);
  const operationTimeoutMs = parseTimeoutEnv(process.env.SAT_DIAG_OPERATION_TIMEOUT_MS, DEFAULT_OPERATION_TIMEOUT_MS);
  const verifyRawHabilitado = process.env.SAT_DIAG_VERIFY_RAW === '1';

  // Prueba controlada opcional: crear solicitud nueva + verificar de inmediato.
  let opcionesCrear: OpcionesSolicitudPrueba | null = null;
  if (process.env.SAT_DIAG_CREAR_SOLICITUD === '1') {
    const tipoRaw = (process.env.SAT_DIAG_TIPO ?? '').trim();
    const tipoSolicitudRaw = (process.env.SAT_DIAG_TIPO_SOLICITUD ?? '').trim();
    const fechaInicio = (process.env.SAT_DIAG_FECHA_INICIO ?? '').trim();
    const fechaFin = (process.env.SAT_DIAG_FECHA_FIN ?? '').trim();
    const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

    const tipoDescarga: SatTipoDescarga | null = tipoRaw === 'recibidos' || tipoRaw === 'emitidos' ? tipoRaw : null;
    // "cfdi" es el alias que usa el usuario; la librería/la app lo llaman "xml".
    const tipoSolicitud: SatTipoSolicitud | null =
      tipoSolicitudRaw === 'metadata' ? 'metadata' : tipoSolicitudRaw === 'xml' || tipoSolicitudRaw === 'cfdi' ? 'xml' : null;

    if (!tipoDescarga || !tipoSolicitud || !FECHA_REGEX.test(fechaInicio) || !FECHA_REGEX.test(fechaFin) || fechaFin < fechaInicio) {
      console.log(
        'FAIL SAT_DIAG_CREAR_SOLICITUD=1 requiere SAT_DIAG_TIPO=recibidos|emitidos, SAT_DIAG_TIPO_SOLICITUD=metadata|cfdi, y SAT_DIAG_FECHA_INICIO/SAT_DIAG_FECHA_FIN válidos (YYYY-MM-DD, fin >= inicio). Se omite la prueba de crear solicitud.'
      );
    } else {
      opcionesCrear = { tipoDescarga, tipoSolicitud, fechaInicio, fechaFin };
    }
  }

  let etapaAuth: EtapaDiagnostico = 'omitido';

  if (empresaIdRaw && password) {
    // Modalidad principal: credenciales guardadas en Emphasys para la empresa.
    const empresaId = Number(empresaIdRaw);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      console.log(`FAIL SAT_DIAG_EMPRESA_ID inválido: "${empresaIdRaw}"`);
    } else {
      etapaAuth = await diagnosticarPorEmpresa(
        empresaId,
        password,
        requestIdOpcional,
        opcionesCrear,
        httpTimeoutMs,
        operationTimeoutMs,
        verifyRawHabilitado
      );
    }
  } else if (cerPath && keyPath && password) {
    // Modalidad legacy: .cer/.key sueltos en disco (NO es la ruta principal para esta app;
    // útil solo si quieres probar una FIEL que todavía no está cargada en Emphasys).
    console.log('Modalidad: archivos .cer/.key sueltos (legacy — no es la ruta principal de esta app).');
    const inicioLocal = performance.now();
    try {
      const cerBuffer = await fs.readFile(cerPath);
      const keyBuffer = await fs.readFile(keyPath);

      let service;
      try {
        const construido = await construirServicioSat(cerBuffer, keyBuffer, password);
        service = construido.service;
        etapaAuth = 'validacion_fiel';
        console.log(`OK   FIEL válida localmente (Fiel.create + isValid, sin red)  (${ms(inicioLocal)} ms)`);
      } catch (error: any) {
        etapaAuth = 'construccion_fiel';
        console.log(`FAIL FIEL inválida localmente (certificado/llave/contraseña): ${error?.message ?? error}  (${ms(inicioLocal)} ms)`);
      }

      if (service) {
        const inicioAuth = performance.now();
        try {
          await service.authenticate();
          etapaAuth = 'ok';
          console.log(`OK   Autenticación aceptada por el SAT  (${ms(inicioAuth)} ms)`);
        } catch (error: any) {
          etapaAuth = 'autenticacion_sat';
          console.log(`FAIL Autenticación rechazada o sin respuesta del SAT: ${error?.message ?? error}  (${ms(inicioAuth)} ms)`);
        }
      }
    } catch (error: any) {
      console.log(`FAIL No se pudieron leer los archivos .cer/.key indicados: ${error?.message ?? error}`);
    }
  } else {
    console.log(
      'Omitido: define SAT_DIAG_EMPRESA_ID + SAT_DIAG_PASSWORD (modalidad principal, usa la FIEL ya cargada en Emphasys) para probar autenticación real.'
    );
  }

  // --- Resumen ---
  console.log('\n' + linea('='));
  console.log('RESUMEN');
  console.log(linea('='));

  const dnsOk = Array.from(dnsResultados.values()).every((r) => r.ok);
  const httpsOk = Array.from(httpsResultados.values()).every((r) => r.ok);

  const ETAPA_LABEL: Record<EtapaDiagnostico, string> = {
    omitido: 'no probada (variables de entorno no definidas)',
    lectura_credenciales: 'FALLA (no hay credenciales guardadas para esa empresa)',
    vigencia_local: 'FALLA (FIEL guardada vencida)',
    descifrado: 'FALLA (no se pudo descifrar cer/key — ¿cambió la clave de cifrado?)',
    construccion_fiel: 'FALLA (certificado/llave/contraseña inválidos, antes de tocar la red)',
    validacion_fiel: 'FALLA (FIEL construida pero no válida — ¿es un CSD? ¿vencida?)',
    autenticacion_sat: 'FALLA (llegó a contactar al SAT, pero la autenticación no se completó)',
    verificacion_solicitud: 'FALLA (autenticación OK, pero verify() no respondió u obtuvo error)',
    crear_solicitud_prueba: 'FALLA (no se pudo crear la solicitud de prueba ante el SAT)',
    ok: 'OK',
  };

  console.log(`DNS:              ${dnsOk ? 'OK' : 'FALLA'}`);
  console.log(`HTTPS/TLS:        ${httpsOk ? 'OK' : 'FALLA'}`);
  console.log(`Autenticación / verificación:    ${ETAPA_LABEL[etapaAuth]}`);

  let etapaFinal: string;
  if (!dnsOk) etapaFinal = 'DNS';
  else if (!httpsOk) etapaFinal = 'Conexión TCP/TLS';
  else if (etapaAuth === 'lectura_credenciales') etapaFinal = 'Lectura de credenciales guardadas (no hay ninguna para esa empresa)';
  else if (etapaAuth === 'vigencia_local' || etapaAuth === 'construccion_fiel' || etapaAuth === 'validacion_fiel')
    etapaFinal = 'e.firma (antes de tocar la red: vigencia, certificado, llave o contraseña)';
  else if (etapaAuth === 'descifrado') etapaFinal = 'Descifrado de credenciales guardadas (clave de cifrado del servidor)';
  else if (etapaAuth === 'autenticacion_sat') etapaFinal = 'Autenticación ante el SAT (red llega, el SAT no completa el login)';
  else if (etapaAuth === 'verificacion_solicitud') etapaFinal = 'Verificación de solicitud (autenticación OK, verify() falló o no fue aceptado)';
  else if (etapaAuth === 'crear_solicitud_prueba') etapaFinal = 'Crear solicitud de prueba (query() falló o no fue aceptado)';
  else etapaFinal = 'Ninguna detectada — DNS/HTTPS/TLS OK' + (etapaAuth === 'ok' ? ' y autenticación/verificación exitosas' : ' (autenticación no probada)');

  console.log(`\nEtapa donde parece fallar: ${etapaFinal}`);
  console.log(linea('='));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error inesperado en el diagnóstico:', error?.message ?? error);
    process.exit(1);
  });
