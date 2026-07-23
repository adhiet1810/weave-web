// /api/projects — the multi-project library.
//   GET                       -> { projects: [{id,name,created}] }  (excludes the example template)
//   POST { op:"create", name, from:"blank"|"example", id? } -> { id, name, projects }
//   POST { op:"rename", id, name }                          -> { projects }
//   POST { op:"delete", id }                                -> { projects }
// The active project itself is chosen client-side via the X-Weave-Project header
// (see graph.js / mutate.js); this endpoint just manages the catalogue + seeding.
import { requireAuth, VAULT, EXAMPLE } from "../_lib/auth.js";

const now = () => new Date().toISOString();

const COLS = {
  nodes: "id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated",
  facets: "node_id,name,semantic,distillate,confidence",
  edges: "src,from_facet,to_id,to_facet,rel,note",
  captures: "id,text,created",
};

function slug(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
function randId() {
  return "p" + Math.random().toString(36).slice(2, 9);
}

// Example templates are reserved, read-only vaults: the legacy 'example'
// plus anything under the 'ex-' prefix. They never appear in the user's own
// project list and cannot be renamed or deleted through this endpoint.
function isExample(id) {
  return typeof id === "string" && (id === EXAMPLE || id.startsWith("ex-"));
}

async function listProjects(db) {
  // Make sure the primary working project always appears.
  await db.prepare("INSERT OR IGNORE INTO projects (vault_id,name,created) VALUES (?,?,?)")
    .bind(VAULT, "My project", now()).run();
  const rows = await db.prepare(
    "SELECT vault_id AS id, name, created FROM projects WHERE vault_id != ? AND vault_id NOT LIKE 'ex-%' ORDER BY created DESC"
  ).bind(EXAMPLE).all();
  return rows.results || [];
}

// The example library, shown in the "load an example" picker.
async function listExamples(db) {
  const rows = await db.prepare(
    "SELECT vault_id AS id, name, created FROM projects WHERE vault_id = ? OR vault_id LIKE 'ex-%' ORDER BY created ASC"
  ).bind(EXAMPLE).all();
  return rows.results || [];
}

export async function onRequestGet({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const db = env.DB;
  return Response.json({ projects: await listProjects(db), examples: await listExamples(db) });
}

export async function onRequestPost({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const db = env.DB;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

  try {
    if (body.op === "create") {
      let id = slug(body.id) || slug(body.name) || randId();
      // avoid collisions with an existing project / reserved vaults
      const exists = await db.prepare("SELECT 1 FROM projects WHERE vault_id=?").bind(id).first();
      if (id === VAULT || isExample(id) || exists) id = randId();
      const name = (body.name || "Untitled").toString().slice(0, 120);
      await db.prepare("INSERT INTO projects (vault_id,name,created) VALUES (?,?,?)").bind(id, name, now()).run();
      // Seed from a specific example template when requested. `from` may be
      // "example" (legacy) or any 'ex-' vault id; "blank"/absent -> empty.
      const src = isExample(body.from) ? body.from : null;
      if (src) {
        await db.batch([
          db.prepare("INSERT INTO nodes (vault_id," + COLS.nodes + ") SELECT ?," + COLS.nodes + " FROM nodes WHERE vault_id=?").bind(id, src),
          db.prepare("INSERT INTO facets (vault_id," + COLS.facets + ") SELECT ?," + COLS.facets + " FROM facets WHERE vault_id=?").bind(id, src),
          db.prepare("INSERT INTO edges (vault_id," + COLS.edges + ") SELECT ?," + COLS.edges + " FROM edges WHERE vault_id=?").bind(id, src),
          db.prepare("INSERT INTO captures (vault_id," + COLS.captures + ") SELECT ?," + COLS.captures + " FROM captures WHERE vault_id=?").bind(id, src),
        ]);
      }
      return Response.json({ id, name, projects: await listProjects(db) });
    }

    if (body.op === "rename") {
      const id = slug(body.id);
      if (!id) return Response.json({ error: "bad id" }, { status: 400 });
      if (isExample(id)) return Response.json({ error: "cannot rename an example" }, { status: 400 });
      const name = (body.name || "Untitled").toString().slice(0, 120);
      await db.prepare(
        "INSERT INTO projects (vault_id,name,created) VALUES (?,?,?) ON CONFLICT(vault_id) DO UPDATE SET name=excluded.name"
      ).bind(id, name, now()).run();
      return Response.json({ projects: await listProjects(db) });
    }

    if (body.op === "delete") {
      const id = slug(body.id);
      if (!id || id === VAULT || isExample(id)) return Response.json({ error: "cannot delete this project" }, { status: 400 });
      await db.batch([
        db.prepare("DELETE FROM nodes WHERE vault_id=?").bind(id),
        db.prepare("DELETE FROM facets WHERE vault_id=?").bind(id),
        db.prepare("DELETE FROM edges WHERE vault_id=?").bind(id),
        db.prepare("DELETE FROM captures WHERE vault_id=?").bind(id),
        db.prepare("DELETE FROM projects WHERE vault_id=?").bind(id),
      ]);
      return Response.json({ projects: await listProjects(db) });
    }
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 400 });
  }
  return Response.json({ error: "unknown op" }, { status: 400 });
}
