# Comparativa del benchmark RAG

Generado: 2026-11-22 06:23

| Modelo | Resultado |
|---|---|
| gemma-4-e4b | Correctas: 16/17 | latencia media: 57729 ms | p90: 130548 ms | mediana: 52703 ms | fallos de acceso: 0 | sin grounded (esperaba respuesta): 1 | rechazos indebidos: 1 |
| gpt-oss-20b | Correctas: 12/17 | latencia media: 47957 ms | p90: 100383 ms | mediana: 39462 ms | fallos de acceso: 0 | sin grounded (esperaba respuesta): 5 | rechazos indebidos: 5 |
| granite-4.2-8b | Correctas: 12/17 | latencia media: 81339 ms | p90: 168560 ms | mediana: 48923 ms | fallos de acceso: 0 | sin grounded (esperaba respuesta): 5 | rechazos indebidos: 5 |
| groq-gpt-oss-120b | Correctas: 14/17 | latencia media: 6667 ms | p90: 13581 ms | mediana: 6209 ms | fallos de acceso: 0 | sin grounded (esperaba respuesta): 3 | rechazos indebidos: 3 |
| qwen3.5-9b | Correctas: 15/17 | latencia media: 44526 ms | p90: 97055 ms | mediana: 31153 ms | fallos de acceso: 0 | sin grounded (esperaba respuesta): 2 | rechazos indebidos: 2 |
| qwen3.6-35b-a3b |  |

## Recursos medidos (picos)

| Modelo | Archivo GB | RAM llama-server MB | RAM back end MB | VRAM MB | RAM BD MB | DuraciÃ³n s |
|---|---|---|---|---|---|---|
| granite-4.2-8b | 5 | 11630 | 6663 | 7575 | 54 | 1503 |
| qwen3.5-9b | 5.3 | 10366 | 6039 | 6658 | 55 | 878 |
| gemma-4-e4b | 5 | 5156 | 6044 | 4650 | 57 | 1100 |
| gpt-oss-20b | 11.3 | 12976 | 6902 | 6171 | 57 | 934 |
| gemma-4-12b | 6.9 | 11459 | 6397 | 7174 | 57 | 465 |
| groq-gpt-oss-120b | 0 | 175 | 142 | 4881 | 53 | 15 |
| groq-gpt-oss-120b | 0 | 0 | 6495 | 853 | 54 | 232 |
