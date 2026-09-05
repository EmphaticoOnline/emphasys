export type CartaPortePrintDomicilio = {
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  colonia?: string;
  localidad?: string;
  municipio?: string;
  estado?: string;
  pais?: string;
  codigoPostal?: string;
};

export type CartaPortePrintModel = {
  branding?: { logoPath?: string; razonSocial?: string; nombre?: string; rfc?: string; regimenFiscal?: string; domicilio?: string };
  cancelado?: boolean;
  colorTablaHeader?: string;
  documento: { documentoId: number; serie?: string; folio?: string; fecha?: string };
  cfdi: { uuid?: string; fechaTimbrado?: string; rfcEmisor?: string; rfcReceptor?: string; selloCfdi?: string; total?: number };
  cartaPorte: {
    version: string;
    idCcp?: string;
    transporteInternacional?: string;
    totalDistanciaRecorrida?: number;
  };
  ubicaciones: Array<{
    tipoUbicacion: string;
    idUbicacion?: string;
    rfc?: string;
    nombre?: string;
    residenciaFiscal?: string;
    numRegIdTrib?: string;
    fechaHora?: string;
    distanciaRecorrida?: number;
    domicilio?: CartaPortePrintDomicilio;
  }>;
  mercancias: {
    pesoBrutoTotal?: number;
    unidadPeso?: string;
    pesoNetoTotal?: number;
    numTotalMercancias?: number;
    items: Array<{
      bienesTransportados?: string;
      descripcion?: string;
      cantidad?: number;
      claveUnidad?: string;
      unidad?: string;
      materialPeligroso?: string;
      cveMaterialPeligroso?: string;
      embalaje?: string;
      descripEmbalaje?: string;
      pesoEnKg?: number;
      valorMercancia?: number;
      moneda?: string;
      idOrigen?: string;
      idDestino?: string;
    }>;
  };
  autotransporte?: {
    permisoSct?: string;
    numPermisoSct?: string;
    configuracionVehicular?: string;
    placaVm?: string;
    anioModeloVm?: number;
    pesoBrutoVehicular?: number;
    seguros: {
      aseguraRespCivil?: string;
      polizaRespCivil?: string;
      aseguraMedAmbiente?: string;
      polizaMedAmbiente?: string;
      aseguraCarga?: string;
      polizaCarga?: string;
      primaSeguro?: number;
    };
    remolques: Array<{ subtipoRemolque?: string; placa?: string }>;
  };
  figuras: Array<{
    tipoFigura?: string;
    rfcFigura?: string;
    nombreFigura?: string;
    numLicencia?: string;
    numRegIdTrib?: string;
    residenciaFiscal?: string;
    domicilio?: CartaPortePrintDomicilio;
  }>;
};

export type CartaPortePrintXmlData = Pick<CartaPortePrintModel, 'cartaPorte' | 'ubicaciones' | 'mercancias' | 'autotransporte' | 'figuras'>;
