# business-cards-to-crm

Turn photos of business cards into clean, deduped, CRM-ready contacts.

Point it at a folder of card photos and get a `contacts.csv` you can import
straight into HubSpot, Salesforce, or Notion. Free, zero dependencies, no paid
APIs.

**Live on npm:** `npx business-cards-to-crm` — try it now.

## What you get

**In:** a folder of card photos
```
cards/IMG_001.jpg   cards/IMG_002.jpg   ...
```

**Out:** one clean CSV
```csv
Email,First Name,Last Name,Job Title,Company,Phone Number,Website URL,LinkedIn URL
avi@acme.com,Avi,Singh,CEO & Founder,Acme Inc.,+14155550100,https://www.acme.com,https://linkedin.com/in/avisingh
```

Duplicates are merged, phones are normalized to E.164 (`415-555-0100` →
`+14155550100`), and titles are expanded (`CEO` → `Chief Executive Officer`).

## How it works

1. **Scan** — one empty record per card.
2. **Fill** — the AI reads each photo and fills in the fields (name, title,
   company, email, phone, LinkedIn).
3. **Clean** — normalize, merge duplicates, export.

The AI does the judgment (reading cards, finding missing info); the CLI does the
mechanical work. Everything runs on the same `records.jsonl` file, so any step
can be re-run.

## Install

Requires Node.js 18.17+. Two ways to run — pick one:

**Option A — `npx` (no install).** Prefix every command with
`npx business-cards-to-crm`:

```bash
npx business-cards-to-crm --help
```

**Option B — install globally once.** Then use the short `cards-crm` command:

```bash
npm install -g business-cards-to-crm
cards-crm --help
```

> `business-cards-to-crm` is the **package name** (use with npx / npm install);
> `cards-crm` is the **command name** (only available after a global install).

## Quick start

Run from the folder that contains your `cards/` directory. Examples use `npx`
(Option A) — if you installed globally, write `cards-crm` instead.

```bash
# 1. Create one record per card in the folder
npx business-cards-to-crm new cards/ -o records.jsonl

# 2. (AI fills in records.jsonl — see "Use it as an AI skill" below)

# 3. Validate
npx business-cards-to-crm check records.jsonl

# 4. Normalize names, phones, titles
npx business-cards-to-crm normalize records.jsonl -o records.normalized.jsonl

# 5. Merge duplicates
npx business-cards-to-crm dedupe records.normalized.jsonl -o records.deduped.jsonl

# 6. Export to your CRM
npx business-cards-to-crm export records.deduped.jsonl -o contacts.csv --target hubspot
```

## Commands

| Command | What it does |
|---------|--------------|
| `new <dir>` | Scan a folder of images → one empty record per card |
| `check <file>` | Validate records and list problems |
| `normalize <file>` | Fix name casing, phone E.164, expand job titles |
| `enrich <file>` | Show which fields are missing + search queries to find them |
| `dedupe <file>` | Merge duplicate people (same email/phone, or fuzzy name+company) |
| `export <file> -o OUT` | Write CSV/JSON for a CRM |
| `report <file>` | Print a short summary of the batch |

Options: `-o/--out FILE`, `--target generic|hubspot|salesforce|notion`,
`--format csv|json` (export only), `-h/--help`.

## Use it as an AI skill

This repo is also an AI skill. Copy the folder into your agent (Claude Code,
Codex, Cursor, opencode) and say:

> "turn the cards in `cards/` into HubSpot contacts"

The agent reads each photo, fills `records.jsonl`, and runs the CLI for you.
See `SKILL.md` for the full workflow.

## License

MIT
