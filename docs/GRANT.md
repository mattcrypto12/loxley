# Loxley — Grant Submission Package

> Working document for the **Arbitrum Open House 2026 / Robinhood Chain
> $1M builder program**. Everything a reviewer or application form asks
> for, in one place.

---

## 1. The program (what we're applying to)

Robinhood Chain is sponsoring the **Arbitrum Open House 2026** with
**$1M for teams building on Robinhood Chain testnet**. The program runs as
city-branded online buildathons + in-person Founder Houses:

| Stop | Status (as of Jul 4, 2026) | Notes |
| --- | --- | --- |
| New York | ✅ concluded | Buildathon winners paid; $340K Founder House done |
| London | ✅ buildathon ended | $415K total; Robinhood-exclusive prizes appeared when its cycle spun up |
| **Dubai** | 🟡 **Page live, early stage** | $30K posted, prize breakdown "TBD", status "UnOpen", ~153-day register countdown |
| Singapore | ⏳ later in 2026 | Announced, not yet open |

**Application URL: https://arbitrum-dubai.hackquest.io/**

### The Robinhood connection — precisely stated
- **Program-wide (confirmed by Robinhood):** "$1 million of prizes for
  builders, backing teams building on the Robinhood Chain testnet, across
  New York, London, Singapore, and Dubai."
- **Dubai page today:** no tracks published yet, no Robinhood mention,
  breakdown TBD. London's page followed the same arc — bare at first, then
  gained a Robinhood track with exclusive prizes (**$30K Innovation Award**,
  **$60K Founder-in-Residence** at the Founder House stage). Expect (but do
  not assume) the same for Dubai; re-check the page as the event nears.
- Judging criteria (from NYC winners' announcement): *technical execution,
  product clarity, ecosystem alignment, long-term potential*. Building on
  Robinhood Chain testnet is the alignment story whatever the track names
  turn out to be.

### Application steps (HackQuest)
1. Create a HackQuest account (email or wallet login) at the Dubai URL above.
2. Register/enroll for "Arbitrum Open House Dubai: Online Buildathon"
   (if full registration is gated while status is "UnOpen", enroll and
   watch for it to open).
3. When tracks are published, pick the Robinhood Chain track if one exists;
   otherwise DeFi/Open — the project's chain speaks for itself.
4. Form/register the team (solo is allowed on HackQuest; teams typically 1–5).
5. Build during the buildathon window (Loxley is already built and deployed —
   the window is for polish + the required artifacts).
6. Submit before the deadline: project profile, **public GitHub repo**,
   **demo video (~3 min)**, live demo URL, deployed contract addresses on
   Robinhood Chain testnet, and a short pitch deck.
7. Judging → winners; strong teams get invited toward Founder House /
   Arbitrum Foundation case-by-case grants ($30K USDC reserved per stop).

---

## 2. The pitch

**One-liner:** Loxley is the flagship DEX for Robinhood Chain — a
Uniswap-v2-class AMM whose protocol fee is redistributed, on-chain and
transparently, to active small wallets. *Steal the spread, share the spoils.*

**Problem.** Every new chain needs a canonical DEX before anything else can
compose. Robinhood Chain has none yet. And on every existing chain, protocol
fees flow to insiders — the users who create the volume never see a satoshi
of it.

**Solution.** A deliberately boring, auditable constant-product AMM (the
exact v2 design that has secured billions for six years) with one twist at
the treasury layer: the 0.05% protocol fee (1/6 of the 0.30% swap fee)
accrues to the **Merry Men's Share** — a contract that divides each weekly
epoch's take pro-rata among wallets that actually used the protocol in the
last 30 days *and* hold less than a wealth threshold. Whales pay in like
everyone else; only the smallfolk claim out. It is Robin Hood as mechanism
design, on Robinhood's own chain — and every rule of it is inspectable
on-chain.

**Why us / why now.** Fully working product, already live on Robinhood
Chain testnet (addresses below), with contract tests on every money path
and a distinctive, finished UI — not a hackathon skeleton.

## 3. What's live (verifiable today)

**Robinhood Chain testnet, chainId 46630** — explorer:
https://explorer.testnet.chain.robinhood.com

| Contract | Address |
| --- | --- |
| LoxleyFactory | `0x9CbDE27ACEdd5DDd4BC7A152247BeB929C1144F7` |
| GreenwoodRouter | `0xD76e7a2A8B3c06D62b3F57622a15b9F27945CEA2` |
| MerryMenShare | `0xf1553459b978Aa8c9B85b0769dB3b3D8D2AD1356` |
| LoxToken ($LOX) | `0x5355Ca93a24821bc77ee6d19DAF29219328afBc6` |
| BowStaking | `0xb274cf9770D87cb5c1D3DcAc0495D14814EbB809` |
| WETH (test) | `0x1C61880f2F4ce64EaD62a347ECAEA39508b68544` |

Four seeded pools (ETH/GOLD, ETH/SILV, ETH/LOX, GOLD/SILV); the treasury is
already accruing fee LP from real swaps. Wallet flow tested end-to-end with
MetaMask against the public RPC.

**Product surface:** swap (with slippage/deadline protection and a
signature arrow-flight interaction), liquidity add/remove with live APR,
the Merry Men's Share dashboard (eligibility checklist, epoch ledger,
permissionless finalize, one-click claim), $LOX staking, and analytics
(TVL/volume/per-pool, computed from on-chain events — no indexer
dependency). 44 Foundry tests across all money paths, including proofs that
Hoards stay invariant under stock-token corporate actions (ERC-8056).

