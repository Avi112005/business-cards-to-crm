/**
 * cards-crm CLI.
 *
 * Subcommands compose the deterministic pipeline around a JSONL of contact
 * records. See README.md for the full flow.
 */

import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  newRecord, scanImages, loadJsonl, saveJsonl, validate,
} from "./extract.js";
import { normalizeRecord } from "./normalize.js";
import { buildLookupQueries, gapReport } from "./enrich.js";
import { dedupe } from "./dedupe.js";
import { TARGETS, exportCsv, exportJson } from "./export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const USAGE = `cards-crm — business cards to CRM pipeline

Usage:
  cards-crm new <cards-dir>           scaffold records.jsonl from card images
  cards-crm check <records>           validate records, print issues
  cards-crm normalize <records>       normalize fields -> records.normalized.jsonl
  cards-crm enrich <records>          gap report + lookup queries
  cards-crm dedupe <records>          merge duplicates -> records.deduped.jsonl
  cards-crm export <records> -o FILE  flatten to CSV/JSON for a CRM target
  cards-crm report <records>          human summary of the batch

Options:
  -o, --out FILE       output file
      --target TARGET  generic | hubspot | salesforce | notion
      --format FORMAT  csv | json (export only)
  -h, --help           show this help
`;

function outPath(inPath, suffix) {
  const i = inPath.lastIndexOf(".");
  const base = i === -1 ? inPath : inPath.slice(0, i);
  const extn = i === -1 ? "" : inPath.slice(i);
  return `${base}${suffix}${extn}`;
}

function parse() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      target: { type: "string" },
      format: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  return { command: positionals[0], arg: positionals[1], values };
}

function cmdNew(arg, values) {
  if (!arg) return fail("missing <cards-dir>");
  let images;
  try {
    images = scanImages(arg);
  } catch (err) {
    return fail(err.message);
  }
  if (images.length === 0) return fail(`no card images found under ${arg}`);
  const records = images.map((p, i) => newRecord(p, i + 1));
  const out = saveJsonl(records, values.out ?? "records.jsonl");
  log(`scaffolded ${records.length} empty records -> ${out}`);
  log("next: Read each image and fill the records, then run `check`.");
  return 0;
}

function cmdCheck(arg) {
  const records = loadRecords(arg);
  let total = 0;
  for (const rec of records) {
    const issues = validate(rec);
    if (issues.length) {
      total += issues.length;
      process.stderr.write(`${rec.id}: ${issues.join(", ")}\n`);
    }
  }
  if (total === 0) {
    log(`${records.length} records: all valid.`);
    return 0;
  }
  return fail(`${total} issue(s) across ${records.length} records.`);
}

function cmdNormalize(arg, values) {
  const records = loadRecords(arg);
  const out = saveJsonl(
    records.map(normalizeRecord),
    values.out ?? outPath(arg, ".normalized"),
  );
  log(`normalized ${records.length} records -> ${out}`);
  return 0;
}

function cmdEnrich(arg) {
  const records = loadRecords(arg);
  const gaps = gapReport(records);
  const total = records.length;

  const lines = [];
  lines.push("# enrichment gap report", "");
  for (const [field, missing] of Object.entries(gaps)) {
    if (missing) lines.push(`- ${field}: ${missing}/${total} missing`);
  }
  lines.push("", "## lookup queries", "");
  for (const rec of records) {
    const qs = buildLookupQueries(rec);
    if (qs.length) {
      lines.push(`### ${rec.name || rec.id} (${rec.company || "no company"})`);
      for (const q of qs) lines.push(`  - ${q}`);
    }
  }
  lines.push("", "_Run these searches, then merge findings back into the records and re-run `export`._");
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

function cmdDedupe(arg, values) {
  const records = loadRecords(arg);
  const [deduped, report] = dedupe(records);
  const out = saveJsonl(deduped, values.out ?? outPath(arg, ".deduped"));
  const removed = records.length - deduped.length;
  log(`${records.length} records -> ${deduped.length} unique (merged ${removed}) -> ${out}`);
  for (const entry of report) {
    log(`  merged ${entry.merged} -> ${entry.kept} (${entry.reason})`);
  }
  return 0;
}

function cmdExport(arg, values) {
  if (!values.out) return fail("export requires -o/--out FILE");
  const target = values.target ?? "generic";
  const format = values.format ?? "csv";
  if (!TARGETS[target]) {
    return fail(`unknown target '${target}'. choices: ${Object.keys(TARGETS).join(", ")}`);
  }
  const records = loadRecords(arg);
  const out = format === "json"
    ? exportJson(records, values.out)
    : exportCsv(records, values.out, target);
  log(`exported ${records.length} records (${format}/${target}) -> ${out}`);
  return 0;
}

function cmdReport(arg) {
  const records = loadRecords(arg);
  const lines = [`# batch report: ${records.length} record(s)`, ""];
  for (const rec of records) {
    const name = rec.name || "(unnamed)";
    const company = rec.company || "—";
    const title = rec.title || "—";
    const emails = (rec.emails ?? []).length;
    const phones = (rec.phones ?? []).length;
    const missing = Object.entries(gapReport([rec]))
      .filter(([, n]) => n > 0)
      .map(([f]) => f);
    let line = `- ${name} | ${title} @ ${company} | ${emails} email(s), ${phones} phone(s)`;
    if (missing.length) line += ` | missing: ${missing.join(", ")}`;
    lines.push(line);
  }
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

function loadRecords(path) {
  if (!path) throw new Error("missing <records> file");
  try {
    return loadJsonl(path);
  } catch (err) {
    throw new Error(err.message);
  }
}

function log(msg) {
  process.stdout.write(`[cards-crm] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[cards-crm] error: ${msg}\n`);
  return 1;
}

const COMMANDS = {
  new: cmdNew,
  check: cmdCheck,
  normalize: cmdNormalize,
  enrich: cmdEnrich,
  dedupe: cmdDedupe,
  export: cmdExport,
  report: cmdReport,
};

export function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(USAGE);
    return argv.includes("-h") || argv.includes("--help") ? 0 : 1;
  }

  const { command, arg, values } = parse();
  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`[cards-crm] error: unknown command '${command}'\n\n${USAGE}`);
    return 1;
  }
  try {
    return handler(arg, values);
  } catch (err) {
    return fail(err.message);
  }
}
