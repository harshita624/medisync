export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

function buildTarget(pathSegments = [], search = "") {
  const path = pathSegments.map(encodeURIComponent).join("/");
  return `${BACKEND_URL}/api/${path}${search || ""}`;
}

function forwardedHeaders(req) {
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  return headers;
}

async function proxy(req, { params }) {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const upstream = await fetch(buildTarget(params.path, url.search), {
    method,
    headers: forwardedHeaders(req),
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual",
  });

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
