import { create } from 'xmlbuilder2';
import type { CuentaAuxiliar } from './auxiliarCuentasXml.repository';
import type { TipoSolicitudPolizas } from './tipoSolicitudSat';

// Estructura verificada contra el XSD oficial vigente del SAT (Anexo 24,
// Contabilidad Electrónica, "Auxiliar de cuentas y/o subcuentas" versión
// 1.3): http://omawww.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarCtas/AuxiliarCtas_1_3.xsd
//
// Nodo raíz "AuxiliarCtas": Version (fijo "1.3"), RFC, Mes, Anio,
// TipoSolicitud (AF|FC|DE|CO), NumOrden/NumTramite (misma regla condicional
// que PolizasPeriodo/AuxiliarFolios).
//
// Nodo "Cuenta" (1..n): NumCta (1-100), DesCta (1-100), SaldoIni
// (t_importe), SaldoFin (t_importe). SIN nodo de CFDI/UUID -- ese es el
// Auxiliar de folios, no este.
//
// Nodo "DetalleAux" (1..n, hijo de Cuenta): Fecha (date), NumUnIdenPol
// (1-50), Concepto (1-200), Debe (t_importe), Haber (t_importe).
const NAMESPACE = 'http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarCtas';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = `${NAMESPACE} ${NAMESPACE}/AuxiliarCtas_1_3.xsd`;

function formatearImporte(valor: number): string {
  return valor.toFixed(2);
}

export function construirAuxiliarCuentasXmlString(params: {
  rfc: string;
  ejercicio: number;
  periodo: number;
  tipoSolicitud: TipoSolicitudPolizas;
  numOrden: string | null;
  numTramite: string | null;
  cuentas: CuentaAuxiliar[];
}): string {
  const { rfc, ejercicio, periodo, tipoSolicitud, numOrden, numTramite, cuentas } = params;

  const atributosRaiz: Record<string, string> = {
    'xmlns:auxiliarctas': NAMESPACE,
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

  const raiz = create({ version: '1.0', encoding: 'UTF-8' }).ele('auxiliarctas:AuxiliarCtas', atributosRaiz);

  // Solo cuentas sin errores (naturaleza resoluble) entran al XML; una
  // cuenta con error ya bloquea la descarga completa (ok=false), así que
  // en la práctica este filtro solo importa para no fallar si se llamara
  // el builder directamente sobre un resultado con errores.
  for (const cuenta of cuentas.filter((c) => c.estado === 'correcto')) {
    const nodoCuenta = raiz.ele('auxiliarctas:Cuenta', {
      NumCta: cuenta.num_cta,
      DesCta: cuenta.descripcion,
      SaldoIni: formatearImporte(cuenta.saldo_ini),
      SaldoFin: formatearImporte(cuenta.saldo_fin),
    });

    for (const det of cuenta.detalle) {
      nodoCuenta
        .ele('auxiliarctas:DetalleAux', {
          Fecha: det.fecha,
          NumUnIdenPol: det.poliza,
          Concepto: det.concepto ?? '',
          Debe: formatearImporte(det.debe),
          Haber: formatearImporte(det.haber),
        })
        .up();
    }

    nodoCuenta.up();
  }

  return raiz.end({ prettyPrint: true });
}
