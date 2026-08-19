## Deploy de producción

ERP + Compass:

```bash
npm run deploy
```

ERP:

```bash
npm run deploy:erp
```

Compass:

```bash
npm run deploy:compass
```

El backend siempre se construye y despliega. En un deploy individual, el frontend no seleccionado se conserva exactamente desde el release activo. Cada comando genera automáticamente un release aislado, lo activa mediante el cambio atómico de `current`, recarga PM2 con `startOrReload`, valida `/health` y restaura automáticamente el release anterior si falla PM2 o el health check.

No se deben usar `deploy.sh`, `deploy.ps1`, `deploy-rsync.ps1`, `deploy_rapido.sh`, `scripts/deploy.js` ni los comandos npm con prefijo `legacy:` para producción. Son flujos antiguos que pueden escribir sobre rutas activas o provocar downtime.
