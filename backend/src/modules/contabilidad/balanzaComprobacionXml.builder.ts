import { create } from 'xmlbuilder2';
import type { CuentaBalanzaXml, TipoEnvioBalanza } from './balanzaComprobacionXml.repository';

// Estructura verificada contra el XSD oficial vigente del SAT (Anexo 24,
// Contabilidad Electrónica, "Balanza de comprobación" versión 1.3):
//   http://omawww.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion/BalanzaComprobacion_1_3.xsd
//
// Nodo raíz "Balanza": Version (fijo "1.3"), RFC (12-13, requerido),
// Mes (cadena "01".."13" — "13" es el mes de "ajuste"/cierre anual, no
// usado en esta fase porque el ERP solo maneja periodos 1-12), Anio (entero
// 2015-2099), TipoEnvio (patrón "[NC]": N=Normal, C=Complementaria).
// FechaModBal es OPCIONAL pero requerida cuando TipoEnvio='C' (validado en
// el repository antes de llegar aquí). Sello/noCertificado/Certificado son
// opcionales (firma digital) y no se generan en esta fase.
//
// Nodo hijo "Ctas" por cuenta: a diferencia del Catálogo de cuentas, este
// nodo NO tiene CodAgrup ni SubCtaDe — se verificó explícitamente en el XSD
// que sus únicos atributos son NumCta (requerido, 1-100, sin restricción de
// caracteres), SaldoIni, Debe, Haber y SaldoFin (los 4 de tipo decimal,
// firmado, 2 decimales). No se inventan atributos adicionales.
const NAMESPACE = 'http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = `${NAMESPACE} ${NAMESPACE}/BalanzaComprobacion_1_3.xsd`;

// Los importes se formatean siempre con 2 decimales explícitos (requisito
// de "validación XML básica" de esta fase: "importes con dos decimales").
function formatearImporte(valor: number): string {
  return valor.toFixed(2);
}

export function construirBalanzaComprobacionXmlString(params: {
  rfc: string;
  ejercicio: number;
  periodo: number;
  tipoEnvio: TipoEnvioBalanza;
  fechaModificacion: string | null;
  cuentas: CuentaBalanzaXml[];
}): string {
  const { rfc, ejercicio, periodo, tipoEnvio, fechaModificacion, cuentas } = params;

  const atributosRaiz: Record<string, string> = {
    'xmlns:balanzacomprobacion': NAMESPACE,
    'xmlns:xsi': XSI_NAMESPACE,
    'xsi:schemaLocation': SCHEMA_LOCATION,
    Version: '1.3',
    RFC: rfc,
    Mes: String(periodo).padStart(2, '0'),
    Anio: String(ejercicio),
    TipoEnvio: tipoEnvio,
  };
  if (tipoEnvio === 'C' && fechaModificacion) {
    atributosRaiz.FechaModBal = fechaModificacion;
  }

  const raiz = create({ version: '1.0', encoding: 'UTF-8' }).ele('balanzacomprobacion:Balanza', atributosRaiz);

  for (const cuenta of cuentas) {
    raiz
      .ele('balanzacomprobacion:Ctas', {
        NumCta: cuenta.num_cta,
        SaldoIni: formatearImporte(cuenta.saldo_ini),
        Debe: formatearImporte(cuenta.debe),
        Haber: formatearImporte(cuenta.haber),
        SaldoFin: formatearImporte(cuenta.saldo_fin),
      })
      .up();
  }

  return raiz.end({ prettyPrint: true });
}
