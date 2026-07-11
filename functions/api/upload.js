import { getUploadFile, jsonResponse, uploadImageToR2 } from "../_shared/airtable.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const formData = await request.formData();
    const file = getUploadFile(formData);

    if (!file) {
      return jsonResponse({ error: "No image file received" }, 400);
    }

    const uploadResult = await uploadImageToR2(file, env);
    return jsonResponse({ url: uploadResult.url, key: uploadResult.key }, 200);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unable to upload image",
      details: error && typeof error === "object" && "details" in error ? error.details : null
    }, error && typeof error === "object" && "status" in error ? error.status : 500);
  }
}
