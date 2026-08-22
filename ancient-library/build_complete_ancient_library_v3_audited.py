#!/usr/bin/env python3
"""Build The Ancient Library - Audited Historical Reading Edition v3.

This layer runs the v2 corpus builder but adds a provenance/textual-risk audit:
- Rejects selected upstream files that self-identify as AI/ChatGPT translations.
- Gives every section a textual-confidence tier and explicit audit note.
- Separates fidelity to the selected English source from confidence about the
  recoverable ancient wording/manuscript tradition.
- Produces a machine-readable audit summary and a human-readable TEXTUAL_AUDIT.md.

The audit is deliberately conservative. Passing it does NOT mean that a historical
English translation is equivalent to a modern critical edition.
"""
from __future__ import annotations

import importlib.util
import json
import re
from collections import Counter
from pathlib import Path

from weasyprint import HTML as WeasyHTML

HERE = Path(__file__).resolve().parent
V2_PATH = HERE / "build_complete_ancient_library_v2.py"

spec = importlib.util.spec_from_file_location("ancient_library_v2", V2_PATH)
v2 = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(v2)

AUDIT_DATE = "2026-08-23"
AUDIT_VERSION = "3.0"
AUDIT_REPORT = v2.OUT / "TEXTUAL_AUDIT.md"

# Strong markers only. A mere reference to Migne is NOT an AI marker: Migne is a
# historical printed edition and is frequently cited inside trustworthy translations.
AI_TRANSLATION_MARKERS = (
    "translated into english via chatgpt",
    "translated by chatgpt",
    "translation by chatgpt",
    "chatgpt translation",
    "machine translated by chatgpt",
    "translated using chatgpt",
)

# Works whose surviving textual history is especially complex. The assigned tier is
# about confidence that this historical English reading edition closely represents a
# single recoverable ancient form, not about whether the source file was copied right.
COMPLEX_TRANSMISSION_PATTERNS = (
    "first book of adam",
    "second book of adam",
    "secrets of enoch",
    "odes of solomon",
    "story of ahikar",
    "testament of reuben",
    "testament of simeon",
    "testament of levi",
    "testament of judah",
    "testament of issachar",
    "testament of zebulun",
    "testament of dan",
    "testament of naphtali",
    "testament of gad",
    "testament of asher",
    "testament of joseph",
    "testament of benjamin",
)

MODERATE_TRANSMISSION_PATTERNS = (
    "psalms of solomon",
    "letter of aristeas",
    "fourth book of maccabees",
    "muratorian",
    "papias",
    "quadratus",
)

excluded_ai_sources: list[str] = []
original_add_section = v2.add_section
original_add_path = v2.add_path


def _source_audit(title: str, source: str, status: str) -> dict:
    key = f"{title} {source}".lower()

    if status == "Historical manuscript profile":
        return {
            "tier": "EDITORIAL",
            "ancient_text_confidence": "Not applicable - editorial profile",
            "source_fidelity": "Editorial summary, not an ancient-text transcription",
            "basis": "Modern editorial profile included for collection history.",
        }

    if "fresh translation of preserved fragment" in status.lower():
        return {
            "tier": "B",
            "ancient_text_confidence": "Moderate-high for the preserved fragment; the complete work is lost",
            "source_fidelity": "High for the short preserved passage",
            "basis": "Short fragment preserved by an ancient witness; modern rendering is transparent but not a full lost work.",
        }

    if "beaudamore/biblical" in source.lower():
        if any(p in key for p in COMPLEX_TRANSMISSION_PATTERNS):
            return {
                "tier": "C",
                "ancient_text_confidence": "Moderate - multiple languages, recensions, or difficult transmission history",
                "source_fidelity": "High to the selected public-domain English witness",
                "basis": "Historical reading witness retained, but it must not be treated as a unique reconstructed original.",
            }
        return {
            "tier": "B-",
            "ancient_text_confidence": "Moderate-high for general sense; wording should be checked against a modern critical edition",
            "source_fidelity": "High to the selected public-domain English witness",
            "basis": "Public-domain historical translation supplied through the Forgotten Books of Eden extracted-text mirror.",
        }

    if "historicalchristianfaith/writings-database" in source.lower():
        named = "lightfoot" in key or "-anf" in key or "%20anf" in key
        return {
            "tier": "A-" if named else "B",
            "ancient_text_confidence": (
                "High for a historical reading translation; quotation-level wording should still be checked against a critical edition"
                if named else
                "Moderate-high for general sense; exact translation pedigree/critical text is not always encoded in the mirror path"
            ),
            "source_fidelity": "High to the selected upstream file",
            "basis": (
                "Named historical translation/edition is visible in the source path."
                if named else
                "The upstream Writings Database is a mixed-source mirror. This specific selected file passed the AI-translation marker screen, but repository membership alone is not treated as proof of a critical edition."
            ),
        }

    if "wikisource.org" in source.lower() and "murator" in key:
        return {
            "tier": "B",
            "ancient_text_confidence": "Moderate - damaged Latin witness and debated reconstruction at points",
            "source_fidelity": "High to the selected public-domain ANF rendering",
            "basis": "Historical translation of a defective manuscript witness; lacunae and reconstruction remain explicit uncertainties.",
        }

    return {
        "tier": "B",
        "ancient_text_confidence": "Moderate-high as a historical reading witness",
        "source_fidelity": "High to the selected source",
        "basis": "Retained with explicit provenance; use a critical edition for quotation-level textual decisions.",
    }


