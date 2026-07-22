// POST /api/ai — server-side OpenRouter proxy. The API key stays here, never in
// the browser. Implements two actions from weave-ai-actions.md:
//   { action: "chat", messages: [...] }         -> a thread reply (text)
//   { action: "synthesize", context: {...} }    -> a structured synthesis proposal
//
// Model-agnostic: synthesize first asks for a strict JSON schema (best on models
// that support Structured Outputs) and falls back to plain JSON generation +
// robust parsing for models that don't (e.g. DeepSeek). So it works either way.
import { requireAuth } from "../_lib/auth.js";

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-v4-pro";

const SYNTH_SYSTEM = `You are Weave's synthesis partner. Weave is a reasoning graph of typed nodes.
The create vector is divergent: a synthesis fuses several seeds into one novel whole.
Combine the given seeds — and ONLY those — into a single synthesis. Cite which seed
contributes what. Place it honestly on the novel x feasible frame; never dress a
research bet as a breakthrough. Surface any constraint it INHERITS from its parents or
their couplings; do not hide it. Introduce no facts not derivable from the inputs.`;

// Plain-text shape description so models WITHOUT strict json_schema support still
// return the right object.
const SYNTH_JSON_HINT = `Return ONLY a single JSON object — no prose, no markdown fences — with exactly these keys:
"title" (string), "distillate" (string), "confidence" (number 0..1),
"placement" (one of "breakthrough","research-bet","just-execution","discard"),
"novel" (string), "feasible" (string),
"combined_from" (array of objects each {"id": string, "contribution": string}),
"inherited_gap" (object {"ref": string|null, "text": string} or null),
"body" (string).`;

const SYNTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "distillate", "confidence", "placement", "novel", "feasible", "combined_from", "body"],
  properties: {
    title: { type: "string" },
    distillate: { type: "string" },
    confidence: { type: "number" },
    placement: { type: "string", enum: ["breakthrough", "research-bet", "just-execution", "discard"] },
    novel: { type: "string" },
    feasible: { type: "string" },
    combined_from: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "contribution"],
        properties: { id: { type: "string" }, contribution: { type: "string" } } },
    },
    inherited_gap: { type: ["object", "null"], additionalProperties: false,
      properties: { ref: { type: ["string", "null"] }, text: { type: "string" } } },
    body: { type: "string" },
  },
};

// ---- distill: the one settled one-line claim a node has earned ----
const DISTILL_SYSTEM = `You are Weave's distillation partner. A node's distillate is the single settled
one-line claim it has earned — the most compressed TRUE statement its own notes, its
dimensions (facets), and its neighbours support.
You are given: the node (kind, title, body, current_distillate); its facets; its
neighbours — each with "rel" and "dir" ("out" = this node points to it, "in" = it points
to this node); and any inherited blocking gaps.
Write ONE line (max ~25 words). If the node is RESOLVED — the answer has landed — state the
settled claim plainly. If it is UNRESOLVED — options still compete, no answer is chosen, or a
blocking gap is open — phrase the line as an explicit OPEN STATUS naming the unsettled
decision (e.g. "Open: push vs pull delivery is unsettled"), NOT as an imperative or a to-do
(never write "must be defined" / "needs to be").
Always return a numeric confidence in 0..1, calibrated: unresolved/open nodes → 0.30 or below;
reserve above 0.70 for claims corroborated by several neighbours and facets. Never default to
0.5 — commit to a real number.
In grounded_in, name the specific inputs that justify the line (sources like "body",
"facet:<name>", or "node:<id>"). If a blocking gap is inherited and unresolved, do NOT claim
it is solved — state that limitation in caveat. Introduce no facts not present in the inputs.`;

const DISTILL_JSON_HINT = `Return ONLY a single JSON object — no prose, no markdown fences — with exactly these keys:
"distillate" (string), "confidence" (number 0..1),
"grounded_in" (array of objects each {"source": string, "note": string|null}),
"caveat" (string or null).`;

const DISTILL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["distillate", "confidence", "grounded_in"],
  properties: {
    distillate: { type: "string" },
    confidence: { type: "number" },
    grounded_in: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["source"],
        properties: { source: { type: "string" }, note: { type: ["string", "null"] } } },
    },
    caveat: { type: ["string", "null"] },
  },
};

// ---- suggest_kind: infer a node's kind from its title + graph role ----
const SUGGEST_KIND_SYSTEM = `You are Weave's node classifier. Weave has six node kinds, defined by their ROLE
in an argument, not their wording:
- problem: a question or goal to resolve (where the solve side starts)
- hypothesis: a claim that might be true, or an approach you are asserting — something attackable
- solution: the concrete method that realises or answers a hypothesis
- seed: a loose idea with no problem attached yet (where the create side starts)
- synthesis: several ideas fused into one new whole
- gap: a blocker — an external wall that blocks a hypothesis or solution
A node's kind is decided MORE by its role (its edges) than by its title. You are given the
node's title, body, current_kind, and its neighbours — each with "rel" and "dir" ("out" =
this node points to it, "in" = it points to this node).
Rank the 1-2 most likely kinds. Each reason must be VERY SHORT — a fragment of at most ~8
words, NOT a sentence (e.g. "asserted claim, attackable" or "method that answers a problem").
If two kinds are genuinely plausible, include both and pose ONE short disambiguating question
(max ~14 words). Prefer structure over surface phrasing — never call something a solution just
because it is an action phrase, or a gap just because it sounds negative. Order candidates best-first.`;

