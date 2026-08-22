#!/usr/bin/env python3
"""Strict v2 build for the Complete Ancient Library anthology.

Adds a rate-limit-safe full Forgotten Books of Eden ingest and closes the known
coverage gaps from the first automated build. The output still distinguishes a
historical public-domain translation from a newly reconstructed source-language
translation; it does not claim surviving manuscripts are authorial autographs.
"""
from __future__ import annotations
import json, os, re, time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

import build_complete_ancient_library as base


def strict_fbe(sections, coverage):
    """Capture every page in Platt's Sacred-Texts edition with respectful retries.

    Sacred-Texts exposes the edition as fbe000.htm through fbe295.htm. The first
    build hit HTTP 429 after page 28. The archive host is tried first, then the
    theology101 mirror, with a delay between requests and exponential retry.
    """
    hosts = [
        "https://archive.sacred-texts.com/bib/fbe/",
        "https://www.theology101.org/bib/fbe/",
        "https://sacred-texts.com/bib/fbe/",
    ]
    sess = requests.Session()
    sess.headers.update({"User-Agent":"AncientCanonResearchEdition/2.0 (historical public-domain anthology)"})
    failures=[]
    ok=0
    for n in range(296):
        name=f"fbe{n:03d}.htm"
        raw=None; used=None; last_error=None
        for host in hosts:
            u=urljoin(host,name)
            for attempt in range(4):
                try:
                    r=sess.get(u,timeout=45)
                    if r.status_code==200 and len(r.text)>200:
                        raw=r.text; used=u; break
                    last_error=f"HTTP {r.status_code}"
                except Exception as e:
                    last_error=str(e)
                time.sleep(0.7*(attempt+1))
            if raw is not None: break
        if raw is None:
            failures.append(f"{name}: {last_error}")
            continue
        txt=base.html_to_text(raw)
        if len(txt)<100:
            failures.append(f"{name}: extracted text only {len(txt)} chars")
            continue
        title=base.title_from_html(raw,name)
        base.add_section(
            sections,
            part="I. Forgotten Books of Eden collection",
            title=title,
            text=txt,
            source=used,
            provenance="Rutherford H. Platt Jr., The Forgotten Books of Eden (1926), public-domain historical English edition. Pages are drawn from the Sacred-Texts transcription or its mirror.",
            status="Public-domain historical translation",
            notes="Complete historical reading witness. This wording is preserved as an edition witness and is not falsely represented as a new translation from the earliest extant manuscript of each underlying work."
        )
        ok+=1
        time.sleep(0.16)
    coverage.append(f"- Forgotten Books of Eden: {ok}/296 pages captured.")
    if failures:
        coverage.append("### Forgotten Books pages still missing")
        coverage.extend("- "+x for x in failures)
        raise RuntimeError(f"Strict FBE ingest incomplete: {len(failures)} pages missing")


def _add_exact_wdb(sections, repo, relative, part, title, note=""):
    p=repo/relative
    if not p.exists():
        raise FileNotFoundError(relative)
    text=base.extract_path(p)
    if len(text)<120:
        raise RuntimeError(f"Tiny extraction for {relative}: {len(text)} chars")
    rel=str(p.relative_to(repo)).replace(os.sep,"/")
    return base.add_section(
        sections,part=part,title=title,text=text,
        source=f"https://github.com/HistoricalChristianFaith/Writings-Database/blob/master/{rel}",
        provenance="Public-domain historical English text in the Historical Christian Faith Writings Database, derived from older patristic/scholarly editions.",
        status="Public-domain historical translation",
        notes=note or "Included as a documented historical reading text; source-language reconstruction and materially variant recensions remain identified separately in the critical apparatus."
    )


