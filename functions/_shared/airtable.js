const DEFAULT_FIELD_CONFIG = {
  fields: {
    propertyName: "Property Name",
    propertyNameFallback: "Name",
    location: "Location",
    price: "Price",
    type: "Type",
    status: "Status",
    description: "Description",
    businessId: "Business ID",
    photo: "Photo",
    photoBase64: "PhotoBase64"
  },
  fieldAliases: {
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
  },
  activeStatus: "Active"
};

const FIELD_CONFIG_CACHE = new Map();
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const UPLOAD_FIELD_NAMES = ["photoFile", "photo", "file", "image", "photoFiles"];
const REQUIRED_FIELD_ROLES = [
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

export function parseFieldConfig(requestUrl) {
  const raw = requestUrl.searchParams.get("fieldConfig");
  if (!raw) {
    return {
      fields: {},
      fieldAliases: DEFAULT_FIELD_CONFIG.fieldAliases,
      activeStatus: DEFAULT_FIELD_CONFIG.activeStatus
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      fields: normalizeFieldMap(parsed.fields),
      fieldAliases: mergeFieldAliases(parsed.fieldAliases),
      activeStatus: parsed.activeStatus || DEFAULT_FIELD_CONFIG.activeStatus
    };
  } catch (error) {
    return {
      fields: {},
      fieldAliases: DEFAULT_FIELD_CONFIG.fieldAliases,
      activeStatus: DEFAULT_FIELD_CONFIG.activeStatus
    };
  }
}

export async function resolveFieldConfig(env, fieldConfig) {
  ensureAirtableEnv(env);

  const normalizedConfig = {
    fields: normalizeFieldMap(fieldConfig.fields),
    fieldAliases: mergeFieldAliases(fieldConfig.fieldAliases),
    activeStatus: fieldConfig.activeStatus || DEFAULT_FIELD_CONFIG.activeStatus
  };
  const cacheKey = [
    env.AIRTABLE_BASE_ID,
    env.AIRTABLE_TABLE_NAME,
    JSON.stringify(normalizedConfig.fields),
    JSON.stringify(normalizedConfig.fieldAliases),
    normalizedConfig.activeStatus
  ].join("::");

  if (FIELD_CONFIG_CACHE.has(cacheKey)) {
    return FIELD_CONFIG_CACHE.get(cacheKey);
  }

  const requiredMap = buildFieldMapFromAliases(normalizedConfig.fieldAliases);
  const needsDiscovery = REQUIRED_FIELD_ROLES.some((role) => !normalizedConfig.fields[role]);

  let resolvedFields = {
    ...requiredMap,
    ...normalizedConfig.fields
  };

  if (needsDiscovery) {
    const metadataFields = await fetchAirtableTableFields(env).catch(() => []);
    const discoveredFields = buildFieldMapFromMetadata(metadataFields, normalizedConfig.fieldAliases);
    resolvedFields = {
      ...requiredMap,
      ...discoveredFields,
      ...normalizedConfig.fields
    };
  }

  const resolved = {
    fields: fillMissingFieldMap(resolvedFields, normalizedConfig.fieldAliases),
    fieldAliases: normalizedConfig.fieldAliases,
    activeStatus: normalizedConfig.activeStatus
  };

  FIELD_CONFIG_CACHE.set(cacheKey, resolved);
  return resolved;
}

export function normalizePhotoUrls(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object" && typeof value.url === "string") {
    return [value.url.trim()].filter(Boolean);
  }

  return [];
}

