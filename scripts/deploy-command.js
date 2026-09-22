const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

// No shell locally. Deadlines also apply when a child never closes its output pipes.
function run(command, args, options = {}) {
  const {
    stage = path.basename(command), timeoutMs = 120000, heartbeatMs = 30000,
    capture = false, ...spawnOptions
  } = options;
  const started = Date.now();
  console.log(`==> INICIO: ${stage} (límite ${timeoutMs / 1000}s)`);
  return new Promise((resolve, reject) => {
    let child;
    let deadline;
    let heartbeat;
    let settled = false;
    let timedOut;
    let output = '';
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearInterval(heartbeat);
      child?.stdout?.destroy();
      if (error) {
        console.error(`==> ERROR: ${stage}: ${error.message}`);
        reject(error);
      } else {
        console.log(`==> FIN: ${stage} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
        resolve(output);
      }
    }
    try {
      child = spawn(command, args, {
        ...spawnOptions,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
      });
    } catch (error) { finish(error); return; }
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => finish(timedOut || error));
    child.on('close', (code, signal) => {
      if (timedOut) { finish(timedOut); return; }
      if (code === 0) { finish(); return; }
      const error = new Error(`${stage}: ${signal ? `señal ${signal}` : `código ${code}`}`);
      error.exitCode = code ?? (128 + (os.constants.signals[signal] || 1));
      finish(error);
    });
    heartbeat = setInterval(() => {
      console.log(`==> EN CURSO: ${stage} (${Math.floor((Date.now() - started) / 1000)}s)`);
    }, heartbeatMs);
    deadline = setTimeout(() => {
      timedOut = new Error(`Timeout en ${stage} después de ${timeoutMs / 1000}s; terminando proceso.`);
      timedOut.exitCode = 124;
      console.error(timedOut.message);
      if (process.platform === 'win32' && child.pid) {
        // Terminate the whole tree (npm/scp can start their own children).
        const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
          ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        const killDeadline = setTimeout(() => {
          killer.kill('SIGKILL');
          child.kill('SIGKILL');
          finish(timedOut);
        }, 5000);
        const killed = () => {
          clearTimeout(killDeadline);
          child.kill('SIGKILL');
          finish(timedOut);
        };
        killer.once('error', killed);
        killer.once('close', killed);
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        finish(timedOut);
      }
    }, timeoutMs);
  });
}

module.exports = { run };
