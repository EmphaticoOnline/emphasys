import axios, { AxiosInstance } from 'axios';
import pool from '../../config/database';
import type { FacturamaConfig, FacturamaStampResponse } from './cfdi.types';
import { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';
export { convertXmlCfdiToFacturamaJson } from './convertXmlCfdiToFacturamaJson';

const MISSING_ACTIVE_CONFIG_MESSAGE = 'No existe una configuración PAC activa en core.cfdi_pac_config. Configure Facturama antes de intentar timbrar.';

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
    baseUrl: row.base_url || '',
    username: row.username || '',
    password: row.password || '',
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
