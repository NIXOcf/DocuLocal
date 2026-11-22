# Benchmark del RAG con varios LLM locales (llama.cpp) y Groq como referencia.
# Uso (desde la raíz del repo):
#   powershell -ExecutionPolicy Bypass -File backend\scripts\benchmark\run_benchmark.ps1 -ConGroq
# Cada modelo: levanta llama-server (8081) -> back end en modo local (8001) -> eval_rag.py -> apaga ambos.
# Mide también RAM del proceso, VRAM y RAM de la BD (para los requisitos mínimos).
# Resultados: <etiqueta>.md por modelo, recursos.csv y COMPARATIVA.md. Si ya existe el .md de un modelo se omite (-Forzar lo repite).
param(
    [string]$LlamaDir = $(if ($env:LLAMA_CPP_DIR) { $env:LLAMA_CPP_DIR } else { "F:\peliculas\llama-b9518-bin-win-vulkan-x64" }),
    [string[]]$Modelos = @("granite-4.2-8b", "qwen3.5-9b", "gemma-4-e4b", "gpt-oss-20b", "gemma-4-12b", "gemma-4-26b-a4b", "qwen3.6-35b-a3b"),
    [switch]$ConGroq,
    [switch]$Forzar,
    [double]$Pausa = 6
)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Out = "$Root\backend\scripts\benchmark"
$Py = "$Root\backend\.venv\Scripts\python.exe"
$Base = "--ctx-size 8192 --n-gpu-layers 99 --flash-attn on --jinja --host 127.0.0.1 --port 8081"
$NoThink = '--chat-template-kwargs "{\"enable_thinking\":false}"'

# Flags validados en MODELOS_DOCULOCAL.md (carpeta de modelos).
$Catalogo = @{
    "gpt-oss-20b"     = @{ Archivo = "gpt-oss-20b-MXFP4.gguf"; Extra = '--n-cpu-moe 14 --chat-template-kwargs "{\"reasoning_effort\":\"low\"}"' }
    "qwen3.5-9b"      = @{ Archivo = "Qwen3.5-9B-Q4_K_M.gguf"; Extra = $NoThink }
    "granite-4.2-8b"  = @{ Archivo = "granite-4.2-8b-Q4_K_M.gguf"; Extra = "" }
    "gemma-4-26b-a4b" = @{ Archivo = "gemma-4-26B-A4B-it-Q4_K_M.gguf"; Extra = "--n-cpu-moe 18" }
    "gemma-4-12b"     = @{ Archivo = "gemma-4-12B-it-Q4_K_M.gguf"; Extra = "" }
    "gemma-4-e4b"     = @{ Archivo = "google_gemma-4-E4B-it-Q4_K_M.gguf"; Extra = "" }
    "qwen3.6-35b-a3b" = @{ Archivo = "Qwen3.6-35B-A3B-Q4_K_M.gguf"; Extra = "--n-cpu-moe 30 $NoThink" }
}

function Wait-Url([string]$Url, [int]$Segundos) {
    $limite = (Get-Date).AddSeconds($Segundos)
    while ((Get-Date) -lt $limite) {
        try { if ((Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return } } catch {}
        Start-Sleep 2
    }
    throw "No respondió a tiempo: $Url"
}
function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
# Muestrea en segundo plano los picos de RAM (llama-server y back end, por puerto) y de VRAM dedicada.
function Start-Muestreo([string]$Marca) {
    "1" | Set-Content $Marca
    Start-Job -ArgumentList $Marca -ScriptBlock {
        param($Marca)
        $max = @{ llama = 0; api = 0; gpu = 0 }
        while (Test-Path $Marca) {
            foreach ($par in @(@("llama", 8081), @("api", 8001))) {
                $c = Get-NetTCPConnection -LocalPort $par[1] -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($c) {
                    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
                    if ($p) { $mb = [int]($p.WorkingSet64 / 1MB); if ($mb -gt $max[$par[0]]) { $max[$par[0]] = $mb } }
                }
            }
            try {
                $g = (Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction Stop).CounterSamples |
                    Measure-Object CookedValue -Maximum
                $mb = [int]($g.Maximum / 1MB); if ($mb -gt $max.gpu) { $max.gpu = $mb }
            } catch {}
            Start-Sleep 2
        }
        $max
    }
}
function Stop-Muestreo($Job, [string]$Marca) {
    Remove-Item $Marca -ErrorAction SilentlyContinue
    $r = $Job | Wait-Job -Timeout 30 | Receive-Job
    Remove-Job $Job -Force -ErrorAction SilentlyContinue
    if ($r) { $r } else { @{ llama = 0; api = 0; gpu = 0 } }
}
function Get-DbMB {
    $ErrorActionPreference = "Continue"
    $s = docker stats --no-stream --format "{{.MemUsage}}" doculocal-db-1 2>$null
    if ($s -match '([\d.]+)\s*(MiB|GiB)') { [int]([double]$Matches[1] * $(if ($Matches[2] -eq 'GiB') { 1024 } else { 1 })) } else { 0 }
}
function Invoke-Eval([string]$Etiqueta, [double]$Gb) {
    $marca = "$Out\logs\$Etiqueta.muestreo"
    $t0 = Get-Date
    $job = Start-Muestreo $marca
    $api = Start-Process $Py -ArgumentList "-m uvicorn app.main:app --app-dir backend --port 8001 --no-server-header" `
        -WorkingDirectory $Root -PassThru -WindowStyle Hidden -RedirectStandardError "$Out\logs\$Etiqueta.api.log"
    try {
        Wait-Url "http://127.0.0.1:8001/api/v1/health" 120
        & $Py "$Root\backend\scripts\eval_rag.py" --base-url http://127.0.0.1:8001 --etiqueta $Etiqueta `
            --salida "$Out\$Etiqueta.md" --pausa $Pausa *>&1 | Tee-Object "$Out\logs\$Etiqueta.eval.log"
    } finally {
        $db = Get-DbMB
        $m = Stop-Muestreo $job $marca
        Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue; Stop-Port 8001
        $seg = [int]((Get-Date) - $t0).TotalSeconds
        if (-not (Test-Path "$Out\recursos.csv")) { "etiqueta,modelo_gb,ram_llama_mb,ram_backend_mb,vram_mb,ram_bd_mb,duracion_s" | Set-Content "$Out\recursos.csv" }
        "$Etiqueta,$Gb,$($m.llama),$($m.api),$($m.gpu),$db,$seg" | Add-Content "$Out\recursos.csv"
    }
}

