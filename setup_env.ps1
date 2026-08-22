# setup_env.ps1
# Self-contained environment setup script for Reply Desk (non-admin)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$workspaceDir = "d:\reviewc"
$cacheDir = Join-Path $workspaceDir ".cache"
$goDir = Join-Path $workspaceDir "go"
$pgsqlDir = Join-Path $workspaceDir "pgsql"
$pgdataDir = Join-Path $workspaceDir "pgdata"

# Create directories
if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir | Out-Null }

# Helper function to download files quickly using curl or Invoke-WebRequest
function Download-File {
    param (
        [string]$Url,
        [string]$OutPath
    )
    if (Test-Path $OutPath) {
        if ((Get-Item $OutPath).Length -gt 1000000) {
            Write-Host ">>> File $OutPath already downloaded." -ForegroundColor Yellow
            return
        }
        Remove-Item $OutPath -Force
    }

    Write-Host ">>> Downloading $Url to $OutPath..." -ForegroundColor Cyan
    
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        Write-Host ">>> Using curl.exe for high-speed download..." -ForegroundColor Gray
        & curl.exe -L -o $OutPath $Url
        if (Test-Path $OutPath) {
            Write-Host ">>> Download complete." -ForegroundColor Green
            return
        }
    }
    
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $Url -OutFile $OutPath
    Write-Host ">>> Download complete." -ForegroundColor Green
}

# Helper function to extract ZIP archives quickly using tar.exe or Expand-Archive
function Extract-Zip {
    param (
        [string]$ZipPath,
        [string]$DestParentDir
    )
    Write-Host ">>> Extracting $ZipPath to $DestParentDir..." -ForegroundColor Cyan
    
    if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
        Write-Host ">>> Using native tar.exe for high-speed extraction..." -ForegroundColor Gray
        if (-not (Test-Path $DestParentDir)) { New-Item -ItemType Directory -Path $DestParentDir | Out-Null }
        & tar.exe -xf $ZipPath -C $DestParentDir
        Write-Host ">>> Extraction complete." -ForegroundColor Green
        return
    }
    
    Write-Host ">>> Using Expand-Archive (fallback, slower)..." -ForegroundColor Gray
    Expand-Archive -Path $ZipPath -DestinationPath $DestParentDir
    Write-Host ">>> Extraction complete." -ForegroundColor Green
}

# 1. Download and extract Go
$goZipPath = Join-Path $cacheDir "go1.22.4.windows-amd64.zip"
$goUrl = "https://go.dev/dl/go1.22.4.windows-amd64.zip"
if (-not (Test-Path $goDir)) {
    Download-File -Url $goUrl -OutPath $goZipPath
    Extract-Zip -ZipPath $goZipPath -DestParentDir $workspaceDir
    Write-Host ">>> Go setup completed successfully." -ForegroundColor Green
} else {
    Write-Host ">>> Go is already installed." -ForegroundColor Yellow
}

# 2. Download and extract PostgreSQL
$pgZipPath = Join-Path $cacheDir "postgresql-16.3-1-windows-x64-binaries.zip"
$pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip"
if (-not (Test-Path $pgsqlDir)) {
    Download-File -Url $pgUrl -OutPath $pgZipPath
    Extract-Zip -ZipPath $pgZipPath -DestParentDir $workspaceDir
    Write-Host ">>> PostgreSQL extraction completed." -ForegroundColor Green
} else {
    Write-Host ">>> PostgreSQL is already extracted." -ForegroundColor Yellow
}

# 3. Initialize DB cluster
$initdbExe = Join-Path $pgsqlDir "bin\initdb.exe"
$pgctlExe = Join-Path $pgsqlDir "bin\pg_ctl.exe"
$createdbExe = Join-Path $pgsqlDir "bin\createdb.exe"
$psqlExe = Join-Path $pgsqlDir "bin\psql.exe"

if (-not (Test-Path $pgdataDir)) {
    Write-Host ">>> Initializing database cluster at $pgdataDir..." -ForegroundColor Cyan
    & $initdbExe -D $pgdataDir -U postgres --auth-local=trust --auth-host=trust
    
    # Configure postgresql.conf to listen on port 5433
    $confPath = Join-Path $pgdataDir "postgresql.conf"
    (Get-Content $confPath) -replace "#port = 5432", "port = 5433" | Set-Content $confPath
    Write-Host ">>> Database cluster initialized (port configured to 5433)." -ForegroundColor Green
} else {
    Write-Host ">>> Database cluster already initialized." -ForegroundColor Yellow
}

# 4. Start database server
$pgLog = Join-Path $pgdataDir "pg.log"
Write-Host ">>> Starting PostgreSQL on port 5433..." -ForegroundColor Cyan
& $pgctlExe -D $pgdataDir -l $pgLog -o "-p 5433" start

# Wait a few seconds for the database to start
Start-Sleep -Seconds 5

# 5. Create database
Write-Host ">>> Creating 'replydesk' database..." -ForegroundColor Cyan
try {
    # Check if database already exists
    $dbExists = & $psqlExe -U postgres -p 5433 -d template1 -tAc "SELECT 1 FROM pg_database WHERE datname='replydesk'"
    if ($dbExists -eq "1") {
        Write-Host ">>> Database 'replydesk' already exists." -ForegroundColor Yellow
    } else {
        & $createdbExe -U postgres -p 5433 replydesk
        Write-Host ">>> Database 'replydesk' created." -ForegroundColor Green
    }
} catch {
    Write-Host ">>> Failed to create database: $_" -ForegroundColor Red
}

Write-Host ">>> Setup completed! Go bin is at $goDir\bin, PostgreSQL port is 5433." -ForegroundColor Green
