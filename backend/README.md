# DocuLocal · Back end (Hito 2)

API REST en FastAPI con un asistente RAG sobre los documentos internos de la empresa, con control de acceso por nivel
(General < Jefatura < Gerencia). Diseño y decisiones: `docs/Hito2_Diseno_Backend.md`; contrato: `docs/API.md`.

## Requisitos

- Python 3.12, Docker (PostgreSQL 17 + pgvector), y una clave de Groq en `GROQ_API_KEY`.
- Unos 1,5 GB libres para los modelos locales (embeddings y reranker, se descargan solos la primera vez).

## Levantar

Desde la raíz del repo (`DocuLocal/`):

```bash
cp .env.example .env                       # completar JWT_SECRET y GROQ_API_KEY
docker compose up -d db                    # PostgreSQL + pgvector (aplica db/schema.sql la primera vez)

uv venv backend/.venv --python 3.12        # o: python -m venv backend/.venv
uv pip install -r backend/requirements.txt --python backend/.venv/Scripts/python   # o: backend/.venv/Scripts/pip install -r ...
                                           # (en Linux/Mac: backend/.venv/bin/python)

backend/.venv/Scripts/python backend/scripts/seed.py                   # usuarios y 19 PDF de docs/prueba (≈2 min)
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000 --no-server-header
```

`--no-server-header` evita anunciar el servidor en cada respuesta. Swagger (`/docs`, `/redoc`, `/openapi.json`) está
**desactivado por defecto**: para desarrollo o la demo poner `ENABLE_DOCS=true` en `.env` (en producción, `false`).
Con la opción activa: http://localhost:8000/docs · salud: http://localhost:8000/api/v1/health

`JWT_SECRET` debe tener al menos 32 caracteres (la API no arranca si es más corto).

### Esquema de la BD

`db/schema.sql` crea todo desde cero y empieza con `DROP TABLE`: solo se ejecuta al crear el volumen. Para reiniciar la BD de demo, `docker compose down -v` y `docker compose up -d db`, y luego `seed.py`.
PostgreSQL solo se publica en `127.0.0.1` (`docker-compose.yml`).

Para empezar con la BD limpia: `docker compose down -v && docker compose up -d db` y repetir el seed.

## Usuarios demo (contraseña `DocuLocal2026!`)

| Correo | Rol | Nivel |
|---|---|---|
| `admin@aguanube.cl` | admin | Gerencia |
| `trabajador@aguanube.cl` | employee | General |
| `jefe@aguanube.cl` | employee | Jefatura |
| `gerente@aguanube.cl` | employee | Gerencia |

El administrador gestiona usuarios y documentos; para el chat rige su propio nivel.

## Pruebas y evaluación

```bash
backend/.venv/Scripts/python -m pytest backend            # unitarias: sin BD ni red
backend/.venv/Scripts/python backend/scripts/eval_rag.py  # extremo a extremo (BD con seed + Groq); escribe backend/scripts/eval_resultados.md
```

`eval_rag.py` hace preguntas vagas, concretas, comparativas, fuera de alcance, saludo, inyección y consultas de nivel
Gerencia hechas por un trabajador, y verifica que ninguna fuente supere el nivel del usuario. Termina con código 1 si hay
una fuga de acceso. Colección Postman con una carpeta "Demo en vivo": `postman/DocuLocal.postman_collection.json`
(para subir el documento de ejemplo, usar como directorio de trabajo de Postman la carpeta `postman/`).

## Límites y protecciones

| Qué | Límite | Respuesta |
|---|---|---|
| Login: fallos por (IP, correo) | 5 en 15 min | 429 `demasiados_intentos` + `Retry-After` |
| Login: fallos por IP (todos los correos) | 20 en 15 min | 429 `demasiados_intentos` + `Retry-After` |
| Login: turnos por cuenta (todas las IP) | desde el 6.º intento en 15 min, cada intento ocupa un turno separado por `min(2^(n-5), 8)` s; ningún hilo espera más de 8 s | 429 `demasiados_intentos` + `Retry-After` si el turno quedaría a más de 8 s |
| Preguntas al chat | 10 por minuto por usuario | 429 `demasiadas_consultas` + `Retry-After` |
| Cuerpo de la petición | 64 KB; `POST /documents`: `MAX_UPLOAD_MB` + 1 MB (se corta aunque falte o mienta `Content-Length`) | 413 `cuerpo_demasiado_grande` / `archivo_demasiado_grande` |
| Subidas | firma real (`%PDF-`, ZIP con `word/document.xml` o `xl/workbook.xml`); ≤200 MB descomprimidos y proporción ≤100 por entrada | 415 `tipo_no_coincide` / `archivo_sospechoso` |