def audited_add_section(sections, used_sources, *, part, title, text, source, provenance, status, notes=""):
    audit = _source_audit(title, source, status)
    audit_note = (
        f"Textual audit {AUDIT_DATE}: Tier {audit['tier']}. "
        f"Source-file fidelity: {audit['source_fidelity']}. "
        f"Ancient-text confidence: {audit['ancient_text_confidence']}. "
        f"{audit['basis']}"
    )
    combined_notes = (notes.strip() + " " + audit_note).strip() if notes else audit_note
    added = original_add_section(
        sections, used_sources,
        part=part, title=title, text=text, source=source,
        provenance=provenance, status=status, notes=combined_notes,
    )
    if added:
        sections[-1]["audit"] = audit
        sections[-1]["audit_date"] = AUDIT_DATE
    return added


def audited_add_path(sections, used_sources, repo, path, part, *, title=None, provenance=None,
                     status="Public-domain historical translation", notes=""):
    if not path.exists():
        return False
    raw = path.read_text(encoding="utf-8", errors="ignore")
    lower_raw = raw.lower()
    rel = str(path.relative_to(repo)).replace("\\", "/")
    if any(marker in lower_raw for marker in AI_TRANSLATION_MARKERS):
        excluded_ai_sources.append(rel)
        print(f"AUDIT EXCLUDE AI-MARKED SOURCE: {rel}", flush=True)
        return False

    rel_lower = rel.lower()
    if provenance is None:
        if "lightfoot" in rel_lower or "anf" in rel_lower:
            provenance = (
                "Named public-domain historical translation/edition preserved in the Historical Christian Faith "
                "Writings Database. The edition/translator indicator is visible in the selected source path."
            )
        else:
            provenance = (
                "Historical English text preserved in the Historical Christian Faith Writings Database. "
                "That database is a mixed-source aggregation (including ANF/NPNF, Roger Pearse material, and some "
                "separately identified AI-translated Migne material). This selected file passed this edition's "
                "strong AI-translation marker screen; its exact translation pedigree is not asserted where the "
                "file itself does not identify it."
            )
    return original_add_path(
        sections, used_sources, repo, path, part,
        title=title, provenance=provenance, status=status, notes=notes,
    )


# Monkey-patch the functions used dynamically by v2.main(). original_add_path calls
# v2.add_section by global lookup, so it picks up audited_add_section below.
v2.add_section = audited_add_section
v2.add_path = audited_add_path


def _amend_rendered_edition() -> None:
    """Amend the rendered HTML front matter and regenerate the PDF."""
    html_text = v2.HTMLFILE.read_text(encoding="utf-8")
    html_text = html_text.replace(
        "Complete Historical Reading Edition",
        "Audited Historical Reading Edition",
    )
    audit_front = (
        "<p><b>Textual Audit:</b> Every included section now carries a confidence tier. "
        "The audit distinguishes faithful reproduction of the selected English source from the harder question "
        "of how closely that translation represents the earliest recoverable ancient text. Files that explicitly "
        "self-identify as ChatGPT/AI translations are excluded by the build. A Tier C text is not 'false'; it means "
        "the manuscript/recension history prevents this reading edition from claiming critical-edition certainty.</p>"
    )
    html_text = html_text.replace("<h1>Editorial Statement</h1>", "<h1>Editorial Statement</h1>" + audit_front, 1)
    v2.HTMLFILE.write_text(html_text, encoding="utf-8")
    WeasyHTML(filename=str(v2.HTMLFILE)).write_pdf(str(v2.PDF))


