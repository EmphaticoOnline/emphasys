import axios, { AxiosInstance } from 'axios';
import type {
  FacturamaConfig,
  FacturamaStampedDocument,
  FacturamaStampResponse,
  CfdiTimbradoOptions,
} from './cfdi.types';
import { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';
import { assertPagoComplementPayload } from './pago-complement.builder';
import { enmascararRfc, normalizarRfcEstricto } from './cfdi-emisor.validation';
import {
  actualizarIntentoTimbrado,
  registrarIdAceptado,
} from './cfdi-timbrado-intentos.repository';
import {
  type CfdiPacModalidad,
  getCancelPath,
  getCfdiStatusPath,
  interpretarEstadoCancelacionFacturama,
} from './cfdi-cancelacion';
import {
  resolveHistoricalPacConfig,
  resolvePacConfigById,
  resolvePacConfigForEmpresa,
  type PacConfigResolved,
} from './cfdi-pac-config.resolver';
export { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';

const MISSING_ACTIVE_CONFIG_MESSAGE = 'No existe una configuración PAC activa asignada a la empresa.';

function normalizeFacturamaModelState(modelState: any): string[] {
  if (!modelState || typeof modelState !== 'object') return [];

  return Object.entries(modelState).flatMap(([field, value]) => {
    if (Array.isArray(value)) {
      return value
        .map((msg) => String(msg || '').trim())
        .filter((msg) => msg.length > 0)
        .map((msg) => (field ? `${field}: ${msg}` : msg));
    }

    const msg = String(value || '').trim();
    if (!msg) return [];
    return [field ? `${field}: ${msg}` : msg];
  });
}

function buildFacturamaUserMessage(respData: any): string | null {
  const message = String(respData?.Message || '').trim();
  const modelStateLines = normalizeFacturamaModelState(respData?.ModelState);

  if (!message && modelStateLines.length === 0) return null;
  if (!message) return modelStateLines.join('\n');
  if (modelStateLines.length === 0) return message;
  return `${message}\n${modelStateLines.join('\n')}`;
}

function tryDecodeBase64(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (_) {
    return value;
  }
}

export function getApiLiteIssuedFilePath(format: 'xml' | 'pdf' | 'html', id: string): string {
  return `/Cfdi/${format}/issuedLite/${encodeURIComponent(id)}`;
}

export class CfdiAcceptedPendingDownloadError extends Error {
  readonly statusCode = 409;
  readonly estadoReconciliacion = 'error_descarga';

  constructor(readonly intentoId: number) {
    super('Facturama aceptó la factura, pero no fue posible recuperar el XML. No vuelva a timbrar. El documento requiere reconciliación.');
  }
}

function toFacturamaConfig(row: PacConfigResolved): FacturamaConfig {
  return {
    id: Number(row.id),
    pac: row.pac,
    baseUrl: row.base_url || '',
    username: row.username || '',
    password: row.password || '',
    modo: row.modo,
    stampPath: row.stamp_path || '',
  };
}

export class FacturamaClient {
  private http: AxiosInstance;
  private readonly stampPath: string;

  constructor(private readonly config: FacturamaConfig) {
    if (!config.baseUrl || !config.username || !config.password || !config.stampPath) {
      throw new Error(MISSING_ACTIVE_CONFIG_MESSAGE);
    }

    this.stampPath = config.stampPath;
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: 30_000,
      auth: {
        username: config.username,
        password: config.password,
      },
    });
  }

  static async forEmpresa(empresaId: number): Promise<FacturamaClient> {
    return new FacturamaClient(toFacturamaConfig(await resolvePacConfigForEmpresa(empresaId)));
  }

  static async forConfigId(configId: number): Promise<FacturamaClient> {
    return new FacturamaClient(toFacturamaConfig(await resolvePacConfigById(configId)));
  }

  static async forHistorical(input: {
    empresaId: number;
    configId?: number | null;
    pac?: string | null;
    modalidad?: string | null;
  }): Promise<FacturamaClient> {
    return new FacturamaClient(toFacturamaConfig(await resolveHistoricalPacConfig(input)));
  }

  get configId(): number {
    return this.config.id;
  }

  get pac(): string {
    return this.config.pac;
  }

  private resolveApiLiteBaseUrl(): string {
    if (this.config.modo === 'produccion') {
      return 'https://api.facturama.mx';
    }

    if (this.config.modo === 'sandbox') {
      return 'https://apisandbox.facturama.mx';
    }

    const normalized = (this.config.baseUrl || '').toLowerCase();
    if (normalized.includes('apisandbox.facturama.mx')) {
      return 'https://apisandbox.facturama.mx';
    }

    return 'https://api.facturama.mx';
  }

  getMultiemisorCsdEndpoint(): string {
    return `${this.resolveApiLiteBaseUrl()}/api-lite/csds`;
  }

  private getApiLiteCfdisPath(): string {
    return '/api-lite/3/cfdis';
  }

  private getApiLiteCfdisEndpoint(): string {
    return new URL(this.getApiLiteCfdisPath(), this.resolveApiLiteBaseUrl()).toString();
  }

  async registerMultiemisorCsd(payload: {
    Rfc: string;
    Certificate: string;
    PrivateKey: string;
    PrivateKeyPassword: string;
  }): Promise<any> {
    try {
      const endpoint = this.getMultiemisorCsdEndpoint();
      const response = await axios.post(endpoint, payload, {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const respData = error.response?.data;
        const userMessage = buildFacturamaUserMessage(respData);

        const facturamaError: any = new Error(userMessage || error.message || 'Error al registrar CSD en Facturama');
        facturamaError.statusCode = error.response?.status;
        facturamaError.facturamaResponse = respData;
        facturamaError.isFacturamaValidation = Boolean(userMessage);
        throw facturamaError;
      }

      throw error;
    }
  }

  async stampXml(
    xml: string,
    context: {
      expectedIssuerRfc: string;
      empresaId: number;
      documentoId: number;
      serie?: string | null;
      folio?: string | number | null;
    },
    options?: CfdiTimbradoOptions
  ): Promise<FacturamaStampedDocument> {
    let jsonPayload;
    try {
      jsonPayload = convertXmlCfdiToFacturamaJson(xml, options);
    } catch (error) {
      const validationError: any = new Error(
        error instanceof Error ? error.message : 'El payload CFDI contiene datos fiscales incompletos.'
      );
      validationError.isFacturamaValidation = true;
      throw validationError;
    }
    const expectedIssuerRfc = normalizarRfcEstricto(context.expectedIssuerRfc);
    const payloadIssuerRfc = normalizarRfcEstricto(jsonPayload.Issuer.Rfc);

    if (!expectedIssuerRfc || !payloadIssuerRfc || payloadIssuerRfc !== expectedIssuerRfc) {
      const validationError: any = new Error(
        'El RFC emisor del payload no coincide con el RFC de la empresa activa.'
      );
      validationError.isFacturamaValidation = true;
      throw validationError;
    }

    const endpoint = this.getApiLiteCfdisEndpoint();
    console.info('[CFDI][Facturama] Solicitud de timbrado preparada', {
      endpoint,
      ambiente: this.config.modo,
      empresaId: context.empresaId,
      documentoId: context.documentoId,
      rfcEmisor: enmascararRfc(payloadIssuerRfc),
      serie: context.serie || null,
      folio: context.folio ?? null,
    });

    try {
      const create = await this.http.post(endpoint, jsonPayload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const data = create.data;
      const cfdiId = (data as any)?.Id as string | undefined;
      const intentoId = cfdiId
        ? await registrarIdAceptado({
            empresaId: context.empresaId,
            documentoId: context.documentoId,
            proveedorCfdiId: cfdiId,
            endpoint: new URL(
              getApiLiteIssuedFilePath('xml', cfdiId),
              this.resolveApiLiteBaseUrl()
            ).toString(),
            cfdiPacConfigId: this.configId,
          })
        : undefined;

      // Si viene XmlContent directo (API Lite), usarlo; de lo contrario descargar XML emitido.
      const xmlContent = (data as any)?.XmlContent as string | undefined;
      if (xmlContent) {
        const xmlTimbradoLite = Buffer.from(xmlContent, 'base64').toString('utf8');
        if (intentoId) {
          await actualizarIntentoTimbrado(intentoId, 'xml_recuperado', {
            uuid: (data as any)?.Uuid || (data as any)?.Complement?.TaxStamp?.Uuid || null,
          });
        }
        return {
          xmlTimbrado: xmlTimbradoLite,
          response: data,
          uuid: (data as any)?.Uuid || (data as any)?.Complement?.TaxStamp?.Uuid,
          pdfUrl: (data as any)?.PdfUrl,
          xmlUrl: (data as any)?.XmlUrl,
          intentoId,
        };
      }

      if (!cfdiId) {
        throw new Error('Facturama no regresó Id del CFDI para descargar el XML timbrado.');
      }

      const issuedPath = getApiLiteIssuedFilePath('xml', cfdiId);
      const issuedEndpoint = new URL(issuedPath, this.resolveApiLiteBaseUrl()).toString();

      let file;
      try {
        file = await this.http.get(issuedEndpoint);
      } catch (downloadError: any) {
        await actualizarIntentoTimbrado(intentoId!, 'error_descarga', {
          errorCodigo: String(downloadError?.response?.status || downloadError?.code || 'DOWNLOAD_ERROR'),
          errorMensaje: downloadError,
          incrementarDescarga: true,
        });
        throw new CfdiAcceptedPendingDownloadError(intentoId!);
      }

      const xmlBase64 = (file.data as any)?.Content as string | undefined;
      const xmlTimbrado = xmlBase64
        ? Buffer.from(xmlBase64, 'base64').toString('utf8')
        : tryDecodeBase64((file.data as any)?.Content) || '';

      if (!xmlTimbrado.trim()) {
        await actualizarIntentoTimbrado(intentoId!, 'error_descarga', {
          errorCodigo: 'EMPTY_XML',
          errorMensaje: 'Facturama no devolvió contenido XML.',
          incrementarDescarga: true,
        });
        throw new CfdiAcceptedPendingDownloadError(intentoId!);
      }

      await actualizarIntentoTimbrado(intentoId!, 'xml_recuperado', {
        uuid: (data as any)?.Complement?.TaxStamp?.Uuid || null,
        incrementarDescarga: true,
      });

      return {
        xmlTimbrado,
        uuid: (data as any)?.Complement?.TaxStamp?.Uuid,
        response: data,
        intentoId: intentoId!,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const respData = error.response?.data;
        console.error('[facturama] Error al timbrar:', error.message);
        if (respData !== undefined) {
          const userMessage = buildFacturamaUserMessage(respData);
          if (userMessage) {
            const facturamaError: any = new Error(userMessage);
            facturamaError.isFacturamaValidation = true;
            throw facturamaError;
          }
        }
      }
      throw error;
    }
  }

  async stampPagoComplement(
    payload: object,
    context: { empresaId: number; documentoId: number }
  ): Promise<{
    xmlTimbrado: string;
    response: FacturamaStampResponse;
    uuid?: string;
    pacId?: string | null;
    pacModalidad?: 'lite' | 'web' | null;
    intentoId?: number;
  }> {
    assertPagoComplementPayload(payload);

    try {
      const create = await this.http.post(this.stampPath, payload, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      const data = create.data;
      const pacId = String((data as any)?.Id || '').trim() || null;
      const pacModalidad = this.stampPath.toLowerCase().includes('api-lite') ? 'lite' : 'web';
      const intentoId = pacId
        ? await registrarIdAceptado({
            empresaId: context.empresaId,
            documentoId: context.documentoId,
            proveedorCfdiId: pacId,
            endpoint: getApiLiteIssuedFilePath('xml', pacId),
            cfdiPacConfigId: this.configId,
          })
        : undefined;

      const xmlContent = (data as any)?.XmlContent as string | undefined;
      if (xmlContent) {
        if (intentoId) {
          await actualizarIntentoTimbrado(intentoId, 'xml_recuperado', {
            uuid: (data as any)?.Uuid || (data as any)?.Complement?.TaxStamp?.Uuid || null,
          });
        }
        return {
          xmlTimbrado: Buffer.from(xmlContent, 'base64').toString('utf8'),
          response: data,
          uuid: (data as any)?.Uuid || (data as any)?.Complement?.TaxStamp?.Uuid,
          pacId,
          pacModalidad,
          intentoId,
        };
      }

      const cfdiId = (data as any)?.Id;
      if (!cfdiId) {
        throw new Error('Facturama no regresó Id para descargar XML del complemento de pago.');
      }

      let file;
      try {
        file = await this.http.get(getApiLiteIssuedFilePath('xml', cfdiId));
      } catch (downloadError: any) {
        if (intentoId) {
          await actualizarIntentoTimbrado(intentoId, 'error_descarga', {
            errorCodigo: String(downloadError?.response?.status || downloadError?.code || 'DOWNLOAD_ERROR'),
            errorMensaje: downloadError,
            incrementarDescarga: true,
          });
        }
        throw new CfdiAcceptedPendingDownloadError(intentoId || 0);
      }
      const xmlBase64 = (file.data as any)?.Content as string | undefined;
      const xmlTimbrado = xmlBase64
        ? Buffer.from(xmlBase64, 'base64').toString('utf8')
        : String((file.data as any) || '');
      if (intentoId) {
        await actualizarIntentoTimbrado(intentoId, 'xml_recuperado', {
          uuid: (data as any)?.Uuid || (data as any)?.Complement?.TaxStamp?.Uuid || null,
          incrementarDescarga: true,
        });
      }

      return {
        xmlTimbrado,
        uuid: (data as any)?.Complement?.TaxStamp?.Uuid,
        response: data,
        pacId,
        pacModalidad,
        intentoId,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const respData = error.response?.data;
        console.error('[facturama] Error al timbrar complemento de pago:', error.message);
        if (respData !== undefined) {
          const userMessage = buildFacturamaUserMessage(respData);
          if (userMessage) {
            const facturamaError: any = new Error(userMessage);
            facturamaError.isFacturamaValidation = true;
            throw facturamaError;
          }
        }
      }
      throw error;
    }
  }

  async cancelCfdi(payload: {
    pacId: string;
    modalidad: CfdiPacModalidad;
    motivoSat: string;
    uuidSustitucion?: string | null;
  }): Promise<{
    data: any;
    endpoint: string;
    proveedorStatus: string | null;
    estado: ReturnType<typeof interpretarEstadoCancelacionFacturama>;
  }> {
    const motive = String(payload.motivoSat || '').trim();
    const folioSustitucion = String(payload.uuidSustitucion || '').trim();

    if (!motive) {
      throw new Error('Motivo SAT requerido para cancelar en Facturama');
    }
    if (motive === '01' && !folioSustitucion) {
      throw new Error('UUID de sustitución requerido para el motivo SAT 01');
    }

    const endpoint = getCancelPath(
      payload.modalidad,
      payload.pacId,
      motive,
      folioSustitucion || null
    );

    try {
      const response = await this.http.delete(endpoint, {
        headers: { Accept: 'application/json' },
      });
      const proveedorStatus = String(response.data?.Status ?? response.data?.status ?? '').trim() || null;
      return {
        data: response.data,
        endpoint,
        proveedorStatus,
        estado: interpretarEstadoCancelacionFacturama(proveedorStatus),
      };
    } catch (error: any) {
      if (!axios.isAxiosError(error)) throw error;
      const respData = error.response?.data;
      const userMessage = buildFacturamaUserMessage(respData);
      const facturamaError: any = new Error(userMessage || error.message || 'Error al cancelar CFDI en Facturama');
      facturamaError.statusCode = error.response?.status;
      facturamaError.facturamaResponse = respData;
      facturamaError.requestDispatched = true;
      facturamaError.hasPacResponse = Boolean(error.response);
      facturamaError.transportCode = error.code || null;
      facturamaError.isFacturamaValidation = Boolean(userMessage);
      throw facturamaError;
    }
  }

  async getCfdiStatus(payload: {
    pacId: string;
    modalidad: CfdiPacModalidad;
  }): Promise<{
    data: any;
    endpoint: string;
    httpStatus: number;
    proveedorStatus: string | null;
    estado: ReturnType<typeof interpretarEstadoCancelacionFacturama>;
  }> {
    const endpoint = getCfdiStatusPath(payload.modalidad, payload.pacId);
    const response = await this.http.get(endpoint, {
      headers: { Accept: 'application/json' },
    });
    const proveedorStatus = String(response.data?.Status ?? response.data?.status ?? '').trim() || null;
    return {
      data: response.data,
      endpoint,
      httpStatus: response.status,
      proveedorStatus,
      estado: interpretarEstadoCancelacionFacturama(proveedorStatus),
    };
  }
}
