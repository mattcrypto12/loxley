import { SwapCard } from "@/components/SwapCard";

export default function SwapPage() {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-10 mt-2 text-center">
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
      </div>
      <SwapCard />
    </div>
  );
}
