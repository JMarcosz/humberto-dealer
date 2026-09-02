<#
.SYNOPSIS
    Script DevOps todo-en-uno para Humberto Dealer.
.DESCRIPTION
    1. Verifica que Docker Desktop este en ejecucion.
    2. Crea y completa automaticamente el archivo .env con claves secretas y contrasenas criptograficas.
    3. Construye y levanta los contenedores optimizados con Docker Compose.
    4. Espera a que MySQL este saludable y ejecuta la sincronizacion de hashes de usuarios (seed).
.EXAMPLE
    .\deploy.ps1                # Despliegue en modo produccion
    .\deploy.ps1 -Mode dev      # Modo desarrollo con hot-reloading
    .\deploy.ps1 -Down          # Detiene los contenedores
    .\deploy.ps1 -Logs          # Muestra logs en tiempo real
    .\deploy.ps1 -Seed          # Ejecuta el seed de usuarios en el contenedor
#>

[CmdletBinding()]
param (
    [ValidateSet("prod", "dev")]
    [string]$Mode = "prod",

    [switch]$Down,
    [switch]$Logs,
    [switch]$Seed,
    [switch]$Status
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         HUMBERTO DEALER - DEVOPS AUTOMATION              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# Funciones auxiliares de generacion criptografica
# -----------------------------------------------------------------------------
function New-CryptoHex([int]$numBytes = 32) {
    $buffer = New-Object byte[] $numBytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buffer)
    return [System.BitConverter]::ToString($buffer).Replace("-", "").ToLowerInvariant()
}

function New-CryptoPassword([int]$length = 24) {
    $validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $buffer = New-Object byte[] $length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buffer)
    $chars = foreach ($b in $buffer) {
        $validChars[$b % $validChars.Length]
    }
    return -join $chars
}

function Invoke-DatabaseSeed {
    Write-Host "[*] Verificando e importando datos seed en MySQL..." -ForegroundColor Yellow
    $rootPass = "dealer_root_password_456"
    $envFile = Join-Path $ProjectRoot ".env"
    if (Test-Path $envFile) {
        $envText = Get-Content $envFile -Raw
        if ($envText -match 'MYSQL_ROOT_PASSWORD=([^\r\n]+)') {
            $rootPass = $matches[1].Trim()
        }
    }

    Write-Host "  -> Verificando tablas en base de datos..." -ForegroundColor DarkGray
    $null = docker compose exec -T db mysql -u root -p"$rootPass" concesionaria -e "SELECT 1 FROM vehiculos LIMIT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  -> Creando tablas desde database/schema.sql..." -ForegroundColor DarkGray
        Get-Content (Join-Path $ProjectRoot "database\schema.sql") -Raw | docker compose exec -T db mysql -u root -p"$rootPass" concesionaria
    }

    $count = docker compose exec -T db mysql -u root -p"$rootPass" concesionaria -N -s -e "SELECT count(*) FROM vehiculos;" 2>$null
    if ([string]::IsNullOrWhiteSpace($count) -or $count.Trim() -eq "0") {
        Write-Host "  -> Cargando catalogo y usuarios (database/seed.sql)..." -ForegroundColor DarkGray
        Get-Content (Join-Path $ProjectRoot "database\seed.sql") -Raw | docker compose exec -T db mysql -u root -p"$rootPass" concesionaria
        Write-Host "[OK] Catalogo y datos iniciales cargados en MySQL." -ForegroundColor Green
    } else {
        Write-Host "[OK] La base de datos ya contiene $count vehiculos registrados." -ForegroundColor Green
    }

    Write-Host "  -> Sincronizando usuarios con bcrypt..." -ForegroundColor DarkGray
    try {
        docker compose exec backend python seed.py
        Write-Host "[OK] Seeders sincronizados al 100%." -ForegroundColor Green
    } catch {
        Write-Host "[WARN] No se pudo ejecutar seed.py en backend" -ForegroundColor Yellow
    }
}

# -----------------------------------------------------------------------------
# Manejo de flags especiales (-Down, -Logs, -Seed, -Status)
# -----------------------------------------------------------------------------
if ($Down) {
    Write-Host "[*] Deteniendo y removiendo contenedores..." -ForegroundColor Yellow
    docker compose down
    Write-Host "[OK] Contenedores detenidos." -ForegroundColor Green
    exit 0
}

if ($Logs) {
    docker compose logs -f
    exit 0
}

if ($Status) {
    docker compose ps
    exit 0
}

if ($Seed) {
    Invoke-DatabaseSeed
    exit 0
}

# -----------------------------------------------------------------------------
# 1. Verificar Docker Daemon
# -----------------------------------------------------------------------------
Write-Host "[1/5] Verificando Docker Engine..." -ForegroundColor Yellow
$dockerReady = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
    }
} catch {
    $dockerReady = $false
}

if (-not $dockerReady) {
    Write-Host ""
    Write-Host "[ERROR] El servicio de Docker no esta respondiendo." -ForegroundColor Red
    Write-Host "Por favor inicia Docker Desktop y vuelve a ejecutar este comando." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "[OK] Docker Engine esta activo." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. Generacion y configuracion de claves criptograficas en .env
# -----------------------------------------------------------------------------
Write-Host "[2/5] Verificando y configurando variables de entorno (.env)..." -ForegroundColor Yellow

$envPath = Join-Path $ProjectRoot ".env"
$envExamplePath = Join-Path $ProjectRoot ".env.docker.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-Host "  -> Creado archivo .env a partir de .env.docker.example" -ForegroundColor DarkGray
    } else {
        Write-Host "[ERROR] No se encontro .env.docker.example para crear .env" -ForegroundColor Red
        exit 1
    }
}

