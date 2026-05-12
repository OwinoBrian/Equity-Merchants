export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "GET") {
      return jsonResponse({
        error: "Method not allowed"
      }, 405, corsHeaders);
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
      const endpoint = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`);
      endpoint.searchParams.set("filterByFormula", "{Status}='Active'");
      endpoint.searchParams.set("sort[0][field]", "Property Name");
      endpoint.searchParams.set("sort[0][direction]", "asc");

      const airtableResponse = await fetch(endpoint.toString(), {
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_API_KEY}`
        }
      });

      if (!airtableResponse.ok) {
        const errorText = await airtableResponse.text();

        return jsonResponse({
          error: "Unable to fetch Airtable records",
          details: errorText
        }, airtableResponse.status, corsHeaders);
      }

      const data = await airtableResponse.json();
      const records = Array.isArray(data.records) ? data.records : [];

      const sanitizedRecords = records.map((record) => sanitizeRecord(record));

      return jsonResponse({
        records: sanitizedRecords
      }, 200, corsHeaders);
    } catch (error) {
      return jsonResponse({
        error: "Unexpected worker error",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 500, corsHeaders);
    }
  }
};

function sanitizeRecord(record) {
  const fields = record.fields || {};
  const photo = Array.isArray(fields.Photo)
    ? fields.Photo
        .filter((item) => item && item.url)
        .map((item) => ({
          url: item.url
        }))
    : [];

  return {
    id: record.id,
    fields: {
      "Property Name": fields["Property Name"] || fields.Name || "",
      Location: fields.Location || "",
      Price: fields.Price || "",
      Type: fields.Type || "",
      Description: fields.Description || "",
      Photo: photo
    }
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
