# Benchmark del RAG con varios LLM locales (llama.cpp) y Groq como referencia.
# Uso (desde la raíz del repo):
#   powershell -ExecutionPolicy Bypass -File backend\scripts\benchmark\run_benchmark.ps1 -LlamaDir F:\ruta\llama -Modelos gpt-oss-20b,granite
# Cada modelo: levanta llama-server (8081) -> back end en modo local (8001) -> eval_rag.py -> apaga ambos.
# Resultados en backend\scripts\benchmark\<etiqueta>.md y resumen en COMPARATIVA.md.
param(
    [string]$LlamaDir = $env:LLAMA_CPP_DIR,
    [string[]]$Modelos = @("gpt-oss-20b", "qwen3.5-9b", "granite-4.2-8b", "gemma-4-26b-a4b"),
    [switch]$ConGroq,
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
function Invoke-Eval([string]$Etiqueta) {
    $api = Start-Process $Py -ArgumentList "-m uvicorn app.main:app --app-dir backend --port 8001 --no-server-header" `
        -WorkingDirectory $Root -PassThru -WindowStyle Hidden -RedirectStandardError "$Out\logs\$Etiqueta.api.log"
    try {
        Wait-Url "http://127.0.0.1:8001/api/v1/health" 120
        & $Py "$Root\backend\scripts\eval_rag.py" --base-url http://127.0.0.1:8001 --etiqueta $Etiqueta `
            --salida "$Out\$Etiqueta.md" --pausa $Pausa *>&1 | Tee-Object "$Out\logs\$Etiqueta.eval.log"
    } finally { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue; Stop-Port 8001 }
}

New-Item -ItemType Directory -Force "$Out\logs" | Out-Null
Set-Location $Root
$ErrorActionPreference = "Continue"; docker compose up -d db 2>&1 | Out-Null; $ErrorActionPreference = "Stop"  # docker escribe en stderr y con Stop abortaría
Stop-Port 8081; Stop-Port 8001

foreach ($m in $Modelos) {
    $cfg = $Catalogo[$m]
    if (-not $cfg) { Write-Warning "Modelo desconocido: $m"; continue }
    Write-Host "=== $m ==="
    $srv = Start-Process "$LlamaDir\llama-server.exe" -WorkingDirectory $LlamaDir -PassThru -WindowStyle Hidden `
        -ArgumentList "--model `"$LlamaDir\models\$($cfg.Archivo)`" $Base $($cfg.Extra)" `
        -RedirectStandardError "$Out\logs\$m.llama.log"
    try {
        Wait-Url "http://127.0.0.1:8081/health" 600  # modelos de 12-20 GB desde disco lento
        $env:LLM_BASE_URL = "http://127.0.0.1:8081/v1"; $env:LLM_MODEL = "local"; $env:LLM_FAST_MODEL = "local"
        $env:LLM_GUARD_MODEL = ""; $env:LLM_TIMEOUT_SECONDS = "240"; $env:LLM_MAX_RETRIES = "1"
        Invoke-Eval $m
    } catch { Write-Warning "$m falló: $_" }
    finally {
        Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue; Stop-Port 8081
        "LLM_BASE_URL","LLM_MODEL","LLM_FAST_MODEL","LLM_GUARD_MODEL","LLM_TIMEOUT_SECONDS","LLM_MAX_RETRIES" |
            ForEach-Object { Remove-Item "env:$_" -ErrorAction SilentlyContinue }
    }
}
if ($ConGroq) { Write-Host "=== groq ==="; try { Invoke-Eval "groq-gpt-oss-120b" } catch { Write-Warning "groq falló: $_" } }

# Resumen: la línea en negrita que escribe eval_rag.py en cada informe.
$filas = Get-ChildItem "$Out\*.md" -Exclude COMPARATIVA.md | ForEach-Object {
    $r = (Select-String -Path $_.FullName -Pattern '^\*\*Correctas' | Select-Object -First 1).Line
    "| $($_.BaseName) | $($r -replace '\*\*','') |"
}
@("# Comparativa del benchmark RAG", "", "Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "",
  "| Modelo | Resultado |", "|---|---|") + $filas | Set-Content "$Out\COMPARATIVA.md" -Encoding UTF8
Write-Host "Listo: $Out\COMPARATIVA.md"
