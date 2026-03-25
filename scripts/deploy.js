const { execSync } = require('child_process');
const os = require('os');

try {
  console.log('🚀 Iniciando deploy...\n');

  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    console.log('🪟 Ejecutando en Windows...\n');
    execSync('powershell -ExecutionPolicy Bypass -File deploy.ps1', {
      stdio: 'inherit',
    });
  } else {
    console.log('🍎🐧 Ejecutando en Mac/Linux...\n');
    execSync('bash deploy_rapido.sh', {
      stdio: 'inherit',
    });
  }

  console.log('\n✅ Deploy terminado correctamente 🚀');

} catch (error) {
  console.error('\n❌ Error durante el deploy');
  console.error(error.message);
  process.exit(1);
}