# DocuLocal · Contrato de la API (v1)

Base: `http://localhost:8000/api/v1` · JSON UTF-8 · Documentación interactiva (`/docs`, `/redoc`, `/openapi.json`): **desactivada por defecto**; se activa con `ENABLE_DOCS=true` (solo desarrollo/demo).
Colección Postman: `postman/DocuLocal.postman_collection.json`.

## Versionado

- Todas las rutas llevan el prefijo `/api/v1` desde el primer despliegue, de modo que el cliente nunca depende de rutas sin versión.
- Cambios **compatibles** (campos nuevos opcionales, endpoints nuevos) se agregan en `v1`. Los clientes deben ignorar campos desconocidos.
- Cambios **incompatibles** (renombrar o quitar campos, cambiar semántica o códigos) salen en `/api/v2`, que convive con `/api/v1` mientras los clientes migran; `v1` se retira solo con aviso previo.

## Convenciones

- **Autenticación**: `Authorization: Bearer <token>` (JWT de 8 h, obtenido en `POST /auth/login`). Sin token válido: 401.
- **Roles**: `employee` y `admin`. Los endpoints marcados *admin* devuelven 403 `requiere_admin` a un empleado.
- **Niveles de acceso**: `General` < `Jefatura` < `Gerencia`. Un empleado solo ve documentos de su nivel o inferior (y de su departamento, si el documento lo restringe). Un recurso no autorizado responde **404**, nunca 403, para no confirmar su existencia.
- **Respuestas** en camelCase (salvo el objeto de login, que usa `access_token`). Fechas de documentos y usuarios en ISO 8601; fechas de conversaciones y mensajes en **epoch ms** (número).
- **Paginación** (`?pagina=1&tamano=20`, tamaño máx. 100): `{"datos": [...], "paginacion": {"pagina", "tamano", "total", "paginas"}}`.
- **Creación** → `201` + cabecera `Location`. **Borrado** → `204` sin cuerpo.
- **Entradas** con lista blanca de campos: un campo desconocido produce 422.

### Formato de error (único para todos los códigos 4xx/5xx)

```json
{ "error": "codigo_maquina", "mensaje": "Texto para personas.", "detalle": {}, "ref": "err_a1b2c3" }
```

Errores de validación (422): `{"error": "validacion_fallida", "detalle": {"campos": {"content": "String should have at least 1 character"}}}`.
`ref` también queda en el log del servidor para rastrear incidencias.

## Endpoints

| Verbo | Ruta | Auth | Éxito | Errores |
|---|---|---|---|---|
| GET | `/health` | pública | 200 | 503 `bd_no_disponible` |
| POST | `/auth/login` | pública | 200 | 401 `credenciales_invalidas`, 403 `usuario_inactivo`, 413, 422, 429 `demasiados_intentos` (+ `Retry-After`) |
| GET | `/auth/me` | token | 200 | 401 `token_invalido` |
| GET | `/users` | admin | 200 | 401, 403 |
| POST | `/users` | admin | 201 + Location | 401, 403, 409 `email_duplicado`, 422 |
| GET | `/users/{id}` | admin | 200 | 401, 403, 404 `usuario_no_encontrado`, 422 |
| PATCH | `/users/{id}` | admin | 200 | 401, 403, 404, 409 `no_puedes_degradarte`, 422 |
| DELETE | `/users/{id}` | admin | 204 | 401, 403, 404, 409 `no_puedes_eliminarte` |
| GET | `/documents` | token | 200 | 401 |
| POST | `/documents` | admin | 202 + Location | 400 `archivo_vacio`, 401, 403, 409 `documento_duplicado`, 413, 415 `tipo_no_soportado` / `tipo_no_coincide` / `archivo_sospechoso`, 422 |
| GET | `/documents/{id}` | token | 200 | 401, 404 `documento_no_encontrado` |
| PATCH | `/documents/{id}` | admin | 200 | 401, 403, 404, 422 |
| DELETE | `/documents/{id}` | admin | 204 | 401, 403, 404 |
| GET | `/documents/{id}/file` | token | 200 (archivo) | 401, 404 `documento_no_encontrado` / `archivo_no_encontrado` |
| GET | `/chunks/{id}` | token | 200 | 401, 404 `fragmento_no_encontrado` |
| GET | `/conversations` | token | 200 | 401 |
| POST | `/conversations` | token | 201 + Location | 401, 409 `limite_conversaciones`, 422 |
| GET | `/conversations/{id}` | token | 200 | 401, 404 `conversacion_no_encontrada` |
| PATCH | `/conversations/{id}` | token | 200 | 401, 404, 422 |
| DELETE | `/conversations/{id}` | token | 204 | 401, 404 |
| GET | `/conversations/{id}/messages` | token | 200 | 401, 404 |
| POST | `/conversations/{id}/messages` | token | 201 + Location | 401, 404, 409 `limite_mensajes`, 413, 422, 429 `demasiadas_consultas` (+ `Retry-After`), 503 `llm_no_disponible` |
| PATCH | `/conversations/{id}/messages/{messageId}` | token | 200 | 401, 404 `conversacion_no_encontrada` / `mensaje_no_encontrado`, 422 |

