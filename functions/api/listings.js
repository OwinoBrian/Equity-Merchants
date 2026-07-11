import { jsonResponse, listListings, saveListing, parseFieldConfig } from "../_shared/airtable.js";

export async function onRequest(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);
  const fieldConfig = parseFieldConfig(requestUrl);

  try {
    if (request.method === "GET") {
      const businessId = (requestUrl.searchParams.get("businessId") || "").trim();
      const records = await listListings(env, fieldConfig, businessId);
      return jsonResponse({ records }, 200);
    }

    if (request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      const result = await saveListing(env, fieldConfig, payload);
      return jsonResponse(result, 200);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected API error",
      details: error && typeof error === "object" && "details" in error ? error.details : null
    }, error && typeof error === "object" && "status" in error ? error.status : 500);
  }
}
