// POST /api/ai — server-side OpenRouter proxy. The API key stays here, never in
// the browser. Implements two actions from weave-ai-actions.md:
//   { action: "chat", messages: [...] }         -> a thread reply (text)
//   { action: "synthesize", context: {...} }    -> a structured synthesis proposal
import { requireAuth } from "../_lib/auth.js";

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

const SYNTH_SYSTEM = `You are Weave's synthesis partner. Weave is a reasoning graph of typed nodes.
The create vector is divergent: a synthesis fuses several seeds into one novel whole.
Combine the given seeds — and ONLY those — into a single synthesis. Cite which seed
contributes what. Place it honestly on the novel x feasible frame; never dress a
research bet as a breakthrough. Surface any constraint it INHERITS from its parents or
their couplings; do not hide it. Introduce no facts not derivable from the inputs.
Return ONLY the structured object.`;

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

export async function onRequestPost({ env, request }) {
  const auth = requireAuth(request, env);
  if (auth) return auth;
  const key = env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const model = body.model || env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

  let payload;
  if (body.action === "synthesize") {
    payload = {
      model,
      messages: [
        { role: "system", content: SYNTH_SYSTEM },
        { role: "user", content: JSON.stringify(body.context) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "synthesis", strict: true, schema: SYNTH_SCHEMA } },
    };
  } else {
    // chat / composer: relay the thread, keep replies short and vector-aware
    payload = {
      model,
      messages: body.messages || [
        { role: "system", content: "You are Weave, a concise thinking partner. Reply in 1-3 sentences that tighten a constraint or open a direction." },
      ],
    };
  }

  const r = await fetch(OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": new URL(request.url).origin,
      "X-Title": "Weave",
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) return Response.json({ error: data.error || "openrouter error", detail: data }, { status: r.status });

  const content = data.choices?.[0]?.message?.content ?? "";
  if (body.action === "synthesize") {
    let proposal;
    try { proposal = JSON.parse(content); } catch { return Response.json({ error: "model did not return valid JSON", raw: content }, { status: 502 }); }
    // guardrail: combined_from must be a subset of the given seed ids
    const seedIds = new Set((body.context?.seeds || []).map((s) => s.id));
    proposal.combined_from = (proposal.combined_from || []).filter((c) => seedIds.has(c.id));
    return Response.json({ proposal });
  }
  return Response.json({ reply: content });
}