def complete_wdb(sections, repo, coverage):
    before=len(sections)
    base.add_wdb(sections,repo,coverage)
    APF="II. Apostolic Fathers and earliest post-New-Testament witnesses"
    SEC="III. Second-century writers, apologists, and martyrs"
    CAN="V. Canon-history primary sources"

    titles={s['title'].lower() for s in sections}
    extras=[]
    if "second epistle to the corinthians" not in titles:
        _add_exact_wdb(sections,repo,
            Path("Clement of Rome")/"Pseudo-Clement"/"Second Epistle to the Corinthians.html",
            APF,"Second Clement (anonymous early Christian homily)",
            "Traditionally transmitted with Clement but not treated here as a work actually written by Clement of Rome.")
        extras.append("Second Clement")

    # Eusebius preserves the surviving Quadratus notice/fragment in Book 4 and the
    # letter of the martyrs of Lyon and Vienne in Book 5. Including the full books
    # avoids silently cutting the quotation out of its ancient literary context.
    _add_exact_wdb(sections,repo,
        Path("Eusebius of Caesarea")/"THE CHURCH HISTORY OF EUSEBIUS"/"Book 4.html",
        SEC,"Eusebius, Church History Book 4 (including Quadratus evidence)")
    extras.append("Eusebius Book 4 / Quadratus")
    _add_exact_wdb(sections,repo,
        Path("Eusebius of Caesarea")/"THE CHURCH HISTORY OF EUSEBIUS"/"Book 5.html",
        SEC,"Eusebius, Church History Book 5 (including Lyon and Vienne)")
    extras.append("Eusebius Book 5 / Lyon and Vienne")

    # Muratorian fragment: a complete historical English reading text. This source
    # is used only as a reading witness; app metadata should separately preserve the
    # damaged Latin manuscript and debated reconstruction of its opening/end.
    u="https://raw.githubusercontent.com/goldmonkey21/doxer/main/christiantexts/muratorian3_christian.txt"
    r=requests.get(u,timeout=45); r.raise_for_status()
    txt=base.clean_text(r.text)
    if len(txt)<1000: raise RuntimeError("Muratorian reading text unexpectedly short")
    base.add_section(sections,part=CAN,title="Muratorian Fragment - historical English reading text",text=txt,
        source="https://github.com/goldmonkey21/doxer/blob/main/christiantexts/muratorian3_christian.txt",
        provenance="Complete English reading text of the damaged Muratorian Fragment from a public GitHub textual witness; the app's critical record should be checked against the surviving Latin fragment and critical editions before publication.",
        status="Historical English reading text",
        notes="The manuscript is damaged at the beginning and end. This reading text is not presented as an autograph or as an undisputed reconstruction of every damaged Latin phrase.")
    extras.append("Muratorian Fragment")

    # Remove obsolete first-pass gap warnings that the strict additions above close.
    closed=("second clement","quadratus","lyon","murator")
    coverage[:] = [line for line in coverage if not (line.startswith("- No ") and any(x in line.lower() for x in closed))]
    coverage.append(f"- Strict-v2 additions: {', '.join(extras)}.")
    coverage.append(f"- Early-Christian sections after strict additions: {len(sections)-before} added in this phase.")


def main():
    coverage=["# Source coverage report - strict v2","",
              "This report records the content actually included. The build fails rather than calling itself complete when a required Forgotten Books page or known coverage-gap text is missing.",""]
    sections=[]
    strict_fbe(sections,coverage)
    repo=base.SRC/"Writings-Database"
    base.clone("https://github.com/HistoricalChristianFaith/Writings-Database.git",repo)
    complete_wdb(sections,repo,coverage)
    base.add_profiles(sections)

    required_titles=[
        "Second Clement (anonymous early Christian homily)",
        "Eusebius, Church History Book 4 (including Quadratus evidence)",
        "Eusebius, Church History Book 5 (including Lyon and Vienne)",
        "Muratorian Fragment - historical English reading text",
    ]
    all_titles={s['title'] for s in sections}
    missing=[x for x in required_titles if x not in all_titles]
    if missing: raise SystemExit("Strict build missing required sections: "+", ".join(missing))
    fbe_count=sum(1 for s in sections if s['part'].startswith("I. Forgotten"))
    if fbe_count!=296: raise SystemExit(f"Strict build expected 296 FBE pages, found {fbe_count}")

    manifest={"title":base.TITLE,"edition":"2026 strict source-controlled historical reading edition","section_count":len(sections),"fbe_page_count":fbe_count,"sections":sections}
    base.JSONOUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    coverage.extend(["","## Totals","",f"- Included reading sections/files: **{len(sections)}**",f"- Forgotten Books pages: **{fbe_count}/296**",f"- Total extracted characters: **{sum(s['chars'] for s in sections):,}**",f"- PDF target: `{base.PDF.name}`"])
    base.REPORT.write_text("\n".join(coverage),encoding="utf-8")
    base.render_book(sections)
    print(f"STRICT V2 BUILT {base.PDF} ({base.PDF.stat().st_size:,} bytes), {len(sections)} sections, FBE {fbe_count}/296",flush=True)

if __name__=="__main__":
    main()
