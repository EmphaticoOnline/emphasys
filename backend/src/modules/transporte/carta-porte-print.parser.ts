import { XMLParser } from 'fast-xml-parser';
import type { CartaPortePrintDomicilio, CartaPortePrintXmlData } from './carta-porte-print.types';

const asArray = <T>(value: T | T[] | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string | undefined => value == null || String(value).trim() === '' ? undefined : String(value);
const num = (value: unknown): number | undefined => {
  if (value == null || String(value).trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};
const attr = (node: any, name: string) => text(node?.[name]);

function domicilio(node: any): CartaPortePrintDomicilio | undefined {
  if (!node || typeof node !== 'object') return undefined;
  return {
    calle: attr(node, 'Calle'), numeroExterior: attr(node, 'NumeroExterior'), numeroInterior: attr(node, 'NumeroInterior'),
    colonia: attr(node, 'Colonia'), localidad: attr(node, 'Localidad'), municipio: attr(node, 'Municipio'),
    estado: attr(node, 'Estado'), pais: attr(node, 'Pais'), codigoPostal: attr(node, 'CodigoPostal'),
  };
}

function findCartaPorte(parsed: any): any {
  const comprobante = parsed?.Comprobante ?? parsed?.['cfdi:Comprobante'];
  const complemento = comprobante?.Complemento ?? comprobante?.['cfdi:Complemento'];
  const direct = complemento?.CartaPorte ?? complemento?.['cartaporte31:CartaPorte'];
  if (direct) return direct;
  for (const key of Object.keys(complemento ?? {})) if (key.toLowerCase().endsWith('cartaporte')) return complemento[key];
  return undefined;
}

export function extractCfdiFechaTimbrado(xmlTimbrado: string): string | undefined {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, parseTagValue: false, trimValues: true });
  const parsed = parser.parse(xmlTimbrado);
  const comprobante = parsed?.Comprobante ?? parsed?.['cfdi:Comprobante'];
  const complemento = comprobante?.Complemento ?? comprobante?.['cfdi:Complemento'];
  const timbre = complemento?.TimbreFiscalDigital ?? complemento?.['tfd:TimbreFiscalDigital'];
  return text(timbre?.FechaTimbrado);
}

export function parseCartaPorte31Xml(xmlTimbrado: string): CartaPortePrintXmlData {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, parseTagValue: false, trimValues: true });
  const parsed = parser.parse(xmlTimbrado);
  const carta = findCartaPorte(parsed);
  if (!carta) throw new Error('El XML timbrado no contiene el complemento Carta Porte.');
  if (String(carta.Version ?? '') !== '3.1') throw new Error(`Versión Carta Porte no soportada: ${carta.Version ?? 'desconocida'}`);

  const ubicaciones = asArray(carta.Ubicaciones?.Ubicacion).map((u: any) => ({
    tipoUbicacion: attr(u, 'TipoUbicacion') ?? '', idUbicacion: attr(u, 'IDUbicacion'),
    rfc: attr(u, 'RFCRemitenteDestinatario'), nombre: attr(u, 'NombreRemitenteDestinatario'),
    residenciaFiscal: attr(u, 'ResidenciaFiscal'), numRegIdTrib: attr(u, 'NumRegIdTrib'),
    fechaHora: attr(u, 'FechaHoraSalidaLlegada'), distanciaRecorrida: num(u.DistanciaRecorrida), domicilio: domicilio(u.Domicilio),
  }));
  const mercanciasNode = carta.Mercancias ?? {};
  const items = asArray(mercanciasNode.Mercancia).map((m: any) => {
    const cantidadTransporta = asArray(m.CantidadTransporta)[0];
    return {
      bienesTransportados: attr(m, 'BienesTransp'), descripcion: attr(m, 'Descripcion'), cantidad: num(m.Cantidad),
      claveUnidad: attr(m, 'ClaveUnidad'), unidad: attr(m, 'Unidad'), materialPeligroso: attr(m, 'MaterialPeligroso'),
      cveMaterialPeligroso: attr(m, 'CveMaterialPeligroso'), embalaje: attr(m, 'Embalaje'), descripEmbalaje: attr(m, 'DescripEmbalaje'),
      pesoEnKg: num(m.PesoEnKg), valorMercancia: num(m.ValorMercancia), moneda: attr(m, 'Moneda'),
      idOrigen: attr(cantidadTransporta, 'IDOrigen'), idDestino: attr(cantidadTransporta, 'IDDestino'),
    };
  });
  const auto = mercanciasNode.Autotransporte;
  const iv = auto?.IdentificacionVehicular;
  const seguros = auto?.Seguros;
  const autotransporte = auto ? {
    permisoSct: attr(auto, 'PermSCT'), numPermisoSct: attr(auto, 'NumPermisoSCT'), configuracionVehicular: attr(iv, 'ConfigVehicular'),
    placaVm: attr(iv, 'PlacaVM'), anioModeloVm: num(iv?.AnioModeloVM), pesoBrutoVehicular: num(iv?.PesoBrutoVehicular),
    seguros: { aseguraRespCivil: attr(seguros, 'AseguraRespCivil'), polizaRespCivil: attr(seguros, 'PolizaRespCivil'), aseguraMedAmbiente: attr(seguros, 'AseguraMedAmbiente'), polizaMedAmbiente: attr(seguros, 'PolizaMedAmbiente'), aseguraCarga: attr(seguros, 'AseguraCarga'), polizaCarga: attr(seguros, 'PolizaCarga'), primaSeguro: num(seguros?.PrimaSeguro) },
    remolques: asArray(auto?.Remolques?.Remolque).map((r: any) => ({ subtipoRemolque: attr(r, 'SubTipoRem'), placa: attr(r, 'Placa') })),
  } : undefined;
  const figuras = asArray(carta.FiguraTransporte?.TiposFigura ?? carta.FiguraTransporte?.Figura ?? carta.FiguraTransporte).map((f: any) => ({
    tipoFigura: attr(f, 'TipoFigura'), rfcFigura: attr(f, 'RFCFigura'), nombreFigura: attr(f, 'NombreFigura'), numLicencia: attr(f, 'NumLicencia'),
    numRegIdTrib: attr(f, 'NumRegIdTrib'), residenciaFiscal: attr(f, 'ResidenciaFiscal'), domicilio: domicilio(f.Domicilio),
  }));
  return {
    cartaPorte: { version: String(carta.Version), idCcp: attr(carta, 'IdCCP'), transporteInternacional: attr(carta, 'TranspInternac'), totalDistanciaRecorrida: num(carta.TotalDistRec) },
    ubicaciones, mercancias: { pesoBrutoTotal: num(mercanciasNode.PesoBrutoTotal), unidadPeso: attr(mercanciasNode, 'UnidadPeso'), pesoNetoTotal: num(mercanciasNode.PesoNetoTotal), numTotalMercancias: num(mercanciasNode.NumTotalMercancias), items }, autotransporte, figuras,
  };
}
