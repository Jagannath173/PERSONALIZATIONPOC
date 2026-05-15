"""
Document ingest pipeline.

Given an uploaded file:
  1. Reject anything image-based or unsupported.
  2. Extract plain text (PDF / DOCX / PPTX / CSV / TXT / MD).
  3. Chunk to ~CHUNK_SIZE characters with overlap.
  4. Embed each chunk via the existing vector service.
  5. Insert each chunk into Milvus with portfolio_owner set to the
     assigned employee — this is what enforces RBAC isolation at search time.

Every insertion goes through `vector.insert_document`, which sets the
`portfolio_owner` field. The vector search service then filters by
`portfolio_owner in allowed_scopes`, so emp_1 can never see chunks tagged
to emp_2.
"""

from __future__ import annotations

import csv
import io
import uuid
from typing import List

from app.core.logging import get
from app.services import vector

log = get("ingest")

# Roughly 800 chars ≈ 200 tokens — small enough to be retrievable, big
# enough to carry a useful self-contained idea.
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

SUPPORTED_EXTS = {".pdf", ".docx", ".pptx", ".csv", ".txt", ".md"}
LEGACY_EXTS    = {".doc", ".ppt", ".xls"}      # rejected with friendly error


# ─── Extraction ──────────────────────────────────────────────────────────────
def extract_text(filename: str, data: bytes) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext in LEGACY_EXTS:
        raise ValueError(
            f"Legacy Office format ({ext}) is not supported. "
            f"Please save the file as the modern equivalent "
            f"(.docx / .pptx / .xlsx) and try again."
        )
    if ext not in SUPPORTED_EXTS:
        raise ValueError(
            f"Unsupported file type {ext or '(no extension)'}. "
            f"Allowed: {', '.join(sorted(SUPPORTED_EXTS))}"
        )

    if ext == ".pdf":   return _extract_pdf(data)
    if ext == ".docx":  return _extract_docx(data)
    if ext == ".pptx":  return _extract_pptx(data)
    if ext == ".csv":   return _extract_csv(data)
    # .txt / .md
    return data.decode("utf-8", errors="replace")


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for i, page in enumerate(reader.pages, 1):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            log.warning("pdf page %d extract failed: %s", i, e)
            text = ""
        if text.strip():
            pages.append(f"[Page {i}]\n{text}")
    return "\n\n".join(pages)


def _extract_docx(data: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(data))
    parts = []
    for p in doc.paragraphs:
        t = p.text.strip()
        if t:
            parts.append(t)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def _extract_pptx(data: bytes) -> str:
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    parts = []
    for i, slide in enumerate(prs.slides, 1):
        slide_lines = [f"[Slide {i}]"]
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = "".join(r.text for r in para.runs).strip()
                    if text:
                        slide_lines.append(text)
            elif shape.has_table:
                for row in shape.table.rows:
                    cells = [c.text.strip() for c in row.cells]
                    if any(cells):
                        slide_lines.append(" | ".join(cells))
        if len(slide_lines) > 1:
            parts.append("\n".join(slide_lines))
    return "\n\n".join(parts)


def _extract_csv(data: bytes) -> str:
    decoded = data.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(decoded)))
    if not rows:
        return ""
    # Render as a markdown-ish table — keeps the LLM happy at retrieval time.
    header, *body = rows
    out = [" | ".join(header)]
    out.append(" | ".join(["---"] * len(header)))
    for row in body:
        # pad/truncate to header width
        padded = (row + [""] * len(header))[: len(header)]
        out.append(" | ".join(padded))
    return "\n".join(out)


# ─── Chunking ────────────────────────────────────────────────────────────────
def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        # try to break at a sentence boundary near `end`
        if end < len(text):
            for sep in ("\n\n", "\n", ". "):
                cut = text.rfind(sep, start + size // 2, end)
                if cut != -1:
                    end = cut + len(sep)
                    break
        chunks.append(text[start:end].strip())
        start = max(end - overlap, end) if end < len(text) else end
    return [c for c in chunks if c]


# ─── Public API ──────────────────────────────────────────────────────────────
def ingest_file(
    *,
    filename: str,
    data: bytes,
    portfolio_owner: str,
    client_id: str = "general",
    document_type: str = "uploaded_document",
    uploaded_by: str,
) -> dict:
    """Extract → chunk → embed → insert. Returns ingest summary."""
    log.info("ingest start file=%r size=%d bytes target_owner=%s by=%s",
             filename, len(data), portfolio_owner, uploaded_by)

    text = extract_text(filename, data)
    if not text.strip():
        raise ValueError("Could not extract any text from the file (it may be image-only).")

    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("File parsed but produced no usable chunks.")

    doc_root = f"upload_{uuid.uuid4().hex[:10]}"
    inserted = []
    for i, chunk in enumerate(chunks, 1):
        doc_id = f"{doc_root}_p{i:03d}"
        content = (
            f"[Source: {filename} — chunk {i}/{len(chunks)}]\n{chunk}"
        )
        try:
            vector.insert_document(
                portfolio_owner=portfolio_owner,
                client_id=client_id,
                document_type=document_type,
                content=content,
                document_id=doc_id,
            )
            inserted.append(doc_id)
        except Exception as e:
            log.error("chunk insert failed (%s): %s", doc_id, e)

    log.info("ingest done file=%r chunks_inserted=%d/%d owner=%s client=%s",
             filename, len(inserted), len(chunks), portfolio_owner, client_id)

    return {
        "filename": filename,
        "portfolio_owner": portfolio_owner,
        "client_id": client_id,
        "document_type": document_type,
        "chunks_total": len(chunks),
        "chunks_inserted": len(inserted),
        "document_root": doc_root,
        "uploaded_by": uploaded_by,
    }
