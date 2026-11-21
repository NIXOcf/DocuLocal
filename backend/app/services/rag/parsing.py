"""Extracción de texto por página. Devuelve [(página | None, texto)] sin páginas vacías."""
import re
from pathlib import Path

from docx import Document
from docx.table import Table
from openpyxl import load_workbook
from pypdf import PdfReader

Pages = list[tuple[int | None, str]]


def normalize(text: str) -> str:
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # palabra cortada por guion al fin de línea
    text = re.sub(r"[ \t ]+", " ", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _parse_pdf(path: Path) -> Pages:
    return [(i, normalize(page.extract_text() or "")) for i, page in enumerate(PdfReader(path).pages, start=1)]


def _parse_docx(path: Path) -> Pages:
    lines: list[str] = []
    for block in Document(str(path)).iter_inner_content():
        if isinstance(block, Table):
            for row in block.rows:
                lines.append(" | ".join(c.text.strip() for c in row.cells if c.text.strip()))
        else:
            lines.append(block.text)
    return [(None, normalize("\n".join(lines)))]


def _parse_xlsx(path: Path) -> Pages:
    wb = load_workbook(path, read_only=True, data_only=True)
    pages: Pages = []
    for number, sheet in enumerate(wb.worksheets, start=1):
        rows = [r for r in sheet.iter_rows(values_only=True) if any(c is not None for c in r)]
        if not rows:
            continue
        header = [str(c) if c is not None else f"col{j}" for j, c in enumerate(rows[0], start=1)]
        lines = [f"Hoja: {sheet.title}"]
        for row in rows[1:]:
            lines.append("; ".join(f"{header[j]}: {c}" for j, c in enumerate(row) if c is not None and j < len(header)))
        pages.append((number, normalize("\n".join(lines))))
    wb.close()
    return pages


_PARSERS = {".pdf": _parse_pdf, ".docx": _parse_docx, ".xlsx": _parse_xlsx}


def extract_pages(path: Path) -> Pages:
    pages = _PARSERS[path.suffix.lower()](path)
    return [(n, t) for n, t in pages if t]
