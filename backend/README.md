# DocuLocal · Back end (Hito 2)

API REST en FastAPI con un asistente RAG sobre los documentos internos de la empresa, con control de acceso por nivel
(General < Jefatura < Gerencia). Diseño y decisiones: `Docs/Hito2_Diseno_Backend.md`; contrato: `Docs/API.md`.

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

backend/.venv/Scripts/python backend/scripts/seed.py                   # usuarios y 19 PDF de Docs/prueba (≈2 min)
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```

Swagger: http://localhost:8000/docs · salud: http://localhost:8000/api/v1/health

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

## Estructura por capas (la dependencia solo baja)

```
backend/app/
  api/v1/          Controladores: parsean HTTP, llaman a un servicio, fijan el código de estado (sin lógica ni SQL)
  schemas/         DTOs Pydantic: contrato de entrada/salida (camelCase, lista blanca de campos)
  services/        Negocio: reglas, autorización, orquestación (no importa fastapi)
    rag/           Pipeline RAG: parsing, chunking, embeddings, llm_client, query_planner, retriever, reranker, generator
  repositories/    Único lugar con SQL (psycopg 3, sin ORM)
  core/            config (.env), seguridad (JWT/bcrypt), errores (AppError), dependencias (usuario actual)
backend/scripts/   seed.py y eval_rag.py
backend/tests/     pruebas unitarias
```

### Recorrido de `POST /conversations/{id}/messages`

1. `api/v1/conversations.py::post_message`: valida el cuerpo con `schemas.conversation.MessageCreate` (1–2000 caracteres), obtiene al usuario con la dependencia `CurrentUser` (`core/deps.py`, que verifica el JWT y que siga activo) y llama a `conversation_service.post_message`.
2. `services/conversation_service.py`: comprueba que la conversación es del usuario (`conversation_repository.get_owned`, si no 404) y el límite de 100 mensajes (409); delega en `chat_service.answer`.
3. `services/chat_service.py`: lee el historial (`message_repository`) y guarda la pregunta; el guard anti-inyección (`rag/llm_client.prompt_injection_score`) puede bloquearla; luego `rag/query_planner` (condensa y planifica) y `rag/retriever`.
4. `rag/retriever.py`: embebe las subconsultas (`rag/embeddings`) y llama a `chunk_repository.search_vector` / `search_text`, cuyo SQL une `chunks` con `documents` y aplica `visibility_clause()` **en el WHERE**: nivel, departamento y estado `Indexado`. Fusiona con RRF, reordena con `rag/reranker`, aplica umbral y diversidad y añade el fragmento vecino. Si no queda nada, responde "No encontré información…" sin llamar al LLM.
5. `rag/generator.py`: pide la respuesta a Groq con el contexto numerado y verifica las citas `[n]`; `chat_service` deja solo las fuentes citadas y las renumera.
6. `message_repository` guarda la respuesta y las fuentes (`message_sources`), `conversation_repository.touch` actualiza fecha y título, `audit_service` registra la consulta. El controlador devuelve 201.

## Fallas frecuentes

- **Puerto 5432 ocupado** (otro Postgres local): cambiar `POSTGRES_PORT` en `.env` (por ejemplo 5433) y volver a levantar `docker compose up -d db`.
- **Primera ejecución lenta**: fastembed descarga los modelos de embeddings y reranker (~1 GB) en el primer seed o la primera consulta.
- **Docker apagado**: `/health` responde 503 `bd_no_disponible` o uvicorn no arranca; iniciar Docker Desktop y `docker compose up -d db`.
- **Falta `GROQ_API_KEY`** (o clave inválida): el chat devuelve 503 `llm_no_disponible`; el resto de la API sigue funcionando.
- **Respuestas "No encontré información" para algo que sí está**: revisar `RERANK_MIN_SCORE` en `.env` (más bajo = más permisivo) y que el documento esté `Indexado`.
