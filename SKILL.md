---
name: business-cards-to-crm
version: "0.1.0"
description: Turn photos of business cards into clean, deduped, enriched CRM records (name, title, company, email, phone, LinkedIn, notes). Use when the user drops card images or a folder of cards and wants contacts ready for HubSpot/Salesforce/Notion/CSV. Extraction is done by your own vision (Read the images); a bundled npx CLI (`npx cards-crm`) does the normalization, deduplication, and export. Free — no paid APIs.
argument-hint: "<cards-dir-or-images> [--target hubspot|salesforce|notion|generic]"
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion, WebSearch, WebFetch
homepage: https://github.com/Avi112005/business-cards-to-crm
repository: https://github.com/Avi112005/business-cards-to-crm
license: MIT
user-invocable: true
---

# /business-cards-to-crm

You don't have a CRM; this skill gives you one. The user hands you business-card
photos (or a folder of them). You read each image with your own vision, extract
the fields, and then run a bundled, zero-dependency CLI (`npx cards-crm`) that
normalizes, dedupes, enriches, and exports everything to a CRM-ready CSV/JSON.
There is no paid API anywhere in the loop.

## Resolve `SKILL_DIR` (do this before any command)

Every command below runs a bundled script under `SKILL_DIR/`. Set `SKILL_DIR` to
the **absolute path of the directory containing THIS SKILL.md you just Read** —
your harness gave you that path in the Read result. The CLI is a direct sibling
of this file (`SKILL_DIR/bin/cards-crm.js`):

```
Read ~/.config/opencode/skills/business-cards-to-crm/SKILL.md → SKILL_DIR=…/business-cards-to-crm
Read ~/.claude/plugins/…/skills/business-cards-to-crm/SKILL.md  → SKILL_DIR=…/business-cards-to-crm
```

Run the CLI one of two ways (both equivalent):

```bash
npx cards-crm <command> ...                 # if published to npm
node "${SKILL_DIR}/bin/cards-crm.js" <command> ...   # always works from the repo
```

If `npx cards-crm` isn't installed/published, prefer the `node "${SKILL_DIR}/bin/cards-crm.js"`
form so the skill works everywhere. Requires Node.js ≥ 18.17.

## When to use

- User drops business-card image(s), a folder, or a zip of cards and wants contacts.
- User says "put these cards into my CRM / HubSpot / Salesforce / Notion / a CSV".
- User asks to "scan / digitize / clean up" a pile of cards.

## The pipeline (overview)

```
cards/*.jpg ── new ──► records.jsonl ── fill (you) ──► check ──► normalize ──► enrich (you) ──► dedupe ──► export ──► contacts.csv
```

`records.jsonl` is the single source of truth: one JSON record per line, shaped
by `schemas/contact.schema.json`. Raw and processed records share the same shape,
so any stage can be re-run.

## Step 1 — locate the cards

Ask or detect the source:

- A folder → glob for images (`*.jpg *.jpeg *.png *.webp *.heic *.tif *.tiff *.bmp`).
- Pasted/attached images → note their paths.

If the user hasn't told you where the cards are, ask. Don't guess.

## Step 2 — scaffold records

```bash
node "${SKILL_DIR}/bin/cards-crm.js" new "<cards-dir>" -o records.jsonl
```

This writes `records.jsonl` with one empty record per image (`id`, `source`,
`date_collected`). If you were given loose image paths instead of a folder,
create `records.jsonl` yourself using the record shape in
`schemas/contact.schema.json` (the `new` command needs a directory).

## Step 3 — extract (your vision)

Read every card image (parallel Read calls). For **each** record, fill the JSONL
with exactly what is printed — do not invent anything:

- `name` / `name_original` (print the name as shown, even if all-caps)
- `title` (as printed)
- `company`
- `emails` (list), `phones` (list of `{"raw": "…"}`), `website`
- `address` (street/city/region/country/postal as printed)
- `linkedin` / `twitter` / `github` if literally printed
- `met_at` / `notes` — use the **conversation context** (event, reason you met)
- `tags` — any obvious segments

Leave absent fields empty. Flag unreadable cards to the user instead of guessing.
Set `provenance.extracted_by` to `"agent-vision"`.

## Step 4 — validate

```bash
node "${SKILL_DIR}/bin/cards-crm.js" check records.jsonl
```

Fix any issues it lists (missing names, malformed emails). Exit 0 means clean.

## Step 5 — normalize

```bash
node "${SKILL_DIR}/bin/cards-crm.js" normalize records.jsonl -o records.normalized.jsonl
```

Title-case names, expand titles (`CEO` → `Chief Executive Officer`), E.164
phones, lowercase emails, country codes. See `references/field-normalization.md`.

## Step 6 — enrich (your research)

```bash
node "${SKILL_DIR}/bin/cards-crm.js" enrich records.normalized.jsonl
```

This prints a **gap report** (what's missing) and concrete **lookup queries**.
Run those searches (WebSearch/WebFetch) and merge confirmed findings back into
the records. Follow `references/enrichment-sources.md`:

- **Never invent data** — a missing field beats a hallucinated one.
- Record each filled field in `provenance.enriched`.
- One batch pass, then move on.

## Step 7 — dedupe

```bash
node "${SKILL_DIR}/bin/cards-crm.js" dedupe records.normalized.jsonl -o records.deduped.jsonl
```

Merges duplicates (identical email/phone = certain; fuzzy name+company =
probable). Read the merge report; if it merged two *different* people, tell the
user rather than silently trusting it. See `references/dedupe-rules.md`.

## Step 8 — export

```bash
node "${SKILL_DIR}/bin/cards-crm.js" export records.deduped.jsonl -o contacts.csv --target hubspot
```

Targets: `generic` (full columns), `hubspot`, `salesforce`, `notion`. Default
`generic`. Ask the user which target if they didn't say. For a non-CSV deliverable
use `--format json`.

## Step 9 — report

```bash
node "${SKILL_DIR}/bin/cards-crm.js" report records.deduped.jsonl
```

Summarize for the user: how many cards in, how many unique contacts out, how many
merged, and where the output file is. Offer the CSV path.

## Failure modes

- **No images found** → `new` exits 1. Ask the user where the cards are.
- **Unreadable card** → skip it, list it in your report, don't guess fields.
- **Over-merging** → if the dedupe report merges distinct people, lower
  `NAME_THRESHOLD`/`COMPANY_THRESHOLD` in `src/dedupe.js` and re-run.
- **Wrong target** → `export` lists valid `--target` choices.

## Security & permissions

- **Does not** send card images to any API. Extraction is your own vision.
- **Enrichment** is opt-in web search; only public data is used.
- **Writes** only the JSONL/CSV files you specify. No keys, no uploads, no
  persistence of card images.

## Bundled tooling

`bin/cards-crm.js` (entry), `src/cli.js` (orchestrator), `src/extract.js` (factory
+ validation + JSONL I/O), `src/normalize.js`, `src/enrich.js`, `src/dedupe.js`,
`src/export.js`. Review `docs/ARCHITECTURE.md` for the full map.
