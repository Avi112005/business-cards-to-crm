# Dedupe rules

Two-pass strategy in `src/dedupe.js`, greedy, first-record-wins.

## Pass 1 — hard keys (always merge)

Two records are the same person when they share a **hard identity key**:

- an identical normalized email (`email:avi@acme.com`), or
- an identical E.164 phone (`phone:+14155550100`).

This is treated as certain — no threshold. The first record becomes the
survivor; later records are merged into it.

## Pass 2 — soft fuzzy match (same person, new company)

When no hard key matches, a record is merged into an existing survivor if:

- name similarity ≥ **86** (Levenshtein ratio), **and**
- company similarity ≥ **82**, **or** either side has no company.

This catches the classic "handed me a card at an old job" duplicate.

## Merge semantics

- Non-empty values win over empty (so enrichment on one card isn't lost).
- `emails`, `tags` union-deduplicated.
- `phones` merged and deduplicated on `e164` (fallback `raw`).
- `source` accumulates both paths (semicolon-joined).
- `provenance.merged_from` records every ID folded into the survivor.
- `provenance.confidence` keeps the max of the two.

## Tuning

Thresholds are module constants (`NAME_THRESHOLD`, `COMPANY_THRESHOLD`).
Raise them for stricter dedupe, lower for looser. A merge report (kept /
merged / reason) is always printed so every decision is auditable.
