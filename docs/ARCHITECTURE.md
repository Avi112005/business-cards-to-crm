# Architecture

How the pieces fit together, for maintainers and anyone auditing the skill.

## Data model

The pipeline's only source of truth is a **JSONL file of contact records** —
one record per line, shaped by `schemas/contact.schema.json`. Raw records
(skeleton from `cards-crm new`, then filled by the agent) and processed records
(normalized / deduped) use the *same* shape, so any stage can be re-run on any
file.

## Division of labor

The skill splits work deliberately:

| Who | What |
|-----|------|
| **Agent (vision + judgment)** | Read card images, extract fields, research/enrich, decide merge edge cases |
| **Deterministic CLI** | Normalize, validate, dedupe, flatten, export — the repetitive, auditable parts |

This mirrors the "bundled tooling" pattern: the CLI does the mechanical work,
the agent does the judgment, and everything is reproducible from the JSONL.

## Pipeline

```
cards/*.jpg
   │  cards-crm new
   ▼
records.jsonl            (empty skeleton; agent fills via vision)
   │  cards-crm check        (validate)
   │  cards-crm normalize    (title-case, E.164, title expansion)
   │  cards-crm enrich       (gap report + lookup queries; agent runs searches)
   │  cards-crm dedupe       (hard-key + fuzzy merge)
   ▼
records.deduped.jsonl
   │  cards-crm export --target hubspot|salesforce|notion|generic
   ▼
contacts.csv / contacts.json
```

## Module map

- `bin/cards-crm.js` — shebang entry that calls `main()`
- `src/cli.js` — argument parsing (`node:util` `parseArgs`) + subcommand dispatch
- `src/extract.js` — record factory, image scan, validation, JSONL I/O
- `src/normalize.js` — pure-JS field normalization
- `src/enrich.js` — gap detection + query generation + provenance
- `src/dedupe.js` — two-pass merge (Levenshtein similarity, no deps)
- `src/export.js` — flatten + target column maps (CSV with BOM, JSON)

## Zero dependencies

The CLI uses only Node.js built-ins (`node:fs`, `node:path`, `node:util`,
`node:test`). Fuzzy matching is a hand-rolled Levenshtein ratio — accurate
enough for name/company dedupe and free of native/binary dependencies. This
keeps `npx cards-crm` instant and works on every platform.

## Testing

`test/*.test.js` uses the built-in `node:test` runner (`npm test`). Coverage
focuses on the deterministic, bug-prone parts: normalization (names, titles,
E.164 phones, country codes), dedupe (hard/fuzzy merge semantics), and export
(column maps, BOM, JSON shape).
