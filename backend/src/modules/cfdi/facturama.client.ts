import axios, { AxiosInstance } from 'axios';
import pool from '../../config/database';
import type { FacturamaConfig, FacturamaStampResponse } from './cfdi.types';
import { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';
export { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';

const DEFAULT_BASE_URL = 'https://apisandbox.facturama.mx';
const DEFAULT_STAMP_PATH = '/3/cfdis';

function tryDecodeBase64(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (_) {
    return value;
  }
}

function getEnvConfig(): FacturamaConfig {
  const username = process.env.FACTURAMA_USER || process.env.FACTURAMA_USERNAME;
  const password = process.env.FACTURAMA_PASSWORD;
  const baseUrl = process.env.FACTURAMA_BASE_URL || DEFAULT_BASE_URL;
  const stampPath = process.env.FACTURAMA_STAMP_PATH || DEFAULT_STAMP_PATH;

  return {
    baseUrl,
    username: username || '',
    password: password || '',
    stampPath,
  };
}

async function getActiveDatabaseConfig(): Promise<FacturamaConfig | null> {
  const { rows } = await pool.query<{
    base_url: string;
    username: string;
    password: string;
    stamp_path: string;
  }>(
    `SELECT base_url,
            username,
            password,
            stamp_path
       FROM core.cfdi_pac_config
      WHERE activo = TRUE
      LIMIT 1`
  );

  const row = rows[0];
  if (!row) return null;

  return {
    baseUrl: row.base_url || DEFAULT_BASE_URL,
    username: row.username || '',
    password: row.password || '',
    stampPath: row.stamp_path || DEFAULT_STAMP_PATH,
  };
}

export class FacturamaClient {
  private http: AxiosInstance;
  private readonly stampPath: string;

  constructor(private readonly config: FacturamaConfig) {
    if (!config.username || !config.password) {
      throw new Error('Credenciales de Facturama no configuradas. Define FACTURAMA_USER y FACTURAMA_PASSWORD.');
    }

    this.stampPath = config.stampPath || DEFAULT_STAMP_PATH;
    this.http = axios.create({
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      auth: {
        username: config.username,
        password: config.password,
      },
    });
  }

  static fromEnv(): FacturamaClient {
    return new FacturamaClient(getEnvConfig());
  }

  static async fromDatabaseOrEnv(): Promise<FacturamaClient> {
    try {
      const databaseConfig = await getActiveDatabaseConfig();
      if (databaseConfig) {
        return new FacturamaClient(databaseConfig);
      }
    } catch (error) {
      console.warn('[facturama] No se pudo cargar configuración activa desde core.cfdi_pac_config. Se usará .env como fallback.', error);
    }

    return FacturamaClient.fromEnv();
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
        }
      }
      throw error;
    }
  }
}
