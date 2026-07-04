"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { isLocalDemo } from "@/config/chains";

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

/**
 * On the local demo chain: a one-click demo wallet (no extension needed).
 * On real chains: the full RainbowKit connect flow with auto network switch.
 */
export function ConnectControls() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isLocalDemo) {
    return <ConnectButton chainStatus="icon" showBalance={false} />;
  }

  if (isConnected) {
    return (
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => disconnect()}
        className="btn-ghost px-4 py-2 text-sm font-mono"
        title="Disconnect demo wallet"
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ember-400 shadow-[0_0_8px_#3fe89e]" />
        {short(address)}
      </motion.button>
    );
  }

  const demoConnector = connectors.find((c) => c.id === "greenwoodDemo");

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      disabled={isPending || !demoConnector}
      onClick={() => demoConnector && connect({ connector: demoConnector })}
      className="btn-gold px-5 py-2.5 text-sm"
    >
      {isPending ? "Entering…" : "Enter the Greenwood"}
    </motion.button>
  );
}
