import {
  getListingById,
  getUploadFile,
  jsonResponse,
  listListings,
  parseFieldConfig,
  saveListing,
  uploadImageToR2
} from "../../functions/_shared/airtable.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("Origin") || "";
    const configuredOrigins = (env.ALLOWED_ORIGIN || "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const allowsAnyOrigin = configuredOrigins.includes("*");
    const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
    const allowsLocalOrigin = configuredOrigins.some(isLocalOrigin);
    const allowedOrigin = allowsAnyOrigin
      ? "*"
      : configuredOrigins.includes(requestOrigin)
        ? requestOrigin
        : requestOrigin && isLocalOrigin(requestOrigin) && allowsLocalOrigin
          ? requestOrigin
          : configuredOrigins.find((origin) => isLocalOrigin(origin)) || configuredOrigins[0] || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);
    const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
    const fieldConfig = parseFieldConfig(requestUrl);

    if (pathname === "/api/upload") {
      return handleUploadRequest(request, env, corsHeaders);
    }

    if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_TABLE_NAME) {
      return responseWithCors({
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

      if (request.method === "GET" && (action === "get" || recordId)) {
        if (!recordId) {
          return responseWithCors({ error: "Missing record id" }, 400, corsHeaders);
        }

        const record = await getListingById(env, fieldConfig, recordId);
        return responseWithCors({ record }, 200, corsHeaders);
      }

      if (request.method === "POST") {
        const payload = await request.json().catch(() => ({}));
        const result = await saveListing(env, fieldConfig, payload);
        return responseWithCors(result, 200, corsHeaders);
      }

      if (request.method === "GET") {
        const records = await listListings(env, fieldConfig, businessId);
        return responseWithCors({ records }, 200, corsHeaders);
      }

      return responseWithCors({ error: "Method not allowed" }, 405, corsHeaders);
    } catch (error) {
      return responseWithCors({
        error: "Unexpected worker error",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 500, corsHeaders);
    }
  }
};

async function handleUploadRequest(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return responseWithCors({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const formData = await request.formData();
    const file = getUploadFile(formData);

    if (!file) {
      return responseWithCors({ error: "No image file received" }, 400, corsHeaders);
    }

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME_TYPES, file.type)) {
      return responseWithCors({
        error: "Unsupported image type",
        details: "Only JPEG, PNG, and WEBP images are allowed."
      }, 400, corsHeaders);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return responseWithCors({
        error: "Image too large",
        details: "Maximum image size is 5MB."
      }, 413, corsHeaders);
    }

    try {
      const uploadResult = await uploadImageToR2(file, env);
      return responseWithCors({ url: uploadResult.url, storage: "r2" }, 200, corsHeaders);
    } catch (storageError) {
      console.warn("R2 upload failed, using data URL fallback", storageError);
      const dataUrl = await fileToDataUrl(file);
      return responseWithCors({ url: dataUrl, storage: "data-url" }, 200, corsHeaders);
    }
  } catch (error) {
    return responseWithCors({
      error: "Unable to upload image",
      details: error instanceof Error ? error.message : "Unknown upload error"
    }, 500, corsHeaders);
  }
}

function responseWithCors(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers
    }
  });
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fileToDataUrl(file) {
  const bytes = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(bytes);
  return `data:${file.type || "application/octet-stream"};base64,${base64}`;
}
