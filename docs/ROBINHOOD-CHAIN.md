# Loxley × Robinhood Chain — following the official docs

How Loxley aligns with each page of the Robinhood Chain developer docs
(docs.robinhood.com/chain), with evidence.

## 1. Deploy smart contracts ✅

Per the docs: Foundry workflow, testnet-first, throwaway deployer keys via
env vars, Blockscout verification.

- Deployed testnet-first (chainId 46630) with a throwaway key kept in
  gitignored `.secrets/` — never hardcoded, never committed.
- **All contracts source-verified on Blockscout** with the documented
  `forge verify-contract … --verifier blockscout --verifier-url
  https://explorer.testnet.chain.robinhood.com/api/` flow:
  factory, router, MerryMenShare, LOX, BowStaking, WETH, and the three
  demo tokens. Browse any address on
  [the explorer](https://explorer.testnet.chain.robinhood.com/address/0xc1B3d94b980F83De0909cf7BB7da833aCfC56720?tab=contract)
  and read the source.
- Orbit-specific lesson encoded in `scripts/deploy-testnet.sh`: the L1
  data-fee component of gas moves with Ethereum's base fee, so broadcasts
  use `--gas-estimate-multiplier 200` headroom.

## 2. Building with stock tokens ✅ (v1 ready, UI polish on roadmap)

Stock tokens are ERC-20 (18 decimals) + the **ERC-8056 Scaled UI Amount**
extension: corporate actions (splits, stock dividends) update a
`uiMultiplier`; **raw balances never rebase**.

That design composes perfectly with a constant-product AMM, and we prove it:

- [`MockStockToken.sol`](../contracts/src/mocks/MockStockToken.sol)
  implements the extension (`uiMultiplier`, `balanceOfUI`, `totalSupplyUI`,
  `UIMultiplierUpdated`).
- [`StockTokenHoard.t.sol`](../contracts/test/StockTokenHoard.t.sol) proves:
  - stock tokens trade in Hoards like any ERC-20;
  - a 2:1 split leaves raw reserves, K, LP supply, and swap quotes
    **bit-for-bit unchanged** while `balanceOfUI` correctly doubles;
  - swaps execute normally after a corporate action.

**Design stance:** the AMM operates on raw amounts (the standard's intent);
share-denominated display belongs in the UI layer. Roadmap (M3/M4):
render `balanceOfUI` for stock-token balances and label prices per
underlying share.

## 3. Oracles & price feeds ✅ stance documented, integration on roadmap

Chainlink is the chain's oracle layer; stock-token feeds are 8-decimal USD,
24/5 per market hours.

- The AMM itself needs no oracle (prices are pool-implied), and the demo
  analytics use a stable-anchored pool oracle — appropriate for demo tokens.
- For stock-token pairs, roadmap M4 integrates the documented
  `AggregatorV3Interface` pattern (with `updatedAt`/heartbeat freshness
  checks) for: USD display prices, price-impact warnings vs. the official
  feed, and out-of-hours staleness banners for 24/5 feeds.
- Per the docs' explicit instruction, feed addresses are **not hardcoded**
  anywhere; they'll be read from Chainlink's published Robinhood Chain
  feed list at integration time.

## 4. Cross-chain messaging ✅ not applicable by design, stance documented

Robinhood Chain's cross-chain layer is the native Arbitrum Nitro messaging
(retryable tickets L1→L2, ArbSys + 7-day challenge L2→L1), with the
canonical bridge on top.

Loxley v1 is deliberately single-chain: assets arrive on Robinhood Chain
via the canonical bridge, then trade in Hoards. No custom messaging
contracts means no custom bridge risk — aligned with the docs'
recommendation to use the Arbitrum SDK rather than hand-rolled messaging
if/when a cross-chain feature (e.g. remote LP onboarding) ever justifies it.
