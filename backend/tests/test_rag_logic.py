"""Lógica pura del RAG: sin base de datos ni red."""
import json
from types import SimpleNamespace

from app.services.rag.generator import (extract_citations, normalize_citations, renumber_citations,
                                        verify_citations)
from app.services.rag.query_planner import MAX_SUBQUERIES, parse_plan
from app.services.rag.retriever import diversify, rrf_fuse


def test_rrf_orders_by_fused_rank():
    fused = rrf_fuse([["a", "b", "c"], ["b", "a", "d"], ["b"]])
    ids = [i for i, _ in fused]
    assert ids[0] == "b"  # aparece primero/segundo en las tres listas
    assert set(ids) == {"a", "b", "c", "d"}
    assert dict(fused)["a"] == 1 / 61 + 1 / 62  # k=60, posiciones 1 y 2
    assert dict(fused)["d"] < dict(fused)["c"] + 1  # puntajes finitos y comparables


def test_rrf_empty():
    assert rrf_fuse([]) == []


def test_extract_citations_variants():
    assert extract_citations("Dato [2]. Otro [1, 3] y [2][4].") == [2, 1, 3, 4]
    assert extract_citations("Sin citas") == []
    assert extract_citations(normalize_citations("Texto【1】 y 【3†L5-L9】")) == [1, 3]


def test_verify_drops_nonexistent_citations():
    text, valid = verify_citations("A [1] B [7] C [2, 9].", n_chunks=3)
    assert valid == [1, 2]
    assert "7" not in text and "9" not in text
    assert text == "A [1] B C [2]."


def test_renumber_in_order_of_first_appearance():
    text, cited = verify_citations("Primero [3], luego [1][3].", n_chunks=4)
    assert cited == [3, 1]
    assert renumber_citations(text, cited) == "Primero [1], luego [2][1]."


def test_planner_invalid_json_falls_back():
    for raw in ("no es json", "[1, 2]", "", "null"):
        plan = parse_plan(raw, "¿Cuántos días?")
        assert (plan.tipo, plan.subqueries, plan.search_question) == ("documental", ["¿Cuántos días?"], "¿Cuántos días?")


def test_planner_sanitizes_fields():
    raw = json.dumps({"tipo": "raro", "subconsultas": ["a", 5, "  ", "b", "c", "d", "e"], "palabras_clave": 3})
    plan = parse_plan(raw, "q")
    assert plan.tipo == "documental"  # tipo desconocido -> documental
    assert plan.subqueries == ["a", "b", "c", "d"][:MAX_SUBQUERIES]
    assert plan.keywords == ""
    assert plan.search_question == "q"  # sin pregunta_busqueda -> la original
    good = parse_plan(json.dumps({"pregunta_busqueda": " ¿Días de feriado de los trabajadores? "}), "¿Cuántos tengo?")
    assert good.search_question == "¿Días de feriado de los trabajadores?"
    ok = parse_plan(json.dumps({"tipo": "saludo", "subconsultas": [], "palabras_clave": "x y"}), "hola")
    assert (ok.tipo, ok.subqueries, ok.keywords) == ("saludo", ["hola"], "x y")


def test_diversify_limits_per_document_and_total():
    items = [SimpleNamespace(document_id=d, n=i) for i, d in enumerate("AAAABBC")]
    out = diversify(items, max_per_doc=3, limit=10)
    assert [i.n for i in out] == [0, 1, 2, 4, 5, 6]  # el 4.º de A se descarta
    assert len(diversify(items, max_per_doc=3, limit=2)) == 2
