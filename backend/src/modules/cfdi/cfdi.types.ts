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
  tipo_documento?: string | null;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  documento_origen_id?: number | null;
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
  tratamiento_impuestos?: string | null;
  periodicidad_global?: string | null;
  meses_global?: string | null;
  anio_global?: number | null;
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

export interface CfdiRelatedDocument {
  uuid: string;
}

export interface CfdiRelationsData {
  type: string;
  cfdis: CfdiRelatedDocument[];
}

export interface CfdiGlobalInformation {
  periodicity: string; // SAT code: 01=Diario 02=Semanal 03=Quincenal 04=Mensual 05=Bimestral
  months: string;      // SAT code: 01-12 mensual, 13-18 bimestral
  year: string;        // YYYY
}

export interface CfdiBuildOptions {
  fechaEmision?: string;
  cfdiType?: string;
  relations?: CfdiRelationsData;
  globalInformation?: CfdiGlobalInformation;
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
  modo?: 'sandbox' | 'produccion';
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

// ---------------------------------------------------------------------------
// Complemento de Pagos 2.0
// ---------------------------------------------------------------------------

export interface ImpuestoDR {
  impuesto: string;                      // nombre o clave SAT: "IVA", "002", etc.
  tipo: 'traslado' | 'retencion';
  tasa: number;                          // puede venir como 16 o 0.16
  base: number;
  monto: number;
}

export interface AplicacionComplemento {
  uuid_factura: string;
  serie: string | null;
  folio: string | null;
  moneda_factura: string;
  tipo_cambio_factura: number;
  total_factura: number;
  monto_moneda_documento: number;
  num_parcialidad: number;
  imp_saldo_ant: number;
  imp_saldo_insoluto: number;
  impuestos: ImpuestoDR[];
}

export interface PagoComplementData {
  empresa: {
    rfc: string;
    razon_social: string;
    regimen_fiscal: string;
    codigo_postal_id: string;
  };
  receptor: {
    rfc: string;
    nombre: string;
    regimen_fiscal: string;
    codigo_postal: string;
  };
  pago: {
    monto: number;
    forma_pago: string;
    moneda: string;
    tipo_cambio: number;
    fecha: string;
  };
  aplicaciones: AplicacionComplemento[];
}
