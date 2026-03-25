## Despliegue

### Windows

1. Requisitos: PowerShell 5+, acceso SSH al servidor (`ubuntu@api.emphasys.cloud`).
2. Comando estándar (completo, copia todo):
	```powershell
	npm run deploy:win
	```
3. Comando rápido con sincronización incremental (usa rsync si está disponible, o tar+scp como fallback):
	```powershell
	npm run deploy:win:rsync
	```
	- Para mejor rendimiento instala rsync nativo (`choco install rsync`) o usa WSL con `sudo apt install rsync`.
	- Opcionales: `SKIP_FRONTEND=true`, `SKIP_LOCAL_INSTALL=true`, `SKIP_REMOTE_INSTALL=true` antes del comando.

### macOS / Linux / WSL

1. Requisitos: bash, rsync, SSH, Node.
2. Comando estándar (completo, copia todo):
	```bash
	npm run deploy
	```
3. Comando rápido incremental:
	```bash
	npm run deploy:rsync
	```
	- Requiere `rsync` instalado (`brew install rsync` o `sudo apt install rsync`).
	- Opcionales: `SKIP_FRONTEND=true`, `SKIP_LOCAL_INSTALL=true`, `SKIP_REMOTE_INSTALL=true` antes del comando.

### Notas
- Ambos flujos construyen frontend y backend localmente antes de subir artefactos.
- En el servidor se ejecuta `npm install --omit=dev` solo si cambia el `package-lock.json` (en los comandos *:rsync*).
- PM2 se recarga con `ecosystem.config.js` al final del deploy.
