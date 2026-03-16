import type { AxiosResponse } from 'axios';

export type CfdiMoneda = 'MXN' | string;

export interface CfdiEmpresa {
  id: number;
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  codigo_postal_id: string;
}

export interface CfdiDocumento {
  id: number;
  empresa_id: number;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  moneda: CfdiMoneda;
  subtotal: number;
  iva: number;
  total: number;
  forma_pago: string | null;
  metodo_pago: string | null;
  uso_cfdi: string | null;
  rfc_receptor: string | null;
  nombre_receptor: string | null;
  regimen_fiscal_receptor: string | null;
  codigo_postal_receptor: string | null;
}

export interface CfdiPartida {
  id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal_partida: number;
  iva_porcentaje?: number | null; // legacy
  iva_monto?: number | null; // legacy
  descripcion: string;
  clave_producto_sat: string | null;
  clave_unidad_sat: string | null;
  impuestos?: CfdiPartidaImpuesto[];
}

export interface CfdiPartidaImpuesto {
  impuesto: string;
  tipo: 'traslado' | 'retencion' | string;
  tasa: number;
  base: number;
  monto: number;
}

export interface CfdiInvoiceData {
  documento: CfdiDocumento;
  empresa: CfdiEmpresa;
  partidas: CfdiPartida[];
}

export interface CfdiBuildOptions {
  fechaEmision?: string;
}

export interface CfdiBuildResult {
  xml: string;
  subtotal: number;
  totalImpuestosTrasladados: number;
  total: number;
}

export interface TimbreFiscalDigitalData {
  uuid?: string;
  fechaTimbrado?: string;
  selloCfd?: string;
  selloSat?: string;
  noCertificadoSat?: string;
  version?: string;
  cadenaOriginal?: string | null;
  serie?: string | null;
  folio?: string | null;
  noCertificado?: string | null;
  estadoSat?: string | null;
  rfcProveedorCertificacion?: string | null;
}

export interface FacturamaConfig {
  baseUrl: string;
  username: string;
  password: string;
  stampPath?: string;
}

export interface FacturamaStampResponse {
  uuid?: string;
  FechaTimbrado?: string;
  Cfdi?: string;
  Xml?: string;
  CadenaOriginal?: string;
  QrCode?: string;
  QrUrl?: string;
  NoCertificado?: string;
  NoCertificadoSat?: string;
  SelloCFD?: string;
  SelloSAT?: string;
  Serie?: string;
  Folio?: string;
  Estado?: string;
  [key: string]: any;
}

export interface FacturamaStampResult {
  rawResponse: FacturamaStampResponse;
  httpResponse?: AxiosResponse<FacturamaStampResponse>;
  xmlTimbrado: string;
  timbre: TimbreFiscalDigitalData;
}

export interface TimbradoPersisted {
  documento_id: number;
  uuid: string;
  fecha_timbrado: Date;
  version_cfdi: string | null;
  serie_cfdi: string | null;
  folio_cfdi: string | null;
  no_certificado: string | null;
  no_certificado_sat: string | null;
  sello_cfdi: string | null;
  sello_sat: string | null;
  cadena_original: string | null;
  xml_timbrado: string | null;
  qr_url: string | null;
  estado_sat: string | null;
  rfc_emisor?: string | null;
  rfc_receptor?: string | null;
  total?: number | null;
}

export interface TimbrarFacturaResult {
  xmlGenerado: string;
  xmlTimbrado: string;
  timbre: TimbradoPersisted;
  facturamaResponse: FacturamaStampResponse;
}
