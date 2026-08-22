#!/usr/bin/env python3
"""Build a single-volume Ancient Library historical reading edition.

This script intentionally distinguishes (1) direct source-language translations already
prepared for the project, (2) public-domain historical translations, and (3) witness
profiles where no responsible single reconstructed text exists. It does not call a
historical translation 'perfect' or silently merge manuscript recensions.
"""
from __future__ import annotations
import hashlib, html, json, os, re, shutil, subprocess, sys, textwrap, time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"
SRC = ROOT / "_sources"
OUT.mkdir(parents=True, exist_ok=True)
SRC.mkdir(parents=True, exist_ok=True)

TITLE = "The Ancient Canon - Complete Ancient Library"
SUBTITLE = "Historical Texts, Apostolic Fathers, Early Church Writers, and Canon History"
PDF = OUT / "The_Ancient_Canon_Complete_Ancient_Library.pdf"
HTML = OUT / "The_Ancient_Canon_Complete_Ancient_Library.html"
REPORT = OUT / "SOURCE_COVERAGE.md"
JSONOUT = OUT / "ancient_library_complete_manifest.json"

session = requests.Session()
session.headers.update({"User-Agent": "AncientCanonResearchEdition/1.0 (+source-citation build)"})


def run(*args):
    print("+", " ".join(map(str,args)), flush=True)
    subprocess.run(list(map(str,args)), check=True)


def clone(url: str, dest: Path):
    if dest.exists(): shutil.rmtree(dest)
    run("git", "clone", "--depth", "1", url, dest)


def clean_text(s: str) -> str:
    s = s.replace("\r", "")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n[ \t]+", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def html_to_text(raw: str) -> str:
    soup = BeautifulSoup(raw, "lxml")
    for tag in soup(["script","style","nav","footer","header","form","noscript","svg"]):
        tag.decompose()
    # Prefer content-like containers where present.
    node = (soup.find(id=re.compile(r"^(content|main|text)$", re.I))
            or soup.find("main") or soup.find("article") or soup.body or soup)
    # Retain visible paragraph/heading rhythm.
    for br in node.find_all("br"):
        br.replace_with("\n")
    for tag in node.find_all(["p","div","h1","h2","h3","h4","li","blockquote","tr"]):
        tag.append("\n")
    text = node.get_text(" ")
    text = re.sub(r" *\n *", "\n", text)
    return clean_text(text)


def title_from_html(raw: str, fallback: str) -> str:
    soup = BeautifulSoup(raw, "lxml")
    for tag in ["h1","h2","title"]:
        n = soup.find(tag)
        if n:
            t = clean_text(n.get_text(" "))
            if t: return t[:240]
    return fallback


def score_name(path: Path, terms: list[str]) -> int:
    s = str(path).lower().replace("_", " ").replace("-", " ")
    return sum(3 if t.lower() in s else 0 for t in terms)


def find_author_dirs(repo: Path, author_terms: list[str]) -> list[Path]:
    dirs=[]
    for p in repo.iterdir():
        if not p.is_dir() or p.name.startswith("."): continue
        n=p.name.lower()
        if all(t.lower() in n for t in author_terms): dirs.append(p)
    if not dirs:
        for p in repo.iterdir():
            if p.is_dir() and any(t.lower() in p.name.lower() for t in author_terms): dirs.append(p)
    return sorted(dirs)


def files_under(dirs: list[Path], include_terms=None, exclude_terms=None, extensions=(".html", ".htm", ".txt", ".md")) -> list[Path]:
    candidates=[]
    for d in dirs:
        for p in d.rglob("*"):
            if not p.is_file() or p.suffix.lower() not in extensions: continue
            s=str(p).lower()
            if include_terms and not all(t.lower() in s for t in include_terms): continue
            if exclude_terms and any(t.lower() in s for t in exclude_terms): continue
            if p.name.lower().startswith("metadata"): continue
            candidates.append(p)
    return sorted(set(candidates))


def extract_path(p: Path) -> str:
    raw=p.read_text(encoding="utf-8", errors="ignore")
    if p.suffix.lower() in (".html",".htm"):
        return html_to_text(raw)
    return clean_text(raw)