# Leer lineas actuales
$envContent = Get-Content $envPath -Raw -Encoding UTF8
$updated = $false

# Generar SECRET_KEY si es por defecto o vacio
if ($envContent -match 'SECRET_KEY=(cambiar_por_clave_secreta_super_segura_32_bytes_minimo|\s*$)' -or $envContent -match 'SECRET_KEY=\s*\r?\n') {
    $newSecretKey = New-CryptoHex 32
    $envContent = [System.Text.RegularExpressions.Regex]::Replace($envContent, 'SECRET_KEY=.*', "SECRET_KEY=$newSecretKey")
    $updated = $true
    Write-Host "  -> Generada nueva SECRET_KEY criptografica (64 chars hex)" -ForegroundColor Green
}

# Generar contrasena MySQL User si es por defecto
if ($envContent -match 'MYSQL_PASSWORD=(dealer_secure_password_123|\s*$)' -or $envContent -match 'MYSQL_PASSWORD=\s*\r?\n') {
    $newDbPass = New-CryptoPassword 24
    $envContent = [System.Text.RegularExpressions.Regex]::Replace($envContent, 'MYSQL_PASSWORD=.*', "MYSQL_PASSWORD=$newDbPass")
    $updated = $true
    Write-Host "  -> Generada contrasena segura para usuario MySQL" -ForegroundColor Green
}

# Generar contrasena MySQL Root si es por defecto
if ($envContent -match 'MYSQL_ROOT_PASSWORD=(dealer_root_password_456|\s*$)' -or $envContent -match 'MYSQL_ROOT_PASSWORD=\s*\r?\n') {
    $newRootPass = New-CryptoPassword 32
    $envContent = [System.Text.RegularExpressions.Regex]::Replace($envContent, 'MYSQL_ROOT_PASSWORD=.*', "MYSQL_ROOT_PASSWORD=$newRootPass")
    $updated = $true
    Write-Host "  -> Generada contrasena segura para root MySQL" -ForegroundColor Green
}

if ($updated) {
    [System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
    Write-Host "[OK] Archivo .env configurado con claves criptograficas unicas." -ForegroundColor Green
} else {
    Write-Host "[OK] Archivo .env ya contiene credenciales personalizadas." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Construir y Levantar Contenedores
# -----------------------------------------------------------------------------
Write-Host "[3/5] Construyendo y levantando contenedores (Modo: $Mode)..." -ForegroundColor Yellow

$composeArgs = @("compose")
if ($Mode -eq "dev") {
    $composeArgs += @("-f", "docker-compose.yml", "-f", "docker-compose.dev.yml")
}
$composeArgs += @("up", "-d", "--build")

& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo el comando docker compose up." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "[OK] Contenedores iniciados en segundo plano." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. Esperar que la Base de Datos este saludable y ejecutar Seed
# -----------------------------------------------------------------------------
Write-Host "[4/5] Esperando a que MySQL este listo e inicialice el esquema..." -ForegroundColor Yellow

$retries = 30
$healthy = $false
for ($i = 1; $i -le $retries; $i++) {
    $status = docker inspect --format="{{.State.Health.Status}}" humberto_db 2>$null
    if ($status -eq "healthy") {
        $healthy = $true
        break
    }
    Write-Host "  -> Esperando MySQL... ($i/$retries - estado: $status)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

if ($healthy) {
    Write-Host "[OK] MySQL esta saludable." -ForegroundColor Green
} else {
    Write-Host "[WARN] MySQL tardo en reportar estado saludable. Continuando con el seed..." -ForegroundColor Yellow
}

# Sincronizar catalogo y usuarios con bcrypt dentro de la base de datos
Write-Host "[5/5] Sincronizando catalogo y usuarios en base de datos..." -ForegroundColor Yellow
Invoke-DatabaseSeed

# -----------------------------------------------------------------------------
# Resumen Final y Enlaces
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "         DESPLIEGUE COMPLETADO EXITOSAMENTE!             " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Acceso a los servicios:" -ForegroundColor Cyan
Write-Host "  * Frontend:       http://localhost:3000" -ForegroundColor White
Write-Host "  * API Backend:    http://localhost:5001/api/health" -ForegroundColor White
Write-Host "  * API Proxy:      http://localhost:3000/api/catalogo/vehiculos" -ForegroundColor White
Write-Host "  * Base de datos:  localhost:3306 (concesionaria)" -ForegroundColor White
Write-Host ""
Write-Host "Credenciales de prueba del sistema:" -ForegroundColor Cyan
Write-Host "  * Admin:          admin@concesionaria.com / admin123" -ForegroundColor White
Write-Host "  * Cliente:        maria@email.com / user1234" -ForegroundColor White
Write-Host ""
Write-Host "Comandos de utilidad:" -ForegroundColor DarkGray
Write-Host "  .\deploy.ps1 -Logs    # Ver logs en vivo" -ForegroundColor DarkGray
Write-Host "  .\deploy.ps1 -Down    # Detener aplicacion" -ForegroundColor DarkGray
Write-Host "  .\deploy.ps1 -Status  # Ver estado de contenedores" -ForegroundColor DarkGray
Write-Host ""
