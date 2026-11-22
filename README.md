# DocuLocal

**Asistente interno que responde las dudas de los trabajadores solo a partir de la documentación que sube la empresa, con citas verificables y control de acceso por nivel.**

Proyecto del curso INGT1003 (Universidad Mayor). Repositorio: https://github.com/NIXOcf/DocuLocal

## Integrantes

| Nombre | Usuario de GitHub |
|---|---|
| Eduardo Castillo | [PENDIENTE: usuario de GitHub] |
| Cristofer del Río | [PENDIENTE: usuario de GitHub] |
| Angelo D'Agostino | [PENDIENTE: usuario de GitHub] |
| René Jorquera | [PENDIENTE: usuario de GitHub] |

## Arquitectura

| Capa | Tecnología |
|---|---|
| Front end | React 19 + TypeScript + Vite (`http://localhost:5173`), Tailwind 4, shadcn/base-ui. Usa la API real; el token JWT vive en `sessionStorage`. |
| Back end | Python 3.12 + FastAPI (`http://localhost:8000`, prefijo `/api/v1`), en capas controlador, servicio y repositorio. |
| Base de datos | PostgreSQL 17 + pgvector en Docker (`pgvector/pgvector:pg17`), publicada solo en `127.0.0.1`. |
| Embeddings y reranker | **Locales** (fastembed): `paraphrase-multilingual-mpnet-base-v2` y `jina-reranker-v2-base-multilingual`. |
| LLM | API compatible con OpenAI, configurable en `.env`: **Groq** (`openai/gpt-oss-120b`, `gpt-oss-20b` y `llama-prompt-guard-2-86m`) o **llama.cpp local** (`backend/scripts/llama_local.ps1`). |

Los documentos, la base de datos, los embeddings y el reranker quedan en la máquina en ambos modos. La diferencia está en el LLM, que se elige con `LLM_BASE_URL` en `.env`:

| Modo | Configuración | Qué sale de la red |
|---|---|---|
| Nube (`groq`) | `LLM_BASE_URL` apunta a Groq (por defecto) | La pregunta y los fragmentos autorizados que se usan para responder viajan a Groq (EE. UU.) |
| Local (`local`) | `LLM_BASE_URL=http://127.0.0.1:8081/v1` (llama.cpp, `backend/scripts/llama_local.ps1`) | Nada |

`GET /api/v1/health` informa el modo activo en el campo `modo`. El front muestra un aviso de privacidad con la variante que corresponde.

Seguridad: el filtro de nivel y departamento se aplica dentro del SQL antes de buscar, de modo que el LLM nunca recibe un fragmento no autorizado. Lo no autorizado responde 404. Detalle en [`docs/Hito2_Diseno_Backend.md`](docs/Hito2_Diseno_Backend.md).

## Requisitos previos

- Node.js 18 o superior
- Python 3.12
- Docker (con Docker Compose)
- Unos 1,5 GB libres para los modelos locales (se descargan solos la primera vez)
- Una clave de Groq (`GROQ_API_KEY`), salvo que uses el modo llama.cpp local

## Instalación (PowerShell, desde esta carpeta)

```powershell
# 1. Configuración: completar JWT_SECRET (mín. 32 caracteres aleatorios) y GROQ_API_KEY. No subas .env.
Copy-Item .env.example .env

# 2. Back end
python -m venv backend\.venv
backend\.venv\Scripts\pip install -r backend\requirements.txt

# 3. Front end
npm install

# 4. Base de datos (aplica db/schema.sql la primera vez)
docker compose up -d db

# 5. Datos de demo: usuarios y los PDF de docs/prueba (unos 2 min)
backend\.venv\Scripts\python backend\scripts\seed.py
```

### Levantar

```powershell
.\levantar.ps1            # BD + back + front, y abre el navegador
.\levantar.ps1 -Seed      # lo mismo, cargando antes los datos de demo
.\levantar.ps1 -Detener   # apaga todo
```

O a mano, en dos terminales:

```powershell
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --port 8000 --no-server-header
npm run dev
```

Swagger en `http://localhost:8000/docs` si `ENABLE_DOCS=true` en `.env`. Salud: `http://localhost:8000/api/v1/health`.

## Usuarios de demo

Datos ficticios de la empresa AguaNube. Contraseña de todos: `DocuLocal2026!`

| Correo | Rol | Nivel |
|---|---|---|
| `trabajador@aguanube.cl` | employee | 1 General |
| `jefe@aguanube.cl` | employee | 2 Jefatura |
| `gerente@aguanube.cl` | employee | 3 Gerencia |
| `admin@aguanube.cl` | admin | 3 Gerencia |

Rol y nivel son independientes. El **rol** (`employee` o `admin`) decide si se gestionan usuarios y documentos. El **nivel** (`1 General`, `2 Jefatura`, `3 Gerencia`) decide qué documentos se pueden consultar: se ve todo lo de nivel igual o inferior (y del propio departamento, si el documento lo tiene). El admin también chatea con su propio nivel.

## API