export function buildAirtableFields(payload, fieldConfig) {
  const map = fieldConfig.fields || {};
  const photoUrls = normalizePhotoUrls(payload.photoUrls);
  const priceValue = String(payload.price || "").trim();
  const numericPrice = Number(priceValue);
  const fields = {};

  setFieldValue(fields, map.propertyName, payload.propertyName || "");
  setFieldValue(fields, map.location, payload.location || "");
  setFieldValue(fields, map.price, priceValue && Number.isFinite(numericPrice) ? numericPrice : "");
  setFieldValue(fields, map.type, payload.type || "House");
  setFieldValue(fields, map.status, payload.status || fieldConfig.activeStatus);
  setFieldValue(fields, map.description, payload.description || "");
  setFieldValue(fields, map.businessId, payload.businessId || "");
  setFieldValue(fields, map.photo, photoUrls.join("\n"));

  return fields;
}

export function sanitizeRecord(record, fieldConfig) {
  const raw = record.fields || {};

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: {
      propertyName: readFieldValue(raw, "propertyName", fieldConfig)
        || readFieldValue(raw, "propertyNameFallback", fieldConfig)
        || "",
      location: readFieldValue(raw, "location", fieldConfig) || "",
      price: readFieldValue(raw, "price", fieldConfig) || "",
      type: readFieldValue(raw, "type", fieldConfig) || "",
      status: readFieldValue(raw, "status", fieldConfig) || "",
      description: readFieldValue(raw, "description", fieldConfig) || "",
      businessId: readFieldValue(raw, "businessId", fieldConfig) || "",
      photo: readFieldValue(raw, "photo", fieldConfig) || "",
      photoBase64: readFieldValue(raw, "photoBase64", fieldConfig) || null
    }
  };
}

export async function listListings(env, fieldConfig, businessId) {
  const resolvedFieldConfig = await resolveFieldConfig(env, fieldConfig);
  const { fields, activeStatus } = resolvedFieldConfig;
  const endpoint = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`);
  let filterFormula = `{${fields.status}}='${escapeFormulaValue(activeStatus)}'`;

  if (businessId) {
    filterFormula = `AND({${fields.status}}='${escapeFormulaValue(activeStatus)}', {${fields.businessId}}='${escapeFormulaValue(businessId)}')`;
  }

  endpoint.searchParams.set("filterByFormula", filterFormula);

  const airtableResponse = await fetch(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`
    }
  });

  if (!airtableResponse.ok) {
    const errorText = await airtableResponse.text();
    throw createError("Unable to fetch Airtable records", airtableResponse.status, errorText);
  }

  const data = await airtableResponse.json();
  const records = Array.isArray(data.records) ? data.records : [];
  return records.map((record) => sanitizeRecord(record, resolvedFieldConfig));
}

export async function getListingById(env, fieldConfig, recordId) {
  const resolvedFieldConfig = await resolveFieldConfig(env, fieldConfig);
  ensureAirtableEnv(env);

  if (!recordId) {
    throw createError("Missing record id", 400);
  }

  const airtableResponse = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}/${recordId}`, {
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`
    }
  });

  if (!airtableResponse.ok) {
    const errorText = await airtableResponse.text();
    throw createError("Unable to fetch Airtable record", airtableResponse.status, errorText);
  }

  const record = await airtableResponse.json();
  return sanitizeRecord(record, resolvedFieldConfig);
}

