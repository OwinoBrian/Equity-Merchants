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
  activeStatus: "Active"
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const UPLOAD_FIELD_NAMES = ["photoFile", "photo", "file", "image", "photoFiles"];

export function parseFieldConfig(requestUrl) {
  const raw = requestUrl.searchParams.get("fieldConfig");
  if (!raw) {
    return DEFAULT_FIELD_CONFIG;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      fields: { ...DEFAULT_FIELD_CONFIG.fields, ...(parsed.fields || {}) },
      activeStatus: parsed.activeStatus || DEFAULT_FIELD_CONFIG.activeStatus
    };
  } catch (error) {
    return DEFAULT_FIELD_CONFIG;
  }
}

export function normalizePhotoUrls(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object" && typeof value.url === "string") {
    return [value.url.trim()].filter(Boolean);
  }

  return [];
}

export function buildAirtableFields(payload, fieldConfig) {
  const map = fieldConfig.fields;
  const photoUrls = normalizePhotoUrls(payload.photoUrls);
  const priceValue = String(payload.price || "").trim();
  const numericPrice = Number(priceValue);

  return {
    [map.propertyName]: payload.propertyName || "",
    [map.location]: payload.location || "",
    [map.price]: priceValue && Number.isFinite(numericPrice) ? numericPrice : "",
    [map.type]: payload.type || "House",
    [map.status]: payload.status || fieldConfig.activeStatus,
    [map.description]: payload.description || "",
    [map.businessId]: payload.businessId || "",
    [map.photo]: photoUrls.join("\n")
  };
}

export function sanitizeRecord(record, fieldConfig) {
  const map = fieldConfig.fields;
  const raw = record.fields || {};

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: {
      propertyName: raw[map.propertyName] || raw[map.propertyNameFallback] || "",
      location: raw[map.location] || "",
      price: raw[map.price] || "",
      type: raw[map.type] || "",
      status: raw[map.status] || "",
      description: raw[map.description] || "",
      businessId: raw[map.businessId] || "",
      photo: raw[map.photo] || "",
      photoBase64: raw[map.photoBase64] || null
    }
  };
}

export async function listListings(env, fieldConfig, businessId) {
  ensureAirtableEnv(env);

  const { fields, activeStatus } = fieldConfig;
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
  return records.map((record) => sanitizeRecord(record, fieldConfig));
}

export async function getListingById(env, fieldConfig, recordId) {
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
  return sanitizeRecord(record, fieldConfig);
}

export async function saveListing(env, fieldConfig, payload) {
  ensureAirtableEnv(env);

  const endpoint = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`);
  const fields = buildAirtableFields(payload, fieldConfig);
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
        [fieldConfig.fields.photo]: fields[fieldConfig.fields.photo] || ""
      }
    }, fieldConfig)
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
