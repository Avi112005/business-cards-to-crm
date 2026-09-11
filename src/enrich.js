/**
 * Gap detection and enrichment helpers.
 *
 * Enrichment itself is judgment work the agent performs (web search, LinkedIn
 * lookup, company research). This module provides the deterministic
 * scaffolding: identify what is missing, generate concrete lookup queries, and
 * merge the agent's findings back into a record with provenance tracking.
 */

const ENRICHABLE_FIELDS = [
  "linkedin", "twitter", "github", "company_website", "company_industry",
  "company_size", "emails", "phones", "website",
];

function isEmpty(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Return { field: missingCount } over enrichable fields. */
export function gapReport(records) {
  const counts = {};
  for (const field of ENRICHABLE_FIELDS) {
    counts[field] = records.filter((rec) => isEmpty(rec[field])).length;
  }
  return counts;
}

/** Return the enrichable fields missing from `rec`. */
export function missingFields(rec) {
  return ENRICHABLE_FIELDS.filter((f) => isEmpty(rec[f]));
}

/** Return concrete search queries to fill this record's gaps. */
export function buildLookupQueries(rec) {
  const queries = [];
  const name = rec.name ?? "";
  const company = rec.company ?? "";
  const missing = new Set(missingFields(rec));

  if (missing.has("linkedin")) queries.push(`${name} ${company} LinkedIn`);
  if (missing.has("company_website") && company) queries.push(`${company} official website`);
  if (missing.has("company_industry") && company) queries.push(`${company} company industry`);
  if (missing.has("company_size") && company) queries.push(`${company} company size employees`);
  if (name && company) queries.push(`${name} ${company} email contact`);
  return queries;
}

/** Set `field` to `value`, recording it in provenance.enriched. */
export function applyEnrichment(rec, field, value) {
  const out = { ...rec };
  const prov = { ...(out.provenance ?? {}) };
  const enriched = [...(prov.enriched ?? [])];
  if (!enriched.includes(field)) enriched.push(field);
  prov.enriched = enriched;
  out.provenance = prov;
  out[field] = value;
  return out;
}