Los contadores viven en memoria de un solo proceso (con varias instancias, usar Redis). La IP es `request.client.host`:
detrás de un proxy hay que configurar uvicorn con `--proxy-headers`/`--forwarded-allow-ips` para ver la IP real.
Trade-off del turno por cuenta: durante un ataque a una cuenta, el usuario legítimo también puede recibir 429 en ella (no hay bloqueo permanente: el turno se libera solo y un login exitoso limpia la cuenta); mitigación futura: MFA o CAPTCHA.
Todas las respuestas (salvo `/docs` y `/redoc`) llevan `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y una CSP restrictiva.
Las fuentes de mensajes viejos se muestran según el acceso **actual** del usuario ("Documento no disponible" si ya no lo ve),
y esas respuestas no se envían al LLM como historial. La pregunta se guarda junto con su respuesta (si el LLM falla, no queda guardada).

## Estructura por capas (la dependencia solo baja)

```
backend/app/
  api/v1/          Controladores: parsean HTTP, llaman a un servicio, fijan el código de estado (sin lógica ni SQL)
  schemas/         DTOs Pydantic: contrato de entrada/salida (camelCase, lista blanca de campos)
  services/        Negocio: reglas, autorización, orquestación (no importa fastapi)
    rag/           Pipeline RAG: parsing, chunking, ingestion, embeddings, llm_client, query_planner, retriever, reranker, generator
  repositories/    Único lugar con SQL (psycopg 3, sin ORM)
  core/            config (.env), seguridad (JWT/bcrypt), errores (AppError), dependencias (usuario actual)
backend/scripts/   seed.py y eval_rag.py
backend/tests/     pruebas unitarias
```

### Recorrido de `POST /conversations/{id}/messages`

1. `api/v1/conversations.py::post_message`: valida el cuerpo con `schemas.conversation.MessageCreate` (1–2000 caracteres), obtiene al usuario con la dependencia `CurrentUser` (`core/deps.py`, que verifica el JWT y que siga activo) y llama a `conversation_service.post_message`.
2. `services/conversation_service.py`: comprueba que la conversación es del usuario (`conversation_repository.get_owned`, si no 404) y el límite de 100 mensajes (409); delega en `chat_service.answer`.
3. `services/chat_service.py`: lee el historial (`message_repository`) y lee el historial visible para el usuario (sin respuestas con fuentes que ya no puede ver); el guard anti-inyección (`rag/llm_client.prompt_injection_score`) puede bloquear la pregunta; luego `rag/query_planner` (condensa y planifica) y `rag/retriever`.
4. `rag/retriever.py`: embebe las subconsultas (`rag/embeddings`) y llama a `chunk_repository.search_vector` / `search_text`, cuyo SQL une `chunks` con `documents` y aplica `visibility_clause()` **en el WHERE**: nivel, departamento y estado `Indexado`. Fusiona con RRF, reordena con `rag/reranker`, aplica umbral y diversidad y añade el fragmento vecino. Si no queda nada, responde "No encontré información…" sin llamar al LLM.
5. `rag/generator.py`: pide la respuesta a Groq con el contexto numerado y verifica las citas `[n]`; `chat_service` deja solo las fuentes citadas y las renumera.
6. `message_repository.insert_exchange` guarda la pregunta, la respuesta y las fuentes (`message_sources`) juntas en una sola transacción (si el LLM falló, no se guardó nada y reintentar no duplica la pregunta); `conversation_repository.touch` actualiza fecha y título; `audit_service` registra la consulta (auditoría mínima: fecha, `user_id`, acción y recurso; sin IP, correo ni texto; se purga a los 30 días al arrancar). El controlador devuelve 201.

## Fallas frecuentes

- **Puerto 5432 ocupado** (otro Postgres local): cambiar `POSTGRES_PORT` en `.env` (por ejemplo 5433) y volver a levantar `docker compose up -d db`.
- **Primera ejecución lenta**: fastembed descarga los modelos de embeddings y reranker (~1 GB) en el primer seed o la primera consulta.
- **Docker apagado**: `/health` responde 503 `bd_no_disponible` o uvicorn no arranca; iniciar Docker Desktop y `docker compose up -d db`.
- **Falta `GROQ_API_KEY`** (o clave inválida): el chat devuelve 503 `llm_no_disponible`; el resto de la API sigue funcionando.
- **Respuestas "No encontré información" para algo que sí está**: revisar `RERANK_MIN_SCORE` en `.env` (más bajo = más permisivo) y que el documento esté `Indexado`.

## Modo local con llama.cpp

El asistente puede usar un modelo local en vez de Groq: ningún texto sale del equipo.

1. Descargar llama.cpp (con `llama-server.exe`) y un modelo `.gguf` (p. ej. Qwen3.5).
2. Levantar el servidor: `backend/scripts/llama_local.ps1 -LlamaDir <carpeta> -Model <modelo.gguf>` (o define `LLAMA_CPP_DIR`). Parámetros: `-Port 8081`, `-CtxSize 8192`, `-GpuLayers 99`, `-ExtraArgs`.
3. En `.env` (hay un bloque comentado en `.env.example`): `LLM_BASE_URL=http://127.0.0.1:8081/v1`, `LLM_MODEL=local`, `LLM_FAST_MODEL=local`, `LLM_GUARD_MODEL=` (vacío) y `LLM_TIMEOUT_SECONDS=180`. `GROQ_API_KEY` puede quedar vacía. Reiniciar uvicorn.