def first_matching_files(repo: Path, author_terms, term_sets, all_matches=False):
    dirs=find_author_dirs(repo, author_terms)
    allfiles=files_under(dirs)
    chosen=[]
    for terms in term_sets:
        matches=[p for p in allfiles if all(t.lower() in str(p).lower() for t in terms)]
        if not matches:
            # relaxed token match, score and use plausible top match
            ranked=sorted(allfiles, key=lambda p: score_name(p, terms), reverse=True)
            matches=[p for p in ranked if score_name(p,terms)>0][:1]
        if all_matches: chosen.extend(matches)
        elif matches: chosen.append(matches[0])
    # preserve order, deduplicate
    out=[]; seen=set()
    for p in chosen:
        if p not in seen: out.append(p); seen.add(p)
    return dirs,out


def add_section(sections, *, part, title, text, source, provenance, status="Historical translation", notes=""):
    text=clean_text(text)
    if len(text)<80: return False
    sections.append({
        "part":part,"title":title,"text":text,"source":source,
        "provenance":provenance,"status":status,"notes":notes,
        "sha256":hashlib.sha256(text.encode()).hexdigest(),"chars":len(text)
    })
    return True


def fetch_fbe(sections, coverage):
    base="https://sacred-texts.com/bib/fbe/"
    index=urljoin(base,"index.htm")
    r=session.get(index,timeout=40); r.raise_for_status()
    soup=BeautifulSoup(r.text,"lxml")
    links=[]
    for a in soup.find_all("a",href=True):
        href=a["href"].split("#",1)[0]
        if re.search(r"fbe\d+\.htm$",href,re.I):
            u=urljoin(index,href)
            if u not in links: links.append(u)
    def num(u):
        m=re.search(r"fbe(\d+)\.htm",u,re.I); return int(m.group(1)) if m else 99999
    links=sorted(links,key=num)
    # exclude known navigation/index placeholders only if extraction tiny.
    ok=0
    for i,u in enumerate(links,1):
        try:
            rr=session.get(u,timeout=40); rr.raise_for_status()
            txt=html_to_text(rr.text)
            if len(txt)<120: continue
            tt=title_from_html(rr.text, Path(u).name)
            if add_section(sections, part="I. Forgotten Books of Eden collection", title=tt, text=txt,
                           source=u,
                           provenance="Rutherford H. Platt Jr., The Forgotten Books of Eden (1926), public-domain historical English edition as hosted by Sacred-Texts.",
                           status="Public-domain historical translation",
                           notes="Included as a complete historical reading witness, not represented as a new translation from the earliest surviving manuscript."):
                ok+=1
        except Exception as e:
            coverage.append(f"- FBE fetch failed: {u} - {e}")
    coverage.append(f"- Forgotten Books of Eden: {ok} full web sections/pages captured from {len(links)} linked text pages.")


