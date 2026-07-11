import { getListingById, jsonResponse, parseFieldConfig } from "../../_shared/airtable.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const requestUrl = new URL(request.url);
  const fieldConfig = parseFieldConfig(requestUrl);
  const recordId = String(params.id || "").trim();

  try {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const record = await getListingById(env, fieldConfig, recordId);
    return jsonResponse({ record }, 200);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected API error",
      details: error && typeof error === "object" && "details" in error ? error.details : null
    }, error && typeof error === "object" && "status" in error ? error.status : 500);
  }
}
