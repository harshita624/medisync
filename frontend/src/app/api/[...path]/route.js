export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveBackendUrl() {
  const raw = process.env.BACKEND_URL;

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    return "http://localhost:5000";
  }

  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

function buildTarget(backendUrl, pathSegments = [], search = "") {
  const path = pathSegments.map(encodeURIComponent).join("/");
  return `${backendUrl}/api/${path}${search || ""}`;
}

function forwardedHeaders(req) {
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  return headers;
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function proxy(req, { params }) {
  const backendUrl = resolveBackendUrl();

  if (!backendUrl) {
    console.error("[API PROXY] BACKEND_URL is not set in this environment's production config.");
    return jsonError(500, "Server is misconfigured (BACKEND_URL not set). Contact support.");
  }

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  let upstream;
  try {
    upstream = await fetch(buildTarget(backendUrl, params.path, url.search), {
      method,
      headers: forwardedHeaders(req),
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch (err) {
    console.error("[API PROXY] Could not reach backend:", err.message);
    return jsonError(502, "Could not reach the backend service.");
  }

  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;