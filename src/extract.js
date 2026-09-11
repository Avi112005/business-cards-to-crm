/**
 * Record factory, validation, and JSONL I/O.
 *
 * The pipeline's source of truth is a JSONL file of "contact records"
 * (see schemas/contact.schema.json). `newRecord` scaffolds an empty record
 * for one card image; the agent fills it in (via vision or OCR); the
 * deterministic commands then normalize, enrich, dedupe, and export it.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff", ".bmp",
]);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** ISO date string for today (local time). */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Return an empty record scaffold for one card image. */
export function newRecord(source, index) {
  return {
    id: `card-${String(index).padStart(4, "0")}`,
    source,
    name: "",
    name_original: "",
    title: "",
    title_normalized: "",
    seniority: "",
    company: "",
    company_website: "",
    company_industry: "",
    company_size: "",
    emails: [],
    phones: [],
    website: "",
    address: {},
    linkedin: "",
    twitter: "",
    github: "",
    met_at: "",
    notes: "",
    tags: [],
    date_collected: todayIso(),
    provenance: { extracted_by: "agent-vision", enriched: [], merged_from: [], confidence: 0 },
  };
}

/** Return sorted card image paths under `directory`. */
export function scanImages(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(ext(e.name).toLowerCase()))
    .map((e) => join(directory, e.name))
    .sort();
}

/** Lowercased extension with dot, e.g. ".jpg". */
export function ext(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i);
}

/** Return a list of human-readable issues; empty array means clean. */
export function validate(record) {
  const issues = [];
  if (!record?.id) issues.push("missing id");
  if (!record?.source) issues.push("missing source");
  if (!String(record?.name ?? "").trim()) issues.push("name is empty");
  for (const email of record?.emails ?? []) {
    if (!EMAIL_RE.test(email ?? "")) issues.push(`invalid email: ${JSON.stringify(email)}`);
  }
  for (const phone of record?.phones ?? []) {
    if (!phone || typeof phone !== "object" || !phone.raw) {
      issues.push(`invalid phone entry: ${JSON.stringify(phone)}`);
    }
  }
  return issues;
}

/** Load a JSONL file (one JSON object per line), tolerating blank lines. */
export function loadJsonl(path) {
  const text = readFileSync(path, "utf8");
  const records = [];
  let lineno = 0;
  for (const line of text.split(/\r?\n/)) {
    lineno += 1;
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (err) {
      throw new Error(`${path}:${lineno}: invalid JSON: ${err.message}`);
    }
  }
  return records;
}

/** Write records as JSONL (LF newlines), creating parent dirs as needed. */
export function saveJsonl(records, path) {
  mkdirSync(dirname(path), { recursive: true });
  const text = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(path, text, "utf8");
  return path;
}
