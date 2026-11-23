"""Recuperación híbrida filtrada por permisos: vectorial + texto -> RRF -> rerank -> umbral -> diversidad."""
import logging
import time
from dataclasses import dataclass

from app.core.config import get_settings
from app.repositories import chunk_repository
from app.services.rag import embeddings, reranker
from app.services.rag.query_planner import QueryPlan

logger = logging.getLogger("doculocal.recuperacion")

PER_LIST_K = 20
RRF_K = 60
CANDIDATES = 15  # antes 30: rerank ~lineal en pares; validar recall con scripts/eval_rag.py
MAX_PER_DOCUMENT = 3


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    content: str  # texto del fragmento (se muestra como extracto de la fuente)
    context: str  # content + fragmento vecino, es lo que ve el LLM
    score: float  # puntaje del reranker
    chunk_index: int = 0


def rrf_fuse(ranked_lists: list[list[str]], k: int = RRF_K) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion: suma 1/(k+posición) por lista; devuelve (id, puntaje) de mayor a menor."""
    scores: dict[str, float] = {}
    for ids in ranked_lists:
        for pos, item in enumerate(ids, start=1):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + pos)
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)


def diversify(items: list, max_per_doc: int, limit: int, key=lambda x: x.document_id) -> list:
    """Conserva el orden, limitando cuántos elementos aporta cada documento."""
    counts: dict[str, int] = {}
    out = []
    for item in items:
        doc = key(item)
        if counts.get(doc, 0) >= max_per_doc:
            continue
        counts[doc] = counts.get(doc, 0) + 1
        out.append(item)
        if len(out) == limit:
            break
    return out


def retrieve(question: str, plan: QueryPlan, user: dict) -> list[RetrievedChunk]:
    settings = get_settings()
    level, dept = user["access_level"], user["department"]
    rows_by_id: dict[str, dict] = {}
    ranked_lists: list[list[str]] = []

    def add(rows: list[dict]) -> None:
        for r in rows:
            rows_by_id[str(r["id"])] = r
        ranked_lists.append([str(r["id"]) for r in rows])

    queries = plan.subqueries or [question]
    t = time.perf_counter()
    query_vectors = embeddings.embed_documents(queries)
    ms_embed = round((time.perf_counter() - t) * 1000)
    for q, emb in zip(queries, query_vectors):
        add(chunk_repository.search_vector(emb, PER_LIST_K, level, dept))
        add(chunk_repository.search_text(q, PER_LIST_K, level, dept))
    if plan.keywords:
        add(chunk_repository.search_text(plan.keywords, PER_LIST_K, level, dept))

    candidates = [cid for cid, _ in rrf_fuse([lst for lst in ranked_lists if lst])[:CANDIDATES]]
    if not candidates:
        logger.info("Recuperación sin candidatos subconsultas=%d embeddings_ms=%d", len(queries), ms_embed)
        return []
    t = time.perf_counter()
    scores = reranker.rerank(plan.search_question or question, [rows_by_id[c]["content"] for c in candidates])
    ms_rerank = round((time.perf_counter() - t) * 1000)
    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    relevant = [(c, s) for c, s in ranked if s >= settings.rerank_min_score]
    logger.info("Recuperación subconsultas=%d candidatos=%d mejor_puntaje=%.2f umbral=%.2f relevantes=%d "
                "embeddings_ms=%d rerank_ms=%d", len(queries), len(candidates), ranked[0][1],
                settings.rerank_min_score, len(relevant), ms_embed, ms_rerank)
    chosen = diversify(relevant, MAX_PER_DOCUMENT, settings.retrieval_top_k, key=lambda cs: rows_by_id[cs[0]]["document_id"])

    chosen_ids = {c for c, _ in chosen}
    used_neighbors: set[str] = set()
    result = []
    for cid, score in chosen:
        r = rows_by_id[cid]
        neighbors = chunk_repository.get_neighbors(str(r["document_id"]), r["chunk_index"], level, dept)
        # Prefiere el siguiente (continúa la idea); si no hay, el anterior. Nunca uno ya incluido.
        neighbors.sort(key=lambda n: n["chunk_index"] < r["chunk_index"])
        extra = next((n for n in neighbors if str(n["id"]) not in chosen_ids | used_neighbors), None)
        context = r["content"]
        if extra:
            used_neighbors.add(str(extra["id"]))
            page = f" (página {extra['page']})" if extra["page"] else ""
            context += f"\n[continuación{page}] {extra['content']}"
        result.append(RetrievedChunk(cid, str(r["document_id"]), r["filename"], r["page"], r["content"],
                                     context, score, r["chunk_index"]))
    return result
