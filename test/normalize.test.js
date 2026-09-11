import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeName,
  normalizeTitle,
  normalizePhone,
  normalizeEmail,
  normalizeUrl,
  normalizeCountry,
  normalizeRecord,
} from "../src/normalize.js";

test("normalizeName title-cases and preserves Mc/Mac/hyphens", () => {
  assert.equal(normalizeName("AVI SINGH"), "Avi Singh");
  assert.equal(normalizeName("robert mcdonald"), "Robert McDonald");
  assert.equal(normalizeName("anne-marie dupont"), "Anne-Marie Dupont");
  assert.equal(normalizeName("james smith jr"), "James Smith JR");
  assert.equal(normalizeName(""), "");
});

test("normalizeTitle expands abbreviations and infers seniority", () => {
  assert.deepEqual(normalizeTitle("CEO & Founder"), [
    "Chief Executive Officer & Founder", "C-level",
  ]);
  assert.deepEqual(normalizeTitle("CTO"), ["Chief Technology Officer", "C-level"]);
  assert.deepEqual(normalizeTitle("VP Engineering"), ["Vice President Engineering", "VP"]);
  assert.deepEqual(normalizeTitle(""), ["", ""]);
});

test("normalizePhone infers country codes", () => {
  // Leading + is kept as-is.
  assert.equal(normalizePhone("+1 (415) 555-0100").e164, "+14155550100");
  // US 10-digit with country hint.
  assert.equal(normalizePhone("415-555-0100", "US").e164, "+14155550100");
  // UK trunk '0' stripped, +44 applied.
  assert.equal(normalizePhone("020 7946 0958", "GB").e164, "+442079460958");
  // India without trunk.
  assert.equal(normalizePhone("9876543210", "IN").e164, "+919876543210");
  // 10 digits, no hint -> North America.
  assert.equal(normalizePhone("4155550100").e164, "+14155550100");
  // Leading '00' -> '+'.
  assert.equal(normalizePhone("00442079460958").e164, "+442079460958");
  // Too short, no hint -> empty e164.
  assert.equal(normalizePhone("55501").e164, "");
});

test("normalizePhone detects type", () => {
  assert.equal(normalizePhone("415-555-0100 (mobile)", "US").type, "mobile");
  assert.equal(normalizePhone("415-555-0100 fax").type, "fax");
  assert.equal(normalizePhone("Office: 415-555-0100").type, "landline");
});

test("normalizeEmail lowercases and validates", () => {
  assert.equal(normalizeEmail("  AVI@ACME.COM "), "avi@acme.com");
  assert.equal(normalizeEmail("not-an-email"), "");
});

test("normalizeUrl adds scheme and validates", () => {
  assert.equal(normalizeUrl("acme.com"), "https://acme.com");
  assert.equal(normalizeUrl("https://acme.com"), "https://acme.com");
  assert.equal(normalizeUrl(""), "");
});

test("normalizeCountry maps names and passes through codes", () => {
  assert.equal(normalizeCountry("united states"), "US");
  assert.equal(normalizeCountry("UK"), "GB");
  assert.equal(normalizeCountry("india"), "IN");
  assert.equal(normalizeCountry("DE"), "DE");
});

test("normalizeRecord dedupes emails/phones and fills normalized fields", () => {
  const rec = {
    id: "card-0001",
    source: "cards/a.jpg",
    name: "AVI SINGH",
    title: "CEO",
    company: "Acme Inc.",
    emails: ["AVI@ACME.COM", "avi@acme.com"],
    phones: [{ raw: "+1 (415) 555-0100" }, { raw: "415-555-0100" }],
    address: { country: "usa" },
  };
  const out = normalizeRecord(rec);
  assert.equal(out.name, "Avi Singh");
  assert.equal(out.title_normalized, "Chief Executive Officer");
  assert.equal(out.seniority, "C-level");
  assert.deepEqual(out.emails, ["avi@acme.com"]);
  assert.equal(out.phones.length, 1);
  assert.equal(out.phones[0].e164, "+14155550100");
  assert.equal(out.address.country, "US");
});
