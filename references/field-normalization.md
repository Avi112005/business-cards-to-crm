# Field normalization rules

Deterministic cleanup applied by `src/normalize.js`. The agent's raw
extraction is allowed to be sloppy — these rules make it CRM-ready.

## Name

- Collapse whitespace; title-case each word.
- Preserve `Mc`/`Mac` (`mcdonald` → `McDonald`), hyphenated (`anne-marie` → `Anne-Marie`), and Roman numeral suffixes (`II`, `III`, `IV`) plus `Jr`/`Sr` (uppercased).
- `name_original` is set to the raw printed form only when not already present.

## Title & seniority

- Expand common abbreviations leftmost-first: `CEO` → `Chief Executive Officer`, `CTO` → `Chief Technology Officer`, `VP` → `Vice President`, `SVP`, `EVP`, `Dir` → `Director`, `Mgr` → `Manager`, `Eng` → `Engineer`, `MD` → `Managing Director`, `GM` → `General Manager`, `Pres` → `President`.
- `Co-Founder`/`Cofounder` → `Co-Founder`.
- Infer a `seniority` bucket by keyword match, first rule wins:
  - `C-level`: chief*, ceo/cto/cfo/coo/cmo/cio/cpo/cro/cso/chro, president, founder, co-founder, owner, principal, partner
  - `VP`: vp, vice president, svp, evp, avp, "head of"
  - `Director`: director, dir, managing director, md
  - `Manager`: manager, mgr, lead, supervisor, gm
  - `IC`: engineer, developer, designer, analyst, scientist, specialist, associate, consultant, coordinator, architect
  - fallback: `Other`

## Email

- Lowercase, strip whitespace; validate with a simple regex. Invalid → dropped. Duplicates removed, order preserved.

## Phone

- Strip non-digits (keep leading `+`); prepend `+` when ≥10 digits → E.164.
- Type detection by keyword: `fax` → `fax`, `mob|cell|mobile` → `mobile`, `tel|office|work` → `landline`, else `unknown`.
- Deduplicated on `e164` (fallback `raw`).

## URL / website

- Prepend `https://` when no scheme present; validate against a domain regex. Invalid → empty.

## Country

- ISO alpha-2 (2 letters) passes through uppercased.
- Common names mapped: `usa/united states/u.s.a./america` → `US`, `uk/united kingdom/england/britain` → `GB`, etc. Unknown → title-cased.
