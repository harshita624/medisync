export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// FIX: this used to fall back to "http://localhost:5000" unconditionally.
// On Vercel there is no localhost:5000 — if BACKEND_URL isn't set in the
// project's production environment variables, every single /api/* request
// (login, register, the Google redirect, everything) tried to connect to
// an address that can't exist in that environment and failed the same way
// every time. That's consistent with "ALL auth flows failing" being one
// root cause instead of three unrelated ones.
//
// FIX: also strips a trailing "/api" if someone pastes the backend's own
// /api base into this var by habit — buildTarget() below already adds
// "/api/" itself, so a value like "https://backend.onrender.com/api" would
// otherwise silently become ".../api/api/auth/login" (404) instead of
// ".../api/auth/login".
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
    console.error(
      "[API PROXY] BACKEND_URL is not set in this environment's " +
        "production config — every /api/* request will fail until it is."
    );
    return jsonError(
      500,
      "Server is misconfigured (BACKEND_URL not set). Contact support."
    );
  }

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  // FIX: fetch() to a bad/unreachable backend URL throws instead of
  // returning a response. Uncaught, that crashes this Route Handler and
  // Next.js returns its own error page — often HTML, not JSON — which is
  // exactly what broke the "res.data" shape axios expects on the frontend.
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