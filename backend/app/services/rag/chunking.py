import re
from dataclasses import dataclass

CHUNK_SIZE = 900
OVERLAP = 150
MIN_CHARS = 40
_BREAKS = ("\n\n", "\n", ". ", "; ", " ")  # de mayor a menor preferencia


@dataclass
class Chunk:
    index: int
    page: int | None
    content: str


def _find_end(text: str, start: int, size: int) -> int:
    end = start + size
    if end >= len(text):
        return len(text)
    low = start + size // 2  # no cortar demasiado pronto
    for sep in _BREAKS:
        pos = text.rfind(sep, low, end)
        if pos != -1:
            return pos + len(sep)
    return end


def split_text(text: str, size: int = CHUNK_SIZE, overlap: int = OVERLAP) -> list[str]:
    parts: list[str] = []
    start = 0
    while start < len(text):
        end = _find_end(text, start, size)
        parts.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
        ws = re.compile(r"\s").search(text, start, end)  # el solape empieza en límite de palabra
        if ws:
            start = ws.end()
    return [p for p in parts if len(p) >= MIN_CHARS]


def chunk_pages(pages: list[tuple[int | None, str]]) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page, text in pages:
        for content in split_text(text):
            chunks.append(Chunk(len(chunks), page, content))
    return chunks
