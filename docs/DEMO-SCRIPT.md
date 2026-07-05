# Loxley — 3-Minute Demo Video Script

Target: ≤3:00, 1600×900 (or 1920×1080), dark room lighting matches the UI.
Record against the **local demo chain** (`make anvil` + `make demo` + `make web`)
so pools are deep and numbers look healthy; cut to the **testnet explorer**
at the end for the "it's real" beat. Keep the footer disclaimer visible in
at least one shot.

| # | Time | Screen | Say (or caption) |
|---|------|--------|------------------|
| 1 | 0:00–0:15 | Landing page, cursor idle. Fireflies drifting, hero glow. | "This is Loxley — the flagship DEX for Robinhood Chain. Every ecosystem gets one canonical exchange. We built this one with a conscience." |
| 2 | 0:15–0:40 | Click **Enter the Greenwood** → type 2 ETH → quote appears → point at the fee line. | "Standard 0.30% swap fee — but watch the split: 0.25% to liquidity providers, and 0.05% — the Merry Men's Share — is carved off for redistribution." |
| 3 | 0:40–0:55 | Click **Loose the arrow**. Let the arrow fly, thunk, gold-leaf burst, explorer receipt line. | (no narration — let the sound land) "…every swap is an arrow loosed." |
| 4 | 0:55–1:20 | Nav → **Hoards**. Scroll the table (TVL, volume, APR). Open ETH·GOLD → add liquidity (auto-ratio fills). | "Liquidity lives in Hoards. Provide two coins, earn 0.25% of every swap — position, share, and APR tracked live." |
| 5 | 1:20–2:05 | Nav → **Merry Men's Share**. Linger on the animated fee-flow diagram. Point at the eligibility checklist (3 green checks), the countdown, the chest holdings. Click **Ring the bell** on an ended epoch, then **Claim your cut**. | "Here's the heart of it. Weekly epochs. To claim you must have actually used the protocol in the last 30 days — and your wallet must be under the wealth threshold. Whales pay in; only the smallfolk claim out. Anyone can ring the bell to finalize an epoch. Claiming is one click. Every rule is a require statement you can read on-chain." |
| 6 | 2:05–2:25 | Nav → **Analytics**. Sweep across TVL area chart, gold volume bars, per-pool table, the gold "Merry Men's Share · all time" card. | "Analytics come straight from on-chain events — no indexer, no trust." |
| 7 | 2:25–2:50 | Switch network pill → **RH Testnet** (block heartbeat ticking). Cut to explorer.testnet.chain.robinhood.com showing the router's tx list. | "And it's not a mockup — Loxley is deployed on Robinhood Chain testnet today. Chain ID 46630. These are real transactions you can verify right now." |
| 8 | 2:50–3:00 | Back to landing hero. Hold. | "Loxley. Steal the spread. Share the spoils. The outlaw's true name — on Robinhood Chain." |

## Recording notes
- macOS: `Cmd+Shift+5` → record selected portion → frame the browser viewport only.
- Do a silent pass first for mouse choreography, then record narration over it
  (QuickTime → File → New Audio Recording, or record live if confident).
- Before recording, reset the demo for clean numbers:
  `pkill anvil && make anvil` (new terminal) `&& make demo`.
- Keep cursor movement slow; pause ~1s after every click so viewers register
  the state change.
- Export ≤100MB (HackQuest uploads) or upload unlisted to YouTube and link.
