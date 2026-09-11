/**
 * Deterministic field normalization.
 *
 * Zero-dependency. Turns ragged card text into consistent CRM-ready fields:
 * name casing, title expansion + seniority, email/phone/URL cleanup, and
 * country/region tagging.
 */

const TITLE_ABBR = {
  ceo: "Chief Executive Officer",
  cto: "Chief Technology Officer",
  cfo: "Chief Financial Officer",
  coo: "Chief Operating Officer",
  cmo: "Chief Marketing Officer",
  cio: "Chief Information Officer",
  cpo: "Chief Product Officer",
  cro: "Chief Revenue Officer",
  cso: "Chief Security Officer",
  chro: "Chief Human Resources Officer",
  vp: "Vice President",
  svp: "Senior Vice President",
  evp: "Executive Vice President",
  avp: "Assistant Vice President",
  dir: "Director",
  mgr: "Manager",
  eng: "Engineer",
  sr: "Senior",
  jr: "Junior",
  founder: "Founder",
  "co-founder": "Co-Founder",
  cofounder: "Co-Founder",
  pres: "President",
  md: "Managing Director",
  gm: "General Manager",
};

const SENIORITY_RULES = [
  ["C-level", ["chief", "ceo", "cto", "cfo", "coo", "cmo", "cio", "cpo", "cro", "cso", "chro", "president", "founder", "co-founder", "cofounder", "owner", "principal", "partner"]],
  ["VP", ["vp", "vice president", "svp", "evp", "avp", "head of"]],
  ["Director", ["director", "dir", "managing director", "md"]],
  ["Manager", ["manager", "mgr", "lead", "supervisor", "gm"]],
  ["IC", ["engineer", "developer", "designer", "analyst", "scientist", "specialist", "associate", "consultant", "coordinator", "architect"]],
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URL_RE = /^(https?:\/\/)?(www\.)?[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i;

const COUNTRY_TO_CODE = {
  usa: "US", "united states": "US", "u.s.a.": "US", america: "US",
  canada: "CA", uk: "GB", "united kingdom": "GB", england: "GB", britain: "GB",
  germany: "DE", france: "FR", spain: "ES", italy: "IT", netherlands: "NL",
  australia: "AU", "new zealand": "NZ", india: "IN", singapore: "SG",
  japan: "JP", china: "CN", korea: "KR", brazil: "BR", mexico: "MX",
  uae: "AE", sweden: "SE", switzerland: "CH", israel: "IL", ireland: "IE",
};

const CALLING_CODES = {
  US: "1", CA: "1", GB: "44", DE: "49", FR: "33", ES: "34",
  IT: "39", NL: "31", AU: "61", NZ: "64", IN: "91", SG: "65",
  JP: "81", CN: "86", KR: "82", BR: "55", MX: "52", AE: "971",
  SE: "46", CH: "41", IL: "972", IE: "353",
};

/** Title-case a display name, preserving Mc/Mac and hyphenation. */
export function normalizeName(value) {
  if (!value) return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  const words = [];
  for (const w of s.split(" ")) {
    const low = w.toLowerCase();
    if (["ii", "iii", "iv", "jr", "sr"].includes(low)) {
      words.push(w.toUpperCase());
    } else if (low.startsWith("mc") && low.length > 2) {
      words.push("Mc" + w[2].toUpperCase() + w.slice(3).toLowerCase());
    } else if (low.startsWith("mac") && low.length > 3) {
      words.push("Mac" + w[3].toUpperCase() + w.slice(4).toLowerCase());
    } else if (w.includes("-")) {
      words.push(w.split("-").map(cap).join("-"));
    } else {
      words.push(cap(w));
    }
  }
  return words.join(" ");
}

function cap(w) {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Return [normalizedTitle, seniority]. */
export function normalizeTitle(value) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return ["", ""];
  const low = raw.toLowerCase();
  const parts = [];
  for (const token of low.split(" ")) {
    const stripped = token.replace(/[.,]$/, "");
    parts.push(TITLE_ABBR[stripped] ?? cap(token));
  }
  const normalized = parts.join(" ");

  let seniority = "Other";
  for (const [bucket, needles] of SENIORITY_RULES) {
    if (needles.some((n) => low.includes(n))) {
      seniority = bucket;
      break;
    }
  }
  return [normalized, seniority];
}

/** Lowercase + validate an email; invalid returns "". */
export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

/**
 * Normalize a phone to E.164. `countryHint` (ISO alpha-2) is used when the
 * number is printed without a country code. A 10-digit number with no hint is
 * assumed North America (+1).
 */
export function normalizePhone(value, countryHint = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return { raw: "", e164: "", type: "unknown" };
  const digits = raw.replace(/[^0-9+]/g, "");

  let e164;
  if (digits.startsWith("+")) {
    e164 = digits;
  } else if (digits.startsWith("00") && digits.length > 2) {
    e164 = "+" + digits.slice(2);
  } else {
    const cc = CALLING_CODES[String(countryHint).toUpperCase()] ?? "";
    if (cc) {
      const body = digits.startsWith("0") ? digits.slice(1) : digits;
      e164 = "+" + cc + body;
    } else if (digits.length === 10) {
      e164 = "+1" + digits;
    } else {
      e164 = "";
    }
  }

  const low = raw.toLowerCase();
  let type = "unknown";
  if (low.includes("fax")) type = "fax";
  else if (/(mob|cell|mobile)/.test(low)) type = "mobile";
  else if (/(tel|office|work)/.test(low)) type = "landline";

  return { raw, e164, type };
}

/** Prepend https:// when missing; validate; invalid returns "". */
export function normalizeUrl(value) {
  let url = String(value ?? "").trim();
  if (!url) return "";
  if (!/^[a-z]+:\/\//i.test(url)) url = "https://" + url;
  return URL_RE.test(url) ? url : "";
}

/** Map a country name to ISO alpha-2 (2-letter codes pass through). */
export function normalizeCountry(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "";
  if (COUNTRY_TO_CODE[v]) return COUNTRY_TO_CODE[v];
  if (v.length === 2) return v.toUpperCase();
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Return a normalized copy of `rec` (does not mutate input). */
export function normalizeRecord(rec) {
  const out = { ...rec };

  out.name = normalizeName(rec.name);
  if (!out.name_original) out.name_original = rec.name ?? "";

  const [normalizedTitle, seniority] = normalizeTitle(rec.title);
  out.title = String(rec.title ?? "").trim();
  out.title_normalized = normalizedTitle;
  out.seniority = seniority || rec.seniority || "";

  out.company = String(rec.company ?? "").trim();
  out.company_website = normalizeUrl(rec.company_website);

  out.emails = dedupe((rec.emails ?? []).map(normalizeEmail).filter(Boolean));

  const addr = { ...(rec.address ?? {}) };
  if (addr.country) addr.country = normalizeCountry(addr.country);
  out.address = addr;
  const countryHint = addr.country ?? "";

  const phones = [];
  const seen = new Set();
  for (const p of rec.phones ?? []) {
    if (!p || typeof p !== "object") continue;
    const norm = normalizePhone(p.raw, countryHint);
    const key = norm.e164 || norm.raw;
    if (key && !seen.has(key)) {
      seen.add(key);
      phones.push(norm);
    }
  }
  out.phones = phones;

  out.website = normalizeUrl(rec.website);
  out.tags = (rec.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
  return out;
}

function dedupe(items) {
  return [...new Set(items)];
}