New-Item -ItemType Directory -Force "$Out\logs" | Out-Null
Set-Location $Root
$ErrorActionPreference = "Continue"; docker compose up -d db 2>&1 | Out-Null; $ErrorActionPreference = "Stop"  # docker escribe en stderr y con Stop abortaría
$sano = $false
for ($i = 0; $i -lt 30 -and -not $sano; $i++) {
    $ErrorActionPreference = "Continue"; $sano = ((docker inspect -f '{{.State.Health.Status}}' doculocal-db-1 2>$null) -eq 'healthy'); $ErrorActionPreference = "Stop"
    if (-not $sano) { Start-Sleep 2 }
}
if (-not $sano) { throw "La BD (doculocal-db-1) no está sana: abre Docker Desktop y reintenta." }
Stop-Port 8081; Stop-Port 8001; Stop-Port 8000

foreach ($m in $Modelos) {
    $cfg = $Catalogo[$m]
    if (-not $cfg) { Write-Warning "Modelo desconocido: $m"; continue }
    if ((Test-Path "$Out\$m.md") -and -not $Forzar) { Write-Host "=== ${m}: ya medido, se omite (usa -Forzar) ==="; continue }
    Write-Host "=== $m ==="
    $arch = "$LlamaDir\models\$($cfg.Archivo)"
    if (-not (Test-Path $arch)) { Write-Warning "${m}: falta $arch"; continue }
    $gb = [math]::Round((Get-Item $arch).Length / 1GB, 1)
    $srv = Start-Process "$LlamaDir\llama-server.exe" -WorkingDirectory $LlamaDir -PassThru -WindowStyle Hidden `
        -ArgumentList "--model `"$arch`" $Base $($cfg.Extra)" `
        -RedirectStandardError "$Out\logs\$m.llama.log"
    try {
        Wait-Url "http://127.0.0.1:8081/health" 600  # modelos de 12-20 GB desde disco lento
        $env:LLM_BASE_URL = "http://127.0.0.1:8081/v1"; $env:LLM_MODEL = "local"; $env:LLM_FAST_MODEL = "local"
        $env:LLM_GUARD_MODEL = ""; $env:LLM_TIMEOUT_SECONDS = "240"; $env:LLM_MAX_RETRIES = "1"
        Invoke-Eval $m $gb
    } catch { Write-Warning "$m falló: $_" }
    finally {
        Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue; Stop-Port 8081
        "LLM_BASE_URL","LLM_MODEL","LLM_FAST_MODEL","LLM_GUARD_MODEL","LLM_TIMEOUT_SECONDS","LLM_MAX_RETRIES" |
            ForEach-Object { Remove-Item "env:$_" -ErrorAction SilentlyContinue }
    }
}
# Groq usa el .env tal cual; sirve además como medición del back end sin IA local (columnas ram_llama/vram en 0).
if ($ConGroq -and ((-not (Test-Path "$Out\groq-gpt-oss-120b.md")) -or $Forzar)) {
    Write-Host "=== groq ==="; try { Invoke-Eval "groq-gpt-oss-120b" 0 } catch { Write-Warning "groq falló: $_" }
}

# Resumen: la línea en negrita que escribe eval_rag.py en cada informe + recursos medidos.
$filas = Get-ChildItem "$Out\*.md" -Exclude COMPARATIVA.md, CONCLUSIONES.md | ForEach-Object {
    $r = (Select-String -Path $_.FullName -Pattern '^\*\*Correctas' | Select-Object -First 1).Line
    "| $($_.BaseName) | $($r -replace '\*\*','') |"
}
$rec = if (Test-Path "$Out\recursos.csv") { Import-Csv "$Out\recursos.csv" | ForEach-Object {
    "| $($_.etiqueta) | $($_.modelo_gb) | $($_.ram_llama_mb) | $($_.ram_backend_mb) | $($_.vram_mb) | $($_.ram_bd_mb) | $($_.duracion_s) |" } } else { @() }
@("# Comparativa del benchmark RAG", "", "Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "",
  "| Modelo | Resultado |", "|---|---|") + $filas + @("", "## Recursos medidos (picos)", "",
  "| Modelo | Archivo GB | RAM llama-server MB | RAM back end MB | VRAM MB | RAM BD MB | Duración s |", "|---|---|---|---|---|---|---|") + $rec |
    Set-Content "$Out\COMPARATIVA.md" -Encoding UTF8
Write-Host "Listo: $Out\COMPARATIVA.md"
