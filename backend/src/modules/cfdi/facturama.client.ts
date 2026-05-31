import axios, { AxiosInstance } from 'axios';
import pool from '../../config/database';
import type { FacturamaConfig, FacturamaStampResponse } from './cfdi.types';
import { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';
export { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';

const MISSING_ACTIVE_CONFIG_MESSAGE = 'No existe una configuración PAC activa en core.cfdi_pac_config. Configure Facturama antes de intentar timbrar.';

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

async function getActiveDatabaseConfig(): Promise<FacturamaConfig | null> {
  const { rows } = await pool.query<{
    base_url: string;
    username: string;
    password: string;
    modo: 'sandbox' | 'produccion';
    stamp_path: string;
  }>(
    `SELECT base_url,
            username,
            password,
            modo,
            stamp_path
       FROM core.cfdi_pac_config
      WHERE activo = TRUE
      LIMIT 1`
  );

  const row = rows[0];
  if (!row) return null;

  return {
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
      auth: {
        username: config.username,
        password: config.password,
      },
    });
  }

  static async fromDatabaseOrEnv(): Promise<FacturamaClient> {
    const databaseConfig = await getActiveDatabaseConfig();
    if (!databaseConfig) {
      throw new Error(MISSING_ACTIVE_CONFIG_MESSAGE);
    }

    return new FacturamaClient(databaseConfig);
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

  async stampXml(xml: string): Promise<{ xmlTimbrado: string; response: FacturamaStampResponse; uuid?: string; pdfUrl?: string; xmlUrl?: string; }> {
    const jsonPayload = convertXmlCfdiToFacturamaJson(xml);
    console.log('===== FACTURAMA PAYLOAD START =====');
    console.log(JSON.stringify(jsonPayload, null, 2));
    console.log('===== FACTURAMA PAYLOAD END =====');

    try {
      const create = await this.http.post(this.stampPath, jsonPayload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const data = create.data;

      console.log('[facturama] RESPONSE:', JSON.stringify(data, null, 2));

      // Si viene XmlContent directo (API Lite), usarlo; de lo contrario descargar XML emitido.
      const xmlContent = (data as any)?.XmlContent as string | undefined;
      if (xmlContent) {
        const xmlTimbradoLite = Buffer.from(xmlContent, 'base64').toString('utf8');
        return {
          xmlTimbrado: xmlTimbradoLite,
          response: data,
          uuid: (data as any)?.Uuid || (data as any)?.Complement?.TaxStamp?.Uuid,
          pdfUrl: (data as any)?.PdfUrl,
          xmlUrl: (data as any)?.XmlUrl,
        };
      }

      const cfdiId = (data as any)?.Id;
      if (!cfdiId) {
        throw new Error('Facturama no regresó Id del CFDI para descargar el XML timbrado.');
      }

      // Flujo API /3/cfdis: descargar XML base64 desde /api/Cfdi/xml/issued/{id}
      const file = await this.http.get(`/api/Cfdi/xml/issued/${cfdiId}`);
      const xmlBase64 = (file.data as any)?.Content as string | undefined;
      const xmlTimbrado = xmlBase64 ? Buffer.from(xmlBase64, 'base64').toString('utf8') : tryDecodeBase64((file.data as any)?.Content) || (file.data as any) || '';

      return {
        xmlTimbrado,
        uuid: (data as any)?.Complement?.TaxStamp?.Uuid,
        response: data,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const respData = error.response?.data;
        console.error('[facturama] Error al timbrar:', error.message);
        if (respData !== undefined) {
          console.error('[facturama] response.data:', JSON.stringify(respData, null, 2));
          const modelState = (respData as any)?.ModelState;
          if (modelState !== undefined) {
            console.error('[facturama] response.data.ModelState:', JSON.stringify(modelState, null, 2));
          }

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
    uuid: string;
    motivoSat: string;
    uuidSustitucion?: string | null;
  }): Promise<any> {
    const uuid = String(payload.uuid || '').trim();
    const motive = String(payload.motivoSat || '').trim();
    const folioSustitucion = String(payload.uuidSustitucion || '').trim();

    if (!uuid) {
      throw new Error('UUID de CFDI requerido para cancelar en Facturama');
    }
    if (!motive) {
      throw new Error('Motivo SAT requerido para cancelar en Facturama');
    }

    const body = {
      Motive: motive,
      FolioSubstitution: folioSustitucion || undefined,
    };

    const requests = [
      () => this.http.post(`${this.getApiLiteCfdisPath()}/${encodeURIComponent(uuid)}/cancel`, body, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }),
      () => this.http.delete(`${this.getApiLiteCfdisPath()}/${encodeURIComponent(uuid)}`, {
        data: body,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }),
      () => this.http.post(`${this.getApiLiteCfdisPath()}/cancel`, {
        UUID: uuid,
        ...body,
      }, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }),
    ];

    let lastError: any = null;
    for (const request of requests) {
      try {
        const response = await request();
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (!axios.isAxiosError(error)) {
          continue;
        }

        const status = Number(error.response?.status || 0);
        const respData = error.response?.data;
        const userMessage = buildFacturamaUserMessage(respData);

        if (status >= 400 && status < 500 && status !== 404 && status !== 405) {
          const facturamaError: any = new Error(userMessage || error.message || 'Error al cancelar CFDI en Facturama');
          facturamaError.statusCode = status;
          facturamaError.facturamaResponse = respData;
          facturamaError.isFacturamaValidation = Boolean(userMessage);
          throw facturamaError;
        }
      }
    }

    if (axios.isAxiosError(lastError)) {
      const respData = lastError.response?.data;
      const userMessage = buildFacturamaUserMessage(respData);
      const facturamaError: any = new Error(userMessage || lastError.message || 'Error al cancelar CFDI en Facturama');
      facturamaError.statusCode = lastError.response?.status;
      facturamaError.facturamaResponse = respData;
      facturamaError.isFacturamaValidation = Boolean(userMessage);
      throw facturamaError;
    }

    throw lastError ?? new Error('Error al cancelar CFDI en Facturama');
  }
}
