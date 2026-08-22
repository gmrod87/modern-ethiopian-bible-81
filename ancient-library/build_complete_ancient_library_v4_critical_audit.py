#!/usr/bin/env python3
"""The Ancient Library - critical-source audit/cleanup layer (v4).

Adds two corrections discovered during the textual audit:
1. Forgotten Books of Eden mirrors contain Sacred-Texts navigation, Platt editorial
   introductions, and modern chapter summaries. These are removed from the ancient
   reading text while the source/provenance remains recorded.
2. The Aristides folder contains editorial apparatus and duplicate translations.
   The reading corpus now keeps one complete, explicitly identified 1891 Syriac
   translation (J. Rendel Harris) rather than treating title pages/intros/appendices
   as separate ancient works.
"""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

from weasyprint import HTML as WeasyHTML

HERE = Path(__file__).resolve().parent
V3_PATH = HERE / "build_complete_ancient_library_v3_audited.py"
spec = importlib.util.spec_from_file_location("ancient_library_v3", V3_PATH)
v3 = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(v3)

v3.AUDIT_VERSION = "4.0"
v3.AUDIT_DATE = "2026-08-23"

removed_editorial_sections: list[str] = []
cleaned_fbe_sections: list[str] = []
original_v3_add_section = v3.audited_add_section
original_add_tree = v3.v2.add_tree

NAV_EXACT = {
    "Sacred Texts", "Bible", "Apocrypha", "Index", "Previous", "Next",
    "The Forgotten Books of Eden",
}


