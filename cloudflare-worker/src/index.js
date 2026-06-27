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
      const requestUrl = new URL(request.url);
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
        return jsonResponse({ record: sanitizeRecord(record) }, 200, corsHeaders);
      }

      if (request.method === "POST") {
        const payload = await request.json().catch(() => ({}));
        const fields = buildAirtableFields(payload);
        const body = JSON.stringify({ fields });

        const airtableResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body
        });

        const data = await airtableResponse.json().catch(() => ({}));
        if (!airtableResponse.ok) {
          return jsonResponse({ error: "Unable to create Airtable record", details: data }, airtableResponse.status, corsHeaders);
        }

        return jsonResponse({ recordId: data.id, record: sanitizeRecord(data) }, 200, corsHeaders);
      }

      if (request.method === "GET") {
        let filterFormula = "{Status}='Active'";
        if (businessId) {
          filterFormula = `AND({Status}='Active', {Business ID}='${businessId}')`;
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
        const sanitizedRecords = records.map((record) => sanitizeRecord(record));
        return jsonResponse({ records: sanitizedRecords }, 200, corsHeaders);
      }

      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    } catch (error) {
      return jsonResponse({ error: "Unexpected worker error", details: error instanceof Error ? error.message : "Unknown error" }, 500, corsHeaders);
    }
  }
};

function buildAirtableFields(payload) {
  const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls : [];
  const fields = {
    "Property Name": payload.propertyName || "",
    Location: payload.location || "",
    Price: payload.price || "",
    Type: payload.type || "House",
    Status: payload.status || "Active",
    Description: payload.description || "",
    "Business ID": payload.businessId || "",
    Photo: photoUrls.map((url) => ({ url }))
  };

  // If the client uploaded files as data URLs, persist them in a text field
  if (Array.isArray(payload.photoData) && payload.photoData.length) {
    try {
      fields['PhotoBase64'] = JSON.stringify(payload.photoData.slice(0, 10));
    } catch (e) {
      // ignore stringify errors
    }
  }

  return fields;
}

function sanitizeRecord(record) {
  const fields = record.fields || {};
  const photo = Array.isArray(fields.Photo)
    ? fields.Photo
        .filter((item) => item && item.url)
        .map((item) => ({
          url: item.url,
          cardUrl: item.thumbnails && item.thumbnails.large ? item.thumbnails.large.url : item.url,
          thumbUrl: item.thumbnails && item.thumbnails.small ? item.thumbnails.small.url : item.url
        }))
    : [];

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: {
      "Property Name": fields["Property Name"] || fields.Name || "",
      Location: fields.Location || "",
      Price: fields.Price || "",
      Type: fields.Type || "",
      Description: fields.Description || "",
      "Business ID": fields["Business ID"] || "",
      Photo: photo,
      PhotoBase64: fields.PhotoBase64 || null
    }
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
