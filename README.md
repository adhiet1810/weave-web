# Weave (web)

A **folder-as-truth reasoning graph**, running as a Cloudflare Pages app.

Weave holds thinking as a graph of typed nodes — `problem`, `hypothesis`,
`solution`, `seed`, `synthesis`, `gap` — joined by typed edges on two planes:
a **structural spine** (decomposes / answers / blocks / sparks / combines /
refines) and a **dimensional** layer (shares / drives / depends-on /
constrains) that folds away until you want it. The structure *is* the prompt:
the same derivation that lays out the graph is what an AON model reasons over.

This repo is the server-backed version of that idea. The vault lives in a
Cloudflare **D1** database; a small set of **Pages Functions** derive the graph
and broker a **server-side OpenRouter** call so the model key never touches the
browser.

The seeded example vault is a relatable, non-work topic — **"Cut my food
spending by 30%"** — so a first-time user can read the graph without any
domain context.

---

## Architecture

```
public/index.html      the whole UI (one file: graph canvas, threads, composer)
functions/
  api/graph.js         GET  /api/graph   → read D1, return the derived graph
  api/mutate.js        POST /api/mutate  → one write op, return the fresh graph
  api/ai.js            POST /api/ai      → OpenRouter proxy (synthesize | chat)
  _lib/derive.js       the derivation (JS port of weave-core): folds, effective
                       lean, couplings, scout
  _lib/auth.js         optional Bearer-token gate + the single "default" vault id
migrations/
  0001_init.sql        D1 schema: nodes, facets, edges, captures
  0002_seed.sql        the "Cut my food spending" example vault
wrangler.toml          Pages + D1 binding + default model
```

**The security boundary that matters:** `OPENROUTER_API_KEY` is a server
secret, read only inside `functions/api/ai.js`. The browser calls `/api/ai`;
it never sees the key. If you set `APP_TOKEN`, every `/api/*` request must send
`Authorization: Bearer <APP_TOKEN>` — the frontend prompts for it once and
keeps it in `localStorage`.

---

## Run it locally

Prerequisites: Node 18+ and npm.

```bash
npm install
npm run db:init      # apply schema to a local D1
npm run db:seed      # load the food-spending example vault
npm run dev          # wrangler pages dev on http://localhost:8788
```

The app loads with no key set — the graph, editing, capture, connect, and
add-dimension all work offline against D1. To enable live AI (composer replies
and **Synthesize**), copy `.dev.vars.example` → `.dev.vars` and set
`OPENROUTER_API_KEY`, then restart `npm run dev`.

Quick backend checks:

```bash
curl http://localhost:8788/api/graph
curl -X POST http://localhost:8788/api/mutate \
  -H 'content-type: application/json' \
  -d '{"op":"addCapture","id":"c1","text":"try oat milk in bulk"}'
```

---

## Deploy to Cloudflare (GitHub → Pages)

1. **Push to GitHub.**

   ```bash
   git remote add origin https://github.com/<you>/weave-web.git
   git push -u origin main
   ```

2. **Create the D1 database** (once) and paste its id into `wrangler.toml`:

   ```bash
   npx wrangler d1 create weave
   # copy the printed database_id into wrangler.toml → [[d1_databases]].database_id
   npm run db:init:remote
   npm run db:seed:remote
   ```

3. **Connect the repo in the Cloudflare dashboard** → *Workers & Pages* →
   *Create* → *Pages* → *Connect to Git*. Build settings:
   - Build command: *(none)*
   - Build output directory: `public`
   - Under *Settings → Functions → D1 bindings*: bind variable **`DB`** to the
     `weave` database.

4. **Set the secrets** (Pages project → *Settings → Environment variables*, or
   via CLI):

   ```bash
   npx wrangler pages secret put OPENROUTER_API_KEY
   npx wrangler pages secret put APP_TOKEN        # optional; gates all /api/*
   ```

   `OPENROUTER_MODEL` is a plain var (defaults to
   `anthropic/claude-3.5-sonnet` in `wrangler.toml`); override per-request by
   sending `model` in the `/api/ai` body.

Every push to the connected branch redeploys. Migrations are *not* run on
deploy — apply them once with the `:remote` scripts above (and again when the
schema changes).

---

## The write ops (`POST /api/mutate`)

| op              | payload                                                        |
|-----------------|---------------------------------------------------------------|
| `upsertNode`    | `{ node: { id, kind, region, title, state?, distillate?, facets? } }` |
| `deleteNode`    | `{ id }` (also removes its facets and any incident edges)     |
| `addEdge`       | `{ src, to_id, rel, from?, to_facet?, note? }`                |
| `deleteEdge`    | `{ id }`                                                       |
| `addFacet`      | `{ node_id, name, semantic?, distillate?, confidence? }`      |
| `addCapture`    | `{ id, text }`                                                |
| `deleteCapture` | `{ id }`                                                       |
| `promote`       | `{ captureId, node }` (capture → node in one step)            |

Each returns the full re-derived graph, so the client stays in sync.

## The AI actions (`POST /api/ai`)

- `{ action: "chat", messages: [...] }` → `{ reply }` — a short, vector-aware
  thread reply.
- `{ action: "synthesize", context: { seeds: [...] } }` → `{ proposal }` — a
  structured synthesis of the given seeds, validated against a JSON schema and
  filtered so it can only combine seeds you actually passed. **AI proposes, you
  dispose:** the proposal appears in the Synthesis tab with *Add to graph* /
  *Discard*. Nothing is written until you accept.