## 4. Roadmap & use of funds

| Milestone | Target | Funded by |
| --- | --- | --- |
| M1 — Security: external audit of core + treasury, fuzz/invariant suite expansion | +6 weeks | grant |
| M2 — Mainnet launch on Robinhood Chain (canonical WETH, audited build, timelocked admin) | +10 weeks | grant |
| M3 — Merry Men's Share v2: sybil-resistant eligibility (proof-of-personhood or stake-weighted decay), LP fee dashboards | +16 weeks | grant |
| M4 — Ecosystem: token lists, router SDK, integrations with RWA assets as they land on Robinhood Chain | ongoing | grant + revenue |

Ask: buildathon prize + Foundation grant consideration. Every dollar goes
to audit and mainnet hardening — the product itself is already built.

## 5. Submission checklist

- [x] Deployed on Robinhood Chain testnet (46630)
- [x] All contracts **source-verified on Blockscout** (per their deploy docs)
- [x] **Stock-token ready**: ERC-8056 scaled-UI mock + tests proving Hoards
      are invariant under corporate actions — see
      [ROBINHOOD-CHAIN.md](ROBINHOOD-CHAIN.md)
- [x] Public demo runnable end-to-end (local + testnet)
- [x] Contract tests (40) green
- [x] LICENSE (GPL-3.0), disclaimer, no Robinhood Markets trademarks used
- [x] **Public GitHub repo** — https://github.com/mattcrypto12/loxley
- [ ] **Demo video (~3 min)** — full shot list + narration script ready in
      [DEMO-SCRIPT.md](DEMO-SCRIPT.md); needs a human voice + screen recording.
- [x] **Pitch deck** — [loxley-pitch-deck.pptx](loxley-pitch-deck.pptx)
      (7 slides: problem → mechanism → live proof → criteria fit → roadmap)
- [ ] HackQuest account + Dubai registration (Robinhood Chain track)
- [ ] Team info: names/handles, contact email, region
- [x] **Live demo URL**: https://loxley-dex.vercel.app (Vercel, pointed at
      Robinhood Chain testnet)

## 6. Fine print to keep straight

- Branding: Loxley uses the public-domain Robin Hood legend only. No
  Robinhood Markets logo/wordmark/feather/HOOD ticker anywhere. The footer
  carries the non-affiliation disclaimer — keep it in the demo video too.
- Contracts are unaudited; all public copy says so.
- The wealth-threshold eligibility check is documented as a v1 heuristic
  (sybil-gameable); the roadmap's M3 addresses it — reviewers respect
  honesty about limitations more than silence.
