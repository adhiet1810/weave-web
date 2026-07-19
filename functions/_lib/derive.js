// Weave graph derivation — the JS port of weave-core::derive / validate.py.
// Given raw D1 rows (nodes, facets, edges, captures) it returns the same graph
// shape the frontend consumes: folded idea-layer, effective lean, couplings, scout.

export const REL = {
  decomposes: { plane: "structural", vector: "solve", directed: true },
  answers:    { plane: "structural", vector: "solve", directed: true },
  blocks:     { plane: "structural", vector: "solve", directed: true },
  sparks:     { plane: "structural", vector: "create", directed: true },
  combines:   { plane: "structural", vector: "create", directed: true },
  refines:    { plane: "structural", vector: "neutral", directed: true },
  contains:   { plane: "structural", vector: "neutral", directed: true },
  shares:     { plane: "dimensional", vector: "neutral", directed: false },
  drives:     { plane: "dimensional", vector: "solve", directed: true },
  "depends-on": { plane: "dimensional", vector: "neutral", directed: true },
  constrains: { plane: "dimensional", vector: "solve", directed: true },
};
const GENERATIVE = new Set(["decomposes", "answers", "combines", "sparks", "refines"]);
export const KINDS = ["problem", "hypothesis", "solution", "seed", "synthesis", "gap"];
const KINDSET = new Set(KINDS);

export function derive(nodeRows, facetRows, edgeRows, captureRows) {
  const facetsByNode = {};
  for (const f of facetRows) {
    (facetsByNode[f.node_id] ||= []).push({
      name: f.name, semantic: f.semantic,
      distillate: f.distillate ?? null,
      confidence: f.confidence ?? null,
    });
  }
  const facetSet = new Set(facetRows.map((f) => `${f.node_id}#${f.name}`));
  const byId = new Map(nodeRows.map((n) => [n.id, n]));

  // resolve edges into structural / dimensional
  const structural = [], dimensional = [];
  for (const e of edgeRows) {
    const rt = REL[e.rel];
    if (!rt) continue;
    if (rt.plane === "structural") {
      structural.push({ src: e.src, to: e.to_id, rel: e.rel, vector: rt.vector, note: e.note ?? null });
    } else {
      dimensional.push({
        src: e.src, from: e.from_facet ?? null,
        to_id: e.to_id, to_facet: e.to_facet ?? null,
        rel: e.rel, note: e.note ?? null,
      });
    }
  }

  const ideas = nodeRows.filter((n) => KINDSET.has(n.kind));
  const ideaIds = new Set(ideas.map((n) => n.id));

  // effective lean: base (lean|region) then propagate explicit leans along generative edges
  const eff = {};
  for (const n of ideas) eff[n.id] = n.lean && n.lean !== "inherit" ? n.lean : n.region;
  const genChildren = {};
  for (const e of structural) {
    if (GENERATIVE.has(e.rel) && ideaIds.has(e.src) && ideaIds.has(e.to)) {
      (genChildren[e.src] ||= []).push(e.to);
    }
  }
  for (const n of ideas) {
    if (n.lean && n.lean !== "inherit") {
      const q = [...(genChildren[n.id] || [])];
      while (q.length) {
        const c = q.shift();
        const child = byId.get(c);
        if (child && (!child.lean || child.lean === "inherit") && eff[c] !== n.lean) {
          eff[c] = n.lean;
          q.push(...(genChildren[c] || []));
        }
      }
    }
  }

  // fold dimensional edges by unordered parent-pair
  const foldMap = new Map();
  for (const e of dimensional) {
    const pair = [e.src, e.to_id].sort();
    const key = pair.join("");
    const cur = foldMap.get(key) || { a: pair[0], b: pair[1], count: 0, note: e.note };
    cur.count++;
    foldMap.set(key, cur);
  }
  const folds = [...foldMap.values()];

  // couplings: same-namespace facet across nodes; wired iff a shares edge joins them
  const byFacet = {};
  for (const f of facetRows) (byFacet[f.name] ||= new Set()).add(f.node_id);
  const shares = new Set(
    dimensional.filter((e) => e.rel === "shares").map((e) => [e.src, e.to_id].sort().join(""))
  );
  const couplings = [];
  for (const [facet, ids] of Object.entries(byFacet)) {
    const arr = [...ids].sort();
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        couplings.push({ facet, a: arr[i], b: arr[j], wired: shares.has([arr[i], arr[j]].sort().join("")) });
  }

  // scout: a solution with an incoming answers and an incoming blocks
  const scout = [];
  for (const n of ideas) {
    if (n.kind === "solution") {
      const answered = structural.some((e) => e.rel === "answers" && e.to === n.id);
      const blocked = structural.some((e) => e.rel === "blocks" && e.to === n.id);
      if (answered && blocked) scout.push(n.id);
    }
  }

  const nodes = ideas.map((n) => ({
    id: n.id, kind: n.kind, region: n.region,
    lean: eff[n.id] || n.region, state: n.state,
    title: n.title || n.id, freeform: n.state === "freeform",
    distillate: n.distillate_text ?? null,
    confidence: n.distillate_confidence ?? null,
    facets: facetsByNode[n.id] || [],
    body: n.body || "",
  }));

  const captures = (captureRows || []).map((c) => ({ id: c.id, t: c.text }));

  return { nodes, structural, dimensional, folds, couplings, scout, captures, errors: [] };
}