def _strip_fbe_boilerplate(text: str, title: str) -> str:
    """Remove modern web/editorial matter while preserving the historical translation."""
    lines = text.replace("\r", "").splitlines()
    kept = []
    for line in lines:
        s = line.strip()
        if not s:
            kept.append("")
            continue
        if s in NAV_EXACT:
            continue
        if re.match(r"^#{1,6}\s+", s):
            continue
        if re.match(r"^Next:\s+", s, re.I):
            continue
        if re.match(r"^p\.\s*\d+\s*$", s, re.I):
            continue
        if "by Rutherford H. Platt, Jr." in s and "sacred-texts.com" in s:
            continue
        kept.append(s)
    text = "\n".join(kept)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    low_title = title.lower()
    # The aggregate Testaments introduction is modern editorial apparatus, not a
    # thirteenth ancient testament. Its individual twelve works are already included.
    if low_title == "the testaments of the twelve patriarchs":
        return ""

    start_patterns = []
    if "odes of solomon" in low_title:
        start_patterns = [r"(?m)^ODE\s+1\.$"]
    elif "psalms of solomon" in low_title:
        start_patterns = [r"(?m)^I$"]
    elif "secrets of enoch" in low_title:
        start_patterns = [r"(?m)^I\.$"]
    elif any(k in low_title for k in (
        "adam and eve", "letter of aristeas", "fourth book of maccabees",
        "story of ahikar", "testament of ", "the testament of ",
    )):
        start_patterns = [r"(?m)^CHAP\.\s*I\.$"]

    for pat in start_patterns:
        m = re.search(pat, text)
        if m:
            text = text[m.start():]
            break

    # Platt's chapter blurbs are typically a single modern summary between the
    # chapter heading and a standalone period. Remove those without touching verses.
    text = re.sub(
        r"(?m)^(CHAP\.\s*[IVXLCDM]+\.)\n[^\n]{15,650}\n\.\n",
        r"\1\n",
        text,
    )

    # 2 Enoch uses bare Roman-numeral chapter headings and a one-line Platt summary
    # immediately before the translated chapter text.
    if "secrets of enoch" in low_title:
        text = re.sub(
            r"(?m)^([IVXLCDM]+\.)\n[^\n]{25,650}\n(?=[A-Z][A-Z ])",
            r"\1\n",
            text,
        )

    # Psalms of Solomon has the same pattern, sometimes with a standalone period.
    if "psalms of solomon" in low_title:
        text = re.sub(
            r"(?m)^([IVXLCDM]+\.?)\n[^\n]{15,500}\n\.\n",
            r"\1\n",
            text,
        )

    # Remove repeated page markers that can occur inline after HTML extraction.
    text = re.sub(r"(?m)^p\.\s*\d+\s*$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def cleaned_audited_add_section(sections, used_sources, *, part, title, text, source, provenance, status, notes=""):
    if "beaudamore/biblical" in source.lower():
        cleaned = _strip_fbe_boilerplate(text, title)
        if not cleaned:
            removed_editorial_sections.append(title)
            print(f"AUDIT EXCLUDE EDITORIAL FBE SECTION: {title}", flush=True)
            return False
        if cleaned != text.strip():
            cleaned_fbe_sections.append(title)
            text = cleaned
            extra = (
                " Source cleanup: Sacred-Texts navigation, Rutherford H. Platt Jr. editorial introduction/"
                "chapter-summary material, and web page-number boilerplate were removed from the reading text."
            )
            notes = (notes + extra).strip()
    return original_v3_add_section(
        sections, used_sources,
        part=part, title=title, text=text, source=source,
        provenance=provenance, status=status, notes=notes,
    )


def selective_add_tree(sections, used_sources, repo, subtree, part, *, title_prefix=""):
    if subtree == "Aristides the Philosopher/The Apology":
        p = repo / subtree / "Translation from the Syriac_1891.html"
        if not p.exists():
            raise FileNotFoundError(f"Audited Aristides primary translation missing: {p}")
        return int(v3.v2.add_path(
            sections, used_sources, repo, p, part,
            title="Aristides - Apology (Syriac witness, J. Rendel Harris 1891)",
            provenance=(
                "J. Rendel Harris's 1891 English translation from the Syriac witness, preserved in the Historical "
                "Christian Faith mirror. Editorial introductions, title pages, notes, appendices, and duplicate "
                "parallel translations from the same source folder are excluded from the reading corpus."
            ),
            notes=(
                "The Apology has Greek and Syriac textual witnesses. This edition retains one complete identified "
                "historical translation for continuous reading; variant-witness study belongs in a critical apparatus."
            ),
        ))
    return original_add_tree(sections, used_sources, repo, subtree, part, title_prefix=title_prefix)


# v2's source-selection functions resolve these names dynamically.
v3.v2.add_section = cleaned_audited_add_section
v3.v2.add_tree = selective_add_tree


def main() -> None:
    v3.main()

    manifest_path = v3.v2.JSONOUT
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    data["audit_version"] = "4.0"
    data["edition"] = "Critically Audited Historical Reading Edition v4"
    data["content_cleanup"] = {
        "fbe_sections_cleaned": sorted(set(cleaned_fbe_sections)),
        "editorial_sections_excluded": sorted(set(removed_editorial_sections)),
        "aristides_policy": (
            "One complete identified 1891 Syriac-witness translation retained; editorial apparatus and duplicate "
            "translations excluded from the continuous reading corpus."
        ),
    }
    manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    audit_path = v3.AUDIT_REPORT
    with audit_path.open("a", encoding="utf-8") as f:
        f.write("\n## Content-boundary corrections (v4)\n\n")
        f.write(f"- Forgotten Books sections cleaned of modern/web boilerplate: {len(set(cleaned_fbe_sections))}\n")
        f.write(f"- Purely editorial FBE sections excluded: {len(set(removed_editorial_sections))}\n")
        for name in sorted(set(removed_editorial_sections)):
            f.write(f"  - {name}\n")
        f.write("- Aristides: title pages, introductions, prefaces, notes, appendix material, and duplicate translations were removed from the reading corpus; J. Rendel Harris's 1891 Syriac-witness translation is retained.\n")

    with v3.v2.REPORT.open("a", encoding="utf-8") as f:
        f.write("\n## Content-boundary corrections v4\n")
        f.write(f"- FBE sections cleaned: {len(set(cleaned_fbe_sections))}\n")
        f.write(f"- Editorial FBE sections excluded: {sorted(set(removed_editorial_sections))}\n")
        f.write("- Aristides reading corpus narrowed to the identified 1891 Syriac-witness translation.\n")

    # The PDF was already generated from the patched section stream. Update the
    # front-matter label and render once more from the same audited HTML.
    html_path = v3.v2.HTMLFILE
    html_text = html_path.read_text(encoding="utf-8")
    html_text = html_text.replace("Audited Historical Reading Edition", "Critically Audited Historical Reading Edition")
    html_path.write_text(html_text, encoding="utf-8")
    WeasyHTML(filename=str(html_path)).write_pdf(str(v3.v2.PDF))

    print(
        "CRITICAL AUDIT BUILD",
        f"sections={data['section_count']}",
        f"fbe_cleaned={len(set(cleaned_fbe_sections))}",
        f"editorial_excluded={len(set(removed_editorial_sections))}",
        f"true_missing={data.get('required_core_missing')}",
        flush=True,
    )


if __name__ == "__main__":
    main()
