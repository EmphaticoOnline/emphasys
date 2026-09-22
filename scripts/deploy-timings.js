const { performance } = require('node:perf_hooks');

function createTimings(now = () => performance.now(), output = console.log) {
  const started = now();
  const values = new Map();
  const active = new Map();
  const start = (name) => active.set(name, now());
  const stop = (name) => {
    if (!active.has(name)) return;
    values.set(name, (values.get(name) || 0) + now() - active.get(name));
    active.delete(name);
  };
  const measure = async (name, action) => {
    start(name);
    try { return await action(); } finally { stop(name); }
  };
  const seconds = (name) => values.has(name) ? `${(values.get(name) / 1000).toFixed(2)}s` : 'omitida/no ejecutada';
  const summary = () => {
    output('\nResumen de tiempos:');
    for (const directory of ['frontend', 'backend']) {
      output(`- Dependencias ${directory}: ${seconds(`Dependencias ${directory}`)} (validación: ${seconds(`Validación ${directory}`)}; instalación: ${seconds(`Instalación ${directory}`)})`);
      output(`- Build ${directory}: ${seconds(`Build ${directory}`)}`);
    }
    output(`- Transferencia: ${seconds('Transferencia')}`);
    output(`- Activación remota: ${seconds('Activación remota')}`);
    output(`- Total: ${((now() - started) / 1000).toFixed(2)}s`);
  };
  return { start, stop, measure, summary };
}

module.exports = { createTimings };
