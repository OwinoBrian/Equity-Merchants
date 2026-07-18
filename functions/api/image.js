export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }

    const requestUrl = new URL(request.url);
    const src = String(requestUrl.searchParams.get("src") || "").trim();
    const allowedBaseUrl = String(env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

    if (!src) {
      return jsonError("Missing image source", 400);
    }

    if (!allowedBaseUrl || !src.startsWith(allowedBaseUrl)) {
      return jsonError("Invalid image source", 403);
    }

    const upstreamResponse = await fetch(src, {
      headers: {
        Accept: "image/*"
      }
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => "");
      return jsonError("Unable to fetch image", upstreamResponse.status, errorText);
    }

    const headers = new Headers();
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    const cacheControl = upstreamResponse.headers.get("cache-control") || "public, max-age=86400";
    headers.set("Cache-Control", cacheControl);
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected image proxy error",
      500
    );
  }
}

function jsonError(message, status = 500, details = null) {
  return new Response(JSON.stringify({
    error: message,
    details
  }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
