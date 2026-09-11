# Enrichment sources (free, no API key)

The skill is designed to work with **zero paid APIs**. Extraction is done by
the agent's own vision (it Reads the card images); enrichment is the agent
running web searches. This file is the playbook for *which* sources to use and
*when*, so the agent stays consistent.

## Priority order for gap-filling

1. **LinkedIn** — best single source for current title, company, and headshot.
   Query: `"<full name>" <company> LinkedIn`. Prefer the person's canonical
   `/in/<slug>` URL.
2. **Company site** — domain, industry, and size. Query:
   `"<company>" official website`, then read the about/careers page for
   headcount and sector.
3. **Crunchbase / OpenCorporates / LinkedIn company page** — company size and
   industry when the company site is thin.
4. **Hunter.io public patterns / website footer** — email format when the card
   omits email (note: never scrape/guess emails beyond public data).
5. **X / GitHub** — socials when the person is technical or public.

## Rules

- **Never invent data.** If a lookup doesn't confirm a field, leave it empty —
  a missing field is better than a hallucinated one.
- **Record provenance.** Every enriched field must be added via
  `applyEnrichment(rec, field, value)` (or manually appended to
  `provenance.enriched`) so the export is auditable.
- **One pass.** Enrich in a single batch (build the query list with
  `cards-crm enrich`, run all searches, merge, then export). Don't enrich
  one-by-one mid-conversation.
