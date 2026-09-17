// GET /api/export — Weave's portability contract.
//
// Returns a round-trippable JSON bundle of the ACTIVE project: raw rows, with
// the instance-specific bits (vault_id, autoincrement edge ids) stripped, so
// the bundle can be imported into any other Weave instance unchanged.
//
// This is deliberately NOT the Markdown export. Markdown is for reading (an
// AI-readable context file); it is lossy. This is for moving and backing up:
// everything needed to rebuild the project exactly.
import { requireAuth, activeVault } from "../_lib/auth.js";

export async function onRequestGet({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const db = env.DB;
  const vault = activeVault(request);

  const [nodes, facets, edges, captures, proj] = await Promise.all([
    db.prepare(
      "SELECT id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated FROM nodes WHERE vault_id=?"
    ).bind(vault).all(),
    db.prepare(
      "SELECT node_id,name,semantic,distillate,confidence FROM facets WHERE vault_id=?"
    ).bind(vault).all(),
    db.prepare(
      "SELECT src,from_facet,to_id,to_facet,rel,note FROM edges WHERE vault_id=?"
    ).bind(vault).all(),
    db.prepare(
      "SELECT id,text,created FROM captures WHERE vault_id=?"
    ).bind(vault).all(),
    db.prepare("SELECT name FROM projects WHERE vault_id=?").bind(vault).first(),
  ]);

  return Response.json(
    {
      weave: 1,                               // bundle format version
      exported: new Date().toISOString(),
      project: { name: proj?.name || "Untitled" },
      nodes: nodes.results || [],
      facets: facets.results || [],
      edges: edges.results || [],
      captures: captures.results || [],
    },
    { headers: { "cache-control": "no-store" } }
  );
}