Contrato completo, formatos y códigos de error en [`docs/API.md`](docs/API.md). Colección Postman: [`postman/DocuLocal.postman_collection.json`](postman/DocuLocal.postman_collection.json).

| Recurso | Endpoints (`/api/v1`) | Acceso |
|---|---|---|
| Salud | `GET /health` | pública |
| Auth | `POST /auth/login`, `GET /auth/me` | pública / token |
| Usuarios | `GET, POST /users`; `GET, PATCH, DELETE /users/{id}` | admin |
| Documentos | `GET /documents`, `GET /documents/{id}`, `GET /documents/{id}/file` | token |
| | `POST /documents` (PDF/DOCX/XLSX ≤ 20 MB, 202), `PATCH, DELETE /documents/{id}` | admin |
| Fragmentos | `GET /chunks/{id}` | token (con permisos) |
| Conversaciones | `GET, POST /conversations`; `GET, PATCH, DELETE /conversations/{id}` | token |
| Mensajes | `GET, POST /conversations/{id}/messages`; `PATCH /conversations/{id}/messages/{messageId}` | token |

## Pruebas y evaluación

```powershell
cd backend; .venv/Scripts/python -m pytest -q
```

Evaluación del RAG de extremo a extremo (usa la API en proceso, la BD con el seed y el LLM reales; verifica control de acceso, respuestas "no encontré" y citas esperadas), desde esta carpeta:

```powershell
backend\.venv\Scripts\python backend\scripts\eval_rag.py
```

Resultados de referencia: [`backend/scripts/eval_resultados.md`](backend/scripts/eval_resultados.md).

## Estructura

```
DocuLocal/
├── src/                 Front end (React + TypeScript)
├── backend/
│   ├── app/             api/v1, schemas, services (+ services/rag), repositories, core
│   ├── tests/           Pruebas con pytest
│   └── scripts/         seed.py, eval_rag.py, llama_local.ps1, benchmark/
├── db/                  schema.sql y migrations/ (ver db/README.md)
├── postman/             Colección Postman
├── docs/                Documentación (ver abajo) y datos de demo en prueba/
├── docker-compose.yml   PostgreSQL 17 + pgvector
├── levantar.ps1         Levanta BD, back y front
└── .env.example         Variables de entorno de ejemplo
```

## Documentos

- [`docs/hito2/DocuLocal_Hito2_Documento_Tecnico.pdf`](docs/hito2/DocuLocal_Hito2_Documento_Tecnico.pdf): documento técnico del Hito 2
- [`docs/Hito2_Diseno_Backend.md`](docs/Hito2_Diseno_Backend.md): diseño y decisiones del back end
- [`docs/API.md`](docs/API.md): contrato de la API
- [`docs/hito2/diagramas/`](docs/hito2/diagramas): arquitectura en capas, despliegue, modelo de datos, pipeline RAG y secuencia
- [`docs/DocuLocal_INF.pdf`](docs/DocuLocal_INF.pdf): informe del Hito 1
- [`backend/README.md`](backend/README.md) y [`db/README.md`](db/README.md)
- [`docs/Declaración de uso de Inteligencia Artificial Generativa.pdf`](docs/Declaración%20de%20uso%20de%20Inteligencia%20Artificial%20Generativa.pdf)
- Video de demostración: `[enlace pendiente]`

## Declaración de uso de IA generativa

Este proyecto **utilizó Inteligencia Artificial Generativa (IAG) en su desarrollo y en su documentación**. La IAG se empleó como herramienta de apoyo; los requisitos, el alcance, la identidad visual y los criterios de aceptación fueron definidos por el/los autor(es), quien(es) asume(n) la responsabilidad final del contenido.

### Herramientas utilizadas

| Herramienta | Uso |
|---|---|
| Claude (Anthropic) | Arquitectura, redacción de prompts, análisis de auditorías, decisiones técnicas y documentación |
| Claude Code (Anthropic) | Generación y modificación de código, configuración de dependencias, verificación (tipos, build, lint) y evolución a v2 |
| Cline + modelo local | Intento inicial de construcción y auditoría de código |

### Alcance

- **Código:** estructura del proyecto, componentes (`Sidebar`, `ChatView`, `AdminView`, login, diálogo de citas), enrutamiento, roles simulados, persistencia local, simulación de streaming, feedback y aplicación de directrices OWASP/WCAG.
- **Documentación:** plan de arquitectura, justificación de decisiones técnicas, informe de cumplimiento y la declaración completa de uso de IAG.

### Limitaciones

- El código generado por IA puede contener errores; se verificó mediante compilación, lint y pruebas manuales, **sin una auditoría formal**.
- El cumplimiento de OWASP y WCAG 2.2 es una directriz de desarrollo, **no una certificación**.
- Los controles de acceso se aplican en el backend (JWT, nivel y departamento dentro del SQL), pero no se realizó una auditoría de seguridad formal.
- Todos los datos son ficticios y no se compartieron credenciales ni información confidencial con las herramientas de IA.

La declaración completa está en [`docs/Declaración de uso de Inteligencia Artificial Generativa.pdf`](docs/Declaración%20de%20uso%20de%20Inteligencia%20Artificial%20Generativa.pdf).
