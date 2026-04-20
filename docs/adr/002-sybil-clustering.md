# ADR 002: Sybil Clustering via Funder-Graph Tracing

## Status

Accepted — shipped in Niya Tools v1.

## Context

Top-10 holder concentration is the canonical first-look signal for rug risk, but on its own it is noisy. One genuine whale holding 30% looks identical to ten coordinated sybil wallets collectively holding 30%. The two situations imply very different risks: a unified position is transparent and can be modeled; a coordinated cluster is designed to *look* decentralized while being controlled by one party that can dump in lockstep.

Moralis exposes individual holder balances but nothing on-chain explicitly labels a sybil cluster. We needed a heuristic that could surface likely coordination without introducing a heavy ML pipeline.

## Decision

Implement a 2-hop funder-graph trace over the top holders and flag any group of wallets that share an ancestor funder.

- **Hop 1.** For each top-10 holder that is not a contract and not in the known-contracts registry, fetch the address that funded it (first inbound native transfer). If two or more top holders share the same direct funder, a cluster is detected.
- **Hop 2.** If no cluster emerges at hop 1, fetch the funder-of-funder for each unique hop-1 funder. If two or more top holders share a common grandparent funder, a cluster is detected. This catches the common pattern `master wallet → intermediary → end holder`.

Both hops are implemented in `src/features/nylaTools/microstructure.ts` — see `detectClusters` (hop 1 starting around line 482, hop 2 starting around line 527) and the `findBestCluster` helper around line 440. Funder lookups go through `moralis.fetchWalletFunder`. When a cluster is detected the result contributes to `rugRiskScore` with weight tied to the cluster's combined share of supply.

Known-contract addresses (burn, exchange custody, LP lockers, launchpad contracts, staking pools, bridges) are excluded from clustering because their shared funders are structural, not coordinated. The hand-curated registry lives at `src/features/nylaTools/knownContracts.ts` (~30 BSC addresses at the time of writing).

Per-scan clustering cost is bounded by the top-10 size at hop 1 plus at most ten hop-2 lookups, so roughly 10–20 extra Moralis calls per cold scan. Microstructure results are cached for ten minutes in `nylaMicrostructureCache` so repeat views of the same token don't pay that cost again.

## Consequences

**Better.** We surface coordinated clusters that pure concentration metrics miss — the dominant new signal in the rug-risk panel. The heuristic is transparent and debuggable: every contributing cluster is logged with the funder address and combined share.

**Worse.** Added latency on cold scans from the fan-out of funder lookups. False positives are possible when two unrelated users happen to be funded by the same popular on-ramp or shared deposit address; the known-contracts registry mitigates this but needs manual maintenance as new exchanges and lockers appear.

**Uncertain.** The 2-hop depth was chosen pragmatically — deeper tracing would catch more sophisticated laundering but quickly blows up the call budget. Future work: replace the shared-ancestor heuristic with a classifier trained on cluster features (funder fan-in, temporal proximity of funding transactions, shared contract interactions).
