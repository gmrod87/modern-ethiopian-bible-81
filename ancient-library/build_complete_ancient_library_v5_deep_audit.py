#!/usr/bin/env python3
"""The Ancient Library - deep textual/source-boundary audit v5.

Extends v4 by removing duplicated modern contents/front-matter blocks that precede
many ANF/NPNF mirror texts. This is intentionally conservative: a preamble is cut
only when an opening title block repeats later (the normal mirror pattern), plus a
small number of source-specific cases established during the audit.
"""
from __future__ import annotations

import importlib.util
import json
import re
from collections import Counter
from pathlib import Path

from weasyprint import HTML as WeasyHTML

HERE = Path(__file__).resolve().parent
V4_PATH = HERE / "build_complete_ancient_library_v4_critical_audit.py"
spec = importlib.util.spec_from_file_location("ancient_library_v4", V4_PATH)
v4 = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(v4)

v2 = v4.v3.v2
AUDIT_VERSION = "5.0"
AUDIT_DATE = "2026-08-23"

wdb_frontmatter_cleaned: list[str] = []
original_v4_add_section = v4.cleaned_audited_add_section


def _norm_block(block: str) -> str:
    return re.sub(r"\s+", " ", block).strip()


def _strip_duplicate_wdb_frontmatter(text: str, title: str) -> str:
    """Strip a duplicated mirror TOC/preamble only when the actual title repeats."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    if len(blocks) < 5:
        return text.strip()

    # Source-specific boundary: 1 Clement includes modern Eusebius/Jerome historical
    # introductions before the actual epistle. The ancient reading begins at Ch. I.
    if title == "1 Clement":
        for i, b in enumerate(blocks):
            if _norm_block(b).lower().startswith("chapter i.-the salutation"):
                return "\n\n".join(blocks[i:]).strip()

    # Source-specific boundary: Conybeare's 1910 publication begins with modern
    # scholarly framing. Retain the translated Dionysius letters, not the article intro.
    if title.startswith("Newly discovered letters to the Popes Stephen and Xystus"):
        for i, b in enumerate(blocks):
            if _norm_block(b).lower().startswith("i. of the blessed dionysius"):
                return "\n\n".join(blocks[i:]).strip()

    candidates = []
    for j, b in enumerate(blocks[:5]):
        n = _norm_block(b)
        if 4 <= len(n) <= 220:
            candidates.append((j, n))

    cut = None
    # Prefer a descriptive title block. Exact repetition is strong evidence that the
    # first occurrence was a generated contents/header block rather than source text.
    for j, anchor in candidates:
        if re.match(r"^(chapter|preface|argument)\b", anchor, re.I):
            continue
        for k in range(max(j + 3, 3), min(len(blocks), 200)):
            if _norm_block(blocks[k]) == anchor:
                cut = k
                break
        if cut is not None:
            break

    # Some book pages use only "Book I." as the repeated anchor.
    if cut is None:
        anchor = _norm_block(blocks[0])
        if len(anchor) <= 120:
            for k in range(6, min(len(blocks), 200)):
                if _norm_block(blocks[k]) == anchor:
                    cut = k
                    break

    if cut is None:
        return text.strip()

    kept = blocks[cut:]
    # Remove repository metadata immediately following the repeated work title.
    while len(kept) > 1 and re.match(
        r"^(date:|alternative sources:|source:|original source:)",
        _norm_block(kept[1]), re.I,
    ):
        kept.pop(1)
    return "\n\n".join(kept).strip()


def deep_clean_add_section(sections, used_sources, *, part, title, text, source, provenance, status, notes=""):
    if "historicalchristianfaith/writings-database" in source.lower():
        cleaned = _strip_duplicate_wdb_frontmatter(text, title)
        if cleaned != text.strip():
            wdb_frontmatter_cleaned.append(title)
            text = cleaned
            notes = (notes + (
                " Source cleanup: duplicated mirror contents/front matter preceding the ancient reading text was "
                "removed. The cut was made only at a repeated title boundary or an individually audited source boundary."
            )).strip()
    return original_v4_add_section(
        sections, used_sources,
        part=part, title=title, text=text, source=source,
        provenance=provenance, status=status, notes=notes,
    )


# v2's selection calls resolve add_section dynamically.
v2.add_section = deep_clean_add_section


def main() -> None:
    # Build the corpus directly so v2 selection uses all v3/v4/v5 patches.
    wdb = v2.SRC / "Writings-Database"
    fbe = v2.SRC / "biblical"
    v2.clone(v2.WDB_URL, wdb)
    v2.clone(v2.FBE_URL, fbe)

    sections, used_sources = [], set()
    coverage = [
        "# The Ancient Library - Source Coverage",
        "",
        "Critically audited historical reading edition. This report records the selected sources and source-boundary corrections.",
        "",
    ]
    v2.add_forgotten_books(sections, used_sources, fbe, coverage)
    v2.add_selected_wdb(sections, used_sources, wdb, coverage)
    v2.add_profiles(sections, used_sources)
    sections = v2.dedupe(sections)

    required = [
        "first book of adam", "second book of adam", "secrets of enoch", "psalms of solomon", "odes of solomon",
        "letter of aristeas", "maccabees", "ahikar", "testament of reuben", "1 clement", "2 clement",
        "shepherd of hermas", "ignatius", "polycarp", "irenaeus", "justin", "tertullian", "origen", "cyprian",
        "muratorian", "quadratus", "eusebius", "athanasius"
    ]
    source_haystack = "\n".join(
        " ".join([s.get("title", ""), s.get("text", "")[:500], s.get("source", ""), s.get("provenance", ""), s.get("notes", "")]).lower()
        for s in sections
    )
    true_missing = [marker for marker in required if marker not in source_haystack]

    tiers = Counter(s.get("audit", {}).get("tier", "UNCLASSIFIED") for s in sections)
    manifest = {
        "title": "The Ancient Library",
        "subtitle": "Critically Audited Historical Reading Edition",
        "edition": "Critically Audited Historical Reading Edition v5",
        "audit_version": AUDIT_VERSION,
        "audit_date": AUDIT_DATE,
        "editorial_policy": (
            "Historical reading library, not an expanded biblical canon. Source-file fidelity is distinguished from "
            "confidence about the earliest recoverable ancient wording. Explicitly AI/ChatGPT-marked selected source "
            "files are excluded. Modern navigation, introductions, duplicate contents blocks, and source apparatus are "
            "removed from the continuous ancient reading body where a reliable boundary can be established."
        ),
        "section_count": len(sections),
        "character_count": sum(s["chars"] for s in sections),
        "audit_tier_counts": dict(sorted(tiers.items())),
        "excluded_ai_marked_sources": sorted(set(v4.v3.excluded_ai_sources)),
        "required_core_missing": true_missing,
        "content_cleanup": {
            "fbe_sections_cleaned": sorted(set(v4.cleaned_fbe_sections)),
            "editorial_sections_excluded": sorted(set(v4.removed_editorial_sections)),
            "wdb_frontmatter_sections_cleaned": sorted(set(wdb_frontmatter_cleaned)),
            "aristides_policy": (
                "One complete identified 1891 J. Rendel Harris Syriac-witness translation retained; editorial apparatus "
                "and duplicate parallel translations excluded from the continuous reading corpus."
            ),
        },
        "sections": sections,
    }
    v2.JSONOUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    coverage.extend([
        "",
        "## Audit totals",
        f"- Total retained sections: {len(sections)}",
        f"- Total extracted characters: {sum(s['chars'] for s in sections):,}",
        f"- Confidence tiers: {dict(sorted(tiers.items()))}",
        f"- Explicit AI/ChatGPT-marked selected files excluded: {len(set(v4.v3.excluded_ai_sources))}",
        f"- FBE sections cleaned of modern/web boilerplate: {len(set(v4.cleaned_fbe_sections))}",
        f"- Pure editorial FBE sections excluded: {len(set(v4.removed_editorial_sections))}",
        f"- WDB sections cleaned at audited duplicate front-matter boundaries: {len(set(wdb_frontmatter_cleaned))}",
        f"- True missing core markers: {len(true_missing)}",
    ])
    v2.REPORT.write_text("\n".join(coverage) + "\n", encoding="utf-8")

    audit_lines = [
        "# The Ancient Library - Deep Textual Audit",
        "",
        f"Audit version: {AUDIT_VERSION}",
        f"Audit date: {AUDIT_DATE}",
        "",
        "## Audit standard",
        "",
        "This is a source-provenance and reading-text audit, not a claim that nineteenth- or early twentieth-century English translations supersede modern critical editions.",
        "",
        "- Each retained section has a SHA-256 content fingerprint and confidence tier.",
        "- Explicitly self-declared AI/ChatGPT translations in selected upstream files are rejected.",
        "- The mixed-source Writings Database is not treated as a uniform translation authority.",
        "- Sacred-Texts/Platt web navigation, modern introductions and chapter summaries are removed where safely separable.",
        "- Duplicated ANF/NPNF mirror contents/front matter is removed only at a repeated title boundary or individually audited boundary.",
        "- Complex-recension works remain lower-confidence even when copied perfectly from their selected English witness.",
        "",
        "## Results",
        "",
        f"- Retained sections: {len(sections)}",
        f"- Confidence tiers: {dict(sorted(tiers.items()))}",
        f"- Explicit AI/ChatGPT-marked selected sources excluded: {len(set(v4.v3.excluded_ai_sources))}",
        f"- Purely editorial FBE sections excluded: {sorted(set(v4.removed_editorial_sections))}",
        f"- WDB duplicate/front-matter sections cleaned: {len(set(wdb_frontmatter_cleaned))}",
        f"- True missing required core markers: {true_missing}",
        "",
        "## Confidence tiers",
        "",
        "- A-: named established historical edition/translation visible in the source path; strong reading-edition confidence, but a modern critical edition still governs exact scholarly quotation.",
        "- B / B-: useful historical translation with high source-file fidelity; exact translation pedigree or ancient wording warrants critical-edition checking for quotation-level scholarship.",
        "- C: complex manuscript/recension history; retained as a historical reading witness, not represented as one indisputable original text.",
        "- EDITORIAL: modern collection/manuscript profile, not ancient translated text.",
    ]
    v4.v3.AUDIT_REPORT.write_text("\n".join(audit_lines) + "\n", encoding="utf-8")

    # Render once using v2's proven book renderer, then amend its front matter in HTML
    # and render the final audited PDF. (The first render is discarded.)
    v2.render_book(sections)
    html_path = v2.HTMLFILE
    html_text = html_path.read_text(encoding="utf-8")
    html_text = html_text.replace("Complete Historical Reading Edition", "Critically Audited Historical Reading Edition")
    html_text = html_text.replace(
        "<h1>Editorial Statement</h1>",
        "<h1>Editorial Statement</h1><p><b>Deep textual audit:</b> The continuous reading text has been separated from identifiable modern navigation, source introductions, duplicate contents blocks, and editorial apparatus. Each work carries a confidence tier distinguishing source-copy fidelity from ancient-text reconstruction certainty.</p>",
        1,
    )
    html_path.write_text(html_text, encoding="utf-8")
    WeasyHTML(filename=str(html_path)).write_pdf(str(v2.PDF))

    print(
        "DEEP AUDIT BUILD",
        f"sections={len(sections)}",
        f"chars={sum(s['chars'] for s in sections)}",
        f"tiers={dict(sorted(tiers.items()))}",
        f"ai_excluded={len(set(v4.v3.excluded_ai_sources))}",
        f"fbe_cleaned={len(set(v4.cleaned_fbe_sections))}",
        f"editorial_excluded={len(set(v4.removed_editorial_sections))}",
        f"wdb_frontmatter_cleaned={len(set(wdb_frontmatter_cleaned))}",
        f"true_missing={true_missing}",
        flush=True,
    )


if __name__ == "__main__":
    main()
