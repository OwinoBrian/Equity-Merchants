// TODO: change Airtable Photo field from Attachment to URL type.
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

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("Origin") || "";
    const configuredOrigins = (env.ALLOWED_ORIGIN || "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const allowsAnyOrigin = configuredOrigins.includes("*");
    const allowedOrigin = allowsAnyOrigin
      ? "*"
      : configuredOrigins.includes(requestOrigin)
        ? requestOrigin
        : configuredOrigins[0] || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const requestUrl = new URL(request.url);
    const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
    const fieldConfig = parseFieldConfig(requestUrl);

    if (pathname === "/api/upload") {
      return handleUploadRequest(request, env, corsHeaders);
    }

    if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_TABLE_NAME) {
      return jsonResponse({
        error: "Missing Airtable configuration",
        diagnostics: {
          hasApiKey: Boolean(env.AIRTABLE_API_KEY),
          hasBaseId: Boolean(env.AIRTABLE_BASE_ID),
          hasTableName: Boolean(env.AIRTABLE_TABLE_NAME),
          allowedOrigin: env.ALLOWED_ORIGIN || null
        }
      }, 500, corsHeaders);
    }

    try {
      const action = (requestUrl.searchParams.get("action") || "list").trim().toLowerCase();
      const recordId = (requestUrl.searchParams.get("id") || "").trim();
      const businessId = (requestUrl.searchParams.get("businessId") || "").replace(/'/g, "\\'");
      const endpoint = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`);

      if (request.method === "GET" && (action === "get" || recordId)) {
        if (!recordId) {
          return jsonResponse({ error: "Missing record id" }, 400, corsHeaders);
        }

        const recordResponse = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}/${recordId}`, {
          headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` }
        });

        if (!recordResponse.ok) {
          const errorText = await recordResponse.text();
          return jsonResponse({ error: "Unable to fetch Airtable record", details: errorText }, recordResponse.status, corsHeaders);
        }

        const record = await recordResponse.json();
        return jsonResponse({ record: sanitizeRecord(record, fieldConfig) }, 200, corsHeaders);
      }

      if (request.method === "POST") {
        const payload = await request.json().catch(() => ({}));
        const fields = buildAirtableFields(payload, fieldConfig);
        const updateRecordId = String(payload.recordId || "").trim();
        const photoField = fieldConfig.fields.photo;
        const photoBase64Field = fieldConfig.fields.photoBase64;

        let airtableResponse = updateRecordId
          ? await patchAirtableRecord(updateRecordId, env, fields)
          : await createAirtableRecord(endpoint, env, fields);
        let data = await airtableResponse.json().catch(() => ({}));

        if (!airtableResponse.ok && isFieldError(data, photoBase64Field) && fields[photoBase64Field]) {
          delete fields[photoBase64Field];
          airtableResponse = updateRecordId
            ? await patchAirtableRecord(updateRecordId, env, fields)
            : await createAirtableRecord(endpoint, env, fields);
          data = await airtableResponse.json().catch(() => ({}));
        }

        if (!airtableResponse.ok) {
          return jsonResponse({ error: updateRecordId ? "Unable to update Airtable record" : "Unable to create Airtable record", details: data }, airtableResponse.status, corsHeaders);
        }

        return jsonResponse({
          recordId: data.id,
          record: sanitizeRecord({
            ...data,
            fields: {
              ...(data.fields || {}),
              [photoField]: fields[photoField] || ""
            }
          }, fieldConfig)
        }, 200, corsHeaders);
      }

      if (request.method === "GET") {
        const { fields, activeStatus } = fieldConfig;
        let filterFormula = `{${fields.status}}='${escapeFormulaValue(activeStatus)}'`;
        if (businessId) {
          filterFormula = `AND({${fields.status}}='${escapeFormulaValue(activeStatus)}', {${fields.businessId}}='${businessId}')`;
        }

        endpoint.searchParams.set("filterByFormula", filterFormula);
        const airtableResponse = await fetch(endpoint.toString(), {
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_API_KEY}`
          }
        });

        if (!airtableResponse.ok) {
          const errorText = await airtableResponse.text();
          return jsonResponse({ error: "Unable to fetch Airtable records", details: errorText }, airtableResponse.status, corsHeaders);
        }

        const data = await airtableResponse.json();
        const records = Array.isArray(data.records) ? data.records : [];
        const sanitizedRecords = records.map((record) => sanitizeRecord(record, fieldConfig));
        return jsonResponse({ records: sanitizedRecords }, 200, corsHeaders);
      }

      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    } catch (error) {
      return jsonResponse({ error: "Unexpected worker error", details: error instanceof Error ? error.message : "Unknown error" }, 500, corsHeaders);
    }
  }
};

async function handleUploadRequest(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  if (!env.LISTINGS_IMAGES || !env.R2_PUBLIC_URL) {
    return jsonResponse({
      error: "Missing R2 configuration",
      details: "Add the LISTINGS_IMAGES bucket binding and set R2_PUBLIC_URL before uploading images."
    }, 500, corsHeaders);
  }

  try {
    const formData = await request.formData();
    const file = getUploadFile(formData);

    if (!file) {
      return jsonResponse({ error: "No image file received" }, 400, corsHeaders);
    }

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME_TYPES, file.type)) {
      return jsonResponse({
        error: "Unsupported image type",
        details: "Only JPEG, PNG, and WEBP images are allowed."
      }, 400, corsHeaders);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({
        error: "Image too large",
        details: "Maximum image size is 5MB."
      }, 413, corsHeaders);
    }

    const uploadResult = await putImageInR2(file, env);
    return jsonResponse({ url: uploadResult.url }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({
      error: "Unable to upload image",
      details: error instanceof Error ? error.message : "Unknown upload error"
    }, 500, corsHeaders);
  }
}

function getUploadFile(formData) {
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

function isUploadFile(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.arrayBuffer === "function"
    && typeof value.name === "string"
    && typeof value.type === "string"
    && typeof value.size === "number";
}

async function putImageInR2(file, env) {
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
    throw new Error("Missing R2_PUBLIC_URL");
  }

  return {
    key,
    url: `${baseUrl}/${key}`
  };
}

function parseFieldConfig(requestUrl) {
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

function escapeFormulaValue(value) {
  return String(value || "").replace(/'/g, "\\'");
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

function isFieldError(data, fieldName) {
  return data
    && data.error
    && String(data.error.message || "").includes(`"${fieldName}"`);
}

function buildAirtableFields(payload, fieldConfig) {
  const map = fieldConfig.fields;
  const photoUrls = normalizePhotoUrls(payload.photoUrls);
  const priceValue = String(payload.price || "").trim();
  const numericPrice = Number(priceValue);
  const fields = {
    [map.propertyName]: payload.propertyName || "",
    [map.location]: payload.location || "",
    [map.price]: priceValue && Number.isFinite(numericPrice) ? numericPrice : "",
    [map.type]: payload.type || "House",
    [map.status]: payload.status || fieldConfig.activeStatus,
    [map.description]: payload.description || "",
    [map.businessId]: payload.businessId || "",
    [map.photo]: photoUrls.join("\n")
  };

  if (Array.isArray(payload.photoData) && payload.photoData.length) {
    try {
      fields[map.photoBase64] = JSON.stringify(payload.photoData.slice(0, 10));
    } catch (error) {
      // ignore stringify errors
    }
  }

  return fields;
}

function normalizePhotoUrls(value) {
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

function sanitizeRecord(record, fieldConfig) {
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

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
