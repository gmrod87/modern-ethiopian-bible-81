#!/usr/bin/env python3
"""Build the Ancient Library JSON used by the Hobah Books tab.

This reuses the source-controlled ingestion logic from build_complete_ancient_library.py
but intentionally skips PDF rendering so native App Store builds remain fast and do not
need WeasyPrint/Pango. It produces the same complete reading-section manifest shape.
"""
from __future__ import annotations
import json

from build_complete_ancient_library import (
    OUT, SRC, TITLE, JSONOUT, fetch_fbe, clone, add_wdb, add_profiles
)


def main():
    coverage=[]
    sections=[]
    fetch_fbe(sections,coverage)
    wdb=SRC/"Writings-Database"
    clone("https://github.com/HistoricalChristianFaith/Writings-Database.git",wdb)
    add_wdb(sections,wdb,coverage)
    add_profiles(sections)
    if len(sections)<25:
        raise SystemExit(f"Ancient Library app manifest is unexpectedly small: {len(sections)} sections")
    manifest={
        "title":TITLE,
        "edition":"2026 source-controlled historical reading edition",
        "audit_date":"2026-08-23",
        "canonical_scope":"Ancient Library historical texts; distinct from the primary 81-book Scripture collection",
        "section_count":len(sections),
        "total_characters":sum(s.get("chars",0) for s in sections),
        "sections":sections,
    }
    OUT.mkdir(parents=True,exist_ok=True)
    JSONOUT.write_text(json.dumps(manifest,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Built Hobah Ancient Library app manifest: {len(sections)} sections, {manifest['total_characters']:,} characters")
    for line in coverage:
        print(line)


if __name__=="__main__":
    main()
