import { PlainTerms } from "@/components/PlainTerms";
import { SwapCard } from "@/components/SwapCard";

export default function SwapPage() {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-10 mt-2 flex flex-col items-center text-center">
        <p className="rise-in rise-in-1 mb-3 text-xs uppercase tracking-[0.4em] text-ember-400 text-glow-ember">
          The outlaw&apos;s true name
        </p>
        <h1 className="rise-in rise-in-2 engraved text-4xl font-semibold text-moon-100 sm:text-5xl">
          Steal the <span className="text-gold-400 text-glow-gold">spread</span>.
          <br className="sm:hidden" /> Share the{" "}
          <span className="text-gold-400 text-glow-gold">spoils</span>.
        </h1>
        <p className="rise-in rise-in-3 mx-auto mt-4 max-w-md text-sm leading-relaxed text-moon-500">
          Every swap pays 0.30%: 0.25% to liquidity providers, 0.025% to the
          Merry Men&apos;s Share for the smallfolk, and 0.025% to the guild
          that keeps the greenwood standing. Every split on-chain, immutable.
        </p>
        <PlainTerms
          summary="token swaps on a constant-product AMM (Uniswap-v2 design)."
          contracts={[
            { label: "Router", key: "router" },
            { label: "Factory", key: "factory" },
            { label: "FeeSplitter", key: "feeSplitter" },
          ]}
        >
          Trades route through the router (&quot;the Greenwood Path&quot;) with
          slippage limits and transaction deadlines on every call. Each pool
          holds two tokens; prices come from the ratio of reserves. The 0.30%
          swap fee stays in the pool for liquidity providers, except a 0.05%
          protocol fee minted as LP tokens and split 50/50 on-chain between
          the redistribution treasury and the development treasury.
        </PlainTerms>
      </div>
      <SwapCard />
    </div>
  );
}
