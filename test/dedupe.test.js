import { test } from "node:test";
import assert from "node:assert/strict";

import { similarity, dedupe, mergeRecords } from "../src/dedupe.js";

test("similarity is 100 for identical strings", () => {
  assert.equal(similarity("Avi Singh", "avi singh"), 100);
});

test("similarity is 0 for fully different strings", () => {
  assert.equal(similarity("Avi Singh", ""), 0);
});

test("dedupe merges on identical email (hard)", () => {
  const records = [
    { id: "a", source: "1.jpg", name: "Avi Singh", emails: ["avi@acme.com"], phones: [], provenance: {} },
    { id: "b", source: "2.jpg", name: "AVI SINGH", emails: ["AVI@ACME.COM"], phones: [], provenance: {} },
  ];
  const [out, report] = dedupe(records);
  assert.equal(out.length, 1);
  assert.equal(report.length, 1);
  assert.equal(report[0].reason, "hard");
  assert.equal(out[0].id, "a");
});

test("dedupe merges on identical E.164 phone (hard)", () => {
  const records = [
    { id: "a", source: "1.jpg", name: "Avi Singh", emails: [], phones: [{ raw: "x", e164: "+14155550100" }], provenance: {} },
    { id: "b", source: "2.jpg", name: "Avi", emails: [], phones: [{ raw: "y", e164: "+14155550100" }], provenance: {} },
  ];
  const [out, report] = dedupe(records);
  assert.equal(out.length, 1);
  assert.equal(report[0].reason, "hard");
});

test("dedupe merges on fuzzy name+company (soft)", () => {
  const records = [
    { id: "a", source: "1.jpg", name: "Avi Singh", company: "Acme Inc", emails: [], phones: [], provenance: {} },
    { id: "b", source: "2.jpg", name: "Avi Singh", company: "Acme Inc.", emails: [], phones: [], provenance: {} },
  ];
  const [out, report] = dedupe(records);
  assert.equal(out.length, 1);
  assert.equal(report[0].reason, "fuzzy");
});

test("dedupe keeps distinct people separate", () => {
  const records = [
    { id: "a", source: "1.jpg", name: "Avi Singh", company: "Acme Inc", emails: ["avi@acme.com"], phones: [], provenance: {} },
    { id: "b", source: "2.jpg", name: "Jordan Lee", company: "Beta Corp", emails: ["jordan@beta.io"], phones: [], provenance: {} },
  ];
  const [out, report] = dedupe(records);
  assert.equal(out.length, 2);
  assert.equal(report.length, 0);
});

test("mergeRecords unions fields and records provenance", () => {
  const a = {
    id: "a", source: "1.jpg", name: "Avi Singh", emails: ["avi@acme.com"],
    phones: [{ raw: "x", e164: "+14155550100" }], tags: ["hot"],
    provenance: { enriched: ["linkedin"], confidence: 0.8 },
  };
  const b = {
    id: "b", source: "2.jpg", name: "", company: "Acme Inc",
    emails: ["avi2@acme.com"], phones: [{ raw: "y", e164: "+14155550100" }],
    linkedin: "https://linkedin.com/in/avi", provenance: { confidence: 0.9 },
  };
  const merged = mergeRecords(a, b);
  assert.deepEqual(merged.emails, ["avi@acme.com", "avi2@acme.com"]);
  assert.equal(merged.phones.length, 1);
  assert.equal(merged.company, "Acme Inc");
  assert.equal(merged.linkedin, "https://linkedin.com/in/avi");
  assert.deepEqual(merged.provenance.merged_from, ["b"]);
  assert.equal(merged.provenance.confidence, 0.9);
});
