# The Ancient Library - Deep Textual Audit

Audit version: 5.0
Audit date: 2026-08-23

## Audit standard

This is a source-provenance and reading-text audit, not a claim that nineteenth- or early twentieth-century English translations supersede modern critical editions.

- Each retained section has a SHA-256 content fingerprint and confidence tier.
- Explicitly self-declared AI/ChatGPT translations in selected upstream files are rejected.
- The mixed-source Writings Database is not treated as a uniform translation authority.
- Sacred-Texts/Platt web navigation, modern introductions and chapter summaries are removed where safely separable.
- Duplicated ANF/NPNF mirror contents/front matter is removed only at a repeated title boundary or individually audited boundary.
- Complex-recension works remain lower-confidence even when copied perfectly from their selected English witness.

## Results

- Retained sections: 193
- Confidence tiers: {'A-': 2, 'B': 169, 'B-': 3, 'C': 17, 'EDITORIAL': 2}
- Explicit AI/ChatGPT-marked selected sources excluded: 0
- Purely editorial FBE sections excluded: ['The Testaments of the Twelve Patriarchs']
- WDB duplicate/front-matter sections cleaned: 152
- True missing required core markers: []

## Confidence tiers

- A-: named established historical edition/translation visible in the source path; strong reading-edition confidence, but a modern critical edition still governs exact scholarly quotation.
- B / B-: useful historical translation with high source-file fidelity; exact translation pedigree or ancient wording warrants critical-edition checking for quotation-level scholarship.
- C: complex manuscript/recension history; retained as a historical reading witness, not represented as one indisputable original text.
- EDITORIAL: modern collection/manuscript profile, not ancient translated text.
