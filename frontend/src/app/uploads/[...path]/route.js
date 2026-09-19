export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

export async function GET(req, { params }) {
  const url = new URL(req.url);
  const path = (params.path || []).map(encodeURIComponent).join("/");
  const upstream = await fetch(`${BACKEND_URL}/uploads/${path}${url.search}`, {
    headers: { "ngrok-skip-browser-warning": req.headers.get("ngrok-skip-browser-warning") || "" },
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