const SUGGEST_KIND_JSON_HINT = `Return ONLY a JSON object with keys:
"candidates" (array, best first, 1-2 items, each {"kind": one of "problem"|"hypothesis"|"solution"|"seed"|"synthesis"|"gap", "reason": a terse fragment of at most ~8 words, "confidence": number 0..1}),
"question" (one short disambiguating question, max ~14 words, or null if the kind is clear).`;

const SUGGEST_KIND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["kind", "reason"],
        properties: {
          kind: { type: "string", enum: ["problem", "hypothesis", "solution", "seed", "synthesis", "gap"] },
          reason: { type: "string" },
          confidence: { type: ["number", "null"] },
        } },
    },
    question: { type: ["string", "null"] },
  },
};

// Pull a JSON object out of a model reply, tolerating ```json fences / stray prose.
function extractJson(s) {
  if (!s) return null;
  let t = String(s).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

async function callOpenRouter(key, origin, payload) {
  const r = await fetch(OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": origin,
      "X-Title": "Weave",
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function onRequestPost({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const key = env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const model = body.model || env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const origin = new URL(request.url).origin;

  if (body.action === "synthesize") {
    const messages = [
      { role: "system", content: SYNTH_SYSTEM + "\n\n" + SYNTH_JSON_HINT },
      { role: "user", content: JSON.stringify(body.context) },
    ];
    // 1) try strict Structured Outputs; 2) fall back to plain generation if the
    //    model / provider rejects response_format.
    let res = await callOpenRouter(key, origin, {
      model, messages,
      response_format: { type: "json_schema", json_schema: { name: "synthesis", strict: true, schema: SYNTH_SCHEMA } },
    });
    if (!res.ok) res = await callOpenRouter(key, origin, { model, messages });
    if (!res.ok) return Response.json({ error: res.data.error || "openrouter error", detail: res.data }, { status: res.status });

    const content = res.data.choices?.[0]?.message?.content ?? "";
    const proposal = extractJson(content);
    if (!proposal) return Response.json({ error: "model did not return valid JSON", raw: content }, { status: 502 });
    // guardrail: combined_from must be a subset of the given seed ids
    const seedIds = new Set((body.context?.seeds || []).map((s) => s.id));
    proposal.combined_from = (proposal.combined_from || []).filter((c) => seedIds.has(c.id));
    return Response.json({ proposal });
  }

  if (body.action === "distill") {
    const messages = [
      { role: "system", content: DISTILL_SYSTEM + "\n\n" + DISTILL_JSON_HINT },
      { role: "user", content: JSON.stringify(body.context) },
    ];
    let res = await callOpenRouter(key, origin, {
      model, messages,
      response_format: { type: "json_schema", json_schema: { name: "distillate", strict: true, schema: DISTILL_SCHEMA } },
    });
    if (!res.ok) res = await callOpenRouter(key, origin, { model, messages });
    if (!res.ok) return Response.json({ error: res.data.error || "openrouter error", detail: res.data }, { status: res.status });
    const content = res.data.choices?.[0]?.message?.content ?? "";
    const proposal = extractJson(content);
    if (!proposal) return Response.json({ error: "model did not return valid JSON", raw: content }, { status: 502 });
    return Response.json({ proposal });
  }

  if (body.action === "suggest_kind") {
    const messages = [
      { role: "system", content: SUGGEST_KIND_SYSTEM + "\n\n" + SUGGEST_KIND_JSON_HINT },
      { role: "user", content: JSON.stringify(body.context) },
    ];
    let res = await callOpenRouter(key, origin, {
      model, messages,
      response_format: { type: "json_schema", json_schema: { name: "kind", strict: true, schema: SUGGEST_KIND_SCHEMA } },
    });
    if (!res.ok) res = await callOpenRouter(key, origin, { model, messages });
    if (!res.ok) return Response.json({ error: res.data.error || "openrouter error", detail: res.data }, { status: res.status });
    const content = res.data.choices?.[0]?.message?.content ?? "";
    const out = extractJson(content);
    if (!out || !Array.isArray(out.candidates)) return Response.json({ error: "model did not return valid JSON", raw: content }, { status: 502 });
    return Response.json(out);
  }

  // chat / composer: relay the thread, keep replies short and vector-aware
  const res = await callOpenRouter(key, origin, {
    model,
    messages: body.messages || [
      { role: "system", content: "You are Weave, a concise thinking partner. Reply in 1-3 sentences that tighten a constraint or open a direction." },
    ],
  });
  if (!res.ok) return Response.json({ error: res.data.error || "openrouter error", detail: res.data }, { status: res.status });
  return Response.json({ reply: res.data.choices?.[0]?.message?.content ?? "" });
}
