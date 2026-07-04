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
          Every swap pays 0.30%. A twentieth of that — the Merry Men&apos;s
          Share — is carved off and handed back to the smallfolk of the
          greenwood.
        </p>
      </div>
      <SwapCard />
    </div>
  );
}
