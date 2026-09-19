# Weave

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-003c33.svg)](./LICENSE)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/adhiet1810/weave-web)

**A tool for thinking through hard things.** Weave holds your reasoning as a
graph of typed nodes — `problem`, `hypothesis`, `solution`, `seed`, `synthesis`,
`gap` — joined by typed edges on two planes: a **structural spine** (decomposes /
answers / blocks / sparks / combines / refines) and a **dimensional** layer
(shares / drives / depends-on / constrains) that folds away until you want it.

The structure *is* the prompt. Because the AI reads a typed graph instead of a
wall of prose, asking it to act on a node is a precise instruction rather than a
vague request.

**Weave is local-first.** Your graph lives on your device. There is no account,
no sign-up, and no server that holds your thinking. See [the manifesto](../MANIFESTO.md).

---

## Run it

Three ways, easiest first. **The first needs nothing but a web server.**

### 1. Just serve the folder (recommended)

Weave runs as a plain static page. No database, no account, no build step.

```bash
npx --yes serve public        # or: python3 -m http.server -d public 8080
```

Open the printed URL. That's the whole install. Your graphs are stored in your
browser (IndexedDB), and the four example graphs are bundled as static files.

> **Why not just double-click `public/index.html`?** It mostly works, but
> browsers block `fetch` on `file://`, so the bundled **examples won't load**.
> Everything else does. Serving the folder is one command and avoids the issue.

### 2. With Docker

```bash
docker build -t weave .
docker run --rm -p 8080:80 weave
```

### 3. With the optional server backend (Cloudflare Pages + D1)

Only needed if you want a **hosted, multi-device** instance with a shared
database. Requires Node 18+ and your own Cloudflare account.

```bash
npm install
npm run db:init       # schema
npm run db:seed       # the "Cut my food spending" graph
npm run db:projects   # projects table  (required — /api/graph 500s without it)
npm run db:examples   # the example library
npm run dev           # wrangler pages dev → http://localhost:8788
```

---

## Your AI key stays yours

Weave's AI is **bring-your-own-key**. Click **✦ AI** in the top bar, paste a key
from your provider, and it is stored **only in your browser** and sent **directly
to that provider**. It never touches any Weave server — including this one.

**No key = AI features are simply off.** Everything else (the graph, editing,
capture, connect, export) works exactly the same without one.

Default provider is [OpenRouter](https://openrouter.ai/keys); any
OpenAI-compatible endpoint works if it allows browser (CORS) requests.

> Self-hosters *may* optionally set a server-side `OPENROUTER_API_KEY` to offer a
> fallback for visitors who don't bring their own key — see `.dev.vars.example`.
> It is not required, and it is not the default path.

---

## Where your data lives

A **⛁** button in the project bar shows and switches the active store:

| Mode | Meaning |
| --- | --- |
| **⛁ On this device** | The graph lives in this browser (IndexedDB). No server involved. |
| **⛁ Server** | The graph lives in this deployment's D1 database. |

Weave picks automatically on first load: if this deployment answers `/api/graph`
it uses the server, otherwise it falls back to device storage. Switching never
deletes anything on either side — each store keeps its own projects.

---

## Nothing is ever trapped

Two exports, for two different jobs:

- **⬇ Export** → Markdown. For *reading* — an AI-readable context file of the
  whole graph. Lossy by design.
- **{ } JSON** → a portable bundle. For *moving and backing up*: every row needed
  to rebuild the project exactly, on any Weave instance.

**⬆ Import** reads a JSON bundle back in. Import always creates a **new project**,
so a file can never silently overwrite work you already have.

The bundle is a plain, versioned JSON object (`{"weave": 1, project, nodes,
facets, edges, captures}`) — readable and diffable, not an opaque blob.

---

## Deploy

### Any static host

Weave is a static site. Point any host at the **`public/`** directory with **no
build command** — Cloudflare Pages, Netlify, Vercel, GitHub Pages, S3, or your
own nginx all work. Users get the full local-first app.

### Cloudflare Pages + D1 (for the optional server mode)

The button at the top of this README reads `wrangler.toml` and provisions the
resources it declares, including a D1 database.

Deploying by hand instead:

1. Create your **own** D1 database and put its id in `wrangler.toml`:

   ```bash
   npx wrangler d1 create weave
   # paste the printed database_id into wrangler.toml → [[d1_databases]].database_id
   ```

   > ⚠️ The `database_id` committed here points at the original author's
   > database. You **must** replace it with your own — it is not a credential and
   > grants no access, but deploys will not find your data until you swap it.

2. Apply the migrations to the remote database:

   ```bash
   npm run db:init:remote
   npm run db:seed:remote
   npm run db:projects:remote
   npm run db:examples:remote
   ```

3. In the Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* →
   *Connect to Git*. Build command: **none**. Output directory: **`public`**.
   Under *Settings → Functions → D1 bindings*, bind **`DB`** to your database.

Migrations do **not** run on deploy — apply them with the `:remote` scripts above,
and again whenever the schema changes.

---

## Architecture

```
public/
  index.html           the whole UI — graph canvas, threads, composer,
                       the local-first engine, and the BYOK AI client
  examples/*.json      the example graphs as static bundles (no DB needed)
functions/             OPTIONAL server backend (Cloudflare Pages Functions)
  api/graph.js         GET  /api/graph   → read D1, return the derived graph
  api/mutate.js        POST /api/mutate  → one write op, return the fresh graph
  api/export.js        GET  /api/export  → the portable JSON bundle
  api/projects.js      the project library
  api/ai.js            POST /api/ai      → optional server-side AI fallback
  _lib/derive.js       the derivation: folds, effective lean, couplings, scout
  _lib/auth.js         optional Bearer-token gate + vault resolution
migrations/*.sql       D1 schema, seed, projects, example library
wrangler.toml          Pages + D1 binding + default model
```

The **derivation is the contract**: `_lib/derive.js` (server) and the ported copy
in the browser produce an identical graph from identical rows, so both backends
behave the same.

---

## Write ops (`POST /api/mutate`, or the local engine)

| op | payload |
|---|---|
| `upsertNode` | `{ node: { id, kind, region, title, state?, distillate?, facets? } }` |
| `deleteNode` | `{ id }` — also removes its facets and incident edges |
| `addEdge` | `{ src, to_id, rel, from?, to_facet?, note? }` |
| `deleteEdge` / `deleteEdgeMatch` | `{ id }` / `{ src, to_id, rel }` |
| `addFacet` | `{ node_id, name, semantic?, distillate?, confidence? }` |
| `addCapture` / `deleteCapture` | `{ id, text }` / `{ id }` |
| `promote` | `{ captureId, node }` — capture → node in one step |
| `renameNode` / `editNode` / `changeKind` | node edits |
| `renameProject` / `clearVault` | project-level |
| `importVault` | `{ bundle }` — rebuild a vault from a portable bundle |

Each returns the full re-derived graph, so the client stays in sync.

---

## Contributing

Issues and pull requests are welcome. Please keep the two promises the project is
built on: **the graph stays on the user's device by default**, and **no user's key
or reasoning is ever sent to a Weave-controlled server**.

## License

[GNU AGPL-3.0](./LICENSE). You may use, study, modify and self-host Weave freely.
If you run a modified version as a network service, you must publish your changes.
