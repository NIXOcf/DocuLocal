# Visor del estado del benchmark: modelo en curso, avance, GPU (compute 0) y VRAM.
# Uso: powershell -File backend\scripts\benchmark\estado.ps1   (Ctrl+C para salir)
param([int]$VramTotalMB = 8192, [int]$Cada = 3)
$Dir = $PSScriptRoot
function Barra([double]$pct, [int]$n = 30) {
    $p = [math]::Max(0, [math]::Min(100, $pct)); $l = [int]($p / 100 * $n)
    "[" + ("#" * $l) + ("-" * ($n - $l)) + "] " + ("{0,5:N1}%" -f $p)
}
while ($true) {
    $gpu = 0; $vram = 0
    try {
        $gpu = ((Get-Counter '\GPU Engine(*engtype_compute 0)\Utilization Percentage' -ErrorAction Stop).CounterSamples | Measure-Object CookedValue -Sum).Sum
        $vram = [int](((Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction Stop).CounterSamples | Measure-Object CookedValue -Maximum).Maximum / 1MB)
    } catch {}

    $srv = Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
    $modelo = if ($srv -and $srv.CommandLine -match '--model\s+"?[^"]*\\([^\\"]+?)(\.gguf)?"?\s') { $Matches[1] } else { "-" }
    $api = [bool](Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue)
    $bench = [bool](Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'run_benchmark' })

    # Avance del caso en curso: el eval vuelca una línea por pregunta en logs\<modelo>.eval.log
    $ultimo = Get-ChildItem "$Dir\logs\*.eval.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $lineas = if ($ultimo) { @(Get-Content $ultimo.FullName -Tail 4) } else { @() }

    Clear-Host
    "BENCHMARK DocuLocal  ·  $(Get-Date -Format 'HH:mm:ss')  ·  script: $(if ($bench) {'EN EJECUCIÓN'} else {'detenido'})"
    ""
    "GPU compute 0 $(Barra $gpu)"
    "VRAM          $(Barra ($vram * 100 / $VramTotalMB)) ($vram / $VramTotalMB MB)"
    ""
    "Modelo en curso : $modelo  (llama-server: $(if ($srv) {'activo'} else {'apagado'}), back 8001: $(if ($api) {'activo'} else {'apagado'}))"
    if ($ultimo) { "Último log       : $($ultimo.Name)"; $lineas | ForEach-Object { "  $_" } }
    ""
    "Resultados terminados:"
    $hechos = Get-ChildItem "$Dir\*.md" -Exclude COMPARATIVA.md, CONCLUSIONES.md -ErrorAction SilentlyContinue
    if ($hechos) { $hechos | ForEach-Object { "  $($_.BaseName): $(((Select-String -Path $_.FullName -Pattern '^\*\*Correctas' | Select-Object -First 1).Line) -replace '\*\*','')" } } else { "  (ninguno todavía)" }
    if (Test-Path "$Dir\recursos.csv") { ""; "Recursos medidos (recursos.csv):"; Get-Content "$Dir\recursos.csv" | ForEach-Object { "  $_" } }
    Start-Sleep $Cada
}
