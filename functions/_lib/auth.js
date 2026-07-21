// Minimal workspace-token gate. If APP_TOKEN is unset the app is open (dev/local).
// When set, every request must send `Authorization: Bearer <APP_TOKEN>`.
export function requireAuth(request, env) {
  const token = env.APP_TOKEN;
  if (!token) return null; // open in dev
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (got !== token) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  return null;
}

export const VAULT = "default";   // the primary working project (default active)
export const EXAMPLE = "example";  // read-only template cloned by "Load example"

// Resolve the active project (vault) from the request. The client selects it via
// the X-Weave-Project header; falls back to the primary working vault.
export function activeVault(request) {
  const raw = (request.headers.get("X-Weave-Project") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  return raw || VAULT;
}
