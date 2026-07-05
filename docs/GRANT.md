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
| London | ✅ buildathon ended | $415K total pool; Founder House follows the buildathon |
| **Dubai** | 🟢 **REGISTRATION OPEN — ~118 days left** | Online, 3-week buildathon, HackQuest platform |
| Singapore | ⏳ later in 2026 | Announced, not yet open |

**Live application URL: https://arbitrum-dubai.hackquest.io/**

### Why the Robinhood Chain track favors us
- Reserved podium spots: at least one top-3 slot in the main categories is
  reserved for projects building on Robinhood Chain.
- Exclusive prizes (based on London's structure): **Robinhood Innovation
  Award ($30K)** and **Robinhood Founder-in-Residence ($60K)** are open
  *only* to Robinhood Chain projects.
- Judging criteria (from NYC winners' announcement): *technical execution,
  product clarity, ecosystem alignment, long-term potential* — plus "clear
  user focus, promising architecture, concise roadmap."

### Application steps (HackQuest)
1. Create a HackQuest account (email or wallet login) at the Dubai URL above.
2. Register for "Arbitrum Open House Dubai: Online Buildathon" and select
   the **Robinhood Chain track**.
3. Form/register the team (solo is allowed on HackQuest; teams typically 1–5).
4. Build during the 3-week window (Loxley is already built and deployed —
   the window is for polish + the required artifacts).
5. Submit before the deadline: project profile, **public GitHub repo**,
   **demo video (~3 min)**, live demo URL, deployed contract addresses on
   Robinhood Chain testnet, and a short pitch deck.
6. Judging → winners; strong teams get invited toward Founder House /
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
| LoxleyFactory | `0xbA2717Be7ad661B5582d9050735d85Dec043225F` |
| GreenwoodRouter | `0xc1B3d94b980F83De0909cf7BB7da833aCfC56720` |
| MerryMenShare | `0xEC81858FaB25e9C5C081777B9243E68E5Bc7f6F5` |
| LoxToken ($LOX) | `0x6662Fb018E2f92ccA89B30C5c223004455b746CE` |
| BowStaking | `0x06F140568bE0f5eb7B562dd3ebBf037F6B95E9f5` |
| WETH (test) | `0xE8F8BaB71197A18DeF27799fb9295f142897156c` |

Four seeded pools (ETH/GOLD, ETH/SILV, ETH/LOX, GOLD/SILV); the treasury is
already accruing fee LP from real swaps. Wallet flow tested end-to-end with
MetaMask against the public RPC.

**Product surface:** swap (with slippage/deadline protection and a
signature arrow-flight interaction), liquidity add/remove with live APR,
the Merry Men's Share dashboard (eligibility checklist, epoch ledger,
permissionless finalize, one-click claim), $LOX staking, and analytics
(TVL/volume/per-pool, computed from on-chain events — no indexer
dependency). 40 Foundry tests across all money paths.

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
- [ ] **Pitch deck (5–8 slides)**: problem → mechanism → live-on-testnet
      proof → roadmap → team
- [ ] HackQuest account + Dubai registration (Robinhood Chain track)
- [ ] Team info: names/handles, contact email, region
- [ ] (Optional, strong signal) a hosted deployment of the web app
      (Vercel) pointed at `NEXT_PUBLIC_LOXLEY_NETWORK=robinhoodTestnet`

## 6. Fine print to keep straight

- Branding: Loxley uses the public-domain Robin Hood legend only. No
  Robinhood Markets logo/wordmark/feather/HOOD ticker anywhere. The footer
  carries the non-affiliation disclaimer — keep it in the demo video too.
- Contracts are unaudited; all public copy says so.
- The wealth-threshold eligibility check is documented as a v1 heuristic
  (sybil-gameable); the roadmap's M3 addresses it — reviewers respect
  honesty about limitations more than silence.
