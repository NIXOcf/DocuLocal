# Levanta BD, back end y front de DocuLocal y abre el navegador.
# Uso: .\levantar.ps1          (normal)
#      .\levantar.ps1 -Seed    (carga usuarios y documentos de demo)
#      .\levantar.ps1 -Detener (apaga todo)
param([switch]$Seed, [switch]$Detener)
$ErrorActionPreference = 'Continue'  # docker escribe progreso por stderr
Set-Location $PSScriptRoot
$py = "backend\.venv\Scripts\python.exe"

if ($Detener) {
    foreach ($p in 5173, 8000) {
        Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
    docker compose stop db
    return
}

docker compose up -d db
Write-Host "Esperando la base de datos..."
for ($i = 0; $i -lt 30; $i++) {
    if ((docker inspect -f '{{.State.Health.Status}}' doculocal-db-1) -eq 'healthy') { break }
    Start-Sleep 2
}

if ($Seed) { & $py backend\scripts\seed.py }

Start-Process powershell -ArgumentList '-NoExit', '-Command', "& '$py' -m uvicorn app.main:app --app-dir backend --port 8000 --no-server-header"
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npm run dev'

for ($i = 0; $i -lt 30; $i++) {
    try { Invoke-WebRequest http://localhost:8000/api/v1/health -UseBasicParsing | Out-Null; break } catch { Start-Sleep 2 }
}
Start-Process http://localhost:5173
Write-Host "Listo: http://localhost:5173  (trabajador|jefe|gerente|admin@aguanube.cl / DocuLocal2026!)"