Las conversaciones son siempre del usuario autenticado: una ajena o inexistente da 404 `conversacion_no_encontrada`.
Límites: 50 conversaciones por usuario y 100 mensajes por conversación (409).

### Salud

`GET /health` → `200 {"estado": "ok", "db": "ok", "llm": "ok", "modo": "groq"}` (`llm`: `ok`, `no_disponible` o `sin_configurar`, cacheado 30 s; `modo` indica el proveedor activo (`groq` o local)). Sin BD: `503 bd_no_disponible`.

### Auth

`POST /auth/login`

```json
{ "email": "trabajador@aguanube.cl", "password": "DocuLocal2026!" }
```
→ `200`
```json
{ "access_token": "eyJ...", "token_type": "bearer", "expires_in": 28800,
  "user": { "id": "…", "email": "trabajador@aguanube.cl", "displayName": "Trabajador AguaNube", "role": "employee",
            "accessLevel": "General", "department": "General", "isActive": true, "createdAt": "2026-11-21T16:00:00Z" } }
```

`GET /auth/me` → `200` objeto `user` anterior.

### Usuarios (admin)

`GET /users?pagina&tamano&q` (`q` busca en correo y nombre).

`POST /users`
```json
{ "email": "nuevo@aguanube.cl", "password": "Clave12345", "displayName": "Usuario Nuevo",
  "role": "employee", "accessLevel": "General", "department": "General" }
```
→ `201` objeto usuario (`password` 8–128 caracteres, `role` `employee|admin`, `accessLevel` `General|Jefatura|Gerencia`).

`PATCH /users/{id}` (todos opcionales): `{ "accessLevel": "Jefatura", "isActive": false, "password": "OtraClave123", "department": null }` → `200` usuario.
`DELETE /users/{id}` → `204` (no se puede eliminar al propio usuario).

### Documentos

`GET /documents?pagina&tamano&estado=Procesando|Indexado|Error&nivel=General|Jefatura|Gerencia&q=texto`
El empleado solo ve los documentos `Indexado` que su nivel/departamento permiten; el admin ve todos.

`POST /documents` — `multipart/form-data`: `file` (PDF, DOCX o XLSX, máx. `MAX_UPLOAD_MB`), `accessLevel`, `department` (opcional). Responde **202** al instante (estado `Procesando`) y se indexa en segundo plano; consultar `GET /documents/{id}` hasta ver `Indexado` o `Error`.

```json
{ "id": "…", "name": "07_AguaNube_Contrato_de_Trabajo_Tipo.pdf", "size": "112 KB", "sizeBytes": 114688,
  "uploadedAt": "2026-11-21T16:00:00Z", "status": "Indexado", "accessLevel": "General", "department": null,
  "pageCount": 4, "chunkCount": 11, "errorMessage": null }
```

`PATCH /documents/{id}`: `{ "accessLevel": "Gerencia", "department": null }` → `200` documento.
`DELETE /documents/{id}` → `204` (borra archivo y fragmentos; las citas históricas quedan sin enlace).
`GET /documents/{id}/file` → archivo original (descarga).
`GET /chunks/{id}` → `{ "id", "documentId", "filename", "page", "content" }` (solo si el usuario puede ver el documento).

### Conversaciones

`GET /conversations?pagina&tamano` → ordenadas por `updatedAt` descendente:
```json
{ "datos": [ { "id": "…", "title": "¿Cuántas horas semanales…?", "createdAt": 1795289135728, "updatedAt": 1795289151536 } ],
  "paginacion": { "pagina": 1, "tamano": 20, "total": 1, "paginas": 1 } }
```

