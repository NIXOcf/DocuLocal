# Base de datos de DocuLocal

PostgreSQL 17 con pgvector, citext y pgcrypto. El esquema completo está en `schema.sql`.

![Modelo de datos](modelo_datos.png)

```mermaid
erDiagram
    users ||--o{ documents : "sube (uploaded_by)"
    users ||--o{ conversations : tiene
    users ||--o{ audit_log : genera
    documents ||--o{ chunks : contiene
    conversations ||--o{ messages : contiene
    messages ||--o{ message_sources : cita
    chunks ||--o{ message_sources : origen
    documents ||--o{ message_sources : origen
    users {
        uuid id PK
        citext email UK
        text role
        smallint access_level
        text department
        bool is_active
    }
    documents {
        uuid id PK
        char64 checksum UK
        smallint access_level
        text department
        text status
        int chunk_count
    }
    chunks {
        uuid id PK
        uuid document_id FK
        int chunk_index
        int page
        vector768 embedding
        tsvector tsv
    }
    conversations {
        uuid id PK
        uuid user_id FK
        varchar title
    }
    messages {
        uuid id PK
        uuid conversation_id FK
        text role
        text feedback
        bool grounded
    }
    message_sources {
        uuid message_id PK
        int ref_number PK
        uuid chunk_id FK
        uuid document_id FK
        real score
    }
    audit_log {
        bigint id PK
        uuid user_id FK
        text action
        jsonb detail
    }
```

## Crear la base

1. Copia `.env.example` a `.env` (trae valores de desarrollo).
2. Desde la raíz del repo: `docker compose up -d db`

Al crearse el volumen por primera vez, Postgres ejecuta `db/schema.sql` automáticamente.

## Recrearla desde cero (borra todos los datos)

```
docker compose down -v
docker compose up -d db
```
