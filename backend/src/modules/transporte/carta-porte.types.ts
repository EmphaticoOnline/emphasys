export const CARTA_PORTE_VERSION = '3.1' as const;
export const CARTA_PORTE_UNIDAD_PESO_KG = 'KGM' as const;
export const CARTA_PORTE_TIPO_FIGURA_OPERADOR = '01' as const;
export const FACTURAMA_NAME_ID_CARTA_PORTE_31 = '36' as const;

export interface CartaPorteDomicilio31 {
  Calle?: string;
  NumeroExterior?: string;
  NumeroInterior?: string;
  Colonia?: string;
  Localidad?: string;
  Referencia?: string;
  Municipio?: string;
  Estado: string;
  Pais: string;
  CodigoPostal: string;
}

export interface CartaPorteUbicacion31 {
  TipoUbicacion: 'Origen' | 'Destino';
  IDUbicacion: string;
  RFCRemitenteDestinatario: string;
  NombreRemitenteDestinatario: string;
  FechaHoraSalidaLlegada: string;
  DistanciaRecorrida?: number;
  Domicilio: CartaPorteDomicilio31;
}

export interface CartaPorteMercancia31 {
  BienesTransp: string;
  Descripcion: string;
  Cantidad: number;
  ClaveUnidad: string;
  Unidad: string;
  PesoEnKg: number;
  MaterialPeligroso: 'Sí' | 'No';
  CveMaterialPeligroso?: string;
  Embalaje?: string;
  DescripEmbalaje?: string;
  ValorMercancia?: number;
  Moneda?: string;
  CantidadTransporta?: Array<{
    Cantidad: number;
    IDOrigen: string;
    IDDestino: string;
  }>;
}

export interface CartaPorteAutotransporte31 {
  PermSCT: string;
  NumPermisoSCT: string;
  IdentificacionVehicular: {
    ConfigVehicular: string;
    PlacaVM: string;
    AnioModeloVM: number;
    PesoBrutoVehicular: number;
  };
  Seguros: {
    AseguraRespCivil: string;
    PolizaRespCivil: string;
    AseguraMedAmbiente?: string;
    PolizaMedAmbiente?: string;
    AseguraCarga?: string;
    PolizaCarga?: string;
  };
  Remolques?: Array<{ SubTipoRem: string; Placa: string }>;
}

export interface CartaPorteFigura31 {
  TipoFigura: '01';
  RFCFigura: string;
  NumLicencia: string;
  NombreFigura: string;
  Domicilio: CartaPorteDomicilio31;
}

export interface CartaPorte31 {
  Version: '3.1';
  IdCCP: string;
  TranspInternac: 'No';
  TotalDistRec: number;
  Ubicaciones: CartaPorteUbicacion31[];
  Mercancias: {
    NumTotalMercancias: number;
    PesoBrutoTotal: number;
    UnidadPeso: 'KGM';
    Mercancia: CartaPorteMercancia31[];
    Autotransporte: CartaPorteAutotransporte31;
  };
  FiguraTransporte: CartaPorteFigura31[];
}

export type CartaPorteIssueSection =
  | 'ruta'
  | 'unidad'
  | 'operador'
  | 'mercancias'
  | 'generales';

export interface CartaPorteIssue {
  section: CartaPorteIssueSection;
  message: string;
  /** Índice 1-based del elemento (ubicación / mercancía / remolque / operador) cuando aplica. */
  index?: number;
}

export interface CartaPorteBuildSource {
  viaje: Record<string, any>;
  ubicaciones: Array<Record<string, any>>;
  mercancias: Array<Record<string, any>>;
  figuras: Array<Record<string, any>>;
  remolques: Array<Record<string, any>>;
  vehiculo: Record<string, any> | null;
}
