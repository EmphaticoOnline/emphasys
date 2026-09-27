import assert from 'node:assert/strict';
import { normalizarErrorCfdi } from '../modules/cfdi/cfdi-error-normalizer';
import { CfdiPacConfigurationError } from '../modules/cfdi/cfdi-pac-config.resolver';
import { CfdiValidationError } from '../modules/cfdi/cfdi.service';

async function main() {
  const pacConfigError = normalizarErrorCfdi(new CfdiPacConfigurationError(8));
  assert.equal(pacConfigError.code, 'CFDI_PAC_CONFIG_MISSING');
  assert.equal(pacConfigError.message, 'La empresa no tiene una configuración PAC activa para timbrar CFDI.');
  assert.doesNotMatch(pacConfigError.message, /\d/, 'El mensaje público no debe exponer el empresa_id.');
  assert.doesNotMatch(pacConfigError.message, /configura facturama/i);

  const desconocido = normalizarErrorCfdi(new Error('Timeout de red al conectar con Facturama'));
  assert.equal(desconocido.code, 'CFDI_TIMBRADO_ERROR');
  assert.doesNotMatch(desconocido.message, /consulta los detalles/i);
  assert.match(desconocido.message, /Intenta nuevamente\.$/);

  const validacion = normalizarErrorCfdi(new CfdiValidationError('El RFC del receptor no es válido.'));
  assert.equal(validacion.code, 'CFDI_VALIDATION_ERROR');
  assert.match(validacion.message, /RFC del receptor/);

  console.log('OK: normalización de errores CFDI (config PAC ausente, fallback desconocido, validación Facturama).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
