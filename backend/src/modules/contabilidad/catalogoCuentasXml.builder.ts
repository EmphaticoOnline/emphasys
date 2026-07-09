import { create } from 'xmlbuilder2';
import type { CuentaCatalogoXml } from './catalogoCuentasXml.repository';

// Estructura verificada contra el XSD oficial vigente del SAT (Anexo 24,
// Contabilidad Electrónica, "Catálogo de cuentas" versión 1.3):
//   http://omawww.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas/CatalogoCuentas_1_3.xsd
//
// Nodo raíz "Catalogo": Version (fijo "1.3"), RFC (12-13, requerido),
// Mes (cadena "01".."12"), Anio (entero 2015-2099). Sello/noCertificado/
// Certificado son OPCIONALES (firma digital del catálogo) y no se generan
// en esta fase (no hay firmado con CSD todavía).
//
// Nodo hijo "Ctas" por cuenta: CodAgrup (requerido, catálogo SAT), NumCta
// (requerido, cadena 1-100, SIN restricción de caracteres más allá de la
// longitud: se conserva tal cual la captura el contribuyente, incluyendo
// espacios), Desc (requerido, 1-400), Nivel (entero >= 1, requerido),
// Natur (requerido, patrón exacto "[DA]" — el atributo se llama "Natur",
// NO "Nat": esto se verificó explícitamente porque varias fuentes
// secundarias no oficiales lo abrevian mal), SubCtaDe (opcional, 1-100:
// solo se incluye cuando la cuenta tiene padre incluido en el catálogo).
const NAMESPACE = 'http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = `${NAMESPACE} ${NAMESPACE}/CatalogoCuentas_1_3.xsd`;

export function construirCatalogoCuentasXmlString(params: {
  rfc: string;
  ejercicio: number;
  periodo: number;
  cuentas: CuentaCatalogoXml[];
}): string {
  const { rfc, ejercicio, periodo, cuentas } = params;

  const raiz = create({ version: '1.0', encoding: 'UTF-8' }).ele('catalogocuentas:Catalogo', {
    'xmlns:catalogocuentas': NAMESPACE,
    'xmlns:xsi': XSI_NAMESPACE,
    'xsi:schemaLocation': SCHEMA_LOCATION,
    Version: '1.3',
    RFC: rfc,
    Mes: String(periodo).padStart(2, '0'),
    Anio: String(ejercicio),
  });

  for (const cuenta of cuentas) {
    const atributos: Record<string, string> = {
      CodAgrup: cuenta.cod_agrup ?? '',
      NumCta: cuenta.num_cta,
      Desc: cuenta.descripcion,
      Nivel: String(cuenta.nivel),
      Natur: cuenta.naturaleza ?? '',
    };
    if (cuenta.sub_cta_de) {
      atributos.SubCtaDe = cuenta.sub_cta_de;
    }
    raiz.ele('catalogocuentas:Ctas', atributos).up();
  }

  return raiz.end({ prettyPrint: true });
}