`POST /conversations` — cuerpo opcional `{ "title": "Mi consulta" }` (1–120; por defecto "Nueva conversación") → `201` + Location, objeto `{id,title,createdAt,updatedAt}`.
`GET /conversations/{id}` → lo anterior más `"messages": [ …mensajes… ]`.
`PATCH /conversations/{id}` `{ "title": "Nuevo título" }` (1–120) → `200`. `DELETE` → `204`.
`GET /conversations/{id}/messages` → arreglo de mensajes en orden cronológico.

### Preguntar

`POST /conversations/{id}/messages`
```json
{ "content": "¿Cuántas horas semanales dura la jornada ordinaria?" }
```
(`content`: 1–2000 caracteres tras quitar espacios) → **201** con `Location: /api/v1/conversations/{id}/messages/{answerId}`. Máximo 10 preguntas por minuto por usuario (429 `demasiadas_consultas` + `Retry-After`).
```json
{
  "id": "…", "role": "assistant",
  "content": "La jornada ordinaria es de **42 horas semanales**[1].",
  "sources": [ { "id": "chunk-uuid", "ref": 1, "filename": "07_AguaNube_Contrato_de_Trabajo_Tipo.pdf",
                 "documentId": "…", "page": 1, "score": 0.56, "snippet": "…La jornada ordinaria será de [42] horas…" } ],
  "feedback": null, "grounded": true, "createdAt": 1795289145236,
  "question": { "id": "…", "role": "user", "content": "¿Cuántas horas…?", "sources": [], "feedback": null, "grounded": null, "createdAt": 1795289135788 }
}
```
- `sources` contiene solo los fragmentos efectivamente citados, renumerados `1..n` según su aparición en el texto (`[n]`). `id` es el id del fragmento (`GET /chunks/{id}`) o `null` si el documento se borró después.
- `grounded=false` y `sources=[]` cuando no hay información en los documentos autorizados (respuesta "No encontré información…"), en saludos, preguntas fuera de alcance y consultas bloqueadas por el detector de inyección.
- `503 llm_no_disponible` si el proveedor del modelo falla o falta `GROQ_API_KEY`; la pregunta no se guarda (pregunta y respuesta se guardan juntas), así que reintentar no la duplica.

`PATCH /conversations/{id}/messages/{messageId}` `{ "feedback": "up" }` (`"up"`, `"down"` o `null`) → `200` mensaje. Solo mensajes del asistente (otro rol: 422 `feedback_no_permitido`).

### Códigos de error frecuentes

| error | HTTP | Cuándo |
|---|---|---|
| `token_invalido` | 401 | Sin token, vencido, o usuario desactivado |
| `requiere_admin` | 403 | Empleado llamando a un endpoint admin |
| `usuario_inactivo` | 403 | Login de una cuenta desactivada |
| `validacion_fallida` | 422 | Campo faltante, inválido o desconocido (`detalle.campos`) |
| `conversacion_no_encontrada`, `documento_no_encontrado`, `usuario_no_encontrado`, `fragmento_no_encontrado`, `mensaje_no_encontrado` | 404 | No existe o no tienes acceso |
| `documento_duplicado`, `email_duplicado`, `limite_conversaciones`, `limite_mensajes`, `no_puedes_eliminarte`, `no_puedes_degradarte` | 409 | Conflicto con el estado actual |
| `archivo_demasiado_grande` | 413 | Supera `MAX_UPLOAD_MB` |
| `cuerpo_demasiado_grande` | 413 | Cuerpo sobre 64 KB (en `POST /documents`: `MAX_UPLOAD_MB` + 1 MB); se corta antes de autenticar |
| `tipo_no_soportado` | 415 | Extensión distinta de PDF/DOCX/XLSX |
| `tipo_no_coincide` | 415 | El contenido no es del tipo que dice la extensión (firma `%PDF-`, ZIP con `word/document.xml` o `xl/workbook.xml`) |
| `archivo_sospechoso` | 415 | DOCX/XLSX con más de 200 MB descomprimidos o proporción de compresión mayor a 100 |
| `demasiados_intentos`, `demasiadas_consultas` | 429 | Límite de login (por IP y correo, por IP, o turno por cuenta) o de 10 preguntas/min; cabecera `Retry-After` en segundos |
| `llm_no_disponible` | 503 | Proveedor del LLM caído o sin clave |
| `error_interno` | 500 | Error no controlado (usar `ref` para buscar en el log) |