export async function saveListing(env, fieldConfig, payload) {
  const resolvedFieldConfig = await resolveFieldConfig(env, fieldConfig);
  ensureAirtableEnv(env);

  const endpoint = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`);
  const fields = buildAirtableFields(payload, resolvedFieldConfig);
  const updateRecordId = String(payload.recordId || "").trim();

  const airtableResponse = updateRecordId
    ? await patchAirtableRecord(updateRecordId, env, fields)
    : await createAirtableRecord(endpoint, env, fields);

  const data = await airtableResponse.json().catch(() => ({}));

  if (!airtableResponse.ok) {
    throw createError(
      updateRecordId ? "Unable to update Airtable record" : "Unable to create Airtable record",
      airtableResponse.status,
      data
    );
  }

  return {
    recordId: data.id,
    record: sanitizeRecord({
      ...data,
      fields: {
        ...(data.fields || {}),
        ...(resolvedFieldConfig.fields.photo ? { [resolvedFieldConfig.fields.photo]: fields[resolvedFieldConfig.fields.photo] || "" } : {})
      }
    }, resolvedFieldConfig)
  };
}

export async function uploadImageToR2(file, env) {
  if (!env.LISTINGS_IMAGES || !env.R2_PUBLIC_URL) {
    throw createError("Missing R2 configuration", 500, "Add the LISTINGS_IMAGES bucket binding and set R2_PUBLIC_URL before uploading images.");
  }

  if (!Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME_TYPES, file.type)) {
    throw createError("Unsupported image type", 400, "Only JPEG, PNG, and WEBP images are allowed.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw createError("Image too large", 413, "Maximum image size is 5MB.");
  }

  const extension = ALLOWED_IMAGE_MIME_TYPES[file.type];
  const randomId = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  const key = `listings/${Date.now()}-${randomId}.${extension}`;
  const bytes = await file.arrayBuffer();

  await env.LISTINGS_IMAGES.put(key, bytes, {
    httpMetadata: {
      contentType: file.type
    }
  });

  const baseUrl = String(env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  if (!baseUrl) {
    throw createError("Missing R2_PUBLIC_URL", 500);
  }

  return {
    key,
    url: `${baseUrl}/${key}`
  };
}

export function getUploadFile(formData) {
  for (const fieldName of UPLOAD_FIELD_NAMES) {
    const value = formData.get(fieldName);
    if (isUploadFile(value)) {
      return value;
    }

    const values = formData.getAll(fieldName);
    const fileValue = values.find((item) => isUploadFile(item));
    if (fileValue) {
      return fileValue;
    }
  }

  return null;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function normalizeFieldMap(fieldMap) {
  if (!fieldMap || typeof fieldMap !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fieldMap)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([key, value]) => [key, value.trim()])
  );
}

function mergeFieldAliases(fieldAliases) {
  const merged = {};
  const source = {
    ...DEFAULT_FIELD_CONFIG.fieldAliases,
    ...(fieldAliases && typeof fieldAliases === "object" ? fieldAliases : {})
  };

  Object.entries(source).forEach(([role, values]) => {
    merged[role] = Array.from(new Set([
      ...(Array.isArray(values) ? values : []),
      ...(DEFAULT_FIELD_CONFIG.fieldAliases[role] || [])
    ].map((item) => String(item || "").trim()).filter(Boolean)));
  });

  return merged;
}

function buildFieldMapFromAliases(fieldAliases) {
  const map = {};
  Object.entries(DEFAULT_FIELD_CONFIG.fieldAliases).forEach(([role, defaultAliases]) => {
    const roleAliases = fieldAliases[role] || defaultAliases;
    map[role] = Array.isArray(roleAliases) && roleAliases.length ? roleAliases[0] : DEFAULT_FIELD_CONFIG.fields[role] || "";
  });
  return map;
}

function buildFieldMapFromMetadata(fields, fieldAliases) {
  const fieldNames = Array.isArray(fields)
    ? fields
        .map((field) => String(field && field.name ? field.name : "").trim())
        .filter(Boolean)
    : [];

  if (!fieldNames.length) {
    return buildFieldMapFromAliases(fieldAliases);
  }

  const normalizedLookup = new Map(fieldNames.map((name) => [normalizeFieldName(name), name]));
  const pickName = (role) => {
    const candidates = [
      ...(Array.isArray(fieldAliases[role]) ? fieldAliases[role] : []),
      ...(Array.isArray(DEFAULT_FIELD_CONFIG.fieldAliases[role]) ? DEFAULT_FIELD_CONFIG.fieldAliases[role] : [])
    ];

    for (const candidate of candidates) {
      const match = normalizedLookup.get(normalizeFieldName(candidate));
      if (match) {
        return match;
      }
    }

    return normalizedLookup.get(normalizeFieldName(DEFAULT_FIELD_CONFIG.fields[role])) || DEFAULT_FIELD_CONFIG.fields[role] || "";
  };

  return {
    propertyName: pickName("propertyName"),
    propertyNameFallback: pickName("propertyNameFallback"),
    location: pickName("location"),
    price: pickName("price"),
    type: pickName("type"),
    status: pickName("status"),
    description: pickName("description"),
    businessId: pickName("businessId"),
    photo: pickName("photo"),
    photoBase64: pickName("photoBase64")
  };
}

function fillMissingFieldMap(fieldMap, fieldAliases) {
  const fallbackMap = buildFieldMapFromAliases(fieldAliases);
  return REQUIRED_FIELD_ROLES.reduce((accumulator, role) => {
    accumulator[role] = fieldMap[role] || fallbackMap[role] || DEFAULT_FIELD_CONFIG.fields[role] || "";
    return accumulator;
  }, {});
}

async function fetchAirtableTableFields(env) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`, {
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`
    }
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json().catch(() => ({}));
  const tables = Array.isArray(data.tables) ? data.tables : [];
  const normalizedTarget = normalizeFieldName(env.AIRTABLE_TABLE_NAME);
  const table = tables.find((item) => {
    const tableName = String(item && item.name ? item.name : "").trim();
    const tableId = String(item && item.id ? item.id : "").trim();
    return normalizeFieldName(tableName) === normalizedTarget || normalizeFieldName(tableId) === normalizedTarget;
  }) || tables[0] || null;

  return Array.isArray(table && table.fields) ? table.fields : [];
}

function readFieldValue(raw, role, fieldConfig) {
  const candidates = getFieldCandidates(role, fieldConfig);

  for (const candidate of candidates) {
    const value = findRawFieldValue(raw, candidate);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function getFieldCandidates(role, fieldConfig) {
  const configured = fieldConfig.fields || {};
  const aliases = fieldConfig.fieldAliases || DEFAULT_FIELD_CONFIG.fieldAliases;
  const candidates = [];

  if (configured[role]) {
    candidates.push(configured[role]);
  }

  if (role === "propertyName" && configured.propertyNameFallback) {
    candidates.push(configured.propertyNameFallback);
  }

  if (Array.isArray(aliases[role])) {
    candidates.push(...aliases[role]);
  }

  if (role === "propertyName" && Array.isArray(aliases.propertyNameFallback)) {
    candidates.push(...aliases.propertyNameFallback);
  }

  if (Array.isArray(DEFAULT_FIELD_CONFIG.fieldAliases[role])) {
    candidates.push(...DEFAULT_FIELD_CONFIG.fieldAliases[role]);
  }

  return [...new Set(candidates.filter(Boolean))];
}

function findRawFieldValue(raw, candidate) {
  const normalizedCandidate = normalizeFieldName(candidate);
  for (const [key, value] of Object.entries(raw || {})) {
    if (normalizeFieldName(key) === normalizedCandidate) {
      return value;
    }
  }

  return undefined;
}

function setFieldValue(target, fieldName, value) {
  if (!fieldName) {
    return;
  }

  target[fieldName] = value;
}

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function ensureAirtableEnv(env) {
  if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_TABLE_NAME) {
    throw createError("Missing Airtable configuration", 500, {
      hasApiKey: Boolean(env.AIRTABLE_API_KEY),
      hasBaseId: Boolean(env.AIRTABLE_BASE_ID),
      hasTableName: Boolean(env.AIRTABLE_TABLE_NAME)
    });
  }
}

function isUploadFile(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.arrayBuffer === "function"
    && typeof value.name === "string"
    && typeof value.type === "string"
    && typeof value.size === "number";
}

function escapeFormulaValue(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function createError(message, status = 500, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function createAirtableRecord(endpoint, env, fields) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
}

function patchAirtableRecord(recordId, env, fields) {
  return fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
}
