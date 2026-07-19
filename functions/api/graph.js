// GET /api/graph — read the vault from D1 and return the derived graph.
import { derive } from "../_lib/derive.js";
import { requireAuth, VAULT } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const db = env.DB;
  const [nodes, facets, edges, captures] = await Promise.all([
    db.prepare("SELECT * FROM nodes WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT * FROM facets WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT * FROM edges WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT * FROM captures WHERE vault_id=?").bind(VAULT).all(),
  ]);
  const graph = derive(nodes.results, facets.results, edges.results, captures.results);
  return Response.json(graph, { headers: { "cache-control": "no-store" } });
}
