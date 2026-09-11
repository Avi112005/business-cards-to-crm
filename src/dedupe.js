/**
 * Deduplication and merge.
 *
 * Two-pass strategy:
 *   1. HARD key match — identical normalized email or identical E.164 phone
 *      always merges (same person beyond reasonable doubt).
 *   2. SOFT fuzzy match — high name similarity AND (high company similarity OR
 *      one side missing) merges across batches (same person, new company).
 *
 * Similarity is Levenshtein ratio (pure JS, no deps).
 */

const NAME_THRESHOLD = 86;
const COMPANY_THRESHOLD = 82;

/** Levenshtein distance between two strings (case-folded). */
export function levenshtein(a, b) {
  a = String(a ?? "").toLowerCase();
  b = String(b ?? "").toLowerCase();
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 0..100 similarity ratio between two strings. */
export function similarity(a, b) {
  a = String(a ?? "").trim();
  b = String(b ?? "").trim();
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const max = Math.max(a.length, b.length);
  return ((max - dist) / max) * 100;
}

function hardKeys(rec) {
  const keys = new Set();
  for (const email of rec.emails ?? []) {
    if (email) keys.add(`email:${email.toLowerCase()}`);
  }
  for (const phone of rec.phones ?? []) {
    if (phone && phone.e164) keys.add(`phone:${phone.e164}`);
  }
  return keys;
}

function unionField(a, b) {
  a = String(a ?? "").trim();
  b = String(b ?? "").trim();
  if (a === b) return a;
  if (a && b) return `${a}; ${b}`;
  return a || b;
}

function dedupeList(items) {
  return [...new Set(items)];
}

function mergePhones(a, b) {
  const out = [];
  const seen = new Set();
  for (const p of [...a, ...b]) {
    if (!p || typeof p !== "object") continue;
    const key = p.e164 || p.raw;
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/** Merge `b` into `a` (a is the survivor); non-empty values win. */
export function mergeRecords(a, b) {
  const merged = { ...a };
  const prov = { ...(merged.provenance ?? {}) };

  if (!merged.source || merged.source === b.source) {
    merged.source = unionField(merged.source, b.source);
  }

  for (const field of [
    "name", "name_original", "title", "title_normalized", "seniority",
    "company", "company_website", "company_industry", "company_size",
    "website", "linkedin", "twitter", "github", "met_at", "notes",
    "date_collected",
  ]) {
    merged[field] = merged[field] || b[field] || "";
  }

  merged.emails = dedupeList([...(merged.emails ?? []), ...(b.emails ?? [])]);
  merged.tags = dedupeList([...(merged.tags ?? []), ...(b.tags ?? [])]);
  merged.phones = mergePhones(merged.phones ?? [], b.phones ?? []);

  if (!merged.address || Object.keys(merged.address).length === 0) {
    merged.address = b.address ?? {};
  }

  const mergedFrom = [...(prov.merged_from ?? [])];
  mergedFrom.push(b.id ?? "?");
  prov.merged_from = dedupeList(mergedFrom);
  prov.enriched = dedupeList([...(prov.enriched ?? []), ...(b.provenance?.enriched ?? [])]);
  prov.confidence = Math.max(
    Number(prov.confidence ?? 0),
    Number(b.provenance?.confidence ?? 0),
  );
  merged.provenance = prov;
  return merged;
}

function softMatch(a, b) {
  const nameSim = similarity(a.name, b.name);
  if (nameSim < NAME_THRESHOLD) return false;
  const compA = String(a.company ?? "").trim();
  const compB = String(b.company ?? "").trim();
  if (!compA || !compB) return true;
  return similarity(compA, compB) >= COMPANY_THRESHOLD;
}

/**
 * Return [dedupedRecords, mergeReport].
 * Records merge greedily; first record with an identity is the survivor.
 */
export function dedupe(records) {
  const report = [];
  const hard = new Map();
  const survivors = [];

  for (const rec of records) {
    const keys = [...hardKeys(rec)];

    let targetIdx = null;
    for (const key of keys) {
      if (hard.has(key)) {
        targetIdx = hard.get(key);
        break;
      }
    }

    if (targetIdx === null) {
      for (let i = 0; i < survivors.length; i++) {
        if (softMatch(survivors[i], rec)) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === null) {
      const idx = survivors.length;
      survivors.push({ ...rec });
      for (const key of keys) hard.set(key, idx);
    } else {
      const hadHardKey = keys.some((k) => hard.has(k));
      const survivor = survivors[targetIdx];
      report.push({
        kept: survivor.id,
        merged: rec.id,
        reason: hadHardKey ? "hard" : "fuzzy",
        name: survivor.name || rec.name,
      });
      survivors[targetIdx] = mergeRecords(survivor, rec);
      for (const key of keys) hard.set(key, targetIdx);
    }
  }

  return [survivors, report];
}
