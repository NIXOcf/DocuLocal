from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import AccessLevel, CamelInput, CamelModel

DocumentStatus = str  # 'Procesando' | 'Indexado' | 'Error'


class DocumentOut(CamelModel):
    id: UUID
    name: str
    size: str
    size_bytes: int
    uploaded_at: datetime
    status: DocumentStatus
    access_level: AccessLevel
    department: str | None
    page_count: int | None
    chunk_count: int
    error_message: str | None


class DocumentUpdate(CamelInput):
    access_level: AccessLevel | None = None
    department: str | None = Field(default=None, max_length=80)


class ChunkOut(CamelModel):
    id: UUID
    document_id: UUID
    filename: str
    page: int | None
    content: str
