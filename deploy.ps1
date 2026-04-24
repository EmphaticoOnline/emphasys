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
  $skipFrontend = if ($env:SKIP_FRONTEND) { $env:SKIP_FRONTEND } else { "false" }
  $skipLocalInstall = if ($env:SKIP_LOCAL_INSTALL) { $env:SKIP_LOCAL_INSTALL } else { "false" }
  $skipRemoteInstall = if ($env:SKIP_REMOTE_INSTALL) { $env:SKIP_REMOTE_INSTALL } else { "false" }

  function Get-HashLower {
    param([string] $Path)
    return (Get-FileHash $Path -Algorithm SHA256).Hash.ToLower()
  }

  function Get-LocalCachePath {
    param([string] $NodeModulesPath)
    return (Join-Path $NodeModulesPath ".deploy-lock.sha")
  }

  function Test-LocalInstallNeeded {
    param(
      [string] $LockPath,
      [string] $NodeModulesPath
    )

    if (-not (Test-Path $NodeModulesPath)) { return $true }

    $cacheFile = Get-LocalCachePath -NodeModulesPath $NodeModulesPath
    if (-not (Test-Path $cacheFile)) { return $true }

    $cached = (Get-Content $cacheFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $cached) { return $true }

    $currentHash = Get-HashLower -Path $LockPath
    return ($cached.Trim().ToLower() -ne $currentHash)
  }

  function Save-LocalCache {
    param(
      [string] $LockPath,
      [string] $NodeModulesPath
    )

    if (-not (Test-Path $NodeModulesPath)) { return }
    $cacheFile = Get-LocalCachePath -NodeModulesPath $NodeModulesPath
    $hash = Get-HashLower -Path $LockPath
    Set-Content -Path $cacheFile -Value $hash -Encoding ascii
  }

  # =============================
  # Build frontend
  # =============================
  if ($skipFrontend -ne "true") {
    Write-Host "Building frontend..."
    Set-Location $frontendLocal
    $frontendLock = (Resolve-Path "package-lock.json").Path
    $frontendNodeModules = (Resolve-Path "node_modules" -ErrorAction SilentlyContinue)
    $frontendNodeModulesPath = if ($frontendNodeModules) { $frontendNodeModules.Path } else { "node_modules" }
    $frontendNeedsInstall = $true

    if ($skipLocalInstall -eq "true") {
      Write-Host "Skipping frontend npm install (SKIP_LOCAL_INSTALL=true)..."
      $frontendNeedsInstall = $false
  } elseif (-not (Test-LocalInstallNeeded -LockPath $frontendLock -NodeModulesPath $frontendNodeModulesPath)) {
      Write-Host "Frontend lockfile sin cambios: saltando npm install"
      $frontendNeedsInstall = $false
    }

    if ($frontendNeedsInstall) {
      npm install
      Save-LocalCache -LockPath $frontendLock -NodeModulesPath $frontendNodeModulesPath
    }
    npm run build
    Set-Location ..
  } else {
    Write-Host "Skipping frontend build (SKIP_FRONTEND=true)..."
  }

  # =============================
  # Build backend
  # =============================
  Write-Host "Building backend..."
  Set-Location $backendLocal
  $backendLock = (Resolve-Path "package-lock.json").Path
  $backendNodeModules = (Resolve-Path "node_modules" -ErrorAction SilentlyContinue)
  $backendNodeModulesPath = if ($backendNodeModules) { $backendNodeModules.Path } else { "node_modules" }
  $backendNeedsInstall = $true

  if ($skipLocalInstall -eq "true") {
    Write-Host "Skipping backend npm install (SKIP_LOCAL_INSTALL=true)..."
    $backendNeedsInstall = $false
  } elseif (-not (Test-LocalInstallNeeded -LockPath $backendLock -NodeModulesPath $backendNodeModulesPath)) {
    Write-Host "Backend lockfile sin cambios: saltando npm install"
    $backendNeedsInstall = $false
  }

  if ($backendNeedsInstall) {
    npm install
    Save-LocalCache -LockPath $backendLock -NodeModulesPath $backendNodeModulesPath
  }
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
  $backendLockLocal = (Resolve-Path "$backendLocal/package-lock.json").Path
  $localLock = Get-HashLower -Path $backendLockLocal
  $remoteLock = ssh $sshOpts $server "cd $remotePath; sha256sum package-lock.json 2>/dev/null | awk '{print $1}'" 2>$null

  $installNeeded = $true
  if ($skipRemoteInstall -eq "true") {
    Write-Host "Skipping remote npm install (SKIP_REMOTE_INSTALL=true)..."
    $installNeeded = $false
  } elseif ($remoteLock -and ($remoteLock.Trim().ToLower() -eq $localLock)) {
    Write-Host "Lockfile sin cambios: saltando npm install remoto"
    $installNeeded = $false
  }

  if ($installNeeded) {
    ssh $sshOpts $server "cd $remotePath; npm install --omit=dev"
    if ($LASTEXITCODE -ne 0) { throw "Error en npm install remoto" }
  }

  ssh $sshOpts $server "
    cd $remotePath;
    pm2 delete emphasys-api >/dev/null 2>&1;
    pm2 startOrReload ecosystem.config.js --env production
  "
  if ($LASTEXITCODE -ne 0) { throw "Error en comandos remotos de PM2" }

  Write-Host "Deploy finalizado correctamente."
  exit 0

} catch {
  $errMsg = ($_ | Out-String).Trim()
  Write-Error -Message $errMsg
  exit 1
}