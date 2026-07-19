// Minimal workspace-token gate. If APP_TOKEN is unset the app is open (dev/local).
// When set, every request must send `Authorization: Bearer <APP_TOKEN>`.
export function requireAuth(request, env) {
  const token = env.APP_TOKEN;
  if (!token) return null; // open in dev
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (got !== token) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  return null;
}

export const VAULT = "default"; // single-workspace v1
