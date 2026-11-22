<#
.SYNOPSIS
  Levanta llama-server (llama.cpp) como LLM local de DocuLocal, con API compatible con OpenAI en http://127.0.0.1:<Port>/v1.
.EXAMPLE
  .\llama_local.ps1 -LlamaDir C:\llama.cpp -Model C:\modelos\Qwen3.5-9B-Q4_K_M.gguf
  Luego en .env: LLM_BASE_URL=http://127.0.0.1:8081/v1, LLM_MODEL=local, LLM_FAST_MODEL=local, LLM_GUARD_MODEL=, LLM_TIMEOUT_SECONDS=180
#>
param(
    [string]$LlamaDir = $env:LLAMA_CPP_DIR,   # carpeta que contiene llama-server.exe
    [Parameter(Mandatory = $true)][string]$Model,   # ruta al archivo .gguf
    [int]$Port = 8081,
    [int]$CtxSize = 8192,
    [int]$GpuLayers = 99,
    [string[]]$ExtraArgs = @()
)

$exe = if ($LlamaDir) { Join-Path $LlamaDir "llama-server.exe" } else { "" }
if (-not $exe -or -not (Test-Path $exe)) { throw "No se encontró llama-server.exe: indica -LlamaDir o define LLAMA_CPP_DIR." }
if (-not (Test-Path $Model)) { throw "No existe el modelo: $Model" }

# Qwen3.5 razona por defecto y, con el presupuesto agotado, el contenido de la respuesta sale vacío.
# '--reasoning-budget 0' NO desactiva ese razonamiento; hay que usar enable_thinking=false en la plantilla.
# Se arma una sola línea de argumentos (Start-Process) para controlar el escapado de las comillas del JSON.
$argLine = "--model `"$Model`" --ctx-size $CtxSize --n-gpu-layers $GpuLayers --flash-attn on --jinja " +
    "--chat-template-kwargs `"{\`"enable_thinking\`":false}`" --host 127.0.0.1 --port $Port " + ($ExtraArgs -join " ")

Write-Host "llama-server en http://127.0.0.1:$Port/v1 (Ctrl+C para detener)"
Start-Process -FilePath $exe -ArgumentList $argLine.Trim() -NoNewWindow -Wait
