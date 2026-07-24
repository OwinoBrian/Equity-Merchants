#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_ALIASES = {
  propertyName: ["Property Name", "Name", "Title", "Listing Name"],
  propertyNameFallback: ["Name", "Title"],
  location: ["Location", "Area", "Town", "City", "Address"],
  price: ["Price", "Amount", "Cost", "Rate"],
  type: ["Type", "Category", "Listing Type"],
  status: ["Status", "State", "Availability"],
  description: ["Description", "Details", "Summary"],
  businessId: ["Business ID", "Tenant ID", "Client ID"],
  photo: ["Photo", "Photos", "Image", "Images", "Gallery", "Media"],
  photoBase64: ["PhotoBase64", "Photo Base64", "Image Data"]
};

const ROLE_ORDER = [
  "propertyName",
  "propertyNameFallback",
  "location",
  "price",
  "type",
  "status",
  "description",
  "businessId",
  "photo",
  "photoBase64"
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = SCRIPT_DIR;
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "client-config.generated.js");
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, "client-config.js");

const flags = parseFlags(process.argv.slice(2));
const rl = createInterface({ input, output });

try {
  const apiKey = await ask(rl, "Airtable API key", "");
  const baseId = await ask(rl, "Airtable base ID", "");
  const tableName = await ask(rl, "Airtable table name", "Listings");
  const businessId = await ask(rl, "Business ID", "");
  const activeListingStatus = await ask(rl, "Active listing status", "Active");
  const airtableBaseUrl = await ask(rl, "Airtable base URL", baseId ? `https://airtable.com/${baseId}` : "");
  const airtableEditorUrl = await ask(rl, "Airtable editor URL", airtableBaseUrl);
  const airtableAddFormUrl = await ask(rl, "Airtable add form URL", "");

  const siteName = await ask(rl, "Site name", "");
  const shortName = await ask(rl, "Short name", siteName);
  const brandNameShort = await ask(rl, "Brand name short", shortName);
  const adminAppName = await ask(rl, "Admin app name", `${siteName || shortName || "Listings"} Admin`);
  const adminAppShortName = await ask(rl, "Admin app short name", "Admin");
  const tagline = await ask(rl, "Tagline", "");
  const heroTitle = await ask(rl, "Hero title", "");
  const description = await ask(rl, "Description", "");
  const listingsDescription = await ask(rl, "Listings description", "");
  const keywords = await ask(rl, "Keywords", "");
  const whatsappNumber = await ask(rl, "WhatsApp number", "");
  const contactEmail = await ask(rl, "Contact email", "");
  const address = await ask(rl, "Address", "");
  const mapText = await ask(rl, "Map helper text", "Map loading - contact us for directions");
  const logoSrc = await ask(rl, "Logo path", "");
  const logoAlt = await ask(rl, "Logo alt text", siteName ? `${siteName} logo` : "");
  const faviconSrc = await ask(rl, "Favicon path", logoSrc);
  const themeColor = await ask(rl, "Theme color", "#003049");
  const footerCredit = await ask(rl, "Footer credit", "");
  const footerCreditUrl = await ask(rl, "Footer credit URL", "");
  const theme = await ask(rl, "Theme preset (optional)", "");

  const includeThemeOverrides = await ask(rl, "Add theme override color? (y/N)", "n");
  const themeOverrides = includeThemeOverrides.toLowerCase().startsWith("y")
    ? {
        primary: await ask(rl, "Theme primary color", "#c1121f"),
        cssVars: {}
      }
    : undefined;

  const contacts = await collectContacts(rl);

  const rawFieldAliases = DEFAULT_ALIASES;

  process.stdout.write("\nDiscovering Airtable fields...\n");
  const discovery = await discoverAirtableFields({ apiKey, baseId, tableName, aliases: rawFieldAliases });

  const config = {
    siteName,
    shortName,
    brandNameShort,
    adminAppName,
    adminAppShortName,
    tagline,
    heroTitle,
    description,
    listingsDescription,
    keywords,
    businessId,
    whatsappNumber,
    contactEmail,
    address,
    mapText,
    logoSrc,
    logoAlt,
    faviconSrc,
    themeColor,
    ...(theme ? { theme } : {}),
    ...(themeOverrides ? { themeOverrides } : {}),
    apiBaseUrl: "/api",
    footerCredit,
    footerCreditUrl,
    contacts,
    airtableBaseId: baseId,
    airtableTableName: tableName,
    airtableEditorUrl,
    airtableAddFormUrl,
    airtableBaseUrl,
    activeListingStatus,
    airtableFields: discovery.fields,
    airtableFieldAliases: rawFieldAliases
  };

  const outputPath = path.resolve(PROJECT_ROOT, flags.output || DEFAULT_OUTPUT);
  const content = `const APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
  await writeFile(outputPath, content, "utf8");

  process.stdout.write(`Wrote ${path.relative(PROJECT_ROOT, outputPath) || path.basename(outputPath)}\n`);
  process.stdout.write("Airtable field mapping:\n");
  process.stdout.write(`${JSON.stringify(discovery.fields, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}

async function ask(rlInstance, prompt, defaultValue = "") {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rlInstance.question(`${prompt}${suffix}: `)).trim();
  return answer || defaultValue;
}

async function collectContacts(rlInstance) {
  const contacts = [];
  let index = 1;

  while (true) {
    const label = (await ask(rlInstance, `Contact ${index} label (leave blank to finish)`, "")).trim();
    if (!label) {
      break;
    }

    const type = (await ask(rlInstance, `Contact ${index} type`, "text")).trim().toLowerCase();
    const value = (await ask(rlInstance, `Contact ${index} value`, "")).trim();
    const display = (await ask(rlInstance, `Contact ${index} display (optional)`, "")).trim();
    const href = (await ask(rlInstance, `Contact ${index} custom link (optional)`, "")).trim();

    if (value) {
      const contact = { label, type, value };
      if (display) {
        contact.display = display;
      }
      if (href) {
        contact.href = href;
      }
      contacts.push(contact);
    }

    index += 1;
  }

  return contacts;
}

async function discoverAirtableFields({ apiKey, baseId, tableName, aliases }) {
  if (!apiKey || !baseId || !tableName) {
    return {
      fields: buildFallbackFieldMap(aliases)
    };
  }

  const [metadata, records] = await Promise.all([
    fetchJson(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, apiKey),
    fetchJson(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=10&maxRecords=10`, apiKey)
  ]);

  const table = pickTable(metadata.tables || [], tableName);
  const fieldNames = Array.isArray(table?.fields) ? table.fields.map((field) => String(field?.name || "").trim()).filter(Boolean) : [];
  const sampleRecords = Array.isArray(records.records) ? records.records : [];
  const valueCounts = buildValueCounts(sampleRecords);

  return {
    fields: resolveFieldMap(fieldNames, valueCounts, aliases)
  };
}

async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    return {};
  }

  return response.json().catch(() => ({}));
}

function pickTable(tables, tableName) {
  const normalizedTarget = normalize(tableName);
  return tables.find((table) => normalize(table?.name) === normalizedTarget || normalize(table?.id) === normalizedTarget) || tables[0] || null;
}

function buildValueCounts(records) {
  const counts = new Map();

  for (const record of records) {
    const fields = record?.fields || {};
    Object.entries(fields).forEach(([name, value]) => {
      if (isMeaningfulValue(value)) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });
  }

  return counts;
}

function resolveFieldMap(fieldNames, valueCounts, aliases) {
  const map = {};
  ROLE_ORDER.forEach((role) => {
    map[role] = pickFieldForRole(role, fieldNames, valueCounts, aliases, map);
  });
  return map;
}

function pickFieldForRole(role, fieldNames, valueCounts, aliases, resolvedMap) {
  const candidates = [
    ...(Array.isArray(aliases[role]) ? aliases[role] : []),
    ...(DEFAULT_ALIASES[role] || [])
  ].filter(Boolean);

  if (!candidates.length) {
    return "";
  }

  const byName = new Map(fieldNames.map((name) => [normalize(name), name]));
  const currentPropertyName = resolvedMap.propertyName;

  const matchWithValues = candidates.find((candidate) => {
    const name = byName.get(normalize(candidate));
    return name && hasSampleValues(name, valueCounts);
  });

  if (matchWithValues) {
    if (role === "propertyNameFallback" && normalize(matchWithValues) === normalize(currentPropertyName)) {
      const alternate = candidates.find((candidate) => {
        const name = byName.get(normalize(candidate));
        return name && normalize(name) !== normalize(currentPropertyName);
      });
      if (alternate) {
        return byName.get(normalize(alternate)) || alternate;
      }
    }
    return byName.get(normalize(matchWithValues)) || matchWithValues;
  }

  const metadataMatch = candidates.find((candidate) => byName.has(normalize(candidate)));
  if (metadataMatch) {
    const name = byName.get(normalize(metadataMatch)) || metadataMatch;
    if (role === "propertyNameFallback" && normalize(name) === normalize(currentPropertyName)) {
      const alternate = fieldNames.find((field) => normalize(field) !== normalize(currentPropertyName) && /name|title/i.test(field));
      if (alternate) {
        return alternate;
      }
    }
    return name;
  }

  const sampleFallback = fieldNames.find((field) => hasSampleValues(field, valueCounts));
  if (sampleFallback) {
    return sampleFallback;
  }

  return candidates[0];
}

function hasSampleValues(fieldName, valueCounts) {
  return (valueCounts.get(fieldName) || 0) > 0;
}

function buildFallbackFieldMap(aliases) {
  return ROLE_ORDER.reduce((accumulator, role) => {
    accumulator[role] = (Array.isArray(aliases[role]) && aliases[role][0]) || DEFAULT_ALIASES[role]?.[0] || "";
    return accumulator;
  }, {});
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isMeaningfulValue(value) {
  if (value == null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.values(value).some((item) => isMeaningfulValue(item));
  }

  return String(value).trim() !== "";
}

function parseFlags(argv) {
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--output") {
      flags.output = argv[index + 1];
      index += 1;
    } else if (current === "--in-place") {
      flags.output = DEFAULT_CONFIG_PATH;
    }
  }

  return flags;
}
