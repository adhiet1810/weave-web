// POST /api/mutate — apply one write op to the D1 vault, return the fresh graph.
// Body: { op, ... }.  Ops: upsertNode, deleteNode, addEdge, deleteEdge,
//                          addFacet, addCapture, deleteCapture, promote.
import { derive } from "../_lib/derive.js";
import { requireAuth, VAULT, EXAMPLE } from "../_lib/auth.js";

const now = () => new Date().toISOString();

// Column lists for the loadExample clone (edges.id is AUTOINCREMENT, so omit it).
const COLS = {
  nodes: "id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated",
  facets: "node_id,name,semantic,distillate,confidence",
  edges: "src,from_facet,to_id,to_facet,rel,note",
  captures: "id,text,created",
};

async function apply(db, op, a) {
  switch (op) {
    case "upsertNode": {
      const n = a.node;
      await db.prepare(
        `INSERT INTO nodes (vault_id,id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(vault_id,id) DO UPDATE SET
           kind=excluded.kind,state=excluded.state,region=excluded.region,lean=excluded.lean,
           cluster=excluded.cluster,title=excluded.title,distillate_text=excluded.distillate_text,
           distillate_confidence=excluded.distillate_confidence,distillate_updated=excluded.distillate_updated,
           body=excluded.body,updated=excluded.updated`
      ).bind(
        VAULT, n.id, n.kind ?? null, n.state ?? "freeform", n.region ?? null, n.lean ?? "inherit",
        n.cluster ?? null, n.title ?? null,
        n.distillate?.text ?? null, n.distillate?.confidence ?? null, n.distillate ? now() : null,
        n.body ?? "", n.created ?? now(), now()
      ).run();
      if (Array.isArray(n.facets)) {
        for (const f of n.facets) {
          await db.prepare(
            `INSERT INTO facets (vault_id,node_id,name,semantic,distillate,confidence) VALUES (?,?,?,?,?,?)
             ON CONFLICT(vault_id,node_id,name) DO UPDATE SET semantic=excluded.semantic,distillate=excluded.distillate,confidence=excluded.confidence`
          ).bind(VAULT, n.id, f.name, f.semantic ?? null, f.distillate ?? null, f.confidence ?? null).run();
        }
      }
      return;
    }
    case "deleteNode":
      await db.batch([
        db.prepare("DELETE FROM nodes WHERE vault_id=? AND id=?").bind(VAULT, a.id),
        db.prepare("DELETE FROM facets WHERE vault_id=? AND node_id=?").bind(VAULT, a.id),
        db.prepare("DELETE FROM edges WHERE vault_id=? AND (src=? OR to_id=?)").bind(VAULT, a.id, a.id),
      ]);
      return;
    case "addEdge":
      await db.prepare(
        "INSERT INTO edges (vault_id,src,from_facet,to_id,to_facet,rel,note) VALUES (?,?,?,?,?,?,?)"
      ).bind(VAULT, a.src, a.from ?? null, a.to_id, a.to_facet ?? null, a.rel, a.note ?? null).run();
      return;
    case "deleteEdge":
      await db.prepare("DELETE FROM edges WHERE vault_id=? AND id=?").bind(VAULT, a.id).run();
      return;
    case "addFacet":
      await db.prepare(
        `INSERT INTO facets (vault_id,node_id,name,semantic,distillate,confidence) VALUES (?,?,?,?,?,?)
         ON CONFLICT(vault_id,node_id,name) DO UPDATE SET semantic=excluded.semantic`
      ).bind(VAULT, a.node_id, a.name, a.semantic ?? "informational", a.distillate ?? null, a.confidence ?? null).run();
      return;
    case "addCapture":
      await db.prepare("INSERT OR REPLACE INTO captures (vault_id,id,text,created) VALUES (?,?,?,?)")
        .bind(VAULT, a.id, a.text, now()).run();
      return;
    case "deleteCapture":
      await db.prepare("DELETE FROM captures WHERE vault_id=? AND id=?").bind(VAULT, a.id).run();
      return;
    case "promote": // capture -> node
      await db.prepare("DELETE FROM captures WHERE vault_id=? AND id=?").bind(VAULT, a.captureId).run();
      await apply(db, "upsertNode", { node: a.node });
      return;
    case "renameProject":
      await db.prepare(
        `INSERT INTO projects (vault_id,name,created) VALUES (?,?,?)
         ON CONFLICT(vault_id) DO UPDATE SET name=excluded.name`
      ).bind(VAULT, a.name || "Untitled", now()).run();
      return;
    case "clearVault": // "New blank" — empty the working project
      await db.batch([
        db.prepare("DELETE FROM nodes WHERE vault_id=?").bind(VAULT),
        db.prepare("DELETE FROM facets WHERE vault_id=?").bind(VAULT),
        db.prepare("DELETE FROM edges WHERE vault_id=?").bind(VAULT),
        db.prepare("DELETE FROM captures WHERE vault_id=?").bind(VAULT),
      ]);
      if (a.name) await apply(db, "renameProject", { name: a.name });
      return;
    case "loadExample": // clone the example template into the working project
      await db.batch([
        db.prepare("DELETE FROM nodes WHERE vault_id=?").bind(VAULT),
        db.prepare("DELETE FROM facets WHERE vault_id=?").bind(VAULT),
        db.prepare("DELETE FROM edges WHERE vault_id=?").bind(VAULT),
        db.prepare("DELETE FROM captures WHERE vault_id=?").bind(VAULT),
        db.prepare("INSERT INTO nodes (vault_id," + COLS.nodes + ") SELECT ?," + COLS.nodes + " FROM nodes WHERE vault_id=?").bind(VAULT, EXAMPLE),
        db.prepare("INSERT INTO facets (vault_id," + COLS.facets + ") SELECT ?," + COLS.facets + " FROM facets WHERE vault_id=?").bind(VAULT, EXAMPLE),
        db.prepare("INSERT INTO edges (vault_id," + COLS.edges + ") SELECT ?," + COLS.edges + " FROM edges WHERE vault_id=?").bind(VAULT, EXAMPLE),
        db.prepare("INSERT INTO captures (vault_id," + COLS.captures + ") SELECT ?," + COLS.captures + " FROM captures WHERE vault_id=?").bind(VAULT, EXAMPLE),
      ]);
      await apply(db, "renameProject", { name: a.name || "Cut my food spending (example)" });
      return;
    default:
      throw new Error("unknown op: " + op);
  }
}

export async function onRequestPost({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const db = env.DB;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  try {
    await apply(db, body.op, body);
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 400 });
  }
  const [nodes, facets, edges, captures, proj] = await Promise.all([
    db.prepare("SELECT * FROM nodes WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT * FROM facets WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT * FROM edges WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT * FROM captures WHERE vault_id=?").bind(VAULT).all(),
    db.prepare("SELECT name FROM projects WHERE vault_id=?").bind(VAULT).first(),
  ]);
  const graph = derive(nodes.results, facets.results, edges.results, captures.results);
  graph.project = { name: proj?.name || "Untitled" };
  return Response.json(graph);
}
