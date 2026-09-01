# Proof-Carrying Models

**LIVE: https://sjgant80-hub.github.io/proof-carrying-models/**

> **DEFENSIVE PUBLICATION.** This document is published to establish prior art. Every mechanism
> described here is placed irrevocably in the public domain (CC0-1.0) so that no party may
> enclose it by patent. The first commit timestamp of this repository anchors the disclosure
> date.

## Abstract

A model artifact that can **prove its own history**: what it was trained on, in what order,
and which evaluation claims about it are evidence rather than theatre. The mechanism is three
small laws — a content-addressed step identity, a lineage chain that must begin at null, and a
verdict that counts only reproducible claims — with the deciding property that **the tier is
derived, never declared**. An artifact claiming "proven" gets what it earned, and nothing on
the artifact can say otherwise.

This is the estate's trust rail (proof-of-play: no listing without a reproducible,
un-forgeable pass) pointed at machine-learning artifacts.

## 1) Step identity (`stepId`)

A training step is exactly `{ parent, data, note? }` — the digest of what it trained on,
chained to its parent. The id is a hash over a **canonical serialization** (sorted keys), so
identity depends on content, never on serialization luck. Two rules with teeth:

- **A step carries exactly those fields.** Any other field refuses *by name*: what the hash
  does not cover, the chain cannot vouch for — an unhashed field is a smuggling channel that
  would let two different artifacts share an identity.
- **The hash is frozen** and pinned by test (`082de292707b71a5` for the canonical example) —
  changing the canonicalisation orphans every existing lineage, so the suite makes that loud.

## 2) The lineage (`chainValid`)

- A lineage **begins at null, or it hides something** — a chain that starts mid-air is
  refused, because "fine-tuned from something we won't name" is exactly the provenance hole
  this closes.
- Every step's `parent` must equal the id of the step before; the first break is named by
  index. Tampering with any early step changes its id and severs everything after it —
  proven by fuzz over 200 random chains with single-field tampers.

## 3) The verdict (`attest`) — the anti-theatre rule

An evaluation claim `{ name, head, score, digest }` **counts** only if:

- `head` equals the lineage head — it evaluated *this* artifact, not a cousin;
- `digest` is present — the run is reproducible;
- `score` is in [0,1].

A claim failing any test is **ignored and listed with its reason** — not an error, just
nothing. Then the tier is derived: valid chain → `lineaged`; 1–2 counting evals →
`evaluated`; ≥3 counting evals with mean ≥ κ (0.618) → `proven`. Three weak evals stay
`evaluated`: **quantity is not quality.**

## Why this matters now

Model cards, eval leaderboards, and provenance statements are today **assertions** — the
reader trusts the publisher. Regulation (the EU AI Act's training-data transparency duties
among others) is about to demand what only a mechanism can honestly supply. The mechanism
disclosed here makes the claims *checkable arithmetic*: anyone holding the artifact and its
chain can re-derive the tier. The estate runs the same pattern in production over 90+ repos:
tiers computed from what CI actually ran, never set by hand
([the-ladder](https://github.com/sjgant80-hub/fallworld)).

## What already runs (gated, live, today)

| organ | what it proves | gate |
|---|---|---|
| [`attest.mjs`](attest.mjs) (this repo) | identity, lineage, verdict | 35/36 killed + 1 argued equivalent |
| [proven-web](https://github.com/sjgant80-hub/proven-web) | signed, expiring verdicts derived from evidence | witness-gated |
| [fallineage](https://github.com/sjgant80-hub/fallineage) | Ed25519 provenance chains | live |
| [kcc-mint](https://github.com/sjgant80-hub/kcc-mint) | provenance minting at estate scale (1,410 repos) | live |
| [acg-assessor](https://github.com/sjgant80-hub/acg-assessor) | a rubric that passes its own rubric | witness-gated |

## What must catch up (the honest speculation)

- **Signing at training time**: the reference law hashes and chains; production needs the
  training loop itself to emit signed steps (Ed25519 exists in the estate; wiring it into
  major training frameworks does not).
- **Eval digest standards**: "reproducible digest" is a field here; an ecosystem convention
  for what it digests (harness + dataset + seed) does not yet exist.
- **What is NOT claimed**: this does not verify that a digest is *honest*, only that a claim
  without one is *nothing* — the gate moves dishonesty from cheap assertion to forgeable
  artifact, where existing cryptographic machinery applies.

## Claims anticipated (the patent surface this blocks)

Any claim covering: content-addressed training-step identity with closed field sets;
lineage chains for model artifacts required to originate at a null parent; refusal-by-name of
undeclared step metadata; evaluation claims gated on artifact-head match and reproducibility
digests; tier or certification levels for AI models **derived** from counting verified
evidence rather than declared; or embedding such attestations so the artifact carries its own
proof. Prior art here, dated by first commit.

## Run the reference law

```bash
node --test          # 7 suites: frozen ids, the null origin, tamper fuzz, the anti-theatre rule
```

The live page carries the same gated kernel inline: build a lineage, tamper with it, file
eval claims with and without digests, and watch the verdict derive.

---

*Built on the Konomi architecture, created by **Thomas Frumkin** (konomi-systems.com). The estate builds WITH Konomi. Published CC0-1.0; see LICENSE.*
