try {
  $ErrorActionPreference = "Stop"

  # Variables
  $server = "ubuntu@api.emphasys.cloud"
  $remotePath = "/var/www/emphasys-backend"
  $backendLocal = "backend"
  $frontendLocal = "frontend"
  $pm2Config = "ecosystem.config.js"
  $sshOpts = @(
    "-o","BatchMode=yes",
    "-o","StrictHostKeyChecking=accept-new",
    "-o","ConnectTimeout=10",
    "-o","ServerAliveInterval=5",
    "-o","ServerAliveCountMax=2"
  )
  $sshOptsString = ($sshOpts -join ' ')
  $skipFrontend = if ($env:SKIP_FRONTEND) { $env:SKIP_FRONTEND } else { "false" }
  $skipLocalInstall = if ($env:SKIP_LOCAL_INSTALL) { $env:SKIP_LOCAL_INSTALL } else { "false" }
  $skipRemoteInstall = if ($env:SKIP_REMOTE_INSTALL) { $env:SKIP_REMOTE_INSTALL } else { "false" }
  $skipHostKeyCheck = $env:SKIP_HOSTKEY_SCAN -eq "true"

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

  function ToPosixPath($path) {
    return ($path -replace '\\','/')
  }

  function Ensure-KnownHost {
    param([string] $TargetHost)
    if ($skipHostKeyCheck) { return }

  $sshKeyscan = Get-Command ssh-keyscan -ErrorAction SilentlyContinue
    if (-not $sshKeyscan) {
      Write-Warning "ssh-keyscan no está disponible; asegúrate de haber aceptado manualmente la clave de host para $Host"
      return
    }

    $sshDir = Join-Path $HOME ".ssh"
    if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir | Out-Null }

    $knownHosts = Join-Path $sshDir "known_hosts"
    $already = $false
    if (Test-Path $knownHosts) {
      $already = Select-String -Path $knownHosts -Pattern "^$TargetHost[ ,]" -Quiet -ErrorAction SilentlyContinue
    }

    if (-not $already) {
      Write-Host "Agregando host key de $TargetHost a known_hosts..."
      ssh-keyscan -T 5 -t rsa,ecdsa,ed25519 -H $TargetHost 2>$null | Out-File -FilePath $knownHosts -Append -Encoding ascii
    }
  }

  function Invoke-SSH {
    param(
      [string] $Command,
      [string] $Label = "ssh"
    )

    & ssh @sshOpts $server $Command
    if ($LASTEXITCODE -ne 0) {
      throw "SSH falló ($Label) con código $LASTEXITCODE"
    }
  }

  $disableWslRsync = $env:DISABLE_WSL_RSYNC -eq "true"
  $forceTarFallback = $env:FORCE_TAR_FALLBACK -eq "true"

  $usingWslRsync = $false
  $usingRsync = -not $forceTarFallback

  if ($usingRsync -and -not (Get-Command rsync -ErrorAction SilentlyContinue)) {
    if (-not $disableWslRsync -and (Get-Command wsl -ErrorAction SilentlyContinue)) {
      wsl sh -c "command -v rsync >/dev/null 2>&1"
      if ($LASTEXITCODE -eq 0) {
        $usingWslRsync = $true
      } else {
        Write-Warning "rsync no está instalado en Windows ni en WSL. Usaré fallback tar+scp (más lento). Considera 'choco install rsync' o 'wsl sudo apt install rsync'."
        $usingRsync = $false
      }
    } else {
      if ($disableWslRsync) {
        Write-Warning "DISABLE_WSL_RSYNC=true: saltando uso de rsync desde WSL."
      } else {
        Write-Warning "rsync no está instalado o no está en PATH. Usaré fallback tar+scp (más lento). Considera 'choco install rsync'."
      }
      $usingRsync = $false
    }
  }

  $serverHost = if ($server -match '@') { $server.Split('@')[1] } else { $server }
  Ensure-KnownHost -TargetHost $serverHost

  function Resolve-RsyncPath($path) {
    $resolved = (Resolve-Path $path).Path
    if ($usingWslRsync) {
      try {
        # Escapar backslashes para que bash no los consuma
        $escaped = $resolved -replace '\\','\\\\'
        $wslPath = wsl wslpath -a "$escaped" 2>$null
        if ([string]::IsNullOrWhiteSpace($wslPath)) {
          throw "wslpath devolvió vacío"
        }
        return $wslPath.Trim()
      } catch {
        Write-Warning "No pude convertir ruta con wslpath (¿WSL/systemd caído?). Usaré fallback sin rsync. Detalle: $($_.Exception.Message)"
        $script:usingWslRsync = $false
        $script:usingRsync = $false
        return ToPosixPath($resolved)
      }
    }
    return ToPosixPath($resolved)
  }

  function Invoke-Rsync {
    param(
      [string[]] $Args
    )
    if ($usingWslRsync) {
      & wsl rsync @Args
    } else {
      & rsync @Args
    }
  }

  function Try-RsyncOrFallback {
    param(
      [string] $Label,
      [scriptblock] $RsyncBlock,
      [scriptblock] $FallbackBlock
    )

    if (-not $usingRsync) {
      & $FallbackBlock
      return
    }

    try {
      & $RsyncBlock
      if ($LASTEXITCODE -ne 0) { throw "rsync exit code $LASTEXITCODE" }
    } catch {
      Write-Warning "${Label}: rsync falló (${($_.Exception.Message)}). Cambiando a tar/scp fallback."
      & $FallbackBlock
    }
  }

  function Send-TarAndExtract {
    param(
      [string] $SourceDir,
      [string] $RemoteTarget,
      [string] $Label
    )

    $tempTar = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "deploy-$Label.tar")
    if (Test-Path $tempTar) { Remove-Item $tempTar -Force }

    Write-Host "Empaquetando $Label en tar (fallback sin rsync)..."
    tar -cf $tempTar -C $SourceDir .

    $remoteTar = "$remotePath/$Label.tar"
    Write-Host "Subiendo $Label.tar..."
  scp @sshOpts $tempTar "${server}:$remoteTar"

    Write-Host "Extrayendo $Label.tar en remoto..."
  Invoke-SSH -Command "mkdir -p $RemoteTarget; rm -rf ${RemoteTarget}/*; tar -xf $remoteTar -C $RemoteTarget; rm -f $remoteTar" -Label "untar-$Label"

    Remove-Item $tempTar -Force
  }

  # =============================
  # Build frontend
  # =============================
  if ($skipFrontend -ne "true") {
    Write-Host "Building frontend..."
    Push-Location $frontendLocal
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
    Pop-Location
  } else {
    Write-Host "Skipping frontend build (SKIP_FRONTEND=true)..."
  }

  # =============================
  # Build backend
  # =============================
  Write-Host "Building backend..."
  Push-Location $backendLocal
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
  Pop-Location

  if ($usingRsync) {
    $backendDist = Resolve-RsyncPath "$backendLocal/dist"
    $frontendDist = Resolve-RsyncPath "$frontendLocal/dist"
    $pm2ConfigPath = Resolve-RsyncPath $pm2Config
    $backendPkg = Resolve-RsyncPath "$backendLocal/package.json"
    $backendLockRsync = Resolve-RsyncPath "$backendLocal/package-lock.json"
  } else {
    $backendDist = (Resolve-Path "$backendLocal/dist").Path
    $frontendDist = (Resolve-Path "$frontendLocal/dist").Path
    $pm2ConfigPath = (Resolve-Path $pm2Config).Path
    $backendPkg = (Resolve-Path "$backendLocal/package.json").Path
  }
  $backendLockLocal = (Resolve-Path "$backendLocal/package-lock.json").Path

  # =============================
  # Preparar servidor
  # =============================
  Write-Host "Preparando servidor..."
  Invoke-SSH -Command "mkdir -p $remotePath $remotePath/dist $remotePath/frontend-dist" -Label "prepare"

  # =============================
  # Rsync backend dist (con fallback)
  # =============================
  Write-Host "Sincronizando backend dist..."
  Try-RsyncOrFallback -Label "backend-dist" -RsyncBlock {
    Invoke-Rsync -az --delete -e "ssh $sshOptsString" "$backendDist/" "${server}:$remotePath/dist/"
  } -FallbackBlock {
    Send-TarAndExtract -SourceDir $backendDist -RemoteTarget "$remotePath/dist" -Label "backend-dist"
  }

  # =============================
  # Rsync frontend dist (con fallback)
  # =============================
  Write-Host "Sincronizando frontend dist..."
  Try-RsyncOrFallback -Label "frontend-dist" -RsyncBlock {
    Invoke-Rsync -az --delete -e "ssh $sshOptsString" "$frontendDist/" "${server}:$remotePath/frontend-dist/"
  } -FallbackBlock {
    Send-TarAndExtract -SourceDir $frontendDist -RemoteTarget "$remotePath/frontend-dist" -Label "frontend-dist"
  }

  # =============================
  # Rsync archivos adicionales (con fallback)
  # =============================
  Write-Host "Sincronizando package.json y lock..."
  Try-RsyncOrFallback -Label "pkg-lock" -RsyncBlock {
    Invoke-Rsync -az -e "ssh $sshOptsString" "$backendPkg" "$backendLockRsync" "${server}:$remotePath/"
  } -FallbackBlock {
    scp @sshOpts "$backendPkg" "${server}:$remotePath/package.json"
    scp @sshOpts "$backendLockLocal" "${server}:$remotePath/package-lock.json"
  }

  if (Test-Path "$backendLocal/.env") {
    Write-Host "Sincronizando .env..."
    Try-RsyncOrFallback -Label "env" -RsyncBlock {
      $envPath = Resolve-RsyncPath "$backendLocal/.env"
      Invoke-Rsync -az -e "ssh $sshOptsString" "$envPath" "${server}:$remotePath/.env"
    } -FallbackBlock {
      $envPathLocal = (Resolve-Path "$backendLocal/.env").Path
      scp @sshOpts "$envPathLocal" "${server}:$remotePath/.env"
    }
  }

  Write-Host "Sincronizando ecosystem.config.js..."
  Try-RsyncOrFallback -Label "ecosystem" -RsyncBlock {
    Invoke-Rsync -az -e "ssh $sshOptsString" "$pm2ConfigPath" "${server}:$remotePath/"
  } -FallbackBlock {
    scp @sshOpts "$pm2ConfigPath" "${server}:$remotePath/"
  }

  # =============================
  # Instalar dependencias condicionalmente y reiniciar PM2
  # =============================
  Write-Host "Chequeando cambios de lockfile para decidir npm install..."
  $localLock = (Get-FileHash "$backendLockLocal" -Algorithm SHA256).Hash.ToLower()
  $remoteLock = ssh $sshOpts $server "cd $remotePath; sha256sum package-lock.json 2>/dev/null | awk '{print $1}'" 2>$null

  $installNeeded = $true
  if ($skipRemoteInstall -eq "true") {
    Write-Host "Skipping remote npm install (SKIP_REMOTE_INSTALL=true)..."
    $installNeeded = $false
  } elseif ($remoteLock -and ($remoteLock.Trim().ToLower() -eq $localLock)) {
    Write-Host "Lockfile sin cambios: saltando npm install"
    $installNeeded = $false
  }

  if ($installNeeded) {
    Write-Host "Lockfile cambió o no existe: npm install --omit=dev"
    Invoke-SSH -Command "cd $remotePath; npm install --omit=dev" -Label "npm install"
  }

  Write-Host "Reiniciando PM2..."
  Invoke-SSH -Command "cd $remotePath; pm2 delete emphasys-api >/dev/null 2>&1; pm2 startOrReload ecosystem.config.js --env production" -Label "pm2"

  Write-Host "Deploy rsync finalizado correctamente."
  exit 0

} catch {
  $errMsg = ($_ | Out-String).Trim()
  Write-Error -Message $errMsg
  exit 1
}
