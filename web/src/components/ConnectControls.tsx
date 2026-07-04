"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { LOCAL_CHAIN_ID } from "@/config/chains";

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

/**
 * The full RainbowKit flow (MetaMask, Rainbow, Coinbase, WalletConnect…)
 * everywhere. On the local Greenwood chain there is additionally a
 * one-click, pre-funded demo wallet — no extension required.
 */
export function ConnectControls() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // connected via the demo burner → show our own chip (RainbowKit doesn't
  // know this connector)
  if (isConnected && connector?.id === "greenwoodDemo") {
    return (
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => disconnect()}
        className="btn-ghost px-4 py-2 text-sm font-mono"
        title="Disconnect demo wallet"
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ember-400 shadow-[0_0_8px_#3fe89e]" />
        {short(address)} · demo
      </motion.button>
    );
  }

  const demoConnector = connectors.find((c) => c.id === "greenwoodDemo");
  const showDemo = !isConnected && chainId === LOCAL_CHAIN_ID && demoConnector;

  return (
    <div className="flex items-center gap-2">
      {showDemo && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          disabled={isPending}
          onClick={() => connect({ connector: demoConnector, chainId: LOCAL_CHAIN_ID })}
          className="btn-gold px-4 py-2.5 text-sm"
          title="Pre-funded local wallet — no extension needed"
        >
          {isPending ? "Entering…" : "Demo wallet"}
        </motion.button>
      )}
      <ConnectButton
        chainStatus="icon"
        showBalance={false}
        accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
      />
    </div>
  );
}
