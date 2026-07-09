import { create } from 'xmlbuilder2';
import type { FolioXml } from './auxiliarFoliosXml.repository';
import type { TipoSolicitudPolizas } from './tipoSolicitudSat';

// Estructura verificada contra el XSD oficial vigente del SAT (Anexo 24,
// Contabilidad Electrónica, "Auxiliar de folios fiscales" versión 1.3):
//   http://omawww.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarFolios/AuxiliarFolios_1_3.xsd
//
// Nodo raíz "RepAuxFol": Version (fijo "1.3"), RFC (12-13, requerido), Mes
// (cadena "01".."12"), Anio (entero 2015-2099), TipoSolicitud (patrón
// "AF|FC|DE|CO"), NumOrden (requerido solo si AF/FC), NumTramite (requerido
// solo si DE/CO) -- MISMOS atributos y misma regla condicional que
// PolizasPeriodo_1_3, verificado independientemente en este XSD.
//
// Nodo "DetAuxFol" (0..n, por póliza): SOLO tiene NumUnIdenPol (1-50) y
// Fecha (date). NO tiene concepto ni ningún dato de cuenta.
//
// Nodo "ComprNal" (0..n, hijo de DetAuxFol, por CFDI relacionado): UUID_CFDI
// (36, patrón UUID estándar, requerido), MontoTotal (t_importe, requerido),
// RFC (12-13, del tercero, requerido), MetPagoAux (catálogo SAT, opcional --
// Emphasys no captura forma de pago por movimiento, no se genera), Moneda
// (catálogo SAT, opcional), TipCamb (decimal, opcional pero requerido si
// Moneda != MXN -- Emphasys no captura tipo de cambio, por lo que NUNCA se
// genera TipCamb y, en consecuencia, tampoco se incluye Moneda cuando es
// distinta de MXN, para no dejar un nodo condicionalmente inválido).
//
// ComprNalOtr, ComprExt: existen en el XSD pero no se implementan (Emphasys
// no captura CFD/CBB pre-2014 ni comprobantes extranjeros sin CFDI).
const NAMESPACE = 'http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarFolios';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = `${NAMESPACE} ${NAMESPACE}/AuxiliarFolios_1_3.xsd`;

function formatearImporte(valor: number): string {
  return valor.toFixed(2);
}

export function construirAuxiliarFoliosXmlString(params: {
  rfc: string;
  ejercicio: number;
  periodo: number;
  tipoSolicitud: TipoSolicitudPolizas;
  numOrden: string | null;
  numTramite: string | null;
  folios: FolioXml[];
}): string {
  const { rfc, ejercicio, periodo, tipoSolicitud, numOrden, numTramite, folios } = params;

  const atributosRaiz: Record<string, string> = {
    'xmlns:auxiliarfolios': NAMESPACE,
    'xmlns:xsi': XSI_NAMESPACE,
    'xsi:schemaLocation': SCHEMA_LOCATION,
    Version: '1.3',
    RFC: rfc,
    Mes: String(periodo).padStart(2, '0'),
    Anio: String(ejercicio),
    TipoSolicitud: tipoSolicitud,
  };
  if ((tipoSolicitud === 'AF' || tipoSolicitud === 'FC') && numOrden) {
    atributosRaiz.NumOrden = numOrden;
  }
  if ((tipoSolicitud === 'DE' || tipoSolicitud === 'CO') && numTramite) {
    atributosRaiz.NumTramite = numTramite;
  }

  const raiz = create({ version: '1.0', encoding: 'UTF-8' }).ele('auxiliarfolios:RepAuxFol', atributosRaiz);

  // DetAuxFol es por PÓLIZA (no por folio): se agrupan los folios
  // incluibles por póliza (NumUnIdenPol + Fecha), preservando el orden ya
  // establecido por la consulta (UUID, fecha, tipo, número, renglón).
  const poliza2clave = (f: FolioXml) => `${f.poliza}|${f.fecha}`;
  const ordenPolizas: string[] = [];
  const foliosPorPoliza = new Map<string, { poliza: string; fecha: string; folios: FolioXml[] }>();

  for (const folio of folios) {
    if (!folio.incluir_en_xml) continue;
    const clave = poliza2clave(folio);
    let grupo = foliosPorPoliza.get(clave);
    if (!grupo) {
      grupo = { poliza: folio.poliza, fecha: folio.fecha, folios: [] };
      foliosPorPoliza.set(clave, grupo);
      ordenPolizas.push(clave);
    }
    grupo.folios.push(folio);
  }

  for (const clave of ordenPolizas) {
    const grupo = foliosPorPoliza.get(clave)!;
    const nodoDet = raiz.ele('auxiliarfolios:DetAuxFol', {
      NumUnIdenPol: grupo.poliza,
      Fecha: grupo.fecha,
    });

    for (const folio of grupo.folios) {
      const monedaMxnONula = !folio.moneda || folio.moneda.toUpperCase() === 'MXN';
      const atributosComprNal: Record<string, string> = {
        UUID_CFDI: folio.uuid_cfdi,
        MontoTotal: formatearImporte(folio.total_cfdi ?? 0),
        RFC: folio.rfc_comprobante ?? '',
      };
      if (monedaMxnONula && folio.moneda) {
        atributosComprNal.Moneda = folio.moneda;
      }
      nodoDet.ele('auxiliarfolios:ComprNal', atributosComprNal).up();
    }

    nodoDet.up();
  }

  return raiz.end({ prettyPrint: true });
}