def _postprocess_manifest_and_report() -> None:
    manifest = json.loads(v2.JSONOUT.read_text(encoding="utf-8"))
    sections = manifest.get("sections", [])

    # Source-aware completeness: author names may be in source paths/provenance even
    # when not repeated in the selected title/text excerpt (e.g. Origen / Against Celsus).
    missing = list(manifest.get("required_core_missing", []))
    source_haystack = "\n".join(
        " ".join([s.get("title", ""), s.get("source", ""), s.get("provenance", ""), s.get("notes", "")]).lower()
        for s in sections
    )
    source_confirmed = [m for m in missing if m.lower() in source_haystack]
    true_missing = [m for m in missing if m not in source_confirmed]

    tiers = Counter(s.get("audit", {}).get("tier", "UNCLASSIFIED") for s in sections)
    manifest.update({
        "subtitle": "Audited Historical Reading Edition",
        "edition": "Audited Historical Reading Edition v3",
        "audit_version": AUDIT_VERSION,
        "audit_date": AUDIT_DATE,
        "audit_policy": (
            "Source fidelity and ancient-text reconstruction are scored separately. Explicitly AI/ChatGPT-marked "
            "upstream translations are excluded. Historical translations with unresolved exact edition pedigree "
            "remain included only with a caution tier and are not represented as critical editions or autographs."
        ),
        "audit_tier_counts": dict(sorted(tiers.items())),
        "excluded_ai_marked_sources": sorted(set(excluded_ai_sources)),
        "source_confirmed_markers": source_confirmed,
        "required_core_missing": true_missing,
    })
    v2.JSONOUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# The Ancient Library - Textual Audit",
        "",
        f"Audit version: {AUDIT_VERSION}",
        f"Audit date: {AUDIT_DATE}",
        "",
        "## What this audit can and cannot certify",
        "",
        "- It can verify that the reading edition reproduces the selected digital source files and records a SHA-256 for each extracted section.",
        "- It screens selected Writings Database files for strong self-declared ChatGPT/AI-translation markers and excludes matches.",
        "- It does not claim that every historical English translation equals the latest Greek/Latin/Syriac/Ge'ez/Slavonic critical text.",
        "- Works with multiple recensions or indirect transmission are intentionally given a lower confidence tier even when the English source was copied perfectly.",
        "",
        "## Confidence tiers",
        "",
        "- A-: named established historical edition/translation visible in the source path; strong reading-edition confidence, but critical editions still govern exact quotations.",
        "- B / B-: useful historical translation with good source-file fidelity; exact translation pedigree or ancient wording needs critical-edition checking for scholarly quotation.",
        "- C: complex manuscript/recension history; retained as a historical witness, not presented as a single reconstructed original.",
        "- EDITORIAL: modern collection/manuscript profile, not a translated ancient text.",
        "",
        "## Results",
        "",
        f"- Sections audited: {len(sections)}",
        f"- Tier counts: {dict(sorted(tiers.items()))}",
        f"- Explicit AI/ChatGPT-marked selected sources excluded: {len(set(excluded_ai_sources))}",
        f"- True missing core markers after source-aware verification: {len(true_missing)}",
        "",
        "## Important provenance finding",
        "",
        "The Historical Christian Faith Writings Database is a mixed-source aggregation. Its repository documentation states that it includes ANF/NPNF, Roger Pearse material, and some Migne material translated into English via ChatGPT. This audit therefore does not treat that repository as a uniform translation authority. Selected files are screened and individually cautioned; no selected file is upgraded to critical-edition status merely because it appears in the mirror.",
        "",
        "## Excluded AI-marked selected files",
        "",
    ]
    if excluded_ai_sources:
        lines.extend(f"- {p}" for p in sorted(set(excluded_ai_sources)))
    else:
        lines.append("- None of the selected files triggered the strong self-declared AI-translation marker screen.")

    AUDIT_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Also append the audit result to the source coverage report.
    with v2.REPORT.open("a", encoding="utf-8") as f:
        f.write("\n## Textual audit v3\n")
        f.write(f"- Sections audited: {len(sections)}\n")
        f.write(f"- Tier counts: {dict(sorted(tiers.items()))}\n")
        f.write(f"- Explicit AI/ChatGPT-marked selected sources excluded: {len(set(excluded_ai_sources))}\n")
        f.write(f"- True missing core markers after source-aware verification: {len(true_missing)}\n")


def main() -> None:
    v2.SUBTITLE = "Audited Historical Reading Edition"
    v2.session.headers.update({"User-Agent": "AncientLibraryAuditedEdition/3.0"})
    v2.main()
    _postprocess_manifest_and_report()
    _amend_rendered_edition()

    data = json.loads(v2.JSONOUT.read_text(encoding="utf-8"))
    print(
        "AUDITED BUILD",
        f"sections={data['section_count']}",
        f"tiers={data['audit_tier_counts']}",
        f"ai_excluded={len(data['excluded_ai_marked_sources'])}",
        f"true_missing={data['required_core_missing']}",
        flush=True,
    )


if __name__ == "__main__":
    main()
