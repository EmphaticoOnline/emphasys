try {
  $ErrorActionPreference = "Stop"

  # Variables
  $server = "ubuntu@api.emphasys.cloud"
  $remotePath = "/var/www/emphasys-backend"
  $backendLocal = "backend"
  $frontendLocal = "frontend"
  $frontendDist = "$frontendLocal/dist"
  $pm2Config = "ecosystem.config.js"
  $sshOpts = "-o BatchMode=yes"
  $scpOpts = "-o BatchMode=yes"

  # =============================
  # Build frontend
  # =============================
  Write-Host "Building frontend..."
  Set-Location $frontendLocal
  npm install
  npm run build
  Set-Location ..

  # =============================
  # Build backend
  # =============================
  Write-Host "Building backend..."
  Set-Location $backendLocal
  npm install
  npm run build
  Set-Location ..

  # =============================
  # Preparar servidor
  # =============================
  Write-Host "Preparando servidor..."
  ssh $sshOpts $server "mkdir -p $remotePath $remotePath/dist $remotePath/frontend-dist"
  if ($LASTEXITCODE -ne 0) { throw "Error creando carpetas remotas" }

  # Limpiar backend dist remoto
  ssh $sshOpts $server "rm -rf $remotePath/dist/*"
  if ($LASTEXITCODE -ne 0) { throw "Error limpiando dist remoto" }

  # Limpiar frontend dist remoto
  ssh $sshOpts $server "rm -rf $remotePath/frontend-dist/*"
  if ($LASTEXITCODE -ne 0) { throw "Error limpiando frontend-dist remoto" }

  # =============================
  # Copiar backend (solo contenido dist)
  # =============================
  Write-Host "Copiando backend dist..."
  scp $scpOpts -r "$backendLocal/dist/*" "${server}:${remotePath}/dist/"
  if ($LASTEXITCODE -ne 0) { throw "Error copiando backend/dist" }

  # =============================
  # Copiar frontend (solo contenido dist)
  # =============================
  Write-Host "Copiando frontend dist..."
  scp $scpOpts -r "$frontendDist/*" "${server}:${remotePath}/frontend-dist/"
  if ($LASTEXITCODE -ne 0) { throw "Error copiando frontend-dist" }

  # =============================
  # Copiar archivos adicionales
  # =============================
  Write-Host "Copiando package.json y lock..."
  scp $scpOpts "$backendLocal/package.json" "$backendLocal/package-lock.json" "${server}:${remotePath}/"
  if ($LASTEXITCODE -ne 0) { throw "Error copiando package.json o package-lock" }

  if (Test-Path "$backendLocal/.env") {
    Write-Host "Copiando .env..."
    scp $scpOpts "$backendLocal/.env" "${server}:${remotePath}/.env"
    if ($LASTEXITCODE -ne 0) { throw "Error copiando .env" }
  }

  Write-Host "Copiando ecosystem.config.js..."
  scp $scpOpts $pm2Config "${server}:${remotePath}/"
  if ($LASTEXITCODE -ne 0) { throw "Error copiando ecosystem.config.js" }

  # =============================
  # Instalar dependencias y reiniciar PM2
  # =============================
  Write-Host "Instalando dependencias y reiniciando PM2..."
  ssh $sshOpts $server "
    cd $remotePath;
    npm install --omit=dev;
    pm2 delete emphasys-api >/dev/null 2>&1;
    pm2 startOrReload ecosystem.config.js --env production
  "
  if ($LASTEXITCODE -ne 0) { throw "Error en comandos remotos de backend/PM2" }

  Write-Host "Deploy finalizado correctamente."
  exit 0

} catch {
  $errMsg = ($_ | Out-String).Trim()
  Write-Error -Message $errMsg
  exit 1
}