`GET /api/v1/health` mostrará `"modo": "local"`.

Trade-off: privacidad total y sin cupo, a cambio de menor calidad y más latencia (decenas de segundos por respuesta según la GPU). El detector de inyección (Prompt Guard) solo existe en Groq: en local queda desactivado y se avisa en el log al arrancar. Qwen3.5 necesita `enable_thinking=false` (el script ya lo pasa); `--reasoning-budget 0` no basta y el contenido sale vacío.

## Diagnóstico con logs

- **Dónde**: consola y `backend/logs/doculocal.log` (rotativo, 5 MB × 5; en `.gitignore`). Carpeta y nivel: `LOG_DIR` y `LOG_LEVEL` en `.env`.
- **DEBUG**: poner `LOG_LEVEL=DEBUG` y reiniciar; añade, por ejemplo, la pregunta truncada a 120 caracteres. En INFO nunca se registra el texto de preguntas ni documentos (solo su largo), ni contraseñas, tokens o claves; los correos van enmascarados (`t***@aguanube.cl`).
- **Formato**: `fecha nivel [modulo] req=<id> mensaje k=v ...`.
- **Seguir una petición**: toda respuesta trae la cabecera `X-Request-ID` (se respeta el que envíe el cliente si es alfanumérico/guiones y ≤64 caracteres). Los errores de la API traen además `ref` (`err_xxxxxx`). Buscar cualquiera de los dos: `Select-String backend/logs/doculocal.log -Pattern "err_1a2b3c"` toma la línea con el `ref` y su `req=`; luego buscar ese `req=` para ver toda la petición.
- Cada consulta de chat deja: líneas `[llm]` (modelo, ms, tokens), `[recuperacion]` (candidatos, mejor puntaje del reranker vs. umbral) y `[chat]` (modo, plan, fuentes, tiempos por etapa).

| Síntoma | Línea de log | Causa | Solución |
|---|---|---|---|
| API no arranca / `/health` 503 `bd_no_disponible` | `ERROR [bd] No se pudo conectar a PostgreSQL...` o `[salud] la base de datos no responde` | Docker apagado o puerto distinto | `docker compose up -d db`; revisar `POSTGRES_PORT` |
| Chat 503, "cupo agotado" | `ERROR [llm] ... cupo de Groq agotado (429)` | Cupo diario/por minuto de Groq | Esperar o pasar a modo local |
| Chat 503 con clave | `ERROR [llm] ... clave del proveedor rechazada (401)` | `GROQ_API_KEY` inválida o vacía (`WARNING [arranque] Falta GROQ_API_KEY`) | Corregir la clave |
| Chat 503 en modo local | `ERROR [llm] ... conexión rechazada en 127.0.0.1:8081: ¿está encendido llama-server?` | llama-server apagado o puerto distinto | Ejecutar `llama_local.ps1`; revisar `LLM_BASE_URL` |
| Chat 503 tras mucho rato (local) | `ERROR [llm] ... timeout tras 30s` | Respuesta larga más lenta que el timeout | Subir `LLM_TIMEOUT_SECONDS` (180) |
| Primera consulta o seed falla | `ERROR [embeddings] No se pudo cargar el modelo...` (o `[reranker]`) | Modelo sin descargar y sin internet | Conectar a internet para la primera descarga (~1 GB) |
| Documento queda en `Error` | `WARNING [ingestion] Documento sin texto extraíble` | PDF escaneado sin OCR | Subir una versión con texto (OCR) |
| "No encontré información" para algo que existe | `[recuperacion] ... mejor_puntaje=-1.5 umbral=-1.30` | Puntaje bajo el umbral, o documento no `Indexado` / sin permiso | Revisar `RERANK_MIN_SCORE` y el estado del documento |
| `/health` con `"llm": "no_disponible"` | `WARNING [salud] LLM no disponible` | Proveedor caído, sin red o clave inválida | Ver las filas anteriores |
