# business-cards-to-crm

Turn photos of business cards into clean, deduped, CRM-ready contacts.

Point it at a folder of card photos and get a `contacts.csv` you can import
straight into HubSpot, Salesforce, or Notion. Free, zero dependencies, no paid
APIs.

## How it works

1. **Scan** — one empty record per card.
2. **Fill** — the AI reads each photo and fills in the fields (name, title,
   company, email, phone, LinkedIn).
3. **Clean** — normalize, merge duplicates, export.

The AI does the judgment (reading cards, finding missing info); the CLI does the
mechanical work. Everything runs on the same `records.jsonl` file, so any step
can be re-run.

## Install

Requires Node.js 18.17+.

```bash
# no install — run straight from npm
npx business-cards-to-crm --help

# or install globally
npm install -g business-cards-to-crm
cards-crm --help
```

(`cards-crm` is the command name; `business-cards-to-crm` is the package name.)

## Quick start

```bash
# 1. Create one record per card in the folder
cards-crm new cards/ -o records.jsonl

# 2. (AI fills in records.jsonl — see "Use it as an AI skill" below)

# 3. Validate
cards-crm check records.jsonl

# 4. Normalize names, phones, titles
cards-crm normalize records.jsonl -o records.normalized.jsonl

# 5. Merge duplicates
cards-crm dedupe records.normalized.jsonl -o records.deduped.jsonl

# 6. Export to your CRM
cards-crm export records.deduped.jsonl -o contacts.csv --target hubspot
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
