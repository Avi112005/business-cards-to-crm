import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { newRecord, scanImages, validate, saveJsonl, loadJsonl, ext } from "../src/extract.js";

test("newRecord scaffolds empty record with stable id", () => {
  const rec = newRecord("cards/a.jpg", 7);
  assert.equal(rec.id, "card-0007");
  assert.equal(rec.source, "cards/a.jpg");
  assert.equal(rec.name, "");
  assert.deepEqual(rec.emails, []);
  assert.equal(rec.provenance.extracted_by, "agent-vision");
  assert.match(rec.date_collected, /^\d{4}-\d{2}-\d{2}$/);
});

test("scanImages finds only image files (case-insensitive)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "a.jpg"), "");
  writeFileSync(join(dir, "b.PNG"), "");
  writeFileSync(join(dir, "notes.txt"), "");
  const found = scanImages(dir);
  assert.deepEqual(found.map((p) => ext(p).toLowerCase()).sort(), [".jpg", ".png"]);
});

test("validate flags issues", () => {
  const bad = { id: "x", source: "s.jpg", name: "", emails: ["nope"], phones: [{ raw: "" }, "garbage"] };
  const issues = validate(bad);
  assert.ok(issues.some((i) => i.includes("name is empty")));
  assert.ok(issues.some((i) => i.includes("invalid email")));
  assert.ok(issues.some((i) => i.includes("invalid phone entry")));
});

test("validate flags a fresh empty record for missing name", () => {
  const issues = validate(newRecord("a.jpg", 1));
  assert.ok(issues.includes("name is empty"));
});

test("saveJsonl/loadJsonl round-trip", () => {
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  const out = join(dir, "sub", "records.jsonl");
  const recs = [newRecord("a.jpg", 1), newRecord("b.jpg", 2)];
  saveJsonl(recs, out);
  const loaded = loadJsonl(out);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[1].id, "card-0002");
});
