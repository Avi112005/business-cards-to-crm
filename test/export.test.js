import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exportCsv, exportJson, TARGETS } from "../src/export.js";
import { normalizeRecord } from "../src/normalize.js";

const RECORDS = [
  {
    id: "card-0001", source: "1.jpg", name: "Avi Singh", title: "CEO & Founder",
    company: "Acme Inc.", company_website: "", company_industry: "", company_size: "",
    emails: ["avi@acme.com"], phones: [{ raw: "+1 (415) 555-0100", e164: "+14155550100" }],
    website: "https://acme.com", address: { city: "San Francisco", region: "CA", country: "US" },
    linkedin: "https://linkedin.com/in/avisingh", twitter: "", github: "",
    met_at: "TechCrunch Disrupt 2026", notes: "Wants a demo.", tags: ["hot-lead"],
    date_collected: "2026-09-11", provenance: {},
  },
].map(normalizeRecord);

test("exportCsv writes HubSpot columns with BOM", () => {
  const dir = mkdtempSync(join(tmpdir(), "cards-crm-"));
  const out = join(dir, "contacts.csv");
  exportCsv(RECORDS, out, "hubspot");
  const text = readFileSync(out, "utf8");
  assert.ok(text.startsWith("\uFEFF"));
  assert.ok(text.includes("Email,First Name,Last Name,Job Title,Company"));
  assert.ok(text.includes("avi@acme.com,Avi,Singh"));
});

test("exportCsv respects target column maps", () => {
  for (const target of Object.keys(TARGETS)) {
    const dir = mkdtempSync(join(tmpdir(), "cards-crm-"));
    const out = join(dir, `c-${target}.csv`);
    exportCsv(RECORDS, out, target);
    const header = readFileSync(out, "utf8").split("\r\n")[0].replace(/^\uFEFF/, "");
    assert.equal(header, TARGETS[target].join(","));
  }
});

test("exportCsv rejects unknown target", () => {
  assert.throws(() => exportCsv(RECORDS, "x.csv", "nope"), /unknown target/);
});

test("exportJson writes pretty JSON array", () => {
  const dir = mkdtempSync(join(tmpdir(), "cards-crm-"));
  const out = join(dir, "contacts.json");
  exportJson(RECORDS, out);
  const parsed = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "Avi Singh");
});