def add_wdb(sections, repo: Path, coverage):
    """Select the works defined by the research corpus from the public-domain writings database."""
    PART_APF="II. Apostolic Fathers and earliest post-New-Testament witnesses"
    PART_2C="III. Second-century writers, apologists, and martyrs"
    PART_3C="IV. Late second- and third-century writers"
    PART_CAN="V. Canon-history primary sources"

    # Each tuple: part, display label, author directory tokens, list of filename term-sets, all_matches.
    specs = [
      (PART_APF,"First Clement",["clement","rome"],[["clement"]],False),
      (PART_APF,"Second Clement",["clement","rome"],[["second"],["2 clement"]],False),
      (PART_APF,"Ignatius of Antioch - seven-letter Middle Recension",["ignatius"],[["ephesians"],["magnesians"],["trallians"],["romans"],["philadelphians"],["smyrnaeans"],["polycarp"]],False),
      (PART_APF,"Polycarp to the Philippians",["polycarp"],[["philippians"]],False),
      (PART_APF,"Martyrdom of Polycarp",["polycarp"],[["martyr"]],False),
      (PART_APF,"Didache",["didache"],[["didache"]],False),
      (PART_APF,"Epistle of Barnabas",["barnabas"],[["barnabas"]],False),
      (PART_APF,"Shepherd of Hermas",["hermas"],[["shepherd"]],False),
      (PART_APF,"Fragments of Papias",["papias"],[["fragment"]],True),
      (PART_APF,"Epistle to Diognetus",["diognetus"],[["diognet"]],False),
      (PART_APF,"Quadratus fragment",["quadratus"],[["fragment"],["quadratus"]],False),

      (PART_2C,"Justin Martyr",["justin"],[["first apology"],["second apology"],["dialogue","trypho"],["martyr"]],False),
      (PART_2C,"Irenaeus of Lyons",["irenaeus"],[["against heresies","book 1"],["against heresies","book 2"],["against heresies","book 3"],["against heresies","book 4"],["against heresies","book 5"],["apostolic preaching"]],False),
      (PART_2C,"Aristides - Apology",["aristides"],[["apology"]],False),
      (PART_2C,"Tatian - Address to the Greeks",["tatian"],[["greeks"]],False),
      (PART_2C,"Theophilus of Antioch - To Autolycus",["theophilus"],[["autolycus","book 1"],["autolycus","book 2"],["autolycus","book 3"],["autolycus"]],False),
      (PART_2C,"Athenagoras",["athenagoras"],[["plea"],["resurrection"]],False),
      (PART_2C,"Melito of Sardis - On Pascha",["melito"],[["pascha"],["passover"]],False),
      (PART_2C,"Martyrs of Lyon and Vienne",["lyon"],[["martyr"]],True),

      (PART_3C,"Clement of Alexandria",["clement","alexandria"],[["exhortation"],["protrepticus"],["instructor","book 1"],["instructor","book 2"],["instructor","book 3"],["paedagogus"],["stromata","book 1"],["stromata","book 2"],["stromata","book 3"],["stromata","book 4"],["stromata","book 5"],["stromata","book 6"],["stromata","book 7"]],False),
      (PART_3C,"Tertullian",["tertullian"],[["apology"],["baptism"],["prayer"],["prescription"],["flesh of christ"],["resurrection of the flesh"],["praxeas"],["marcion","book 1"],["marcion","book 2"],["marcion","book 3"],["marcion","book 4"],["marcion","book 5"]],False),
      (PART_3C,"Passion of Perpetua and Felicity",["perpetua"],[["passion"]],False),
      (PART_3C,"Hippolytus",["hippolytus"],[["apostolic tradition"],["refutation","book 1"],["refutation","book 2"],["refutation","book 3"],["refutation","book 4"],["refutation","book 5"],["refutation","book 6"],["refutation","book 7"],["refutation","book 8"],["refutation","book 9"],["refutation","book 10"],["refutation"]],False),
      (PART_3C,"Origen",["origen"],[["first principles","book 1"],["first principles","book 2"],["first principles","book 3"],["first principles","book 4"],["principles"],["celsus","book 1"],["celsus","book 2"],["celsus","book 3"],["celsus","book 4"],["celsus","book 5"],["celsus","book 6"],["celsus","book 7"],["celsus","book 8"]],False),
      (PART_3C,"Cyprian of Carthage - letters",["cyprian"],[["epistle"],["letter"]],True),
      (PART_3C,"Cyprian - On the Unity of the Church",["cyprian"],[["unity"]],False),
      (PART_3C,"Novatian - On the Trinity",["novatian"],[["trinity"]],False),
      (PART_3C,"Gregory Thaumaturgus - Declaration/Exposition of Faith",["gregory","thaumaturgus"],[["faith"]],False),
      (PART_3C,"Dionysius of Alexandria - surviving letters/fragments",["dionysius","alexandria"],[["fragment"],["epistle"],["letter"]],True),
      (PART_3C,"Methodius - Symposium / Banquet of the Ten Virgins",["methodius"],[["banquet"],["virgins"],["symposium"]],False),

      (PART_CAN,"Muratorian Fragment",["murator"],[["fragment"]],False),
      (PART_CAN,"Eusebius - Ecclesiastical History canon evidence",["eusebius"],[["church history","book 3"],["ecclesiastical history","book 3"]],False),
      (PART_CAN,"Athanasius - Festal Letter 39",["athanasius"],[["festal","39"],["letter","39"]],False),
    ]

    used=set(); missing=[]; count=0
    for part,label,author_terms,term_sets,all_matches in specs:
        dirs, paths=first_matching_files(repo,author_terms,term_sets,all_matches=all_matches)
        if not dirs:
            missing.append(f"{label}: no author directory matching {author_terms}"); continue
        if not paths:
            missing.append(f"{label}: author dir found ({', '.join(d.name for d in dirs)}) but no matching files"); continue
        for p in paths:
            if p in used: continue
            used.add(p)
            try:
                txt=extract_path(p)
            except Exception as e:
                missing.append(f"{label}: failed reading {p.relative_to(repo)}: {e}"); continue
            # Reject metadata/navigation-sized files.
            if len(txt)<300:
                missing.append(f"{label}: tiny extraction {p.relative_to(repo)} ({len(txt)} chars)"); continue
            t=p.stem.replace("_"," ")
            add_section(sections,part=part,title=t,text=txt,
                source=f"https://github.com/HistoricalChristianFaith/Writings-Database/blob/master/{str(p.relative_to(repo)).replace(os.sep,'/')}",
                provenance="Public-domain historical English text from the Historical Christian Faith Writings Database; ultimately derived from older scholarly/patristic editions. Read together with the source notes in this volume.",
                status="Public-domain historical translation",
                notes="This full reading text is included for completeness. It is not falsely labelled as a newly reconstructed autograph or as a direct translation from every earliest fragment.")
            count+=1
    coverage.append(f"- Early Christian writings database: {count} full text files included; {len(used)} unique source files.")
    if missing:
        coverage.append("\n### Items requiring manual/source-critical follow-up")
        coverage += ["- "+m for m in missing]


