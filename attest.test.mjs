// attest.test.mjs — the verdict law, falsifiable. The load-bearing properties: identity depends on
// content not key order, a chain that starts mid-air refuses, a digest-less eval is NOTHING (listed,
// never counted), and the tier is DERIVED — an input claiming 'proven' gets what it earned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KAPPA, stepId, chainValid, attest } from './attest.mjs';

const chainOf = (n) => {
  const steps = [];
  let parent = null;
  for (let i = 0; i < n; i++) {
    steps.push({ parent, data: 'sha256:data' + i });
    parent = stepId(steps[i]).id;
  }
  return steps;
};

test('STEP ID — content-addressed: key order cannot change the id, content must', () => {
  const a = stepId({ parent: null, data: 'sha256:x', note: 'warmup' });
  const b = stepId({ note: 'warmup', data: 'sha256:x', parent: null });
  assert.equal(a.id, b.id, 'the id is of the CONTENT, not the serialization luck');
  assert.match(a.id, /^[0-9a-f]{16}$/);
  const c = stepId({ parent: null, data: 'sha256:y', note: 'warmup' });
  assert.notEqual(a.id, c.id, 'different data, different step');
  assert.equal(stepId({ parent: null, data: 'sha256:x' }).id, stepId({ parent: null, data: 'sha256:x', note: '' }).id, 'no note = empty note');
  assert.match(stepId(null).why, /must be an object/);
  assert.match(stepId(7).why, /must be an object/, 'a primitive refuses as itself');
  assert.match(stepId([]).why, /must be an object/, 'an array refuses as itself');
  assert.match(stepId({ parent: 7, data: 'x' }).why, /parent must be/);
  assert.match(stepId({ parent: null, data: '' }).why, /cannot say what it trained on/);
  // the id is PINNED: provenance ids must be stable across versions, or every old chain breaks
  assert.equal(stepId({ parent: null, data: 'sha256:x' }).id, '082de292707b71a5', 'the canonical hash is frozen — changing it orphans every existing lineage');
});

test('CHAIN — begins at null or it hides something; each break named by index', () => {
  const good = chainOf(3);
  const v = chainValid(good);
  assert.ok(v.ok);
  assert.equal(v.depth, 3);
  assert.equal(v.head, stepId(good[2]).id, 'the head is the last step id');
  assert.match(chainValid([{ parent: 'deadbeef', data: 'x' }]).why, /begins at null/);
  const broken = chainOf(3);
  broken[2] = { ...broken[2], parent: 'deadbeefdeadbeef' };
  assert.match(chainValid(broken).why, /step 2: parent does not match/);
  assert.match(chainValid([]).why, /no lineage/);
  assert.match(chainValid('x').why, /must be a list/);
  assert.match(chainValid([{ parent: null, data: '' }]).why, /step 0/);
});

test('CHAIN — tampering with an early step invalidates everything after it', () => {
  const steps = chainOf(4);
  steps[1] = { ...steps[1], data: 'sha256:TAMPERED' };
  const v = chainValid(steps);
  assert.equal(v.ok, false);
  assert.match(v.why, /step 2/, 'the tamper at 1 changes its id, so 2 no longer chains');
});

test('ATTEST — the anti-theatre rule: digest-less and wrong-head evals are IGNORED with reasons', () => {
  const steps = chainOf(2);
  const head = chainValid(steps).head;
  const r = attest(steps, [
    { name: 'mmlu', head, score: 0.8, digest: 'sha256:run1' },
    { name: 'braggart', head, score: 0.99 },                          // no digest → nothing
    { name: 'stale', head: 'deadbeefdeadbeef', score: 0.9, digest: 'sha256:run2' }, // wrong artifact
    { name: 'sloppy', head, score: 1.7, digest: 'sha256:run3' },      // impossible score
  ]);
  assert.equal(r.verified.length, 1);
  assert.equal(r.verified[0].name, 'mmlu');
  assert.deepEqual(r.ignored.map((i) => i.name), ['braggart', 'stale', 'sloppy']);
  assert.match(r.ignored[0].why, /not evidence/);
  assert.match(r.ignored[1].why, /different artifact/);
  assert.match(r.ignored[2].why, /\[0,1\]/);
  assert.equal(r.tier, 'evaluated', 'one counting eval');
});

test('ATTEST — the tier ladder is derived, never read: lineaged → evaluated → proven', () => {
  const steps = chainOf(2);
  const head = chainValid(steps).head;
  const ev = (score, i) => ({ name: 'e' + i, head, score, digest: 'sha256:' + i });
  assert.equal(attest(steps, []).tier, 'lineaged', 'a valid chain with no evidence is lineaged, honestly');
  assert.equal(attest(steps, [ev(0.9, 1)]).tier, 'evaluated');
  assert.equal(attest(steps, [ev(0.9, 1), ev(0.9, 2)]).tier, 'evaluated', 'two is not yet proven');
  assert.equal(attest(steps, [ev(0.618, 1), ev(0.618, 2), ev(0.618, 3)]).tier, 'proven', 'three at mean exactly κ');
  assert.equal(attest(steps, [ev(0.617, 1), ev(0.617, 2), ev(0.617, 3)]).tier, 'evaluated', 'quantity is not quality — mean below κ stays evaluated');
  // the score boundaries are inclusive: 0 and 1 are both real, countable results
  const edges = attest(steps, [ev(0, 1), ev(1, 2)]);
  assert.equal(edges.verified.length, 2, 'a zero score and a perfect score both COUNT — only the undigested is nothing');
  assert.equal(KAPPA, 0.618);
  // an input that CLAIMS a tier gets refused outright — the smuggling channel is closed:
  // a field the hash does not cover would let two different steps share an id
  const withClaim = attest(steps.map((s) => ({ ...s, tier: 'proven' })), []);
  assert.equal(withClaim.ok, false);
  assert.match(withClaim.why, /unknown field on a step: "tier"/, 'the claim is named and refused, never silently unhashed');
});

test('ATTEST — refusals and totality', () => {
  assert.match(attest([], []).why, /no lineage/);
  assert.match(attest(chainOf(1), 'x').why, /evals must be a list/);
  const r = attest(chainOf(1), [null, 7, 'x']);
  assert.equal(r.verified.length, 0);
  assert.equal(r.ignored.length, 3, 'junk evals are ignored one by one, never fatal');
  for (const junk of [null, 7, 'x', [{}], [{ parent: null }]]) {
    assert.equal(typeof chainValid(junk).ok, 'boolean', 'answers, never throws');
  }
});

test('THE FUZZ — 200 random chains: valid ones verify, any single-field tamper breaks them', () => {
  let seed = 99;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(rnd() * 6);
    const steps = [];
    let parent = null;
    for (let i = 0; i < n; i++) {
      steps.push({ parent, data: 'sha256:' + Math.floor(rnd() * 1e9), note: rnd() > 0.5 ? 'n' + t : '' });
      parent = stepId(steps[i]).id;
    }
    assert.ok(chainValid(steps).ok, 'an honestly built chain always validates');
    if (n > 1) {
      const i = Math.floor(rnd() * (n - 1));
      const tampered = steps.map((s, j) => j === i ? { ...s, data: s.data + 'X' } : s);
      assert.equal(chainValid(tampered).ok, false, 'any tamper anywhere breaks the chain');
    }
  }
});
