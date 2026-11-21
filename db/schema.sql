-- Esquema de DocuLocal (PostgreSQL 17 + pgvector). Recrea todo desde cero.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS message_sources;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext NOT NULL UNIQUE,
    password_hash text NOT NULL,
    display_name  text NOT NULL,
    role          text NOT NULL CHECK (role IN ('employee', 'admin')),
    access_level  smallint NOT NULL CHECK (access_level BETWEEN 1 AND 3),
    department    text,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name text NOT NULL,
    stored_name   text NOT NULL,
    mime_type     text NOT NULL,
    size_bytes    bigint NOT NULL,
    checksum      char(64) NOT NULL UNIQUE,
    access_level  smallint NOT NULL CHECK (access_level BETWEEN 1 AND 3),
    department    text,
    status        text NOT NULL DEFAULT 'Procesando' CHECK (status IN ('Procesando', 'Indexado', 'Error')),
    error_message text,
    page_count    integer,
    chunk_count   integer NOT NULL DEFAULT 0,
    uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index integer NOT NULL,
    page        integer,
    content     text NOT NULL,
    embedding   vector(768),
    tsv         tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED,
    UNIQUE (document_id, chunk_index)
);
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_tsv ON chunks USING gin (tsv);
CREATE INDEX idx_chunks_document ON chunks (document_id);

CREATE TABLE conversations (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      varchar(120) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_user ON conversations (user_id, updated_at DESC);

CREATE TABLE messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('user', 'assistant')),
    content         text NOT NULL,
    feedback        text CHECK (feedback IN ('up', 'down')),
    grounded        boolean,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE message_sources (
    message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    ref_number  integer NOT NULL,
    chunk_id    uuid REFERENCES chunks(id) ON DELETE SET NULL,
    document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
    filename    text NOT NULL,
    page        integer,
    score       real NOT NULL,
    snippet     text NOT NULL,
    PRIMARY KEY (message_id, ref_number)
);

CREATE TABLE audit_log (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    action      text NOT NULL,
    resource    text NOT NULL,
    resource_id text,
    detail      jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_log (created_at);