def add_profiles(sections):
    profiles = [
      ("V. Canon-history primary sources","Codex Sinaiticus collection profile",
       "Codex Sinaiticus is a fourth-century Greek biblical codex. Its surviving New Testament is followed by the Epistle of Barnabas and part of the Shepherd of Hermas. This profile is metadata, not a claim that those two works belonged to every fourth-century canon.",
       "Manuscript collection profile"),
      ("V. Canon-history primary sources","Codex Alexandrinus collection profile",
       "Codex Alexandrinus is a fifth-century Greek biblical codex. After Revelation it preserves 1 Clement and 2 Clement, with the ending of 2 Clement lost. This is evidence for the contents of one major codex and for reception history, not a universal canon list.",
       "Manuscript collection profile"),
    ]
    for part,title,text,status in profiles:
        add_section(sections,part=part,title=title,text=text,source="Manuscript collection metadata",
                    provenance="Codex collection profile; verify folio-level details against current manuscript catalogues in app metadata.",status=status)


def render_book(sections):
    # Stable part order from first appearance.
    parts=[]
    for s in sections:
        if s['part'] not in parts: parts.append(s['part'])
    ids=[]
    for i,s in enumerate(sections):
        ids.append(f"work-{i+1}")
    toc=[]
    for part in parts:
        toc.append(f'<li class="toc-part">{html.escape(part)}</li>')
        for i,s in enumerate(sections):
            if s['part']==part:
                toc.append(f'<li><a href="#{ids[i]}">{html.escape(s["title"])}</a></li>')
    body=[]; current=None
    for i,s in enumerate(sections):
        if s['part']!=current:
            current=s['part']; body.append(f'<section class="part-page"><h1>{html.escape(current)}</h1></section>')
        paras=[]
        # Preserve simple chapter/paragraph lines. Very long lines are still paragraphs.
        for block in re.split(r"\n\s*\n|\n(?=(?:CHAPTER|Chapter|BOOK|Book|\d+\.|[IVXLCDM]+\.?\s))",s['text']):
            block=block.strip()
            if not block: continue
            if len(block)<150 and re.match(r"^(CHAPTER|Chapter|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.)",block):
                paras.append(f'<h3>{html.escape(block)}</h3>')
            else:
                paras.append(f'<p>{html.escape(block).replace(chr(10),"<br>")}</p>')
        body.append(f'''<article class="work" id="{ids[i]}">
          <h2>{html.escape(s['title'])}</h2>
          <div class="sourcebox"><b>Text status:</b> {html.escape(s['status'])}<br>
          <b>Provenance:</b> {html.escape(s['provenance'])}<br>
          <b>Source:</b> {html.escape(s['source'])}
          {('<br><b>Editorial note:</b> '+html.escape(s['notes'])) if s['notes'] else ''}</div>
          {''.join(paras)}
        </article>''')
    css='''
    @page { size:A4; margin:18mm 17mm 20mm 17mm; @bottom-center { content: counter(page); font-size:9pt; color:#777; } }
    @page:first { @bottom-center { content:""; } }
    html { font-family: Georgia, "Times New Roman", serif; color:#1d1b18; font-size:10.5pt; line-height:1.42; }
    body { margin:0; }
    .titlepage { page-break-after:always; min-height:245mm; display:flex; flex-direction:column; justify-content:center; text-align:center; }
    .titlepage h1 { font-size:34pt; letter-spacing:.02em; margin:0 0 12pt; }
    .titlepage h2 { font-size:15pt; font-weight:normal; color:#6b5a43; margin:0 auto 28pt; max-width:135mm; }
    .titlepage .edition { font-size:10pt; letter-spacing:.12em; text-transform:uppercase; }
    .notice { border-top:1px solid #a48b65; border-bottom:1px solid #a48b65; padding:12pt 0; margin:20pt auto 0; max-width:150mm; font-size:10pt; text-align:left; }
    .toc { page-break-after:always; }
    .toc h1 { font-size:24pt; }
    .toc ol { list-style:none; padding:0; margin:0; }
    .toc li { margin:2.5pt 0; }
    .toc .toc-part { margin-top:12pt; font-weight:bold; color:#6b5a43; }
    .toc a { color:#1d1b18; text-decoration:none; }
    .toc a::after { content: leader('.') target-counter(attr(href), page); }
    .part-page { page-break-before:always; page-break-after:always; min-height:230mm; display:flex; align-items:center; justify-content:center; text-align:center; }
    .part-page h1 { font-size:28pt; font-weight:normal; color:#6b5a43; max-width:150mm; }
    article.work { page-break-before:always; }
    h2 { font-size:21pt; line-height:1.15; margin:0 0 10pt; string-set: worktitle content(); }
    h3 { font-size:12.5pt; margin:12pt 0 5pt; page-break-after:avoid; }
    p { margin:0 0 7pt; text-align:justify; orphans:3; widows:3; }
    .sourcebox { font-family: Arial, sans-serif; font-size:8.5pt; line-height:1.35; background:#f3efe7; border-left:2.5pt solid #9c815b; padding:8pt 9pt; margin:0 0 14pt; page-break-inside:avoid; }
    '' '
    ''
    html_doc=f'''<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(TITLE)}</title><style>{css}</style></head><body>
    <section class="titlepage"><div class="edition">The Ancient Canon</div><h1>Complete Ancient Library</h1><h2>{html.escape(SUBTITLE)}</h2>
    <div class="notice"><b>Historical accuracy notice.</b> No ancient work survives in its author's autograph, and several works in this corpus survive in competing recensions or translations. Therefore no responsible edition can promise a mathematically "perfect" original wording. This volume gives complete reading texts from documented public-domain editions and preserves source/provenance labels. A historical translation is never silently relabelled as a fresh direct translation from an earliest fragment. Where a text's earliest recoverable wording differs materially by witness, that difference belongs in the app's critical apparatus.</div>
    <p style="margin-top:28pt">Research/reading edition - August 2026</p></section>
    <section class="toc"><h1>Contents</h1><ol>{''.join(toc)}</ol></section>
    {''.join(body)}</body></html>'''
    HTML.write_text(html_doc,encoding="utf-8")
    from weasyprint import HTML as WHTML
    WHTML(filename=str(HTML),base_url=str(OUT)).write_pdf(str(PDF))


def main():
    coverage=["# Source coverage report","", "This report records what the automated complete-reading build actually included. It is deliberately candid about missing or source-critical items.",""]
    sections=[]
    # 1) User-linked ancient collection.
    try:
        fetch_fbe(sections,coverage)
    except Exception as e:
        coverage.append(f"- Forgotten Books of Eden collection failed at index level: {e}")

    # 2) Early Christian corpus.
    wdb=SRC/"Writings-Database"
    try:
        clone("https://github.com/HistoricalChristianFaith/Writings-Database.git",wdb)
        add_wdb(sections,wdb,coverage)
    except Exception as e:
        coverage.append(f"- Writings Database ingestion failed: {e}")

    add_profiles(sections)
    sections.sort(key=lambda s: (list(dict.fromkeys(x['part'] for x in sections)).index(s['part']) if sections else 0))
    manifest={"title":TITLE,"edition":"2026 source-controlled historical reading edition","section_count":len(sections),"sections":sections}
    JSONOUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    coverage += ["",f"## Totals","",f"- Included reading sections/files: **{len(sections)}**",f"- Total extracted characters: **{sum(s['chars'] for s in sections):,}**",f"- PDF target: `{PDF.name}`"]
    REPORT.write_text("\n".join(coverage),encoding="utf-8")
    if len(sections)<25:
        raise SystemExit(f"Refusing to build a misleading 'complete' volume: only {len(sections)} sections were captured. See coverage report.")
    render_book(sections)
    print(f"Built {PDF} ({PDF.stat().st_size:,} bytes), {len(sections)} sections",flush=True)

if __name__=='__main__':
    main()
