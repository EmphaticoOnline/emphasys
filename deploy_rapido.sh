try {
  $ErrorActionPreference = "Stop"

  # =============================
  # Variables
  # =============================
  $server = "ubuntu@api.emphasys.cloud"
  $remotePath = "/var/www/emphasys-backend"
  $backendLocal = "backend"
  $frontendLocal = "frontend"
  $frontendDist = "$frontendLocal/dist"
  $pm2Config = "ecosystem.config.js"
  $sshOpts = "-o BatchMode=yes"

  # =============================
  # Build frontend
  # =============================
  Write-Host "Building frontend..."
  Set-Location $frontendLocal
  npm ci --prefer-offline
  npm run build
  Set-Location ..

  # =============================
  # Build backend
  # =============================
  Write-Host "Building backend..."
  Set-Location $backendLocal
  npm ci --prefer-offline
  npm run build
  Set-Location ..

  # =============================
  # Preparar servidor
  # =============================
  Write-Host "Preparando servidor..."
  ssh $sshOpts $server "mkdir -p $remotePath/dist $remotePath/frontend-dist"

  if ($LASTEXITCODE -ne 0) { throw "Error preparando servidor" }

  # =============================
  # Deploy backend (rsync incremental)
  # =============================
  Write-Host "Deploy backend (rsync)..."
  rsync -avz --delete --size-only "$backendLocal/dist/" "${server}:${remotePath}/dist/"

  if ($LASTEXITCODE -ne 0) { throw "Error en rsync backend" }

  # =============================
  # Deploy frontend (rsync incremental)
  # =============================
  Write-Host "Deploy frontend (rsync)..."
  rsync -avz --delete --size-only "$frontendDist/" "${server}:${remotePath}/frontend-dist/"

  if ($LASTEXITCODE -ne 0) { throw "Error en rsync frontend" }

  # =============================
  # Archivos clave backend
  # =============================
  Write-Host "Copiando archivos clave..."

  rsync -avz "$backendLocal/package.json" "${server}:${remotePath}/"
  rsync -avz "$backendLocal/package-lock.json" "${server}:${remotePath}/"

  if (Test-Path "$backendLocal/.env") {
    rsync -avz "$backendLocal/.env" "${server}:${remotePath}/.env"
  }

  rsync -avz $pm2Config "${server}:${remotePath}/"

  # =============================
  # Instalar dependencias (solo si es necesario)
  # =============================
  Write-Host "Instalando dependencias y reiniciando PM2..."

  ssh $sshOpts $server "
    cd $remotePath;

    if [ -f package-lock.json ]; then
      npm ci --omit=dev;
    fi;

    pm2 startOrReload ecosystem.config.js --env production;
    pm2 save;
  "

  if ($LASTEXITCODE -ne 0) { throw "Error en servidor" }

  Write-Host "🚀 Deploy finalizado correctamente."
  exit 0

} catch {
  $errMsg = ($_ | Out-String).Trim()
  Write-Error -Message $errMsg
  exit 1
}