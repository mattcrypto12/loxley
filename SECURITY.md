# Loxley Security

**Status: UNAUDITED. Testnet and demonstration use only.**

There is no such thing as a guarantee of "no vulnerabilities" — anyone
claiming one is wrong. Loxley's approach is layered assurance: each layer
catches what the previous one can't, and the residual risk is documented
rather than hidden.

## Assurance layers

| Layer | Status |
| --- | --- |
| Battle-tested design (Uniswap v2 core, unmodified money math) | ✅ by construction |
| Solidity 0.8 checked arithmetic + reentrancy `lock` on the pair | ✅ |
| Unit + fuzz tests on every money path | ✅ 47 tests (incl. fuzzed K-invariant, stock-token corporate actions) |
| **Invariant testing** (randomized action sequences, multi-actor) | ✅ 6 invariants, ~128k calls/run: pair solvency, K-monotonicity outside burns, uint112 bounds, locked MINIMUM_LIQUIDITY, quotes can't drain reserves, treasury `reserved ≤ balance` |
| **Static analysis** (Slither) | ✅ run + triaged below; one real finding fixed |
| External audit | ❌ **not done — the main grant ask** |
| Bug bounty (Immunefi) | ❌ planned post-audit, pre-mainnet-scale |
| Staged mainnet rollout (caps, monitoring, timelocked admin) | ❌ planned at launch |

## Slither triage (full honesty)

Real finding, **fixed**:

- **`finalizeEpoch` accepted arbitrary reward tokens.** Finalize is
  permissionless; an attacker could pass a token that lies about
  `balanceOf` and reverts on `transfer`, bricking `claim()` for an entire
  epoch (griefing/DoS, not theft), or stuff the token list to inflate claim
  gas. Fix: reward tokens must be genuine Hoard LP tokens, cross-checked
  against the factory registry (`_isHoard`), and the per-epoch token list
  is capped at 16. Regression tests: `test_finalize_rejectsNonHoardTokens`,
  `test_finalize_rejectsUnregisteredHoardLookalike`,
  `test_finalize_capsTokenListLength`.

Inherited-from-v2 patterns, intentionally kept (false positives for this
design, same shape as Uniswap v2 itself):

- `weak-prng` — `block.timestamp % 2**32` is the TWAP accumulator's
  documented timestamp truncation, not randomness.
- `divide-before-multiply` — UQ112x112 fixed-point encoding in the price
  accumulators; precision behavior identical to v2.
- `reentrancy-*` on the pair — all pair entry points are behind the
  `lock` mutex; state is settled before external calls where it matters.
  The remaining flag is the well-known read-only-reentrancy *class*:
  integrators must not read `getReserves()` inside a token callback.
- `incorrect-equality` (`totalSupply == 0`, `data.length == 0`) — v2's
  first-mint branch and missing-return-value ERC-20 handling; intended.
- `timestamp` — epochs and deadlines are timestamp-based by design;
  sequencer timestamp drift of seconds is immaterial at 7-day granularity.
- `unchecked-transfer` in `removeLiquidity` — the transferred token is the
  pair's own LP token, whose `transferFrom` reverts on failure.
- `calls-loop` in `claim` — bounded by the 16-token cap and the Hoard-only
  allowlist above.

## Known limitations (documented, not hidden)

1. **Fee-on-transfer / rebasing tokens are unsupported.** Plain v2 router
   semantics: swaps of fee-on-transfer tokens revert on the K check (funds
   safe, trade fails). The `SupportingFeeOnTransferTokens` router variants
   were deliberately not ported to keep the audit surface small. Robinhood
   Chain stock tokens (ERC-8056) do **not** rebase raw balances and are
   unaffected — proven in `StockTokenHoard.t.sol`.
2. **The wealth threshold is sybil-gameable.** Splitting funds across
   wallets defeats the "small wallet" check; per-epoch point caps only
   blunt it. This is documented v1 simplicity; roadmap M3 replaces it.
3. **Pool-implied prices are manipulable within a block.** The UI's USD
   figures are informational. Anything that needs a robust price must use
   the TWAP accumulators or Chainlink feeds — never spot reserves.
4. **Admin keys.** `feeToSetter`, treasury owner, and LOX owner are EOAs
   pre-launch. Mainnet plan: timelock + multisig, then progressive
   renouncement.
5. **The deployed testnet instance (46630) predates the `_isHoard` fix**
   and will be redeployed; testnet funds are valueless by definition.

## The path to "as close to guaranteed as this industry gets"

1. External audit of `core/` + `MerryMenShare` (the only novel logic).
   Scope is small by design: ~600 lines of consequential code.
2. Public bug bounty with meaningful rewards before meaningful TVL.
3. Mainnet soft-launch: seeded-but-small pools, deposit caps, prominent
   unaudited banner until the audit lands, monitoring on `Sync`/`Swap`
   event anomalies.
4. Invariant suite runs in CI on every commit (see `test/Invariants.t.sol`).

Report vulnerabilities: open a GitHub security advisory on
`mattcrypto12/loxley` (private disclosure). Do not exploit on any network
where value is at stake.
