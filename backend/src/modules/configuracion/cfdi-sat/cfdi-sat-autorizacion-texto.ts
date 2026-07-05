/**
 * Cambiar esta versión invalida las aceptaciones previas (obliga a re-aceptar),
 * ya que la consulta de autorización vigente filtra por empresa_id + version_texto.
 */
export const CFDI_SAT_AUTORIZACION_VERSION = 'v1';

export const CFDI_SAT_AUTORIZACION_TEXTO = `Al aceptar, autorizo a Emphasys ERP a utilizar la e.firma (FIEL) registrada por esta empresa exclusivamente para consultar y descargar, a través del Servicio de Descarga Masiva del SAT, los Comprobantes Fiscales Digitales por Internet (CFDI) emitidos y recibidos por esta empresa.

Emphasys no utilizará esta e.firma para ningún otro trámite ante el SAT ni ante ninguna otra autoridad, y no la compartirá con terceros. La contraseña de la e.firma no se almacena en ningún momento: se solicitará únicamente al momento de ejecutar cada consulta o descarga contra el SAT.

Esta autorización puede revocarse en cualquier momento eliminando las credenciales cargadas en esta pantalla.`;
