// proof-carrying-models · attest.mjs — THE VERDICT LAW (reference implementation).
//
// The runnable heart of the disclosure: a model artifact that can PROVE its own history.
// Three mechanisms, all deterministic:
//
//   · STEP ID — every training step {parent, data, note} hashes to a stable id over a
//               canonical serialization (key order cannot change the id).
//   · CHAIN   — a lineage is valid only if it BEGINS AT NULL (a chain that starts mid-air
//               hides something) and every step's parent equals the id of the step before.
//               The first break is named by index.
//   · ATTEST  — the anti-theatre rule: an eval claim COUNTS only if it names the chain
//               head it actually evaluated AND carries a reproducible digest. A claim
//               without a digest is not evidence and not an error — it is NOTHING, and it
//               is listed as ignored with its reason. The tier is DERIVED from what
//               counts, never read from the input: lineaged → evaluated (1–2 counting
//               evals) → proven (≥3 counting evals with mean score ≥ κ). Quantity is not
//               quality: three weak evals stay 'evaluated'.
//
// Pure and total: bad input → { ok:false, why }, never a throw mid-verdict.

export const KAPPA = 0.618;

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
const str = (v) => typeof v === 'string' && v.length > 0;
const num01 = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
const round3 = (x) => Math.round(x * 1000) / 1000;

// canonical serialization: object keys sorted at every depth, so id depends on CONTENT only
const canon = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
};

// FNV-1a 64-bit over the canonical form, hex — small, dependency-free, deterministic
const fnv = (s) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, '0');
};

/** STEP ID — the stable identity of one training step. A step carries EXACTLY
 *  { parent, data, note? } — any other field refuses BY NAME: what the hash does not cover,
 *  the chain cannot vouch for, and an unhashed field is a smuggling channel. */
export function stepId(step) {
  const s = obj(step);
  if (!s) return { ok: false, why: 'a step must be an object' };
  for (const k of Object.keys(s)) if (k !== 'parent' && k !== 'data' && k !== 'note')
    return { ok: false, why: `unknown field on a step: "${k}" — what the hash does not cover, the chain cannot vouch for` };
  if (!(s.parent === null || str(s.parent))) return { ok: false, why: 'parent must be a step id, or null for the first step' };
  if (!str(s.data)) return { ok: false, why: 'data digest required — a step that cannot say what it trained on is not a step' };
  return { ok: true, id: fnv(canon({ parent: s.parent, data: s.data, note: typeof s.note === 'string' ? s.note : '' })) };
}

/** CHAIN — validate a lineage. Returns the head id and depth, or names the first break. */
export function chainValid(steps) {
  if (!Array.isArray(steps)) return { ok: false, why: 'lineage must be a list of steps' };
  if (steps.length === 0) return { ok: false, why: 'no lineage — an artifact with no history proves nothing' };
  let prev = null;
  for (let i = 0; i < steps.length; i++) {
    const id = stepId(steps[i]);
    if (!id.ok) return { ok: false, why: `step ${i}: ${id.why}` };
    if (i === 0 && steps[0].parent !== null) return { ok: false, why: 'step 0: a lineage begins at null, or it hides something' };
    if (i > 0 && steps[i].parent !== prev) return { ok: false, why: `step ${i}: parent does not match the step before — the chain breaks here` };
    prev = id.id;
  }
  return { ok: true, head: prev, depth: steps.length };
}

/**
 * ATTEST — the verdict on a model artifact. evals = [{ name, head, score, digest }].
 * Counting rules (each miss is IGNORED and listed, never fatal):
 *   head must equal the chain head · digest must be a non-empty string · score must be in [0,1].
 * Tier, derived only: 'lineaged' (0 counting) · 'evaluated' (1–2, or ≥3 with mean < κ)
 * · 'proven' (≥3 counting AND round3(mean) ≥ κ). Any tier field on the INPUT is ignored.
 */
export function attest(steps, evals) {
  const chain = chainValid(steps);
  if (!chain.ok) return { ok: false, why: chain.why };
  if (!Array.isArray(evals)) return { ok: false, why: 'evals must be a list (empty is honest)' };
  const verified = [], ignored = [];
  for (const e of evals) {
    const v = obj(e);
    const name = v && str(v.name) ? v.name : '(unnamed)';
    if (!v) { ignored.push({ name, why: 'not an object' }); continue; }
    if (v.head !== chain.head) { ignored.push({ name, why: 'evaluated a different artifact — head does not match the lineage' }); continue; }
    if (!str(v.digest)) { ignored.push({ name, why: 'no reproducible digest — a claim without one is not evidence' }); continue; }
    if (!num01(v.score)) { ignored.push({ name, why: 'score must be a number in [0,1]' }); continue; }
    verified.push({ name, score: v.score, digest: v.digest });
  }
  let tier = 'lineaged';
  if (verified.length >= 1) tier = 'evaluated';
  if (verified.length >= 3) {
    const mean = round3(verified.reduce((a, e) => a + e.score, 0) / verified.length);
    if (mean >= KAPPA) tier = 'proven';
  }
  return { ok: true, tier, head: chain.head, depth: chain.depth, verified, ignored };
}
