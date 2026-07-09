import { create } from 'xmlbuilder2';
import type { PolizaXml, TipoSolicitudPolizas } from './polizasPeriodoXml.repository';

// Estructura verificada contra el XSD oficial vigente del SAT (Anexo 24,
// Contabilidad Electrónica, "Pólizas del periodo" versión 1.3):
//   http://omawww.sat.gob.mx/esquemas/ContabilidadE/1_3/PolizasPeriodo/PolizasPeriodo_1_3.xsd
//
// Nodo raíz "Polizas": Version (fijo "1.3"), RFC (12-13, requerido),
// Mes (cadena "01".."12"), Anio (entero 2015-2099), TipoSolicitud (patrón
// "AF|FC|DE|CO"), NumOrden (13 caracteres, patrón "[A-Z]{3}[0-9]{7}/[0-9]{2}",
// requerido solo si TipoSolicitud es AF o FC), NumTramite (14 caracteres,
// patrón "[A-Z]{2}[0-9]{12}", requerido solo si TipoSolicitud es DE o CO).
// Sello/noCertificado/Certificado son opcionales (firma digital) y no se
// generan en esta fase.
//
// Nodo "Poliza" (por póliza): NumUnIdenPol (1-50), Fecha (date), Concepto
// (1-300).
//
// Nodo "Transaccion" (por movimiento, hijo de Poliza): NumCta (1-100),
// DesCta (1-100), Concepto (1-200), Debe (t_Importe), Haber (t_Importe).
//
// Nodo "CompNal" (hijo de Transaccion, solo cuando hay CFDI nacional con
// UUID encontrado en core.cfdi_sat_comprobantes): UUID_CFDI (36, patrón
// UUID estándar), RFC (12-13, del tercero relacionado), MontoTotal
// (t_Importe, requerido), Moneda (catálogo SAT, opcional), TipCamb
// (requerido solo si Moneda != MXN — Emphasys no captura tipo de cambio
// hoy, por eso el repository NUNCA arma este nodo cuando la moneda es
// distinta de MXN, para no generar un nodo inválido según el XSD).
//
// CompNalOtr, CompExt, Cheque, Transferencia, OtrMetodoPago: EXISTEN en el
// XSD pero NO se implementan en esta fase (ver comentario de alcance en
// polizasPeriodoXml.repository.ts): Emphasys no captura CFD/CBB pre-2014
// (CompNalOtr), comprobantes extranjeros sin CFDI (CompExt), ni datos de
// cheques/transferencias/otros métodos de pago a nivel de movimiento.
const NAMESPACE = 'http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/PolizasPeriodo';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = `${NAMESPACE} ${NAMESPACE}/PolizasPeriodo_1_3.xsd`;

function formatearImporte(valor: number): string {
  return valor.toFixed(2);
}

export function construirPolizasPeriodoXmlString(params: {
  rfc: string;
  ejercicio: number;
  periodo: number;
  tipoSolicitud: TipoSolicitudPolizas;
  numOrden: string | null;
  numTramite: string | null;
  polizas: PolizaXml[];
}): string {
  const { rfc, ejercicio, periodo, tipoSolicitud, numOrden, numTramite, polizas } = params;

  const atributosRaiz: Record<string, string> = {
    'xmlns:polizasperiodo': NAMESPACE,
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

  const raiz = create({ version: '1.0', encoding: 'UTF-8' }).ele('polizasperiodo:Polizas', atributosRaiz);

  for (const poliza of polizas) {
    const nodoPoliza = raiz.ele('polizasperiodo:Poliza', {
      NumUnIdenPol: poliza.num_un_iden_pol,
      Fecha: poliza.fecha,
      Concepto: poliza.concepto,
    });

    for (const mov of poliza.movimientos) {
      const nodoTransaccion = nodoPoliza.ele('polizasperiodo:Transaccion', {
        NumCta: mov.cuenta ?? '',
        DesCta: mov.descripcion ?? '',
        Concepto: mov.concepto ?? '',
        Debe: formatearImporte(mov.debe),
        Haber: formatearImporte(mov.haber),
      });

      if (mov.incluir_comprobante && mov.uuid_cfdi && mov.rfc_comprobante && mov.monto_cfdi != null) {
        const atributosCompNal: Record<string, string> = {
          UUID_CFDI: mov.uuid_cfdi,
          RFC: mov.rfc_comprobante,
          MontoTotal: formatearImporte(mov.monto_cfdi),
        };
        if (mov.moneda_cfdi) {
          atributosCompNal.Moneda = mov.moneda_cfdi;
        }
        nodoTransaccion.ele('polizasperiodo:CompNal', atributosCompNal).up();
      }

      nodoTransaccion.up();
    }

    nodoPoliza.up();
  }

  return raiz.end({ prettyPrint: true });
}
