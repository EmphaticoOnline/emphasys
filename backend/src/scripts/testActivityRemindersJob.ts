import assert from 'node:assert/strict';
import { ejecutarCicloSeguro } from '../crm/activity-reminders.job';

async function main() {
  const originalError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => { errors.push(args); };

  try {
    let attempts = 0;
    await ejecutarCicloSeguro(async () => {
      attempts += 1;
      throw new Error('fallo simulado');
    });

    assert.equal(attempts, 1, 'el ciclo debe ejecutarse aunque falle');
    assert.equal(errors.length, 1, 'el error debe registrarse exactamente una vez');
    assert.match(String(errors[0][0]), /activity-reminders/);
    assert.match(String(errors[0][1]), /fallo simulado/);

    errors.length = 0;
    await ejecutarCicloSeguro(async () => { attempts += 1; });

    assert.equal(attempts, 2, 'una ejecución posterior debe poder continuar');
    assert.equal(errors.length, 0, 'una ejecución exitosa posterior no debe registrar error');
  } finally {
    console.error = originalError;
  }

  console.log('OK: el job captura errores y continúa en ejecuciones posteriores.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
