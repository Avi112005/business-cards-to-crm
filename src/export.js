/**
 * Export contact records to CRM-ready formats.
 *
 * Supported targets (CSV column maps), plus raw JSON. Each target flattens a
 * contact record into stable columns so the file drops straight into an
 * importer. CSV is written with a UTF-8 BOM for Excel compatibility.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const GENERIC_COLUMNS = [
  "id", "first_name", "last_name", "full_name", "job_title", "seniority",
  "company", "company_website", "company_industry", "company_size",
  "email", "phone", "website", "address_street", "address_city",
  "address_region", "address_country", "address_postal", "linkedin",
  "twitter", "github", "met_at", "notes", "tags", "date_collected",
];

export const TARGETS = {
  generic: GENERIC_COLUMNS,
  hubspot: [
    "Email", "First Name", "Last Name", "Job Title", "Company",
    "Phone Number", "Website URL", "LinkedIn URL", "Street Address",
    "City", "State/Region", "Zip/Postal Code", "Country/Region",
    "Industry", "Notes",
  ],
  salesforce: [
    "Email", "FirstName", "LastName", "Title", "Company",
    "Phone", "Website", "LinkedIn_URL__c", "Street", "City",
    "State", "PostalCode", "Country", "Industry", "Description",
  ],
  notion: [
    "Name", "Title", "Company", "Email", "Phone", "LinkedIn",
    "Website", "Location", "Tags", "Notes", "Source",
  ],
};

function splitName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

function flat(rec) {
  const addr = rec.address ?? {};
  const emails = rec.emails ?? [];
  const phones = (rec.phones ?? [])
    .filter((p) => p && typeof p === "object")
    .map((p) => p.e164 || p.raw || "")
    .filter(Boolean);
  const [first, last] = splitName(rec.name);
  return {
    id: rec.id ?? "",
    first_name: first,
    last_name: last,
    full_name: rec.name ?? "",
    job_title: rec.title ?? "",
    seniority: rec.seniority ?? "",
    company: rec.company ?? "",
    company_website: rec.company_website ?? "",
    company_industry: rec.company_industry ?? "",
    company_size: rec.company_size ?? "",
    email: emails.join("; "),
    phone: phones.join("; "),
    website: rec.website ?? "",
    address_street: addr.street ?? "",
    address_city: addr.city ?? "",
    address_region: addr.region ?? "",
    address_country: addr.country ?? "",
    address_postal: addr.postal ?? "",
    linkedin: rec.linkedin ?? "",
    twitter: rec.twitter ?? "",
    github: rec.github ?? "",
    met_at: rec.met_at ?? "",
    notes: rec.notes ?? "",
    tags: (rec.tags ?? []).join("; "),
    date_collected: rec.date_collected ?? "",
  };
}

function targetRows(records, target) {
  return records.map((rec) => {
    const f = flat(rec);
    switch (target) {
      case "generic":
        return Object.fromEntries(GENERIC_COLUMNS.map((c) => [c, f[c]]));
      case "hubspot":
        return {
          Email: f.email,
          "First Name": f.first_name,
          "Last Name": f.last_name,
          "Job Title": f.job_title,
          Company: f.company,
          "Phone Number": f.phone,
          "Website URL": f.website || f.company_website,
          "LinkedIn URL": f.linkedin,
          "Street Address": f.address_street,
          City: f.address_city,
          "State/Region": f.address_region,
          "Zip/Postal Code": f.address_postal,
          "Country/Region": f.address_country,
          Industry: f.company_industry,
          Notes: f.notes,
        };
      case "salesforce":
        return {
          Email: f.email,
          FirstName: f.first_name,
          LastName: f.last_name,
          Title: f.job_title,
          Company: f.company,
          Phone: f.phone,
          Website: f.website || f.company_website,
          LinkedIn_URL__c: f.linkedin,
          Street: f.address_street,
          City: f.address_city,
          State: f.address_region,
          PostalCode: f.address_postal,
          Country: f.address_country,
          Industry: f.company_industry,
          Description: f.notes,
        };
      case "notion": {
        const location = [f.address_city, f.address_region, f.address_country]
          .filter(Boolean).join(", ");
        return {
          Name: f.full_name,
          Title: f.job_title,
          Company: f.company,
          Email: f.email,
          Phone: f.phone,
          LinkedIn: f.linkedin,
          Website: f.website || f.company_website,
          Location: location,
          Tags: f.tags,
          Notes: f.notes,
          Source: f.met_at || f.id,
        };
      }
      default:
        throw new Error(`unknown target: ${target}`);
    }
  });
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => csvEscape(row[c])).join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

/** Write a CSV file (UTF-8 with BOM) and return the path. */
export function exportCsv(records, out, target = "generic") {
  if (!TARGETS[target]) throw new Error(`unknown target: ${target}`);
  mkdirSync(dirname(out), { recursive: true });
  const columns = TARGETS[target];
  const rows = targetRows(records, target);
  const csv = toCsv(rows, columns);
  writeFileSync(out, "\uFEFF" + csv, "utf8");
  return out;
}

/** Write a pretty JSON file and return the path. */
export function exportJson(records, out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(records, null, 2) + "\n", "utf8");
  return out;
}
