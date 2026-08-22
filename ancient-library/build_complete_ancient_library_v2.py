#!/usr/bin/env python3
"""Build THE ANCIENT LIBRARY - Complete Historical Reading Edition.

The goal of this build is complete readable coverage plus honest provenance. For the
large corpus where a fresh source-language translation has not yet been prepared, it
uses public-domain historical English translations and labels them accordingly. It
never presents a later translation as an autograph and never silently collapses
materially different recensions into an invented 'original'.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup
from weasyprint import HTML as WeasyHTML

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output-v2"
SRC = ROOT / "_sources-v2"
OUT.mkdir(parents=True, exist_ok=True)
SRC.mkdir(parents=True, exist_ok=True)

TITLE = "The Ancient Library"
SUBTITLE = "Complete Historical Reading Edition"
PDF = OUT / "The_Ancient_Library_Complete_Reading_Edition.pdf"
HTMLFILE = OUT / "The_Ancient_Library_Complete_Reading_Edition.html"
REPORT = OUT / "SOURCE_COVERAGE.md"
JSONOUT = OUT / "ancient_library_complete_manifest.json"

WDB_URL = "https://github.com/HistoricalChristianFaith/Writings-Database.git"
FBE_URL = "https://github.com/beaudamore/biblical.git"
WDB_WEB = "https://github.com/HistoricalChristianFaith/Writings-Database/blob/master/"
FBE_WEB = "https://github.com/beaudamore/biblical/blob/main/data/source-raw/extracted_texts/fbe/"

session = requests.Session()
session.headers.update({"User-Agent": "AncientLibraryResearchEdition/2.0"})


def run(*args):
    print("+", " ".join(map(str, args)), flush=True)
    subprocess.run(list(map(str, args)), check=True)


def clone(url: str, dest: Path):
    if dest.exists():
        shutil.rmtree(dest)
    run("git", "clone", "--depth", "1", url, dest)


def clean_text(s: str) -> str:
    s = s.replace("\r", "").replace("\u00a0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def html_to_text(raw: str) -> str:
    soup = BeautifulSoup(raw, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "form", "noscript", "svg"]):
        tag.decompose()
    node = soup.find("main") or soup.find("article") or soup.find(id=re.compile(r"^(content|main|text)$", re.I)) or soup.body or soup
    for br in node.find_all("br"):
        br.replace_with("\n")
    for tag in node.find_all(["p", "div", "h1", "h2", "h3", "h4", "li", "blockquote", "tr"]):
        tag.append("\n")
    return clean_text(node.get_text(" "))


def read_source(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    return html_to_text(raw) if path.suffix.lower() in {".html", ".htm"} else clean_text(raw)


def natural_key(value):
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", str(value))]


def files_under(path: Path):
    if not path.exists():
        return []
    return sorted(
        [p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in {".html", ".htm", ".txt", ".md"} and not p.name.lower().startswith("metadata")],
        key=natural_key,
    )


def top_dirs(repo: Path, terms):
    terms = [t.lower() for t in terms]
    exact = []
    fallback = []
    for p in repo.iterdir():
        if not p.is_dir() or p.name.startswith("."):
            continue
        n = p.name.lower()
        if all(t in n for t in terms):
            exact.append(p)
        elif any(t in n for t in terms):
            fallback.append(p)
    return sorted(exact or fallback, key=natural_key)


def find_matches(repo: Path, author_terms, term_sets, all_matches=False):
    pool = []
    for d in top_dirs(repo, author_terms):
        pool.extend(files_under(d))
    pool = sorted(set(pool), key=natural_key)
    chosen = []
    for terms in term_sets:
        tl = [t.lower() for t in terms]
        matches = [p for p in pool if all(t in str(p).lower() for t in tl)]
        if all_matches:
            chosen.extend(matches)
        elif matches:
            chosen.append(matches[0])
    out, seen = [], set()
    for p in chosen:
        if p not in seen:
            out.append(p)
            seen.add(p)
    return out


def section_title(path: Path, repo: Path) -> str:
    rel = path.relative_to(repo)
    parts = list(rel.parts)
    stem = Path(parts[-1]).stem.replace("_", " ").replace("-", " ")
    if stem.lower() in {"index", "title", "contents"} and len(parts) > 1:
        stem = parts[-2].replace("_", " ").replace("-", " ")
    if len(parts) >= 3 and re.match(r"^(chapter|book|vision|mandate|command|similitude|letter|epistle)\b", stem, re.I):
        parent = parts[-2].replace("_", " ").replace("-", " ")
        return f"{parent} - {stem}"
    return stem


def add_section(sections, used_sources, *, part, title, text, source, provenance, status, notes=""):
    text = clean_text(text)
    if len(text) < 80 or source in used_sources:
        return False
    used_sources.add(source)
    sections.append({
        "part": part,
        "title": title.strip(),
        "text": text,
        "source": source,
        "provenance": provenance,
        "status": status,
        "notes": notes,
        "chars": len(text),
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    })
    return True


def add_path(sections, used_sources, repo, path, part, *, title=None, provenance=None, status="Public-domain historical translation", notes=""):
    if not path.exists():
        return False
    rel = str(path.relative_to(repo)).replace(os.sep, "/")
    return add_section(
        sections, used_sources,
        part=part,
        title=title or section_title(path, repo),
        text=read_source(path),
        source=WDB_WEB + quote(rel, safe="/"),
        provenance=provenance or "Public-domain historical English text preserved in the Historical Christian Faith Writings Database, drawing chiefly on older patristic and scholarly editions.",
        status=status,
        notes=notes or "Included as a documented historical reading witness, not as a newly recovered autograph.",
    )


def add_tree(sections, used_sources, repo, subtree, part, *, title_prefix=""):
    count = 0
    for p in files_under(repo / subtree):
        title = section_title(p, repo)
        if title_prefix:
            title = f"{title_prefix}: {title}"
        if add_path(sections, used_sources, repo, p, part, title=title):
            count += 1
    return count


def add_forgotten_books(sections, used_sources, fbe_repo, coverage):
    part = "I. Ancient Jewish, Pseudepigraphal, and Related Writings"
    root = fbe_repo / "data/source-raw/extracted_texts/fbe"
    preferred = [
        "The_First_Book_of_Adam_and_Eve.txt", "The_Second_Book_of_Adam_and_Eve.txt",
        "The_Book_of_the_Secrets_of_Enoch.txt", "The_Psalms_of_Solomon.txt",
        "The_Odes_of_Solomon.txt", "The_Letter_of_Aristeas.txt",
        "Fourth_Book_of_Maccabees.txt", "The_Story_of_Ahikar.txt",
        "Testament_of_Reuben.txt", "Testament_of_Simeon.txt", "Testament_of_Levi.txt",
        "Testament_of_Judah.txt", "Testament_of_Issachar.txt", "Testament_of_Zebulun.txt",
        "Testament_of_Dan.txt", "Testament_of_Naphtali.txt", "The_Testament_Of_Gad.txt",
        "Testament_of_Asher.txt", "Testament_of_Joseph.txt", "Testament_of_Benjamin.txt",
    ]
    all_files = {p.name: p for p in root.glob("*.txt")}
    ordered = [all_files[n] for n in preferred if n in all_files]
    ordered.extend(p for p in sorted(root.glob("*.txt"), key=natural_key) if p not in ordered)
    count = 0
    for p in ordered:
        if add_section(
            sections, used_sources,
            part=part,
            title=p.stem.replace("_", " "),
            text=read_source(p),
            source=FBE_WEB + quote(p.name),
            provenance="Public-domain historical English text from Rutherford H. Platt Jr.'s 1926 Forgotten Books of Eden collection, supplied through a complete extracted-text mirror. The individual works derive from earlier translations and diverse manuscript traditions.",
            status="Public-domain historical translation",
            notes="This is the complete historical reading text represented in the Platt collection. It is not described as a fresh critical reconstruction of the earliest surviving recension.",
        ):
            count += 1
    coverage.append(f"- Ancient/Forgotten Books corpus: {count} complete text files included.")


def add_selected_wdb(sections, used_sources, repo, coverage):
    APF = "II. Apostolic Fathers and Earliest Post-New-Testament Witnesses"
    SEC = "III. Second-Century Fathers, Apologists, and Martyrs"
    THIRD = "IV. Late Second- and Third-Century Fathers"
    CAN = "V. Canon History and Manuscript Witnesses"
    count = 0

    explicit = [
        (APF, "Clement of Rome/First Epistle to the Corinthians.html", "1 Clement"),
        (APF, "Clement of Rome/Pseudo-Clement/Second Epistle to the Corinthians.html", "2 Clement"),
        (APF, "Shepherd of Hermas/Translation-Lightfoot.html", "The Shepherd of Hermas"),
        (SEC, "Irenaeus/The Proof of the Apostolic Preaching/THE DEMONSTRATION OF THE APOSTOLIC PREACHING.html", "Irenaeus - Demonstration of the Apostolic Preaching"),
        (CAN, "Eusebius of Caesarea/THE CHURCH HISTORY OF EUSEBIUS/Book 3.html", "Eusebius - Church History, Book III"),
        (SEC, "Eusebius of Caesarea/THE CHURCH HISTORY OF EUSEBIUS/Book 4.html", "Eusebius - Church History, Book IV (including Quadratus evidence)"),
        (SEC, "Eusebius of Caesarea/THE CHURCH HISTORY OF EUSEBIUS/Book 5.html", "Eusebius - Church History, Book V (including Lyon and Vienne)"),
    ]
    for part, rel, title in explicit:
        if add_path(sections, used_sources, repo, repo / rel, part, title=title):
            count += 1

    count += add_tree(sections, used_sources, repo, "Aristides the Philosopher/The Apology", SEC, title_prefix="Aristides - Apology")

    specs = [
        (APF, ["ignatius"], [["ephesians"], ["magnesians"], ["trallians"], ["romans"], ["philadelphians"], ["smyrnaeans"], ["polycarp"]], False),
        (APF, ["polycarp"], [["philippians"], ["martyr"]], False),
        (APF, ["didache"], [["didache"], ["teaching"]], False),
        (APF, ["barnabas"], [["barnabas"]], False),
        (APF, ["papias"], [["fragment"]], True),
        (APF, ["diognetus"], [["diognet"]], False),
        (SEC, ["justin"], [["first apology"], ["second apology"], ["dialogue", "trypho"], ["martyr"]], False),
        (SEC, ["irenaeus"], [["against heresies", "book 1"], ["against heresies", "book 2"], ["against heresies", "book 3"], ["against heresies", "book 4"], ["against heresies", "book 5"]], False),
        (SEC, ["tatian"], [["greeks"]], False),
        (SEC, ["theophilus"], [["autolycus", "book 1"], ["autolycus", "book 2"], ["autolycus", "book 3"]], False),
        (SEC, ["athenagoras"], [["plea"], ["resurrection"]], False),
        (SEC, ["melito"], [["pascha"], ["passover"]], False),
        (THIRD, ["clement", "alexandria"], [["exhortation"], ["protrepticus"], ["instructor", "book 1"], ["instructor", "book 2"], ["instructor", "book 3"], ["stromata", "book 1"], ["stromata", "book 2"], ["stromata", "book 3"], ["stromata", "book 4"], ["stromata", "book 5"], ["stromata", "book 6"], ["stromata", "book 7"]], False),
        (THIRD, ["tertullian"], [["apology"], ["baptism"], ["prayer"], ["prescription"], ["flesh of christ"], ["resurrection of the flesh"], ["praxeas"], ["marcion", "book 1"], ["marcion", "book 2"], ["marcion", "book 3"], ["marcion", "book 4"], ["marcion", "book 5"], ["crown"], ["spectacles"]], False),
        (THIRD, ["perpetua"], [["passion"]], False),
        (THIRD, ["hippolytus"], [["commentary", "daniel"], ["refutation", "book 1"], ["refutation", "book 2"], ["refutation", "book 3"], ["refutation", "book 4"], ["refutation", "book 5"], ["refutation", "book 6"], ["refutation", "book 7"], ["refutation", "book 8"], ["refutation", "book 9"], ["refutation", "book 10"]], False),
        (THIRD, ["origen"], [["first principles", "book 1"], ["first principles", "book 2"], ["first principles", "book 3"], ["first principles", "book 4"], ["celsus", "book 1"], ["celsus", "book 2"], ["celsus", "book 3"], ["celsus", "book 4"], ["celsus", "book 5"], ["celsus", "book 6"], ["celsus", "book 7"], ["celsus", "book 8"]], False),
        (THIRD, ["cyprian"], [["epistle"], ["letter"]], True),
        (THIRD, ["cyprian"], [["unity"], ["lapsed"], ["lord", "prayer"]], False),
        (THIRD, ["novatian"], [["trinity"]], False),
        (THIRD, ["gregory", "thaumaturgus"], [["faith"]], False),
        (THIRD, ["dionysius", "alexandria"], [["fragment"], ["epistle"], ["letter"]], True),
        (THIRD, ["methodius"], [["banquet"], ["virgins"], ["symposium"]], False),
        (CAN, ["athanasius"], [["festal", "39"], ["letter", "39"]], False),
    ]

    missing = []
    for part, author_terms, term_sets, all_matches in specs:
        matches = find_matches(repo, author_terms, term_sets, all_matches=all_matches)
        if not matches:
            missing.append(f"No match for {author_terms}: {term_sets}")
            continue
        for p in matches:
            if add_path(sections, used_sources, repo, p, part):
                count += 1

    # Muratorian Fragment: public-domain Ante-Nicene Fathers rendering on Wikisource.
    try:
        url = "https://en.wikisource.org/wiki/Ante-Nicene_Fathers/Volume_V/Caius/Fragments_of_Caius/Canon_Muratorianus"
        r = session.get(url, timeout=60)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        node = soup.select_one("div.mw-parser-output") or soup.body
        for bad in node.select("table, .navbox, .mw-editsection, style, script, sup.reference"):
            bad.decompose()
        text = clean_text(node.get_text("\n"))
        if add_section(
            sections, used_sources,
            part=CAN,
            title="The Muratorian Fragment / Canon Muratorianus",
            text=text,
            source=url,
            provenance="Public-domain Ante-Nicene Fathers English rendering of the Muratorian fragment, hosted by Wikisource.",
            status="Public-domain historical translation",
            notes="The surviving Latin manuscript is defective at the beginning and end and is generally understood to reflect an earlier Greek text. Its date and several reconstructions remain debated.",
        ):
            count += 1
    except Exception as exc:
        missing.append(f"Muratorian web source failed: {exc}")

    quadratus = (
        "The works of our Savior were always present, because they were true: those who were healed, "
        "and those who were raised from the dead, were seen not only while they were being healed or raised, "
        "but were continually present - not only while the Savior remained among us, but for a considerable "
        "time after his departure; indeed, some of them survived even to our own times."
    )
    if add_section(
        sections, used_sources,
        part=APF,
        title="Quadratus - Surviving Apology Fragment",
        text=quadratus,
        source="Eusebius, Ecclesiastical History 4.3.2",
        provenance="Fresh modern-English rendering of the short Greek fragment of Quadratus preserved by Eusebius.",
        status="Fresh translation of preserved fragment",
        notes="Only this short quotation from Quadratus' apology survives in Eusebius; the complete apology is lost.",
    ):
        count += 1

    coverage.append(f"- Early Christian and canon-history corpus: {count} selected sections/files included.")
    if missing:
        coverage.append("\n### Source matches not resolved automatically")
        coverage.extend(f"- {m}" for m in missing)


def add_profiles(sections, used_sources):
    part = "V. Canon History and Manuscript Witnesses"
    profiles = [
        ("Codex Sinaiticus - Collection Profile", "Codex Sinaiticus is a fourth-century Greek biblical codex. Its surviving New Testament is followed by the Epistle of Barnabas and part of the Shepherd of Hermas. This is evidence for the contents of one major manuscript collection, not proof that every fourth-century church possessed an identical canon."),
        ("Codex Alexandrinus - Collection Profile", "Codex Alexandrinus is a fifth-century Greek biblical codex. After Revelation it preserves 1 Clement and 2 Clement, although the ending of 2 Clement is lost. This witnesses to the physical collection and reception of these works without by itself defining a universal canon."),
    ]
    for title, text in profiles:
        add_section(sections, used_sources, part=part, title=title, text=text, source=title, provenance="Editorial manuscript profile.", status="Historical manuscript profile")


def dedupe(sections):
    out, seen = [], set()
    for s in sections:
        if s["sha256"] in seen:
            continue
        seen.add(s["sha256"])
        out.append(s)
    return out


def render_book(sections):
    toc, body = [], []
    current = None
    for i, s in enumerate(sections, 1):
        sid = f"work-{i}"
        if s["part"] != current:
            current = s["part"]
            toc.append(f'<li class="toc-part">{html.escape(current)}</li>')
            body.append(f'<section class="part-page"><div class="part-kicker">THE ANCIENT LIBRARY</div><h1>{html.escape(current)}</h1></section>')
        toc.append(f'<li><a href="#{sid}">{html.escape(s["title"])}</a></li>')
        paras = []
        for block in re.split(r"\n\s*\n", s["text"]):
            block = block.strip()
            if not block:
                continue
            escaped = html.escape(block).replace("\n", "<br>")
            if len(block) < 110 and re.match(r"^(chapter|book|vision|mandate|command|similitude|ode|psalm|testament|epistle|letter|homily|section|part)\b", block, re.I):
                paras.append(f"<h3>{escaped}</h3>")
            else:
                paras.append(f"<p>{escaped}</p>")
        meta = (
            f'<div class="meta"><b>Text status:</b> {html.escape(s["status"])}<br>'
            f'<b>Source:</b> {html.escape(s["source"])}<br>'
            f'<b>Provenance:</b> {html.escape(s["provenance"])}'
            + (f'<br><b>Editorial note:</b> {html.escape(s["notes"])}' if s.get("notes") else "") + "</div>"
        )
        body.append(f'<article id="{sid}" class="work"><div class="running">THE ANCIENT LIBRARY</div><h2>{html.escape(s["title"])}</h2>{meta}{"".join(paras)}</article>')

    intro = """
    <section class="title-page">
      <div class="smallcaps">COMPANION TO THE ANCIENT CANON</div>
      <h1>THE ANCIENT<br>LIBRARY</h1>
      <div class="rule"></div>
      <h2>Complete Historical Reading Edition</h2>
      <p>Ancient Jewish writings, pseudepigrapha, Apostolic Fathers,<br>early Christian apologists, martyrs, theologians, and canon-history witnesses</p>
    </section>
    <section class="editorial">
      <h1>Editorial Statement</h1>
      <p>This volume is a historical library, not an expanded biblical canon. Works are grouped by literary and historical context, and their presence here does not imply equal canonical authority.</p>
      <p>The aim is <b>complete readable access</b> together with <b>honest textual provenance</b>. For the much larger body of patristic and pseudepigraphal literature, this reading edition often uses public-domain historical English translations. They are not falsely described as recovered autographs or perfect reconstructions of the earliest attainable text.</p>
      <p>Many works survive in multiple languages and recensions. The Adam literature, 2 Enoch, the Testaments of the Twelve Patriarchs, the Odes of Solomon, Ahiqar, and several patristic writings have especially complicated transmission histories. The companion source-first research edition should be consulted for dating, authorship, manuscripts, recensions, and major variants.</p>
    </section>
    """
    css = """
    @page { size: A4; margin: 20mm 18mm 22mm 18mm; @bottom-center { content: counter(page); font-size: 8pt; color: #777; } }
    @page:first { @bottom-center { content: none; } }
    body { font-family: 'DejaVu Serif', Georgia, serif; color: #211b16; font-size: 9.4pt; line-height: 1.48; }
    .title-page,.part-page { page-break-after: always; min-height:235mm; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
    .title-page h1 { font-size:40pt; line-height:.98; letter-spacing:1.5px; margin:20mm 0 6mm; }
    .title-page h2 { font-size:16pt; font-weight:normal; margin:4mm 0; }
    .title-page p { font-size:10pt; color:#5a4d42; }
    .smallcaps,.part-kicker { font-size:8pt; letter-spacing:2.2px; text-transform:uppercase; color:#866f51; }
    .rule { width:42mm; border-top:1px solid #9a7f5d; margin:3mm auto 6mm; }
    .editorial,.toc-page { page-break-after:always; }
    .editorial h1,.toc-page h1 { font-size:24pt; }
    .toc-page ul { list-style:none; padding:0; columns:2; column-gap:10mm; }
    .toc-page li { break-inside:avoid; margin:0 0 2mm; font-size:8.3pt; }
    .toc-page li.toc-part { column-span:all; font-weight:bold; font-size:11pt; margin-top:5mm; border-bottom:.4pt solid #cdbda8; padding-bottom:1.5mm; }
    a { color:#5f4a34; text-decoration:none; }
    .part-page h1 { font-size:26pt; max-width:150mm; }
    .work { page-break-before:always; }
    .work h2 { font-size:22pt; line-height:1.12; margin:0 0 5mm; }
    .work h3 { font-size:12pt; margin:6mm 0 2mm; }
    .work p { margin:0 0 3.2mm; text-align:justify; orphans:3; widows:3; }
    .meta { border-top:.7pt solid #9a7f5d; border-bottom:.4pt solid #cdbda8; padding:3mm 0; margin-bottom:6mm; font-family:'DejaVu Sans',Arial,sans-serif; font-size:7.4pt; line-height:1.4; color:#5b5148; overflow-wrap:anywhere; }
    .running { font-family:'DejaVu Sans',Arial,sans-serif; font-size:6.8pt; letter-spacing:1.6px; color:#927b5e; margin-bottom:3mm; }
    """
    doc = f"<!doctype html><html><head><meta charset='utf-8'><title>{TITLE}</title><style>{css}</style></head><body>{intro}<section class='toc-page'><h1>Contents</h1><ul>{''.join(toc)}</ul></section>{''.join(body)}</body></html>"
    HTMLFILE.write_text(doc, encoding="utf-8")
    WeasyHTML(filename=str(HTMLFILE)).write_pdf(str(PDF))


def main():
    wdb = SRC / "Writings-Database"
    fbe = SRC / "biblical"
    clone(WDB_URL, wdb)
    clone(FBE_URL, fbe)
    sections, used_sources = [], set()
    coverage = ["# The Ancient Library - Source Coverage", "", "This report records the sources actually included in the complete historical reading edition.", ""]
    add_forgotten_books(sections, used_sources, fbe, coverage)
    add_selected_wdb(sections, used_sources, wdb, coverage)
    add_profiles(sections, used_sources)
    sections = dedupe(sections)

    joined = "\n".join(s["title"].lower() + "\n" + s["text"][:400].lower() for s in sections)
    required = [
        "first book of adam", "second book of adam", "secrets of enoch", "psalms of solomon", "odes of solomon",
        "letter of aristeas", "maccabees", "ahikar", "testament of reuben", "1 clement", "2 clement",
        "shepherd of hermas", "ignatius", "polycarp", "irenaeus", "justin", "tertullian", "origen", "cyprian",
        "muratorian", "quadratus", "eusebius", "athanasius"
    ]
    absent = [r for r in required if r not in joined]
    coverage.extend(["", "## Core completeness check", f"- Missing expected markers: {len(absent)}"])
    coverage.extend(f"- {r}" for r in absent)

    render_book(sections)
    manifest = {
        "title": TITLE, "subtitle": SUBTITLE, "edition": "Complete Historical Reading Edition v2",
        "editorial_policy": "Canonical Scripture remains distinct from the Ancient Library. Historical translations are labelled; no translation is presented as an autograph.",
        "section_count": len(sections), "character_count": sum(s["chars"] for s in sections),
        "required_core_missing": absent, "sections": sections,
    }
    JSONOUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    coverage.extend(["", "## Totals", f"- Total sections: {len(sections)}", f"- Total extracted characters: {sum(s['chars'] for s in sections):,}", f"- PDF: {PDF.name}"])
    REPORT.write_text("\n".join(coverage) + "\n", encoding="utf-8")
    print(f"BUILT {PDF} with {len(sections)} sections; missing core markers={absent}", flush=True)


if __name__ == "__main__":
    main()
